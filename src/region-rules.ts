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

import { FactsTable, FunctionFacts, PointerParamFacts } from "./attributes"
import { arrayMethodName, isAssignmentOperator, methodReceiver, unwrapParens } from "./emit-util"
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
import { Local, STORAGE_PARAM } from "./symbols"
import { TypeTable } from "./types"

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

const regionToOuterMessage = (fn: FunctionSig, what: string): string =>
  `${fnName(fn)} runs inside a region, and ${what}: region memory kept by memory outside the region ` +
  "points at freed memory once `free` runs; copy the numbers out instead"

const outerToRegionMessage = (fn: FunctionSig, what: string): string =>
  `${fnName(fn)} runs inside a region, and ${what}: memory outside a region kept by the region's memory ` +
  "may be released while the region still points at it; copy it into memory the region allocates instead"

const enterResultMessage = (fn: FunctionSig, table: TypeTable): string =>
  `${fnName(fn)} answers \`${table.typeName(fn.returnType)}\`, and the function \`enter\` or \`enterWith\` runs ` +
  "may answer only a number, a `boolean`, an `enum` or a `Region`: anything else would point into the region " +
  "from outside it"

const threadsMessage = (fn: FunctionSig): string =>
  `${fnName(fn)} runs inside a region, and reaches \`scope()\`, \`spawn\`, a parallel body or a channel: ` +
  "another thread allocates from an arena of its own, not from the region"

export const crossingMessage = (what: string, type: string): string =>
  `${what} is \`${type}\`, which holds a \`Region\`, and a region is entered only on the thread that made it`

const notFreshMessage = (fn: FunctionSig, ref: string): string =>
  `The function \`region\` or \`regionWith\` runs answers the region's root, which must be memory it allocated, ` +
  `and ${fnName(fn)} may not: ${ref}`

const growthMessage = (fn: FunctionSig, what: string): string =>
  `${fnName(fn)} runs inside a region, and ${what}: storage outside the region that grows inside it ` +
  "would move into the region and be freed with it"

const noFactsMessage = (fn: FunctionSig, callee: FunctionSig): string =>
  `${fnName(fn)} runs inside a region, and calls ${regionCalleeName(callee)}, which the region rules have no facts for`

const arenaStateMessage = (fn: FunctionSig): string =>
  `${fnName(fn)} runs inside a region, and reaches \`Arena.mark\` or \`Arena.used\`: ` +
  "inside a region they would read the region's own arena, not the thread's"

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

/** The names an arrow's parameters bind. */
const arrowParamNames = (arrow: Node): string[] => {
  const out: string[] = []
  for (const param of arrow.children[1].children) {
    if (param.kind === N_PARAM && param.children[0].kind === N_IDENT) {
      out.push(param.children[0].text)
    }
  }
  return out
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
  changed: boolean
  collect: boolean
  findings: RegionFinding[]

  constructor(
    program: CheckedProgram,
    table: TypeTable,
    facts: FactsTable,
    fn: FunctionSig,
    fresh: StringSet
  ) {
    this.program = program
    this.table = table
    this.facts = facts
    this.fn = fn
    this.fresh = fresh
    this.paramNames = []
    this.paramOrigins = []
    this.arrowNames = []
    this.arrowOrigins = []
    this.locals = []
    this.localOrigins = []
    this.changed = false
    this.collect = true
    this.findings = []
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
    const local = this.program.nodeLocals[e.id]
    if (local === null) {
      // A module-level binding: a number, a boolean, a string literal or a function.
      return ORIGIN_SCALAR
    }
    const at = this.locals.indexOf(local)
    let out = at < 0 ? ORIGIN_NONE : this.localOrigins[at]
    if (local.storage !== STORAGE_PARAM) {
      return out
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
    if (callee !== null && this.fresh.has(callee.name)) {
      return ORIGIN_REGION
    }
    let out = ORIGIN_REGION
    for (const arg of this.handedTo(call, callee)) {
      const a = unwrapParens(arg)
      if (a.kind !== N_ARROW) {
        out = joinOrigin(out, this.origin(a))
      } else if (callee === null) {
        // What a builtin's callback answers may be what the builtin answers (`map`).
        out = joinOrigin(out, this.arrowResult(a))
      }
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
      this.report(at, outerToRegionMessage(this.fn, what))
    } else if (holder === ORIGIN_OUTER && mayBeRegion(value)) {
      this.report(at, regionToOuterMessage(this.fn, what))
    } else if (holder === ORIGIN_UNKNOWN) {
      this.report(
        at,
        value === ORIGIN_OUTER ? outerToRegionMessage(this.fn, what) : regionToOuterMessage(this.fn, what)
      )
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
        this.bind(this.program.nodeLocals[node.id], this.origin(init))
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
      const what = `stores \`${textOf(this.program, value)}\` into \`${textOf(this.program, target)}\``
      this.store(this.origin(target.children[0]), stored, node, what)
    }
  }

  visitLiteral(node: Node): void {
    for (const child of node.children) {
      const value = child.kind === N_PROPERTY ? child.children[child.children.length - 1] : child
      const o = this.origin(value)
      if (o !== ORIGIN_NONE && mayBeOuter(o)) {
        this.report(
          child,
          outerToRegionMessage(this.fn, `puts \`${textOf(this.program, value)}\` in a literal`)
        )
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
    for (const arg of node.children[1].children) {
      this.visit(arg)
    }
    if (regionRoleOf(callee) !== REGION_NONE) {
      // Another region's call is judged at its own call; a nested `region` only makes a handle.
      return
    }
    this.judgeCallee(node, callee, false)
  }

  visitBuiltin(node: Node, handed: Node[]): void {
    this.visit(node.children[0])
    let around = ORIGIN_SCALAR
    for (const arg of handed) {
      if (unwrapParens(arg).kind !== N_ARROW) {
        around = joinOrigin(around, this.origin(arg))
      }
    }
    for (const arg of node.children[1].children) {
      const a = unwrapParens(arg)
      if (a.kind === N_ARROW) {
        for (const name of arrowParamNames(a)) {
          this.bindArrowParam(name, around)
        }
        this.visit(a.children[3])
      } else {
        this.visit(a)
      }
    }
    const receiver = methodReceiver(node)
    const method = arrayMethodName(this.program, this.table, node)
    if (receiver === null || method.length === 0) {
      return
    }
    const holder = this.origin(receiver)
    if (method === "push" || method === "unshift" || method === "splice") {
      if (mayBeOuter(holder)) {
        this.report(
          node,
          growthMessage(this.fn, `grows \`${textOf(this.program, receiver)}\` with \`${method}\``)
        )
        return
      }
    }
    if (method === "push" || method === "unshift" || method === "splice" || method === "fill") {
      for (const arg of node.children[1].children) {
        const what = `stores \`${textOf(this.program, arg)}\` into \`${textOf(this.program, receiver)}\``
        if (!isCopied(this.table, this.typeOf(arg))) {
          this.store(holder, this.origin(arg), node, what)
        }
      }
    }
  }

  /** The rules a user function or constructor is held to, from its facts, at `node`. */
  judgeCallee(node: Node, callee: FunctionSig, isNew: boolean): void {
    const f: FunctionFacts | null = this.facts.get(callee.name)
    if (f === null) {
      this.report(node, noFactsMessage(this.fn, callee))
      return
    }
    const handed = this.handedTo(node, callee)
    const offset = isNew && f.paramNames.length > 0 && f.paramNames[0] === "this" ? 1 : 0
    const origins: i32[] = []
    let anyOuter = false
    for (const arg of handed) {
      const a = unwrapParens(arg)
      const o = a.kind === N_ARROW ? ORIGIN_SCALAR : this.origin(a)
      origins.push(o)
      anyOuter = anyOuter || mayBeOuter(o)
    }
    const name = regionCalleeName(callee)
    for (let i = 0; i < handed.length; i++) {
      const pp: PointerParamFacts | null = f.pointerParamAt(i + offset)
      const o = origins[i]
      if (o === ORIGIN_NONE || o === ORIGIN_SCALAR) {
        continue
      }
      const arg = textOf(this.program, handed[i])
      if (pp === null) {
        // A `string` has no pointer facts, so a constructor is taken to keep it.
        if (isNew && mayBeOuter(o)) {
          this.report(node, outerToRegionMessage(this.fn, `hands \`${arg}\` to ${name}, which may keep it`))
        }
        continue
      }
      if (mayBeOuter(o)) {
        if (pp.polluted) {
          this.report(
            node,
            regionToOuterMessage(this.fn, `hands \`${arg}\` to ${name}, which stores into it`)
          )
        } else if (pp.writesReach && f.allocates) {
          this.report(node, growthMessage(this.fn, `hands \`${arg}\` to ${name}, which may grow it`))
        } else if (isNew && (pp.keptInThis || pp.captured)) {
          this.report(node, outerToRegionMessage(this.fn, `hands \`${arg}\` to ${name}, which keeps it`))
        }
      } else if (pp.polluted && anyOuter) {
        this.report(
          node,
          outerToRegionMessage(
            this.fn,
            `hands \`${arg}\` to ${name}, which may store memory outside the region into it`
          )
        )
      }
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
    out.push(new RegionFinding(program, site, noFactsMessage(fn, fn)))
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
  const home = regionProgramOf(programs, fn)
  const body = fn.body()
  if (home === null || body === null) {
    return out
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
  const walk = new RegionWalk(home, table, facts, fn, fresh)
  const names = fn.paramNames
  if (role === REGION_MAKE_WITH && names.length > 0) {
    walk.paramNames.push(names[0])
    walk.paramOrigins.push(ORIGIN_OUTER)
  }
  if ((role === REGION_ENTER || role === REGION_ENTER_WITH) && names.length > 0) {
    walk.paramNames.push(names[0])
    walk.paramOrigins.push(ORIGIN_REGION)
  }
  if (role === REGION_ENTER_WITH && names.length > 1) {
    walk.paramNames.push(names[1])
    walk.paramOrigins.push(ORIGIN_OUTER)
  }
  // Each run can only raise an origin, and there are four, so this ends.
  let runs = 0
  walk.changed = true
  while (walk.changed && runs < 64) {
    walk.changed = false
    walk.visit(body)
    runs = runs + 1
  }
  walk.collect = false
  walk.visit(body)
  if (fnInstance !== null) {
    home.leaveInstance()
  }
  for (const finding of walk.findings) {
    out.push(finding)
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
