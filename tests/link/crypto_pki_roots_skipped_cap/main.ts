// `PkiRoots.skipped` stops at `PKI_ROOTS_MAX_SKIPPED` rather than overflowing:
// past `PKI_ROOTS_MAX_FILES` a trust directory's entries are each counted
// without a read, so nothing smaller bounds the count (PKI-R8). Two skips from
// one below the cap leave it at the cap, and the load goes on. Without the
// test in `pkiRootsSkip` the second `+ 1` would overflow and panic: exit 1.
import { PKI_ROOTS_MAX_SKIPPED, PkiRootsLoad, pkiRootsSkip } from "nish/crypto/pki-roots"

export const main = (): i32 => {
  const load = new PkiRootsLoad()
  load.out.skipped = PKI_ROOTS_MAX_SKIPPED - 1
  pkiRootsSkip(load)
  console.log(`one below the cap, one skip: ${load.out.skipped === PKI_ROOTS_MAX_SKIPPED}`)
  pkiRootsSkip(load)
  console.log(`at the cap, one more skip: ${load.out.skipped === PKI_ROOTS_MAX_SKIPPED}`)
  return 0
}
