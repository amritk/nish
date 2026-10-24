// The numbers row of `--emit-ts` (wp33 §3): the rewrites a number needs under
// Node, where every number is a double and the width types do not exist.
//
// The composer (`src/emit-ts-edits.ts`) calls this hook once per node,
// children first, in the fixed order numbers, strings, records, control; a
// later row sees a node only when every earlier one answered `null`. The
// contract:
//
// - Answer `null` for a node this row has nothing to say about. Then the node
//   is written as its source span with its changed children spliced in.
// - Answer the node's whole text otherwise. `operands.at(i)` is child `i` as
//   it will be written, so a rewrite composes with the rows below it.
// - A rewrite that calls a `nish/runtime` export asks for it with
//   `walk.useHelper(name)`; the driver writes the import line.
// - Read types through `walk.program`: inside a generic body the composer has
//   installed one instance's tables, and it holds every instance to the same
//   answer.
//
// What the row writes, by the type the checker gave the operation:
//
// - i32 `+ - *` and unary minus: `(a + b) | 0` and `Math.imul(a, b)` where the
//   compiler proved no overflow or `--wrapping` is on, else the checked
//   `checkedAdd`, `checkedSub`, `checkedMul` and `checkedNeg`, which panic as
//   native does.
//   `>>>` is `(a >>> n) | 0`, the signed reading of the logical shift.
// - u8, u16 and u32 wrap: `& 0xff`, `& 0xffff` and `>>> 0` after the
//   operation; a u8 or u16 shift masks its count to the width first.
// - i64 and u64 are a `bigint`: a literal gains `n`, and an operation goes
//   through `BigInt.asIntN(64, …)` / `asUintN`, the same checked helpers,
//   or the core's shifts.
// - Integer `/` and `%` at every width are `idiv(a, b)` and `irem(a, b)`.
// - f32 `+ - * / %` and a float literal at f32 are rounded with `Math.fround`.
// - `x op= e`, `++` and `--` are the same operation assigned back. That
//   reads the target twice, so a target whose index holds a call, a step or
//   an element read is refused (NL4012).
// - An i64 or u64 string index, or offset of an array's `fill`,
//   goes through `Number`.
// - The conversions whose source or target is unsigned or f32 go through
//   `convert(x, from, to)`; `Math.min`, `Math.max`, `Math.round` and
//   `Math.abs` through the core where Math answers differently.
//
// Every rewrite is one parenthesised expression or one call, so it can be
// spliced into any parent without asking how tightly that parent binds. The
// exceptions keep the precedence of what they replace: `x op= e` is written
// `x = …`, still an assignment, and a step standing as a statement is too,
// since a statement opening with `(` would call the line before it when that
// line has no semicolon.

import { Operands, Walk } from "./emit-ts-edits"
import { elementArguments, idxArguments } from "./emit-ts-records"
import { isAssignmentOperator } from "./emit-util"
import {
  FLAG_POSTFIX,
  N_BINARY,
  N_BIGINT,
  N_CALL,
  N_EXPR_STMT,
  N_IDENT,
  N_INDEX,
  N_MEMBER,
  N_NEW,
  N_NUMBER,
  N_PAREN,
  N_THIS,
  N_TYPE_REF,
  N_VAR_DECL,
  N_UNARY,
  Node,
} from "./nodes"
import {
  T_F32,
  T_F64,
  T_I32,
  T_I64,
  T_STRING,
  T_U16,
  T_U32,
  T_U64,
  T_U8,
  isInteger,
  isUnsigned,
} from "./types"

/** The numbers row's rewrite of `node`, or `null` to leave it to the next row. */
export const numbersRow = (walk: Walk, node: Node, operands: Operands): string | null => {
  const kind = node.kind
  if (kind === N_NUMBER) {
    return wideLiteral(walk, node)
  }
  if (kind === N_BINARY) {
    return binaryRow(walk, node, operands)
  }
  if (kind === N_UNARY) {
    return unaryRow(walk, node, operands)
  }
  if (kind === N_CALL) {
    return callRow(walk, node, operands)
  }
  if (kind === N_EXPR_STMT) {
    return statementRow(walk, node)
  }
  if (kind === N_VAR_DECL) {
    return typedConstant(walk, node, operands)
  }
  if (kind === N_NEW) {
    arrayLength(walk, node, operands)
    return null
  }
  return null
}

/** The width's name as the core's `convert` spells it, or "" for a type this row leaves alone. */
const kindName = (type: i32): string => {
  if (type === T_I32) {
    return "i32"
  }
  if (type === T_I64) {
    return "i64"
  }
  if (type === T_U8) {
    return "u8"
  }
  if (type === T_U16) {
    return "u16"
  }
  if (type === T_U32) {
    return "u32"
  }
  if (type === T_U64) {
    return "u64"
  }
  if (type === T_F32) {
    return "f32"
  }
  return type === T_F64 ? "f64" : ""
}

const isBig = (type: i32): boolean => type === T_I64 || type === T_U64

/** `node`'s type in the checked program, or -1 when the node has none recorded. */
const typeOf = (walk: Walk, node: Node): i32 => {
  const types = walk.program.nodeTypes
  return node.id >= 0 && node.id < types.length ? types[node.id] : -1
}

/** Whether the operation at `site` may skip its overflow check: proven, or `--wrapping`. */
const unchecked = (walk: Walk, site: Node): boolean => {
  const proven = walk.program.nodeProvenNoOverflow
  return walk.program.wrapping || (site.id >= 0 && site.id < proven.length && proven[site.id])
}

/** `expr` wrapped into the integer width `type`. */
const wrapTo = (type: i32, expr: string): string => {
  if (type === T_I32) {
    return `((${expr}) | 0)`
  }
  if (type === T_U32) {
    return `((${expr}) >>> 0)`
  }
  if (type === T_U8) {
    return `((${expr}) & 0xff)`
  }
  if (type === T_U16) {
    return `((${expr}) & 0xffff)`
  }
  if (type === T_I64) {
    return `BigInt.asIntN(64, ${expr})`
  }
  return `BigInt.asUintN(64, ${expr})`
}

/** A helper call, importing the helper. */
const helper = (walk: Walk, name: string, args: string): string => {
  walk.useHelper(name)
  return `${name}(${args})`
}

/** An integer literal at i64 or u64 is a `bigint`. */
const wideLiteral = (walk: Walk, node: Node): string | null => {
  const type = typeOf(walk, node)
  if (isBig(type)) {
    return bigLiteral(node.text)
  }
  if (type !== T_F32) {
    return null
  }
  // A float literal at f32 is the nearest float; a short integer is one already.
  const exact = node.text.length <= 7 && !hasFraction(node.text)
  return exact ? null : `Math.fround(${node.text})`
}

/** Whether a decimal literal has a fraction or an exponent. */
const hasFraction = (text: string): boolean =>
  !text.startsWith("0x") &&
  !text.startsWith("0X") &&
  (text.indexOf(".") >= 0 || text.indexOf("e") >= 0 || text.indexOf("E") >= 0)

/** A number literal's text as a `bigint` literal. */
const bigLiteral = (text: string): string => {
  if (hasFraction(text)) {
    return `BigInt(${text})`
  }
  return `${text}n`
}

/**
 * A module constant with an integer annotation: the checker folds its
 * initializer and records no type in it, so the annotation is the type of
 * every literal and operation inside, which are written as in a function.
 * A literal of an i64 or u64 constant is a `bigint`. An initializer holding
 * anything but literals, names, parentheses and arithmetic is left alone.
 */
const typedConstant = (walk: Walk, node: Node, operands: Operands): string | null => {
  if (node.children.length !== 3 || operands.changed[2]) {
    return null
  }
  const annotation = node.children[1]
  const init = node.children[2]
  const type = annotation.kind === N_TYPE_REF ? spelledType(annotation.text) : -1
  if (type < 0 || typeOf(walk, init) >= 0) {
    return null
  }
  const value = foldedText(walk, init, type)
  if (value === null || value === between(walk, init.start, init.end)) {
    return null
  }
  return `${operands.at(0)}${between(walk, node.children[0].end, init.start)}${value}${between(walk, init.end, node.end)}`
}

/** The integer type a type name spells, or -1. */
const spelledType = (name: string): i32 => {
  const types = [T_I32, T_I64, T_U8, T_U16, T_U32, T_U64]
  for (const type of types) {
    if (kindName(type) === name) {
      return type
    }
  }
  return -1
}

/** `node`, a folded initializer, written at `type`; null for a node this does not write. */
const foldedText = (walk: Walk, node: Node, type: i32): string | null => {
  if (node.kind === N_NUMBER) {
    return isBig(type) ? bigLiteral(node.text) : node.text
  }
  if (node.kind === N_IDENT) {
    return node.text
  }
  if (node.kind === N_PAREN && node.children.length === 1) {
    const inner = foldedText(walk, node.children[0], type)
    return inner === null
      ? null
      : `${between(walk, node.start, node.children[0].start)}${inner}${between(walk, node.children[0].end, node.end)}`
  }
  if (node.kind === N_UNARY && node.children.length === 1 && (node.text === "-" || node.text === "~")) {
    const x = foldedText(walk, node.children[0], type)
    if (x === null) {
      return null
    }
    const negated = negation(walk, node, type, x)
    return negated === null ? `${node.text}${x}` : negated
  }
  if (node.kind === N_BINARY && node.children.length === 2 && !isCompound(node.text)) {
    const left = node.children[0]
    const right = node.children[1]
    const a = foldedText(walk, left, type)
    const b = foldedText(walk, right, type)
    if (a === null || b === null) {
      return null
    }
    const written = operation(walk, node, node.text, type, a, b)
    return written === null ? `${a}${between(walk, left.end, right.start)}${b}` : written
  }
  return null
}

/** Whether `op` is a compound assignment (`+=`, `>>>=`, ...), not a comparison or `=`. */
const isCompound = (op: string): boolean => op !== "=" && isAssignmentOperator(op)

/** Whether `type` is i32 or i64, the widths whose overflow panics. */
const isSigned = (type: i32): boolean => isInteger(type) && !isUnsigned(type)

/**
 * Whether a target can be read and then assigned again by repeating its text:
 * a name, a property chain over a name or `this`, or an element of one at a
 * `pure` index.
 */
const repeatable = (node: Node): boolean => {
  if (node.kind === N_IDENT) {
    return true
  }
  if (node.kind === N_MEMBER && node.children.length === 1) {
    const receiver = node.children[0]
    return receiver.kind === N_THIS || repeatable(receiver)
  }
  if (node.kind === N_INDEX && node.children.length === 2) {
    const index = node.children[1]
    return repeatable(node.children[0]) && pure(index)
  }
  return false
}

/**
 * Whether an index reads the same twice: names, their fields, literals and
 * the arithmetic of them. Its only effect is a panic, and the first copy panics before the
 * second runs.
 */
const pure = (node: Node): boolean => {
  if (node.kind === N_IDENT || node.kind === N_NUMBER || node.kind === N_BIGINT) {
    return true
  }
  if (node.kind === N_PAREN) {
    return pure(node.children[0])
  }
  if (node.kind === N_MEMBER && node.children.length === 1) {
    // A field, never a getter, of a name: `seen.length`.
    const receiver = node.children[0]
    return receiver.kind === N_THIS || receiver.kind === N_IDENT
  }
  if (node.kind === N_UNARY) {
    return node.text !== "++" && node.text !== "--" && pure(node.children[0])
  }
  if (node.kind === N_BINARY) {
    return !isAssignmentOperator(node.text) && pure(node.children[0]) && pure(node.children[1])
  }
  return false
}

/**
 * Whether `text`, a row's rewrite of the repeatable `target`, is still that
 * target: an element whose index changed, or a property of such an element.
 * Only an index is rewritten below a target, so the property name ends it.
 */
const rewrittenTarget = (target: Node, text: string): boolean => {
  if (target.kind === N_INDEX) {
    return true
  }
  return target.kind === N_MEMBER && text.endsWith(`.${target.text}`)
}

/** The message the refusal of a compound assignment over an impure target carries; `src/codes.ts` keys its code on it. */
const COMPOUND_REFUSAL: string =
  "--emit-ts cannot write this compound assignment, whose target it would read twice and which holds a call, a step or an element read: hoist the index into a const"

const binaryRow = (walk: Walk, node: Node, operands: Operands): string | null => {
  const op = node.text
  if (isCompound(op)) {
    const target = node.children[0]
    const name = operands.at(0)
    const own = typeOf(walk, node)
    const value = operation(
      walk,
      node,
      op.substring(0, op.length - 1),
      own >= 0 ? own : typeOf(walk, target),
      name,
      operands.at(1)
    )
    if (value === null) {
      return null
    }
    // Written `x = x op e`, the target is read twice: refused where the second
    // read could differ, or a row's rewrite of it may no longer be a target.
    if (!repeatable(target) || (operands.changed[0] && !rewrittenTarget(target, name))) {
      walk.refuse(node, COMPOUND_REFUSAL)
      return null
    }
    // An element target stores through `setIdx`, which checks the index again
    // after the right side ran, as the right side can shrink the array. The
    // records row writes one whose index is unproven as `idx(a, i)`, which is
    // no target; a proven one keeps its plain read.
    if (target.kind === N_INDEX && !walk.program.uncheckedIndexing) {
      const args =
        operands.changed[0] && idxArguments(name) !== "" ? idxArguments(name) : elementArguments(name)
      if (args !== "") {
        walk.useHelper("setIdx")
        return `setIdx(${args}, ${value})`
      }
    }
    return `${name} = ${value}`
  }
  return operation(walk, node, op, typeOf(walk, node), operands.at(0), operands.at(1))
}

/**
 * `a op b` at `type`, or `null` when JavaScript's operator already answers
 * what the native one does. `site` is the node the compiler keyed its overflow
 * proof to: the operation, the compound assignment or the `++`.
 */
const operation = (walk: Walk, site: Node, op: string, type: i32, a: string, b: string): string | null => {
  if (type === T_F32) {
    return op === "+" || op === "-" || op === "*" || op === "/" || op === "%"
      ? `Math.fround(${a} ${op} ${b})`
      : null
  }
  if (!isInteger(type)) {
    return null
  }
  if (op === "/") {
    return helper(walk, "idiv", `${a}, ${b}`)
  }
  if (op === "%") {
    return helper(walk, "irem", `${a}, ${b}`)
  }
  if (op === "+" || op === "-" || op === "*") {
    return arithmetic(walk, site, op, type, a, b)
  }
  if (op === "<<" || op === ">>" || op === ">>>") {
    return shift(walk, op, type, a, b)
  }
  if ((op === "&" || op === "|" || op === "^") && type === T_U32) {
    return wrapTo(type, `${a} ${op} ${b}`)
  }
  return null
}

/** The helper suffix of `+ - *`: `Add`, `Sub` or `Mul`. */
const opName = (op: string): string => {
  if (op === "+") {
    return "Add"
  }
  return op === "-" ? "Sub" : "Mul"
}

const arithmetic = (walk: Walk, site: Node, op: string, type: i32, a: string, b: string): string => {
  const signed = isSigned(type)
  if (signed && !unchecked(walk, site)) {
    return helper(walk, `checked${opName(op)}`, `${a}, ${b}`)
  }
  if (op === "*" && (type === T_I32 || type === T_U32)) {
    return type === T_I32 ? `Math.imul(${a}, ${b})` : `(Math.imul(${a}, ${b}) >>> 0)`
  }
  return wrapTo(type, `${a} ${op} ${b}`)
}

const shift = (walk: Walk, op: string, type: i32, a: string, b: string): string | null => {
  if (type === T_I32) {
    return op === ">>>" ? `((${a} >>> ${b}) | 0)` : null
  }
  if (type === T_U32) {
    return op === "<<" ? `((${a} << ${b}) >>> 0)` : `(${a} >>> ${b})`
  }
  if (type === T_U8 || type === T_U16) {
    const count = `(${b} & ${type === T_U8 ? "7" : "15"})`
    return op === "<<" ? wrapTo(type, `${a} << ${count}`) : `(${a} >>> ${count})`
  }
  const name = op === "<<" ? "shl" : "lshr"
  if (type === T_I64 && op === ">>") {
    return helper(walk, "ashrI64", `${a}, ${b}`)
  }
  return helper(walk, `${name}${type === T_I64 ? "I64" : "U64"}`, `${a}, ${b}`)
}

const unaryRow = (walk: Walk, node: Node, operands: Operands): string | null => {
  const op = node.text
  if (op === "++" || op === "--") {
    return stepped(walk, node, operands.at(0), (node.flags & FLAG_POSTFIX) !== 0, false)
  }
  return negation(walk, node, typeOf(walk, node), operands.at(0))
}

/** Unary `~` or `-` of `x` at the integer `type`, or null where JavaScript's answer is native's. */
/** Whether a numeric literal spells zero, in any base: `0`, `0x0`, `0b00`, `0n`. */
const zeroLiteral = (text: string): boolean => {
  const prefixed = text.length > 2 && text.startsWith("0") && "xXbBoO".indexOf(text.substring(1, 2)) >= 0
  const digits = prefixed ? text.substring(2, text.length) : text
  let zero = true
  for (let i = 0; i < digits.length; i++) {
    const c = digits.charCodeAt(i)
    // `0`, `_` and the `n` of a bigint.
    zero = zero && (c === 48 || c === 95 || c === 110)
  }
  return zero
}

const negation = (walk: Walk, node: Node, type: i32, x: string): string | null => {
  const op = node.text
  if (!isInteger(type)) {
    return null
  }
  if (op === "~") {
    if (isUnsigned(type)) {
      return wrapTo(type, `~${x}`)
    }
    return null
  }
  if (op !== "-") {
    return null
  }
  const zero = isBig(type) ? "0n" : "0"
  const signed = isSigned(type)
  // A negative literal is the constant itself, never a negation that can overflow.
  const literal = node.children[0].kind === N_NUMBER || node.children[0].kind === N_BIGINT
  if (signed && literal) {
    // `-0` is a negative zero in JavaScript and the integer zero natively.
    return zeroLiteral(node.children[0].text) ? zero : null
  }
  if (signed && !unchecked(walk, node)) {
    return helper(walk, "checkedNeg", x)
  }
  return wrapTo(type, `${zero} - ${x}`)
}

/**
 * `++x`, `x++`, `--x` and `x--` on an integer or f32 local: the step assigned
 * back. A postfix one's value is the old one: the new one stepped back at
 * an integer width, read before the store at f32. `null` where JavaScript's operator is already exact: a
 * proven i32 or i64 step, and every f64 one.
 */
const stepped = (walk: Walk, node: Node, name: string, postfix: boolean, bare: boolean): string | null => {
  const type = typeOf(walk, node.children[0])
  if (!isInteger(type) && type !== T_F32) {
    return null
  }
  const signed = isSigned(type)
  if (signed && !walk.program.wrapping && unchecked(walk, node)) {
    return null
  }
  const one = isBig(type) ? "1n" : "1"
  const up = node.text === "++"
  const value = operation(walk, node, up ? "+" : "-", type, name, one)
  if (value === null) {
    return null
  }
  if (bare) {
    return `${name} = ${value}`
  }
  const assigned = `(${name} = ${value})`
  if (!postfix) {
    return assigned
  }
  if (type === T_F32) {
    // Stepping back would round again, so the old value is read before the store.
    return `[${name}, ${name} = ${value}][0]`
  }
  return wrapTo(type, `${assigned} ${up ? "-" : "+"} ${one}`)
}

/**
 * An expression statement that is only a step: its value is unused, so it is
 * the bare assignment. That reads better than taking a postfix step's old
 * value back, and a statement that opened with `(` would be read as a call
 * on the line before it when that line has no semicolon.
 */
const statementRow = (walk: Walk, node: Node): string | null => {
  const expr = node.children[0]
  if (expr.kind !== N_UNARY || (expr.text !== "++" && expr.text !== "--")) {
    return null
  }
  // A step's target is a plain local, so no row has rewritten it.
  const target = expr.children[0]
  const step = stepped(walk, expr, between(walk, target.start, target.end), false, true)
  if (step === null) {
    return null
  }
  return `${between(walk, node.start, expr.start)}${step}${between(walk, expr.end, node.end)}`
}

/** The source between two offsets. */
const between = (walk: Walk, from: i32, to: i32): string => walk.source.text.substring(from, to)

/**
 * A call this row rewrites: a conversion builtin whose source or target the
 * core's `toI32`/`toI64`/`toF64` would get wrong, or a `Math` method whose
 * answer differs from the native one at the call's type.
 */
const callRow = (walk: Walk, node: Node, operands: Operands): string | null => {
  if (node.children.length !== 2) {
    return null
  }
  const callee = node.children[0]
  const args = node.children[1]
  if (callee.kind === N_IDENT && walk.program.nodeCallees[node.id] === null) {
    const name =
      walk.program.nodeBuiltins[node.id].length > 0 ? walk.program.nodeBuiltins[node.id] : callee.text
    return conversion(walk, name, args, operands)
  }
  if (
    callee.kind === N_MEMBER &&
    callee.children.length === 1 &&
    typeOf(walk, callee.children[0]) === T_STRING
  ) {
    indexArguments(walk, node, operands, 0)
    return null
  }
  if (callee.kind === N_MEMBER && callee.children.length === 1 && arrayOffsets(walk, node)) {
    indexArguments(walk, node, operands, 1)
    return null
  }
  if (callee.kind !== N_MEMBER || callee.children.length !== 1 || callee.children[0].kind !== N_IDENT) {
    return null
  }
  if (callee.children[0].text === "console") {
    return printed(walk, node, operands)
  }
  if (callee.children[0].text !== "Math") {
    return null
  }
  const type = typeOf(walk, node)
  const method = callee.text
  let replacement = ""
  if (method === "min" || method === "max") {
    if (type === T_I64) {
      replacement = method === "min" ? "minI64" : "maxI64"
    } else if (type === T_U64) {
      replacement = method === "min" ? "minU64" : "maxU64"
    } else if (type === T_F32 || type === T_F64) {
      replacement = method === "min" ? "minF64" : "maxF64"
    }
  } else if (method === "round" && (type === T_F32 || type === T_F64)) {
    replacement = "roundF64"
  } else if (method === "abs") {
    if (type === T_I64) {
      replacement = "absI64"
    } else if (type === T_I32) {
      // `llvm.abs` with poison off: the minimum is its own absolute value.
      return `(${operands.at(0)}${between(walk, callee.end, args.start)}${operands.at(1)}${between(walk, args.end, node.end)} | 0)`
    }
  }
  if (replacement.length === 0) {
    return null
  }
  walk.useHelper(replacement)
  return `${replacement}${between(walk, callee.end, args.start)}${operands.at(1)}${between(walk, args.end, node.end)}`
}

/**
 * Whether `node` is an array's `fill(v, from, to)`, whose offsets may be an
 * i64 or u64; a function of the program named so has a callee. An array's
 * `set` takes one too, but Node's arrays have no `set` to call.
 */
const arrayOffsets = (walk: Walk, node: Node): boolean =>
  node.children[0].text === "fill" && walk.program.nodeCallees[node.id] === null

/**
 * A string method given an i64 or u64 index, or an array's `fill` given one as
 * an offset, which JavaScript refuses as a `bigint`: each such argument from
 * the `first` on goes through `Number`, whose rounding past 2^53 lands where
 * the method's clamp does anyway. The argument list is rewritten in
 * `operands` and the call itself left to the later rows, so the strings row
 * builds its byte-offset helper from the converted arguments. When another
 * row rewrote an argument, the list's text no longer splits into arguments,
 * so the runtime's `offsets` converts them instead.
 */
const indexArguments = (walk: Walk, node: Node, operands: Operands, first: i32): void => {
  const args = node.children[1]
  let wrapped = false
  for (let i = first; i < args.children.length; i++) {
    wrapped = wrapped || isBig(typeOf(walk, args.children[i]))
  }
  if (!wrapped) {
    return
  }
  if (operands.changed[1]) {
    walk.useHelper("offsets")
    operands.texts[1] = `...offsets(${first}, [${operands.at(1)}])`
  } else {
    operands.texts[1] = wrappedFrom(walk, args, first, args.start, args.end)
  }
  operands.changed[1] = true
  operands.any = true
}

/**
 * The source from `from` to `end` with each i64 or u64 argument of `args`,
 * from the `i`th on, wrapped in `Number`. It recurses rather than loops, so
 * the text it builds is the result and no loop keeps it per pass.
 */
const wrappedFrom = (walk: Walk, args: Node, i: i32, from: i32, end: i32): string => {
  if (i >= args.children.length) {
    return between(walk, from, end)
  }
  const arg = args.children[i]
  if (!isBig(typeOf(walk, arg))) {
    return wrappedFrom(walk, args, i + 1, from, end)
  }
  return `${between(walk, from, arg.start)}Number(${between(walk, arg.start, arg.end)})${wrappedFrom(walk, args, i + 1, arg.end, end)}`
}

/**
 * `new Array<T>(n)` at an i64 or u64 length, which JavaScript would take as a
 * one-element array holding the `bigint`: the length goes through `Number`.
 * Only the argument is rewritten and the `new` left to the later rows, so the
 * records row builds its zero-filled `newArray` from the converted length.
 */
const arrayLength = (walk: Walk, node: Node, operands: Operands): void => {
  if (node.children.length !== 3 || node.children[0].kind !== N_IDENT || node.children[0].text !== "Array") {
    return
  }
  const args = node.children[2]
  if (args.children.length !== 1 || !isBig(typeOf(walk, args.children[0]))) {
    return
  }
  // One argument: the list's text is that argument's, rewritten or not.
  operands.texts[2] = `Number(${operands.at(2)})`
  operands.changed[2] = true
  operands.any = true
}

/**
 * `console.log(x)` and `console.error(x)` of an i64, u64 or float, whose
 * native output is `String(x)`: Node's console would print a `bigint` with
 * its `n` and a negative zero as `-0`.
 */
const printed = (walk: Walk, node: Node, operands: Operands): string | null => {
  const callee = node.children[0]
  const args = node.children[1]
  if ((callee.text !== "log" && callee.text !== "error") || args.children.length !== 1) {
    return null
  }
  const type = typeOf(walk, args.children[0])
  if (!isBig(type) && type !== T_F32 && type !== T_F64) {
    return null
  }
  return `${operands.at(0)}${between(walk, callee.end, args.start)}String(${operands.at(1)})${between(walk, args.end, node.end)}`
}

/** The width a conversion builtin converts to, or "" for another name. */
const conversionWidth = (name: string): string => {
  if (name === "toI32") {
    return "i32"
  }
  if (name === "toI64") {
    return "i64"
  }
  if (name === "toU8") {
    return "u8"
  }
  if (name === "toU16") {
    return "u16"
  }
  if (name === "toU32") {
    return "u32"
  }
  if (name === "toU64") {
    return "u64"
  }
  if (name === "toF32") {
    return "f32"
  }
  return name === "toF64" ? "f64" : ""
}

/** Whether the core's own `toI32`, `toI64` and `toF64` read and write `width` exactly. */
const exactWidth = (width: string): boolean => width === "i32" || width === "i64" || width === "f64"

/**
 * `toU8(x)` and the rest as `convert(x, "from", "to")`, except where the
 * core's own `toI32`, `toI64` or `toF64` is already exact: a signed or float
 * source going to a signed or f64 target.
 */
const conversion = (walk: Walk, name: string, args: Node, operands: Operands): string | null => {
  const to = conversionWidth(name)
  if (to.length === 0 || args.children.length !== 1) {
    return null
  }
  const from = kindName(typeOf(walk, args.children[0]))
  if (from.length === 0) {
    return null
  }
  if (exactWidth(to) && (exactWidth(from) || (from === "f32" && to !== "f64"))) {
    return null
  }
  return helper(walk, "convert", `${operands.at(1)}, "${from}", "${to}"`)
}
