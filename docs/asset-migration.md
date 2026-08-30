# Asset Migration (v0.1 → v0.2)

Existing vaults store binary files (png, jpg, pdf, etc.) as base64 in `VaultState.files` via `create-note`/`replace-content`. This still works — `vault-applier.ts` decodes base64 for `isBinaryPath`.

New behavior: binary `create`/`modify` via `vault-listener.ts` now emit `add-asset` (`assetId=encodeURIComponent(path)`, `hash=SHA-256`, `size`, `mimeType`) and upload the blob via `PUT /vaults/:id/assets/:assetId` before `push`. `delete` emits `delete-asset`. `VaultState` now has `assets: Record<path, {assetId,hash,size,mimeType}>` and `engine.ts` tracks it; `VaultDurableObject` persists it in `snapshot.assets` and compaction keeps it.

Migration:
- No action needed. Old base64 files remain in `files` and are readable on all devices.
- New or modified binaries will be stored as `assets` after the next modify. The first `add-asset` push will upload the blob; subsequent `pull` downloads via `GET /assets/:assetId`.
- Snapshot from pre-0.2 vaults has no `assets` field — `deserializeSnapshot` and `VaultDurableObject.load()` default `assets={}`.
- After 500 ops `compactLog` now preserves `assets` in the snapshot; previously `add-asset` ops would be dropped.
- `MAX_ASSET_SIZE=10MB` — larger files are skipped with a console warning and need manual split.

# Auth Wizard (v0.2) — One Field

User enters only `Server URL` (`https://…`, validated via `validateServerUrl`, `checkHealth` `✓/✗`). `Vault` is picker: `Create new vault` auto-creates `vaultId` (pushed to `lastVaultIds`) or `Import thoth://?serverUrl=&vaultId=` link. `Device` name defaults via `defaultDeviceName()`, `deviceId` auto `uuidv4()`, no manual `deviceId`/`apiKey` typing. Settings-tab shows `1. Server → 2. Vault → 3. Device` stepper with `Dropdown recent` and `Check` inline status.
