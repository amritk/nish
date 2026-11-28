// The caller contract (#2296): a function or method whose first statements
// are `if (test) { panic(m) }`, each test an `||` of comparisons that read
// only its parameters, panics there exactly when its caller passed arguments
// that make a comparison true. A caller that proves every comparison false
// with its own arguments has proved the panic away. Each call into such a
// function holds those tests as a `contract` site of its own (`PANIC_CONTRACT`
// in `src/panics.ts`), proven where `src/bounds.ts` proves each comparison
// false at the call. When every call is proven, the callee lists the panics
// behind them as proven, so a call reaches them through its `contract` site
// and never twice; one call nothing proves leaves them the callee's.
//
// The comparisons read, with `p` and `q` `i32` parameters and `b` an array or
// string parameter whose length is `toI32(b.length)`:
//
//   p < 0                       the caller proves p >= 0
//   p > toI32(b.length)         p <= b.length
//   p >= toI32(b.length)        0 <= p < b.length, the index proof
//   p > toI32(b.length) - q     the window [q, q + p) of b, as a buffer call's
//   p < q, or q > p             q <= p, with `p > toI32(b.length)` held too
//
// The caller proves a little more than the comparison in the last three (the
// index's floor, the window's offset, the range's end), which it may: the
// panic is away whenever the stronger fact holds. The run of tests stops at
// the first statement that is not one of these, and everything after it is
// the function's own, followed as any call's is.

import { shadowsGuardName } from "./checker"
import { FLAG_ASYNC, FLAG_GENERATOR, Node, NodeKind } from "./nodes"
import { CheckedProgram, FunctionSig, ROLE_FUNCTION, ROLE_METHOD } from "./program"
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

/** The position of the `i32` parameter `node` names, or -1. */
const intParam = (sig: FunctionSig, node: Node): i32 => {
  if (node.kind !== NodeKind.Ident || node.text === "this") {
    return -1
  }
  let k = 0
  while (k < sig.paramNames.length && k < sig.paramTypes.length) {
    if (sig.paramNames[k] === node.text) {
      return sig.paramTypes[k] === T_I32 ? k : -1
    }
    k = k + 1
  }
  return -1
}

/** The position of the array or string parameter whose length `node` is, as `toI32(b.length)`, or -1. */
const lengthParam = (program: CheckedProgram, table: TypeTable, sig: FunctionSig, node: Node): i32 => {
  if (
    node.kind !== NodeKind.Call ||
    node.children[0].kind !== NodeKind.Ident ||
    node.children[0].text !== "toI32" ||
    shadowsGuardName(program, "toI32") ||
    node.children[1].children.length !== 1
  ) {
    return -1
  }
  const member = node.children[1].children[0]
  if (member.kind !== NodeKind.Member || member.text !== "length") {
    return -1
  }
  const holder = member.children[0]
  if (holder.kind !== NodeKind.Ident || holder.text === "this") {
    return -1
  }
  let k = 0
  while (k < sig.paramNames.length && k < sig.paramTypes.length) {
    if (sig.paramNames[k] === holder.text) {
      const type = sig.paramTypes[k]
      return type === T_STRING || table.isArray(type) ? k : -1
    }
    k = k + 1
  }
  return -1
}

/** Whether `node` is the integer literal `0`. */
const isZero = (node: Node): boolean => node.kind === NodeKind.Number && node.text === "0"

/** The comparison `node` is, or null for anything else. */
const atomOf = (program: CheckedProgram, table: TypeTable, sig: FunctionSig, node: Node): Atom | null => {
  if (node.kind !== NodeKind.Binary) {
    return null
  }
  const left = node.children[0]
  const right = node.children[1]
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
  const b = lengthParam(program, table, sig, right)
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
  const rest = lengthParam(program, table, sig, right.children[0])
  const off = intParam(sig, right.children[1])
  return rest >= 0 && off >= 0 && off !== p ? new Atom(ATOM_PAST_REST, p, off, rest) : null
}

/** The comparisons of an `||` chain, as the parser nests it, onto `out`; false when one is not a comparison read here. */
const atomsOf = (
  program: CheckedProgram,
  table: TypeTable,
  sig: FunctionSig,
  node: Node,
  out: Atom[]
): boolean => {
  if (node.kind === NodeKind.Binary && node.text === "||") {
    return (
      atomsOf(program, table, sig, node.children[0], out) &&
      atomsOf(program, table, sig, node.children[1], out)
    )
  }
  const atom = atomOf(program, table, sig, node)
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

/** Whether `sig` is a function or method this contract may read: its own body, checked when called, with its arguments as written. */
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
  return (
    sig.role === ROLE_METHOD &&
    sig.decl.kind === NodeKind.Method &&
    sig.decl.children.length <= 4 &&
    sig.paramNames.length > 0 &&
    sig.paramNames[0] === "this"
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

/**
 * Record `sig`'s caller contract: its leading `if (test) { panic(m) }`
 * statements whose tests are read here, in order, up to the first that is not
 * one, and their comparisons, flat on the signature (`ATOM_WIDTH` each).
 */
const noteCallerContract = (program: CheckedProgram, table: TypeTable, sig: FunctionSig): void => {
  if (!mayHoldContract(program, sig)) {
    return
  }
  const body = sig.body()
  if (body === null || body.kind !== NodeKind.Block) {
    return
  }
  const held: Node[] = []
  const atoms: Atom[] = []
  for (const stmt of body.children) {
    if (
      stmt.kind !== NodeKind.If ||
      stmt.children[2].kind !== NodeKind.Empty ||
      !isPanicBlock(program, stmt.children[1])
    ) {
      break
    }
    const found: Atom[] = []
    if (!atomsOf(program, table, sig, stmt.children[0], found)) {
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
  if (held.length === 0) {
    return
  }
  sig.precondition = held
  sig.preconditionAtoms = flat
}

/** Whether `sig` holds a caller contract (`noteCallerContracts`). */
export const isCallerContract = (sig: FunctionSig): boolean => sig.precondition.length > 0

/**
 * Find every caller contract in every module, after the window and fault
 * contracts and before any body is checked: `src/bounds.ts` reads them as it
 * walks the callers.
 */
export const noteCallerContracts = (programs: CheckedProgram[], table: TypeTable): void => {
  for (const program of programs) {
    for (const sig of program.functions) {
      noteCallerContract(program, table, sig)
    }
  }
}
