// WP50 §5.2 (NL2684): storage lent to an imported function whose body binds
// the parameter is refused: the check reads the callee's body in its own
// module. The alias route is `reject_storage_lend_import_alias`.
import { bad } from "./lib"

const S = new Int32Array(4)

export const main = (): i32 => {
  bad(S)
  return 0
}
