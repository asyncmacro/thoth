/**
 * Shared primitive types used across the Thoth protocol.
 *
 * These wire-level identifiers and revisions are used by both the
 * server and the Obsidian plugin. Keep them small and opaque.
 */

export type VaultId = string;
export type DeviceId = string;
export type OperationId = string;
export type Revision = number;
export type ProtocolVersion = number;

export type ProtocolCapability =
  | 'batching'
  | 'partial-sync'
  | 'granular-ops'
  | 'idempotency'
  | 'version-negotiation';

export interface OperationMetadata {
  [key: string]: unknown;
}
