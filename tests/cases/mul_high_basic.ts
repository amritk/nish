// WP41: `mulHigh(a, b)` is the high 64 bits of the 128-bit product of two
// `u64`s. The first lines are the edge pairs (0, 1, 2^32 and 2^64 - 1 among
// them); then 10^6 xorshift64 pairs are each held to the four 32×32 product
// reference below, and folded into one checksum that tests/run.js recomputes
// with BigInt from the same seed, so the answer is pinned twice: by a
// reference in Nish and by exact arithmetic outside it.
// `mul_high_wasm32` checks that the wasm32 lowering prints the same lines.

/** The high half from four 32×32 products, none of which can overflow. */
const reference = (a: u64, b: u64): u64 => {
  const mask: u64 = 4294967295
  const aHi: u64 = a >> toU64(32)
  const aLo: u64 = a & mask
  const bHi: u64 = b >> toU64(32)
  const bLo: u64 = b & mask
  const ll: u64 = aLo * bLo
  const hl: u64 = aHi * bLo
  const lh: u64 = aLo * bHi
  const cross: u64 = (ll >> toU64(32)) + (hl & mask) + lh
  return (hl >> toU64(32)) + (cross >> toU64(32)) + aHi * bHi
}

const show = (a: u64, b: u64): void => {
  console.log(`${a} * ${b} -> ${mulHigh(a, b)}`)
}

export const main = (): i32 => {
  const zero: u64 = toU64(0)
  const one: u64 = toU64(1)
  const k32: u64 = one << toU64(32)
  const top: u64 = one << toU64(63)
  const all: u64 = ~zero
  show(zero, zero)
  show(zero, all)
  show(one, one)
  show(one, all)
  show(k32, k32)
  show(k32 - one, k32 - one)
  show(k32 + one, all)
  show(top, toU64(2))
  show(all, toU64(2))
  show(all, all)

  let x: u64 = (toU64(20529) << toU64(42)) | toU64(1234567)
  let fold: u64 = zero
  let wrong: i32 = 0
  for (let i = 0; i < 1000000; i++) {
    x = x ^ (x << toU64(13))
    x = x ^ (x >> toU64(7))
    x = x ^ (x << toU64(17))
    const a: u64 = x
    x = x ^ (x << toU64(13))
    x = x ^ (x >> toU64(7))
    x = x ^ (x << toU64(17))
    const h: u64 = mulHigh(a, x)
    if (h !== reference(a, x)) {
      wrong++
    }
    fold = ((fold << one) | (fold >> toU64(63))) ^ h
  }
  console.log(`pairs 1000000 wrong ${wrong} fold ${fold}`)
  return 0
}
