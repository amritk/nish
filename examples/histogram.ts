// A histogram four tasks fill at once through a lock that owns its data
// (docs/wp29-thread-surface.md §4.3). Each task bins a shard of its own into a
// local tally, then takes the shared `Mutex<Hist>` once and adds its tally to
// the bins. The `Hist` is reachable only through the guard `using g =
// m.lock()` binds, so no task can touch the bins without holding the lock, and
// the guard releases it when its block ends.
//
// Taking the lock once per task rather than once per value is the shape to
// copy: four threads contending for the lock on every value would run their
// critical sections one at a time and lose the speedup.
//   nish examples/histogram.ts --link build/histogram && ./build/histogram
//   ./build/histogram --sequential     the same four calls, one after another
// Adding to a bin commutes, so the bins are the same whatever order the tasks
// took the lock in, and Node, which runs each task at its `spawn`, prints the
// same lines (`using` needs `--js-explicit-resource-management` before Node 24):
//   node --js-explicit-resource-management --experimental-strip-types \
//     --import ./runtime/nish.mjs -e 'import("./examples/histogram.ts").then((m) => m.main())'
import { Mutex, scope } from "nish/threads"

/** The shared tally. A field initialiser is a literal, so the array is built in the constructor. */
class Hist {
  bins: i32[]

  constructor() {
    this.bins = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  }
}

/** One task's work: `n` values generated from `seed`, binned into `hist`. */
class Shard {
  seed: i32
  n: i32
  hist: Mutex<Hist>

  constructor(seed: i32, n: i32, hist: Mutex<Hist>) {
    this.seed = seed
    this.n = n
    this.hist = hist
  }
}

/**
 * Bins a shard by the top four bits of each value, then merges the tally under
 * the lock. The values come from Marsaglia's xorshift32, which is shifts and
 * xors only, so it wraps the same way natively and under Node. The answer is
 * how many values the task binned, which the parent checks against the bins.
 */
const binShard = (s: Shard): i32 => {
  const tally: i32[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  let x: i32 = s.seed
  for (let i: i32 = 0; i < s.n; i++) {
    x = x ^ (x << 13)
    x = x ^ (x >>> 17)
    x = x ^ (x << 5)
    const bin: i32 = x >>> 28
    tally[bin] += 1
  }
  using g = s.hist.lock()
  for (let b: i32 = 0; b < toI32(tally.length); b++) {
    g.value.bins[b] = g.value.bins[b] + tally[b]
  }
  return s.n
}

const TASKS: i32 = 4
const ROUNDS: i32 = 8
const PER_TASK: i32 = 25000000

export const main = (): i32 => {
  const args = process.argv
  const sequential = args.length > 1 && args[1] === "--sequential"
  let values: i32 = 0
  let total: i32 = 0
  let checksum: i32 = 0
  // Every round seeds its shards afresh and folds its bins into the checksum,
  // so no round repeats another's work and none of it can be skipped.
  for (let r: i32 = 0; r < ROUNDS; r++) {
    const hist = new Mutex<Hist>(new Hist())
    if (sequential) {
      for (let t: i32 = 0; t < TASKS; t++) {
        values = values + binShard(new Shard(r * TASKS + t + 1, PER_TASK, hist))
      }
    } else {
      const binned: i32[] = [0, 0, 0, 0]
      {
        using s = scope()
        for (let t: i32 = 0; t < TASKS; t++) {
          s.spawn(binShard, new Shard(r * TASKS + t + 1, PER_TASK, hist), binned, t)
        }
      }
      values = values + binned[0] + binned[1] + binned[2] + binned[3]
    }
    using g = hist.lock()
    for (let b: i32 = 0; b < 16; b++) {
      total = total + g.value.bins[b]
      checksum = (checksum * 31 + g.value.bins[b]) % 1000003
    }
  }
  console.log(`${ROUNDS} rounds of ${TASKS} shards of ${PER_TASK} values`)
  console.log(`binned ${values}, counted in the bins ${total}`)
  console.log(`checksum of every round's bins: ${checksum}`)
  return 0
}
