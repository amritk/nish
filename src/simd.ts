/**
 * `nish:simd` (WP38 S3): the six sixteen-byte vector types and the calls that
 * make, load, store and take apart one. The checker's rules and the emitter's
 * lowering are both here, so a later stage that adds lane arithmetic extends
 * one file.
 *
 * A vector is a value, as a number is: an LLVM `<N x T>` held in a register,
 * a local, a field or an array slot (sixteen bytes, aligned to sixteen in the
 * layout — `TypeTable.alignOf`). Nothing here names a target: the IR is
 * `insertelement`, `shufflevector`, `extractelement` and a vector `load` or
 * `store`, and LLVM picks the instructions.
 */

import { readonlyWriteMessage } from "./arrays"
import { checkBuiltinArity, checkArgumentType, requireStatementPosition } from "./builtins"
import { parseIntegerLiteral } from "./constants"
import { CheckContext } from "./context"
import { Emitter } from "./emit"
import { emitVectorAccess } from "./emit-arrays"
import { unwrapParens } from "./emit-util"
import { checkExpression } from "./expressions"
import { checkIndexArgument } from "./members"
import { SIMD_SPECIFIER, simdSuffix, simdTypeLane } from "./nish-modules"
import { N_NUMBER, Node } from "./nodes"
import { Scope } from "./symbols"
import { T_ERROR, T_F32, T_F64, T_I32, T_U16, T_U32, T_U8, T_VOID, TypeTable } from "./types"

/** The lane type a vector type's name spells (`"u8x16"` is `u8`), or `T_ERROR`. */
export const simdLaneType = (name: string): i32 => {
  const lane = simdTypeLane(name)
  if (lane === "u8") {
    return T_U8
  }
  if (lane === "u16") {
    return T_U16
  }
  if (lane === "i32") {
    return T_I32
  }
  if (lane === "u32") {
    return T_U32
  }
  if (lane === "f32") {
    return T_F32
  }
  return lane === "f64" ? T_F64 : T_ERROR
}

/** The vector a constructor, `splat…` or `load…` call makes, by its name, or `T_ERROR` for the others. */
const madeVector = (table: TypeTable, name: string): i32 => {
  let lane = simdLaneType(name)
  if (lane === T_ERROR) {
    lane = simdLaneType(simdSuffix(name, "splat"))
  }
  if (lane === T_ERROR) {
    lane = simdLaneType(simdSuffix(name, "load"))
  }
  return lane === T_ERROR ? T_ERROR : table.vectorOf(lane)
}

/**
 * A vector type's name used without its import: the six are names in
 * `nish:simd` and nowhere else, so a module that spells one says where it
 * comes from at its top.
 */
export const simdImportMessage = (name: string): string =>
  `\`${name}\` is a \`${SIMD_SPECIFIER}\` name and is used only through an import of it: add \`import { ${name} } from "${SIMD_SPECIFIER}"\``

/**
 * A comparison of whole vectors: `===`, `!==`, `<` and the rest, and the
 * `===` an array's `indexOf` makes. A lane-wise compare gives a vector of
 * answers, not one, and under Node a vector is a typed array whose `===` is
 * identity, so the program says which lanes it compares.
 */
export const simdCompareMessage = (op: string, vector: string): string =>
  `\`${op}\` does not compare \`${SIMD_SPECIFIER}\` vectors (got ${vector}): compare the lanes, read with \`extract\``

// ---- Checking ---------------------------------------------------------------------------

/** The vector `arg` is, or `T_ERROR` after saying it is not one. */
const checkVectorArgument = (ctx: CheckContext, arg: Node, scope: Scope, name: string): i32 => {
  const type = checkExpression(ctx, arg, scope, -1)
  if (type === T_ERROR) {
    return T_ERROR
  }
  if (!ctx.table.isVector(type)) {
    ctx.error(arg, `\`${name}\` takes a \`${SIMD_SPECIFIER}\` vector, got ${ctx.table.typeName(type)}`)
    return T_ERROR
  }
  return type
}

/**
 * The array a `load…` or `store` reads or writes: one whose elements are the
 * vector's lane type, exactly, and for a store not `readonly`. A `u8x16` is
 * loaded from a `u8[]` and nothing else, so the sixteen bytes it reads are the
 * sixteen elements the index names.
 */
const checkLaneArray = (
  ctx: CheckContext,
  arg: Node,
  scope: Scope,
  name: string,
  lane: i32,
  store: boolean
): void => {
  const want = ctx.table.arrayOf(lane)
  const type = checkExpression(ctx, arg, scope, want)
  if (type === T_ERROR) {
    return
  }
  if (!ctx.table.isArray(type) || ctx.table.refOf(type) !== lane) {
    ctx.error(
      arg,
      `\`${name}\` takes an array whose elements are the vector's lane type, ${ctx.table.typeName(lane)}[], got ${ctx.table.typeName(type)}`
    )
  } else if (store && ctx.table.isReadonlyArray(type)) {
    ctx.error(arg, readonlyWriteMessage(ctx, type, `\`${name}\` through`))
  }
}

/**
 * A lane index: an integer literal from 0 to one less than the lane count.
 * A constant, because `extractelement` and `insertelement` at a constant are
 * one instruction (a lane move) and at a variable a trip through memory, and
 * because a constant in range needs no check at run time.
 */
const checkLaneIndex = (ctx: CheckContext, arg: Node, scope: Scope, name: string, vector: i32): void => {
  checkExpression(ctx, arg, scope, T_I32)
  if (vector === T_ERROR) {
    return
  }
  const count = ctx.table.laneCount(vector)
  const literal = unwrapParens(arg)
  if (literal.kind !== N_NUMBER || literal.text.indexOf(".") >= 0) {
    ctx.error(
      arg,
      `\`${name}\` takes a lane index that is an integer literal, from 0 to ${count - 1}: ${ctx.table.typeName(vector)} has ${count} lanes`
    )
    return
  }
  const index = parseIntegerLiteral(literal.text)
  if (index < 0 || index >= toI64(count)) {
    ctx.error(
      arg,
      `\`${name}\` lane index ${literal.text} is out of range: ${ctx.table.typeName(vector)} has lanes 0 to ${count - 1}`
    )
  }
}

/**
 * A call to one of `nish:simd`'s functions, by the name the import bound. The
 * type-named constructor takes one argument per lane, `splat…` one for all of
 * them; `load…(xs, i)` reads `xs[i]` to `xs[i + N - 1]` and `store(v, xs, i)`
 * writes them, each checked once for the whole vector; `extract(v, k)` and
 * `replace(v, k, x)` read and swap one lane.
 */
export const checkSimdCall = (ctx: CheckContext, call: Node, scope: Scope, name: string): i32 => {
  const args = call.children[1]
  const table = ctx.table
  const made = madeVector(table, name)
  if (made !== T_ERROR) {
    const lane = table.refOf(made)
    const count = simdLaneType(name) === T_ERROR ? 1 : table.laneCount(made)
    if (isSimdAccess(name)) {
      if (checkBuiltinArity(ctx, call, name, args, 2)) {
        checkLaneArray(ctx, args.children[0], scope, name, lane, false)
        checkIndexArgument(ctx, args.children[1], scope, name)
      }
      return made
    }
    if (checkBuiltinArity(ctx, call, name, args, count)) {
      for (const arg of args.children) {
        checkArgumentType(ctx, arg, scope, name, lane)
      }
    }
    return made
  }
  if (name === "store") {
    if (checkBuiltinArity(ctx, call, name, args, 3)) {
      const vector = checkVectorArgument(ctx, args.children[0], scope, name)
      if (vector === T_ERROR) {
        checkExpression(ctx, args.children[1], scope, -1)
      } else {
        checkLaneArray(ctx, args.children[1], scope, name, table.refOf(vector), true)
      }
      checkIndexArgument(ctx, args.children[2], scope, name)
    }
    requireStatementPosition(ctx, call, name)
    return T_VOID
  }
  const replace = name === "replace"
  if (!checkBuiltinArity(ctx, call, name, args, replace ? 3 : 2)) {
    return T_ERROR
  }
  const vector = checkVectorArgument(ctx, args.children[0], scope, name)
  checkLaneIndex(ctx, args.children[1], scope, name, vector)
  if (!replace) {
    return vector === T_ERROR ? T_ERROR : table.refOf(vector)
  }
  if (vector === T_ERROR) {
    checkExpression(ctx, args.children[2], scope, -1)
  } else {
    checkArgumentType(ctx, args.children[2], scope, name, table.refOf(vector))
  }
  return vector
}

// ---- Lowering ---------------------------------------------------------------------------

/** The constant lane index a checked `extract` or `replace` was given. */
const laneIndex = (arg: Node): string => `${parseIntegerLiteral(unwrapParens(arg).text)}`

/**
 * One `insertelement` per lane into `undef`. A constructor of constants folds
 * to a constant vector under `opt`; `splat…` inserts once and broadcasts lane
 * 0 with a `shufflevector` whose mask is all zeros.
 */
export const emitSimdCall = (emitter: Emitter, expr: Node, name: string): string => {
  const args = expr.children[1].children
  if (isSimdAccess(name)) {
    return emitVectorAccess(emitter, expr, name === "store")
  }
  const fn = emitter.fn
  const result = emitter.typeOf(expr)
  if (name === "extract") {
    const v = args[0]
    const value = emitter.emitExpression(v)
    return fn.emitValue(
      `extractelement ${emitter.llvm(emitter.typeOf(v))} ${value}, i32 ${laneIndex(args[1])}`
    )
  }
  const ty = emitter.llvm(result)
  const lane = emitter.llvm(emitter.table.refOf(result))
  if (name === "replace") {
    const value = emitter.emitExpression(args[0])
    const x = emitter.emitExpression(args[2])
    return fn.emitValue(`insertelement ${ty} ${value}, ${lane} ${x}, i32 ${laneIndex(args[1])}`)
  }
  if (simdLaneType(name) === T_ERROR) {
    const x = emitter.emitExpression(args[0])
    const one = fn.emitValue(`insertelement ${ty} undef, ${lane} ${x}, i32 0`)
    const count = emitter.table.laneCount(result)
    return fn.emitValue(`shufflevector ${ty} ${one}, ${ty} undef, <${count} x i32> zeroinitializer`)
  }
  let acc = "undef"
  for (let i = 0; i < args.length; i++) {
    const x = emitter.emitExpression(args[i])
    acc = fn.emitValue(`insertelement ${ty} ${acc}, ${lane} ${x}, i32 ${i}`)
  }
  return acc
}

/** Whether `name` is the `nish:simd` load or store, the two calls that touch an array. */
export const isSimdAccess = (name: string): boolean =>
  name === "store" || simdLaneType(simdSuffix(name, "load")) !== T_ERROR

/** The runtime a call can reach: a load's or a store's out-of-range panic, and nothing for the rest. */
export const simdCallees = (name: string): string[] => {
  const out: string[] = []
  if (isSimdAccess(name)) {
    out.push("nish_panic_index")
  }
  return out
}
