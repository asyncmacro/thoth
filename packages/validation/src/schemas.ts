/**
 * Runtime schemas for the shared Thoth protocol.
 *
 * These are the single source of truth for validating request bodies as
 * they cross the wire. The server and the plugin use the same schemas so
 * client and server never drift apart.
 */

import type {
  CreateNoteOperation,
  CreateVaultRequest,
  DeleteNoteOperation,
  Operation,
  OperationType,
  PullOperationsRequest,
  PushOperationsRequest,
  RegisterDeviceRequest,
  RenameNoteOperation,
  ReplaceContentOperation,
} from '@thoth/protocol';

import {
  array,
  integer,
  object,
  oneOf,
  optional,
  record,
  string,
  unknownObject,
  type Validator,
} from './validators.js';

export const createVaultSchema: Validator<CreateVaultRequest> = object({
  name: optional(string({ maxLength: 200 })),
});

export const registerDeviceSchema: Validator<RegisterDeviceRequest> = object({
  deviceId: optional(
    string({
      pattern:
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    })
  ),
  name: optional(string({ maxLength: 100 })),
});

const createNotePayloadSchema: Validator<CreateNoteOperation['payload']> =
  object({
    path: string({ minLength: 1 }),
    content: string(),
  });

const deleteNotePayloadSchema: Validator<DeleteNoteOperation['payload']> =
  object({
    path: string({ minLength: 1 }),
  });

const renameNotePayloadSchema: Validator<RenameNoteOperation['payload']> =
  object({
    oldPath: string({ minLength: 1 }),
    newPath: string({ minLength: 1 }),
  });

const replaceContentPayloadSchema: Validator<
  ReplaceContentOperation['payload']
> = object({
  path: string({ minLength: 1 }),
  content: string(),
});

const payloadSchemas: Record<OperationType, Validator<unknown>> = {
  'create-note': createNotePayloadSchema,
  'delete-note': deleteNotePayloadSchema,
  'rename-note': renameNotePayloadSchema,
  'replace-content': replaceContentPayloadSchema,
};

const operationBaseSchema = object({
  id: string({ minLength: 1, maxLength: 200 }),
  type: oneOf('create-note', 'delete-note', 'rename-note', 'replace-content'),
  deviceId: string({ minLength: 1, maxLength: 200 }),
  revision: integer({ min: 0 }),
  payload: unknownObject(),
});

/**
 * Validates the operation envelope and then the type-specific payload,
 * so CreateNote, DeleteNote, RenameNote and ReplaceContent each get the
 * fields their semantics require.
 */
export const operationSchema: Validator<Operation> = (value) => {
  const base = operationBaseSchema(value);
  if (!base.ok) {
    return base;
  }

  const payloadSchema = payloadSchemas[base.value.type];
  const payload = payloadSchema(base.value.payload);
  if (!payload.ok) {
    return {
      ok: false,
      issues: payload.issues.map((issue) => ({
        path: issue.path.length === 0 ? 'payload' : `payload.${issue.path}`,
        message: issue.message,
      })),
    };
  }

  return {
    // The payload validator is keyed by the validated `type`, so the
    // runtime value is guaranteed to match the operation kind. The cast
    // is the boundary between validated (unknown) and typed data.
    ok: true,
    value: { ...base.value, payload: payload.value } as unknown as Operation,
  };
};

export const pushOperationsSchema: Validator<PushOperationsRequest> = object({
  baseRevision: integer({ min: 0 }),
  operations: array(operationSchema),
});

export const pullOperationsSchema: Validator<PullOperationsRequest> = object({
  sinceRevision: integer({ min: 0 }),
});

/** Schema for a persisted, append-only operation log. */
export const logSchema = object({
  operations: array(operationSchema),
});

/** Schema for a stored vault snapshot (revision + file map). */
export const snapshotSchema = object({
  revision: integer({ min: 0 }),
  files: record(string()),
});
