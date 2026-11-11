// WP51 stage 1, §2.3 store row `a[i] = e`: `u3` reaches the element type
// `F[]` only through an indexed store, so its set is {u1, u3}; `u2`, called
// through a local of its own, stays out of it.
type F = (x: i32) => i32

const u1 = (x: i32): i32 => x + 1
const u2 = (x: i32): i32 => x * 2
const u3 = (x: i32): i32 => x + 3

export const main = (): void => {
  const other: F = u2
  const fs: F[] = [u1, u1]
  fs[1] = u3
  console.log(`${fs[0](10)} ${fs[1](10)} ${other(10)}`)
}
