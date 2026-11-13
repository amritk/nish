// Root storage keeps only what the runtime can trace: an interface a class
// implements is a pointer to an object of any of its classes, with no tag.
interface Shape {
  side: i32
}

class Square implements Shape {
  side: i32 = 2
}

class Scene {
  shapes: Shape[]

  constructor() {
    this.shapes = [new Square()]
  }
}

const scene = new Array<Scene | null>(1)

export const total = (): i32 => {
  const s = scene[0]
  return s === null ? 0 : s.shapes.length
}
