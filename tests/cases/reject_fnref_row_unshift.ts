// WP51 stage 1, §2.3 store row `a.unshift(e)`: an array of references has
// no `unshift`, so the call is refused before the reference pass runs, and
// the row stores nothing in stage 1.
type F = (x: i32) => i32

const u1 = (x: i32): i32 => x + 1
const u2 = (x: i32): i32 => x * 2
const u3 = (x: i32): i32 => x + 3

export const main = (): void => {
  const other: F = u2
  const fs: F[] = [u1]
  fs.unshift(u3)
  console.log(`${fs[0](10)} ${fs[1](10)} ${other(10)}`)
}
