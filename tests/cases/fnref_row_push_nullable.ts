// WP51 stage 2, store row `xs.push(e)` into a `(F | null)[]`: `u3` reaches
// the array's elements only through `push`, so the call through the element
// read dispatches over {u1, u3}; `u2`, called through a local of its own,
// stays out of it. Under Node `hs[1]` is `u3`, so the two must agree.
type F = (x: i32) => i32

const u1 = (x: i32): i32 => x + 1
const u2 = (x: i32): i32 => x * 2
const u3 = (x: i32): i32 => x + 3

export const main = (): void => {
  const other: F = u2
  const hs: (F | null)[] = [null]
  hs.push(u3)
  hs[0] = u1
  const g = hs[1]
  if (g !== null) {
    console.log(`${g(10)} ${other(10)}`)
  }
}
