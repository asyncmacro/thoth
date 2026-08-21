import { Notice, Plugin } from 'obsidian';

import { checkHealth, testAuthentication } from './api.js';
import {
  loadPluginData,
  savePluginData,
  type Persistence,
} from './persistence.js';
import { OperationQueue } from './queue.js';
import { attachVaultListener } from './vault-listener.js';
import { DEFAULT_SETTINGS, type ThothSettings } from './settings.js';
import { ThothSettingTab } from './settings-tab.js';
import { uploadOperations, acknowledgeOperations, downloadAndApply, downloadSnapshot } from './sync-engine.js';
import { RetryScheduler } from './retry-scheduler.js';
import type { VaultAdapter } from './vault-applier.js';
import { applySnapshotToVault } from './vault-applier.js';

// Obsidian loads the plugin entry module and instantiates its default
// export. The default export is the Obsidian plugin contract; the named
// export lets other modules import the type without the runtime cycle.
export class ThothPlugin extends Plugin {
  settings: ThothSettings = { ...DEFAULT_SETTINGS };
  readonly queue = new OperationQueue((queue) => this.saveQueue(queue));
  serverRevision = 0;
  private detachVaultListener?: () => void;
  private scheduler?: RetryScheduler;
  private isSyncing = false;

  async onload(): Promise<void> {
    await this.loadPersisted();

    this.addSettingTab(new ThothSettingTab(this.app, this));

    this.addCommand({
      id: 'thoth-check-connection',
      name: 'Check Thoth connection',
      callback: () => {
        void this.checkConnection();
      },
    });

    this.addCommand({
      id: 'thoth-sync-now',
      name: 'Sync now',
      callback: () => {
        void this.manualSync();
      },
    });

    this.detachVaultListener = attachVaultListener({
      vault: this.app.vault,
      queue: this.queue,
      getDeviceId: () => this.settings.deviceId,
    });

    this.scheduler = new RetryScheduler({
      task: () => this.performSync(),
      baseIntervalMs: 60_000,
      maxDelayMs: 600_000,
    });
    this.scheduler.start();

    // Initial synchronization
    void this.performSync();
  }

  onunload(): void {
    if (this.detachVaultListener) {
      this.detachVaultListener();
      this.detachVaultListener = undefined;
    }
    if (this.scheduler) {
      this.scheduler.stop();
      this.scheduler = undefined;
    }
  }

  /** Restores settings and the persisted operation queue on startup. */
  async loadPersisted(): Promise<void> {
    const data = await loadPluginData(this.storage());
    this.settings = data.settings;
    this.queue.replaceAll(data.queue);
    this.serverRevision = data.serverRevision;
  }

  /** Persists settings and the queue as one plugin data blob. */
  async saveSettings(): Promise<void> {
    await savePluginData(this.storage(), {
      settings: this.settings,
      queue: [...this.queue.all],
      serverRevision: this.serverRevision,
    });
  }

  async saveQueue(queue: OperationQueue): Promise<void> {
    await savePluginData(this.storage(), {
      settings: this.settings,
      queue: [...queue.all],
      serverRevision: this.serverRevision,
    });
  }

  async checkConnection(): Promise<void> {
    if (!this.settings.serverUrl) {
      new Notice('Thoth: configure a server URL first');
      return;
    }

    const health = await checkHealth(this.settings.serverUrl);
    if (!health.ok) {
      new Notice(`Thoth: ${health.message}`);
      return;
    }

    const auth = await testAuthentication({
      serverUrl: this.settings.serverUrl,
      vaultId: this.settings.vaultId,
      deviceId: this.settings.deviceId,
      apiKey: this.settings.apiKey,
    });
    new Notice(`Thoth: ${auth.message}`);
  }

  async manualSync(): Promise<void> {
    if (this.scheduler) {
      await this.scheduler.trigger();
    } else {
      await this.performSync();
    }
    new Notice('Thoth: sync triggered');
  }

  private async performSync(): Promise<void> {
    if (this.isSyncing) {
      console.debug('Thoth: sync already in progress, skipping');
      return;
    }
    this.isSyncing = true;
    let syncSucceeded = false;
    try {
      if (
        !this.settings.serverUrl ||
        !this.settings.vaultId ||
        !this.settings.deviceId ||
        !this.settings.apiKey
      ) {
        console.debug('Thoth: sync skipped, settings incomplete');
        return;
      }

      const startedRevision = this.serverRevision;
      console.debug('Thoth: sync started', { revision: startedRevision, queueSize: this.queue.size });

      // Upload queued operations
      if (this.queue.size > 0) {
        const baseRevision = this.serverRevision;
        const ops = [...this.queue.all];
        const uploadResult = await uploadOperations({
          serverUrl: this.settings.serverUrl,
          vaultId: this.settings.vaultId,
          baseRevision,
          operations: ops,
        });
        if (uploadResult.ok) {
          const newRevision = uploadResult.newRevision;
          const removed = acknowledgeOperations(this.queue, baseRevision, newRevision);
          this.serverRevision = newRevision;
          await this.saveSettings();
          console.debug('Thoth: uploaded', { uploaded: removed, newRevision });
        } else {
          console.warn('Thoth: upload failed, will retry on next sync', { error: uploadResult.error, baseRevision });
        }
      }

      const adapter = this.createVaultAdapter();

      // Restore from snapshot on initial sync
      if (this.serverRevision === 0) {
        const snapshotResult = await downloadSnapshot({
          serverUrl: this.settings.serverUrl,
          vaultId: this.settings.vaultId,
        });
        if (snapshotResult.ok) {
          await applySnapshotToVault(adapter, snapshotResult.files);
          this.serverRevision = snapshotResult.revision;
          await this.saveSettings();
          console.debug('Thoth: restored from snapshot', { revision: snapshotResult.revision, files: Object.keys(snapshotResult.files).length });
        } else {
          console.warn('Thoth: snapshot restore failed', { error: snapshotResult.error });
        }
      }

      // Download missing operations and apply locally
      const downloadResult = await downloadAndApply({
        serverUrl: this.settings.serverUrl,
        vaultId: this.settings.vaultId,
        sinceRevision: this.serverRevision,
        vault: adapter,
      });
      if (downloadResult.ok) {
        this.serverRevision = downloadResult.newRevision;
        await this.saveSettings();
        console.debug('Thoth: downloaded', { from: startedRevision, to: this.serverRevision });
        syncSucceeded = true;
      } else {
        console.warn('Thoth: download failed, will retry on next sync', { error: downloadResult.error });
      }
    } catch (error) {
      console.error('Thoth: sync failed with exception', error);
    } finally {
      this.isSyncing = false;
      // Provide user feedback only for manual triggers; periodic sync stays silent
    }
  }

  private createVaultAdapter(): VaultAdapter {
    const vault = this.app.vault;
    return {
      exists: async (path: string) => {
        const file = vault.getAbstractFileByPath(path);
        return file !== null;
      },
      read: async (path: string) => {
        const file = vault.getAbstractFileByPath(path);
        if (!file) {
          throw new Error(`File not found: ${path}`);
        }
        return await vault.read(file as any);
      },
      create: async (path: string, content: string) => {
        await vault.create(path, content);
      },
      modify: async (file: { path: string }, content: string) => {
        const f = vault.getAbstractFileByPath(file.path);
        if (f) {
          await vault.modify(f as any, content);
        }
      },
      rename: async (file: { path: string }, newPath: string) => {
        const f = vault.getAbstractFileByPath(file.path);
        if (f) {
          await vault.rename(f as any, newPath);
        }
      },
      delete: async (path: string) => {
        const file = vault.getAbstractFileByPath(path);
        if (file) {
          await vault.delete(file);
        }
      },
    };
  }

  private storage(): Persistence {
    return {
      loadData: () => this.loadData(),
      saveData: (data) => this.saveData(data),
    };
  }
}

export default ThothPlugin;
