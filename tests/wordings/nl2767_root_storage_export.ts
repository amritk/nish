// Root storage moves its objects between calls, so a page cannot read it.
class World {
  tick: i32 = 0
}

export const world = new Array<World | null>(1)

export const tick = (): i32 => {
  const w = world[0]
  return w === null ? -1 : w.tick
}
