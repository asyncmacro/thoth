/**
 * Runtime schemas for the shared Thoth protocol.
 *
 * These are the single source of truth for validating request bodies as
 * they cross the wire. The server and the plugin use the same schemas so
 * client and server never drift apart.
 */

import type {
  CreateVaultRequest,
  Operation,
  PullOperationsRequest,
  PushOperationsRequest,
  RegisterDeviceRequest,
} from '@thoth/protocol';

import {
  array,
  integer,
  object,
  oneOf,
  optional,
  string,
  unknownObject,
  type Validator,
} from './validators.js';

export const createVaultSchema: Validator<CreateVaultRequest> = object({
  name: optional(string({ maxLength: 200 })),
});

export const registerDeviceSchema: Validator<RegisterDeviceRequest> = object({
  name: optional(string({ maxLength: 200 })),
});

export const operationSchema: Validator<Operation> = object({
  id: string({ minLength: 1, maxLength: 200 }),
  type: oneOf('create-note', 'delete-note', 'rename-note', 'replace-content'),
  deviceId: string({ minLength: 1, maxLength: 200 }),
  revision: integer({ min: 0 }),
  payload: unknownObject(),
});

export const pushOperationsSchema: Validator<PushOperationsRequest> = object({
  baseRevision: integer({ min: 0 }),
  operations: array(operationSchema),
});

export const pullOperationsSchema: Validator<PullOperationsRequest> = object({
  sinceRevision: integer({ min: 0 }),
});
