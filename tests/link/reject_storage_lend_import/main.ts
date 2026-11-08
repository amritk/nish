// WP50 §5.2 (NL2684): storage lent to an imported function whose body binds
// the parameter, and to one that forwards through an import alias to it, is
// refused: the check reads the callee's body in its own module.
import { bad } from "./lib"
import { viaAlias } from "./forward"

const S = new Int32Array(4)

export const main = (): i32 => {
  bad(S)
  viaAlias(S)
  return 0
}
