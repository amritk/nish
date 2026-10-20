// A give-back whose used extent is negative panics naming the pool.
import { BufferPool } from "nish/net/buffer-pool";

export const main = (): number => {
  const pool = new BufferPool("Test.pool", 16, 2);
  const a: u8[] = pool.take();
  console.log(`took ${pool.lent()}`);
  pool.give(a, -1);
  console.log("unreachable");
  return 0;
};
