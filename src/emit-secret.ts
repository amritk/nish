// The emitter half of `nish:secret` (`src/secret.ts` is the checker's): the
// body of every `wipe` instance.
//
// `std/secret.ts` gives `wipe` an empty body, because a wipe cannot be written
// in the language: every store a program makes is one the optimiser may delete
// once nothing reads the memory again, and a wipe is exactly a store nothing
// reads again. So each instance's body is written here, as one `llvm.memset`
// with its volatile flag set. LLVM never removes, merges or narrows a volatile
// memory intrinsic (LangRef, "Volatile Memory Accesses"), whatever is inlined
// around it and whatever is read afterwards, which is the property CLAUDE.md
// asks of a wipe: `tests/run.js` holds it under `opt -O2` and through the
// native build ("nish:secret: the wipe survives -O2").
//
// What is zeroed is the whole storage, not the visible part: an array's
// `capacity` elements rather than its `length`, because a `pop` leaves the old
// element in the buffer, and a record's `sizeof`, padding included. A buffer an
// earlier `push` outgrew is not reachable any more and is not zeroed; the rule
// and its reason are in docs/LANGUAGE.md, "Secrets".
//
// The loads here carry no alias metadata. The instance is a function of its
// own, so nothing in it competes for the header's alias domain, and an access
// with no metadata is one LLVM may assume aliases everything — the safe side.

import { Emitter } from "./emit"
import { paramValue } from "./ir"
import { ARRAY_TYPE } from "./runtime"
import { FunctionSig } from "./program"
import { intBits } from "./types"
import { internalErrorFor } from "./ice"

/** The intrinsic every wipe is: `memset`'s fourth operand is the volatile flag. */
export const WIPE_MEMSET: string = "llvm.memset.p0i8.i64"

/** The `%struct.X` a `%struct.X*` points at. */
const pointee = (pointer: string): string => pointer.substring(0, pointer.length - 1)

/** One volatile store of zeros over `bytes` bytes from the `i8*` `at`. */
const emitVolatileZero = (emitter: Emitter, at: string, bytes: string): void => {
  emitter.declare(`declare void @${WIPE_MEMSET}(i8* nocapture writeonly, i8, i64, i1 immarg)`)
  emitter.fn.emit(`call void @${WIPE_MEMSET}(i8* ${at}, i8 0, i64 ${bytes}, i1 true)`)
}

/** Zero the storage of `value`, of type `type`: an array of integers or a record of them. */
const emitZeroStorage = (emitter: Emitter, value: string, type: i32): void => {
  const table = emitter.table
  const fn = emitter.fn
  if (table.isArray(type)) {
    const elem = table.refOf(type)
    const width = intBits(elem) / 8
    emitter.declareType(ARRAY_TYPE)
    const capAt = fn.emitValue(
      `getelementptr inbounds %struct.nish_array, %struct.nish_array* ${value}, i32 0, i32 1`
    )
    const cap = fn.emitValue(`load i64, i64* ${capAt}, align 8`)
    const dataAt = fn.emitValue(
      `getelementptr inbounds %struct.nish_array, %struct.nish_array* ${value}, i32 0, i32 2`
    )
    const data = fn.emitValue(`load i8*, i8** ${dataAt}, align 8`)
    const bytes = width === 1 ? cap : fn.emitValue(`mul i64 ${cap}, ${width}`)
    emitVolatileZero(emitter, data, bytes)
    return
  }
  const info = emitter.program.struct(table.nameOf(type))
  if (info === null) {
    process.exit(
      internalErrorFor(
        `emitter: \`wipe\` of a record with no layout, ${table.typeName(type)}`,
        emitter.opts.json
      )
    )
  }
  const bytes = fn.emitValue(`bitcast ${emitter.llvm(type)} ${value} to i8*`)
  emitVolatileZero(emitter, bytes, `${info.size}`)
}

/**
 * The body of the `wipe` instance `sig`, whose one parameter is a `Secret`
 * (the value it holds is zeroed) or the array or record itself. The checker
 * has already refused every other type (`wipeShapeMessage`).
 */
export const emitWipeBody = (emitter: Emitter, sig: FunctionSig): void => {
  const table = emitter.table
  const type = sig.paramTypes[0]
  const value = paramValue(sig.paramNames[0])
  const inner = table.secretInner(type)
  if (inner < 0) {
    emitZeroStorage(emitter, value, type)
  } else {
    const holder = emitter.llvm(type)
    const fieldAt = emitter.fn.emitValue(
      `getelementptr inbounds ${pointee(holder)}, ${holder} ${value}, i32 0, i32 0`
    )
    const held = emitter.fn.emitValue(
      `load ${emitter.llvm(inner)}, ${emitter.llvm(inner)}* ${fieldAt}, align 8`
    )
    emitZeroStorage(emitter, held, inner)
  }
  emitter.fn.emit("ret void")
}
