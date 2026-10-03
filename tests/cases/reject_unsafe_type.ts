// What the `nish:unsafe` functions take: `wrapping*` two operands of one type,
// `i32` or `i64`; `uncheckedGet` / `uncheckedSet` an array of numbers, an `i32`
// index, and for a store a writable array and a value of its element type.
import { uncheckedGet, uncheckedSet, wrappingAdd, wrappingMul, wrappingSub } from "nish:unsafe";

export const f = (
  xs: i32[],
  names: string[],
  bytes: readonly u8[],
  a: i32,
  b: i64,
  u: u32,
  d: f64
): i32 => {
  const mixed = wrappingAdd(a, b);
  const unsigned = wrappingMul(u, u);
  const double = wrappingSub(d, d);
  const name = uncheckedGet(names, 0);
  const scalar = uncheckedGet(a, 0);
  const at = uncheckedGet(xs, d);
  uncheckedSet(bytes, 0, 1);
  uncheckedSet(xs, 0, b);
  return 0;
};
