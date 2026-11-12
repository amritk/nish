// WP51 stage 2: an array of references is a `Map` value; an element of the
// array the map hands back dispatches over the functions stored into it.
type Op = (x: i32) => i32

const inc = (x: i32): i32 => x + 1
const twice = (x: i32): i32 => x * 2

export const main = (): void => {
  const byName = new Map<string, Op[]>()
  byName.set("up", [inc, twice])
  const up = byName.get("up")
  if (up !== undefined) {
    console.log(`${up[0](5)} ${up[1](5)}`)
  }
}
