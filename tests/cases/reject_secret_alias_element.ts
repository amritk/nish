// An element that holds the array — in a literal, stored by index, or pushed —
// is a second reference `secret(raw)` cannot move.
import { Secret, secret, wipe } from "nish:secret";
const literal = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const rows: u8[][] = [raw];
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(rows[0][0]);
};
const stored = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const rows: u8[][] = [[0]];
  rows[0] = raw;
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(rows[0][0]);
};
const pushed = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const rows: u8[][] = [];
  rows.push(raw);
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(rows[0][0]);
};
export const main = (): i32 => literal() + stored() + pushed();
