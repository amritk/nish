// A `Result` local copied into another is refused even where only one of the
// two is used again: the rule does not follow which name survives, so a second
// name for the payload is a second reference. The cost is this refusal, not a
// missed read.
import { Secret, secret, wipe } from "nish:secret";
const make = (): Result<u8[], string> => {
  const out: u8[] = [1, 2, 3];
  const r: Result<u8[], string> = Ok(out);
  const alias = r;
  return alias;
};
const use = (): Result<i32, string> => {
  const key: Secret<u8[]> = secret(make().orReturn());
  wipe(key);
  return Ok(0);
};
export const main = (): i32 => (use().ok ? 0 : 1);
