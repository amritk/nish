/**
 * `nish/page`: the page-side helpers for a wasm module built with
 * `--profile wasm-host` (docs/guide/using-nish/interop.md).
 */

/**
 * The objects a host module hands the program as `HostHandle<"kind">` values.
 * Slot 0 is "none" and is never handed out; `get` and `take` throw a
 * RangeError on a handle that names no object.
 */
export declare class HostTable<T> {
  /** Stores `value` and answers its handle, never 0, typed as the handle the caller returns. */
  add<H extends number = number>(value: T): H;
  /** The object `handle` names. */
  get(handle: number): T;
  /** Removes the object `handle` names and answers it. */
  take(handle: number): T;
  /** How many objects the table holds. */
  readonly size: number;
}

/** A `layout` entry the loader answers for module storage. */
export interface RingField {
  readonly at: number;
  readonly length: number;
}

/** The page's half of a `nish/host/ring` ring. */
export interface Ring {
  /** The number of slots, the storage's length less two. */
  readonly capacity: number;
  /** The words put and not yet taken. */
  size(): number;
  /** The words `push` would still take. */
  free(): number;
  /** Puts `word` (an i32) at the tail; false, and nothing changed, when full. */
  push(word: number): boolean;
  /** Takes the word at the head; 0, and nothing changed, when empty. */
  shift(): number;
  /** Empties the ring. */
  clear(): void;
}

/** The ring held in module storage `field` of the loaded module's `memory`. */
export declare function ringOver(memory: { readonly buffer: ArrayBuffer }, field: RingField): Ring;

/** A panic as the loader reports it. */
export interface PagePanic {
  readonly message: string;
}

/** The default `onPanic`: `console.error("nish: " + panic.message)`. */
export declare function reportPanic(panic: PagePanic): void;
