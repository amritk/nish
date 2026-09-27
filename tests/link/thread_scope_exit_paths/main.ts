// WP29 P2: a scope joins at every exit of the block that declares it — its
// end, a `return` (before the returned value is computed, so the value can read
// what the tasks stored), and a `break` or `continue` that leaves it — and at
// no exit that stays inside it.
import { scope } from "nish/threads";

const triple = (n: i32): i32 => n * 3;

const firstTriple = (k: i32): i32 => {
  const res: i32[] = [0, 0];
  using s = scope();
  s.spawn(triple, k, res, 0);
  if (k > 1) {
    return res[0];
  }
  s.spawn(triple, k + 1, res, 1);
  return res[0] * 100 + res[1];
};

export const main = (): i32 => {
  const out: i32[] = [0, 0, 0];
  for (let i: i32 = 0; i < 3; i++) {
    using s = scope();
    s.spawn(triple, 10 + i, out, i);
    if (i === 0) {
      continue;
    }
    if (i === 1) {
      break;
    }
  }
  console.log(`${out[0]} ${out[1]} ${out[2]}`);
  const pair: i32[] = [0, 0];
  let n: i32 = 0;
  while (true) {
    using s = scope();
    for (let j: i32 = 0; j < 2; j++) {
      s.spawn(triple, j + n, pair, j);
      if (j === 0) {
        continue; // leaves the loop inside the scope's block, not the block
      }
    }
    n = n + 1;
    if (n === 2) {
      break;
    }
  }
  console.log(`${pair[0]} ${pair[1]}`);
  console.log(`${firstTriple(5)}`);
  console.log(`${firstTriple(0)}`);
  return 0;
};
