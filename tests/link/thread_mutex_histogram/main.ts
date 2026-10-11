// WP29 P3: the histogram. Four tasks bin a shard each into one guarded
// `i32[]`, taking the lock once per element, and the parent prints the bins
// after the join. Adding to a bin commutes, so the bins are the same whatever
// order the critical sections ran in: natively, on four threads, and under
// Node, in spawn order. The last line is the bins' sum beside the number of
// elements the tasks binned: equal exactly when no guarded increment was lost.
import { Mutex, scope } from "nish/threads";

class Hist {
  bins: i32[];

  constructor() {
    this.bins = [0, 0, 0, 0, 0, 0, 0, 0];
  }
}

class Shard {
  xs: i32[];
  hist: Mutex<Hist>;

  constructor(xs: i32[], hist: Mutex<Hist>) {
    this.xs = xs;
    this.hist = hist;
  }
}

const binShard = (s: Shard): i32 => {
  for (const x of s.xs) {
    const bin: i32 = x & 7;
    using g = s.hist.lock();
    g.value.bins[bin] = g.value.bins[bin] + 1;
  }
  return toI32(s.xs.length);
};

/** `n` values of the ZX81's generator, `v = (75 * v + 74) mod 65537`, from `seed`. */
const shard = (seed: i32, n: i32): i32[] => {
  const xs: i32[] = [];
  let v: i32 = seed;
  for (let i: i32 = 0; i < n; i++) {
    v = (v * 75 + 74) % 65537;
    xs.push(v);
  }
  return xs;
};

export const main = (): i32 => {
  const hist = new Mutex<Hist>(new Hist());
  const counted: i32[] = [0, 0, 0, 0];
  {
    using s = scope();
    for (let t: i32 = 0; t < 4; t++) {
      s.spawn(binShard, new Shard(shard(t + 1, 50000), hist), counted, t);
    }
  }
  using g = hist.lock();
  const parts: string[] = [];
  let sum: i32 = 0;
  for (let b: i32 = 0; b < 8; b++) {
    parts.push(`${g.value.bins[b]}`);
    sum = sum + g.value.bins[b];
  }
  console.log(parts.join(" "));
  console.log(`${sum} ${counted[0] + counted[1] + counted[2] + counted[3]}`);
  return 0;
};
