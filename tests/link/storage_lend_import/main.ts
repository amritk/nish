// WP50 §5.2: storage lent to an imported function that only indexes, sums
// through one forwarding hop and through an import alias; the check reads
// the callee's body in its own module.
import { good, fwd } from "./lib"
import { viaAlias } from "./forward"

const S = new Int32Array(4)

export const main = (): i32 => {
  S[1] = 3
  console.log(`${good(S)} ${fwd(S)} ${viaAlias(S)}`)
  return 0
}
