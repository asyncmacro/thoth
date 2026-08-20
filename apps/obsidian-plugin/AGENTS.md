# AGENTS.md

This file contains additional instructions specific to the Obsidian plugin.

These instructions supplement the root AGENTS.md.

---

# Goal

The plugin is responsible for:

- detecting local changes
- maintaining a local operation queue
- communicating with the server
- replaying remote operations
- remaining responsive while offline

The plugin is **not** authoritative.

The server decides synchronization state.

---

# Compatibility

The plugin MUST support:

- Obsidian Desktop
- Obsidian Mobile

Every feature should work on both unless explicitly documented.

Never implement desktop-only behavior without a fallback.

---

# JavaScript Target

The compiled JavaScript must be compatible with the Electron runtime shipped with supported Obsidian versions.

Always transpile with esbuild.

Do not emit syntax newer than the supported runtime.

Avoid experimental JavaScript features.

---

# Platform APIs

Prefer:

- Obsidian APIs
- Web APIs

Avoid direct Node.js APIs.

Do not depend on:

- fs
- path
- child_process
- worker_threads
- native addons

unless routed through official Obsidian APIs.

---

# Vault Access

Always use the official Obsidian Vault API.

Do not read or modify vault files outside the provided API.

Never assume filesystem paths behave identically across platforms.

---

# Synchronization

The plugin should:

- queue operations
- retry safely
- survive crashes
- resume after offline periods

Synchronization must be idempotent.

---

# Startup

Startup should be fast.

Avoid expensive vault scans.

Load only what is necessary.

Perform background work incrementally.

---

# Mobile

Assume:

- limited memory
- slower CPUs
- intermittent connectivity
- application suspension

Avoid large in-memory caches.

Avoid blocking the UI thread.

---

# Error Handling

Network failures are expected.

Do not spam notifications.

Retry with exponential backoff.

Differentiate between:

- network errors
- authentication failures
- validation failures
- server conflicts

---

# UI

The plugin should remain unobtrusive.

Avoid excessive modal dialogs.

Prefer:

- notices
- status indicators
- settings

---

# Build

The plugin must build cleanly with:

- TypeScript
- esbuild

Compilation warnings should be treated seriously.

Never disable strict mode to satisfy the compiler.

---

# Dependencies

Keep dependencies small.

Avoid Electron-specific packages.

Avoid Node-only packages.

Favor browser-compatible libraries.

---

# Performance

Avoid:

- repeatedly parsing large Markdown files
- unnecessary serialization
- repeated vault-wide scans

Prefer incremental updates.

---

# Testing

Test:

- desktop
- Android
- iOS

Verify:

- startup
- synchronization
- offline mode
- reconnect
- plugin reload

---

# Never

Never:

- assume desktop APIs
- block the UI thread
- lose queued operations
- ignore failed syncs
- use unsupported browser APIs

---

# Always

Always:

- build for desktop and mobile
- use Obsidian APIs
- transpile for the supported Electron runtime
- preserve offline changes
- keep the UI responsive
