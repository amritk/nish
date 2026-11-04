/**
 * `nish/runtime`: the host-agnostic core (runtime/core.mjs). Pair it with
 * `nish/runtime/node` or `nish/runtime/browser`, which install a host.
 */
export * from "./core/arrays.js";
export * from "./core/host.js";
export * from "./core/numbers.js";
export * from "./core/result.js";
export * from "./core/strings.js";

// `nish:simd`: what `--emit-ts` writes for a program's `import ... from "nish:simd"`.
import type { f32, f64, i32, u16, u32, u8 } from "./core/numbers.js";

/**
 * A sixteen-byte vector of lanes. Opaque: TypeScript refuses `+` on one, as
 * `nish` does, but lets `===` and `<` through, which `nish` refuses. Under
 * Node it is a typed array made once and never written after.
 */
export interface u8x16 { readonly __nishSimd: "u8x16"; readonly __lane: u8; readonly __mask: mask8x16 }
export interface u16x8 { readonly __nishSimd: "u16x8"; readonly __lane: u16; readonly __mask: mask16x8 }
export interface i32x4 { readonly __nishSimd: "i32x4"; readonly __lane: i32; readonly __mask: mask32x4 }
export interface u32x4 { readonly __nishSimd: "u32x4"; readonly __lane: u32; readonly __mask: mask32x4 }
export interface f32x4 { readonly __nishSimd: "f32x4"; readonly __lane: f32; readonly __mask: mask32x4 }
export interface f64x2 { readonly __nishSimd: "f64x2"; readonly __lane: f64; readonly __mask: mask64x2 }
/** Any of the six. */
export type SimdVector = u8x16 | u16x8 | i32x4 | u32x4 | f32x4 | f64x2;
/** The four with integer lanes. */
export type IntegerVector = u8x16 | u16x8 | i32x4 | u32x4;
/** The two with float lanes. */
export type FloatVector = f32x4 | f64x2;
/**
 * One boolean per lane, which a lane-wise compare answers. Under Node an
 * array of booleans. `nish` keeps a mask in a local, a parameter or a
 * return of a function the module keeps, and nowhere else; it has no
 * constructor.
 */
export interface mask8x16 { readonly __nishMask: "mask8x16" }
export interface mask16x8 { readonly __nishMask: "mask16x8" }
export interface mask32x4 { readonly __nishMask: "mask32x4" }
export interface mask64x2 { readonly __nishMask: "mask64x2" }
/** Any of the four. */
export type SimdMask = mask8x16 | mask16x8 | mask32x4 | mask64x2;
/** One value per lane, lane 0 first. */
export declare function u8x16(
  a0: u8, a1: u8, a2: u8, a3: u8, a4: u8, a5: u8, a6: u8, a7: u8,
  a8: u8, a9: u8, a10: u8, a11: u8, a12: u8, a13: u8, a14: u8, a15: u8
): u8x16;
export declare function u16x8(a0: u16, a1: u16, a2: u16, a3: u16, a4: u16, a5: u16, a6: u16, a7: u16): u16x8;
export declare function i32x4(a0: i32, a1: i32, a2: i32, a3: i32): i32x4;
export declare function u32x4(a0: u32, a1: u32, a2: u32, a3: u32): u32x4;
export declare function f32x4(a0: f32, a1: f32, a2: f32, a3: f32): f32x4;
export declare function f64x2(a0: f64, a1: f64): f64x2;
/** `x` in every lane. */
export declare function splatU8x16(x: u8): u8x16;
export declare function splatU16x8(x: u16): u16x8;
export declare function splatI32x4(x: i32): i32x4;
export declare function splatU32x4(x: u32): u32x4;
export declare function splatF32x4(x: f32): f32x4;
export declare function splatF64x2(x: f64): f64x2;
/** `xs[i]` to `xs[i + N - 1]`, bounds-checked once for the whole vector. */
export declare function loadU8x16(xs: readonly u8[], i: i32): u8x16;
export declare function loadU16x8(xs: readonly u16[], i: i32): u16x8;
export declare function loadI32x4(xs: readonly i32[], i: i32): i32x4;
export declare function loadU32x4(xs: readonly u32[], i: i32): u32x4;
export declare function loadF32x4(xs: readonly f32[], i: i32): f32x4;
export declare function loadF64x2(xs: readonly f64[], i: i32): f64x2;
/** The lanes of `v` into `xs[i]` to `xs[i + N - 1]`, checked once. */
export declare function store<V extends SimdVector>(v: V, xs: V["__lane"][], i: i32): void;
/** Lane `k`, an integer literal in range. */
export declare function extract<V extends SimdVector>(v: V, k: i32): V["__lane"];
/** A new vector: `v` with lane `k` set to `x`. */
export declare function replace<V extends SimdVector>(v: V, k: i32, x: V["__lane"]): V;
/** Float lane arithmetic, lane by lane. An integer lane's form wraps. */
export declare function add<V extends FloatVector>(a: V, b: V): V;
export declare function sub<V extends FloatVector>(a: V, b: V): V;
export declare function mul<V extends FloatVector>(a: V, b: V): V;
export declare function div<V extends FloatVector>(a: V, b: V): V;
export declare function sqrt<V extends FloatVector>(a: V): V;
/** Integer lane arithmetic, wrapping at the lane width. */
export declare function addWrapping<V extends IntegerVector>(a: V, b: V): V;
export declare function subWrapping<V extends IntegerVector>(a: V, b: V): V;
export declare function mulWrapping<V extends IntegerVector>(a: V, b: V): V;
/** Negation and absolute value of float lanes: the sign bit. */
export declare function neg<V extends FloatVector>(a: V): V;
export declare function abs<V extends FloatVector>(a: V): V;
/** The lesser and the greater lane: a float NaN lane answers NaN. */
export declare function min<V extends SimdVector>(a: V, b: V): V;
export declare function max<V extends SimdVector>(a: V, b: V): V;
/** Bitwise, on integer lanes or lane by lane on two masks. */
export declare function and<V extends IntegerVector | SimdMask>(a: V, b: V): V;
export declare function or<V extends IntegerVector | SimdMask>(a: V, b: V): V;
export declare function xor<V extends IntegerVector | SimdMask>(a: V, b: V): V;
export declare function not<V extends IntegerVector | SimdMask>(a: V): V;
/** Lane-wise compares, answering the vector's mask. A float compare is ordered (`ne` unordered). */
export declare function eq<V extends SimdVector>(a: V, b: V): V["__mask"];
export declare function ne<V extends SimdVector>(a: V, b: V): V["__mask"];
export declare function lt<V extends SimdVector>(a: V, b: V): V["__mask"];
export declare function le<V extends SimdVector>(a: V, b: V): V["__mask"];
export declare function gt<V extends SimdVector>(a: V, b: V): V["__mask"];
export declare function ge<V extends SimdVector>(a: V, b: V): V["__mask"];
/** Lane `k` of `a` where lane `k` of `m` is set, else of `b`. */
export declare function select<V extends SimdVector>(m: V["__mask"], a: V, b: V): V;
/** Whether any lane, or every lane, is set. */
export declare function any(m: SimdMask): boolean;
export declare function all(m: SimdMask): boolean;
/** Lane `k`'s flag in bit `k`. */
export declare function bitmask(m: SimdMask): i32;
/**
 * The lanes added: a `u8x16` or `u16x8` in an `i32`, a float vector in lane
 * order. An `i32x4` or `u32x4` total is `sumWrapping`.
 */
export declare function sum(v: u8x16 | u16x8): i32;
export declare function sum(v: f32x4): f32;
export declare function sum(v: f64x2): f64;
export declare function sumWrapping(v: i32x4): i32;
export declare function sumWrapping(v: u32x4): u32;
/** Lanes picked from `a` then `b` by integer-literal indices, one per lane. */
export declare function shuffle<V extends SimdVector>(a: V, b: V, ...lanes: i32[]): V;
/**
 * Shifts and rotates by an integer-literal count below the lane width:
 * `shr` is logical on an unsigned lane and arithmetic on an `i32` lane.
 */
export declare function shl<V extends IntegerVector>(v: V, count: i32): V;
export declare function shr<V extends IntegerVector>(v: V, count: i32): V;
export declare function rotl<V extends IntegerVector>(v: V, count: i32): V;
export declare function rotr<V extends IntegerVector>(v: V, count: i32): V;
/** The same sixteen bytes read as another vector type. */
export declare function asU8x16(v: SimdVector): u8x16;
export declare function asU16x8(v: SimdVector): u16x8;
export declare function asI32x4(v: SimdVector): i32x4;
export declare function asU32x4(v: SimdVector): u32x4;
export declare function asF32x4(v: SimdVector): f32x4;
export declare function asF64x2(v: SimdVector): f64x2;
