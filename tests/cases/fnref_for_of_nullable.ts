// WP51 stage 2: a `for…of` loop variable over a `(F | null)[]`, over a
// `Map<K, F | null>`'s `values()` and over a `Map<K, F[]>` value reads the
// element place every store into those collections reaches, so each call
// through it dispatches over the functions stored there.
type F = (x: i32) => i32

const sq = (x: i32): i32 => x * x
const inc = (x: i32): i32 => x + 1
const dbl = (x: i32): i32 => x * 2

export const main = (): void => {
  const hs: (F | null)[] = [null]
  hs.push(sq)
  hs.push(inc)
  for (const h of hs) {
    if (h !== null) {
      console.log(`${h(3)}`)
    }
  }
  const m = new Map<string, F | null>()
  m.set("a", dbl)
  m.set("b", null)
  m.set("c", sq)
  for (const h of m.values()) {
    if (h !== null) {
      console.log(`${h(4)}`)
    }
  }
  const rows = new Map<string, F[]>()
  rows.set("x", [inc, dbl])
  for (const fs of rows.values()) {
    for (const f of fs) {
      console.log(`${f(7)}`)
    }
  }
  const row = rows.get("x")
  if (row !== undefined) {
    for (const f of row) {
      console.log(`${f(6)}`)
    }
  }
}
