// A `let` that names the array, whether it is declared with it or assigned it
// later, is a second reference `secret(raw)` cannot move.
import { Secret, secret, wipe } from "nish:secret";
const declared = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  let alias: u8[] = raw;
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(alias[0]);
};
const assigned = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  let alias: u8[] = [0];
  alias = raw;
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(alias[0]);
};
export const main = (): i32 => declared() + assigned();
