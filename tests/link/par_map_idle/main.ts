// A burst of string maps, then a pause. A worker that finds the queue empty
// for a second parks and hands its heap back (`nish_pool_drain`), so during
// the pause the process holds a few megabytes again rather than the burst's
// peak. tests/run.js reads the resident size from `/proc/<pid>/status` two
// seconds after the checksum line.
import { parallelMap } from "nish/threads";

const round = (r: i32, n: i32): i32 => {
  const xs: i32[] = [];
  for (let i = 0; i < n; i++) {
    xs.push(i + r);
  }
  const ys = parallelMap(xs, (x): string => `element-${x}-with-some-padding-${x % 977}`);
  let t = 0;
  for (const y of ys) {
    t = t + y.length;
  }
  return t;
};

export const main = (): i32 => {
  let t = 0;
  for (let r = 0; r < 4; r++) {
    t = t + round(r, 1200000);
  }
  console.log(`${t}`);
  let spins = 0;
  const until = Date.now() + 3500;
  while (Date.now() < until) {
    spins = spins + 1;
  }
  console.log(`${spins > 0}`);
  return 0;
};
