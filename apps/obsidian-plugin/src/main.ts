import { Notice, Plugin } from 'obsidian';

import { checkHealth, testAuthentication } from './api.js';
import { OperationQueue } from './queue.js';
import { attachVaultListener } from './vault-listener.js';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type SettingsStorage,
  type ThothSettings,
} from './settings.js';
import { ThothSettingTab } from './settings-tab.js';

// Obsidian loads the plugin entry module and instantiates its default
// export. The default export is the Obsidian plugin contract; the named
// export lets other modules import the type without the runtime cycle.
export class ThothPlugin extends Plugin {
  settings: ThothSettings = { ...DEFAULT_SETTINGS };
  readonly queue = new OperationQueue();
  private detachVaultListener?: () => void;

  async onload(): Promise<void> {
    await this.loadSettings();

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

  async loadSettings(): Promise<void> {
    this.settings = await loadSettings(this.storage());
  }

  async saveSettings(): Promise<void> {
    await saveSettings(this.storage(), this.settings);
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

  private storage(): SettingsStorage {
    return {
      loadData: () => this.loadData(),
      saveData: (data) => this.saveData(data),
    };
  }
}

export default ThothPlugin;
