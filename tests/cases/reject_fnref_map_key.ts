// WP51 stage 2: a `Map` value may be a function reference, but a key may not:
// a key is hashed and compared, and a reference has no hash.
type Op = (x: i32) => i32

const inc = (x: i32): i32 => x + 1

export const main = (): void => {
  const m = new Map<Op, i32>()
  m.set(inc, 1)
  console.log(`${m.size}`)
}
