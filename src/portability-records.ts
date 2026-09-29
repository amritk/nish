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

import { referenceRoot, SlotOverwrite, slotOverwrites, slotStoreArray } from "./arrays"
import {
  isAssignmentOperator,
  isPushCall,
  methodReceiver,
  storesInlineElements,
  unwrapParens,
} from "./emit-util"
import {
  N_ARRAY,
  N_ARROW,
  N_BINARY,
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
  /** The node whose text a message names this side by, spelled only when there is a finding. */
  spelled: Node

  constructor(local: Local | null, root: string, spelled: Node) {
    this.local = local
    this.root = root
    this.spelled = spelled
  }

  /** Whether `node` names this side. */
  names(walk: PortabilityWalk, node: Node): boolean {
    const local = this.local
    if (local !== null) {
      return namesLocal(walk, node, local)
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

/** Whether `node` is a use of the binding `local`. */
const namesLocal = (walk: PortabilityWalk, node: Node, local: Local): boolean => {
  const bound = walk.program.nodeLocals[node.id]
  return node.kind === N_IDENT && bound !== null && bound === local
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
    return local === null ? null : new Side(local, "", inner)
  }
  if (inner.kind !== N_MEMBER) {
    return null
  }
  const root = referenceRoot(inner)
  return root === "" ? null : new Side(null, root, inner)
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
    return local === null ? null : new Side(local, "", parent.children[0])
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

/** Every copy of a binding into an array of records, in source order. */
const collectCopies = (walk: PortabilityWalk, node: Node, out: CopySite[]): void => {
  if (node.kind === N_ARROW) {
    return
  }
  const receiver = methodReceiver(node)
  if (
    receiver !== null &&
    isPushCall(walk.program, walk.table, node) &&
    storesInlineElements(walk.program, walk.table, receiver)
  ) {
    const into = sideOf(walk, receiver)
    for (const arg of node.children[1].children) {
      addCopy(walk, arg, into, out)
    }
  }
  if (node.kind === N_ARRAY && storesInlineElements(walk.program, walk.table, node)) {
    const into = literalSide(walk, node)
    for (const element of node.children) {
      addCopy(walk, element, into, out)
    }
  }
  const stored = slotStoreArray(walk.program, walk.table, node)
  if (stored !== null) {
    addCopy(walk, node.children[1], sideOf(walk, stored), out)
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
 * The outermost loop around `node` that runs it again with the same record —
 * one that does not declare the record, since a loop that does makes a fresh
 * one each pass — or `null`. Every loop between it and `node` repeats with the
 * same record too, so this one loop answers for all of them.
 */
const repeatingLoop = (walk: PortabilityWalk, node: Node, decl: Node | null): Node | null => {
  let found: Node | null = null
  let at = walk.parents.parentOf(node)
  while (at !== null && at !== walk.body) {
    if (isLoop(at) && (decl === null || !isInside(decl, at))) {
      found = at
    }
    at = walk.parents.parentOf(at)
  }
  return found
}

/**
 * Whether `later` can run after `earlier`: it follows it in the source, or it
 * is inside `loop`, `earlier`'s `repeatingLoop`, which runs both again.
 */
const runsAfter = (earlier: Node, later: Node, loop: Node | null): boolean =>
  later.start >= earlier.end || (loop !== null && isInside(later, loop))

/** Whether anything under `node` names `side` after `write`, whose `repeatingLoop` is `loop`, has run. */
const readAfter = (
  walk: PortabilityWalk,
  node: Node,
  side: Side,
  write: Node,
  loop: Node | null
): boolean => {
  if (node.kind === N_ARROW) {
    return false
  }
  if (side.names(walk, node) && runsAfter(write, node, loop)) {
    return true
  }
  for (const child of node.children) {
    if (readAfter(walk, child, side, write, loop)) {
      return true
    }
  }
  return false
}

/** Which copy a write goes unseen by: none, the array, the source binding, or the array's other copy. */
const SEEN_BY_NONE: i32 = 0
const SEEN_BY_ARRAY: i32 = 1
const SEEN_BY_SOURCE: i32 = 2
const SEEN_BY_OTHER_COPY: i32 = 3

/**
 * The NL8003 message for one copy. Built here rather than in the loop that
 * finds it, so the strings it spells are the finding the loop keeps and not
 * scratch the loop leaves behind on every pass (NL9011).
 */
const copyFinding = (walk: PortabilityWalk, copy: CopySite, write: Node, seenBy: i32): PortabilityFinding => {
  const name = copy.source.text
  const into = walk.textOf(copy.into.spelled)
  let other = `the other copy in \`${into}\``
  if (seenBy === SEEN_BY_SOURCE) {
    other = `\`${name}\``
  } else if (seenBy === SEEN_BY_ARRAY) {
    other = `\`${into}\``
  }
  return new PortabilityFinding(
    copy.source,
    `\`${name}\` is copied into the array here, and TypeScript stores the same object, so the later write \`${walk.textOf(write)}\` (line ${walk.program.source.lineOf(write.start)}) is not seen through ${other}`
  )
}

/**
 * NL8003. A binding `p` copied into an array `ps` of records, then one of the
 * two written and the other read afterwards: natively the write stays on its
 * own side of the copy, and in TypeScript both names are one object. A write
 * through `ps[i].x` counts as a write to the array's copy whichever slot `i`
 * is; when `p` went into `ps` twice (`[p, p]`), a read of `ps` after it is a
 * read of the other copy too. Each copy is reported once, at its first such
 * write.
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
    const copyLoop = repeatingLoop(walk, copy.source, decl)
    const source = new Side(copy.local, "", copy.source)
    let twice = false
    for (const other of copies) {
      if (other !== copy && other.local === copy.local && other.into.same(copy.into)) {
        twice = true
        break
      }
    }
    for (const write of writes) {
      if (!runsAfter(copy.source, write, copyLoop)) {
        continue
      }
      const record = writtenRecord(write)
      const writeLoop = repeatingLoop(walk, write, decl)
      let seenBy = SEEN_BY_NONE
      if (namesLocal(walk, record, copy.local)) {
        if (readAfter(walk, walk.body, copy.into, write, writeLoop)) {
          seenBy = SEEN_BY_ARRAY
        }
      } else if (record.kind === N_INDEX && copy.into.names(walk, unwrapParens(record.children[0]))) {
        if (readAfter(walk, walk.body, source, write, writeLoop)) {
          seenBy = SEEN_BY_SOURCE
        } else if (twice && readAfter(walk, walk.body, copy.into, write, writeLoop)) {
          seenBy = SEEN_BY_OTHER_COPY
        }
      }
      if (seenBy !== SEEN_BY_NONE) {
        out.push(copyFinding(walk, copy, write, seenBy))
        break
      }
    }
  }
}

// ---- NL8004: a store over an element a reference still reads ----------------------

/** The NL8004 message for one overwrite, built outside the loop for the reason `copyFinding` gives. */
const overwriteFinding = (walk: PortabilityWalk, found: SlotOverwrite): PortabilityFinding =>
  new PortabilityFinding(
    found.store,
    `\`${walk.textOf(found.store)}\` overwrites the element a reference still reads, and TypeScript replaces the object instead (\`${found.reference.name}\`, line ${walk.program.source.lineOf(found.read.start)})`
  )

/**
 * NL8004. `ps[i] = q` while `r = ps[j]` is live and read afterwards: natively
 * `r` points at the slot and reads `q`'s fields from then on, and in
 * TypeScript it still holds the object the slot held before. Which slot is
 * not asked, so `i` and `j` may be unrelated; the reference and its liveness
 * are the ones `src/arrays.ts` tracks for `reject_arr_element_across_push`.
 */
const overwriteFindings = (walk: PortabilityWalk, out: PortabilityFinding[]): void => {
  for (const found of slotOverwrites(walk.program, walk.table, walk.body)) {
    out.push(overwriteFinding(walk, found))
  }
}
