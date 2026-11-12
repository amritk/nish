// WP51 stage 2, §2.3 store row `m.set(k, e)`: `u3` reaches the map's values
// only through `set`, and `get` reads them, so the call through `get`'s
// result dispatches over {u1, u3}; `u2`, called through a local of its own,
// stays out of it.
type F = (x: i32) => i32

const u1 = (x: i32): i32 => x + 1
const u2 = (x: i32): i32 => x * 2
const u3 = (x: i32): i32 => x + 3

export const main = (): void => {
  const other: F = u2
  const m = new Map<i32, F>()
  m.set(0, u1)
  m.set(1, u3)
  const h = m.get(1)
  if (h !== undefined) {
    console.log(`${h(10)} ${other(10)}`)
  }
}
