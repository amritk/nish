// WP51 stage 1: a `Map` value is not yet a place the reference pass tracks
// (stage 2), so a function reference cannot be one; an index into an array
// of references is the stage 1 spelling.
type Op = (x: i32) => i32

const inc = (x: i32): i32 => x + 1

export const main = (): void => {
  const m = new Map<string, Op>()
  m.set("inc", inc)
  console.log(`${m.size}`)
}
