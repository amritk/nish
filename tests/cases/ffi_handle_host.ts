// WP89 S5a: a handle class may own a `HostHandle` the page gives it, as it
// owns a `CPtr`. `View` opens its canvas through the host module's `hCanvas`
// and its dispose hands it back through `hSame`, tested against the handle's
// "none", `0`; `using` emits that dispose once, at the end of the scope.
import { Canvas, hCanvas, hSame } from "../host-import/host"

export class View {
  readonly canvas: Canvas
  constructor(name: i32) {
    this.canvas = hCanvas(name)
  }
  open(): boolean {
    const c = this.canvas
    return c !== 0
  }
  [Symbol.dispose](): void {
    const c = this.canvas
    if (c !== 0) {
      hSame(c)
    }
  }
}

export const shown = (name: i32): boolean => {
  using v = new View(name)
  return v.open()
};
