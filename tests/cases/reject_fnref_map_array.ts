// WP51 stage 1: an array of references is refused as a `Map` value, like a
// reference: a value the map hands out is a place the place pass does not
// follow (NL2738).
type Op = (x: i32) => i32

const inc = (x: i32): i32 => x + 1
const twice = (x: i32): i32 => x * 2

export const main = (): void => {
  const byName = new Map<string, Op[]>()
  byName.set("up", [inc, twice])
  const up = byName.get("up")
  if (up !== undefined) {
    console.log(`${up[0](5)}`)
  }
}
