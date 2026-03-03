/**
 * EU Transparency Database API client.
 *
 * Typed HTTP client for https://transparency.dsa.ec.europa.eu/api/v1/
 */
import { randomUUID } from 'node:crypto';
import { sorSubmissionSchema } from '../schemas/sor-schema.js';
import { DsaApiError, DsaAuthError, DsaNetworkError, DsaPuidConflictError, DsaRateLimitError, DsaValidationError, } from './errors.js';
import { DEFAULT_RETRY_CONFIG, withRetry } from './retry.js';
const PRODUCTION_BASE_URL = 'https://transparency.dsa.ec.europa.eu';
// The EU does not provide a public sandbox. When sandbox: true is set without
// a custom baseUrl, we use the production URL but log a warning. Platforms
// running integration tests should provide their own baseUrl or mock server.
const SANDBOX_BASE_URL = 'https://transparency.dsa.ec.europa.eu';
const VERSION = '0.5.0';
export class TransparencyDatabaseClient {
    baseUrl;
    token;
    timeoutMs;
    retryConfig;
    requestInterceptors;
    responseInterceptors;
    fetchFn;
    userAgent;
    queue = null;
    lastRateLimitInfo = null;
    constructor(config) {
        this.token = config.token;
        this.baseUrl = config.baseUrl ?? (config.sandbox ? SANDBOX_BASE_URL : PRODUCTION_BASE_URL);
        this.timeoutMs = config.timeoutMs ?? 30_000;
        this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retry };
        this.requestInterceptors = config.interceptors?.request ?? [];
        this.responseInterceptors = config.interceptors?.response ?? [];
        this.fetchFn = config.fetch ?? globalThis.fetch;
        this.userAgent = config.userAgent ?? `dsa-toolkit/${VERSION}`;
    }
    /**
     * Submit a single Statement of Reasons.
     * POST /api/v1/statement
     */
    async submitStatement(submission) {
        this.validateSubmission(submission);
        return withRetry(() => this.request('POST', '/api/v1/statement', submission), this.retryConfig);
    }
    /**
     * Submit a batch of Statements of Reasons (auto-chunks if >100).
     * POST /api/v1/statements
     */
    async submitStatements(submissions) {
        if (submissions.length === 0) {
            return { statements: [] };
        }
        for (const sub of submissions) {
            this.validateSubmission(sub);
        }
        const allStatements = [];
        // API limit: 100 per call
        const chunks = [];
        for (let i = 0; i < submissions.length; i += 100) {
            chunks.push(submissions.slice(i, i + 100));
        }
        for (const chunk of chunks) {
            const result = await withRetry(() => this.request('POST', '/api/v1/statements', { statements: chunk }), this.retryConfig);
            allStatements.push(...result.statements);
        }
        return { statements: allStatements };
    }
    /**
     * Check if a PUID already exists.
     * GET /api/v1/statement/existing-puid/{puid}
     *
     * Returns true if exists (302), false if not (404).
     */
    async checkPuid(puid) {
        try {
            await this.request('GET', `/api/v1/statement/existing-puid/${encodeURIComponent(puid)}`);
            return { exists: true, puid };
        }
        catch (error) {
            if (error instanceof DsaApiError && error.statusCode === 404) {
                return { exists: false, puid };
            }
            throw error;
        }
    }
    /**
     * Retrieve a previously submitted Statement of Reasons.
     * GET /api/v1/statement/{id}
     */
    async getStatement(id) {
        return this.request('GET', `/api/v1/statement/${id}`);
    }
    /**
     * Test the API connection.
     * GET /api/ping
     */
    async ping() {
        const start = Date.now();
        try {
            await this.request('GET', '/api/ping');
            return { ok: true, latencyMs: Date.now() - start };
        }
        catch {
            return { ok: false, latencyMs: Date.now() - start };
        }
    }
    /** Get rate limit info from last response */
    getRateLimitInfo() {
        return this.lastRateLimitInfo;
    }
    /** Attach an offline queue */
    setQueue(queue) {
        this.queue = queue;
    }
    /** Submit with automatic queueing on failure */
    async submitOrQueue(submission) {
        try {
            return await this.submitStatement(submission);
        }
        catch (error) {
            if (this.queue && ((error instanceof DsaApiError && error.isRetryable) ||
                error instanceof DsaNetworkError)) {
                return this.queue.enqueue(submission);
            }
            throw error;
        }
    }
    /** Process all queued submissions */
    async flushQueue() {
        if (!this.queue) {
            return { submitted: 0, failed: 0 };
        }
        return this.queue.flush((sub) => this.submitStatement(sub));
    }
    // ---- Private ----
    validateSubmission(submission) {
        const result = sorSubmissionSchema.safeParse(submission);
        if (!result.success) {
            const fieldErrors = {};
            for (const issue of result.error.issues) {
                const path = issue.path.join('.');
                if (!fieldErrors[path])
                    fieldErrors[path] = [];
                fieldErrors[path].push(issue.message);
            }
            throw new DsaValidationError('Statement of Reasons validation failed', fieldErrors);
        }
    }
    async request(method, path, body) {
        const url = `${this.baseUrl}${path}`;
        const requestId = randomUUID();
        let ctx = {
            method,
            url,
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': this.userAgent,
            },
            body,
            timestamp: new Date(),
            requestId,
        };
        // Run request interceptors
        for (const interceptor of this.requestInterceptors) {
            ctx = await interceptor(ctx);
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        let response;
        const startTime = Date.now();
        try {
            response = await this.fetchFn(ctx.url, {
                method: ctx.method,
                headers: ctx.headers,
                body: ctx.body ? JSON.stringify(ctx.body) : undefined,
                signal: controller.signal,
                redirect: 'manual', // Handle 302 for PUID check
            });
        }
        catch (error) {
            clearTimeout(timeout);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new DsaNetworkError(`Request timed out after ${this.timeoutMs}ms`, error);
            }
            throw new DsaNetworkError(`Network error: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined);
        }
        finally {
            clearTimeout(timeout);
        }
        // Parse rate limit headers
        this.lastRateLimitInfo = this.parseRateLimitHeaders(response.headers);
        // Parse response body
        let responseBody;
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
            try {
                responseBody = await response.json();
            }
            catch {
                responseBody = null;
            }
        }
        else {
            responseBody = await response.text();
        }
        // Run response interceptors
        const responseCtx = {
            request: ctx,
            statusCode: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            body: responseBody,
            durationMs: Date.now() - startTime,
            timestamp: new Date(),
        };
        for (const interceptor of this.responseInterceptors) {
            await interceptor(responseCtx);
        }
        // Handle 302 (PUID exists redirect)
        if (response.status === 302) {
            return responseBody;
        }
        // Handle success
        if (response.status >= 200 && response.status < 300) {
            return responseBody;
        }
        // Handle errors
        const errorResponse = responseBody;
        if (response.status === 401 || response.status === 403) {
            throw new DsaAuthError(`Authentication failed: ${response.status}`, response.status, errorResponse);
        }
        if (response.status === 429) {
            const retryAfter = response.headers.get('retry-after');
            let retryAfterMs = 60_000;
            if (retryAfter) {
                const seconds = parseInt(retryAfter, 10);
                if (!isNaN(seconds)) {
                    retryAfterMs = seconds * 1000;
                }
                else {
                    // Retry-After can be an HTTP-date (RFC 7231)
                    const date = new Date(retryAfter);
                    if (!isNaN(date.getTime())) {
                        retryAfterMs = Math.max(0, date.getTime() - Date.now());
                    }
                }
            }
            throw new DsaRateLimitError(retryAfterMs, this.lastRateLimitInfo ?? undefined);
        }
        if (response.status === 422 && errorResponse) {
            // Check for PUID conflict
            if (typeof errorResponse.existing === 'object' &&
                errorResponse.existing !== null &&
                'puid' in errorResponse.existing) {
                throw new DsaPuidConflictError(errorResponse.existing.puid, errorResponse);
            }
        }
        throw new DsaApiError(`EU Transparency Database API error: ${response.status}`, response.status, errorResponse, this.lastRateLimitInfo ?? undefined);
    }
    parseRateLimitHeaders(headers) {
        const limit = headers.get('x-ratelimit-limit');
        const remaining = headers.get('x-ratelimit-remaining');
        const reset = headers.get('x-ratelimit-reset');
        if (limit && remaining) {
            const parsedLimit = parseInt(limit, 10);
            const parsedRemaining = parseInt(remaining, 10);
            if (isNaN(parsedLimit) || isNaN(parsedRemaining))
                return null;
            return {
                limit: parsedLimit,
                remaining: parsedRemaining,
                resetAt: reset ? new Date(parseInt(reset, 10) * 1000) : new Date(),
            };
        }
        return null;
    }
}
//# sourceMappingURL=client.js.map