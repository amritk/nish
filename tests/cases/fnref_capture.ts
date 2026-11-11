// WP51 stage 1: an arrow argument captures a `const` reference local of the
// function it is written in, a tag like any other value it captures, and
// calls through it.
type F = (x: i32) => i32

const plus1 = (x: i32): i32 => x + 1
const plus3 = (x: i32): i32 => x + 3

const choose = (n: i32): F => (n > 0 ? plus3 : plus1)

export const main = (): void => {
  const h = choose(1)
  const xs: i32[] = [1, 2]
  const ys = xs.map((x) => h(x))
  console.log(`${ys[0]} ${ys[1]}`)
}
