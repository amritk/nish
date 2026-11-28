// `BufferPool.tryTake` answers `null` where `take` would panic, and makes
// nothing: with all `ceiling` buffers lent, for a pool whose ceiling is 0,
// and for a `size` set below 0 after the constructor. A buffer given back is
// lent again. A size of 0 lends empty buffers. Without the tests in
// `tryTake` the third take would make a buffer past the ceiling, and the
// negative size would panic in `new Array`.
import { BufferPool } from "nish/net/buffer-pool";

export const main = (): i32 => {
  const pool = new BufferPool("Test.pool", 16, 2);
  const a: u8[] | null = pool.tryTake();
  const b: u8[] | null = pool.tryTake();
  console.log(`two lent: ${a !== null && b !== null && pool.lent() === 2}`);
  console.log(`third: ${pool.tryTake() === null}, made ${pool.made}`);
  if (a !== null) {
    pool.give(a, 0);
  }
  console.log(`after a give-back: ${pool.tryTake() !== null}`);
  const none = new BufferPool("Test.none", 16, 0);
  console.log(`ceiling 0: ${none.tryTake() === null}, made ${none.made}`);
  const empty = new BufferPool("Test.empty", 0, 1);
  const e: u8[] | null = empty.tryTake();
  console.log(`size 0: ${e !== null && e.length === 0}`);
  const bad = new BufferPool("Test.bad", 16, 1);
  bad.size = -1;
  console.log(`size below 0: ${bad.tryTake() === null}, made ${bad.made}`);
  return 0;
};
