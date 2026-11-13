// A thread allocates from an arena of its own, which a root could outlive.
import { AtomicI32 } from "nish/threads"

class World {
  tick: i32 = 0
}

const world = new Array<World | null>(1)

export const tick = (): i32 => {
  const count = new AtomicI32(0)
  count.add(1)
  const w = world[0]
  return w === null ? count.load() : w.tick
}
