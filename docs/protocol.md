# Protocol Documentation

Thoth synchronizes via atomic operations, not whole files.

## Core types

- `Operation` – immutable, ordered by `revision`
  - `id: string` – stable ULID/UUID
  - `type: 'create-note'|'delete-note'|'rename-note'|'replace-content'|'insert-text'|'delete-text'|'replace-range'`
  - `deviceId: string`
  - `revision: number`
  - `parentRevision?: number`
  - `timestamp?: number`
  - `metadata?: Record<string,unknown>`
  - `payload` – type-specific

## Operation kinds

- `create-note` – `{ path, content }`
- `replace-content` – `{ path, content }`
- `rename-note` – `{ oldPath, newPath }`
- `delete-note` – `{ path }`
- `insert-text` – `{ path, index, text }`
- `delete-text` – `{ path, index, length }`
- `replace-range` – `{ path, index, length, text }`

## Requests

- `PushOperationsRequest` – `{ baseRevision, operations[], protocolVersion?, requestId? }`
- `PullOperationsRequest` – `{ sinceRevision, protocolVersion?, limit?, continuationToken? }`

## Responses

- `PushOperationsResponse` – `{ revision, protocolVersion?, capabilities?, acknowledged? }`
- `PullOperationsResponse` – `{ revision, operations[], protocolVersion?, capabilities?, continuationToken?, hasMore? }`

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
