// The strings and records rows' helpers where the module binds their names
// itself: a function `slice`, a local `idx` and a constant `__nish_idx` (the
// alias the first try would take) keep theirs, and `s.slice` and the checked
// index call the runtime's by an alias numbered past every name the module
// spells.
const slice = (n: i32): i32 => n + 1

const __nish_idx: i32 = 3

export const main = (): number => {
  const xs: i32[] = [10, 20, 30]
  const idx = "hello".slice(1, 3)
  const i = xs.length - slice(0)
  console.log(`${idx} ${xs[i]} ${__nish_idx}`)
  return 0
}
