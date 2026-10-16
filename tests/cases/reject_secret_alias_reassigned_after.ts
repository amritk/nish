// A `let` given another local's array is refused wherever the assignment is,
// even after the move, where `raw` no longer names the key: the rule judges
// every value a local is given. The cost is this refusal, not a missed read.
import { Secret, secret, wipe } from "nish:secret";
export const main = (): i32 => {
  const other: u8[] = [5];
  let raw: u8[] = [1, 2, 3];
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  raw = other;
  return toI32(raw[0]);
};
