// The overflow check of a self-recursive sum's loop (src/emit-accumulate.ts)
// panics exactly when the recursion would. `chain(c, i)` answers
// term(c, i) + term(c, i - 1) + ... + term(c, 1) + last(c), added deepest
// first as the recursion unwinds, and is emitted as one loop.
//
// With no argument every chain stays in range, though some pass through sums
// past `i32` that no add of the recursion computes, and the answers print
// (acc_overflow.out). With a case number as the argument that case runs
// first and must panic with "attempt to add with overflow", exit 1 and print
// nothing; tests/run.js runs each:
//   0  (a) the deepest add overflows: MAX + 1
//   1  (b) a middle add overflows though the whole sum fits: -1 + (MAX + 1)
//   2  (c) the outermost add overflows: MAX + (1 + 0)
//   3  (d) MAX + (MAX + (MAX + (-MAX + 0))): the inner adds fit and the
//          outermost overflows, while the loop's sum from the outside in
//          passes MAX at the second step, which it hands to the call
const MAX: i32 = 2147483647

/** Step `i` of chain `c`; step 1 is the deepest add, the first to run. */
const term = (c: i32, i: i32): i32 => {
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
const last = (c: i32): i32 => {
  if (c === 0) {
    return 1
  }
  if (c === 1) {
    return 1
  }
  if (c === 10) {
    return 1
  }
  if (c === 11) {
    return -5
  }
  return 0
}

const chain = (c: i32, i: i32): i32 => {
  if (i === 0) {
    return last(c)
  }
  return term(c, i) + chain(c, i - 1)
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
    console.log(`${chain(pick, steps(pick))}`)
  }
  // In range: MAX + (-1 + 1); 1 + (MAX - 5), whose partial sum 1 + MAX no
  // add computes; -1 + (-MAX + 0), which is MIN; and 1..1000 summed.
  console.log(`${chain(10, 2)} ${chain(11, 2)} ${chain(12, 2)} ${chain(20, 1000)}`)
  return 0
}
