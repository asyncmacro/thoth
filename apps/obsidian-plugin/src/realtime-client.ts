/**
 * Real-time vault change notifications via WebSocket + DO hibernation.
 *
 * Connects to wss://<server>/vaults/<vaultId>/ws using a short-lived
 * single-use ticket obtained from /ws-ticket. On a valid
 * {type:'vault-changed', revision} message, the caller is notified.
 * Reconnects with exponential backoff + jitter.
 */

import { withJitter } from './backoff.js';

const TICKET_TTL_MS = 60_000;
const PING_INTERVAL_MS = 30_000;
const DEBOUNCE_MS = 250;

export type RealtimeStatus = 'connecting' | 'open' | 'closed';

export interface RealtimeOptions {
  serverUrl: string;
  vaultId: string;
  deviceId: string;
  apiKey: string;
  getLocalRevision: () => number;
  requestSync: () => void;
  onStatusChange: (status: RealtimeStatus) => void;
  webSocketFactory?: (url: string) => WebSocket;
}

interface InternalState {
  ws?: WebSocket;
  pingTimer?: ReturnType<typeof setInterval>;
  reconnectTimer?: ReturnType<typeof setTimeout>;
  lastSeenRevision: number;
  debounceTimer?: ReturnType<typeof setTimeout>;
  backoffMs: number;
  closed: boolean;
}

function baseUrl(serverUrl: string): string {
  return serverUrl.replace(/\/+$/, '');
}

function wsUrlFromHttp(url: string): string {
  if (url.startsWith('http://')) return 'ws://' + url.slice(7);
  if (url.startsWith('https://')) return 'wss://' + url.slice(8);
  return url;
}

async function fetchTicket(params: {
  serverUrl: string;
  vaultId: string;
  deviceId: string;
  apiKey: string;
}): Promise<{ ticket: string } | null> {
  try {
    const res = await fetch(
      `${baseUrl(params.serverUrl)}/vaults/${encodeURIComponent(params.vaultId)}/ws-ticket`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: params.deviceId,
          apiKey: params.apiKey,
        }),
      }
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { ticket?: string };
    if (!body.ticket) return null;
    return { ticket: body.ticket };
  } catch {
    return null;
  }
}

export function connectRealtime(options: RealtimeOptions) {
  const {
    serverUrl,
    vaultId,
    deviceId,
    apiKey,
    getLocalRevision,
    requestSync,
    onStatusChange,
    webSocketFactory = (url) => new WebSocket(url),
  } = options;

  const state: InternalState = {
    lastSeenRevision: getLocalRevision(),
    backoffMs: 1_000,
    closed: false,
  };

  let status: RealtimeStatus = 'closed';

  const setStatus = (s: RealtimeStatus) => {
    if (status !== s) {
      status = s;
      onStatusChange(s);
    }
  };

  const scheduleSync = () => {
    if (state.debounceTimer) clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
      requestSync();
    }, DEBOUNCE_MS);
  };

  const connect = async () => {
    if (state.closed) return;
    setStatus('connecting');
    const ticket = await fetchTicket({ serverUrl, vaultId, deviceId, apiKey });
    if (!ticket) {
      // credential error → give up
      setStatus('closed');
      return;
    }
    const url = `${wsUrlFromHttp(baseUrl(serverUrl))}/vaults/${encodeURIComponent(vaultId)}/ws?deviceId=${encodeURIComponent(deviceId)}&ticket=${encodeURIComponent(ticket.ticket)}`;
    let ws: WebSocket;
    try {
      ws = webSocketFactory(url);
    } catch {
      scheduleReconnect();
      return;
    }
    state.ws = ws;

    ws.onopen = () => {
      setStatus('open');
      state.backoffMs = 1_000;
      if (state.pingTimer) clearInterval(state.pingTimer);
      state.pingTimer = setInterval(() => {
        try {
          ws.send(JSON.stringify({ type: 'ping' }));
        } catch {}
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
        if (
          data?.type === 'vault-changed' &&
          typeof data.revision === 'number'
        ) {
          const local = getLocalRevision();
          if (data.revision > local && data.revision > state.lastSeenRevision) {
            state.lastSeenRevision = data.revision;
            scheduleSync();
          }
        }
      } catch {}
    };

    ws.onclose = () => {
      setStatus('closed');
      if (state.pingTimer) {
        clearInterval(state.pingTimer);
        state.pingTimer = undefined;
      }
      if (!state.closed) scheduleReconnect();
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {}
    };
  };

  const scheduleReconnect = () => {
    if (state.closed) return;
    const delay = withJitter(Math.min(state.backoffMs, 60_000));
    state.backoffMs = Math.min(state.backoffMs * 2, 60_000);
    state.reconnectTimer = setTimeout(() => {
      void connect();
    }, delay);
  };

  // initial connect
  void connect();

  return {
    close() {
      state.closed = true;
      if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
      if (state.pingTimer) clearInterval(state.pingTimer);
      if (state.debounceTimer) clearTimeout(state.debounceTimer);
      try {
        state.ws?.close();
      } catch {}
      setStatus('closed');
    },
  };
}
