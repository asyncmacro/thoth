import type { Operation } from '@thoth/protocol';

/**
 * Minimal vault adapter required to apply operations.
 * Using a narrow interface keeps the module testable without Obsidian.
 */
export interface VaultAdapter {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  create(path: string, content: string): Promise<void>;
  modify(file: { path: string }, content: string): Promise<void>;
  rename(file: { path: string }, newPath: string): Promise<void>;
  delete(path: string): Promise<void>;
}

/**
 * Applies a single operation to the vault.
 *
 * The function is intentionally side-effecting but otherwise pure in its
 * mapping from operation kind to vault mutation.
 */
export async function applyOperationToVault(
  vault: VaultAdapter,
  operation: Operation
): Promise<void> {
  switch (operation.type) {
    case 'create-note': {
      const { path, content } = operation.payload;
      const exists = await vault.exists(path);
      if (exists) {
        // If the note already exists, treat create as an upsert.
        await vault.modify({ path }, content);
      } else {
        await vault.create(path, content);
      }
      break;
    }
    case 'replace-content': {
      const { path, content } = operation.payload;
      const exists = await vault.exists(path);
      if (!exists) {
        // Create missing file to keep the operation log consistent.
        await vault.create(path, content);
      } else {
        await vault.modify({ path }, content);
      }
      break;
    }
    case 'rename-note': {
      const { oldPath, newPath } = operation.payload;
      const exists = await vault.exists(oldPath);
      if (exists) {
        await vault.rename({ path: oldPath }, newPath);
      }
      break;
    }
    case 'delete-note': {
      const { path } = operation.payload;
      const exists = await vault.exists(path);
      if (exists) {
        await vault.delete(path);
      }
      break;
    }
  }
}

/**
 * Applies a batch of operations in order, skipping no-ops silently.
 */
export async function applyOperationsToVault(
  vault: VaultAdapter,
  operations: readonly Operation[]
): Promise<void> {
  for (const op of operations) {
    await applyOperationToVault(vault, op);
  }
}

/**
 * Restores a vault from a snapshot by writing all files.
 * Existing files are overwritten with the snapshot content.
 */
export async function applySnapshotToVault(
  vault: VaultAdapter,
  files: Record<string, string>
): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    const exists = await vault.exists(path);
    if (exists) {
      await vault.modify({ path }, content);
    } else {
      await vault.create(path, content);
    }
  }
}
