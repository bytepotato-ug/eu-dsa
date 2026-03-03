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
export class DsaToolkitError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.name = 'DsaToolkitError';
        this.code = code;
    }
}
export class DsaValidationError extends DsaToolkitError {
    fieldErrors;
    constructor(message, fieldErrors) {
        super(message, 'VALIDATION_ERROR');
        this.name = 'DsaValidationError';
        this.fieldErrors = fieldErrors;
    }
}
export class DsaNetworkError extends DsaToolkitError {
    cause;
    constructor(message, cause) {
        super(message, 'NETWORK_ERROR');
        this.name = 'DsaNetworkError';
        this.cause = cause;
    }
}
export class DsaApiError extends DsaToolkitError {
    statusCode;
    response;
    rateLimitInfo;
    requestId;
    constructor(message, statusCode, response, rateLimitInfo) {
        super(message, `API_ERROR_${statusCode}`);
        this.name = 'DsaApiError';
        this.statusCode = statusCode;
        this.response = response;
        this.rateLimitInfo = rateLimitInfo;
    }
    get isRetryable() {
        return [408, 429, 500, 502, 503, 504].includes(this.statusCode);
    }
    get isRateLimited() {
        return this.statusCode === 429;
    }
    get fieldErrors() {
        if (this.response && 'errors' in this.response) {
            return this.response.errors;
        }
        return undefined;
    }
}
export class DsaAuthError extends DsaApiError {
    constructor(message, statusCode, response) {
        super(message, statusCode, response);
        this.name = 'DsaAuthError';
    }
}
export class DsaPuidConflictError extends DsaApiError {
    puid;
    constructor(puid, response) {
        super(`PUID "${puid}" already exists for this platform`, 422, response);
        this.name = 'DsaPuidConflictError';
        this.puid = puid;
    }
}
export class DsaRateLimitError extends DsaApiError {
    retryAfterMs;
    constructor(retryAfterMs, rateLimitInfo) {
        super('Rate limit exceeded', 429, undefined, rateLimitInfo);
        this.name = 'DsaRateLimitError';
        this.retryAfterMs = retryAfterMs;
    }
}
export class DsaBatchError extends DsaToolkitError {
    succeeded;
    failed;
    constructor(succeeded, failed) {
        super(`Batch submission partially failed: ${succeeded.length} succeeded, ${failed.length} failed`, 'BATCH_ERROR');
        this.name = 'DsaBatchError';
        this.succeeded = succeeded;
        this.failed = failed;
    }
}
//# sourceMappingURL=errors.js.map