# API Documentation

Base URL: `https://<worker>/`

## Health & Version

- `GET /health` → `{ status: "ok" }`
- `GET /version` → `{ version: string }`

## Vaults

- `POST /vaults` → create vault → `{ id, revision: 0 }`
- `GET /vaults/:id` → `{ id, revision }`
- `DELETE /vaults/:id` → 204

### Sync

- `POST /vaults/:id/push`
  Body: `{ baseRevision: number, operations: Operation[] }`
  Response: `{ revision: number }` or 409 Conflict
- `POST /vaults/:id/pull`
  Body: `{ sinceRevision: number }`
  Response: `{ revision: number, operations: Operation[] }`
- `GET /vaults/:id/snapshot`
  Response: `{ revision: number, files: Record<string,string> }`

### Devices

- `POST /vaults/:id/devices` → `{ deviceId, apiKey }`
- `GET /vaults/:id/devices` → `{ devices: [...] }`
- `DELETE /vaults/:id/devices/:deviceId` → 204
- `POST /vaults/:id/devices/:deviceId/rotate` → `{ deviceId, apiKey }`
- `POST /vaults/:id/devices/:deviceId/validate` → `{ valid: boolean }`

## Errors

Structured JSON:

```json
{
  "error": "VALIDATION_ERROR|REVISION_MISMATCH|CONFLICT|...",
  "message": "...",
  "details": {}
}
```

Status codes: 400, 404, 409, 500
