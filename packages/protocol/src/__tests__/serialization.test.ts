import { describe, expect, it } from 'vitest';

import {
  PullOperationsResponse,
  PushOperationsRequest,
  type Operation,
} from '../index.js';

describe('protocol serialization', () => {
  it('round-trips PushOperationsRequest via JSON', () => {
    const req: PushOperationsRequest = {
      baseRevision: 5,
      operations: [
        {
          id: 'op-1',
          type: 'create-note',
          deviceId: 'dev-1',
          revision: 5,
          payload: { path: 'a.md', content: 'hello' },
        },
      ],
    };
    const json = JSON.stringify(req);
    const parsed = JSON.parse(json) as PushOperationsRequest;
    expect(parsed).toEqual(req);
  });

  it('round-trips PullOperationsResponse via JSON', () => {
    const res: PullOperationsResponse = {
      revision: 10,
      operations: [],
    };
    const json = JSON.stringify(res);
    const parsed = JSON.parse(json) as PullOperationsResponse;
    expect(parsed).toEqual(res);
  });

  it('Operation is JSON serializable', () => {
    const op: Operation = {
      id: 'op-2',
      type: 'delete-note',
      deviceId: 'dev-2',
      revision: 3,
      payload: { path: 'b.md' },
    };
    const json = JSON.stringify(op);
    const parsed = JSON.parse(json) as Operation;
    expect(parsed).toEqual(op);
  });
});
