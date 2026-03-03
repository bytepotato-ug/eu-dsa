/**
 * PUID (Platform Unique Identifier) generation strategies.
 *
 * The PUID must be unique per platform and match /^[a-zA-Z0-9-_]+$/.
 * Max 500 characters.
 */
export interface PuidContext {
    platform?: string;
    actionType?: string;
    referenceId?: string;
    timestamp?: Date;
}
/**
 * Generate a deterministic PUID from platform + action type + reference ID.
 * Format: {platform}-{actionType}-{referenceId}
 */
export declare function deterministicPuid(ctx: {
    platform: string;
    actionType: string;
    referenceId: string;
}): string;
/**
 * Generate a PUID using UUID v4.
 * Format: {platform}-{uuid} or just {uuid}
 */
export declare function randomPuid(platform?: string): string;
/**
 * Generate a PUID using SHA-256 hash of components.
 * Format: {platform}-{16-char-hex-prefix}
 */
export declare function hashedPuid(platform: string, ...components: string[]): string;
/**
 * Generate a time-based PUID with a unique suffix.
 * Format: {platform}-{YYYYMMDD}-{random-suffix}
 */
export declare function timestampPuid(platform: string, date?: Date): string;
/** Validate a PUID format */
export declare function isValidPuid(puid: string): boolean;
//# sourceMappingURL=puid.d.ts.map