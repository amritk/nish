// A pool with a ceiling of zero panics when it is made, naming the pool.
import { BufferPool } from "nish/net/buffer-pool";

export const main = (): number => {
  console.log("making");
  const pool = new BufferPool("Test.pool", 16, 0);
  console.log(`unreachable ${pool.lent()}`);
  return 0;
};
