import type { TAbstractFile, TFile, Vault } from 'obsidian';

import type { FileChange } from './change-detection.js';
import { changeToDraft } from './change-detection.js';
import type { OperationQueue } from './queue.js';

interface ListenerOptions {
  vault: Vault;
  queue: OperationQueue;
  /** Returns the configured device id; empty until the user registers. */
  getDeviceId: () => string;
  /** Returns true while sync is applying server changes to the vault. */
  isSyncing?: () => boolean;
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
 * Local processing failures (e.g. unreadable files) are logged and the
 * event is skipped rather than propagated to Obsidian's event loop.
 *
 * Rename is followed by a modify event in Obsidian; the redundant
 * replace-content operation is harmless (the server applies it as a
 * no-op content write) and can be deduplicated in a later phase.
 */
export function attachVaultListener(options: ListenerOptions): () => void {
  const { vault, queue, getDeviceId } = options;

  const safely = async (work: () => Promise<void>): Promise<void> => {
    try {
      await work();
    } catch (error) {
      console.error('Thoth: failed to handle vault event', error);
    }
  };

  const enqueue = async (change: FileChange): Promise<void> => {
    if (options.isSyncing?.()) {
      // Ignore changes we made ourselves while applying server state
      return;
    }
    const deviceId = getDeviceId().trim();
    if (!deviceId) {
      // Without a registered device the operation could never be pushed.
      return;
    }
    await queue.enqueue(changeToDraft(change), deviceId);
  };

  const handleCreateOrModify = async (file: TAbstractFile): Promise<void> => {
    if (!isMarkdownNote(file)) {
      return;
    }
    const content = await vault.read(file);
    await enqueue({ kind: 'create', path: file.path, content });
  };

  const handleModify = async (file: TAbstractFile): Promise<void> => {
    if (!isMarkdownNote(file)) {
      return;
    }
    const content = await vault.read(file);
    await enqueue({ kind: 'modify', path: file.path, content });
  };

  const handleRename = async (
    file: TAbstractFile,
    oldPath: string
  ): Promise<void> => {
    if (!isMarkdownNote(file)) {
      return;
    }
    await enqueue({ kind: 'rename', oldPath, newPath: file.path });
  };

  const handleDelete = async (file: TAbstractFile): Promise<void> => {
    if (!isMarkdownNote(file)) {
      return;
    }
    await enqueue({ kind: 'delete', path: file.path });
  };

  const refs = [
    vault.on('create', (file) => {
      void safely(() => handleCreateOrModify(file));
    }),
    vault.on('modify', (file) => {
      void safely(() => handleModify(file));
    }),
    vault.on('rename', (file, oldPath) => {
      void safely(() => handleRename(file, oldPath));
    }),
    vault.on('delete', (file) => {
      void safely(() => handleDelete(file));
    }),
  ];

  return () => {
    for (const ref of refs) {
      vault.offref(ref);
    }
  };
}
