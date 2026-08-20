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

/**
 * Operation kinds understood by the protocol.
 *
 * The concrete payload shape for each operation kind is defined in
 * Phase 4 (packages/operations). Until then the payload is an opaque
 * object.
 */
export type OperationType =
  | "create-note"
  | "delete-note"
  | "rename-note"
  | "replace-content";

/**
 * An atomic change transmitted between a device and the server.
 *
 * Operation payloads are validated as opaque objects for now; Phase 4
 * introduces per-kind payload models and validation.
 */
export interface Operation {
  /** Client-generated unique identifier for the operation. */
  id: OperationId;
  /** The kind of change this operation describes. */
  type: OperationType;
  /** Device that produced the operation. */
  deviceId: DeviceId;
  /** Revision the operation must apply on top of. */
  revision: Revision;
  /** Operation-specific payload (see OperationType). */
  payload: unknown;
}