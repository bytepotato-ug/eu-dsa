/**
 * Typed event emitter for DSA toolkit events.
 */
import { EventEmitter } from 'node:events';
export function createDsaEventEmitter(options) {
    const ee = new EventEmitter();
    ee.setMaxListeners(options?.maxListeners ?? 50);
    return {
        on(event, handler) {
            ee.on(event, handler);
        },
        once(event, handler) {
            ee.once(event, handler);
        },
        off(event, handler) {
            ee.off(event, handler);
        },
        emit(event, payload) {
            ee.emit(event, payload);
        },
        removeAllListeners(event) {
            if (event) {
                ee.removeAllListeners(event);
            }
            else {
                ee.removeAllListeners();
            }
        },
        listenerCount(event) {
            return ee.listenerCount(event);
        },
    };
}
//# sourceMappingURL=emitter.js.map