# Protocol Documentation

Thoth synchronizes via atomic operations, not whole files.

## Core types
- `Operation` – immutable, ordered by `revision`
  - `id: string`
  - `type: 'create-note'|'delete-note'|'rename-note'|'replace-content'`
  - `deviceId: string`
  - `revision: number`
  - `payload` – type-specific

## Operation kinds
- `create-note` – `{ path, content }`
- `replace-content` – `{ path, content }`
- `rename-note` – `{ oldPath, newPath }`
- `delete-note` – `{ path }`

## Requests
- `PushOperationsRequest` – `{ baseRevision, operations[] }`
- `PullOperationsRequest` – `{ sinceRevision }`

## Responses
- `PushOperationsResponse` – `{ revision }`
- `PullOperationsResponse` – `{ revision, operations[] }`

## Validation
All requests validated with shared schemas in `@thoth/validation`.
- `operationSchema`
- `pushOperationsSchema`
- `pullOperationsSchema`
- `snapshotSchema`

## Invariants
- Revisions are monotonic and server-authoritative
- Operations are applied deterministically
- Log is append-only; snapshots are immutable
- Conflicts returned as 409 with current server revision
