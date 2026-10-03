// WP35: a `parallelMapInto` body is reached by a direct call from the instance
// that runs it, so the body's capabilities would be its caller's. None can be:
// every builtin that carries one writes memory the runtime shares, and a
// parallel body may write nothing but its result
// (`tests/cases/reject_caps_parallel_clock`). So the body here is pure, the
// instance in `std/threads.ts` reaches nothing, and `main`'s one capability,
// `clock`, comes from outside the region.
import { parallelMapInto } from "nish/threads";

const square = (x: i32): i32 => x * x;

export const main = (): i32 => {
  const src: i32[] = [1, 2, 3, 4];
  const dst: i32[] = [0, 0, 0, 0];
  parallelMapInto(src, dst, square);
  const start = monotonicNanos();
  console.log(dst[3]);
  console.log(monotonicNanos() >= start);
  return 0;
};
