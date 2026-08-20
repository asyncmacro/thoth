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

- [ ] CreateVault
- [ ] RegisterDevice
- [ ] PushOperations
- [ ] PullOperations

## Response models

- [ ] Success responses
- [ ] Error responses
- [ ] Validation errors

## Validation

- [ ] Runtime schemas
- [ ] Shared validation helpers

---

# Phase 4 — Operation Engine

## Operation model

- [ ] CreateNote
- [ ] DeleteNote
- [ ] RenameNote
- [ ] ReplaceContent

## Engine

- [ ] Apply operation
- [ ] Validate operation
- [ ] Reject invalid operations
- [ ] Increment revision

## Persistence

- [ ] Append-only operation log
- [ ] Snapshot storage

---

# Phase 5 — Synchronization API

## Push

- [ ] Upload operations
- [ ] Validate revisions
- [ ] Store operations
- [ ] Return new revision

## Pull

- [ ] Fetch missing operations
- [ ] Return latest revision

## Conflict handling

- [ ] Revision mismatch detection
- [ ] 409 responses
- [ ] Retry workflow support

---

# Phase 6 — Obsidian Plugin Foundation

## Plugin

- [ ] Plugin bootstrap
- [ ] Settings tab
- [ ] Save settings

## Configuration

- [ ] Server URL
- [ ] API key
- [ ] Device ID

## Connectivity

- [ ] Server health check
- [ ] Authentication test

---

# Phase 7 — Local Change Detection

## File events

- [ ] Note created
- [ ] Note modified
- [ ] Note renamed
- [ ] Note deleted

## Operation generation

- [ ] Convert events to operations
- [ ] Assign local revisions
- [ ] Queue operations

---

# Phase 8 — Local Queue

## Queue

- [ ] Persistent queue
- [ ] Load on startup
- [ ] Save after changes

## Offline support

- [ ] Queue while offline
- [ ] Retry automatically
- [ ] Exponential backoff

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
