/**
 * Thoth protocol: wire-level types shared between the server and the
 * Obsidian plugin. The server is the source of truth; clients never
 * invent server state.
 */

export {
  DeviceId,
  Operation,
  OperationId,
  OperationType,
  Revision,
  VaultId,
} from './common.js';
export {
  CreateVaultRequest,
  PullOperationsRequest,
  PushOperationsRequest,
  RegisterDeviceRequest,
} from './requests.js';
export {
  CreateVaultResponse,
  DeviceListResponse,
  DeviceSummary,
  HealthResponse,
  PullOperationsResponse,
  PushOperationsResponse,
  RegisterDeviceResponse,
  VaultMetadataResponse,
  VersionResponse,
} from './responses.js';
export {
  ERROR_CODES,
  ErrorCode,
  ErrorResponse,
  ValidationErrorResponse,
  ValidationIssue,
} from './errors.js';
