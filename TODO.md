# TODO.md

# Thoth v0.1 Roadmap

> Goal: Build a reliable, offline-first synchronization system for Obsidian using Cloudflare Workers and Durable Objects while remaining entirely within the Cloudflare Free tier.
>
> Every completed phase should leave the project in a working state.

---

# Phase 0 — Repository Bootstrap

## Monorepo

- [x] Initialize pnpm workspace
- [x] Configure TypeScript project references
- [x] Configure ESLint
- [x] Configure Prettier
- [x] Configure Vitest
- [x] Configure esbuild
- [x] Configure shared tsconfig
- [x] Configure CI (lint + typecheck + tests)

## Repository

- [x] Root AGENTS.md
- [x] Server AGENTS.md
- [x] Plugin AGENTS.md
- [x] LICENSE
- [x] README
- [x] CONTRIBUTING
- [x] .editorconfig
- [x] .gitignore

## Packages

- [x] packages/protocol
- [x] packages/operations
- [x] packages/validation
- [x] packages/utils

---

# Phase 1 — Server Foundation

## Cloudflare Worker

- [x] Worker entrypoint
- [x] Local development
- [x] Deployment configuration
- [x] Environment configuration

## Health

- [x] GET /health
- [x] Version endpoint

## Error handling

- [x] Global error handler
- [x] Structured JSON errors
- [x] Error identifiers

## Logging

- [x] Request IDs
- [x] Structured logs
- [x] Development logging

---

# Phase 2 — Vault Management

## Vaults

- [x] Create vault
- [x] Retrieve vault metadata
- [x] Delete vault

## Devices

- [x] Register device
- [x] Remove device
- [x] Rotate API key
- [x] Validate API keys

## Durable Object

- [x] Vault Durable Object
- [x] Persistent state
- [x] Revision counter

---

# Phase 3 — Shared Protocol

## Request models

- [x] CreateVault
- [x] RegisterDevice
- [x] PushOperations
- [x] PullOperations

## Response models

- [x] Success responses
- [x] Error responses
- [x] Validation errors

## Validation

- [x] Runtime schemas
- [x] Shared validation helpers

---

# Phase 4 — Operation Engine

## Operation model

- [x] CreateNote
- [x] DeleteNote
- [x] RenameNote
- [x] ReplaceContent

## Engine

- [x] Apply operation
- [x] Validate operation
- [x] Reject invalid operations
- [x] Increment revision

## Persistence

- [x] Append-only operation log
- [x] Snapshot storage

---

# Phase 5 — Synchronization API

## Push

- [x] Upload operations
- [x] Validate revisions
- [x] Store operations
- [x] Return new revision

## Pull

- [x] Fetch missing operations
- [x] Return latest revision

## Conflict handling

- [x] Revision mismatch detection
- [x] 409 responses
- [x] Retry workflow support

---

# Phase 6 — Obsidian Plugin Foundation

## Plugin

- [x] Plugin bootstrap
- [x] Settings tab
- [x] Save settings

## Configuration

- [x] Server URL
- [x] API key
- [x] Device ID

## Connectivity

- [x] Server health check
- [x] Authentication test

---

# Phase 7 — Local Change Detection

## File events

- [x] Note created
- [x] Note modified
- [x] Note renamed
- [x] Note deleted

## Operation generation

- [x] Convert events to operations
- [x] Assign local revisions
- [x] Queue operations

---

# Phase 8 — Local Queue

## Queue

- [x] Persistent queue
- [x] Load on startup
- [x] Save after changes

## Offline support

- [x] Queue while offline
- [x] Retry automatically
- [x] Exponential backoff

---

# Phase 9 — Synchronization Engine

## Upload

- [ ] Send queued operations
- [ ] Remove acknowledged operations

## Download

- [ ] Download missing operations
- [ ] Apply operations locally

## Startup

- [ ] Initial synchronization

## Background

- [ ] Periodic synchronization
- [ ] Manual synchronization command

---

# Phase 10 — Snapshot Support

## Server

- [ ] Snapshot creation
- [ ] Snapshot persistence

## Client

- [ ] Restore from snapshot
- [ ] Apply remaining operations

---

# Phase 11 — Reliability

## Recovery

- [ ] Restart during sync
- [ ] Retry failed uploads
- [ ] Retry failed downloads

## Validation

- [ ] Ignore malformed operations
- [ ] Recover from invalid server responses

## Error reporting

- [ ] Friendly user messages
- [ ] Developer diagnostics

---

# Phase 12 — Testing

## Protocol

- [ ] Serialization tests
- [ ] Validation tests

## Operation engine

- [ ] Operation application
- [ ] Revision tracking
- [ ] Snapshot generation

## Server

- [ ] API tests
- [ ] Authentication tests
- [ ] Conflict tests

## Plugin

- [ ] Queue persistence
- [ ] Offline synchronization
- [ ] Startup synchronization
- [ ] Settings persistence

---

# Phase 13 — Documentation

## Documentation

- [ ] Installation guide
- [ ] Local development
- [ ] Deployment guide
- [ ] API documentation
- [ ] Protocol documentation

---

# Phase 14 — Release Candidate

## Validation

- [ ] Desktop testing
- [ ] Android testing
- [ ] iOS testing

## Performance

- [ ] Measure sync latency
- [ ] Measure Worker CPU usage
- [ ] Verify Cloudflare Free compatibility

## Cleanup

- [ ] Remove dead code
- [ ] Remove debug logging
- [ ] Final lint
- [ ] Final typecheck
- [ ] Final tests

---

# Definition of Done

A v0.1 release is complete when all of the following are true:

- [ ] Server deploys successfully to Cloudflare Workers
- [ ] Entire stack runs on the Cloudflare Free tier
- [ ] Vaults can be created and synchronized
- [ ] Devices can register and authenticate
- [ ] Operations synchronize correctly between two devices
- [ ] Offline edits synchronize after reconnecting
- [ ] No data loss occurs during normal synchronization
- [ ] Plugin works on Obsidian Desktop
- [ ] Plugin works on Obsidian Mobile (Android & iOS)
- [ ] All tests pass
- [ ] TypeScript compiles with zero errors
- [ ] ESLint passes
- [ ] Documentation is complete

---

# Future (v0.2+)

These are intentionally excluded from v0.1:

- [ ] Live collaboration
- [ ] WebSockets
- [ ] CRDT-based merging
- [ ] Multi-user vaults
- [ ] Shared workspaces
- [ ] Attachments
- [ ] Binary synchronization
- [ ] End-to-end encryption
- [ ] User accounts
- [ ] Web dashboard
- [ ] Presence
- [ ] Rich conflict resolution UI
- [ ] Synchronization analytics
- [ ] Plugin telemetry
- [ ] Operation compression
- [ ] Background push notifications
