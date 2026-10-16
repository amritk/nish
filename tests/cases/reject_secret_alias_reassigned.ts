// A `let` given another local's array is a second name for it: `other` still
// reads what `secret(raw)` moved and the wipe zeroed.
import { Secret, secret, wipe } from "nish:secret";
export const main = (): i32 => {
  const other: u8[] = [5];
  let raw: u8[] = [1, 2, 3];
  raw = other;
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(other[0]);
};
