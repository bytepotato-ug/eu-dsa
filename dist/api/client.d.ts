/**
 * EU Transparency Database API client.
 *
 * Typed HTTP client for https://transparency.dsa.ec.europa.eu/api/v1/
 */
import type { SorSubmission, SorSubmissionResponse, SorBatchResponse, RateLimitInfo } from '../schemas/api-types.js';
import type { RequestInterceptor, ResponseInterceptor } from './interceptors.js';
import type { RetryConfig } from './retry.js';
import type { OfflineQueue, QueuedStatement } from './queue.js';
export interface TransparencyDatabaseClientConfig {
    token: string;
    baseUrl?: string;
    sandbox?: boolean;
    timeoutMs?: number;
    retry?: Partial<RetryConfig>;
    interceptors?: {
        request?: RequestInterceptor[];
        response?: ResponseInterceptor[];
    };
    fetch?: typeof globalThis.fetch;
    userAgent?: string;
}
export declare class TransparencyDatabaseClient {
    private readonly baseUrl;
    private readonly token;
    private readonly timeoutMs;
    private readonly retryConfig;
    private readonly requestInterceptors;
    private readonly responseInterceptors;
    private readonly fetchFn;
    private readonly userAgent;
    private queue;
    private lastRateLimitInfo;
    constructor(config: TransparencyDatabaseClientConfig);
    /**
     * Submit a single Statement of Reasons.
     * POST /api/v1/statement
     */
    submitStatement(submission: SorSubmission): Promise<SorSubmissionResponse>;
    /**
     * Submit a batch of Statements of Reasons (auto-chunks if >100).
     * POST /api/v1/statements
     */
    submitStatements(submissions: SorSubmission[]): Promise<SorBatchResponse>;
    /**
     * Check if a PUID already exists.
     * GET /api/v1/statement/existing-puid/{puid}
     *
     * Returns true if exists (302), false if not (404).
     */
    checkPuid(puid: string): Promise<{
        exists: boolean;
        puid: string;
    }>;
    /**
     * Retrieve a previously submitted Statement of Reasons.
     * GET /api/v1/statement/{id}
     */
    getStatement(id: number | string): Promise<SorSubmissionResponse>;
    /**
     * Test the API connection.
     * GET /api/ping
     */
    ping(): Promise<{
        ok: boolean;
        latencyMs: number;
    }>;
    /** Get rate limit info from last response */
    getRateLimitInfo(): RateLimitInfo | null;
    /** Attach an offline queue */
    setQueue(queue: OfflineQueue): void;
    /** Submit with automatic queueing on failure */
    submitOrQueue(submission: SorSubmission): Promise<SorSubmissionResponse | QueuedStatement>;
    /** Process all queued submissions */
    flushQueue(): Promise<{
        submitted: number;
        failed: number;
    }>;
    private validateSubmission;
    private request;
    private parseRateLimitHeaders;
}
//# sourceMappingURL=client.d.ts.map