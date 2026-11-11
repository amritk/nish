// WP51 §2.3, §5.3: `g`'s place holds only `twice`, so its dispatcher has one
// member. The speed profile trusts the place pass and checks nothing; the
// debug profile checks the tag on entry and panics on one outside the set,
// which tests/run.js forges into this program's debug IR.
type F = (x: i32) => i32

const inc = (x: i32): i32 => x + 1
const dec = (x: i32): i32 => x - 1
const twice = (x: i32): i32 => x * 2

export const main = (): void => {
  const fs: F[] = [inc]
  fs.push(dec)
  const g: F = twice
  console.log(`${fs[0](1)} ${fs[1](1)} ${g(3)}`)
}
