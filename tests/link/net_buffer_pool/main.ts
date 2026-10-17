// `nish/net/buffer-pool`: a take returns the buffer given back last, or a new
// one while fewer than the ceiling exist; a give-back zeroes the extent the
// borrower used and leaves the rest; a warmed take/give loop moves the arena
// by nothing. Each misuse panic has its own `net_buffer_pool_bad_*` program,
// since a panic ends the process.
import { BufferPool } from "nish/net/buffer-pool";
import { Suite } from "nish/testing";

/** How many bytes of `buf[from .. to)` are not 0. */
const nonZero = (buf: u8[], from: i32, to: i32): i32 => {
  let count: i32 = 0;
  for (let k: i32 = from; k < to; k++) {
    if (buf[k] !== 0) {
      count = count + 1;
    }
  }
  return count;
};

/** Writes 0xAB over `buf[0 .. used)`, as a borrower that used that much would. */
const scribble = (buf: u8[], used: i32): void => {
  for (let k: i32 = 0; k < used; k++) {
    buf[k] = 171;
  }
};

export const main = (): number => {
  const t = new Suite("buffer-pool");

  // A fresh pool has made nothing; the first take makes a zeroed buffer.
  const pool = new BufferPool("Test.pool", 64, 3);
  t.eqI32("a fresh pool has made nothing", pool.made, 0);
  t.eqI32("a fresh pool has lent nothing", pool.lent(), 0);
  const a: u8[] = pool.take();
  t.eqI32("take returns a buffer of the pool's size", toI32(a.length), 64);
  t.eqI32("a new buffer is all zeros", nonZero(a, 0, 64), 0);
  t.eqI32("the first take makes one buffer", pool.made, 1);
  t.eqI32("one buffer is lent", pool.lent(), 1);

  // give zeroes [0, used) and nothing past it: a marker past the extent stays.
  scribble(a, 10);
  a[40] = 7;
  pool.give(a, 10);
  t.eqI32("give takes the buffer back", pool.lent(), 0);
  t.eqI32("give zeroes the used extent", nonZero(a, 0, 10), 0);
  t.eqI32("give leaves bytes past the used extent", toI32(a[40]), 7);

  // The buffer given back last is the one lent next, and nothing new is made.
  const again: u8[] = pool.take();
  t.eqI32("take returns the buffer given back last (its marker is there)", toI32(again[40]), 7);
  t.eqI32("a reused buffer reads 0 where it was used", nonZero(again, 0, 10), 0);
  t.eqI32("reuse makes no new buffer", pool.made, 1);
  again[40] = 0;

  // Last given, first taken: of two buffers given back, the second comes out first.
  const b: u8[] = pool.take();
  t.eqI32("a second take while one is lent makes a second buffer", pool.made, 2);
  again[0] = 1;
  b[0] = 2;
  pool.give(again, 0);
  pool.give(b, 0);
  const first: u8[] = pool.take();
  const second: u8[] = pool.take();
  t.eqI32("the buffer given back last comes out first", toI32(first[0]), 2);
  t.eqI32("the buffer given back before it comes out next, used 0 having zeroed nothing", toI32(second[0]), 1);
  t.eqI32("both came off the free list", pool.made, 2);

  // used = size zeroes the whole buffer.
  scribble(first, 64);
  pool.give(first, 64);
  t.eqI32("give with used = size zeroes every byte", nonZero(first, 0, 64), 0);
  scribble(second, 64);
  pool.give(second, 64);
  t.eqI32("the other buffer is zeroed too", nonZero(second, 0, 64), 0);

  // The ceiling: three buffers at most, all lent at once, then all reused.
  const c1: u8[] = pool.take();
  const c2: u8[] = pool.take();
  const c3: u8[] = pool.take();
  t.eqI32("taking up to the ceiling makes exactly the ceiling", pool.made, 3);
  t.eqI32("all three are lent", pool.lent(), 3);
  pool.give(c1, 0);
  pool.give(c2, 0);
  pool.give(c3, 0);
  t.eqI32("all three given back leaves none lent", pool.lent(), 0);
  const d1: u8[] = pool.take();
  const d2: u8[] = pool.take();
  const d3: u8[] = pool.take();
  t.eqI32("taking the ceiling again makes nothing new", pool.made, 3);
  pool.give(d1, 0);
  pool.give(d2, 0);

  // giveSecret wipes what was used; a buffer never written costs nothing.
  scribble(d3, 20);
  pool.giveSecret(d3, 20);
  t.eqI32("giveSecret zeroes the used extent", nonZero(d3, 0, 20), 0);
  t.eqI32("giveSecret takes the buffer back", pool.lent(), 0);
  const e: u8[] = pool.take();
  t.eqI32("a buffer given back by giveSecret is the next one lent", nonZero(e, 0, 64), 0);
  pool.giveSecret(e, 0);
  t.eqI32("giveSecret with used 0 still takes the buffer back", pool.lent(), 0);

  // After warm-up, take and give move the arena by nothing.
  const warm = new BufferPool("Test.warm", 256, 4);
  const w1: u8[] = warm.take();
  const w2: u8[] = warm.take();
  warm.give(w1, 0);
  warm.give(w2, 0);
  const before: i64 = Arena.used();
  for (let round: i32 = 0; round < 1000; round++) {
    const x: u8[] = warm.take();
    const y: u8[] = warm.take();
    scribble(x, 100);
    scribble(y, 256);
    warm.give(y, 256);
    warm.giveSecret(x, 100);
  }
  const growth: i64 = Arena.used() - before;
  t.ok("a warmed take/give loop moves Arena.used() by 0", growth === toI64(0));
  t.eqI32("the warmed loop made nothing past its warm-up", warm.made, 2);

  return t.done();
};
