// The same stale reference read by a `parallelMapInto` body.
import { parallelMapInto } from "nish/threads";

interface P {
  v: i32;
}

export const main = (): i32 => {
  const ps: P[] = [{ v: 1 }];
  const first = ps[0];
  ps.push({ v: 2 });
  const out: i32[] = [0, 0];
  parallelMapInto([1, 2], out, (x) => first.v + x);
  return out[0];
};
