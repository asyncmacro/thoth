# AGENTS.md

This file contains additional instructions specific to the Cloudflare server.

These instructions supplement the root AGENTS.md.

---

# Goal

The server is the authoritative synchronization engine.

Its primary responsibilities are:

- authentication
- synchronization
- operation validation
- persistence
- conflict detection
- deterministic state transitions

The server must remain deployable on the Cloudflare Free plan.

---

# Runtime

Target:

- Cloudflare Workers
- Durable Objects

Assume a serverless environment.

Never assume process-local state exists outside a Durable Object.

---

# Durable Objects

Durable Objects own mutable synchronization state.

Workers should remain as stateless as possible.

Durable Objects should:

- own synchronization state
- serialize writes
- validate operations
- increment revisions
- generate snapshots

Avoid storing synchronization state in Workers.

---

# Determinism

Synchronization logic must be deterministic.

Given identical operations, every server should produce identical state.

Never rely on:

- wall-clock time
- random ordering
- object iteration order

Prefer:

- revision numbers
- explicit ordering
- immutable operations

---

# API

HTTP APIs should:

- validate every request
- return structured JSON
- use appropriate status codes

Example:

```
400 Bad Request

401 Unauthorized

403 Forbidden

404 Not Found

409 Conflict

500 Internal Server Error
```

Never expose stack traces.

---

# Validation

Every request must be validated before use.

Never trust:

- JSON bodies
- query parameters
- headers
- operation payloads

Reject malformed requests early.

---

# Storage

Snapshots should be immutable once written.

Operation logs should be append-only.

Never mutate historical operations.

History is an audit log.

---

# Performance

Avoid:

- repeated JSON parsing
- unnecessary allocations
- quadratic algorithms

Prefer incremental synchronization.

Do not repeatedly serialize large vaults.

---

# Error Handling

Every failure should provide enough information to debug.

Good:

```
Revision mismatch.

Expected: 104

Received: 101
```

Bad:

```
Sync failed.
```

Never swallow Durable Object failures.

---

# Logging

Log:

- request ids
- vault ids
- revisions
- operation counts

Never log:

- note contents
- markdown
- encryption keys
- API tokens

---

# Dependencies

Avoid large frameworks.

Prefer lightweight libraries.

Every dependency must justify itself.

---

# Future-proofing

Do not implement features "for later."

Implement only what v0.1 requires.

Avoid premature abstraction.

---

# Never

Never:

- use global mutable state
- trust client revisions
- mutate operation history
- skip validation
- silently recover from corrupted state

---

# Always

Always:

- validate
- preserve determinism
- return structured errors
- optimize for Cloudflare limits
- keep Durable Objects small and focused
