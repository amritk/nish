// The WP33 portability rows for records (docs/wp33-round-trip.md §3.3): a
// record copied into an array while the original is still used (NL8003) and a
// store over an element a live reference still reads (NL8004).
//
// Both come from one layout decision, "Arrays of records are contiguous" in
// docs/LANGUAGE.md: an array of records holds the records themselves, so
// putting one in copies it and `ps[i]` is a pointer into the block. TypeScript
// stores and hands out the same object instead. Neither difference shows until
// one copy is written and the other is read afterwards, so that is what both
// rows wait for; a copy nobody writes is the same program in either reading.
//
// Each row is a question about a whole body rather than one node, so both are
// answered once, when the pass hands over the body's root. NL8004 asks the
// element-reference walk of `src/arrays.ts` — the one behind
// `reject_arr_element_across_push` — which already knows which references are
// live where, rather than tracking them a second time.

import { inlineArrayElement, referenceRoot, slotOverwrites } from "./arrays"
import { isAssignmentOperator, unwrapParens } from "./emit-util"
import {
  N_ARRAY,
  N_ARROW,
  N_BINARY,
  N_CALL,
  N_DO,
  N_FOR,
  N_FOR_OF,
  N_IDENT,
  N_INDEX,
  N_MEMBER,
  N_PAREN,
  N_UNARY,
  N_VAR_DECL,
  N_WHILE,
  Node,
} from "./nodes"
import { PortabilityFinding, PortabilityWalk } from "./portability"
import { Local } from "./symbols"

/**
 * The records rows, asked about one node at a time.
 *
 * `src/portability.ts` calls this once for every node of every checked
 * function body, in source order, after NL8005 and before the next row
 * module; an arrow argument's body is handed over under its own function
 * rather than inside its parent's. `walk` carries the facts
 * (`PortabilityWalk`): the module with this body's side tables installed —
 * a generic instantiation's own, so a type read there is concrete — the type
 * table, the options (`--wrapping`, `--number-mode`), the parent links, and
 * the function and body being walked.
 *
 * A site is reported by appending `new PortabilityFinding(node, message)` to
 * `out`; `node` is where the caret goes and `message` must contain its
 * row's fragment from `portabilityRules` in `src/codes.ts` verbatim. The
 * order findings are appended in does not matter — the sink sorts them — and a
 * finding repeated at one node with one message is kept once.
 *
 * Both rows here read the whole body, so they answer at its root and at no
 * other node.
 */
export const recordFindings = (walk: PortabilityWalk, node: Node, out: PortabilityFinding[]): void => {
  if (node !== walk.body) {
    return
  }
  copyFindings(walk, out)
  overwriteFindings(walk, out)
}

// ---- NL8003: a record copied into an array --------------------------------------

/**
 * One side of a copy: the source binding `p`, or the array `ps` it went into.
 * A local is matched by its binding, so a shadowing name is another side; an
 * array that is a field (`this.ps`) has no local and is matched by its root,
 * the spelling `src/arrays.ts` tells references apart by.
 */
class Side {
  local: Local | null
  root: string
  text: string

  constructor(local: Local | null, root: string, text: string) {
    this.local = local
    this.root = root
    this.text = text
  }

  /** Whether `node` names this side. */
  names(walk: PortabilityWalk, node: Node): boolean {
    const local = this.local
    if (local !== null) {
      const bound = walk.program.nodeLocals[node.id]
      return node.kind === N_IDENT && bound !== null && bound === local
    }
    return node.kind === N_MEMBER && referenceRoot(node) === this.root
  }

  same(other: Side): boolean {
    const local = this.local
    const theirs = other.local
    if (local !== null) {
      return theirs !== null && local === theirs
    }
    return theirs === null && this.root === other.root
  }
}

/** `p` copied into `into`: the argument of a `push`, an element of a literal, the value of `ps[i] = p`. */
class CopySite {
  source: Node
  local: Local
  into: Side

  constructor(source: Node, local: Local, into: Side) {
    this.source = source
    this.local = local
    this.into = into
  }
}

/** The side an array expression names, or `null` for one that has no name (a call's result). */
const sideOf = (walk: PortabilityWalk, expr: Node): Side | null => {
  const inner = unwrapParens(expr)
  if (inner.kind === N_IDENT) {
    const local = walk.program.nodeLocals[inner.id]
    return local === null ? null : new Side(local, "", inner.text)
  }
  if (inner.kind !== N_MEMBER) {
    return null
  }
  const root = referenceRoot(inner)
  return root === "" ? null : new Side(null, root, walk.textOf(inner))
}

/**
 * The array a literal becomes: the binding it initialises or the target it is
 * assigned to. A literal handed straight to a call or returned has no name
 * here to watch, and is left alone.
 */
const literalSide = (walk: PortabilityWalk, literal: Node): Side | null => {
  let child = literal
  let parent = walk.parents.parentOf(literal)
  while (parent !== null && parent.kind === N_PAREN) {
    child = parent
    parent = walk.parents.parentOf(parent)
  }
  if (parent === null) {
    return null
  }
  if (parent.kind === N_VAR_DECL && parent.children[2] === child) {
    const local = walk.program.nodeLocals[parent.id]
    return local === null ? null : new Side(local, "", parent.children[0].text)
  }
  if (parent.kind === N_BINARY && parent.text === "=" && parent.children[1] === child) {
    return sideOf(walk, parent.children[0])
  }
  return null
}

/** Record `value` as a copy into `into` when it is a binding. */
const addCopy = (walk: PortabilityWalk, value: Node, into: Side | null, out: CopySite[]): void => {
  const source = unwrapParens(value)
  if (into === null || source.kind !== N_IDENT) {
    return
  }
  const local = walk.program.nodeLocals[source.id]
  if (local !== null) {
    out.push(new CopySite(source, local, into))
  }
}

/** Whether `array` is an array whose slots hold records by value. */
const holdsRecords = (walk: PortabilityWalk, array: Node): boolean =>
  inlineArrayElement(walk.program, walk.table, array) !== ""

/** Every copy of a binding into an array of records, in source order. */
const collectCopies = (walk: PortabilityWalk, node: Node, out: CopySite[]): void => {
  if (node.kind === N_ARROW) {
    return
  }
  if (node.kind === N_CALL && node.children[0].kind === N_MEMBER && node.children[0].text === "push") {
    const receiver = node.children[0].children[0]
    if (holdsRecords(walk, receiver)) {
      const into = sideOf(walk, receiver)
      for (const arg of node.children[1].children) {
        addCopy(walk, arg, into, out)
      }
    }
  }
  if (node.kind === N_ARRAY && holdsRecords(walk, node)) {
    const into = literalSide(walk, node)
    for (const element of node.children) {
      addCopy(walk, element, into, out)
    }
  }
  if (node.kind === N_BINARY && node.text === "=") {
    const target = unwrapParens(node.children[0])
    if (target.kind === N_INDEX && holdsRecords(walk, target.children[0])) {
      addCopy(walk, node.children[1], sideOf(walk, target.children[0]), out)
    }
  }
  for (const child of node.children) {
    collectCopies(walk, child, out)
  }
}

/**
 * Every write to a field of a record, in source order: `r.x = e`, `r.x += e`,
 * `r.x++`. Only the record's own fields count: `p.inner.x = 1` writes a record
 * the field points to, which the copy shares natively too.
 */
const collectFieldWrites = (node: Node, out: Node[]): void => {
  if (node.kind === N_ARROW) {
    return
  }
  const writes =
    (node.kind === N_BINARY && isAssignmentOperator(node.text)) ||
    (node.kind === N_UNARY && (node.text === "++" || node.text === "--"))
  if (writes && unwrapParens(node.children[0]).kind === N_MEMBER) {
    out.push(node)
  }
  for (const child of node.children) {
    collectFieldWrites(child, out)
  }
}

/** The record a field write writes into: `p` of `p.x = 1`, `ps[i]` of `ps[i].x = 1`. */
const writtenRecord = (write: Node): Node => unwrapParens(unwrapParens(write.children[0]).children[0])

/** Where `local` is declared in the body, or `null` for a parameter. */
const bindingDeclaration = (walk: PortabilityWalk, node: Node, local: Local): Node | null => {
  const declared = walk.program.nodeLocals[node.id]
  if (node.kind === N_VAR_DECL && declared !== null && declared === local) {
    return node
  }
  for (const child of node.children) {
    const found = bindingDeclaration(walk, child, local)
    if (found !== null) {
      return found
    }
  }
  return null
}

const isInside = (inner: Node, outer: Node): boolean => inner.start >= outer.start && inner.end <= outer.end

const isLoop = (node: Node): boolean =>
  node.kind === N_FOR || node.kind === N_FOR_OF || node.kind === N_WHILE || node.kind === N_DO

/**
 * Whether `later` can run after `earlier`: it follows it in the source, or
 * both are inside a loop that runs them again with the same record. A loop
 * that declares the record makes a fresh one each pass, so a write there on
 * one pass does not reach the copy an earlier pass made.
 */
const runsAfter = (walk: PortabilityWalk, earlier: Node, later: Node, decl: Node | null): boolean => {
  if (later.start >= earlier.end) {
    return true
  }
  let at = walk.parents.parentOf(earlier)
  while (at !== null && at !== walk.body) {
    if (isLoop(at) && isInside(later, at) && (decl === null || !isInside(decl, at))) {
      return true
    }
    at = walk.parents.parentOf(at)
  }
  return false
}

/** Whether anything under `node` names `side` after `write` has run. */
const readAfter = (
  walk: PortabilityWalk,
  node: Node,
  side: Side,
  write: Node,
  decl: Node | null
): boolean => {
  if (node.kind === N_ARROW) {
    return false
  }
  if (side.names(walk, node) && runsAfter(walk, write, node, decl)) {
    return true
  }
  for (const child of node.children) {
    if (readAfter(walk, child, side, write, decl)) {
      return true
    }
  }
  return false
}

/**
 * NL8003. A binding `p` copied into an array `ps` of records, then one of the
 * two written and the other read afterwards: natively the write stays on its
 * own side of the copy, and in TypeScript both names are one object. A write
 * through `ps[i].x` counts as a write to the array's copy whichever slot `i`
 * is; when `p` went into `ps` twice (`[p, p]`), a read of `ps` after it is a
 * read of the other copy too.
 */
const copyFindings = (walk: PortabilityWalk, out: PortabilityFinding[]): void => {
  const copies: CopySite[] = []
  collectCopies(walk, walk.body, copies)
  if (copies.length === 0) {
    return
  }
  const writes: Node[] = []
  collectFieldWrites(walk.body, writes)
  for (const copy of copies) {
    const decl = bindingDeclaration(walk, walk.body, copy.local)
    const source = new Side(copy.local, "", copy.source.text)
    let twice = false
    for (const other of copies) {
      if (other !== copy && other.local === copy.local && other.into.same(copy.into)) {
        twice = true
      }
    }
    for (const write of writes) {
      if (!runsAfter(walk, copy.source, write, decl)) {
        continue
      }
      const record = writtenRecord(write)
      let seenBy = ""
      if (source.names(walk, record)) {
        seenBy = readAfter(walk, walk.body, copy.into, write, decl) ? `\`${copy.into.text}\`` : ""
      } else if (record.kind === N_INDEX && copy.into.names(walk, unwrapParens(record.children[0]))) {
        if (readAfter(walk, walk.body, source, write, decl)) {
          seenBy = `\`${source.text}\``
        } else if (twice && readAfter(walk, walk.body, copy.into, write, decl)) {
          seenBy = `the other copy in \`${copy.into.text}\``
        }
      }
      if (seenBy !== "") {
        out.push(
          new PortabilityFinding(
            copy.source,
            `\`${source.text}\` is copied into the array here, and TypeScript stores the same object, so the later write \`${walk.textOf(write)}\` (line ${walk.program.source.lineOf(write.start)}) is not seen through ${seenBy}`
          )
        )
        break
      }
    }
  }
}

// ---- NL8004: a store over an element a reference still reads ----------------------

/**
 * NL8004. `ps[i] = q` while `r = ps[j]` is live and read afterwards: natively
 * `r` points at the slot and reads `q`'s fields from then on, and in
 * TypeScript it still holds the object the slot held before. Which slot is
 * not asked, so `i` and `j` may be unrelated; the reference and its liveness
 * are the ones `src/arrays.ts` tracks for `reject_arr_element_across_push`.
 */
const overwriteFindings = (walk: PortabilityWalk, out: PortabilityFinding[]): void => {
  for (const found of slotOverwrites(walk.program, walk.table, walk.body)) {
    out.push(
      new PortabilityFinding(
        found.store,
        `\`${walk.textOf(found.store)}\` overwrites the element a reference still reads, and TypeScript replaces the object instead (\`${found.reference.name}\`, line ${walk.program.source.lineOf(found.read.start)})`
      )
    )
  }
}
