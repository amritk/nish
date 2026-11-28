// A pool made with a buffer size below 0 lends nothing: every `tryTake`
// answers `null` and makes no buffer. Without the `size < 0` test in
// `tryTake` it would make a buffer, and `new Array` of a negative length
// panics.
import { BufferPool } from "nish/net/buffer-pool";

export const main = (): number => {
  const pool = new BufferPool("Test.pool", -1, 2);
  console.log(`lends none: ${pool.tryTake() === null}`);
  console.log(`lends none again: ${pool.tryTake() === null}`);
  console.log(`made: ${pool.made}`);
  return 0;
};
