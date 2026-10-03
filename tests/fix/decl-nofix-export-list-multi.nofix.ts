// `export` on `const n = 1, m = 2` would export `m` as well: no fix.
const n: i32 = 1,
  m: i32 = 2
export const main = (): number => n + m - 3
export { n }
