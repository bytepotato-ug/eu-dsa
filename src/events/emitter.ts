/**
 * Typed event emitter for DSA toolkit events.
 */

import { EventEmitter } from 'node:events';
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

export function createDsaEventEmitter(options?: { maxListeners?: number }): DsaEventEmitter {
  const ee = new EventEmitter();
  ee.setMaxListeners(options?.maxListeners ?? 50);

  return {
    on<T extends DsaEventName>(event: T, handler: DsaEventHandler<T>): void {
      ee.on(event, handler as (...args: unknown[]) => void);
    },
    once<T extends DsaEventName>(event: T, handler: DsaEventHandler<T>): void {
      ee.once(event, handler as (...args: unknown[]) => void);
    },
    off<T extends DsaEventName>(event: T, handler: DsaEventHandler<T>): void {
      ee.off(event, handler as (...args: unknown[]) => void);
    },
    emit<T extends DsaEventName>(event: T, payload: DsaEventMap[T]): void {
      ee.emit(event, payload);
    },
    removeAllListeners(event?: DsaEventName): void {
      if (event) {
        ee.removeAllListeners(event);
      } else {
        ee.removeAllListeners();
      }
    },
    listenerCount(event: DsaEventName): number {
      return ee.listenerCount(event);
    },
  };
}
