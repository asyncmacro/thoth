import { describe, expect, it, vi } from 'vitest';

import type { EventRef, TFile, Vault } from 'obsidian';

import { OperationQueue } from '../queue.js';
import { attachVaultListener } from '../vault-listener.js';

class FakeVault {
  readonly handlers = new Map<string, (...args: unknown[]) => unknown>();
  readonly offref = vi.fn();

  on(name: string, callback: (...args: unknown[]) => unknown): EventRef {
    this.handlers.set(name, callback);
    return { name, callback };
  }

  read(file: { path: string }): Promise<string> {
    return Promise.resolve(`content of ${file.path}`);
  }

  fire(name: string, ...args: unknown[]): void {
    const handler = this.handlers.get(name);
    if (handler) {
      handler(...args);
    }
  }
}

const note = (path: string): TFile => ({ path, extension: 'md' }) as TFile;

function setup(getDeviceId: () => string = () => 'dev-1') {
  const vault = new FakeVault();
  const queue = new OperationQueue();
  const detach = attachVaultListener({
    vault: vault as unknown as Vault,
    queue,
    getDeviceId,
  });
  return { vault, queue, detach };
}

async function waitForSize(queue: OperationQueue, size: number): Promise<void> {
  await vi.waitFor(() => expect(queue.size).toBe(size));
}

describe('attachVaultListener', () => {
  it('queues a create-note operation on file create', async () => {
    const { vault, queue } = setup();
    vault.fire('create', note('notes/a.md'));

    await waitForSize(queue, 1);
    const op = queue.all[0];
    expect(op.type).toBe('create-note');
    if (op.type === 'create-note') {
      expect(op.payload).toEqual({
        path: 'notes/a.md',
        content: 'content of notes/a.md',
      });
    }
  });

  it('queues a replace-content operation on file modify', async () => {
    const { vault, queue } = setup();
    vault.fire('modify', note('notes/a.md'));

    await waitForSize(queue, 1);
    const op = queue.all[0];
    expect(op.type).toBe('replace-content');
    if (op.type === 'replace-content') {
      expect(op.payload).toEqual({
        path: 'notes/a.md',
        content: 'content of notes/a.md',
      });
    }
  });

  it('queues a rename-note operation on file rename', async () => {
    const { vault, queue } = setup();
    const file = note('notes/b.md');
    vault.fire('rename', file, 'notes/a.md');

    await waitForSize(queue, 1);
    const op = queue.all[0];
    expect(op.type).toBe('rename-note');
    if (op.type === 'rename-note') {
      expect(op.payload).toEqual({
        oldPath: 'notes/a.md',
        newPath: 'notes/b.md',
      });
    }
  });

  it('queues a delete-note operation on file delete', async () => {
    const { vault, queue } = setup();
    vault.fire('delete', note('notes/a.md'));

    await waitForSize(queue, 1);
    const op = queue.all[0];
    expect(op.type).toBe('delete-note');
    if (op.type === 'delete-note') {
      expect(op.payload).toEqual({ path: 'notes/a.md' });
    }
  });

  it('ignores non-markdown files', async () => {
    const { vault, queue } = setup();
    vault.fire('create', { path: 'image.png', extension: 'png' });
    vault.fire('modify', { path: 'note.txt', extension: 'txt' });

    await vi.waitFor(() => expect(queue.size).toBe(0));
  });

  it('ignores folders', async () => {
    const { vault, queue } = setup();
    vault.fire('create', { path: 'subfolder', extension: undefined });

    await vi.waitFor(() => expect(queue.size).toBe(0));
  });

  it('ignores events while no device is configured', async () => {
    const { vault, queue } = setup(() => '');
    vault.fire('create', note('notes/a.md'));

    await vi.waitFor(() => expect(queue.size).toBe(0));
  });

  it('detaches all listeners on unsubscribe', () => {
    const { vault, detach } = setup();
    detach();

    expect(vault.offref).toHaveBeenCalledTimes(4);
  });
});
