// A lock under contention: eight tasks bin a stream each into one guarded
// `i32[]`, taking the lock once per value, so on four cores the lock is fought
// over on every value and most takes go through the runtime's wait. Each round
// draws new values from seeds the round number moves, and the bins are folded
// into a checksum and emptied after every join, so no round can be computed
// once. Adding to a bin commutes, so the checksum is the same whatever order
// the critical sections ran in, and the last line, the bins' total beside the
// number of values binned, is equal exactly when no guarded increment was lost.
// `process.argv[1]` sets the rounds: 4 here, more when it is timed
// (docs/wp29-thread-surface.md §8f).
import { Mutex, scope } from "nish/threads";

class Hist {
  bins: i32[];

  constructor() {
    this.bins = [0, 0, 0, 0, 0, 0, 0, 0];
  }
}

class Job {
  seed: i32;
  count: i32;
  hist: Mutex<Hist>;

  constructor(seed: i32, count: i32, hist: Mutex<Hist>) {
    this.seed = seed;
    this.count = count;
    this.hist = hist;
  }
}

/** `count` values of the ZX81's generator from `seed`, each binned under the lock. */
const binStream = (j: Job): i32 => {
  let v: i32 = j.seed;
  for (let i: i32 = 0; i < j.count; i++) {
    v = (v * 75 + 74) % 65537;
    const bin: i32 = v & 7;
    using g = j.hist.lock();
    g.value.bins[bin] = g.value.bins[bin] + 1;
  }
  return j.count;
};

export const main = (): i32 => {
  const rounds: i32 = process.argv.length > 1 ? parseInt(process.argv[1]) : 4;
  const tasks: i32 = 8;
  const count: i32 = 20000;
  const hist = new Mutex<Hist>(new Hist());
  const done: i32[] = [0, 0, 0, 0, 0, 0, 0, 0];
  let check: i32 = 0;
  let total: i32 = 0;
  let binned: i32 = 0;
  for (let r: i32 = 0; r < rounds; r++) {
    {
      using s = scope();
      for (let t: i32 = 0; t < tasks; t++) {
        s.spawn(binStream, new Job(r * tasks + t + 1, count, hist), done, t);
      }
    }
    using g = hist.lock();
    for (let b: i32 = 0; b < 8; b++) {
      check = (check * 31 + g.value.bins[b]) % 1000003;
      total = total + g.value.bins[b];
      g.value.bins[b] = 0;
    }
    for (let t: i32 = 0; t < tasks; t++) {
      binned = binned + done[t];
    }
  }
  console.log(`${check}`);
  console.log(`${total} ${binned}`);
  return 0;
};
