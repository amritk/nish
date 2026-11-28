// WP89 S5a: a handle class may own a `HostHandle`, but not a `HostHandle |
// null`: the handle is a scalar `i32` with no null of its own, so the field is
// refused as `i32 | null` is, and "none" is the handle's `0`, as
// `ffi_handle_host` tests it.
import { Canvas, hCanvas, hSame } from "../host-import/host"

class Pane {
  readonly spare: Canvas | null
  constructor(name: i32) {
    this.spare = name > 0 ? hCanvas(name) : null
  }
  [Symbol.dispose](): void {
    const s = this.spare
    if (s !== null) {
      hSame(s)
    }
  }
}

export const spared = (name: i32): boolean => {
  using p = new Pane(name)
  return p.spare === null
}
