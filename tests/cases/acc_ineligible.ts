// Recursive sums the loop must not take; each compiles as plain recursion
// (no `rec.head` in acc_ineligible.ll).

// The `Y` after the call is a local: the recursion could not change it, but
// only numbers and parameters are taken.
const afterLocal = (n: i32): i32 => {
  if (n <= 0) {
    return 0
  }
  const y = n * 2
  return afterLocal(n - 1) + y
}

// A product, not a sum.
const product = (n: i32): i32 => {
  if (n <= 1) {
    return 1
  }
  return n * product(n - 1)
}

// An `i64` result.
const wide = (n: i32): i64 => {
  if (n <= 0) {
    return toI64(0)
  }
  return toI64(n) + wide(n - 1)
}

// No base: every return is a step.
const noBase = (n: i32): i32 => {
  return n + noBase(n - 1)
}

// A loop in the body.
const looped = (n: i32): i32 => {
  if (n <= 0) {
    return 0
  }
  let t: i32 = 0
  for (let i: i32 = 0; i < n; i++) {
    t = t + i
  }
  return t + looped(n - 1)
}

// A difference, the call on either side.
const lessSelf = (n: i32): i32 => {
  if (n <= 0) {
    return 0
  }
  return lessSelf(n - 1) - n
}

const selfLess = (n: i32): i32 => {
  if (n <= 0) {
    return 0
  }
  return n - selfLess(n - 1)
}

// The `Y` after the call is a call, which could see what the recursion did.
const twice = (n: i32): i32 => n * 2

const callAfter = (n: i32): i32 => {
  if (n <= 0) {
    return 0
  }
  return callAfter(n - 1) + twice(n)
}

// A string in the body: its arena bracket would have to repeat on every
// pass, so the emitter keeps the recursion though the checker took the sum.
const digits = (n: i32): i32 => {
  if (n <= 0) {
    return 0
  }
  const s = `${n}`
  return s.length + digits(n - 1)
}

// A method.
class Counter {
  step: i32
  constructor(step: i32) {
    this.step = step
  }
  total(n: i32): i32 {
    if (n <= 0) {
      return 0
    }
    return this.step + this.total(n - 1)
  }
}

export const main = (): i32 => {
  const c = new Counter(3)
  // `noBase` never ends, so it runs only when an argument asks for it.
  const endless: i32 = process.argv.length > 5 ? noBase(1) : -1
  console.log(`${afterLocal(5)} ${product(5)} ${wide(5)} ${looped(5)} ${c.total(4)} ${endless}`)
  console.log(`${lessSelf(4)} ${selfLess(4)} ${callAfter(4)} ${digits(12)}`)
  return 0
}
