// The bodies of `std/sync/shm.ts`'s window intrinsics (`src/shm-window.ts`),
// each one call into `runtime/runtime-shm.c`. A window crosses as the array's
// header, which the runtime owns: `lend` answers it, and `giveBack` and the
// region's `close` empty it in place.

import { Emitter } from "./emit"
import { paramValue } from "./ir"
import { FunctionSig } from "./program"
import { SHM_LEND } from "./shm-window"

/** The body of the intrinsic `sig`, whose role is `role` (`shmWindowRole`). */
export const emitShmWindowBody = (emitter: Emitter, sig: FunctionSig, role: i32): void => {
  const fn = emitter.fn
  const h = paramValue(sig.paramNames[0])
  if (role === SHM_LEND) {
    const at = paramValue(sig.paramNames[1])
    const len = paramValue(sig.paramNames[2])
    const reuse = paramValue(sig.paramNames[3])
    const window = fn.emitValue(
      `call %struct.nish_array* ${emitter.useRuntime("nishshm_lend")}(i32 ${h}, i32 ${at}, i32 ${len}, %struct.nish_array* ${reuse})`
    )
    fn.emit(`ret %struct.nish_array* ${window}`)
    return
  }
  const window = paramValue(sig.paramNames[1])
  const n = fn.emitValue(
    `call i32 ${emitter.useRuntime("nishshm_give_back")}(i32 ${h}, %struct.nish_array* ${window})`
  )
  fn.emit(`ret i32 ${n}`)
}
