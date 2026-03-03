# Error Handling

## Error Class Hierarchy

```
DsaToolkitError (base)
├── DsaValidationError    — Zod schema validation failures
├── DsaNetworkError       — Timeout / connection failures
└── DsaApiError           — HTTP errors from the EU API
    ├── DsaAuthError          — 401 / 403
    ├── DsaPuidConflictError  — Duplicate PUID (422)
    ├── DsaRateLimitError     — 429
    └── DsaBatchError         — Partial batch failure
```

All errors extend `DsaToolkitError` which extends `Error`. Every error has a `code` string for programmatic matching.

## Error Types

### DsaToolkitError

Base error for all dsa-toolkit errors.

| Property | Type | Description |
|----------|------|-------------|
| `message` | `string` | Human-readable error message |
| `code` | `string` | Error code for programmatic matching |

---

### DsaValidationError

Thrown when a `SorSubmission` fails Zod validation (in `SoRBuilder.build()` or `client.submitStatement()`).

| Property | Type | Description |
|----------|------|-------------|
| `code` | `'VALIDATION_ERROR'` | |
| `fieldErrors` | `Record<string, string[]>` | Per-field validation errors |

```ts
try {
  const sor = builder.build();
} catch (error) {
  if (error instanceof DsaValidationError) {
    console.log(error.fieldErrors);
    // { "decision_ground": ["Required"], "puid": ["Required"] }
  }
}
```

**Recovery:** Fix the input data and rebuild. Use `builder.validate()` for a non-throwing check.

---

### DsaNetworkError

Thrown on connection failures, DNS errors, or request timeouts.

| Property | Type | Description |
|----------|------|-------------|
| `code` | `'NETWORK_ERROR'` | |
| `cause` | `Error \| undefined` | Original error |

```ts
try {
  await client.submitStatement(sor);
} catch (error) {
  if (error instanceof DsaNetworkError) {
    console.log(error.message); // "Request timed out after 30000ms"
    console.log(error.cause);   // Original AbortError
  }
}
```

**Recovery:** Transient — auto-retried by `RetryConfig`. Use `submitOrQueue()` for offline resilience.

---

### DsaApiError

Thrown on non-success HTTP responses from the EU API.

| Property | Type | Description |
|----------|------|-------------|
| `code` | `'API_ERROR_{status}'` | e.g., `'API_ERROR_500'` |
| `statusCode` | `number` | HTTP status code |
| `response` | `Record<string, unknown> \| undefined` | API error response body |
| `rateLimitInfo` | `RateLimitInfo \| undefined` | Rate limit info from headers |
| `isRetryable` | `boolean` | True for 408, 429, 500, 502, 503, 504 |
| `isRateLimited` | `boolean` | True for 429 |
| `fieldErrors` | `Record<string, string[]> \| undefined` | Extracted from `response.errors` |

```ts
try {
  await client.submitStatement(sor);
} catch (error) {
  if (error instanceof DsaApiError) {
    if (error.isRetryable) {
      // Will be auto-retried by RetryConfig
    }
    console.log(error.statusCode); // 500
    console.log(error.response);   // { message: "Internal server error" }
  }
}
```

---

### DsaAuthError

Thrown on 401 (unauthenticated) or 403 (forbidden) responses. Extends `DsaApiError`.

| Property | Type | Description |
|----------|------|-------------|
| `statusCode` | `401 \| 403` | HTTP status |

```ts
catch (error) {
  if (error instanceof DsaAuthError) {
    if (error.statusCode === 401) {
      // Token expired or invalid — refresh credentials
    } else {
      // 403 — insufficient permissions
    }
  }
}
```

**Recovery:** Check and refresh your API token. Auth errors are not retryable.

---

### DsaPuidConflictError

Thrown when submitting a statement with a PUID that already exists for this platform (422 with `existing.puid` in response). Extends `DsaApiError`.

| Property | Type | Description |
|----------|------|-------------|
| `puid` | `string` | The conflicting PUID |

```ts
catch (error) {
  if (error instanceof DsaPuidConflictError) {
    console.log(`PUID already exists: ${error.puid}`);
    // Option 1: Skip (statement already submitted)
    // Option 2: Generate new PUID and resubmit
  }
}
```

**Recovery:** Skip the duplicate or use `checkPuid()` before submitting to avoid conflicts. Consider using `hashedPuid()` for deterministic deduplication.

---

### DsaRateLimitError

Thrown on 429 responses. Extends `DsaApiError`.

| Property | Type | Description |
|----------|------|-------------|
| `retryAfterMs` | `number` | How long to wait (from Retry-After header or 60s default) |
| `rateLimitInfo` | `RateLimitInfo \| undefined` | Parsed x-ratelimit-* headers |

```ts
catch (error) {
  if (error instanceof DsaRateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfterMs}ms`);
    console.log(error.rateLimitInfo); // { limit: 1000, remaining: 0, resetAt: Date }
  }
}
```

**Recovery:** Auto-handled by `RetryConfig` — the retry delay uses `retryAfterMs` from the response. Monitor via `getRateLimitInfo()` or the `api.rate_limited` event.

---

### DsaBatchError

Thrown when a batch submission partially fails. Extends `DsaToolkitError`.

| Property | Type | Description |
|----------|------|-------------|
| `code` | `'BATCH_ERROR'` | |
| `succeeded` | `Array<{ index, uuid, puid }>` | Successfully submitted items |
| `failed` | `Array<{ index, puid?, errors }>` | Failed items with per-field errors |

```ts
catch (error) {
  if (error instanceof DsaBatchError) {
    console.log(`${error.succeeded.length} succeeded, ${error.failed.length} failed`);
    for (const fail of error.failed) {
      console.log(`Item ${fail.index}: ${JSON.stringify(fail.errors)}`);
    }
  }
}
```

**Recovery:** Resubmit only the failed items after fixing validation errors. Successfully submitted items have UUIDs you can track.

---

## Retry Configuration

The API client retries transient failures automatically:

```ts
const client = new TransparencyDatabaseClient({
  token: 'your-token',
  retry: {
    maxAttempts: 3,        // Total attempts (1 initial + 2 retries)
    baseDelayMs: 1000,     // Initial delay
    maxDelayMs: 30_000,    // Maximum delay cap
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    retryNetworkErrors: true,
    onRetry: (attempt, error, delayMs) => {
      console.log(`Retry ${attempt} in ${delayMs}ms: ${error.message}`);
    },
  },
});
```

**Backoff formula:** `min(baseDelay * 2^(attempt-1) + random_jitter, maxDelay)`

**Rate limit override:** When a 429 response includes a `Retry-After` header, the retry delay uses the server's value instead of exponential backoff.

## Offline Queue Pattern

For high-availability submission, attach a queue to the client:

```ts
import { TransparencyDatabaseClient, InMemoryQueue } from 'dsa-toolkit';

const client = new TransparencyDatabaseClient({ token: 'your-token' });
const queue = new InMemoryQueue({ maxSize: 50_000, maxRetries: 5 });
client.setQueue(queue);

// submitOrQueue: submits if possible, queues if API is down
const result = await client.submitOrQueue(sor);

if ('status' in result) {
  // Queued — result is a QueuedStatement
  console.log(`Queued: ${result.id}, attempts: ${result.attempts}`);
} else {
  // Submitted — result is a SorSubmissionResponse
  console.log(`Submitted: ${result.uuid}`);
}

// Periodically flush the queue
const { submitted, failed } = await client.flushQueue();
```

The queue catches:
- `DsaNetworkError` (connection failures, timeouts)
- `DsaApiError` with `isRetryable: true` (408, 429, 500, 502, 503, 504)

Non-retryable errors (validation, auth, PUID conflict) are thrown immediately.

## Complete Error Handling Pattern

```ts
import {
  TransparencyDatabaseClient,
  DsaValidationError,
  DsaAuthError,
  DsaPuidConflictError,
  DsaRateLimitError,
  DsaBatchError,
  DsaNetworkError,
  DsaApiError,
} from 'dsa-toolkit';

try {
  const response = await client.submitStatement(sor);
} catch (error) {
  if (error instanceof DsaValidationError) {
    // Fix input: check error.fieldErrors
  } else if (error instanceof DsaAuthError) {
    // Refresh API token
  } else if (error instanceof DsaPuidConflictError) {
    // Skip duplicate or use new PUID
  } else if (error instanceof DsaRateLimitError) {
    // Already retried by RetryConfig — this means all retries exhausted
    // Wait error.retryAfterMs before trying again
  } else if (error instanceof DsaNetworkError) {
    // Connection failed after all retries
    // Consider queueing via submitOrQueue()
  } else if (error instanceof DsaApiError) {
    // Other API error (e.g., 500 after retries exhausted)
    console.log(error.statusCode, error.response);
  }
}
```
