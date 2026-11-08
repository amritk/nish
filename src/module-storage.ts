/**
 * WP50 stage 3: module storage (`docs/wp50-wasm-host.md` §5, `docs/LANGUAGE.md`
 * → "Module storage").
 *
 * A top-level `const sim = new Array<Sim>(4)`, or a typed-array `new`, is the
 * one piece of state a module keeps between calls: a static array, emitted as
 * two globals (`src/emit.ts` → `emitStorage`) and zero-filled by the loader, so
 * no code runs to build it. That is what makes it safe to read from a page
 * through `layout` (`src/interop-dts.ts`) and what lets a module that keeps it
 * still have no top-level code.
 *
 * The rules are the ones that keep its bytes where a page can find them:
 *
 * - **its length is a compile-time constant**, so the layout is a literal;
 * - **its element is pointer-free** — a scalar, an enum or a range whose zero is
 *   a member, a `HostHandle`, or an interface no class implements whose fields
 *   are all of these — so the zero fill is a value of the type;
 * - **it never moves and never resizes**: no method runs on it and its length
 *   is never assigned;
 * - **its name is never a value**, so nothing aliases it — the one exception
 *   is an argument lent to a parameter declared with a typed-array name, which
 *   has no `push`, `pop` or `length =`, or to a host function's buffer window
 *   (`lendsStorage`) — and **a record
 *   element is a place, not a value**: `sim[i].x` reads and writes a field,
 *   `sim[i] = v` and `sim[i] = sim[j]` copy a whole element, and nothing binds,
 *   passes or returns one. Under `--emit-ts` the storage is one `ArrayBuffer`
 *   and `sim[i]` an object of accessors over it, so a binding that held one
 *   would alias the buffer where the native build holds a copy.
 */

import { parameterSpelling } from "./checker"
import { CheckContext } from "./context"
import { dottedName, isAssignmentOperator, storesInlineElements, unwrapParens } from "./emit-util"
import {
  N_BINARY,
  N_CALL,
  N_EXPR_STMT,
  N_FOR_OF,
  N_FUNCTION,
  N_IDENT,
  N_INDEX,
  N_LIST,
  N_MEMBER,
  N_NEW,
  N_NUMBER,
  N_PAREN,
  N_UNARY,
  Node,
} from "./nodes"
import {
  CheckedProgram,
  ConstInfo,
  FunctionSig,
  StructInfo,
  elementStride,
  inlineElementStruct,
} from "./program"
import { SORT_LOCAL } from "./std-modules"
import { T_BOOL, T_U8, TypeTable, isHostWindow, isNumeric } from "./types"

/** The most elements one storage may hold. */
const STORAGE_MAX_LENGTH: i32 = 16777216

/**
 * The most bytes one storage may span: 16,777,216 elements of the widest
 * number fit, and a record wide enough to pass it would otherwise reach a
 * data section the linker cannot write (wasm's is 32-bit) instead of a
 * diagnostic.
 */
const STORAGE_MAX_BYTES: i32 = 268435456

/**
 * Whether `init`, a top-level `const`'s initialiser, is a storage `new`:
 * `new Array<T>(n)` or `new Float32Array(n)` and the other typed arrays.
 */
export const isStorageNew = (init: Node, typedElement: i32): boolean => {
  const expr = unwrapParens(init)
  if (expr.kind !== N_NEW || expr.children[0].kind !== N_IDENT) {
    return false
  }
  return expr.children[0].text === "Array" || typedElement >= 0
}

/** The storage `new` itself, past any parentheses. */
export const storageNewNode = (init: Node): Node => unwrapParens(init)

/**
 * Check `info`'s element and the shape of its length, and answer the length
 * expression for `foldConstant` to fold, or null once something is reported. Runs from `foldConstants`, once
 * every module has its signatures, because whether an interface is a record
 * (`implemented`) is known only then. Reports against the declaring module.
 */
export const checkStorage = (ctx: CheckContext, info: ConstInfo): Node | null => {
  const expr = storageNewNode(info.decl.children[2])
  const elemNode = expr.children[1].children.length > 0 ? expr.children[1].children[0] : expr
  const name = info.name
  const elem = info.storageElem
  const spelled = ctx.table.typeName(elem)
  if (!checkStorageElement(ctx, info, elemNode, elem, spelled)) {
    return null
  }
  const args = expr.children[2]
  if (args.children.length !== 1 || !storageLengthShaped(info, args.children[0])) {
    storageReport(
      ctx,
      info,
      args.children.length === 1 ? args.children[0] : expr,
      `Module storage \`${name}\` needs a length known at compile time: a literal, a module constant, or arithmetic over them, because the page reads its layout from the type`
    )
    return null
  }
  return args.children[0]
}

/**
 * The length has folded to `value`; `integer` is false when it folded to
 * something other than an integer. Range-check it and record it.
 */
export const acceptStorageLength = (
  ctx: CheckContext,
  info: ConstInfo,
  lengthNode: Node,
  integer: boolean,
  value: i64
): void => {
  if (!integer) {
    storageReport(
      ctx,
      info,
      lengthNode,
      `Module storage \`${info.name}\` needs a length known at compile time: a literal, a module constant, or arithmetic over them, because the page reads its layout from the type`
    )
    return
  }
  if (value < toI64(1) || value > toI64(STORAGE_MAX_LENGTH)) {
    storageReport(
      ctx,
      info,
      lengthNode,
      `Module storage \`${info.name}\` has length ${value}; a storage holds from 1 to ${STORAGE_MAX_LENGTH} elements`
    )
    return
  }
  const stride = elementStride(ctx.program, ctx.table, info.storageElem)
  if (value * toI64(stride) > toI64(STORAGE_MAX_BYTES)) {
    storageReport(
      ctx,
      info,
      lengthNode,
      `Module storage \`${info.name}\` has length ${value} of ${stride}-byte elements; a storage holds from 1 to ${STORAGE_MAX_LENGTH} elements and at most ${STORAGE_MAX_BYTES} bytes`
    )
    return
  }
  info.intValue = value
}

const storageReport = (ctx: CheckContext, info: ConstInfo, node: Node, message: string): void => {
  ctx.sink.report(info.origin, node.start, node.end, message)
}

/**
 * Whether a length expression has the shape a constant folds from. Anything
 * else is refused here with the storage's own message, before the folder would
 * refuse it with a module constant's.
 */
const storageLengthShaped = (info: ConstInfo, expr: Node): boolean => {
  switch (expr.kind) {
    case N_NUMBER:
      return true
    case N_PAREN:
    case N_UNARY:
      return expr.children.length === 1 && storageLengthShaped(info, expr.children[0])
    case N_BINARY:
      return storageLengthShaped(info, expr.children[0]) && storageLengthShaped(info, expr.children[1])
    case N_IDENT: {
      const scope = info.scope
      const target: ConstInfo | null = scope === null ? null : scope.constant(expr.text)
      return target !== null && !target.storage
    }
    case N_CALL: {
      // `wrappingMul(A, B)` under `nish:unsafe` is the one call a constant
      // folds; whether it is that import is the folder's to judge.
      const callee = expr.children[0]
      return callee.kind === N_IDENT && callee.text.startsWith("wrapping")
    }
    default:
      return false
  }
}

/** What a storage element's check found: nothing wrong, an element with no type, a zero that is no value, or a type storage cannot hold. */
const FAULT_NONE: i32 = 0
const FAULT_SILENT: i32 = 1
const FAULT_ZERO: i32 = 2
const FAULT_HOLD: i32 = 3
const FAULT_NESTED: i32 = 4

/**
 * Whether `elem` is a type whose zero fill is one of its values and holds no
 * pointer; reports against `at`, spelling the element `spelled`, when not.
 */
const checkStorageElement = (
  ctx: CheckContext,
  info: ConstInfo,
  at: Node,
  elem: i32,
  spelled: string
): boolean => {
  const table = ctx.table
  const fault = storageElementFault(ctx, info, elem)
  if (fault === FAULT_NONE) {
    return true
  }
  if (fault !== FAULT_HOLD) {
    return storageFaultReport(ctx, info, at, fault, spelled)
  }
  const scope = info.scope
  const record: StructInfo | null = scope === null ? null : storageRecord(scope, table, elem)
  if (record === null) {
    return storageFaultReport(ctx, info, at, fault, spelled)
  }
  let bad = -1
  let inner = FAULT_NONE
  let k = 0
  while (bad < 0 && k < record.fields.length) {
    inner = storageElementFault(ctx, info, record.fields[k].type)
    if (inner !== FAULT_NONE) {
      bad = k
    }
    k = k + 1
  }
  if (bad < 0) {
    return true
  }
  const field = record.fields[bad]
  // A field that is itself a record is a pointer to it, so it is refused as nested.
  const nested =
    inner === FAULT_HOLD && scope !== null && inlineElementStruct(scope, table, field.type) !== null
  const label = `${spelled}.${field.name} (${table.typeName(field.type)})`
  return storageFaultReport(ctx, info, at, nested ? FAULT_NESTED : inner, label)
}

/**
 * The interface `elem` names when storage may lay it inline: one no class
 * implements, and, for an instantiation (`Cell<i32>`), one whose template no
 * generic class implements either, since `implements Cell<T>` reaches an
 * instantiation only when the class is instantiated, after this check.
 */
const storageRecord = (program: CheckedProgram, table: TypeTable, elem: i32): StructInfo | null => {
  const info = inlineElementStruct(program, table, elem)
  if (info === null) {
    return null
  }
  const instance = info.instance
  return instance !== null && instance.template.implemented ? null : info
}

/**
 * Check `info`'s element again once every body and instantiation is checked:
 * an interface element that gained an implementer after `checkStorage`
 * accepted it would be laid out as a pointer per slot. Refused with the
 * message `checkStorage` gives an implemented interface.
 */
export const recheckStorage = (ctx: CheckContext, info: ConstInfo): void => {
  const scope = info.scope
  const elem = info.storageElem
  if (scope === null || storageElementFault(ctx, info, elem) !== FAULT_HOLD) {
    return
  }
  if (storageRecord(scope, ctx.table, elem) !== null) {
    return
  }
  const expr = storageNewNode(info.decl.children[2])
  const at = expr.children[1].children.length > 0 ? expr.children[1].children[0] : expr
  storageFaultReport(ctx, info, at, FAULT_HOLD, ctx.table.typeName(elem))
}

/** What is wrong with `elem` as a storage element or a record field, never looking inside a record. */
const storageElementFault = (ctx: CheckContext, info: ConstInfo, elem: i32): i32 => {
  const table = ctx.table
  if (elem < 0) {
    return FAULT_SILENT
  }
  if (isNumeric(elem) || elem === T_BOOL || table.isHostHandle(elem)) {
    return FAULT_NONE
  }
  if (table.isEnum(elem) || table.isEnumMemberType(elem) || table.isRanged(elem)) {
    return storageZeroIsMember(ctx, info, elem) ? FAULT_NONE : FAULT_ZERO
  }
  return FAULT_HOLD
}

/** Report `fault` for the element spelled `spelled`, and answer false. */
const storageFaultReport = (
  ctx: CheckContext,
  info: ConstInfo,
  at: Node,
  fault: i32,
  spelled: string
): boolean => {
  if (fault === FAULT_ZERO) {
    storageReport(
      ctx,
      info,
      at,
      `Module storage \`${info.name}\` is zero-filled, and 0 is not a value of ${spelled}; give the type a zero member, or store the number and convert it where it is read`
    )
  } else if (fault === FAULT_NESTED) {
    storageReport(
      ctx,
      info,
      at,
      `Module storage \`${info.name}\` cannot hold ${spelled}: a record field that is itself a record is a pointer to it, and storage holds no pointer; spell the inner fields on the outer record`
    )
  } else if (fault === FAULT_HOLD) {
    storageReport(
      ctx,
      info,
      at,
      `Module storage \`${info.name}\` cannot hold ${spelled}: its bytes are zero-filled where a page can read them, so an element is a number, a \`boolean\`, an enum or range whose zero is a member, a \`HostHandle\`, or an interface no class implements whose fields are all of these — never a string, an array, a class, a \`Map\` or a \`| null\``
    )
  }
  return false
}

/** Whether 0 is a value of the enum, member type or range `elem`. */
const storageZeroIsMember = (ctx: CheckContext, info: ConstInfo, elem: i32): boolean => {
  const table = ctx.table
  if (table.isRanged(elem)) {
    return table.rangeLo(elem) <= 0 && table.rangeHi(elem) >= 0
  }
  if (table.isEnumMemberType(elem)) {
    return table.memberValue(elem) === 0
  }
  const scope = info.scope
  if (scope === null) {
    return false
  }
  for (const e of scope.enumList) {
    if (e.type === elem) {
      for (const value of e.memberValues) {
        if (value === 0) {
          return true
        }
      }
      return false
    }
  }
  return false
}

// ---- Uses --------------------------------------------------------------------------

/** The storage `expr` names, or null: a bare identifier bound to module storage. */
const storageNamed = (ctx: CheckContext, expr: Node): ConstInfo | null => {
  const e = unwrapParens(expr)
  if (e.kind !== N_IDENT) {
    return null
  }
  const constant = ctx.program.nodeConstants[e.id]
  return constant !== null && constant.storage ? constant : null
}

/** The storage `expr` is an element of (`sim[i]`), or null. */
const storageElementOf = (ctx: CheckContext, expr: Node): ConstInfo | null => {
  const e = unwrapParens(expr)
  if (e.kind !== N_INDEX) {
    return null
  }
  return storageNamed(ctx, e.children[0])
}

/** Whether `info`'s element is a record (an inline interface) rather than a scalar. */
const storageHoldsRecords = (ctx: CheckContext, info: ConstInfo): boolean =>
  ctx.table.isStruct(info.storageElem)

/**
 * The use rules, over one function body (or the entry's top-level code). Each
 * refusal is reported once, at the use; the walk goes on, so every bad use of
 * the body is reported in one run.
 */
export const checkStorageUses = (ctx: CheckContext, node: Node): void => {
  switch (node.kind) {
    case N_IDENT: {
      const info = storageNamed(ctx, node)
      if (info !== null) {
        ctx.error(
          node,
          `Module storage \`${info.name}\` is a place, not a value: index it (\`${info.name}[i]\`) or read \`${info.name}.length\`, lend it only to a parameter declared \`u8[]\`, \`Int32Array\`, \`Float32Array\`, \`Float64Array\` or \`BigInt64Array\` or to a host function's buffer window, and never alias, return or store the array itself`
        )
      }
      return
    }
    case N_INDEX: {
      const info = storageNamed(ctx, node.children[0])
      if (info === null) {
        break
      }
      checkStorageUses(ctx, node.children[1])
      if (storageHoldsRecords(ctx, info)) {
        refuseElementValue(ctx, info, node)
      }
      return
    }
    case N_MEMBER: {
      const info = storageNamed(ctx, node.children[0])
      if (info !== null) {
        if (node.text !== "length") {
          refuseMethod(ctx, info, node, node.text)
        }
        return
      }
      if (storageElementOf(ctx, node.children[0]) !== null) {
        // `sim[i].x`: a field of a place, read or written.
        checkStorageUses(ctx, unwrapParens(node.children[0]).children[1])
        return
      }
      break
    }
    case N_CALL: {
      checkStorageCall(ctx, node)
      return
    }
    case N_BINARY: {
      if (isAssignmentOperator(node.text)) {
        checkStorageAssignment(ctx, node)
        return
      }
      break
    }
    case N_FOR_OF: {
      const info = storageNamed(ctx, node.children[1])
      if (info !== null && storageHoldsRecords(ctx, info)) {
        ctx.error(
          node.children[1],
          `\`for (const p of ${info.name})\` would bind an element of module storage \`${info.name}\`, which is a place, not a value: loop over the index and use \`${info.name}[i].field\``
        )
        checkStorageUses(ctx, node.children[0])
        checkStorageUses(ctx, node.children[2])
        return
      }
      if (info !== null) {
        checkStorageUses(ctx, node.children[0])
        checkStorageUses(ctx, node.children[2])
        return
      }
      break
    }
    default:
      break
  }
  for (const child of node.children) {
    checkStorageUses(ctx, child)
  }
}

/**
 * Refuse `S.length = n` on module storage with its own message, ahead of the
 * array rule that would point at `push`, which storage refuses too. Called by
 * the assignment check once it has typed the receiver; true when it reported.
 */
export const refuseStorageLength = (ctx: CheckContext, target: Node): boolean => {
  const info = storageNamed(ctx, target.children[0])
  if (info === null) {
    return false
  }
  refuseMethod(ctx, info, target, "length =")
  return true
}

const refuseElementValue = (ctx: CheckContext, info: ConstInfo, node: Node): void => {
  ctx.error(
    node,
    `An element of module storage \`${info.name}\` is a place, not a value: read and write its fields (\`${info.name}[i].x\`) or copy a whole element with \`${info.name}[i] = ${info.name}[j]\`, and never bind, return or store \`${info.name}[i]\` itself`
  )
}

const refuseMethod = (ctx: CheckContext, info: ConstInfo, node: Node, method: string): void => {
  ctx.error(
    node,
    `Module storage \`${info.name}\` has a fixed length and a fixed place, so \`${info.name}.${method}\` is not available: index it, and keep a count beside it for the slots in use`
  )
}

const checkStorageCall = (ctx: CheckContext, call: Node): void => {
  const callee = call.children[0]
  const args = call.children[1]
  let pushesCopy = false
  if (callee.kind === N_IDENT && callee.text === SORT_LOCAL && args.children.length > 0) {
    // `xs.sort(cmp)` was rewritten to the std sort over `xs` (`arrays.ts`).
    const sorted = storageNamed(ctx, args.children[0])
    if (sorted !== null) {
      refuseMethod(ctx, sorted, callee, "sort")
      return
    }
  }
  if (callee.kind === N_MEMBER) {
    const info = storageNamed(ctx, callee.children[0])
    if (info !== null) {
      refuseMethod(ctx, info, callee, callee.text)
      for (const arg of args.children) {
        checkStorageUses(ctx, arg)
      }
      return
    }
    // `out.push(sim[i])` onto an array of inline records copies the element.
    pushesCopy = callee.text === "push" && storesInlineElements(ctx.program, ctx.table, callee.children[0])
  }
  checkStorageUses(ctx, callee)
  for (let i = 0; i < args.children.length; i++) {
    const arg = args.children[i]
    if (lendsStorage(ctx, call, i, arg)) {
      continue
    }
    const info = storageElementOf(ctx, arg)
    if (info !== null && storageHoldsRecords(ctx, info)) {
      checkStorageUses(ctx, unwrapParens(arg).children[1])
      if (!pushesCopy) {
        ctx.error(
          arg,
          `An element of module storage \`${info.name}\` cannot be passed as an argument: it is a place, not a value; pass the index, or the fields the callee needs`
        )
      }
      continue
    }
    checkStorageUses(ctx, arg)
  }
}

/**
 * Whether argument `i`, `arg`, lends scalar module storage to a parameter
 * that cannot move it: one declared with a typed-array name (`Int32Array`,
 * `Float32Array`, ...) that the callee only reads and writes in place
 * (`lentParamStays`), or a host function's buffer window, which the page
 * reads in place. Either reaches the static elements through the storage's
 * own header, so the storage still never moves; a record element stays a
 * place and is never lent. A typed-array parameter the callee lets go is
 * refused here, at the argument, and answers true so the use is reported once.
 */
const lendsStorage = (ctx: CheckContext, call: Node, i: i32, arg: Node): boolean => {
  const callee = call.children[0]
  const info = storageNamed(ctx, unwrapParens(arg))
  if (info === null || storageHoldsRecords(ctx, info) || callee.kind !== N_IDENT) {
    return false
  }
  // The function the checker bound this call to, never a lookup by name: a
  // parameter, local or function value spelled like a declared function shadows
  // it, and a call through a value is no lend (`nodeCallees` holds no sig).
  const sig = ctx.program.nodeCallees[call.id]
  if (sig === null || i >= sig.paramNames.length) {
    return false
  }
  const origin = sig.origin
  if (origin !== null && origin.host) {
    return isHostWindow(ctx.table, sig.paramTypes[i])
  }
  if (!lendableParameter(ctx, sig, i)) {
    return false
  }
  const name = sig.paramNames[i]
  if (!lentParamStays(ctx, sig, name)) {
    ctx.error(
      arg,
      `Module storage \`${info.name}\` cannot be lent to \`${callee.text}\`, which lets its parameter \`${name}\` go further than indexing: storage keeps its length, so a callee it is lent to only indexes the parameter, reads its \`length\`, loops over it, calls a method that reads it, or lends it on the same way — never passes it elsewhere, binds, returns or stores it, where it could be spelled \`T[]\` and resized`
    )
  }
  return true
}

/**
 * Whether parameter `at` of `sig` can take lent storage at all: one spelled
 * with a typed-array name, or a byte array (`u8[]`, `readonly u8[]`), which
 * has no such name (`Uint8Array` is not spelled) and which `nish/host/text`
 * writes through. Neither may be resized, rebound or let go:
 * `lentParamStays` judges the body, and refuses `length =` for the byte array
 * no spelling stops.
 */
const lendableParameter = (ctx: CheckContext, sig: FunctionSig, at: i32): boolean => {
  const type = sig.paramTypes[at]
  if (ctx.table.isArray(type) && ctx.table.refOf(type) === T_U8) {
    return true
  }
  return parameterSpelling(ctx, sig, sig.paramNames[at]) !== ""
}

/** How many parameters `lentParamStays` follows a lent array through before it gives up. */
const LEND_DEPTH: i32 = 8

/**
 * The parameters a lent array reaches, in the order `lentParamStays` judges
 * them: a lend on to a function of the same module appends its parameter
 * rather than recursing into it, so the walk is one loop with no cycle through
 * the call graph, and a parameter already listed is not listed again.
 */
class LendQueue {
  sigs: FunctionSig[]
  names: string[]

  constructor() {
    this.sigs = []
    this.names = []
  }

  /** Appends `name` of `sig` unless it is listed already. */
  add(sig: FunctionSig, name: string): void {
    let k = 0
    while (k < this.sigs.length && k < this.names.length) {
      if (this.sigs[k] === sig && this.names[k] === name) {
        return
      }
      k = k + 1
    }
    this.sigs.push(sig)
    this.names.push(name)
  }
}

/**
 * Whether `method` of a typed array answers something other than the array
 * itself, so calling it on a lent parameter lets nothing escape.
 */
const lendSafeMethod = (method: string): boolean =>
  method === "at" ||
  method === "every" ||
  method === "filter" ||
  method === "find" ||
  method === "findIndex" ||
  method === "forEach" ||
  method === "includes" ||
  method === "indexOf" ||
  method === "join" ||
  method === "lastIndexOf" ||
  method === "map" ||
  method === "reduce" ||
  method === "slice" ||
  method === "some"

/** Whether `method` works in place and answers the array itself, safe only where that answer is dropped. */
const lendInPlaceMethod = (method: string): boolean =>
  method === "copyWithin" || method === "fill" || method === "reverse" || method === "sort"

/**
 * Whether `sig`'s body uses its parameter `name` only in place, and so does
 * every parameter of the same module it lends the array on to: a typed-array
 * spelling forbids `push`, `pop` and `length =` on that binding, but the value
 * can still flow to a `T[]` binding (an argument, a `const`, a return), whose
 * spelling allows them and would resize module storage through its static
 * header (WP50 §5.1). A name the body shadows is judged by every use of it,
 * which refuses more than it must and never less.
 */
const lentParamStays = (ctx: CheckContext, sig: FunctionSig, name: string): boolean => {
  const queue = new LendQueue()
  queue.add(sig, name)
  let k = 0
  while (k < queue.sigs.length && k < queue.names.length) {
    const next = queue.sigs[k]
    if (k >= LEND_DEPTH || next.decl.kind !== N_FUNCTION || next.decl.children.length < 4) {
      return false
    }
    if (!lentUsesStay(ctx, next, queue.names[k], next.decl.children[3], null, null, null, queue)) {
      return false
    }
    k = k + 1
  }
  return true
}

/**
 * `lentParamStays` over `node`, whose three nearest ancestors are `parent`,
 * `grand` and `great` (null past the body): a use is judged by those alone.
 */
const lentUsesStay = (
  ctx: CheckContext,
  sig: FunctionSig,
  name: string,
  node: Node,
  parent: Node | null,
  grand: Node | null,
  great: Node | null,
  queue: LendQueue
): boolean => {
  if (node.kind === N_IDENT && node.text === name) {
    return lentUseStays(ctx, sig, node, parent, grand, great, queue)
  }
  for (const child of node.children) {
    if (!lentUsesStay(ctx, sig, name, child, node, parent, grand, queue)) {
      return false
    }
  }
  return true
}

/** Whether one reference to a lent parameter, under `parent`, `grand` and `great`, keeps it in place. */
const lentUseStays = (
  ctx: CheckContext,
  sig: FunctionSig,
  use: Node,
  parent: Node | null,
  grand: Node | null,
  great: Node | null,
  queue: LendQueue
): boolean => {
  if (parent === null) {
    return false
  }
  if (parent.kind === N_INDEX) {
    return parent.children[0] === use
  }
  if (parent.kind === N_FOR_OF) {
    return parent.children[1] === use
  }
  if (parent.kind === N_MEMBER) {
    if (parent.children[0] !== use) {
      return false
    }
    if (parent.text === "length") {
      // Read, never written: `xs.length = n` and `xs.length++` resize an
      // array parameter that no typed-array name stops.
      return !lengthWritten(parent, grand)
    }
    if (lendSafeMethod(parent.text)) {
      return true
    }
    // `xs.fill(0);` as a statement: its answer, the array itself, is dropped.
    return (
      lendInPlaceMethod(parent.text) &&
      grand !== null &&
      grand.kind === N_CALL &&
      grand.children[0] === parent &&
      great !== null &&
      great.kind === N_EXPR_STMT
    )
  }
  if (parent.kind === N_LIST && grand !== null && grand.kind === N_CALL && grand.children[1] === parent) {
    // `String.fromBytes(xs, start, end)` copies the bytes into a new string.
    return copiesBytes(grand, parent, use) || lentOnStays(ctx, sig, grand, use, queue)
  }
  return false
}

/** Whether `member`, a `.length` under `grand`, is the target of an assignment or `++`/`--`. */
const lengthWritten = (member: Node, grand: Node | null): boolean => {
  if (grand === null) {
    return false
  }
  if (grand.kind === N_BINARY) {
    return isAssignmentOperator(grand.text) && grand.children[0] === member
  }
  return grand.kind === N_UNARY && (grand.text === "++" || grand.text === "--")
}

/** Whether `use` is the bytes argument, in `args`, of `call`, a `String.fromBytes`. */
const copiesBytes = (call: Node, args: Node, use: Node): boolean => {
  return dottedName(call.children[0]) === "String.fromBytes" && args.children.length > 0 && args.children[0] === use
}

/**
 * Whether `decl`, a function, mentions `name` anywhere but as the callee of a
 * direct call or as its own name: a parameter, a local, a binding pattern or a
 * value use of it. Such a name may stand for something other than the module's
 * function of that name, so a call through it is never judged a lend; this
 * refuses more than it must and never less.
 */
const lendCalleeShadowed = (decl: Node, name: string): boolean => {
  for (let k = 1; k < decl.children.length; k++) {
    if (lendNameMentioned(decl.children[k], name, null)) {
      return true
    }
  }
  return false
}

/** `lendCalleeShadowed` below `decl`'s name: `node`, whose parent is `parent`. */
const lendNameMentioned = (node: Node, name: string, parent: Node | null): boolean => {
  if (node.kind === N_IDENT && node.text === name) {
    return parent === null || parent.kind !== N_CALL || parent.children[0] !== node
  }
  if (node.text === name && node.kind !== N_CALL && node.kind !== N_MEMBER) {
    return true
  }
  for (const child of node.children) {
    if (lendNameMentioned(child, name, node)) {
      return true
    }
  }
  return false
}

/** The context of the module that defines `sig`, or `null`. */
const homeContext = (ctx: CheckContext, sig: FunctionSig): CheckContext | null => {
  if (sig.definedIn(ctx.source)) {
    return ctx
  }
  for (const peer of ctx.peers) {
    if (sig.definedIn(peer.source)) {
      return peer
    }
  }
  return null
}

/**
 * Whether a lent parameter passed on as an argument of `call` may stay in
 * place: to a host function's buffer window, or to a typed-array parameter of
 * another function, which joins `queue` to be judged in turn. `call` sits in
 * `sig`'s body, so its callee is resolved in the scope of `sig`'s module,
 * which a std function lending on (`ringSize` to `ringCapacity`) needs.
 */
const lentOnStays = (
  ctx: CheckContext,
  sig: FunctionSig,
  call: Node,
  use: Node,
  queue: LendQueue
): boolean => {
  const callee = call.children[0]
  const home = homeContext(ctx, sig)
  if (callee.kind !== N_IDENT || home === null || lendCalleeShadowed(sig.decl, callee.text)) {
    return false
  }
  // Resolved by name in `sig`'s module, whose body may not be checked yet; a
  // name `sig` binds itself (a parameter, a local, a function value) was
  // refused just above, so the name can only reach a declared function.
  const next = home.signature(callee.text)
  if (next === null) {
    return false
  }
  const at = call.children[1].children.indexOf(use)
  if (at < 0 || at >= next.paramNames.length) {
    return false
  }
  const origin = next.origin
  if (origin !== null && origin.host) {
    return isHostWindow(ctx.table, next.paramTypes[at])
  }
  if (!lendableParameter(ctx, next, at)) {
    return false
  }
  queue.add(next, next.paramNames[at])
  return true
}

const checkStorageAssignment = (ctx: CheckContext, node: Node): void => {
  const lhs = unwrapParens(node.children[0])
  const rhs = node.children[1]
  if (lhs.kind === N_MEMBER && lhs.text === "length") {
    const info = storageNamed(ctx, lhs.children[0])
    if (info !== null) {
      // `refuseStorageLength` reported it while the assignment was checked.
      checkStorageUses(ctx, rhs)
      return
    }
  }
  const target = storageElementOf(ctx, lhs)
  const inlineTarget = lhs.kind === N_INDEX && storesInlineElements(ctx.program, ctx.table, lhs.children[0])
  if (target !== null) {
    // `sim[i] = v`, `sim[i] = sim[j]` or `sim[i] += 1`: the target is a place.
    checkStorageUses(ctx, lhs.children[1])
  } else {
    checkStorageUses(ctx, lhs)
  }
  const source = storageElementOf(ctx, rhs)
  if (
    source !== null &&
    storageHoldsRecords(ctx, source) &&
    node.text === "=" &&
    (target !== null || inlineTarget)
  ) {
    // A whole-element copy into storage or into another array of inline records.
    checkStorageUses(ctx, unwrapParens(rhs).children[1])
    return
  }
  checkStorageUses(ctx, rhs)
}
