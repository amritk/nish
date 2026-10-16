// A histogram four tasks fill at once, one atomic increment per value
// (docs/LANGUAGE.md, "Atomics"). Each bin is an `AtomicI32`, and a task adds
// to the bin a value falls in with `add(1)`, a single indivisible
// read-modify-write: no lock, no guard, and no increment lost to a race.
//
// Adding to a bin commutes, so the bins come out the same whatever order the
// tasks' increments landed in, natively on four threads and under Node, which
// runs each task at its `spawn`. That is the program's obligation, not the
// compiler's: an update that does not commute (a `store`, an `exchange`) would
// leave an answer that depends on the schedule.
//
//   nish examples/histogram-atomic.ts --link build/histogram-atomic
//   ./build/histogram-atomic              four tasks, an AtomicI32 per bin
//   ./build/histogram-atomic --lock       four tasks, one Mutex taken per value
//   ./build/histogram-atomic --single     one thread, a plain i32 per bin
//   ./build/histogram-atomic --lock 7     any mode, with its seeds moved by 7
// All three print the same lines for the same seed. Under Node (`using` needs
// `--js-explicit-resource-management` before Node 24):
//   node --js-explicit-resource-management --experimental-strip-types \
//     --import ./runtime/nish.mjs -e 'import("./examples/histogram-atomic.ts").then((m) => m.main())'
import { AtomicI32, Mutex, scope } from "nish/threads"

const BINS: i32 = 256
const TASKS: i32 = 4
const ROUNDS: i32 = 4
const PER_TASK: i32 = 2000000
const ZERO: i32 = 0
const ONE: i32 = 1

/** One task's work: `n` values generated from `seed`, binned into `bins`. */
class Shard {
  seed: i32
  n: i32
  bins: AtomicI32[]

  constructor(seed: i32, n: i32, bins: AtomicI32[]) {
    this.seed = seed
    this.n = n
    this.bins = bins
  }
}

/**
 * Bins a shard by the top eight bits of each value, one atomic increment per
 * value. The values come from Marsaglia's xorshift32, shifts and xors only, so
 * they wrap the same way natively and under Node.
 */
const binShard = (s: Shard): i32 => {
  let x: i32 = s.seed
  for (let i: i32 = 0; i < s.n; i++) {
    x = x ^ (x << 13)
    x = x ^ (x >>> 17)
    x = x ^ (x << 5)
    const bin: i32 = x >>> 24
    s.bins[bin].add(ONE)
  }
  return s.n
}

/** The per-value-lock version's tally: every bin behind one lock. */
class Hist {
  bins: i32[]

  constructor() {
    this.bins = []
    for (let b: i32 = 0; b < BINS; b++) {
      this.bins.push(ZERO)
    }
  }
}

class LockedShard {
  seed: i32
  n: i32
  hist: Mutex<Hist>

  constructor(seed: i32, n: i32, hist: Mutex<Hist>) {
    this.seed = seed
    this.n = n
    this.hist = hist
  }
}

/** The same values, binned by taking the lock once per value. */
const binLocked = (s: LockedShard): i32 => {
  let x: i32 = s.seed
  for (let i: i32 = 0; i < s.n; i++) {
    x = x ^ (x << 13)
    x = x ^ (x >>> 17)
    x = x ^ (x << 5)
    const bin: i32 = x >>> 24
    using g = s.hist.lock()
    g.value.bins[bin] = g.value.bins[bin] + 1
  }
  return s.n
}

/** The same values, binned on one thread into plain counters. */
const binPlain = (seed: i32, n: i32, bins: i32[]): i32 => {
  let x: i32 = seed
  for (let i: i32 = 0; i < n; i++) {
    x = x ^ (x << 13)
    x = x ^ (x >>> 17)
    x = x ^ (x << 5)
    const bin: i32 = x >>> 24
    if (bin < toI32(bins.length)) {
      bins[bin] += 1
    }
  }
  return n
}

/** One round's bins, read into plain numbers whichever mode filled them. */
const round = (mode: string, first: i32): i32[] => {
  const out: i32[] = []
  if (mode === "--single") {
    for (let b: i32 = 0; b < BINS; b++) {
      out.push(ZERO)
    }
    for (let t: i32 = 0; t < TASKS; t++) {
      binPlain(first + t, PER_TASK, out)
    }
  } else if (mode === "--lock") {
    const hist = new Mutex<Hist>(new Hist())
    const binned: i32[] = [0, 0, 0, 0]
    {
      using s = scope()
      for (let t: i32 = 0; t < TASKS; t++) {
        s.spawn(binLocked, new LockedShard(first + t, PER_TASK, hist), binned, t)
      }
    }
    using g = hist.lock()
    for (let b: i32 = 0; b < BINS; b++) {
      out.push(g.value.bins[b])
    }
  } else {
    const bins: AtomicI32[] = []
    for (let b: i32 = 0; b < BINS; b++) {
      bins.push(new AtomicI32(0))
    }
    const binned: i32[] = [0, 0, 0, 0]
    {
      using s = scope()
      for (let t: i32 = 0; t < TASKS; t++) {
        s.spawn(binShard, new Shard(first + t, PER_TASK, bins), binned, t)
      }
    }
    for (let b = 0; b < bins.length; b++) {
      out.push(bins[b].load())
    }
  }
  return out
}

export const main = (): i32 => {
  const args = process.argv
  let mode = ""
  let shift: i32 = 0
  for (let i = 1; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--lock" || arg === "--single") {
      mode = arg
    } else {
      shift = parseInt(arg)
    }
  }
  let total: i32 = 0
  let checksum: i32 = 0
  // Every round seeds its shards afresh and folds its bins into the checksum,
  // so no round repeats another's work and none of it can be skipped.
  for (let r: i32 = 0; r < ROUNDS; r++) {
    const bins = round(mode, shift * 64 + r * TASKS + 1)
    for (let b = 0; b < bins.length; b++) {
      total = total + bins[b]
      checksum = (checksum * 31 + bins[b]) % 1000003
    }
  }
  console.log(`${ROUNDS} rounds of ${TASKS} shards of ${PER_TASK} values into ${BINS} bins`)
  console.log(`counted in the bins ${total}`)
  console.log(`checksum of every round's bins: ${checksum}`)
  return 0
}
