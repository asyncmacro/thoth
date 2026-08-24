# AGENTS.md

> Canonical instructions for all AI coding agents working on the Thoth monorepo.
>
> This document is the source of truth for project conventions, architecture, engineering standards, and behavioral expectations. Follow these instructions unless explicitly overridden by the project maintainers.

---

# Project

**Thoth** is a Cloudflare-native synchronization server and Obsidian plugin that synchronizes vaults by transmitting atomic operations instead of entire Markdown files.

Primary goals:

- Reliable synchronization
- Minimal bandwidth usage
- Conflict-resistant synchronization
- Offline-first design
- Simple architecture
- Cloudflare Free tier only

The project values correctness, maintainability, and simplicity over feature count.

---

# Stack

## Runtime

- TypeScript
- Node.js (development only)
- Cloudflare Workers
- Durable Objects
- Electron (Obsidian Desktop)
- Capacitor/Electron runtime (Obsidian Mobile)

## Package manager

pnpm

## Build

esbuild

## Testing

Vitest

## Linting

ESLint

## Formatting

Prettier

---

# Monorepo Layout

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

docs/

scripts/
```

Packages inside `packages/` must be framework-independent whenever possible.

The Obsidian plugin and server should share protocol definitions.

Never duplicate protocol types.

---

# Architecture Principles

The architecture should always prefer:

- simple over clever
- explicit over implicit
- immutable over mutable
- deterministic over magical
- composition over inheritance

If two implementations are equally correct, choose the simpler one.

---

# Cloudflare Constraints

The server MUST remain compatible with the Cloudflare Free plan.

Do not introduce dependencies on paid Cloudflare products.

Preferred services:

- Workers
- Durable Objects
- KV (only if justified)
- D1 (only if justified)

Avoid introducing additional Cloudflare products unless there is a clear architectural reason.

Always optimize for:

- low CPU time
- low memory usage
- minimal requests
- minimal storage

---

# TypeScript Standards

## Strict Mode

Always assume:

```
strict = true
```

Never disable strict mode.

Never use:

```
any
```

Use:

- unknown
- generics
- discriminated unions
- type guards

---

## Prefer interfaces

Prefer

```ts
interface Vault {}
```

over

```ts
type Vault = {};
```

unless a type alias is clearly more appropriate.

---

## Exports

Use named exports.

Avoid default exports.

---

## File Naming

Use:

```
kebab-case.ts
```

Examples:

```
sync-engine.ts
vault-store.ts
create-note.ts
```

Never use PascalCase filenames.

---

## Imports

Prefer explicit imports.

Avoid wildcard imports.

Good:

```ts
import { createVault } from './vault';
```

Avoid:

```ts
import * as Vault from './vault';
```

---

## Functions

Prefer pure functions.

Avoid hidden state.

Avoid global mutable variables.

Prefer:

```ts
function applyOperation(...)
```

instead of:

```ts
class SyncManager
```

unless stateful behavior is genuinely required.

---

## Classes

Do not create classes unless they model long-lived state.

Prefer modules and functions.

---

## Async

Never ignore Promises.

Never write:

```ts
doWork();
```

when

```ts
await doWork();
```

is expected.

Use:

```ts
await;
```

instead of chained `.then()`.

---

## Nullability

Never assume values exist.

Prefer:

```ts
if (!vault) {
    ...
}
```

instead of:

```ts
vault!;
```

Avoid non-null assertions.

---

# Error Handling

Errors are part of the API.

Do not hide them.

---

## Never swallow errors

Never do:

```ts
catch {}
```

Never do:

```ts
catch (e) {
    return
}
```

without documenting why.

---

## Use typed errors

Prefer:

```ts
class SyncError extends Error
```

instead of throwing strings.

Never:

```ts
throw 'failed';
```

---

## Preserve context

Wrap errors when appropriate.

Good:

```ts
throw new SyncError('Failed to apply operation', { cause: error });
```

Never discard the original error.

---

## Validate external input

Everything from:

- HTTP
- filesystem
- Obsidian
- user settings
- JSON

must be validated before use.

Assume external input is malformed.

---

## Fail safely

Return meaningful errors.

Never silently corrupt data.

Correctness is more important than availability.

---

## Logging

Logs should be:

- structured
- concise
- useful

Never log:

- secrets
- API keys
- authentication tokens
- encryption keys
- vault contents

---

# API Design

Prefer explicit request/response models.

Avoid positional arguments.

Good:

```ts
createVault({
  id,
  owner,
});
```

instead of:

```ts
createVault(id, owner);
```

when more than two parameters exist.

---

# Shared Packages

Everything shared between the server and plugin belongs inside:

```
packages/
```

Never duplicate:

- protocol types
- validation
- operation models
- constants

---

# Server Guidelines

The server is authoritative.

Clients never invent server state.

Every operation should be deterministic.

Server code should remain stateless except for Durable Objects.

Durable Objects own synchronization state.

Workers perform routing and authentication.

---

# Obsidian Plugin Guidelines

The plugin must support:

- Obsidian Desktop
- Obsidian Mobile

Never rely on Node APIs that are unavailable on mobile.

Avoid:

- fs
- path
- child_process
- worker_threads

unless accessed through Obsidian's official APIs.

Always use the Obsidian API when interacting with the vault.

---

# Electron Compatibility

Generated JavaScript must be compatible with the Electron version bundled with supported Obsidian releases.

Do not emit syntax requiring a newer JavaScript runtime than Obsidian supports.

The build should transpile appropriately using esbuild.

Do not assume the latest Chromium features are available.

Avoid experimental JavaScript features.

---

# Browser Compatibility

The plugin should execute without modification on:

- desktop
- Android
- iOS

Avoid browser-specific assumptions.

Use platform-independent APIs whenever possible.

---

# Performance

Prefer incremental algorithms.

Avoid repeatedly reading the entire vault.

Avoid unnecessary allocations.

Avoid copying large strings repeatedly.

Think in terms of operations rather than files.

---

# Synchronization

Synchronization should be:

- deterministic
- idempotent
- resumable
- offline-friendly

Never rely on wall-clock time for correctness.

Prefer revision numbers.

---

# Security

Never hardcode:

- secrets
- tokens
- credentials

Validate every external input.

Escape user-controlled values.

Never trust client input.

---

# Dependencies

Every dependency increases maintenance cost.

Before introducing a dependency, ask:

1. Is this functionality available in the standard library?
2. Can this be implemented in under ~100 lines?
3. Is the dependency actively maintained?
4. Is it necessary?

Prefer fewer dependencies.

---

# Testing

Every new feature should include tests where practical.

Prioritize:

- protocol tests
- operation tests
- synchronization tests
- merge tests
- regression tests

---

# Documentation

Public APIs should include concise documentation.

Complex algorithms should explain:

- why
- invariants
- edge cases

Do not explain obvious code.

Explain intent.

---

# Refactoring

Improve surrounding code when safe.

Avoid unrelated large refactors.

Keep pull requests focused.

---

# Never

Never:

- disable strict mode
- use `any`
- ignore Promise rejections
- swallow errors
- duplicate protocol types
- mutate shared state unexpectedly
- add unnecessary dependencies
- commit secrets
- bypass validation
- use unstable JavaScript features
- assume desktop-only behavior
- write code incompatible with Obsidian Mobile

---

# Always

Always:

- write deterministic code
- validate external input
- preserve error context
- write readable TypeScript
- prefer composition
- share protocol definitions
- optimize for Cloudflare Free
- target both desktop and mobile Obsidian
- keep synchronization atomic
- leave the codebase cleaner than you found it
