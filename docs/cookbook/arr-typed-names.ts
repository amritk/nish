// `t.push(v)` on the `Float64Array` itself is NL2415. The value is still an
// `f64[]`, so a parameter spelled `f64[]` grows it with the `f64[]` lowering.
const append = (xs: f64[], v: f64): void => {
  xs.push(v)
}

export const main = (): number => {
  const t = new Float64Array(2)
  append(t, 1.5)
  return t.length
}
