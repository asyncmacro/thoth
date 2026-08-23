import type { DurableObjectState } from '@cloudflare/workers-types';
import type { ValidationIssue } from '@thoth/protocol';
import {
  appendOperation,
  applyOperations,
  createOperationLog,
  createVaultState,
  type OperationLog,
  type VaultState,
} from '@thoth/operations';
import {
  pullOperationsSchema,
  pushOperationsSchema,
  registerDeviceSchema,
} from '@thoth/validation';

interface Device {
  apiKeyHash: string;
  createdAt: number;
  name?: string;
}

interface VaultMetadata {
  id: string;
  devices: Record<string, Device>;
}

interface StoredVault {
  metadata: VaultMetadata;
  log: OperationLog;
  snapshot: VaultState;
}

/** Structured 400 error matching the protocol ValidationErrorResponse. */
function validationErrorResponse(issues: ValidationIssue[]): Response {
  return new Response(
    JSON.stringify({
      error: 'VALIDATION_ERROR',
      message: 'request body is invalid',
      details: { issues },
    }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  );
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export class VaultDurableObject {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const method = request.method;

    let data = await this.load();

    if (url.pathname === '/init' && method === 'POST') {
      const body = (await request.json().catch(() => null)) as unknown as {
        id?: string;
      };
      if (body.id) {
        data = {
          metadata: { id: body.id, devices: {} },
          log: createOperationLog(),
          snapshot: createVaultState(),
        };
        await this.save(data);
      }
      return json({ ok: true });
    }

    if (url.pathname === '/purge' && method === 'DELETE') {
      await this.state.storage.delete('vault');
      return new Response(null, { status: 204 });
    }

    if (url.pathname === '/metadata' && method === 'GET') {
      return json({
        id: data.metadata.id,
        revision: data.snapshot.revision,
      });
    }

    if (url.pathname === '/snapshot' && method === 'GET') {
      return json({
        revision: data.snapshot.revision,
        files: data.snapshot.files,
      });
    }

    if (url.pathname === '/push' && method === 'POST') {
      return this.handlePush(request, data);
    }

    if (url.pathname === '/pull' && method === 'POST') {
      return this.handlePull(request, data);
    }

    // Device management
    if (url.pathname === '/devices' && method === 'POST') {
      const body = await request.json().catch(() => null);
      const parsed = registerDeviceSchema(body);
      if (!parsed.ok) {
        return validationErrorResponse(parsed.issues);
      }
      const { deviceId: requestedId, name } = parsed.value;
      const MAX_DEVICES = 20;
      if (Object.keys(data.metadata.devices).length >= MAX_DEVICES) {
        return json(
          {
            error: 'DEVICE_LIMIT_REACHED',
            message: `maximum of ${MAX_DEVICES} devices per vault`,
          },
          409
        );
      }
      const deviceId =
        requestedId && !data.metadata.devices[requestedId]
          ? requestedId
          : crypto.randomUUID();
      if (data.metadata.devices[deviceId]) {
        return json(
          {
            error: 'DEVICE_ALREADY_REGISTERED',
            message: 'device id already in use',
          },
          409
        );
      }
      const apiKey = crypto.randomUUID();
      const apiKeyHash = await this.hash(apiKey);
      data.metadata.devices[deviceId] = {
        apiKeyHash,
        createdAt: Date.now(),
        name,
      };
      await this.save(data);
      return json({ deviceId, apiKey }, 201);
    }

    if (url.pathname === '/devices' && method === 'GET') {
      const devices = Object.entries(data.metadata.devices).map(
        ([id, device]) => ({
          id,
          createdAt: device.createdAt,
          name: device.name,
        })
      );
      return json({ devices });
    }

    const deviceMatch = url.pathname.match(/^\/devices\/([^/]+)/);
    if (deviceMatch) {
      const deviceId = deviceMatch[1];
      const device = data.metadata.devices[deviceId];

      if (!device) {
        return json({ error: 'NOT_FOUND' }, 404);
      }

      if (method === 'DELETE') {
        delete data.metadata.devices[deviceId];
        await this.save(data);
        return new Response(null, { status: 204 });
      }

      if (url.pathname === `/devices/${deviceId}/rotate` && method === 'POST') {
        const apiKey = crypto.randomUUID();
        const apiKeyHash = await this.hash(apiKey);
        data.metadata.devices[deviceId] = {
          ...device,
          apiKeyHash,
          createdAt: Date.now(),
        };
        await this.save(data);
        return json({ deviceId, apiKey });
      }

      if (
        url.pathname === `/devices/${deviceId}/validate` &&
        method === 'POST'
      ) {
        const body = (await request.json().catch(() => null)) as unknown as {
          apiKey?: string;
        };
        if (!body.apiKey) {
          return json({ valid: false });
        }
        const hash = await this.hash(body.apiKey);
        return json({ valid: hash === device.apiKeyHash });
      }
    }

    return json({ error: 'NOT_FOUND' }, 404);
  }

  private async handlePush(
    request: Request,
    data: StoredVault
  ): Promise<Response> {
    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = pushOperationsSchema(body);
    if (!parsed.ok) {
      return validationErrorResponse(parsed.issues);
    }

    const { baseRevision, operations } = parsed.value;
    const { metadata, log, snapshot } = data;

    if (baseRevision !== snapshot.revision) {
      return json(
        {
          error: 'REVISION_MISMATCH',
          message: `server is at revision ${snapshot.revision}`,
          details: { revision: snapshot.revision },
        },
        409
      );
    }

    const applied = applyOperations(snapshot, operations);
    if (!applied.ok) {
      return json(
        {
          error: 'CONFLICT',
          message: `operation rejected: ${applied.error}`,
          details: { reason: applied.error, revision: snapshot.revision },
        },
        409
      );
    }

    let nextLog = log;
    for (const op of operations) {
      const appended = appendOperation(nextLog, op);
      if (!appended.ok) {
        // Unreachable when baseRevision matched: applyOperations verified
        // the batch chains revisions contiguously. Kept as a safety net.
        return json(
          {
            error: 'REVISION_MISMATCH',
            message: 'operation revisions are not contiguous',
          },
          409
        );
      }
      nextLog = appended.log;
    }

    await this.save({
      metadata,
      log: nextLog,
      snapshot: applied.state,
    });
    return json({ revision: applied.state.revision });
  }

  private async handlePull(
    request: Request,
    data: StoredVault
  ): Promise<Response> {
    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = pullOperationsSchema(body);
    if (!parsed.ok) {
      return validationErrorResponse(parsed.issues);
    }

    const { sinceRevision } = parsed.value;
    const operations = data.log.operations.filter(
      (op) => op.revision >= sinceRevision
    );
    return json({
      revision: data.snapshot.revision,
      operations,
    });
  }

  private async load(): Promise<StoredVault> {
    const stored = await this.state.storage.get<StoredVault>('vault');
    if (stored) {
      return stored;
    }
    return {
      metadata: { id: 'unknown', devices: {} },
      log: createOperationLog(),
      snapshot: createVaultState(),
    };
  }

  private async save(data: StoredVault): Promise<void> {
    await this.state.storage.put('vault', data);
  }

  private async hash(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
