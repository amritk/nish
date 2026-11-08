// WP50 §5.2 (NL2684): storage lent to an imported function that forwards it
// through an import alias to a callee that binds the parameter is refused:
// the check follows the alias to the callee's body in its own module.
import { viaAlias } from "./forward"

const S = new Int32Array(4)

export const main = (): i32 => {
  viaAlias(S)
  return 0
}
