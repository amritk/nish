// NL2362: `m.get(k)` may be missing and cannot be passed as an argument, so
// the fix gives it the zero of the value type with `??`.
const twice = (n: i32): i32 => n * 2
export const test = (): number => {
  const counts = new Map<string, i32>()
  counts.set("a", 4)
  return twice(counts.get("a"))
}
