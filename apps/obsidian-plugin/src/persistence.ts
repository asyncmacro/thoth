import type { Operation } from '@thoth/protocol';
import { operationSchema } from '@thoth/validation';

import { parseSettings, type ThothSettings } from './settings.js';

/**
 * Persistence surface implemented by the Obsidian plugin (loadData /
 * saveData). Kept as an interface so plugin storage logic can be tested
 * without the Obsidian runtime.
 */
export interface Persistence {
  loadData(): Promise<unknown>;
  saveData(data: unknown): Promise<void>;
}

/** The single JSON blob Obsidian stores per plugin. */
export interface PluginData {
  settings: ThothSettings;
  queue: Operation[];
  serverRevision: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Validates persisted queue entries with the shared operation schema. */
function parseQueue(value: unknown): Operation[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const operations: Operation[] = [];
  for (const item of value) {
    const parsed = operationSchema(item);
    if (parsed.ok) {
      operations.push(parsed.value);
    }
  }
  return operations;
}

/** Parses the persisted plugin blob, tolerating missing or malformed parts. */
export function parsePluginData(value: unknown): PluginData {
  if (!isRecord(value)) {
    return { settings: parseSettings(undefined), queue: [], serverRevision: 0 };
  }
  const serverRevisionRaw = value.serverRevision;
  const serverRevision =
    typeof serverRevisionRaw === 'number' &&
    Number.isInteger(serverRevisionRaw) &&
    serverRevisionRaw >= 0
      ? serverRevisionRaw
      : 0;
  return {
    settings: parseSettings(value.settings),
    queue: parseQueue(value.queue),
    serverRevision,
  };
}

export async function loadPluginData(
  persistence: Persistence
): Promise<PluginData> {
  let raw: unknown;
  try {
    raw = await persistence.loadData();
  } catch {
    // Intentionally swallow: unreadable persisted data must not break
    // startup; the plugin falls back to defaults and an empty queue.
    raw = null;
  }
  return parsePluginData(raw);
}

export async function savePluginData(
  persistence: Persistence,
  data: PluginData
): Promise<void> {
  await persistence.saveData(data);
}
