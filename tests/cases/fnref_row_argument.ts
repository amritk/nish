// WP51 stage 2, §2.3 store row `f(e)`: `u3` reaches the parameter `h` of
// `run` only as an argument, so `h`'s set is {u1, u3}; `u2`, called through
// a local of its own, stays out of it.
type F = (x: i32) => i32

const u1 = (x: i32): i32 => x + 1
const u2 = (x: i32): i32 => x * 2
const u3 = (x: i32): i32 => x + 3

const run = (h: F, x: i32): i32 => h(x)

export const main = (): void => {
  const other: F = u2
  console.log(`${run(u1, 10)} ${run(u3, 10)} ${other(10)}`)
}
