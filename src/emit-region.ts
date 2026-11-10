// The emitter's half of `nish:region` (`src/region-check.ts` is the checker's):
// the bodies of `std/region.ts`'s intrinsics, each one call into
// `runtime/runtime-region.c`. `region`, `enter` and the rest are ordinary code
// over these, so `f` is called directly, as any function parameter is.
//
// A root crosses the runtime as an `i8*`: the region keeps it without knowing
// its type, and `reopen` gives it back as the `T` `close` was given.

import { Emitter } from "./emit"
import { paramValue } from "./ir"
import { FunctionSig } from "./program"
import {
  REGION_CHILD_NEW,
  REGION_CLOSE,
  REGION_FREE,
  REGION_LEAVE,
  REGION_NEW,
  REGION_OPEN,
  REGION_REOPEN,
} from "./region-check"

/** `root`, of the LLVM pointer type `type`, as the `i8*` the runtime keeps. */
const asBytes = (emitter: Emitter, type: string, root: string): string =>
  emitter.fn.emitValue(`bitcast ${type} ${root} to i8*`)

/** The body of the intrinsic `sig`, whose role is `role` (`regionRoleIn`). */
export const emitRegionBody = (emitter: Emitter, sig: FunctionSig, role: i32): void => {
  const fn = emitter.fn
  if (role === REGION_NEW) {
    const h = fn.emitValue(`call i64 ${emitter.useRuntime("nish_region_new")}()`)
    fn.emit(`ret i64 ${h}`)
    return
  }
  if (role === REGION_CHILD_NEW) {
    const h = fn.emitValue(`call i64 ${emitter.useRuntime("nish_region_child_new")}()`)
    fn.emit(`ret i64 ${h}`)
    return
  }
  const h = paramValue(sig.paramNames[0])
  if (role === REGION_OPEN) {
    fn.emit(`call i8* ${emitter.useRuntime("nish_region_enter")}(i64 ${h})`)
    fn.emit("ret void")
  } else if (role === REGION_REOPEN) {
    const type = emitter.llvm(sig.returnType)
    const root = fn.emitValue(`call i8* ${emitter.useRuntime("nish_region_enter")}(i64 ${h})`)
    fn.emit(`ret ${type} ${fn.emitValue(`bitcast i8* ${root} to ${type}`)}`)
  } else if (role === REGION_CLOSE || role === REGION_LEAVE) {
    const type = emitter.llvm(sig.paramTypes[1])
    const root = asBytes(emitter, type, paramValue(sig.paramNames[1]))
    fn.emit(`call void ${emitter.useRuntime("nish_region_leave")}(i64 ${h}, i8* ${root})`)
    fn.emit(role === REGION_CLOSE ? `ret i64 ${h}` : "ret void")
  } else if (role === REGION_FREE) {
    fn.emit(`call void ${emitter.useRuntime("nish_region_free")}(i64 ${h})`)
    fn.emit("ret void")
  }
}
