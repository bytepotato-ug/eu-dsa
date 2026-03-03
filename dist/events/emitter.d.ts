/**
 * Typed event emitter for DSA toolkit events.
 */
import type { DsaEventMap, DsaEventName } from './types.js';
export type DsaEventHandler<T extends DsaEventName> = (payload: DsaEventMap[T]) => void | Promise<void>;
export interface DsaEventEmitter {
    on<T extends DsaEventName>(event: T, handler: DsaEventHandler<T>): void;
    once<T extends DsaEventName>(event: T, handler: DsaEventHandler<T>): void;
    off<T extends DsaEventName>(event: T, handler: DsaEventHandler<T>): void;
    emit<T extends DsaEventName>(event: T, payload: DsaEventMap[T]): void;
    removeAllListeners(event?: DsaEventName): void;
    listenerCount(event: DsaEventName): number;
}
export declare function createDsaEventEmitter(options?: {
    maxListeners?: number;
}): DsaEventEmitter;
//# sourceMappingURL=emitter.d.ts.map