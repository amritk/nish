/** The string half of the core: every length and offset counts UTF-8 bytes. */
import type { i32, u8 } from "./numbers.js";

export declare function strLen(x: string | readonly unknown[]): i32;
export declare function charCodeAt(s: string, i: number | bigint): u8;
export declare function substring(s: string, a: number | bigint, b?: number | bigint): string;
export declare function slice(s: string, a: number | bigint, b?: number | bigint): string;
export declare function indexOf(s: string, sub: string): i32;
export declare function startsWith(s: string, sub: string): boolean;
export declare function endsWith(s: string, sub: string): boolean;
export declare function fromCharCode(code: number | bigint): string;
export declare function fromBytes(bytes: readonly u8[], start: number, end: number): string;
