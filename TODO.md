I would treat v0.2 as "Production Readiness". v0.1 proves the architecture; v0.2 makes it something you'd actually want to use every day.


---

Phase 1 — Protocol Evolution

Operation Model

[x] More granular text operations

[x] Stable operation IDs (UUID/ULID)

[x] Parent revision references

[x] Operation timestamps (informational only)

[x] Device attribution

[x] Optional operation metadata


Synchronization

[x] Operation batching

[x] Incremental acknowledgements

[x] Partial sync responses

[x] Better retry semantics

[x] Improved idempotency


Validation

[x] Protocol version negotiation

[x] Backward-compatible request parsing

Protocol capability flags



---

Phase 2 — Real-Time Sync

Connections

Durable Object WebSocket support

Connection lifecycle management

Heartbeats

Automatic reconnection

Idle timeout handling


Events

Push new operations instantly

Remote device notifications

Immediate revision updates

Live vault state


Client

Automatic reconnect

Offline detection

Seamless transition between polling and real-time



---

Phase 3 — Attachment Synchronization

Asset Support

Images

PDFs

Audio

Videos

Arbitrary files


Storage

Asset metadata

Upload protocol

Download protocol

Hash verification

Duplicate detection


Synchronization

Asset operations

Missing asset detection

Lazy downloads

Background asset synchronization



---

Phase 4 — Snapshot Improvements

Snapshots

Automatic snapshot intervals

Snapshot compaction

Snapshot pruning

Snapshot verification


Recovery

Restore from snapshot

Verify snapshot integrity

Snapshot migration



---

Phase 5 — Reliability

Recovery

Crash recovery

Interrupted upload recovery

Interrupted download recovery

Queue recovery


Integrity

Operation checksum verification

Snapshot checksum verification

Corruption detection

Revision verification


Diagnostics

Sync health report

Last successful sync

Sync statistics

Failure history



---

Phase 6 — Conflict Resolution

Detection

Better concurrent edit detection

Duplicate operation detection

Replay protection


Resolution

Improved automatic merges

Better revision reconciliation

Conflict reporting

Retry optimization


Still not full CRDT.


---

Phase 7 — Plugin UX

Settings

Connection diagnostics

Test connection

Device information

Sync statistics


Commands

Sync now

Pause synchronization

Resume synchronization

Reset local cache


Status

Status bar indicator

Current sync state

Queue size

Last synchronization

Active server



---

Phase 8 — Performance

Server

Reduce Durable Object CPU usage

Reduce storage writes

Smarter serialization

Faster replay


Plugin

Incremental vault scanning

Lower memory usage

Reduced startup time

Efficient operation queue



---

Phase 9 — Security

Authentication

API key rotation

Device revocation

Session validation


Validation

Request hardening

Better input validation

Abuse protection


Server

Request size limits

Operation count limits

Rate limiting (lightweight)



---

Phase 10 — Developer Experience

Documentation

Protocol specification

Synchronization flow

Architecture diagrams

Deployment guide


Tooling

Local development improvements

Better logging

Debug mode

Replay operation logs


Testing

Larger integration suite

Multi-device tests

Long-running sync tests

Stress testing

Performance benchmarks



---

Phase 11 — API Improvements

API

Versioned endpoints

Capability discovery

Better error responses

Consistent response models


Compatibility

Graceful protocol upgrades

Client version checks



---

Phase 12 — Production Polish

Stability

Memory leak testing

Worker restart testing

Durable Object restart testing


Compatibility

Latest Obsidian Desktop

Android

iOS


Release

Migration documentation

Upgrade path from v0.1

Changelog

Release validation



---

Nice-to-Have (Stretch Goals)

These aren't essential, but would be welcome additions if time allows:

Vault sync history and timeline

Per-device sync history

Sync activity log

Sync performance metrics

Optional debug panel

Asset deduplication by hash

Background attachment downloads

Smarter operation compaction

Snapshot export/import

Server maintenance commands



---

Deliberately Deferred to v0.3+

These are intentionally postponed because they significantly increase architectural complexity:

Multi-user shared vaults

User accounts

Role-based permissions

Live collaborative editing

CRDT implementation

End-to-end encryption

Web dashboard

Plugin marketplace integration

Search indexing

Comments and annotations

Presence indicators

Push notifications

AI-powered features

Cross-vault synchronization

Git interoperability


What v0.2 should feel like

The goal isn't to add the most features—it's to make Thoth feel invisible. Users shouldn't think about synchronization at all. They edit notes on one device, open another, and everything is already there. It should recover gracefully from network interruptions, efficiently handle larger vaults and attachments, provide enough diagnostics to troubleshoot issues, and continue to run comfortably within the Cloudflare free tier. At the end of v0.2, Thoth should feel like a dependable piece of infrastructure rather than an experimental sync engine.  
