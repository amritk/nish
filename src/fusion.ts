// WP32 S5: fused lookups on the global `Map` and `Set` (docs/wp32-map.md §9.1).
//
// Three patterns ask the table the same question twice, and each is one probe
// here: the first probe's packed answer — the entry it found, or the empty
// bucket it stopped at and the key's hash — is kept, and the write goes
// through it, `setValueAt` where the key was found and `insertAt` where it was
// not, so the second hash and the second search are never made.
//
//   1. Update:         m.set(k, E)             E reads `m.get(k)` or `m.has(k)` exactly once
//   2. Guarded write:  if (m.has(k)) { m.set(k, E); ... }       and `!m.has(k)`
//   3. Insert-if-absent: if (!s.has(x)) { s.add(x); ... }
//
// The `set` or `add` of a guard is the branch's first statement. The receiver
// and the key are the same in both calls and spelled the same way: a local or
// a parameter, or a `this.<field>` path, and the key may be a literal too. Any
// other receiver — a call, an element — is evaluated anew by each call, so
// the two calls may not ask about the same table at all.
//
// **Nothing in between.** Between the probe and the write — inside `E`, and
// between the `has` and the branch's first statement, where there is nothing —
// there is no call of any kind, no allocation (`new`, an array or object
// literal, a template literal, a string `+`) and no assignment, `++`, `--` or
// compound assignment. A call could grow the table, delete from it or clear
// it, and any of those moves the bucket the probe found; the whole-program
// facts do not yet say "does not touch this map". `&&`, `||`, `??` and the
// ternary only choose among values `E` already has, so they may stay, and so
// does reading a field, an element, a `.length` or a `.size`.
//
// A pattern outside these rules is not an error: it compiles as the separate
// calls it is, one probe each. So this module only ever records; it reports
// nothing. The checker calls it once the calls are checked, the attribute pass
// reads what it recorded to name the table's functions a fused call reaches
// instead (`fusedCalleesOf`), and the emitter lowers it (`emitFusedCall`, both
// in `src/emit-map.ts`).

import { CheckContext } from "./context"
import { isAssignmentOperator, unwrapParens } from "./emit-util"
import { isCollectionStruct, isMapOwner } from "./generics"
import { Node, NodeKind } from "./nodes"
import {
  CheckedProgram,
  FUSE_PROBE,
  FUSE_UPDATE,
  FUSE_USE,
  FUSE_WRITE_ABSENT,
  FUSE_WRITE_FOUND,
  FunctionSig,
  StructInfo,
} from "./program"
import { T_STRING } from "./types"

/**
 * Pattern 1: `call` is `m.set(k, E)`, just checked. When `E` asks about `k` in
 * `m` exactly once and does nothing else, the `set` is recorded as an update
 * whose probe that one `get` or `has` reads.
 */
export const recordUpdateFusion = (ctx: CheckContext, call: Node): void => {
  const owner = collectionOwnerOf(ctx.program, call, "set")
  if (owner === null || ctx.program.isCollections()) {
    return
  }
  const args = call.children[1].children
  if (args.length !== 2) {
    return
  }
  const receiver = call.children[0].children[0]
  const key = args[0]
  if (!isFusablePlace(ctx.program, receiver) || !isFusableKey(ctx.program, key)) {
    return
  }
  const calls: Node[] = []
  if (!isInert(ctx, args[1], calls) || calls.length !== 1) {
    return
  }
  const use = calls[0]
  const asks =
    collectionOwnerOf(ctx.program, use, "get") !== null || collectionOwnerOf(ctx.program, use, "has") !== null
  if (!asks || !sameCallTarget(ctx.program, use, receiver, key)) {
    return
  }
  ctx.program.fusion.record(call.id, FUSE_UPDATE, call.id)
  ctx.program.fusion.record(use.id, FUSE_USE, call.id)
}

/**
 * Patterns 2 and 3: `stmt` is an `if`, just checked. When its condition is
 * `m.has(k)` or `!m.has(k)` and its branch starts with the write of that key
 * — `m.set(k, E)` for a `Map`, `s.add(x)` under `!s.has(x)` for a `Set` — the
 * `has` is recorded as the probe and the write as a write through it.
 */
export const recordGuardFusion = (ctx: CheckContext, stmt: Node): void => {
  if (ctx.program.isCollections()) {
    return
  }
  let condition = unwrapParens(stmt.children[0])
  const absent = condition.kind === NodeKind.Unary && condition.text === "!"
  if (absent) {
    condition = unwrapParens(condition.children[0])
  }
  const owner = collectionOwnerOf(ctx.program, condition, "has")
  if (owner === null) {
    return
  }
  const receiver = condition.children[0].children[0]
  const key = condition.children[1].children[0]
  if (!isFusablePlace(ctx.program, receiver) || !isFusableKey(ctx.program, key)) {
    return
  }
  const write = firstCallOf(stmt.children[1])
  if (write === null || !sameCallTarget(ctx.program, write, receiver, key)) {
    return
  }
  if (isMapOwner(owner)) {
    const args = write.children[1].children
    const calls: Node[] = []
    if (
      collectionOwnerOf(ctx.program, write, "set") === null ||
      args.length !== 2 ||
      !isInert(ctx, args[1], calls) ||
      calls.length > 0
    ) {
      return
    }
  } else if (!absent || collectionOwnerOf(ctx.program, write, "add") === null) {
    return
  }
  ctx.program.fusion.record(condition.id, FUSE_PROBE, condition.id)
  ctx.program.fusion.record(write.id, absent ? FUSE_WRITE_ABSENT : FUSE_WRITE_FOUND, condition.id)
}

/**
 * The table `call` is a call of `name` on, when it is one on the global `Map`
 * or `Set`, or `null`. A `get` is checked as a call of the table's `probe`
 * (`checkMapGet`), so it is recognised by its spelling and that callee.
 */
const collectionOwnerOf = (program: CheckedProgram, call: Node, name: string): StructInfo | null => {
  if (
    call.kind !== NodeKind.Call ||
    call.children[0].kind !== NodeKind.Member ||
    call.children[0].text !== name
  ) {
    return null
  }
  const sig: FunctionSig | null = program.nodeCallees[call.id]
  if (sig === null) {
    return null
  }
  const owner = sig.owner
  if (owner === null || !isCollectionStruct(owner) || call.children[1].children.length === 0) {
    return null
  }
  return owner
}

/** The call a branch starts with, when its first statement is one: `{ m.set(k, E); ... }` or `m.set(k, E);`. */
const firstCallOf = (branch: Node): Node | null => {
  let first = branch
  if (branch.kind === NodeKind.Block) {
    if (branch.children.length === 0) {
      return null
    }
    first = branch.children[0]
  }
  if (first.kind !== NodeKind.ExprStmt) {
    return null
  }
  const call = unwrapParens(first.children[0])
  return call.kind === NodeKind.Call && call.children[0].kind === NodeKind.Member ? call : null
}

/** Whether `call` is on `receiver` with `key` as its first argument, both spelled the same. */
const sameCallTarget = (program: CheckedProgram, call: Node, receiver: Node, key: Node): boolean =>
  call.children[0].kind === NodeKind.Member &&
  call.children[1].children.length > 0 &&
  samePlace(program, call.children[0].children[0], receiver) &&
  samePlace(program, call.children[1].children[0], key)

/** A receiver both calls evaluate to the same table: a local or parameter, or a `this.<field>` path. */
const isFusablePlace = (program: CheckedProgram, node: Node): boolean =>
  node.kind === NodeKind.Ident ? program.nodeLocals[node.id] !== null : isThisPath(node)

/** `this.a.b`: a chain of field reads that starts at `this`. */
const isThisPath = (node: Node): boolean => {
  if (node.kind === NodeKind.This) {
    return true
  }
  return node.kind === NodeKind.Member && isThisPath(node.children[0])
}

/** A key that means the same at both calls: a place, or a literal. */
const isFusableKey = (program: CheckedProgram, node: Node): boolean =>
  isKeyLiteral(node) || isFusablePlace(program, node)

const isKeyLiteral = (node: Node): boolean =>
  node.kind === NodeKind.Number ||
  node.kind === NodeKind.String ||
  node.kind === NodeKind.True ||
  node.kind === NodeKind.False

/** Whether `a` and `b` are spelled the same way and name the same place. */
const samePlace = (program: CheckedProgram, a: Node, b: Node): boolean => {
  if (a.kind !== b.kind) {
    return false
  }
  if (a.kind === NodeKind.Ident) {
    const local = program.nodeLocals[a.id]
    const other = program.nodeLocals[b.id]
    return a.text === b.text && local !== null && other !== null && local === other
  }
  if (a.kind === NodeKind.This) {
    return true
  }
  if (a.kind === NodeKind.Member) {
    return a.text === b.text && samePlace(program, a.children[0], b.children[0])
  }
  return isKeyLiteral(a) && a.text === b.text
}

/**
 * Whether evaluating `node` can do nothing to a table: no allocation, no
 * assignment and no call. The calls it holds are collected rather than
 * refused, because pattern 1 allows exactly one and says which; the caller
 * judges them. The places of a call collected are its receiver and key,
 * which the caller holds to `samePlace`, so they are not walked here.
 */
const isInert = (ctx: CheckContext, node: Node, calls: Node[]): boolean => {
  const program = ctx.program
  switch (node.kind) {
    case NodeKind.Ident:
    case NodeKind.Number:
    case NodeKind.String:
    case NodeKind.True:
    case NodeKind.False:
    case NodeKind.Null:
    case NodeKind.This:
      return true
    case NodeKind.Paren:
      return isInert(ctx, node.children[0], calls)
    case NodeKind.Unary:
      return node.text !== "++" && node.text !== "--" && isInert(ctx, node.children[0], calls)
    case NodeKind.Binary:
      // A string `+` builds a new string, which is an allocation.
      if (isAssignmentOperator(node.text) || (node.text === "+" && program.nodeTypes[node.id] === T_STRING)) {
        return false
      }
      return isInert(ctx, node.children[0], calls) && isInert(ctx, node.children[1], calls)
    case NodeKind.Conditional:
      return (
        isInert(ctx, node.children[0], calls) &&
        isInert(ctx, node.children[1], calls) &&
        isInert(ctx, node.children[2], calls)
      )
    case NodeKind.Member:
      // A field, `.length` or `.size` of a value, or an enum member; a
      // namespace's property (`Math.PI`, `process.argv`) is the builtins' to
      // lower, and is left out rather than looked into.
      if (program.nodeTypes[node.children[0].id] >= 0) {
        return isInert(ctx, node.children[0], calls)
      }
      return program.isEnumMember(ctx.table, node)
    case NodeKind.Index:
      return isInert(ctx, node.children[0], calls) && isInert(ctx, node.children[1], calls)
    case NodeKind.Call:
      calls.push(node)
      return true
    default:
      return false
  }
}
