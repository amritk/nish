// A vector is a value with no null, as a number is, so `i32x4 | null` is
// refused where the type is spelled.
import { i32x4 } from "nish:simd";

export const k = (a: i32x4 | null): i32 => 0;
