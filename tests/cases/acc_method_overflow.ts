// acc_overflow's chains as a method (issue #1612): the loop that carries
// the receiver panics exactly when the recursion would. `c.chain(i)`
// answers term(i) + term(i - 1) + ... + term(1) + last(), added deepest
// first as the recursion unwinds.
//
// With no argument every chain stays in range and the answers print
// (acc_method_overflow.out). With a case number as the argument that case
// runs first and must panic with "attempt to add with overflow", exit 1
// and print nothing; acc_method_overflow.panics lists the runs:
//   0  the deepest add overflows: MAX + 1
//   1  the deepest add overflows, under an outer add that would bring the
//      whole sum back in range: -1 + (MAX + 1)
//   2  only the outermost add overflows: MAX + (1 + 0)
//   3  MAX + (MAX + (MAX + (-MAX + 0))): the inner adds fit and the
//      outermost overflows, while the loop's sum from the outside in
//      passes MAX at the second step, which it hands to the call
const MAX: i32 = 2147483647

class Chain {
  c: i32
  constructor(c: i32) {
    this.c = c
  }

  /** Step `i`; step 1 is the deepest add, the first to run. */
  term(i: i32): i32 {
    const c = this.c
    if (c === 0) {
      return i === 1 ? MAX : 1
    }
    if (c === 1) {
      return i === 1 ? MAX : -1
    }
    if (c === 2) {
      return i === 2 ? MAX : 1
    }
    if (c === 3) {
      return i === 1 ? -MAX : MAX
    }
    if (c === 10) {
      return i === 2 ? MAX : -1
    }
    if (c === 11) {
      return i === 1 ? MAX : 1
    }
    if (c === 12) {
      return i === 1 ? -MAX : -1
    }
    return i
  }

  /** The base the chain ends on. */
  last(): i32 {
    const c = this.c
    if (c === 0 || c === 1 || c === 10) {
      return 1
    }
    if (c === 11) {
      return -5
    }
    return 0
  }

  chain(i: i32): i32 {
    if (i === 0) {
      return this.last()
    }
    return this.term(i) + this.chain(i - 1)
  }
}

/** The number of steps of chain `c`. */
const steps = (c: i32): i32 => {
  if (c === 0) {
    return 1
  }
  if (c === 3) {
    return 4
  }
  return 2
}

export const main = (): i32 => {
  const pick: i32 = process.argv.length > 1 ? parseInt(process.argv[1]) : -1
  if (pick >= 0) {
    console.log(`${new Chain(pick).chain(steps(pick))}`)
  }
  const a = new Chain(10).chain(2)
  const b = new Chain(11).chain(2)
  const d = new Chain(12).chain(2)
  const e = new Chain(20).chain(1000)
  console.log(`${a} ${b} ${d} ${e}`)
  return 0
}
