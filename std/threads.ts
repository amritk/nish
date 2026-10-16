/**
 * `std/threads` — data parallelism, a scope for heterogeneous tasks, and a
 * lock that owns its data (docs/wp29-thread-surface.md §4.1, §4.2 and §4.3).
 *
 *     import { AtomicI32, Mutex, parallelFrom, parallelMap, parallelMapInto, parallelReduce, scope } from "nish/threads";
 *
 *     parallelMapInto(src, dst, (x) => x * 3);
 *     const ys = parallelMap(src, (x) => x * k + b); // k, b: `const` locals, read by the body
 *     const sq = parallelFrom(n, (i) => i * i);
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
 * The compiler then recognises the exported templates by module and name
 * and lowers an instance of `parallelMapInto`, `parallelFrom` or
 * `parallelReduce` onto `nish_parallel_range` (runtime/runtime-parallel.c): it
 * replaces the one call that walks the whole range — `mapRange` for a map,
 * `fromRange` for a `parallelFrom`, `reduceBlocks` for a reduce — with a region
 * that hands each thread a contiguous piece of it, and emits the rest of the
 * body as written. `parallelMap` is `parallelMapInto` into an array it
 * allocates first. So the length check, its message and the order a reduce combines in
 * are this file's, whichever way the program is compiled.
 *
 * What makes the region safe is checked at the call, not trusted
 * (docs/LANGUAGE.md, "Data parallelism"): the function passed as `f` may write
 * nothing its caller could observe, may allocate only temporaries it drops
 * before it returns — they are given back after every element — `dst` may not
 * be reachable from an element of `src`, and the result type is a number or a
 * `boolean`. An arrow written at the call may read the `const` locals and
 * the parameters of the function it is written in: each one is handed to the
 * body as a parameter of its own, which no body may write through. Importing this module compiles the program with `--threads`,
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

import { wrappingAdd, wrappingSub } from "nish:unsafe"

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
 * share of a map. Both lengths are read in the loop condition and `dst`'s again
 * after the call, because a call ends every length fact the bounds proof holds
 * (docs/LANGUAGE.md, "Arrays") and this is what keeps both accesses unchecked.
 * The caller has already checked that the range is inside both arrays, so
 * neither test is ever the one that stops the loop. `dst`'s in the condition
 * lets the loop vectorise (#619) when `f` inlines with no panic path: LLVM
 * sees the test after the call repeat one the condition made, drops it, and
 * the store is unconditional. `fromRange` has the same shape.
 */
const mapRange = <T, U>(src: T[], dst: U[], f: (x: T) => U, lo: i32, hi: i32): void => {
  for (let i: i32 = lo; i >= 0 && i < hi && i < toI32(src.length) && i < toI32(dst.length); i++) {
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
 * A new array of `f(src[i])` for every index of `src`: `parallelMapInto` into
 * an array this call allocates, before any element is computed, so nothing
 * but the map itself can hold it while the region runs.
 */
export const parallelMap = <T, U>(src: T[], f: (x: T) => U): U[] => {
  const dst = new Array<U>(toI32(src.length))
  parallelMapInto(src, dst, f)
  return dst
}

/**
 * Writes `f(i)` into `dst[i]` for every `i` in `[lo, hi)`: one thread's share
 * of a `parallelFrom`. The length is read in the loop condition and again
 * after the call, for the reason `mapRange` gives.
 */
const fromRange = <U>(dst: U[], f: (i: i32) => U, lo: i32, hi: i32): void => {
  for (let i: i32 = lo; i >= 0 && i < hi && i < toI32(dst.length); i++) {
    const y = f(i)
    if (i < toI32(dst.length)) {
      dst[i] = y
    }
  }
}

/**
 * A new array of `n` elements, `f(i)` at index `i`, computed on as many
 * threads as the machine has and the length is worth: `Array.from({ length:
 * n }, (_, i) => f(i))`, with the array allocated before any element is.
 */
export const parallelFrom = <U>(n: i32, f: (i: i32) => U): U[] => {
  const dst = new Array<U>(n)
  fromRange(dst, f, 0, toI32(dst.length))
  return dst
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
 * One task with no destination: `entry(arg)`, whose answer, if it has one,
 * nothing stores — the checker holds such an entry to `void`. Natively the
 * compiler files this call as a task as it files `runTask`'s, with no store
 * at the join; nothing under Node reaches it (see `spawn`).
 */
const runWith = <A, R>(entry: (arg: A) => R, arg: A): void => {
  entry(arg)
}

/** `runWith` for an entry of no parameters, such as `() => work(xs)`, whose captures are its arguments. */
const runThunk = <R>(entry: () => R): void => {
  entry()
}

/**
 * Whether a call of `spawn` wrote a destination slot. Natively every call
 * that reaches `spawn` did, so this is always true there: the compiler gives
 * `s.spawn(entry, arg)` and `s.spawn(() => ...)` the methods written for
 * them below, `spawnWith` and `spawnThunk`. Under Node the source runs as
 * it is written and every form reaches `spawn`, where a slot the call left
 * out is `undefined`, which is neither below zero nor at or above it.
 */
const slotWritten = (at: i32): boolean => at < 0 || at >= 0

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
    if (!slotWritten(at)) {
      // Under Node only: `s.spawn(entry, arg)` or `s.spawn(() => ...)`, run
      // at the spawn with nothing to store (`slotWritten`).
      entry(arg)
      return
    }
    if (at < 0 || at >= toI32(dst.length)) {
      slotOutOfRange(at, toI32(dst.length))
    }
    runTask(entry, arg, dst, at)
  }

  /**
   * `s.spawn(entry, arg)` as the compiler reads it: run `entry(arg)` on a
   * thread of its own when the scope closes, and store nothing. `entry`
   * answers `void`. Only the compiler names this method (see `slotWritten`):
   * a scope is only ever the receiver of a `spawn` statement, so `s.spawnWith(...)`
   * written in a program is refused by that rule (NL2389), as passing the
   * scope would be.
   */
  spawnWith<A, R>(entry: (arg: A) => R, arg: A): void {
    runWith(entry, arg)
  }

  /**
   * `s.spawn(() => work(xs))` as the compiler reads it: run the arrow, whose
   * captured `const` locals are its arguments, on a thread of its own when the
   * scope closes, and store nothing. Only the compiler names this method, and
   * a program that names it is refused as `spawnWith`'s is (NL2389).
   */
  spawnThunk<R>(entry: () => R): void {
    runThunk(entry)
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

/**
 * What a `Mutex` hands out: its data, as `value`, for as long as the block of
 * the `using` declaration that took the lock (docs/LANGUAGE.md, "A lock that
 * owns its data"). A guard is only ever named as `g.value`, and `g.value`
 * only as the base of a field or element access, so nothing read through it
 * outlives the lock.
 *
 * Each `Mutex` makes exactly one guard, when it is made, and every lock hands
 * out that one: taking the lock allocates nothing.
 */
export class MutexGuard<T> {
  /** The data the lock owns. */
  value: T

  /**
   * The lock word: 0 when the lock is free, 1 while a guard's block holds it.
   * Nothing written here reads or writes it. Natively the compiler takes it
   * with an acquire compare-and-swap in `lock()` and gives it back with a
   * release store at every exit of the guard's block (`src/emit-parallel.ts`);
   * under Node one task runs at a time and there is nothing to exclude.
   */
  word: i32 = 0

  constructor(value: T) {
    this.value = value
  }

  /**
   * What `using` calls when the guard's block ends. Natively the compiler
   * emits the release itself at every exit of the block, and under Node
   * nothing was taken, so there is nothing to give back.
   */
  [Symbol.dispose](): void {
    // Nothing to release: see above.
  }
}

/**
 * A lock that owns its data (docs/wp29-thread-surface.md §4.3). The data is
 * reachable only through the guard `lock()` answers, bound by `using`, so no
 * path to it skips the lock: `new Mutex<Hist>(new Hist())` takes a fresh
 * value, and `using g = m.lock()` is the only way to read or write it.
 *
 * Under Node a scope's tasks run one at a time, at their spawn, so `lock()`
 * answers the guard and waits for nothing: that is one of the orders the
 * native program can run its critical sections in, and a program whose
 * guarded updates commute prints the same either way.
 */
export class Mutex<T> {
  /** The one guard, which holds the data; only `lock()` hands it out. */
  guard: MutexGuard<T>

  constructor(init: T) {
    this.guard = new MutexGuard<T>(init)
  }

  /**
   * The guard over the data, for a `using` declaration: `using g = m.lock()`.
   * Natively the call waits until the lock is free and takes it.
   */
  lock(): MutexGuard<T> {
    return this.guard
  }
}

/**
 * An `i32` that a scope's tasks and a parallel body may update together
 * (docs/LANGUAGE.md, "Atomics"). Each method is one indivisible operation:
 * natively the compiler emits each body itself, as a sequentially consistent
 * `load atomic`, `store atomic`, `atomicrmw` or `cmpxchg` on `value`
 * (docs/IR_COOKBOOK.md, "Atomics"), and what is written below is the meaning,
 * which is what runs under Node. `add` and `sub` wrap at 32 bits, as the
 * native instruction does; `add`, `sub`, `min`, `max` and `exchange` answer
 * the value before the update, and `compareExchange` the value it saw.
 *
 * It reaches a task by the routes a `Mutex` does, and a parallel body through
 * a capture; its value is named only through these methods. Results that do
 * not depend on the order the updates land in need the updates to commute,
 * which the checker does not prove.
 */
export class AtomicI32 {
  /** The value; named only by this class's methods, which the compiler emits. */
  value: i32

  constructor(value: i32) {
    this.value = value
  }

  /** The value. */
  load(): i32 {
    return this.value
  }

  /** Sets the value to `value`. */
  store(value: i32): void {
    this.value = value
  }

  /** Adds `delta`, wrapping, and answers the value before. */
  add(delta: i32): i32 {
    const old = this.value
    this.value = wrappingAdd(old, delta)
    return old
  }

  /** Subtracts `delta`, wrapping, and answers the value before. */
  sub(delta: i32): i32 {
    const old = this.value
    this.value = wrappingSub(old, delta)
    return old
  }

  /** Keeps the smaller of the value and `value`, and answers the value before. */
  min(value: i32): i32 {
    const old = this.value
    if (value < old) {
      this.value = value
    }
    return old
  }

  /** Keeps the larger of the value and `value`, and answers the value before. */
  max(value: i32): i32 {
    const old = this.value
    if (value > old) {
      this.value = value
    }
    return old
  }

  /** Sets the value to `value` and answers the value before. */
  exchange(value: i32): i32 {
    const old = this.value
    this.value = value
    return old
  }

  /** Sets the value to `desired` if it is `expected`, and answers the value it saw. */
  compareExchange(expected: i32, desired: i32): i32 {
    const old = this.value
    if (old === expected) {
      this.value = desired
    }
    return old
  }
}

/**
 * An `i64` that a scope's tasks and a parallel body may update together
 * (docs/LANGUAGE.md, "Atomics"). Each method is one indivisible operation:
 * natively the compiler emits each body itself, as a sequentially consistent
 * `load atomic`, `store atomic`, `atomicrmw` or `cmpxchg` on `value`
 * (docs/IR_COOKBOOK.md, "Atomics"), and what is written below is the meaning,
 * which is what runs under Node. Natively `add` and `sub` wrap at 64 bits;
 * under Node an `i64` is a `number`, so they are `+` and `-`, which agree with
 * the native program while the value stays within 2^53. `add`, `sub`, `min`,
 * `max` and `exchange` answer the value before the update, and
 * `compareExchange` the value it saw.
 *
 * It reaches a task by the routes a `Mutex` does, and a parallel body through
 * a capture; its value is named only through these methods. Results that do
 * not depend on the order the updates land in need the updates to commute,
 * which the checker does not prove.
 */
export class AtomicI64 {
  /** The value; named only by this class's methods, which the compiler emits. */
  value: i64

  constructor(value: i64) {
    this.value = value
  }

  /** The value. */
  load(): i64 {
    return this.value
  }

  /** Sets the value to `value`. */
  store(value: i64): void {
    this.value = value
  }

  /** Adds `delta` and answers the value before; natively the sum wraps at 64 bits. */
  add(delta: i64): i64 {
    const old = this.value
    this.value = old + delta
    return old
  }

  /** Subtracts `delta` and answers the value before; natively the difference wraps at 64 bits. */
  sub(delta: i64): i64 {
    const old = this.value
    this.value = old - delta
    return old
  }

  /** Keeps the smaller of the value and `value`, and answers the value before. */
  min(value: i64): i64 {
    const old = this.value
    if (value < old) {
      this.value = value
    }
    return old
  }

  /** Keeps the larger of the value and `value`, and answers the value before. */
  max(value: i64): i64 {
    const old = this.value
    if (value > old) {
      this.value = value
    }
    return old
  }

  /** Sets the value to `value` and answers the value before. */
  exchange(value: i64): i64 {
    const old = this.value
    this.value = value
    return old
  }

  /** Sets the value to `desired` if it is `expected`, and answers the value it saw. */
  compareExchange(expected: i64, desired: i64): i64 {
    const old = this.value
    if (old === expected) {
      this.value = desired
    }
    return old
  }
}

/**
 * A channel of scalars between a scope's tasks (docs/wp29-thread-surface.md
 * §4.4): `send` from the tasks that produce, `for (const x of ch)` in the one
 * that consumes, or in the parent once the scope has joined.
 *
 *     const ch = new Channel<i32>()
 *     {
 *       using s = scope()
 *       s.spawn(produce, new Pipe(ch, 100), done, 0) // every sender first
 *       s.spawn(consume, new Pipe(ch, 0), sums, 0)   // then the one receiver
 *     }
 *
 * Nobody closes a channel: it closes when its scope has started to join and
 * every task that may send on it has returned (docs/LANGUAGE.md, "Channels").
 *
 * **What is written here is the meaning under Node**, where a scope's tasks run
 * one at a time at their spawns: `send` pushes onto `queue`, and a loop takes
 * values off its front until it is empty. That is correct because every
 * sender is spawned before the receiver, so every sender has run by the time
 * the receiver's loop starts. Natively the compiler writes `send` and the loop
 * itself (`src/emit-parallel.ts`), onto a buffer the runtime keeps outside
 * every arena behind `state`, and the loop waits while the channel is empty
 * and still open.
 */
export class Channel<T> {
  /** Under Node: every value sent, in the order it was sent. */
  queue: T[]

  /** Under Node: how many of `queue`'s values a loop has taken. */
  head: i32 = 0

  /**
   * Natively: the runtime's handle on the channel (runtime/runtime-parallel.c),
   * 0 until the channel is first used. Nothing written here reads or writes it.
   */
  state: i64 = 0

  constructor() {
    this.queue = []
  }

  /** Hand `x` to the receiver. It never waits: a channel holds as many values as are sent. */
  send(x: T): void {
    this.queue.push(x)
  }

  /**
   * The next value, for a loop that has found one waiting (`ChannelWalk`).
   * Natively the loop is the compiler's, which takes a value with the runtime
   * instead, and nothing calls this.
   */
  take(): T {
    const x = this.queue[this.head]
    this.head = this.head + 1
    return x
  }

  /** Whether a value is waiting, under Node, where nothing is sent while a loop runs. */
  ready(): boolean {
    return this.head < toI32(this.queue.length)
  }

  /**
   * What `for (const x of ch)` asks for under Node: a walk that takes each
   * value as it reaches it, so a second loop over the channel finds it empty,
   * as it does natively.
   */
  [Symbol.iterator](): ChannelWalk<T> {
    return new ChannelWalk<T>(this)
  }
}

/**
 * The iterator a `for...of` over a `Channel` walks under Node. Natively it is
 * never made: the compiler lowers the loop itself.
 */
class ChannelWalk<T> {
  channel: Channel<T>

  constructor(channel: Channel<T>) {
    this.channel = channel
  }

  next(): IteratorResult<T> {
    if (!this.channel.ready()) {
      return { done: true, value: 0 }
    }
    return { done: false, value: this.channel.take() }
  }
}
