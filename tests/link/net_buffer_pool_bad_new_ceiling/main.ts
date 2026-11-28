// A pool made with a ceiling below 0 lends nothing: every `tryTake` answers
// `null` and makes no buffer. Without the `made >= ceiling` test in `tryTake`
// it would make buffers past a ceiling it was told to keep.
import { BufferPool } from "nish/net/buffer-pool";

export const main = (): number => {
  const pool = new BufferPool("Test.pool", 16, -1);
  console.log(`lends none: ${pool.tryTake() === null}`);
  console.log(`lends none again: ${pool.tryTake() === null}`);
  console.log(`made: ${pool.made}`);
  return 0;
};
