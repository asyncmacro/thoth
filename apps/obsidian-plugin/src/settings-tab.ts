import { App, PluginSettingTab, Setting, TextComponent } from 'obsidian';

import type { ThothPlugin } from './main.js';
import { withSetting, type ThothSettings } from './settings.js';
import { defaultDeviceName } from './device-name.js';

export class ThothSettingTab extends PluginSettingTab {
  private readonly plugin: ThothPlugin;

  constructor(app: App, plugin: ThothPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    // Refresh device list silently on each open
    void this.plugin.refreshDeviceList();

    new Setting(containerEl)
      .setName('Server URL')
      .setDesc(
        'Base URL of the Thoth sync server, e.g. https://sync.example.com'
      )
      .addText((text) =>
        this.bindConfig(text, 'serverUrl', 'https://sync.example.com')
      );

    new Setting(containerEl)
      .setName('Vault ID')
      .setDesc('Identifier of the vault on the server')
      .addText((text) => this.bindConfig(text, 'vaultId', ''))
      .addButton((btn) =>
        btn.setButtonText('Create new vault').onClick(async () => {
          await this.plugin.createVault();
          this.display();
        })
      );

    // Device section
    const { deviceId, apiKey, deviceName } = this.plugin.settings;
    const registered = Boolean(deviceId && apiKey);

    if (registered) {
      new Setting(containerEl)
        .setName('Current device')
        .setDesc(
          `Registered as ${deviceName || 'Unknown'} (${deviceId.slice(0, 8)}…)`
        )
        .addButton((btn) =>
          btn
            .setButtonText('Remove this device')
            .onClick(() => void this.plugin.removeDevice())
        )
        .addButton((btn) =>
          btn
            .setButtonText('Rotate API key')
            .onClick(() => void this.plugin.rotateApiKey())
        )
        .addButton((btn) =>
          btn
            .setButtonText('Check connection')
            .onClick(() => void this.plugin.checkConnection())
        );
    } else {
      new Setting(containerEl)
        .setName('Device name')
        .setDesc('Human-readable name for this device')
        .addText((text) => {
          const value = deviceName || defaultDeviceName();
          text
            .setPlaceholder(defaultDeviceName())
            .setValue(value)
            .onChange(async (v) => {
              this.plugin.settings = withSetting(
                this.plugin.settings,
                'deviceName',
                v
              );
              await this.plugin.saveSettings();
            });
        });

      new Setting(containerEl)
        .setName('')
        .setDesc('')
        .addButton((btn) =>
          btn.setButtonText('Register this device').onClick(async () => {
            await this.plugin.registerDevice();
            this.display();
          })
        );
    }

    // Devices list
    new Setting(containerEl)
      .setName('Registered devices')
      .setDesc('Shows all devices for this vault')
      .addButton((btn) =>
        btn.setButtonText('Refresh list').onClick(async () => {
          await this.plugin.refreshDeviceList();
          this.display();
        })
      );

    const list = this.plugin.deviceList ?? [];
    if (list.length === 0) {
      new Setting(containerEl)
        .setName('No devices')
        .setDesc('Server returned no devices or not loaded yet.');
    } else {
      for (const d of list) {
        const isCurrent = d.id === deviceId;
        new Setting(containerEl)
          .setName(isCurrent ? d.name || d.id : d.name || d.id)
          .setDesc(
            `ID: ${d.id} • created ${new Date(d.createdAt).toLocaleDateString()}${isCurrent ? ' • current' : ''}`
          )
          .addButton((btn) =>
            btn
              .setButtonText('Remove')
              .setWarning()
              .onClick(async () => {
                await this.plugin.removeDeviceById(d.id);
                this.display();
              })
          );
      }
    }

    // Connection diagnostics & sync statistics
    new Setting(containerEl)
      .setName('Connection diagnostics')
      .setDesc('Test connection and view sync statistics')
      .addButton((btn) =>
        btn.setButtonText('Test connection').onClick(() => void this.plugin.checkConnection())
      );

    new Setting(containerEl)
      .setName('Sync statistics')
      .setDesc(`Revision: ${this.plugin.serverRevision} • Queue: ${this.plugin.queue.size} • Last sync: ${new Date().toLocaleString()}`);

  }

  private bindConfig(
    text: TextComponent,
    key: keyof ThothSettings,
    placeholder: string
  ): void {
    text
      .setPlaceholder(placeholder)
      .setValue(this.plugin.settings[key])
      .onChange(async (value: string) => {
        this.plugin.settings = withSetting(this.plugin.settings, key, value);
        await this.plugin.saveSettings();
      });
  }
}
