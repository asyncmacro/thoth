import { describe, expect, it } from 'vitest';

import {
  createVaultSchema,
  operationSchema,
  pullOperationsSchema,
  pushOperationsSchema,
  registerDeviceSchema,
} from '../index.js';

const validOperation = {
  id: 'op-1',
  type: 'create-note',
  deviceId: 'device-1',
  revision: 3,
  payload: { path: 'notes/hello' },
};

describe('createVaultSchema', () => {
  it('accepts an empty body', () => {
    expect(createVaultSchema({}).ok).toBe(true);
  });

  it('accepts an optional name', () => {
    expect(createVaultSchema({ name: 'docs' }).ok).toBe(true);
  });

  it('rejects a non-string name', () => {
    const result = createVaultSchema({ name: 42 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        { path: 'name', message: 'expected a string' },
      ]);
    }
  });

  it('rejects unknown keys', () => {
    const result = createVaultSchema({ owner: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        { path: 'owner', message: 'unexpected key' },
      ]);
    }
  });
});

describe('registerDeviceSchema', () => {
  it('accepts an empty or named body', () => {
    expect(registerDeviceSchema({}).ok).toBe(true);
    expect(registerDeviceSchema({ name: 'Laptop' }).ok).toBe(true);
  });

  it('rejects a non-string name', () => {
    expect(registerDeviceSchema({ name: true }).ok).toBe(false);
  });
});

describe('operationSchema', () => {
  it('accepts a valid operation', () => {
    const result = operationSchema(validOperation);
    expect(result.ok).toBe(true);
  });

  it('rejects an unknown operation type', () => {
    const result = operationSchema({ ...validOperation, type: 'explode' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        {
          path: 'type',
          message:
            'expected one of: create-note, delete-note, rename-note, replace-content',
        },
      ]);
    }
  });

  it('rejects a missing id', () => {
    const withoutId = {
      type: 'create-note',
      deviceId: 'device-1',
      revision: 3,
      payload: { path: 'notes/hello' },
    };
    const result = operationSchema(withoutId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0].path).toBe('id');
    }
  });

  it('rejects a non-object payload', () => {
    const result = operationSchema({ ...validOperation, payload: 'text' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        { path: 'payload', message: 'expected an object' },
      ]);
    }
  });
});

describe('pushOperationsSchema', () => {
  it('accepts a valid push with operations', () => {
    const request = {
      baseRevision: 2,
      operations: [validOperation],
    };
    expect(pushOperationsSchema(request).ok).toBe(true);
  });

  it('accepts an empty operation list', () => {
    expect(pushOperationsSchema({ baseRevision: 2, operations: [] }).ok).toBe(
      true
    );
  });

  it('rejects a negative base revision', () => {
    const result = pushOperationsSchema({ baseRevision: -1, operations: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        { path: 'baseRevision', message: 'must be >= 0' },
      ]);
    }
  });

  it('rejects a non-array operations field', () => {
    const result = pushOperationsSchema({
      baseRevision: 2,
      operations: 'nope',
    });
    expect(result.ok).toBe(false);
  });

  it('reports issues inside operations with indexed paths', () => {
    const result = pushOperationsSchema({
      baseRevision: 2,
      operations: [{ ...validOperation, type: 'explode' }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0].path).toBe('operations[0].type');
    }
  });
});

describe('pullOperationsSchema', () => {
  it('accepts a valid since revision', () => {
    expect(pullOperationsSchema({ sinceRevision: 5 }).ok).toBe(true);
  });

  it('rejects a negative revision', () => {
    const result = pullOperationsSchema({ sinceRevision: -1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        { path: 'sinceRevision', message: 'must be >= 0' },
      ]);
    }
  });

  it('rejects unknown keys', () => {
    const result = pullOperationsSchema({ sinceRevision: 1, extra: true });
    expect(result.ok).toBe(false);
  });
});
