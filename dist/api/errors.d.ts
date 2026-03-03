/**
 * Error class hierarchy for dsa-toolkit.
 *
 * DsaToolkitError (base)
 * ├── DsaValidationError — Zod schema validation failures
 * ├── DsaNetworkError — timeout/connection failures
 * └── DsaApiError — HTTP errors from the EU API
 *     ├── DsaAuthError — 401/403
 *     ├── DsaPuidConflictError — duplicate PUID (422)
 *     ├── DsaRateLimitError — 429
 *     └── DsaBatchError — partial batch failure
 */
import type { RateLimitInfo } from '../schemas/api-types.js';
export declare class DsaToolkitError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare class DsaValidationError extends DsaToolkitError {
    readonly fieldErrors: Record<string, string[]>;
    constructor(message: string, fieldErrors: Record<string, string[]>);
}
export declare class DsaNetworkError extends DsaToolkitError {
    readonly cause?: Error;
    constructor(message: string, cause?: Error);
}
export declare class DsaApiError extends DsaToolkitError {
    readonly statusCode: number;
    readonly response?: Record<string, unknown>;
    readonly rateLimitInfo?: RateLimitInfo;
    readonly requestId?: string;
    constructor(message: string, statusCode: number, response?: Record<string, unknown>, rateLimitInfo?: RateLimitInfo);
    get isRetryable(): boolean;
    get isRateLimited(): boolean;
    get fieldErrors(): Record<string, string[]> | undefined;
}
export declare class DsaAuthError extends DsaApiError {
    constructor(message: string, statusCode: 401 | 403, response?: Record<string, unknown>);
}
export declare class DsaPuidConflictError extends DsaApiError {
    readonly puid: string;
    constructor(puid: string, response?: Record<string, unknown>);
}
export declare class DsaRateLimitError extends DsaApiError {
    readonly retryAfterMs: number;
    constructor(retryAfterMs: number, rateLimitInfo?: RateLimitInfo);
}
export declare class DsaBatchError extends DsaToolkitError {
    readonly succeeded: Array<{
        index: number;
        uuid: string;
        puid: string;
    }>;
    readonly failed: Array<{
        index: number;
        puid?: string;
        errors: Record<string, string[]>;
    }>;
    constructor(succeeded: DsaBatchError['succeeded'], failed: DsaBatchError['failed']);
}
//# sourceMappingURL=errors.d.ts.map