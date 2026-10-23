import { panicIndex, panicSlice, toIndex } from "./checks.mjs";

/** `a[i]` read with the WP4 bounds check (negative indices fail like the unsigned compare does). */
export function idx(a, i) {
  const k = toIndex(i);
  if (!(k >= 0 && k < a.length)) panicIndex(k, a.length);
  return a[k];
}

/** `a.pop()`: the last element, or the bounds panic — Nish has no `undefined` to return. */
export function pop(a) {
  if (a.length === 0) panicIndex(0, 0);
  return a.pop();
}

/** `a[i] = v`: evaluates `a`, `i`, `v`, then checks and stores; yields `v`. */
export function setIdx(a, i, v) {
  const k = toIndex(i);
  if (!(k >= 0 && k < a.length)) panicIndex(k, a.length);
  a[k] = v;
  return v;
}

/** `a[i] op= v`: evaluates `a`, `i`, checks, loads, then `f(old)` computes the new element. */
export function updIdx(a, i, f) {
  const k = toIndex(i);
  if (!(k >= 0 && k < a.length)) panicIndex(k, a.length);
  const v = f(a[k]);
  a[k] = v;
  return v;
}

/**
 * `dst.set(src, offset)` (WP34 N2): `TypedArray.prototype.set`'s copy on the
 * plain array a `u8[]` is here. The source is copied first, so a self-copy or
 * an overlapping one reads what was there before, as `memmove` does natively;
 * a range past the end fails with the native panic and its words, where a
 * typed array would throw a `RangeError` for the same offsets.
 */
export function arraySet(dst, src, offset) {
  // `ToIntegerOrInfinity`: NaN is 0, as `llvm.fptosi.sat` makes it natively.
  // `Math.trunc` rather than `toIndex`, which converts a bigint: an `i64` or
  // `u64` offset is a bigint here, and it throws the `TypeError` the typed
  // array and `Array.prototype.fill` throw for one, instead of being rounded
  // to the nearest double past 2^53 (docs/RUN_UNDER_NODE.md).
  const at = offset === undefined ? 0 : Math.trunc(offset) || 0;
  const end = at + src.length;
  if (!(at >= 0 && end <= dst.length)) panicSlice(at, end, dst.length);
  // Two plain arrays overlap only when they are one array, which is the one
  // case that must read the source before writing it.
  const from = src === dst ? src.slice() : src;
  for (let i = 0; i < from.length; i++) dst[at + i] = from[i];
}

/** `new Array<T>(n)`: `n` zero-filled elements (`0`, `0n`, or `false`). */
export function newArray(n, zero) {
  return new Array(toIndex(n)).fill(zero);
}

// Arena introspection has no JS counterpart: the stubs keep programs that only
// compare `Arena.used()` before/after (a "stayed flat" check) in agreement, while
// programs that print raw byte counts are listed as known differences.
//
// `nish --threads` makes the native arena thread-local (WP20 T0) and nothing
// here moves with it: a rewritten program runs on the one thread Node gives it,
// so "the arena of the calling thread" and "the arena" are the same object, and
// these stubs answer for both. If T1 ever lands a spawn the rewrite can reach,
// that is when this file grows a second arena to keep count of.
export function arenaUsed() { return 0; }
export function arenaMark() { return 0; }
export function arenaRelease() {}
export function arenaReset() {}
/** `using a = arena()`: a disposable whose disposal does nothing, because there is no arena to release. */
export function arena() {
  return { [Symbol.dispose]() {} };
}
