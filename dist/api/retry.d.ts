/**
 * Retry logic with exponential backoff and jitter.
 */
export interface RetryConfig {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    retryableStatuses: number[];
    retryNetworkErrors?: boolean;
    onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}
export declare const DEFAULT_RETRY_CONFIG: RetryConfig;
export declare function withRetry<T>(fn: () => Promise<T>, config?: RetryConfig): Promise<T>;
//# sourceMappingURL=retry.d.ts.map