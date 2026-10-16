// A data-parallel body answers a `string` or an array of numbers, booleans or
// enums. Each worker copies its range's answers out of its arena before it
// returns, and the caller copies them into its own (copy-at-join). `churn()`
// reuses the memory a missed copy would leave the result pointing at.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

const churn = (): i32 => {
  let t = 0;
  for (let i = 0; i < 5000; i++) {
    t = t + `qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq${i}`.length;
  }
  return t;
};

const shout = (x: i32): string => `W${x}` + "!";

export const main = (): i32 => {
  const xs: i32[] = [];
  for (let i = 0; i < 5000; i++) {
    xs.push(i);
  }
  // Concatenation in the body, and a string the body captured: the capture
  // was not born in the worker, so its copy passes it through.
  const prefix = `p${xs.length}-`;
  const named = parallelMap(xs, (x) => prefix + `${x * 3}`);
  const same = parallelMap(xs, (x) => (x % 2 === 0 ? prefix : "odd"));
  // A slice and a substring of a string the body built.
  const cut = parallelMap(xs, (x) => `abcdef${x}`.substring(1, 4) + `${x}xyz`.slice(0, 2));
  const loud = parallelFrom(3000, (i) => shout(i));
  // A scalar array per element: copied whole, element by element.
  const rows = parallelMap(xs, (x): i32[] => [x, x * 2, x * 3]);
  const flags = parallelFrom(10, (i): boolean[] => [i % 2 === 0, i % 3 === 0]);
  // Into a `string[]` that already holds strings: each slot is replaced.
  const into: string[] = [];
  for (let i = 0; i < 5000; i++) {
    into.push("old");
  }
  parallelMapInto(xs, into, (x) => `n${x}`);
  // A reduction folds numbers only; strings reach it through a length.
  const total = parallelReduce(parallelMap(named, (s) => s.length), (a, b) => a + b, 0);
  const c = churn();
  let lens = 0;
  for (const s of named) {
    lens = lens + s.length;
  }
  let odd = 0;
  for (const s of same) {
    if (s === "odd") {
      odd++;
    }
  }
  let rowSum = 0;
  for (const r of rows) {
    rowSum = rowSum + r[0] + r[1] + r[2];
  }
  console.log(`${named[0]} ${named[4999]} ${named.length} ${lens}`);
  console.log(`${same[0]} ${same[1]} ${odd}`);
  console.log(`${cut[0]} ${cut[42]} ${cut[4999]}`);
  console.log(`${loud[0]} ${loud[2999]} ${loud.length}`);
  console.log(`${rows[7][2]} ${rows.length} ${rowSum}`);
  console.log(`${flags[6][0]} ${flags[6][1]} ${flags[7][0]} ${flags.length}`);
  console.log(`${into[0]} ${into[4999]} ${into.length} ${total} ${c}`);
  return 0;
};
