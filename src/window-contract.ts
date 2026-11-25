// The window contract (#2296): a method whose first statement hands its own
// `(buf, off, len)` to a guard that panics exactly when `[off, off + len)` is
// outside `buf` makes the same promise its guard does, so a caller that has
// proved the window has proved the guard's check. The guard is followed by no
// call (`FunctionFacts.callerProven`); each call into it, and each call into a
// method that forwards to it, holds the check as a `window` site of its own
// (`PANIC_WINDOW` in `src/panics.ts`), proven where `src/bounds.ts` proves the
// window at that call, and proven at the forwarding call because the method's
// callers hold it. Both shapes are read exactly, and anything else is no
// contract: the guard's check is then followed as any call's is.

import { shadowsGuardName } from "./checker"
import { FLAG_CONST, Node, NodeKind } from "./nodes"
import { CheckedProgram, FunctionSig, ROLE_FUNCTION, ROLE_METHOD } from "./program"
import { T_I32, T_VOID, TypeTable } from "./types"

/** Whether `node` is the identifier `name`. */
const isName = (node: Node, name: string): boolean => node.kind === NodeKind.Ident && node.text === name

/** Whether `node` is the binary `left op right`, with `left` and `right` the identifiers named. */
const isCompare = (node: Node, op: string, left: string, right: string): boolean =>
  node.kind === NodeKind.Binary &&
  node.text === op &&
  isName(node.children[0], left) &&
  isName(node.children[1], right)

/**
 * `off < 0 || len < 0 || off > size || len > size - off`, as the parser
 * nests it, in this order: each test runs only when the ones before it were
 * false, so `size - off` is a difference of two values in `[0, size]`.
 */
const isWindowTest = (node: Node, off: string, len: string, size: string): boolean => {
  if (node.kind !== NodeKind.Binary || node.text !== "||") {
    return false
  }
  const last = node.children[1]
  if (
    last.kind !== NodeKind.Binary ||
    last.text !== ">" ||
    !isName(last.children[0], len) ||
    last.children[1].kind !== NodeKind.Binary ||
    !isCompare(last.children[1], "-", size, off)
  ) {
    return false
  }
  const third = node.children[0]
  if (
    third.kind !== NodeKind.Binary ||
    third.text !== "||" ||
    !isCompare(third.children[1], ">", off, size)
  ) {
    return false
  }
  const pair = third.children[0]
  return (
    pair.kind === NodeKind.Binary &&
    pair.text === "||" &&
    isBelowZero(pair.children[0], off) &&
    isBelowZero(pair.children[1], len)
  )
}

/** `name < 0`. */
const isBelowZero = (node: Node, name: string): boolean =>
  node.kind === NodeKind.Binary &&
  node.text === "<" &&
  isName(node.children[0], name) &&
  node.children[1].kind === NodeKind.Number &&
  node.children[1].text === "0"

/** `toI32(buf.length)`, where the module does not declare its own `toI32`. */
const isLengthOf = (program: CheckedProgram, node: Node, buf: string): boolean => {
  if (node.kind !== NodeKind.Call || !isName(node.children[0], "toI32") || shadowsGuardName(program, "toI32")) {
    return false
  }
  const args = node.children[1].children
  return (
    args.length === 1 &&
    args[0].kind === NodeKind.Member &&
    args[0].text === "length" &&
    isName(args[0].children[0], buf)
  )
}

/** `{ panic(message) }`, the builtin: the branch never falls through to the return. */
const isPanicBlock = (program: CheckedProgram, node: Node): boolean => {
  if (node.kind !== NodeKind.Block || node.children.length !== 1 || shadowsGuardName(program, "panic")) {
    return false
  }
  const stmt = node.children[0]
  return (
    stmt.kind === NodeKind.ExprStmt &&
    stmt.children[0].kind === NodeKind.Call &&
    isName(stmt.children[0].children[0], "panic") &&
    stmt.children[0].children[1].children.length === 1
  )
}

/** Whether `name` is one of `sig`'s parameters. */
const isParam = (sig: FunctionSig, name: string): boolean => {
  for (const param of sig.paramNames) {
    if (param === name) {
      return true
    }
  }
  return false
}

/** The position of the parameter `name` of `sig` with type `type` (any array when `type` is -1), or -1. */
const paramAt = (table: TypeTable, sig: FunctionSig, name: string, type: i32): i32 => {
  let k = 0
  while (k < sig.paramNames.length && k < sig.paramTypes.length) {
    if (sig.paramNames[k] === name) {
      const fits = type < 0 ? table.isArray(sig.paramTypes[k]) : sig.paramTypes[k] === type
      return fits ? k : -1
    }
    k = k + 1
  }
  return -1
}

/** Whether `sig` takes its arguments as written: no default, no rest parameter. */
const takesArgumentsAsWritten = (sig: FunctionSig): boolean => {
  for (const value of sig.defaults) {
    if (value !== null) {
      return false
    }
  }
  return sig.restIndex < 0
}

/**
 * A window guard: a free, non-generic function that returns nothing and whose
 * body is exactly `const size: i32 = toI32(buf.length)` and then
 * `if (off < 0 || len < 0 || off > size || len > size - off) { panic(m) }` on
 * an array parameter `buf` and `i32` parameters `off` and `len`. It returns
 * exactly when the window is inside the buffer. Records `window` on the signature; the branch is its `windowCheck`.
 */
const noteGuard = (program: CheckedProgram, table: TypeTable, sig: FunctionSig): void => {
  if (
    sig.role !== ROLE_FUNCTION ||
    sig.instance !== null ||
    sig.returnType !== T_VOID ||
    !sig.definedIn(program.source) ||
    sig.decl.kind !== NodeKind.FunctionDecl ||
    sig.decl.children[4].children.length > 0 ||
    !takesArgumentsAsWritten(sig)
  ) {
    return
  }
  const body = sig.body()
  if (body === null || body.kind !== NodeKind.Block) {
    return
  }
  // `const size: i32 = toI32(buf.length)`, then the test and nothing else.
  const statements = body.children
  if (statements.length !== 2) {
    return
  }
  const local = statements[0]
  if (local.kind !== NodeKind.Var || (local.flags & FLAG_CONST) === 0 || local.children[0].children.length !== 1) {
    return
  }
  const decl = local.children[0].children[0]
  const type = decl.children[1]
  const init = decl.children[2]
  if (
    decl.children[0].kind !== NodeKind.Ident ||
    type.kind !== NodeKind.TypeRef ||
    type.text !== "i32" ||
    init.kind !== NodeKind.Call ||
    init.children[1].children.length !== 1
  ) {
    return
  }
  const size = decl.children[0].text
  const length = init.children[1].children[0]
  if (length.kind !== NodeKind.Member || length.children[0].kind !== NodeKind.Ident) {
    return
  }
  const buf = length.children[0].text
  const test = statements[1]
  if (test.kind !== NodeKind.If || test.children[2].kind !== NodeKind.Empty || !isPanicBlock(program, test.children[1])) {
    return
  }
  const cond = test.children[0]
  if (cond.kind !== NodeKind.Binary || cond.children[1].kind !== NodeKind.Binary) {
    return
  }
  const last = cond.children[1]
  const len = last.children[0]
  const diff = last.children[1]
  if (len.kind !== NodeKind.Ident || diff.kind !== NodeKind.Binary || diff.children[1].kind !== NodeKind.Ident) {
    return
  }
  const off = diff.children[1]
  if (isParam(sig, size) || !isLengthOf(program, init, buf) || !isWindowTest(cond, off.text, len.text, size)) {
    return
  }
  const b = paramAt(table, sig, buf, -1)
  const o = paramAt(table, sig, off.text, T_I32)
  const l = paramAt(table, sig, len.text, T_I32)
  if (b < 0 || o < 0 || l < 0 || b === o || b === l || o === l) {
    return
  }
  sig.window = [b, o, l]
  sig.windowCheck = test.children[1]
}

/** Whether `sig` is a window guard: it checks a window of its own, and hands it to no guard. */
export const isWindowGuard = (sig: FunctionSig): boolean => sig.window.length === 3 && sig.windowGuard === null

/** The guard `name` calls in `program`: its one free function of that name, when it is a window guard. */
const guardNamed = (program: CheckedProgram, name: string): FunctionSig | null => {
  let found: FunctionSig | null = null
  for (const sig of program.functions) {
    if (sig.sourceName === name) {
      if (found !== null) {
        return null
      }
      found = sig
    }
  }
  return found !== null && found.role === ROLE_FUNCTION && isWindowGuard(found) ? found : null
}

/**
 * A method whose first statement is `guard(...)` on its own parameters, the
 * window ones each named once, and nothing but string literals besides: what
 * it was called with is what the guard checks. Records the guard, the call
 * argument each window parameter is (the call's arguments leave `this` out),
 * and the forwarding call.
 */
const noteForward = (program: CheckedProgram, table: TypeTable, sig: FunctionSig): void => {
  if (
    sig.role !== ROLE_METHOD ||
    sig.instance !== null ||
    sig.paramNames.length === 0 ||
    sig.paramNames[0] !== "this" ||
    !sig.definedIn(program.source) ||
    sig.decl.kind !== NodeKind.Method ||
    sig.decl.children.length > 4 ||
    !takesArgumentsAsWritten(sig)
  ) {
    return
  }
  const body = sig.body()
  if (body === null || body.kind !== NodeKind.Block || body.children.length === 0) {
    return
  }
  const first = body.children[0]
  if (first.kind !== NodeKind.ExprStmt || first.children[0].kind !== NodeKind.Call) {
    return
  }
  const call = first.children[0]
  const callee = call.children[0]
  if (callee.kind !== NodeKind.Ident || isParam(sig, callee.text)) {
    return
  }
  const guard = guardNamed(program, callee.text)
  if (guard === null) {
    return
  }
  const args = call.children[1].children
  if (args.length !== guard.paramNames.length) {
    return
  }
  const window: i32[] = []
  for (const k of guard.window) {
    const arg = args[k]
    if (arg.kind !== NodeKind.Ident) {
      return
    }
    // The guard's array type, or `i32` for the offset and the count, so the forward converts nothing.
    const at = paramAt(table, sig, arg.text, window.length === 0 ? -1 : T_I32)
    if (at < 1) {
      return
    }
    for (const seen of window) {
      if (seen === at - 1) {
        return
      }
    }
    window.push(at - 1)
  }
  for (const arg of args) {
    if (arg.kind !== NodeKind.String && arg.kind !== NodeKind.Ident) {
      return
    }
    if (arg.kind === NodeKind.Ident && !isParam(sig, arg.text)) {
      return
    }
  }
  sig.window = window
  sig.windowGuard = guard
  sig.windowForward = call
}

/**
 * Find every window guard and every method that forwards to one, in every
 * module, once each has its signatures and before any body is checked:
 * `src/bounds.ts` reads them as it walks the callers.
 */
export const noteWindowContracts = (programs: CheckedProgram[], table: TypeTable): void => {
  for (const program of programs) {
    for (const sig of program.functions) {
      noteGuard(program, table, sig)
    }
  }
  for (const program of programs) {
    for (const sig of program.functions) {
      noteForward(program, table, sig)
    }
  }
}
