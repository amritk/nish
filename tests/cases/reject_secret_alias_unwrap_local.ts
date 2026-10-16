// A local `Result` that holds `raw` hands it back through `orReturn` and
// `expect`: `secret` would take an array the local `raw` still names.
import { Secret, secret, wipe } from "nish:secret";
const viaOrReturn = (): Result<i32, string> => {
  const raw: u8[] = [1, 2, 3];
  const r: Result<u8[], string> = Ok(raw);
  const key: Secret<u8[]> = secret(r.orReturn());
  wipe(key);
  return Ok(toI32(raw[0]));
};
const viaExpect = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const r: Result<u8[], string> = Ok(raw);
  const key: Secret<u8[]> = secret(r.expect("x"));
  wipe(key);
  return toI32(raw[0]);
};
export const main = (): i32 => (viaOrReturn().ok ? viaExpect() : 0);
