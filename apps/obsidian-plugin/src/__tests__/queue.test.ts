import { describe, expect, it } from 'vitest';

import { OperationQueue } from '../queue.js';

describe('OperationQueue', () => {
  it('stamps drafts with device, id and the first local revision', () => {
    const queue = new OperationQueue();
    const op = queue.enqueue(
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

  it('assigns contiguous local revisions', () => {
    const queue = new OperationQueue();
    queue.enqueue(
      { type: 'create-note', payload: { path: 'a.md', content: 'x' } },
      'dev-1'
    );
    const second = queue.enqueue(
      { type: 'delete-note', payload: { path: 'a.md' } },
      'dev-1'
    );
    const third = queue.enqueue(
      { type: 'rename-note', payload: { oldPath: 'a.md', newPath: 'b.md' } },
      'dev-1'
    );

    expect(second.revision).toBe(1);
    expect(third.revision).toBe(2);
    expect(queue.nextRevision()).toBe(3);
  });

  it('assigns unique ids', () => {
    const queue = new OperationQueue();
    const first = queue.enqueue(
      { type: 'create-note', payload: { path: 'a.md', content: 'x' } },
      'dev-1'
    );
    const second = queue.enqueue(
      { type: 'create-note', payload: { path: 'b.md', content: 'y' } },
      'dev-1'
    );

    expect(first.id).not.toBe(second.id);
  });

  it('exposes size and contents in enqueue order', () => {
    const queue = new OperationQueue();
    expect(queue.size).toBe(0);
    expect(queue.all).toEqual([]);

    queue.enqueue(
      { type: 'create-note', payload: { path: 'a.md', content: 'x' } },
      'dev-1'
    );
    queue.enqueue(
      { type: 'replace-content', payload: { path: 'a.md', content: 'y' } },
      'dev-1'
    );

    expect(queue.size).toBe(2);
    expect(queue.all.map((op) => op.type)).toEqual([
      'create-note',
      'replace-content',
    ]);
  });
});
