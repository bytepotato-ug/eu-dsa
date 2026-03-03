/**
 * Pseudonymization helpers for GDPR-compliant SoR submissions.
 *
 * SoRs submitted to the EU Transparency Database must not contain personal data.
 */
export interface PseudonymizationConfig {
    salt: string;
    algorithm?: 'sha256' | 'sha384' | 'sha512';
    prefixLength?: number;
}
/**
 * Generate a pseudonymous identifier from a user ID using HMAC.
 */
export declare function pseudonymizeUserId(userId: string, config: PseudonymizationConfig): string;
/**
 * Replace known strings in text with their pseudonymized versions.
 */
export declare function pseudonymizeText(text: string, replacements: Map<string, string>): string;
/**
 * Strip IP addresses from text.
 */
export declare function stripIpAddresses(text: string): string;
/**
 * Strip email addresses from text.
 */
export declare function stripEmails(text: string): string;
/**
 * Strip @mentions from text.
 */
export declare function stripMentions(text: string): string;
/**
 * Strip URLs that might contain user data.
 */
export declare function stripUserUrls(text: string, patterns?: RegExp[]): string;
/**
 * Apply all pseudonymization in one pass.
 */
export declare function sanitizeForSubmission(text: string, options?: {
    replacements?: Map<string, string>;
    stripIps?: boolean;
    stripEmailAddresses?: boolean;
    stripUserMentions?: boolean;
    urlPatterns?: RegExp[];
}): string;
//# sourceMappingURL=pseudonymize.d.ts.map