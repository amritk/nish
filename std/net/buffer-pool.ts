/**
 * `nish/net/buffer-pool` — fixed-size byte buffers a server's connections
 * borrow and give back, so the memory a server holds follows the connections
 * that are moving bytes, not the slots it was sized for.
 *
 *     const pool = new BufferPool("TlsTcpServer.output", 33290, slots);
 *     // when a connection first needs room:
 *     const out: u8[] = pool.take();
 *     // ... write out[0 .. used) and send it ...
 *     pool.giveSecret(out, used); // or pool.give(out, used) for bytes that were never secret
 *
 * It has the shape of `nish/net/http1-server`'s `Http1OutputPool` (`take`,
 * `give`, `made`, a `u8[][]` free list), so the two read alike and can merge,
 * with three things added:
 *
 * - **A ceiling.** At most `ceiling` buffers ever exist. A server sizes it to
 *   what preallocating every slot would have cost, so a full server behaves as
 *   it did before and a `take` can never fail for want of memory. Reaching it
 *   therefore means some buffer was not given back, and `take` panics rather
 *   than allocating past it.
 * - **Give-back zeroes what was used.** The borrower says how far into the
 *   buffer it wrote, and `give` zeroes `[0, used)` before the buffer goes on
 *   the free list, so nothing one connection wrote is readable by the next one
 *   to take it. The cost follows the bytes moved, not the buffer's size.
 * - **Misuse panics.** A buffer of the wrong length, a `used` outside the
 *   buffer, or a give-back with nothing lent is a borrower's bug, and each
 *   panics with the pool's name rather than corrupting the free list quietly.
 *
 * The pool grows to its high-water mark and never shrinks: after warm-up a
 * `take` pops the free list and a `give` pushes onto capacity it already has,
 * so a warmed take/give loop moves the arena by nothing.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 */

/**
 * A pool of `size`-byte `u8` buffers, at most `ceiling` of them, lent last
 * given first. Owned by a server and shared by its slots; a slot holds a
 * buffer only between the `take` that borrowed it and the `give` that brings
 * it back.
 */
export class BufferPool {
  // References, then 32-bit fields: the order the layout packs without padding.
  /** The buffers given back and not yet taken again; the last one is lent next. */
  free: u8[][]
  /** Names the pool in every panic, so a leak or a stray buffer says whose it is. */
  name: string
  /** The length of every buffer the pool makes and takes back. */
  size: i32 = 0
  /** The most buffers the pool will ever make. */
  ceiling: i32 = 0
  /** How many buffers the pool has made: its high-water mark, since it never frees one. */
  made: i32 = 0

  /**
   * An empty pool: it makes nothing until the first `take`. `name` is what
   * its panics print (the owner's type and field reads best,
   * `"Http2TlsServer.output"`). Panics, naming the pool, unless `size` is
   * above 0 and `ceiling` at least 1: a pool of neither makes a buffer
   * nobody can use or none at all.
   */
  constructor(name: string, size: i32, ceiling: i32) {
    if (size <= 0) {
      panic(`BufferPool ${name}: a buffer size of ${size} bytes is not above 0`)
    }
    if (ceiling < 1) {
      panic(`BufferPool ${name}: a ceiling of ${ceiling} buffers is below 1`)
    }
    this.name = name
    this.size = size
    this.ceiling = ceiling
    this.free = []
  }

  /**
   * A buffer of `size` bytes: the one given back last, or a new one, all
   * zeros, while fewer than `ceiling` exist. Every byte a previous borrower
   * reported as used reads 0; bytes past that extent are as it left them,
   * which is nothing when the borrower kept its promise.
   *
   * Panics when all `ceiling` buffers are lent: the ceiling is what every
   * slot holding a buffer at once would need, so one more means a buffer was
   * never given back.
   */
  take(): u8[] {
    if (this.free.length > 0) {
      const buf: u8[] = this.free[this.free.length - 1]
      this.free.pop()
      return buf
    }
    if (this.made >= this.ceiling) {
      panic(`BufferPool ${this.name}: all ${this.ceiling} buffers are lent, so one was never given back`)
    }
    this.made = this.made + 1
    return new Array<u8>(this.size)
  }

  /**
   * Takes back a buffer `take` lent, after zeroing `buf[0 .. used)` with a
   * plain fill. `used` is how far the borrower wrote: the zeroing promises
   * nothing about bytes past it. For bytes that were never secret; a buffer
   * that held plaintext or keys under TLS goes back through `giveSecret`.
   *
   * Panics when `buf` is not `size` bytes, when `used` is outside
   * `0 .. size`, or when nothing is lent.
   */
  give(buf: u8[], used: i32): void {
    bufferPoolCheckGive(this, buf, used)
    buf.fill(0, 0, used)
    this.free.push(buf)
  }

  /**
   * `give` for a buffer that held secret bytes: the zeroing is `secureZero`,
   * whose stores no optimisation removes, where `give`'s fill is an ordinary
   * store `-O2` may drop once nothing reads the buffer again. `secureZero`
   * clears a whole array, so this zeroes all `size` bytes whenever `used` is
   * above 0, and costs nothing for a buffer that was never written.
   *
   * Panics as `give` does.
   */
  giveSecret(buf: u8[], used: i32): void {
    bufferPoolCheckGive(this, buf, used)
    if (used > 0) {
      secureZero(buf)
    }
    this.free.push(buf)
  }

  /** How many buffers are lent now: made, less those waiting on the free list. */
  lent(): i32 {
    return this.made - toI32(this.free.length)
  }
}

/** Panics unless `buf` and `used` are a give-back `pool` can take: the borrower's mistake, named. */
const bufferPoolCheckGive = (pool: BufferPool, buf: u8[], used: i32): void => {
  const length: i32 = toI32(buf.length)
  if (length !== pool.size) {
    panic(
      `BufferPool ${pool.name}: a buffer of ${length} bytes was given back to a pool of ${pool.size}-byte buffers`
    )
  }
  if (used < 0 || used > pool.size) {
    panic(`BufferPool ${pool.name}: a used extent of ${used} bytes is outside 0 to ${pool.size}`)
  }
  if (pool.lent() === 0) {
    panic(`BufferPool ${pool.name}: a buffer was given back with none lent`)
  }
}
