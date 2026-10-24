// A `(P | null)[]` slot holds a reference to the record, not the record
// inline: a push or a store into one writes no copy, through a generic body
// as well, and a generic `new Array<T>(n)` with a nullable T is filled with
// `null`.
import { idx, setIdx, newArray } from "nish/runtime"
import type { i32 } from "nish/runtime"
interface P {
  x: i32;
}

const put = <T>(xs: T[], v: T): void => {
  xs.push(v);
};

const store = <T>(xs: T[], i: i32, v: T): void => {
  setIdx(xs, i, v);
};

// `like` names T for the call, which infers it from the arguments.
const fresh = <T>(like: T[], n: i32): T[] => newArray(n, null);

export const main = (): i32 => {
  const p: P = { x: 1 };
  const ps: (P | null)[] = [];
  ps.push(p);
  const qs: (P | null)[] = [null, null];
  put(qs, p);
  store(qs, 0, p);
  p.x = 2;
  const a = idx(ps, 0);
  const b = idx(qs, 0);
  const c = idx(qs, 2);
  const ns = fresh(qs, 2);
  console.log(`${a === null ? 0 : a.x} ${b === null ? 0 : b.x} ${c === null ? 0 : c.x} ${idx(qs, 1) === null} ${idx(ns, 1) === null} ${ns.length}`);
  return 0;
};
