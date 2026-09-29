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
//
// Arrays are references, so one array can be under two names (`const qs = ps`).
// Both rows tell arrays apart by name, so for an element type a body puts
// under a second name (`aliasedRecordElements` in `src/arrays.ts`) they match
// every array of that element type instead: a write or a store through `qs`
// is then seen as one through `ps`.

import {
  aliasedRecordElements,
  inlineArrayElement,
  referenceRoot,
  SlotOverwrite,
  slotOverwrites,
  slotStoreArray,
} from "./arrays"
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
import { StringMap, StringSet } from "./map"
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
  const aliased = aliasedRecordElements(walk.program, walk.table, walk.body)
  copyFindings(walk, aliased, out)
  overwriteFindings(walk, aliased, out)
}

// ---- NL8003: a record copied into an array --------------------------------------

/**
 * One side of a copy: the source binding `p`, or the array `ps` it went into.
 * A local is matched by its binding, so a shadowing name is another side; an
 * array that is a field (`this.ps`) has no local and is matched by its root,
 * the spelling `src/arrays.ts` tells references apart by; and an array whose
 * element type the body aliases (`elem`) is matched by that type, whatever
 * names it.
 */
class Side {
  local: Local | null
  root: string
  elem: string
  /** The node whose text a message names this side by, spelled only when there is a finding. */
  spelled: Node
  /** Which bucket of the `RecordIndex` this side's uses and writes are in. */
  key: string

  constructor(local: Local | null, root: string, elem: string, spelled: Node) {
    this.local = local
    this.root = root
    this.elem = elem
    this.spelled = spelled
    this.key = `r:${root}`
    if (local !== null) {
      this.key = `l:${local.name}`
    } else if (elem !== "") {
      this.key = `e:${elem}`
    }
  }

  /** Whether `node` names this side. */
  names(walk: PortabilityWalk, node: Node): boolean {
    const local = this.local
    if (local !== null) {
      return namesLocal(walk, node, local)
    }
    if (this.elem !== "") {
      return (
        (node.kind === N_IDENT || node.kind === N_MEMBER) &&
        inlineArrayElement(walk.program, walk.table, node) === this.elem
      )
    }
    return node.kind === N_MEMBER && referenceRoot(node) === this.root
  }

  same(other: Side): boolean {
    const local = this.local
    const theirs = other.local
    if (local !== null) {
      return theirs !== null && local === theirs
    }
    return theirs === null && this.key === other.key
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

/** The nodes of one bucket, in source order. */
class NodeList {
  nodes: Node[]

  constructor() {
    this.nodes = []
  }
}

/**
 * The body read once, so that every question NL8003 asks is a lookup rather
 * than another walk of the body: the copies, and in buckets keyed by name —
 * `u` for a use, `w` for a field write, `d` for a declaration, then a
 * `Side.key` — every node a side's question can be about, in source order.
 * A bucket keyed by a local's name can hold a shadowing local too, so an
 * answer read out of it still asks `Side.names`.
 */
class RecordIndex {
  walk: PortabilityWalk
  aliased: StringSet
  keys: StringMap
  lists: NodeList[]
  empty: Node[]
  copies: CopySite[]
  /** How many copies each (binding, array) pair has, for `[p, p]`. */
  copyCounts: StringMap

  constructor(walk: PortabilityWalk, aliased: StringSet) {
    this.walk = walk
    this.aliased = aliased
    this.keys = new StringMap()
    this.lists = []
    this.empty = []
    this.copies = []
    this.copyCounts = new StringMap()
  }

  add(key: string, node: Node): void {
    let at = this.keys.get(key, -1)
    if (at < 0) {
      at = this.lists.length
      this.keys.set(key, at)
      this.lists.push(new NodeList())
    }
    this.lists[at].nodes.push(node)
  }

  at(key: string): Node[] {
    const at = this.keys.get(key, -1)
    return at < 0 ? this.empty : this.lists[at].nodes
  }

  /** The side an array expression names, or `null` for one that has no name (a call's result). */
  sideOf(expr: Node): Side | null {
    const inner = unwrapParens(expr)
    const elem = inlineArrayElement(this.walk.program, this.walk.table, inner)
    if (this.aliased.has(elem)) {
      return new Side(null, "", elem, inner)
    }
    if (inner.kind === N_IDENT) {
      const local = this.walk.program.nodeLocals[inner.id]
      return local === null ? null : new Side(local, "", "", inner)
    }
    if (inner.kind !== N_MEMBER) {
      return null
    }
    const root = referenceRoot(inner)
    return root === "" ? null : new Side(null, root, "", inner)
  }

  /**
   * The array a literal becomes: the binding it initialises or the target it
   * is assigned to. A literal handed straight to a call or returned has no
   * name here to watch, and is left alone unless its element type is aliased.
   */
  literalSide(literal: Node): Side | null {
    const walk = this.walk
    const elem = inlineArrayElement(walk.program, walk.table, literal)
    if (this.aliased.has(elem)) {
      return new Side(null, "", elem, literal)
    }
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
      return local === null ? null : new Side(local, "", "", parent.children[0])
    }
    if (parent.kind === N_BINARY && parent.text === "=" && parent.children[1] === child) {
      return this.sideOf(parent.children[0])
    }
    return null
  }

  /** Record `value` as a copy into `into` when it is a binding. */
  addCopy(value: Node, into: Side | null): void {
    const source = unwrapParens(value)
    if (into === null || source.kind !== N_IDENT) {
      return
    }
    const local = this.walk.program.nodeLocals[source.id]
    if (local !== null) {
      this.copies.push(new CopySite(source, local, into))
      const pair = `${local.name}|${into.key}`
      this.copyCounts.set(pair, this.copyCounts.get(pair, 0) + 1)
    }
  }

  /** Index a copy made at `node`, if it is one. */
  indexCopy(node: Node): void {
    const walk = this.walk
    const receiver = methodReceiver(node)
    if (
      receiver !== null &&
      isPushCall(walk.program, walk.table, node) &&
      storesInlineElements(walk.program, walk.table, receiver)
    ) {
      const into = this.sideOf(receiver)
      for (const arg of node.children[1].children) {
        this.addCopy(arg, into)
      }
    }
    if (node.kind === N_ARRAY && storesInlineElements(walk.program, walk.table, node)) {
      const into = this.literalSide(node)
      for (const element of node.children) {
        this.addCopy(element, into)
      }
    }
    const stored = slotStoreArray(walk.program, walk.table, node)
    if (stored !== null) {
      this.addCopy(node.children[1], this.sideOf(stored))
    }
  }

  /**
   * Index a use of a binding or of a record array. A record array goes into
   * its element type's bucket as well as its name's, for an aliased side.
   */
  indexUse(node: Node): void {
    const walk = this.walk
    if (node.kind === N_IDENT) {
      const local = walk.program.nodeLocals[node.id]
      if (local !== null) {
        this.add(`ul:${local.name}`, node)
      }
    }
    if (node.kind !== N_IDENT && node.kind !== N_MEMBER) {
      return
    }
    const elem = inlineArrayElement(walk.program, walk.table, node)
    if (elem === "") {
      return
    }
    this.add(`ue:${elem}`, node)
    if (node.kind === N_MEMBER) {
      const root = referenceRoot(node)
      if (root !== "") {
        this.add(`ur:${root}`, node)
      }
    }
  }

  /**
   * Index a write to a field of a record: `r.x = e`, `r.x += e`, `r.x++`. Only
   * the record's own fields count: `p.inner.x = 1` writes a record the field
   * points to, which the copy shares natively too. The write is filed under
   * the record's binding, or for `ps[i].x` under the array's name and type.
   */
  indexWrite(node: Node): void {
    const writes =
      (node.kind === N_BINARY && isAssignmentOperator(node.text)) ||
      (node.kind === N_UNARY && (node.text === "++" || node.text === "--"))
    if (!writes || unwrapParens(node.children[0]).kind !== N_MEMBER) {
      return
    }
    const walk = this.walk
    const record = writtenRecord(node)
    if (record.kind === N_IDENT) {
      const local = walk.program.nodeLocals[record.id]
      if (local !== null) {
        this.add(`wl:${local.name}`, node)
      }
      return
    }
    if (record.kind !== N_INDEX) {
      return
    }
    const array = unwrapParens(record.children[0])
    const side = this.sideOf(array)
    if (side !== null) {
      this.add(`w${side.key}`, node)
    }
    const elem = inlineArrayElement(walk.program, walk.table, array)
    if (elem !== "" && (side === null || side.elem === "")) {
      this.add(`we:${elem}`, node)
    }
  }

  /** Every node under `node`, once, into the copies and the buckets. */
  index(node: Node): void {
    if (node.kind === N_ARROW) {
      return
    }
    this.indexCopy(node)
    this.indexUse(node)
    this.indexWrite(node)
    if (node.kind === N_VAR_DECL) {
      const local = this.walk.program.nodeLocals[node.id]
      if (local !== null) {
        this.add(`d:${local.name}`, node)
      }
    }
    for (const child of node.children) {
      this.index(child)
    }
  }

  /** Where `local` is declared in the body, or `null` for a parameter. */
  declarationOf(local: Local): Node | null {
    for (const decl of this.at(`d:${local.name}`)) {
      const declared = this.walk.program.nodeLocals[decl.id]
      if (declared !== null && declared === local) {
        return decl
      }
    }
    return null
  }

  /** The last use of `side` in the source, or `null`: a scan back to the first that names it. */
  lastUse(side: Side): Node | null {
    const uses = this.at(`u${side.key}`)
    let j = uses.length - 1
    while (j >= 0) {
      const use = uses[j]
      if (side.names(this.walk, use)) {
        return use
      }
      j = j - 1
    }
    return null
  }

  /**
   * Where a write stops being able to reach a read of `side`: the end of its
   * last use, or of the loop around that use that runs it again with the
   * record `decl` declares. A write that starts there or later has no read
   * of `side` after it, since a loop that could carry it back to one would
   * contain that last use too. -1 when `side` is never used.
   */
  readLimit(side: Side, decl: Node | null): i32 {
    const last = this.lastUse(side)
    if (last === null) {
      return -1
    }
    const loop = repeatingLoop(this.walk, last, decl)
    return loop !== null ? loop.end : last.end
  }

  /**
   * Whether a use of `side` runs after `write`, whose `repeatingLoop` is
   * `loop`: the last use in the source is after it, or some use is inside the
   * loop. The bucket is in source order, so the first is a scan back to the
   * last use that names the side, and the second a binary search to the
   * loop's first node.
   */
  readAfter(side: Side, write: Node, loop: Node | null): boolean {
    const last = this.lastUse(side)
    if (last !== null && last.start >= write.end) {
      return true
    }
    if (loop === null) {
      return false
    }
    const uses = this.at(`u${side.key}`)
    let low = firstFrom(uses, loop.start)
    while (low >= 0 && low < uses.length) {
      const use = uses[low]
      if (use.start >= loop.end) {
        return false
      }
      if (side.names(this.walk, use)) {
        return true
      }
      low = low + 1
    }
    return false
  }
}

/** The index of the first of `nodes`, which are in source order, that starts at or after `start`. */
const firstFrom = (nodes: Node[], start: i32): i32 => {
  let low = 0
  let high = nodes.length
  while (low < high) {
    const mid = low + ((high - low) >> 1)
    if (mid < 0 || mid >= nodes.length) {
      break
    }
    if (nodes[mid].start < start) {
      low = mid + 1
    } else {
      high = mid
    }
  }
  return low
}

/** The record a field write writes into: `p` of `p.x = 1`, `ps[i]` of `ps[i].x = 1`. */
const writtenRecord = (write: Node): Node => unwrapParens(unwrapParens(write.children[0]).children[0])

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
 * Who does not see `write` after `copy`: a write to `p` unseen by the array,
 * a write through `ps[i]` unseen by `p`, or, when `p` went into the array
 * twice, unseen by its other copy there; `SEEN_BY_NONE` when the other side is
 * not read after the write, or the write is not to either side.
 */
const unseenBy = (
  index: RecordIndex,
  copy: CopySite,
  source: Side,
  write: Node,
  decl: Node | null,
  twice: boolean
): i32 => {
  const walk = index.walk
  const record = writtenRecord(write)
  const loop = repeatingLoop(walk, write, decl)
  if (namesLocal(walk, record, copy.local)) {
    return index.readAfter(copy.into, write, loop) ? SEEN_BY_ARRAY : SEEN_BY_NONE
  }
  if (record.kind !== N_INDEX || !copy.into.names(walk, unwrapParens(record.children[0]))) {
    return SEEN_BY_NONE
  }
  if (index.readAfter(source, write, loop)) {
    return SEEN_BY_SOURCE
  }
  return twice && index.readAfter(copy.into, write, loop) ? SEEN_BY_OTHER_COPY : SEEN_BY_NONE
}

/** The first of `writes`, in source order, that runs after `copy` and goes unseen by its other side. */
const firstUnseen = (
  index: RecordIndex,
  copy: CopySite,
  source: Side,
  writes: Node[],
  decl: Node | null,
  copyLoop: Node | null,
  twice: boolean,
  limit: i32
): Node | null => {
  // Nothing before the copy (or before its loop) runs after it, and nothing
  // from `limit` on has a read of the other side after it.
  let i = firstFrom(writes, copyLoop !== null ? copyLoop.start : copy.source.end)
  while (i >= 0 && i < writes.length) {
    const write = writes[i]
    if (write.start >= limit) {
      return null
    }
    if (
      runsAfter(copy.source, write, copyLoop) &&
      unseenBy(index, copy, source, write, decl, twice) !== SEEN_BY_NONE
    ) {
      return write
    }
    i = i + 1
  }
  return null
}

/**
 * NL8003. A binding `p` copied into an array `ps` of records, then one of the
 * two written and the other read afterwards: natively the write stays on its
 * own side of the copy, and in TypeScript both names are one object. A write
 * through `ps[i].x` counts as a write to the array's copy whichever slot `i`
 * is; when `p` went into `ps` twice (`[p, p]`), a read of `ps` after it is a
 * read of the other copy too. Each copy is reported once, at its first such
 * write.
 *
 * The candidate writes are the two buckets the copy's sides name, and the
 * earlier of the first each gives is reported, so the work is the size of
 * those buckets and not the body's.
 */
const copyFindings = (walk: PortabilityWalk, aliased: StringSet, out: PortabilityFinding[]): void => {
  const index = new RecordIndex(walk, aliased)
  index.index(walk.body)
  for (const copy of index.copies) {
    const decl = index.declarationOf(copy.local)
    const copyLoop = repeatingLoop(walk, copy.source, decl)
    const source = new Side(copy.local, "", "", copy.source)
    const twice = index.copyCounts.get(`${copy.local.name}|${copy.into.key}`, 0) > 1
    // A write to `p` is unseen only if the array is read after it; one through
    // the array, only if `p` is (or, for `[p, p]`, the array again).
    const intoLimit = index.readLimit(copy.into, decl)
    let throughLimit = index.readLimit(source, decl)
    if (twice && intoLimit > throughLimit) {
      throughLimit = intoLimit
    }
    const ownWrites = index.at(`wl:${copy.local.name}`)
    const own = firstUnseen(index, copy, source, ownWrites, decl, copyLoop, twice, intoLimit)
    const throughWrites = index.at(`w${copy.into.key}`)
    const through = firstUnseen(index, copy, source, throughWrites, decl, copyLoop, twice, throughLimit)
    let write = own
    if (write === null || (through !== null && through.start < write.start)) {
      write = through
    }
    if (write !== null) {
      out.push(copyFinding(walk, copy, write, unseenBy(index, copy, source, write, decl, twice)))
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
 * are the ones `src/arrays.ts` tracks for `reject_arr_element_across_push`,
 * less a `pop()` reference, whose dropped slot no in-bounds store reaches.
 */
const overwriteFindings = (walk: PortabilityWalk, aliased: StringSet, out: PortabilityFinding[]): void => {
  for (const found of slotOverwrites(walk.program, walk.table, walk.body, aliased)) {
    out.push(overwriteFinding(walk, found))
  }
}
