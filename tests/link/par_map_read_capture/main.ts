// The body of `parallelMapInto` reads a captured `Map<string, i32>` while it
// writes an `i32[]` its function was handed: neither is a `const` of its own,
// so only the map's type can show it is not `dst`, and a map's own arrays are
// private to it.
import { parallelMapInto } from "nish/threads";

const fill = (m: Map<string, i32>, xs: i32[], out: i32[]): void => {
  parallelMapInto(xs, out, (x: i32): i32 => (m.get("a") ?? 0) * x + m.size);
};

export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.set("a", 5);
  m.set("b", 7);
  const xs: i32[] = [1, 2, 3, 4];
  const out: i32[] = [0, 0, 0, 0];
  fill(m, xs, out);
  console.log(`${out[0]} ${out[1]} ${out[2]} ${out[3]}`);
  return 0;
};
