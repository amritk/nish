// Data parallelism (wp29 P1), the compute kernel: every element is 64 rounds of
// a square root, with nothing shared and nothing allocated, so the map is
// limited by the cores alone. `par_compute seq` runs the loop a program would
// write without `nish/threads`, `par_compute par` runs `parallelMapInto` over
// the same arrays, and both print the same checksum: the sum of the results,
// added up in index order on one thread.
import { parallelMapInto } from "nish/threads";

const settle = (x: f64): f64 => {
  let v = x;
  for (let k: i32 = 0; k < 64; k++) {
    v = Math.sqrt(v * v + 1.0) - 0.5 * v;
  }
  return v;
};

export const main = (): i32 => {
  const n: i32 = 2097152; // bench:n
  const par = process.argv.length > 1 && process.argv[1] === "par";
  const src = new Array<f64>(n);
  const dst = new Array<f64>(n);
  let x: f64 = 0.0;
  for (let i: i32 = 0; i < toI32(src.length); i++) {
    src[i] = x;
    x = x + 0.000001;
  }
  if (par) {
    parallelMapInto(src, dst, settle);
  } else {
    for (let i: i32 = 0; i < toI32(src.length); i++) {
      const y = settle(src[i]);
      if (i < toI32(dst.length)) {
        dst[i] = y;
      }
    }
  }
  let sum: f64 = 0.0;
  for (let i: i32 = 0; i < toI32(dst.length); i++) {
    sum = sum + dst[i];
  }
  console.log(`${sum}`);
  return 0;
};
