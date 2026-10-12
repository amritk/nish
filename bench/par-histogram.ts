// Data parallelism (wp29 P3), the histogram: four tasks bin a stream each into
// one guarded `i32[]`, taking the lock once per value, so on a machine with
// four cores or more the lock is fought over on every value. It is the shape
// tests/link/thread_mutex_contended pins, sized to be timed. Each round draws
// new values from seeds the round number moves, and the bins are folded into a
// checksum and emptied after every join, so no round can be computed once.
// `seq` calls the four streams one after another on the main thread, still
// taking the lock, and `par` spawns them on a scope. Adding to a bin commutes,
// so both print the same checksum, and the last number, the bins' total, is
// the count of values binned exactly when no guarded increment was lost.
import { Mutex, scope } from "nish/threads"

class Hist {
  bins: i32[]

  constructor() {
    this.bins = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  }
}

class Job {
  seed: i32
  count: i32
  hist: Mutex<Hist>

  constructor(seed: i32, count: i32, hist: Mutex<Hist>) {
    this.seed = seed
    this.count = count
    this.hist = hist
  }
}

/** `count` values of the ZX81's generator from `seed`, each binned under the lock. */
const binStream = (j: Job): i32 => {
  let v: i32 = j.seed
  for (let i: i32 = 0; i < j.count; i++) {
    v = (v * 75 + 74) % 65537
    const bin: i32 = v & 15
    using g = j.hist.lock()
    g.value.bins[bin] = g.value.bins[bin] + 1
  }
  return j.count
}

export const main = (): i32 => {
  const rounds: i32 = 16 // bench:n
  const tasks: i32 = 4
  const count: i32 = 50000
  const par = process.argv.length > 1 && process.argv[1] === "par"
  const hist = new Mutex<Hist>(new Hist())
  let check: i32 = 0
  let total: i32 = 0
  for (let r: i32 = 0; r < rounds; r++) {
    if (par) {
      const done: i32[] = [0, 0, 0, 0]
      {
        using s = scope()
        for (let t: i32 = 0; t < tasks; t++) {
          s.spawn(binStream, new Job(r * tasks + t + 1, count, hist), done, t)
        }
      }
    } else {
      for (let t: i32 = 0; t < tasks; t++) {
        binStream(new Job(r * tasks + t + 1, count, hist))
      }
    }
    using g = hist.lock()
    for (let b: i32 = 0; b < 16; b++) {
      check = (check * 31 + g.value.bins[b]) % 65521
      total = total + g.value.bins[b]
      g.value.bins[b] = 0
    }
  }
  console.log(`${check} ${total}`)
  return 0
}
