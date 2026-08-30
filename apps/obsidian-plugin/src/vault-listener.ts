import type { TAbstractFile, TFile, Vault } from 'obsidian';

import type { FileChange } from './change-detection.js';
import { changeToDraft } from './change-detection.js';
import type { OperationQueue } from './queue.js';
import {
  assetIdForPath,
  hashArrayBuffer,
  isBinaryPath,
  MAX_ASSET_SIZE,
  mimeTypeForPath,
} from './vault-applier.js';

interface ListenerOptions {
  vault: Vault;
  queue: OperationQueue;
  /** Returns the configured device id; empty until the user registers. */
  getDeviceId: () => string;
  /** Returns the file extensions to synchronize as text files. */
  getExtensions: () => string[];
  /** Returns true while sync is applying server changes to the vault. */
  isSyncing?: () => boolean;
  /** Called after a local change was enqueued successfully. */
  onLocalChange?: () => void;
}

/**
 * Structural check for synchronizable text files. Avoids `instanceof
 * TFile` so the listener can be tested with plain fixtures; folders have
 * no `extension` and are always excluded.
 */
function isSyncedFile(file: TAbstractFile, extensions: string[]): file is TFile {
  const ext = (file as TFile).extension;
  return typeof ext === 'string' && extensions.includes(ext.toLowerCase());
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
  const { vault, queue, getDeviceId, getExtensions } = options;

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
    options.onLocalChange?.();
  };

  const handleCreateOrModify = async (file: TAbstractFile): Promise<void> => {
    if (!isSyncedFile(file, getExtensions())) {
      return;
    }
    if (isBinaryPath(file.path) && typeof (vault as Vault & { readBinary?: (f: TFile) => Promise<ArrayBuffer> }).readBinary === 'function') {
      if (options.isSyncing?.()) return;
      const deviceId = getDeviceId().trim();
      if (!deviceId) return;
      const buffer = await (vault as Vault & { readBinary: (f: TFile) => Promise<ArrayBuffer> }).readBinary(file as TFile);
      if (buffer.byteLength > MAX_ASSET_SIZE) {
        console.warn('Thoth: asset too large, skipped', { path: file.path, size: buffer.byteLength });
        return;
      }
      const hash = await hashArrayBuffer(buffer);
      const assetId = assetIdForPath(file.path);
      const mimeType = mimeTypeForPath(file.path);
      await queue.enqueue(
        {
          type: 'add-asset',
          payload: {
            path: file.path,
            assetId,
            hash,
            size: buffer.byteLength,
            ...(mimeType ? { mimeType } : {}),
          },
        },
        deviceId
      );
      options.onLocalChange?.();
      return;
    }
    const content = await vault.read(file as TFile);
    await enqueue({ kind: 'create', path: file.path, content });
  };

  const handleModify = async (file: TAbstractFile): Promise<void> => {
    if (!isSyncedFile(file, getExtensions())) {
      return;
    }
    if (isBinaryPath(file.path) && typeof (vault as Vault & { readBinary?: (f: TFile) => Promise<ArrayBuffer> }).readBinary === 'function') {
      if (options.isSyncing?.()) return;
      const deviceId = getDeviceId().trim();
      if (!deviceId) return;
      const buffer = await (vault as Vault & { readBinary: (f: TFile) => Promise<ArrayBuffer> }).readBinary(file as TFile);
      if (buffer.byteLength > MAX_ASSET_SIZE) {
        console.warn('Thoth: asset too large, skipped', { path: file.path, size: buffer.byteLength });
        return;
      }
      const hash = await hashArrayBuffer(buffer);
      const assetId = assetIdForPath(file.path);
      const mimeType = mimeTypeForPath(file.path);
      await queue.enqueue(
        {
          type: 'add-asset',
          payload: {
            path: file.path,
            assetId,
            hash,
            size: buffer.byteLength,
            ...(mimeType ? { mimeType } : {}),
          },
        },
        deviceId
      );
      options.onLocalChange?.();
      return;
    }
    const content = await vault.read(file as TFile);
    await enqueue({ kind: 'modify', path: file.path, content });
  };

  const handleRename = async (
    file: TAbstractFile,
    oldPath: string
  ): Promise<void> => {
    if (!isSyncedFile(file, getExtensions())) {
      return;
    }
    await enqueue({ kind: 'rename', oldPath, newPath: file.path });
  };

  const handleDelete = async (file: TAbstractFile): Promise<void> => {
    if (!isSyncedFile(file, getExtensions())) {
      return;
    }
    if (isBinaryPath(file.path)) {
      if (options.isSyncing?.()) return;
      const deviceId = getDeviceId().trim();
      if (!deviceId) return;
      const assetId = assetIdForPath(file.path);
      await queue.enqueue(
        { type: 'delete-asset', payload: { path: file.path, assetId } },
        deviceId
      );
      options.onLocalChange?.();
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
