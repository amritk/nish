// Data parallelism (wp29 P3), the histogram with atomic bins: par-histogram's
// four streams, sizes and checksum, each bin an `AtomicI32` and each value one
// `add` on its bin instead of a lock taken around the increment. The four
// tasks still fight over the same sixteen bins on every value, now as a
// contended cache line rather than a contended lock; the local tally that
// avoids the fight is examples/histogram-atomic.ts. Each round draws new
// values from seeds the round number moves, and the bins are folded into a
// checksum and emptied after every join, so no round can be computed once.
// `seq` calls the four streams one after another on the main thread, still
// adding atomically, and `par` spawns them on a scope. Adding to a bin
// commutes, so both print the same checksum, par-histogram's, and the last
// number, the bins' total, is the count of values binned exactly when no add
// was lost.
import { AtomicI32, scope } from "nish/threads"

const ONE: i32 = 1

class Job {
  seed: i32
  count: i32
  bins: AtomicI32[]

  constructor(seed: i32, count: i32, bins: AtomicI32[]) {
    this.seed = seed
    this.count = count
    this.bins = bins
  }
}

/** `count` values of the ZX81's generator from `seed`, each one atomic add on its bin. */
const binStream = (j: Job): i32 => {
  let v: i32 = j.seed
  for (let i: i32 = 0; i < j.count; i++) {
    v = (v * 75 + 74) % 65537
    const bin: i32 = v & 15
    j.bins[bin].add(ONE)
  }
  return j.count
}

export const main = (): i32 => {
  const rounds: i32 = 16 // bench:n
  const tasks: i32 = 4
  const count: i32 = 50000
  const par = process.argv.length > 1 && process.argv[1] === "par"
  const bins: AtomicI32[] = []
  for (let b: i32 = 0; b < 16; b++) {
    bins.push(new AtomicI32(0))
  }
  let check: i32 = 0
  let total: i32 = 0
  for (let r: i32 = 0; r < rounds; r++) {
    if (par) {
      const done: i32[] = [0, 0, 0, 0]
      {
        using s = scope()
        for (let t: i32 = 0; t < tasks; t++) {
          s.spawn(binStream, new Job(r * tasks + t + 1, count, bins), done, t)
        }
      }
    } else {
      for (let t: i32 = 0; t < tasks; t++) {
        binStream(new Job(r * tasks + t + 1, count, bins))
      }
    }
    for (let b = 0; b < bins.length; b++) {
      const n: i32 = bins[b].exchange(0)
      check = (check * 31 + n) % 65521
      total = total + n
    }
  }
  console.log(`${check} ${total}`)
  return 0
}
