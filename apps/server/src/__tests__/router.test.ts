import { describe, it, expect } from "vitest";
import { createRouter } from "../routes/router.js";

describe("router", () => {
  it("GET /health returns ok", async () => {
    const router = createRouter({ VERSION: "0.1.0", ENVIRONMENT: "test" });
    const req = new Request("http://localhost/health");
    const res = await router(req);
    expect(res.status).toBe(200);
    const json = await res.json() as { status: string };
    expect(json).toEqual({ status: "ok" });
  });

  it("GET /version returns version", async () => {
    const router = createRouter({ VERSION: "0.1.0", ENVIRONMENT: "test" });
    const req = new Request("http://localhost/version");
    const res = await router(req);
    expect(res.status).toBe(200);
    const json = await res.json() as { version: string };
    expect(json).toEqual({ version: "0.1.0" });
  });

  it("unknown route returns 404", async () => {
    const router = createRouter({ VERSION: "0.1.0", ENVIRONMENT: "test" });
    const req = new Request("http://localhost/unknown");
    const res = await router(req);
    expect(res.status).toBe(404);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("NOT_FOUND");
  });

  it("POST /vaults creates vault", async () => {
    const router = createRouter({ VERSION: "0.1.0", ENVIRONMENT: "test" });
    const req = new Request("http://localhost/vaults", { method: "POST" });
    const res = await router(req);
    expect(res.status).toBe(201);
    const json = await res.json() as { id: string; revision: number };
    expect(json).toHaveProperty("id");
    expect(json.revision).toBe(0);
  });

  it("GET /vaults/:id returns metadata", async () => {
    const router = createRouter({ VERSION: "0.1.0", ENVIRONMENT: "test" });
    const req = new Request("http://localhost/vaults/123");
    const res = await router(req);
    expect(res.status).toBe(200);
    const json = await res.json() as { id: string };
    expect(json.id).toBe("123");
  });

  it("DELETE /vaults/:id returns 204", async () => {
    const router = createRouter({ VERSION: "0.1.0", ENVIRONMENT: "test" });
    const req = new Request("http://localhost/vaults/123", { method: "DELETE" });
    const res = await router(req);
    expect(res.status).toBe(204);
  });

  it("POST /vaults/:id/devices registers device", async () => {
    const router = createRouter({ VERSION: "0.1.0", ENVIRONMENT: "test" });
    const req = new Request("http://localhost/vaults/123/devices", { method: "POST" });
    const res = await router(req);
    expect(res.status).toBe(201);
    const json = await res.json() as { deviceId: string; apiKey: string };
    expect(json).toHaveProperty("deviceId");
    expect(json).toHaveProperty("apiKey");
  });

  it("GET /vaults/:id/devices lists devices", async () => {
    const router = createRouter({ VERSION: "0.1.0", ENVIRONMENT: "test" });
    const req = new Request("http://localhost/vaults/123/devices");
    const res = await router(req);
    expect(res.status).toBe(200);
    const json = await res.json() as { devices: unknown[] };
    expect(json).toHaveProperty("devices");
  });

  it("DELETE /vaults/:id/devices/:deviceId removes device", async () => {
    const router = createRouter({ VERSION: "0.1.0", ENVIRONMENT: "test" });
    const req = new Request("http://localhost/vaults/123/devices/abc", { method: "DELETE" });
    const res = await router(req);
    expect(res.status).toBe(204);
  });

  it("POST /vaults/:id/devices/:deviceId/rotate rotates api key", async () => {
    const router = createRouter({ VERSION: "0.1.0", ENVIRONMENT: "test" });
    const req = new Request("http://localhost/vaults/123/devices/abc/rotate", { method: "POST" });
    const res = await router(req);
    expect(res.status).toBe(200);
    const json = await res.json() as { deviceId: string; apiKey: string };
    expect(json.deviceId).toBe("abc");
    expect(json).toHaveProperty("apiKey");
  });

  it("POST /vaults/:id/devices/:deviceId/validate validates api key", async () => {
    const router = createRouter({ VERSION: "0.1.0", ENVIRONMENT: "test" });
    const req = new Request("http://localhost/vaults/123/devices/abc/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "test" }),
    });
    const res = await router(req);
    expect(res.status).toBe(200);
    const json = await res.json() as { valid: boolean };
    expect(json).toHaveProperty("valid");
  });
});
