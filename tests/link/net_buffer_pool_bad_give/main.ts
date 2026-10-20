// A second give-back of the one buffer lent panics naming the pool: with
// nothing lent, the free list would hold one buffer twice.
import { BufferPool } from "nish/net/buffer-pool";

export const main = (): number => {
  const pool = new BufferPool("Test.pool", 16, 2);
  const a: u8[] = pool.take();
  pool.give(a, 4);
  console.log(`gave ${pool.made}`);
  pool.give(a, 4);
  console.log("unreachable");
  return 0;
};
