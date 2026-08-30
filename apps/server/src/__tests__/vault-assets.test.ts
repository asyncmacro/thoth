import { describe, expect, it } from 'vitest';

import type { DurableObjectState } from '@cloudflare/workers-types';
import type { Operation } from '@thoth/protocol';

import { VaultDurableObject } from '../durable-objects/vault.js';

class FakeStorage {
  private readonly map = new Map<string, unknown>();
  get<T>(key: string): T | undefined {
    return this.map.get(key) as T | undefined;
  }
  put(key: string, value: unknown): void {
    this.map.set(key, value);
  }
  delete(key: string): void {
    this.map.delete(key);
  }
  list(opts?: { prefix?: string }) {
    const prefix = opts?.prefix ?? '';
    const entries = new Map<string, unknown>();
    for (const [k, v] of this.map.entries()) if (k.startsWith(prefix)) entries.set(k, v);
    return entries;
  }
}

function createDo() {
  const storage = new FakeStorage();
  return { doObject: new VaultDurableObject({ storage } as unknown as DurableObjectState), storage };
}

async function initVault(doObject: VaultDurableObject, id = 'vault-1'): Promise<void> {
  const res = await doObject.fetch(new Request('https://internal/init', { method: 'POST', body: JSON.stringify({ id }) }));
  expect(res.status).toBe(200);
}

describe('assets E2E', () => {
  it('uploads blob then pushes add-asset and snapshot contains asset', async () => {
    const { doObject } = createDo();
    await initVault(doObject);
    const assetId = encodeURIComponent('img/photo.png');
    const data = new TextEncoder().encode('pngbytes').buffer as ArrayBuffer;
    const putRes = await doObject.fetch(
      new Request(`https://internal/assets/${assetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
        body: data,
      })
    );
    expect(putRes.status).toBe(200);
    const { hash } = (await putRes.json()) as { hash: string };
    expect(hash).toMatch(/^[0-9a-f]{64}$/);

    const op: Operation = {
      id: 'op-asset-0',
      type: 'add-asset',
      deviceId: 'dev-1',
      revision: 0,
      payload: { path: 'img/photo.png', assetId, hash, size: data.byteLength, mimeType: 'image/png' },
    };
    const pushRes = await doObject.fetch(
      new Request('https://internal/push', { method: 'POST', body: JSON.stringify({ baseRevision: 0, operations: [op] }) })
    );
    expect(pushRes.status).toBe(200);
    const snapRes = await doObject.fetch(new Request('https://internal/snapshot'));
    const snap = (await snapRes.json()) as { revision: number; files: Record<string, string>; assets: Record<string, unknown> };
    expect(snap.revision).toBe(1);
    expect(snap.assets['img/photo.png']).toMatchObject({ assetId, hash, size: data.byteLength });

    const getRes = await doObject.fetch(new Request(`https://internal/assets/${assetId}`));
    expect(getRes.status).toBe(200);
    const out = await getRes.arrayBuffer();
    expect(new Uint8Array(out)).toEqual(new Uint8Array(data));
  });

  it('pull returns add-asset and delete-asset renames asset', async () => {
    const { doObject } = createDo();
    await initVault(doObject);
    const assetId = encodeURIComponent('a.png');
    const data = new TextEncoder().encode('b').buffer as ArrayBuffer;
    await doObject.fetch(new Request(`https://internal/assets/${assetId}`, { method: 'PUT', body: data }));
    const addOp: Operation = {
      id: 'op-1',
      type: 'add-asset',
      deviceId: 'dev-1',
      revision: 0,
      payload: { path: 'a.png', assetId, hash: 'h', size: 1 },
    };
    await doObject.fetch(new Request('https://internal/push', { method: 'POST', body: JSON.stringify({ baseRevision: 0, operations: [addOp] }) }));

    const renameOp: Operation = {
      id: 'op-2',
      type: 'rename-note',
      deviceId: 'dev-1',
      revision: 1,
      payload: { oldPath: 'a.png', newPath: 'b.png' },
    };
    const r2 = await doObject.fetch(new Request('https://internal/push', { method: 'POST', body: JSON.stringify({ baseRevision: 1, operations: [renameOp] }) }));
    expect(r2.status).toBe(200);

    const pull = await doObject.fetch(new Request('https://internal/pull', { method: 'POST', body: JSON.stringify({ sinceRevision: 0 }) }));
    const json = (await pull.json()) as { operations: Operation[] };
    expect(json.operations.map((o) => o.type)).toEqual(['add-asset', 'rename-note']);

    const snap = (await (await doObject.fetch(new Request('https://internal/snapshot'))).json()) as { assets: Record<string, unknown> };
    expect(snap.assets['b.png']).toBeDefined();
    expect(snap.assets['a.png']).toBeUndefined();
  });

  it('rejects delete-asset for missing path', async () => {
    const { doObject } = createDo();
    await initVault(doObject);
    const op: Operation = {
      id: 'op-del',
      type: 'delete-asset',
      deviceId: 'dev-1',
      revision: 0,
      payload: { path: 'missing.png', assetId: 'missing.png' },
    };
    const res = await doObject.fetch(new Request('https://internal/push', { method: 'POST', body: JSON.stringify({ baseRevision: 0, operations: [op] }) }));
    expect(res.status).toBe(409);
    const body = (await res.json()) as { details: { reason: string } };
    expect(body.details.reason).toBe('NOTE_NOT_FOUND');
  });
});
