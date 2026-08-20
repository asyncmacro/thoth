/**
 * Vault state as seen by the operation engine.
 *
 * A vault state is a revision plus a map of note paths to contents.
 * It is immutable: applying operations produces a new state.
 */

import type { Revision } from '@thoth/protocol';

export interface VaultState {
  revision: Revision;
  files: Record<string, string>;
}

export function createVaultState(): VaultState {
  return { revision: 0, files: {} };
}
