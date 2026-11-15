// The one kernel of spike S4, shared by its three programs: the product of an
// array's elements modulo a prime. It is pure, so two calls on two arrays are
// the non-interfering pair a `Promise.all` would join; it is associative, so
// `parallelReduce` can fold the same elements with the same operator; and each
// multiply waits on the last, so its cost is linear in the length and does not
// vectorise away at the small sizes.

/** The modulus: the largest prime whose square fits an `i32`. */
export const P: i32 = 46337

/** `a * b` modulo `P`, for operands in `[0, P)`. */
export const mulmod = (a: i32, b: i32): i32 => (a * b) % P

/** One task: the product of every element of `xs` modulo `P`. */
export const product = (xs: i32[]): i32 => {
  let acc: i32 = 1
  for (let i: i32 = 0; i < toI32(xs.length); i++) {
    acc = mulmod(acc, xs[i])
  }
  return acc
}

/** The element at `index` of the whole input, in `[1, P)` so that no product collapses to zero. */
export const element = (index: i32): i32 => 1 + toI32((toU32(index) * 40503 + 13) & 32767)

/** The element a call stores back into its input, from the checksum so far: in `[1, P)` as every other is. */
export const feedback = (check: i32): i32 => 1 + (check % (P - 1))

/** The checksum after one more call answered `answer`. */
export const fold = (check: i32, answer: i32): i32 => ((check & 16777215) * 17 + answer) & 16777215
