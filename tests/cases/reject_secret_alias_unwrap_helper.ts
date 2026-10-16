// A helper that wraps its parameter answers a `Result` whose payload is the
// caller's array, so `orReturn` and `expect` hand `secret` an array `raw` still
// names.
import { Secret, secret, wipe } from "nish:secret";
const wrap = (p: u8[]): Result<u8[], string> => Ok(p);
const viaOrReturn = (): Result<i32, string> => {
  const raw: u8[] = [1, 2, 3];
  const key: Secret<u8[]> = secret(wrap(raw).orReturn());
  wipe(key);
  return Ok(toI32(raw[0]));
};
const viaExpect = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const key: Secret<u8[]> = secret(wrap(raw).expect("k"));
  wipe(key);
  return toI32(raw[0]);
};
export const main = (): i32 => (viaOrReturn().ok ? viaExpect() : 0);
