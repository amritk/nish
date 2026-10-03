// NL2247: a template hole takes only a number, a boolean or a string, so
// `String(c)` of a class instance has no template-literal fix.
class Cell {
  value: i32 = 0
}
export const test = (): number => {
  const c = new Cell()
  const s = String(c)
  return s.length
}
