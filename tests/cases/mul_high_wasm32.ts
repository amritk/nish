// WP41: `mulHigh` for wasm32 is four 32×32 products in i64, with no i128 and
// so no `__multi3`, and `mulHighIsNative()` is the constant false.
// tests/run.js runs the `--profile wasi` build and reads its stdout.
export const high = (a: u64, b: u64): u64 => mulHigh(a, b)

export const main = (): i32 => {
  const all: u64 = ~toU64(0)
  console.log(`${high(all, all)} ${mulHighIsNative()}`)
  return 0
}
