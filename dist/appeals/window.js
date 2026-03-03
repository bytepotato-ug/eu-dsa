/**
 * Appeal window tracker per DSA Art. 20(1).
 *
 * Recipients of content moderation decisions have 6 months
 * from the date of the decision to file an appeal.
 */
const MS_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_MS = 180 * MS_DAY;
/**
 * Check if the appeal window is open for a given decision date.
 */
export function isAppealWindowOpen(decisionDate, config) {
    const windowMs = config?.windowMs ?? DEFAULT_WINDOW_MS;
    const expiresAt = decisionDate.getTime() + windowMs;
    return Date.now() < expiresAt;
}
/**
 * Get detailed appeal window status.
 */
export function getAppealWindowStatus(decisionDate, config) {
    const windowMs = config?.windowMs ?? DEFAULT_WINDOW_MS;
    const expiresAt = new Date(decisionDate.getTime() + windowMs);
    const remainingMs = Math.max(0, expiresAt.getTime() - Date.now());
    return {
        isOpen: remainingMs > 0,
        decisionDate,
        expiresAt,
        remainingMs,
        remainingDays: Math.ceil(remainingMs / MS_DAY),
    };
}
/**
 * Calculate the appeal window expiration date.
 */
export function calculateAppealWindowEnd(decisionDate, config) {
    const windowMs = config?.windowMs ?? DEFAULT_WINDOW_MS;
    return new Date(decisionDate.getTime() + windowMs);
}
//# sourceMappingURL=window.js.map