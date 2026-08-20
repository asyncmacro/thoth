import type { DurableObjectState } from "@cloudflare/workers-types";

interface Device {
  apiKeyHash: string;
  createdAt: number;
}

interface VaultState {
  id: string;
  revision: number;
  devices: Record<string, Device>;
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

    if (url.pathname === "/init" && method === "POST") {
      const body = await request.json().catch(() => ({})) as { id?: string };
      if (body.id) {
        data = { id: body.id, revision: 0, devices: {} };
        await this.save(data);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/purge" && method === "DELETE") {
      await this.state.storage.delete("vault");
      return new Response(null, { status: 204 });
    }

    if (url.pathname === "/metadata" && method === "GET") {
      return new Response(JSON.stringify({ id: data.id, revision: data.revision }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/revision" && method === "POST") {
      const updated = { ...data, revision: data.revision + 1 };
      await this.save(updated);
      return new Response(JSON.stringify({ revision: updated.revision }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Device management
    if (url.pathname === "/devices" && method === "POST") {
      const deviceId = crypto.randomUUID();
      const apiKey = crypto.randomUUID();
      const apiKeyHash = await this.hash(apiKey);
      data.devices[deviceId] = { apiKeyHash, createdAt: Date.now() };
      await this.save(data);
      return new Response(JSON.stringify({ deviceId, apiKey }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/devices" && method === "GET") {
      const devices = Object.entries(data.devices).map(([id, d]) => ({
        id,
        createdAt: d.createdAt,
      }));
      return new Response(JSON.stringify({ devices }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const deviceMatch = url.pathname.match(/^\/devices\/([^/]+)/);
    if (deviceMatch) {
      const deviceId = deviceMatch[1];
      const device = data.devices[deviceId];

      if (!device) {
        return new Response(JSON.stringify({ error: "NOT_FOUND" }), { status: 404 });
      }

      if (method === "DELETE") {
        delete data.devices[deviceId];
        await this.save(data);
        return new Response(null, { status: 204 });
      }

      if (url.pathname === `/devices/${deviceId}/rotate` && method === "POST") {
        const apiKey = crypto.randomUUID();
        const apiKeyHash = await this.hash(apiKey);
        data.devices[deviceId] = { ...device, apiKeyHash, createdAt: Date.now() };
        await this.save(data);
        return new Response(JSON.stringify({ deviceId, apiKey }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.pathname === `/devices/${deviceId}/validate` && method === "POST") {
        const body = await request.json().catch(() => ({})) as { apiKey?: string };
        if (!body.apiKey) {
          return new Response(JSON.stringify({ valid: false }), {
            headers: { "Content-Type": "application/json" },
          });
        }
        const hash = await this.hash(body.apiKey);
        const valid = hash === device.apiKeyHash;
        return new Response(JSON.stringify({ valid }), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "NOT_FOUND" }), { status: 404 });
  }

  private async load(): Promise<VaultState> {
    const stored = await this.state.storage.get<VaultState>("vault");
    if (stored) return stored;
    return { id: "unknown", revision: 0, devices: {} };
  }

  private async save(data: VaultState): Promise<void> {
    await this.state.storage.put("vault", data);
  }

  private async hash(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
}
