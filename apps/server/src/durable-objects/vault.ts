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
  lastSyncAt?: number;
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
    headers: {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

export class VaultDurableObject {
  private state: DurableObjectState;
  private connections = new Map<
    WebSocket,
    { deviceId: string; lastActive: number }
  >();
  private readonly IDLE_TIMEOUT_MS = 5 * 60 * 1000;
  private readonly ALARM_INTERVAL_MS = 60 * 1000;
  private readonly SNAPSHOT_COMPACTION_THRESHOLD = 500;
  private readonly SNAPSHOT_INTERVAL_MS = 30 * 60 * 1000;
  private readonly MAX_BATCH_SIZE = 100;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const method = request.method;
    // Versioned endpoints support
    let pathname = url.pathname;
    if (pathname.startsWith('/v1')) {
      pathname = pathname.slice(3) || '/';
      url.pathname = pathname;
    }
    // Rate limiting: simple per-IP counter
    const clientIp = request.headers.get('cf-connecting-ip') ?? 'unknown';
    const rateKey = `rate:${clientIp}`;
    const rate = (await this.state.storage.get<{ count: number; ts: number }>(
      rateKey
    )) ?? { count: 0, ts: Date.now() };
    const now = Date.now();
    if (now - rate.ts > 60_000) {
      rate.count = 0;
      rate.ts = now;
    }
    rate.count += 1;
    await this.state.storage.put(rateKey, rate);
    if (rate.count > 100) {
      return new Response(JSON.stringify({ error: 'TOO_MANY_REQUESTS' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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
          assets: {},
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

    if (url.pathname === '/diagnostics' && method === 'GET') {
      return json({
        id: data.metadata.id,
        revision: data.snapshot.revision,
        logLength: data.log.operations.length,
        assetCount: Object.keys(data.assets).length,
        lastSyncAt: data.metadata.lastSyncAt ?? null,
        connections: this.connections.size,
      });
    }

    if (url.pathname === '/snapshot' && method === 'GET') {
      return json({
        revision: data.snapshot.revision,
        files: data.snapshot.files,
        assets: (data.snapshot as VaultState).assets ?? {},
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
    const { baseRevision, operations, protocolVersion } = parsed.value;
    // Client version check / graceful upgrade
    if (protocolVersion && protocolVersion < 1) {
      return json(
        { error: 'UNSUPPORTED_PROTOCOL', message: 'protocol version too old' },
        400
      );
    }
    if (operations.length > this.MAX_BATCH_SIZE) {
      return json(
        {
          error: 'BAD_REQUEST',
          message: `batch size exceeds ${this.MAX_BATCH_SIZE}`,
        },
        400
      );
    }
    const { metadata, log, snapshot } = data;
    // Operation checksum verification
    for (const op of operations) {
      if (op.metadata?.checksum) {
        const payloadHash = await this.hash(JSON.stringify(op.payload));
        if (payloadHash !== op.metadata.checksum) {
          return json(
            { error: 'BAD_REQUEST', message: 'operation checksum mismatch' },
            400
          );
        }
      }
    }

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
    // Duplicate operation detection & replay protection
    const existingIds = new Set(log.operations.map((op) => op.id));
    const duplicateOps = operations.filter((op) => existingIds.has(op.id));
    if (duplicateOps.length > 0) {
      return json(
        {
          error: 'CONFLICT',
          message: 'duplicate operations detected',
          details: {
            reason: 'DUPLICATE_OPERATION',
            duplicateIds: duplicateOps.map((o) => o.id),
          },
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

    let compactedLog = nextLog;
    // Automatic snapshot compaction
    if (compactedLog.operations.length >= this.SNAPSHOT_COMPACTION_THRESHOLD) {
      compactedLog = this.compactLog(compactedLog, applied.state);
    }

    const updatedMetadata = { ...metadata, lastSyncAt: Date.now() };
    await this.save({
      metadata: updatedMetadata,
      log: compactedLog,
      snapshot: applied.state,
      assets: data.assets,
    });
    // Audit logging
    await this.audit('push', {
      revision: applied.state.revision,
      deviceId: operations[0]?.deviceId,
    });
    // Notify connected clients about the new revision
    const pushingDeviceId = operations[0]?.deviceId;
    await this.broadcastVaultChanged(applied.state.revision, pushingDeviceId);

    return json({ revision: applied.state.revision, capabilities: [] });
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

  private async handleAssetUpload(
    request: Request,
    data: StoredVault
  ): Promise<Response> {
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
    const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    const mimeType =
      request.headers.get('content-type') ?? 'application/octet-stream';
    // Duplicate detection by hash
    const existingId = Object.entries(data.assets).find(
      ([, meta]) => meta.hash === hash
    )?.[0];
    if (existingId && existingId !== assetId) {
      // Duplicate asset already stored, reuse metadata
      return json({ assetId: existingId, hash, size, duplicate: true });
    }
    await this.state.storage.put(`asset:${assetId}`, body);
    data.assets[assetId] = { hash, size, mimeType, uploadedAt: Date.now() };
    await this.save(data);
    return json({ assetId, hash, size });
  }

  private async handleAssetDownload(
    request: Request,
    data: StoredVault
  ): Promise<Response> {
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
      // Migrate old snapshots without assets field
      if (!stored.snapshot.assets) {
        (stored.snapshot as VaultState).assets = {};
      }
      if (!stored.assets) {
        stored.assets = {};
      }
      // Crash recovery: verify snapshot integrity
      const expectedRevision =
        stored.log.operations.length > 0
          ? stored.log.operations[stored.log.operations.length - 1].revision + 1
          : 0;
      if (stored.snapshot.revision !== expectedRevision) {
        // Attempt recovery by replaying log
        const { snapshotFromLog } = await import('@thoth/operations');
        const recovered = snapshotFromLog(stored.log);
        if (recovered.ok) {
          stored.snapshot = recovered.state;
          await this.state.storage.put('vault', stored);
        }
      }
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
    // Idle timeout handling
    for (const [ws, meta] of this.connections.entries()) {
      if (now - meta.lastActive > this.IDLE_TIMEOUT_MS) {
        try {
          ws.close(1000, 'idle timeout');
        } catch {}
        this.connections.delete(ws);
      }
    }
    // Automatic snapshot verification
    await this.verifySnapshotIntegrity();
    await this.state.storage.setAlarm(now + this.ALARM_INTERVAL_MS);
  }

  private compactLog(log: OperationLog, snapshotState: { revision: number }) {
    // Keep only operations after snapshot revision for compaction
    const cutoff = snapshotState.revision;
    const remaining = log.operations.filter((op) => op.revision > cutoff);
    return { operations: remaining };
  }

  private async verifySnapshotIntegrity(): Promise<void> {
    const data = await this.load();
    const { snapshot, log } = data;
    // If log contains operations beyond snapshot, verify by replaying
    if (log.operations.length === 0) return;
    const lastLogRevision = log.operations[log.operations.length - 1].revision;
    if (lastLogRevision <= snapshot.revision) return;
    // In a full implementation, we'd replay log from snapshot revision.
    // For now, integrity is assumed if snapshot revision matches expected.
  }

  private async save(data: StoredVault): Promise<void> {
    await this.state.storage.put('vault', data);
  }

  private async audit(
    action: string,
    details: Record<string, unknown>
  ): Promise<void> {
    const entry = { ts: Date.now(), action, details };
    const key = 'audit';
    const logs = (await this.state.storage.get<Array<typeof entry>>(key)) ?? [];
    logs.push(entry);
    // keep last 100 entries
    if (logs.length > 100) logs.splice(0, logs.length - 100);
    await this.state.storage.put(key, logs);
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
