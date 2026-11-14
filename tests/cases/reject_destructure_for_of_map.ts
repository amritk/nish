// A `Map`'s entries are `[key, value]` pairs of two types, which Nish has no
// type for, so a destructuring head over a `Map` is refused.
export const main = (): void => {
  const m = new Map<string, number>()
  m.set("a", 1)
  for (const [k, v] of m) {
    console.log(`${k} ${v}`)
  }
}
