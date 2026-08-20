import type {
  CreateNotePayload,
  DeleteNotePayload,
  DeviceId,
  Operation,
  RenameNotePayload,
  ReplaceContentPayload,
} from '@thoth/protocol';

/**
 * A local change before ids, devices and revisions are assigned. This is
 * the plugin-local input form the queue stamps into a full Operation.
 */
export type OperationDraft =
  | { type: 'create-note'; payload: CreateNotePayload }
  | { type: 'delete-note'; payload: DeleteNotePayload }
  | { type: 'rename-note'; payload: RenameNotePayload }
  | { type: 'replace-content'; payload: ReplaceContentPayload };

/**
 * In-memory queue of local operations waiting to be pushed.
 *
 * Local revisions mirror the engine's contiguous log: each queued
 * operation gets revision == queue position. These revisions are local
 * ordinals only; the server assigns authoritative revisions when the
 * batch is pushed (the push step re-stamps each operation).
 */
export class OperationQueue {
  private readonly operations: Operation[] = [];

  get size(): number {
    return this.operations.length;
  }

  /** Queue contents in enqueue order. */
  get all(): readonly Operation[] {
    return this.operations;
  }

  /** Next local revision (the queue position). */
  nextRevision(): number {
    return this.operations.length;
  }

  /** Stamps the draft with a device, id and local revision, then stores it. */
  enqueue(draft: OperationDraft, deviceId: DeviceId): Operation {
    const operation = this.build(draft, deviceId);
    this.operations.push(operation);
    return operation;
  }

  private build(draft: OperationDraft, deviceId: DeviceId): Operation {
    const id = crypto.randomUUID();
    const revision = this.nextRevision();
    switch (draft.type) {
      case 'create-note':
        return {
          id,
          type: 'create-note',
          deviceId,
          revision,
          payload: draft.payload,
        };
      case 'delete-note':
        return {
          id,
          type: 'delete-note',
          deviceId,
          revision,
          payload: draft.payload,
        };
      case 'rename-note':
        return {
          id,
          type: 'rename-note',
          deviceId,
          revision,
          payload: draft.payload,
        };
      case 'replace-content':
        return {
          id,
          type: 'replace-content',
          deviceId,
          revision,
          payload: draft.payload,
        };
    }
  }
}
