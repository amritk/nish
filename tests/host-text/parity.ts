// The formatting parity corpus of tests/run.js's `host-import-text` section
// (WP50 stage 4): every value a template literal formats, the same source built
// native and for wasm32, compared line for line. The values sit in arrays so
// each is formatted by the runtime at run time, never folded by the compiler.
export const corpus = (): string => {
  // The 64-bit extremes and the non-finite values have no literal: built here.
  const half: i64 = 1073741824
  const top: i64 = half * half * 4 - 1 + half * half * 4
  const zero: f64 = 0
  const I32S: i32[] = [0, -1, 7, 2147483647, -2147483647 - 1]
  const I64S: i64[] = [0, -1, top, -top - 1, 1000000000000]
  const U64S: u64[] = [0, 1, toU64(top) * 2 + 1, toU64(top) + 1]
  const F64S: f64[] = [
    0, -0, 1, -1.5, 0.1, 0.5, 100, 1e21, 1e-7, 123456789012345680000, 1e20, 9007199254740993,
    5e-324, 2.2250738585072014e-308, 2.225073858507201e-308, 1.7976931348623157e308, -1.7976931348623157e308,
    zero / zero, 1 / zero, -1 / zero,
  ]
  const out: string[] = []
  for (const x of I32S) {
    out.push(`i32 ${x}`)
  }
  for (const x of I64S) {
    out.push(`i64 ${x}`)
  }
  for (const x of U64S) {
    out.push(`u64 ${x}`)
  }
  for (const x of F64S) {
    out.push(`f64 ${x}`)
  }
  out.push(`f64 ${0.1 + F64S[4] + F64S[4]} ${F64S[4] * 3} ${F64S[13] / 2}`)
  return out.join("\n")
}
