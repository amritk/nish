// A give-back of a buffer the wrong length panics naming the pool, before the
// stray buffer can reach the free list.
import { BufferPool } from "nish/net/buffer-pool";

export const main = (): number => {
  const pool = new BufferPool("Test.pool", 16, 2);
  const a: u8[] = pool.take();
  console.log(`took ${pool.lent()}`);
  const stray: u8[] = new Array<u8>(8);
  pool.give(stray, 0);
  console.log(`unreachable ${a.length}`);
  return 0;
};
