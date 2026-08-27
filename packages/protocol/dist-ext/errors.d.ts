/**
 * Error models shared between clients and the server.
 *
 * `error` values are machine-readable and stable; `message` is
 * human-readable. Clients must branch on `error`, never on `message`.
 */
/** Stable, machine-readable error identifiers. */
export declare const ERROR_CODES: readonly ["BAD_REQUEST", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "CONFLICT", "REVISION_MISMATCH", "VALIDATION_ERROR", "INTERNAL_ERROR"];
export type ErrorCode = (typeof ERROR_CODES)[number];
export interface ErrorResponse {
    error: ErrorCode;
    message: string;
    details?: unknown;
    requestId?: string;
}
/** Describes a single invalid field in a request. */
export interface ValidationIssue {
    /**
     * Path of the invalid field, e.g. "operations[2].type".
     * An empty path refers to the whole payload.
     */
    path: string;
    message: string;
}
export interface ValidationErrorResponse extends ErrorResponse {
    error: 'VALIDATION_ERROR';
    details: {
        issues: ValidationIssue[];
    };
}
//# sourceMappingURL=errors.d.ts.map