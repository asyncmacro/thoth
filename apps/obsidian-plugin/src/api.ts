export type ConnectionResult =
  { ok: true; message: string } | { ok: false; message: string };

function baseUrl(serverUrl: string): string {
  return serverUrl.replace(/\/+$/, '');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Pings the server health endpoint. */
export async function checkHealth(
  serverUrl: string
): Promise<ConnectionResult> {
  try {
    const res = await fetch(`${baseUrl(serverUrl)}/health`);
    if (!res.ok) {
      return {
        ok: false,
        message: `Health check failed with status ${res.status}`,
      };
    }
    const body = (await res.json()) as { status?: unknown };
    if (body.status !== 'ok') {
      return {
        ok: false,
        message: 'Health check returned an unexpected payload',
      };
    }
    return { ok: true, message: 'Server is reachable' };
  } catch (error) {
    return {
      ok: false,
      message: `Health check failed: ${errorMessage(error)}`,
    };
  }
}

/** Verifies the device API key against the server. */
export async function testAuthentication(params: {
  serverUrl: string;
  vaultId: string;
  deviceId: string;
  apiKey: string;
}): Promise<ConnectionResult> {
  try {
    const res = await fetch(
      `${baseUrl(params.serverUrl)}/vaults/${encodeURIComponent(params.vaultId)}/devices/${encodeURIComponent(params.deviceId)}/validate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: params.apiKey }),
      }
    );
    if (!res.ok) {
      return {
        ok: false,
        message: `Authentication request failed with status ${res.status}`,
      };
    }
    const body = (await res.json()) as { valid?: unknown };
    return body.valid === true
      ? { ok: true, message: 'Authentication succeeded' }
      : { ok: false, message: 'Authentication failed: invalid API key' };
  } catch (error) {
    return {
      ok: false,
      message: `Authentication failed: ${errorMessage(error)}`,
    };
  }
}
