/**
 * Operation models shared across the Thoth protocol.
 *
 * Every change a device makes to a vault is transmitted as an atomic
 * operation. Each operation kind carries its own payload; `Operation` is
 * the discriminated union used on the wire and by the engine.
 */

import type { DeviceId, OperationId, Revision } from './common.js';

export type OperationType =
  'create-note' | 'delete-note' | 'rename-note' | 'replace-content';

export interface CreateNotePayload {
  /** Vault-relative note path, e.g. "notes/hello". */
  path: string;
  /** Full note content. */
  content: string;
}

export interface DeleteNotePayload {
  path: string;
}

export interface RenameNotePayload {
  oldPath: string;
  newPath: string;
}

export interface ReplaceContentPayload {
  path: string;
  content: string;
}

export interface CreateNoteOperation {
  id: OperationId;
  type: 'create-note';
  deviceId: DeviceId;
  /** Revision this operation applies on top of. */
  revision: Revision;
  payload: CreateNotePayload;
}

export interface DeleteNoteOperation {
  id: OperationId;
  type: 'delete-note';
  deviceId: DeviceId;
  revision: Revision;
  payload: DeleteNotePayload;
}

export interface RenameNoteOperation {
  id: OperationId;
  type: 'rename-note';
  deviceId: DeviceId;
  revision: Revision;
  payload: RenameNotePayload;
}

export interface ReplaceContentOperation {
  id: OperationId;
  type: 'replace-content';
  deviceId: DeviceId;
  revision: Revision;
  payload: ReplaceContentPayload;
}

export type Operation =
  | CreateNoteOperation
  | DeleteNoteOperation
  | RenameNoteOperation
  | ReplaceContentOperation;
