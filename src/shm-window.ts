// `SharedRegion.lend`'s windows (`std/sync/shm.ts`): which of that module's
// functions are the two intrinsics whose bodies `src/emit-shm-window.ts`
// writes. A window is a `u8[]` whose data is the mapping, and no foreign
// function can make one: FFI answers no `u8[]` and lends one as its data, never
// its header. So the module is known by its package and path, as `nish:region`
// is, and a root-package file at the same path is an ordinary module.

import { CLI } from "./branding"
import { CheckedProgram, FunctionSig } from "./program"
import { stdModuleName } from "./std-modules"

/** None of the window intrinsics. */
const SHM_NONE: i32 = 0
/** `shmLend(h, at, len, reuse)`: `nishshm_lend`. */
export const SHM_LEND: i32 = 1
/** `shmGiveBack(h, window)`: `nishshm_give_back`. */
const SHM_GIVE_BACK: i32 = 2

/** Whether `program` is `std/sync/shm.ts` as `nish/sync/shm` loads it. */
export const isShmSource = (program: CheckedProgram): boolean =>
  program.packageName === CLI && program.source.path === stdModuleName("nish/sync/shm")

/** The `SHM_*` role of `sig` where `program` defines it: a module function, no method or instance. */
export const shmWindowRole = (program: CheckedProgram, sig: FunctionSig): i32 => {
  if (
    sig.instance !== null ||
    sig.owner !== null ||
    !sig.definedIn(program.source) ||
    !isShmSource(program)
  ) {
    return SHM_NONE
  }
  if (sig.sourceName === "shmLend") {
    return SHM_LEND
  }
  return sig.sourceName === "shmGiveBack" ? SHM_GIVE_BACK : SHM_NONE
}

/** Whether `sig` is one of the window intrinsics. */
export const isShmWindowIntrinsic = (program: CheckedProgram, sig: FunctionSig): boolean =>
  shmWindowRole(program, sig) !== SHM_NONE
