// Four different questions about one series, asked at once (docs/wp29-thread-surface.md
// §4.2): a scope from `nish/threads` runs each `spawn` on a thread of its own when
// the block that declares it ends, and stores each answer in its slot of `answers`
// once all four have finished. The tasks are heterogeneous — a prime count, a
// Collatz search, a digit sum and a checksum — which is the shape `parallelMapInto`
// cannot take.
//   nish examples/tasks.ts --link build/tasks && ./build/tasks
//   ./build/tasks --sequential     the same four calls, one after another
// Under Node the same file runs each task at its `spawn`, one at a time, and prints
// the same lines (`using` needs `--js-explicit-resource-management` before Node 24):
//   node --js-explicit-resource-management --experimental-strip-types \
//     --import ./runtime/nish.mjs -e 'import("./examples/tasks.ts").then((m) => m.main())'
import { scope } from "nish/threads"

/** How many of `[2, n)` are prime, by trial division. */
const primesBelow = (n: i32): i32 => {
  let count: i32 = 0
  for (let k: i32 = 2; k < n; k++) {
    let prime = true
    for (let d: i32 = 2; d * d <= k; d++) {
      if (k % d === 0) {
        prime = false
        break
      }
    }
    if (prime) {
      count = count + 1
    }
  }
  return count
}

/**
 * The longest Collatz trajectory that starts below `n`, in steps. The walk is
 * in `f64`, which holds every value it reaches exactly, so it means the same
 * in either number mode and under Node.
 */
const longestCollatz = (n: i32): i32 => {
  let best: i32 = 0
  for (let start: i32 = 1; start < n; start++) {
    let x: f64 = toF64(start)
    let steps: i32 = 0
    while (x !== 1.0) {
      x = x % 2.0 === 0.0 ? x / 2.0 : x * 3.0 + 1.0
      steps = steps + 1
    }
    if (steps > best) {
      best = steps
    }
  }
  return best
}

/** The sum of the decimal digits of every number below `n`, modulo 1,000,003. */
const digitSum = (n: i32): i32 => {
  let total: i32 = 0
  for (let k: i32 = 1; k < n; k++) {
    let rest: i32 = k
    while (rest > 0) {
      const digit: i32 = rest % 10
      total = (total + digit) % 1000003
      rest = (rest - digit) / 10
    }
  }
  return total
}

/** A multiplicative checksum of `[0, n)`, kept below 1,000,003. */
const checksum = (n: i32): i32 => {
  let acc: i32 = 1
  for (let i: i32 = 0; i < n; i++) {
    acc = (acc * 31 + i) % 1000003
  }
  return acc
}

// Sized so each task takes about the same time on one core, which is what lets
// four of them divide by four.
const PRIMES: i32 = 3000000
const COLLATZ: i32 = 400000
const DIGITS: i32 = 18000000
const CHECKSUM: i32 = 120000000

export const main = (): i32 => {
  const answers: i32[] = [0, 0, 0, 0]
  const args = process.argv
  if (args.length > 1 && args[1] === "--sequential") {
    answers[0] = primesBelow(PRIMES)
    answers[1] = longestCollatz(COLLATZ)
    answers[2] = digitSum(DIGITS)
    answers[3] = checksum(CHECKSUM)
  } else {
    using s = scope()
    s.spawn(primesBelow, PRIMES, answers, 0)
    s.spawn(longestCollatz, COLLATZ, answers, 1)
    s.spawn(digitSum, DIGITS, answers, 2)
    s.spawn(checksum, CHECKSUM, answers, 3)
  }
  console.log(`primes below ${PRIMES}: ${answers[0]}`)
  console.log(`longest Collatz trajectory below ${COLLATZ}: ${answers[1]} steps`)
  console.log(`digit sum below ${DIGITS}, modulo 1000003: ${answers[2]}`)
  console.log(`checksum of ${CHECKSUM}: ${answers[3]}`)
  return 0
}
