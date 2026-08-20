export interface ThothSettings {
  serverUrl: string;
  vaultId: string;
  deviceId: string;
  apiKey: string;
}

export const DEFAULT_SETTINGS: Readonly<ThothSettings> = {
  serverUrl: '',
  vaultId: '',
  deviceId: '',
  apiKey: '',
};

/**
 * Minimal persistence surface implemented by the Obsidian plugin
 * (loadData/saveData). Kept as an interface so settings logic can be
 * tested without the Obsidian runtime.
 */
export interface SettingsStorage {
  loadData(): Promise<unknown>;
  saveData(data: unknown): Promise<void>;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * Loads settings from storage. Saved data is external input and may be
 * malformed or missing: every field is validated and falls back to the
 * default rather than crashing the plugin.
 */
export async function loadSettings(
  storage: SettingsStorage
): Promise<ThothSettings> {
  let data: unknown;
  try {
    data = await storage.loadData();
  } catch {
    // Intentionally swallow: unreadable settings must not break startup.
    data = null;
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ...DEFAULT_SETTINGS };
  }

  const record = data as Record<string, unknown>;
  return {
    serverUrl: asString(record.serverUrl, DEFAULT_SETTINGS.serverUrl),
    vaultId: asString(record.vaultId, DEFAULT_SETTINGS.vaultId),
    deviceId: asString(record.deviceId, DEFAULT_SETTINGS.deviceId),
    apiKey: asString(record.apiKey, DEFAULT_SETTINGS.apiKey),
  };
}

export async function saveSettings(
  storage: SettingsStorage,
  settings: ThothSettings
): Promise<void> {
  await storage.saveData(settings);
}

/** Returns a new settings object with one field replaced (immutable). */
export function withSetting<S extends ThothSettings, K extends keyof S>(
  settings: S,
  key: K,
  value: S[K]
): S {
  return { ...settings, [key]: value };
}
