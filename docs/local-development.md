# Local Development

## Workspace

The repository is a pnpm monorepo with TypeScript project references.

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
```

## Run Server locally

```bash
pnpm --filter @thoth/server dev
```

The dev server uses `wrangler` with a local Durable Object binding.

## Run Plugin locally

Obsidian developer mode:

1. `pnpm --filter @thoth/obsidian-plugin build`
2. Symlink `apps/obsidian-plugin/dist` into your test vault’s `.obsidian/plugins/thoth`
3. Reload Obsidian

## Testing

```bash
pnpm test
```

Tests run via Vitest. Protocol, operations and validation packages are tested independently.

## Code style

- TypeScript strict mode
- ESLint + Prettier
- Named exports, kebab-case filenames
- No `any`, validate external input
