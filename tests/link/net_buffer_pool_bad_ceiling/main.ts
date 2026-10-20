// A take past the ceiling panics naming the pool: with both of its two
// buffers lent, a third take means one was never given back.
import { BufferPool } from "nish/net/buffer-pool";

export const main = (): number => {
  const pool = new BufferPool("Test.pool", 16, 2);
  const a: u8[] = pool.take();
  const b: u8[] = pool.take();
  console.log(`took ${pool.lent()}`);
  const c: u8[] = pool.take();
  console.log(`unreachable ${a.length + b.length + c.length}`);
  return 0;
};
