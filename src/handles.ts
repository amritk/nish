/**
 * WP40 §4: the owned foreign handle. A class with one `CPtr` field owns the C
 * resource the field points to, and its `[Symbol.dispose]` names the one C
 * function that closes it. The rules here keep every value of such a class,
 * and every name for its pointer, inside the `using` block that opens it, so
 * that the close that block emits is the last thing that touches the pointer
 * (`docs/wp40-ffi-buffers-handles.md` §4a–§4d).
 *
 * The shape of the class (one `readonly` field, no type parameters, no
 * `implements`, no `export`, no typed JSON) is checked where the class is
 * collected (`src/structs.ts`), and a type argument naming it where a template
 * is instantiated (`src/generics.ts`). This pass runs once every body is
 * checked, over the checked tables: the dispose shape, where the class's name
 * may be written, and where a value of the class and its pointer may go.
 */

import { CheckContext } from "./context"
import { unwrapParens, isAssignmentOperator } from "./emit-util"
import { StringSet } from "./map"
import {
  FLAG_CONST,
  FLAG_DEFAULT,
  FLAG_EXPORTED,
  FLAG_FOREIGN,
  FLAG_OPTIONAL,
  FLAG_PROPERTY,
  FLAG_REST,
  FLAG_STATIC,
  FLAG_USING,
  N_ARROW,
  N_BINARY,
  N_BLOCK,
  N_CALL,
  N_CLASS,
  N_CONSTRUCTOR,
  N_EMPTY,
  N_EXPR_STMT,
  N_FUNCTION,
  N_IDENT,
  N_IF,
  N_LIST,
  N_MEMBER,
  N_METHOD,
  N_NEW,
  N_NULL,
  N_PARAM,
  N_PAREN,
  N_RETURN,
  N_SOURCE_FILE,
  N_THIS,
  N_TYPE_ARRAY,
  N_TYPE_FUNCTION,
  N_TYPE_LITERAL,
  N_TYPE_NULL,
  N_TYPE_OPERATOR,
  N_TYPE_PAREN,
  N_TYPE_READONLY,
  N_TYPE_REF,
  N_TYPE_UNION,
  N_VAR,
  N_VAR_DECL,
  Node,
} from "./nodes"
import { CheckedProgram, FunctionSig, ROLE_FUNCTION, ROLE_METHOD, StructInfo } from "./program"
import { DISPOSE_METHOD } from "./parallel"
import { Local, sourceLocal } from "./symbols"
import { TypeTable } from "./types"

/** One refusal of the handle rules: where, and the sentence. */
export class HandleFinding {
  node: Node
  message: string

  constructor(node: Node, message: string) {
    this.node = node
    this.message = message
  }
}

// ---- The sentences ---------------------------------------------------------

export const handlePointerMessage = (cls: string, field: string): string =>
  `The pointer \`${field}\` of handle class \`${cls}\` cannot be used here: a handle's pointer may be read only as \`this.${field}\` in a method of its class, passed straight to a \`declare function\` or bound once to a \`const\`, so that no name for it outlives the object or reaches a second close`

export const handleValueMessage = (cls: string): string =>
  `A \`${cls}\` cannot be used here: a handle may only be opened by \`using\`, called, or lent to a parameter of its type, so that the close its \`using\` block emits is the last thing that names it`

export const handleTypeMessage = (cls: string): string =>
  `\`${cls}\` is a handle class, and its name may be written only as the type of a parameter that borrows one: a handle lives in the \`using\` block that opens it, and a value of this type anywhere else could outlive the close`

export const handleWriteMessage = (cls: string, field: string): string =>
  `The pointer \`${field}\` of handle class \`${cls}\` is written only once, by \`this.${field} = g(...)\` as a statement at the top of the constructor, where \`g\` is a \`declare function\` and nothing before it leaves the constructor: any other write would replace or copy a pointer the object owns`

export const handleFieldMessage = (cls: string): string =>
  `Handle class \`${cls}\`: a handle class declares exactly one \`CPtr\` or \`CPtr | null\` field, \`readonly\` and with no initialiser, so the one pointer it owns is written once by its constructor and closed once by its dispose`

export const handleHeaderMessage = (cls: string, what: string): string =>
  `Handle class \`${cls}\` cannot ${what}: a handle class has no type parameters, no \`implements\` and no \`export\`, so no other type and no other module can name it`

export const handleJsonMessage = (cls: string): string =>
  `Handle class \`${cls}\` cannot declare \`static readonly json\`: a handle is never serialised, and its options would name the pointer it owns`

const noDisposeMessage = (cls: string, field: string): string =>
  `Handle class \`${cls}\` must declare \`[Symbol.dispose](): void\` closing \`this.${field}\`: a class that owns a C pointer and names no close would leak it at every exit`

const disposeShapeMessage = (cls: string, field: string): string =>
  `The \`[Symbol.dispose]\` of handle class \`${cls}\` must take no parameters, return \`void\` and be exactly \`close(this.${field});\` or \`const p = this.${field}; if (p !== null) { close(p); }\` for a \`declare function\` \`close\`: the \`using\` block emits that call at every exit and runs nothing else`

const closeUnknownMessage = (name: string, cls: string): string =>
  `\`${name}\` in the \`[Symbol.dispose]\` of handle class \`${cls}\` is not a \`declare function\`: a handle is closed by the C function its dispose names, and nothing else`

const closeArityMessage = (name: string, cls: string): string =>
  `The close \`${name}\` of handle class \`${cls}\` must take exactly one argument, the pointer the object owns, and be declared with one parameter`

const closeTypeMessage = (
  name: string,
  cls: string,
  field: string,
  param: string,
  arg: string,
  type: string
): string =>
  `The close \`${name}\` of handle class \`${cls}\` takes \`${param}\`, and \`${arg}\` is \`${type}\`: test a \`CPtr | null\` field through a \`const\` first, as in \`const p = this.${field}; if (p !== null) { ${name}(p); }\``

const closeCallMessage = (name: string, cls: string): string =>
  `\`${name}\` is the close of handle class \`${cls}\`, and only its \`[Symbol.dispose]\` may call it on the pointer the object owns: the \`using\` block closes it at every exit, so a close written here would be followed by a use after close and a second close`

const usingMessage = (cls: string): string =>
  `\`using\` of handle class \`${cls}\` is not lowered yet: the declaration is checked, and the close waits for the release that emits it`

// ---- Which types are handles -----------------------------------------------

/**
 * The handle class `type` is, through a `| null`, or `null`. A handle class is
 * never exported (§4a H), so the module that names one is the module that
 * declares it, and `program.struct` finds it.
 */
export const handleOf = (program: CheckedProgram, table: TypeTable, type: i32): StructInfo | null => {
  if (type < 0) {
    return null
  }
  const bare = table.stripNull(type)
  if (!table.isStruct(bare)) {
    return null
  }
  const info = program.struct(table.nameOf(bare))
  return info !== null && info.handle && info.type === bare ? info : null
}

/**
 * A type argument that is a handle class, written or inferred (`id(f)`): the
 * instance would name the class outside a borrowing parameter (§4d).
 */
export const rejectHandleArgument = (ctx: CheckContext, type: i32, at: Node): boolean => {
  const info = handleOf(ctx.program, ctx.table, type)
  if (info === null) {
    return false
  }
  ctx.error(at, handleTypeMessage(info.name))
  return true
}

/** Whether the annotation `type` is `CPtr` or `CPtr | null` as written, the one shape a handle's field takes (§4a D1). */
export const isHandleFieldAnnotation = (type: Node): boolean => {
  let at = type
  while (at.kind === N_TYPE_PAREN) {
    at = at.children[0]
  }
  if (at.kind === N_TYPE_REF) {
    return at.text === "CPtr" && at.children[0].children.length === 0
  }
  if (at.kind !== N_TYPE_UNION || at.children.length !== 2) {
    return false
  }
  let pointers = 0
  let nulls = 0
  for (const member of at.children) {
    let inner = member
    while (inner.kind === N_TYPE_PAREN) {
      inner = inner.children[0]
    }
    if (inner.kind === N_TYPE_NULL) {
      nulls = nulls + 1
    } else if (
      inner.kind === N_TYPE_REF &&
      inner.text === "CPtr" &&
      inner.children[0].children.length === 0
    ) {
      pointers = pointers + 1
    }
  }
  return pointers === 1 && nulls === 1
}

// ---- The dispose ------------------------------------------------------------

/** The close a handle class's dispose names, once it has been found sound. */
class HandleClose {
  info: StructInfo
  sig: FunctionSig

  constructor(info: StructInfo, sig: FunctionSig) {
    this.info = info
    this.sig = sig
  }
}

/** Whether `expr` is `this.<field>`. */
const isThisField = (expr: Node, field: string): boolean => {
  const at = unwrapParens(expr)
  return (
    at.kind === N_MEMBER &&
    (at.flags & FLAG_OPTIONAL) === 0 &&
    at.text === field &&
    unwrapParens(at.children[0]).kind === N_THIS
  )
}

/** The `close(arg)` a statement is, when it is one call statement with a named callee and one argument; otherwise `null`. */
const closeStatement = (stmt: Node): Node | null => {
  if (stmt.kind !== N_EXPR_STMT) {
    return null
  }
  const call = unwrapParens(stmt.children[0])
  if (call.kind !== N_CALL || (call.flags & FLAG_OPTIONAL) !== 0 || call.children[0].kind !== N_IDENT) {
    return null
  }
  return call
}

/** The `[Symbol.dispose]` member of a class declaration, or `null`. */
const disposeMethod = (decl: Node): Node | null => {
  for (const member of decl.children[3].children) {
    if (member.kind === N_METHOD && member.children[0].text === DISPOSE_METHOD) {
      return member
    }
  }
  return null
}

/**
 * The call a dispose body is, in one of its two shapes (§4b), and whether it
 * passes the field through a tested `const`; `null` for any other body.
 */
const disposeCall = (body: Node, field: string): Node | null => {
  const stmts = body.children
  if (stmts.length === 1) {
    const call = closeStatement(stmts[0])
    return call !== null &&
      call.children[1].children.length >= 1 &&
      isThisField(call.children[1].children[0], field)
      ? call
      : null
  }
  if (stmts.length !== 2) {
    return null
  }
  const bind = stmts[0]
  if (bind.kind !== N_VAR || (bind.flags & FLAG_CONST) === 0 || (bind.flags & FLAG_USING) !== 0) {
    return null
  }
  const decls = bind.children[0].children
  if (decls.length !== 1 || decls[0].children[0].kind !== N_IDENT || decls[0].children[1].kind !== N_EMPTY) {
    return null
  }
  if (decls[0].children[2].kind === N_EMPTY || !isThisField(decls[0].children[2], field)) {
    return null
  }
  const local = decls[0].children[0].text
  const test = stmts[1]
  if (test.kind !== N_IF || test.children[2].kind !== N_EMPTY) {
    return null
  }
  const cond = unwrapParens(test.children[0])
  if (cond.kind !== N_BINARY || cond.text !== "!==") {
    return null
  }
  const left = unwrapParens(cond.children[0])
  const right = unwrapParens(cond.children[1])
  if (left.kind !== N_IDENT || left.text !== local || right.kind !== N_NULL) {
    return null
  }
  const then = test.children[1]
  if (then.kind !== N_BLOCK || then.children.length !== 1) {
    return null
  }
  const call = closeStatement(then.children[0])
  if (call === null || call.children[1].children.length < 1) {
    return null
  }
  const arg = unwrapParens(call.children[1].children[0])
  return arg.kind === N_IDENT && arg.text === local ? call : null
}

/** The module function called `name`, or `null`. */
const functionNamed = (program: CheckedProgram, name: string): FunctionSig | null => {
  for (const sig of program.functions) {
    if (sig.role === ROLE_FUNCTION && sig.instance === null && sig.sourceName === name) {
      return sig
    }
  }
  return null
}

/** §4b: the dispose of a handle class this module declares, and the close it names when it is sound. */
const checkDispose = (
  program: CheckedProgram,
  table: TypeTable,
  info: StructInfo,
  out: HandleFinding[]
): HandleClose | null => {
  const cls = info.name
  const fieldName = info.handleField
  const method = disposeMethod(info.decl)
  if (method === null) {
    out.push(new HandleFinding(info.decl.children[0], noDisposeMessage(cls, fieldName)))
    return null
  }
  const returns = method.children[2]
  const returnsVoid =
    returns.kind === N_TYPE_REF && returns.text === "void" && returns.children[0].children.length === 0
  const generic = method.children.length > 4 && method.children[4].children.length > 0
  const call = disposeCall(method.children[3], fieldName)
  if (method.children[1].children.length > 0 || !returnsVoid || generic || call === null) {
    out.push(new HandleFinding(method.children[0], disposeShapeMessage(cls, fieldName)))
    return null
  }
  const name = call.children[0].text
  const sig = functionNamed(program, name)
  if (sig === null || !sig.foreign()) {
    out.push(new HandleFinding(call.children[0], closeUnknownMessage(name, cls)))
    return null
  }
  if (call.children[1].children.length !== 1 || sig.paramTypes.length !== 1) {
    out.push(new HandleFinding(call, closeArityMessage(name, cls)))
    return null
  }
  const field = info.field(fieldName)
  if (field === null) {
    return null
  }
  // Shape 1 passes the field as it is typed; shape 2 the `const` its test narrowed.
  const arg = method.children[3].children.length === 1 ? field.type : table.stripNull(field.type)
  if (!table.assignable(arg, sig.paramTypes[0])) {
    const spelled =
      method.children[3].children.length === 1 ? `this.${fieldName}` : call.children[1].children[0].text
    out.push(
      new HandleFinding(
        call.children[1].children[0],
        closeTypeMessage(
          name,
          cls,
          fieldName,
          table.typeName(sig.paramTypes[0]),
          spelled,
          table.typeName(arg)
        )
      )
    )
    return null
  }
  return new HandleClose(info, sig)
}

// ---- Where the name is written (§4d, the type positions) --------------------

/** Whether a class declaration is generic or exported, so its methods' parameters are not H2 positions. */
const closedClass = (program: CheckedProgram, decl: Node): boolean => {
  if ((decl.flags & FLAG_EXPORTED) !== 0 || decl.children[4].children.length > 0) {
    return false
  }
  const info = program.struct(decl.children[0].text)
  return info === null || !info.exported
}

/**
 * Whether `param` is a parameter that borrows a handle (H2): a plain one, of a
 * module-level function or a method this module alone can call, neither
 * generic nor `declare`d.
 */
const borrowingParam = (program: CheckedProgram, param: Node, parents: Node[]): boolean => {
  if ((param.flags & (FLAG_OPTIONAL | FLAG_REST | FLAG_DEFAULT | FLAG_PROPERTY)) !== 0) {
    return false
  }
  if (parents.length < 3 || parents[parents.length - 2].kind !== N_LIST) {
    return false
  }
  const owner = parents[parents.length - 3]
  if (owner.children[1] !== parents[parents.length - 2]) {
    return false
  }
  if (owner.kind === N_FUNCTION) {
    const top = parents.length >= 4 && parents[parents.length - 4].kind === N_SOURCE_FILE
    const generic = owner.children[4].kind === N_LIST && owner.children[4].children.length > 0
    return top && !generic && (owner.flags & (FLAG_FOREIGN | FLAG_EXPORTED)) === 0
  }
  if (owner.kind === N_METHOD) {
    if (
      (owner.flags & FLAG_STATIC) !== 0 ||
      (owner.children.length > 4 && owner.children[4].children.length > 0)
    ) {
      return false
    }
    // METHOD <- LIST of members <- CLASS
    if (parents.length < 5 || parents[parents.length - 5].kind !== N_CLASS) {
      return false
    }
    return closedClass(program, parents[parents.length - 5])
  }
  return false
}

const isTypeNode = (kind: i32): boolean =>
  kind === N_TYPE_REF ||
  kind === N_TYPE_ARRAY ||
  kind === N_TYPE_UNION ||
  kind === N_TYPE_NULL ||
  kind === N_TYPE_PAREN ||
  kind === N_TYPE_READONLY ||
  kind === N_TYPE_FUNCTION ||
  kind === N_TYPE_LITERAL ||
  kind === N_TYPE_OPERATOR

/** Every annotation naming a handle class outside an H2 parameter, and every `new` of one outside a body. */
const walkTypes = (
  program: CheckedProgram,
  node: Node,
  parents: Node[],
  depth: i32,
  out: HandleFinding[]
): void => {
  if (node.kind === N_TYPE_REF) {
    const info = program.struct(node.text)
    if (info !== null && info.handle) {
      // `parents` ends at the PARAM the annotation is the type of, if it is one.
      const parent = parents[parents.length - 1]
      if (parent.kind !== N_PARAM || parent.children[1] !== node || !borrowingParam(program, parent, parents)) {
        out.push(new HandleFinding(node, handleTypeMessage(info.name)))
      }
    }
  }
  if (node.kind === N_NEW && depth === 0) {
    const callee = node.children[0]
    const info: StructInfo | null = callee.kind === N_IDENT ? program.struct(callee.text) : null
    if (info !== null && info.handle) {
      out.push(new HandleFinding(node, handleValueMessage(info.name)))
    }
  }
  const inner =
    node.kind === N_FUNCTION || node.kind === N_METHOD || node.kind === N_CONSTRUCTOR || node.kind === N_ARROW
  parents.push(node)
  for (const child of node.children) {
    walkTypes(program, child, parents, inner ? depth + 1 : depth, out)
  }
  parents.pop()
}

// ---- Where a value and its pointer go (§4c, §4d) ----------------------------

/** What one body's walk knows. */
class HandleWalk {
  program: CheckedProgram
  table: TypeTable
  closes: HandleClose[]
  /** The handle class whose method or constructor this is, or `null`. */
  cls: StructInfo | null
  ctor: boolean
  /** The constructor's block, where the field's one write stands. */
  ctorBody: Node | null
  /** The `const`s bound to `this.<field>` (§4c R2). */
  derived: Local[]
  wroteField: boolean
  parents: Node[]
  out: HandleFinding[]

  constructor(program: CheckedProgram, table: TypeTable, closes: HandleClose[], out: HandleFinding[]) {
    this.program = program
    this.table = table
    this.closes = closes
    this.cls = null
    this.ctor = false
    this.ctorBody = null
    this.derived = []
    this.wroteField = false
    this.parents = []
    this.out = out
  }

  /** The node `up` levels above the one being visited, or `null`. */
  parent(up: i32): Node | null {
    const at = this.parents.length - up
    return at >= 0 ? this.parents[at] : null
  }

  /** The class `sig` is the close of, or `null`. */
  closeOf(sig: FunctionSig): StructInfo | null {
    for (const close of this.closes) {
      if (close.sig === sig) {
        return close.info
      }
    }
    return null
  }
}

/** How far above the node being visited its parentheses end: the parent that reads it is `walk.parent(up)`. */
const climbParens = (walk: HandleWalk): i32 => {
  let up = 1
  let at = walk.parent(up)
  while (at !== null && at.kind === N_PAREN) {
    up = up + 1
    at = walk.parent(up)
  }
  return up
}

/** The child of `walk.parent(up)` that `node` stands in: `node`, or its outermost parentheses. */
const outermost = (walk: HandleWalk, node: Node, up: i32): Node =>
  up === 1 ? node : walk.parents[walk.parents.length - up + 1]

/**
 * The call `node` is a direct argument of, when that call's callee is a
 * `declare function`; `null` otherwise. `up` is how far above `node` its
 * parentheses end.
 */
const foreignCallOf = (walk: HandleWalk, up: i32): Node | null => {
  const list = walk.parent(up)
  const call = walk.parent(up + 1)
  if (
    list === null ||
    call === null ||
    list.kind !== N_LIST ||
    call.kind !== N_CALL ||
    call.children[1] !== list
  ) {
    return null
  }
  const sig = walk.program.nodeCallees[call.id]
  return sig !== null && sig.foreign() ? call : null
}

/** The refusal of a foreign call that closes a handle's pointer outside its dispose (NL2572), if `call` is one. */
const refuseClose = (walk: HandleWalk, call: Node): boolean => {
  const sig = walk.program.nodeCallees[call.id]
  const owner: StructInfo | null = sig === null ? null : walk.closeOf(sig)
  if (owner === null) {
    return false
  }
  walk.out.push(new HandleFinding(call, closeCallMessage(sig === null ? "" : sig.sourceName, owner.name)))
  return true
}

/** Whether a statement holds a way out of the constructor: a `return`, or a `.orReturn` / `.orElse`. */
const leaves = (node: Node): boolean => {
  if (node.kind === N_RETURN) {
    return true
  }
  if (node.kind === N_MEMBER && (node.text === "orReturn" || node.text === "orElse")) {
    return true
  }
  for (const child of node.children) {
    if (leaves(child)) {
      return true
    }
  }
  return false
}

/** §4c F: whether the assignment `this.<field> = ...` is the one write the constructor may make; the assignment is `walk.parent(1)`. */
const soundWrite = (walk: HandleWalk, member: Node, assign: Node): boolean => {
  const body = walk.ctorBody
  if (!walk.ctor || body === null || assign.text !== "=" || unwrapParens(member.children[0]).kind !== N_THIS) {
    return false
  }
  const stmt = walk.parent(2)
  const block = walk.parent(3)
  if (stmt === null || block === null || stmt.kind !== N_EXPR_STMT || block !== body || walk.wroteField) {
    return false
  }
  const value = unwrapParens(assign.children[1])
  if (value.kind !== N_CALL) {
    return false
  }
  const sig = walk.program.nodeCallees[value.id]
  if (sig === null || !sig.foreign()) {
    return false
  }
  for (const earlier of body.children) {
    if (earlier === stmt) {
      break
    }
    if (leaves(earlier)) {
      return false
    }
  }
  return true
}

/** A read of `this.<field>` (§4c R1, R2); the member's parent is on the stack. */
const checkFieldRead = (walk: HandleWalk, member: Node, info: StructInfo, depth: i32): void => {
  const receiver = unwrapParens(member.children[0])
  const cls = walk.cls
  if (receiver.kind === N_THIS && cls !== null && cls === info && !walk.ctor && depth === 0) {
    const up = climbParens(walk)
    const call = foreignCallOf(walk, up)
    if (call !== null) {
      refuseClose(walk, call)
      return
    }
    const decl = walk.parent(up)
    const list = walk.parent(up + 1)
    const stmt = walk.parent(up + 2)
    if (
      decl !== null &&
      list !== null &&
      stmt !== null &&
      decl.kind === N_VAR_DECL &&
      decl.children[0].kind === N_IDENT &&
      stmt.kind === N_VAR &&
      (stmt.flags & FLAG_CONST) !== 0 &&
      (stmt.flags & FLAG_USING) === 0
    ) {
      const local = sourceLocal(walk.program.nodeLocals[decl.id])
      if (local !== null) {
        walk.derived.push(local)
        return
      }
    }
  }
  walk.out.push(new HandleFinding(member, handlePointerMessage(info.name, info.handleField)))
}

/** A use of a `const` bound to the pointer (§4c L1, L2). */
const checkDerivedUse = (walk: HandleWalk, ident: Node, depth: i32): void => {
  if (depth === 0) {
    const up = climbParens(walk)
    const call = foreignCallOf(walk, up)
    if (call !== null) {
      refuseClose(walk, call)
      return
    }
    const test = walk.parent(up)
    if (test !== null && test.kind === N_BINARY && (test.text === "===" || test.text === "!==")) {
      const left = unwrapParens(test.children[0])
      const right = unwrapParens(test.children[1])
      if (left.kind === N_NULL || right.kind === N_NULL) {
        return
      }
    }
  }
  const cls = walk.cls
  walk.out.push(
    new HandleFinding(
      ident,
      handlePointerMessage(cls === null ? "" : cls.name, cls === null ? "" : cls.handleField)
    )
  )
}

/** Whether a node of handle type `type` stands where a handle may (§4d U1, U2). */
const admittedValue = (walk: HandleWalk, node: Node, type: i32, info: StructInfo, depth: i32): boolean => {
  if ((node.kind !== N_IDENT && node.kind !== N_THIS) || depth > 0) {
    return false
  }
  const up = climbParens(walk)
  const parent = walk.parent(up)
  if (parent === null) {
    return false
  }
  if (node.kind === N_THIS && walk.ctor) {
    // In its constructor the object is half built: it may only be written to.
    const assign = walk.parent(up + 1)
    return (
      parent.kind === N_MEMBER &&
      assign !== null &&
      assign.kind === N_BINARY &&
      isAssignmentOperator(assign.text) &&
      assign.children[0] === parent
    )
  }
  if (parent.kind === N_MEMBER) {
    if ((parent.flags & FLAG_OPTIONAL) !== 0) {
      return false
    }
    const call = walk.parent(up + 1)
    if (call !== null && call.kind === N_CALL && call.children[0] === parent) {
      return walk.program.nodeCallees[call.id] !== null
    }
    return parent.text !== info.handleField && info.field(parent.text) !== null
  }
  const call = walk.parent(up + 1)
  if (parent.kind !== N_LIST || call === null || call.kind !== N_CALL || call.children[1] !== parent) {
    return false
  }
  const sig = walk.program.nodeCallees[call.id]
  if (sig === null || sig.foreign()) {
    return false
  }
  const arg = outermost(walk, node, up)
  let at = -1
  for (let i = 0; i < parent.children.length; i++) {
    if (parent.children[i] === arg) {
      at = i
    }
  }
  const index = at + (sig.role === ROLE_METHOD ? 1 : 0)
  return at >= 0 && index < sig.paramTypes.length && sig.paramTypes[index] === type
}

/** Whether `node` names a binding rather than reading one: a declarator's or a parameter's name. */
const namesBinding = (walk: HandleWalk, node: Node): boolean => {
  const parent = walk.parent(1)
  return (
    parent !== null && (parent.kind === N_VAR_DECL || parent.kind === N_PARAM) && parent.children[0] === node
  )
}

/** Whether `local` is one of the walk's pointer `const`s. */
const isDerived = (walk: HandleWalk, local: Local | null): boolean => {
  if (local === null) {
    return false
  }
  for (const derived of walk.derived) {
    if (derived === local) {
      return true
    }
  }
  return false
}

/** A `new` of a handle class in a body: only as a `using` declaration's initialiser, which is not lowered yet (NL2573). */
const checkHandleNew = (walk: HandleWalk, node: Node, info: StructInfo, depth: i32): void => {
  const up = climbParens(walk)
  const decl = walk.parent(up)
  const list = walk.parent(up + 1)
  const stmt = walk.parent(up + 2)
  const block = walk.parent(up + 3)
  const opened =
    depth === 0 &&
    decl !== null &&
    decl.kind === N_VAR_DECL &&
    decl.children[2] === outermost(walk, node, up) &&
    list !== null &&
    stmt !== null &&
    stmt.kind === N_VAR &&
    (stmt.flags & FLAG_USING) !== 0 &&
    block !== null &&
    block.kind === N_BLOCK
  walk.out.push(new HandleFinding(node, opened ? usingMessage(info.name) : handleValueMessage(info.name)))
}

const walkValues = (walk: HandleWalk, node: Node, depth: i32): void => {
  if (isTypeNode(node.kind)) {
    return
  }
  const program = walk.program
  if (node.kind === N_MEMBER) {
    const owner = handleOf(program, walk.table, program.nodeTypes[unwrapParens(node.children[0]).id])
    if (owner !== null && node.text === owner.handleField) {
      const parent = walk.parent(1)
      if (
        parent !== null &&
        parent.kind === N_BINARY &&
        isAssignmentOperator(parent.text) &&
        parent.children[0] === node
      ) {
        if (soundWrite(walk, node, parent)) {
          walk.wroteField = true
        } else {
          walk.out.push(new HandleFinding(parent, handleWriteMessage(owner.name, owner.handleField)))
        }
      } else {
        checkFieldRead(walk, node, owner, depth)
      }
      return
    }
  }
  if (
    node.kind === N_IDENT &&
    !namesBinding(walk, node) &&
    isDerived(walk, sourceLocal(program.nodeLocals[node.id]))
  ) {
    checkDerivedUse(walk, node, depth)
    return
  }
  if (node.kind === N_NEW) {
    const info = handleOf(program, walk.table, program.nodeTypes[node.id])
    if (info !== null) {
      checkHandleNew(walk, node, info, depth)
      walk.parents.push(node)
      walkValues(walk, node.children[2], depth)
      walk.parents.pop()
      return
    }
  }
  if (node.kind !== N_PAREN && !namesBinding(walk, node)) {
    const type = program.nodeTypes[node.id]
    const info = handleOf(program, walk.table, type)
    if (info !== null && !admittedValue(walk, node, type, info, depth)) {
      walk.out.push(new HandleFinding(node, handleValueMessage(info.name)))
      return
    }
  }
  const inner = node.kind === N_ARROW || node.kind === N_FUNCTION
  walk.parents.push(node)
  for (const child of node.children) {
    walkValues(walk, child, inner ? depth + 1 : depth)
  }
  walk.parents.pop()
}

/**
 * Every refusal of the handle rules in `program`. A generic body is walked
 * once per instantiation, over that instantiation's tables, so the findings
 * are kept once each.
 */
export const handleFindings = (program: CheckedProgram, table: TypeTable): HandleFinding[] => {
  const found: HandleFinding[] = []
  let any = false
  const closes: HandleClose[] = []
  for (const info of program.structList) {
    if (info.handle && info.origin === program.source) {
      any = true
      const close = checkDispose(program, table, info, found)
      if (close !== null) {
        closes.push(close)
      }
    }
  }
  if (!any) {
    return found
  }
  walkTypes(program, program.file, [], 0, found)
  for (const sig of program.functions) {
    const body = sig.body()
    if (body === null || sig.lifted || !sig.definedIn(program.source)) {
      continue
    }
    const instance = sig.instance
    if (instance !== null) {
      program.enterInstance(instance)
    }
    const walk = new HandleWalk(program, table, closes, found)
    const owner = sig.owner
    walk.cls = owner !== null && owner.handle ? owner : null
    walk.ctor = sig.role !== ROLE_FUNCTION && sig.role !== ROLE_METHOD
    walk.ctorBody = walk.ctor ? body : null
    walkValues(walk, body, 0)
    if (instance !== null) {
      program.leaveInstance()
    }
  }
  const out: HandleFinding[] = []
  const seen = new StringSet()
  for (const finding of found) {
    const key = `${finding.node.start}/${finding.node.end}/${finding.message}`
    if (!seen.has(key)) {
      seen.add(key)
      out.push(finding)
    }
  }
  return out
}
