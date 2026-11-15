// What a self-recursive sum's loop (src/emit-accumulate.ts) does before its
// first test. `noisy` prints before it tests anything, so the loop tests its
// last step before the print and, when that step cannot stay in the loop,
// makes the recursion's call there: each line prints once and in order.
// `lower` computes a checked `n - 1` first, so the loop's test shares the
// branch that ends that code with the overflow check's. `swing` steps with
// negative and positive `X`, each sign change handing a step to the call.
//
// With "1" as the argument `noisy(3, 1000000000)` prints `at 3` down to
// `at 0` and then panics with "attempt to add with overflow", as its third
// add does in the recursion (tests/run.js runs it).

/** Print where `noisy` is: a call, so its header does more than compute. */
const trace = (n: i32): void => {
  console.log(`at ${n}`)
}

const noisy = (n: i32, x: i32): i32 => {
  trace(n)
  if (n <= 0) {
    return 0
  }
  return x + noisy(n - 1, x)
}

const lower = (n: i32, step: i32): i32 => {
  const m = n - step
  if (m < 0) {
    return n
  }
  return m + lower(m, step)
}

const swing = (n: i32): i32 => {
  if (n === 0) {
    return 1
  }
  return (n % 3 === 0 ? -n : n) + swing(n - 1)
}

export const main = (): i32 => {
  const pick: i32 = process.argv.length > 1 ? parseInt(process.argv[1]) : 0
  if (pick === 1) {
    console.log(`${noisy(3, 1000000000)}`)
  }
  console.log(`${noisy(2, -5)}`)
  console.log(`${lower(10, 3)} ${lower(-2147483646, 2)} ${lower(5, 1)}`)
  console.log(`${swing(10)} ${swing(1000)}`)
  return 0
}
