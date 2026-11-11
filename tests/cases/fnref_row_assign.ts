// WP51 stage 1, §2.3 store row `a = e`: `u3` reaches the local `h` only
// through a plain reassignment, so `h`'s set is {u1, u3}; `u2`, called
// through a place of its own, stays out of it.
type F = (x: i32) => i32

const u1 = (x: i32): i32 => x + 1
const u2 = (x: i32): i32 => x * 2
const u3 = (x: i32): i32 => x + 3

export const main = (): void => {
  const other: F = u2
  let h: F = u1
  const before = h(10)
  h = u3
  console.log(`${before} ${h(10)} ${other(10)}`)
}
