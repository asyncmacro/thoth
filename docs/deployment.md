# Deployment Guide

## Cloudflare Workers

Thoth server targets Cloudflare Workers + Durable Objects on the Free tier.

### Requirements

- Workers KV / D1 not required for v0.1
- Durable Object binding named `VAULT_DO`
- `VERSION` env var

### Deploy

```bash
pnpm --filter @thoth/server build
pnpm --filter @thoth/server deploy
```

The router forwards:
- `POST /vaults` → create vault
- `GET /vaults/:id` → metadata
- `POST /vaults/:id/push` → upload operations
- `POST /vaults/:id/pull` → download operations
- `GET /vaults/:id/snapshot` → snapshot restore
- Device management under `/vaults/:id/devices`

### Obsidian Plugin Release

Build the plugin:
```bash
pnpm --filter @thoth/obsidian-plugin build
```

Package `dist` for distribution via Obsidian community plugins.

### Operational notes

- Durable Objects own sync state; Workers stay stateless
- Snapshots are immutable once written
- Operation log is append-only
- Optimize for low CPU/memory/requests per Cloudflare Free limits
