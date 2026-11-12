// WP51 stage 2: `F | null` and `F[] | null` are `Map` values. `get` gives
// `(F | null) | undefined`; a test for each layer narrows it to the reference.
type Op = (x: i32) => i32

const inc = (x: i32): i32 => x + 1
const sq = (x: i32): i32 => x * x

export const main = (): void => {
  const opt = new Map<string, Op | null>()
  opt.set("none", null)
  opt.set("sq", sq)
  const a = opt.get("none")
  const b = opt.get("sq")
  if (a !== undefined && b !== undefined) {
    console.log(`${a === null} ${b === null}`)
    if (b !== null) {
      console.log(`${b(7)}`)
    }
  }
  const lists = new Map<string, Op[] | null>()
  lists.set("up", [inc])
  lists.set("empty", null)
  const up = lists.get("up")
  if (up !== undefined && up !== null) {
    console.log(`${up[0](4)} ${lists.size}`)
  }
}
