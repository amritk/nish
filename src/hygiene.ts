// Correctness rules over a body that has checked cleanly: the mistakes every
// type is happy with.
//
// Each rule refuses a line that compiles to *something* but cannot be what its
// author meant: a local computed and never read, `x = x`, `a === a`, an
// `else if` that tests what an earlier branch already tested, an unsigned value
// compared with zero, a statement whose value is thrown away. rustc warns about
// most of these and Clippy denies the rest. Here they are errors, because each
// one is a bug far more often than it is a choice, and because a model writing
// the program acts on an error where it may skim past a warning. A rule only
// fires where the answer is certain, and each one has a spelling for "on
// purpose": a name that starts with `_` is never reported unread, and a value
// meant to be compared with itself can be copied to a second name first.
//
// The walk runs after the body's own rules, over the side tables pass 2 just
// wrote, so it reads every binding and type rather than re-deriving one. What
// it finds is held in `ctx.hygiene`, not reported: the compilation adds it only
// once every other rule has passed (`Compilation.reportHygiene`), so an unread
// local never crowds out the error that made it unread. A template's body is
// walked once per instantiation, and each finding is held once per node.

import { CheckContext } from "./context"
import { Diagnostic } from "./diagnostics"
import {
  FLAG_USING,
  N_ARRAY,
  N_AS,
  N_BIGINT,
  N_BINARY,
  N_CONDITIONAL,
  N_EXPR_STMT,
  N_FALSE,
  N_FOR,
  N_IDENT,
  N_IF,
  N_INDEX,
  N_LIST,
  N_MEMBER,
  N_NULL,
  N_NUMBER,
  N_PAREN,
  N_STRING,
  N_TEMPLATE,
  N_TEMPLATE_TEXT,
  N_THIS,
  N_TRUE,
  N_UNARY,
  N_VAR,
  N_VAR_DECL,
  Node
} from "./nodes"
import { CheckedProgram } from "./program"
import { Local, sourceLocal } from "./symbols"
import { isUnsigned, T_F32, T_F64 } from "./types"

/** One local the body declares (`node`, its VAR_DECL), and what the walk found it is used for. */
class Declared {
  node: Node
  local: Local
  read: boolean
  written: boolean

  constructor(node: Node, local: Local) {
    this.node = node
    this.local = local
    this.read = false
    this.written = false
  }
}

/** Run every rule over `body`, holding what they find in `ctx.hygiene`. */
export const checkHygiene = (ctx: CheckContext, body: Node): void => {
  const declared: Declared[] = []
  collectDeclared(ctx.program, body, false, declared)
  markUse(ctx.program, body, declared, true)
  for (const d of declared) {
    reportUnread(ctx, d)
  }
  walkHygiene(ctx, body)
}

/**
 * Hold `message` against `node` for the compilation to report once every other
 * rule has passed, and only once however many instantiations reach it.
 */
const holdFinding = (ctx: CheckContext, node: Node, message: string): void => {
  const key = `hygiene ${node.id}`
  if (ctx.reportedOnce.has(key)) {
    return
  }
  ctx.reportedOnce.add(key)
  ctx.hygiene.push(new Diagnostic(ctx.source, node.start, node.end, "error", message))
}

// ---- A local is read at least once -----------------------------------------

/**
 * Every `let` and `const` declared in `node`, a `for` or `for...of` head's
 * included. `using` is left out: its binding exists to be disposed of, which
 * the block's end does without naming it.
 */
const collectDeclared = (program: CheckedProgram, node: Node, inVar: boolean, out: Declared[]): void => {
  if (node.kind === N_VAR_DECL && inVar) {
    const local = program.nodeLocals[node.id]
    if (local !== null) {
      out.push(new Declared(node, local))
    }
  }
  if (node.kind === N_VAR && (node.flags & FLAG_USING) !== 0) {
    return
  }
  // A declarator sits in a LIST under its N_VAR; anything deeper (its
  // initialiser) is an expression, whose arrows declare through their own N_VAR.
  const passes = node.kind === N_VAR || (inVar && node.kind === N_LIST)
  for (const child of node.children) {
    collectDeclared(program, child, passes, out)
  }
}

const declaredIndex = (declared: Declared[], local: Local | null): i32 => {
  const source = sourceLocal(local)
  if (source === null) {
    return -1
  }
  let i = 0
  while (i < declared.length) {
    if (declared[i].local === source) {
      return i
    }
    i = i + 1
  }
  return -1
}

/** Whether `op` stores into its left operand: `=` or a compound assignment. */
const isStoreOperator = (op: string): boolean =>
  op === "=" ||
  op === "+=" ||
  op === "-=" ||
  op === "*=" ||
  op === "/=" ||
  op === "%=" ||
  op === "**=" ||
  op === "<<=" ||
  op === ">>=" ||
  op === ">>>=" ||
  op === "&=" ||
  op === "|=" ||
  op === "^=" ||
  op === "&&=" ||
  op === "||=" ||
  op === "??="

const isStepOperator = (node: Node): boolean => node.kind === N_UNARY && (node.text === "++" || node.text === "--")

/**
 * Mark what the body does with each declared local. A bare name stored into —
 * `x = v`, `x += v`, `x++` — is a write, and a read as well only where the
 * expression's own value is used: `n++` on its own line, or as a `for`'s step,
 * does not read `n`, and `const m = n++` does. Every other mention is a read,
 * an arrow's capture included.
 */
const markUse = (program: CheckedProgram, node: Node, declared: Declared[], valueUsed: boolean): void => {
  if (node.kind === N_IDENT) {
    const at = declaredIndex(declared, program.nodeLocals[node.id])
    if (at >= 0) {
      declared[at].read = true
    }
    return
  }
  if (node.kind === N_EXPR_STMT) {
    // A lone name on its own line is not a use of it, so `x;` cannot quiet
    // the rule about `x`.
    if (node.children[0].kind !== N_IDENT) {
      markUse(program, node.children[0], declared, false)
    }
    return
  }
  if (node.kind === N_FOR) {
    let index = 0
    for (const child of node.children) {
      markUse(program, child, declared, index !== 2)
      index = index + 1
    }
    return
  }
  if (node.kind === N_PAREN) {
    markUse(program, node.children[0], declared, valueUsed)
    return
  }
  const stores = (node.kind === N_BINARY && isStoreOperator(node.text)) || isStepOperator(node)
  if (stores && node.children[0].kind === N_IDENT) {
    const at = declaredIndex(declared, program.nodeLocals[node.children[0].id])
    if (at >= 0) {
      declared[at].written = true
      // `x = v` never reads `x`; `x += v` and `x++` read it for their value.
      if (valueUsed && node.text !== "=") {
        declared[at].read = true
      }
    }
    if (node.kind === N_BINARY) {
      markUse(program, node.children[1], declared, true)
    }
    return
  }
  for (const child of node.children) {
    markUse(program, child, declared, true)
  }
}

const reportUnread = (ctx: CheckContext, d: Declared): void => {
  const name = d.local.name
  // An unread `Result` has its own rule and its own advice (NL2032).
  if (d.read || name.startsWith("_") || ctx.table.isResult(d.local.type)) {
    return
  }
  const what = d.written ? "is assigned but its value is never read" : "is declared but never read"
  holdFinding(
    ctx,
    d.node.children[0],
    `\`${name}\` ${what}: use it, delete it, or rename it \`_${name}\` if it is unused on purpose`
  )
}

// ---- Expressions that cannot be what was meant -----------------------------

const walkHygiene = (ctx: CheckContext, node: Node): void => {
  if (node.kind === N_EXPR_STMT) {
    // A lone name is left to the rule above, which does not count it as a
    // read: it changes nothing, and it is how a program states a variable
    // named `try` or `var` on a line of its own (`tests/parser/names.ts`).
    const expr = hygieneUnwrap(node.children[0])
    if (expr.kind !== N_IDENT && isPure(expr)) {
      const hint = expr.kind === N_BINARY && (expr.text === "===" || expr.text === "==") ? " (to assign, write `=`)" : ""
      holdFinding(
        ctx,
        node.children[0],
        `This statement has no effect: its value is computed and thrown away${hint}; delete it, or use the value`
      )
      return
    }
  }
  if (node.kind === N_IF) {
    checkRepeatedCondition(ctx, node)
  }
  if (node.kind === N_BINARY) {
    checkSameOperands(ctx, node)
    checkUnsignedZero(ctx, node)
  }
  for (const child of node.children) {
    walkHygiene(ctx, child)
  }
}

const hygieneUnwrap = (node: Node): Node => {
  let at = node
  while (at.kind === N_PAREN || at.kind === N_AS) {
    at = at.children[0]
  }
  return at
}

/**
 * Whether evaluating `node` can do nothing but compute a value: no call, no
 * `new`, no store, no `await`. Anything this does not recognise is taken to
 * have an effect, so a new kind of expression is never refused by default.
 * An index can panic on its bounds check, but a line that reads an element
 * only to throw it away is not a bounds assertion anybody meant to write.
 */
const isPure = (node: Node): boolean => {
  switch (node.kind) {
    case N_IDENT:
    case N_NUMBER:
    case N_BIGINT:
    case N_STRING:
    case N_TRUE:
    case N_FALSE:
    case N_NULL:
    case N_THIS:
    case N_TEMPLATE_TEXT:
      return true
    case N_BINARY:
      return !isStoreOperator(node.text) && isPure(node.children[0]) && isPure(node.children[1])
    case N_UNARY:
      return (
        (node.text === "!" || node.text === "-" || node.text === "+" || node.text === "~") && isPure(node.children[0])
      )
    case N_PAREN:
    case N_AS:
    case N_MEMBER:
      return isPure(node.children[0])
    case N_INDEX:
    case N_CONDITIONAL:
    case N_TEMPLATE:
    case N_ARRAY: {
      for (const child of node.children) {
        if (!isPure(child)) {
          return false
        }
      }
      return true
    }
    default:
      return false
  }
}

/**
 * Whether `a` and `b` are the same pure expression over the same variables, so
 * that evaluating them one after the other cannot give two answers: equal in
 * shape, operator and literal, and each name bound to the same local. At least
 * one name has to be in it — `1 === 1` is a constant someone wrote on purpose,
 * where `n === n` is a typo for two different variables.
 */
const sameValue = (program: CheckedProgram, a: Node, b: Node): boolean =>
  isPure(a) && isPure(b) && mentionsVariable(a) && sameShape(program, hygieneUnwrap(a), hygieneUnwrap(b))

const mentionsVariable = (node: Node): boolean => {
  if (node.kind === N_IDENT || node.kind === N_THIS) {
    return true
  }
  for (const child of node.children) {
    if (mentionsVariable(child)) {
      return true
    }
  }
  return false
}

const sameShape = (program: CheckedProgram, a: Node, b: Node): boolean => {
  const x = hygieneUnwrap(a)
  const y = hygieneUnwrap(b)
  if (x.kind !== y.kind || x.text !== y.text || x.children.length !== y.children.length) {
    return false
  }
  if (x.kind === N_IDENT) {
    const lx = sourceLocal(program.nodeLocals[x.id])
    const ly = sourceLocal(program.nodeLocals[y.id])
    if (lx === null || ly === null) {
      // A name that is not a local — a module constant, an enum — is one
      // binding wherever it is written, so its spelling is its identity.
      return lx === null && ly === null
    }
    return lx === ly
  }
  if (x.kind === N_UNARY && x.flags !== y.flags) {
    return false
  }
  let i = 0
  while (i < x.children.length) {
    if (!sameShape(program, x.children[i], y.children[i])) {
      return false
    }
    i = i + 1
  }
  return true
}

const isFloating = (ctx: CheckContext, node: Node): boolean => {
  const type = ctx.program.nodeTypes[node.id]
  return type === T_F32 || type === T_F64 || ctx.table.isVector(type)
}

/**
 * `x = x`, and `a OP a` for an operator whose answer does not depend on `a`:
 * always true, always false, always zero, or `a` itself. Each is a typo for two
 * different operands. On `f32` and `f64` the self-comparisons other than `<`
 * and `>` have an answer that does depend on `a` — `x !== x` is the test for
 * NaN, `x - x` the test for a finite value — so only those two are refused there.
 */
const checkSameOperands = (ctx: CheckContext, node: Node): void => {
  const op = node.text
  const left = node.children[0]
  const right = node.children[1]
  if (op === "=") {
    if (sameValue(ctx.program, left, right)) {
      holdFinding(ctx, node, `\`${ctx.textOf(node)}\` assigns \`${ctx.textOf(left)}\` to itself, which does nothing`)
    }
    return
  }
  const ordered = op === "<" || op === ">"
  const comparison = ordered || op === "===" || op === "!==" || op === "==" || op === "!=" || op === "<=" || op === ">="
  const other = op === "&&" || op === "||" || op === "&" || op === "|" || op === "^" || op === "-" || op === "/" || op === "%"
  if (!comparison && !other) {
    return
  }
  if (!sameValue(ctx.program, left, right)) {
    return
  }
  if (!ordered && isFloating(ctx, left)) {
    return
  }
  holdFinding(
    ctx,
    node,
    `Both operands of \`${op}\` are \`${ctx.textOf(left)}\`, so \`${ctx.textOf(node)}\` does not depend on its value; one of them is probably meant to be something else (to mean it, copy the value to a second \`const\` first)`
  )
}

/**
 * `if (c) ... else if (c) ...`: the second test of the same condition can
 * never pass, because the first one took every case where it would. A
 * condition with a call in it can answer differently the second time and is
 * left alone (`sameValue` takes only pure expressions).
 */
const checkRepeatedCondition = (ctx: CheckContext, node: Node): void => {
  const condition = node.children[0]
  let next = node.children[2]
  while (next.kind === N_IF) {
    if (sameValue(ctx.program, condition, next.children[0])) {
      holdFinding(
        ctx,
        next.children[0],
        `\`${ctx.textOf(next.children[0])}\` is already tested by an earlier branch of this \`if\`, so this branch never runs; test something else, or merge the two branches`
      )
    }
    next = next.children[2]
  }
}

const isZero = (node: Node): boolean => {
  const at = hygieneUnwrap(node)
  return (at.kind === N_NUMBER && at.text === "0") || (at.kind === N_BIGINT && at.text === "0n")
}

/**
 * An unsigned value compared with zero where the answer is the same for every
 * value it can hold: `u < 0` and `0 > u` are always false, `u >= 0` and
 * `0 <= u` always true. The test was meant for a signed value, or for a bound
 * other than zero.
 */
const checkUnsignedZero = (ctx: CheckContext, node: Node): void => {
  const op = node.text
  const left = node.children[0]
  const right = node.children[1]
  // Written as `u OP 0` either way round: `0 > u` is `u < 0`.
  const zeroRight = isZero(right) && isUnsigned(ctx.program.nodeTypes[left.id])
  const zeroLeft = !zeroRight && isZero(left) && isUnsigned(ctx.program.nodeTypes[right.id])
  const below = (zeroRight && op === "<") || (zeroLeft && op === ">")
  const atLeast = (zeroRight && op === ">=") || (zeroLeft && op === "<=")
  if (!below && !atLeast) {
    return
  }
  const answer = below ? "false" : "true"
  const value = zeroRight ? left : right
  const type = ctx.table.typeName(ctx.program.nodeTypes[value.id])
  holdFinding(
    ctx,
    node,
    `\`${ctx.textOf(value)}\` is ${type}, which is never below 0, so \`${ctx.textOf(node)}\` is always ${answer}; compare a signed value, or against a bound other than 0`
  )
}
