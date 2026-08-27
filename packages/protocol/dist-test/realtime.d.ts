/**
 * Real-time WebSocket protocol for vault change notifications.
 *
 * Types are shared between server and plugin to avoid duplication.
 */
import type { DeviceId, Revision } from './common.js';
export interface WsTicketRequest {
    deviceId: DeviceId;
    apiKey: string;
}
export interface WsTicketResponse {
    ticket: string;
    expiresAt: number;
}
/** Messages sent from server to client. */
export type RealtimeServerMessage = {
    type: 'vault-changed';
    revision: Revision;
} | {
    type: 'pong';
};
/** Messages sent from client to server. */
export type RealtimeClientMessage = {
    type: 'ping';
};
