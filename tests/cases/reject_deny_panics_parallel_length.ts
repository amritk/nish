// --deny-panics refuses `parallelMapInto`, whose length check no proof
// removes yet.
import { parallelMapInto } from "nish/threads";

const double = (x: i32): i32 => x * 2;

export const doubleAll = (src: i32[], dst: i32[]): void => {
  parallelMapInto(src, dst, double);
};
