/**
 * Request models shared between clients and the server.
 *
 * These describe the body of every client-initiated API request.
 */

import type { Revision } from './common.js';
import type { Operation } from './operations.js';

export interface CreateVaultRequest {
  /** Optional human-readable vault name. */
  name?: string;
}

export interface RegisterDeviceRequest {
  /** Optional client-provided device identifier. If omitted the server generates one. */
  deviceId?: string;
  /** Optional human-readable device name (e.g. "Laptop"). */
  name?: string;
}

export interface PushOperationsRequest {
  /** Revision the client's operation list is based on. */
  baseRevision: Revision;
  /** Operations to append to the vault log, in order. */
  operations: Operation[];
}

export interface PullOperationsRequest {
  /**
   * First revision the client still needs. Send 0 for a fresh device.
   * The server returns operations with revision >= sinceRevision, in order.
   */
  sinceRevision: Revision;
}
