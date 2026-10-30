// WP38 S3: a `nish:simd` vector crosses into a parallel region as a capture.
// The map's arrow reads an `i32x4` out of the region's context on every
// thread, and a spawned task reads one out of its payload; both slots sit in a
// block the arena aligns to eight, so each access states `align 8`
// (expected.ir) rather than the vector's sixteen.
import { parallelMap, scope } from "nish/threads";
import { i32x4, loadI32x4, extract, replace } from "nish:simd";

const lanesSum = (v: i32x4): i32 => extract(v, 0) + extract(v, 1) + extract(v, 2) + extract(v, 3);

export const main = (): i32 => {
  const seed: i32[] = [1, 2, 3, 4];
  const v = loadI32x4(seed, 0);
  const xs: i32[] = [10, 20, 30, 40, 50];
  const ys = parallelMap(xs, (x) => x * extract(v, 1) + extract(v, 3));
  console.log(`${ys[0]} ${ys[1]} ${ys[2]} ${ys[3]} ${ys[4]}`);
  const sums: i32[] = [0];
  {
    using s = scope();
    s.spawn(lanesSum, replace(v, 0, 9), sums, 0);
  }
  console.log(`${sums[0]}`);
  return 0;
};
