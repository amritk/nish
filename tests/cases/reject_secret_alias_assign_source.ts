// An assignment given to a local as its value leaves the array with both names:
// `raw = (alias = [1, 2, 3])` makes `alias` a second name for what `raw` holds.
import { Secret, secret, wipe } from "nish:secret";
export const main = (): i32 => {
  let raw: u8[] = [0];
  let alias: u8[] = [9];
  raw = (alias = [1, 2, 3]);
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(alias[0]);
};
