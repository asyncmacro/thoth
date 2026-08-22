import type { Operation } from '@thoth/protocol';
import { operationSchema } from '@thoth/validation';
import { OperationQueue } from './queue.js';
import { applyOperationsToVault, type VaultAdapter } from './vault-applier.js';

function baseUrl(serverUrl: string): string {
  return serverUrl.replace(/\/+$/, '');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Result of an upload attempt. */
export type UploadResult =
  { ok: true; newRevision: number } | { ok: false; error: string };

/** Result of a pull attempt. */
export type PullResult =
  | { ok: true; revision: number; operations: Operation[] }
  | { ok: false; error: string };

/**
 * Sends queued operations to the server via PushOperations.
 *
 * The caller must provide the server revision the operations are based on.
 * On success the server returns the new authoritative revision.
 */
export async function uploadOperations(params: {
  serverUrl: string;
  vaultId: string;
  baseRevision: number;
  operations: readonly Operation[];
}): Promise<UploadResult> {
  const { serverUrl, vaultId, baseRevision, operations } = params;

  if (operations.length === 0) {
    return { ok: true, newRevision: baseRevision };
  }

  // Re-stamp revisions so the batch is contiguous from baseRevision
  const stampedOps = operations.map((op, i) => ({
    ...op,
    revision: baseRevision + i,
  }));

  try {
    const url = `${baseUrl(serverUrl)}/vaults/${encodeURIComponent(vaultId)}/push`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseRevision,
        operations: stampedOps,
      }),
    });

    if (!res.ok) {
      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;
        const message =
          typeof body.message === 'string' ? body.message : 'revision conflict';
        return { ok: false, error: `Conflict: ${message}` };
      }
      return { ok: false, error: `Push failed with status ${res.status}` };
    }

    const body = (await res.json().catch(() => null)) as unknown;
    if (
      typeof body === 'object' &&
      body !== null &&
      'revision' in body &&
      typeof (body as { revision: unknown }).revision === 'number'
    ) {
      return { ok: true, newRevision: (body as { revision: number }).revision };
    }

    return { ok: false, error: 'Push response missing revision' };
  } catch (error) {
    return { ok: false, error: `Push failed: ${errorMessage(error)}` };
  }
}

/**
 * Removes acknowledged operations from the queue after a successful push.
 *
 * Returns the number of operations removed.
 */
export function acknowledgeOperations(
  queue: OperationQueue,
  baseRevision: number,
  newRevision: number
): number {
  const acknowledged = newRevision - baseRevision;
  if (acknowledged <= 0) {
    return 0;
  }
  const toRemove = Math.min(acknowledged, queue.size);
  queue.dropFirst(toRemove);
  return toRemove;
}

/**
 * Downloads missing operations from the server via PullOperations.
 *
 * The server returns operations with revision >= sinceRevision.
 */
export async function downloadOperations(params: {
  serverUrl: string;
  vaultId: string;
  sinceRevision: number;
}): Promise<PullResult> {
  const { serverUrl, vaultId, sinceRevision } = params;

  try {
    const url = `${baseUrl(serverUrl)}/vaults/${encodeURIComponent(vaultId)}/pull`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sinceRevision }),
    });

    if (!res.ok) {
      return { ok: false, error: `Pull failed with status ${res.status}` };
    }

    const body = (await res.json().catch(() => null)) as unknown;
    if (
      typeof body === 'object' &&
      body !== null &&
      'revision' in body &&
      'operations' in body &&
      typeof (body as { revision: unknown }).revision === 'number' &&
      Array.isArray((body as { operations: unknown }).operations)
    ) {
      const revision = (body as { revision: number }).revision;
      const operations = (body as { operations: unknown[] })
        .operations as Operation[];
      return { ok: true, revision, operations };
    }

    return { ok: false, error: 'Pull response missing revision or operations' };
  } catch (error) {
    return { ok: false, error: `Pull failed: ${errorMessage(error)}` };
  }
}

/**
 * High-level download + apply. Pulls missing operations from the server
 * and applies them to the vault in order.
 *
 * Returns the new server revision on success.
 */
export type DownloadAndApplyResult =
  { ok: true; newRevision: number } | { ok: false; error: string };

export async function downloadAndApply(params: {
  serverUrl: string;
  vaultId: string;
  sinceRevision: number;
  vault: VaultAdapter;
}): Promise<DownloadAndApplyResult> {
  const pull = await downloadOperations({
    serverUrl: params.serverUrl,
    vaultId: params.vaultId,
    sinceRevision: params.sinceRevision,
  });

  if (!pull.ok) {
    return { ok: false, error: pull.error };
  }

  // Validate operations from server and ignore malformed ones
  const validOps: Operation[] = [];
  for (const op of pull.operations) {
    const parsed = operationSchema(op);
    if (parsed.ok) {
      validOps.push(parsed.value);
    } else {
      console.warn('Thoth: ignoring malformed operation', {
        op,
        issues: parsed.issues,
      });
    }
  }

  if (validOps.length > 0) {
    await applyOperationsToVault(params.vault, validOps);
  }

  return { ok: true, newRevision: pull.revision };
}

/** Result of downloading a server snapshot. */
export type SnapshotResult =
  | { ok: true; revision: number; files: Record<string, string> }
  | { ok: false; error: string };

/**
 * Downloads a vault snapshot from the server.
 */
export async function downloadSnapshot(params: {
  serverUrl: string;
  vaultId: string;
}): Promise<SnapshotResult> {
  const { serverUrl, vaultId } = params;
  try {
    const url = `${baseUrl(serverUrl)}/vaults/${encodeURIComponent(vaultId)}/snapshot`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      return {
        ok: false,
        error: `Snapshot fetch failed with status ${res.status}`,
      };
    }
    const body = (await res.json().catch(() => null)) as unknown;
    if (
      typeof body === 'object' &&
      body !== null &&
      'revision' in body &&
      'files' in body &&
      typeof (body as { revision: unknown }).revision === 'number' &&
      typeof (body as { files: unknown }).files === 'object'
    ) {
      const revision = (body as { revision: number }).revision;
      const files = (body as { files: Record<string, string> }).files;
      return { ok: true, revision, files };
    }
    return { ok: false, error: 'Snapshot response missing revision or files' };
  } catch (error) {
    return {
      ok: false,
      error: `Snapshot fetch failed: ${errorMessage(error)}`,
    };
  }
}
