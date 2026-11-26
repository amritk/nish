// The fault contract (#2296): a guard whose whole body is
// `const fault: string = F(p)` and then `if (fault.length > 0) { panic(fault) }`,
// with `F` a function that reads only its parameter, panics exactly when `F`
// finds a fault in what it was called with. A caller that has just run the
// same `F` on the same unchanged value and left on a fault has made the
// guard's check. The guard is followed by no call (`FunctionFacts.callerProven`).
// Each call into it, and each call into a constructor or method whose first
// statement hands it a parameter of its own, holds the check as a `fault`
// site (`PANIC_FAULT` in `src/panics.ts`), proven by `faultProven` below.
// Every shape is read exactly, and anything else is no contract: the guard's
// check is then followed as any call's is.

import { declaresName, shadowsGuardName } from "./checker"
import { isAssignmentOperator } from "./emit-util"
import { FLAG_CONST, Node, NodeKind } from "./nodes"
import { CheckedProgram, FunctionSig, ROLE_CONSTRUCTOR, ROLE_FUNCTION, ROLE_METHOD } from "./program"
import { T_I32, T_STRING, T_VOID } from "./types"

/** Whether `node` is the identifier `name`. */
const faultIsName = (node: Node, name: string): boolean => node.kind === NodeKind.Ident && node.text === name

/** Whether `node` is a literal: a number, string, boolean or `null`, or a negated number. */
const faultIsLiteral = (node: Node): boolean =>
  node.kind === NodeKind.Number ||
  node.kind === NodeKind.String ||
  node.kind === NodeKind.True ||
  node.kind === NodeKind.False ||
  node.kind === NodeKind.Null ||
  (node.kind === NodeKind.Unary && node.text === "-" && node.children[0].kind === NodeKind.Number)

/** The position of `name` among the arguments a call to `sig` is written with (`this` left out), or -1. */
const argumentAt = (sig: FunctionSig, name: string): i32 => {
  const skip = sig.paramNames.length > 0 && sig.paramNames[0] === "this" ? 1 : 0
  let k = skip
  while (k < sig.paramNames.length) {
    if (sig.paramNames[k] === name) {
      return k - skip
    }
    k = k + 1
  }
  return -1
}

/** Whether every default of `sig` is a literal and it has no rest parameter: a call evaluates nothing it was not written with. */
const defaultsAreLiterals = (sig: FunctionSig): boolean => {
  for (const value of sig.defaults) {
    if (value !== null) {
      const init = value.initializer
      if (init === null || !faultIsLiteral(init)) {
        return false
      }
    }
  }
  return sig.restIndex < 0
}

/** The one free function `program` declares as `name`, or null. */
const faultFunctionNamed = (program: CheckedProgram, name: string): FunctionSig | null => {
  let found: FunctionSig | null = null
  for (const sig of program.functions) {
    if (sig.sourceName === name) {
      if (found !== null) {
        return null
      }
      found = sig
    }
  }
  return found !== null && found.role === ROLE_FUNCTION ? found : null
}

/** Whether `name` is a module `const` of `program` whose value is a literal: a read of it is always the same. */
const isLiteralConst = (program: CheckedProgram, name: string): boolean => {
  for (const decl of program.file.children) {
    if (decl.kind !== NodeKind.ModuleConst || (decl.flags & FLAG_CONST) === 0) {
      continue
    }
    for (const binding of decl.children[0].children) {
      if (faultIsName(binding.children[0], name)) {
        return faultIsLiteral(binding.children[2])
      }
    }
  }
  return false
}

/** The conversions a fault function may call: they read their argument and nothing else. */
const faultIsConversion = (program: CheckedProgram, name: string): boolean =>
  (name === "toI32" || name === "toI64") && !declaresName(program.file, name)

/** Whether `node` is a type, which a walk for reads skips. */
const isType = (node: Node): boolean =>
  node.kind === NodeKind.TypeRef ||
  node.kind === NodeKind.TypeArray ||
  node.kind === NodeKind.TypeUnion ||
  node.kind === NodeKind.TypeNull ||
  node.kind === NodeKind.TypeParen ||
  node.kind === NodeKind.TypeReadonly ||
  node.kind === NodeKind.TypeFunction ||
  node.kind === NodeKind.TypeLiteral

/** The names `node` declares as locals: each `const`/`let` binding inside it. */
const collectLocals = (node: Node, into: string[]): void => {
  if (node.kind === NodeKind.VarDecl && node.children[0].kind === NodeKind.Ident) {
    into.push(node.children[0].text)
  }
  for (const child of node.children) {
    collectLocals(child, into)
  }
}

/** Whether `name` is in `names`. */
const has = (names: string[], name: string): boolean => {
  for (const seen of names) {
    if (seen === name) {
      return true
    }
  }
  return false
}

/**
 * Whether `node`, inside a fault function whose parameters and locals are
 * `locals`, only reads: every name it uses is one of `locals` or a literal
 * module constant; it assigns only to `locals`; it makes no object, takes no
 * `this`, and calls only conversions and other fault-pure functions, by name.
 */
const faultReadsOnly = (
  program: CheckedProgram,
  node: Node,
  locals: string[],
  open: FunctionSig[]
): boolean => {
  if (isType(node)) {
    return true
  }
  switch (node.kind) {
    case NodeKind.Ident:
      return has(locals, node.text) || isLiteralConst(program, node.text)
    case NodeKind.This:
    case NodeKind.Super:
    case NodeKind.New:
    case NodeKind.Arrow:
    case NodeKind.Object:
      return false
    case NodeKind.Member:
      return faultReadsOnly(program, node.children[0], locals, open)
    case NodeKind.VarDecl:
      return faultReadsOnly(program, node.children[2], locals, open)
    case NodeKind.Unary:
      if (node.text === "await" || node.text === "yield" || node.text === "delete") {
        return false
      }
      if ((node.text === "++" || node.text === "--") && !faultIsLocal(node.children[0], locals)) {
        return false
      }
      return faultReadsOnly(program, node.children[0], locals, open)
    case NodeKind.Binary:
      if (isAssignmentOperator(node.text) && !faultIsLocal(node.children[0], locals)) {
        return false
      }
      return (
        faultReadsOnly(program, node.children[0], locals, open) &&
        faultReadsOnly(program, node.children[1], locals, open)
      )
    case NodeKind.Call: {
      const callee = node.children[0]
      if (callee.kind !== NodeKind.Ident || has(locals, callee.text)) {
        return false
      }
      if (!faultIsConversion(program, callee.text)) {
        const sig = faultFunctionNamed(program, callee.text)
        if (sig === null || !isFaultPure(program, sig, open)) {
          return false
        }
      }
      return faultReadsOnly(program, node.children[1], locals, open)
    }
    default:
      for (const child of node.children) {
        if (!faultReadsOnly(program, child, locals, open)) {
          return false
        }
      }
      return true
  }
}

/** Whether `node` is one of `locals`, by name. */
const faultIsLocal = (node: Node, locals: string[]): boolean =>
  node.kind === NodeKind.Ident && has(locals, node.text)

/**
 * Whether `sig` reads only its parameters: a free, non-generic function of
 * `program` whose body `faultReadsOnly` accepts. Called with the same values, it
 * answers the same. `open` holds the functions being asked about, so a cycle
 * answers no.
 */
const isFaultPure = (program: CheckedProgram, sig: FunctionSig, open: FunctionSig[]): boolean => {
  if (
    sig.role !== ROLE_FUNCTION ||
    sig.instance !== null ||
    !sig.definedIn(program.source) ||
    sig.decl.kind !== NodeKind.FunctionDecl ||
    sig.decl.children[4].children.length > 0 ||
    !defaultsAreLiterals(sig)
  ) {
    return false
  }
  for (const seen of open) {
    if (seen === sig) {
      return false
    }
  }
  const body = sig.body()
  if (body === null) {
    return false
  }
  const locals: string[] = []
  for (const name of sig.paramNames) {
    locals.push(name)
  }
  collectLocals(body, locals)
  open.push(sig)
  const pure = faultReadsOnly(program, body, locals, open)
  open.pop()
  return pure
}

/** `{ panic(message) }`, the builtin. */
const isPanicOf = (program: CheckedProgram, node: Node, fault: string): boolean => {
  if (node.kind !== NodeKind.Block || node.children.length !== 1 || shadowsGuardName(program, "panic")) {
    return false
  }
  const stmt = node.children[0]
  return (
    stmt.kind === NodeKind.ExprStmt &&
    stmt.children[0].kind === NodeKind.Call &&
    faultIsName(stmt.children[0].children[0], "panic") &&
    stmt.children[0].children[1].children.length === 1 &&
    faultIsName(stmt.children[0].children[1].children[0], fault)
  )
}

/** `const name: string = F(arg)` or `const name = F(arg)`: the `[name, F, arg]` nodes, or null. */
const faultBinding = (stmt: Node): Node[] | null => {
  if (
    stmt.kind !== NodeKind.Var ||
    (stmt.flags & FLAG_CONST) === 0 ||
    stmt.children[0].children.length !== 1
  ) {
    return null
  }
  const decl = stmt.children[0].children[0]
  const type = decl.children[1]
  const init = decl.children[2]
  if (
    decl.children[0].kind !== NodeKind.Ident ||
    (type.kind !== NodeKind.Empty && (type.kind !== NodeKind.TypeRef || type.text !== "string")) ||
    init.kind !== NodeKind.Call ||
    init.children[0].kind !== NodeKind.Ident ||
    init.children[1].children.length !== 1 ||
    init.children[1].children[0].kind !== NodeKind.Ident
  ) {
    return null
  }
  return [decl.children[0], init, init.children[1].children[0]]
}

/** `name.length > 0`. */
const isFaultTest = (node: Node, name: string): boolean =>
  node.kind === NodeKind.Binary &&
  node.text === ">" &&
  node.children[0].kind === NodeKind.Member &&
  node.children[0].text === "length" &&
  faultIsName(node.children[0].children[0], name) &&
  node.children[1].kind === NodeKind.Number &&
  node.children[1].text === "0"

/**
 * A fault guard: a free, non-generic function of one parameter `p` that
 * returns nothing and whose body is exactly `const fault: string = F(p)` and
 * then `if (fault.length > 0) { panic(fault) }`, with `F` a function of
 * `program` that returns a string and reads only its parameter. Records `F`
 * and the parameter on the signature; the branch is its `faultCheck`.
 */
const noteFaultGuard = (program: CheckedProgram, sig: FunctionSig): void => {
  if (
    sig.role !== ROLE_FUNCTION ||
    sig.instance !== null ||
    sig.returnType !== T_VOID ||
    sig.paramNames.length !== 1 ||
    !sig.definedIn(program.source) ||
    sig.decl.kind !== NodeKind.FunctionDecl ||
    sig.decl.children[4].children.length > 0 ||
    !defaultsAreLiterals(sig) ||
    (sig.defaults.length > 0 && sig.defaults[0] !== null)
  ) {
    return
  }
  const body = sig.body()
  if (body === null || body.kind !== NodeKind.Block || body.children.length !== 2) {
    return
  }
  const binding = faultBinding(body.children[0])
  const test = body.children[1]
  if (
    binding === null ||
    binding[1].children[0].kind !== NodeKind.Ident ||
    !faultIsName(binding[2], sig.paramNames[0]) ||
    binding[0].text === sig.paramNames[0] ||
    test.kind !== NodeKind.If ||
    test.children[2].kind !== NodeKind.Empty ||
    !isFaultTest(test.children[0], binding[0].text) ||
    !isPanicOf(program, test.children[1], binding[0].text)
  ) {
    return
  }
  const f = faultFunctionNamed(program, binding[1].children[0].text)
  const open: FunctionSig[] = []
  if (
    f === null ||
    f.returnType !== T_STRING ||
    f.paramNames.length !== 1 ||
    !isFaultPure(program, f, open)
  ) {
    return
  }
  sig.fault = f
  sig.faultAt = 0
  sig.faultCheck = test.children[1]
}

/** Whether `sig` is a fault guard: it checks a fault of its own, and hands it to no guard. */
export const isFaultGuard = (sig: FunctionSig): boolean => sig.fault !== null && sig.faultGuard === null

/** The fault guard `name` calls in `program`: its one free function of that name, when it is one. */
const faultGuardNamed = (program: CheckedProgram, name: string): FunctionSig | null => {
  const found = faultFunctionNamed(program, name)
  return found !== null && isFaultGuard(found) ? found : null
}

/** Whether every field `sig`'s class declares starts at a literal, or at nothing: making one runs no code before the body. */
const fieldsStartAtLiterals = (sig: FunctionSig): boolean => {
  const owner = sig.owner
  if (owner === null) {
    return false
  }
  for (const field of owner.fields) {
    const init = field.initializer
    if (init !== null && !faultIsLiteral(init)) {
      return false
    }
  }
  return true
}

/**
 * A constructor or method whose first statement is `guard(p)` on a parameter
 * `p` of its own that its body never assigns: what it was called with is what
 * the guard checks. A constructor's class must start every field at a literal,
 * so nothing runs before that statement. Records the guard, `F`, the argument
 * `p` is, and the forwarding call.
 */
const noteFaultForward = (program: CheckedProgram, sig: FunctionSig): void => {
  const method =
    sig.role === ROLE_METHOD && sig.decl.kind === NodeKind.Method && sig.decl.children.length <= 4
  const ctor =
    sig.role === ROLE_CONSTRUCTOR && sig.decl.kind === NodeKind.Constructor && fieldsStartAtLiterals(sig)
  if (
    (!method && !ctor) ||
    sig.instance !== null ||
    !sig.definedIn(program.source) ||
    !defaultsAreLiterals(sig)
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
  const args = call.children[1].children
  if (callee.kind !== NodeKind.Ident || argumentAt(sig, callee.text) >= 0 || args.length !== 1) {
    return
  }
  const guard = faultGuardNamed(program, callee.text)
  if (guard === null || args[0].kind !== NodeKind.Ident || argumentAt(sig, args[0].text) < 0) {
    return
  }
  const name = args[0].text
  if (assigns(body, name) || faultRedeclares(body, name)) {
    return
  }
  sig.fault = guard.fault
  sig.faultAt = argumentAt(sig, name)
  sig.faultGuard = guard
  sig.faultForward = call
}

/** Whether `node` assigns to the name `name` anywhere inside it. */
const assigns = (node: Node, name: string): boolean => {
  if (
    (node.kind === NodeKind.Binary &&
      isAssignmentOperator(node.text) &&
      faultIsName(node.children[0], name)) ||
    (node.kind === NodeKind.Unary &&
      (node.text === "++" || node.text === "--") &&
      faultIsName(node.children[0], name))
  ) {
    return true
  }
  for (const child of node.children) {
    if (assigns(child, name)) {
      return true
    }
  }
  return false
}

/** How many bindings named `name` `node` declares inside it. */
const declarations = (node: Node, name: string): i32 => {
  let count = node.kind === NodeKind.VarDecl && faultIsName(node.children[0], name) ? 1 : 0
  if (node.kind === NodeKind.Param && faultIsName(node.children[0], name)) {
    count = count + 1
  }
  for (const child of node.children) {
    count = count + declarations(child, name)
  }
  return count
}

/** Whether `node` declares a binding `name` anywhere inside it, a parameter of a closure included. */
const faultRedeclares = (node: Node, name: string): boolean => declarations(node, name) > 0

/**
 * Find every fault guard and every constructor or method that forwards to
 * one, in every module, once each has its signatures and before any body is
 * checked.
 */
export const noteFaultContracts = (programs: CheckedProgram[]): void => {
  for (const program of programs) {
    for (const sig of program.functions) {
      noteFaultGuard(program, sig)
    }
  }
  for (const program of programs) {
    for (const sig of program.functions) {
      noteFaultForward(program, sig)
    }
    for (const info of program.structList) {
      const ctor = info.ctor
      if (ctor !== null) {
        noteFaultForward(program, ctor)
      }
    }
  }
}

/** The arguments `call` is written with: a `new`'s third child, a call's second. */
const faultArgumentsOf = (call: Node): Node[] =>
  call.kind === NodeKind.New ? call.children[2].children : call.children[1].children

/** The nodes from `node` down to `target`, both included, into `path`; whether `target` is inside `node`. */
const faultPathTo = (node: Node, target: Node, path: Node[]): boolean => {
  path.push(node)
  if (node === target) {
    return true
  }
  for (const child of node.children) {
    if (faultPathTo(child, target, path)) {
      return true
    }
  }
  path.pop()
  return false
}

/** Whether `node` is a loop or a closure: a statement before it in its block need not run before each pass through it. */
const repeats = (node: Node): boolean =>
  node.kind === NodeKind.While ||
  node.kind === NodeKind.Do ||
  node.kind === NodeKind.For ||
  node.kind === NodeKind.ForOf ||
  node.kind === NodeKind.Arrow ||
  node.kind === NodeKind.FunctionDecl

/** Whether `name` is a function a `nish:` module exports to `program`, which writes nothing it is not handed. */
const isNishImport = (program: CheckedProgram, name: string): boolean => {
  for (const decl of program.file.children) {
    if (decl.kind !== NodeKind.Import || !decl.text.startsWith("nish:")) {
      continue
    }
    for (const spec of decl.children[0].children) {
      if (spec.kind === NodeKind.ImportSpec && spec.text === name) {
        return true
      }
    }
  }
  return false
}

/**
 * Whether `node` writes no object and runs no code of the program, except
 * through `allowed` (the call being judged and the calls around it, which run
 * after it): it assigns no field or element, awaits nothing, makes no object,
 * and calls only `nish:` functions with arguments that are names or literals
 * of a primitive type.
 */
const isQuiet = (program: CheckedProgram, node: Node, allowed: Node[]): boolean => {
  for (const seen of allowed) {
    if (seen === node) {
      for (const child of node.children) {
        if (!isQuiet(program, child, allowed)) {
          return false
        }
      }
      return true
    }
  }
  switch (node.kind) {
    case NodeKind.New:
    case NodeKind.Arrow:
      return false
    case NodeKind.Unary:
      if (node.text === "await" || node.text === "yield" || node.text === "delete") {
        return false
      }
      if ((node.text === "++" || node.text === "--") && node.children[0].kind !== NodeKind.Ident) {
        return false
      }
      break
    case NodeKind.Binary:
      if (isAssignmentOperator(node.text) && node.children[0].kind !== NodeKind.Ident) {
        return false
      }
      break
    case NodeKind.Call: {
      const callee = node.children[0]
      if (
        program.nodeCallees[node.id] !== null ||
        callee.kind !== NodeKind.Ident ||
        !isNishImport(program, callee.text)
      ) {
        return false
      }
      for (const arg of node.children[1].children) {
        if (
          (arg.kind !== NodeKind.Ident && !faultIsLiteral(arg)) ||
          !isPrimitiveType(program.nodeTypes[arg.id])
        ) {
          return false
        }
      }
      return true
    }
    default:
      break
  }
  for (const child of node.children) {
    if (!isQuiet(program, child, allowed)) {
      return false
    }
  }
  return true
}

/** Whether `type` is a number, a boolean or a string: a value no call can write through. */
const isPrimitiveType = (type: i32): boolean => type >= T_I32 && type <= T_STRING

/** Whether the branch `node` never falls through: a block that ends in `return`, `throw` or the builtin `panic`, or one of those alone. */
const leaves = (program: CheckedProgram, node: Node): boolean => {
  let last = node
  if (node.kind === NodeKind.Block) {
    if (node.children.length === 0) {
      return false
    }
    last = node.children[node.children.length - 1]
  }
  if (last.kind === NodeKind.Return || last.kind === NodeKind.Throw) {
    return true
  }
  return (
    last.kind === NodeKind.ExprStmt &&
    last.children[0].kind === NodeKind.Call &&
    faultIsName(last.children[0].children[0], "panic") &&
    program.nodeCallees[last.children[0].id] === null &&
    !shadowsGuardName(program, "panic")
  )
}

/**
 * Whether the binding `name`, as `caller` reads it at `call`, holds the value
 * it held when it was checked: a parameter of `caller`, or a `const` local,
 * declared once in the whole function and assigned nowhere in it.
 */
const isSteady = (caller: FunctionSig, body: Node, name: string): boolean => {
  if (assigns(body, name)) {
    return false
  }
  const declared = declarations(body, name)
  if (argumentAt(caller, name) >= 0 || (caller.paramNames.length > 0 && caller.paramNames[0] === name)) {
    return declared === 0
  }
  return declared === 1 && isConstLocal(body, name)
}

/** Whether `body` declares `name` with `const`. */
const isConstLocal = (node: Node, name: string): boolean => {
  if (node.kind === NodeKind.Var && (node.flags & FLAG_CONST) !== 0) {
    for (const decl of node.children[0].children) {
      if (faultIsName(decl.children[0], name)) {
        return true
      }
    }
  }
  for (const child of node.children) {
    if (isConstLocal(child, name)) {
      return true
    }
  }
  return false
}

/**
 * Whether `caller` has made `target`'s fault check before `call`: in a block
 * around the call, with no loop or closure between that block and the call,
 * a statement before the call's is `const g = F(x)` with `target`'s `F`,
 * followed at once by `if (g.length > 0) ...` whose branch never falls
 * through, and `x` is the call's checked argument, a name `isSteady` keeps.
 * Every statement after the check up to the call's writes no object
 * (`isQuiet`) or is an `if` that leaves (`isQuietExit`), the call's own
 * statement up to the call writes none, and the call's
 * other arguments are names or literals, so nothing between the check and
 * the guard can change what `F` reads.
 */
export const faultProven = (
  program: CheckedProgram,
  caller: FunctionSig,
  call: Node,
  target: FunctionSig
): boolean => {
  const fault = target.fault
  const args = faultArgumentsOf(call)
  const body = caller.body()
  if (fault === null || body === null || target.faultAt < 0 || target.faultAt >= args.length) {
    return false
  }
  const checked = args[target.faultAt]
  if (checked.kind !== NodeKind.Ident || !isSteady(caller, body, checked.text)) {
    return false
  }
  for (const arg of args) {
    if (arg.kind !== NodeKind.Ident && !faultIsLiteral(arg)) {
      return false
    }
  }
  const path: Node[] = []
  if (!faultPathTo(body, call, path)) {
    return false
  }
  // From the call outwards: each block around it, and the statement in it that holds the call.
  let k = path.length - 2
  while (k >= 0 && k + 1 < path.length) {
    const block = path[k]
    if (repeats(block)) {
      return false
    }
    if (block.kind === NodeKind.Block) {
      const holder = path[k + 1]
      const allowed: Node[] = []
      let j = k + 1
      while (j < path.length) {
        allowed.push(path[j])
        j = j + 1
      }
      let at = 0
      while (at < block.children.length && block.children[at] !== holder) {
        at = at + 1
      }
      if (isQuiet(program, holder, allowed) && checkedBefore(program, block, at, fault, checked.text)) {
        return true
      }
    }
    k = k - 1
  }
  return false
}

/**
 * Whether a statement of `block` before position `at` is `const g = F(name)`
 * with `F` the function `fault`, followed at once by a leaving
 * `if (g.length > 0)`, with only quiet statements or quiet exits from there
 * to `at`.
 */
const checkedBefore = (
  program: CheckedProgram,
  block: Node,
  at: i32,
  fault: FunctionSig,
  name: string
): boolean => {
  const none: Node[] = []
  let k = at - 1
  while (k >= 1) {
    const test = block.children[k]
    const binding = faultBinding(block.children[k - 1])
    const called: FunctionSig | null = binding !== null ? program.nodeCallees[binding[1].id] : null
    if (
      binding !== null &&
      called !== null &&
      called === fault &&
      faultIsName(binding[2], name) &&
      test.kind === NodeKind.If &&
      test.children[2].kind === NodeKind.Empty &&
      isFaultTest(test.children[0], binding[0].text) &&
      leaves(program, test.children[1])
    ) {
      return true
    }
    if (!isQuiet(program, block.children[k], none) && !isQuietExit(program, block.children[k])) {
      return false
    }
    k = k - 1
  }
  return false
}

/**
 * `if (test) { ... }` with no `else`, a quiet test and a branch that never
 * falls through: on the way to the call only the test runs, so what the
 * branch does before it leaves cannot reach the call.
 */
const isQuietExit = (program: CheckedProgram, node: Node): boolean => {
  const none: Node[] = []
  return (
    node.kind === NodeKind.If &&
    node.children[2].kind === NodeKind.Empty &&
    isQuiet(program, node.children[0], none) &&
    leaves(program, node.children[1])
  )
}
