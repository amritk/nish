// WP51 stage 2, §2.3 value rule for `c ? a : b` into a nullable place: `u3`
// reaches the nullable local `g` only as an arm of `?:`, so `g`'s set is
// {u1, u3}; `u2`, called through a local of its own, stays out of it.
type F = (x: i32) => i32

const u1 = (x: i32): i32 => x + 1
const u2 = (x: i32): i32 => x * 2
const u3 = (x: i32): i32 => x + 3

export const main = (): void => {
  const other: F = u2
  let n = 0
  let sum = 0
  while (n < 3) {
    const g: F | null = n === 0 ? null : n === 1 ? u1 : u3
    if (g !== null) {
      sum = sum * 100 + g(10)
    }
    n = n + 1
  }
  console.log(`${sum} ${other(10)}`)
}
