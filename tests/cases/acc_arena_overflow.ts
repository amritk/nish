// The overflow check of a self-recursive sum whose frames allocate, emitted
// as a loop that releases the arena per step (src/emit-accumulate.ts): it
// panics exactly when the recursion would. `chain(c, i)` adds the length of
// `${i}` plus a bump on one step, deepest first as the recursion unwinds.
//
// With no argument every chain stays in range and the answers print
// (acc_arena_overflow.out). With a case number as the argument that case runs
// first and must panic with "attempt to add with overflow"; tests/run.js
// runs each against the program built with --no-elision:
//   0  the deepest add overflows: (MAX - 1 + 1) + 1
//   1  only the outermost add overflows: MAX + (1 + 0)
const MAX: i32 = 2147483647

/** The bump step `i` of chain `c` adds to its length. */
const bump = (c: i32, i: i32): i32 => {
  if (c === 0) {
    return i === 1 ? MAX - 1 : 0
  }
  if (c === 1) {
    return i === 2 ? MAX - 1 : 0
  }
  if (c === 2) {
    return i === 1 ? MAX - 3 : 0
  }
  return 0
}

const chain = (c: i32, i: i32): i32 => {
  if (i === 0) {
    return c === 0 ? 1 : 0
  }
  const s = `${i}`
  const t = s.length + bump(c, i)
  return t + chain(c, i - 1)
}

export const main = (): i32 => {
  const pick: i32 = process.argv.length > 1 ? parseInt(process.argv[1]) : -1
  if (pick >= 0) {
    console.log(`${chain(pick, 2)}`)
  }
  // In range: (MAX - 3 + 1) + 1 + 0, which is MAX - 1; and the lengths of 1..1000.
  console.log(`${chain(2, 2)} ${chain(3, 1000)}`)
  return 0
}
