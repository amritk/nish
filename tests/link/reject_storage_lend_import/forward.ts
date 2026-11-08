// A one-hop lend through an import alias to a callee that binds it.
import { bad as idx } from "./lib"

export function viaAlias(a: Int32Array): void {
  idx(a)
}
