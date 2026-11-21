import { run } from "./m";

// The task arrow in m.ts's private `work` is lifted into a function named
// after it, so it takes the qualifier too: `@m$.work$arrow0` (WP57 S1).
const work = (n: i32): i32 => {
  return n + 1;
};

export const main = (): i32 => {
  return work(run(10));
};
