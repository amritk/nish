// --deny-panics accepts `wrappingAdd`, `wrappingSub` and `wrappingMul` from
// `nish:unsafe`: they are defined to wrap, are never checked, and are not
// sites, so arithmetic no proof bounds is accepted when it says it wraps.
import { wrappingAdd, wrappingMul, wrappingSub } from "nish:unsafe";

const mix = (a: i32, b: i32): i32 => wrappingAdd(wrappingMul(a, 31), wrappingSub(b, 7));

export const main = (): number => {
  console.log(mix(2147483647, process.argv.length));
  return 0;
};
