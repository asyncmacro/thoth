# Contributing

Thoth values correctness, maintainability, and simplicity.

## Development standards

Follow `AGENTS.md` for project conventions.

Key rules:

- TypeScript strict mode, no `any`
- Named exports, kebab-case filenames
- Pure functions, validate external input, preserve error context
- Shared types live in `packages/`
- Server must stay Cloudflare Free compatible
- Plugin must work on Desktop and Mobile

## Workflow

1. Create a branch
2. Make focused changes
3. Run `pnpm typecheck`, `pnpm lint`, `pnpm test`
4. Open PR

## Commit messages

Use clear, imperative messages.

## Testing

Add tests for protocol, operations, synchronization, and merge logic where practical.
