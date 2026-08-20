/**
 * Success response models shared between clients and the server.
 *
 * These describe the body of every successful API response.
 */

import type { DeviceId, Revision, VaultId } from './common.js';
import type { Operation } from './operations.js';

export interface CreateVaultResponse {
  id: VaultId;
  revision: Revision;
}

export interface VaultMetadataResponse {
  id: VaultId;
  revision: Revision;
}

export interface DeviceSummary {
  id: DeviceId;
  createdAt: number;
}

export interface DeviceListResponse {
  devices: DeviceSummary[];
}

export interface RegisterDeviceResponse {
  deviceId: DeviceId;
  apiKey: string;
}

export interface PushOperationsResponse {
  /** New vault revision after the pushed operations were applied. */
  revision: Revision;
}

export interface PullOperationsResponse {
  /** Latest revision available on the server. */
  revision: Revision;
  /** Operations the client is missing, in revision order. */
  operations: Operation[];
}

export interface HealthResponse {
  status: 'ok';
}

export interface VersionResponse {
  version: string;
}
