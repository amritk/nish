// WP29 P2: two heterogeneous tasks on one scope — a sum over an `f64[]` and a
// count over an `i32` — each on a thread of its own, joined when the block
// ends, and both answers read after it. The scope's tasks run at the join, and
// each answer is stored into its destination by this thread once both are done.
import { scope } from "nish/threads";

const sumOf = (xs: f64[]): f64 => {
  let t: f64 = 0.0;
  for (const x of xs) {
    t = t + x;
  }
  return t;
};

const primesBelow = (n: i32): i32 => {
  let count: i32 = 0;
  for (let k: i32 = 2; k < n; k++) {
    let prime = true;
    for (let d: i32 = 2; d * d <= k; d++) {
      if (k % d === 0) {
        prime = false;
        break;
      }
    }
    if (prime) {
      count = count + 1;
    }
  }
  return count;
};

export const main = (): i32 => {
  const xs: f64[] = [1.5, 2.5, 3.0];
  const sums: f64[] = [0.0];
  const counts: i32[] = [0];
  {
    using s = scope();
    s.spawn(sumOf, xs, sums, 0);
    s.spawn(primesBelow, 1000, counts, 0);
  }
  console.log(`${sums[0]} ${counts[0]}`);
  return 0;
};
