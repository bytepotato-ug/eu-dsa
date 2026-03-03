/**
 * Configurable state machine for notice workflow.
 *
 * Default transitions enforce DSA Art. 16 flow:
 *   RECEIVED → ACKNOWLEDGED → ASSESSING → DECIDED_* → CLOSED
 *
 * Platforms can customize by providing their own transitions.
 */
import { NoticeState, type Notice, type StateTransition } from './types.js';
export interface NoticeStateMachineConfig {
    transitions?: StateTransition[];
    onTransition?: (notice: Notice, from: NoticeState, to: NoticeState) => void | Promise<void>;
}
declare const DEFAULT_TRANSITIONS: StateTransition[];
export declare class NoticeStateMachine {
    private readonly transitions;
    private readonly onTransitionCallback?;
    constructor(config?: NoticeStateMachineConfig);
    /**
     * Get all valid next states for a notice.
     */
    getValidTransitions(notice: Notice): NoticeState[];
    /**
     * Check if a transition is valid.
     */
    canTransition(notice: Notice, to: NoticeState): boolean;
    /**
     * Transition a notice to a new state. Returns updated notice.
     * Throws if transition is not valid.
     */
    transition(notice: Notice, to: NoticeState): Promise<Notice>;
}
/**
 * Create a notice in RECEIVED state.
 */
export declare function createNotice(params: {
    id?: string;
    source: Notice['source'];
    content: Notice['content'];
    classification: Notice['classification'];
    priority?: number;
    territorialScope?: Notice['territorialScope'];
    metadata?: Record<string, unknown>;
}): Notice;
export { DEFAULT_TRANSITIONS };
//# sourceMappingURL=state-machine.d.ts.map