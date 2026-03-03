/**
 * Retry logic with exponential backoff and jitter.
 */
import { DsaApiError, DsaNetworkError, DsaRateLimitError } from './errors.js';
export const DEFAULT_RETRY_CONFIG = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30_000,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    retryNetworkErrors: true,
};
function calculateDelay(attempt, config) {
    const exponential = config.baseDelayMs * Math.pow(2, attempt - 1);
    const jitter = Math.random() * config.baseDelayMs;
    return Math.min(exponential + jitter, config.maxDelayMs);
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export async function withRetry(fn, config = DEFAULT_RETRY_CONFIG) {
    let lastError;
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt >= config.maxAttempts)
                break;
            // Determine if this error is retryable
            const isRetryableApi = error instanceof DsaApiError
                && config.retryableStatuses.includes(error.statusCode);
            const isRetryableNetwork = config.retryNetworkErrors !== false
                && error instanceof DsaNetworkError;
            if (!isRetryableApi && !isRetryableNetwork)
                throw error;
            let delayMs = calculateDelay(attempt, config);
            // Use retryAfterMs from DsaRateLimitError (parsed from Retry-After header).
            // Trust the server's Retry-After value — capping it risks retry storms.
            if (error instanceof DsaRateLimitError && error.retryAfterMs > 0) {
                delayMs = error.retryAfterMs;
            }
            config.onRetry?.(attempt, error, delayMs);
            await sleep(delayMs);
        }
    }
    throw lastError;
}
//# sourceMappingURL=retry.js.map