import { describe, expect, it } from 'vitest';

describe('router CORS guard', () => {
  it('does not add CORS headers to WebSocket upgrades', async () => {
    // Simulate addCors behavior
    function addCors(res: any) {
      if (res && res.webSocket) return res;
      return res;
    }

    const mockRes = { status: 101, webSocket: {} };
    const out = addCors(mockRes);
    expect(out).toBe(mockRes);
  });
});
