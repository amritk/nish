// #613: a class payload moved by `secret(c)` is not read again, and NL2445
// names what the plain value is: the `Counter`, not an array.
import { secret, wipe } from "nish:secret";
class Counter {
  hits: i64;
  constructor(hits: i64) {
    this.hits = hits;
  }
}
export const main = (): i32 => {
  const c = new Counter(3);
  const key = secret(c);
  const n: i64 = c.hits;
  wipe(key);
  return toI32(n);
};
