// WP89 S5a: the program, in a module of its own. It opens each handle class
// through its factory with `using`, lends it to a function of the library
// module, and prints, from the C side's count, the order every native object
// was released in: the buffer, then its pool's fence, then its device.
import { Gpu, Pool, openGpu, openPool, describe } from "./context"
import { closed_count, closed_at, live_count } from "./sys"

const twice = (g: Gpu): i32 => g.id() * 2

// A class of the program's own module owns a `Gpu` the library module
// declares, and a `Pool` it may leave empty: the `Gpu` is laid out as owned
// though the import that names it binds after this class's fields, and the
// `null` write and the plain `i32` field leave the close order as declared.
class Rig {
  readonly gpu: Gpu
  readonly spare: Pool | null
  readonly n: i32
  constructor(gpu: Gpu, n: i32) {
    this.gpu = gpu
    this.spare = null
    this.n = n
  }
  [Symbol.dispose](): void {}
}

const early = (id: i32): i32 => {
  using p = openPool(id, 8)
  if (p === null) {
    return -1
  }
  if (p.size() > 4) {
    return describe(p)
  }
  return 0
}

export const main = (): i32 => {
  {
    using g = openGpu(1).expect("a device")
    console.log(twice(g))
  }
  {
    using p = openPool(2, 64)
    if (p !== null) {
      console.log(describe(p))
    }
  }
  {
    using none = openPool(3, 0)
    console.log(none === null ? 1 : 0)
  }
  console.log(early(4))
  {
    using r = new Rig(openGpu(5).expect("a device"), 7)
    console.log(r.n + r.gpu.id())
  }
  for (let i = 0; i < closed_count(); i++) {
    console.log(closed_at(i))
  }
  console.log(live_count())
  return 0
}
