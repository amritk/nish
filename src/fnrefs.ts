// Function references (WP51 stage 1, docs/wp51-function-references.md).
//
// A reference names one capture-free, non-generic top-level function. It is
// an `i32` tag, the function's position plus one among the functions of its
// signature that the program names in a value position (§2.1). A call
// through it is checked here against the reference's signature and recorded;
// once every body is checked, `src/fnref-places.ts` works out which functions
// each place can hold and gives every call a dispatcher of its own set, a
// generated function whose `switch` makes the direct calls (§2.3).

import { CheckContext } from "./context"
import { checkExpression } from "./expressions"
import { refuseOnce } from "./generics"
import { FunctionSig } from "./program"
import { Scope } from "./symbols"
import { T_ERROR } from "./types"
import { Node } from "./nodes"

/** The refusal for a generic function named in a value position. */
export const genericReferenceMessage = (name: string): string =>
  `\`${name}\` is generic: a function reference names one non-generic top-level function`

/** The refusal for a function that takes a function parameter, named in a value position. */
export const templateReferenceMessage = (name: string): string =>
  `\`${name}\` takes a function parameter, so it has no single body to refer to`

/** The refusal for an `async` function named in a value position. */
export const asyncReferenceMessage = (name: string): string =>
  `\`${name}\` is async: a function reference cannot hold it, because its call is a promise`

/** The refusal for a `declare function` named in a value position. */
export const foreignReferenceMessage = (name: string): string =>
  `\`${name}\` is declared in C: a function reference names a function this program defines`

/** The refusal for a function with a rest or defaulted parameter named in a value position. */
export const partialReferenceMessage = (name: string, rest: boolean): string =>
  `\`${name}\` has ${rest ? "a rest parameter" : "a parameter with a default"}: a function reference names a ` +
  "function whose every parameter the caller passes"

/** The refusal for a reference used as anything but a callee, an operand of `===`/`!==`, or a stored value. */
export const referenceUseMessage = (shown: string): string =>
  `\`${shown}\` is a function reference: it can be called, compared, stored and passed, nothing else`

/**
 * `name` in a value position, where it names a top-level function: the
 * reference type of its signature, `T_ERROR` after a refusal, or -1 when no
 * function has that name.
 */
export const functionReference = (ctx: CheckContext, expr: Node): i32 => {
  const name = expr.text
  const template = ctx.template(name)
  if (template !== null) {
    refuseOnce(
      ctx,
      expr,
      template.typeParams.length > 0 ? genericReferenceMessage(name) : templateReferenceMessage(name)
    )
    return T_ERROR
  }
  const sig = ctx.signature(name)
  if (sig === null) {
    return -1
  }
  if (sig.foreign()) {
    return ctx.errorType(expr, foreignReferenceMessage(name))
  }
  if (sig.isAsync()) {
    return ctx.errorType(expr, asyncReferenceMessage(name))
  }
  if (sig.restIndex >= 0 || sig.requiredArity() < sig.writtenArity()) {
    return ctx.errorType(expr, partialReferenceMessage(name, sig.restIndex >= 0))
  }
  ctx.program.nodeFnRefs[expr.id] = sig
  return referenceTypeOf(ctx, sig)
}

/** The reference type of `sig`'s signature. */
export const referenceTypeOf = (ctx: CheckContext, sig: FunctionSig): i32 => {
  const params: i32[] = []
  let i = 0
  while (i < sig.writtenArity()) {
    params.push(sig.paramTypes[i])
    i = i + 1
  }
  return ctx.table.fnRefOf(params, sig.returnType)
}

/**
 * A call through a reference of type `type`, whose callee `expr.children[0]`
 * is already checked: the arguments against the reference's signature, and
 * the call recorded for the dispatcher `src/fnref-places.ts` gives it.
 */
export const checkReferenceCall = (
  ctx: CheckContext,
  expr: Node,
  type: i32,
  shown: string,
  scope: Scope
): i32 => {
  const params = ctx.table.fnRefParamsOf(type)
  const args = expr.children[1]
  if (args.children.length !== params.length) {
    return ctx.errorType(
      expr,
      `\`${shown}\` expects ${params.length} argument(s), got ${args.children.length}`
    )
  }
  let bad = -1
  let badType = T_ERROR
  let i = 0
  while (i < args.children.length) {
    const got = checkExpression(ctx, args.children[i], scope, params[i])
    if (bad < 0 && got !== T_ERROR && !ctx.table.assignable(got, params[i])) {
      bad = i
      badType = got
    }
    i = i + 1
  }
  if (bad >= 0) {
    const want = ctx.table.typeName(params[bad])
    return ctx.errorType(
      args.children[bad],
      `Argument ${bad + 1} of \`${shown}\`: expected ${want}, got ${ctx.table.typeName(badType)}`
    )
  }
  // An instantiation's body is checked once per instance, each into its own
  // table, so the call is recorded with the table its dispatcher goes in.
  const tables = ctx.program.refCallTables
  let seen = false
  let k = 0
  while (k < ctx.program.refCalls.length) {
    if (ctx.program.refCalls[k] === expr && tables[k] === ctx.program.nodeCallees) {
      seen = true
    }
    k = k + 1
  }
  if (!seen) {
    ctx.program.refCalls.push(expr)
    tables.push(ctx.program.nodeCallees)
    ctx.program.refCallTypes.push(type)
  }
  return ctx.table.fnRefResultOf(type)
}
