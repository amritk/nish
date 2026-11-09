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
import {
  N_ARRAY,
  N_ARROW,
  N_AS,
  N_BINARY,
  N_BLOCK,
  N_CALL,
  N_CONDITIONAL,
  N_EMPTY,
  N_FOR_OF,
  N_IDENT,
  N_INDEX,
  N_MEMBER,
  N_NEW,
  N_NULL,
  N_OBJECT,
  N_PARAM,
  N_PROPERTY,
  N_RETURN,
  N_SPREAD,
  N_STRING,
  N_TEMPLATE,
  N_TEMPLATE_TEXT,
  N_UNARY,
  N_VAR_DECL,
  Node,
} from "./nodes"
import { capturesOf, isThreadsLayout } from "./parallel"
import { CheckedProgram, FunctionSig, ParallelCall } from "./program"
import { FreshResults } from "./secret"
import {
  REGION_ENTER,
  REGION_ENTER_WITH,
  REGION_MAKE,
  REGION_MAKE_WITH,
  REGION_NONE,
  regionRoleOf,
} from "./region-check"
import { Local, STORAGE_PARAM, sourceLocal } from "./symbols"
import { T_STRING, TypeTable } from "./types"

/** Not yet known: the walk has not reached a binding's value. Joins as nothing. */
const ORIGIN_NONE: i32 = -1
/** A number, a boolean, an enum, a `Region` handle, a string literal or `null`: copied, never pointed at. */
const ORIGIN_SCALAR: i32 = 0
/** The root, or memory `f` allocated. */
const ORIGIN_REGION: i32 = 1
/** Memory `arg` reaches. */
const ORIGIN_OUTER: i32 = 2
/** Either, as far as the walk can tell. */
const ORIGIN_UNKNOWN: i32 = 3

/** The origin of a value that may be `a` or `b`. */
const joinOrigin = (a: i32, b: i32): i32 => {
  if (a === ORIGIN_NONE || a === ORIGIN_SCALAR) {
    return b === ORIGIN_NONE ? a : b
  }
  if (b === ORIGIN_NONE || b === ORIGIN_SCALAR || a === b) {
    return a
  }
  return ORIGIN_UNKNOWN
}

/** Whether a value of origin `o` may be outer memory. */
const mayBeOuter = (o: i32): boolean => o === ORIGIN_OUTER || o === ORIGIN_UNKNOWN

/** Whether a value of origin `o` may be region memory. */
const mayBeRegion = (o: i32): boolean => o === ORIGIN_REGION || o === ORIGIN_UNKNOWN

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

/** The first argument `spawnPiped` appends to, its `stdout`; `stderr` follows. */
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

const notFreshMessage = (fn: FunctionSig, ref: string): string =>
  `The function \`region\` or \`regionWith\` runs answers the region's root, which must be memory it allocated, ` +
  `and ${fnName(fn)} may not: ${ref}`

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
 * A spawned task handed an arrow that captures (WP29): the captures ride in
 * the task's frame as hidden arguments that neither the spawn's argument rule
 * nor the task's region walk sees, so a task takes capture-free functions only.
 */
const captureSpawnMessage = (task: FunctionSig, local: string): string =>
  `\`spawn\` hands ${fnName(task)} an arrow that reads \`${local}\` of the function it is written in: ` +
  "a spawned task takes a function argument only when it captures nothing, because the task may run after that function returns; " +
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

/** The `N_RETURN` values of an arrow's block, not those of arrows nested in it. */
const collectArrowReturns = (node: Node, out: Node[]): void => {
  if (node.kind === N_RETURN) {
    if (node.children[0].kind !== N_EMPTY) {
      out.push(node.children[0])
    }
    return
  }
  if (node.kind === N_ARROW) {
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
  changed: boolean
  collect: boolean
  /**
   * WP49 stage 5, part 3: `fn` is a spawned task, not a region's function.
   * Its outside memory is what it shares with its spawner, which outlives it,
   * so only memory of its own region kept from outside is refused, and growth.
   */
  task: boolean

  constructor(
    program: CheckedProgram,
    table: TypeTable,
    facts: FactsTable,
    fn: FunctionSig,
    fresh: StringSet,
    paramNames: string[],
    paramOrigins: i32[],
    task: boolean
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
    const joined = joinOrigin(this.localOrigins[at], origin)
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
    const joined = joinOrigin(this.arrowOrigins[at], origin)
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
    if (kind === N_NULL || kind === N_STRING || kind === N_TEMPLATE_TEXT) {
      return ORIGIN_SCALAR
    }
    if (kind === N_IDENT) {
      return this.identOrigin(e)
    }
    if (kind === N_MEMBER || kind === N_INDEX || kind === N_AS || kind === N_SPREAD || kind === N_UNARY) {
      return this.origin(e.children[0])
    }
    if (kind === N_NEW || kind === N_ARRAY || kind === N_OBJECT) {
      return ORIGIN_REGION
    }
    if (kind === N_TEMPLATE) {
      // A new string; a substitution that is one already may come back as it is.
      let out = ORIGIN_REGION
      for (const part of e.children) {
        out = joinOrigin(out, this.origin(part))
      }
      return out
    }
    if (kind === N_CONDITIONAL) {
      return joinOrigin(this.origin(e.children[1]), this.origin(e.children[2]))
    }
    if (kind === N_BINARY) {
      if (isAssignmentOperator(e.text)) {
        return this.origin(e.children[1])
      }
      // `??`, `||` and `&&` answer an operand; `+` on strings a new string, or an operand.
      const either = joinOrigin(this.origin(e.children[0]), this.origin(e.children[1]))
      return e.text === "+" ? joinOrigin(ORIGIN_REGION, either) : either
    }
    if (kind === N_CALL) {
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
      out = joinOrigin(out, this.paramOrigins[own])
      named = true
    }
    const nested = this.arrowNames.indexOf(local.name)
    if (nested >= 0) {
      out = joinOrigin(out, this.arrowOrigins[nested])
      named = true
    }
    return named || out !== ORIGIN_NONE ? out : ORIGIN_UNKNOWN
  }

  /** The receiver of a method call and then its arguments: the values a callee is handed, in its parameters' order. */
  handedTo(call: Node, callee: FunctionSig | null): Node[] {
    const out: Node[] = []
    if (call.kind === N_NEW) {
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
    // answers a new holder of the shared object), so its arguments join in.
    let out = ORIGIN_REGION
    for (const arg of this.handedTo(call, callee)) {
      const a = unwrapParens(arg)
      // What a callback answers may be what the call answers (`map`, `pick(() => a.node)`).
      out = joinOrigin(out, a.kind === N_ARROW ? this.arrowResult(a) : this.origin(a))
    }
    return out
  }

  arrowResult(arrow: Node): i32 {
    const body = arrow.children[3]
    if (body.kind !== N_BLOCK) {
      return this.origin(body)
    }
    const values: Node[] = []
    collectArrowReturns(body, values)
    let out = ORIGIN_SCALAR
    for (const value of values) {
      out = joinOrigin(out, this.origin(value))
    }
    return out
  }

  /** A store of `value`'s memory into `holder`'s, at `at`, which `what` describes. */
  store(holder: i32, value: i32, at: Node, what: string): void {
    if (value === ORIGIN_NONE || value === ORIGIN_SCALAR) {
      return
    }
    if (holder === ORIGIN_REGION && mayBeOuter(value)) {
      this.reportOuter(at, what)
    } else if (holder === ORIGIN_OUTER && mayBeRegion(value)) {
      this.report(at, regionToOuterMessage(this.who, what, this.freed))
    } else if (holder === ORIGIN_UNKNOWN) {
      if (value !== ORIGIN_OUTER) {
        this.report(at, regionToOuterMessage(this.who, what, this.freed))
      } else {
        this.reportOuter(at, what)
      }
    }
  }

  visit(node: Node): void {
    const kind = node.kind
    if (kind === N_ARROW) {
      // An arrow a user function is handed is a function of its own, judged by its facts.
      return
    }
    if (kind === N_VAR_DECL) {
      const init = node.children[2]
      if (init.kind !== N_EMPTY) {
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
    if (kind === N_FOR_OF) {
      this.bind(
        this.program.nodeLocals[node.children[0].children[0].children[0].id],
        this.origin(node.children[1])
      )
    } else if (kind === N_BINARY && isAssignmentOperator(node.text)) {
      this.visitAssignment(node)
      return
    } else if (kind === N_CALL) {
      this.visitCall(node)
      return
    } else if (kind === N_NEW) {
      this.visitNew(node)
    } else if (kind === N_ARRAY || kind === N_OBJECT) {
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
    if (target.kind === N_IDENT) {
      this.bind(this.program.nodeLocals[target.id], stored)
      return
    }
    if (target.kind === N_MEMBER || target.kind === N_INDEX) {
      this.store(this.origin(target.children[0]), stored, node, storesText(this.program, value, target))
    }
  }

  visitLiteral(node: Node): void {
    for (const child of node.children) {
      const value = child.kind === N_PROPERTY ? child.children[child.children.length - 1] : child
      const o = this.origin(value)
      if (o !== ORIGIN_NONE && mayBeOuter(o)) {
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
    if (regionRoleOf(callee) !== REGION_NONE) {
      // Another region's call is judged at its own call; a nested `region` only makes a handle.
      for (const arg of node.children[1].children) {
        this.visit(arg)
      }
      return
    }
    this.visitArguments(node, handed, ORIGIN_REGION)
    this.judgeCallee(node, callee, false)
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
      around = joinOrigin(around, a.kind === N_ARROW ? this.arrowResult(a) : this.origin(a))
    }
    for (const arg of node.children[1].children) {
      const a = unwrapParens(arg)
      if (a.kind === N_ARROW) {
        for (const param of a.children[1].children) {
          if (param.kind === N_PARAM && param.children[0].kind === N_IDENT) {
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
      const args = node.children[1].children
      let grown = -1
      for (let i = 0; i < args.length && grown < 0; i++) {
        if (i >= SPAWN_PIPED_FIRST_GROWN && mayBeOuter(this.origin(args[i]))) {
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
      const o = a.kind === N_ARROW ? this.arrowResult(a) : this.origin(a)
      origins.push(o)
      anyOuter = anyOuter || mayBeOuter(o)
    }
    const name = regionCalleeName(callee)
    for (let i = 0; i < origins.length; i++) {
      const pp: PointerParamFacts | null = f.pointerParamAt(i + offset)
      const o = origins[i]
      if (o === ORIGIN_NONE || o === ORIGIN_SCALAR) {
        continue
      }
      const arg = i < handed.length ? handed[i] : node
      if (pp === null) {
        // A `string` has no pointer facts, so a constructor is taken to keep it.
        if (isNew && mayBeOuter(o)) {
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
        } else if (isNew && (pp.keptInThis || pp.captured)) {
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
      call.kind !== N_NEW &&
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
  if (node.kind === N_CALL || node.kind === N_NEW) {
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
  freshResults: FreshResults
): RegionFinding[] => {
  const out: RegionFinding[] = []
  const role = regionRoleOf(sig)
  const instance = sig.instance
  if (instance === null || instance.functionArgs.length !== 1) {
    return out
  }
  const fn = instance.functionArgs[0]
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
  if (role === REGION_MAKE || role === REGION_MAKE_WITH) {
    const ref = freshResults.resultRef(fn)
    if (ref.length > 0) {
      out.push(new RegionFinding(program, site, notFreshMessage(fn, ref)))
    }
  }
  const names = fn.paramNames
  const seedNames: string[] = []
  const seedOrigins: i32[] = []
  if (role === REGION_MAKE_WITH && names.length > 0) {
    seedNames.push(names[0])
    seedOrigins.push(ORIGIN_OUTER)
  }
  if ((role === REGION_ENTER || role === REGION_ENTER_WITH) && names.length > 0) {
    seedNames.push(names[0])
    seedOrigins.push(ORIGIN_REGION)
  }
  if (role === REGION_ENTER_WITH && names.length > 1) {
    seedNames.push(names[1])
    seedOrigins.push(ORIGIN_OUTER)
  }
  walkFindings(out, programs, table, facts, fn, freshResults, seedNames, seedOrigins, false)
  return out
}

/**
 * Adds to `out` the walk's refusals in `fn`'s body, its parameters `seedNames`
 * bound to `seedOrigins`: a region's function, or a spawned task (`task`).
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
  task: boolean
): void => {
  const home = regionProgramOf(programs, fn)
  const body = fn.body()
  if (home === null || body === null) {
    return
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
  const walk = new RegionWalk(home, table, facts, fn, fresh, seedNames, seedOrigins, task)
  // A run that changes anything adds a binding or raises one a step up
  // none, scalar, region or outer, unknown, and bindings are finite, so this
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
  const captures = capturesOf(task)
  if (captures.length > 0) {
    const first = captures[0]
    out.push(
      new RegionFinding(program, site, captureSpawnMessage(task, first.arrow.captures[first.index].name))
    )
  }
  if (shares) {
    walkFindings(out, programs, table, facts, task, freshResults, seedNames, seedOrigins, true)
  }
  return out
}

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
