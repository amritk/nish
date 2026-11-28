// WP89 S5a: an owned native field is written from a foreign call, the one
// place a fresh native object comes from. A Nish function that returns a
// `HostHandle` may hand back one something else already owns, as two calls of
// `shared` hand back one canvas, so writing its result into a field the
// dispose closes could close that canvas twice.
import { Canvas, hCanvas, hSame } from "../host-import/host"

const shared = (name: i32): Canvas => hCanvas(name)

class View {
  readonly canvas: Canvas
  constructor(name: i32) {
    this.canvas = shared(name)
  }
  [Symbol.dispose](): void {
    const c = this.canvas
    if (c !== 0) {
      hSame(c)
    }
  }
}

export const shown = (name: i32): i32 => {
  using v = new View(name)
  return name
}
