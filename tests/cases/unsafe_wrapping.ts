// `wrappingAdd`, `wrappingSub` and `wrappingMul` from `nish:unsafe`
// (docs/LANGUAGE.md, "nish:unsafe"): `add`, `sub` and `mul` with no `nsw`
// whatever `--wrapping` says, so each answer at INT_MAX and INT_MIN is the
// two's-complement wrap, at `i32` and at `i64`. `WRAPPED` is a module constant
// folded the same way, where `2147483647 + 1` would be refused. The operands
// are parameters of exported functions, so nothing here is folded but the
// constant.
import { wrappingAdd, wrappingMul, wrappingSub } from "nish:unsafe";

const WRAPPED: i32 = wrappingAdd(2147483647, 1);

export const addI32 = (a: i32, b: i32): i32 => wrappingAdd(a, b);

export const subI32 = (a: i32, b: i32): i32 => wrappingSub(a, b);

export const mulI32 = (a: i32, b: i32): i32 => wrappingMul(a, b);

export const addI64 = (a: i64, b: i64): i64 => wrappingAdd(a, b);

export const subI64 = (a: i64, b: i64): i64 => wrappingSub(a, b);

export const mulI64 = (a: i64, b: i64): i64 => wrappingMul(a, b);

export const main = (): number => {
  const max: i32 = 2147483647;
  const min: i32 = subI32(0, max) - 1;
  console.log(addI32(max, 1));
  console.log(subI32(min, 1));
  console.log(mulI32(max, 2));
  console.log(mulI32(65536, 65536));
  console.log(WRAPPED);
  // INT64_MAX and INT64_MIN, built from 2^62 so that no step overflows.
  const quarter: i64 = toI64(1) << toI64(62);
  const max64: i64 = addI64(subI64(quarter, toI64(1)), quarter);
  const min64: i64 = subI64(subI64(toI64(0), max64), toI64(1));
  console.log(max64);
  console.log(addI64(max64, toI64(1)));
  console.log(subI64(min64, toI64(1)));
  console.log(mulI64(max64, toI64(2)));
  console.log(mulI64(quarter, toI64(4)));
  return 0;
};
