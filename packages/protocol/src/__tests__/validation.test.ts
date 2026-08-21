import { describe, expect, it } from 'vitest';

import { operationSchema, pushOperationsSchema, pullOperationsSchema } from '../../../validation/src/schemas.js';

describe('protocol validation', () => {
  it('validates a correct operation', () => {
    const op = {
      id: 'op-1',
      type: 'create-note' as const,
      deviceId: 'dev-1',
      revision: 0,
      payload: { path: 'a.md', content: 'hi' },
    };
    const result = operationSchema(op);
    expect(result.ok).toBe(true);
  });

  it('rejects an operation with missing fields', () => {
    const op = {
      id: 'op-1',
      type: 'create-note',
      deviceId: 'dev-1',
      // revision missing
      payload: { path: 'a.md', content: 'hi' },
    };
    const result = operationSchema(op as any);
    expect(result.ok).toBe(false);
  });

  it('validates push request', () => {
    const req = {
      baseRevision: 0,
      operations: [
        {
          id: 'op-1',
          type: 'create-note',
          deviceId: 'dev-1',
          revision: 0,
          payload: { path: 'a.md', content: '' },
        },
      ],
    };
    const result = pushOperationsSchema(req);
    expect(result.ok).toBe(true);
  });

  it('validates pull request', () => {
    const req = { sinceRevision: 5 };
    const result = pullOperationsSchema(req);
    expect(result.ok).toBe(true);
  });
});
