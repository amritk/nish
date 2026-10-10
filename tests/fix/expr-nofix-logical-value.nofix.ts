// NL2099: `n && ok` held as a value has no fix. Under `tsc` it is `0` when
// `n` is, not `false`, so `n !== 0 && ok` would change what is held.
export const test = (n: i32, ok: boolean): number => {
  const both = n && ok
  return both ? 1 : 0
}
