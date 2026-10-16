// A rule about a declaration covers every declarator of the statement: a
// second name made by a later one, or before the move in the same statement,
// is a second name all the same.
import { Secret, secret, wipe } from "nish:secret";
const later = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const n = 1, alias = raw;
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(alias[0]) + n;
};
const before = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const alias = raw, key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(alias[0]);
};
export const main = (): i32 => later() + before();
