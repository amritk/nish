/**
 * `std/threads` — data parallelism, and a scope for heterogeneous tasks
 * (docs/wp29-thread-surface.md §4.1 and §4.2).
 *
 *     import { parallelMapInto, parallelReduce, scope } from "nish/threads";
 *
 *     parallelMapInto(src, dst, (x) => x * 3);
 *     const total = parallelReduce(src, (a, b) => a + b, 0);
 *     {
 *       using s = scope();
 *       s.spawn(sumOf, xs, out, 0);
 *       s.spawn(maxOf, ys, out, 1);
 *     } // both tasks have run, and `out` holds both answers
 *
 * **What is written here is the meaning, not the implementation.** Each body
 * below is the sequential program, and it is what runs under Node, what
 * `npm run check` type-checks, and what the compiler checks the call against.
 * The compiler then recognises the two exported templates by module and name
 * and lowers an instance of either onto `nish_parallel_range`
 * (runtime/runtime-parallel.c): it replaces the one call that walks the whole
 * range — `mapRange` for a map, `reduceBlocks` for a reduce — with a region that
 * hands each thread a contiguous piece of it, and emits the rest of the body as
 * written. So the length check, its message and the order a reduce combines in
 * are this file's, whichever way the program is compiled.
 *
 * What makes the region safe is checked at the call, not trusted
 * (docs/LANGUAGE.md, "Data parallelism"): the function passed as `f` may write
 * nothing its caller could observe, may allocate only temporaries it drops
 * before it returns — they are given back after every element — `dst` may not
 * be reachable from an element of `src`, and the result type is a number or a
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
 * been. It is independent of the map's grain (`mapGrain` in
 * `src/parallel.ts`), which decides only how a map is divided and may
 * change without changing any result; this one may not.
 */
const BLOCK: i32 = 1048576

/** The most blocks a reduce is split into: the partitioner's own ceiling on threads. */
const MAX_BLOCKS: i32 = 64

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
    const y = f(src[i])
    if (i < toI32(dst.length)) {
      dst[i] = y
    }
  }
}

/** `f` folded over `src[lo..hi)` from `identity`: one block of a reduce. */
const reduceRange = <T>(src: T[], f: (acc: T, x: T) => T, identity: T, lo: i32, hi: i32): T => {
  let acc = identity
  for (let i: i32 = lo; i >= 0 && i < hi && i < toI32(src.length); i++) {
    acc = f(acc, src[i])
  }
  return acc
}

/**
 * How many blocks a reduce over `n` elements is split into: `min(MAX_BLOCKS, ceil(n / BLOCK))`.
 *
 * This and `reduceBlockStart` compute in `f64` rather than `i64`, because this
 * file is also what runs under Node (docs/RUN_UNDER_NODE.md), where `toI64`
 * answers a BigInt that throws the moment it meets the `1` of a `+ 1`. A double
 * holds every value either function reaches exactly: `n` is below 2^31 and
 * dividing by `BLOCK`, a power of two, loses nothing.
 */
const reduceBlockCount = (n: i32): i32 => {
  const wanted: i32 = toI32(Math.ceil(toF64(n) / toF64(BLOCK)))
  return wanted < MAX_BLOCKS ? wanted : MAX_BLOCKS
}

/**
 * Where block `k` of `blocks` over `n` elements starts, `floor(n * k / blocks)`;
 * block `blocks` starts at `n`. `n * k` is below 2^37, past `i32` but exact in
 * a double, and the rounded quotient floors to the true one: when `n * k` is
 * not a multiple of `blocks` the true quotient is at least `1 / blocks` below
 * the next integer, and the rounding error is under 2^37 * 2^-53, far less than
 * `1 / MAX_BLOCKS`. So these are the same blocks the `i64` form computed, which
 * the determinism of a reduce depends on (`tests/link/par_reduce_blocks`).
 */
const reduceBlockStart = (n: i32, blocks: i32, k: i32): i32 =>
  toI32(Math.floor((toF64(n) * toF64(k)) / toF64(blocks)))

/** Folds blocks `[lo, hi)` of `src` into `partials`, one result per block: one thread's share of a reduce. */
const reduceBlocks = <T>(
  src: T[],
  f: (acc: T, x: T) => T,
  identity: T,
  partials: T[],
  lo: i32,
  hi: i32
): void => {
  const n: i32 = toI32(src.length)
  const blocks: i32 = toI32(partials.length)
  for (let k: i32 = lo; k >= 0 && k < hi && k < blocks; k++) {
    const partial = reduceRange(
      src,
      f,
      identity,
      reduceBlockStart(n, blocks, k),
      reduceBlockStart(n, blocks, k + 1)
    )
    if (k < toI32(partials.length)) {
      partials[k] = partial
    }
  }
}

/**
 * The panic of a map whose `dst` is shorter than its `src`. A function of its
 * own so that the message it builds is its allocation and not the map's: an
 * allocation anywhere in `parallelMapInto` would give every call an arena mark
 * and release, which is most of what a map over a few elements costs.
 */
const dstTooShort = (have: i32, want: i32): void => {
  panic(`parallelMapInto: dst has ${have} elements and src has ${want}`)
}

/**
 * `dst[i] = f(src[i])` for every index of `src`, on as many threads as the
 * machine has and the length is worth. `dst` must be at least as long as
 * `src`, which is checked once, before any element is written.
 */
export const parallelMapInto = <T, U>(src: T[], dst: U[], f: (x: T) => U): void => {
  const n: i32 = toI32(src.length)
  if (toI32(dst.length) < n) {
    dstTooShort(toI32(dst.length), n)
  }
  mapRange(src, dst, f, 0, n)
}

/**
 * `f` folded over `src`, blockwise from `identity` and then left to right over
 * the blocks, so the answer does not depend on how many threads computed it.
 * An empty `src` answers `identity`.
 */
export const parallelReduce = <T>(src: T[], f: (acc: T, x: T) => T, identity: T): T => {
  const blocks: i32 = reduceBlockCount(toI32(src.length))
  if (blocks === 0) {
    return identity
  }
  const partials = new Array<T>(blocks)
  reduceBlocks(src, f, identity, partials, 0, blocks)
  let acc = partials[0]
  for (let k: i32 = 1; k < toI32(partials.length); k++) {
    acc = f(acc, partials[k])
  }
  return acc
}

/**
 * The panic of a task whose destination slot is not in its array. A function of
 * its own for the reason `dstTooShort` is one: the message is its allocation.
 */
const slotOutOfRange = (at: i32, length: i32): void => {
  panic(`spawn: destination index ${at} is out of range for an array of ${length} elements`)
}

/** `dst[at] = r`, checked: what the scope does with a task's answer when it joins. */
const storeResult = <R>(dst: R[], at: i32, r: R): void => {
  if (at >= 0 && at < toI32(dst.length)) {
    dst[at] = r
  } else {
    slotOutOfRange(at, toI32(dst.length))
  }
}

/**
 * One task: `entry(arg)`, stored into `dst[at]`. Natively the compiler splits
 * this call in two (`src/emit-parallel.ts`): `entry(arg)` runs on a thread of its
 * own when the scope closes, and the store runs on the thread that opened the
 * scope, once every task of it has finished. Here, under Node, it is the one
 * call it reads as, made at the spawn.
 */
const runTask = <A, R>(entry: (arg: A) => R, arg: A, dst: R[], at: i32): void =>
  storeResult(dst, at, entry(arg))

/**
 * A scope of tasks, joined when the block that declares it ends
 * (docs/wp29-thread-surface.md §4.2). It is only ever made by `scope()` in a
 * `using` declaration, and only ever used as the receiver of `spawn`
 * (docs/LANGUAGE.md, "Scoped tasks"), so no task can outlive it.
 */
export class ThreadScope {
  /**
   * Nothing reads or writes it. It is here so that each scope is an object of
   * its own, whose address is what the runtime files the scope's tasks under.
   */
  tag: i32 = 0

  /**
   * Run `entry(arg)` on a thread of its own and store its answer in `dst[at]`
   * when the scope closes. `at` is checked here, before the task is taken, and
   * again when its answer is stored.
   */
  spawn<A, R>(entry: (arg: A) => R, arg: A, dst: R[], at: i32): void {
    if (at < 0 || at >= toI32(dst.length)) {
      slotOutOfRange(at, toI32(dst.length))
    }
    runTask(entry, arg, dst, at)
  }

  /**
   * What `using` calls when the block ends. Natively the compiler emits the
   * join itself at every exit of the block, and under Node every task has
   * already run by the time this is reached, so there is nothing left to do.
   */
  [Symbol.dispose](): void {
    // Nothing left to join: see above.
  }
}

/** A new scope, for a `using` declaration: `using s = scope()`. */
export const scope = (): ThreadScope => new ThreadScope()
