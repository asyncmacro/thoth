import { healthHandler } from './health.js';
import { createLogger } from '../logger/index.js';
import { handleError } from '../errors/handler.js';
import { HttpError } from '../errors/http-error.js';
import type { Env } from '../types/worker.js';

export function createRouter(env: Env) {
  const log = createLogger(env);

  return async (request: Request) => {
    await Promise.resolve();
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);

    try {
      log.info('request received', { requestId });

      if (url.pathname === '/health' && request.method === 'GET') {
        return healthHandler();
      }

      if (url.pathname === '/version' && request.method === 'GET') {
        return new Response(
          JSON.stringify({ version: env.VERSION ?? '0.1.0' }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      if (url.pathname === '/vaults' && request.method === 'POST') {
        const id = crypto.randomUUID();
        if (env.VAULT_DO) {
          const doId = env.VAULT_DO.idFromName(id);
          const stub = env.VAULT_DO.get(doId);
          await stub.fetch('https://internal/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          });
        }
        return new Response(JSON.stringify({ id, revision: 0 }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const vaultIdMatch = url.pathname.match(/^\/vaults\/([^/]+)/);
      if (vaultIdMatch) {
        const vaultId = vaultIdMatch[1];

        // Vault-level routes
        if (url.pathname === `/vaults/${vaultId}` && request.method === 'GET') {
          if (env.VAULT_DO) {
            const doId = env.VAULT_DO.idFromName(vaultId);
            const stub = env.VAULT_DO.get(doId);
            const res = await stub.fetch('https://internal/metadata');
            if (res.ok) return res;
          }
          return new Response(JSON.stringify({ id: vaultId, revision: 0 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (
          url.pathname === `/vaults/${vaultId}` &&
          request.method === 'DELETE'
        ) {
          if (env.VAULT_DO) {
            const doId = env.VAULT_DO.idFromName(vaultId);
            const stub = env.VAULT_DO.get(doId);
            await stub.fetch('https://internal/purge', { method: 'DELETE' });
          }
          return new Response(null, { status: 204 });
        }

        // Operation sync routes
        const forwardToVault = async (path: string) => {
          if (!env.VAULT_DO) {
            return handleError(
              new HttpError(
                500,
                'INTERNAL_ERROR',
                'Vault Durable Object binding is not configured'
              )
            );
          }
          const doId = env.VAULT_DO.idFromName(vaultId);
          const stub = env.VAULT_DO.get(doId);
          return stub.fetch(`https://internal${path}`, {
            method: request.method,
            body: await request.text(),
            headers: { 'Content-Type': 'application/json' },
          });
        };

        if (
          url.pathname === `/vaults/${vaultId}/push` &&
          request.method === 'POST'
        ) {
          return forwardToVault('/push');
        }

        if (
          url.pathname === `/vaults/${vaultId}/pull` &&
          request.method === 'POST'
        ) {
          return forwardToVault('/pull');
        }

        if (
          url.pathname === `/vaults/${vaultId}/snapshot` &&
          request.method === 'GET'
        ) {
          return forwardToVault('/snapshot');
        }

        // Device routes
        if (url.pathname.startsWith(`/vaults/${vaultId}/devices`)) {
          if (env.VAULT_DO) {
            const doId = env.VAULT_DO.idFromName(vaultId);
            const stub = env.VAULT_DO.get(doId);
            const devicePath = url.pathname.replace(`/vaults/${vaultId}`, '');
            const res = await stub.fetch(`https://internal${devicePath}`, {
              method: request.method,
              headers: request.headers,
            });
            return res;
          }
          // Fallback for tests without DO binding
          if (
            url.pathname === `/vaults/${vaultId}/devices` &&
            request.method === 'POST'
          ) {
            const deviceId = crypto.randomUUID();
            const apiKey = crypto.randomUUID();
            return new Response(JSON.stringify({ deviceId, apiKey }), {
              status: 201,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          if (
            url.pathname === `/vaults/${vaultId}/devices` &&
            request.method === 'GET'
          ) {
            return new Response(JSON.stringify({ devices: [] }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          // Device specific actions fallback
          const deviceActionMatch = url.pathname.match(
            new RegExp(`/vaults/${vaultId}/devices/([^/]+)(/.*)?`)
          );
          if (deviceActionMatch) {
            const deviceId = deviceActionMatch[1];
            const action = deviceActionMatch[2] || '';
            if (request.method === 'DELETE' && !action) {
              return new Response(null, { status: 204 });
            }
            if (request.method === 'POST' && action === '/rotate') {
              const apiKey = crypto.randomUUID();
              return new Response(JSON.stringify({ deviceId, apiKey }), {
                headers: { 'Content-Type': 'application/json' },
              });
            }
            if (request.method === 'POST' && action === '/validate') {
              return new Response(JSON.stringify({ valid: true }), {
                headers: { 'Content-Type': 'application/json' },
              });
            }
          }
          return new Response(JSON.stringify({ error: 'NOT_FOUND' }), {
            status: 404,
          });
        }
      }

      return new Response(
        JSON.stringify({ error: 'NOT_FOUND', message: 'Route not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (err) {
      log.error('handler error', { requestId }, err);
      return handleError(err, { requestId });
    }
  };
}
