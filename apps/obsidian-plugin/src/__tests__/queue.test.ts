import { describe, expect, it } from 'vitest';

import { OperationQueue } from '../queue.js';

describe('OperationQueue', () => {
  it('stamps drafts with device, id and the first local revision', async () => {
    const queue = new OperationQueue();
    const op = await queue.enqueue(
      { type: 'create-note', payload: { path: 'notes/a.md', content: 'hi' } },
      'dev-1'
    );

    expect(op).toMatchObject({
      type: 'create-note',
      deviceId: 'dev-1',
      revision: 0,
      payload: { path: 'notes/a.md', content: 'hi' },
    });
    expect(op.id).toBeTruthy();
  });

  it('assigns contiguous local revisions', async () => {
    const queue = new OperationQueue();
    await queue.enqueue(
      { type: 'create-note', payload: { path: 'a.md', content: 'x' } },
      'dev-1'
    );
    const second = await queue.enqueue(
      { type: 'delete-note', payload: { path: 'a.md' } },
      'dev-1'
    );
    const third = await queue.enqueue(
      { type: 'rename-note', payload: { oldPath: 'a.md', newPath: 'b.md' } },
      'dev-1'
    );

    expect(second.revision).toBe(1);
    expect(third.revision).toBe(2);
    expect(queue.nextRevision()).toBe(3);
  });

  it('assigns unique ids', async () => {
    const queue = new OperationQueue();
    const first = await queue.enqueue(
      { type: 'create-note', payload: { path: 'a.md', content: 'x' } },
      'dev-1'
    );
    const second = await queue.enqueue(
      { type: 'create-note', payload: { path: 'b.md', content: 'y' } },
      'dev-1'
    );

    expect(first.id).not.toBe(second.id);
  });

  it('exposes size and contents in enqueue order', async () => {
    const queue = new OperationQueue();
    expect(queue.size).toBe(0);
    expect(queue.all).toEqual([]);

    await queue.enqueue(
      { type: 'create-note', payload: { path: 'a.md', content: 'x' } },
      'dev-1'
    );
    await queue.enqueue(
      { type: 'replace-content', payload: { path: 'a.md', content: 'y' } },
      'dev-1'
    );

    expect(queue.size).toBe(2);
    expect(queue.all.map((op) => op.type)).toEqual([
      'create-note',
      'replace-content',
    ]);
  });

  it('notifies the change listener after enqueue so callers can persist', async () => {
    let saved: unknown[] = [];
    const queue = new OperationQueue((changed) => {
      saved = [...changed.all];
      return Promise.resolve();
    });

    await queue.enqueue(
      { type: 'create-note', payload: { path: 'a.md', content: 'x' } },
      'dev-1'
    );

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ type: 'create-note', revision: 0 });
  });

  it('keeps accepting operations without a change listener', async () => {
    const queue = new OperationQueue();
    await queue.enqueue(
      { type: 'create-note', payload: { path: 'a.md', content: 'x' } },
      'dev-1'
    );
    expect(queue.size).toBe(1);
  });

  it('replaces contents on startup load', async () => {
    const source = new OperationQueue();
    const first = await source.enqueue(
      { type: 'create-note', payload: { path: 'a.md', content: 'x' } },
      'dev-1'
    );

    const queue = new OperationQueue();
    queue.replaceAll([{ ...first }]);

    expect(queue.size).toBe(1);
    expect(queue.all[0].id).toBe(first.id);
    expect(queue.nextRevision()).toBe(1);
  });
});
