// WP55 root storage: a world kept across export calls. Each step adds a ball,
// drops the oldest past 64, renames the world and leaves garbage behind; the
// page asks for the values back and checks the memory stays flat.

class Ball {
  id: i32
  name: string
  trail: i32[]

  constructor(id: i32) {
    this.id = id
    this.name = `ball ${id}`
    this.trail = []
  }
}

enum Kind {
  Dot,
  Box,
}

class Dot {
  readonly kind: Kind.Dot = Kind.Dot
  r: i32

  constructor(r: i32) {
    this.r = r
  }
}

class Box {
  readonly kind: Kind.Box = Kind.Box
  w: i32
  label: string

  constructor(w: i32) {
    this.w = w
    this.label = `box ${w}`
  }
}

type Shape = Dot | Box

class World {
  balls: Ball[]
  shapes: Shape[]
  title: string = ""
  tick: i32 = 0
  noise: i32 = 0
  last: Ball | null = null

  constructor() {
    this.balls = []
    this.shapes = []
  }
}

/** A dot on even ticks, a box on odd ones. */
const shapeAt = (t: i32): Shape => {
  if (t % 2 === 0) {
    return new Dot(t)
  }
  return new Box(t)
}

const world = new Array<World | null>(1)

/** Start a fresh world. */
export const init = (): void => {
  world[0] = new World()
}

/** One step: a ball in, the oldest out past 64, a shape in, a new title. */
export const step = (): void => {
  const w = world[0]
  if (w === null) {
    return
  }
  w.tick = w.tick + 1
  const t = w.tick
  const b = new Ball(w.tick)
  b.trail.push(t * 2)
  b.trail.push(t * 3)
  w.balls.push(b)
  w.last = b
  if (w.balls.length > 64) {
    w.balls = w.balls.slice(1)
  }
  w.shapes.push(shapeAt(t))
  if (w.shapes.length > 16) {
    const kept: Shape[] = []
    for (let i = 1; i < w.shapes.length; i++) {
      kept.push(w.shapes[i])
    }
    w.shapes = kept
  }
  w.title = `tick ${w.tick}`
  // Garbage: an array no root keeps, which the next call's compaction drops.
  const scratch: i32[] = []
  for (let i = 0; i < 32; i++) {
    scratch.push(i * t)
  }
  let noise = 0
  for (const v of scratch) {
    noise = noise + v
  }
  w.noise = noise % 1000
}

/** A checksum of the world the page compares with its own count. */
export const draw = (): i32 => {
  const w = world[0]
  if (w === null) {
    return -1
  }
  let sum = 0
  for (const b of w.balls) {
    sum = sum + b.id + b.trail[0] + b.trail[1] + b.name.length
  }
  for (const s of w.shapes) {
    if (s.kind === Kind.Dot) {
      sum = sum + s.r
    } else {
      sum = sum + s.w + s.label.length
    }
  }
  const last = w.last
  if (last !== null) {
    sum = sum + last.id * 1000
  }
  return sum + w.title.length + w.noise
}

/** How many steps the world has seen. */
export const tick = (): i32 => {
  const w = world[0]
  return w === null ? -1 : w.tick
}
