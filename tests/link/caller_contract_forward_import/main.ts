// A forward into a caller contract another module defines (docs/LANGUAGE.md,
// "Panic sites"): `caller_contract_forward` split across a dependency
// package, `Grid` in its `index.ts` and `area` in its `area.ts`. `index.ts`
// lists `area` before `area.ts` is read, and the contract is still read
// from where `area` is defined, so `Grid`'s constructor forwards into it and
// every `new Grid` here, constant sides whose product fits, is proven:
// `--deny-panics` builds the program and `area`'s `panic`s are listed as
// proven (`expected.panics`). A package's module is no root export a host
// calls by its symbol, so the forward is held.
import { Grid } from "pkg_grid"
import { done } from "./done"

export const main = (): i32 => {
  const g = new Grid(640, 480)
  const empty = new Grid(0, 0)
  const wide = new Grid(46340, 46340)
  console.log(`${g.cells} ${empty.cells} ${wide.cells}`)
  console.log(done())
  return 0
}
