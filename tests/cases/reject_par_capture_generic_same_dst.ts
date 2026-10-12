// A captured array that is the destination itself is refused (NL2505) in every
// instantiation of a generic function: `into<i32>` and `into<f64>` each read
// `dst` through the capture, and each instantiation is refused on its own.
import { parallelMapInto } from "nish/threads";

const into = <T>(src: T[], dst: T[]): T => {
  parallelMapInto(src, dst, (x) => x + dst[0]);
  return dst[0];
};

export const main = (): i32 => {
  const a: i32[] = [1, 2];
  const b: i32[] = [0, 0];
  const c: f64[] = [1.5, 2.5];
  const d: f64[] = [0.0, 0.0];
  console.log(`${into(a, b)} ${into(c, d)}`);
  return 0;
};
