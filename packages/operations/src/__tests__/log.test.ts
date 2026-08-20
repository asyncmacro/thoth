import { describe, expect, it } from 'vitest';

import type {
  CreateNoteOperation,
  ReplaceContentOperation,
} from '@thoth/protocol';
import { ValidationError } from '@thoth/validation';

import {
  appendOperation,
  createOperationLog,
  deserializeLog,
  serializeLog,
} from '../index.js';

function createNote(
  op: Partial<CreateNoteOperation> = {}
): CreateNoteOperation {
  return {
    id: 'op-1',
    type: 'create-note',
    deviceId: 'dev-1',
    revision: 0,
    payload: { path: 'notes/a.md', content: 'hello' },
    ...op,
  };
}

function replaceContent(
  op: Partial<ReplaceContentOperation> = {}
): ReplaceContentOperation {
  return {
    id: 'op-2',
    type: 'replace-content',
    deviceId: 'dev-1',
    revision: 1,
    payload: { path: 'notes/a.md', content: 'edited' },
    ...op,
  };
}

describe('appendOperation', () => {
  it('starts with an empty log', () => {
    expect(createOperationLog()).toEqual({ operations: [] });
  });

  it('appends an operation whose revision matches the log length', () => {
    const log = createOperationLog();
    const result = appendOperation(log, createNote());
    expect(result).toEqual({
      ok: true,
      log: { operations: [createNote()] },
    });
  });

  it('keeps a contiguous revision chain', () => {
    const first = appendOperation(createOperationLog(), createNote());
    if (!first.ok) {
      throw new Error('expected append to succeed');
    }
    const second = appendOperation(first.log, replaceContent());
    expect(second.ok).toBe(true);
  });

  it('rejects an operation with a non-contiguous revision', () => {
    const log = createOperationLog();
    const result = appendOperation(log, replaceContent());
    expect(result).toEqual({ ok: false, error: 'REVISION_MISMATCH' });
  });

  it('does not mutate the input log', () => {
    const log = createOperationLog();
    appendOperation(log, createNote());
    expect(log).toEqual({ operations: [] });
  });
});

describe('serialize/deserialize log', () => {
  it('round-trips a log through JSON', () => {
    const log = createOperationLog();
    const appended = appendOperation(log, createNote());
    if (!appended.ok) {
      throw new Error('expected append to succeed');
    }
    const restored = deserializeLog(serializeLog(appended.log));
    expect(restored).toEqual({ operations: [createNote()] });
  });

  it('throws a SyntaxError for malformed JSON', () => {
    expect(() => deserializeLog('{not json')).toThrow(SyntaxError);
  });

  it('throws a ValidationError for invalid log shapes', () => {
    expect(() => deserializeLog('{ "operations": "nope" }')).toThrow(
      ValidationError
    );
  });

  it('throws a ValidationError for invalid operations', () => {
    const bad = JSON.stringify({
      operations: [{ id: '', type: 'create-note' }],
    });
    expect(() => deserializeLog(bad)).toThrow(ValidationError);
  });
});
