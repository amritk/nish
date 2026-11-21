// A counted loop's `x + i` tests for overflow once, before the loop
// (src/emit-arrays.ts, `emitAddGuards`): when `x + J` and `x + (B - 1)` both
// fit, every `x + i` of `for (let i = J; i < B; i++)` is `add nsw`; when one
// may not, each addition is checked as before and panics where it runs.
//
// With no argument every loop stays in range and the answers print
// (ovf_loop_guard.out), among them a loop whose last `x + i` would overflow
// but that returns before it runs, and loops whose `x` or bound moves, which
// are not guarded. With a case number as the argument that case runs first
// and must print each value up to the overflow, then exit 1 with "attempt to
// add with overflow"; tests/run.js runs each:
//   0  i32 `base + i` from MAX - 2: prints MAX - 2 .. MAX, then panics
//   1  i64 `i + base` from the i64 maximum - 1: prints two values, panics
//   2  i32 `base + i` with base = MIN and i from -2: the first add is below
//      MIN, so the guard is the low end and nothing prints
const MAX: i32 = 2147483647
// 2^63 - 1, built from literals 2^53 can hold exactly.
const MAX64: i64 = 9007199254740991 * 1024 + 1023

/** Prints `base + i` for i in [from, to). */
const show = (base: i32, from: i32, to: i32): void => {
  for (let i: i32 = from; i < to; i++) {
    console.log(`${base + i}`)
  }
}

/** Prints `i + base` for i in [from, to), at 64 bits. */
const show64 = (base: i64, from: i64, to: i64): void => {
  for (let i: i64 = from; i < to; i++) {
    console.log(`${i + base}`)
  }
}

/** The xor of `base + i` over [0, to), returning early at the first value equal to `stop`. */
const fold = (base: i32, to: i32, stop: i32): i32 => {
  let total: i32 = 0
  for (let i: i32 = 0; i < to; i++) {
    const v: i32 = base + i
    if (v === stop) {
      return total
    }
    total = total ^ v
  }
  return total
}

/** Whether `s[a + i]` and `s[b + i]` agree for every i below `n`. */
const same = (s: string, a: i32, b: i32, n: i32): boolean => {
  for (let i: i32 = 0; i < n; i++) {
    if (s.charCodeAt(a + i) !== s.charCodeAt(b + i)) {
      return false
    }
  }
  return true
}

/** `x` moves in the loop, so `x + i` is not guarded. */
const moving = (start: i32, n: i32): i32 => {
  let x: i32 = start
  let total: i32 = 0
  for (let i: i32 = 0; i < n; i++) {
    total = total ^ (x + i)
    x = x - 1
  }
  return total
}

/** The bound moves in the loop, so `x + i` is not guarded. */
const shrinking = (x: i32, n: i32): i32 => {
  let to: i32 = n
  let total: i32 = 0
  for (let i: i32 = 0; i < to; i++) {
    total = total ^ (x + i)
    to = to - 1
  }
  return total
}

/** An answer at once. */
const leaf = async (): Promise<i32> => 0

/** A wait that awaits, so a loop that awaits it polls and can suspend there. */
const tick = async (): Promise<i32> => {
  const v: i32 = await leaf()
  return v
}

/**
 * The guard of an async loop holds across its awaits: `tick` can suspend, so
 * the pre-loop flag is spilled to the frame and reloaded after a resume.
 */
const later = async (base: i32, n: i32): Promise<i32> => {
  let total: i32 = 0
  for (let i: i32 = 0; i < n; i++) {
    total = total ^ (base + i)
    await tick()
  }
  return total
}

export const main = async (): Promise<i32> => {
  const pick: i32 = process.argv.length > 1 ? parseInt(process.argv[1]) : -1
  if (pick === 0) {
    show(MAX - 2, 0, 5)
  } else if (pick === 1) {
    show64(MAX64 - 1, 0, 3)
  } else if (pick === 2) {
    show(-MAX - 1, -2, 1)
  }
  show(MAX - 2, 0, 3)
  show64(MAX64 - 1, -1, 2)
  // MAX - 1 + 2 would overflow; the loop returns at MAX first.
  console.log(`${fold(MAX - 2, 4, MAX)} ${fold(10, 1000, -1)} ${fold(-MAX, 5, 0)}`)
  const s = "abcabcabd"
  console.log(`${same(s, 0, 3, 3)} ${same(s, 0, 6, 3)} ${same(s, 2, 2, 0)}`)
  console.log(`${moving(MAX, 3)} ${shrinking(MAX - 3, 8)}`)
  const waited = await later(MAX - 3, 4)
  // A base parsed at run time is not bounded at the call, so this loop's
  // `base + i` takes the guard, across its awaits.
  const parsed: i32 = parseInt("2147483644")
  const guarded = await later(parsed, 4)
  console.log(`${waited} ${guarded}`)
  return 0
}
