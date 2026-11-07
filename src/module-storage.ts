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
import { isAssignmentOperator, storesInlineElements, unwrapParens } from "./emit-util"
import {
  N_BINARY,
  N_CALL,
  N_FOR_OF,
  N_IDENT,
  N_INDEX,
  N_MEMBER,
  N_NEW,
  N_NUMBER,
  N_PAREN,
  N_UNARY,
  Node,
} from "./nodes"
import { ConstInfo, StructInfo, elementStride, inlineElementStruct } from "./program"
import { SORT_LOCAL } from "./std-modules"
import { T_BOOL, isHostWindow, isNumeric } from "./types"

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
  if (!checkStorageElement(ctx, info, elemNode, elem, spelled, 0)) {
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

/** Whether `elem` is a type whose zero fill is one of its values and holds no pointer. */
const checkStorageElement = (
  ctx: CheckContext,
  info: ConstInfo,
  at: Node,
  elem: i32,
  spelled: string,
  depth: i32
): boolean => {
  const table = ctx.table
  if (elem < 0) {
    return false
  }
  if (isNumeric(elem) || elem === T_BOOL || table.isHostHandle(elem)) {
    return true
  }
  if (table.isEnum(elem) || table.isEnumMemberType(elem) || table.isRanged(elem)) {
    if (storageZeroIsMember(ctx, info, elem)) {
      return true
    }
    storageReport(
      ctx,
      info,
      at,
      `Module storage \`${info.name}\` is zero-filled, and 0 is not a value of ${spelled}; give the type a zero member, or store the number and convert it where it is read`
    )
    return false
  }
  const scope = info.scope
  let record: StructInfo | null = null
  if (scope !== null && depth === 0) {
    record = inlineElementStruct(scope, table, elem)
  }
  if (record !== null) {
    for (const field of record.fields) {
      const fieldName = table.typeName(field.type)
      if (
        !checkStorageElement(ctx, info, at, field.type, `${spelled}.${field.name} (${fieldName})`, depth + 1)
      ) {
        return false
      }
    }
    return true
  }
  storageReport(
    ctx,
    info,
    at,
    `Module storage \`${info.name}\` cannot hold ${spelled}: its bytes are zero-filled where a page can read them, so an element is a number, a \`boolean\`, an enum or range whose zero is a member, a \`HostHandle\`, or an interface no class implements whose fields are all of these — never a string, an array, a class, a \`Map\` or a \`| null\``
  )
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
          `Module storage \`${info.name}\` is a place, not a value: index it (\`${info.name}[i]\`) or read \`${info.name}.length\`, lend it only to a parameter declared \`Int32Array\`, \`Float32Array\`, \`Float64Array\` or \`BigInt64Array\` or to a host function's buffer window, and never alias, return or store the array itself`
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
    if (lendsStorage(ctx, callee, i, arg)) {
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
 * `Float32Array`, ...), which has no `push`, `pop` or `length =`, or a host
 * function's buffer window, which the page reads in place. Either reaches
 * the static elements through the storage's own header, so the storage still
 * never moves; a record element stays a place and is never lent.
 */
const lendsStorage = (ctx: CheckContext, callee: Node, i: i32, arg: Node): boolean => {
  const info = storageNamed(ctx, unwrapParens(arg))
  if (info === null || storageHoldsRecords(ctx, info) || callee.kind !== N_IDENT) {
    return false
  }
  const sig = ctx.signature(callee.text)
  if (sig === null || i >= sig.paramNames.length) {
    return false
  }
  const origin = sig.origin
  if (origin !== null && origin.host) {
    return isHostWindow(ctx.table, sig.paramTypes[i])
  }
  return parameterSpelling(ctx, sig, sig.paramNames[i]) !== ""
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
