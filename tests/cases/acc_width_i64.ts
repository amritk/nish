// A self-recursive sum over `i64` is emitted as a loop (src/emit-accumulate.ts,
// "Widths"), and its overflow check panics exactly when the recursion would,
// at `i64`'s MAX. `chain(c, i)` answers
// term(c, i) + term(c, i - 1) + ... + term(c, 1) + last(c), added deepest
// first as the recursion unwinds; `after(c, i)` is the same sum written
// `after(c, i - 1) + y`, with the call first and a parameter after it.
//
// With no argument every sum stays in range, some past `i32` and some through
// partial sums past `i64` that no add of the recursion computes, and the
// answers print (acc_width_i64.out). With a case number as the argument that
// case runs first and must panic with "attempt to add with overflow", exit 1
// and print nothing; acc_width_i64.panics lists each:
//   0  the deepest add overflows: MAX + 1
//   1  the deepest add overflows, under an outer add that would bring the
//      whole sum back in range: -1 + (MAX + 1)
//   2  only the outermost add overflows: MAX + (1 + 0)
//   3  MAX + (MAX + (MAX + (-MAX + 0))): the inner adds fit and the
//      outermost overflows, while the loop's sum from the outside in
//      passes MAX at the second step, which it hands to the call
//   4  `after`'s outermost add overflows: (1 + 0) + MAX
//   5  an inner add of `after` overflows, under one more: ((0 + MAX) + 1) + 1

/** `i64`'s MAX, 2^63 - 1: a literal past 2^53 cannot be written exactly. */
const max64 = (): i64 => {
  const half: i64 = toI64(1073741824) * toI64(1073741824) * toI64(4)
  return half - toI64(1) + half
}

/** Step `i` of chain `c`; step 1 is the deepest add, the first to run. */
const term = (c: i32, i: i32): i64 => {
  const max = max64()
  if (c === 0) {
    return i === 1 ? max : toI64(1)
  }
  if (c === 1) {
    return i === 1 ? max : toI64(-1)
  }
  if (c === 2) {
    return i === 2 ? max : toI64(1)
  }
  if (c === 3) {
    return i === 1 ? -max : max
  }
  if (c === 10) {
    return i === 2 ? max : toI64(-1)
  }
  if (c === 11) {
    return i === 1 ? max : toI64(1)
  }
  if (c === 12) {
    return i === 1 ? -max : toI64(-1)
  }
  // Past `i32`: each step is i * 2^32.
  return toI64(i) * toI64(65536) * toI64(65536)
}

/** The base the chain ends on. */
const last = (c: i32): i64 => {
  if (c === 0 || c === 1 || c === 10) {
    return toI64(1)
  }
  if (c === 11) {
    return toI64(-5)
  }
  return toI64(0)
}

const chain = (c: i32, i: i32): i64 => {
  if (i === 0) {
    return last(c)
  }
  return term(c, i) + chain(c, i - 1)
}

/** `y` at every step but the deepest, which adds `deep`; the base is 0. */
const after = (i: i32, y: i64, deep: i64): i64 => {
  if (i === 0) {
    return toI64(0)
  }
  return i === 1 ? after(0, y, deep) + deep : after(i - 1, y, deep) + y
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

/** Panicking case `pick`; it never prints. */
const run = (pick: i32): i64 => {
  if (pick === 4) {
    // (0 + 1) then + MAX: the outermost add.
    return after(2, max64(), toI64(1))
  }
  if (pick === 5) {
    // 0 + MAX, then + 1 overflows before the outermost + 1 runs.
    return after(3, toI64(1), max64())
  }
  return chain(pick, steps(pick))
}

export const main = (): i32 => {
  const pick: i32 = process.argv.length > 1 ? parseInt(process.argv[1]) : -1
  if (pick >= 0) {
    console.log(`${run(pick)}`)
  }
  // In range: MAX + (-1 + 1); 1 + (MAX - 5), whose partial sum 1 + MAX no
  // add computes; -1 + (-MAX + 0), which is MIN; and (1..1000) * 2^32.
  console.log(`${chain(10, 2)} ${chain(11, 2)} ${chain(12, 2)} ${chain(20, 1000)}`)
  // `after`: 2^40 * 1000 + 7, and -MAX then +1 repeatedly.
  const big: i64 = 1099511627776
  console.log(`${after(1001, big, toI64(7))} ${after(4, toI64(1), -max64())}`)
  return 0
}
