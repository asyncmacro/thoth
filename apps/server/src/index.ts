import { VaultDurableObject } from './durable-objects/vault.js';
import type { Env } from './types/worker.js';

export { VaultDurableObject };

export default {
  async fetch(request: Request, env: Env) {
    const { createRouter } = await import('./routes/router.js');
    const router = createRouter(env);
    return router(request);
  },
};
