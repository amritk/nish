// A give-back whose used extent runs past the buffer panics naming the pool.
import { BufferPool } from "nish/net/buffer-pool";

export const main = (): number => {
  const pool = new BufferPool("Test.pool", 16, 2);
  const a: u8[] = pool.take();
  console.log(`took ${pool.lent()}`);
  pool.giveSecret(a, 17);
  console.log("unreachable");
  return 0;
};
