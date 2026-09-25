/**
 * `std/threads` — data parallelism, and nothing else (docs/wp29-thread-surface.md §4.1).
 *
 *     import { parallelMapInto, parallelReduce } from "nish/threads";
 *
 *     parallelMapInto(src, dst, (x) => x * 3);
 *     const total = parallelReduce(src, (a, b) => a + b, 0);
 *
 * **What is written here is the meaning, not the implementation.** Each body
 * below is the sequential program, and it is what runs under Node, what
 * `npm run check` type-checks, and what the compiler checks the call against.
 * The compiler then recognises the two exported templates by module and name
 * and lowers an instance of either onto `nish_parallel_range`
 * (runtime/runtime_parallel.c): it replaces the one call that walks the whole
 * range — `mapRange` for a map, `reduceBlocks` for a reduce — with a region that
 * hands each thread a contiguous piece of it, and emits the rest of the body as
 * written. So the length check, its message and the order a reduce combines in
 * are this file's, whichever way the program is compiled.
 *
 * What makes the region safe is checked at the call, not trusted
 * (docs/LANGUAGE.md, "Data parallelism"): the function passed as `f` may write
 * nothing its caller could observe and may not allocate, `dst` may not be
 * reachable from an element of `src`, and the result type is a number or a
 * `boolean`. Importing this module compiles the program with `--threads`,
 * because every worker needs an arena of its own.
 *
 * A reduce is deterministic. `src` is split into `min(64, ceil(n / BLOCK))`
 * blocks, each block is folded from `identity`, and the block results are
 * combined left to right — here, on one thread, and by the compiled program on
 * any number of them — so an `f64` sum is the same bits on one core or sixty
 * four. That needs `f` to be associative and `identity` to be its identity,
 * which the checker enforces for an arrow whose body is one operator on its two
 * parameters and cannot see through a named function.
 */

/**
 * Elements per block of a reduce: 2^20, about a millisecond of simple work
 * (docs/wp20-threads.md §8e). It decides the blocking, and so the answer's
 * bits: an array this short is one block, folded as the loop it would have
 * been. It is independent of the map's grain (`GRAIN` in
 * `self/emit_parallel.ts`), which decides only how a map is divided and may
 * change without changing any result; this one may not.
 */
const BLOCK: i32 = 1048576;

/** The most blocks a reduce is split into: the partitioner's own ceiling on threads. */
const MAX_BLOCKS: i32 = 64;

/**
 * Writes `f(src[i])` into `dst[i]` for every `i` in `[lo, hi)`: one thread's
 * share of a map. Each length is read in the loop condition and `dst`'s again
 * after the call, because a call ends every length fact the bounds proof holds
 * (docs/LANGUAGE.md, "Arrays") and this is what keeps both accesses unchecked.
 * The caller has already checked that the range is inside both arrays, so
 * neither test is ever the one that stops the loop.
 */
const mapRange = <T, U>(src: T[], dst: U[], f: (x: T) => U, lo: i32, hi: i32): void => {
  for (let i: i32 = lo; i >= 0 && i < hi && i < toI32(src.length); i++) {
    const y = f(src[i]);
    if (i < toI32(dst.length)) {
      dst[i] = y;
    }
  }
};

/** `f` folded over `src[lo..hi)` from `identity`: one block of a reduce. */
const reduceRange = <T>(src: T[], f: (acc: T, x: T) => T, identity: T, lo: i32, hi: i32): T => {
  let acc = identity;
  for (let i: i32 = lo; i >= 0 && i < hi && i < toI32(src.length); i++) {
    acc = f(acc, src[i]);
  }
  return acc;
};

/** How many blocks a reduce over `n` elements is split into: `min(MAX_BLOCKS, ceil(n / BLOCK))`. */
const reduceBlockCount = (n: i32): i32 => {
  const wanted: i32 = toI32((toI64(n) + toI64(BLOCK) - 1) / toI64(BLOCK));
  return wanted < MAX_BLOCKS ? wanted : MAX_BLOCKS;
};

/** Where block `k` of `blocks` over `n` elements starts; block `blocks` starts at `n`. */
const reduceBlockStart = (n: i32, blocks: i32, k: i32): i32 => toI32((toI64(n) * toI64(k)) / toI64(blocks));

/** Folds blocks `[lo, hi)` of `src` into `partials`, one result per block: one thread's share of a reduce. */
const reduceBlocks = <T>(
  src: T[],
  f: (acc: T, x: T) => T,
  identity: T,
  partials: T[],
  lo: i32,
  hi: i32
): void => {
  const n: i32 = toI32(src.length);
  const blocks: i32 = toI32(partials.length);
  for (let k: i32 = lo; k >= 0 && k < hi && k < blocks; k++) {
    const partial = reduceRange(
      src,
      f,
      identity,
      reduceBlockStart(n, blocks, k),
      reduceBlockStart(n, blocks, k + 1)
    );
    if (k < toI32(partials.length)) {
      partials[k] = partial;
    }
  }
};

/**
 * `dst[i] = f(src[i])` for every index of `src`, on as many threads as the
 * machine has and the length is worth. `dst` must be at least as long as
 * `src`, which is checked once, before any element is written.
 */
export const parallelMapInto = <T, U>(src: T[], dst: U[], f: (x: T) => U): void => {
  const n: i32 = toI32(src.length);
  if (toI32(dst.length) < n) {
    panic(`parallelMapInto: dst has ${toI32(dst.length)} elements and src has ${n}`);
  }
  mapRange(src, dst, f, 0, n);
};

/**
 * `f` folded over `src`, blockwise from `identity` and then left to right over
 * the blocks, so the answer does not depend on how many threads computed it.
 * An empty `src` answers `identity`.
 */
export const parallelReduce = <T>(src: T[], f: (acc: T, x: T) => T, identity: T): T => {
  const blocks: i32 = reduceBlockCount(toI32(src.length));
  if (blocks === 0) {
    return identity;
  }
  const partials = new Array<T>(blocks);
  reduceBlocks(src, f, identity, partials, 0, blocks);
  let acc = partials[0];
  for (let k: i32 = 1; k < toI32(partials.length); k++) {
    acc = f(acc, partials[k]);
  }
  return acc;
};
