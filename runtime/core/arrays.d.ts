/** The array half of the core: bounds-checked access, and the arena stubs. */
export declare function idx<T>(a: readonly T[], i: number | bigint): T;
export declare function pop<T>(a: T[]): T;
export declare function setIdx<T>(a: T[], i: number | bigint, v: T): T;
export declare function updIdx<T>(a: T[], i: number | bigint, f: (old: T) => T): T;
export declare function copyIn<T>(v: T): T;
export declare function storeIdx<T>(a: T[], i: number | bigint, v: T): T;
export declare function arraySet<T>(dst: T[], src: readonly T[], offset?: number): void;
export declare function newArray<T>(n: number | bigint, zero: T): T[];
export declare function arenaUsed(): number;
export declare function arenaMark(): number;
export declare function arenaRelease(m?: unknown): void;
export declare function arenaReset(): void;
/** `using a = arena()`: an object whose `Symbol.dispose` does nothing. */
export declare function arena(): object;
