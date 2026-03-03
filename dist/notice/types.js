/**
 * Notice-and-action types per DSA Art. 16.
 *
 * A Notice represents a report/flag about potentially illegal or
 * terms-violating content. The state machine tracks it through
 * acknowledgment, assessment, and decision.
 */
// ---- Notice States ----
export const NoticeState = {
    RECEIVED: 'RECEIVED',
    ACKNOWLEDGED: 'ACKNOWLEDGED',
    ASSESSING: 'ASSESSING',
    DECIDED_ACTION_TAKEN: 'DECIDED_ACTION_TAKEN',
    DECIDED_NO_ACTION: 'DECIDED_NO_ACTION',
    DECIDED_PARTIAL_ACTION: 'DECIDED_PARTIAL_ACTION',
    ESCALATED: 'ESCALATED',
    APPEALED: 'APPEALED',
    CLOSED: 'CLOSED',
};
//# sourceMappingURL=types.js.map