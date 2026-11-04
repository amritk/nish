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
import { vectorSuffix } from "./runtime"
import { emitVectorAccess } from "./emit-arrays"
import { unwrapParens } from "./emit-util"
import { checkExpression } from "./expressions"
import { checkIndexArgument } from "./members"
import { SIMD_SPECIFIER, isSimdOp, simdMaskWidth, simdSuffix, simdTypeLane } from "./nish-modules"
import { N_NUMBER, Node } from "./nodes"
import { Scope } from "./symbols"
import { T_BOOL, T_ERROR, T_F32, T_F64, T_I32, T_U16, T_U32, T_U64, T_U8, T_VOID, TypeTable } from "./types"

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
 * A comparison of whole vectors or masks: `===`, `!==`, `<` and the rest, and
 * the `===` an array's `indexOf` makes. A lane-wise compare gives a mask of
 * answers, not one, and under Node a vector is a typed array whose `===` is
 * identity, so the program names the compare and asks the mask what it wants.
 */
export const simdCompareMessage = (op: string, vector: string): string =>
  `\`${op}\` does not compare \`${SIMD_SPECIFIER}\` vectors or masks (got ${vector}): compare lane by lane with \`eq\`, \`lt\` and the rest, which answer a mask, and ask it \`all\` or \`any\``

// ---- Checking ---------------------------------------------------------------------------

/** The vector `arg` is, or `T_ERROR` after saying it is not one. */
const checkVectorArgument = (ctx: CheckContext, arg: Node, scope: Scope, name: string): i32 => {
  const type = checkExpression(ctx, arg, scope, -1)
  if (type === T_ERROR) {
    return T_ERROR
  }
  if (!ctx.table.isVector(type)) {
    ctx.error(
      arg,
      `\`${name}\` takes a \`${SIMD_SPECIFIER}\` vector as its first argument, got ${ctx.table.typeName(type)}`
    )
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
      `\`${name}\` lane index ${literal.text} is out of range for ${ctx.table.typeName(vector)}, whose lanes are 0 to ${count - 1}`
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
  if (isSimdOp(name)) {
    return checkSimdOp(ctx, call, scope, name)
  }
  if (simdMaskWidth(name) > 0) {
    for (const arg of args.children) {
      checkExpression(ctx, arg, scope, -1)
    }
    return ctx.errorType(call.children[0], simdMaskConstructorMessage(name))
  }
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
  if (isSimdOp(name)) {
    return emitSimdOp(emitter, expr, name)
  }
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

/** Whether `name` is one of `nish:simd`'s `load…` calls, which read an array. */
export const isSimdLoad = (name: string): boolean => simdLaneType(simdSuffix(name, "load")) !== T_ERROR

/** Whether `name` is the `nish:simd` load or store, the two calls that touch an array. */
export const isSimdAccess = (name: string): boolean => name === "store" || isSimdLoad(name)

// ---- Lane operations (WP38 S3 "s3-ops") --------------------------------------------------
//
// docs/wp38-simd.md §3.2. Each operation takes whole vectors (or masks) and is
// chosen by its first argument's type. The lowering is one LLVM instruction or
// one generic `llvm.*` intrinsic per call: `fadd`, `icmp`, `select`,
// `shufflevector`, `llvm.umin.v16i8`, `llvm.fshl.v4i32`. None of it names a
// target, and none carries `nsw`, `nuw` or a fast-math flag, so a lane answers
// what the scalar operation it mirrors answers.

/** The unsigned integer as wide as `bits`, which is the lane a mask of that width counts by. */
export const simdMaskLane = (bits: i32): i32 => {
  if (bits === 8) {
    return T_U8
  }
  if (bits === 16) {
    return T_U16
  }
  return bits === 32 ? T_U32 : T_U64
}

/** A mask type called as though it were a vector constructor. */
const simdMaskConstructorMessage = (name: string): string =>
  `\`${name}\` is a mask type and has no constructor: a mask is what a lane-wise compare (\`eq\`, \`lt\` and the rest) answers`

/**
 * Where a mask may not be written, and the one diagnostic for all of those
 * places. A mask is `<N x i1>`, which has no layout in memory that the arena,
 * a C header and Node agree on, so it lives in registers: a local, a
 * parameter or a return of a function this module keeps. Answers true when it
 * refused. `position` reads as the rest of "cannot be ...".
 */
export const rejectStoredMask = (ctx: CheckContext, type: i32, position: string, node: Node): boolean => {
  if (!ctx.table.holdsMask(type)) {
    return false
  }
  ctx.error(
    node,
    `\`${ctx.table.typeName(type)}\` cannot be ${position}: a \`${SIMD_SPECIFIER}\` mask is a value held only in a local, a parameter or a return of a function this module keeps; store the vectors it selects, or its \`bitmask\``
  )
  return true
}

/** Whether `vector`'s lanes are floats (`f32x4`, `f64x2`). */
const floatLanes = (table: TypeTable, vector: i32): boolean => {
  const lane = table.refOf(vector)
  return lane === T_F32 || lane === T_F64
}

/** The type of one operand, recorded and answered; `T_ERROR` when it was refused already. */
const operand = (ctx: CheckContext, arg: Node, scope: Scope, want: i32): i32 =>
  checkExpression(ctx, arg, scope, want)

/** Refuse an operand that is not what `name` takes; `allowed` reads as "takes ...". */
const refuseOperand = (ctx: CheckContext, arg: Node, name: string, allowed: string, type: i32): i32 =>
  ctx.errorType(arg, `\`${name}\` takes ${allowed}, got ${ctx.table.typeName(type)}`)

const FLOAT_VECTORS: string = "an `f32x4` or an `f64x2`"
const INTEGER_VECTORS: string = "an integer vector, a `u8x16`, `u16x8`, `i32x4` or `u32x4`"

/**
 * The first operand, held to what `name` applies to: "float" (`f32x4`,
 * `f64x2`), "int" (the four integer vectors), "bits" (an integer vector or a
 * mask), "mask" or "any" vector. Answers its type, or `T_ERROR` after saying
 * why not.
 */
const firstOperand = (ctx: CheckContext, arg: Node, scope: Scope, name: string, family: string): i32 => {
  const table = ctx.table
  const type = operand(ctx, arg, scope, -1)
  if (type === T_ERROR) {
    return T_ERROR
  }
  const vector = table.isVector(type)
  const mask = table.isMask(type)
  if (family === "mask") {
    return mask
      ? type
      : refuseOperand(ctx, arg, name, `a \`${SIMD_SPECIFIER}\` mask, which a lane-wise compare answers`, type)
  }
  if (family === "bits") {
    return mask || (vector && !floatLanes(table, type))
      ? type
      : refuseOperand(ctx, arg, name, `${INTEGER_VECTORS}, or a mask`, type)
  }
  if (!vector) {
    return refuseOperand(ctx, arg, name, `a \`${SIMD_SPECIFIER}\` vector`, type)
  }
  if (family === "float" && !floatLanes(table, type)) {
    // `add`, `sub` and `mul` name the form an integer lane has: it wraps.
    const wraps = name === "add" || name === "sub" || name === "mul"
    return ctx.errorType(
      arg,
      wraps
        ? `\`${name}\` is float lane arithmetic and takes ${FLOAT_VECTORS}, got ${table.typeName(type)}: an integer lane can overflow, so its form is \`${name}Wrapping\``
        : `\`${name}\` takes ${FLOAT_VECTORS}, got ${table.typeName(type)}`
    )
  }
  if (family === "int" && floatLanes(table, type)) {
    return refuseOperand(ctx, arg, name, INTEGER_VECTORS, type)
  }
  return type
}

/** A later operand, which is the first operand's type exactly. */
const sameOperand = (ctx: CheckContext, arg: Node, scope: Scope, name: string, first: i32): void => {
  const type = operand(ctx, arg, scope, first)
  if (type === T_ERROR || first === T_ERROR || type === first) {
    return
  }
  ctx.error(
    arg,
    `\`${name}\` takes operands of one type, got ${ctx.table.typeName(first)} and ${ctx.table.typeName(type)}; reinterpret the lanes with \`asU8x16\` and the rest`
  )
}

/** The `family` an operation applies to (see `firstOperand`) and its arity, as "family/arity". */
const opShape = (name: string): string => {
  if (name === "add" || name === "sub" || name === "mul" || name === "div") {
    return "float/2"
  }
  if (name === "neg" || name === "abs" || name === "sqrt") {
    return "float/1"
  }
  if (name === "addWrapping" || name === "subWrapping" || name === "mulWrapping") {
    return "int/2"
  }
  if (name === "and" || name === "or" || name === "xor") {
    return "bits/2"
  }
  if (name === "not") {
    return "bits/1"
  }
  if (name === "any" || name === "all" || name === "bitmask") {
    return "mask/1"
  }
  if (name === "shl" || name === "shr" || name === "rotl" || name === "rotr") {
    return "int/2"
  }
  // min, max, the six compares; `sum`, `sumWrapping` and the `as…` casts take one.
  return name === "sum" || name === "sumWrapping" || name.startsWith("as") ? "any/1" : "any/2"
}

/** Whether `name` is one of the six lane-wise compares, each of which answers a mask. */
const isCompare = (name: string): boolean =>
  name === "eq" || name === "ne" || name === "lt" || name === "le" || name === "gt" || name === "ge"

/** Whether `name` shifts or rotates by a constant count. */
const isLaneShift = (name: string): boolean =>
  name === "shl" || name === "shr" || name === "rotl" || name === "rotr"

/**
 * A shift or rotate count: an integer literal from 0 to one less than the lane
 * width. A constant, because the count is the same for every lane and folds
 * into the instruction, and below the width because LLVM answers poison for a
 * `shl` of the width or more — a count no lane can mean.
 */
const checkLaneShiftCount = (ctx: CheckContext, arg: Node, scope: Scope, name: string, vector: i32): void => {
  checkExpression(ctx, arg, scope, T_I32)
  if (vector === T_ERROR) {
    return
  }
  const bits = ctx.table.alignOf(ctx.table.refOf(vector)) * 8
  const literal = unwrapParens(arg)
  if (literal.kind !== N_NUMBER || literal.text.indexOf(".") >= 0) {
    ctx.error(
      arg,
      `\`${name}\` takes a count that is an integer literal below the lane width, from 0 to ${bits - 1}: a lane of ${ctx.table.typeName(vector)} is ${bits} bits`
    )
    return
  }
  const count = parseIntegerLiteral(literal.text)
  if (count < 0 || count >= toI64(bits)) {
    ctx.error(
      arg,
      `\`${name}\` count ${literal.text} is not below the lane width of ${ctx.table.typeName(vector)}, ${bits} bits: a shift by the width or more moves every bit out, and a rotate by it is a rotate by ${count % toI64(bits)}`
    )
  }
}

/**
 * `shuffle(a, b, i0, ..., iN-1)`: lane `k` of the answer is lane `ik` of `a`
 * and `b` read as one run of 2N lanes. Each index is a literal, because
 * `shufflevector` takes a constant mask.
 */
const checkShuffle = (ctx: CheckContext, call: Node, scope: Scope): i32 => {
  const name = "shuffle"
  const args = call.children[1].children
  if (args.length < 2) {
    return ctx.errorType(
      call,
      `\`${name}\` takes two vectors of one type and one lane index per lane, got ${args.length} argument(s)`
    )
  }
  const vector = firstOperand(ctx, args[0], scope, name, "any")
  sameOperand(ctx, args[1], scope, name, vector)
  for (let i = 2; i < args.length; i++) {
    checkExpression(ctx, args[i], scope, T_I32)
  }
  if (vector === T_ERROR) {
    return T_ERROR
  }
  const count = ctx.table.laneCount(vector)
  const shown = ctx.table.typeName(vector)
  if (args.length !== count + 2) {
    return ctx.errorType(
      call,
      `\`${name}\` of two ${shown} takes ${count} lane indices, one per lane of the answer, got ${args.length - 2}`
    )
  }
  for (let i = 2; i < args.length; i++) {
    const arg = args[i]
    const literal = unwrapParens(arg)
    if (literal.kind !== N_NUMBER || literal.text.indexOf(".") >= 0) {
      ctx.error(
        arg,
        `\`${name}\` takes lane indices that are integer literals, from 0 to ${count * 2 - 1}: the lanes of both ${shown} in order`
      )
      continue
    }
    const index = parseIntegerLiteral(literal.text)
    if (index < 0 || index >= toI64(count) * toI64(2)) {
      ctx.error(
        arg,
        `\`${name}\` lane index ${literal.text} is out of range for two ${shown}, whose lanes are 0 to ${count * 2 - 1}`
      )
    }
  }
  return vector
}

/** The vector an `as…` cast names: `asU8x16` is `u8x16`. */
const castTarget = (table: TypeTable, name: string): i32 => {
  const lane = simdLaneType(simdSuffix(name, "as"))
  return lane === T_ERROR ? T_ERROR : table.vectorOf(lane)
}

/** What `sum` or `sumWrapping` of `vector` answers, or `T_ERROR` after saying it takes none. */
const checkSum = (ctx: CheckContext, arg: Node, name: string, vector: i32): i32 => {
  const lane = ctx.table.refOf(vector)
  const wide = lane === T_I32 || lane === T_U32
  if (name === "sumWrapping") {
    if (wide) {
      return lane
    }
    return ctx.errorType(
      arg,
      `\`sumWrapping\` takes an \`i32x4\` or a \`u32x4\`, got ${ctx.table.typeName(vector)}: \`sum\` adds narrower lanes in an \`i32\` and float lanes in lane order, and neither wraps`
    )
  }
  if (wide) {
    return ctx.errorType(
      arg,
      `\`sum\` of ${ctx.table.typeName(vector)} can overflow its lane type, so its total is \`sumWrapping\`, which wraps as the lanes do`
    )
  }
  return lane === T_U8 || lane === T_U16 ? T_I32 : lane
}

/** A lane operation, by the name its import bound. */
const checkSimdOp = (ctx: CheckContext, call: Node, scope: Scope, name: string): i32 => {
  const table = ctx.table
  const args = call.children[1]
  if (name === "shuffle") {
    return checkShuffle(ctx, call, scope)
  }
  if (name === "select") {
    if (!checkBuiltinArity(ctx, call, name, args, 3)) {
      return T_ERROR
    }
    const mask = firstOperand(ctx, args.children[0], scope, name, "mask")
    const vector = firstOperand(ctx, args.children[1], scope, name, "any")
    sameOperand(ctx, args.children[2], scope, name, vector)
    if (mask === T_ERROR || vector === T_ERROR) {
      return vector
    }
    if (table.maskFor(vector) !== mask) {
      ctx.error(
        args.children[0],
        `\`select\` between two ${table.typeName(vector)} takes the mask their compare answers, ${table.typeName(table.maskFor(vector))}, got ${table.typeName(mask)}`
      )
    }
    return vector
  }
  const shape = opShape(name)
  const slash = shape.indexOf("/")
  const family = shape.substring(0, slash)
  const arity = shape.substring(slash + 1) === "2" ? 2 : 1
  if (!checkBuiltinArity(ctx, call, name, args, arity)) {
    return T_ERROR
  }
  const first = firstOperand(ctx, args.children[0], scope, name, family)
  if (isLaneShift(name)) {
    checkLaneShiftCount(ctx, args.children[1], scope, name, first)
    return first
  }
  if (arity === 2) {
    sameOperand(ctx, args.children[1], scope, name, first)
  }
  if (first === T_ERROR) {
    return T_ERROR
  }
  if (isCompare(name)) {
    return table.maskFor(first)
  }
  if (name === "any" || name === "all") {
    return T_BOOL
  }
  if (name === "bitmask") {
    return T_I32
  }
  if (name === "sum" || name === "sumWrapping") {
    return checkSum(ctx, args.children[0], name, first)
  }
  if (name.startsWith("as")) {
    return castTarget(table, name)
  }
  return first
}

/** `<N x T> <T x, T x, ...>`: every lane of `vector` (an LLVM vector type) the constant `x`. */
const splatConstant = (vectorType: string, lane: string, count: i32, x: string): string => {
  const lanes: string[] = []
  for (let i = 0; i < count; i++) {
    lanes.push(`${lane} ${x}`)
  }
  return `${vectorType} <${lanes.join(", ")}>`
}

/** The `icmp` or `fcmp` predicate of a compare on `vector`; floats compare ordered but for `ne`. */
const comparePredicate = (table: TypeTable, name: string, vector: i32): string => {
  const lane = table.refOf(vector)
  if (lane === T_F32 || lane === T_F64) {
    if (name === "ne") {
      return "fcmp une" // true when either lane is NaN, as `!==` is
    }
    return `fcmp o${name}`
  }
  if (name === "eq" || name === "ne") {
    return `icmp ${name}`
  }
  return `icmp ${lane === T_I32 ? "s" : "u"}${name}`
}

/** One `call` of a vector intrinsic, with its operands already typed. */
const callVectorIntrinsic = (emitter: Emitter, name: string, ret: string, args: string): string =>
  emitter.fn.emitValue(`call ${ret} ${emitter.useRuntime(name)}(${args})`)

/** The lowering of a checked lane operation. */
const emitSimdOp = (emitter: Emitter, expr: Node, name: string): string => {
  const args = expr.children[1].children
  const table = emitter.table
  const fn = emitter.fn
  const lead = name === "select" ? args[1] : args[0]
  const vector = emitter.typeOf(lead)
  const ty = emitter.llvm(vector)
  const count = table.laneCount(vector)
  const laneType = table.isMask(vector) ? "i1" : emitter.llvm(table.refOf(vector))
  const suffix = vectorSuffix(ty)
  if (name === "select") {
    const mask = emitter.emitExpression(args[0])
    const a = emitter.emitExpression(args[1])
    const b = emitter.emitExpression(args[2])
    return fn.emitValue(`select ${emitter.llvm(emitter.typeOf(args[0]))} ${mask}, ${ty} ${a}, ${ty} ${b}`)
  }
  if (name === "shuffle") {
    const a = emitter.emitExpression(args[0])
    const b = emitter.emitExpression(args[1])
    const indices: string[] = []
    for (let i = 2; i < args.length; i++) {
      indices.push(`i32 ${parseIntegerLiteral(unwrapParens(args[i]).text)}`)
    }
    return fn.emitValue(`shufflevector ${ty} ${a}, ${ty} ${b}, <${count} x i32> <${indices.join(", ")}>`)
  }
  const a = emitter.emitExpression(args[0])
  if (isLaneShift(name)) {
    const k = `${parseIntegerLiteral(unwrapParens(args[1]).text)}`
    const amount = splatConstant(ty, laneType, count, k)
    if (name === "rotl" || name === "rotr") {
      const funnel = name === "rotl" ? "fshl" : "fshr"
      return callVectorIntrinsic(emitter, `llvm.${funnel}.${suffix}`, ty, `${ty} ${a}, ${ty} ${a}, ${amount}`)
    }
    let op = "shl"
    if (name === "shr") {
      op = table.refOf(vector) === T_I32 ? "ashr" : "lshr"
    }
    return fn.emitValue(`${op} ${ty} ${a}, ${amount.substring(ty.length + 1)}`)
  }
  if (name === "neg") {
    return fn.emitValue(`fneg ${ty} ${a}`)
  }
  if (name === "abs" || name === "sqrt") {
    return callVectorIntrinsic(
      emitter,
      `llvm.${name === "abs" ? "fabs" : "sqrt"}.${suffix}`,
      ty,
      `${ty} ${a}`
    )
  }
  if (name === "not") {
    const ones = splatConstant(ty, laneType, count, laneType === "i1" ? "true" : "-1")
    return fn.emitValue(`xor ${ty} ${a}, ${ones.substring(ty.length + 1)}`)
  }
  if (name === "any" || name === "all") {
    return callVectorIntrinsic(
      emitter,
      `llvm.vector.reduce.${name === "any" ? "or" : "and"}.${suffix}`,
      "i1",
      `${ty} ${a}`
    )
  }
  if (name === "bitmask") {
    const bits = fn.emitValue(`bitcast ${ty} ${a} to i${count}`)
    return count === 32 ? bits : fn.emitValue(`zext i${count} ${bits} to i32`)
  }
  if (name === "sum" || name === "sumWrapping") {
    const lane = table.refOf(vector)
    if (lane === T_F32 || lane === T_F64) {
      // `-0.0` is the identity of `fadd`, so a sum of `-0.0` lanes stays `-0.0`.
      return callVectorIntrinsic(
        emitter,
        `llvm.vector.reduce.fadd.${suffix}`,
        laneType,
        `${laneType} -0.000000e+00, ${ty} ${a}`
      )
    }
    if (lane === T_U8 || lane === T_U16) {
      const wide = `<${count} x i32>`
      const widened = fn.emitValue(`zext ${ty} ${a} to ${wide}`)
      return callVectorIntrinsic(
        emitter,
        `llvm.vector.reduce.add.${vectorSuffix(wide)}`,
        "i32",
        `${wide} ${widened}`
      )
    }
    return callVectorIntrinsic(emitter, `llvm.vector.reduce.add.${suffix}`, "i32", `${ty} ${a}`)
  }
  if (name.startsWith("as")) {
    return fn.emitValue(`bitcast ${ty} ${a} to ${emitter.llvm(emitter.typeOf(expr))}`)
  }
  const b = emitter.emitExpression(args[1])
  if (isCompare(name)) {
    return fn.emitValue(`${comparePredicate(table, name, vector)} ${ty} ${a}, ${b}`)
  }
  const isFloat = laneType === "float" || laneType === "double"
  if (name === "min" || name === "max") {
    let family = name === "min" ? "minimum" : "maximum"
    if (!isFloat) {
      const signed = table.refOf(vector) === T_I32 ? "s" : "u"
      family = `${signed}${name}`
    }
    return callVectorIntrinsic(emitter, `llvm.${family}.${suffix}`, ty, `${ty} ${a}, ${ty} ${b}`)
  }
  return fn.emitValue(`${binaryInstruction(name)} ${ty} ${a}, ${b}`)
}

/** The instruction a two-operand lane operation is: `fadd` for `add`, `add` for `addWrapping`, `and` for `and`. */
const binaryInstruction = (name: string): string => {
  if (name === "add" || name === "sub" || name === "mul" || name === "div") {
    return name === "div" ? "fdiv" : `f${name}`
  }
  if (name === "addWrapping") {
    return "add"
  }
  if (name === "subWrapping") {
    return "sub"
  }
  return name === "mulWrapping" ? "mul" : name
}
