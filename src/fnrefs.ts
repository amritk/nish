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
import { arrowElsewhereMessage, refuseOnce } from "./generics"
import { FunctionSig, StructInfo } from "./program"
import { Scope } from "./symbols"
import { T_ERROR, TypeTable } from "./types"
import { BuildMode, hostVisible } from "./visibility"
import { N_ARROW, N_CLASS, N_CONSTRUCTOR, N_FIELD, N_IDENT, N_PARAM, N_THIS, N_VAR_DECL, Node } from "./nodes"
import { StringSet } from "./map"

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

/** The refusal for `new Array<S>(n)` of a function type, whose zero is no function's tag. */
export const zeroFilledReferenceMessage = (spelled: string): string =>
  `\`new Array<${spelled}>(n)\` would zero-fill with 0, which names no function; build it with \`[]\` and \`push\` instead`

/** The refusal for an arrow in a value position that reads a name of the function it is written in. */
export const capturingArrowMessage = (name: string): string =>
  `this arrow captures \`${name}\`: a function reference names a top-level function and carries no environment`

/** The refusal for a method named as a value. */
export const methodReferenceMessage = (shown: string): string =>
  `\`${shown}\` is a method: a function reference names a top-level function, and a method needs its receiver`

/** The names `node` and everything under it declare: parameters and variables. */
const declaredNames = (node: Node, into: StringSet): void => {
  if ((node.kind === N_PARAM || node.kind === N_VAR_DECL) && node.children.length > 0) {
    into.add(node.children[0].text)
  }
  for (const child of node.children) {
    declaredNames(child, into)
  }
}

/** The first name under `node`, not in `own`, that `scope` resolves, or `this`; "" for none. */
const firstCapture = (node: Node, own: StringSet, scope: Scope): string => {
  if (node.kind === N_THIS) {
    return "this"
  }
  if (node.kind === N_IDENT && !own.has(node.text) && scope.lookup(node.text) !== null) {
    return node.text
  }
  for (const child of node.children) {
    const found = firstCapture(child, own, scope)
    if (found !== "") {
      return found
    }
  }
  return ""
}

/**
 * An arrow in a value position, which stage 1 does not make a reference:
 * refused as capturing when it reads a name of the function around it (§2.2),
 * else with the advice to name a top-level function.
 */
export const refuseValueArrow = (ctx: CheckContext, arrow: Node, scope: Scope): void => {
  const own = new StringSet()
  if (arrow.kind === N_ARROW) {
    declaredNames(arrow, own)
  }
  const captured = firstCapture(arrow, own, scope)
  refuseOnce(ctx, arrow, captured !== "" ? capturingArrowMessage(captured) : arrowElsewhereMessage())
}

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

/** The refusal for a function reference that code outside the program could hold or hand in (§5.2). */
export const hostReferenceMessage = (what: string): string =>
  `${what} holds a function reference that code outside this program can reach: a reference is a tag this ` +
  "program's dispatcher reads, not an address, and a host could hand back one no dispatcher knows"

/** Whether `type` holds a reference: is one, or an array or nullable of one. */
const holdsFnRef = (table: TypeTable, type: i32): boolean => {
  if (type < 0) {
    return false
  }
  if (table.isFnRef(type)) {
    return true
  }
  if (table.isArray(type) || table.isNullable(type)) {
    return holdsFnRef(table, table.refOf(type))
  }
  return false
}

/** The classes `type` names, directly or as an array element or nullable, added to `into`. */
const classesOf = (table: TypeTable, type: i32, into: i32[]): void => {
  if (type < 0) {
    return
  }
  if (table.isArray(type) || table.isNullable(type)) {
    classesOf(table, table.refOf(type), into)
  } else if (table.isStruct(type) && into.indexOf(type) < 0) {
    into.push(type)
  }
}

/** The parameter list of a function, method, arrow or constructor declaration. */
const paramList = (decl: Node): Node | null => {
  if (decl.kind === N_CONSTRUCTOR) {
    return decl.children[0]
  }
  return decl.children.length > 1 ? decl.children[1] : null
}

/**
 * §5.2: no reference crosses into code this compiler did not see. A
 * parameter or return of a function `hostVisible` answers yes for, the entry
 * point among them, or of a `declare function`, and a field of a class reachable from one -- of every
 * class where the build hands out every layout -- is refused, since a host
 * could store or pass a tag no dispatcher's set holds. A compile-time
 * function parameter is bound at a call this compiler checked, so it is not
 * in scope.
 */
export const refuseHostReferences = (contexts: CheckContext[], mode: BuildMode): void => {
  const reached: i32[] = []
  for (const ctx of contexts) {
    const program = ctx.program
    const table = ctx.table
    for (const sig of program.functions) {
      const owner = sig.owner
      const exported = owner !== null ? owner.exported : sig.exported
      const main = program.entryMain
      const entry = program.isEntry && main !== null && sig === main
      if (
        !sig.definedIn(program.source) ||
        sig.dispatcher ||
        sig.compileTimeOnly() ||
        (!sig.foreign() && !hostVisible(mode, exported, entry))
      ) {
        continue
      }
      const params = paramList(sig.decl)
      let i = 0
      while (i < sig.paramTypes.length) {
        if (!sig.isCompileTime(i)) {
          const at = params !== null && i < params.children.length ? params.children[i] : sig.decl
          if (holdsFnRef(table, sig.paramTypes[i])) {
            ctx.error(at, hostReferenceMessage(`Parameter \`${sig.paramNames[i]}\` of \`${sig.sourceName}\``))
          }
          classesOf(table, sig.paramTypes[i], reached)
        }
        i = i + 1
      }
      if (holdsFnRef(table, sig.returnType)) {
        const at =
          sig.decl.kind !== N_CONSTRUCTOR && sig.decl.children.length > 2 ? sig.decl.children[2] : sig.decl
        ctx.error(at, hostReferenceMessage(`The return type of \`${sig.sourceName}\``))
      }
      classesOf(table, sig.returnType, reached)
    }
  }
  // The classes those signatures reach, and the classes their fields reach.
  let k = 0
  while (k < reached.length) {
    for (const ctx of contexts) {
      for (const info of ctx.program.structList) {
        if (info.type === reached[k]) {
          for (const field of info.fields) {
            classesOf(ctx.table, field.type, reached)
          }
        }
      }
    }
    k = k + 1
  }
  for (const ctx of contexts) {
    for (const info of ctx.program.structList) {
      if (info.origin !== ctx.program.source || (!mode.everyLayoutShared && reached.indexOf(info.type) < 0)) {
        continue
      }
      for (const field of info.fields) {
        if (holdsFnRef(ctx.table, field.type)) {
          ctx.error(
            fieldNode(info, field.name),
            hostReferenceMessage(`Field \`${field.name}\` of \`${info.name}\``)
          )
        }
      }
    }
  }
}

/** The declaration of field `name` in `info`'s class, or the class when none is written. */
const fieldNode = (info: StructInfo, name: string): Node => {
  const decl = info.decl
  if (decl.kind === N_CLASS && decl.children.length > 3) {
    for (const member of decl.children[3].children) {
      if (member.kind === N_FIELD && member.children[0].text === name) {
        return member
      }
    }
  }
  return decl
}

/** How a member came into a call's set, after "reaches `h`". */
const reachText = (via: string): string =>
  via !== "" ? `through ${via}` : "through a value whose functions this compiler cannot follow"

/**
 * The escape-join refusal (§2.2): a call through `shown` whose set holds
 * `keeper`, which keeps its parameter `param`, and `other`, which does not.
 */
export const escapeJoinMessage = (
  shown: string,
  keeper: string,
  other: string,
  param: string,
  via: string
): string =>
  `this call through \`${shown}\` can reach \`${keeper}\`, which keeps \`${param}\`, and \`${other}\`, which does ` +
  `not, so every call here would allocate \`${param}\` in the arena; \`${keeper}\` reaches \`${shown}\` ` +
  `${reachText(via)}: call \`${keeper}\` directly, or store it where \`${shown}\` does not read`

/** The warning for a call whose set passes eight members (§2.2), naming the stores that widened it. */
export const wideSetMessage = (shown: string, count: i32, vias: string[]): string => {
  const seen = new StringSet()
  const named: string[] = []
  let wide = false
  for (const via of vias) {
    if (via === "") {
      wide = true
    } else if (seen.add(via)) {
      named.push(via)
    }
  }
  if (wide) {
    named.push("a value whose functions this compiler cannot follow")
  }
  return (
    `this call through \`${shown}\` can reach ${count} functions, more than eight, so it branches on a ` +
    `\`switch\` of them where a direct call would not; they came in through ${named.join(", ")}`
  )
}

/** The size past which a call's set is warned. */
export const WIDE_SET: i32 = 8
