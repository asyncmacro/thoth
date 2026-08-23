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
  realtimeClientMessageSchema,
  registerDeviceSchema,
  wsTicketRequestSchema,
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

interface AssetMetadata {
  hash: string;
  size: number;
  mimeType?: string;
  uploadedAt: number;
}

interface StoredVault {
  metadata: VaultMetadata;
  log: OperationLog;
  snapshot: VaultState;
  assets: Record<string, AssetMetadata>;
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
  private connections = new Map<WebSocket, { deviceId: string; lastActive: number }>();
  private readonly IDLE_TIMEOUT_MS = 5 * 60 * 1000;
  private readonly ALARM_INTERVAL_MS = 60 * 1000;

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

    if (url.pathname.startsWith('/assets/') && method === 'PUT') {
      return this.handleAssetUpload(request, data);
    }

    if (url.pathname.startsWith('/assets/') && method === 'GET') {
      return this.handleAssetDownload(request, data);
    }

    if (url.pathname === '/ws-ticket' && method === 'POST') {
      return this.handleWsTicket(request, data);
    }

    if (url.pathname === '/ws' && method === 'GET') {
      return this.handleWsUpgrade(request, data);
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

    // Feature flag for device auth on mutating endpoints – disabled by default
    const ENFORCE_DEVICE_AUTH = false;
    if (ENFORCE_DEVICE_AUTH) {
      // TODO: validate Authorization header against devices
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
    // Notify connected clients about the new revision
    const pushingDeviceId = operations[0]?.deviceId;
    await this.broadcastVaultChanged(applied.state.revision, pushingDeviceId);

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

  private async handleAssetUpload(request: Request, data: StoredVault): Promise<Response> {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const assetId = parts[2];
    if (!assetId) {
      return json({ error: 'BAD_REQUEST', message: 'missing assetId' }, 400);
    }
    const body = await request.arrayBuffer();
    const size = body.byteLength;
    // Simple hash for verification – SHA-256 hex
    const hashBuffer = await crypto.subtle.digest('SHA-256', body);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const mimeType = request.headers.get('content-type') ?? 'application/octet-stream';
    await this.state.storage.put(`asset:${assetId}`, body);
    data.assets[assetId] = { hash, size, mimeType, uploadedAt: Date.now() };
    await this.save(data);
    return json({ assetId, hash, size });
  }

  private async handleAssetDownload(request: Request, data: StoredVault): Promise<Response> {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const assetId = parts[2];
    if (!assetId) {
      return json({ error: 'BAD_REQUEST', message: 'missing assetId' }, 400);
    }
    const meta = data.assets[assetId];
    if (!meta) {
      return json({ error: 'NOT_FOUND' }, 404);
    }
    const buf = await this.state.storage.get<ArrayBuffer>(`asset:${assetId}`);
    if (!buf) {
      return json({ error: 'NOT_FOUND' }, 404);
    }
    return new Response(buf, {
      headers: { 'Content-Type': meta.mimeType ?? 'application/octet-stream' },
    });
  }

  private async handleWsTicket(
    request: Request,
    data: StoredVault
  ): Promise<Response> {
    const body = await request.json().catch(() => null);
    const parsed = wsTicketRequestSchema(body);
    if (!parsed.ok) {
      return validationErrorResponse(parsed.issues);
    }
    const { deviceId, apiKey } = parsed.value;
    const device = data.metadata.devices[deviceId];
    if (!device) {
      return json({ error: 'UNAUTHORIZED', message: 'device not found' }, 401);
    }
    const hash = await this.hash(apiKey);
    if (hash !== device.apiKeyHash) {
      return json({ error: 'UNAUTHORIZED', message: 'invalid api key' }, 401);
    }
    // Prune expired tickets to avoid unbounded growth
    const list = await this.state.storage.list({ prefix: 'ws-ticket:' });
    const now = Date.now();
    for (const [key, value] of list.entries()) {
      const entry = value as { expiresAt: number };
      if (entry.expiresAt < now) {
        await this.state.storage.delete(key);
      }
    }
    const ticket = crypto.randomUUID();
    const expiresAt = Date.now() + 60_000;
    await this.state.storage.put(`ws-ticket:${ticket}`, {
      deviceId,
      expiresAt,
    });
    return json({ ticket, expiresAt }, 201);
  }

  private async broadcastVaultChanged(
    revision: number,
    pushingDeviceId?: string
  ): Promise<void> {
    try {
      const message = JSON.stringify({ type: 'vault-changed', revision });
      const allSockets = (this.state as any).getWebSockets?.() ?? [];
      const senderSockets = pushingDeviceId
        ? new Set((this.state as any).getWebSockets?.(pushingDeviceId) ?? [])
        : new Set();
      for (const ws of allSockets) {
        if (senderSockets.has(ws)) {
          continue;
        }
        try {
          ws.send(message);
        } catch {
          // ignore closed sockets
        }
      }
    } catch {
      // ignore broadcast errors
    }
  }

  private async handleWsUpgrade(
    request: Request,
    _data: StoredVault
  ): Promise<Response> {
    const url = new URL(request.url);
    const deviceId = url.searchParams.get('deviceId') ?? '';
    const ticket = url.searchParams.get('ticket') ?? '';
    if (!deviceId || !ticket) {
      return json(
        { error: 'BAD_REQUEST', message: 'missing ticket or deviceId' },
        400
      );
    }
    const stored = await this.state.storage.get<{
      deviceId: string;
      expiresAt: number;
    }>(`ws-ticket:${ticket}`);
    if (
      !stored ||
      stored.deviceId !== deviceId ||
      stored.expiresAt < Date.now()
    ) {
      return json(
        { error: 'UNAUTHORIZED', message: 'invalid or expired ticket' },
        401
      );
    }
    // single-use
    await this.state.storage.delete(`ws-ticket:${ticket}`);
    // Upgrade to WebSocket via hibernation API
    const pair = new (globalThis as any).WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    // Tag socket with device id for future filtering/broadcast
    (this.state as any).acceptWebSocket(server, [deviceId]);
    // Track connection for lifecycle & idle timeout
    this.connections.set(server, { deviceId, lastActive: Date.now() });
    // Schedule idle check alarm
    await this.state.storage.put('lastAlarm', Date.now());
    await this.state.storage.setAlarm(Date.now() + this.ALARM_INTERVAL_MS);
    // Optional auto-response for ping/pong without waking the DO
    (this.state as any).setWebSocketAutoResponse?.({
      request: '{"type":"ping"}',
      response: '{"type":"pong"}',
    });
    return new Response(null, { status: 101, webSocket: client } as any);
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    const entry = this.connections.get(ws);
    if (entry) {
      entry.lastActive = Date.now();
    }
    try {
      const text =
        typeof message === 'string'
          ? message
          : new TextDecoder().decode(message);
      const parsed = JSON.parse(text);
      const validated = realtimeClientMessageSchema(parsed);
      if (!validated.ok) {
        // Invalid client message — close the connection
        try {
          ws.close(1008, 'invalid message');
        } catch {}
        return;
      }
      // ping is auto-responded via setWebSocketAutoResponse; no further action needed
    } catch {
      try {
        ws.close(1008, 'invalid message');
      } catch {}
    }
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean
  ): Promise<void> {
    this.connections.delete(ws);
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
      assets: {},
    };
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    for (const [ws, meta] of this.connections.entries()) {
      if (now - meta.lastActive > this.IDLE_TIMEOUT_MS) {
        try {
          ws.close(1000, 'idle timeout');
        } catch {}
        this.connections.delete(ws);
      }
    }
    await this.state.storage.setAlarm(now + this.ALARM_INTERVAL_MS);
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
