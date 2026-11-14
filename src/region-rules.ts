// `nish:region`'s rules (docs/LANGUAGE.md, "Regions"): what the function a
// `region`, `regionWith`, `enter` or `enterWith` runs may do while the region
// is the thread's arena, and where a `Region` handle may travel. They ask the
// whole-program facts, so `Compilation.checkRegions` runs them once those
// exist, as it does `nish:secret`'s.
//
// Inside `f` there are two kinds of memory. Region memory is the root `enter`
// hands `f` and whatever `f` allocates; outer memory is what `arg` reaches.
// Nothing else is reachable: an arrow `f` captures nothing (NL2335), and a
// module-level binding holds only a number, a boolean or a string literal,
// which no rule here has to follow. The walk gives every expression one of
// the origins below and refuses a store that mixes them: region memory kept
// by outer memory dangles once `free` runs, and outer memory kept by region
// memory dangles once the scope that owns it is released while the region
// lives on. A callee is judged by its facts (`PointerParamFacts`), never by
// its body.

import { FactsTable, FunctionFacts, PointerParamFacts, isResizeCall } from "./attributes"
import {
  arrayMethodName,
  builtinNameOf,
  isAssignmentOperator,
  methodReceiver,
  unwrapParens,
} from "./emit-util"
import { isScalarArgument } from "./escape"
import { StringSet } from "./map"
import { Node, NodeKind } from "./nodes"
import { capturesOf, isThreadsLayout } from "./parallel"
import { CheckedProgram, FunctionSig, ParallelCall } from "./program"
import { FreshResults } from "./secret"
import {
  REGION_CHILD,
  REGION_CHILD_WITH,
  REGION_ENTER,
  REGION_ENTER_WITH,
  REGION_MAKE,
  REGION_MAKE_WITH,
  REGION_NONE,
  isChildMaker,
  isRegionMaker,
  regionRoleOf,
} from "./region-check"
import { Local, STORAGE_PARAM, sourceLocal } from "./symbols"
import { T_BOOL, T_CPTR, T_STRING, TypeTable, isNumeric } from "./types"

/** Not yet known: the walk has not reached a binding's value. Joins as nothing. */
const ORIGIN_NONE: i32 = -1
/** A number, a boolean, an enum, a `Region` handle, a string literal or `null`: copied, never pointed at. */
const ORIGIN_SCALAR: i32 = 0
/** Region memory: memory `f` allocated, or the root's reach once it may be that. */
const ORIGIN_REGION: i32 = 1
/** Memory `arg` reaches. */
const ORIGIN_OUTER: i32 = 2
/** Either, as far as the walk can tell. */
const ORIGIN_UNKNOWN: i32 = 3
/**
 * Region memory the root `enter` hands `f` reaches: it existed before this
 * `enter`, so no scope opened in it can release it, and a child region made
 * here may keep it. Otherwise it is `ORIGIN_REGION`, which it joins to.
 */
const ORIGIN_ROOT: i32 = 4
/**
 * In a child's `f`, the parent's memory `childWith`'s `arg` reaches. It
 * outlives the region, so region memory may keep it, but it may keep no
 * region memory and may not grow.
 */
const ORIGIN_PARENT: i32 = 5
/**
 * In a child's `f`, a value that is region memory or the parent's: the region
 * may keep it, but it may keep no region memory and may not grow.
 */
const ORIGIN_MIXED: i32 = 6
/**
 * In an `enter` of a handle that may be a child's, what its root reaches: the
 * child's memory or its ancestors'. Both existed before this `enter`, so a
 * child made here may keep it and region memory may keep it, but it may keep
 * no memory but an ancestor's, may not grow, and may not be stored outside.
 */
const ORIGIN_CHILD_ROOT: i32 = 7

/** Whether `o` is the region's memory or the parent's, in a child's `f`. */
const childOrParent = (o: i32): boolean =>
  o === ORIGIN_REGION || o === ORIGIN_PARENT || o === ORIGIN_MIXED || o === ORIGIN_CHILD_ROOT

/** The origin of a value that may be `a` or `b`. */
const joinOrigin = (a: i32, b: i32): i32 => {
  if (a === ORIGIN_NONE || a === ORIGIN_SCALAR) {
    return b === ORIGIN_NONE ? a : b
  }
  if (b === ORIGIN_NONE || b === ORIGIN_SCALAR || a === b) {
    return a
  }
  if ((a === ORIGIN_ROOT && b === ORIGIN_REGION) || (a === ORIGIN_REGION && b === ORIGIN_ROOT)) {
    return ORIGIN_REGION
  }
  return childOrParent(a) && childOrParent(b) ? ORIGIN_MIXED : ORIGIN_UNKNOWN
}

/** Whether a value of origin `o` may be memory outside the region: what may not grow, nor keep the region's. */
const mayBeOuter = (o: i32): boolean =>
  o === ORIGIN_OUTER ||
  o === ORIGIN_UNKNOWN ||
  o === ORIGIN_PARENT ||
  o === ORIGIN_MIXED ||
  o === ORIGIN_CHILD_ROOT

/** Whether a value of origin `o` may be outer memory region memory may not keep: any but the parent's. */
const mayBeReleased = (o: i32): boolean => o === ORIGIN_OUTER || o === ORIGIN_UNKNOWN

/** Whether a value of origin `o` may be region memory. */
const mayBeRegion = (o: i32): boolean =>
  o === ORIGIN_REGION ||
  o === ORIGIN_UNKNOWN ||
  o === ORIGIN_ROOT ||
  o === ORIGIN_MIXED ||
  o === ORIGIN_CHILD_ROOT

/**
 * Whether a holder or value of origin `o` may be memory the root reaches,
 * as it was before this `enter`: any region origin but `ORIGIN_REGION`,
 * memory `f` allocated, which the root reaches only once stored into it.
 */
const mayReachRoot = (o: i32): boolean => o !== ORIGIN_REGION && mayBeRegion(o)

/** Whether a value of origin `o` is memory a child region made here may keep: what the root reaches. */
const outlivesChild = (o: i32): boolean => o === ORIGIN_ROOT || o === ORIGIN_PARENT || o === ORIGIN_CHILD_ROOT

/** One refusal, at the node in `f`'s module it is about. */
export class RegionFinding {
  program: CheckedProgram
  node: Node
  message: string

  constructor(program: CheckedProgram, node: Node, message: string) {
    this.program = program
    this.node = node
    this.message = message
  }
}

/** How a message names `f`. */
const fnName = (fn: FunctionSig): string => `\`${fn.sourceName}\``

/** How a message names the callee `sig`. */
const regionCalleeName = (sig: FunctionSig): string => {
  const owner = sig.owner
  return owner !== null && sig.sourceName === "constructor"
    ? `the constructor of \`${owner.name}\``
    : `\`${sig.sourceName}\``
}

/** The source text of `node`, up to its first line break. */
const textOf = (program: CheckedProgram, node: Node): string => {
  const text = program.source.text.substring(node.start, node.end)
  const end = text.indexOf("\n")
  return end < 0 ? text : `${text.substring(0, end)} ...`
}

/** What a literal does, for a message: "puts `value` in a literal". */
const putsText = (program: CheckedProgram, value: Node): string =>
  `puts \`${textOf(program, value)}\` in a literal`

/** What a store does, for a message: "stores `value` into `target`". */
const storesText = (program: CheckedProgram, value: Node, target: Node): string =>
  `stores \`${textOf(program, value)}\` into \`${textOf(program, target)}\``

/** What handing `arg` to `callee` does, for a message: "hands `arg` to `f`, which ...". */
const handsText = (program: CheckedProgram, arg: Node, callee: string, which: string): string =>
  `hands \`${textOf(program, arg)}\` to ${callee}, ${which}`

/** How a message opens on a function a region runs: "`f` runs inside a region". */
const insideRegion = (fn: FunctionSig): string => `${fnName(fn)} runs inside a region`

/**
 * How a message opens on a spawned task (WP49 stage 5, part 3), which runs in
 * a region of its own and holds its object and array arguments outside it.
 */
const insideTask = (fn: FunctionSig): string =>
  `${fnName(fn)} runs as a spawned task, in a region of its own that is freed when it ends`

/** `who` opens the message (`insideRegion`), and `freed` says when the region goes. */
const regionToOuterMessage = (who: string, what: string, freed: string): string =>
  `${who}, and ${what}: region memory kept by memory outside the region points at freed memory once ${freed}; ` +
  "copy the numbers out instead"

const outerToRegionMessage = (who: string, what: string): string =>
  `${who}, and ${what}: memory outside a region kept by the region's memory ` +
  "may be released while the region still points at it; copy it into memory the region allocates instead"

/**
 * NL2610 in a task: what the task shares, kept in the task's own memory, is a
 * holder the walk does not follow, through which the task's memory could be
 * stored into what it shares.
 */
const taskKeepsOuterMessage = (who: string, what: string): string =>
  `${who}, and ${what}: memory outside a region kept by the region's memory ` +
  "may be released while the region still points at it, and lets the task store its own memory " +
  "into what it shares; read and update the shared object in place instead"

/** `regionToOuterMessage` for `arg` handed to `callee`. */
const handsRegionMessage = (
  who: string,
  freed: string,
  program: CheckedProgram,
  arg: Node,
  callee: string,
  which: string
): string => regionToOuterMessage(who, handsText(program, arg, callee, which), freed)

/** The first argument `spawnPiped` and `spawnPipedWithin` append to, their `stdout`; `stderr` follows. */
const SPAWN_PIPED_FIRST_GROWN: i32 = 2

/** `growthMessage` for `arg` handed to `callee`, which may grow it. */
const handsGrowthMessage = (who: string, program: CheckedProgram, arg: Node, callee: string): string =>
  growthMessage(who, handsText(program, arg, callee, "which may grow it"))

const enterResultMessage = (fn: FunctionSig, table: TypeTable): string =>
  `${fnName(fn)} answers \`${table.typeName(fn.returnType)}\`, and the function \`enter\` or \`enterWith\` runs ` +
  "may answer only a number, a `boolean`, an `enum` or a `Region`: anything else would point into the region " +
  "from outside it"

const threadsMessage = (fn: FunctionSig): string =>
  `${insideRegion(fn)}, and reaches \`scope()\`, \`spawn\`, a parallel body or a channel: ` +
  "another thread allocates from an arena of its own, not from the region"

export const crossingMessage = (table: TypeTable, what: string, type: i32): string =>
  `${what} is \`${table.typeName(type)}\`, which holds a \`Region\`, and a region is entered only on the thread that made it`

const notFreshMessage = (fn: FunctionSig, ref: string, child: boolean): string =>
  `The function ${child ? "`child` or `childWith`" : "`region` or `regionWith`"} runs answers the region's root, ` +
  `which must be memory it allocated, and ${fnName(fn)} may not: ${ref}`

/**
 * NL2702: a child region's parent is whichever region is entered when it is
 * made, which only the function `enter` or `enterWith` runs knows for certain.
 * `what` says how `child` or `childWith` is reached otherwise.
 */
const childPlacementMessage = (what: string): string =>
  `${what}: a child region's parent is the region entered when it is made, so \`child\` and \`childWith\` ` +
  "are called only in the function `enter` or `enterWith` runs, and that function only by them"

const growthMessage = (who: string, what: string): string =>
  `${who}, and ${what}: storage outside the region that grows inside it ` +
  "would move into the region and be freed with it"

const noFactsMessage = (who: string, callee: FunctionSig): string =>
  `${who}, and calls ${regionCalleeName(callee)}, which the region rules have no facts for`

const arenaStateMessage = (fn: FunctionSig): string =>
  `${insideRegion(fn)}, and reaches \`Arena.mark\` or \`Arena.used\`: ` +
  "inside a region they would read the region's own arena, not the thread's"

const nestedSpawnMessage = (task: FunctionSig): string =>
  `${insideTask(task)}, and spawns a task with an object or an array, itself or through a callee: ` +
  "what a task hands on may be memory of its own region, freed while the task it spawned still holds it"

/**
 * A spawned task handed an arrow that captures (WP29) what the task could not
 * share: the captures ride in the task's frame as hidden arguments, so one is
 * a number, a `boolean`, an enum, or an object or array a task may share
 * (`taskFindings`), never a `string` or anything else of the spawner's region.
 */
const captureSpawnMessage = (task: FunctionSig, local: string, type: string): string =>
  `\`spawn\` hands ${fnName(task)} an arrow that reads \`${local}\` of type ${type} of the function it is written in: ` +
  "a spawned task's function argument captures only numbers, booleans, enums and objects or arrays it may share, " +
  "because the task may run after that function returns; " +
  "pass the value to the task as an argument of its own, or hand it a top-level function"

/** A spawn argument that holds what the spawner's own rules end, at any depth (`taskShareObstacle`). */
const sharedResourceMessage = (task: FunctionSig, param: string, type: string, why: string): string =>
  `\`spawn\` hands ${fnName(task)} its parameter \`${param}\` of type ${type}, and ${why}: ` +
  "a task shares with its spawner only objects and arrays whose every part outlives the spawner's call; pass the task what it needs of it instead"

export const regionNewMessage = (): string =>
  "A `Region` is made by `region(f)` or `regionWith(arg, f)`, which run `f` in it, not by `new`"

/** Whether a value of `type` is copied rather than pointed at: what the rules never follow. */
const isCopied = (table: TypeTable, type: i32): boolean =>
  type >= 0 && (isScalarArgument(table, type) || table.isRegion(type))

/** Whether a value of `type` holds a `Region` at any depth: itself, an element, a field, an arm. */
export const holdsRegion = (programs: CheckedProgram[], table: TypeTable, type: i32): boolean =>
  holdsRegionIn(programs, table, type, [])

const holdsRegionIn = (programs: CheckedProgram[], table: TypeTable, type: i32, seen: i32[]): boolean => {
  if (type < 0 || seen.indexOf(type) >= 0) {
    return false
  }
  seen.push(type)
  if (table.isRegion(type)) {
    return true
  }
  if (table.isNullable(type)) {
    return holdsRegionIn(programs, table, table.stripNull(type), seen)
  }
  if (table.isArray(type)) {
    return holdsRegionIn(programs, table, table.refOf(type), seen)
  }
  if (table.isResult(type)) {
    return (
      holdsRegionIn(programs, table, table.okOf(type), seen) ||
      holdsRegionIn(programs, table, table.errOf(type), seen)
    )
  }
  if (table.isUnion(type)) {
    for (const variant of table.variantsOf(type)) {
      if (holdsRegionIn(programs, table, variant, seen)) {
        return true
      }
    }
    return false
  }
  if (!table.isStruct(type)) {
    return false
  }
  const name = table.nameOf(type)
  for (const program of programs) {
    const info = program.struct(name)
    if (info !== null) {
      for (const field of info.fields) {
        if (holdsRegionIn(programs, table, field.type, seen)) {
          return true
        }
      }
      return false
    }
  }
  return false
}

/**
 * Why a task may not share an argument of `type` with its spawner, or "" when
 * it may: what the argument holds at any depth, an element, a field or an arm,
 * that the spawner's own rules end when its call or block does. `seen` stops a
 * recursive class.
 */
const taskShareObstacle = (programs: CheckedProgram[], table: TypeTable, type: i32, seen: i32[]): string => {
  if (type < 0 || seen.indexOf(type) >= 0) {
    return ""
  }
  seen.push(type)
  if (table.isRegion(type)) {
    return "it holds a `Region`, which the frame that made it frees, perhaps while the task still waits"
  }
  if (table.isSecret(type)) {
    return "it holds a `Secret`, which its holder wipes, perhaps while the task still reads it"
  }
  if (table.isNullable(type)) {
    return taskShareObstacle(programs, table, table.stripNull(type), seen)
  }
  if (table.isArray(type)) {
    return taskShareObstacle(programs, table, table.refOf(type), seen)
  }
  if (table.isResult(type)) {
    const ok = taskShareObstacle(programs, table, table.okOf(type), seen)
    return ok.length > 0 ? ok : taskShareObstacle(programs, table, table.errOf(type), seen)
  }
  if (table.isUnion(type)) {
    for (const variant of table.variantsOf(type)) {
      const inner = taskShareObstacle(programs, table, variant, seen)
      if (inner.length > 0) {
        return inner
      }
    }
    return ""
  }
  if (!table.isStruct(type)) {
    return ""
  }
  const name = table.nameOf(type)
  for (const program of programs) {
    const info = program.struct(name)
    if (info === null) {
      continue
    }
    if (info.handle) {
      return `it is the handle class \`${info.name}\`, which the \`using\` block that opened it closes when the spawner leaves it, perhaps while the task still waits`
    }
    if (isThreadsLayout(info)) {
      return `it holds a \`${table.typeName(type)}\` of \`nish/threads\`, a scope, a lock, a guard or a channel, which is shared only by the rules of its own block`
    }
    for (const field of info.fields) {
      const inner = taskShareObstacle(programs, table, field.type, seen)
      if (inner.length > 0) {
        return inner
      }
    }
    return ""
  }
  return ""
}

/**
 * WP49 stage 5, part 8: whether a value of type `from` and one of type `into`
 * may reach the same memory: a string, array, object or union both hold at
 * some depth. Types are nominal but for `implements`, so an interface a class
 * implements, a struct no program defines, a foreign pointer and a region may
 * reach anything.
 */
const mayShareMemory = (programs: CheckedProgram[], table: TypeTable, from: i32, into: i32): boolean => {
  const fromTypes: i32[] = []
  const intoTypes: i32[] = []
  if (!heapTypesIn(programs, table, from, fromTypes) || !heapTypesIn(programs, table, into, intoTypes)) {
    return true
  }
  for (const type of fromTypes) {
    if (intoTypes.indexOf(type) >= 0) {
      return true
    }
  }
  return false
}

/** Adds to `out` the heap types a value of `type` reaches; false when it may reach any. */
const heapTypesIn = (programs: CheckedProgram[], table: TypeTable, type: i32, out: i32[]): boolean => {
  if (type < 0 || table.isRegion(type) || type === T_CPTR) {
    return false
  }
  if (out.indexOf(type) >= 0) {
    return true
  }
  if (table.isNullable(type)) {
    return heapTypesIn(programs, table, table.stripNull(type), out)
  }
  if (table.isMaybe(type)) {
    return heapTypesIn(programs, table, table.refOf(type), out)
  }
  if (table.isResult(type)) {
    return (
      heapTypesIn(programs, table, table.okOf(type), out) &&
      heapTypesIn(programs, table, table.errOf(type), out)
    )
  }
  if (type === T_STRING) {
    out.push(type)
    return true
  }
  if (table.isArray(type)) {
    out.push(type)
    return heapTypesIn(programs, table, table.refOf(type), out)
  }
  if (table.isUnion(type)) {
    out.push(type)
    for (const variant of table.variantsOf(type)) {
      if (!heapTypesIn(programs, table, variant, out)) {
        return false
      }
    }
    return true
  }
  if (!table.isStruct(type)) {
    return isScalarArgument(table, type)
  }
  out.push(type)
  const name = table.nameOf(type)
  for (const program of programs) {
    const info = program.struct(name)
    if (info !== null) {
      if (info.implemented || info.implementsNames.length > 0) {
        return false
      }
      for (const field of info.fields) {
        if (!heapTypesIn(programs, table, field.type, out)) {
          return false
        }
      }
      return true
    }
  }
  return false
}

/** The `NodeKind.Return` values of an arrow's block, not those of arrows nested in it. */
const collectArrowReturns = (node: Node, out: Node[]): void => {
  if (node.kind === NodeKind.Return) {
    if (node.children[0].kind !== NodeKind.Empty) {
      out.push(node.children[0])
    }
    return
  }
  if (node.kind === NodeKind.Arrow) {
    return
  }
  for (const child of node.children) {
    collectArrowReturns(child, out)
  }
}

/**
 * The walk of one `f`. `collect` runs until the locals' origins stop
 * changing, and the last run, with `collect` off, reports.
 */
class RegionWalk {
  program: CheckedProgram
  table: TypeTable
  facts: FactsTable
  fn: FunctionSig
  /** The callees `FreshResults` found to answer memory nothing else holds. */
  fresh: StringSet
  /** `f`'s parameters, by name, and the origin of each. */
  paramNames: string[]
  paramOrigins: i32[]
  /** The parameters of the arrows a builtin call in `f` runs, joined by name. */
  arrowNames: string[]
  arrowOrigins: i32[]
  locals: Local[]
  localOrigins: i32[]
  findings: RegionFinding[]
  /** How a message opens on `fn` (`insideRegion`, `insideTask`). */
  who: string
  /** When `fn`'s region is freed, for a message. */
  freed: string
  /** An `enter` walk's record of the child regions `fn` makes, or `null`. */
  sites: ChildSites | null
  /**
   * WP49 stage 5, part 8: the arrows the spawn handed the task that capture
   * its spawner's objects (`taskFindings`). A call that runs one may answer
   * what it captures, and the origins of the arguments the task hands one
   * directly, joined per parameter, seed the walk of its body; `indirect`
   * marks one some other callee of the task runs, whose arguments the walk
   * never sees.
   */
  spawnArrows: FunctionSig[]
  arrowArgs: i32[][]
  indirect: boolean[]
  /** Every module, for the types a call's answer may reach (`mayShareMemory`). */
  programs: CheckedProgram[]
  changed: boolean
  collect: boolean
  /**
   * WP49 stage 5, part 3: `fn` is a spawned task, not a region's function.
   * Its outside memory is what it shares with its spawner, which outlives it,
   * so only memory of its own region kept from outside is refused, and growth.
   */
  task: boolean
  /**
   * `fn` stores into, or hands a callee that writes into, memory the root
   * may reach, so what it reads off the root may be memory it allocated.
   * Flow-insensitive: the passes before the last one set it.
   */
  rootWritten: boolean
  /**
   * `fn` stores into, or hands a writing callee, memory it allocated, which
   * counts as `rootWritten` once `rootAliased` holds too.
   */
  freshWritten: boolean
  /**
   * `fn` puts memory the root reaches into memory it allocated (a store, a
   * literal, or a callee that keeps it), so a write to the latter may be a
   * write to what the root reaches.
   */
  rootAliased: boolean

  constructor(
    program: CheckedProgram,
    table: TypeTable,
    facts: FactsTable,
    fn: FunctionSig,
    fresh: StringSet,
    paramNames: string[],
    paramOrigins: i32[],
    task: boolean,
    sites: ChildSites | null
  ) {
    this.program = program
    this.table = table
    this.facts = facts
    this.fn = fn
    this.fresh = fresh
    this.paramNames = paramNames
    this.paramOrigins = paramOrigins
    this.arrowNames = []
    this.arrowOrigins = []
    this.locals = []
    this.localOrigins = []
    this.changed = false
    this.collect = true
    this.findings = []
    this.task = task
    this.sites = sites
    this.rootWritten = false
    this.freshWritten = false
    this.rootAliased = false
    this.spawnArrows = []
    this.arrowArgs = []
    this.indirect = []
    this.programs = []
    this.who = task ? insideTask(fn) : insideRegion(fn)
    this.freed = task ? "the task ends" : "`free` runs"
  }

  /** Memory outside the region, kept by the region's, at `node`, which `what` describes. */
  reportOuter(node: Node, what: string): void {
    this.report(
      node,
      this.task ? taskKeepsOuterMessage(this.who, what) : outerToRegionMessage(this.who, what)
    )
  }

  report(node: Node, message: string): void {
    if (this.collect) {
      return
    }
    for (const finding of this.findings) {
      if (finding.node === node && finding.message === message) {
        return
      }
    }
    this.findings.push(new RegionFinding(this.program, node, message))
  }

  bind(local: Local | null, origin: i32): void {
    if (local === null) {
      return
    }
    const at = this.locals.indexOf(local)
    if (at < 0) {
      this.locals.push(local)
      this.localOrigins.push(origin)
      this.changed = this.changed || origin !== ORIGIN_NONE
      return
    }
    const joined = this.join(this.localOrigins[at], origin)
    if (joined !== this.localOrigins[at]) {
      this.localOrigins[at] = joined
      this.changed = true
    }
  }

  bindArrowParam(name: string, origin: i32): void {
    const at = this.arrowNames.indexOf(name)
    if (at < 0) {
      this.arrowNames.push(name)
      this.arrowOrigins.push(origin)
      this.changed = true
      return
    }
    const joined = this.join(this.arrowOrigins[at], origin)
    if (joined !== this.arrowOrigins[at]) {
      this.arrowOrigins[at] = joined
      this.changed = true
    }
  }

  typeOf(node: Node): i32 {
    return this.program.nodeTypes[node.id]
  }

  origin(expr: Node): i32 {
    const e = unwrapParens(expr)
    if (isCopied(this.table, this.typeOf(e))) {
      return ORIGIN_SCALAR
    }
    const kind = e.kind
    if (kind === NodeKind.Null || kind === NodeKind.String || kind === NodeKind.TemplateText) {
      return ORIGIN_SCALAR
    }
    if (kind === NodeKind.Ident) {
      return this.identOrigin(e)
    }
    if (
      kind === NodeKind.Member ||
      kind === NodeKind.Index ||
      kind === NodeKind.As ||
      kind === NodeKind.Spread ||
      kind === NodeKind.Unary
    ) {
      return this.origin(e.children[0])
    }
    if (kind === NodeKind.New || kind === NodeKind.Array || kind === NodeKind.Object) {
      return ORIGIN_REGION
    }
    if (kind === NodeKind.Template) {
      // A new string; a substitution that is one already may come back as it is.
      let out = ORIGIN_REGION
      for (const part of e.children) {
        out = joinOrigin(out, this.origin(part))
      }
      return out
    }
    if (kind === NodeKind.Conditional) {
      return this.join(this.origin(e.children[1]), this.origin(e.children[2]))
    }
    if (kind === NodeKind.Binary) {
      if (isAssignmentOperator(e.text)) {
        return this.origin(e.children[1])
      }
      // `??`, `||` and `&&` answer an operand; `+` on strings a new string, or an operand.
      const left = this.origin(e.children[0])
      const right = this.origin(e.children[1])
      const either = e.text === "+" ? joinOrigin(left, right) : this.join(left, right)
      return e.text === "+" ? joinOrigin(ORIGIN_REGION, either) : either
    }
    if (kind === NodeKind.Call) {
      return this.callOrigin(e)
    }
    return ORIGIN_UNKNOWN
  }

  identOrigin(e: Node): i32 {
    // An arrow argument's capture is handed the value of the local it copies.
    const local = sourceLocal(this.program.nodeLocals[e.id])
    if (local === null) {
      // A module-level binding: a number, a boolean, a string literal or a function.
      return ORIGIN_SCALAR
    }
    const at = this.locals.indexOf(local)
    let out = at < 0 ? ORIGIN_NONE : this.localOrigins[at]
    if (local.storage !== STORAGE_PARAM) {
      // A task's local this walk never bound was bound some way it does not
      // follow: its value may be the task's own memory, so it is unknown.
      return at < 0 && this.task ? ORIGIN_UNKNOWN : out
    }
    let named = false
    const own = this.paramNames.indexOf(local.name)
    if (own >= 0) {
      out = this.join(out, this.paramOrigins[own])
      named = true
    }
    const nested = this.arrowNames.indexOf(local.name)
    if (nested >= 0) {
      out = this.join(out, this.arrowOrigins[nested])
      named = true
    }
    return named || out !== ORIGIN_NONE ? out : ORIGIN_UNKNOWN
  }

  /** The receiver of a method call and then its arguments: the values a callee is handed, in its parameters' order. */
  handedTo(call: Node, callee: FunctionSig | null): Node[] {
    const out: Node[] = []
    if (call.kind === NodeKind.New) {
      for (const arg of call.children[2].children) {
        out.push(arg)
      }
      return out
    }
    const receiver = methodReceiver(call)
    if (receiver !== null && (callee === null || callee.owner !== null)) {
      out.push(receiver)
    }
    for (const arg of call.children[1].children) {
      out.push(arg)
    }
    return out
  }

  callOrigin(call: Node): i32 {
    const callee = this.program.nodeCallees[call.id]
    if (callee !== null && regionRoleOf(callee) !== REGION_NONE) {
      // `enter` answers a scalar, `region` a handle: both copied, and typed so.
      return ORIGIN_UNKNOWN
    }
    if (callee !== null && this.fresh.has(callee.name) && (!this.task || this.typeOf(call) === T_STRING)) {
      return ORIGIN_REGION
    }
    // In a task, a fresh object may hold what it was handed (`wrap(shared)`
    // answers a new holder of the shared object), so its arguments join in,
    // and so do the spawner's objects an arrow it runs captures.
    let out = callee !== null && this.runsSpawnArrow(callee) ? ORIGIN_UNKNOWN : ORIGIN_REGION
    // An argument whose memory the answer's type cannot reach stays out
    // (`await pgAsyncQuery(pool, ...)` answers rows of the task's own).
    const answer = this.task && callee !== null && capturesOf(callee).length === 0 ? callee.returnType : -1
    for (const arg of this.handedTo(call, callee)) {
      const a = unwrapParens(arg)
      if (answer >= 0 && a.kind !== NodeKind.Arrow && !this.reaches(a, answer)) {
        continue
      }
      // What a callback answers may be what the call answers (`map`, `pick(() => a.node)`).
      out = this.joinHanded(out, a)
    }
    return out
  }

  /** Whether what `arg` points at may be reached from a value of type `answer`. */
  reaches(arg: Node, answer: i32): boolean {
    return mayShareMemory(this.programs, this.table, this.typeOf(arg), answer)
  }

  arrowResult(arrow: Node): i32 {
    const body = arrow.children[3]
    if (body.kind !== NodeKind.Block) {
      return this.origin(body)
    }
    const values: Node[] = []
    collectArrowReturns(body, values)
    let out = ORIGIN_SCALAR
    for (const value of values) {
      out = this.join(out, this.origin(value))
    }
    return out
  }

  /** Whether a call of `callee` may run an arrow of `spawnArrows`, itself or as an instance it was handed. */
  runsSpawnArrow(callee: FunctionSig): boolean {
    if (this.spawnArrows.length === 0) {
      return false
    }
    for (const slot of capturesOf(callee)) {
      if (this.spawnArrows.indexOf(slot.arrow) >= 0) {
        return true
      }
    }
    return false
  }

  /**
   * Notes a call of `callee` for the arrows of `spawnArrows` it may run: the
   * origins of `handed` for a direct call of one, `indirect` for any other.
   */
  noteSpawnArrows(callee: FunctionSig, handed: Node[]): void {
    if (this.spawnArrows.length === 0) {
      return
    }
    for (let a = 0; a < this.spawnArrows.length; a++) {
      const arrow = this.spawnArrows[a]
      if (callee === arrow) {
        const seen = this.arrowArgs[a]
        for (let i = 0; i < handed.length; i++) {
          // The origin is read before the bound is tested: a call between
          // the test and the store would leave the store unproven.
          const handedOrigin = this.origin(handed[i])
          if (i < seen.length) {
            seen[i] = this.join(seen[i], handedOrigin)
          }
        }
      } else if (!this.indirect[a]) {
        for (const slot of capturesOf(callee)) {
          if (slot.arrow === arrow) {
            this.indirect[a] = true
          }
        }
      }
    }
  }

  /**
   * A write into `holder`'s memory: memory the root reaches read back after
   * it is not known to have existed before `enter`.
   */
  noteWrite(holder: i32): void {
    if (mayReachRoot(holder)) {
      this.rootWritten = true
    } else if (holder === ORIGIN_REGION) {
      this.freshWritten = true
    }
  }

  /**
   * `value`, of origin `o`, is put where `fn`'s own memory may keep it. A
   * string has no slot to write through, so keeping one aliases nothing.
   */
  noteAlias(value: Node, o: i32): void {
    if (mayReachRoot(o) && this.typeOf(value) !== T_STRING) {
      this.rootAliased = true
    }
  }

  /**
   * `joinOrigin`, noting when memory the root may reach is folded into memory
   * new in this `enter`: a value that may be either is an alias of the root.
   */
  join(a: i32, b: i32): i32 {
    const out = joinOrigin(a, b)
    if (out === ORIGIN_REGION && (mayReachRoot(a) || mayReachRoot(b))) {
      this.rootAliased = true
    }
    return out
  }

  /**
   * `join` with what the argument `a` hands: an arrow's result, or its own
   * origin. A string cannot be written through, so handing one aliases nothing.
   */
  joinHanded(out: i32, a: Node): i32 {
    if (a.kind === NodeKind.Arrow) {
      return this.join(out, this.arrowResult(a))
    }
    const o = this.origin(a)
    return this.typeOf(a) === T_STRING ? joinOrigin(out, o) : this.join(out, o)
  }

  /** Whether what `fn` reads off the root may be memory it allocated (`noteWrite`). */
  rootMayBeNew(): boolean {
    return this.rootWritten || (this.freshWritten && this.rootAliased)
  }

  /** A store of `value`'s memory into `holder`'s, at `at`, which `what` describes. */
  store(holder: i32, value: i32, at: Node, what: string): void {
    if (value === ORIGIN_NONE || value === ORIGIN_SCALAR) {
      return
    }
    this.noteWrite(holder)
    if ((holder === ORIGIN_REGION || holder === ORIGIN_ROOT) && mayBeReleased(value)) {
      this.reportOuter(at, what)
    } else if (holder === ORIGIN_PARENT && mayBeReleased(value)) {
      this.reportOuter(at, what)
    } else if ((holder === ORIGIN_OUTER || holder === ORIGIN_PARENT) && mayBeRegion(value)) {
      this.report(at, regionToOuterMessage(this.who, what, this.freed))
    } else if (holder === ORIGIN_UNKNOWN || holder === ORIGIN_MIXED || holder === ORIGIN_CHILD_ROOT) {
      // The parent's memory outlives the region, whichever the holder is.
      if (value === ORIGIN_OUTER) {
        this.reportOuter(at, what)
      } else if (value !== ORIGIN_PARENT) {
        this.report(at, regionToOuterMessage(this.who, what, this.freed))
      }
    }
  }

  visit(node: Node): void {
    const kind = node.kind
    if (kind === NodeKind.Arrow) {
      // An arrow a user function is handed is a function of its own, judged by its facts.
      return
    }
    if (kind === NodeKind.VarDecl) {
      const init = node.children[2]
      if (init.kind !== NodeKind.Empty) {
        this.visit(init)
        const origin = this.origin(init)
        const local = this.program.nodeLocals[node.id]
        if (local !== null) {
          this.bind(local, origin)
        } else {
          // `const [a, b] = await awaitAll(...)` declares each name on its own node.
          for (const name of node.children[0].children) {
            this.bind(this.program.nodeLocals[name.id], origin)
          }
        }
      }
      return
    }
    if (kind === NodeKind.ForOf) {
      this.bind(
        this.program.nodeLocals[node.children[0].children[0].children[0].id],
        this.origin(node.children[1])
      )
    } else if (kind === NodeKind.Binary && isAssignmentOperator(node.text)) {
      this.visitAssignment(node)
      return
    } else if (kind === NodeKind.Call) {
      this.visitCall(node)
      return
    } else if (kind === NodeKind.New) {
      this.visitNew(node)
    } else if (kind === NodeKind.Array || kind === NodeKind.Object) {
      this.visitLiteral(node)
    }
    for (const child of node.children) {
      this.visit(child)
    }
  }

  visitAssignment(node: Node): void {
    const target = unwrapParens(node.children[0])
    const value = node.children[1]
    this.visit(value)
    for (const child of target.children) {
      this.visit(child)
    }
    if (isCopied(this.table, this.typeOf(target))) {
      return
    }
    // `s += t` stores a new string, or `t` itself.
    const stored = node.text === "=" ? this.origin(value) : joinOrigin(ORIGIN_REGION, this.origin(value))
    if (target.kind === NodeKind.Ident) {
      this.bind(this.program.nodeLocals[target.id], stored)
      return
    }
    if (target.kind === NodeKind.Member || target.kind === NodeKind.Index) {
      this.noteAlias(value, stored)
      this.store(this.origin(target.children[0]), stored, node, storesText(this.program, value, target))
    }
  }

  visitLiteral(node: Node): void {
    for (const child of node.children) {
      const value = child.kind === NodeKind.Property ? child.children[child.children.length - 1] : child
      const o = this.origin(value)
      this.noteAlias(value, o)
      if (o !== ORIGIN_NONE && mayBeReleased(o)) {
        this.reportOuter(child, putsText(this.program, value))
      }
    }
  }

  visitNew(node: Node): void {
    const ctor = this.program.nodeCallees[node.id]
    if (ctor === null) {
      // No constructor: the arguments, if any, were refused already.
      return
    }
    this.judgeCallee(node, ctor, true)
    if (this.spawnArrows.length > 0) {
      this.noteSpawnArrows(ctor, this.handedTo(node, ctor))
    }
  }

  visitCall(node: Node): void {
    const callee = this.program.nodeCallees[node.id]
    const handed = this.handedTo(node, callee)
    if (callee === null) {
      this.visitBuiltin(node, handed)
      return
    }
    // A method's receiver is visited with the callee position it sits in.
    this.visit(node.children[0])
    const role = regionRoleOf(callee)
    if (role !== REGION_NONE) {
      // Another region's call is judged at its own call; a nested `region` only makes a handle.
      for (const arg of node.children[1].children) {
        this.visit(arg)
      }
      const sites = this.sites
      if (isChildMaker(role) && sites !== null && !this.collect) {
        // What `childWith` hands the child's `f` is the parent's to keep only if the root reaches it.
        const args = node.children[1].children
        // Memory read off the root after `f` stores into region memory may be new, so none is.
        sites.record(
          node,
          role === REGION_CHILD ||
            (!this.rootMayBeNew() && args.length > 0 && outlivesChild(this.origin(args[0]))),
          this.fn
        )
      }
      return
    }
    this.visitArguments(node, handed, ORIGIN_REGION)
    this.judgeCallee(node, callee, false)
    this.noteSpawnArrows(callee, handed)
  }

  /**
   * A call's arguments, walking each arrow's body as part of `f`: the callee
   * runs it here, with its captures (`sourceLocal`), and hands its parameters
   * what the call is handed, what any arrow of the call answers (`compose`
   * hands `g()` to `f`, `twice` hands `f`'s answer back to `f`) or, from a
   * user function (`seed` region), memory it allocated. An arrow's answer
   * reads its own parameters, so it is taken from the run before: the
   * fixpoint in `regionFindings` reruns the walk until no binding moves.
   */
  visitArguments(node: Node, handed: Node[], seed: i32): void {
    let around = seed
    for (const arg of handed) {
      const a = unwrapParens(arg)
      around = this.joinHanded(around, a)
    }
    for (const arg of node.children[1].children) {
      const a = unwrapParens(arg)
      if (a.kind === NodeKind.Arrow) {
        for (const param of a.children[1].children) {
          if (param.kind === NodeKind.Param && param.children[0].kind === NodeKind.Ident) {
            this.bindArrowParam(param.children[0].text, around)
          }
        }
        this.visit(a.children[3])
      } else {
        this.visit(a)
      }
    }
  }

  visitBuiltin(node: Node, handed: Node[]): void {
    this.visit(node.children[0])
    this.visitArguments(node, handed, ORIGIN_SCALAR)
    const receiver = methodReceiver(node)
    if (receiver === null && isResizeCall(this.program, this.table, node)) {
      // `spawnPiped(argv, stdin, stdout, stderr)` appends to its last two
      // arguments as `push` does: one outside the region is grown inside it.
      // `spawnPipedWithin`'s fifth, the deadline, is a number and grows nothing.
      const args = node.children[1].children
      let grown = -1
      for (let i = 0; i < args.length && grown < 0; i++) {
        if (
          i >= SPAWN_PIPED_FIRST_GROWN &&
          i <= SPAWN_PIPED_FIRST_GROWN + 1 &&
          mayBeOuter(this.origin(args[i]))
        ) {
          grown = i
        }
      }
      if (grown >= 0 && grown < args.length) {
        const name = builtinNameOf(this.program, node)
        const text = textOf(this.program, args[grown])
        this.report(node, growthMessage(this.who, `grows \`${text}\` with \`${name}\``))
      }
      return
    }
    const method = arrayMethodName(this.program, this.table, node)
    if (receiver === null || method.length === 0) {
      return
    }
    const holder = this.origin(receiver)
    if (method === "push" || method === "unshift" || method === "splice") {
      if (mayBeOuter(holder)) {
        this.report(
          node,
          growthMessage(this.who, `grows \`${textOf(this.program, receiver)}\` with \`${method}\``)
        )
        return
      }
    }
    if (method === "push" || method === "unshift" || method === "splice" || method === "fill") {
      for (const arg of node.children[1].children) {
        if (!isCopied(this.table, this.typeOf(arg))) {
          this.noteAlias(arg, this.origin(arg))
          this.store(holder, this.origin(arg), node, storesText(this.program, arg, receiver))
        }
      }
    }
  }

  /** The rules a user function or constructor is held to, from its facts, at `node`. */
  judgeCallee(node: Node, callee: FunctionSig, isNew: boolean): void {
    const f: FunctionFacts | null = this.facts.get(callee.name)
    if (f === null) {
      this.report(node, noFactsMessage(this.who, callee))
      return
    }
    const handed = this.handedTo(node, callee)
    const offset = isNew && f.paramNames.length > 0 && f.paramNames[0] === "this" ? 1 : 0
    const origins: i32[] = []
    let anyOuter = false
    for (const arg of handed) {
      const a = unwrapParens(arg)
      // An arrow argument has no pointer facts; what it answers may be stored by the callee.
      const o = a.kind === NodeKind.Arrow ? this.arrowResult(a) : this.origin(a)
      origins.push(o)
      anyOuter = anyOuter || mayBeReleased(o)
    }
    const name = regionCalleeName(callee)
    for (let i = 0; i < origins.length; i++) {
      const pp: PointerParamFacts | null = f.pointerParamAt(i + offset)
      const o = origins[i]
      if (o === ORIGIN_NONE || o === ORIGIN_SCALAR) {
        continue
      }
      const arg = i < handed.length ? handed[i] : node
      // A string is never written through, whatever the callee does with it.
      if (pp !== null && (pp.writesReach || pp.polluted) && this.typeOf(arg) !== T_STRING) {
        this.noteWrite(o)
      }
      if (pp === null || pp.captured || pp.keptInThis || pp.polluted) {
        // A callee that keeps it may keep it in memory `fn` allocated.
        this.noteAlias(arg, o)
      }
      if (pp === null) {
        // A `string` has no pointer facts, so a constructor is taken to keep it.
        if (isNew && mayBeReleased(o)) {
          this.reportOuter(node, handsText(this.program, arg, name, "which may keep it"))
        }
        continue
      }
      if (mayBeOuter(o)) {
        // Growth first: a callee that grows its argument also stores the
        // new storage into it, and the growth is what to name.
        if (pp.writesReach && f.allocates) {
          this.report(node, handsGrowthMessage(this.who, this.program, arg, name))
        } else if (pp.polluted) {
          this.report(
            node,
            handsRegionMessage(this.who, this.freed, this.program, arg, name, "which stores into it")
          )
        } else if (isNew && (pp.keptInThis || pp.captured) && mayBeReleased(o)) {
          this.reportOuter(node, handsText(this.program, arg, name, "which keeps it"))
        } else if (this.task && i > 0 && pp.captured && this.receiverMayBeRegion(node, callee, origins)) {
          // `m.set(k, shared)`: a method of the task's own object may keep it there.
          this.reportOuter(node, handsText(this.program, arg, name, "which may keep it in its receiver"))
        }
      } else if (pp.polluted && anyOuter) {
        this.reportOuter(
          node,
          handsText(this.program, arg, name, "which may store memory outside the region into it")
        )
      }
    }
    if (this.task) {
      this.judgeTaskCallee(node, f, handed, origins, offset, name)
    }
  }

  /** True when `call` is a method call whose receiver, the first of `origins`, may be the region's. */
  receiverMayBeRegion(call: Node, callee: FunctionSig, origins: i32[]): boolean {
    return (
      call.kind !== NodeKind.New &&
      callee.owner !== null &&
      methodReceiver(call) !== null &&
      origins.length > 0 &&
      mayBeRegion(origins[0])
    )
  }

  /**
   * A task's callee handed both a shared argument it writes into and memory
   * that may be the task's own may store the one into the other: a string,
   * which has no pointer facts, or a value read out of an object of the
   * task's. Its facts cannot say which, so the pair is refused.
   */
  judgeTaskCallee(
    node: Node,
    f: FunctionFacts,
    handed: Node[],
    origins: i32[],
    offset: i32,
    name: string
  ): void {
    let written = -1
    for (let i = 0; i < origins.length && written < 0; i++) {
      const pp: PointerParamFacts | null = f.pointerParamAt(i + offset)
      if (pp !== null && pp.writesReach && mayBeOuter(origins[i])) {
        written = i
      }
    }
    let kept = -1
    for (let j = 0; j < origins.length && written >= 0 && kept < 0; j++) {
      const o = origins[j]
      if (j !== written && o !== ORIGIN_NONE && o !== ORIGIN_SCALAR && mayBeRegion(o)) {
        kept = j
      }
    }
    if (kept >= 0 && kept < handed.length && written < handed.length) {
      const into = `which writes into \`${textOf(this.program, handed[written])}\` and may keep it there`
      this.report(node, handsRegionMessage(this.who, this.freed, this.program, handed[kept], name, into))
    }
  }
}

/** The symbols that put another thread to work, which a region's `f` may not reach. */
const isThreadSymbol = (name: string, scopeName: string): boolean =>
  name === "nish_scope_spawn" ||
  name === "nish_parallel_range" ||
  name === "nish_scope_join" ||
  name === "nish_channel_send" ||
  name === "nish_channel_receive" ||
  (scopeName.length > 0 && name === scopeName)

const reachesThreads = (facts: FactsTable, name: string, scopeName: string, seen: StringSet): boolean => {
  if (isThreadSymbol(name, scopeName)) {
    return true
  }
  if (!seen.add(name)) {
    return false
  }
  const own = facts.get(name)
  if (own === null) {
    return false
  }
  for (let c = 0; c < own.callees.size(); c++) {
    if (reachesThreads(facts, own.callees.at(c), scopeName, seen)) {
      return true
    }
  }
  return false
}

/** The program among `programs` that defines `sig`, or `null`. */
const regionProgramOf = (programs: CheckedProgram[], sig: FunctionSig): CheckedProgram | null => {
  for (const program of programs) {
    if (sig.definedIn(program.source)) {
      return program
    }
  }
  return null
}

/** The user callees of `body`'s calls and `new`s, once each. */
const collectCallees = (program: CheckedProgram, node: Node, out: FunctionSig[]): void => {
  if (node.kind === NodeKind.Call || node.kind === NodeKind.New) {
    const callee = program.nodeCallees[node.id]
    if (callee !== null && out.indexOf(callee) < 0) {
      out.push(callee)
    }
  }
  for (const child of node.children) {
    collectCallees(program, child, out)
  }
}

/**
 * The refusals one runner call earns: the whole-`f` questions at `site`, the
 * call, and the walk's at the nodes in `f` they are about.
 */
export const regionCallFindings = (
  programs: CheckedProgram[],
  table: TypeTable,
  facts: FactsTable,
  program: CheckedProgram,
  site: Node,
  sig: FunctionSig,
  scopeName: string,
  freshResults: FreshResults,
  sites: ChildSites
): RegionFinding[] => {
  const out: RegionFinding[] = []
  const role = regionRoleOf(sig)
  const instance = sig.instance
  if (instance === null || instance.functionArgs.length !== 1) {
    return out
  }
  const fn = instance.functionArgs[0]
  const child = isChildMaker(role)
  const at = child ? sites.indexOf(site) : -1
  if (child) {
    const placed = at < 0 ? "" : sites.misplaced(facts, at)
    if (at < 0 || placed.length > 0) {
      const name = role === REGION_CHILD ? "`child`" : "`childWith`"
      const what = at < 0 ? `${name} is called outside the function \`enter\` or \`enterWith\` runs` : placed
      out.push(new RegionFinding(program, site, childPlacementMessage(what)))
      return out
    }
  }
  const f = facts.get(fn.name)
  if (f === null) {
    out.push(new RegionFinding(program, site, noFactsMessage(insideRegion(fn), fn)))
    return out
  }
  if (f.readsArenaState) {
    out.push(new RegionFinding(program, site, arenaStateMessage(fn)))
  }
  if (reachesThreads(facts, fn.name, scopeName, new StringSet())) {
    out.push(new RegionFinding(program, site, threadsMessage(fn)))
  }
  if ((role === REGION_ENTER || role === REGION_ENTER_WITH) && !isCopied(table, fn.returnType)) {
    out.push(new RegionFinding(program, site, enterResultMessage(fn, table)))
  }
  if (isRegionMaker(role)) {
    const ref = freshResults.builderRef(fn)
    if (ref.length > 0) {
      out.push(new RegionFinding(program, site, notFreshMessage(fn, ref, child)))
    }
  }
  const names = fn.paramNames
  const seedNames: string[] = []
  const seedOrigins: i32[] = []
  const entered = role === REGION_ENTER || role === REGION_ENTER_WITH
  if (role === REGION_MAKE_WITH && names.length > 0) {
    seedNames.push(names[0])
    seedOrigins.push(ORIGIN_OUTER)
  }
  if (role === REGION_CHILD_WITH && names.length > 0 && at >= 0) {
    seedNames.push(names[0])
    seedOrigins.push(sites.fromRoot[at] ? ORIGIN_PARENT : ORIGIN_OUTER)
  }
  if (entered && names.length > 0) {
    // A child's root may reach its ancestors' memory, which may not grow nor keep the child's.
    const handle = sig.paramTypes.length > 0 ? sig.paramTypes[0] : -1
    seedNames.push(names[0])
    const mayBeChild = sites.childTypes.indexOf(handle) >= 0 && !sites.plainHandle(program, site)
    seedOrigins.push(mayBeChild ? ORIGIN_CHILD_ROOT : ORIGIN_ROOT)
  }
  if (role === REGION_ENTER_WITH && names.length > 1) {
    seedNames.push(names[1])
    seedOrigins.push(ORIGIN_OUTER)
  }
  if (entered) {
    sites.enter(sig.name, fn)
  }
  walkFindings(
    out,
    programs,
    table,
    facts,
    fn,
    freshResults,
    seedNames,
    seedOrigins,
    false,
    [],
    [],
    entered ? sites : null
  )
  return out
}

/**
 * Adds to `out` the walk's refusals in `fn`'s body, its parameters `seedNames`
 * bound to `seedOrigins`: a region's function, or a spawned task (`task`).
 * In a task, `outer` are locals its body reads that hold its spawner's
 * objects (an arrow's captures), and `spawnArrows` the arrows the spawn
 * handed it (`RegionWalk.spawnArrows`). Answers the walk, or null when `fn`
 * has no body to walk.
 */
const walkFindings = (
  out: RegionFinding[],
  programs: CheckedProgram[],
  table: TypeTable,
  facts: FactsTable,
  fn: FunctionSig,
  freshResults: FreshResults,
  seedNames: string[],
  seedOrigins: i32[],
  task: boolean,
  outer: Local[],
  spawnArrows: FunctionSig[],
  sites: ChildSites | null
): RegionWalk | null => {
  const home = regionProgramOf(programs, fn)
  const body = fn.body()
  if (home === null || body === null) {
    return null
  }
  // Only one instantiation's tables are installed at a time, and
  // `resultRef` installs its own, so the callees are judged before the walk enters `fn`'s.
  const fnInstance = fn.instance
  if (fnInstance !== null) {
    home.enterInstance(fnInstance)
  }
  const callees: FunctionSig[] = []
  collectCallees(home, body, callees)
  if (fnInstance !== null) {
    home.leaveInstance()
  }
  const fresh = new StringSet()
  for (const callee of callees) {
    if (regionRoleOf(callee) === REGION_NONE && freshResults.resultRef(callee).length === 0) {
      fresh.add(callee.name)
    }
  }
  if (fnInstance !== null) {
    home.enterInstance(fnInstance)
  }
  const walk = new RegionWalk(home, table, facts, fn, fresh, seedNames, seedOrigins, task, sites)
  walk.programs = programs
  for (const local of outer) {
    walk.bind(local, ORIGIN_OUTER)
  }
  for (const arrow of spawnArrows) {
    walk.spawnArrows.push(arrow)
    const none: i32[] = []
    for (let i = 0; i < arrow.writtenArity(); i++) {
      none.push(ORIGIN_NONE)
    }
    walk.arrowArgs.push(none)
    walk.indirect.push(false)
  }
  // A run that changes anything adds a binding or raises one a step up
  // none, scalar, root or parent or outer, region, unknown, and bindings are finite, so this
  // reaches the fixpoint; a cap would report from origins not yet settled.
  walk.changed = true
  while (walk.changed) {
    walk.changed = false
    walk.visit(body)
  }
  walk.collect = false
  walk.visit(body)
  if (fnInstance !== null) {
    home.leaveInstance()
  }
  for (const finding of walk.findings) {
    out.push(finding)
  }
  return walk
}

/**
 * WP49 stage 5, part 3: the refusals the task of one `spawn` from
 * `nish:async` earns, at `site` and in `task`'s body. The objects and arrays
 * it is handed are its spawner's, outside the region the task allocates
 * from, which is freed when it ends: the walk holds the task to keeping none
 * of its own memory in them and growing none of them. A task that spawns a
 * task with an object it shares is refused outright: what it hands on may be
 * its own, and freed while the other task holds it.
 */
export const taskFindings = (
  programs: CheckedProgram[],
  table: TypeTable,
  facts: FactsTable,
  program: CheckedProgram,
  site: Node,
  task: FunctionSig,
  freshResults: FreshResults
): RegionFinding[] => {
  const out: RegionFinding[] = []
  const seedNames: string[] = []
  const seedOrigins: i32[] = []
  // Only the first refused argument is reported: one finding per site.
  let refused = -1
  for (let i = 0; i < task.paramTypes.length; i++) {
    const type = task.paramTypes[i]
    if (task.isCompileTime(i) || isCopied(table, type)) {
      continue
    }
    if (taskShareObstacle(programs, table, type, []).length > 0) {
      if (refused < 0) {
        refused = i
      }
      continue
    }
    // A `string` argument is copied into the task's region when it starts.
    seedNames.push(task.paramNames[i])
    seedOrigins.push(table.sharedWithTask(type) ? ORIGIN_OUTER : ORIGIN_REGION)
  }
  if (refused >= 0 && refused < task.paramTypes.length && refused < task.paramNames.length) {
    const type = task.paramTypes[refused]
    const why = taskShareObstacle(programs, table, type, [])
    const name = task.paramNames[refused]
    out.push(new RegionFinding(program, site, sharedResourceMessage(task, name, table.typeName(type), why)))
  }
  const shares = seedOrigins.indexOf(ORIGIN_OUTER) >= 0
  const f = facts.get(task.name)
  if (f === null) {
    // Without facts nothing proves the task keeps its memory out of what it shares.
    if (shares) {
      out.push(new RegionFinding(program, site, noFactsMessage(insideTask(task), task)))
    }
    return out
  }
  if (f.feedsTasks) {
    out.push(new RegionFinding(program, site, nestedSpawnMessage(task)))
  }
  // WP49 stage 5, part 8: an arrow the spawn hands the task may capture its
  // spawner's numbers, copied into the frame, and objects it could share as
  // arguments, which the task reaches as it does those.
  const arrows: FunctionSig[] = []
  const outer: Local[] = []
  // The refused capture, or arrow without facts, is found in the loop and its
  // message built after it, so no pass of the loop keeps a message's memory.
  let captureRefused = false
  let refusedName = ""
  let refusedType = 0
  for (const slot of capturesOf(task)) {
    const type = slot.type()
    const local = slot.arrow.captures[slot.index]
    if (
      !isFrameValue(table, type) &&
      !(table.sharedWithTask(type) && taskShareObstacle(programs, table, type, []).length === 0)
    ) {
      captureRefused = true
      refusedName = local.name
      refusedType = type
      break
    }
    if (arrows.indexOf(slot.arrow) < 0) {
      arrows.push(slot.arrow)
    }
    if (!isFrameValue(table, type)) {
      outer.push(local)
    }
  }
  if (captureRefused) {
    out.push(
      new RegionFinding(program, site, captureSpawnMessage(task, refusedName, table.typeName(refusedType)))
    )
    return out
  }
  let factless: FunctionSig | null = null
  let nested = false
  for (const arrow of arrows) {
    const own = facts.get(arrow.name)
    if (own === null) {
      factless = arrow
      break
    }
    if (own.feedsTasks && !f.feedsTasks) {
      nested = true
    }
  }
  if (factless !== null) {
    if (nested) {
      out.push(new RegionFinding(program, site, nestedSpawnMessage(task)))
    }
    out.push(new RegionFinding(program, site, noFactsMessage(insideTask(task), factless)))
    return out
  }
  if (nested) {
    out.push(new RegionFinding(program, site, nestedSpawnMessage(task)))
  }
  if (!shares && outer.length === 0) {
    return out
  }
  const walk = walkFindings(
    out,
    programs,
    table,
    facts,
    task,
    freshResults,
    seedNames,
    seedOrigins,
    true,
    [],
    arrows,
    null
  )
  // Each arrow is a body of the task's own: its captures are the spawner's,
  // and its parameters what the task hands it, or anything when a callee
  // the walk judges by its facts runs it.
  for (let a = 0; a < arrows.length; a++) {
    const arrow = arrows[a]
    const names: string[] = []
    const origins: i32[] = []
    for (let i = 0; i < arrow.writtenArity(); i++) {
      names.push(arrow.paramNames[i])
      const seen = walk === null || walk.indirect[a] ? ORIGIN_UNKNOWN : walk.arrowArgs[a][i]
      origins.push(seen === ORIGIN_NONE ? ORIGIN_UNKNOWN : seen)
    }
    walkFindings(out, programs, table, facts, arrow, freshResults, names, origins, true, outer, [], null)
  }
  return out
}

/** A value a task's frame holds as it is, which a capture may be: a number, a `boolean` or an enum. */
const isFrameValue = (table: TypeTable, type: i32): boolean =>
  isNumeric(type) || type === T_BOOL || table.enumBase(type) >= 0

/**
 * Remember a call for `Compilation.checkRegions`, once: a generic caller's
 * body is checked once per instantiation and reaches here again with the same
 * node.
 */
export const recordRegionCall = (calls: ParallelCall[], node: Node, sig: FunctionSig): void => {
  for (const call of calls) {
    if (call.node === node && call.sig === sig) {
      return
    }
  }
  calls.push(new ParallelCall(node, sig, null))
}

/**
 * The child regions the program makes, filled in by `Compilation.checkRegions`
 * before it judges a `child` or `childWith` call: the type of each handle they
 * answer, then, from each `enter` walk, every call it makes directly and
 * whether its argument is memory the root reaches.
 */
export class ChildSites {
  /** `Region<T>` types a `child` or `childWith` answers: an `enter` of one sees its parent's memory. */
  childTypes: i32[]
  nodes: Node[]
  /** Whether the call's `arg` is memory the root reaches, in every `enter` walk that met it. */
  fromRoot: boolean[]
  /** The function `enter` or `enterWith` runs that makes the call. */
  holders: FunctionSig[]
  /** Each `enter` or `enterWith` instance judged, and the function it runs. */
  enterNames: string[]
  enterFns: FunctionSig[]
  /**
   * Variables declared from `region` or `regionWith`, and those bound any
   * other way: one in the first and not the second holds a plain handle.
   */
  plain: Local[]
  spoiled: Local[]

  constructor() {
    this.childTypes = []
    this.plain = []
    this.spoiled = []
    this.nodes = []
    this.fromRoot = []
    this.holders = []
    this.enterNames = []
    this.enterFns = []
  }

  indexOf(node: Node): i32 {
    return this.nodes.indexOf(node)
  }

  /** Notes every variable `node` binds, under `program`'s tables, as `plain` or `spoiled`. */
  scan(program: CheckedProgram, node: Node): void {
    if (node.kind === NodeKind.VarDecl) {
      const local = program.nodeLocals[node.id]
      const init = node.children[2]
      if (local !== null && init.kind !== NodeKind.Empty && this.makesPlain(program, init)) {
        this.plain.push(local)
      } else if (local !== null) {
        this.spoiled.push(local)
      }
    } else if (node.kind === NodeKind.Binary && isAssignmentOperator(node.text)) {
      const target = unwrapParens(node.children[0])
      const local: Local | null = target.kind === NodeKind.Ident ? program.nodeLocals[target.id] : null
      if (local !== null) {
        this.spoiled.push(local)
      }
    }
    for (const child of node.children) {
      this.scan(program, child)
    }
  }

  /** Whether `value` is a call of `region` or `regionWith`. */
  makesPlain(program: CheckedProgram, value: Node): boolean {
    const v = unwrapParens(value)
    const callee: FunctionSig | null = v.kind === NodeKind.Call ? program.nodeCallees[v.id] : null
    const role = callee === null ? REGION_NONE : regionRoleOf(callee)
    return role === REGION_MAKE || role === REGION_MAKE_WITH
  }

  /**
   * Whether the handle the `enter` or `enterWith` call `site` is handed is
   * one `region` or `regionWith` made: made there, or a variable only
   * ever bound to one. A parameter or a field may hold a child's.
   */
  plainHandle(program: CheckedProgram, site: Node): boolean {
    const args = site.children[1].children
    if (args.length === 0) {
      return false
    }
    const arg = unwrapParens(args[0])
    if (this.makesPlain(program, arg)) {
      return true
    }
    const local: Local | null = arg.kind === NodeKind.Ident ? program.nodeLocals[arg.id] : null
    return local !== null && this.plain.indexOf(local) >= 0 && this.spoiled.indexOf(local) < 0
  }

  record(node: Node, fromRoot: boolean, holder: FunctionSig): void {
    const at = this.nodes.indexOf(node)
    if (at < 0) {
      this.nodes.push(node)
      this.fromRoot.push(fromRoot)
      this.holders.push(holder)
      return
    }
    this.fromRoot[at] = this.fromRoot[at] && fromRoot
  }

  enter(name: string, fn: FunctionSig): void {
    this.enterNames.push(name)
    this.enterFns.push(fn)
  }

  /**
   * How the holder of call `at` is called other than as the function `enter`
   * or `enterWith` runs, which would run its child call in another region or
   * none, or `""`. A callee is known by its facts.
   */
  misplaced(facts: FactsTable, at: i32): string {
    const holder = this.holders[at]
    for (let i = 0; i < facts.index.size(); i++) {
      const caller = facts.index.keyAt(i)
      const own = facts.list[facts.index.valueAt(i)]
      if (own.callees.has(holder.name) && !this.runs(caller, holder)) {
        const name = own.sourceName === "" ? caller : own.sourceName
        return `${fnName(holder)} makes a child region and is called by another function, \`${name}\``
      }
    }
    return ""
  }

  /** Whether `caller` is an `enter` or `enterWith` instance that runs `fn`. */
  runs(caller: string, fn: FunctionSig): boolean {
    for (let i = 0; i < this.enterNames.length; i++) {
      if (this.enterNames[i] === caller && this.enterFns[i] === fn) {
        return true
      }
    }
    return false
  }
}
