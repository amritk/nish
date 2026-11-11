// WP51 stage 1, §2.3 store row `a.fill(e)`: `fill` takes numeric elements
// only, so filling an `F[]` is refused before the reference pass runs, and
// the row stores nothing in stage 1.
type F = (x: i32) => i32

const u1 = (x: i32): i32 => x + 1
const u2 = (x: i32): i32 => x * 2
const u3 = (x: i32): i32 => x + 3

export const main = (): void => {
  const other: F = u2
  const fs: F[] = [u1, u1, u1]
  fs.fill(u3, 1)
  console.log(`${fs[0](10)} ${fs[2](10)} ${other(10)}`)
}
