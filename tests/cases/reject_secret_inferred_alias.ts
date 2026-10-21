// #613: an unannotated `const` is judged as an annotated one: `alias` names
// the array `secret(raw)` would move, so the move is refused.
import { secret, wipe } from "nish:secret";
export const main = (): i32 => {
  const raw = [toU8(1), toU8(2), toU8(3)];
  const alias = raw;
  const key = secret(raw);
  wipe(key);
  return toI32(alias[0]);
};
