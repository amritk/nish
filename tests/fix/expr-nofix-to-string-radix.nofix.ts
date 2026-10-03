// NL2249: `n.toString(16)` prints in another base, which a template literal
// cannot ask for, so there is no fix.
export const test = (): number => {
  const n: i32 = 255
  const s = n.toString(16)
  return s.length
}
