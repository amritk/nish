// --deny-panics refuses `parallelMapInto` when no test proves `dst` at least
// as long as `src`. The callback cannot panic, so the length check is the
// only site the case pins.
import { parallelMapInto } from "nish/threads";

const flip = (x: i32): i32 => x ^ 1;

export const flipAll = (src: i32[], dst: i32[]): void => {
  parallelMapInto(src, dst, flip);
};
