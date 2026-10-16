// A ternary arm is a second name for its local, and `secret` of a ternary moves
// the local in either arm: it is not read again, and a parameter is refused there
// as it is anywhere `secret` is handed one.
import { Secret, secret, wipe } from "nish:secret";
const named = (c: boolean): i32 => {
  const raw: u8[] = [1, 2, 3];
  const other: u8[] = [4];
  const alias = c ? raw : other;
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(alias[0]);
};
const moved = (c: boolean): i32 => {
  const raw: u8[] = [1, 2, 3];
  const other: u8[] = [4];
  const key: Secret<u8[]> = secret(c ? raw : other);
  wipe(key);
  return toI32(raw[0]);
};
const borrowed = (c: boolean, p: u8[]): Secret<u8[]> => secret(c ? p : [toU8(1)]);
export const main = (): i32 => named(true) + moved(true);
