// WP55: root storage -- module storage whose element is `C | null` -- holds
// one object graph that every call reaches. Natively the arena is never handed
// back between calls, so the graph simply stays; this pins the reads and
// writes through the root that a page module keeps by compaction.

class Ball {
  id: i32
  name: string

  constructor(id: i32) {
    this.id = id
    this.name = `ball ${id}`
  }
}

class World {
  balls: Ball[]
  tick: i32 = 0

  constructor() {
    this.balls = []
  }
}

const world = new Array<World | null>(1)

const step = (): void => {
  const w = world[0]
  if (w === null) {
    return
  }
  w.tick = w.tick + 1
  w.balls.push(new Ball(w.tick))
  if (w.balls.length > 3) {
    w.balls = w.balls.slice(1)
  }
}

const draw = (): i32 => {
  const w = world[0]
  if (w === null) {
    return -1
  }
  let sum = 0
  for (const b of w.balls) {
    sum = sum + b.id + b.name.length
  }
  return sum
}

export const main = (): i32 => {
  console.log(draw())
  world[0] = new World()
  for (let i = 0; i < 5; i++) {
    step()
    console.log(draw())
  }
  world[0] = null
  console.log(draw())
  return 0
}
