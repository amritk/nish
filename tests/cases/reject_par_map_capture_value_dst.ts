// A captured `Map` stores `i32[]` values, and any of them could be the array
// `parallelMapInto` is writing.
import { parallelMapInto } from "nish/threads";

const fill = (m: Map<string, i32[]>, xs: i32[], out: i32[]): void => {
  parallelMapInto(xs, out, (x: i32): i32 => {
    const a = m.get("a");
    return a === undefined ? x : a[0] + x;
  });
};

export const main = (): i32 => {
  const out: i32[] = [0, 0];
  const m = new Map<string, i32[]>();
  m.set("a", out);
  fill(m, [1, 2], out);
  return out[0];
};
