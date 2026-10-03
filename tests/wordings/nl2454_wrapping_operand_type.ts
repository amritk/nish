// NL2454: the wrapping functions take the signed words i32 and i64 only.
import { wrappingAdd } from "nish:unsafe";

export const main = (): i32 => {
  const a: u32 = toU32(1);
  const b: u32 = wrappingAdd(a, a);
  return toI32(b);
};
