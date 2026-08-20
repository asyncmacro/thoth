import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  withSetting,
  type SettingsStorage,
  type ThothSettings,
} from '../settings.js';

class MemoryStorage implements SettingsStorage {
  data: unknown;

  constructor(data: unknown = null) {
    this.data = data;
  }

  loadData(): Promise<unknown> {
    return Promise.resolve(this.data);
  }

  saveData(data: unknown): Promise<void> {
    this.data = data;
    return Promise.resolve();
  }
}

describe('loadSettings', () => {
  it('returns defaults when no data is stored', async () => {
    expect(await loadSettings(new MemoryStorage())).toEqual({
      ...DEFAULT_SETTINGS,
    });
  });

  it('returns defaults when stored data is not an object', async () => {
    expect(await loadSettings(new MemoryStorage('nope'))).toEqual({
      ...DEFAULT_SETTINGS,
    });
    expect(await loadSettings(new MemoryStorage(42))).toEqual({
      ...DEFAULT_SETTINGS,
    });
    expect(await loadSettings(new MemoryStorage(['a']))).toEqual({
      ...DEFAULT_SETTINGS,
    });
  });

  it('returns defaults when storage throws', async () => {
    const storage: SettingsStorage = {
      loadData(): Promise<unknown> {
        return Promise.reject(new Error('disk unreadable'));
      },
      saveData(): Promise<void> {
        return Promise.resolve();
      },
    };
    expect(await loadSettings(storage)).toEqual({ ...DEFAULT_SETTINGS });
  });

  it('merges partial stored data with defaults', async () => {
    const storage = new MemoryStorage({
      serverUrl: 'https://sync.example.com',
    });
    const settings = await loadSettings(storage);
    expect(settings.serverUrl).toBe('https://sync.example.com');
    expect(settings.vaultId).toBe('');
    expect(settings.apiKey).toBe('');
  });

  it('ignores non-string field values', async () => {
    const storage = new MemoryStorage({ serverUrl: 123, vaultId: true });
    expect(await loadSettings(storage)).toEqual({ ...DEFAULT_SETTINGS });
  });
});

describe('saveSettings', () => {
  it('persists settings through storage', async () => {
    const storage = new MemoryStorage();
    const settings: ThothSettings = {
      serverUrl: 'u',
      vaultId: 'v',
      deviceId: 'd',
      apiKey: 'k',
    };
    await saveSettings(storage, settings);
    expect(storage.data).toEqual(settings);
  });
});

describe('withSetting', () => {
  it('returns a new settings object with one field replaced', () => {
    const base: ThothSettings = { ...DEFAULT_SETTINGS };
    const next = withSetting(base, 'serverUrl', 'https://x');
    expect(next.serverUrl).toBe('https://x');
    expect(base.serverUrl).toBe('');
  });
});
