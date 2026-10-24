/** The array half of the core: bounds-checked access, and the arena stubs. */
import type { i32 } from "./numbers.js";
export declare function idx<T>(a: readonly T[], i: number | bigint): T;
export declare function pop<T>(a: T[]): T;
export declare function setIdx<T>(a: T[], i: number | bigint, v: T): T;
export declare function updIdx<T>(a: T[], i: number | bigint, f: (old: T) => T): T;
export declare function uncheckedGet<T extends number>(xs: readonly T[], i: i32): T;
export declare function uncheckedSet<T extends number>(xs: T[], i: i32, v: T): void;
export declare function copyIn<T>(v: T): T;
export declare function storeIdx<T>(a: T[], i: number | bigint, v: T): T;
export declare function arraySet<T>(dst: T[], src: readonly T[], offset?: number): void;
/** `dst.set(src, offset)` as `--emit-ts` writes it: a 64-bit offset is a bigint, checked exactly. */
export declare function arraySetAt<T>(dst: T[], src: readonly T[], offset?: number | bigint): void;
export declare function newArray<T>(n: number | bigint, zero: T): T[];
export declare function arenaUsed(): number;
export declare function arenaMark(): number;
export declare function arenaRelease(m?: unknown): void;
export declare function arenaReset(): void;
/** `using a = arena()`: an object whose `Symbol.dispose` does nothing. */
export declare function arena(): object;
