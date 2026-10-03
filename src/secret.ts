// `nish:secret`: key material, and the rules that keep it in (docs/LANGUAGE.md,
// "Secrets").
//
// A `Secret<T>` is an ordinary generic class declared in `std/secret.ts`, so
// its layout, its escape facts and its every attribute come from the machinery
// any class gets. What makes it a secret is this module: the checker knows the
// class, and `secret`, `expose`, `exposeWith` and `wipe`, by the module that
// declares them (`isSecretSource`), and refuses every place a value of it could
// leave the program other than through `expose`.
//
// Three families of rule live here, and each runs where the facts it needs are:
//
//   - **Shape and position**, asked by the checker as it meets the construct:
//     what `T` may be, and that a `Secret` is never interpolated, printed,
//     handed to a builtin, compared with a value, branched on, indexed, read
//     into, built with `new`, or put in a field, an element or a `Result`.
//     Each is asked before the generic rule it would otherwise trip, so the one
//     diagnostic a program gets names the secret.
//   - **Ownership**, over a body once it has checked cleanly
//     (`checkSecretFlow`): a `Secret` the function makes leaves it returned or
//     wiped on every path, is not copied, is not read once wiped, and a local
//     handed to `secret` is moved. Result rule 1's two entry points, the
//     statement that drops a value and the body that never handles one, with
//     the second walked path by path rather than counted, because "wiped
//     somewhere" is not "wiped".
//   - **Exposure**, over the whole-program facts (`exposeMessages`, called from
//     `Compilation.checkSecrets`): the function `expose` runs reaches no I/O
//     and no C, keeps nothing of the value, writes nothing it is handed, and
//     declares a result that holds no `Secret`.

import { FunctionFacts, FactsTable, PointerParamFacts } from "./attributes"
import { terminatesControlFlow } from "./builtins"
import { CheckContext } from "./context"
import {
  N_ARROW,
  N_BINARY,
  N_BLOCK,
  N_BREAK,
  N_CALL,
  N_CASE,
  N_CONDITIONAL,
  N_CONTINUE,
  N_DEFAULT,
  N_DO,
  N_EMPTY,
  N_EXPR_STMT,
  N_FOR,
  N_FOR_OF,
  N_IDENT,
  N_IF,
  N_INDEX,
  N_MEMBER,
  N_NEW,
  N_NULL,
  N_PAREN,
  N_RETURN,
  N_SWITCH,
  N_THROW,
  N_TRUE,
  N_VAR,
  N_VAR_DECL,
  N_WHILE,
  Node,
} from "./nodes"
import { CheckedProgram, FunctionSig, ParallelCall, StructTemplateInfo, TemplateInfo } from "./program"
import { RuntimeTable } from "./runtime"
import { isSecretModule } from "./std-modules"
import { Local, Scope, STORAGE_PARAM } from "./symbols"
import { isInteger, T_ERROR, TypeTable } from "./types"

/** The class `nish:secret` declares. */
const SECRET_CLASS: string = "Secret"

/** What an instance of one of `nish:secret`'s templates is. */
const SECRET_NONE: i32 = 0
/** `secret(v)`. */
const SECRET_MAKE: i32 = 1
/** `expose(s, f)`. */
export const SECRET_EXPOSE: i32 = 2
/** `exposeWith(s, arg, f)`. */
export const SECRET_EXPOSE_WITH: i32 = 3
/** `wipe(x)`, whose body the emitter writes (`src/emit-secret.ts`). */
export const SECRET_WIPE: i32 = 4

// ---- Which module, which template ----------------------------------------------------------

/**
 * Whether `program` is `std/secret.ts` as `nish:secret` loads it. The package is
 * part of the test, as it is for `nish/threads`: a root-package file that sits
 * at the same path is an ordinary module whose names mean nothing here.
 */
export const isSecretSource = (program: CheckedProgram): boolean =>
  isSecretModule(program.packageName, program.source.path)

/** Whether `template` is `Secret<T>` itself. */
export const isSecretTemplate = (template: StructTemplateInfo): boolean =>
  template.sourceName === SECRET_CLASS && isSecretSource(template.home.program)

/** The `SECRET_*` role of an instantiation of `template`. */
const secretRole = (template: TemplateInfo): i32 => {
  if (template.owner !== null || !isSecretSource(template.home.program)) {
    return SECRET_NONE
  }
  const name = template.sourceName
  if (name === "secret") {
    return SECRET_MAKE
  }
  if (name === "expose") {
    return SECRET_EXPOSE
  }
  if (name === "exposeWith") {
    return SECRET_EXPOSE_WITH
  }
  return name === "wipe" ? SECRET_WIPE : SECRET_NONE
}

/** The role of the function `sig` is, or `SECRET_NONE` when it is no instance of `nish:secret`'s. */
export const secretRoleOf = (sig: FunctionSig | null): i32 => {
  if (sig === null) {
    return SECRET_NONE
  }
  const instance = sig.instance
  if (instance === null) {
    return SECRET_NONE
  }
  const template = instance.template
  return template === null ? SECRET_NONE : secretRole(template)
}

// ---- Shape ---------------------------------------------------------------------------------

/**
 * Whether `type` may be what a `Secret` holds, or what `wipe` zeroes: an array
 * of integers, or a class or interface with at least one field and only
 * integer fields. Both are one run of bytes, which is what makes a wipe one
 * store and leaves nothing behind a pointer it does not reach.
 */
export const isSecretPayload = (ctx: CheckContext, type: i32): boolean => {
  const table = ctx.table
  if (table.isArray(type)) {
    return isInteger(table.refOf(type))
  }
  if (!table.isStruct(type) || table.isSecret(type)) {
    return false
  }
  const info = ctx.program.struct(table.nameOf(type))
  if (info === null || info.fields.length === 0) {
    return false
  }
  for (const field of info.fields) {
    if (!isInteger(field.type)) {
      return false
    }
  }
  return true
}

/** `Secret<string>` and the rest: a `T` that is not one run of integers. */
export const secretShapeMessage = (table: TypeTable, inner: i32): string =>
  `\`Secret<${table.typeName(inner)}>\` is not key material: a \`Secret\` holds an array of integers ` +
  "(`u8[]`, `u32[]`, ...) or a record whose every field is an integer, because `wipe` has to reach " +
  "every byte of it with one store"

/**
 * The refusal for a struct instantiation whose arguments mention a `Secret`,
 * or "": a `Secret` is a field of `Box<Secret<u8[]>>` as surely as of a class
 * that declares one, and outlives its function there just as surely.
 */
export const secretArgumentRefusal = (table: TypeTable, templateName: string, args: i32[]): string => {
  for (const arg of args) {
    if (table.holdsSecret(arg)) {
      return containerMessage(`${templateName}<${table.typeName(arg)}>`)
    }
  }
  return ""
}

/** A `Secret` where a value outlives the function that made it: an element, a payload, a field. */
export const containerMessage = (spelled: string): string =>
  `\`${spelled}\` cannot hold a \`Secret\`: an element, a \`Result\` payload or a type argument ` +
  "outlives the function that made the secret, which then can neither return nor wipe it; " +
  "hold a `Secret` in a local or a parameter"

/** `key: Secret<u8[]>` in a class or an interface. */
export const secretFieldMessage = (field: string): string =>
  `\`${field}\` cannot be a \`Secret\`: a field of a class or interface outlives the function that ` +
  "made the secret, which then can neither return nor wipe it; hold a `Secret` in a local or a parameter"

// ---- Position ------------------------------------------------------------------------------

/** `${key}`. */
export const templateMessage = (): string =>
  "A `Secret` cannot be interpolated into a template literal: what it holds would leave in the " +
  "string. Compute with it inside `expose` and interpolate what that returns"

/** `console.log(key)`, `writeFileSync(path, key)`, `netWrite(fd, key, ...)`, ... */
const builtinMessage = (name: string): string =>
  `\`${name}\` cannot be handed a \`Secret\`: a builtin reaches the outside world or reads the bytes, ` +
  "and a `Secret` is read only through `expose`"

/** `key === other`, where `other` is not a `Secret` and not `null`. */
export const equalityMessage = (): string =>
  "A `Secret` can be compared only with another `Secret` or with `null`: comparing it with a value " +
  "would answer a question about the key, in time that depends on it. Use `timingSafeEqual` inside `expose`"

/** `if (key)`, `while (key)`, `key ? a : b`. */
export const conditionMessage = (): string =>
  "A `Secret` cannot be a condition: a branch taken on key material is a timing channel, " +
  "and a `Secret` is read only through `expose`"

/** `key[0]`, `table[key]`. */
export const indexMessage = (): string =>
  "A `Secret` cannot be indexed or be an index: either reads key material outside `expose`, " +
  "and an index that depends on a key is a cache-timing channel"

/** `key.value`. */
export const memberMessage = (name: string): string =>
  `\`${name}\` of a \`Secret\` is read only by \`nish:secret\` itself: compute with the value inside ` +
  "`expose(key, f)`, which runs `f` with it"

/** `new Secret<u8[]>(v)`. */
export const newMessage = (): string =>
  "A `Secret` is made by `secret(v)`, which moves `v` into it, not by `new`"

/** `wipe(s)` for an `s` that is not one run of integers. */
const wipeShapeMessage = (table: TypeTable, type: i32): string =>
  `\`wipe\` zeroes a \`Secret\`, or an array or record of integers, and \`${table.typeName(type)}\` is ` +
  "neither: there is no single run of bytes to store zeros over"

/**
 * The refusal of a call of `template` with the type arguments `tuple`, or "":
 * `secret(v)` for a `v` no `Secret` may hold, and `wipe(x)` for an `x` it
 * cannot zero — a nullable `Secret` included, which has to be narrowed first.
 * Asked before the instance is made, so the diagnostic is at the argument.
 */
export const secretArgumentShapeMessage = (
  ctx: CheckContext,
  template: TemplateInfo,
  tuple: i32[]
): string => {
  const role = secretRole(template)
  if (tuple.length === 0 || tuple[0] === T_ERROR) {
    return ""
  }
  const target = tuple[0]
  if (role === SECRET_MAKE && !isSecretPayload(ctx, target)) {
    return secretShapeMessage(ctx.table, target)
  }
  if (role !== SECRET_WIPE) {
    return ""
  }
  const zeroable = ctx.table.isSecret(target) ? !ctx.table.isNullable(target) : isSecretPayload(ctx, target)
  return zeroable ? "" : wipeShapeMessage(ctx.table, target)
}

/**
 * Whether the expression `arg`, as written, names a local whose current type
 * is a `Secret`. It reads the scope and never checks `arg`, so a builtin can
 * refuse a secret before its own argument checks run and say something less
 * useful about the same mistake.
 */
export const namesSecret = (ctx: CheckContext, arg: Node, scope: Scope): boolean => {
  let at = arg
  while (at.kind === N_PAREN) {
    at = at.children[0]
  }
  if (at.kind !== N_IDENT) {
    return false
  }
  const local = scope.lookup(at.text)
  return local !== null && ctx.table.isSecret(scope.typeOf(local))
}

/**
 * Refuse a builtin call one of whose arguments names a `Secret`, reporting at
 * that argument; true when it refused. `name` is the builtin as a reader looks
 * it up (`console.log`, `writeFileSync`).
 */
export const refuseSecretArguments = (ctx: CheckContext, call: Node, scope: Scope, name: string): boolean => {
  for (const arg of call.children[1].children) {
    if (namesSecret(ctx, arg, scope)) {
      ctx.error(arg, builtinMessage(name))
      return true
    }
  }
  return false
}

// ---- Ownership -----------------------------------------------------------------------------

/** `secret(make())` as a statement, or a `Secret` handed to a call without a name. */
const discardMessage = (table: TypeTable, type: i32): string =>
  `\`${table.typeName(type)}\` is made here and nobody owns it: a \`Secret\` leaves the function that ` +
  "made it returned or wiped, so bind it to a local (`const s = ...`) and `wipe(s)` once done, or return it"

/** A `return`, a `break`, a `continue` or an `orReturn()` that leaves `name` behind unwiped. */
const exitMessage = (name: string, type: string): string =>
  `\`${name}\` holds a \`${type}\` that this exit leaves neither wiped nor returned: a \`Secret\` ` +
  `leaves the function that made it returned or wiped, on every path, so \`wipe(${name})\` before it, or return it`

/** A block that can end with `name` still holding its secret. */
const scopeEndMessage = (name: string, type: string): string =>
  `\`${name}\` holds a \`${type}\` that can reach the end of its block neither wiped nor returned: ` +
  `a \`Secret\` leaves the function that made it returned or wiped, on every path, so \`wipe(${name})\` on each`

/** `s = make()` while `s` still holds a secret nobody wiped. */
const overwriteMessage = (name: string): string =>
  `\`${name}\` is assigned again while the \`Secret\` it holds is neither wiped nor returned, and that ` +
  `secret would be lost unwiped: \`wipe(${name})\` first`

/** A read of a `Secret` local or parameter that a path has wiped. */
const wipedMessage = (name: string): string =>
  `\`${name}\` may have been wiped already, and a wiped \`Secret\` holds zeros: read it before ` +
  "`wipe`, or make a new one"

/** `const t = p` for a parameter `p`, `[s]`, `c ? s : t`, ... */
const copyMessage = (name: string): string =>
  `\`${name}\` is a \`Secret\`, and a \`Secret\` is not copied: two names for one key would leave one ` +
  "of them to be wiped by nobody. Pass it to a function, return it, `wipe` it, or move a local the function " +
  "made into another (`const j = k`), after which `k` is not read"

/** A read of a local after `secret(x)` moved it. */
const movedMessage = (name: string): string =>
  `\`${name}\` was moved into a \`Secret\` by \`secret(${name})\` and cannot be read again: the ` +
  "plain array would be key material outside the `Secret`'s rules"

/** A read of a `Secret` local after `const j = k` or `j = k` moved what it held. */
const movedOutMessage = (name: string): string =>
  `\`${name}\` was moved into another \`Secret\` local and cannot be read again: one key has one owner, ` +
  "which is the one that wipes it"

/** `secret(p)` for a parameter, a field or an element. */
const unmovableMessage = (): string =>
  "`secret` takes a value only it will hold: a fresh value (a call, `new`, a literal) or a local it moves, " +
  "not a parameter, a field or an element, whose owner would keep the plain bytes"

/** A role an expression is walked in: what its value is being used for. */
const ROLE_READ: i32 = 0
/** An argument of a call: the callee borrows it. */
const ROLE_BORROW: i32 = 1
/** The argument of `wipe`. */
const ROLE_WIPE: i32 = 2
/** The value of a `return`, or a concise body. */
const ROLE_RETURN: i32 = 3
/** A declaration's initialiser, or the right of an assignment to a local. */
const ROLE_INIT: i32 = 4
/** An operand of `=== null` / `!== null`. */
const ROLE_NULL_TEST: i32 = 5
/** An arm of a ternary in a place a new secret may stand: a call may be one, a name may not. */
const ROLE_ARM: i32 = 6

/** What one path knows: per tracked variable, may it hold an unhandled secret, may it be wiped, moved. */
class FlowState {
  live: boolean[]
  wiped: boolean[]
  moved: boolean[]
  reachable: boolean

  constructor(vars: i32, movable: i32) {
    this.live = []
    this.wiped = []
    this.moved = []
    this.reachable = true
    let i = 0
    while (i < vars) {
      this.live.push(false)
      this.wiped.push(false)
      i = i + 1
    }
    i = 0
    while (i < movable) {
      this.moved.push(false)
      i = i + 1
    }
  }
}

const copyState = (s: FlowState): FlowState => {
  const out = new FlowState(s.live.length, s.moved.length)
  let i = 0
  while (i < s.live.length) {
    out.live[i] = s.live[i]
    out.wiped[i] = s.wiped[i]
    i = i + 1
  }
  i = 0
  while (i < s.moved.length) {
    out.moved[i] = s.moved[i]
    i = i + 1
  }
  out.reachable = s.reachable
  return out
}

/** Into `into`, what either path may have: an unreachable path contributes nothing. */
const mergeInto = (into: FlowState, other: FlowState): void => {
  if (!other.reachable) {
    return
  }
  if (!into.reachable) {
    let j = 0
    while (j < into.live.length) {
      into.live[j] = other.live[j]
      into.wiped[j] = other.wiped[j]
      j = j + 1
    }
    j = 0
    while (j < into.moved.length) {
      into.moved[j] = other.moved[j]
      j = j + 1
    }
    into.reachable = true
    return
  }
  let i = 0
  while (i < into.live.length) {
    into.live[i] = into.live[i] || other.live[i]
    into.wiped[i] = into.wiped[i] || other.wiped[i]
    i = i + 1
  }
  i = 0
  while (i < into.moved.length) {
    into.moved[i] = into.moved[i] || other.moved[i]
    i = i + 1
  }
}

const sameState = (a: FlowState, b: FlowState): boolean => {
  if (a.reachable !== b.reachable) {
    return false
  }
  let i = 0
  while (i < a.live.length) {
    if (a.live[i] !== b.live[i] || a.wiped[i] !== b.wiped[i]) {
      return false
    }
    i = i + 1
  }
  i = 0
  while (i < a.moved.length) {
    if (a.moved[i] !== b.moved[i]) {
      return false
    }
    i = i + 1
  }
  return true
}

/** One loop or `switch` a `break` or a `continue` can leave, and what reached its exits. */
class SecretExitTarget {
  isSwitch: boolean
  /** How many targets enclose it: a variable declared deeper than this is inside it. */
  depth: i32
  breaks: FlowState
  continues: FlowState

  constructor(isSwitch: boolean, depth: i32, vars: i32, movable: i32) {
    this.isSwitch = isSwitch
    this.depth = depth
    this.breaks = new FlowState(vars, movable)
    this.breaks.reachable = false
    this.continues = new FlowState(vars, movable)
    this.continues.reachable = false
  }
}

/**
 * The ownership walk over one body. `vars` are the `Secret` locals and
 * parameters the body names, `owned[i]` whether the body made `vars[i]` (a
 * parameter is borrowed: its caller wipes it), and `movable` every local the
 * body hands to `secret`. Diagnostics are made only while `report` is set:
 * a loop is walked to its fixpoint quietly first and then once more aloud, so
 * every node is reported once, from the state that holds on every iteration.
 */
class SecretFlow {
  ctx: CheckContext
  vars: Local[]
  owned: boolean[]
  declNodes: Node[]
  /** The block (or `for`) that declares each owned variable; a parameter's own name until then. */
  declBlocks: Node[]
  declDepths: i32[]
  movable: Local[]
  targets: SecretExitTarget[]
  report: boolean
  /** Node ids already reported, so a node reached twice in one pass says it once. */
  reported: boolean[]

  constructor(ctx: CheckContext) {
    this.ctx = ctx
    this.vars = []
    this.owned = []
    this.declNodes = []
    this.declBlocks = []
    this.declDepths = []
    this.movable = []
    this.targets = []
    this.report = true
    this.reported = []
  }

  fresh(): FlowState {
    return new FlowState(this.vars.length, this.movable.length)
  }

  varIndex(local: Local | null): i32 {
    if (local === null) {
      return -1
    }
    let i = 0
    while (i < this.vars.length) {
      if (this.vars[i] === local) {
        return i
      }
      i = i + 1
    }
    return -1
  }

  movableIndex(local: Local | null): i32 {
    if (local === null) {
      return -1
    }
    let i = 0
    while (i < this.movable.length) {
      if (this.movable[i] === local) {
        return i
      }
      i = i + 1
    }
    return -1
  }

  error(node: Node, message: string): void {
    if (!this.report) {
      return
    }
    while (this.reported.length <= node.id) {
      this.reported.push(false)
    }
    if (this.reported[node.id]) {
      return
    }
    this.reported[node.id] = true
    this.ctx.error(node, message)
    // Each finding is its own; the statement around it carries on.
    this.ctx.errored = false
  }

  typeName(i: i32): string {
    return this.ctx.table.typeName(this.vars[i].type)
  }

  /** Every owned variable declared deeper than `depth` that may still hold a secret, reported at `at`. */
  checkExit(state: FlowState, at: Node, depth: i32, keep: i32): void {
    // The first such variable is named: an exit is reported once (`error`
    // keys on the node), and the message is built outside the scan.
    let found = -1
    let i = 0
    while (i < this.vars.length && found < 0) {
      if (this.owned[i] && state.live[i] && this.declDepths[i] > depth && i !== keep) {
        found = i
      }
      i = i + 1
    }
    if (found >= 0) {
      this.error(at, exitMessage(this.vars[found].name, this.typeName(found)))
    }
  }

  /**
   * Every owned variable `block` declares that may reach its end holding a
   * secret: the first is reported, at its declaration, and all of them are
   * out of scope from here, so none is reported again further out.
   */
  checkScopeEnd(state: FlowState, block: Node): void {
    if (!state.reachable) {
      return
    }
    let found = -1
    let i = 0
    while (i < this.vars.length) {
      if (this.owned[i] && this.declBlocks[i] === block && state.live[i]) {
        if (found < 0) {
          found = i
        }
        state.live[i] = false
      }
      i = i + 1
    }
    if (found >= 0) {
      this.error(
        this.declNodes[found].children[0],
        scopeEndMessage(this.vars[found].name, this.typeName(found))
      )
    }
  }

  // ---- Statements ----

  statements(list: Node[], state: FlowState, block: Node): void {
    for (const stmt of list) {
      if (!state.reachable) {
        break
      }
      this.statement(stmt, state, block)
    }
  }

  statement(stmt: Node, state: FlowState, block: Node): void {
    switch (stmt.kind) {
      case N_BLOCK:
        this.statements(stmt.children, state, stmt)
        this.checkScopeEnd(state, stmt)
        return
      case N_VAR:
        this.declarations(stmt, state, block)
        return
      case N_EXPR_STMT:
        this.expression(stmt.children[0], ROLE_READ, state)
        if (terminatesControlFlow(this.ctx, stmt.children[0])) {
          state.reachable = false // the process ends, and the key with it
        }
        return
      case N_RETURN:
        this.returnValue(stmt, stmt.children[0], state)
        return
      case N_THROW:
        this.expression(stmt.children[0], ROLE_READ, state)
        state.reachable = false
        return
      case N_IF:
        this.ifStatement(stmt, state, block)
        return
      case N_WHILE:
        this.loop(stmt, stmt.children[0], stmt.children[1], null, false, state, block)
        return
      case N_DO:
        this.loop(stmt, stmt.children[1], stmt.children[0], null, true, state, block)
        return
      case N_FOR:
        this.forStatement(stmt, state, block)
        return
      case N_FOR_OF:
        this.expression(stmt.children[1], ROLE_READ, state)
        this.loop(stmt, null, stmt.children[2], null, false, state, block)
        return
      case N_SWITCH:
        this.switchStatement(stmt, state)
        return
      case N_BREAK:
        this.leave(stmt, state, false)
        return
      case N_CONTINUE:
        this.leave(stmt, state, true)
        return
      default:
        return
    }
  }

  declarations(stmt: Node, state: FlowState, block: Node): void {
    for (const decl of stmt.children[0].children) {
      if (decl.kind !== N_VAR_DECL) {
        continue
      }
      const init = decl.children[2]
      if (init.kind !== N_EMPTY) {
        this.expression(init, ROLE_INIT, state)
      }
      const local = this.ctx.program.nodeLocals[decl.id]
      const at = this.varIndex(local)
      if (at >= 0) {
        state.live[at] = mayHoldSecret(init)
        state.wiped[at] = false
        this.declBlocks[at] = block
        this.declDepths[at] = this.targets.length
      }
      const moved = this.movableIndex(local)
      if (moved >= 0) {
        state.moved[moved] = false
      }
    }
  }

  returnValue(at: Node, value: Node, state: FlowState): void {
    let keep = -1
    if (value.kind !== N_EMPTY) {
      const named = unwrapSecretNode(value)
      keep = named.kind === N_IDENT ? this.varIndex(this.ctx.program.nodeLocals[named.id]) : -1
      this.expression(value, ROLE_RETURN, state)
    }
    this.checkExit(state, at, -1, keep)
    state.reachable = false
  }

  ifStatement(stmt: Node, state: FlowState, block: Node): void {
    this.expression(stmt.children[0], ROLE_READ, state)
    const whenTrue = copyState(state)
    const whenFalse = copyState(state)
    this.narrowNull(stmt.children[0], whenTrue, whenFalse)
    this.statement(stmt.children[1], whenTrue, block)
    if (stmt.children[2].kind !== N_EMPTY) {
      this.statement(stmt.children[2], whenFalse, block)
    }
    const merged = whenTrue
    mergeInto(merged, whenFalse)
    if (!whenTrue.reachable && !whenFalse.reachable) {
      merged.reachable = false
    }
    assign(state, merged)
  }

  /** `k === null` holds no secret in its true branch, `k !== null` in its false one. */
  narrowNull(cond: Node, whenTrue: FlowState, whenFalse: FlowState): void {
    const test = unwrapSecretNode(cond)
    if (test.kind !== N_BINARY || (test.text !== "===" && test.text !== "!==")) {
      return
    }
    const left = unwrapSecretNode(test.children[0])
    const right = unwrapSecretNode(test.children[1])
    const named = left.kind === N_NULL ? right : left
    const other = left.kind === N_NULL ? left : right
    if (named.kind !== N_IDENT || other.kind !== N_NULL) {
      return
    }
    const at = this.varIndex(this.ctx.program.nodeLocals[named.id])
    if (at < 0) {
      return
    }
    if (test.text === "===") {
      whenTrue.live[at] = false
    } else {
      whenFalse.live[at] = false
    }
  }

  forStatement(stmt: Node, state: FlowState, block: Node): void {
    const init = stmt.children[0]
    if (init.kind === N_VAR) {
      this.declarations(init, state, stmt)
    } else if (init.kind !== N_EMPTY) {
      this.expression(init, ROLE_READ, state)
    }
    const cond = stmt.children[1]
    this.loop(
      stmt,
      cond.kind === N_EMPTY ? null : cond,
      stmt.children[3],
      stmt.children[2],
      false,
      state,
      block
    )
    this.checkScopeEnd(state, stmt)
  }

  /**
   * A loop: `cond` before each pass (none for `for...of`, whose end is its
   * iterable's), `body`, then `step`. `once` is a `do`, whose body runs before
   * its first test. Walked to the fixpoint of the state at the head quietly,
   * then once aloud from it.
   */
  loop(
    stmt: Node,
    cond: Node | null,
    body: Node,
    step: Node | null,
    once: boolean,
    state: FlowState,
    block: Node
  ): void {
    const saved = this.report
    this.report = false
    let head = copyState(state)
    let rounds = 0
    while (rounds < 8) {
      const next = copyState(state)
      mergeInto(next, this.pass(stmt, cond, body, step, once, copyState(head), block).continues)
      if (sameState(next, head)) {
        break
      }
      head = next
      rounds = rounds + 1
    }
    this.report = saved
    const target = this.pass(stmt, cond, body, step, once, head, block)
    // Where the loop exits: its test failing (never for `while (true)`), and every `break`.
    const out = target.breaks
    if (target.exits.reachable) {
      mergeInto(out, target.exits)
    }
    assign(state, out)
  }

  /** One pass of a loop from `head`: what reaches its next head, and what leaves it. */
  pass(
    stmt: Node,
    cond: Node | null,
    body: Node,
    step: Node | null,
    once: boolean,
    head: FlowState,
    block: Node
  ): LoopPass {
    const target = new SecretExitTarget(false, this.targets.length, this.vars.length, this.movable.length)
    const exits = this.fresh()
    exits.reachable = false
    const state = head
    if (!once && cond !== null) {
      this.expression(cond, ROLE_READ, state)
      if (!isLiteralTrue(cond)) {
        mergeInto(exits, state)
      }
    } else if (!once && stmt.kind === N_FOR_OF) {
      mergeInto(exits, state) // an empty iterable runs no pass
    }
    this.targets.push(target)
    this.statement(body, state, block)
    this.checkScopeEnd(state, body)
    this.targets.pop()
    mergeInto(state, target.continues)
    if (state.reachable) {
      if (step !== null && step.kind !== N_EMPTY) {
        this.expression(step, ROLE_READ, state)
      }
      if (once && cond !== null) {
        this.expression(cond, ROLE_READ, state)
        if (!isLiteralTrue(cond)) {
          mergeInto(exits, state)
        }
      } else if (once) {
        mergeInto(exits, state)
      }
    }
    return new LoopPass(state, target.breaks, exits)
  }

  switchStatement(stmt: Node, state: FlowState): void {
    this.expression(stmt.children[0], ROLE_READ, state)
    const target = new SecretExitTarget(true, this.targets.length, this.vars.length, this.movable.length)
    this.targets.push(target)
    const entry = copyState(state)
    let fall = this.fresh()
    fall.reachable = false
    let hasDefault = false
    for (const clause of stmt.children[1].children) {
      if (clause.kind === N_DEFAULT) {
        hasDefault = true
      }
      const here = copyState(entry)
      mergeInto(here, fall)
      if (clause.kind === N_CASE) {
        this.expression(clause.children[0], ROLE_READ, here)
      }
      const body = clause.kind === N_CASE ? clause.children[1] : clause.children[0]
      if (clause.kind === N_CASE || clause.kind === N_DEFAULT) {
        this.statements(body.children, here, body)
        this.checkScopeEnd(here, body)
      }
      fall = here
    }
    this.targets.pop()
    const out = target.breaks
    mergeInto(out, fall)
    if (!hasDefault) {
      mergeInto(out, entry)
    }
    assign(state, out)
  }

  /** `break` (or `continue`): the innermost target it leaves, and the secrets declared inside it. */
  leave(stmt: Node, state: FlowState, isContinue: boolean): void {
    let i = this.targets.length - 1
    while (i >= 0 && isContinue && this.targets[i].isSwitch) {
      i = i - 1
    }
    if (i < 0) {
      state.reachable = false
      return
    }
    const target = this.targets[i]
    this.checkExit(state, stmt, target.depth, -1)
    // What was declared inside the target is out of scope beyond it: said once, here.
    let v = 0
    while (v < this.vars.length) {
      if (this.owned[v] && this.declDepths[v] > target.depth) {
        state.live[v] = false
      }
      v = v + 1
    }
    mergeInto(isContinue ? target.continues : target.breaks, state)
    state.reachable = false
  }

  // ---- Expressions ----

  expression(node: Node, role: i32, state: FlowState): void {
    const program = this.ctx.program
    switch (node.kind) {
      case N_PAREN:
        this.expression(node.children[0], role, state)
        return
      case N_IDENT:
        this.name(node, role, state)
        return
      case N_ARROW:
        return // an arrow captures nothing, and its body is checked as its own
      case N_CONDITIONAL: {
        this.expression(node.children[0], ROLE_READ, state)
        const arm = role === ROLE_RETURN || role === ROLE_INIT || role === ROLE_ARM ? ROLE_ARM : ROLE_READ
        const whenTrue = copyState(state)
        const whenFalse = copyState(state)
        this.expression(node.children[1], arm, whenTrue)
        this.expression(node.children[2], arm, whenFalse)
        mergeInto(whenTrue, whenFalse)
        assign(state, whenTrue)
        return
      }
      case N_BINARY:
        this.binary(node, state)
        return
      case N_CALL:
        this.call(node, role, state)
        return
      case N_NEW:
        for (const arg of node.children[2].children) {
          this.expression(arg, unwrapSecretNode(arg).kind === N_IDENT ? ROLE_BORROW : ROLE_READ, state)
        }
        this.produced(node, role)
        return
      default:
        break
    }
    for (const child of node.children) {
      this.expression(child, ROLE_READ, state)
    }
    if (node.kind !== N_EMPTY && program.nodeTypes[node.id] >= 0) {
      this.produced(node, role)
    }
  }

  /** A `Secret` made by `node` (a call or a `new`) in a place nobody will own it. */
  produced(node: Node, role: i32): void {
    const type = this.ctx.program.nodeTypes[node.id]
    if (type < 0 || !this.ctx.table.isSecret(type) || node.kind === N_IDENT || node.kind === N_NULL) {
      return
    }
    if (role === ROLE_INIT || role === ROLE_RETURN || role === ROLE_WIPE || role === ROLE_ARM) {
      return
    }
    this.error(node, discardMessage(this.ctx.table, type))
  }

  name(node: Node, role: i32, state: FlowState): void {
    const local = this.ctx.program.nodeLocals[node.id]
    const moved = this.movableIndex(local)
    if (moved >= 0 && state.moved[moved] && local !== null) {
      this.error(
        node,
        this.ctx.table.isSecret(local.type) ? movedOutMessage(local.name) : movedMessage(local.name)
      )
      return
    }
    const at = this.varIndex(local)
    if (at < 0 || local === null) {
      return
    }
    if (role === ROLE_WIPE) {
      state.live[at] = false
      state.wiped[at] = true
      return
    }
    if (role === ROLE_NULL_TEST) {
      return
    }
    if (state.wiped[at]) {
      this.error(node, wipedMessage(local.name))
      return
    }
    if (role === ROLE_BORROW) {
      return
    }
    if (role === ROLE_RETURN) {
      state.live[at] = false
      return
    }
    // `const j = k` and `k = next` move an owned secret: the new name owns it,
    // and the old one is not read again (`movable`).
    if (role === ROLE_INIT && this.owned[at] && moved >= 0) {
      state.live[at] = false
      state.moved[moved] = true
      return
    }
    this.error(node, copyMessage(local.name))
    state.live[at] = false // the one diagnostic is the copy; who wipes is the question it asks
  }

  binary(node: Node, state: FlowState): void {
    const op = node.text
    if (op === "=") {
      this.assignment(node, state)
      return
    }
    if (op === "===" || op === "!==") {
      const nullTest =
        unwrapSecretNode(node.children[0]).kind === N_NULL ||
        unwrapSecretNode(node.children[1]).kind === N_NULL
      for (const side of node.children) {
        this.expression(side, nullTest ? ROLE_NULL_TEST : ROLE_BORROW, state)
      }
      return
    }
    for (const side of node.children) {
      this.expression(side, ROLE_READ, state)
    }
  }

  assignment(node: Node, state: FlowState): void {
    const target = unwrapSecretNode(node.children[0])
    const value = node.children[1]
    if (target.kind !== N_IDENT) {
      for (const side of node.children) {
        this.expression(side, ROLE_READ, state)
      }
      return
    }
    const local = this.ctx.program.nodeLocals[target.id]
    const at = this.varIndex(local)
    this.expression(value, at >= 0 ? ROLE_INIT : ROLE_READ, state)
    if (at >= 0 && local !== null) {
      if (state.live[at]) {
        this.error(target, overwriteMessage(local.name))
      }
      state.live[at] = this.owned[at] && mayHoldSecret(value)
      state.wiped[at] = false
    }
    const moved = this.movableIndex(local)
    if (moved >= 0) {
      state.moved[moved] = false
    }
  }

  call(node: Node, role: i32, state: FlowState): void {
    const program = this.ctx.program
    const callee = node.children[0]
    const args = node.children[1].children
    const sig = program.nodeCallees[node.id]
    const calleeRole = secretRoleOf(sig)
    if (callee.kind === N_MEMBER) {
      this.expression(callee.children[0], ROLE_READ, state)
    }
    let i = 0
    while (i < args.length) {
      const arg = args[i]
      if (calleeRole === SECRET_WIPE && i === 0) {
        this.expression(arg, ROLE_WIPE, state)
      } else if (calleeRole === SECRET_MAKE && i === 0) {
        this.move(arg, state)
      } else if (unwrapSecretNode(arg).kind === N_IDENT) {
        this.expression(arg, ROLE_BORROW, state)
      } else {
        this.expression(arg, ROLE_READ, state)
      }
      i = i + 1
    }
    // `r.orReturn()` returns early, and leaves what every `return` must not.
    if (callee.kind === N_MEMBER && callee.text === "orReturn" && args.length === 0) {
      const receiver = program.nodeTypes[callee.children[0].id]
      if (receiver >= 0 && this.ctx.table.isResult(this.ctx.table.stripNull(receiver))) {
        this.checkExit(state, node, -1, -1)
      }
    }
    this.produced(node, role)
  }

  /** `secret(arg)`: a fresh value, or a local that is moved and not read again. */
  move(arg: Node, state: FlowState): void {
    const named = unwrapSecretNode(arg)
    if (named.kind === N_IDENT) {
      const local = this.ctx.program.nodeLocals[named.id]
      if (local !== null && local.storage === STORAGE_PARAM) {
        this.error(named, unmovableMessage())
        return
      }
      const moved = this.movableIndex(local)
      if (moved >= 0) {
        if (state.moved[moved] && local !== null) {
          this.error(named, movedMessage(local.name))
        }
        state.moved[moved] = true
      }
      return
    }
    if (named.kind === N_MEMBER || named.kind === N_INDEX) {
      this.error(named, unmovableMessage())
      return
    }
    this.expression(arg, ROLE_READ, state)
  }
}

/** One pass over a loop: the state at the end of the body, what `break` took out, and the failed tests. */
class LoopPass {
  continues: FlowState
  breaks: FlowState
  exits: FlowState

  constructor(continues: FlowState, breaks: FlowState, exits: FlowState) {
    this.continues = continues
    this.breaks = breaks
    this.exits = exits
  }
}

const unwrapSecretNode = (node: Node): Node => {
  let at = node
  while (at.kind === N_PAREN) {
    at = at.children[0]
  }
  return at
}

const isLiteralTrue = (node: Node): boolean => unwrapSecretNode(node).kind === N_TRUE

/** Whether an initialiser can leave a secret in its variable: anything but `null` or nothing. */
const mayHoldSecret = (init: Node): boolean => {
  const value = unwrapSecretNode(init)
  return value.kind !== N_EMPTY && value.kind !== N_NULL
}

/** Copy `from` into `into`, element by element, so callers holding `into` see the change. */
const assign = (into: FlowState, from: FlowState): void => {
  let i = 0
  while (i < into.live.length) {
    into.live[i] = from.live[i]
    into.wiped[i] = from.wiped[i]
    i = i + 1
  }
  i = 0
  while (i < into.moved.length) {
    into.moved[i] = from.moved[i]
    i = i + 1
  }
  into.reachable = from.reachable
}

/** Every variable the walk tracks, gathered before it starts so each state has one size. */
const collectFlow = (flow: SecretFlow, node: Node): void => {
  const program = flow.ctx.program
  const table = flow.ctx.table
  if (node.kind === N_ARROW) {
    return
  }
  if (node.kind === N_VAR_DECL) {
    const local = program.nodeLocals[node.id]
    if (local !== null && table.isSecret(local.type) && flow.varIndex(local) < 0) {
      flow.vars.push(local)
      flow.owned.push(true)
      flow.declNodes.push(node)
      flow.declBlocks.push(node)
      flow.declDepths.push(0)
    }
  }
  if (node.kind === N_IDENT) {
    const local = program.nodeLocals[node.id]
    if (
      local !== null &&
      local.storage === STORAGE_PARAM &&
      table.isSecret(local.type) &&
      flow.varIndex(local) < 0
    ) {
      flow.vars.push(local)
      flow.owned.push(false)
      flow.declNodes.push(node)
      flow.declBlocks.push(node)
      flow.declDepths.push(-1)
    }
  }
  // `const j = k` and `j = k`: the owned secret `k` moves, and is then not read.
  let source = node
  if (node.kind === N_VAR_DECL) {
    source = node.children[2]
  } else if (node.kind === N_BINARY && node.text === "=") {
    source = node.children[1]
  }
  if (source !== node) {
    const named = unwrapSecretNode(source)
    const local: Local | null = named.kind === N_IDENT ? program.nodeLocals[named.id] : null
    if (
      local !== null &&
      local.storage !== STORAGE_PARAM &&
      table.isSecret(local.type) &&
      flow.movableIndex(local) < 0
    ) {
      flow.movable.push(local)
    }
  }
  if (node.kind === N_CALL && secretRoleOf(program.nodeCallees[node.id]) === SECRET_MAKE) {
    const args = node.children[1].children
    if (args.length > 0) {
      const named = unwrapSecretNode(args[0])
      if (named.kind === N_IDENT) {
        const local = program.nodeLocals[named.id]
        if (local !== null && local.storage !== STORAGE_PARAM && flow.movableIndex(local) < 0) {
          flow.movable.push(local)
        }
      }
    }
  }
  for (const child of node.children) {
    collectFlow(flow, child)
  }
}

/**
 * The ownership rules over the body of `sig`, once it has checked cleanly.
 * Nothing is walked for a body that names no `Secret` and moves nothing, which
 * is every body of a program that does not import `nish:secret`.
 */
export const checkSecretFlow = (ctx: CheckContext, body: Node): void => {
  if (isSecretSource(ctx.program)) {
    return // the module's own bodies are the rules' implementation
  }
  const flow = new SecretFlow(ctx)
  collectFlow(flow, body)
  if (flow.vars.length === 0 && flow.movable.length === 0 && !producesSecret(ctx, body)) {
    return
  }
  const state = flow.fresh()
  if (body.kind === N_BLOCK) {
    flow.statements(body.children, state, body)
    flow.checkScopeEnd(state, body)
  } else {
    flow.returnValue(body, body, state)
  }
}

/** Whether any expression in `node` has a `Secret` type: a body with none needs no walk. */
const producesSecret = (ctx: CheckContext, node: Node): boolean => {
  if (node.kind === N_ARROW) {
    return false
  }
  const type = node.kind === N_EMPTY ? -1 : ctx.program.nodeTypes[node.id]
  if (type >= 0 && ctx.table.isSecret(type)) {
    return true
  }
  for (const child of node.children) {
    if (producesSecret(ctx, child)) {
      return true
    }
  }
  return false
}

// ---- Exposure ------------------------------------------------------------------------------

/** What `expose` runs reaches the outside world. */
const ioMessage = (fn: string, via: string, intrinsic: string): string =>
  `\`${fn}\` reaches ${via}, and \`${intrinsic}\` runs it with the secret: the function \`${intrinsic}\` ` +
  "runs may reach no I/O, no clock, no entropy, no C, and no `panic` or exit whose message or status is computed, " +
  "so that what it returns is all that leaves"

/** What `expose` runs keeps the value it is handed. */
const keepsMessage = (fn: string, intrinsic: string): string =>
  `\`${fn}\` keeps the value \`${intrinsic}\` hands it — returns it, stores it or passes it where it is kept — ` +
  "and the key would outlive the `Secret` unwiped; return a value computed from it instead"

/** What `exposeWith` runs writes the argument it is handed. */
const writesArgMessage = (fn: string): string =>
  `\`${fn}\` writes the argument \`exposeWith\` hands it, a channel out of \`expose\` its result type does ` +
  "not name: return what it computes instead"

/** What `expose` runs answers a `Secret`, or has no declared result. */
const exposeResultMessage = (fn: string, intrinsic: string, type: string): string =>
  `\`${fn}\` answers \`${type}\`, and what \`${intrinsic}\` returns must be a declared type that holds no ` +
  "`Secret`: that type is the one thing that leaves"

const undeclaredMessage = (intrinsic: string): string =>
  `The arrow given to \`${intrinsic}\` must declare its return type, \`(k): u8[] => ...\`: what \`${intrinsic}\` ` +
  "returns is the one thing that leaves the secret, so it is written down rather than inferred"

/**
 * The runtime symbols the function `expose` runs may reach: the arena, the
 * string builder, number formatting, a `Map`'s hash, and the LLVM intrinsics.
 * Everything else the runtime has touches the world — a file, a process, the
 * environment, a socket, the clock, entropy, a signal, stdout or stderr — or
 * ends the process with a message or a status a key could steer. An allow-list
 * rather than a deny-list, so a runtime symbol added later is outside until
 * somebody says why it is inside.
 */
export const isPureRuntime = (symbol: string): boolean =>
  symbol.startsWith("llvm.") ||
  symbol === "nish_alloc_struct" ||
  symbol === "nish_arena_grow" ||
  symbol === "nish_arena_keep" ||
  symbol === "nish_arena_mark" ||
  symbol === "nish_arena_release" ||
  symbol === "nish_arena_used" ||
  symbol === "nish_str_new" ||
  symbol === "nish_str_concat" ||
  symbol === "nish_str_eq" ||
  symbol === "nish_str_at" ||
  symbol === "nish_str_index_of" ||
  symbol === "nish_str_len" ||
  symbol === "nish_str_from_i32" ||
  symbol === "nish_str_from_f64" ||
  symbol === "nish_str_from_i64" ||
  symbol === "nish_str_from_u64" ||
  symbol === "nish_parse_number"

/** How `FunctionFacts.worldVia` names a `declare function`, which `src/attributes.ts` spells the same way. */
const C_FUNCTION: string = "the C function "

/**
 * The first thing the closure of `start` does that `expose` may not, in the
 * words a diagnostic says it in, or "": a world-touching builtin
 * (`FunctionFacts.worldVia`), or a callee with no facts that is neither the
 * runtime's nor an intrinsic nor the allocator, which is C. Breadth first, so
 * the path named is a shortest one.
 *
 * A failed runtime check's panic — an index, a slice, a division, a
 * `new Array` length, a ranged integer — is not refused: it is the runtime
 * stopping a program that is already wrong, not the function saying something.
 * Its message carries the operand that failed, which docs/LANGUAGE.md
 * ("Secrets") states as the one thing that can leave by that road, and an
 * index that depends on a key is already a cache-timing defect.
 */
const reachedEffect = (facts: FactsTable, runtime: RuntimeTable, start: FunctionFacts): string => {
  const seen: string[] = []
  const queue: FunctionFacts[] = []
  queue.push(start)
  let head = 0
  while (head < queue.length) {
    const f = queue[head]
    head = head + 1
    const through = f === start ? "" : ` through \`${f.sourceName}\``
    if (f.worldVia.length > 0) {
      return `${f.worldVia}${through}`
    }
    let c = 0
    while (c < f.callees.size()) {
      const callee = f.callees.at(c)
      c = c + 1
      if (seen.indexOf(callee) >= 0) {
        continue
      }
      seen.push(callee)
      const next = facts.get(callee)
      if (next !== null && next.worldVia.startsWith(C_FUNCTION)) {
        return `${next.worldVia}${through}` // a `declare function`: named by its caller, not through itself
      }
      if (next !== null) {
        queue.push(next)
        continue
      }
      if (callee !== "nish_alloc_struct" && !callee.startsWith("llvm.") && runtime.lookup(callee) === null) {
        return `${C_FUNCTION}\`${callee}\`${through}`
      }
    }
  }
  return ""
}

const paramFacts = (facts: FunctionFacts, name: string): PointerParamFacts | null => facts.pointerParam(name)

/**
 * Every refusal one `expose` or `exposeWith` call earns, from the instance
 * `sig` and the facts of the function it runs. Empty when the call is sound.
 */
export const exposeMessages = (
  table: TypeTable,
  facts: FactsTable,
  runtime: RuntimeTable,
  sig: FunctionSig
): string[] => {
  const out: string[] = []
  const instance = sig.instance
  if (instance === null || instance.functionArgs.length !== 1) {
    return out
  }
  const intrinsic = secretRoleOf(sig) === SECRET_EXPOSE_WITH ? "exposeWith" : "expose"
  const fn = instance.functionArgs[0]
  const name = fn.sourceName
  if (table.holdsSecret(fn.returnType) || fn.returnType === T_ERROR) {
    out.push(exposeResultMessage(name, intrinsic, table.typeName(fn.returnType)))
  }
  if (fn.lifted && fn.decl.children.length > 2 && fn.decl.children[2].kind === N_EMPTY) {
    out.push(undeclaredMessage(intrinsic))
  }
  const own = facts.get(fn.name)
  if (own === null) {
    return out
  }
  const effect = reachedEffect(facts, runtime, own)
  if (effect.length > 0) {
    out.push(ioMessage(name, effect, intrinsic))
  }
  if (fn.paramNames.length > 0) {
    const value = paramFacts(own, fn.paramNames[0])
    if (value !== null && value.captured) {
      out.push(keepsMessage(name, intrinsic))
    }
  }
  if (intrinsic === "exposeWith" && fn.paramNames.length > 1) {
    const arg = paramFacts(own, fn.paramNames[1])
    if (arg !== null && arg.writesThrough) {
      out.push(writesArgMessage(name))
    }
  }
  return out
}

/**
 * Remember an `expose` or `exposeWith` call for `Compilation.checkSecrets`,
 * once: a generic caller's body is checked once per instantiation and reaches
 * here again with the same node.
 */
export const recordExposeCall = (program: CheckedProgram, node: Node, sig: FunctionSig): void => {
  for (const call of program.exposeCalls) {
    if (call.node === node && call.sig === sig) {
      return
    }
  }
  program.exposeCalls.push(new ParallelCall(node, sig))
}
