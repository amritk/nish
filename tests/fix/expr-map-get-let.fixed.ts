// NL2361: `m.get(k)` may be missing and a `let` cannot hold that, so the fix
// gives it the zero of the value type with `??`: `0` for an integer, `0.0`
// for a float, `""` for a string and `false` for a boolean. An assignment to
// a `let` is the same place and takes the same fix.
export const test = (): number => {
  const counts = new Map<string, i32>()
  const weights = new Map<string, f64>()
  const names = new Map<i32, string>()
  const seen = new Map<string, boolean>()
  counts.set("a", 2)
  let c = counts.get("a") ?? 0
  let w = weights.get("a") ?? 0.0
  let s = names.get(1) ?? ""
  let b = seen.get("a") ?? false
  c = counts.get("b") ?? 0
  console.log(`${c} ${w} ${s} ${b}`)
  return 0
}
