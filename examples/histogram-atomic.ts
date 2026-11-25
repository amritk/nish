// Opt-out (`--allow-panics`), for one kept panic that is not a site of this
// file's. Every `AtomicI32Array` index here is proven at its call, by the
// guard or loop test around it (docs/LANGUAGE.md, "Atomic arrays"; #2206):
// the `load` under `b < bins.length`, the `add` in `binShard`'s loop that
// tests `s.bins.length` too, and the `add` in `binPerValue` under
// `bin < s.bins.length`. And
// `new AtomicI32Array(BINS)`'s `array-length` site (std/threads.ts:826:21) is
// proven by the length's type (#2279). What is left is the constructor's call
// to `negativeAtomicLength` (790:3), a kept contract panic for a negative
// length that `BINS` never is, which a caller's proof cannot discharge
// (`callerProven`, src/attributes.ts): so this file keeps `--allow-panics`.
// smoke: args --allow-panics
//
// A histogram four tasks fill at once (docs/LANGUAGE.md, "Atomic arrays"). The
// bins are one `AtomicI32Array`, 256 atomic counters in one buffer. A task
// counts its own values into a local `u32[]` that no other core touches, then adds each local count to its bin with one `add`, a
// single indivisible read-modify-write: 256 atomic adds per task instead of one
// per value, no lock, and no increment lost to a race.
//
// Adding to a bin commutes, so the bins come out the same whatever order the
// tasks' adds landed in, natively on four threads and under Node, which runs
// each task at its `spawn`. That is the program's obligation, not the
// compiler's: an update that does not commute (a `store`, an `exchange`) would
// leave an answer that depends on the schedule.
//
//   nish --allow-panics examples/histogram-atomic.ts --link build/histogram-atomic
//   ./build/histogram-atomic              four tasks, local counts, one add per bin
//   ./build/histogram-atomic --per-value  four tasks, one atomic add per value
//   ./build/histogram-atomic --lock       four tasks, one Mutex taken per value
//   ./build/histogram-atomic --single     one thread, a plain i32 per bin
//   ./build/histogram-atomic --lock 7     any mode, with its seeds moved by 7
// All four print the same lines for the same seed. Under Node (`using` needs
// `--js-explicit-resource-management` before Node 24):
//   node --js-explicit-resource-management --experimental-strip-types \
//     --import ./runtime/nish.mjs -e 'import("./examples/histogram-atomic.ts").then((m) => m.main())'
import { AtomicI32Array, Mutex, scope } from "nish/threads"

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
  bins: AtomicI32Array

  constructor(seed: i32, n: i32, bins: AtomicI32Array) {
    this.seed = seed
    this.n = n
    this.bins = bins
  }
}

/**
 * Bins a shard by the top eight bits of each value into a local tally, then
 * adds the tally to the shared bins, one atomic add per bin. The values come
 * from Marsaglia's xorshift32, shifts and xors only, so they wrap the same way
 * natively and under Node. A count is a `u32`, whose arithmetic wraps rather
 * than panics: no bin holds more than the 8000000 values of a round, far below
 * its 4294967295.
 */
const binShard = (s: Shard): i32 => {
  const local: u32[] = []
  for (let b: i32 = 0; b < BINS; b++) {
    local.push(toU32(ZERO))
  }
  let x: i32 = s.seed
  for (let i: i32 = 0; i < s.n; i++) {
    x = x ^ (x << 13)
    x = x ^ (x >>> 17)
    x = x ^ (x << 5)
    const bin: i32 = x >>> 24
    if (bin < toI32(local.length)) {
      local[bin] += 1
    }
  }
  // Both lengths are BINS; testing the bins' own proves the `add`'s index.
  for (let b: i32 = 0; b < toI32(local.length) && b < s.bins.length; b++) {
    s.bins.add(b, toI32(local[b]))
  }
  return s.n
}

/** The same values, one atomic increment per value: every task contends for the bins. */
const binPerValue = (s: Shard): i32 => {
  let x: i32 = s.seed
  for (let i: i32 = 0; i < s.n; i++) {
    x = x ^ (x << 13)
    x = x ^ (x >>> 17)
    x = x ^ (x << 5)
    const bin: i32 = x >>> 24
    // Never false: `x >>> 24` is below 256, which is BINS; the test proves the index.
    if (bin < s.bins.length) {
      s.bins.add(bin, ONE)
    }
  }
  return s.n
}

/** The per-value-lock version's tally: every bin behind one lock, `u32` counts as in `binShard`. */
class Hist {
  bins: u32[]

  constructor() {
    this.bins = []
    for (let b: i32 = 0; b < BINS; b++) {
      this.bins.push(toU32(ZERO))
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
    // Never false: `x >>> 24` is below 256, which is BINS; the test is what proves the index.
    if (bin < toI32(g.value.bins.length)) {
      g.value.bins[bin] = g.value.bins[bin] + 1
    }
  }
  return s.n
}

/** The same values, binned on one thread into plain counters. */
const binPlain = (seed: i32, n: i32, bins: u32[]): i32 => {
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

/**
 * One round's bins, read into plain numbers whichever mode filled them. Task
 * `t` is seeded with `high | (first + t)`: `first + t` stays below 64, in the
 * six low bits `high` (the shift moved left by six) leaves clear, so the `|`
 * adds it and cannot overflow.
 */
const round = (mode: string, high: i32, first: u32): u32[] => {
  const out: u32[] = []
  if (mode === "--single") {
    for (let b: i32 = 0; b < BINS; b++) {
      out.push(toU32(ZERO))
    }
    for (let t: u32 = 0; t < toU32(TASKS); t++) {
      binPlain(high | toI32(first + t), PER_TASK, out)
    }
  } else if (mode === "--lock") {
    const hist = new Mutex<Hist>(new Hist())
    const binned: i32[] = [0, 0, 0, 0]
    {
      using s = scope()
      for (let t: i32 = 0; t < toI32(binned.length); t++) {
        const shard = new LockedShard(high | toI32(first + toU32(t)), PER_TASK, hist)
        // The constructor is a call, and a call forgets what the loop's test
        // proved about `binned`'s length: this test states it again at the
        // spawn, which then keeps no slot check (docs/LANGUAGE.md, "Panic sites").
        if (t < toI32(binned.length)) {
          s.spawn(binLocked, shard, binned, t)
        }
      }
    }
    using g = hist.lock()
    for (let b: i32 = 0; b < toI32(g.value.bins.length); b++) {
      out.push(g.value.bins[b])
    }
  } else {
    const bins = new AtomicI32Array(BINS)
    const binned: i32[] = [0, 0, 0, 0]
    const perValue = mode === "--per-value"
    {
      using s = scope()
      for (let t: i32 = 0; t < toI32(binned.length); t++) {
        const shard = new Shard(high | toI32(first + toU32(t)), PER_TASK, bins)
        // Never false, as above: the test states `binned`'s length again at the spawn.
        if (t < toI32(binned.length)) {
          if (perValue) {
            s.spawn(binPerValue, shard, binned, t)
          } else {
            s.spawn(binShard, shard, binned, t)
          }
        }
      }
    }
    for (let b: i32 = 0; b < bins.length; b++) {
      out.push(toU32(bins.load(b)))
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
    if (arg === "--lock" || arg === "--single" || arg === "--per-value") {
      mode = arg
    } else {
      shift = parseInt(arg)
    }
  }
  // `u32` as the bins are: the total is 32000000 and the checksum stays below
  // 1000003 * 32, both far inside 4294967295.
  let total: u32 = 0
  let checksum: u32 = 0
  // Every round seeds its shards afresh and folds its bins into the checksum,
  // so no round repeats another's work and none of it can be skipped.
  for (let r: u32 = 0; r < toU32(ROUNDS); r++) {
    // `shift << 6` is `shift * 64` that wraps as Node's seed did, never panicking.
    const bins = round(mode, shift << 6, r * toU32(TASKS) + 1)
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
