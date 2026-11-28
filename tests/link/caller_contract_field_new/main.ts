// A `new` in a field's initializer of a class without a constructor
// (docs/LANGUAGE.md, "Panic sites"): it runs where the outer class is made,
// so `Grid`'s constructor is a callee there, and no `contract` site is
// written for it. A caller contract with a callee no site names is not
// held, so `Grid`'s call into `area` stays unproven and `--deny-panics`
// refuses `area`'s `panic`, though `main`'s own `new Grid` is proven.
import { done } from "./done"

const area = (who: string, width: i32, height: i32): i32 => {
  if (width < 0 || height < 0) {
    panic(`${who}: a negative size`)
  }
  return width
}

class Grid {
  cells: i32

  constructor(width: i32, height: i32) {
    const cells: i32 = area("Grid", width, height)
    this.cells = cells
  }
}

class Holder {
  g: Grid = new Grid(-1, 2)
}

export const main = (): i32 => {
  const ok = new Grid(2, 3)
  const h = new Holder()
  console.log(`${ok.cells} ${h.g.cells}`)
  console.log(done())
  return 0
}
