// WP51 stage 2: a local `new Array<F | null>(n)` starts each element at tag
// 0, null, but module storage is zero-filled where a page can read it and
// holds no `| null` (NL2686), so a nullable reference is refused there too.
type F = (x: i32) => i32

const inc = (x: i32): i32 => x + 1
const slots = new Array<F | null>(4)

export const main = (): void => {
  slots[1] = inc
  console.log(`${slots.length}`)
}
