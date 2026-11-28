// A constructor that forwards into a caller contract (docs/LANGUAGE.md,
// "Panic sites"), in the shape of `std/term-pixels.ts`'s `Framebuffer`.
// `area` panics on a negative side and on a product past 2^31 - 1, read
// through the name `size` binds; `Grid`'s constructor starts with a call into
// it with its own parameters, so it holds `area`'s comparisons on them, and
// `new Grid(w, h)` is a `contract` site proven where `w` and `h` are
// constants whose product fits. Every `new Grid` here is one, so the call in
// the constructor is proven and `area`'s `panic`s are listed as proven
// (`expected.panics`). `caller_contract_forward_unproven` is a size known
// only at run time.
import { done } from "./done"

const area = (who: string, width: i32, height: i32): i32 => {
  if (width < 0 || height < 0) {
    panic(`${who}: a negative size`)
  }
  const size: i64 = toI64(width) * toI64(height)
  if (size > toI64(2147483647)) {
    panic(`${who}: more than 2^31 - 1 cells`)
  }
  return toI32(size)
}

class Grid {
  width: i32
  height: i32
  cells: i32

  constructor(width: i32, height: i32) {
    const cells: i32 = area("Grid", width, height)
    this.width = width
    this.height = height
    this.cells = cells
  }
}

export const main = (): i32 => {
  const g = new Grid(640, 480)
  const empty = new Grid(0, 0)
  const wide = new Grid(46340, 46340)
  console.log(`${g.cells} ${empty.cells} ${wide.cells}`)
  console.log(done())
  return 0
}
