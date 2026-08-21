# Installation Guide

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Cloudflare account with Workers access

## Install

```bash
git clone https://github.com/your-org/thoth.git
cd thoth
pnpm install
```

## Obsidian Plugin

1. Build the plugin:
```bash
pnpm --filter @thoth/obsidian-plugin build
```
2. Copy `apps/obsidian-plugin/dist` to your Obsidian vault’s `.obsidian/plugins/thoth/` folder.
3. Enable the plugin in Obsidian Settings → Community plugins.

## Server

1. Configure environment variables in `apps/server/.env`:
   - `VAULT_DO` binding
   - `VERSION`
2. Deploy to Cloudflare Workers:
```bash
pnpm --filter @thoth/server deploy
```

## First sync

- Create a vault via the server API
- Register a device to receive an `apiKey` and `deviceId`
- Open Thoth settings in Obsidian and enter Server URL, Vault ID, Device ID, API key
- Run **Thoth: Sync now** from the command palette
