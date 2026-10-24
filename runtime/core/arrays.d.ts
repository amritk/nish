/** The array half of the core: bounds-checked access, and the arena stubs. */
import type { i32, i64 } from "./numbers.js";
export declare function idx<T>(a: readonly T[], i: number | bigint): T;
export declare function pop<T>(a: T[]): T;
export declare function setIdx<T>(a: T[], i: number | bigint, v: T): T;
export declare function updIdx<T>(a: T[], i: number | bigint, f: (old: T) => T): T;
export declare function uncheckedGet<T extends number | bigint>(xs: readonly T[], i: i32): T;
export declare function uncheckedSet<T extends number | bigint>(xs: T[], i: i32, v: T): void;
export declare function copyIn<T>(v: T): T;
export declare function storeIdx<T>(a: T[], i: number | bigint, v: T): T;
export declare function arraySet<T>(dst: T[], src: readonly T[], offset?: number): void;
/** `dst.set(src, offset)` as `--emit-ts` writes it: a 64-bit offset is a bigint, checked exactly. */
export declare function arraySetAt<T>(dst: T[], src: readonly T[], offset?: number | bigint): void;
/** `new Array<T>(n)`: `--emit-ts` writes `T` out, so the zero it fills with is not what `T` is read from. */
export declare function newArray<T>(n: number | bigint, zero: unknown): T[];
export declare function arenaUsed(): i64;
export declare function arenaMark(): i64;
export declare function arenaRelease(m?: unknown): void;
export declare function arenaReset(): void;
/**
 * The protocol `using` reads, declared here as `nish.d.ts` does, so `using a =
 * arena()` type-checks with no `"esnext.disposable"` in a program's `lib`.
 */
declare global {
  interface SymbolConstructor {
    readonly dispose: unique symbol;
  }
}

/** What `arena()` answers: its `Symbol.dispose` does nothing. */
export interface ArenaHandle {
  [Symbol.dispose](): void;
}

/** `using a = arena()`: the arena is the collector's, so leaving it frees nothing. */
export declare function arena(): ArenaHandle;
