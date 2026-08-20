import { App, PluginSettingTab, Setting, TextComponent } from 'obsidian';

import type { ThothPlugin } from './main.js';
import { withSetting, type ThothSettings } from './settings.js';

export class ThothSettingTab extends PluginSettingTab {
  private readonly plugin: ThothPlugin;

  constructor(app: App, plugin: ThothPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

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
      .setDesc('Identifier of the vault registered on the server')
      .addText((text) => this.bindConfig(text, 'vaultId', 'vault-id'));

    new Setting(containerEl)
      .setName('Device ID')
      .setDesc('Device identifier returned when the device was registered')
      .addText((text) => this.bindConfig(text, 'deviceId', 'device-id'));

    new Setting(containerEl)
      .setName('API key')
      .setDesc('API key assigned to this device')
      .addText((text) => {
        text.inputEl.type = 'password';
        this.bindConfig(text, 'apiKey', 'api-key');
      });

    new Setting(containerEl)
      .setName('Connection')
      .setDesc('Check server reachability and device authentication')
      .addButton((button) =>
        button.setButtonText('Check connection').onClick(() => {
          void this.plugin.checkConnection();
        })
      );
  }

  private bindConfig(
    text: TextComponent,
    key: keyof ThothSettings,
    placeholder: string
  ): void {
    text
      .setPlaceholder(placeholder)
      .setValue(this.plugin.settings[key])
      .onChange(async (value) => {
        this.plugin.settings = withSetting(this.plugin.settings, key, value);
        await this.plugin.saveSettings();
      });
  }
}
