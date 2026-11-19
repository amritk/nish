// WP41: `mulHigh` for an AArch64 target is the same i128 multiply, and
// `mulHighIsNative()` is true. tests/run.js reads its machine code: one
// `umulh`, no call; and holds it to tests/ct-asm.js with both operands secret.
// ct-check: high secret=a,b
export const high = (a: u64, b: u64): u64 => mulHigh(a, b)

export const main = (): i32 => {
  const all: u64 = ~toU64(0)
  console.log(`${high(all, all)} ${mulHighIsNative()}`)
  return 0
}
