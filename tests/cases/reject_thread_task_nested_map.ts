// A task cannot run a data-parallel map: `parallelMapInto` writes its `dst`,
// which is a write another task could see.
import { parallelMapInto, scope } from "nish/threads";

const double = (x: i32): i32 => x * 2;

const mapped = (n: i32): i32 => {
  const src: i32[] = [n, n];
  const dst: i32[] = [0, 0];
  parallelMapInto(src, dst, double);
  return dst[0];
};

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(mapped, 1, out, 0);
  }
  return out[0];
};
