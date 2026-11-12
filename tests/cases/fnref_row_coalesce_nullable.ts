// WP51 stage 2, §2.3 value rule for `x ?? y` into a nullable place: `u3`
// reaches the nullable local `g` only as the default of `??`, so `g`'s set
// is {u1, u3}; `u2`, called through a local of its own, stays out of it.
type F = (x: i32) => i32

const u1 = (x: i32): i32 => x + 1
const u2 = (x: i32): i32 => x * 2
const u3 = (x: i32): i32 => x + 3

const pick = (n: i32): F | null => (n > 0 ? u1 : null)

export const main = (): void => {
  const other: F = u2
  const g: F | null = pick(0) ?? u3
  const h: F | null = pick(1) ?? u3
  if (g !== null && h !== null) {
    console.log(`${g(10)} ${h(10)} ${other(10)}`)
  }
}
