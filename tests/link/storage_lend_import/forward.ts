// A one-hop lend through an import alias: `sum` names `good` here.
import { good as sum } from "./lib"

export function viaAlias(a: Int32Array): i32 {
  return sum(a)
}
