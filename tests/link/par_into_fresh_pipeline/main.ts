// #612: a fresh `const` destination that nothing was handed before the call
// is apart from every capture, so a body may read an array an earlier stage
// answered beside it — here a `parallelMap`'s result, which is no `const`
// array of its own and no parameter. Uses of `d` after the call (a helper, an
// alias) come too late to reach the body; one inside a loop around the call
// whose pass declares its own `d` reaches only that pass's array.
import { parallelMap, parallelMapInto } from "nish/threads";

const total = (xs: i32[]): i32 => {
  let s: i32 = 0;
  for (const x of xs) {
    s = s + x;
  }
  return s;
};

export const main = (): i32 => {
  const n: i32 = 8;
  const src: i32[] = [3, 14, 15, 92, 65, 35, 89, 79];
  const weights = parallelMap(src, (x) => x % 13);
  const d = new Array<i32>(n);
  parallelMapInto(src, d, (x) => weights[(x + 1) % n] + 1);
  const kept = d;
  console.log(`${d[0]} ${d[7]} ${total(kept)}`);
  const rows: i32[][] = [];
  for (let round: i32 = 0; round < 2; round = round + 1) {
    const scale = round + 1;
    const e: i32[] = [0, 0, 0, 0, 0, 0, 0, 0];
    parallelMapInto(src, e, (x) => weights[x % n] * scale);
    rows.push(e);
  }
  console.log(`${rows[0][2]} ${rows[1][2]} ${total(rows[1])}`);
  return 0;
};
