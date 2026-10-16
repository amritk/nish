// Mutual recursion carries the parameter round: `f` answers `g`'s answer, and
// `g` answers its parameter, so `f(2, raw)` may answer `raw` itself.
import { Secret, secret, wipe } from "nish:secret";
const f = (n: i32, b: u8[]): u8[] => (n > 0 ? g(n - 1, b) : [toU8(1)]);
const g = (n: i32, b: u8[]): u8[] => (n > 5 ? b : f(n, b));
export const main = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const key: Secret<u8[]> = secret(f(2, raw));
  wipe(key);
  return toI32(raw[0]);
};
