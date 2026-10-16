// An assignment pushed as an element leaves its array in the outer array.
import { Secret, secret, wipe } from "nish:secret";
export const main = (): i32 => {
  let raw: u8[] = [9];
  const rows: u8[][] = [];
  rows.push(raw = [1, 2, 3]);
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(rows[0][0]);
};
