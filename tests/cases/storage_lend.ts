// WP50 stage 3: module storage may be lent to a parameter spelled as a typed
// array. That spelling has no push or pop, so the callee cannot resize the
// storage, and it cannot keep it either: the argument is the static header.
const SCORES = new Int32Array(4)

const sum = (xs: Int32Array): i32 => {
  let total: i32 = 0
  for (let i = 0; i < xs.length; i++) {
    total += xs[i]
  }
  return total
}

const fill = (xs: Int32Array, v: i32): void => {
  for (let i = 0; i < xs.length; i++) {
    xs[i] = v + i
  }
}

export const main = (): void => {
  fill(SCORES, 10)
  SCORES[3] = 1
  console.log(`${sum(SCORES)} ${SCORES[0]}`)
}
