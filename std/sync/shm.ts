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
 * not starting with `.`. `createRegion` makes it with mode 0600 and refuses a
 * name that exists (`SHM_EXISTS`), so a name another user planted is never
 * adopted; `openRegion` refuses a region this user does not own, that anyone
 * else may read or write, or (on Linux) that is not a regular file or has a
 * second hard link (`SHM_ACCESS`). The name stays until `unlinkRegion`,
 * even after every process has exited, which is how a process that starts later
 * finds it; the mapping goes away with `close` or with the process.
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
 */
export const unlinkRegion = (name: string): Result<void, ShmError> => shmDone(nishshm_unlink(name))

/** A fence of `order`, for the accesses around it. */
export const fence = (order: i32): void => {
  nishshm_fence(order)
}

/**
 * A mapped region. Every slot offset is in bytes from its start; an offset
 * outside it, a misaligned slot or an ordering the access cannot take panics.
 */
export class SharedRegion {
  /** The runtime's handle; it names nothing after `close`. */
  handle: i32

  constructor(handle: i32) {
    this.handle = handle
  }

  /** The region's length in bytes. */
  size(): i32 {
    return nishshm_size(this.handle)
  }

  /** The 32-bit slot at `at`. */
  loadI32(at: i32, order: i32): i32 {
    return nishshm_load_i32(this.handle, at, order)
  }

  /** Sets the 32-bit slot at `at` to `value`. */
  storeI32(at: i32, value: i32, order: i32): void {
    nishshm_store_i32(this.handle, at, value, order)
  }

  /** Adds `delta` to the 32-bit slot at `at`, wrapping, and answers the value before. */
  addI32(at: i32, delta: i32, order: i32): i32 {
    return nishshm_add_i32(this.handle, at, delta, order)
  }

  /** Sets the 32-bit slot at `at` to `value` and answers the value before. */
  exchangeI32(at: i32, value: i32, order: i32): i32 {
    return nishshm_exchange_i32(this.handle, at, value, order)
  }

  /**
   * Sets the 32-bit slot at `at` to `desired` if it holds `expected`, and
   * answers what it held: the exchange happened when that is `expected`.
   */
  compareExchangeI32(at: i32, expected: i32, desired: i32, order: i32): i32 {
    return nishshm_cas_i32(this.handle, at, expected, desired, order)
  }

  /** The 64-bit slot at `at`. */
  loadI64(at: i32, order: i32): i64 {
    return nishshm_load_i64(this.handle, at, order)
  }

  /** Sets the 64-bit slot at `at` to `value`. */
  storeI64(at: i32, value: i64, order: i32): void {
    nishshm_store_i64(this.handle, at, value, order)
  }

  /** Adds `delta` to the 64-bit slot at `at`, wrapping, and answers the value before. */
  addI64(at: i32, delta: i64, order: i32): i64 {
    return nishshm_add_i64(this.handle, at, delta, order)
  }

  /** Sets the 64-bit slot at `at` to `value` and answers the value before. */
  exchangeI64(at: i32, value: i64, order: i32): i64 {
    return nishshm_exchange_i64(this.handle, at, value, order)
  }

  /**
   * Sets the 64-bit slot at `at` to `desired` if it holds `expected`, and
   * answers what it held: the exchange happened when that is `expected`.
   */
  compareExchangeI64(at: i32, expected: i64, desired: i64, order: i32): i64 {
    return nishshm_cas_i64(this.handle, at, expected, desired, order)
  }

  /** Copies `len` bytes of the region at `at` into `dst[off, off + len)`. */
  read(at: i32, dst: u8[], off: i32, len: i32): void {
    nishshm_read(this.handle, at, dst, toU64(dst.length), toU64(off), toU64(len))
  }

  /** Copies `src[off, off + len)` into the region at `at`. */
  write(at: i32, src: readonly u8[], off: i32, len: i32): void {
    nishshm_write(this.handle, at, src, toU64(src.length), toU64(off), toU64(len))
  }

  /**
   * Sleeps while the 32-bit slot at `at` holds `expected`, at most
   * `timeoutMs` (negative: no limit): `SHM_WOKEN`, `SHM_NOT_EQUAL`,
   * `SHM_TIMED_OUT`, or `SHM_UNSUPPORTED` off Linux.
   */
  waitI32(at: i32, expected: i32, timeoutMs: i32): i32 {
    return nishshm_wait_i32(this.handle, at, expected, timeoutMs)
  }

  /**
   * Wakes at most `count` of the processes sleeping on the 32-bit slot at
   * `at`: how many it woke, or `SHM_UNSUPPORTED` off Linux.
   */
  wake(at: i32, count: i32): i32 {
    return nishshm_wake(this.handle, at, count)
  }

  /** Unmaps the region; the handle names nothing after. The name stays until `unlinkRegion`. */
  close(): Result<void, ShmError> {
    return shmDone(nishshm_close(this.handle))
  }
}
