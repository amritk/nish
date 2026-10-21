// #613: an interface payload moved by `secret(raw)` is not read again, and NL2445
// names it by its interface, as it does a class: the `Pair`, not an array.
import { secret, wipe } from "nish:secret";
interface Pair {
  lo: i32;
  hi: i32;
}
export const main = (): i32 => {
  const raw: Pair = { lo: 1, hi: 2 };
  const k = secret(raw);
  const leaked = raw.lo;
  wipe(k);
  return leaked;
};
