// #461: the unsigned guard is credited only where its compare says the index
// is below the length. Each access here keeps its check: the golden has a
// `nish_panic_index` call in every function.
//
// A `u64` is narrowed by `toU32`, which keeps its low 32 bits: 2^32 + 1 passes
// the guard and is no index into `xs`.
export const wide = (xs: i32[], i: u64): i32 => (toU32(i) < toU32(xs.length) ? xs[i] : -1)

// `toI32` reads a `u32` above `2^31 - 1` as a negative number, which is below
// any length.
export const signed = (xs: i32[], i: u32): i32 => (toI32(i) < xs.length ? xs[i] : -1)

// `<=` lets the index equal the length.
export const atMost = (xs: i32[], i: u32): i32 => (i <= toU32(xs.length) ? xs[i] : -1)

// A `u32` copy of the length is not a length: `toU32(xs.length) - toU32(1)`
// wraps to 4294967295 on an empty array, so no fact is stated about it.
export const last = (xs: i32[], i: u32): i32 => {
  const top: u32 = toU32(xs.length) - toU32(1)
  return i <= top ? xs[i] : -1
}

// The guard is about `xs`; `ys` may be shorter.
export const other = (xs: i32[], ys: i32[], i: u32): i32 => (i < toU32(xs.length) ? ys[i] : -1)
