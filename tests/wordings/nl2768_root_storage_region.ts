// A region allocates from an arena of its own, which a root could outlive.
import { enter, free, region } from "nish:region"

class World {
  tick: i32 = 0
}

const world = new Array<World | null>(1)

const build = (): i32[] => [1, 2, 3]
const count = (xs: i32[]): i32 => xs.length

export const tick = (): i32 => {
  const r = region(build)
  const n = enter(r, count)
  free(r)
  const w = world[0]
  return w === null ? n : w.tick
}
