/**
 * Appeal/complaint types per DSA Art. 20.
 *
 * Art. 20 requires online platforms to provide an internal
 * complaint-handling system for recipients of content moderation decisions.
 */
export const AppealState = {
    SUBMITTED: 'SUBMITTED',
    ASSIGNED: 'ASSIGNED',
    UNDER_REVIEW: 'UNDER_REVIEW',
    RESOLVED: 'RESOLVED',
    CLOSED: 'CLOSED',
};
export const AppealOutcomeResult = {
    UPHELD: 'UPHELD',
    PARTIALLY_UPHELD: 'PARTIALLY_UPHELD',
    REJECTED: 'REJECTED',
};
//# sourceMappingURL=types.js.map