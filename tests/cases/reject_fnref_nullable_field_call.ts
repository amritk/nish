// WP51 stage 2: a `F | null` field is not narrowed by a test of the field, so
// a call through it is refused until it is read into a `const` and tested
// (NL2758).
type F = (x: i32) => i32

const inc = (x: i32): i32 => x + 1

class Slot {
  op: F | null = null
}

export const main = (): void => {
  const s = new Slot()
  s.op = inc
  console.log(`${s.op(1)}`)
}
