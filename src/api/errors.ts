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

export class DsaToolkitError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'DsaToolkitError';
    this.code = code;
  }
}

export class DsaValidationError extends DsaToolkitError {
  readonly fieldErrors: Record<string, string[]>;

  constructor(message: string, fieldErrors: Record<string, string[]>) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'DsaValidationError';
    this.fieldErrors = fieldErrors;
  }
}

export class DsaNetworkError extends DsaToolkitError {
  readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message, 'NETWORK_ERROR');
    this.name = 'DsaNetworkError';
    this.cause = cause;
  }
}

export class DsaApiError extends DsaToolkitError {
  readonly statusCode: number;
  readonly response?: Record<string, unknown>;
  readonly rateLimitInfo?: RateLimitInfo;
  readonly requestId?: string;

  constructor(
    message: string,
    statusCode: number,
    response?: Record<string, unknown>,
    rateLimitInfo?: RateLimitInfo,
  ) {
    super(message, `API_ERROR_${statusCode}`);
    this.name = 'DsaApiError';
    this.statusCode = statusCode;
    this.response = response;
    this.rateLimitInfo = rateLimitInfo;
  }

  get isRetryable(): boolean {
    return [408, 429, 500, 502, 503, 504].includes(this.statusCode);
  }

  get isRateLimited(): boolean {
    return this.statusCode === 429;
  }

  get fieldErrors(): Record<string, string[]> | undefined {
    if (this.response && 'errors' in this.response) {
      return this.response.errors as Record<string, string[]>;
    }
    return undefined;
  }
}

export class DsaAuthError extends DsaApiError {
  constructor(message: string, statusCode: 401 | 403, response?: Record<string, unknown>) {
    super(message, statusCode, response);
    this.name = 'DsaAuthError';
  }
}

export class DsaPuidConflictError extends DsaApiError {
  readonly puid: string;

  constructor(puid: string, response?: Record<string, unknown>) {
    super(`PUID "${puid}" already exists for this platform`, 422, response);
    this.name = 'DsaPuidConflictError';
    this.puid = puid;
  }
}

export class DsaRateLimitError extends DsaApiError {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number, rateLimitInfo?: RateLimitInfo) {
    super('Rate limit exceeded', 429, undefined, rateLimitInfo);
    this.name = 'DsaRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class DsaBatchError extends DsaToolkitError {
  readonly succeeded: Array<{ index: number; uuid: string; puid: string }>;
  readonly failed: Array<{ index: number; puid?: string; errors: Record<string, string[]> }>;

  constructor(
    succeeded: DsaBatchError['succeeded'],
    failed: DsaBatchError['failed'],
  ) {
    super(
      `Batch submission partially failed: ${succeeded.length} succeeded, ${failed.length} failed`,
      'BATCH_ERROR',
    );
    this.name = 'DsaBatchError';
    this.succeeded = succeeded;
    this.failed = failed;
  }
}
