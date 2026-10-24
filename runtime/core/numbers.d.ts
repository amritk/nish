/**
 * The widths as the core holds them (docs/RUN_UNDER_NODE.md): `i64` and `u64`
 * are a `bigint`, every other width a `number`. `runtime/nish.d.ts` spells
 * each as `number` for `tsc`'s reading of a Nish program; `tests/run.js`
 * (`runtime-hosts`) holds these signatures to that file's.
 */
export type i32 = number;
export type i64 = bigint;
export type u8 = number;
export type u16 = number;
export type u32 = number;
export type u64 = bigint;
export type f32 = number;
export type f64 = number;
/**
 * A ranged integer (docs/wp31-ranged-integers.md) is a `number`; its range is
 * the native build's check, which Node does not make (wp33 §3.3, the range row).
 */
export type integer<Lo extends number, Hi extends number> = number;
/** The typed-array aliases (docs/LANGUAGE.md): in Nish each is an ordinary array of its width. */
export type Int32Array = i32[];
export type Float32Array = f32[];
export type Float64Array = f64[];
export type BigInt64Array = i64[];

/** A width as the rewriter names it, for `convert`. */
export type NumericKind = "i32" | "i64" | "u8" | "u16" | "u32" | "u64" | "f32" | "f64";

export declare function toI32(x: number | bigint | boolean): i32;
export declare function toI64(x: number | bigint | boolean): i64;
export declare function toF64(x: number | bigint | boolean): f64;
export declare function f64ToBits(x: f64): i64;
export declare function f32ToBits(x: f32): i32;
export declare function bitsToF64(bits: i64): f64;
export declare function ctSelect<T extends u32 | u64>(mask: T, a: T, b: T): T;
export declare function ctEq<T extends u32 | u64>(a: T, b: T): T;
export declare function checkedAdd<T extends i32 | i64>(a: T, b: T): T;
export declare function checkedSub<T extends i32 | i64>(a: T, b: T): T;
export declare function checkedMul<T extends i32 | i64>(a: T, b: T): T;
export declare function checkedNeg<T extends i32 | i64>(a: T): T;
export declare function wrappingAdd<T extends i32 | i64>(a: T, b: T): T;
export declare function wrappingSub<T extends i32 | i64>(a: T, b: T): T;
export declare function wrappingMul<T extends i32 | i64>(a: T, b: T): T;
export declare function idiv<T extends number | bigint>(a: T, b: T): T;
export declare function irem<T extends number | bigint>(a: T, b: T): T;
export declare function wrapI64(x: bigint): i64;
export declare function shlI64(a: i64, b: i64): i64;
export declare function ashrI64(a: i64, b: i64): i64;
export declare function lshrI64(a: i64, b: i64): i64;
export declare function absI64(x: i64): i64;
export declare function signI64<T extends i64 | u64>(x: T): T;
export declare function minI64(a: i64, b: i64): i64;
export declare function maxI64(a: i64, b: i64): i64;
export declare function wrapU64(x: bigint): u64;
export declare function shlU64(a: u64, b: u64): u64;
export declare function lshrU64(a: u64, b: u64): u64;
export declare function minU64(a: u64, b: u64): u64;
export declare function maxU64(a: u64, b: u64): u64;
/** What `convert` answers for the width `K`: a `bigint` for the 64-bit integers. */
export type Width<K extends NumericKind> = K extends "i64" | "u64" ? bigint : number;

export declare function convert<K extends NumericKind>(x: number | bigint, from: NumericKind, to: K): Width<K>;
export declare function parseInt(s: string): i32;
export declare function parseFloat(s: string): f64;
export declare function number(x: string | number | bigint | boolean): f64;
export declare function offsets<T extends unknown[]>(first: number, args: T): T;
