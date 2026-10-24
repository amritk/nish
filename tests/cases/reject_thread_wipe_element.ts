// A task may hand a helper a `string` element of an array it is given — a
// string has no slot to store into (tests/link/thread_bcrypt_batch) — but an
// array element is memory the caller can see: the helper's wipe of `rows[0]`
// is a shared write.
import { wipe } from "nish:secret";
import { scope } from "nish/threads";
const clearInto = (xs: u8[]): void => {
  wipe(xs);
};
const clear = (rows: u8[][]): i32 => {
  clearInto(rows[0]);
  return 0;
};
export const main = (): i32 => {
  const rows: u8[][] = [[toU8(1), toU8(2)]];
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(clear, rows, out, 0);
  }
  return out[0];
};
