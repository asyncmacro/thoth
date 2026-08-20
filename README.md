# Thoth

Cloudflare-native synchronization server and Obsidian plugin that synchronizes vaults by transmitting atomic operations instead of entire Markdown files.

## Goals

- Reliable synchronization
- Minimal bandwidth usage
- Conflict-resistant synchronization
- Offline-first design
- Simple architecture
- Cloudflare Free tier only

## Stack

- TypeScript
- pnpm
- Cloudflare Workers + Durable Objects
- Vitest, ESLint, Prettier, esbuild

## Monorepo layout

```
apps/
  server/
  obsidian-plugin/
packages/
  protocol/
  operations/
  validation/
  crypto/
  utils/
```

## Development

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
```

See `TODO.md` for the v0.1 roadmap.

## License

MIT
