import { describe, expect, it } from 'vitest';

import { ValidationError } from '@thoth/validation';

import {
  appendOperation,
  createOperationLog,
  deserializeSnapshot,
  serializeSnapshot,
  snapshotFromLog,
} from '../index.js';

describe('snapshotFromLog', () => {
  it('produces the final state of an operation chain', () => {
    const log = createOperationLog();
    const first = appendOperation(log, {
      id: 'op-1',
      type: 'create-note',
      deviceId: 'dev-1',
      revision: 0,
      payload: { path: 'notes/a.md', content: 'hello' },
    });
    if (!first.ok) {
      throw new Error('expected append to succeed');
    }
    const second = appendOperation(first.log, {
      id: 'op-2',
      type: 'rename-note',
      deviceId: 'dev-1',
      revision: 1,
      payload: { oldPath: 'notes/a.md', newPath: 'notes/b.md' },
    });
    if (!second.ok) {
      throw new Error('expected append to succeed');
    }

    const result = snapshotFromLog(second.log);
    expect(result).toEqual({
      ok: true,
      state: { revision: 2, files: { 'notes/b.md': 'hello' } },
    });
  });

  it('rejects a log with a revision gap', () => {
    const result = snapshotFromLog({
      operations: [
        {
          id: 'op-1',
          type: 'replace-content',
          deviceId: 'dev-1',
          revision: 1,
          payload: { path: 'notes/a.md', content: 'x' },
        },
      ],
    });
    expect(result).toEqual({ ok: false, error: 'REVISION_MISMATCH' });
  });

  it('rejects a log with an invalid operation', () => {
    const result = snapshotFromLog({
      operations: [
        {
          id: 'op-1',
          type: 'delete-note',
          deviceId: 'dev-1',
          revision: 0,
          payload: { path: 'notes/missing.md' },
        },
      ],
    });
    expect(result).toEqual({ ok: false, error: 'NOTE_NOT_FOUND' });
  });
});

describe('serialize/deserialize snapshot', () => {
  it('round-trips a snapshot through JSON', () => {
    const snapshot = { revision: 3, files: { 'a.md': 'hello', 'b.md': 'x' } };
    const restored = deserializeSnapshot(serializeSnapshot(snapshot));
    expect(restored).toEqual(snapshot);
  });

  it('throws a SyntaxError for malformed JSON', () => {
    expect(() => deserializeSnapshot('not json')).toThrow(SyntaxError);
  });

  it('throws a ValidationError for invalid snapshots', () => {
    expect(() =>
      deserializeSnapshot('{ "revision": -1, "files": {} }')
    ).toThrow(ValidationError);
  });
});
