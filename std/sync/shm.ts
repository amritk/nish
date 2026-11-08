/**
 * `nish/sync/shm` — memory that several processes map at once, and the
 * atomics that order what they write to it.
 *
 *     import { createRegion, openRegion, unlinkRegion, ACQUIRE, RELEASE } from "nish/sync/shm"
 *
 *     // The process that owns it: a fresh, zeroed region of 4096 bytes.
 *     const stale = unlinkRegion("jobs") // a region a crashed run left, if any
 *     const region = createRegion("jobs", 4096).expect("create")
 *     region.storeI64(0, toI64(42), RELEASE)
 *
 *     // Any other process of the same user: the same bytes.
 *     const view = openRegion("jobs").expect("open")
 *     const n: i64 = view.loadI64(0, ACQUIRE) // 42 once the store is seen
 *
 * **A region is a named POSIX shared-memory object** (`/dev/shm/<name>` on
 * Linux, `shm_open("/<name>")` on Darwin) mapped shared, so every process that
 * opens the name sees the same bytes. A name is 1 to 30 of `A-Z a-z 0-9 . _ -`,
 * not starting with `.`.
 *
 *  `createRegion` makes it with mode 0600 and refuses a name that exists
 *  (`SHM_EXISTS`), so a name another user planted is never adopted; `openRegion`
 *  refuses a region this user does not own, that anyone else may read or write,
 *  or (on Linux) that is not a regular file or has a second hard link
 *  (`SHM_ACCESS`). The name stays until `unlinkRegion`, even after every process
 *  has exited, which is how a process that starts later finds it; the mapping
 *  goes away with `close` or with the process.
 *
 * **Why named, and no anonymous region made before `fork`.** A Nish program
 * has no `fork`: `spawn` and `nish/net/prefork` start a program with `exec`,
 * and every descriptor is close-on-exec, so neither an anonymous mapping nor a
 * `memfd` reaches the child. A name does. The supervisor creates the region
 * before `preforkWith`, every worker opens it by name, and the supervisor
 * unlinks it after (`examples/prefork-jobs.ts`, docs/wp47-shared-memory.md).
 *
 * **Every access is checked.** An offset is an `i32` byte offset into the
 * region. A 32-bit slot sits at a multiple of 4 and a 64-bit one at a multiple
 * of 8, wholly inside the region; a byte copy fits the region and the buffer.
 * Anything else panics, naming the offset and the region's size, exactly as an
 * array index out of range does. An ordering an access cannot take (a load
 * with `RELEASE`) panics too. A region is never read or written past its end.
 *
 * **Orderings are C11's.** `RELAXED`, `ACQUIRE`, `RELEASE`, `ACQ_REL` and
 * `SEQ_CST`; a load takes the first, second and last, a store the first, third
 * and last, and a read-modify-write any of them. Each access is one LLVM
 * atomic instruction on the speed and size profiles, where the runtime is
 * inlined into the program; a compare-exchange that fails orders as C++
 * derives it (`ACQ_REL` fails `ACQUIRE`, `RELEASE` fails `RELAXED`). Bytes
 * copied by `read` and `write` are plain copies, ordered by the atomics around
 * them, and a copy that races a writer in another process can be torn but is
 * never read past its window.
 *
 * **Waiting.** `waitI32` sleeps while a 32-bit slot holds a value and `wake`
 * wakes the processes sleeping on it: Linux's futex, shared between processes.
 * Darwin and wasi answer `SHM_UNSUPPORTED` (-95) from both, as
 * `setIdlePriority` does on Darwin, and a program there polls instead.
 *
 * **A region belongs to the thread that mapped it.** Under `--threads` the
 * runtime's table of regions is thread-local, so a `SharedRegion` handed to
 * another thread names nothing there and panics; that thread opens the name
 * again. Native only: `--emit-ts` refuses a module that declares C functions,
 * and creating a region on wasi answers `SHM_UNSUPPORTED`. Calling C is the
 * `ffi` capability, so a program that imports this module is reported with
 * `ffi` and `--deny ffi` refuses it.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 */

// biome-ignore-all lint/style/useNamingConvention: the declarations name C symbols
// runtime/runtime-shm.c. The names are `nishshm_`, not `nish_shm_`: `nish_`
// names are the runtime's own (NL2202).
declare function nishshm_create(name: string, bytes: i32): i32
declare function nishshm_open(name: string): i32
declare function nishshm_unlink(name: string): i32
declare function nishshm_close(h: i32): i32
declare function nishshm_size(h: i32): i32
declare function nishshm_load_i32(h: i32, at: i32, order: i32): i32
declare function nishshm_store_i32(h: i32, at: i32, v: i32, order: i32): void
declare function nishshm_add_i32(h: i32, at: i32, delta: i32, order: i32): i32
declare function nishshm_exchange_i32(h: i32, at: i32, v: i32, order: i32): i32
declare function nishshm_cas_i32(h: i32, at: i32, expected: i32, desired: i32, order: i32): i32
declare function nishshm_load_i64(h: i32, at: i32, order: i32): i64
declare function nishshm_store_i64(h: i32, at: i32, v: i64, order: i32): void
declare function nishshm_add_i64(h: i32, at: i32, delta: i64, order: i32): i64
declare function nishshm_exchange_i64(h: i32, at: i32, v: i64, order: i32): i64
declare function nishshm_cas_i64(h: i32, at: i32, expected: i64, desired: i64, order: i32): i64
declare function nishshm_fence(order: i32): void
declare function nishshm_read(h: i32, at: i32, dst: u8[], n: u64, off: u64, len: u64): void
declare function nishshm_write(h: i32, at: i32, src: readonly u8[], n: u64, off: u64, len: u64): void
declare function nishshm_wait_i32(h: i32, at: i32, expected: i32, timeoutMs: i32): i32
declare function nishshm_wake(h: i32, at: i32, count: i32): i32
declare function strerror(errnum: i32): string

// The window intrinsics (`src/shm-window.ts`): each body is a call of itself,
// which the compiler replaces with `nishshm_lend` or `nishshm_give_back`. They
// are not `declare function`s because C would be handed `data` and not the
// `nish_array` header, and could not answer a `u8[]`.

/** `nishshm_lend`: a `u8[]` whose bytes are the region's `[at, at + len)`. */
const shmLend = (h: i32, at: i32, len: i32, reuse: u8[] | null): u8[] => shmLend(h, at, len, reuse)

/** `nishshm_give_back`: empties `window` and answers the length it had. */
const shmGiveBack = (h: i32, window: u8[]): i32 => shmGiveBack(h, window)

/** No ordering beyond the access itself being whole. */
export const RELAXED: i32 = 0
/** A load that sees everything written before the `RELEASE` store it reads. */
export const ACQUIRE: i32 = 2
/** A store after which everything written before it is seen by an `ACQUIRE` load of it. */
export const RELEASE: i32 = 3
/** A read-modify-write that is both. */
export const ACQ_REL: i32 = 4
/** One order every `SEQ_CST` access in every process agrees on. */
export const SEQ_CST: i32 = 5

/** `waitI32`: woken, or for no reason the caller can see; load the slot again. */
export const SHM_WOKEN: i32 = 0
/** `waitI32`: the slot did not hold the value, so it did not sleep. */
export const SHM_NOT_EQUAL: i32 = -11
/** `waitI32`: the time ran out. */
export const SHM_TIMED_OUT: i32 = -110
/** `waitI32` and `wake` on Darwin and wasi, and every region on wasi: not here. */
export const SHM_UNSUPPORTED: i32 = -95

/** `ShmError.code`: no region of that name. */
export const SHM_NOT_FOUND: i32 = 2
/** `ShmError.code`: another user's region, one others may use, or not one region under one name. */
export const SHM_ACCESS: i32 = 13
/** `ShmError.code`: a region of that name exists already. */
export const SHM_EXISTS: i32 = 17
/** `ShmError.code`: a name that is not 1 to 30 of `A-Za-z0-9._-`, or a size outside 1 byte to 1 GiB. */
export const SHM_INVALID: i32 = 22
/** `ShmError.code`: this thread has 63 regions open. */
export const SHM_TOO_MANY: i32 = 24

/** Why a region could not be created, opened, unlinked or closed. */
export class ShmError {
  /** The errno, positive: `SHM_NOT_FOUND`, `SHM_EXISTS` and the rest. */
  code: i32
  /** What it means, such as `File exists`. */
  message: string

  /**
   * The error for one errno, with its text: `strerror`'s, except that 95
   * (`SHM_UNSUPPORTED` negated) reads "not supported on this platform".
   * @param code the errno the runtime answered, positive (the negation of a
   *   failed call's result), such as `SHM_EXISTS`
   */
  constructor(code: i32) {
    this.code = code
    this.message = code === 95 ? "not supported on this platform" : strerror(code)
  }
}

/** `Ok()` for 0, the error for a negated errno. */
const shmDone = (rc: i32): Result<void, ShmError> => {
  if (rc < 0) {
    return Err(new ShmError(-rc))
  }
  return Ok()
}

/**
 * Creates the region `name`, `bytes` long and zeroed, mode 0600, and maps it.
 * `SHM_EXISTS` when the name is taken: unlink a stale one first.
 * @param name the region's name, 1 to 30 of `A-Z a-z 0-9 . _ -`, not
 *   starting with `.`; anything else is `SHM_INVALID`
 * @param bytes the region's length, from 1 to 1 GiB; outside that is
 *   `SHM_INVALID`
 * @returns a new `SharedRegion` mapping the fresh region, which this thread
 *   alone can use and which stays mapped until its `close` or the process
 *   ends; or the `ShmError`: `SHM_EXISTS`, `SHM_INVALID`, `SHM_TOO_MANY`
 *   when this thread has 63 regions open, code 95 on wasi, or the errno the
 *   system gave
 */
export const createRegion = (name: string, bytes: i32): Result<SharedRegion, ShmError> => {
  const h: i32 = nishshm_create(name, bytes)
  if (h < 0) {
    return Err(new ShmError(-h))
  }
  return Ok(new SharedRegion(h))
}

/**
 * Maps the region `name` that some process of this user created. Its size is
 * the region's (on Darwin, rounded up to a page).
 * @param name the name the region was created under, with `createRegion`'s
 *   rules (`SHM_INVALID` otherwise)
 * @returns a new `SharedRegion` on the same bytes every other mapping of the
 *   name sees, which this thread alone can use until its `close`; or the
 *   `ShmError`: `SHM_NOT_FOUND`, `SHM_ACCESS` for a region another user owns,
 *   that others may read or write, or (on Linux) that is not a regular file
 *   or has a second hard link, `SHM_INVALID` for a bad name or a region of
 *   size 0 or over 1 GiB, `SHM_TOO_MANY`, code 95 on wasi, or the errno the
 *   system gave
 */
export const openRegion = (name: string): Result<SharedRegion, ShmError> => {
  const h: i32 = nishshm_open(name)
  if (h < 0) {
    return Err(new ShmError(-h))
  }
  return Ok(new SharedRegion(h))
}

/**
 * Removes the name, so no process can open it again; every mapping of it
 * stays valid until it is closed. `SHM_NOT_FOUND` when there is none.
 * @param name the region's name, with `createRegion`'s rules (`SHM_INVALID`
 *   otherwise)
 * @returns `Ok()` once the name is gone, or the `ShmError`: `SHM_NOT_FOUND`,
 *   `SHM_INVALID`, code 95 on wasi, or the errno the system gave
 */
export const unlinkRegion = (name: string): Result<void, ShmError> => shmDone(nishshm_unlink(name))

/**
 * A fence of `order`, for the accesses around it: C11's
 * `atomic_thread_fence`, so it orders the calling thread's accesses, to
 * regions and to its own memory, exactly as that fence does; `RELAXED` is no
 * fence at all.
 * @param order `RELAXED`, `ACQUIRE`, `RELEASE`, `ACQ_REL` or `SEQ_CST`; any
 *   other value panics
 */
export const fence = (order: i32): void => {
  nishshm_fence(order)
}

/**
 * A mapped region. Every slot offset is in bytes from its start; an offset
 * outside it, a misaligned slot or an ordering the access cannot take panics.
 */
export class SharedRegion {
  /** The runtime's handle; it names nothing after `close`. */
  private handle: i32

  /**
   * Wraps a handle the runtime answered. A program gets a region from
   * `createRegion` or `openRegion` instead; a handle that names no region
   * open on this thread makes every access panic, and `close` answer code 9.
   * @param handle the runtime's handle for a mapped region, as
   *   `nishshm_create` or `nishshm_open` answered it
   */
  constructor(handle: i32) {
    this.handle = handle
  }

  /**
   * The region's length in bytes.
   * @returns the mapped length: what `createRegion` was given, or what
   *   `openRegion` found (on Darwin, rounded up to a page)
   */
  size(): i32 {
    return nishshm_size(this.handle)
  }

  /**
   * Loads the 32-bit slot at `at`, one atomic load.
   * @param at the slot's byte offset from the region's start, a multiple of
   *   4 with the whole slot inside the region; anything else panics
   * @param order `RELAXED`, `ACQUIRE` or `SEQ_CST`; another panics
   * @returns the value the slot held
   */
  loadI32(at: i32, order: i32): i32 {
    return nishshm_load_i32(this.handle, at, order)
  }

  /**
   * Sets the 32-bit slot at `at` to `value`, one atomic store.
   * @param at the slot's byte offset from the region's start, a multiple of
   *   4 with the whole slot inside the region; anything else panics
   * @param value what the slot holds after
   * @param order `RELAXED`, `RELEASE` or `SEQ_CST`; another panics
   */
  storeI32(at: i32, value: i32, order: i32): void {
    nishshm_store_i32(this.handle, at, value, order)
  }

  /**
   * Adds `delta` to the 32-bit slot at `at`, wrapping, and answers the value
   * before, as one atomic read-modify-write.
   * @param at the slot's byte offset from the region's start, a multiple of
   *   4 with the whole slot inside the region; anything else panics
   * @param delta what is added; negative subtracts
   * @param order any of the five orderings; another value panics
   * @returns the value the slot held just before the add
   */
  addI32(at: i32, delta: i32, order: i32): i32 {
    return nishshm_add_i32(this.handle, at, delta, order)
  }

  /**
   * Sets the 32-bit slot at `at` to `value` and answers the value before, as
   * one atomic read-modify-write.
   * @param at the slot's byte offset from the region's start, a multiple of
   *   4 with the whole slot inside the region; anything else panics
   * @param value what the slot holds after
   * @param order any of the five orderings; another value panics
   * @returns the value the slot held just before
   */
  exchangeI32(at: i32, value: i32, order: i32): i32 {
    return nishshm_exchange_i32(this.handle, at, value, order)
  }

  /**
   * Sets the 32-bit slot at `at` to `desired` if it holds `expected`, and
   * answers what it held: the exchange happened when that is `expected`.
   * It never fails spuriously (a strong compare-exchange).
   * @param at the slot's byte offset from the region's start, a multiple of
   *   4 with the whole slot inside the region; anything else panics
   * @param expected the value the slot must hold for the store to happen
   * @param desired what the slot holds after, when it held `expected`
   * @param order the ordering of a successful exchange, any of the five
   *   (another value panics); a failed one is a load ordered as C++ derives
   *   it (`ACQ_REL` fails `ACQUIRE`, `RELEASE` fails `RELAXED`, the others
   *   fail as themselves)
   * @returns what the slot held: `expected` when the exchange happened
   */
  compareExchangeI32(at: i32, expected: i32, desired: i32, order: i32): i32 {
    return nishshm_cas_i32(this.handle, at, expected, desired, order)
  }

  /**
   * Loads the 64-bit slot at `at`, one atomic load.
   * @param at the slot's byte offset from the region's start, a multiple of
   *   8 with the whole slot inside the region; anything else panics
   * @param order `RELAXED`, `ACQUIRE` or `SEQ_CST`; another panics
   * @returns the value the slot held
   */
  loadI64(at: i32, order: i32): i64 {
    return nishshm_load_i64(this.handle, at, order)
  }

  /**
   * Sets the 64-bit slot at `at` to `value`, one atomic store.
   * @param at the slot's byte offset from the region's start, a multiple of
   *   8 with the whole slot inside the region; anything else panics
   * @param value what the slot holds after
   * @param order `RELAXED`, `RELEASE` or `SEQ_CST`; another panics
   */
  storeI64(at: i32, value: i64, order: i32): void {
    nishshm_store_i64(this.handle, at, value, order)
  }

  /**
   * Adds `delta` to the 64-bit slot at `at`, wrapping, and answers the value
   * before, as one atomic read-modify-write.
   * @param at the slot's byte offset from the region's start, a multiple of
   *   8 with the whole slot inside the region; anything else panics
   * @param delta what is added; negative subtracts
   * @param order any of the five orderings; another value panics
   * @returns the value the slot held just before the add
   */
  addI64(at: i32, delta: i64, order: i32): i64 {
    return nishshm_add_i64(this.handle, at, delta, order)
  }

  /**
   * Sets the 64-bit slot at `at` to `value` and answers the value before, as
   * one atomic read-modify-write.
   * @param at the slot's byte offset from the region's start, a multiple of
   *   8 with the whole slot inside the region; anything else panics
   * @param value what the slot holds after
   * @param order any of the five orderings; another value panics
   * @returns the value the slot held just before
   */
  exchangeI64(at: i32, value: i64, order: i32): i64 {
    return nishshm_exchange_i64(this.handle, at, value, order)
  }

  /**
   * Sets the 64-bit slot at `at` to `desired` if it holds `expected`, and
   * answers what it held: the exchange happened when that is `expected`.
   * It never fails spuriously (a strong compare-exchange).
   * @param at the slot's byte offset from the region's start, a multiple of
   *   8 with the whole slot inside the region; anything else panics
   * @param expected the value the slot must hold for the store to happen
   * @param desired what the slot holds after, when it held `expected`
   * @param order the ordering of a successful exchange, any of the five
   *   (another value panics); a failed one is a load ordered as C++ derives
   *   it (`ACQ_REL` fails `ACQUIRE`, `RELEASE` fails `RELAXED`, the others
   *   fail as themselves)
   * @returns what the slot held: `expected` when the exchange happened
   */
  compareExchangeI64(at: i32, expected: i64, desired: i64, order: i32): i64 {
    return nishshm_cas_i64(this.handle, at, expected, desired, order)
  }

  /**
   * Copies `len` bytes of the region at `at` into `dst[off, off + len)`. A
   * plain copy, not atomic: a writer in another process racing it can tear
   * what it reads, and only the atomics around it order it.
   * @param at where in the region the copy starts, in bytes
   * @param dst the buffer the bytes land in
   * @param off where in `dst` the first byte goes
   * @param len how many bytes to copy; the range must fit both the region from
   *   `at` and `dst` from `off`, or it panics
   */
  read(at: i32, dst: u8[], off: i32, len: i32): void {
    nishshm_read(this.handle, at, dst, toU64(dst.length), toU64(off), toU64(len))
  }

  /**
   * Copies `src[off, off + len)` into the region at `at`. A plain copy, not
   * atomic: publish it to another process with a `RELEASE` (or `SEQ_CST`)
   * store after it.
   * @param at where in the region the first byte goes
   * @param src the bytes to copy
   * @param off where in `src` the copy starts
   * @param len how many bytes to copy; the range must fit both `src` from `off`
   *   and the region from `at`, or it panics
   */
  write(at: i32, src: readonly u8[], off: i32, len: i32): void {
    nishshm_write(this.handle, at, src, toU64(src.length), toU64(off), toU64(len))
  }

  /**
   * Sleeps while the 32-bit slot at `at` holds `expected`, at most
   * `timeoutMs` (negative: no limit): `SHM_WOKEN`, `SHM_NOT_EQUAL`,
   * `SHM_TIMED_OUT`, or `SHM_UNSUPPORTED` off Linux. It promises no
   * ordering: load the slot again, with the ordering the caller needs, after
   * it returns.
   * @param at the 32-bit slot's byte offset, a multiple of 4 inside the
   *   region; anything else panics, off Linux too
   * @param expected the value the slot must still hold for the call to sleep
   * @param timeoutMs the longest sleep, in milliseconds; negative for no limit
   * @returns `SHM_WOKEN` when woken, interrupted by a signal or for no reason
   *   the caller can see; `SHM_NOT_EQUAL` when the slot did not hold
   *   `expected`; `SHM_TIMED_OUT`; `SHM_UNSUPPORTED` off Linux; or another
   *   negated errno the futex gave
   */
  waitI32(at: i32, expected: i32, timeoutMs: i32): i32 {
    return nishshm_wait_i32(this.handle, at, expected, timeoutMs)
  }

  /**
   * Wakes at most `count` of the processes sleeping on the 32-bit slot at
   * `at`: how many it woke, or `SHM_UNSUPPORTED` off Linux.
   * @param at the 32-bit slot's byte offset, a multiple of 4 inside the
   *   region; anything else panics, off Linux too
   * @param count the most sleepers to wake; negative wakes none
   * @returns how many it woke, in any process; `SHM_UNSUPPORTED` off Linux, or
   *   another negated errno the futex gave
   */
  wake(at: i32, count: i32): i32 {
    return nishshm_wake(this.handle, at, count)
  }

  /**
   * A `u8[]` of length `len` whose bytes are the region's `[at, at + len)`, not
   * a copy: an index or `copyBytes` into it reads and writes the region. A range
   * outside the region panics. `giveBack` or `close` empties it (length 0), so
   * an index after either panics. A `push` moves it into this process's own
   * memory, after which it is no window and `giveBack` panics. Pass a window
   * already given back as `reuse` to lend it again without a new header: each
   * lend without one keeps a few bytes for the life of the process.
   * @param at where in the region the window starts, in bytes
   * @param len the window's length in bytes; `[at, at + len)` must lie inside
   *   the region, or it panics
   * @param reuse null for a new window, or a window this region lent and that
   *   was given back, to re-point; any other array panics
   * @returns the window: `reuse` itself when one was passed, otherwise a new
   *   array. Its bytes are the region's, shared with every process that maps
   *   it, until `giveBack` or `close`
   */
  lend(at: i32, len: i32, reuse: u8[] | null = null): u8[] {
    return shmLend(this.handle, at, len, reuse)
  }

  /**
   * Empties `window`, which this region lent, and answers the length it had.
   * After it the array has length 0 and may be passed to `lend` as `reuse`.
   * @param window a window this region lent and that is still lent; one given
   *   back already, lent by another region, or moved off the region by a
   *   `push` panics
   * @returns the window's length just before (a `pop` may have shortened it)
   */
  giveBack(window: u8[]): i32 {
    return shmGiveBack(this.handle, window)
  }

  /**
   * Unmaps the region; the handle names nothing after. The name stays until
   * `unlinkRegion`. Every window still lent from it is emptied first, so an
   * index into one after this panics rather than reading unmapped memory (a
   * window a `push` moved off the region is the program's own array, and is
   * left alone); any other access through this object panics too.
   * @returns `Ok()` once it is unmapped, or a `ShmError` of code 9 when it was
   *   closed already (or on wasi, where no region opens)
   */
  close(): Result<void, ShmError> {
    return shmDone(nishshm_close(this.handle))
  }
}
