/**
 * PUID (Platform Unique Identifier) generation strategies.
 *
 * The PUID must be unique per platform and match /^[a-zA-Z0-9-_]+$/.
 * Max 500 characters.
 */
import { createHash, randomUUID } from 'node:crypto';
/**
 * Generate a deterministic PUID from platform + action type + reference ID.
 * Format: {platform}-{actionType}-{referenceId}
 */
export function deterministicPuid(ctx) {
    return `${sanitize(ctx.platform)}-${sanitize(ctx.actionType)}-${sanitize(ctx.referenceId)}`;
}
/**
 * Generate a PUID using UUID v4.
 * Format: {platform}-{uuid} or just {uuid}
 */
export function randomPuid(platform) {
    const uuid = randomUUID();
    return platform ? `${sanitize(platform)}-${uuid}` : uuid;
}
/**
 * Generate a PUID using SHA-256 hash of components.
 * Format: {platform}-{16-char-hex-prefix}
 */
export function hashedPuid(platform, ...components) {
    const hash = createHash('sha256')
        .update(components.join(':'))
        .digest('hex')
        .slice(0, 16);
    return `${sanitize(platform)}-${hash}`;
}
/**
 * Generate a time-based PUID with a unique suffix.
 * Format: {platform}-{YYYYMMDD}-{random-suffix}
 */
export function timestampPuid(platform, date) {
    const d = date ?? new Date();
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = randomUUID().slice(0, 8);
    return `${sanitize(platform)}-${dateStr}-${suffix}`;
}
/** Validate a PUID format */
export function isValidPuid(puid) {
    return /^[a-zA-Z0-9\-_]+$/.test(puid) && puid.length > 0 && puid.length <= 500;
}
/** Sanitize a string for use in PUID (replace invalid chars with hyphens) */
function sanitize(str) {
    const result = str.replace(/[^a-zA-Z0-9\-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return result || 'platform';
}
//# sourceMappingURL=puid.js.map