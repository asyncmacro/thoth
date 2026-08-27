/**
 * Request models shared between clients and the server.
 *
 * These describe the body of every client-initiated API request.
 */
import type { ProtocolVersion, Revision } from './common.js';
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
    /** Protocol version client is speaking. Optional for backward compatibility. */
    protocolVersion?: ProtocolVersion;
    /** Idempotency key for retry safety. */
    requestId?: string;
}
export interface PullOperationsRequest {
    /**
     * First revision the client still needs. Send 0 for a fresh device.
     * The server returns operations with revision >= sinceRevision, in order.
     */
    sinceRevision: Revision;
    /** Protocol version client is speaking. Optional for backward compatibility. */
    protocolVersion?: ProtocolVersion;
    /** Maximum number of operations to return. Enables partial sync. */
    limit?: number;
    /** Continuation token for paginated sync. */
    continuationToken?: string;
}
//# sourceMappingURL=requests.d.ts.map