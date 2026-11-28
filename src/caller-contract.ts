// The caller contract (#2296): a function, method or constructor whose first
// statements are `if (test) { panic(m) }`, each test an `||` of comparisons
// that read only its parameters, panics there exactly when its caller passed
// arguments that make a comparison true. A caller that proves every comparison
// false with its own arguments has proved the panic away. Each call into such
// a function holds those tests as a `contract` site of its own
// (`PANIC_CONTRACT` in `src/panics.ts`), proven where `src/bounds.ts` proves
// each comparison false at the call. When every call is proven, the callee
// lists the panics behind them as proven, so a call reaches them through its
// `contract` site and never twice; one call nothing proves leaves them the
// callee's.
//
// The comparisons read, with `p` and `q` `i32` parameters, `b` an array or
// string parameter whose length is `toI32(b.length)`, and `C` an integer
// literal:
//
//   p < 0                              the caller proves p >= 0
//   p > toI32(b.length)                p <= b.length
//   p >= toI32(b.length)               0 <= p < b.length, the index proof
//   p > toI32(b.length) - q            the window [q, q + p) of b, as a buffer call's
//   toI64(q) + toI64(p) > toI64(b.length)  the same window, its sum widened
//   p < q, or q > p                    q <= p, with `p > toI32(b.length)` held too
//   toI64(p) * toI64(q) > toI64(C)     p and q constants whose product is at most C
//
// The caller proves a little more than the comparison in some (the index's
// floor, the window's offset, the range's end, constant factors), which it
// may: the panic is away whenever the stronger fact holds. Between the tests
// the run may name a length or a product once, as `const n: i32 =
// toI32(b.length)` or `const a: i64 = toI64(p) * toI64(q)`, and a test may
// read that name where it would read the expression. The run may end in a
// forward: a call, alone or as a `const`'s initializer, into another caller
// contract of the module with its own parameters where that contract reads
// its parameters, and literals or parameters besides. The forwarding function
// then holds that contract's comparisons too, on its own parameters, and its
// call into the contract is proven exactly when every call into it is. The run
// stops at the first statement that is none of these, and everything after it
// is the function's own, followed as any call's is.

import { shadowsGuardName } from "./checker"
import { StringSet } from "./map"
import { FLAG_ASYNC, FLAG_CONST, FLAG_GENERATOR, Node, NodeKind } from "./nodes"
import { CheckedProgram, FunctionSig, ROLE_CONSTRUCTOR, ROLE_FUNCTION, ROLE_METHOD } from "./program"
import { T_I32, T_STRING, TypeTable } from "./types"

/** `p < 0`. */
export const ATOM_NEGATIVE: i32 = 0
/** `p > toI32(b.length)`. */
export const ATOM_PAST_END: i32 = 1
/** `p >= toI32(b.length)`. */
export const ATOM_AT_END: i32 = 2
/** `p > toI32(b.length) - q`. */
export const ATOM_PAST_REST: i32 = 3
/** `p < q`: `b` is the buffer a held `p > toI32(b.length)` names. */
const ATOM_BEFORE: i32 = 4
/** `toI64(p) * toI64(q) > toI64(C)`: `b` holds `C`, a literal in `[0, 2^31 - 1]`, not a position. */
export const ATOM_PRODUCT_OVER: i32 = 5

/** The number of entries one comparison takes in `FunctionSig.preconditionAtoms`: shape, `p`, `q`, `b`. */
export const ATOM_WIDTH: i32 = 4

/** One comparison, by parameter position (`this` counted for a method); -1 for a part the shape has not. */
class Atom {
  shape: i32
  p: i32
  q: i32
  b: i32

  constructor(shape: i32, p: i32, q: i32, b: i32) {
    this.shape = shape
    this.p = p
    this.q = q
    this.b = b
  }
}

/**
 * The names a contract's run binds between its tests: `const n: i32 =
 * toI32(b.length)`, a length, and `const a: i64 = toI64(p) * toI64(q)`, a
 * product, each by the parameter positions it reads.
 */
class RunNames {
  lengths: string[]
  lengthOf: i32[]
  products: string[]
  productP: i32[]
  productQ: i32[]

  constructor() {
    this.lengths = []
    this.lengthOf = []
    this.products = []
    this.productP = []
    this.productQ = []
  }
}

/** The position of the parameter named `name`, or -1. */
const paramAt = (sig: FunctionSig, name: string): i32 => {
  let k = 0
  while (k < sig.paramNames.length && k < sig.paramTypes.length) {
    if (sig.paramNames[k] === name) {
      return k
    }
    k = k + 1
  }
  return -1
}

/** The position of the `i32` parameter `node` names, or -1. */
const intParam = (sig: FunctionSig, node: Node): i32 => {
  if (node.kind !== NodeKind.Ident || node.text === "this") {
    return -1
  }
  const k = paramAt(sig, node.text)
  return k >= 0 && sig.paramTypes[k] === T_I32 ? k : -1
}

/** Whether `node` calls the builtin conversion `name` with one argument. */
const convertsBy = (program: CheckedProgram, node: Node, name: string): boolean =>
  node.kind === NodeKind.Call &&
  node.children[0].kind === NodeKind.Ident &&
  node.children[0].text === name &&
  !shadowsGuardName(program, name) &&
  node.children[1].children.length === 1

/** The position of the array or string parameter `node` reads the length of, as `b.length`, or -1. */
const memberLength = (table: TypeTable, sig: FunctionSig, node: Node): i32 => {
  if (node.kind !== NodeKind.Member || node.text !== "length") {
    return -1
  }
  const holder = node.children[0]
  if (holder.kind !== NodeKind.Ident || holder.text === "this") {
    return -1
  }
  const k = paramAt(sig, holder.text)
  if (k < 0) {
    return -1
  }
  const type = sig.paramTypes[k]
  return type === T_STRING || table.isArray(type) ? k : -1
}

/** The position of the array or string parameter whose length `node` is, as `toI32(b.length)` or a name the run bound to it, or -1. */
const lengthParam = (
  program: CheckedProgram,
  table: TypeTable,
  sig: FunctionSig,
  names: RunNames,
  node: Node
): i32 => {
  if (node.kind === NodeKind.Ident) {
    let k = 0
    while (k < names.lengths.length) {
      if (names.lengths[k] === node.text) {
        return names.lengthOf[k]
      }
      k = k + 1
    }
    return -1
  }
  return convertsBy(program, node, "toI32") ? memberLength(table, sig, node.children[1].children[0]) : -1
}

/** The position of the `i32` parameter `node` widens, as `toI64(p)`, or -1. */
const widenedParam = (program: CheckedProgram, sig: FunctionSig, node: Node): i32 =>
  convertsBy(program, node, "toI64") ? intParam(sig, node.children[1].children[0]) : -1

/** Whether `node` is the integer literal `0`. */
const isZero = (node: Node): boolean => node.kind === NodeKind.Number && node.text === "0"

/** The value of a decimal literal in `[0, 2^31 - 1]`, as `C` or `toI64(C)`, or -1. */
const productCap = (program: CheckedProgram, node: Node): i32 => {
  const literal = convertsBy(program, node, "toI64") ? node.children[1].children[0] : node
  if (literal.kind !== NodeKind.Number || literal.text.length === 0 || literal.text.length > 10) {
    return -1
  }
  let value: i64 = toI64(0)
  let k = 0
  while (k < literal.text.length) {
    const digit = literal.text.charCodeAt(k) - 48
    if (digit < 0 || digit > 9) {
      return -1
    }
    value = value * toI64(10) + toI64(digit)
    k = k + 1
  }
  return value > toI64(2147483647) ? -1 : toI32(value)
}

/** The factors of `toI64(p) * toI64(q)` or of a name the run bound to one, onto `out` as `[p, q]`; false for anything else. */
const productOf = (
  program: CheckedProgram,
  sig: FunctionSig,
  names: RunNames,
  node: Node,
  out: i32[]
): boolean => {
  if (node.kind === NodeKind.Ident) {
    let k = 0
    while (k < names.products.length) {
      if (names.products[k] === node.text) {
        out.push(names.productP[k])
        out.push(names.productQ[k])
        return true
      }
      k = k + 1
    }
    return false
  }
  if (node.kind !== NodeKind.Binary || node.text !== "*") {
    return false
  }
  const p = widenedParam(program, sig, node.children[0])
  const q = widenedParam(program, sig, node.children[1])
  if (p < 0 || q < 0) {
    return false
  }
  out.push(p)
  out.push(q)
  return true
}

/** `toI64(q) + toI64(p) > toI64(...)` over `b`'s length, as the window `[q, q + p)`, or null. */
const widenedRest = (
  program: CheckedProgram,
  table: TypeTable,
  sig: FunctionSig,
  names: RunNames,
  left: Node,
  right: Node
): Atom | null => {
  if (left.kind !== NodeKind.Binary || left.text !== "+" || !convertsBy(program, right, "toI64")) {
    return null
  }
  const q = widenedParam(program, sig, left.children[0])
  const p = widenedParam(program, sig, left.children[1])
  const inner = right.children[1].children[0]
  const asMember = memberLength(table, sig, inner)
  const b = asMember >= 0 ? asMember : lengthParam(program, table, sig, names, inner)
  return p >= 0 && q >= 0 && p !== q && b >= 0 ? new Atom(ATOM_PAST_REST, p, q, b) : null
}

/** The comparison `node` is, or null for anything else. */
const atomOf = (
  program: CheckedProgram,
  table: TypeTable,
  sig: FunctionSig,
  names: RunNames,
  node: Node
): Atom | null => {
  if (node.kind !== NodeKind.Binary) {
    return null
  }
  const left = node.children[0]
  const right = node.children[1]
  if (node.text === ">") {
    const factors: i32[] = []
    if (productOf(program, sig, names, left, factors)) {
      const cap = productCap(program, right)
      return cap >= 0 ? new Atom(ATOM_PRODUCT_OVER, factors[0], factors[1], cap) : null
    }
    const widened = widenedRest(program, table, sig, names, left, right)
    if (widened !== null) {
      return widened
    }
  }
  const p = intParam(sig, left)
  if (node.text === "<") {
    if (p >= 0 && isZero(right)) {
      return new Atom(ATOM_NEGATIVE, p, -1, -1)
    }
    const q = intParam(sig, right)
    return p >= 0 && q >= 0 && p !== q ? new Atom(ATOM_BEFORE, p, q, -1) : null
  }
  if (p < 0 || (node.text !== ">" && node.text !== ">=")) {
    return null
  }
  const b = lengthParam(program, table, sig, names, right)
  if (b >= 0) {
    return new Atom(node.text === ">" ? ATOM_PAST_END : ATOM_AT_END, p, -1, b)
  }
  if (node.text !== ">") {
    return null
  }
  const q = intParam(sig, right)
  if (q >= 0) {
    // `p > q` is `q < p`.
    return q !== p ? new Atom(ATOM_BEFORE, q, p, -1) : null
  }
  if (right.kind !== NodeKind.Binary || right.text !== "-") {
    return null
  }
  const rest = lengthParam(program, table, sig, names, right.children[0])
  const off = intParam(sig, right.children[1])
  return rest >= 0 && off >= 0 && off !== p ? new Atom(ATOM_PAST_REST, p, off, rest) : null
}

/** The comparisons of an `||` chain, as the parser nests it, onto `out`; false when one is not a comparison read here. */
const atomsOf = (
  program: CheckedProgram,
  table: TypeTable,
  sig: FunctionSig,
  names: RunNames,
  node: Node,
  out: Atom[]
): boolean => {
  if (node.kind === NodeKind.Binary && node.text === "||") {
    return (
      atomsOf(program, table, sig, names, node.children[0], out) &&
      atomsOf(program, table, sig, names, node.children[1], out)
    )
  }
  const atom = atomOf(program, table, sig, names, node)
  if (atom === null) {
    return false
  }
  out.push(atom)
  return true
}

/** `{ panic(message) }`, the builtin: the branch never falls through. */
const isPanicBlock = (program: CheckedProgram, node: Node): boolean => {
  if (node.kind !== NodeKind.Block || node.children.length !== 1 || shadowsGuardName(program, "panic")) {
    return false
  }
  const stmt = node.children[0]
  return (
    stmt.kind === NodeKind.ExprStmt &&
    stmt.children[0].kind === NodeKind.Call &&
    stmt.children[0].children[0].kind === NodeKind.Ident &&
    stmt.children[0].children[0].text === "panic" &&
    stmt.children[0].children[1].children.length === 1
  )
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

/** Whether `sig` is a function, method or constructor this contract may read: its own body, checked when called, with its arguments as written. */
const mayHoldContract = (program: CheckedProgram, sig: FunctionSig): boolean => {
  if (
    sig.instance !== null ||
    !sig.definedIn(program.source) ||
    // A task or generator body runs after the call returns, when the caller's proof no longer holds.
    (sig.decl.flags & (FLAG_ASYNC | FLAG_GENERATOR)) !== 0 ||
    !takesArgumentsAsWritten(sig) ||
    // A window or fault contract holds its own check.
    sig.window.length > 0 ||
    sig.fault !== null
  ) {
    return false
  }
  if (sig.role === ROLE_FUNCTION) {
    return sig.decl.kind === NodeKind.FunctionDecl && sig.decl.children[4].children.length === 0
  }
  const receives = sig.paramNames.length > 0 && sig.paramNames[0] === "this"
  if (sig.role === ROLE_CONSTRUCTOR) {
    return sig.decl.kind === NodeKind.Constructor && receives
  }
  return (
    sig.role === ROLE_METHOD && sig.decl.kind === NodeKind.Method && sig.decl.children.length <= 4 && receives
  )
}

/** A buffer a held `p > toI32(b.length)` names, for `p < q`, or -1. */
const endBuffer = (atoms: Atom[], p: i32): i32 => {
  for (const atom of atoms) {
    if (atom.shape === ATOM_PAST_END && atom.p === p) {
      return atom.b
    }
  }
  return -1
}

/** The single declarator of `const name: T = init`, or null. */
const constDeclarator = (stmt: Node): Node | null => {
  if (
    stmt.kind !== NodeKind.Var ||
    (stmt.flags & FLAG_CONST) === 0 ||
    stmt.children[0].children.length !== 1
  ) {
    return null
  }
  const decl = stmt.children[0].children[0]
  return decl.children.length >= 3 &&
    decl.children[0].kind === NodeKind.Ident &&
    decl.children[1].kind === NodeKind.TypeRef
    ? decl
    : null
}

/** Whether `name` is free for the run to bind: no parameter, no name the run bound. */
const isFreshName = (sig: FunctionSig, names: RunNames, name: string): boolean =>
  name !== "this" &&
  paramAt(sig, name) < 0 &&
  names.lengths.indexOf(name) < 0 &&
  names.products.indexOf(name) < 0

/** Bind `stmt` onto `names` when it is a length or product the run names; false for anything else. */
const bindName = (
  program: CheckedProgram,
  table: TypeTable,
  sig: FunctionSig,
  names: RunNames,
  stmt: Node
): boolean => {
  const decl = constDeclarator(stmt)
  if (decl === null || !isFreshName(sig, names, decl.children[0].text)) {
    return false
  }
  const type = decl.children[1].text
  const init = decl.children[2]
  if (type === "i32" && convertsBy(program, init, "toI32")) {
    const b = memberLength(table, sig, init.children[1].children[0])
    if (b < 0) {
      return false
    }
    names.lengths.push(decl.children[0].text)
    names.lengthOf.push(b)
    return true
  }
  const factors: i32[] = []
  if (
    type !== "i64" ||
    init.kind !== NodeKind.Binary ||
    !productOf(program, sig, new RunNames(), init, factors)
  ) {
    return false
  }
  names.products.push(decl.children[0].text)
  names.productP.push(factors[0])
  names.productQ.push(factors[1])
  return true
}

/** The function of `program` a call by the bare name `name` reaches, when exactly one has it, or null. */
const functionNamed = (program: CheckedProgram, name: string): FunctionSig | null => {
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

/** The call of a forward, `g(...)` alone or as a `const`'s initializer, or null. */
const forwardCall = (stmt: Node): Node | null => {
  if (stmt.kind === NodeKind.ExprStmt) {
    return stmt.children[0].kind === NodeKind.Call ? stmt.children[0] : null
  }
  const decl = constDeclarator(stmt)
  return decl !== null && decl.children[2].kind === NodeKind.Call ? decl.children[2] : null
}

/**
 * The comparisons of the caller contract `call` forwards into, mapped onto
 * `sig`'s parameters, onto `atoms`; false when `call` is no forward: its
 * callee no caller contract of the module, or a position the contract reads
 * not one of `sig`'s parameters of the same type, or another argument neither
 * a literal nor a parameter.
 */
const forwardAtoms = (
  program: CheckedProgram,
  table: TypeTable,
  sig: FunctionSig,
  names: RunNames,
  seen: StringSet,
  programs: CheckedProgram[],
  call: Node,
  atoms: Atom[]
): FunctionSig | null => {
  const callee = call.children[0]
  if (callee.kind !== NodeKind.Ident || !isFreshName(sig, names, callee.text)) {
    return null
  }
  const target = functionNamed(program, callee.text)
  if (target === null || target === sig) {
    return null
  }
  // Read from the module that defines the target, which may come after this one.
  for (const home of programs) {
    if (target.definedIn(home.source)) {
      noteCallerContract(home, table, target, seen, programs)
    }
  }
  if (!isCallerContract(target)) {
    return null
  }
  const args = call.children[1].children
  if (args.length !== target.paramNames.length) {
    return null
  }
  // The holder's position each argument names, or -1 for a literal.
  const at: i32[] = []
  let k = 0
  for (const arg of args) {
    let pos = -1
    if (arg.kind === NodeKind.Ident && arg.text !== "this") {
      pos = paramAt(sig, arg.text)
      if (pos < 0 || sig.paramTypes[pos] !== target.paramTypes[k]) {
        return null
      }
    } else if (arg.kind !== NodeKind.Number && arg.kind !== NodeKind.String) {
      return null
    }
    at.push(pos)
    k = k + 1
  }
  const flat = target.preconditionAtoms
  k = 0
  // `k + 3`, the last slot of an atom, is `ATOM_WIDTH - 1` spelled so the prover reads it.
  while (k >= 0 && k + 3 < flat.length) {
    const shape = flat[k]
    const p = at[flat[k + 1]]
    const q = flat[k + 2] >= 0 ? at[flat[k + 2]] : -1
    // A product's `b` is its cap, a literal; any other's is a parameter position.
    let b = flat[k + 3]
    if (shape !== ATOM_PRODUCT_OVER) {
      b = flat[k + 3] >= 0 ? at[flat[k + 3]] : -1
    }
    if (p < 0 || (flat[k + 2] >= 0 && q < 0) || (shape !== ATOM_PRODUCT_OVER && flat[k + 3] >= 0 && b < 0)) {
      return null
    }
    atoms.push(new Atom(shape, p, q, b))
    k = k + ATOM_WIDTH
  }
  return target
}

/**
 * Record `sig`'s caller contract: its leading `if (test) { panic(m) }`
 * statements whose tests are read here, in order, with the names bound
 * between them, up to the first statement that is none of these or a
 * forward, and their comparisons, flat on the signature (`ATOM_WIDTH` each).
 * `seen` holds every signature already read, so a forward reads its target
 * first, from `programs`' module that defines it, and a cycle of forwards
 * ends. Only that module reads `sig`, so the order of `programs` moves no
 * contract.
 */
const noteCallerContract = (
  program: CheckedProgram,
  table: TypeTable,
  sig: FunctionSig,
  seen: StringSet,
  programs: CheckedProgram[]
): void => {
  // Read only from the module that defines `sig`: an importer's listing of it, read first, must not mark it seen.
  if (!mayHoldContract(program, sig) || !seen.add(sig.name)) {
    return
  }
  const body = sig.body()
  if (body === null || body.kind !== NodeKind.Block) {
    return
  }
  const held: Node[] = []
  const atoms: Atom[] = []
  const names = new RunNames()
  let forward: Node | null = null
  let target: FunctionSig | null = null
  for (const stmt of body.children) {
    if (bindName(program, table, sig, names, stmt)) {
      continue
    }
    if (
      stmt.kind !== NodeKind.If ||
      stmt.children[2].kind !== NodeKind.Empty ||
      !isPanicBlock(program, stmt.children[1])
    ) {
      const call = forwardCall(stmt)
      const mapped: Atom[] = []
      target = call === null ? null : forwardAtoms(program, table, sig, names, seen, programs, call, mapped)
      if (target !== null) {
        forward = call
        for (const atom of mapped) {
          atoms.push(atom)
        }
      }
      break
    }
    const found: Atom[] = []
    if (!atomsOf(program, table, sig, names, stmt.children[0], found)) {
      break
    }
    held.push(stmt)
    for (const atom of found) {
      atoms.push(atom)
    }
  }
  // `p < q` names its buffer by a `p > toI32(b.length)` held anywhere in the run.
  const flat: i32[] = []
  for (const atom of atoms) {
    const b = atom.shape === ATOM_BEFORE ? endBuffer(atoms, atom.p) : atom.b
    if (atom.shape === ATOM_BEFORE && b < 0) {
      return
    }
    flat.push(atom.shape)
    flat.push(atom.p)
    flat.push(atom.q)
    flat.push(b)
  }
  if (flat.length === 0) {
    return
  }
  sig.precondition = held
  sig.preconditionAtoms = flat
  sig.preconditionForward = forward
  sig.preconditionTarget = target
}

/** Whether `sig` holds a caller contract (`noteCallerContracts`). */
export const isCallerContract = (sig: FunctionSig): boolean => sig.preconditionAtoms.length > 0

/**
 * Find every caller contract in every module, after the window and fault
 * contracts and before any body is checked: `src/bounds.ts` reads them as it
 * walks the callers.
 */
export const noteCallerContracts = (programs: CheckedProgram[], table: TypeTable): void => {
  const seen = new StringSet()
  for (const program of programs) {
    for (const sig of program.functions) {
      noteCallerContract(program, table, sig, seen, programs)
    }
  }
}
