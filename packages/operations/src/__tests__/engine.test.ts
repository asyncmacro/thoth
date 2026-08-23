import { describe, expect, it } from 'vitest';

import type {
  CreateNoteOperation,
  DeleteNoteOperation,
  Operation,
  RenameNoteOperation,
  ReplaceContentOperation,
} from '@thoth/protocol';

import {
  applyOperation,
  applyOperations,
  nextRevision,
  operationError,
} from '../index.js';
import { createVaultState } from '../index.js';

function createNote(
  op: Partial<CreateNoteOperation> = {}
): CreateNoteOperation {
  return {
    id: 'op-create',
    type: 'create-note',
    deviceId: 'dev-1',
    revision: 0,
    payload: { path: 'notes/a.md', content: 'hello' },
    ...op,
  };
}

function deleteNote(
  op: Partial<DeleteNoteOperation> = {}
): DeleteNoteOperation {
  return {
    id: 'op-delete',
    type: 'delete-note',
    deviceId: 'dev-1',
    revision: 0,
    payload: { path: 'notes/a.md' },
    ...op,
  };
}

function renameNote(
  op: Partial<RenameNoteOperation> = {}
): RenameNoteOperation {
  return {
    id: 'op-rename',
    type: 'rename-note',
    deviceId: 'dev-1',
    revision: 0,
    payload: { oldPath: 'notes/a.md', newPath: 'notes/b.md' },
    ...op,
  };
}

function replaceContent(
  op: Partial<ReplaceContentOperation> = {}
): ReplaceContentOperation {
  return {
    id: 'op-replace',
    type: 'replace-content',
    deviceId: 'dev-1',
    revision: 0,
    payload: { path: 'notes/a.md', content: 'updated' },
    ...op,
  };
}

describe('nextRevision', () => {
  it('increments by one', () => {
    expect(nextRevision(0)).toBe(1);
    expect(nextRevision(7)).toBe(8);
  });
});

describe('operationError', () => {
  it('rejects operations with a mismatched revision', () => {
    const state = createVaultState();
    expect(operationError(createNote({ revision: 1 }), state)).toBe(
      'REVISION_MISMATCH'
    );
  });

  it('returns null for a valid create', () => {
    expect(operationError(createNote(), createVaultState())).toBeNull();
  });
});

describe('applyOperation', () => {
  it('creates a note and increments the revision', () => {
    const state = createVaultState();
    const result = applyOperation(state, createNote());
    expect(result).toEqual({
      ok: true,
      state: { revision: 1, files: { 'notes/a.md': 'hello' } },
    });
  });

  it('does not mutate the input state', () => {
    const state = createVaultState();
    applyOperation(state, createNote());
    expect(state).toEqual({ revision: 0, files: {} });
  });

  it('upserts an existing note on create', () => {
    const state = { revision: 0, files: { 'notes/a.md': 'x' } };
    const result = applyOperation(state, createNote());
    expect(result).toEqual({
      ok: true,
      state: { revision: 1, files: { 'notes/a.md': 'hello' } },
    });
  });

  it('deletes a note', () => {
    const state = { revision: 0, files: { 'notes/a.md': 'x' } };
    const result = applyOperation(state, deleteNote());
    expect(result).toEqual({ ok: true, state: { revision: 1, files: {} } });
  });

  it('rejects deleting a missing note', () => {
    const result = applyOperation(createVaultState(), deleteNote());
    expect(result).toEqual({ ok: false, error: 'NOTE_NOT_FOUND' });
  });

  it('renames a note', () => {
    const state = { revision: 0, files: { 'notes/a.md': 'content' } };
    const result = applyOperation(state, renameNote());
    expect(result).toEqual({
      ok: true,
      state: { revision: 1, files: { 'notes/b.md': 'content' } },
    });
  });

  it('rejects renaming a missing note', () => {
    const result = applyOperation(createVaultState(), renameNote());
    expect(result).toEqual({ ok: false, error: 'NOTE_NOT_FOUND' });
  });

  it('rejects renaming onto an existing note', () => {
    const state = {
      revision: 0,
      files: { 'notes/a.md': 'a', 'notes/b.md': 'b' },
    };
    const result = applyOperation(state, renameNote());
    expect(result).toEqual({ ok: false, error: 'TARGET_EXISTS' });
  });

  it('replaces note content', () => {
    const state = { revision: 0, files: { 'notes/a.md': 'old' } };
    const result = applyOperation(state, replaceContent());
    expect(result).toEqual({
      ok: true,
      state: { revision: 1, files: { 'notes/a.md': 'updated' } },
    });
  });

  it('upserts a missing note on replace-content', () => {
    const result = applyOperation(createVaultState(), replaceContent());
    expect(result).toEqual({
      ok: true,
      state: { revision: 1, files: { 'notes/a.md': 'updated' } },
    });
  });
});

describe('applyOperations', () => {
  it('applies a batch in order', () => {
    const state = createVaultState();
    const operations: Operation[] = [
      createNote(),
      replaceContent({
        revision: 1,
        payload: { path: 'notes/a.md', content: 'edited' },
      }),
      renameNote({ revision: 2 }),
      deleteNote({ revision: 3, payload: { path: 'notes/b.md' } }),
    ];
    const result = applyOperations(state, operations);
    expect(result).toEqual({ ok: true, state: { revision: 4, files: {} } });
  });

  it('applies duplicate creates as upserts', () => {
    const state = createVaultState();
    const operations: Operation[] = [createNote(), createNote({ revision: 1 })];
    const result = applyOperations(state, operations);
    expect(result).toEqual({
      ok: true,
      state: { revision: 2, files: { 'notes/a.md': 'hello' } },
    });
  });

  it('leaves the input state untouched on failure', () => {
    const state = createVaultState();
    const operations: Operation[] = [createNote(), createNote({ revision: 1 })];
    applyOperations(state, operations);
    expect(state).toEqual({ revision: 0, files: {} });
  });
});
