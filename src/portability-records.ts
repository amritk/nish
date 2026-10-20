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
// is then seen as one through `ps`. A record under a second name is followed
// instead: `const q = p` makes `q` one more spelling of `p` (`RecordIndex.canonical`).
//
// A call is a write too when the function it reaches may write or keep what
// it is handed (`CalleeEffects`): `setFirst(ps)` that writes `xs[0].v`, or
// `add(ps, p)` that pushes `r` into `xs` and so copies `p` into `ps`.

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
  N_CALL,
  N_DO,
  N_FOR,
  N_FOR_OF,
  N_IDENT,
  N_INDEX,
  N_MEMBER,
  N_NEW,
  N_PARAM,
  N_PAREN,
  N_UNARY,
  N_VAR_DECL,
  N_WHILE,
  Node,
} from "./nodes"
import { StringMap, StringSet } from "./map"
import { PortabilityFinding, PortabilityWalk } from "./portability"
import { CheckedProgram, capturedReads, FunctionSig, inlineElementStruct, ROLE_FUNCTION } from "./program"
import { Local, sourceLocal } from "./symbols"
import { TypeTable } from "./types"

/**
 * The records rows, asked about one node at a time.
 *
 * `src/portability.ts` calls this once for every node of every checked
 * function body, in source order, after NL8005 and before the next row
 * module; an arrow argument's body is handed over under its own function
 * rather than inside its parent's, though a name it captures (WP29) is read
 * as the parent's local. `walk` carries the facts
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
  names(index: RecordIndex, node: Node): boolean {
    const walk = index.walk
    const local = this.local
    if (local !== null) {
      return namesLocal(index, node, local)
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

/** Whether `node` is a use of the binding `local`, under its own name or a `const` alias's. */
const namesLocal = (index: RecordIndex, node: Node, local: Local): boolean => {
  const bound = index.bindingOf(node)
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
  /** `const q = p` of a record: `aliasFrom[i]` is `q`, `aliasTo[i]` the binding `p` it spells. */
  aliasFrom: Local[]
  aliasTo: Local[]
  effects: CalleeEffects

  constructor(walk: PortabilityWalk, aliased: StringSet) {
    this.walk = walk
    this.aliased = aliased
    this.keys = new StringMap()
    this.lists = []
    this.empty = []
    this.copies = []
    this.copyCounts = new StringMap()
    this.aliasFrom = []
    this.aliasTo = []
    this.effects = new CalleeEffects(walk.program, walk.table)
  }

  /** The binding `local` spells: itself, or for a `const` alias of a record, the record it was set to. */
  canonical(local: Local | null): Local | null {
    if (local === null) {
      return null
    }
    const at = this.aliasFrom.indexOf(local)
    return at < 0 ? local : this.aliasTo[at]
  }

  /** The binding an identifier names, a capture read as its host's local and an alias as its record. */
  bindingOf(node: Node): Local | null {
    return this.canonical(sourceLocal(this.walk.program.nodeLocals[node.id]))
  }

  /**
   * `const q = p` of a record makes `q` another name of `p`'s object, in
   * TypeScript and natively alike, so its uses and writes are filed as
   * `p`'s. Only a `const` is followed: a `let` may be set to another record
   * later, and from then on writing it is not writing `p`.
   */
  indexAlias(decl: Node, local: Local): void {
    const walk = this.walk
    const init = unwrapParens(decl.children[2])
    if (
      local.mutable ||
      init.kind !== N_IDENT ||
      inlineElementStruct(walk.program, walk.table, local.type) === null
    ) {
      return
    }
    const target = this.bindingOf(init)
    if (target !== null && target !== local) {
      this.aliasFrom.push(local)
      this.aliasTo.push(target)
    }
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
      const local = sourceLocal(this.walk.program.nodeLocals[inner.id])
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
    const local = this.canonical(this.walk.program.nodeLocals[source.id])
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
      const local = this.bindingOf(node)
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
    const record = writtenRecord(node)
    if (record.kind === N_IDENT) {
      const local = this.canonical(this.walk.program.nodeLocals[record.id])
      if (local !== null) {
        this.add(`wl:${local.name}`, node)
      }
      return
    }
    if (record.kind === N_INDEX) {
      this.addArrayWrite(node, unwrapParens(record.children[0]))
    }
  }

  /** File `write` as a write through the array `array` names: under its name and its element type. */
  addArrayWrite(write: Node, array: Node): void {
    const walk = this.walk
    const side = this.sideOf(array)
    if (side !== null) {
      this.add(`w${side.key}`, write)
    }
    const elem = inlineArrayElement(walk.program, walk.table, array)
    if (elem !== "" && (side === null || side.elem === "")) {
      this.add(`we:${elem}`, write)
    }
  }

  /**
   * Index a call, or a `new`, by what the function it reaches does with each
   * argument (`CalleeEffects`). A record it may write is a write to that
   * record's binding; an array of records it may write or keep, or the
   * element `ps[i]` it may write, a write through that array; and a record
   * it may copy, handed over with an array of records it may store into, a copy
   * into that array, as `add(ps, p)` is when `add` pushes one into the other.
   */
  indexCall(node: Node): void {
    const walk = this.walk
    if (isPushCall(walk.program, walk.table, node)) {
      return
    }
    const args = callArguments(node)
    let j = 0
    while (j < args.length) {
      const arg = unwrapParens(args[j])
      const effect = this.argumentEffectOf(node, arg, j)
      if ((effect & EFFECT_WRITE) !== 0 && arg.kind === N_IDENT) {
        const local = this.bindingOf(arg)
        if (local !== null) {
          this.add(`wl:${local.name}`, node)
        }
      }
      if (writesThroughArgument(walk, arg, effect)) {
        this.addArrayWrite(node, arrayOfArgument(walk, arg))
      }
      if ((effect & EFFECT_COPY) !== 0 && arg.kind === N_IDENT) {
        let k = 0
        while (k < args.length) {
          const into = unwrapParens(args[k])
          if (
            k !== j &&
            copiesInto(walk, arg, into) &&
            (this.argumentEffectOf(node, into, k) & EFFECT_STORE) !== 0
          ) {
            this.addCopy(arg, this.sideOf(into))
          }
          k = k + 1
        }
      }
      j = j + 1
    }
  }

  /**
   * What the call `node` may do with its argument `j`, asked only of an
   * argument this row follows — a record, an array of records or one of its
   * elements — so the callee is read only for a call that hands one over.
   */
  argumentEffectOf(node: Node, arg: Node, j: i32): i32 {
    const walk = this.walk
    if (!isRecordValue(walk, arg) && !storesInlineElements(walk.program, walk.table, arg)) {
      return 0
    }
    return this.effects.argument(
      walk.program.nodeCallees,
      walk.program.nodeTypes,
      walk.program.nodeCoercions,
      node,
      j
    )
  }

  /**
   * Every node under `node`, once, into the copies and the buckets. An arrow
   * is a function of its own, except that one handed to a data-parallel form
   * may read this body's `const` locals (WP29): its uses are filed here too,
   * where the call runs them, and nothing else of it is.
   */
  index(node: Node): void {
    if (node.kind === N_ARROW) {
      const reads: Node[] = []
      capturedReads(this.walk.program, node, reads)
      if (reads.length > 0) {
        this.indexArrowUses(node)
      }
      return
    }
    this.indexCopy(node)
    this.indexUse(node)
    this.indexWrite(node)
    if (node.kind === N_CALL || node.kind === N_NEW) {
      this.indexCall(node)
    }
    if (node.kind === N_VAR_DECL) {
      const local = this.walk.program.nodeLocals[node.id]
      if (local !== null) {
        this.add(`d:${local.name}`, node)
        this.indexAlias(node, local)
      }
    }
    for (const child of node.children) {
      this.index(child)
    }
  }

  /** The uses under a capturing arrow: it reads, and cannot write, what it captures. */
  indexArrowUses(node: Node): void {
    this.indexUse(node)
    for (const child of node.children) {
      this.indexArrowUses(child)
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
      if (side.names(this, use)) {
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
      if (side.names(this, use)) {
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
  const loop = repeatingLoop(index.walk, write, decl)
  if (writesRecordLocal(index, write, copy.local)) {
    return index.readAfter(copy.into, write, loop) ? SEEN_BY_ARRAY : SEEN_BY_NONE
  }
  if (!writesThrough(index, write, copy.into)) {
    return SEEN_BY_NONE
  }
  if (index.readAfter(source, write, loop)) {
    return SEEN_BY_SOURCE
  }
  return twice && index.readAfter(copy.into, write, loop) ? SEEN_BY_OTHER_COPY : SEEN_BY_NONE
}

/** Whether `write`, a field write or a call `RecordIndex` filed as one, writes the record `local` names. */
const writesRecordLocal = (index: RecordIndex, write: Node, local: Local): boolean => {
  if (write.kind !== N_CALL && write.kind !== N_NEW) {
    return namesLocal(index, writtenRecord(write), local)
  }
  const args = callArguments(write)
  let j = 0
  while (j < args.length) {
    const arg = unwrapParens(args[j])
    if (namesLocal(index, arg, local) && (index.argumentEffectOf(write, arg, j) & EFFECT_WRITE) !== 0) {
      return true
    }
    j = j + 1
  }
  return false
}

/** Whether `write`, a field write or a call `RecordIndex` filed as one, writes through the array `side`. */
const writesThrough = (index: RecordIndex, write: Node, side: Side): boolean => {
  if (write.kind !== N_CALL && write.kind !== N_NEW) {
    const record = writtenRecord(write)
    return record.kind === N_INDEX && side.names(index, unwrapParens(record.children[0]))
  }
  const walk = index.walk
  const args = callArguments(write)
  let j = 0
  while (j < args.length) {
    const arg = unwrapParens(args[j])
    if (
      writesThroughArgument(walk, arg, index.argumentEffectOf(write, arg, j)) &&
      side.names(index, arrayOfArgument(walk, arg))
    ) {
      return true
    }
    j = j + 1
  }
  return false
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

// ---- What a callee does with its arguments -------------------------------------

/** What a function may do with a record, or an array of records, it is handed. */
const EFFECT_WRITE: i32 = 1
/** It may copy it into an array, or for an array, keep it where a later write is not seen. */
const EFFECT_COPY: i32 = 2
/** For an array, it may store a record into it: push one, or put one in a slot. */
const EFFECT_STORE: i32 = 4
/** Anything: it is kept, returned, handed on to a function not read, or the callee is not read. */
const EFFECT_ANY: i32 = 7

/** How many functions deep `CalleeEffects.parameter` follows an argument before it gives up. */
const EFFECT_DEPTH: i32 = 8

/** The arguments of a call or a `new`. */
const callArguments = (call: Node): Node[] =>
  call.kind === N_NEW ? call.children[2].children : call.children[1].children

/** Whether `expr` is a record this row follows: a binding of one, or an element `ps[i]`. */
const isRecordValue = (walk: PortabilityWalk, expr: Node): boolean =>
  (expr.kind === N_IDENT || expr.kind === N_INDEX) &&
  inlineElementStruct(walk.program, walk.table, walk.program.nodeTypes[expr.id]) !== null

/** Whether handing `arg` over with `effect` writes through an array: the array itself, or an element `ps[i]` written. */
const writesThroughArgument = (walk: PortabilityWalk, arg: Node, effect: i32): boolean => {
  if ((effect & (EFFECT_WRITE | EFFECT_COPY)) === 0) {
    return false
  }
  if (arg.kind === N_INDEX) {
    return (effect & EFFECT_WRITE) !== 0 && storesInlineElements(walk.program, walk.table, arg.children[0])
  }
  return storesInlineElements(walk.program, walk.table, arg)
}

/** The array an argument `writesThroughArgument` reaches: `ps` of `ps[i]`, or the argument itself. */
const arrayOfArgument = (walk: PortabilityWalk, arg: Node): Node =>
  arg.kind === N_INDEX && storesInlineElements(walk.program, walk.table, arg.children[0])
    ? unwrapParens(arg.children[0])
    : arg

/** Whether the record binding `record` can be copied into the array `array`: its elements are that record. */
const copiesInto = (walk: PortabilityWalk, record: Node, array: Node): boolean => {
  const program = walk.program
  if (record.kind !== N_IDENT || !storesInlineElements(program, walk.table, array)) {
    return false
  }
  return walk.table.refOf(program.nodeTypes[array.id]) === program.nodeTypes[record.id]
}

/** Whether `node` is the identifier `name`, under any parentheses. */
const namesParameter = (node: Node, name: string): boolean => {
  const inner = unwrapParens(node)
  return inner.kind === N_IDENT && inner.text === name
}

/** Whether `n` declares `name` again: a variable, or a parameter of an arrow inside it. */
const redeclares = (n: Node, name: string): boolean => {
  if ((n.kind === N_VAR_DECL || n.kind === N_PARAM) && namesParameter(n.children[0], name)) {
    return true
  }
  for (const child of n.children) {
    if (redeclares(child, name)) {
      return true
    }
  }
  return false
}

/** Whether `name` appears anywhere in `n`. */
const mentionsIdent = (n: Node, name: string): boolean => {
  if (n.kind === N_IDENT && n.text === name) {
    return true
  }
  for (const child of n.children) {
    if (mentionsIdent(child, name)) {
      return true
    }
  }
  return false
}

/**
 * What a function does with each argument, read from its body, so that a
 * write or a copy done inside a helper (#620) is one NL8003 sees at the
 * call. A body is read when this module defines it as a plain declaration —
 * not a generic instance, whose tables are its own, not an arrow lifted out
 * of a call, not a `declare` — and any other callee may do anything with what
 * it is handed (`EFFECT_ANY`), as may a call through a function value or a
 * builtin this does not know. The parameter is followed by name, so a body
 * that declares the name again is not read. A recursion is read once, and
 * `assumed` counts the answers that rested on that, as `keepsParameter` in
 * `src/bounds.ts` does: only an answer with none is remembered.
 */
class CalleeEffects {
  program: CheckedProgram
  table: TypeTable
  /** `symbol#k` to the effect plus one, for each parameter answered without an assumption. */
  known: StringMap
  visiting: string[]
  assumed: i32

  constructor(program: CheckedProgram, table: TypeTable) {
    this.program = program
    this.table = table
    this.known = new StringMap()
    this.visiting = []
    this.assumed = 0
  }

  /**
   * What the call or `new` `call` may do with its argument `j`, read with the
   * side tables its body was checked into: the walk's own for the body being
   * walked, the module's for a callee's.
   */
  argument(callees: (FunctionSig | null)[], types: i32[], coercions: i32[], call: Node, j: i32): i32 {
    let sig: FunctionSig | null = null
    if (call.kind === N_CALL) {
      sig = callees[call.id]
      if (sig === null) {
        return builtinEffect(call)
      }
    } else {
      // The class named, not an interface it converts to, as `emitNew` asks.
      const coerced = coercions[call.id]
      const type = coerced >= 0 ? coerced : types[call.id]
      if (type >= 0 && this.table.isStruct(type)) {
        const info = this.program.struct(this.table.nameOf(type))
        if (info !== null) {
          sig = info.ctor
        }
      }
    }
    if (sig === null) {
      return EFFECT_ANY
    }
    return this.parameter(sig, sig.role === ROLE_FUNCTION ? j : j + 1)
  }

  /** What `sig` may do with its parameter `k`. */
  parameter(sig: FunctionSig, k: i32): i32 {
    const program = this.program
    const body = sig.body()
    if (
      body === null ||
      !sig.definedIn(program.source) ||
      sig.instance !== null ||
      sig.lifted ||
      sig.foreign() ||
      k >= sig.paramNames.length
    ) {
      return EFFECT_ANY
    }
    const key = `${sig.name}#${k}`
    const known = this.known.get(key, 0)
    if (known > 0) {
      return known - 1
    }
    if (this.visiting.indexOf(key) >= 0) {
      this.assumed = this.assumed + 1
      return 0
    }
    if (this.visiting.length >= EFFECT_DEPTH) {
      this.assumed = this.assumed + 1
      return EFFECT_ANY
    }
    const name = sig.paramNames[k]
    const before = this.assumed
    let effect = EFFECT_ANY
    if (!redeclares(body, name)) {
      this.visiting.push(key)
      effect = this.uses(body, name)
      this.visiting.pop()
    }
    if (this.assumed === before) {
      this.known.set(key, effect + 1)
    }
    return effect
  }

  /**
   * What the uses of the parameter `name` in `n` may do with it. Reading a
   * field, or the length, does nothing; writing a field (`x.v = 1`,
   * `x[i].v += 1`) writes it; pushing it, or putting it in a literal, copies
   * it; storing a slot of it (`x[i] = r`) or pushing into it stores into it. Handed to a call, it is what that callee does with it.
   * Any other use — returned, stored in a field, bound to another name,
   * captured by an arrow, a method of it called — may be anything.
   */
  uses(n: Node, name: string): i32 {
    if (n.kind === N_IDENT) {
      return n.text === name ? EFFECT_ANY : 0
    }
    if (n.kind === N_ARROW) {
      return mentionsIdent(n, name) ? EFFECT_ANY : 0
    }
    const writes =
      (n.kind === N_BINARY && isAssignmentOperator(n.text)) ||
      (n.kind === N_UNARY && (n.text === "++" || n.text === "--"))
    if (writes) {
      const target = unwrapParens(n.children[0])
      const value = n.kind === N_BINARY ? this.uses(n.children[1], name) : 0
      if (target.kind === N_MEMBER) {
        const record = unwrapParens(target.children[0])
        if (namesParameter(record, name)) {
          return EFFECT_WRITE | value
        }
        if (record.kind === N_INDEX && namesParameter(record.children[0], name)) {
          return EFFECT_WRITE | this.uses(record.children[1], name) | value
        }
      }
      if (target.kind === N_INDEX && namesParameter(target.children[0], name)) {
        return EFFECT_STORE | this.uses(target.children[1], name) | value
      }
    }
    if (n.kind === N_MEMBER && namesParameter(n.children[0], name)) {
      return 0
    }
    if (
      n.kind === N_MEMBER &&
      n.children[0].kind === N_INDEX &&
      namesParameter(n.children[0].children[0], name)
    ) {
      return this.uses(n.children[0].children[1], name)
    }
    if (n.kind === N_ARRAY) {
      let effect = 0
      for (const element of n.children) {
        effect = effect | (namesParameter(element, name) ? EFFECT_COPY : this.uses(element, name))
      }
      return effect
    }
    if (n.kind === N_CALL || n.kind === N_NEW) {
      return this.callUses(n, name)
    }
    let effect = 0
    for (const child of n.children) {
      effect = effect | this.uses(child, name)
    }
    return effect
  }

  /** `uses` for a call or a `new`: `x.push(...)`, and `x` handed to the callee as an argument. */
  callUses(call: Node, name: string): i32 {
    const callee = call.children[0]
    let effect = 0
    if (call.kind === N_CALL && callee.kind === N_MEMBER) {
      const receiver = unwrapParens(callee.children[0])
      if (namesParameter(receiver, name) && callee.text === "push") {
        effect = EFFECT_STORE
      } else {
        effect = this.uses(receiver, name)
      }
    } else {
      effect = this.uses(callee, name)
    }
    const program = this.program
    const outside = program.activeInstance !== null
    const callees = outside ? program.savedNodeCallees : program.nodeCallees
    const types = outside ? program.savedNodeTypes : program.nodeTypes
    const coercions = outside ? program.savedNodeCoercions : program.nodeCoercions
    const args = callArguments(call)
    let j = 0
    while (j < args.length) {
      const arg = args[j]
      effect =
        effect |
        (namesParameter(arg, name) ? this.argument(callees, types, coercions, call, j) : this.uses(arg, name))
      j = j + 1
    }
    return effect
  }
}

/**
 * What a call no function of the program answers for does with its
 * arguments: an array method that only reads them (`ps.indexOf(p)`) nothing,
 * one that stores them (`push`, `fill`, `set`) copies them, and any other
 * builtin, or a function value, may do anything.
 */
const builtinEffect = (call: Node): i32 => {
  const callee = call.children[0]
  if (callee.kind !== N_MEMBER) {
    return EFFECT_ANY
  }
  const method = callee.text
  if (method === "indexOf" || method === "lastIndexOf" || method === "includes" || method === "join") {
    return 0
  }
  return method === "push" || method === "fill" || method === "set" ? EFFECT_COPY : EFFECT_ANY
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
