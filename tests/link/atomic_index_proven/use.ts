// Every atomic element call here is an `index` site the caller proves, in a
// module `noPanic` lists (`package.json`), so the package builds: by the
// guard in `bump`, by the loop's `i < a.length` in `fill`, and through a
// field in `Counts`.
import { AtomicI32Array, AtomicI64Array } from "nish/threads"

const TWO: i64 = 2

/** Counters reached through a field, as a task's shared state is. */
export class Counts {
  bins: AtomicI64Array

  constructor(bins: AtomicI64Array) {
    this.bins = bins
  }

  /** Adds two to every counter, under the loop's test of the field's length. */
  addTwo(): void {
    for (let i: i32 = 0; i < this.bins.length; i++) {
      this.bins.add(i, TWO)
    }
  }

  /** Every counter, in order, read through the field. */
  show(): void {
    for (let i: i32 = 0; i < this.bins.length; i++) {
      console.log(this.bins.load(i))
    }
  }
}

/** Each element method under one guard; `-1` where the guard fails. */
export const bump = (a: AtomicI32Array, i: i32): i32 => {
  if (i >= 0 && i < a.length) {
    a.store(i, 3)
    a.sub(i, 1)
    a.min(i, 9)
    a.max(i, 0)
    a.exchange(i, a.load(i))
    return a.compareExchange(i, 1, 5)
  }
  return -1
}

/** Adds each index to its own element, under the loop's test. */
export const fill = (a: AtomicI32Array): void => {
  for (let i: i32 = 0; i < a.length; i++) {
    a.add(i, i)
  }
}

/** Every element, in order. */
export const show = (a: AtomicI32Array): void => {
  for (let i: i32 = 0; i < a.length; i++) {
    console.log(a.load(i))
  }
}
