import type { Env } from './types/worker.js';

export default {
  async fetch(request: Request, env: Env) {
    const { createRouter } = await import('./routes/router.js');
    const router = createRouter(env);
    return router(request);
  },
};
