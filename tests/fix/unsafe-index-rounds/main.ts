// Several sites in one module. Every fix carries the same import edit, so the
// first round applies one of them and drops the rest as overlapping; the
// second, with the import written, applies all the others. The `rewrites`
// file counts those two rounds and the one that fixes `seed.ts`.
export const step = (xs: i32[], bytes: u8[], k: i32, v: i32): i32 => {
  xs[k] = v
  bytes[k] += 1
  const a = xs[k + 1]
  return a + xs[k - 1]
}
