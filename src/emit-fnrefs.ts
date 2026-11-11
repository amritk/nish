// The two pieces of a WP51 dispatcher (`src/fnref-places.ts`) that its body,
// a `switch` of direct calls built as source, cannot say itself
// (docs/wp51-function-references.md §2.3, §6).

import { Emitter } from "./emit"
import { emitPanicTail } from "./emit-builtins"
import { FunctionSig } from "./program"

/** The message a debug build panics with when a tag is outside its dispatcher's set. */
const outsideSetMessage: string = "function reference holds a function outside its place's set"

/**
 * The debug profile's check on a dispatcher's entry: the tag `%$t` is one of
 * its members'. Tags are numbered per signature, not per set, so the check is
 * membership, a `switch` over the members' tags, rather than a range. A set of
 * one is a single compare. The speed profile emits nothing: the place pass
 * proves every tag a place can hold is in its set.
 */
export const emitTagCheck = (emitter: Emitter, sig: FunctionSig): void => {
  const fn = emitter.fn
  const fail = fn.newBlock("ref.outside")
  const ok = fn.newBlock("ref.inside")
  if (sig.refMembers.length === 1) {
    const inside = fn.emitValue(`icmp eq i32 %$t, ${sig.refMembers[0].refTag}`)
    fn.emit(`br i1 ${inside}, label %${ok.label}, label %${fail.label}`)
  } else {
    const cases: string[] = []
    for (const member of sig.refMembers) {
      cases.push(`i32 ${member.refTag}, label %${ok.label}`)
    }
    fn.emit(`switch i32 %$t, label %${fail.label} [ ${cases.join(" ")} ]`)
  }
  fn.placeBlock(fail)
  emitPanicTail(emitter, emitter.stringConstant(outsideSetMessage))
  fn.placeBlock(ok)
}

/**
 * The body of a dispatcher whose set is empty: no store reaches its place, so
 * no call through it can run, and a call that does traps (§2.3).
 */
export const emitEmptyDispatcher = (emitter: Emitter): void => {
  emitter.declare("declare void @llvm.trap()")
  emitter.fn.emit("call void @llvm.trap()")
  emitter.fn.emit("unreachable")
}
