// Root storage whose class is declared after the `const`: the trace descriptor
// is written for the class all the same (WP55 §3.1).
const world = new Array<World | null>(1)

class World {
  score: i32 = 0
}

export const step = (): i32 => {
  const w = world[0]
  if (w !== null) {
    w.score = w.score + 1
    return w.score
  }
  world[0] = new World()
  return 0
}
