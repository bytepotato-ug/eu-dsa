/**
 * Pseudonymization helpers for GDPR-compliant SoR submissions.
 *
 * SoRs submitted to the EU Transparency Database must not contain personal data.
 */
import { createHmac } from 'node:crypto';
/**
 * Generate a pseudonymous identifier from a user ID using HMAC.
 */
export function pseudonymizeUserId(userId, config) {
    const algorithm = config.algorithm ?? 'sha256';
    const prefixLength = config.prefixLength ?? 12;
    const hmac = createHmac(algorithm, config.salt)
        .update(userId)
        .digest('hex')
        .slice(0, prefixLength);
    return `user_${hmac}`;
}
/**
 * Replace known strings in text with their pseudonymized versions.
 */
export function pseudonymizeText(text, replacements) {
    let result = text;
    // Sort by length descending to replace longer strings first
    const sorted = [...replacements.entries()].sort((a, b) => b[0].length - a[0].length);
    for (const [original, replacement] of sorted) {
        result = result.replaceAll(original, replacement);
    }
    return result;
}
/** IPv4 pattern */
const IPV4_REGEX = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;
/** IPv6 pattern — covers full, compressed (::), and IPv4-mapped forms */
const IPV6_REGEX = /(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}|::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}|::)/g;
/**
 * Strip IP addresses from text.
 */
export function stripIpAddresses(text) {
    return text
        .replace(IPV4_REGEX, '[IP_REDACTED]')
        .replace(IPV6_REGEX, '[IP_REDACTED]');
}
/** Email pattern */
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
/**
 * Strip email addresses from text.
 */
export function stripEmails(text) {
    return text.replace(EMAIL_REGEX, '[EMAIL_REDACTED]');
}
/**
 * Strip @mentions from text.
 */
export function stripMentions(text) {
    return text.replace(/@[a-zA-Z0-9_]+/g, '[USER_REDACTED]');
}
/**
 * Strip URLs that might contain user data.
 */
export function stripUserUrls(text, patterns) {
    let result = text;
    if (patterns) {
        for (const pattern of patterns) {
            result = result.replace(pattern, '[URL_REDACTED]');
        }
    }
    return result;
}
/**
 * Apply all pseudonymization in one pass.
 */
export function sanitizeForSubmission(text, options) {
    let result = text;
    if (options?.replacements)
        result = pseudonymizeText(result, options.replacements);
    if (options?.stripIps !== false)
        result = stripIpAddresses(result);
    if (options?.stripEmailAddresses !== false)
        result = stripEmails(result);
    if (options?.stripUserMentions)
        result = stripMentions(result);
    if (options?.urlPatterns)
        result = stripUserUrls(result, options.urlPatterns);
    return result;
}
//# sourceMappingURL=pseudonymize.js.map