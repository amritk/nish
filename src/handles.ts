/**
 * WP53 §4, WP89 S5a: the owned foreign handle. A handle class owns the native
 * resources its owned fields hold — each a `CPtr`, an opaque `declare class`,
 * a `HostHandle<K>` or another handle class — and its `[Symbol.dispose]` names
 * the C function that closes each native one, in the reverse of their
 * declaration order; a field holding a handle class closes itself the same
 * way, from the dispose of its own class. The rules here keep every value of
 * such a class, and every name for its pointers, inside the one owner that
 * closes it: the `using` block that opens it, or the handle class it was
 * moved into. The close that owner emits is the last thing that touches each
 * pointer (`docs/wp53-ffi-buffers-handles.md` §4a–§4d).
 *
 * The shape of the class (`readonly` owned fields, no type parameters, no
 * `implements`, no typed JSON) is checked where the class is collected
 * (`src/structs.ts`), and a type argument naming it where a template is
 * instantiated (`src/generics.ts`). The two passes here run once every body
 * is checked, over the checked tables: `handleDisposes`, for every module
 * first, settles each class's closes and the constructor parameters it takes
 * ownership of; `handleFindings` then checks where the class's name may be
 * written, and where a value of the class and its pointers may go, which for
 * an imported class reads what the first pass settled in its own module.
 */

import { CheckContext } from "./context"
import { unwrapParens, isAssignmentOperator } from "./emit-util"
import { StringSet } from "./map"
import { FLAG_CONST, FLAG_USING, Node, NodeKind } from "./nodes"
import { CheckedProgram, FieldInfo, FunctionSig, OwnedField, ROLE_CONSTRUCTOR, ROLE_FUNCTION, StructInfo } from "./program"
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

const handlePointerMessage = (cls: string, field: string): string =>
  `The pointer \`${field}\` of handle class \`${cls}\` cannot be used here: a handle's pointer may be read only as \`this.${field}\` in a method of its class, passed straight to a \`declare function\` or bound once to a \`const\`, so that no name for it outlives the object or reaches a second close`

const handleValueMessage = (cls: string): string =>
  `A \`${cls}\` cannot be used here: a handle may only be opened by \`using\`, returned by a function that opens it, moved into an owning field of a handle class, called, or lent to a parameter of its type, so that the close its owner emits is the last thing that names it`

const handleTypeMessage = (cls: string): string =>
  `\`${cls}\` is a handle class, and its name may be written only as the type of a parameter that borrows one, of a field of a handle class that owns one, or of the result of a top-level function that opens one: a value of this type anywhere else could outlive the close`

const handleWriteMessage = (cls: string, field: string): string =>
  `The pointer \`${field}\` of handle class \`${cls}\` is written only once, by \`this.${field} = g(...)\` as a statement at the top of the constructor, where \`g\` is a \`declare function\` and nothing before it leaves the constructor: any other write would replace or copy a pointer the object owns`

const childWriteMessage = (cls: string, field: string): string =>
  `The field \`${field}\` of handle class \`${cls}\` owns a handle and is written only once, by \`this.${field} = p\` as a statement at the top of the constructor, where \`p\` is a parameter of its type or a handle opened right there: any other write would drop a handle the object owns or own one twice`

export const handleFieldMessage = (cls: string): string =>
  `Handle class \`${cls}\`: each field a handle class owns is a \`CPtr\`, an opaque \`declare class\`, a \`HostHandle\` or another handle class that does not hold this one, each perhaps \`| null\`, \`readonly\` and with no initialiser, so it is written once by the constructor and closed once by the dispose`

export const handleHeaderMessage = (cls: string, what: string): string =>
  `Handle class \`${cls}\` cannot ${what}: a handle class has no type parameters and no \`implements\`, so no other type can stand for it and outlive its close`

export const handleJsonMessage = (cls: string): string =>
  `Handle class \`${cls}\` cannot declare \`static readonly json\`: a handle is never serialised, and its options would name the pointer it owns`

const noDisposeMessage = (cls: string, field: string): string =>
  `Handle class \`${cls}\` must declare \`[Symbol.dispose](): void\` closing \`this.${field}\`: a class that owns a C pointer and names no close would leak it at every exit`

const stepShapes = (field: string): string =>
  `\`close(this.${field});\` or \`const p = this.${field}; if (p !== null) { close(p); }\` for a \`declare function\` \`close\``

const disposeShapeMessage = (cls: string, natives: string[]): string => {
  let body = "have an empty body, since the handle-class fields it owns close themselves"
  if (natives.length === 1) {
    body = `be exactly ${stepShapes(natives[0])}`
  } else if (natives.length > 1) {
    const order: string[] = []
    for (let i = natives.length - 1; i >= 0; i--) {
      order.push(`\`this.${natives[i]}\``)
    }
    body = `close ${order.join(", then ")}, the reverse of their declaration, each as ${stepShapes("f")}`
  }
  return `The \`[Symbol.dispose]\` of handle class \`${cls}\` must take no parameters, return \`void\` and ${body}: its owner emits these closes at every exit and runs nothing else`
}

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

// ---- Which types are handles -----------------------------------------------

/**
 * The handle class `type` is, through a `| null`, or `null`. The struct table
 * of a module holds every class it names, its imports' included, so an
 * imported handle class is found by its type id.
 */
const handleOf = (program: CheckedProgram, table: TypeTable, type: i32): StructInfo | null => {
  if (type < 0) {
    return null
  }
  const bare = table.stripNull(type)
  if (!table.isStruct(bare)) {
    return null
  }
  const info = program.structByType(bare)
  return info !== null && info.handle ? info : null
}

/** The handle class a `Result<H, E>` carries, or `null`. */
const resultHandleOf = (program: CheckedProgram, table: TypeTable, type: i32): StructInfo | null =>
  type >= 0 && table.isResult(type) ? handleOf(program, table, table.okOf(type)) : null

/**
 * H1.2: the handle class a `using` declarator's initialiser `init` opens: a
 * `new` of one, a call of a function that opens one, or a conditional of
 * those; `null` for a scope, an arena, a guard or a name. The walk below
 * admits no other fresh handle there, so the block closes what this names.
 */
export const openedHandle = (program: CheckedProgram, table: TypeTable, init: Node): StructInfo | null => {
  const at = unwrapParens(init)
  if (at.kind !== NodeKind.New && at.kind !== NodeKind.Call && at.kind !== NodeKind.Conditional) {
    return null
  }
  return handleOf(program, table, program.nodeTypes[at.id])
}

/**
 * The C functions that close a value of handle class `info`, in the order its
 * owner calls them: its owned fields in the reverse of their declaration,
 * a handle-class field's own closes in its place. A class holding itself is
 * refused before any of this is emitted; the depth only bounds the walk.
 */
export const ownedCloses = (info: StructInfo): FunctionSig[] => {
  const out: FunctionSig[] = []
  collectCloses(info, out, 0)
  return out
}

const collectCloses = (info: StructInfo, out: FunctionSig[], depth: i32): void => {
  if (depth > 32) {
    return
  }
  for (let i = info.owned.length - 1; i >= 0; i--) {
    const field = info.owned[i]
    const child = field.child
    const close = field.close
    if (child !== null) {
      collectCloses(child, out, depth + 1)
    } else if (close !== null) {
      out.push(close)
    }
  }
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

/** Whether the annotation `type` is `CPtr` or `CPtr | null` as written, the one shape a handle's pointer field takes (§4a D1). */
export const isHandleFieldAnnotation = (type: Node): boolean => {
  let at = type
  while (at.kind === NodeKind.TypeParen) {
    at = at.children[0]
  }
  if (at.kind === NodeKind.TypeRef) {
    return at.text === "CPtr" && at.children[0].children.length === 0
  }
  if (at.kind !== NodeKind.TypeUnion || at.children.length !== 2) {
    return false
  }
  let pointers = 0
  let nulls = 0
  for (const member of at.children) {
    let inner = member
    while (inner.kind === NodeKind.TypeParen) {
      inner = inner.children[0]
    }
    if (inner.kind === NodeKind.TypeNull) {
      nulls = nulls + 1
    } else if (
      inner.kind === NodeKind.TypeRef &&
      inner.text === "CPtr" &&
      inner.children[0].children.length === 0
    ) {
      pointers = pointers + 1
    }
  }
  return pointers === 1 && nulls === 1
}

// ---- The dispose ------------------------------------------------------------

/** The member a `this.<field>` names, or `""` when `expr` is not one. */
const thisField = (expr: Node): string => {
  const at = unwrapParens(expr)
  return at.kind === NodeKind.Member && unwrapParens(at.children[0]).kind === NodeKind.This ? at.text : ""
}

/** The `close(arg)` a statement is, when it is one call statement with a named callee and one argument; otherwise `null`. */
const closeStatement = (stmt: Node): Node | null => {
  if (stmt.kind !== NodeKind.ExprStmt) {
    return null
  }
  const call = unwrapParens(stmt.children[0])
  if (call.kind !== NodeKind.Call || call.children[0].kind !== NodeKind.Ident) {
    return null
  }
  return call.children[1].children.length > 0 ? call : null
}

/** The `[Symbol.dispose]` member of a class declaration, or `null`. */
const disposeMethod = (decl: Node): Node | null => {
  for (const member of decl.children[3].children) {
    if (member.kind === NodeKind.Method && member.children[0].text === DISPOSE_METHOD) {
      return member
    }
  }
  return null
}

/** One close of a dispose body (§4b): the field it closes, its call, and whether it tests the field first. */
class DisposeStep {
  field: string
  call: Node
  tested: boolean

  constructor(field: string, call: Node, tested: boolean) {
    this.field = field
    this.call = call
    this.tested = tested
  }
}

/**
 * The tested shape of a close, `const p = this.f; if (p !== null) { close(p); }`,
 * at `stmts[at]` and `stmts[at + 1]`, or `null`. A `HostHandle`'s "none" is
 * `0`, so its test may be `p !== 0`.
 */
const testedStep = (stmts: Node[], at: i32): DisposeStep | null => {
  if (at + 1 >= stmts.length) {
    return null
  }
  // Only a variable statement or a `const enum` carries `FLAG_CONST`, and an
  // enum is declared at module level, not in a body.
  const bind = stmts[at]
  if ((bind.flags & FLAG_CONST) === 0 || (bind.flags & FLAG_USING) !== 0) {
    return null
  }
  const decls = bind.children[0].children
  if (decls.length !== 1 || decls[0].children[1].kind !== NodeKind.Empty) {
    return null
  }
  const field = thisField(decls[0].children[2])
  if (field === "") {
    return null
  }
  const local = decls[0].children[0].text
  const test = stmts[at + 1]
  if (test.kind !== NodeKind.If || test.children[2].kind !== NodeKind.Empty) {
    return null
  }
  // Only a binary operator is spelled `!==`.
  const cond = unwrapParens(test.children[0])
  if (cond.text !== "!==") {
    return null
  }
  const left = unwrapParens(cond.children[0])
  const right = unwrapParens(cond.children[1])
  const none = right.kind === NodeKind.Null || (right.kind === NodeKind.Number && right.text === "0")
  if (left.kind !== NodeKind.Ident || left.text !== local || !none) {
    return null
  }
  // A braceless `if` has the call itself as its one child, which `closeStatement` refuses.
  const then = test.children[1]
  if (then.children.length !== 1) {
    return null
  }
  const call = closeStatement(then.children[0])
  if (call === null) {
    return null
  }
  const arg = unwrapParens(call.children[1].children[0])
  return arg.kind === NodeKind.Ident && arg.text === local ? new DisposeStep(field, call, true) : null
}

/** The closes a dispose body is (§4b), in order, or `null` for a body of any other shape. */
const disposeSteps = (body: Node): DisposeStep[] | null => {
  const stmts = body.children
  const steps: DisposeStep[] = []
  let at = 0
  while (at < stmts.length) {
    const call = closeStatement(stmts[at])
    const field = call === null ? "" : thisField(call.children[1].children[0])
    if (call !== null && field !== "") {
      steps.push(new DisposeStep(field, call, false))
      at = at + 1
      continue
    }
    const tested = testedStep(stmts, at)
    if (tested === null) {
      return null
    }
    steps.push(tested)
    at = at + 2
  }
  return steps
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

/** The `declare function` a dispose's `name` calls: one this module declares or imports. */
const foreignNamed = (program: CheckedProgram, name: string): FunctionSig | null => {
  let sig = functionNamed(program, name)
  if (sig === null) {
    for (const binding of program.imports) {
      if (binding.localName === name && binding.sig !== null) {
        sig = binding.sig
      }
    }
  }
  return sig !== null && sig.foreign() ? sig : null
}

/** §4b: the dispose of a handle class this module declares; each native field's close is set when it is sound. */
const checkDispose = (
  program: CheckedProgram,
  table: TypeTable,
  info: StructInfo,
  out: HandleFinding[]
): void => {
  const cls = info.name
  const natives: OwnedField[] = []
  const names: string[] = []
  for (const field of info.owned) {
    if (field.child === null) {
      natives.push(field)
      names.push(field.name)
    }
  }
  const method = disposeMethod(info.decl)
  if (method === null) {
    if (natives.length > 0) {
      out.push(new HandleFinding(info.decl.children[0], noDisposeMessage(cls, natives[0].name)))
    }
    return
  }
  // Only a type reference is spelled `void`: a string literal type is not one the parser takes.
  const returns = method.children[2]
  const returnsVoid = returns.text === "void" && returns.children[0].children.length === 0
  const steps = disposeSteps(method.children[3])
  let ordered = steps !== null && steps.length === natives.length
  if (steps !== null && ordered) {
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].field !== natives[natives.length - 1 - i].name) {
        ordered = false
      }
    }
  }
  if (method.children[1].children.length > 0 || !returnsVoid || steps === null || !ordered) {
    out.push(new HandleFinding(method.children[0], disposeShapeMessage(cls, names)))
    return
  }
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const owned = natives[natives.length - 1 - i]
    const call = step.call
    const name = call.children[0].text
    const sig = foreignNamed(program, name)
    if (sig === null) {
      out.push(new HandleFinding(call.children[0], closeUnknownMessage(name, cls)))
      continue
    }
    if (call.children[1].children.length !== 1 || sig.paramTypes.length !== 1) {
      out.push(new HandleFinding(call, closeArityMessage(name, cls)))
      continue
    }
    const field = info.field(owned.name)
    if (field === null) {
      continue
    }
    // The bare shape passes the field as it is typed; the tested one the `const` its test narrowed.
    const arg = step.tested ? table.stripNull(field.type) : field.type
    if (!table.assignable(arg, sig.paramTypes[0])) {
      const shown = step.tested ? call.children[1].children[0].text : `this.${owned.name}`
      out.push(
        new HandleFinding(
          call.children[1].children[0],
          closeTypeMessage(
            name,
            cls,
            owned.name,
            table.typeName(sig.paramTypes[0]),
            shown,
            table.typeName(arg)
          )
        )
      )
      continue
    }
    owned.close = sig // H1.2: what each exit of its owner calls
    owned.tested = step.tested
  }
}

/** Whether `info` is reached again through the handle-class fields of `at`. */
const holds = (info: StructInfo, at: StructInfo, depth: i32): boolean => {
  if (depth > 32) {
    return true
  }
  for (const field of at.owned) {
    const child = field.child
    if (child !== null && (child === info || holds(info, child, depth + 1))) {
      return true
    }
  }
  return false
}

/**
 * The constructor parameters a handle class takes ownership of: a statement
 * `this.<field> = <param>` at the top of its constructor, for a field holding
 * a handle class. Each parameter moves into one field, the first that names it.
 */
const findSinks = (info: StructInfo): void => {
  const ctor = info.ctor
  if (ctor === null) {
    return
  }
  const params = ctor.decl.children[0].children
  const taken = new StringSet()
  for (const stmt of ctor.decl.children[1].children) {
    if (stmt.kind !== NodeKind.ExprStmt) {
      continue
    }
    const assign = unwrapParens(stmt.children[0])
    if (assign.kind !== NodeKind.Binary || assign.text !== "=") {
      continue
    }
    const name = thisField(assign.children[0])
    const value = unwrapParens(assign.children[1])
    if (name === "" || value.kind !== NodeKind.Ident || taken.has(value.text)) {
      continue
    }
    for (const field of info.owned) {
      if (field.name === name && field.child !== null && field.sinkAt === null) {
        for (let i = 0; i < params.length; i++) {
          if (params[i].children[0].text === value.text) {
            field.sink = i
            field.sinkAt = stmt
            taken.add(value.text)
          }
        }
      }
    }
  }
}

/**
 * The first pass, over every module before the second: for each handle class
 * this module declares, the handle class each owned field holds, whether one
 * holds itself, the constructor parameters it takes, and the close of each
 * native field its dispose names.
 */
export const handleDisposes = (program: CheckedProgram, table: TypeTable): HandleFinding[] => {
  const out: HandleFinding[] = []
  const local: StructInfo[] = []
  for (const info of program.structList) {
    if (info.handle && info.origin === program.source) {
      local.push(info)
      for (const owned of info.owned) {
        const field = info.field(owned.name)
        owned.child = field === null ? null : handleOf(program, table, field.type)
        owned.tested = field !== null && owned.child !== null && table.isNullable(field.type)
      }
    }
  }
  for (const info of local) {
    if (holds(info, info, 0)) {
      for (const member of info.decl.children[3].children) {
        const field: FieldInfo | null = member.kind === NodeKind.Field ? info.field(member.children[0].text) : null
        const child: StructInfo | null = field === null ? null : handleOf(program, table, field.type)
        if (child !== null && (child === info || holds(info, child, 0))) {
          out.push(new HandleFinding(member.children[1], handleFieldMessage(info.name)))
        }
      }
      continue
    }
    findSinks(info)
    checkDispose(program, table, info, out)
  }
  return out
}

// ---- Where the name is written (§4d, the type positions) --------------------

/** Whether a declaration has type parameters. */
const generic = (decl: Node): boolean => decl.children.length > 4 && decl.children[4].children.length > 0

/**
 * Whether the parameter `parents` ends at borrows a handle (H2): one of a
 * function, a method or a constructor that is not generic, of a class that is
 * not generic. The other parameters a handle could be written on are refused
 * before this pass: optional, rest, default and property parameters, nested
 * functions, `static` methods, and a class type on a `declare function`.
 */
const borrowingParam = (parents: Node[], at: i32): boolean => {
  if (at < 2 || parents[at].kind !== NodeKind.Param) {
    return false
  }
  const owner = parents[at - 2]
  if (owner.kind === NodeKind.FunctionDecl) {
    return !generic(owner)
  }
  if (owner.kind === NodeKind.Method || owner.kind === NodeKind.Constructor) {
    // METHOD <- LIST of members <- CLASS: an interface's methods and an object
    // literal's are refused before this pass.
    return at >= 4 && !generic(owner) && !generic(parents[at - 4])
  }
  return false
}

/** Whether the field `parents[at]` belongs to a handle class, which owns what it holds. */
const owningField = (program: CheckedProgram, parents: Node[], at: i32): boolean => {
  if (at < 2 || parents[at].kind !== NodeKind.Field || parents[at - 2].kind !== NodeKind.Class) {
    return false
  }
  const info = program.struct(parents[at - 2].children[0].text)
  return info !== null && info.handle
}

/** Whether `parents[at]` is a top-level function that is not generic: its result may be a handle it opens. */
const openingFunction = (parents: Node[], at: i32): boolean =>
  at >= 0 &&
  parents[at].kind === NodeKind.FunctionDecl &&
  !generic(parents[at]) &&
  (at === 0 || parents[at - 1].kind === NodeKind.SourceFile)

const isTypeNode = (kind: NodeKind): boolean =>
  kind === NodeKind.TypeRef ||
  kind === NodeKind.TypeArray ||
  kind === NodeKind.TypeUnion ||
  kind === NodeKind.TypeNull ||
  kind === NodeKind.TypeParen ||
  kind === NodeKind.TypeReadonly ||
  kind === NodeKind.TypeFunction ||
  kind === NodeKind.TypeLiteral ||
  kind === NodeKind.TypeOperator

/**
 * Whether the annotation `node`, a reference to a handle class, stands where
 * one may be written: through parentheses and one `| null`, the type of a
 * borrowing parameter or of an owning field, or the result of an opening
 * function, there perhaps as the value of a `Result`.
 */
const allowedAnnotation = (program: CheckedProgram, node: Node, parents: Node[]): boolean => {
  let child = node
  let at = parents.length - 1
  let result = false
  while (at >= 0) {
    const parent = parents[at]
    if (parent.kind === NodeKind.TypeParen) {
      child = parent
      at = at - 1
      continue
    }
    if (parent.kind === NodeKind.TypeUnion && parent.children.length === 2) {
      const other = parent.children[0] === child ? parent.children[1] : parent.children[0]
      if (other.kind !== NodeKind.TypeNull) {
        return false
      }
      child = parent
      at = at - 1
      continue
    }
    if (
      !result &&
      parent.kind === NodeKind.List &&
      at >= 1 &&
      parents[at - 1].kind === NodeKind.TypeRef &&
      parents[at - 1].text === "Result" &&
      parent.children.length === 2 &&
      parent.children[0] === child
    ) {
      result = true
      child = parents[at - 1]
      at = at - 2
      continue
    }
    break
  }
  if (at < 0) {
    return false
  }
  const holder = parents[at]
  if (holder.kind === NodeKind.Param && holder.children[1] === child) {
    return !result && borrowingParam(parents, at)
  }
  if (holder.kind === NodeKind.Field && holder.children[1] === child) {
    return !result && owningField(program, parents, at)
  }
  return holder.kind === NodeKind.FunctionDecl && holder.children[2] === child && openingFunction(parents, at)
}

/**
 * Every annotation naming a handle class where none may stand. A `new`
 * outside a body cannot be written: a module constant's initialiser is a
 * literal, and so is a field's.
 */
const walkTypes = (program: CheckedProgram, node: Node, parents: Node[], out: HandleFinding[]): void => {
  if (node.kind === NodeKind.TypeRef) {
    const info = program.struct(node.text)
    if (info !== null && info.handle && !allowedAnnotation(program, node, parents)) {
      out.push(new HandleFinding(node, handleTypeMessage(info.name)))
    }
  }
  parents.push(node)
  for (const child of node.children) {
    walkTypes(program, child, parents, out)
  }
  parents.pop()
}

// ---- Where a value and its pointers go (§4c, §4d) ---------------------------

/** What one body's walk knows. */
class HandleWalk {
  program: CheckedProgram
  table: TypeTable
  /** Every close an owned field names, and the class that owns it. */
  closes: FunctionSig[]
  closeOwners: StructInfo[]
  /** The handle class whose method or constructor this is, or `null`. */
  cls: StructInfo | null
  /** The constructor's block, where each owned field's one write stands. */
  ctorBody: Node | null
  /** The `const`s bound to `this.<field>` (§4c R2), and the field each names. */
  derived: Local[]
  derivedFields: string[]
  /** The owned fields the constructor has written so far. */
  wrote: StringSet
  /** The values a sound write moves into an owned field. */
  admitted: Node[]
  parents: Node[]
  out: HandleFinding[]
  ctor: boolean

  constructor(
    program: CheckedProgram,
    table: TypeTable,
    closes: FunctionSig[],
    closeOwners: StructInfo[],
    out: HandleFinding[]
  ) {
    this.program = program
    this.table = table
    this.closes = closes
    this.closeOwners = closeOwners
    this.cls = null
    this.ctor = false
    this.ctorBody = null
    this.derived = []
    this.derivedFields = []
    this.wrote = new StringSet()
    this.admitted = []
    this.parents = []
    this.out = out
  }

  /** The node `up` levels above the one being visited, or `null`. */
  parent(up: i32): Node | null {
    const at = this.parents.length - up
    return at >= 0 ? this.parents[at] : null
  }

  /** The class `sig` is a close of, or `null`. */
  closeOf(sig: FunctionSig): StructInfo | null {
    for (let i = 0; i < this.closes.length; i++) {
      if (this.closes[i] === sig) {
        return this.closeOwners[i]
      }
    }
    return null
  }

  isAdmitted(node: Node): boolean {
    for (const at of this.admitted) {
      if (at === node) {
        return true
      }
    }
    return false
  }

  /** The field a pointer `const` names, or `""` when `local` is not one. */
  derivedField(local: Local | null): string {
    if (local === null) {
      return ""
    }
    for (let i = 0; i < this.derived.length; i++) {
      if (this.derived[i] === local) {
        return this.derivedFields[i]
      }
    }
    return ""
  }
}

/** How far above the node being visited its parentheses end: the parent that reads it is `walk.parent(up)`. */
const climbParens = (walk: HandleWalk): i32 => {
  let up = 1
  let at = walk.parent(up)
  while (at !== null && at.kind === NodeKind.Paren) {
    up = up + 1
    at = walk.parent(up)
  }
  return up
}

/** The child of `walk.parent(up)` that `node` stands in: `node`, or its outermost parentheses. */
const outermost = (walk: HandleWalk, node: Node, up: i32): Node =>
  up === 1 ? node : walk.parents[walk.parents.length - up + 1]

/** The index of `child` in `list`, or -1. */
const indexIn = (list: Node, child: Node): i32 => {
  for (let i = 0; i < list.children.length; i++) {
    if (list.children[i] === child) {
      return i
    }
  }
  return -1
}

/**
 * The call `node` is a direct argument of, when that call's callee is a
 * `declare function`; `null` otherwise. `up` is how far above `node` its
 * parentheses end. A `HostHandle` is a scalar a Nish function may take too,
 * and only a foreign one is a use the handle rules follow.
 */
const foreignCallOf = (walk: HandleWalk, up: i32): Node | null => {
  const call = walk.parent(up + 1)
  if (call === null || call.kind !== NodeKind.Call) {
    return null
  }
  const sig = walk.program.nodeCallees[call.id]
  return sig !== null && sig.foreign() ? call : null
}

/** The refusal of a foreign call that closes a handle's pointer outside its dispose (NL2572), if `call` is one. */
const refuseClose = (walk: HandleWalk, call: Node): void => {
  const sig = walk.program.nodeCallees[call.id]
  const owner: StructInfo | null = sig === null ? null : walk.closeOf(sig)
  if (owner !== null) {
    walk.out.push(new HandleFinding(call, closeCallMessage(sig === null ? "" : sig.sourceName, owner.name)))
  }
}

/**
 * Whether the assignment `walk.parent(1)` to the owned field `name` of the
 * class being built is a statement at the top of its constructor, the first
 * write of that field. The checker has already confined it: the field is
 * `readonly`, so only `this.<field> = ...` in the constructor is written, and
 * a constructor that may return, or write the field only inside a statement
 * other than its own, leaves the field unassigned.
 */
const topWrite = (walk: HandleWalk, member: Node, name: string): boolean => {
  const block = walk.parent(3)
  const body = walk.ctorBody
  return (
    block !== null &&
    body !== null &&
    block === body &&
    !walk.wrote.has(name) &&
    unwrapParens(member.children[0]).kind === NodeKind.This
  )
}

/**
 * §4c F: a native field is written by a call (`CPtr` is returned by no
 * function but a `declare`d one), and a handle-class field by the parameter it
 * takes ownership of, or by a fresh handle, which the walk then admits.
 */
const checkOwnedWrite = (
  walk: HandleWalk,
  assign: Node,
  member: Node,
  owner: StructInfo,
  field: OwnedField
): void => {
  const value = assign.children[1]
  const bare = unwrapParens(value)
  const cls = walk.cls
  let sound = cls !== null && cls === owner && topWrite(walk, member, field.name)
  if (sound && field.child === null) {
    sound = walk.program.nodeCallees[bare.id] !== null
  } else if (sound) {
    const fresh =
      bare.kind === NodeKind.New || bare.kind === NodeKind.Call || bare.kind === NodeKind.Conditional
    const stmt = walk.parent(2)
    const moved = field.sinkAt
    sound = (stmt !== null && moved !== null && stmt === moved) || fresh
  }
  if (!sound) {
    const message =
      field.child === null
        ? handleWriteMessage(owner.name, field.name)
        : childWriteMessage(owner.name, field.name)
    walk.out.push(new HandleFinding(assign, message))
    return
  }
  walk.wrote.add(field.name)
  if (field.child !== null) {
    walk.admitted.push(value)
  }
}

/**
 * A read of a native `this.<field>` (§4c R1, R2); the member's parent is on
 * the stack. Never inside an arrow: the checker refuses an arrow that reads
 * `this`. A `this` whose pointer field this is belongs to a method of that
 * handle class.
 */
const checkFieldRead = (walk: HandleWalk, member: Node, info: StructInfo): void => {
  const receiver = unwrapParens(member.children[0])
  if (receiver.kind === NodeKind.This && !walk.ctor) {
    const up = climbParens(walk)
    const call = foreignCallOf(walk, up)
    if (call !== null) {
      refuseClose(walk, call)
      return
    }
    // A variable statement's grandchildren are its declarators. In a body
    // only a variable statement carries `FLAG_CONST`: an enum and a module
    // constant are declared at module level.
    const decl = walk.parent(up)
    const stmt = walk.parent(up + 2)
    if (
      decl !== null &&
      decl.kind === NodeKind.VarDecl &&
      stmt !== null &&
      (stmt.flags & FLAG_CONST) !== 0 &&
      (stmt.flags & FLAG_USING) === 0
    ) {
      const local = sourceLocal(walk.program.nodeLocals[decl.id])
      if (local !== null) {
        walk.derived.push(local)
        walk.derivedFields.push(member.text)
        return
      }
    }
  }
  walk.out.push(new HandleFinding(member, handlePointerMessage(info.name, member.text)))
}

/**
 * A use of a `const` bound to a pointer (§4c L1, L2). Never inside an arrow,
 * which the checker refuses to let read a local of the body it is written in.
 */
const checkDerivedUse = (walk: HandleWalk, ident: Node, field: string): void => {
  const up = climbParens(walk)
  const call = foreignCallOf(walk, up)
  if (call !== null) {
    refuseClose(walk, call)
    return
  }
  const test = walk.parent(up)
  if (test !== null && test.kind === NodeKind.Binary && (test.text === "===" || test.text === "!==")) {
    // `null` is never the left operand: the checker gives it no type there.
    const right = unwrapParens(test.children[1])
    if (right.kind === NodeKind.Null || (right.kind === NodeKind.Number && right.text === "0")) {
      return
    }
  }
  const cls = walk.cls
  walk.out.push(new HandleFinding(ident, handlePointerMessage(cls === null ? "" : cls.name, field)))
}

/** Whether the argument at `index` of a `new` of `type` is a parameter its class takes ownership of. */
const sinkAt = (walk: HandleWalk, type: i32, index: i32): boolean => {
  const info = handleOf(walk.program, walk.table, type)
  if (info === null) {
    return false
  }
  for (const field of info.owned) {
    if (field.child !== null && field.sink === index) {
      return true
    }
  }
  return false
}

/** Whether the `Ok(...)` a value stands in is the builtin `Result` constructor. */
const isOkCall = (walk: HandleWalk, call: Node): boolean =>
  call.kind === NodeKind.Call &&
  walk.program.nodeCallees[call.id] === null &&
  call.children[0].kind === NodeKind.Ident &&
  call.children[0].text === "Ok" &&
  walk.table.isResult(walk.program.nodeTypes[call.id])

/**
 * Whether a fresh handle — a `new`, a call or a conditional typed one — ends
 * where something owns it, climbing parentheses, the arms of a conditional and
 * an `Ok(...)`: a `using` declaration, a `return`, a parameter of a `new` that
 * takes ownership of it, or a sound write of an owned field (§4d U3).
 */
const freshAdmitted = (walk: HandleWalk, node: Node, depth: i32): boolean => {
  if (depth > 0) {
    return false
  }
  let child = node
  let up = 1
  let wrapped = false
  for (;;) {
    if (walk.isAdmitted(child)) {
      return !wrapped
    }
    const parent = walk.parent(up)
    if (parent === null || parent.kind === NodeKind.Return) {
      // A concise body is its own result.
      return !walk.ctor
    }
    if (
      parent.kind === NodeKind.Paren ||
      (parent.kind === NodeKind.Conditional && parent.children[0] !== child)
    ) {
      child = parent
      up = up + 1
      continue
    }
    const above = walk.parent(up + 1)
    if (parent.kind === NodeKind.List && above !== null && isOkCall(walk, above) && !wrapped) {
      wrapped = true
      child = above
      up = up + 2
      continue
    }
    if (parent.kind === NodeKind.VarDecl && parent.children[2] === child) {
      // Two levels above a declarator is its statement; only a variable
      // statement carries `FLAG_USING`.
      const stmt = walk.parent(up + 2)
      return !wrapped && stmt !== null && (stmt.flags & FLAG_USING) !== 0
    }
    if (
      parent.kind === NodeKind.List &&
      above !== null &&
      above.kind === NodeKind.New &&
      above.children[2] === parent
    ) {
      return !wrapped && sinkAt(walk, walk.program.nodeTypes[above.id], indexIn(parent, child))
    }
    return false
  }
}

/**
 * Whether a `Result` carrying a handle stands where it may: returned, through
 * parentheses and the arms of a conditional, or unwrapped at once by
 * `.expect(...)` or `.orReturn()`, which gives the fresh handle on.
 */
const resultAdmitted = (walk: HandleWalk, node: Node, depth: i32): boolean => {
  if (depth > 0) {
    return false
  }
  let child = node
  let up = 1
  for (;;) {
    const parent = walk.parent(up)
    if (parent === null || parent.kind === NodeKind.Return) {
      return !walk.ctor
    }
    if (
      parent.kind === NodeKind.Paren ||
      (parent.kind === NodeKind.Conditional && parent.children[0] !== child)
    ) {
      child = parent
      up = up + 1
      continue
    }
    const call = walk.parent(up + 1)
    return (
      parent.kind === NodeKind.Member &&
      (parent.text === "expect" || parent.text === "orReturn") &&
      call !== null &&
      call.kind === NodeKind.Call &&
      call.children[0] === parent
    )
  }
}

/**
 * Whether a name for a handle — a local, `this` or a handle-class field read
 * through its owner — of type `type` stands where it may (§4d U1, U2): the
 * receiver of a call, the left of a test against `null`, an argument lent to a
 * parameter of its type, or the value a sound write moves into an owned field.
 */
const namedAdmitted = (walk: HandleWalk, node: Node, type: i32, depth: i32): boolean => {
  if (depth > 0) {
    return false
  }
  const up = climbParens(walk)
  const parent = walk.parent(up)
  if (parent === null) {
    return false
  }
  if (node.kind === NodeKind.This && walk.ctor) {
    // In its constructor the object is half built. Its writes,
    // `this.<field> = ...`, are taken by the member above it, so `this`
    // reaches here only as a value or a method's receiver.
    return false
  }
  const arg = outermost(walk, node, up)
  if (walk.isAdmitted(arg)) {
    return true
  }
  if (parent.kind === NodeKind.Member) {
    // A method call or a field read, which the walk follows from the member.
    return true
  }
  if (parent.kind === NodeKind.Binary && (parent.text === "===" || parent.text === "!==")) {
    // `null` is never the left operand: the checker gives it no type there.
    return parent.children[0] === arg && unwrapParens(parent.children[1]).kind === NodeKind.Null
  }
  // An argument: a handle is not callable, so a call above it holds it in its
  // argument list. A `declare function` takes no class, so the callee is one
  // this program defines.
  const call = walk.parent(up + 1)
  if (call === null || parent.kind !== NodeKind.List) {
    return false
  }
  let sig: FunctionSig | null = null
  if (call.kind === NodeKind.Call && call.children[1] === parent) {
    sig = walk.program.nodeCallees[call.id]
  } else if (call.kind === NodeKind.New && call.children[2] === parent) {
    const built = walk.program.structByType(walk.table.stripNull(walk.program.nodeTypes[call.id]))
    if (built === null || sinkAt(walk, walk.program.nodeTypes[call.id], indexIn(parent, arg))) {
      // A name lent to a `new` that would own it: the handle has an owner already.
      return false
    }
    sig = built.ctor
  }
  if (sig === null) {
    return false
  }
  const at = indexIn(parent, arg)
  const index = at + (sig.role === ROLE_FUNCTION ? 0 : 1)
  return at >= 0 && index < sig.paramTypes.length && sig.paramTypes[index] === type
}

/** The owned field `member` names, when its receiver is of a handle class; `null` otherwise. */
const ownedMember = (walk: HandleWalk, member: Node): OwnedField | null => {
  const owner = handleOf(
    walk.program,
    walk.table,
    walk.program.nodeTypes[unwrapParens(member.children[0]).id]
  )
  if (owner === null) {
    return null
  }
  for (const field of owner.owned) {
    if (field.name === member.text) {
      return field
    }
  }
  return null
}

/** Whether `member` is the target of the assignment above it. */
const assignedTo = (walk: HandleWalk, member: Node): Node | null => {
  const parent = walk.parent(1)
  return parent !== null &&
    parent.kind === NodeKind.Binary &&
    isAssignmentOperator(parent.text) &&
    parent.children[0] === member
    ? parent
    : null
}

/**
 * A write of an owned child field as a statement of its own, whose value the
 * visit of its target checks: the assignment has the child's type, and names
 * nothing a later read could reach.
 */
const childWrite = (walk: HandleWalk, node: Node): boolean => {
  const stmt = walk.parent(1)
  if (stmt === null || stmt.kind !== NodeKind.ExprStmt || node.kind !== NodeKind.Binary || node.text !== "=") {
    return false
  }
  const target = node.children[0]
  return target.kind === NodeKind.Member && ownedMember(walk, target) !== null
}

const walkValues = (walk: HandleWalk, node: Node, depth: i32): void => {
  if (isTypeNode(node.kind)) {
    return
  }
  const program = walk.program
  if (node.kind === NodeKind.Member) {
    const field = ownedMember(walk, node)
    const owner = handleOf(program, walk.table, program.nodeTypes[unwrapParens(node.children[0]).id])
    if (field !== null && owner !== null) {
      const assign = assignedTo(walk, node)
      if (assign !== null) {
        checkOwnedWrite(walk, assign, node, owner, field)
        return
      }
      if (field.child === null) {
        checkFieldRead(walk, node, owner)
        return
      }
    }
  }
  // A binding's own name is walked before its initialiser binds it, and has no type.
  if (node.kind === NodeKind.Ident) {
    const field = walk.derivedField(sourceLocal(program.nodeLocals[node.id]))
    if (field !== "") {
      checkDerivedUse(walk, node, field)
      return
    }
  }
  if (node.kind !== NodeKind.Paren) {
    const type = program.nodeTypes[node.id]
    const info = handleOf(program, walk.table, type)
    const result: StructInfo | null = info === null ? resultHandleOf(program, walk.table, type) : null
    let admitted = true
    if (info !== null) {
      const fresh =
        node.kind === NodeKind.New || node.kind === NodeKind.Call || node.kind === NodeKind.Conditional
      const named =
        node.kind === NodeKind.Ident || node.kind === NodeKind.This || node.kind === NodeKind.Member
      // A `null` a nullable handle is compared with, or a factory returns,
      // names no handle at all.
      admitted =
        node.kind === NodeKind.Null ||
        (fresh
          ? freshAdmitted(walk, node, depth)
          : named
            ? namedAdmitted(walk, node, type, depth)
            : childWrite(walk, node))
    } else if (result !== null) {
      admitted = resultAdmitted(walk, node, depth)
    }
    const shown = info !== null ? info : result
    if (!admitted && shown !== null) {
      walk.out.push(new HandleFinding(node, handleValueMessage(shown.name)))
      return
    }
  }
  if (node.kind === NodeKind.New) {
    // The callee and the type arguments are names, not values.
    walk.parents.push(node)
    walkValues(walk, node.children[2], depth)
    walk.parents.pop()
    return
  }
  const inner = node.kind === NodeKind.Arrow || node.kind === NodeKind.FunctionDecl
  walk.parents.push(node)
  for (const child of node.children) {
    walkValues(walk, child, inner ? depth + 1 : depth)
  }
  walk.parents.pop()
}

/** Whether the module declares or names a handle class, so the second pass has anything to check. */
const namesHandle = (program: CheckedProgram): boolean => {
  for (const info of program.structList) {
    if (info.handle) {
      return true
    }
  }
  return false
}

/**
 * The second pass: every refusal of the handle rules in `program`'s bodies
 * and annotations. A generic body is walked once per instantiation, over that
 * instantiation's tables, so the findings are kept once each.
 */
export const handleFindings = (program: CheckedProgram, table: TypeTable): HandleFinding[] => {
  const found: HandleFinding[] = []
  if (!namesHandle(program)) {
    return found
  }
  const closes: FunctionSig[] = []
  const closeOwners: StructInfo[] = []
  for (const info of program.structList) {
    if (info.handle) {
      for (const owned of info.owned) {
        const close = owned.close
        if (close !== null) {
          closes.push(close)
          closeOwners.push(info)
        }
      }
    }
  }
  walkTypes(program, program.file, [], found)
  for (const sig of program.functions) {
    const body = sig.body()
    if (body === null || sig.lifted || !sig.definedIn(program.source)) {
      continue
    }
    const instance = sig.instance
    if (instance !== null) {
      program.enterInstance(instance)
    }
    const walk = new HandleWalk(program, table, closes, closeOwners, found)
    const owner = sig.owner
    walk.cls = owner !== null && owner.handle ? owner : null
    walk.ctor = sig.role === ROLE_CONSTRUCTOR
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
