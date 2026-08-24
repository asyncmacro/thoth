# Full Setup Guide: Cloudflare → Obsidian

This guide walks you from a fresh Cloudflare Workers deployment to a working Thoth plugin in Obsidian Desktop / Mobile.

## Prerequisites

- Cloudflare account
- Node.js 20+, pnpm
- Obsidian 1.4+ installed
- Access to a test vault

## 1. Deploy the Thoth Server to Cloudflare

### 1.1 Create a Worker

1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Workers & Pages → Create Application → Workers
3. Name: `thoth-sync`
4. Choose a subdomain, e.g. `thoth-sync.your-subdomain.workers.dev`

### 1.2 Bind Durable Object

1. In the Worker editor, open Settings → Durable Objects
2. Add binding:
   - Binding name: `VAULT_DO`
   - Class name: `VaultDurableObject`
3. Add environment variable:
   - Name: `VERSION`
   - Value: `0.1.0`

### 1.3 Deploy code

From the repo:

```bash
pnpm install
pnpm --filter @thoth/server build
wrangler deploy apps/server/dist/index.js
```

Or use the Cloudflare dashboard’s “Deploy” button after pasting the built Worker.

The Worker exposes:

- `POST /vaults` – create vault
- `POST /vaults/:id/push` – upload operations
- `POST /vaults/:id/pull` – download operations
- `GET /vaults/:id/snapshot` – snapshot restore
- Device management under `/vaults/:id/devices`

## 2. Create a Vault and Device

### 2.1 Create vault

```bash
curl -X POST https://thoth-sync.your-subdomain.workers.dev/vaults
```

Response:

```json
{ "id": "uuid", "revision": 0 }
```

Save the `id`.

### 2.2 Register a device

```bash
curl -X POST https://thoth-sync.your-subdomain.workers.dev/vaults/<VAULT_ID>/devices
```

Response:

```json
{ "deviceId": "uuid", "apiKey": "uuid" }
```

Save both `deviceId` and `apiKey`. Keep the API key secret.

## 3. Build the Obsidian Plugin

### 3.1 Build

```bash
pnpm install
pnpm --filter @thoth/obsidian-plugin build
```

Output: `apps/obsidian-plugin/dist/main.js` + `manifest.json`

### 3.2 Install into Obsidian

**Desktop**

1. Open Obsidian → Settings → Community plugins → Disable Safe mode
2. Copy `apps/obsidian-plugin/dist` to:
   `~/.config/obsidian/<Vault>/ .obsidian/plugins/thoth/`
3. Reload Obsidian
4. Enable “Thoth Sync” in Community plugins

**Mobile**

1. Enable Developer mode in Obsidian Mobile settings
2. Upload the plugin folder via Files app or Obsidian’s plugin installer
3. Enable the plugin

## 4. Configure the Plugin

1. Open Obsidian Settings → Thoth Sync
2. Fill in:
   - Server URL: `https://thoth-sync.your-subdomain.workers.dev`
   - Vault ID: `<VAULT_ID>`
   - Device ID: `<deviceId>`
   - API Key: `<apiKey>`
3. Save

Test connection:

- Command Palette → **Thoth: Check Thoth connection**
- Should show “Server is reachable” and “Authentication succeeded”

## 5. First Synchronization

1. Command Palette → **Thoth: Sync now**
2. On first run the plugin will:
   - Download snapshot if available
   - Apply snapshot to vault
   - Pull remaining operations
3. Subsequent edits create operations locally, queue them, and upload on the next sync

### Periodic sync

The plugin syncs every 60 s by default with exponential backoff on failure. Manual sync is always available via the command palette.

## 6. Daily Workflow

- Edit notes normally in Obsidian
- Changes are detected via file events, converted to operations, and queued
- Offline edits are queued and uploaded when online
- Sync runs automatically in background and on app start

## 7. Troubleshooting

- **Health check fails**: Verify Worker URL and `VERSION` env var
- **Authentication failed**: Re-register device and update API key
- **Revision mismatch 409**: Sync will retry; ensure only one sync runs at a time
- **No changes syncing**: Check Settings → Thoth Sync fields are filled

## Security Notes

- Never commit API keys
- API keys are SHA-256 hashed on server
- Do not log vault contents

You now have a Cloudflare-hosted Thoth server and Obsidian plugin synchronized via atomic operations.
