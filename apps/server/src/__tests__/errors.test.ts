import { describe, it, expect } from 'vitest';
import { HttpError } from '../errors/http-error.js';
import { handleError } from '../errors/handler.js';

describe('errors', () => {
  it('HttpError carries status and code', () => {
    const err = new HttpError(404, 'NOT_FOUND', 'Resource missing');
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Resource missing');
  });

  it('handleError returns structured JSON for HttpError', async () => {
    const err = new HttpError(400, 'BAD_REQUEST', 'Bad input');
    const res = handleError(err);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string; message: string };
    expect(json.error).toBe('BAD_REQUEST');
    expect(json.message).toBe('Bad input');
  });

  it('handleError returns 500 with requestId for unknown errors', async () => {
    const res = handleError(new Error('boom'), { requestId: 'abc-123' });
    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: string; requestId: string };
    expect(json.error).toBe('INTERNAL_ERROR');
    expect(json.requestId).toBe('abc-123');
  });
});
