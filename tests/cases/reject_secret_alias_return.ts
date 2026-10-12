// A helper that answers its parameter makes its answer a second name for the
// argument: before the move (`const alias = id(raw)`) and as the value moved
// (`secret(id(raw))`, with `raw` still readable after it).
import { Secret, secret, wipe } from "nish:secret";
const id = (b: u8[]): u8[] => b;
const before = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const alias = id(raw);
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(alias[0]);
};
const moved = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const key: Secret<u8[]> = secret(id(raw));
  wipe(key);
  return toI32(raw[0]);
};
export const main = (): i32 => before() + moved();
