// The WP33 portability rows for numbers (docs/wp33-round-trip.md §3.1 and 3.5):
// integer division (NL8006), wrapping arithmetic (NL8007), the i32 `>>>`
// (NL8008), 64-bit integers (NL8009) and libm's NaN and signed-zero rules
// (NL8010).
//
// NL8011, a printed negative zero, is retired: `runtime/nish.mjs` installs a
// console that prints `String(x)`, and `String(-0)` is `"0"`, so `-0` prints
// `0` in both readings and there is no site left for the row to name.
//
// Every row reads the type the checker recorded at the node, the way the
// emitter does before it picks an instruction: an operator's operand type is
// `nodeTypes` of its left operand, read through `baseOf` where the emitter
// reads a ranged value as its base. So a site is reported exactly when the IR
// it becomes is the instruction that diverges — `sdiv` rather than `fdiv`, an
// `add` at eight bits, an `lshr` read back as a signed `i32`.
//
// NL8009 is about declarations rather than operations, so it is asked where a
// declaration can be seen from a body: a local at its `VAR_DECL`, a parameter
// and a return type at the root of the body they belong to, and a field or a
// module constant once per module, at the root of its first walked body.

import { isFractional, parseIntegerLiteral } from "./constants"
import {
  FLAG_PREFIX,
  N_BINARY,
  N_CALL,
  N_CONSTRUCTOR,
  N_EMPTY,
  N_NUMBER,
  N_PAREN,
  N_UNARY,
  N_VAR_DECL,
  Node,
} from "./nodes"
import { dottedName, receiverIsValue } from "./emit-util"
import { PortabilityFinding, PortabilityWalk } from "./portability"
import { intBits, isFloat, isInteger, isUnsigned, T_I32 } from "./types"

/**
 * The numbers rows, asked about one node at a time.
 *
 * `src/portability.ts` calls this once for every node of every checked
 * function body, in source order, after NL8005 and before the next row
 * module; an arrow argument's body is handed over under its own function
 * rather than inside its parent's. `walk` carries the facts
 * (`PortabilityWalk`): the module with this body's side tables installed —
 * a generic instantiation's own, so a type read there is concrete — the type
 * table, the options (`--wrapping`, `--number-mode`), the parent links, and
 * the function and body being walked.
 *
 * A site is reported by appending `new PortabilityFinding(node, message)` to
 * `out`; `node` is where the caret goes and `message` must contain its
 * row's fragment from `portabilityRules` in `src/codes.ts` verbatim. The
 * order findings are appended in does not matter — the sink sorts them — and a
 * finding repeated at one node with one message is kept once.
 */
export const numberFindings = (walk: PortabilityWalk, node: Node, out: PortabilityFinding[]): void => {
  if (node === walk.body) {
    signatureFindings(walk, out)
    if (isFirstBody(walk)) {
      moduleFindings(walk, out)
    }
  }
  switch (node.kind) {
    case N_BINARY:
      binaryFindings(walk, node, out)
      return
    case N_UNARY:
      stepFinding(walk, node, out)
      return
    case N_CALL:
      builtinCallFinding(walk, node, out)
      return
    case N_VAR_DECL:
      localFinding(walk, node, out)
      return
    default:
      return
  }
}

// ---- NL8006, NL8007, NL8008: operators ----------------------------------------

/** `a op b` and `t op= e`: the operator is the node's text either way. */
const binaryFindings = (walk: PortabilityWalk, node: Node, out: PortabilityFinding[]): void => {
  const op = node.text
  if (op === "/" || op === "/=") {
    const operand = walk.table.baseOf(walk.program.nodeTypes[node.children[0].id])
    if (isInteger(operand)) {
      out.push(operatorFinding(walk, node, operand, "truncates here, and TypeScript divides exactly"))
    }
    return
  }
  if (op === ">>>" || op === ">>>=") {
    // The result, not the operand: an `i32` result is what reads back signed.
    if (
      walk.table.baseOf(walk.program.nodeTypes[node.id]) === T_I32 &&
      !clearsSignBit(walk, node.children[1])
    ) {
      out.push(operatorFinding(walk, node, T_I32, "reads back signed here, and unsigned in TypeScript"))
    }
    return
  }
  if (op === "+" || op === "-" || op === "*" || op === "+=" || op === "-=" || op === "*=") {
    wrapFinding(walk, node, out)
  }
}

/**
 * Whether a `>>>` count is a constant `k` with `k & 31` not 0. Such a shift
 * moves at least one zero into the sign bit, so the result is at most 2^31 - 1
 * and reads back the same signed here and unsigned in TypeScript. A count that
 * is 0 mod 32, or that is not known until the program runs, can leave the sign
 * bit set, and that is the site NL8008 is for.
 *
 * A constant is a literal, one in parentheses or behind a sign, or a named
 * constant, whose folded value the checker recorded in `nodeConstants`. A sign
 * does not change the answer, because `-k & 31` is 0 exactly when `k & 31` is.
 */
const clearsSignBit = (walk: PortabilityWalk, count: Node): boolean => {
  if (count.kind === N_NUMBER) {
    return !isFractional(count.text) && (parseIntegerLiteral(count.text) & toI64(31)) !== toI64(0)
  }
  if (count.kind === N_PAREN) {
    return clearsSignBit(walk, count.children[0])
  }
  if (count.kind === N_UNARY && count.flags === FLAG_PREFIX && (count.text === "-" || count.text === "+")) {
    return clearsSignBit(walk, count.children[0])
  }
  const constant = walk.program.nodeConstants[count.id]
  return constant !== null && isInteger(constant.type) && (constant.intValue & toI64(31)) !== toI64(0)
}

/** `++` and `--`, prefix or postfix; every other unary operator is quiet. */
const stepFinding = (walk: PortabilityWalk, node: Node, out: PortabilityFinding[]): void => {
  if (node.text === "++" || node.text === "--") {
    wrapFinding(walk, node, out)
  }
}

/**
 * NL8007. The type is read as recorded, not through `baseOf`, so a ranged
 * value is left out by choice: its arithmetic is an `i32` instruction, but
 * every write into a ranged place is checked afterwards, and a result that
 * wrapped back inside the range under `--wrapping` is too rare to report at
 * every `r++`.
 */
const wrapFinding = (walk: PortabilityWalk, node: Node, out: PortabilityFinding[]): void => {
  const operand = walk.program.nodeTypes[node.children[0].id]
  if (wrapsHere(walk, operand)) {
    out.push(operatorFinding(walk, node, operand, "wraps here, and TypeScript keeps counting past the range"))
  }
}

/**
 * Whether `+ - *` on `type` wrap in the IR: always at the narrow unsigned
 * widths, and at `i32` only under `--wrapping`, because without it an `i32`
 * overflow is `nsw` — undefined natively, and not a quiet divergence. `i64`
 * and `u64` are NL8009's: the declaration is reported, not each operation.
 */
const wrapsHere = (walk: PortabilityWalk, type: i32): boolean =>
  (isUnsigned(type) && !isWide(type)) || (type === T_I32 && walk.program.wrapping)

/** "this `/` on i32 truncates here, ...": the operator as written and the type it runs at. */
const operatorFinding = (
  walk: PortabilityWalk,
  node: Node,
  type: i32,
  fragment: string
): PortabilityFinding =>
  new PortabilityFinding(node, `this \`${node.text}\` on ${walk.table.typeName(type)} ${fragment}`)

// ---- NL8010: the builtins ----------------------------------------------------

/**
 * `Math.min` and `Math.max` of a float are `llvm.minnum` and `llvm.maxnum`,
 * which drop a NaN, and `Math.round` rounds `-0.4` to +0 (NL8010). The operand
 * types were settled by the checker: `min` and `max` take two of one type, and
 * `round` only takes an `f64`, so the first argument answers for the call.
 */
const builtinCallFinding = (walk: PortabilityWalk, node: Node, out: PortabilityFinding[]): void => {
  // The emitter's own test for a builtin call (`emitCall`): a dotted name
  // whose receiver the checker gave no type, because it is a namespace.
  const callee = node.children[0]
  const name = dottedName(callee)
  const args = node.children[1].children
  if (name === "" || args.length === 0 || receiverIsValue(walk.program, callee.children[0])) {
    return
  }
  if (!isFloat(walk.table.baseOf(walk.program.nodeTypes[args[0].id]))) {
    return
  }
  if (name === "Math.min" || name === "Math.max" || name === "Math.round") {
    out.push(
      new PortabilityFinding(
        node,
        `\`${name}\` follows the native NaN and signed-zero rules here, not JavaScript's`
      )
    )
  }
}

// ---- NL8009: 64-bit declarations ----------------------------------------------

/** Whether a declaration of `type` holds a double under TypeScript and 64 bits here. */
const isWide = (type: i32): boolean => intBits(type) === 64

/** The whole NL8009 message, after the declaration's own words. */
const wideFinding = (node: Node, what: string): PortabilityFinding =>
  new PortabilityFinding(
    node,
    `${what} is a 64-bit integer here, and a double in TypeScript, which rounds past 2^53`
  )

/** A local, including a `for...of` binding: the caret is its name. */
const localFinding = (walk: PortabilityWalk, node: Node, out: PortabilityFinding[]): void => {
  const local = walk.program.nodeLocals[node.id]
  if (local !== null && isWide(local.type)) {
    out.push(wideFinding(node.children[0], `\`${local.name}\``))
  }
}

/**
 * The parameters and the return type of the function whose body this is. They
 * sit beside the body rather than in it, on `sig.decl`, the declaration the
 * body was read from (`FunctionSig.body`): a
 * constructor has its parameters first and no return type, and every other
 * function — a method, a declaration, an arrow — has a name, the parameters
 * and then the return type. The receiver of a method is `paramTypes[0]` with
 * no node, which is why the two lists are aligned from the end.
 */
const signatureFindings = (walk: PortabilityWalk, out: PortabilityFinding[]): void => {
  const decl = walk.sig.decl
  const ctor = decl.kind === N_CONSTRUCTOR
  const at: i32 = ctor ? 0 : 1
  const params = decl.children[at].children
  const types = walk.sig.paramTypes
  const skip = types.length - params.length
  let i: i32 = 0
  while (i < params.length) {
    const name = params[i].children[0]
    if (isWide(types[skip + i])) {
      out.push(wideFinding(name, `\`${name.text}\``))
    }
    i = i + 1
  }
  if (ctor || !isWide(walk.sig.returnType)) {
    return
  }
  // An arrow argument whose return type was inferred has no annotation, and
  // what it returns is a value some declaration already holds.
  const annotation = decl.children[2]
  if (annotation.kind !== N_EMPTY) {
    out.push(wideFinding(annotation, `\`${walk.sig.sourceName}\`'s return value`))
  }
}

/**
 * Whether this is the first body `portabilityFindings` walks in the module,
 * which is where the declarations that belong to no body are reported, once.
 * It is asked with the pass's own filter, so the answer is the same body the
 * pass will reach first.
 */
const isFirstBody = (walk: PortabilityWalk): boolean => {
  const program = walk.program
  for (const sig of program.functions) {
    // `portabilityFindings`'s filter, with the imported signatures, which
    // come first, turned away before `body()` is read.
    if (sig.definedIn(program.source) && !sig.poisoned && sig.body() !== null) {
      return sig === walk.sig
    }
  }
  return false
}

/**
 * The fields and the module constants this module declares. A generic struct
 * is reported by what an instantiation made of it, at the template's field:
 * `Box<i64>`'s `value: T` is a 64-bit integer as surely as a declared one.
 */
const moduleFindings = (walk: PortabilityWalk, out: PortabilityFinding[]): void => {
  const program = walk.program
  for (const struct of program.structList) {
    if (struct.origin !== program.source) {
      continue
    }
    for (const field of struct.fields) {
      if (isWide(field.type)) {
        out.push(wideFinding(field.decl.children[0], `the field \`${field.name}\``))
      }
    }
  }
  for (const constant of program.constantList) {
    if (constant.origin === program.source && isWide(constant.type)) {
      out.push(wideFinding(constant.decl.children[0], `\`${constant.name}\``))
    }
  }
}
