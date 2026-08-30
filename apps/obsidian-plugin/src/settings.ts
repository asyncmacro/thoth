export interface ThothSettings {
  serverUrl: string;
  vaultId: string;
  deviceId: string;
  apiKey: string;
  deviceName: string;
  /** File extensions synchronized as text files, e.g. ["md", "txt"]. */
  syncedExtensions: string[];
}

export const DEFAULT_SETTINGS: Readonly<ThothSettings> = {
  serverUrl: '',
  vaultId: '',
  deviceId: '',
  apiKey: '',
  deviceName: '',
  syncedExtensions: ['md'],
};

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asExtensionList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_SETTINGS.syncedExtensions];
  }
  const extensions: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }
    const ext = item.trim().toLowerCase().replace(/^\./, '');
    if (ext && !extensions.includes(ext)) {
      extensions.push(ext);
    }
  }
  return extensions.length > 0
    ? extensions
    : [...DEFAULT_SETTINGS.syncedExtensions];
}

/**
 * Parses settings from persisted plugin data. Saved data is external
 * input and may be malformed: every field is validated and falls back to
 * the default rather than crashing the plugin.
 */
export function parseSettings(value: unknown): ThothSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_SETTINGS };
  }

  const record = value as Record<string, unknown>;
  return {
    serverUrl: asString(record.serverUrl, DEFAULT_SETTINGS.serverUrl),
    vaultId: asString(record.vaultId, DEFAULT_SETTINGS.vaultId),
    deviceId: asString(record.deviceId, DEFAULT_SETTINGS.deviceId),
    apiKey: asString(record.apiKey, DEFAULT_SETTINGS.apiKey),
    deviceName: asString(record.deviceName, DEFAULT_SETTINGS.deviceName),
    syncedExtensions: asExtensionList(record.syncedExtensions),
  };
}

/** Returns a new settings object with one field replaced (immutable). */
export function withSetting<S extends ThothSettings, K extends keyof S>(
  settings: S,
  key: K,
  value: S[K]
): S {
  return { ...settings, [key]: value };
}
