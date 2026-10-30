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
export interface u8x16 { readonly __nishSimd: "u8x16"; readonly __lane: u8 }
export interface u16x8 { readonly __nishSimd: "u16x8"; readonly __lane: u16 }
export interface i32x4 { readonly __nishSimd: "i32x4"; readonly __lane: i32 }
export interface u32x4 { readonly __nishSimd: "u32x4"; readonly __lane: u32 }
export interface f32x4 { readonly __nishSimd: "f32x4"; readonly __lane: f32 }
export interface f64x2 { readonly __nishSimd: "f64x2"; readonly __lane: f64 }
/** Any of the six. */
export type SimdVector = u8x16 | u16x8 | i32x4 | u32x4 | f32x4 | f64x2;
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
