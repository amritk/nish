// WP41: `mulHigh` on the host lowers to an i128 multiply and a shift, and
// `mulHighIsNative()` is the constant true. tests/run.js reads its x86-64
// machine code: one `mul`, no call; and holds it to tests/ct-asm.js with both
// operands secret, as std/crypto/p256.ts uses it.
// ct-check: high secret=a,b
export const high = (a: u64, b: u64): u64 => mulHigh(a, b)

export const main = (): i32 => {
  const all: u64 = ~toU64(0)
  console.log(`${high(all, all)} ${mulHighIsNative()}`)
  return 0
}
