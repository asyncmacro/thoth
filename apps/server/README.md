# Thoth Server

Cloudflare Workers + Durable Objects sync server.

## Development

```bash
pnpm install
pnpm build
pnpm dev   # wrangler dev
```

Environment variables are in `.dev.vars`.

Endpoints:
- GET /health → { status: "ok" }
- GET /version → { version: "..." }

## Deploy

```bash
pnpm deploy
```
