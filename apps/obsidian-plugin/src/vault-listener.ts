import type { TAbstractFile, TFile, Vault } from 'obsidian';

import type { FileChange } from './change-detection.js';
import { changeToDraft } from './change-detection.js';
import type { OperationQueue } from './queue.js';

interface ListenerOptions {
  vault: Vault;
  queue: OperationQueue;
  /** Returns the configured device id; empty until the user registers. */
  getDeviceId: () => string;
}

/**
 * Structural check for markdown notes. Avoids `instanceof TFile` so the
 * listener can be tested with plain fixtures; folders and non-markdown
 * files have no `extension === 'md'`.
 */
function isMarkdownNote(file: TAbstractFile): file is TFile {
  return (file as TFile).extension === 'md';
}

/**
 * Watches vault file events and queues the corresponding operations.
 * Returns an unsubscribe function for use during plugin unload.
 *
 * Rename is followed by a modify event in Obsidian; the redundant
 * replace-content operation is harmless (the server applies it as a
 * no-op content write) and can be deduplicated in a later phase.
 */
export function attachVaultListener(options: ListenerOptions): () => void {
  const { vault, queue, getDeviceId } = options;

  const enqueue = (change: FileChange): void => {
    const deviceId = getDeviceId().trim();
    if (!deviceId) {
      // Without a registered device the operation could never be pushed.
      return;
    }
    queue.enqueue(changeToDraft(change), deviceId);
  };

  const handleCreateOrModify = async (file: TAbstractFile): Promise<void> => {
    if (!isMarkdownNote(file)) {
      return;
    }
    const content = await vault.read(file);
    enqueue({ kind: 'create', path: file.path, content });
  };

  const handleModify = async (file: TAbstractFile): Promise<void> => {
    if (!isMarkdownNote(file)) {
      return;
    }
    const content = await vault.read(file);
    enqueue({ kind: 'modify', path: file.path, content });
  };

  const handleRename = (file: TAbstractFile, oldPath: string): void => {
    if (!isMarkdownNote(file)) {
      return;
    }
    enqueue({ kind: 'rename', oldPath, newPath: file.path });
  };

  const handleDelete = (file: TAbstractFile): void => {
    if (!isMarkdownNote(file)) {
      return;
    }
    enqueue({ kind: 'delete', path: file.path });
  };

  const refs = [
    vault.on('create', (file) => {
      void handleCreateOrModify(file);
    }),
    vault.on('modify', (file) => {
      void handleModify(file);
    }),
    vault.on('rename', (file, oldPath) => {
      handleRename(file, oldPath);
    }),
    vault.on('delete', (file) => {
      handleDelete(file);
    }),
  ];

  return () => {
    for (const ref of refs) {
      vault.offref(ref);
    }
  };
}
