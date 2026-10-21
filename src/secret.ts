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
//     into, built with `new`, or put in an element or a `Result`; a field holds
//     one only as a `readonly` field of a class whose `wipe()` wipes it.
//     Each is asked before the generic rule it would otherwise trip, so the one
//     diagnostic a program gets names the secret.
//   - **Ownership**, over a body once it has checked cleanly
//     (`checkSecretFlow`): a `Secret` the function makes leaves it returned or
//     wiped on every path, is not copied, is not read once wiped, and a local
//     handed to `secret` is moved. A `Secret` parameter is borrowed, so it is
//     neither returned nor wiped; a holder's field is set once, in the
//     constructor, and wiped only in the holder's `wipe()`. Result rule 1's two entry points, the
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
  N_ARRAY,
  N_ARROW,
  N_BINARY,
  N_BLOCK,
  N_BREAK,
  N_CALL,
  N_CASE,
  N_CONDITIONAL,
  N_CONSTRUCTOR,
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
  N_LIST,
  N_MEMBER,
  N_NEW,
  N_NULL,
  N_OBJECT,
  N_PAREN,
  N_RETURN,
  N_SWITCH,
  N_THIS,
  N_THROW,
  N_TRUE,
  N_VAR,
  N_VAR_DECL,
  N_WHILE,
  Node,
  FLAG_OPTIONAL,
} from "./nodes"
import {
  CheckedProgram,
  FieldInfo,
  FunctionSig,
  Instantiation,
  ParallelCall,
  ROLE_CONSTRUCTOR,
  SecretNeed,
  STRUCT_CLASS,
  StructInfo,
  StructTemplateInfo,
  SWITCH_COVERED,
  TemplateInfo,
  capturedReads,
} from "./program"
import { RuntimeTable } from "./runtime"
import { isResultConstructorCall, resultMethodName } from "./emit-result"
import { methodReceiver } from "./emit-util"
import { isSecretModule } from "./std-modules"
import { StringBuilder } from "./strings"
import { Local, Scope, STORAGE_LOCAL, STORAGE_PARAM, sourceLocal } from "./symbols"
import { isInteger, T_CPTR, T_ERROR, T_VOID, TypeTable } from "./types"

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

/** Whether `info` is an instantiation of `Secret<T>`, a struct the C header keeps opaque. */
export const isSecretStruct = (info: StructInfo): boolean => {
  const instance = info.instance
  return instance !== null && isSecretTemplate(instance.template)
}

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

/**
 * `key: Secret<u8[]>` anywhere but a `readonly` field of a non-generic class:
 * an interface's, a nullable one, a `Secret<T>[]`, a generic class's.
 */
export const secretFieldMessage = (field: string): string =>
  `\`${field}\` cannot be a \`Secret\`: a field of a class or interface outlives the function that ` +
  "made the secret, which then can neither return nor wipe it; hold a `Secret` in a local, a parameter, " +
  "or a `readonly` field of a class whose `wipe()` wipes it"

/**
 * Whether `type`, the declared type of a field of `owner`, is a `Secret` field
 * the language admits (docs/LANGUAGE.md, "A `Secret` field"): exactly
 * `Secret<T>`, `readonly`, in a class that is neither generic nor
 * `nish:secret`'s own. Every other field `holdsSecret` answers for is NL2430.
 */
export const admitsSecretField = (
  ctx: CheckContext,
  owner: StructInfo,
  type: i32,
  readonly: boolean
): boolean =>
  readonly &&
  ctx.table.secretInner(type) >= 0 &&
  owner.kind === STRUCT_CLASS &&
  owner.instance === null &&
  !isSecretSource(ctx.program)

/**
 * The first `Secret` field of `info`, or null when it has none: a class with
 * one is a *holder*. Only `admitsSecretField` lets such a field in, so this is
 * the record, derived where it is asked rather than kept beside the fields.
 */
export const secretFieldOf = (table: TypeTable, info: StructInfo | null): FieldInfo | null => {
  if (info === null) {
    return null
  }
  for (const field of info.fields) {
    if (table.isSecret(field.type)) {
      return field
    }
  }
  return null
}

/** A holder whose `wipe` is missing, or takes parameters, or answers a value. */
const releaserMessage = (holder: string, field: string): string =>
  `\`${holder}\` holds the \`Secret\` field \`${field}\`, so it declares \`wipe(): void\`, taking no ` +
  "parameters: a holder's key ends in that method, which wipes every `Secret` field it holds, " +
  `\`wipe(this.${field})\`, on every path`

/**
 * A holder declares `wipe(): void`, the one place its keys end, which
 * `checkSecretFlow` then walks path by path.
 */
export const checkHolderReleaser = (ctx: CheckContext, info: StructInfo): void => {
  const field = secretFieldOf(ctx.table, info)
  if (field === null) {
    return
  }
  const sig = info.method("wipe")
  // `this` is the first parameter of a method's signature.
  if (sig === null || sig.paramTypes.length !== 1 || sig.returnType !== T_VOID) {
    ctx.error(info.decl.children[0], releaserMessage(info.name, field.name))
  }
}

/** An exit or the end of a holder's `wipe()` that leaves `this.f` holding its key. */
const releaseMessage = (field: string): string =>
  `\`${field}\` can leave this \`wipe()\` unwiped: a holder's \`wipe()\` ends every \`Secret\` field ` +
  `it holds itself, with \`wipe(${field})\` on every path (a helper it calls does not count), ` +
  "because nothing else ever will"

/** `this.f = v` in a constructor for a `v` that is not `secret(...)`. */
const fieldSourceMessage = (field: string): string =>
  `\`${field}\` is set from something other than \`secret(...)\`: a \`Secret\` field is set in its ` +
  "class's constructor, from `secret(v)`, so the holder is the only owner of the key it makes, " +
  "and its `wipe()` the one place that key ends"

/** A second `this.f = secret(...)` while the first may still hold its key. */
const refillMessage = (field: string): string =>
  `\`${field}\` is set again while it may still hold a \`Secret\`: a \`Secret\` field is set once, ` +
  "in its class's constructor, and the key it held would be lost unwiped"

/** `const k = h.key`, `return h.key`, `c ? h.key : s`, ... */
const fieldReadMessage = (field: string): string =>
  `\`${field}\` is a \`Secret\` field, which is read only as a call's argument or an \`===\`/\`!==\` ` +
  "operand: bound, returned, chosen or stored, it would be a second owner of the key the holder's " +
  "`wipe()` ends, so pass it to `expose`, `exposeWith` or a function that takes a `Secret`"

/** `wipe(h.k)` anywhere but the holder's own `wipe()`. */
const fieldWipeMessage = (field: string): string =>
  `\`${field}\` is wiped outside its holder's \`wipe()\`: a \`Secret\` field ends only in that method, ` +
  "on every path, so a wipe anywhere else would leave the holder holding zeros that its other uses " +
  "then read and its own `wipe()` wipes again; call the holder's `wipe()` instead"

/** `{ key: ... }` for a holder class: the field set without `secret(...)`. */
export const holderLiteralMessage = (holder: string): string =>
  `\`${holder}\` holds a \`Secret\` field and is made only by \`new\`: its constructor is the one place ` +
  "that field is set, from `secret(v)`, so an object literal or a decoded document cannot build it"

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
 * is a `Secret`, or a holder's `Secret` field through a chain of names and
 * fields (`h.key`, `this.key`, `a.h.key`). It reads the scope and the declared
 * fields and never checks `arg`, so a builtin can refuse a secret before its
 * own argument checks run and say something less useful about the same
 * mistake.
 */
export const namesSecret = (ctx: CheckContext, arg: Node, scope: Scope): boolean =>
  ctx.table.isSecret(writtenType(ctx, arg, scope))

/** The type of a chain of names and fields as written, or -1 for anything else. */
const writtenType = (ctx: CheckContext, node: Node, scope: Scope): i32 => {
  const at = unwrapSecretNode(node)
  if (at.kind === N_IDENT) {
    const local = scope.lookup(at.text)
    return local === null ? -1 : scope.typeOf(local)
  }
  if (at.kind === N_THIS) {
    const sig = ctx.current
    if (sig === null) {
      return -1
    }
    const owner = sig.owner
    return owner === null ? -1 : owner.type
  }
  if (at.kind !== N_MEMBER) {
    return -1
  }
  const receiver = writtenType(ctx, at.children[0], scope)
  if (receiver < 0) {
    return -1
  }
  const info = ctx.program.struct(ctx.table.nameOf(ctx.table.stripNull(receiver)))
  if (info === null) {
    return -1
  }
  const field = info.field(at.text)
  return field === null ? -1 : field.type
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

/** `wipe(p)` for a `Secret` parameter `p`, which its caller still owns. */
const paramWipeMessage = (name: string): string =>
  `\`${name}\` is a \`Secret\` parameter, which its caller owns and wipes: wiped here, the caller ` +
  "would go on reading zeros and wipe it again. Leave the wipe to the caller, which knows when it is done"

/** `return p` for a `Secret` parameter `p`, which its caller still owns. */
const paramReturnMessage = (name: string): string =>
  `\`${name}\` is a \`Secret\` parameter, which its caller owns and wipes: returned, it would be a ` +
  "second name for that key in the caller, one of the two wiped by nobody or both read once it is wiped. " +
  "Return a value computed from it inside `expose`, or a new `secret(...)` made from one"

/** A read of a local of `type` after `secret(x)` moved it, naming what it holds: an array, or its class or interface. */
const movedMessage = (table: TypeTable, name: string, type: i32): string => {
  const shape = table.isStruct(type) ? `\`${table.typeName(type)}\`` : "array"
  return (
    `\`${name}\` was moved into a \`Secret\` by \`secret(${name})\` and cannot be read again: the plain ${shape}` +
    " would be key material outside the `Secret`'s rules"
  )
}

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
/** The `secret(v)` a constructor stores in a holder's `Secret` field, which owns it from there. */
const ROLE_FIELD_INIT: i32 = 7

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
  /**
   * Per variable, "" for a local or a parameter, or the name of the holder's
   * `Secret` field it stands for: a *slot*, `this.f` in the holder's own
   * constructor (not owned: set once, from `secret(...)`) or its `wipe()`
   * (owned and live from the start: ended on every path).
   */
  slots: string[]
  movable: Local[]
  /** Every `secret(...)` call in the body, which the sole-reference rule judges. */
  sites: Node[]
  targets: SecretExitTarget[]
  /** The body is a holder's constructor, whose slots are set rather than ended. */
  building: boolean
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
    this.slots = []
    this.building = false
    this.movable = []
    this.sites = []
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

  /** The slot `this.f` names, or -1: a member read of something else, or a body with no slots. */
  slotIndex(member: Node): i32 {
    if (unwrapSecretNode(member.children[0]).kind !== N_THIS) {
      return -1
    }
    let i = 0
    while (i < this.slots.length) {
      if (this.slots[i] === member.text) {
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
      this.error(at, this.endMessage(found, true))
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
      this.error(this.declNodes[found].children[0], this.endMessage(found, false))
    }
  }

  /** What an exit (or, `atExit` false, a scope's end) says of `vars[i]` still holding its key. */
  endMessage(i: i32, atExit: boolean): string {
    const name = this.vars[i].name
    if (this.slots[i] !== "") {
      return releaseMessage(name)
    }
    return atExit ? exitMessage(name, this.typeName(i)) : scopeEndMessage(name, this.typeName(i))
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
        if (stmt.children[0].kind === N_BINARY && stmt.children[0].text === "=") {
          this.assignment(stmt.children[0], state, true)
        } else {
          this.expression(stmt.children[0], ROLE_READ, state)
        }
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
        state.live[at] = mayHoldSecret(init) && !isMemberRead(init)
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
    // A value no label names goes past every clause, unless the checker found
    // the labels name every tag of a union discriminant (`switchCoverage`).
    if (!hasDefault && this.ctx.program.switchCoverage[stmt.id] !== SWITCH_COVERED) {
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
      case N_ARROW: {
        // An arrow's body is checked as its own, but one given to a
        // data-parallel form runs here and reads what it captures (WP29).
        const reads: Node[] = []
        capturedReads(program, node, reads)
        for (const read of reads) {
          this.name(read, ROLE_READ, state)
        }
        return
      }
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
          this.expression(arg, isBorrowable(arg) ? ROLE_BORROW : ROLE_READ, state)
        }
        this.produced(node, role)
        return
      case N_MEMBER:
        if (this.ctx.table.isSecret(program.nodeTypes[node.id])) {
          this.fieldRead(node, role, state)
          return
        }
        break
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
    if (
      role === ROLE_INIT ||
      role === ROLE_RETURN ||
      role === ROLE_WIPE ||
      role === ROLE_ARM ||
      role === ROLE_FIELD_INIT
    ) {
      return
    }
    this.error(node, discardMessage(this.ctx.table, type))
  }

  /**
   * `h.f`, a holder's `Secret` field: lent to a call, compared, or (a slot)
   * wiped. Any other read would be a second owner of the key the holder's
   * `wipe()` ends, so it is refused rather than tracked, and a field read
   * never makes a secret for `produced` to ask about.
   */
  fieldRead(node: Node, role: i32, state: FlowState): void {
    this.expression(node.children[0], ROLE_READ, state)
    const lent = role === ROLE_BORROW || role === ROLE_WIPE || role === ROLE_NULL_TEST
    if (!lent || (node.flags & FLAG_OPTIONAL) !== 0) {
      this.error(node, fieldReadMessage(node.text))
      return
    }
    const at = this.slotIndex(node)
    // A field ends in its holder's own `wipe()`, the one body whose slots are
    // owned: wiped in a constructor, a method or through another name, the
    // holder would go on reading, and wiping, the zeros.
    if (role === ROLE_WIPE && (at < 0 || this.building)) {
      this.error(node, fieldWipeMessage(node.text))
      return
    }
    if (at < 0) {
      return
    }
    if (role === ROLE_WIPE) {
      state.live[at] = false
      state.wiped[at] = true
    } else if (state.wiped[at]) {
      this.error(node, wipedMessage(this.vars[at].name))
    }
  }

  /**
   * `this.f = value` in a holder's constructor, the one store the `readonly`
   * rule lets through (`assignableReadonly`, src/members.ts): every other
   * store of a `Secret` field — in a method, through another name than
   * `this`, compound — is refused there before this walk runs, so this is
   * where the two rules meet. The value is `secret(...)`, made here and owned
   * by the field from now, and the field is not yet set. The store is a
   * statement of its own: `const x = (this.k = secret(v))` would bind the
   * value the field now owns, a second owner as `const x = this.k` is.
   */
  fieldStore(target: Node, value: Node, state: FlowState, statement: boolean): void {
    const at = this.building ? this.slotIndex(target) : -1
    if (at < 0) {
      this.expression(value, ROLE_READ, state)
      return
    }
    const made = unwrapSecretNode(value)
    if (made.kind === N_CALL && secretRoleOf(this.ctx.program.nodeCallees[made.id]) === SECRET_MAKE) {
      this.call(made, ROLE_FIELD_INIT, state)
      if (state.live[at]) {
        this.error(target, refillMessage(this.vars[at].name))
      }
      state.live[at] = true
      state.wiped[at] = false
      if (!statement) {
        this.error(target, fieldReadMessage(target.text))
      }
      return
    }
    if (made.kind === N_BINARY && made.text === "=") {
      // `this.k = this.j = secret(v)`: `this.j` is set, and then read.
      this.expression(made, ROLE_READ, state)
      this.error(made, fieldReadMessage(unwrapSecretNode(made.children[0]).text))
      return
    }
    // `this.k = k`: the one diagnostic is where the key came from, and a
    // local it names is the field's problem now, not its scope's.
    if (made.kind === N_IDENT) {
      const named = this.varIndex(this.ctx.program.nodeLocals[made.id])
      if (named >= 0) {
        state.live[named] = false
      }
    }
    this.error(value, fieldSourceMessage(this.vars[at].name))
  }

  name(node: Node, role: i32, state: FlowState): void {
    const local = sourceLocal(this.ctx.program.nodeLocals[node.id])
    const moved = this.movableIndex(local)
    if (moved >= 0 && state.moved[moved] && local !== null) {
      this.error(
        node,
        this.ctx.table.isSecret(local.type)
          ? movedOutMessage(local.name)
          : movedMessage(this.ctx.table, local.name, local.type)
      )
      return
    }
    const at = this.varIndex(local)
    if (at < 0 || local === null) {
      return
    }
    if (role === ROLE_WIPE) {
      // A parameter is borrowed, and its caller goes on reading it and wipes
      // it itself.
      if (!this.owned[at] && this.slots[at] === "") {
        this.error(node, paramWipeMessage(local.name))
      }
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
      // A parameter is borrowed: returning it hands the caller a second name
      // for a key it already owns.
      if (!this.owned[at] && this.slots[at] === "") {
        this.error(node, paramReturnMessage(local.name))
      }
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
      this.assignment(node, state, false)
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

  /**
   * The type of the field `target` stores to. An assignment's target is not
   * typed as an expression, so it is found through the receiver's struct.
   */
  storedType(target: Node): i32 {
    const program = this.ctx.program
    const receiver = unwrapSecretNode(target.children[0])
    let type = receiver.kind === N_EMPTY ? -1 : program.nodeTypes[receiver.id]
    if (receiver.kind === N_THIS) {
      const sig = this.ctx.current
      if (sig !== null) {
        const owner = sig.owner
        if (owner !== null) {
          type = owner.type
        }
      }
    }
    if (type < 0) {
      return -1
    }
    const info = program.struct(this.ctx.table.nameOf(this.ctx.table.stripNull(type)))
    if (info === null) {
      return -1
    }
    const field = info.field(target.text)
    return field === null ? -1 : field.type
  }

  /** `target = value`; `statement` when it is the whole of an expression statement, so its value goes nowhere. */
  assignment(node: Node, state: FlowState, statement: boolean): void {
    const target = unwrapSecretNode(node.children[0])
    const value = node.children[1]
    if (target.kind === N_MEMBER && this.ctx.table.isSecret(this.storedType(target))) {
      this.fieldStore(target, value, state, statement)
      return
    }
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
      state.live[at] = this.owned[at] && mayHoldSecret(value) && !isMemberRead(value)
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
      } else if (isBorrowable(arg)) {
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

  /**
   * `secret(arg)`: a fresh value, or a local that is moved and not read
   * again. Each arm of a ternary is moved on its own path, so a local named
   * in either is not read once the two meet.
   */
  move(arg: Node, state: FlowState): void {
    const named = unwrapSecretNode(arg)
    if (named.kind === N_CONDITIONAL) {
      this.expression(named.children[0], ROLE_READ, state)
      const whenTrue = copyState(state)
      const whenFalse = copyState(state)
      this.move(named.children[1], whenTrue)
      this.move(named.children[2], whenFalse)
      mergeInto(whenTrue, whenFalse)
      assign(state, whenTrue)
      return
    }
    if (named.kind === N_IDENT) {
      const local = this.ctx.program.nodeLocals[named.id]
      if (local !== null && local.storage === STORAGE_PARAM) {
        this.error(named, unmovableMessage())
        return
      }
      const moved = this.movableIndex(local)
      if (moved >= 0) {
        if (state.moved[moved] && local !== null) {
          this.error(named, movedMessage(this.ctx.table, local.name, local.type))
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

/** An argument a call borrows rather than takes: a name, or a holder's field. */
const isBorrowable = (arg: Node): boolean => {
  const kind = unwrapSecretNode(arg).kind
  return kind === N_IDENT || kind === N_MEMBER
}

/** `h.f`: a field read, which `fieldRead` refuses as an owner, so it hands nothing to own. */
const isMemberRead = (init: Node): boolean => unwrapSecretNode(init).kind === N_MEMBER

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
      flow.slots.push("")
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
      flow.slots.push("")
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
    flow.sites.push(node)
    const args = node.children[1].children
    if (args.length > 0) {
      collectMoved(flow, args[0])
    }
  }
  for (const child of node.children) {
    collectFlow(flow, child)
  }
}

/** The locals `secret(arg)` moves: `arg` itself, or either arm of a ternary. */
const collectMoved = (flow: SecretFlow, arg: Node): void => {
  const named = unwrapSecretNode(arg)
  if (named.kind === N_CONDITIONAL) {
    collectMoved(flow, named.children[1])
    collectMoved(flow, named.children[2])
    return
  }
  if (named.kind !== N_IDENT) {
    return
  }
  const local = flow.ctx.program.nodeLocals[named.id]
  if (local !== null && local.storage !== STORAGE_PARAM && flow.movableIndex(local) < 0) {
    flow.movable.push(local)
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
  const releaser = collectSlots(flow, body)
  if (flow.vars.length === 0 && flow.movable.length === 0 && !producesSecret(ctx, body)) {
    return
  }
  const before = ctx.sink.count()
  const state = flow.fresh()
  // A holder's `wipe()` starts holding every key: each is ended on every path.
  let i = 0
  while (i < flow.vars.length) {
    state.live[i] = releaser && flow.slots[i] !== ""
    i = i + 1
  }
  if (body.kind === N_BLOCK) {
    flow.statements(body.children, state, body)
    flow.checkScopeEnd(state, body)
  } else {
    flow.returnValue(body, body, state)
  }
  if (ctx.sink.count() === before && flow.sites.length > 0) {
    checkSoleReferences(ctx, body, flow.sites)
  }
}

/**
 * A holder's constructor or `wipe()`: one variable per `Secret` field, after
 * the locals and parameters. True for the `wipe()`, whose slots are owned and
 * start live; a constructor's are set once (`building`).
 */
const collectSlots = (flow: SecretFlow, body: Node): boolean => {
  const sig = flow.ctx.current
  if (sig === null) {
    return false
  }
  const owner = sig.owner
  if (owner === null || secretFieldOf(flow.ctx.table, owner) === null) {
    return false
  }
  const wipe = owner.method("wipe")
  const releaser = sig.role !== ROLE_CONSTRUCTOR && wipe !== null && sig === wipe
  flow.building = sig.role === ROLE_CONSTRUCTOR
  if (!releaser && !flow.building) {
    return false
  }
  for (const field of owner.fields) {
    if (flow.ctx.table.isSecret(field.type)) {
      flow.vars.push(new Local(`this.${field.name}`, field.type, false, STORAGE_LOCAL))
      flow.owned.push(releaser)
      // `wipe`'s own name, where the end of its body is reported.
      flow.declNodes.push(sig.decl)
      flow.declBlocks.push(body)
      flow.declDepths.push(0)
      flow.slots.push(field.name)
    }
  }
  return releaser
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

// ---- Sole reference ------------------------------------------------------------------------

/** Judging the argument of `secret(...)`, which it moves in. */
const FRESH_SITE: i32 = 0
/** Judging what a function returns, for a caller that hands its answer to `secret`. */
const FRESH_RETURN: i32 = 1

/** `secret(v)` for a `v` that something else still holds. */
const aliasMessage = (what: string, ref: string, copy: string): string =>
  `\`secret\` takes a value nothing else holds, and ${what} has a second reference: ${ref}. That ` +
  "reference would read the key outside the `Secret`, and zeros once it is wiped, so pass a fresh value " +
  `(\`secret([1, 2, 3])\`, a \`new\`, or a call that makes one) or a copy: ${copy}`

/** The copy `aliasMessage` suggests for the value `name` of `type`, or for one with no name (""). */
const copyHint = (table: TypeTable, type: i32, name: string): string => {
  if (type < 0 || type === T_ERROR || name.length === 0) {
    return "bind the value to a `const` first, then copy that into a new array or record"
  }
  const plain = table.stripNull(type)
  if (table.isArray(plain)) {
    const element = table.typeName(table.refOf(plain))
    return `\`const copy: ${element}[] = new Array<${element}>(${name}.length); copy.set(${name})\``
  }
  return `a new \`${table.typeName(plain)}\` with each field copied`
}

/** Whether a value of `type` can be a second reference to memory: an array, a record, a C pointer. */
const holdsReference = (table: TypeTable, type: i32): boolean => {
  if (type < 0) {
    return true
  }
  const plain = table.stripNull(type)
  return table.isArray(plain) || table.isStruct(plain) || plain === T_CPTR
}

/** The widest source span a diagnostic quotes whole. */
const QUOTE_WIDTH: i32 = 72

/**
 * `node` as a diagnostic quotes it, on one line and with its line,
 * `` `const alias = raw` (line 5) ``, and the function it is in when that is
 * not the one being reported.
 */
const quoteAt = (program: CheckedProgram, node: Node, owner: string): string => {
  const text = program.source.text.substring(node.start, node.end)
  const out = new StringBuilder()
  let space = false
  let i = 0
  while (i < text.length) {
    const c = text.charCodeAt(i)
    i = i + 1
    if (c === 32 || c === 10 || c === 13 || c === 9) {
      space = true
      continue
    }
    if (space && !out.isEmpty()) {
      out.addChar(32)
    }
    space = false
    out.addChar(c)
  }
  let quoted = out.toText()
  if (quoted.endsWith(";")) {
    quoted = quoted.substring(0, quoted.length - 1)
  }
  const line = program.source.lineOf(node.start)
  return owner.length > 0 ? `\`${quoted}\` (line ${line}, in \`${owner}\`)` : `\`${quoted}\` (line ${line})`
}

/** Whether `node` is a statement: what `quoteAt` quotes an expression inside. */
const isStatement = (node: Node): boolean =>
  node.kind === N_VAR ||
  node.kind === N_EXPR_STMT ||
  node.kind === N_RETURN ||
  node.kind === N_IF ||
  node.kind === N_WHILE ||
  node.kind === N_DO ||
  node.kind === N_FOR ||
  node.kind === N_FOR_OF ||
  node.kind === N_SWITCH ||
  node.kind === N_THROW

/** The `Result` methods that answer the `Ok` payload of their receiver: what `Ok(v)` carries comes back out. */
const answersPayload = (method: string): boolean =>
  method === "orReturn" || method === "expect" || method === "unwrapOr"

/**
 * One walk over a body for every occurrence of `local`: the declarations and
 * assignments that give it a value, and the first occurrence that would leave
 * a second reference to that value behind. `consumer` is the occurrence being
 * judged, which is the one place the value is allowed to go. What the facts
 * must answer — whether a callee keeps it — goes to `judge` as a need.
 */
class ReferenceScan {
  judge: FreshJudge
  local: Local
  consumer: Node
  /** The initialisers and right-hand sides that give `local` its value, and what each quotes. */
  sources: Node[]
  sourceOuters: Node[]
  /** The quoted occurrence that leaves a second reference, or "" while there is none. */
  leak: string
  ancestors: Node[]

  constructor(judge: FreshJudge, local: Local, consumer: Node) {
    this.judge = judge
    this.local = local
    this.consumer = consumer
    this.sources = []
    this.sourceOuters = []
    this.leak = ""
    this.ancestors = []
  }

  /**
   * What a diagnostic quotes for `node`: the statement around it, or, when
   * that is too long for one line of a message, the widest expression inside
   * it that is not.
   */
  statementAround(node: Node): Node {
    let quoted = node
    let i = this.ancestors.length - 1
    while (i >= 0) {
      const at = this.ancestors[i]
      if (at.end - at.start > QUOTE_WIDTH) {
        return quoted
      }
      quoted = at
      if (isStatement(at)) {
        return at
      }
      i = i - 1
    }
    return quoted
  }

  /** Whether `node` is bound to `local`, through the parameter a data-parallel arrow captures it as. */
  names(node: Node): boolean {
    const bound = sourceLocal(this.judge.program.nodeLocals[node.id])
    return bound !== null && bound === this.local
  }

  visit(node: Node, inArrow: boolean): void {
    if (node.kind === N_VAR_DECL && this.names(node) && node.children[2].kind !== N_EMPTY) {
      this.sources.push(node.children[2])
      this.sourceOuters.push(this.statementAround(node))
    }
    if (node.kind === N_FOR_OF && node.children[0].kind === N_VAR && this.leak.length === 0) {
      for (const decl of node.children[0].children[0].children) {
        if (decl.kind === N_VAR_DECL && this.names(decl)) {
          this.leak = `${this.judge.quote(node.children[0])} binds an element of an array`
        }
      }
    }
    if (node.kind === N_BINARY && node.text === "=") {
      const target = unwrapSecretNode(node.children[0])
      if (target.kind === N_IDENT && this.names(target)) {
        this.sources.push(node.children[1])
        this.sourceOuters.push(this.statementAround(node))
      }
    }
    if (node.kind === N_IDENT && node !== this.consumer && this.names(node) && this.leak.length === 0) {
      if (inArrow || !this.harmless(node)) {
        this.leak = this.judge.quote(this.statementAround(node))
      }
    }
    this.ancestors.push(node)
    for (const child of node.children) {
      this.visit(child, inArrow || node.kind === N_ARROW)
    }
    this.ancestors.pop()
  }

  /**
   * Whether the occurrence `node` (the top of `ancestors` is its parent)
   * leaves no second reference: it reads an element or a field that holds an
   * integer, the length, compares, iterates, is the target of an assignment,
   * calls an array method, or is handed to a callee that keeps nothing (asked
   * of the facts later). Everything else — an initialiser, an assignment's
   * value, a field or element store, a literal's element, a `return`, and
   * whatever a ternary arm or a `??` hands its value on to — is a second name
   * for the value.
   */
  harmless(node: Node): boolean {
    return this.harmlessAt(node, this.ancestors.length - 1)
  }

  /**
   * `harmless` for `node`, whose innermost ancestor is at `at`. An
   * assignment to the local is harmless only where its own value is
   * dropped, by a statement or a `for` header; anywhere else that value is
   * the local's array, judged as `node` would be (`alias = raw = [...]`,
   * `xs.push(raw = [...])`).
   */
  harmlessAt(node: Node, at: i32): boolean {
    let child = node
    let i = at
    let up = this.handsOn(child, i)
    while (up > 0) {
      i = i - up
      child = this.ancestors[i + 1]
      up = this.handsOn(child, i)
    }
    if (this.consumed(child, i)) {
      return true
    }
    if (i < 0) {
      return false
    }
    const parent = this.ancestors[i]
    switch (parent.kind) {
      case N_VAR_DECL:
        return child === parent.children[0]
      case N_BINARY:
        if (parent.text === "=") {
          return child === parent.children[0] && this.harmlessAt(parent, i - 1)
        }
        return parent.text === "===" || parent.text === "!=="
      case N_INDEX:
        return (
          child === parent.children[0] &&
          !holdsReference(this.judge.table, this.judge.program.nodeTypes[parent.id])
        )
      case N_MEMBER:
        return this.member(parent, i)
      case N_LIST:
        return i > 0 && this.argument(child, parent, this.ancestors[i - 1])
      case N_FOR_OF:
        return child === parent.children[1]
      case N_EXPR_STMT:
        return true
      case N_FOR:
        return child === parent.children[0] || child === parent.children[2]
      default:
        return false
    }
  }

  /**
   * How many of the ancestors above `child` (the innermost is at `at`) are
   * a wrapper whose own value is `child`'s, or 0: parentheses, a ternary arm,
   * either side of `??`, the argument of `Ok` or `Err` (the `Result` holds
   * it), and the receiver, or the default, of a `Result` method that answers
   * the payload (`r.orReturn()`, `r.expect(m)`, `r.unwrapOr(d)`). A use of the
   * wrapper is then a use of `child`.
   */
  handsOn(child: Node, at: i32): i32 {
    if (at < 0) {
      return 0
    }
    const parent = this.ancestors[at]
    if (
      parent.kind === N_PAREN ||
      (parent.kind === N_CONDITIONAL && parent.children[0] !== child) ||
      (parent.kind === N_BINARY && parent.text === "??")
    ) {
      return 1
    }
    if (at < 1) {
      return 0
    }
    const call = this.ancestors[at - 1]
    if (call.kind !== N_CALL) {
      return 0
    }
    const program = this.judge.program
    const table = this.judge.table
    if (parent.kind === N_LIST && call.children[1] === parent) {
      if (isResultConstructorCall(program, table, call)) {
        return 2
      }
      return resultMethodName(program, table, call) === "unwrapOr" ? 2 : 0
    }
    if (parent.kind === N_MEMBER && call.children[0] === parent) {
      return answersPayload(resultMethodName(program, table, call)) ? 2 : 0
    }
    return 0
  }

  /**
   * Whether `value`, the occurrence with every wrapper that hands it on, is
   * where the value is allowed to go: the argument of a `secret(...)` (which
   * the move rule then governs), or, for a function's own result, a `return`.
   */
  consumed(value: Node, at: i32): boolean {
    if (this.judge.mode === FRESH_RETURN) {
      return at < 0 || this.ancestors[at].kind === N_RETURN
    }
    if (at < 1 || this.ancestors[at].kind !== N_LIST) {
      return false
    }
    const call = this.ancestors[at - 1]
    return (
      call.kind === N_CALL &&
      call.children[1] === this.ancestors[at] &&
      call.children[1].children[0] === value &&
      secretRoleOf(this.judge.program.nodeCallees[call.id]) === SECRET_MAKE
    )
  }

  /** `local.length`, `local.lo`, `local.push(1)`, `local.method()`: the receiver of a member. */
  member(access: Node, at: i32): boolean {
    const call: Node | null = at > 0 ? this.ancestors[at - 1] : null
    if (call !== null && call.kind === N_CALL && call.children[0] === access) {
      const sig = this.judge.program.nodeCallees[call.id]
      if (sig !== null) {
        this.keep(sig, "this", call)
      }
      // Every array method keeps nothing of its receiver: `push`, `pop`,
      // `indexOf`, `join`, `set` and `fill` answer a number, a string or nothing.
      return true
    }
    return !holdsReference(this.judge.table, this.judge.program.nodeTypes[access.id])
  }

  /** `local` as an argument of the call or `new` that `list` belongs to. */
  argument(child: Node, list: Node, owner: Node): boolean {
    const program = this.judge.program
    const index = list.children.indexOf(child)
    if (index < 0) {
      return false
    }
    if (owner.kind === N_NEW && owner.children[2] === list) {
      const ctor = program.nodeCallees[owner.id]
      return ctor !== null && this.keepParameter(ctor, index, owner)
    }
    if (owner.kind !== N_CALL || owner.children[1] !== list) {
      return false
    }
    const sig = program.nodeCallees[owner.id]
    const role = secretRoleOf(sig)
    if (role === SECRET_WIPE) {
      return true
    }
    const instance: Instantiation | null = sig === null ? null : sig.instance
    if (
      role === SECRET_EXPOSE_WITH &&
      index === 1 &&
      instance !== null &&
      instance.functionArgs.length === 1
    ) {
      const fn = instance.functionArgs[0]
      return fn.paramNames.length > 1 && this.keep(fn, fn.paramNames[1], owner)
    }
    if (role !== SECRET_NONE) {
      return false
    }
    if (sig !== null) {
      return this.keepParameter(sig, index, owner)
    }
    // An identifier builtin keeps nothing it is handed but for `Ok` and
    // `Err`, whose `Result` holds it (`handsOn` follows those, so they never
    // reach here): the rest — `ctSelect`, `ctEq`, `parseInt`, `parseFloat`,
    // `Number`, the file, process and environment builtins, `write`,
    // `panic`, `secureZero`, `arena`, `crypto.getRandomValues`, `nish:net` —
    // read it or write it and return, or copy it into what they answer. A
    // method of a value may store what it is handed (`xs.push(raw)`), but
    // for `dst.set(raw)`, which copies elements.
    const receiver = methodReceiver(owner)
    if (receiver === null) {
      return !isResultConstructorCall(program, this.judge.table, owner)
    }
    const type = program.nodeTypes[receiver.id]
    return (
      type < 0 ||
      (owner.children[0].text === "set" && this.judge.table.isArray(this.judge.table.stripNull(type)))
    )
  }

  /** The `index`-th argument of a call of `sig`, which has `this` first when it is a method or a constructor. */
  keepParameter(sig: FunctionSig, index: i32, call: Node): boolean {
    const at = sig.paramNames.length > 0 && sig.paramNames[0] === "this" ? index + 1 : index
    if (at >= sig.paramNames.length || sig.isCompileTime(at)) {
      return false
    }
    return this.keep(sig, sig.paramNames[at], call)
  }

  /** Ask the facts later whether `sig` keeps its parameter `name`. */
  keep(sig: FunctionSig, name: string, call: Node): boolean {
    this.judge.need(sig, name, this.judge.quote(this.statementAround(call)))
    return true
  }
}

/**
 * Whether an expression is a value nothing else holds, judged over the body
 * it is in (docs/LANGUAGE.md, "Secrets"). A literal and a `new` are; a call is
 * when its callee's answer is, and a local is when it is not a parameter, every
 * value it is given is, and no other occurrence of it leaves a second
 * reference. What only the whole-program facts can answer — what a callee
 * returns, what it keeps — is left in `needs` for them. The first reason it
 * is not is `failure`, quoted where the second reference is made.
 */
class FreshJudge {
  program: CheckedProgram
  table: TypeTable
  body: Node
  mode: i32
  /** The function whose result is judged, for the quotes; "" at a `secret(...)`. */
  owner: string
  /** The `secret(...)` argument the needs are reported at, and the copy its diagnostic suggests. */
  site: Node
  copy: string
  /** How the diagnostic names what is being judged: the local, the call, or the argument as written. */
  subject: string
  failure: string
  failSubject: string
  needs: SecretNeed[]
  judged: Local[]
  verdicts: boolean[]

  constructor(program: CheckedProgram, table: TypeTable, body: Node, mode: i32, owner: string, site: Node) {
    this.program = program
    this.table = table
    this.body = body
    this.mode = mode
    this.owner = owner
    this.site = site
    this.copy = ""
    this.subject = ""
    this.failure = ""
    this.failSubject = ""
    this.needs = []
    this.judged = []
    this.verdicts = []
  }

  /** `node` quoted where it is, in the function being judged. */
  quote(node: Node): string {
    return quoteAt(this.program, node, this.owner)
  }

  fail(ref: string): boolean {
    if (this.failure.length === 0) {
      this.failure = ref
      this.failSubject = this.subject
    }
    return false
  }

  need(sig: FunctionSig, param: string, via: string): void {
    this.needs.push(new SecretNeed(this.site, sig, param, this.subject, via, this.copy))
  }

  judge(expr: Node): boolean {
    const e = unwrapSecretNode(expr)
    switch (e.kind) {
      case N_ARRAY:
      case N_OBJECT:
      case N_NULL:
        return true
      case N_CONDITIONAL:
        return this.judge(e.children[1]) && this.judge(e.children[2])
      case N_NEW: {
        const ctor = this.program.nodeCallees[e.id]
        if (ctor !== null) {
          this.need(ctor, "this", this.quote(e))
        }
        return true
      }
      case N_CALL:
        return this.call(e)
      case N_IDENT: {
        const local = this.program.nodeLocals[e.id]
        if (local === null) {
          return this.fail(`${this.quote(e)} is not a local this function made`)
        }
        return this.local(local, e)
      }
      case N_MEMBER:
      case N_INDEX:
        return this.fail(`${this.quote(e)} reads a field or an element something else holds`)
      default:
        return this.fail(`${this.quote(e)} is not a value this function made`)
    }
  }

  call(e: Node): boolean {
    const sig = this.program.nodeCallees[e.id]
    if (sig === null) {
      // `Ok(v)` carries `v` as the payload a `Result` method answers, and
      // `Err(e)` carries none; `r.orReturn()` answers what `r` carries.
      const args = e.children[1].children
      if (isResultConstructorCall(this.program, this.table, e)) {
        return e.children[0].text !== "Ok" || args.length === 0 || this.judgeCarried(args[0])
      }
      const method = resultMethodName(this.program, this.table, e)
      const payload = methodReceiver(e)
      if (answersPayload(method) && payload !== null) {
        return (
          this.judgeCarried(payload) &&
          (method !== "unwrapOr" || args.length === 0 || this.judgeCarried(args[0]))
        )
      }
      // An identifier builtin answers memory it allocated; a method of a value
      // (`xs.pop()`) may answer what the value holds.
      const receiver = methodReceiver(e)
      if (receiver === null || this.program.nodeTypes[receiver.id] < 0) {
        return true
      }
      return this.fail(`${this.quote(e)} may answer what its receiver holds`)
    }
    const saved = this.subject
    if (this.mode === FRESH_SITE && this.site === e) {
      this.subject = `the value \`${this.program.source.text.substring(e.start, e.end)}\` answers`
    }
    this.need(sig, "", "")
    this.subject = saved
    return true
  }

  local(local: Local, at: Node): boolean {
    const k = this.judged.indexOf(local)
    if (k >= 0) {
      return this.verdicts[k] || this.fail(`${this.quote(at)} is given its own value`)
    }
    const saved = this.subject
    this.subject = `\`${local.name}\``
    // A cycle (`a = b`, `b = a`) is judged not fresh while it is in progress.
    this.judged.push(local)
    this.verdicts.push(false)
    const slot = this.judged.length - 1
    const ok = this.localVerdict(local, at)
    this.verdicts[slot] = ok
    this.subject = saved
    return ok
  }

  localVerdict(local: Local, at: Node): boolean {
    if (local.storage === STORAGE_PARAM) {
      return this.fail(`${this.quote(at)} is a parameter, which the caller still holds`)
    }
    const scan = new ReferenceScan(this, local, at)
    scan.visit(this.body, false)
    if (scan.leak.length > 0) {
      return this.fail(scan.leak)
    }
    let k = 0
    while (k < scan.sources.length) {
      if (!this.judgeSource(scan.sources[k], scan.sourceOuters[k])) {
        return false
      }
      k = k + 1
    }
    return true
  }

  /**
   * A value a `Result` carries to where it is judged: `v` in `Ok(v)`, and the
   * receiver and default of `r.unwrapOr(d)`. A function's own `return Ok(out)`
   * is judged as `out` is; at a `secret(...)`, a local there is another name
   * the move does not reach, as `judgeSource` says.
   */
  judgeCarried(value: Node): boolean {
    return this.mode === FRESH_RETURN ? this.judge(value) : this.judgeSource(value, value)
  }

  /**
   * A value a local is given: fresh as `judge` says, except that another
   * local is never one, because that local still names the value
   * (`let raw = [1]; raw = other`).
   */
  judgeSource(source: Node, outer: Node): boolean {
    const e = unwrapSecretNode(source)
    if (e.kind === N_CONDITIONAL) {
      return this.judgeSource(e.children[1], outer) && this.judgeSource(e.children[2], outer)
    }
    if (e.kind === N_IDENT) {
      return this.fail(`${this.quote(outer)}, where \`${e.text}\` still names the value`)
    }
    return this.judge(e)
  }
}

/**
 * The sole-reference rule at each `secret(v)` among `sites`: `v` is a value
 * nothing else holds. What the body alone decides is reported here; what a
 * callee returns or keeps is recorded in `secretNeeds` for
 * `Compilation.checkSecrets`. Asked only of a body the ownership walk
 * accepted, so a parameter, a field or an element (NL2447) and a moved local
 * (NL2445) are said once, by that walk.
 */
const checkSoleReferences = (ctx: CheckContext, body: Node, sites: Node[]): void => {
  for (const site of sites) {
    const args = site.children[1].children
    if (args.length > 0) {
      checkSoleReference(ctx, body, args[0])
    }
  }
}

/** The sole-reference rule at one `secret(arg)` in `body`. */
const checkSoleReference = (ctx: CheckContext, body: Node, arg: Node): void => {
  const program = ctx.program
  const named = unwrapSecretNode(arg)
  const judge = new FreshJudge(program, ctx.table, body, FRESH_SITE, "", arg)
  judge.copy = copyHint(ctx.table, program.nodeTypes[arg.id], named.kind === N_IDENT ? named.text : "")
  judge.subject = `\`${ctx.textOf(arg)}\``
  if (!judge.judge(arg)) {
    ctx.error(arg, aliasMessage(judge.failSubject, judge.failure, judge.copy))
    ctx.errored = false
    return
  }
  for (const need of judge.needs) {
    recordSecretNeed(program, need)
  }
}

/** Remember `need` once: a generic body is checked once per instantiation and asks again. */
const recordSecretNeed = (program: CheckedProgram, need: SecretNeed): void => {
  for (const seen of program.secretNeeds) {
    if (seen.site === need.site && seen.sig === need.sig && seen.param === need.param) {
      return
    }
  }
  program.secretNeeds.push(need)
}

/** Every `return` value of a block body, outside the arrows it holds. */
const collectReturnValues = (node: Node, out: Node[]): void => {
  if (node.kind === N_ARROW) {
    return
  }
  if (node.kind === N_RETURN && node.children[0].kind !== N_EMPTY) {
    out.push(node.children[0])
  }
  for (const child of node.children) {
    collectReturnValues(child, out)
  }
}

/**
 * The whole-program half of the sole-reference rule: whether a function
 * answers a value nothing else holds, judged over its own body by the same
 * rule a `secret(v)` is, and whether it keeps a parameter, which the facts say
 * (`PointerParamFacts.captured`). Each function's body is judged once
 * (`FreshSummary`), and the answers are the greatest fixpoint over the calls
 * between them: a function is fresh unless its own body or a callee it
 * answers through says otherwise. Every value a call answers was made by some
 * expression a body holds, and each of those is judged, so a recursive
 * function that only ever answers a literal is fresh.
 */
export class FreshResults {
  programs: CheckedProgram[]
  table: TypeTable
  facts: FactsTable
  summaries: FreshSummary[]
  /** How many of `summaries` the fixpoint has settled. */
  settled: i32

  constructor(programs: CheckedProgram[], table: TypeTable, facts: FactsTable) {
    this.programs = programs
    this.table = table
    this.facts = facts
    this.summaries = []
    this.settled = 0
  }

  /** "" when `need` holds, or the second reference it found. */
  refOf(need: SecretNeed): string {
    return need.param.length === 0 ? this.resultRef(need.sig) : this.keepRef(need)
  }

  keepRef(need: SecretNeed): string {
    const sig = need.sig
    const what = need.param === "this" ? "`this`" : `its parameter \`${need.param}\``
    const f = this.facts.get(sig.name)
    if (f === null) {
      return `${need.via}, and ${calleeName(sig)} may keep ${what}`
    }
    const pointer = f.pointerParam(need.param)
    return pointer !== null && pointer.captured ? `${need.via}, and ${calleeName(sig)} keeps ${what}` : ""
  }

  /** "" when `sig` answers a value nothing else holds, or the second reference it may answer. */
  resultRef(sig: FunctionSig): string {
    const start = this.summaryOf(sig)
    // Summarise every function the answer can come through, then settle them,
    // once for each set of new summaries.
    let next = this.settled
    while (next < this.summaries.length) {
      for (const callee of this.summaries[next].calls) {
        this.summaryOf(callee)
      }
      next = next + 1
    }
    let changed = this.settled < this.summaries.length
    while (changed) {
      changed = false
      for (const summary of this.summaries) {
        for (const callee of summary.calls) {
          const ref = this.summaryOf(callee).ref
          if (summary.ref.length === 0 && ref.length > 0) {
            summary.ref = ref
            changed = true
          }
        }
      }
    }
    this.settled = this.summaries.length
    return start.ref
  }

  /** `sig`'s summary, judging its body the first time it is asked for. */
  summaryOf(sig: FunctionSig): FreshSummary {
    for (const summary of this.summaries) {
      if (summary.name === sig.name) {
        return summary
      }
    }
    const summary = this.summarise(sig)
    this.summaries.push(summary)
    return summary
  }

  summarise(sig: FunctionSig): FreshSummary {
    const out = new FreshSummary(sig.name)
    const role = secretRoleOf(sig)
    const instance = sig.instance
    if ((role === SECRET_EXPOSE || role === SECRET_EXPOSE_WITH) && instance !== null) {
      // What `expose` answers is what the function it runs answers.
      if (instance.functionArgs.length === 1) {
        out.calls.push(instance.functionArgs[0])
      } else {
        out.ref = `\`${sig.sourceName}\` runs no function here`
      }
      return out
    }
    const body = sig.body()
    if (role !== SECRET_NONE || sig.foreign() || body === null) {
      out.ref = `${calleeName(sig)} is not a function whose answer can be judged`
      return out
    }
    let program: CheckedProgram | null = null
    for (const p of this.programs) {
      if (sig.definedIn(p.source)) {
        program = p
      }
    }
    if (program === null) {
      out.ref = `${calleeName(sig)} is not a function this program defines`
      return out
    }
    if (instance !== null) {
      program.enterInstance(instance)
    }
    const judge = new FreshJudge(program, this.table, body, FRESH_RETURN, sig.sourceName, body)
    let fresh = true
    if (body.kind === N_BLOCK) {
      const values: Node[] = []
      collectReturnValues(body, values)
      for (const value of values) {
        fresh = fresh && judge.judge(value)
      }
    } else {
      fresh = judge.judge(body)
    }
    // Only one instantiation's side tables are installed at a time, so the
    // callees are summarised after this one is left.
    if (instance !== null) {
      program.leaveInstance()
    }
    if (!fresh) {
      out.ref = judge.failure
      return out
    }
    // What a callee keeps is the facts' answer already; what it answers
    // waits for the fixpoint.
    for (const need of judge.needs) {
      if (need.param.length === 0) {
        out.calls.push(need.sig)
      } else if (out.ref.length === 0) {
        out.ref = this.keepRef(need)
      }
    }
    return out
  }
}

/**
 * What one function's own body says about its answer: `ref`, the second
 * reference it found (or "" for none yet), and the callees it answers
 * through, whose answers the fixpoint folds in.
 */
class FreshSummary {
  /** The function's symbol. */
  name: string
  ref: string
  calls: FunctionSig[]

  constructor(name: string) {
    this.name = name
    this.ref = ""
    this.calls = []
  }
}

/** How a diagnostic names the function `sig`: `keep`, `Key.enrol`, the constructor of `Holder`. */
const calleeName = (sig: FunctionSig): string => {
  const owner = sig.owner
  return sig.decl.kind === N_CONSTRUCTOR && owner !== null
    ? `the constructor of \`${owner.name}\``
    : `\`${sig.sourceName}\``
}

/** The sole-reference refusal `need` earns, or "" when its callee answers or keeps as the rule needs. */
export const secretNeedMessage = (results: FreshResults, need: SecretNeed): string => {
  const ref = results.refOf(need)
  return ref.length === 0 ? "" : aliasMessage(need.what, ref, need.copy)
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
  symbol === "nish_str_index_of_from" ||
  // Effect-pure, but variable-time: how long it takes says where the first
  // match is, so `std/crypto` must not call `indexOfAny` on secret data.
  symbol === "nish_str_index_of_any" ||
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
  program.exposeCalls.push(new ParallelCall(node, sig, null))
}
