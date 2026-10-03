// `orReturn()` returns early, and leaves what every `return` must not.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
const half = (n: i32): Result<i32, string> => (n % 2 === 0 ? Ok(n / 2) : Err("odd"));
const g = (): Result<i32, string> => {
  const k = secret(bytes());
  const h = half(3).orReturn();
  wipe(k);
  return Ok(h);
};
export const main = (): i32 => 0;
