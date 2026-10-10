// Several sites in one module. Every fix carries the same import edit, and
// `--fix` makes an edit it has already accepted once rather than dropping the
// fix that repeats it, so one round applies every site with the import. The
// `rewrites` file counts that round and the one that fixes `seed.ts`.
export const step = (xs: i32[], bytes: u8[], k: i32, v: i32): i32 => {
  xs[k] = v
  bytes[k] += 1
  const a = xs[k + 1]
  return a + xs[k - 1]
}
