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

// Obsidian loads the plugin entry module and instantiates its default
// export. The default export is the Obsidian plugin contract; the named
// export lets other modules import the type without the runtime cycle.
export class ThothPlugin extends Plugin {
  settings: ThothSettings = { ...DEFAULT_SETTINGS };
  readonly queue = new OperationQueue((queue) => this.saveQueue(queue));
  private detachVaultListener?: () => void;

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

    this.detachVaultListener = attachVaultListener({
      vault: this.app.vault,
      queue: this.queue,
      getDeviceId: () => this.settings.deviceId,
    });
  }

  onunload(): void {
    if (this.detachVaultListener) {
      this.detachVaultListener();
      this.detachVaultListener = undefined;
    }
  }

  /** Restores settings and the persisted operation queue on startup. */
  async loadPersisted(): Promise<void> {
    const data = await loadPluginData(this.storage());
    this.settings = data.settings;
    this.queue.replaceAll(data.queue);
  }

  /** Persists settings and the queue as one plugin data blob. */
  async saveSettings(): Promise<void> {
    await savePluginData(this.storage(), {
      settings: this.settings,
      queue: [...this.queue.all],
    });
  }

  async saveQueue(queue: OperationQueue): Promise<void> {
    await savePluginData(this.storage(), {
      settings: this.settings,
      queue: [...queue.all],
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

  private storage(): Persistence {
    return {
      loadData: () => this.loadData(),
      saveData: (data) => this.saveData(data),
    };
  }
}

export default ThothPlugin;
