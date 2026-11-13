// Allocation escape analysis for stage1 (stage0's `src/codegen/escape.ts`,
// docs/wp14-selfhost.md milestone S4): which allocations can live on the
// stack, and which functions can reclaim their arena temporaries on exit.
//
// The model is that of stage0's `src/codegen/escape.ts`, and its long header states it in
// full: an *allocation site* is an expression that produces fresh memory, its
// value *flows* somewhere through the transparent wrappers and the locals it
// is stored in, and the flow is `local`, `returned` or `leaks`. A stackable
// site whose flow is `local` and whose holding locals are never reassigned
// becomes an entry-block `alloca`; a function whose direct arena allocations
// all flow `local` brackets its body with `nish_arena_mark` /
// `nish_arena_release`.
//
// The call-site reclaim (WP9) is stated there too: `leaks` merges a value the
// caller can still reach with one merely assigned to a local of this frame, so
// every outcome also carries `escapes`, true only in the first case and
// following the value into the local in the second. `allocEscapes` is the
// per-function union; `reclaimsReturnedString` is what it buys.
//
// What is different here is only the bookkeeping. `Set`/`Map` keyed by node or
// by local become a `boolean[]` indexed by `Node.id` and short lists scanned
// by identity — a function has a handful of locals, and `===` on a class value
// is the identity the maps were there for. The upward walks read `src/
// parents.ts` instead of `node.parent`, and an argument's parent is the
// `NodeKind.List` that holds it, which `attributes.ts` handles for both of us.

import {
  classifyUse,
  constructorOf,
  AnalysisUnit,
  CallSite,
  FactsTable,
  FunctionFacts,
  isFreshArrayLocal,
  isJoinedParts,
  LoopScope,
  ParamUse,
  pushedOnto,
  USE_ARGUMENT,
  USE_NONE,
  USE_READ,
  USE_WRITE,
  yieldsInteriorPointer,
} from "./attributes"
import {
  arrayMethodName,
  builtinNameOf,
  coalescesMaybe,
  dottedName,
  isArenaCall,
  intrinsicType,
  isAssignmentOperator,
  isJoinCall,
  isPushCall,
  isStringAllocCall,
  isTemplateExpression,
  storesInlineElements,
  unwrapParens,
  unwrapStringPassthrough,
} from "./emit-util"
import { FLAG_USING, Node, NodeKind } from "./nodes"
import { literalLength } from "./emit-arrays"
import { isResultConstructorCall, resultMethodName } from "./emit-result"
import { StringSet } from "./map"
import { Options } from "./options"
import {
  CaptureTarget,
  arrowCallee,
  captureTarget,
  chunkDstIndex,
  isMapEntry,
  isSpawnEntry,
} from "./parallel"
import { CheckedProgram, elementStride, FunctionSig, ROLE_CONSTRUCTOR, ROLE_FUNCTION } from "./program"
import { Local, STORAGE_LOCAL, STORAGE_PARAM } from "./symbols"
import { isNumeric, T_BOOL, T_STRING, T_VOID, TypeTable } from "./types"

/** Largest array data block (`[n x T]`) placed on the stack, in bytes. */
const STACK_ARRAY_BYTES: i32 = 4096

/** Where the value of an allocation site ends up. The order is the severity order. */
export const FLOW_LOCAL: i32 = 0
export const FLOW_RETURNED: i32 = 1
export const FLOW_LEAKS: i32 = 2

const worse = (a: i32, b: i32): i32 => (a >= b ? a : b)

/**
 * A `spawnPiped` call with its four arguments, or a `spawnPipedWithin` call
 * with its five: one whose `stdout` and `stderr` the runtime grows. A call
 * with the wrong count was refused by the checker and grows nothing here.
 */
const isSpawnPipedArity = (name: string, call: Node): boolean => {
  const count = call.children[1].children.length
  return (name === "spawnPiped" && count === 4) || (name === "spawnPipedWithin" && count === 5)
}

/**
 * Whether an identifier builtin answers fresh arena memory, which is what makes
 * a call of one an allocation site of the function around it.
 *
 * A builtin belongs here when it answers a `string`, an array or a struct that
 * the runtime allocated during the call — every one of these does. One that
 * answers a number does not, and neither does one that answers memory it did not
 * just allocate: `process.platform` hands back the same static string on every
 * call, and `process.argv` is `malloc`ed once by the entry wrapper rather than
 * bumped, which is why neither is here.
 *
 * Adding an allocating builtin to `builtins.ts` and forgetting this predicate is
 * a use-after-free rather than a missed optimisation, so the `mem_*_scope`
 * cases pin them (`mem_wait_pid_scope` for `waitPid`). stage0's `src/codegen/escape.ts` holds the same four names in a
 * `Set`; a module constant in this language is a scalar or a string, so the set
 * is a function here and the two are read side by side. `readCString` (WP27
 * S3.3) copies C's bytes into the arena at the call, as a `declare function`'s
 * `string` result does, and `ffi_owned_string` pins it after `churn()`;
 * `readStruct` (S4.2) copies a C struct into a fresh layout instance there,
 * pinned by `ffi_struct_read`.
 */
const isAllocatingBuiltin = (name: string): boolean =>
  name === "readFileSync" ||
  name === "readFileSyncOrNull" ||
  name === "readFileBytesSync" ||
  name === "getenv" ||
  name === "readdirSync" ||
  name === "realpathSync" ||
  name === "waitPid" ||
  name === "terminalSize" ||
  name === "readCString" ||
  name === "readStruct"

/**
 * Whether the builtin `name` answers an array whose elements were allocated by
 * the same call: `readdirSync` bumps every name and stores it into the array it
 * bumps, which is the store into memory the scope rules below assume nothing
 * made (docs/security/codegen.md, CG-5). A builtin like it goes here beside its
 * entry in `isAllocatingBuiltin`.
 */
const answersFreshElements = (name: string): boolean => name === "readdirSync"

/**
 * Whether `expr` is a listing, whose elements are followed as the listing
 * itself: a call of such a builtin, or of a function that returns an array
 * holding elements allocated by the call (`FunctionFacts.returnsFreshElements`).
 */
const isListingCall = (program: CheckedProgram, facts: FactsTable, expr: Node): boolean => {
  const e = unwrapParens(expr)
  if (e.kind !== NodeKind.Call) {
    return false
  }
  const callee = program.nodeCallees[e.id]
  if (callee === null) {
    return answersFreshElements(builtinNameOf(program, e))
  }
  const g = facts.get(callee.name)
  return g !== null && g.returnsFreshElements
}

export class EscapeResult {
  /** Node id -> the allocation there is lowered to an entry-block alloca. */
  stackSites: boolean[]
  /** Locals that only ever hold a stack object (their fields are own memory). */
  stackLocals: Local[]
  /** The body performs an arena allocation whose flow is `local`. */
  directArena: boolean
  /** Some direct allocation `leaks`. */
  allocLeaks: boolean
  /**
   * WP9: some direct allocation is reachable after this function returns other
   * than through its return value. Refines `allocLeaks`, which also counts a
   * value assigned to a local of this frame; see the header.
   */
  allocEscapes: boolean
  /** Some direct allocation is `returned`. */
  returnsAllocation: boolean
  /**
   * The array this function returns may hold elements allocated during the
   * call: a value stored into a returned fresh array (`storedIntoReturnedArray`),
   * or a listing returned on. Its callers follow those elements as the call
   * itself (`isListingCall`).
   */
  returnsFreshElements: boolean
  /** Calls to pointer-returning user functions, with the flow of each result. */
  callSites: CallSite[]
  /**
   * Where `allocEscapes` was first set: the allocation site, the call whose
   * result escapes, the `push`, or the by-value `Result` parameter. Null
   * exactly when `allocEscapes` is false. The arena-loop diagnostic names its
   * line as the reason a function gets no scope.
   */
  escapeSite: Node | null
  /**
   * WP17: names of the by-value `Result` parameters whose unpacked object may
   * be an entry-block alloca. The word arrives in a register, so the object
   * the body reads is built by the callee; it is this function's own memory
   * unless a use of the parameter stores the pointer somewhere that outlives
   * the frame (an object literal, `push`), which is exactly what
   * `localOutcome` decides for a local holding an allocation.
   */
  stackParams: StringSet
  /**
   * Every allocation site, `push` and by-value `Result` parameter whose value
   * `escapes`, in the order `decide` met them. The per-pass rule
   * (`decideLoopScopes`) asks which of them lie inside a loop body.
   */
  escapingNodes: Node[]
  /** Every site of this body that bumps the arena itself: an allocation that is not an alloca, a `push`, a logged number. */
  arenaNodes: Node[]
  /**
   * The flow of each `arenaNodes` site, parallel to it: `FLOW_LOCAL`,
   * `FLOW_RETURNED` or `FLOW_LEAKS`. Kept for the placement report
   * (`src/arena-report.ts`), which has to tell a value handed to the caller
   * from one nothing here releases; every other reader wants only the
   * aggregates above.
   */
  arenaFlows: i32[]
  /**
   * Every `xs[i] = v` and `xs.push(v)` whose value takes `xs`'s outcome
   * (`storedIntoReturnedArray`), and its `xs`. The value is in memory all the
   * same, so a pass or a block that did not declare `xs` may not release it.
   */
  carriedStores: Node[]
  carriers: Local[]
  /**
   * The parameter, by index, whose elements this function fills with strings
   * the call allocated, or -1. A map's chunk loop stores each answer into
   * `dst` (`chunkDstIndex`), and a function that only hands its own
   * parameter on to such a call fills it in turn. Those stores are not an
   * escape here: the array is the caller's, so the caller decides at the call
   * (`decideFills`) whether its strings outlive the caller's frame, exactly as
   * `storedIntoReturnedArray` decides for an array this function made. A
   * function that fills a parameter is never `contained`, so no scope of its
   * own releases what it stored.
   */
  fillsParam: i32
  /**
   * The `string[]` parameters, by name, whose elements this function neither
   * keeps past the call nor hands back (`decideElementParams`). A caller's
   * listing passed to one of them is not handed on, so the caller's frame
   * may still release its strings (`passesToFreeElements`).
   */
  freeElementParams: string[]

  constructor(nodeCount: i32) {
    this.escapingNodes = []
    this.arenaNodes = []
    this.arenaFlows = []
    this.carriedStores = []
    this.carriers = []
    this.stackSites = new Array<boolean>(nodeCount)
    this.stackLocals = []
    this.stackParams = new StringSet()
    this.directArena = false
    this.allocLeaks = false
    this.allocEscapes = false
    this.returnsAllocation = false
    this.returnsFreshElements = false
    this.callSites = []
    this.escapeSite = null
    this.fillsParam = -1
    this.freeElementParams = []
  }

  /** Set `allocEscapes`, remembering `node` unless an earlier escape already is its site. */
  noteEscape(node: Node): void {
    this.escapingNodes.push(node)
    this.allocEscapes = true
    if (this.escapeSite === null) {
      this.escapeSite = node
    }
  }
}

/** One allocation expression. */
class Site {
  node: Node
  /** Struct or array of a known size within budget: may become an alloca. */
  stackable: boolean
  /** A user call: the site counts only if the callee allocates (fixpoint). Empty otherwise. */
  callee: string

  constructor(node: Node, stackable: boolean) {
    this.node = node
    this.stackable = stackable
    this.callee = ""
  }
}

/** The flow of one value, and whether every local on the path is a fixed binding. */
class Outcome {
  flow: i32
  /** No local on the path is ever reassigned (required for the stack). */
  stable: boolean
  /**
   * WP9: the value is reachable after this function returns, other than
   * through its return value. Always false for a `local` or `returned` flow;
   * false for a `leaks` flow whose only cause is an assignment to a local of
   * this frame, whose own outcome it takes instead.
   */
  escapes: boolean
  /**
   * Stable but for a `let` on the path being assigned again: whatever the
   * local holds when it is read, nothing else keeps a pointer to it. A
   * `Result` site with this and a `local` flow outside every loop may be
   * its own alloca (`decide`), because each site then runs once a call and
   * the slot it fills is never written again while the local can name it.
   */
  settled: boolean

  constructor(flow: i32, stable: boolean, escapes: boolean) {
    this.flow = flow
    this.stable = stable
    this.escapes = escapes
    this.settled = stable
  }
}

/** Where a value is stored: a local, the return value, or neither. */
class FlowTarget {
  local: Local | null
  isReturn: boolean
  /** Neither: the expression whose use decides, the value itself or what the walk followed it into. */
  used: Node | null

  constructor(local: Local | null, isReturn: boolean) {
    this.local = local
    this.isReturn = isReturn
    this.used = null
  }
}

class EscapeAnalysis {
  unit: AnalysisUnit
  table: TypeTable
  facts: FactsTable
  opts: Options
  result: EscapeResult

  sites: Site[]
  /** Every identifier reference to each local of this function, in source order. */
  refLocals: Local[]
  refNodes: Node[][]
  declarations: Node[]
  /**
   * Calls that grow an array in the arena, checked against the site locals
   * below: `xs.push(v)`, and `spawnPiped` (or `spawnPipedWithin`), which appends to its `stdout` and
   * `stderr` and so appears once for each. `pushReceivers` is parallel to it.
   */
  pushes: Node[]
  pushReceivers: Node[]
  /** Calls of a function that fills one of its parameters (`fillsParam`), decided last. */
  fills: Node[]
  logsNumbers: boolean
  /** WP17: this function hands its `Result` back in a register, not as a pointer. */
  returnsByValueResult: boolean
  /**
   * The site being decided is a listing (`isListingCall`), so an element
   * read out of it, `xs[i]` or a `for...of` variable, flows as the site does,
   * and a use that could hand an element on unseen is an escape
   * (`handsOutElements`). Its outcomes are memoised apart, because the same
   * local read without it answers differently.
   */
  listing: boolean
  /** Memoised outcomes, keyed by local identity. */
  outcomeLocals: Local[]
  outcomeValues: Outcome[]
  /** The signature being analysed; WP17 reads its parameter list. */
  sig: FunctionSig
  /**
   * The locals an arrow argument captures (WP29), once per capture, and
   * beside each the arrow parameter it reaches (`captureTarget`), or null
   * when it is an escape.
   */
  captured: Local[]
  captureTargets: (CaptureTarget | null)[]

  constructor(
    unit: AnalysisUnit,
    table: TypeTable,
    facts: FactsTable,
    opts: Options,
    nodeCount: i32,
    sig: FunctionSig,
    returnsByValueResult: boolean
  ) {
    this.unit = unit
    this.table = table
    this.facts = facts
    this.opts = opts
    this.sig = sig
    this.returnsByValueResult = returnsByValueResult
    this.result = new EscapeResult(nodeCount)
    this.sites = []
    this.refLocals = []
    this.refNodes = []
    this.declarations = []
    this.pushes = []
    this.pushReceivers = []
    this.fills = []
    this.logsNumbers = false
    this.outcomeLocals = []
    this.outcomeValues = []
    this.listing = false
    this.captured = []
    this.captureTargets = []
  }

  // ---- Collection -------------------------------------------------------------------

  /** The `Local` of the parameter called `name`, from the refs collected, or null. */
  paramLocal(name: string): Local | null {
    let i = 0
    while (i < this.refLocals.length) {
      const v = this.refLocals[i]
      if (v.storage === STORAGE_PARAM && v.name === name) {
        return v
      }
      i = i + 1
    }
    return null
  }

  addRef(local: Local, node: Node): void {
    let i = 0
    while (i < this.refLocals.length) {
      if (this.refLocals[i] === local) {
        this.refNodes[i].push(node)
        return
      }
      i = i + 1
    }
    const list: Node[] = []
    list.push(node)
    this.refLocals.push(local)
    this.refNodes.push(list)
  }

  refsOf(local: Local): Node[] {
    let i = 0
    while (i < this.refLocals.length) {
      if (this.refLocals[i] === local) {
        return this.refNodes[i]
      }
      i = i + 1
    }
    return []
  }

  /**
   * Bytes per element, for the stack budget. WP15 §2a: an array of classes
   * holds its elements inline, so a stackable `new Array<Point>(64)` is 64
   * `Point`s of slot rather than 64 pointers — the same question
   * `emit-arrays.ts` asks, and it has to be asked the same way or the budget
   * and the `[n x T]` slot the emitter writes would disagree.
   */
  elementSize(elem: i32): i32 {
    return elementStride(this.unit.program, this.table, elem)
  }

  visit(node: Node): void {
    const program = this.unit.program
    // WP29: an arrow argument's body belongs to the function it was lifted
    // into, whose own walk finds its sites; nothing in it is this function's
    // but the locals it captures. An arrow given to an ordinary function
    // parameter may store those anywhere; a data-parallel form's or a task's
    // keeps them read-only and inside the call, by that form's rules.
    if (node.kind === NodeKind.Arrow) {
      const lifted = program.nodeCallees[node.id]
      if (lifted !== null && lifted.capturesForCall) {
        this.noteCaptures(node, lifted)
      }
      return
    }
    if (node.kind === NodeKind.Ident) {
      const local = program.nodeLocals[node.id]
      // WP17: a by-value `Result` parameter owns its object, so its uses are
      // walked like a local's: the same alias chain decides alloca or arena.
      if (
        local !== null &&
        (local.storage === STORAGE_LOCAL ||
          (local.storage === STORAGE_PARAM && this.table.resultByValue(local.type)))
      ) {
        this.addRef(local, node)
      }
    } else if (node.kind === NodeKind.VarDecl) {
      this.declarations.push(node)
    } else if (node.kind === NodeKind.New) {
      this.visitNew(node)
    } else if (node.kind === NodeKind.Object) {
      this.sites.push(new Site(node, true))
    } else if (node.kind === NodeKind.Array) {
      const type = program.nodeTypes[node.id]
      const stackable =
        type >= 0 &&
        this.table.isArray(type) &&
        node.children.length * this.elementSize(this.table.refOf(type)) <= STACK_ARRAY_BYTES
      this.sites.push(new Site(node, stackable))
    } else if (node.kind === NodeKind.Binary) {
      if (node.text === "+" && program.nodeTypes[node.children[0].id] === T_STRING) {
        this.sites.push(new Site(node, false))
      }
    } else if (isTemplateExpression(node)) {
      if (unwrapStringPassthrough(program, node) === node) {
        this.sites.push(new Site(node, false))
      }
    } else if (node.kind === NodeKind.Call) {
      this.visitCall(node)
    }
    for (const child of node.children) {
      this.visit(child)
    }
  }

  /** Each local of this function `arrow` captures, and the arrow parameter it reaches (`captured`). */
  noteCaptures(arrow: Node, lifted: FunctionSig): void {
    const callee = arrowCallee(this.unit.program, this.unit.parents, arrow)
    let k = 0
    while (k < lifted.captures.length) {
      this.captured.push(lifted.captures[k])
      const target: CaptureTarget | null = callee === null ? null : captureTarget(callee, lifted, k)
      this.captureTargets.push(target)
      k = k + 1
    }
  }

  isCaptured(v: Local): boolean {
    for (const seen of this.captured) {
      if (seen === v) {
        return true
      }
    }
    return false
  }

  visitNew(node: Node): void {
    // A `new` checked into a union is recorded as the union; it allocates its class.
    const type = intrinsicType(this.unit.program, node)
    if (type >= 0 && this.table.isStruct(type)) {
      this.sites.push(new Site(node, true))
      return
    }
    if (type < 0 || !this.table.isArray(type)) {
      return
    }
    const args = node.children[2]
    const n = args.children.length > 0 ? literalLength(args.children[0]) : -1
    const stackable = n >= 0 && n * this.elementSize(this.table.refOf(type)) <= STACK_ARRAY_BYTES
    this.sites.push(new Site(node, stackable))
  }

  visitCall(call: Node): void {
    const program = this.unit.program
    const callee = program.nodeCallees[call.id]
    if (callee !== null) {
      const g = this.facts.get(callee.name)
      if (g !== null && g.fillsParam >= 0) {
        this.fills.push(call)
      }
      if (this.isPointerResult(callee.returnType)) {
        const site = new Site(call, false)
        // WP27 S3.2: a `string` from a `declare function` is copied into this
        // function's arena at the call (`emitForeignStringResult`), so it is
        // this function's allocation, as `s.substring(...)` is, and no callee's.
        if (!callee.foreign()) {
          site.callee = callee.name
        }
        this.sites.push(site)
      } else if (this.table.resultByValue(callee.returnType)) {
        // WP17: a `Result` returned in a register is materialised by the
        // *caller*, so the call is an allocation site of this function like
        // `new C(...)` is: an entry-block alloca unless the pointer is handed
        // to something that keeps it, and never memory the callee owns.
        this.sites.push(new Site(call, true))
      }
      return
    }
    if (isPushCall(program, this.table, call)) {
      this.pushes.push(call)
      this.pushReceivers.push(call.children[0].children[0])
      return
    }
    // WP14: `s.substring(...)`, `String.fromCharCode(c)` and `parts.join(s)`
    // each bump one string out of the arena, so they are allocation sites
    // exactly as `a + b` is.
    if (isStringAllocCall(program, call) || isJoinCall(program, this.table, call)) {
      this.sites.push(new Site(call, false))
      return
    }
    // WP16: `r.orReturn()` builds the `Result` this function returns early, so
    // the body hands out arena memory whatever else it does — which is exactly
    // what disqualifies it from an automatic arena scope. WP17: not when the
    // `Result` is packed into the return register, because then nothing is
    // built at all.
    if (resultMethodName(program, this.table, call) === "orReturn") {
      if (!this.returnsByValueResult) {
        this.result.returnsAllocation = true
      }
      return
    }
    const target = call.children[0]
    if (target.kind === NodeKind.Ident) {
      // `Ok(v)` / `Err(e)` bump one fixed-size struct, so they are stackable
      // exactly as `new C(...)` is.
      if (isResultConstructorCall(program, this.table, call)) {
        this.sites.push(new Site(call, true))
        return
      }
      // An identifier builtin that bumps its result out of the arena is an
      // allocation site of its caller, and missing one is not a lost
      // optimisation: the function gets an automatic arena scope whose
      // `nish_arena_release` rewinds past the bytes the caller is about to read.
      // Missing the `OrNull` half did exactly that
      // (`tests/cases/mem_read_or_null_scope`), and `getenv` and `readdirSync`
      // were missing for the same reason (`mem_getenv_scope`,
      // `mem_readdir_scope`), which is why the list is named above with the rule
      // for extending it written beside it. Under a `nish:` import the
      // identifier is the local name, so the builtin is the one the checker
      // recorded: `import { readFileBytesSync as bytesOf }` is the same
      // allocation spelled differently (`mem_read_import_scope`).
      const builtin = builtinNameOf(program, call)
      if (isAllocatingBuiltin(builtin)) {
        this.sites.push(new Site(call, false))
      }
      // `spawnPiped` and `spawnPipedWithin` grow `stdout` and `stderr` with
      // `nish_array_grow`, as `push` grows its receiver, so each is a push of
      // the call's.
      if (isSpawnPipedArity(builtin, call)) {
        for (const k of [2, 3]) {
          this.pushes.push(call)
          this.pushReceivers.push(call.children[1].children[k])
        }
      }
      return
    }
    const name = dottedName(target)
    if (name === "console.log") {
      const args = call.children[1]
      const type = args.children.length > 0 ? program.nodeTypes[args.children[0].id] : -1
      if (type >= 0 && isNumeric(type)) {
        // `nish_str_from_*` allocates the text; `nish_print` does not retain it.
        this.logsNumbers = true
        this.result.arenaNodes.push(call)
        this.result.arenaFlows.push(FLOW_LOCAL)
      }
    }
  }

  isPointerResult(type: i32): boolean {
    const inner = this.table.stripNull(type)
    // A `Result` (WP16) is a pointer into the arena like the others, so a call
    // that answers one is an allocation site of its caller — unless WP17 packs
    // it into a register, in which case the callee allocated nothing and the
    // caller's copy is its own (see the `resultByValue` arm of `visitCall`).
    return (
      this.table.isStruct(inner) ||
      this.table.isArray(inner) ||
      this.table.isUnion(inner) ||
      inner === T_STRING ||
      (this.table.isResult(inner) && !this.table.resultByValue(inner))
    )
  }

  // ---- Flow of one value -------------------------------------------------------------

  /** The local the value is stored in, or the return value, or neither. */
  flowTarget(expr: Node): FlowTarget {
    let node = expr
    for (;;) {
      const parent = this.unit.parents.parentOf(node)
      if (parent === null) {
        return new FlowTarget(null, false)
      }
      // WP32: `a ?? d` is one of its operands, as a ternary is one of its arms.
      if (
        parent.kind === NodeKind.Paren ||
        (parent.kind === NodeKind.Conditional && parent.children[0] !== node) ||
        (parent.kind === NodeKind.Binary && parent.text === "??")
      ) {
        node = parent
        continue
      }
      // An inline element used as a value is the address of a slot in this
      // array, so it goes wherever the element goes (`yieldsInteriorPointer`),
      // and the variable of a `for...of` over such an array holds each slot.
      if (
        parent.kind === NodeKind.Index &&
        parent.children[0] === node &&
        (this.listing || yieldsInteriorPointer(this.unit, this.table, parent))
      ) {
        node = parent
        continue
      }
      if (
        parent.kind === NodeKind.ForOf &&
        parent.children[1] === node &&
        (this.listing || storesInlineElements(this.unit.program, this.table, node))
      ) {
        return new FlowTarget(
          this.unit.program.nodeLocals[parent.children[0].children[0].children[0].id],
          false
        )
      }
      if (parent.kind === NodeKind.VarDecl && parent.children[2] === node) {
        return new FlowTarget(this.unit.program.nodeLocals[parent.id], false)
      }
      if (parent.kind === NodeKind.Return) {
        return new FlowTarget(null, true)
      }
      // A concise arrow body is the one `return` it means, so what it builds
      // is returned rather than local. The parser normalises the arrow into an
      // NodeKind.FunctionDecl whose body slot holds the expression itself, which is the
      // only place a body is not a block: a method's never is.
      if (
        (parent.kind === NodeKind.FunctionDecl || parent.kind === NodeKind.Arrow) &&
        parent.children[3] === node
      ) {
        return new FlowTarget(null, true)
      }
      const neither = new FlowTarget(null, false)
      neither.used = node
      return neither
    }
  }

  /**
   * Whether `callee` retains the pointer passed as parameter `index` (`this`
   * is 0) past the call: `outlives` rather than `captured`, so an array handed
   * to a parallel region is not kept by it (`markParallelEntry`).
   */
  calleeCaptures(callee: FunctionSig, index: i32): boolean {
    const g = this.facts.get(callee.name)
    if (g === null || index < 0 || index >= g.paramNames.length) {
      return true
    }
    const name = g.paramNames[index]
    const pointer = g.pointerParam(name)
    return pointer !== null ? pointer.outlives : g.escaping.has(name)
  }

  /**
   * `calleeCaptures` for a `spawn` (`isSpawnEntry`): whether its task keeps
   * the pointer passed as parameter `index` past the scope's join. The
   * instance's own facts say every parameter outlives the call
   * (`markParallelEntry`), and that is true of the call but not of the frame:
   * the payload holds the scope, the argument and the destination until the
   * join, and a scope is only ever a `using` local of the function that
   * spawns on it (NL2389), joined at every exit of its block, so before this
   * frame returns and before any `using a = arena()` around that block
   * releases. What the task does with them past the join is what the
   * instance hands them to — `runTask`, `runWith` and the entry — so that is
   * what is read. A parameter with no pointer facts (a `string`) keeps the
   * instance's answer.
   */
  spawnCaptures(callee: FunctionSig, index: i32): boolean {
    const g = this.facts.get(callee.name)
    if (g === null || index < 0 || index >= g.paramNames.length) {
      return true
    }
    const pointer = g.pointerParam(g.paramNames[index])
    if (pointer === null) {
      return true
    }
    let i = 0
    while (i < pointer.passedToCallees.length && i < pointer.passedToIndices.length) {
      const target = this.facts.get(pointer.passedToCallees[i])
      if (target === null) {
        return true
      }
      const at = pointer.passedToIndices[i]
      if (at < 0 || at >= target.paramNames.length) {
        return true
      }
      const name = target.paramNames[at]
      const kept = target.pointerParam(name)
      if (kept !== null ? kept.outlives : target.escaping.has(name)) {
        return true
      }
      i = i + 1
    }
    return false
  }

  /**
   * `x = <expr>`: the local of this function the value is assigned to, or
   * null. It is still `leaks` for the stack rule — the binding is not fixed,
   * so the slot may not be reused — but the value has not left the frame, so
   * `escapes` follows it into `x` the way `flow` already follows
   * `const x = <expr>`. A store through anything else (`o.f = v`, `a[i] = v`)
   * or into a parameter is not a local of this frame and keeps the
   * conservative answer.
   */
  assignedLocal(expr: Node): Local | null {
    let node = expr
    for (;;) {
      const parent = this.unit.parents.parentOf(node)
      if (parent === null) {
        return null
      }
      if (
        parent.kind === NodeKind.Paren ||
        (parent.kind === NodeKind.Conditional && parent.children[0] !== node) ||
        (parent.kind === NodeKind.Binary && parent.text === "??") ||
        (parent.kind === NodeKind.Index &&
          parent.children[0] === node &&
          (this.listing || yieldsInteriorPointer(this.unit, this.table, parent)))
      ) {
        node = parent
        continue
      }
      if (
        parent.kind !== NodeKind.Binary ||
        parent.children[1] !== node ||
        !isAssignmentOperator(parent.text) ||
        parent.children[0].kind !== NodeKind.Ident
      ) {
        return null
      }
      const target = this.unit.program.nodeLocals[parent.children[0].id]
      if (target === null || target.storage !== STORAGE_LOCAL) {
        return null
      }
      return target
    }
  }

  useOutcome(expr: Node, visiting: Local[]): Outcome {
    const found = classifyUse(this.unit, this.table, expr)
    const handsOn = found.kind === USE_ARGUMENT || found.kind === USE_READ || found.kind === USE_WRITE
    if (this.listing && handsOn && this.handsOutElements(expr) && !this.passesToFreeElements(found)) {
      return new Outcome(FLOW_LEAKS, true, true)
    }
    if (found.kind === USE_NONE || found.kind === USE_READ || found.kind === USE_WRITE) {
      return new Outcome(FLOW_LOCAL, true, false)
    }
    if (found.kind === USE_ARGUMENT) {
      return this.argumentOutcome(found.callee, found.index)
    }
    // Held by a local of this frame, as `x = <expr>` is below: not a fixed
    // binding, and kept past the pass that pushed it, but not reachable by
    // the caller.
    if (this.pushedIntoJoinedParts(expr)) {
      return new Outcome(FLOW_LEAKS, true, false)
    }
    const carried = this.storedIntoReturnedArray(expr, visiting)
    if (carried !== null) {
      return carried
    }
    const target = this.assignedLocal(expr)
    if (target === null) {
      return new Outcome(FLOW_LEAKS, true, true)
    }
    // `visiting` keeps every local entered for this site, not just the path,
    // so one in it without a memo is still being decided: a cycle back into
    // it (`r = c ? r : Ok(0)`) gets a placeholder, not the local's outcome.
    const pending = this.memoised(target) === null && holdsLocal(visiting, target)
    const held = this.localOutcome(target, visiting)
    // A `Result` assigned to a `let` of this frame goes where the `let` goes:
    // its flow and whether it is settled are the local's, and it is never
    // `stable`, so the slot rule for `const` still refuses it. A cycle keeps
    // the old answer.
    if (!this.listing && !pending && this.table.isResult(this.table.stripNull(target.type))) {
      const followed = new Outcome(held.flow, false, held.escapes)
      followed.settled = held.settled
      return followed
    }
    return new Outcome(FLOW_LEAKS, true, held.escapes)
  }

  /**
   * The value handed to `callee` as its parameter `index`: an argument, or
   * a capture read as one (`captureOutcome`).
   */
  argumentOutcome(callee: FunctionSig | null, index: i32): Outcome {
    // WP17: a by-value `Result` argument is packed into a register, so the
    // callee gets a copy and never sees this object at all.
    if (
      callee !== null &&
      index < callee.paramTypes.length &&
      this.table.resultByValue(callee.paramTypes[index])
    ) {
      return new Outcome(FLOW_LOCAL, true, false)
    }
    // WP27 S3.1 and WP53 B1.2: a `string` or a `u8[]` handed to a `declare
    // function` is borrowed for the length of the call, and the C function
    // may not keep its address (`docs/wp27-ffi.md` §8b,
    // `docs/wp53-ffi-buffers-handles.md` §5). Nothing about a C body can be
    // proved, so this is the decision read as a fact: the argument does not
    // escape, and the arena scope may release once the call has returned.
    // What C writes through a `u8[]` is recorded as a write by the foreign
    // facts, not here.
    if (callee !== null && callee.foreign()) {
      return new Outcome(FLOW_LOCAL, true, false)
    }
    // WP29 P2: held by the scope until it joins, inside this frame. Not a
    // fixed binding: a stack slot a later pass reuses could be overwritten
    // before the join, so the arena keeps it (`spawnCaptures`).
    if (callee !== null && isSpawnEntry(callee) && !this.spawnCaptures(callee, index)) {
      return new Outcome(FLOW_LOCAL, false, false)
    }
    const captures = callee === null ? true : this.calleeCaptures(callee, index)
    return new Outcome(captures ? FLOW_LEAKS : FLOW_LOCAL, true, captures)
  }

  /**
   * What the arrows that capture `v` do with it, joined: each capture is an
   * argument to its arrow at the parameter `captureTarget` names, judged by
   * `argumentOutcome` as `f(v)` would be. A listing captured by an arrow is
   * an argument in front of which an element may be handed on
   * (`handsOutElements` answers so for every array argument), unless the
   * arrow proved it keeps none (`elementsFreeAt`). Null when some capture
   * has no target, which is an escape.
   *
   * An object this answers `local` for may be an alloca: the call that hands
   * it over is never a tail call while it passes captures (`planTailCall`), and
   * the arrow runs before that call returns, because every instance on the
   * way is an ordinary one that only forwards the value.
   */
  captureOutcome(v: Local): Outcome | null {
    let flow = FLOW_LOCAL
    let stable = true
    let settled = true
    let escapes = false
    let i = 0
    while (i < this.captured.length && i < this.captureTargets.length) {
      if (this.captured[i] === v) {
        const target = this.captureTargets[i]
        if (target === null) {
          return null
        }
        let step = this.argumentOutcome(target.sig, target.index)
        if (
          this.listing &&
          this.table.isArray(this.table.stripNull(v.type)) &&
          !this.elementsFreeAt(target.sig, target.index)
        ) {
          step = new Outcome(FLOW_LEAKS, true, true)
        }
        flow = worse(flow, step.flow)
        stable = stable && step.stable
        settled = settled && step.settled
        escapes = escapes || step.escapes
      }
      i = i + 1
    }
    const outcome = new Outcome(flow, stable, escapes)
    outcome.settled = settled
    return outcome
  }

  /**
   * `parts.push(expr)`, where `parts` is a `string[]` this function binds to
   * a fresh array and then only pushes onto, joins and reads the length of.
   *
   * The pushed string is reachable only through `parts`'s elements, and
   * nothing reads those but `join`, which copies every part into a string of
   * its own (`emitJoin`) and is an allocation site analysed like any other. So
   * once `parts` is out of reach the string is too, and nothing outside this
   * frame can reach it: it `leaks` into `parts` as an assignment to a local
   * does, but it does not `escape`. Without this a function that
   * builds its answer from parts (`std/json.ts`'s `jsonUnescape`) lets an
   * allocation out, and every loop that calls it loses its per-pass release
   * (`LOOP_CALLEE_STORES`).
   *
   * The narrowness is the proof, and `isJoinedParts` (attributes.ts) holds
   * it: any other use of `parts` — `parts[i]`, a `for...of`, passing it,
   * storing it, returning it, aliasing it, any other method — could hand a
   * part back out, so each one keeps the conservative answer, and so does an
   * array that is not this function's own literal or `new Array`, because an
   * alias of it could be read where `parts` is not
   * (`tests/cases/mem_join_parts_*`). `noteUse` asks the same question of a
   * string parameter pushed onto `parts` (#503).
   */
  pushedIntoJoinedParts(expr: Node): boolean {
    const v = pushedOnto(this.unit, this.table, expr)
    if (
      v === null ||
      v.storage !== STORAGE_LOCAL ||
      !isJoinedParts(this.unit, this.table, v, this.declarationOf(v), this.refsOf(v))
    ) {
      return false
    }
    const visiting: Local[] = []
    return this.localOutcome(v, visiting).flow === FLOW_LOCAL
  }

  /** `receiver` names a local of this function bound to its own array literal or `new Array`, or null. */
  freshArrayLocal(receiver: Node): Local | null {
    const e = unwrapParens(receiver)
    const v: Local | null = e.kind === NodeKind.Ident ? this.unit.program.nodeLocals[e.id] : null
    return v !== null && isFreshArrayLocal(this.table, v, this.declarationOf(v)) ? v : null
  }

  /**
   * `xs[i] = expr` or `xs.push(expr)`, where `xs` is an array this function
   * allocated and does nothing with but fill, test and return: the value
   * takes `xs`'s own outcome rather than escaping into memory.
   *
   * The value is reachable only through `xs`'s elements, and every use of
   * `xs` is a plain element store, a push, `.length`, an element read that
   * is only tested (`xs[i] === null`), or `return xs` itself (`isCarrierUse`).
   * None of them hands an element back out, so the value lives exactly as
   * long as `xs` does: it dies with a `local` array, and it goes to the
   * caller with a returned one, which is what `returnsFreshElements` tells
   * the caller, whose analysis then follows the elements it reads out
   * (`isListingCall`). Without this a function that fills and returns an
   * array of fresh strings (`std/json.ts`'s `jsonFields`) lets an allocation
   * out, and every loop that calls it loses its per-pass release
   * (`LOOP_CALLEE_STORES`).
   *
   * As with `pushedIntoJoinedParts`, the narrowness is the proof: an alias,
   * a field or another array holding `xs`, an argument, an element read that
   * is kept, a compound store, or a `return` of anything but `xs` itself
   * could hand an element on, and each keeps the conservative answer
   * (`tests/cases/mem_return_array_*`). The outcome is never `stable`, so
   * the value is never an alloca whose one slot every pass would share.
   */
  storedIntoReturnedArray(expr: Node, visiting: Local[]): Outcome | null {
    const program = this.unit.program
    let node = expr
    let parent = this.unit.parents.parentOf(node)
    while (parent !== null && parent.kind === NodeKind.Paren) {
      node = parent
      parent = this.unit.parents.parentOf(node)
    }
    if (parent === null) {
      return null
    }
    let receiver: Node | null = null
    // An assignment's value is its right-hand side, so `h.f = (xs[0] = v)`
    // stores `v` twice: only a store standing as its own statement is carried.
    // A push answers the new length, a number, wherever it stands.
    if (parent.kind === NodeKind.Binary && parent.text === "=" && parent.children[1] === node) {
      const target = unwrapParens(parent.children[0])
      if (target.kind === NodeKind.Index && this.standsAlone(parent)) {
        receiver = target.children[0]
      }
    } else if (parent.kind === NodeKind.List) {
      const call = this.unit.parents.parentOf(parent)
      if (call !== null && isPushCall(program, this.table, call) && call.children[1] === parent) {
        receiver = call.children[0].children[0]
      }
    }
    const v: Local | null = receiver === null ? null : this.freshArrayLocal(receiver)
    if (receiver !== null && v === null && parent.kind === NodeKind.Binary) {
      return this.storedIntoChunkDst(parent, receiver)
    }
    // Only a string is carried. A string is one flat block, so the caller
    // follows all of it by following the array's elements; an array or an
    // object holds pointers of its own, which no caller follows a second
    // level down, so it keeps escaping as it always did. An array an arrow
    // captures is never a carrier: the arrow's reads are not among `refsOf`,
    // so `isCarrierUse` would pass an element the arrow keeps.
    if (v === null || this.table.stripNull(this.table.refOf(v.type)) !== T_STRING || this.isCaptured(v)) {
      return null
    }
    for (const ref of this.refsOf(v)) {
      if (!this.isCarrierUse(ref)) {
        return null
      }
    }
    const outcome = this.localOutcome(v, visiting)
    if (outcome.escapes || outcome.flow === FLOW_LEAKS) {
      return null
    }
    if (outcome.flow === FLOW_RETURNED) {
      this.result.returnsFreshElements = true
    }
    this.result.carriedStores.push(parent)
    this.result.carriers.push(v)
    return new Outcome(outcome.flow, false, false)
  }

  /**
   * `dst[i] = expr` standing alone in a map's chunk loop, where `dst` is the
   * parameter `chunkDstIndex` names and holds strings: the string goes to
   * whoever owns `dst`, so it `leaks` without escaping, and the function
   * fills that parameter (`fillsParam`). The store is carried, so a pass of
   * the loop does not release the string it just stored.
   */
  storedIntoChunkDst(store: Node, receiver: Node): Outcome | null {
    const at = chunkDstIndex(this.sig)
    const e = unwrapParens(receiver)
    const v: Local | null = e.kind === NodeKind.Ident ? this.unit.program.nodeLocals[e.id] : null
    if (
      at < 0 ||
      at >= this.sig.paramNames.length ||
      at >= this.sig.paramTypes.length ||
      v === null ||
      v.storage !== STORAGE_PARAM ||
      v.name !== this.sig.paramNames[at] ||
      this.table.stripNull(this.table.refOf(this.sig.paramTypes[at])) !== T_STRING
    ) {
      return null
    }
    this.result.fillsParam = at
    this.result.carriedStores.push(store)
    this.result.carriers.push(v)
    return new Outcome(FLOW_LEAKS, false, false)
  }

  /**
   * Each call of a function that fills its parameter `k` (`fillsParam`): the
   * strings it stores into argument `k` are this function's to account for.
   * A parameter of this function that the body only hands on to such calls
   * and reads the length of makes this function fill it in turn. A fresh
   * array of this function's own that is only filled, tested and returned
   * carries them as `storedIntoReturnedArray` carries a store: they die with
   * a `local` array and go to the caller with a returned one. Anything else
   * could hand a string on, and is an escape.
   */
  decideFills(): void {
    const program = this.unit.program
    for (const call of this.fills) {
      const callee = program.nodeCallees[call.id]
      const g: FunctionFacts | null = callee === null ? null : this.facts.get(callee.name)
      const args = call.children[1]
      if (
        callee === null ||
        callee.role !== ROLE_FUNCTION ||
        g === null ||
        g.fillsParam < 0 ||
        g.fillsParam >= args.children.length
      ) {
        this.result.noteEscape(call)
        continue
      }
      const arg = unwrapParens(args.children[g.fillsParam])
      const v: Local | null = arg.kind === NodeKind.Ident ? program.nodeLocals[arg.id] : null
      if (v !== null && v.storage === STORAGE_PARAM && this.forwardsFill(v)) {
        const at = this.sig.paramNames.indexOf(v.name)
        if (at >= 0 && (this.result.fillsParam < 0 || this.result.fillsParam === at)) {
          this.result.fillsParam = at
          this.result.carriedStores.push(call)
          this.result.carriers.push(v)
          continue
        }
      }
      const made: Local | null = v === null ? null : this.freshArrayLocal(arg)
      if (v !== null && made !== null && made === v && this.onlyFilled(v)) {
        const fresh: Local[] = []
        const outcome = this.localOutcome(v, fresh)
        if (!outcome.escapes && outcome.flow !== FLOW_LEAKS) {
          if (outcome.flow === FLOW_RETURNED) {
            this.result.returnsFreshElements = true
          }
          this.result.carriedStores.push(call)
          this.result.carriers.push(v)
          continue
        }
      }
      this.result.noteEscape(call)
    }
  }

  /** `ref` is the argument a call in `fills` passes where its callee fills. */
  isFillArgument(ref: Node): boolean {
    let node = ref
    let list = this.unit.parents.parentOf(node)
    while (list !== null && list.kind === NodeKind.Paren) {
      node = list
      list = this.unit.parents.parentOf(node)
    }
    const call: Node | null = list === null ? null : this.unit.parents.parentOf(list)
    if (
      list === null ||
      call === null ||
      list.kind !== NodeKind.List ||
      call.kind !== NodeKind.Call ||
      call.children[1] !== list
    ) {
      return false
    }
    const callee = this.unit.program.nodeCallees[call.id]
    const g: FunctionFacts | null = callee === null ? null : this.facts.get(callee.name)
    return (
      g !== null &&
      g.fillsParam >= 0 &&
      g.fillsParam < list.children.length &&
      list.children[g.fillsParam] === node
    )
  }

  /**
   * Parameter `v` of a plain function, not a lifted arrow, which may be
   * called where no analysis sees the call: the body does nothing with it but
   * pass it where a callee fills and read its length.
   */
  forwardsFill(v: Local): boolean {
    const body = this.sig.body()
    if (this.sig.lifted || this.sig.role !== ROLE_FUNCTION || body === null) {
      return false
    }
    const refs: Node[] = []
    identRefs(this.unit.program, body, v, refs)
    for (const ref of refs) {
      const access = this.unit.parents.parentOf(ref)
      const length =
        access !== null &&
        access.kind === NodeKind.Member &&
        access.children[0] === ref &&
        access.text === "length"
      if (!length && !this.isFillArgument(ref)) {
        return false
      }
    }
    return true
  }

  /**
   * Fresh array `v` is only filled, tested, returned and passed where a
   * callee fills, and no arrow names it, whose uses the collection skips.
   */
  onlyFilled(v: Local): boolean {
    const body = this.sig.body()
    if (body === null || this.table.stripNull(this.table.refOf(v.type)) !== T_STRING) {
      return false
    }
    const refs: Node[] = []
    identRefs(this.unit.program, body, v, refs)
    if (refs.length !== this.refsOf(v).length) {
      return false
    }
    for (const ref of refs) {
      if (!this.isCarrierUse(ref) && !this.isFillArgument(ref)) {
        return false
      }
    }
    return true
  }

  /** `node` is a statement's whole expression, so its value is dropped. */
  standsAlone(node: Node): boolean {
    let at = node
    let parent = this.unit.parents.parentOf(at)
    while (parent !== null && parent.kind === NodeKind.Paren) {
      at = parent
      parent = this.unit.parents.parentOf(at)
    }
    return parent !== null && parent.kind === NodeKind.ExprStmt
  }

  /** `ref` is `xs[i] = v`, `xs.push(v)`, `xs.length`, a tested `xs[i]`, or `return xs`, and nothing else. */
  isCarrierUse(ref: Node): boolean {
    const program = this.unit.program
    const access = this.unit.parents.parentOf(ref)
    if (access === null) {
      return false
    }
    if (access.kind === NodeKind.Index && access.children[0] === ref) {
      const above = this.unit.parents.parentOf(access)
      if (
        above !== null &&
        above.kind === NodeKind.Binary &&
        above.children[0] === access &&
        isAssignmentOperator(above.text)
      ) {
        // A compound store reads the element it replaces.
        return above.text === "="
      }
      return classifyUse(this.unit, this.table, access).kind === USE_NONE
    }
    if (access.kind === NodeKind.Member && access.children[0] === ref) {
      const above = this.unit.parents.parentOf(access)
      if (above !== null && above.kind === NodeKind.Call && above.children[0] === access) {
        return isPushCall(program, this.table, above)
      }
      // An assignment to `length` is refused for every array, so this is a read.
      return access.text === "length"
    }
    let node = ref
    let parent: Node | null = access
    while (parent !== null && parent.kind === NodeKind.Paren) {
      node = parent
      parent = this.unit.parents.parentOf(node)
    }
    return (
      parent !== null &&
      (parent.kind === NodeKind.Return ||
        ((parent.kind === NodeKind.FunctionDecl || parent.kind === NodeKind.Arrow) &&
          parent.children[3] === node))
    )
  }

  /**
   * In a listing (`this.listing`), `expr` is an array whose elements may be
   * new, and the use in front of it could hand one on where the walk does not
   * follow: an argument (the callee may keep or return an element it reads),
   * `pop`, or anything else but `.length`, `join`, `indexOf` and `push`. An
   * element read, a `for...of`, a local and a `return` are followed already.
   */
  handsOutElements(expr: Node): boolean {
    const program = this.unit.program
    const type = program.nodeTypes[expr.id]
    if (type < 0 || !this.table.isArray(this.table.stripNull(type))) {
      return false
    }
    let node = expr
    let access = this.unit.parents.parentOf(node)
    while (access !== null && access.kind === NodeKind.Paren) {
      node = access
      access = this.unit.parents.parentOf(node)
    }
    if (access === null || access.kind !== NodeKind.Member || access.children[0] !== node) {
      return true
    }
    const above = this.unit.parents.parentOf(access)
    if (above !== null && above.kind === NodeKind.Call && above.children[0] === access) {
      const method = arrayMethodName(program, this.table, above)
      return method !== "join" && method !== "indexOf" && method !== "push"
    }
    return access.text !== "length"
  }

  /**
   * The use is an argument to a parameter whose callee proved it keeps no
   * element of it (`elementsFree`), so the listing is not handed on there;
   * whether the callee keeps the array itself is `calleeCaptures`'s answer.
   */
  passesToFreeElements(found: ParamUse): boolean {
    const callee = found.callee
    return found.kind === USE_ARGUMENT && callee !== null && this.elementsFreeAt(callee, found.index)
  }

  /** Whether `callee` proved it keeps no element of its parameter `index` (`elementsFree`). */
  elementsFreeAt(callee: FunctionSig, index: i32): boolean {
    const g = this.facts.get(callee.name)
    if (g === null || index < 0 || index >= g.paramNames.length) {
      return false
    }
    const pointer = g.pointerParam(g.paramNames[index])
    return pointer !== null && pointer.elementsFree
  }

  memoised(v: Local): Outcome | null {
    let i = 0
    while (i < this.outcomeLocals.length) {
      if (this.outcomeLocals[i] === v) {
        return this.outcomeValues[i]
      }
      i = i + 1
    }
    return null
  }

  localOutcome(v: Local, visiting: Local[]): Outcome {
    const known = this.memoised(v)
    if (known !== null) {
      return known
    }
    // What the arrows that capture it do with it (`captureOutcome`), joined
    // with its other uses below. A capture with no target is an escape.
    let captures: Outcome | null = new Outcome(FLOW_LOCAL, true, false)
    if (this.isCaptured(v)) {
      captures = this.captureOutcome(v)
    }
    if (captures === null) {
      return new Outcome(FLOW_LEAKS, false, true)
    }
    for (const seen of visiting) {
      if (seen === v) {
        // `const y = x; const x2 = y` chains are acyclic, but `escapes` also
        // follows `y = x`, and two locals assigned to each other do cycle. The
        // re-entry is therefore pessimistic about escaping and optimistic about
        // the flow, which is what the existing decisions were computed with.
        return new Outcome(FLOW_LOCAL, true, true)
      }
    }
    visiting.push(v)
    let flow = captures.flow
    let stable = captures.stable
    let settled = captures.settled
    let escapes = captures.escapes
    for (const ref of this.refsOf(v)) {
      const parent = this.unit.parents.parentOf(ref)
      if (
        parent !== null &&
        parent.kind === NodeKind.Binary &&
        parent.children[0] === ref &&
        isAssignmentOperator(parent.text)
      ) {
        // `x = other`: the object is no longer named by `x`, and the stack
        // rule wants a fixed binding.
        stable = false
        continue
      }
      const step = this.valueOutcome(ref, visiting)
      flow = worse(flow, step.flow)
      stable = stable && step.stable
      settled = settled && step.settled
      escapes = escapes || step.escapes
    }
    const outcome = new Outcome(flow, stable, escapes)
    outcome.settled = settled
    this.outcomeLocals.push(v)
    this.outcomeValues.push(outcome)
    return outcome
  }

  valueOutcome(expr: Node, visiting: Local[]): Outcome {
    const target = this.flowTarget(expr)
    if (target.isReturn) {
      // WP17: `return r` on a by-value `Result` copies the two live words into
      // the return register; the object itself does not leave the frame, so it
      // is as local as one that is never returned at all.
      return new Outcome(this.returnsByValueResult ? FLOW_LOCAL : FLOW_RETURNED, true, false)
    }
    const local = target.local
    if (local !== null) {
      return this.localOutcome(local, visiting)
    }
    // A listing's element is followed out of the listing, so it is the
    // element's use that decides (`holder.name = names[0]` stores it).
    const used = target.used
    return this.useOutcome(this.listing && used !== null ? used : expr, visiting)
  }

  /**
   * The `string[]` parameters this function keeps no element of
   * (`freeElementParams`). Each reference to the parameter is read as a
   * listing's would be (`this.listing`): an element read out of it, a
   * `for...of` variable and an alias are followed to their uses, and the
   * parameter is free only when every use is `local` and nothing escapes. A
   * store into a field, a global or another array, a `return`, a `new`, an
   * argument to a callee that is not itself proved free (`passesToFreeElements`,
   * settled by the fixpoint in `analyzeFunctions`), and any other method all
   * keep it. `analyzeEscapes` asks only of a body that writes no arrow or
   * nested function, whose captures the walk does not follow, and of a lifted
   * arrow only about its captures, from `from` on.
   *
   * Only `string[]`: an element of a `string[][]` is an array whose own
   * strings this walk does not follow, so that parameter keeps the
   * conservative answer.
   */
  decideElementParams(body: Node, from: i32): void {
    const program = this.unit.program
    let i = from
    while (i < this.sig.paramNames.length && i < this.sig.paramTypes.length) {
      const type = this.table.stripNull(this.sig.paramTypes[i])
      if (
        type >= 0 &&
        this.table.isArray(type) &&
        this.table.stripNull(this.table.refOf(type)) === T_STRING
      ) {
        const refs: Node[] = []
        paramRefs(program, body, this.sig.paramNames[i], refs)
        if (this.elementsStay(refs)) {
          this.result.freeElementParams.push(this.sig.paramNames[i])
        }
      }
      i = i + 1
    }
  }

  /**
   * Every one of `refs` is a `local` use under the listing rule. The walk is
   * a question, not a decision, so what it records on the result as it goes
   * (`storedIntoReturnedArray`, `storedIntoChunkDst`) is put back after it.
   */
  elementsStay(refs: Node[]): boolean {
    const memoLocals = this.outcomeLocals
    const memoValues = this.outcomeValues
    const carriedStores = this.result.carriedStores
    const carriers = this.result.carriers
    const returnsFreshElements = this.result.returnsFreshElements
    const fillsParam = this.result.fillsParam
    this.outcomeLocals = []
    this.outcomeValues = []
    this.result.carriedStores = []
    this.result.carriers = []
    this.listing = true
    let stays = true
    let k = 0
    while (stays && k < refs.length) {
      const ref = refs[k]
      const parent = this.unit.parents.parentOf(ref)
      const rebinds =
        parent !== null &&
        parent.kind === NodeKind.Binary &&
        parent.children[0] === ref &&
        isAssignmentOperator(parent.text)
      if (!rebinds) {
        const fresh: Local[] = []
        const step = this.valueOutcome(ref, fresh)
        stays = step.flow === FLOW_LOCAL && !step.escapes
      }
      k = k + 1
    }
    this.listing = false
    this.outcomeLocals = memoLocals
    this.outcomeValues = memoValues
    this.result.carriedStores = carriedStores
    this.result.carriers = carriers
    this.result.returnsFreshElements = returnsFreshElements
    this.result.fillsParam = fillsParam
    return stays
  }

  // ---- Decisions ----------------------------------------------------------------------

  /** `Ok(v)`, `Err(e)`, or a call answering a by-value `Result`. */
  isResultSite(node: Node): boolean {
    if (node.kind !== NodeKind.Call) {
      return false
    }
    const program = this.unit.program
    const callee = program.nodeCallees[node.id]
    if (callee !== null) {
      return this.table.resultByValue(callee.returnType)
    }
    return isResultConstructorCall(program, this.table, node)
  }

  /** Whether `node` can run more than once a call: a loop of this function encloses it. */
  inLoop(node: Node): boolean {
    let at = this.unit.parents.parentOf(node)
    while (at !== null && at.kind !== NodeKind.Arrow && at.kind !== NodeKind.FunctionDecl) {
      if (isLoopKind(at)) {
        return true
      }
      at = this.unit.parents.parentOf(at)
    }
    return false
  }

  decide(): void {
    for (const site of this.sites) {
      const fresh: Local[] = []
      // A listing's outcomes are kept apart from every other site's: the
      // ordinary memo is set aside while it is decided, and comes back after.
      const memoLocals = this.outcomeLocals
      const memoValues = this.outcomeValues
      this.listing = isListingCall(this.unit.program, this.facts, site.node)
      if (this.listing) {
        this.outcomeLocals = []
        this.outcomeValues = []
      }
      const outcome = this.valueOutcome(site.node, fresh)
      // A listing returned on is this function's own: its callers follow it
      // too. An element of one returned alone is a fresh string like any other.
      if (
        this.listing &&
        outcome.flow === FLOW_RETURNED &&
        this.table.isArray(this.table.stripNull(this.sig.returnType))
      ) {
        this.result.returnsFreshElements = true
      }
      this.listing = false
      this.outcomeLocals = memoLocals
      this.outcomeValues = memoValues
      let flow = outcome.flow
      let escapes = outcome.escapes
      // A `new` object is also handed to its constructor as `this`; a
      // constructor that captures it makes the object escape however the
      // local is used afterwards.
      if (site.node.kind === NodeKind.New) {
        const ctor = constructorOf(this.unit.program, this.table, intrinsicType(this.unit.program, site.node))
        if (ctor !== null && this.calleeCaptures(ctor, 0)) {
          flow = FLOW_LEAKS
          // The constructor stored `this` somewhere the caller may reach.
          escapes = true
        }
      }
      if (escapes) {
        this.result.noteEscape(site.node)
      }
      if (site.callee.length > 0) {
        this.result.callSites.push(new CallSite(site.callee, flow, escapes, site.node))
        continue
      }
      if (site.stackable && this.opts.stackAlloc && flow === FLOW_LOCAL && outcome.stable) {
        this.result.stackSites[site.node.id] = true
        continue
      }
      if (
        site.stackable &&
        this.opts.stackAlloc &&
        flow === FLOW_LOCAL &&
        !escapes &&
        outcome.settled &&
        this.isResultSite(site.node) &&
        !this.inLoop(site.node)
      ) {
        this.result.stackSites[site.node.id] = true
        continue
      }
      this.result.arenaNodes.push(site.node)
      this.result.arenaFlows.push(flow)
      if (flow === FLOW_LOCAL) {
        this.result.directArena = true
      } else if (flow === FLOW_RETURNED) {
        this.result.returnsAllocation = true
      } else {
        this.result.allocLeaks = true
      }
    }

    this.decideFills()

    // WP17: the same decision for each by-value `Result` parameter. A
    // parameter never referenced has no refs and therefore no way to escape,
    // so its object stays an alloca (and the unpack is dead code the optimiser
    // removes).
    let p = 0
    while (p < this.sig.paramNames.length) {
      if (this.table.resultByValue(this.sig.paramTypes[p])) {
        const name = this.sig.paramNames[p]
        const v = this.paramLocal(name)
        let flow = FLOW_LOCAL
        let stable = true
        if (v !== null) {
          const fresh: Local[] = []
          const outcome = this.localOutcome(v, fresh)
          flow = outcome.flow
          stable = outcome.stable
          if (outcome.escapes) {
            this.result.noteEscape(this.refsOf(v)[0])
          }
        }
        if (this.opts.stackAlloc && flow === FLOW_LOCAL && stable) {
          this.result.stackParams.add(name)
        } else if (flow === FLOW_LOCAL) {
          this.result.directArena = true
        } else {
          this.result.allocLeaks = true
        }
      }
      p = p + 1
    }

    // Locals that hold nothing but a stack object: their initializer is a
    // stack site or such a local, and they are never reassigned. Source order
    // is declaration order, so an alias sees its source decided first.
    for (const decl of this.declarations) {
      const v = this.unit.program.nodeLocals[decl.id]
      if (v === null || decl.children[2].kind === NodeKind.Empty) {
        continue
      }
      const init = unwrapParens(decl.children[2])
      let holds = this.result.stackSites[init.id]
      if (!holds && init.kind === NodeKind.Ident) {
        const alias = this.unit.program.nodeLocals[init.id]
        holds = alias !== null && this.holdsStackObject(alias)
      }
      const visiting: Local[] = []
      if (holds && this.localOutcome(v, visiting).stable) {
        this.result.stackLocals.push(v)
      }
    }

    // `xs.push(v)`: growth memory belongs to `xs`. Fine when `xs` is a local
    // allocation of this function that flows `local` (the growth dies with
    // it); a leak otherwise (a parameter, a field, an element, a returned array).
    for (let k = 0; k < this.pushes.length; k++) {
      const push = this.pushes[k]
      const receiver = unwrapParens(this.pushReceivers[k])
      let v: Local | null = null
      if (receiver.kind === NodeKind.Ident) {
        v = this.unit.program.nodeLocals[receiver.id]
      }
      let owned = false
      // Someone else's array: the growth lives as long as that array does.
      let growth = FLOW_LEAKS
      // WP9: the growth is reachable exactly where the array it belongs to is.
      // An array this function allocated and only keeps or returns takes its
      // growth with it; anyone else's array leaves it reachable by the caller.
      let escapes = true
      if (v !== null && v.storage === STORAGE_LOCAL && this.ownsSite(v)) {
        const visiting: Local[] = []
        const outcome = this.localOutcome(v, visiting)
        owned = outcome.flow === FLOW_LOCAL
        growth = outcome.flow
        escapes = outcome.escapes
      }
      if (escapes) {
        this.result.noteEscape(push)
      }
      this.result.arenaNodes.push(push)
      this.result.arenaFlows.push(growth)
      if (owned) {
        this.result.directArena = true
      } else {
        this.result.allocLeaks = true
      }
    }
    if (this.logsNumbers) {
      this.result.directArena = true
    }
  }

  holdsStackObject(local: Local): boolean {
    for (const candidate of this.result.stackLocals) {
      if (candidate === local) {
        return true
      }
    }
    return false
  }

  /** `v` was initialised by an allocation site of this function, directly or through an alias. */
  ownsSite(v: Local): boolean {
    const decl = this.declarationOf(v)
    if (decl === null || decl.children[2].kind === NodeKind.Empty) {
      return false
    }
    const init = unwrapParens(decl.children[2])
    for (const site of this.sites) {
      if (site.node === init) {
        return true
      }
    }
    if (init.kind !== NodeKind.Ident) {
      return false
    }
    const alias = this.unit.program.nodeLocals[init.id]
    return alias !== null && alias.storage === STORAGE_LOCAL && alias !== v && this.ownsSite(alias)
  }

  declarationOf(v: Local): Node | null {
    for (const decl of this.declarations) {
      const declared = this.unit.program.nodeLocals[decl.id]
      if (declared !== null && declared === v) {
        return decl
      }
    }
    return null
  }
}

/**
 * WP9: may the caller reclaim the arena around a call to `callee`?
 *
 * The proof has two parts, and both are needed:
 *
 *  - **The callee's garbage is garbage.** `allocEscapes` is false, so nothing
 *    the callee allocated is reachable from anywhere the caller can see except
 *    through the value it returned. The caller holds no other pointer into the
 *    call, because a return value is the only thing a call hands back.
 *  - **The kept value can be moved.** Only a plain `string` qualifies: it is one
 *    flat block with no interior pointers, so relocating its bytes relocates the
 *    whole value. An array header points at a separate data block, a struct or a
 *    `Result` may hold pointers into other blocks, and `string | null` may be
 *    null, so none of them is moved.
 *
 * `allocates` is not part of the proof, only of the profit: a callee that never
 * bumps the arena has nothing to reclaim, so the pair of calls is skipped.
 */
export const reclaimsReturnedString = (callee: FunctionSig, facts: FactsTable): boolean => {
  // WP27 S3.2: a `declare function`'s copy is the caller's own allocation, the
  // last one the call makes, so there is nothing under it to reclaim.
  if (callee.returnType !== T_STRING || callee.foreign() || facts.noElision) {
    return false
  }
  const g = facts.get(callee.name)
  return g !== null && g.allocates && !g.allocEscapes && g.fillsParam < 0
}

/**
 * WP6: is this call the last thing its function does?
 *
 * Two lowerings read the answer, and both need the same proof:
 *
 *  - the call is marked `tail`, which tells LLVM the callee cannot reach this
 *    frame's stack slots, so the frame may be popped before the jump — that is
 *    what gives a tail recursion constant stack in *every* profile, including
 *    `--profile debug`, where no optimiser runs at all;
 *  - a function with an automatic arena scope releases *before* the call
 *    rather than after it, so that `@nish_arena_release` does not sit between
 *    the call and the `ret` (`emitScopeExit` in the return emitter is what
 *    would otherwise put it there, and work after a call is what stops the
 *    call being last).
 *
 * The proof:
 *
 *  - **The callee holds no pointer into this frame.** Every argument is a
 *    scalar — a number, a `bool` or an `enum` — so there is nothing for the
 *    call to dereference: not a stack slot the `tail` marker promises the
 *    callee cannot see, and not arena memory above the mark the release
 *    reclaims. This is what refuses the shape that looks most like it should
 *    qualify, `return step(n - 1, acc + piece)` with a `string` accumulator:
 *    that argument *is* memory above the mark.
 *  - **Every argument is written down.** A method's receiver is a parameter
 *    that the argument list does not carry, and it is a pointer by
 *    construction, so a signature with more parameters than arguments is one
 *    whose first argument was never looked at. Comparing the two counts is how
 *    that is refused rather than assumed.
 *  - **The caller holds nothing either.** The call is the whole of a `return`,
 *    which is the return emitter's to know and is why it is told rather than
 *    looked up: no local of this frame is read after it, and the value it
 *    answers is the callee's own, allocated above the mark a release restored.
 *  - **Nothing observes the bump position in between.** This one is the
 *    scope's alone: a callee that *reads* the
 *    position — `Arena.mark`, `Arena.used` — would answer a smaller number
 *    than it does today. `readsArenaState` is that fact, propagated over the
 *    call graph like the other one, and it is what keeps the sink invisible to
 *    a program rather than merely harmless. A function with no scope releases
 *    nothing, so it asks nothing of its callee here.
 *
 * The two brackets that also emit work after a call are excluded rather than
 * relied upon to be absent: a packed `Result` is unpacked into an object
 * afterwards (WP17), and a reclaimed string is handed to `nish_arena_keep`
 * (WP9, `reclaimsReturnedString`). Neither can co-occur with a scope that
 * reaches this far, but the marker is not the scope's: without them both
 * lowerings would be claiming a last instruction that is not last.
 */
export const marksTailCall = (
  table: TypeTable,
  caller: FunctionFacts,
  callee: FunctionSig,
  argTypes: i32[],
  facts: FactsTable
): boolean => {
  if (table.resultByValue(callee.returnType) || reclaimsReturnedString(callee, facts)) {
    return false
  }
  if (argTypes.length > callee.paramTypes.length) {
    return false
  }
  // A parameter the call leaves out passes its default, a constant or an
  // earlier argument, which is as much a scalar as the parameter's type.
  for (let k = argTypes.length; k < callee.paramTypes.length; k = k + 1) {
    if (callee.defaultOf(k) === null || !isScalarArgument(table, callee.paramTypes[k])) {
      return false
    }
  }
  for (const type of argTypes) {
    if (!isScalarArgument(table, type)) {
      return false
    }
  }
  const g = facts.get(callee.name)
  if (g === null) {
    return false
  }
  return !caller.arenaScope || !g.readsArenaState
}

/**
 * A value that cannot name this frame's memory, so neither a release below it
 * nor a popped frame leaves the callee holding anything. The list names what
 * is allowed rather than what is not, for the reason `isPointerParam` in
 * attributes.ts does: the next pointer-shaped type has to be admitted by
 * someone on purpose.
 */
export const isScalarArgument = (table: TypeTable, type: i32): boolean =>
  isNumeric(type) || type === T_BOOL || table.enumBase(type) >= 0 || table.isHostHandle(type)

/**
 * Whether nothing that existed before a call to `sig` can be made to hold a
 * pointer while it runs: every parameter, `this` included, is a scalar, a
 * string, or an object whose every field is a number, a boolean or an enum.
 *
 * This is the half of `FunctionFacts.contained` that needs no escape analysis
 * at all, and the argument is about where a pointer could be written rather
 * than about what the body does:
 *
 *  - **Memory older than the call is reachable only from the parameters.** The
 *    one mutable global is module storage, whose elements are pointer-free;
 *    every other module constant is a scalar or a string, a class has no
 *    `static` member, and `process.argv` refuses every store and `push`
 *    (`reject_argv_assign`, `reject_argv_push`). A callee can
 *    reach no more than it is handed, and what it is handed is either one of
 *    these parameters, something reached through them, or memory allocated
 *    during the call. C holds none of them past a call either: the only
 *    pointers this compiler allocated that cross the C boundary are a
 *    `string`'s bytes and a `u8[]`'s data block, each lent to a `declare
 *    function` for the length of that call, and the C function may keep
 *    neither (WP27 S3.1, `docs/wp27-ffi.md` §8b; WP53 B1.2,
 *    `docs/wp53-ffi-buffers-handles.md` §3a). A `u8[]` C writes through is
 *    written by the call, and holds bytes, not pointers.
 *  - **None of that memory has a slot a pointer fits in.** A pointer outlives
 *    a call only by being stored, and a scalar field has no room for one. A
 *    string is immutable. An array is refused even of numbers, because a
 *    `push` that grows it moves its data block into the arena and leaves the
 *    old header pointing at it, and so is every field of an object, array,
 *    string or `Result` type.
 *
 * So everything the call allocates is reachable afterwards only through its
 * return value, whatever its callees do with it, which is the whole of
 * containment. `List.benchmark` in the Are We Fast Yet suite is the shape this
 * is for: it hands three fresh lists to a callee that returns one of them, which
 * the per-value analysis above has to count as a capture.
 */
export const rootsHoldNoPointer = (program: CheckedProgram, table: TypeTable, sig: FunctionSig): boolean => {
  for (const type of sig.paramTypes) {
    if (!holdsNoPointerSlot(program, table, type)) {
      return false
    }
  }
  return true
}

const holdsNoPointerSlot = (program: CheckedProgram, table: TypeTable, type: i32): boolean => {
  if (isScalarArgument(table, type)) {
    return true
  }
  const inner = table.stripNull(type)
  if (inner === T_STRING) {
    return true
  }
  if (!table.isStruct(inner)) {
    return false
  }
  const info = program.struct(table.nameOf(inner))
  if (info === null) {
    return false
  }
  for (const field of info.fields) {
    if (!isScalarArgument(table, field.type)) {
      return false
    }
  }
  return true
}

/** Every identifier under `node` that names `local`, arrow bodies included. */
const identRefs = (program: CheckedProgram, node: Node, local: Local, out: Node[]): void => {
  const named: Local | null = node.kind === NodeKind.Ident ? program.nodeLocals[node.id] : null
  if (named !== null && named === local) {
    out.push(node)
  }
  for (const child of node.children) {
    identRefs(program, child, local, out)
  }
}

/** Every reference to the parameter called `name` in `node`. */
const paramRefs = (program: CheckedProgram, node: Node, name: string, out: Node[]): void => {
  if (node.kind === NodeKind.Ident) {
    const local = program.nodeLocals[node.id]
    if (local !== null && local.storage === STORAGE_PARAM && local.name === name) {
      out.push(node)
    }
  }
  for (const child of node.children) {
    paramRefs(program, child, name, out)
  }
}

/** `node` writes an arrow or a function inside it. */
const namesNestedFunction = (node: Node): boolean => {
  for (const child of node.children) {
    if (child.kind === NodeKind.Arrow || child.kind === NodeKind.FunctionDecl || namesNestedFunction(child)) {
      return true
    }
  }
  return false
}

export const analyzeEscapes = (
  unit: AnalysisUnit,
  table: TypeTable,
  sig: FunctionSig,
  facts: FactsTable,
  opts: Options
): EscapeResult => {
  const analysis = new EscapeAnalysis(
    unit,
    table,
    facts,
    opts,
    unit.program.nodeTypes.length,
    sig,
    table.resultByValue(sig.returnType)
  )
  const body = sig.body()
  if (body === null) {
    return analysis.result
  }
  analysis.visit(body)
  analysis.decide()
  // An arrow's written parameters keep the conservative answer. Its captures
  // are decided, because the function that wrote the arrow reads each one as
  // an argument to it (`captureTarget`), and a capture this proves nothing
  // about would read as kept anyway.
  if (!sig.lifted && !namesNestedFunction(body)) {
    analysis.decideElementParams(body, 0)
  } else if (sig.lifted && sig.capturesForCall && !namesNestedFunction(body)) {
    analysis.decideElementParams(body, sig.writtenArity())
  }
  return analysis.result
}

// ---- Per-pass arena scopes ----------------------------------------------------------------
//
// The function scope above reclaims what a call allocated when the call
// returns, so a loop that builds and drops a temporary on every pass still
// holds every pass's temporaries until then, and holds them for good when the
// function returns a pointer and gets no scope at all (#216). This brackets
// the pass instead: `nish_arena_mark` at the top of the body, and
// `nish_arena_release` on every edge that leaves it.
//
// **The rule.** Nothing allocated during one pass, by the body or by anything
// it calls, is reachable once the pass is over except through a scalar. The
// ways out of a pass are a local declared outside the body, memory older than
// the pass, and a `return`, and each is closed by one clause:
//
//  - **Memory.** No allocation of the pass is stored into memory at all: no
//    site in the body `escapes` (`escapingNodes`), and no callee lets one out
//    (`allocEscapes`, already propagated over its own callees). This is the
//    fact `FunctionFacts.contained` is built on, and it has the same
//    consequence here: a pointer read back out of memory during the pass was
//    not allocated during it, so reading one is safe to keep. The one read
//    that answers memory it did not load is an inline element (`xs[i]` is the
//    address of a slot), which the classifiers follow as the array itself
//    (`yieldsInteriorPointer`), and `isOld` asks for its array.
//  - **Outer locals.** An assignment in the body to a local declared outside
//    it (a parameter, a `for` initialiser, the variable of the `for...of`
//    being scoped) of a type that can hold a pointer stores a value `isOld`
//    proves predates the pass: a literal, `this`, an outer local, a field or
//    element read, the `const` variable of a nested `for...of` over an old
//    array, a call to a function that allocates nothing, or a choice between
//    two of those. `s = s + x` is refused, and so is every `+=` on a
//    pointer type. A `push` grows an array's data block in the arena, so it is
//    allowed only onto a `const` the pass itself initialised with a fresh
//    array.
//  - **Return.** A `return` in the body that answers a pointer answers one
//    `isOld` proves, because the release runs before the `ret`. A scalar is
//    computed first and returned after the release; `orReturn` builds a
//    `Result` and is refused.
//  - **Arena control.** A function that calls `Arena.mark` itself takes no
//    per-pass scope: its author is already managing that memory.
//
// **The placement** is the emitter's (`emitPass` in emit.ts): the mark is the
// first instruction of the body, so it dominates every release inside it; a
// `break` or `continue` releases the passes it leaves, a `return` releases the
// outermost scope open (the function's own, or the outermost scoped loop's),
// and the body falling through releases before the back-edge. A `for` loop's
// condition and incrementor run outside the bracket, after the release, and
// can only read outer locals, which hold nothing the release freed.
//
// **Profit**, not proof, is the last clause: the pass must bump the arena
// itself (`arenaNodes`) or call something that leaves memory behind
// (`netAllocates`), or the bracket would be two runtime calls around nothing.

/** Whether `list` holds `local`, by identity. */
const holdsLocal = (list: Local[], local: Local): boolean => {
  for (const candidate of list) {
    if (candidate === local) {
      return true
    }
  }
  return false
}

/** Why a loop's passes are not scoped, for the arena-loop diagnostic. */
const LOOP_NOTHING: i32 = 0
/** An allocation of the pass is stored into memory (`at`). */
const LOOP_STORED: i32 = 1
/** A callee stores an allocation into memory (`name`). */
const LOOP_CALLEE_STORES: i32 = 2
/** The pass keeps an allocation in a local declared outside the loop (`at`, `name`). */
const LOOP_OUTER_LOCAL: i32 = 3
/** The pass grows an array older than itself (`at`, `name`). */
const LOOP_OUTER_PUSH: i32 = 4
/** The pass returns an allocation (`at`). */
const LOOP_RETURN: i32 = 5
/** The function takes an `Arena.mark` of its own. */
const LOOP_CONTROL: i32 = 6
/** A callee has no facts to read (`name`). */
const LOOP_UNSEEN: i32 = 7
/** A `using a = arena()` block stores what it allocated into a field (`at`). Blocks only, as is the one below. */
const BLOCK_FIELD: i32 = 8
/** A `using a = arena()` block stores what it allocated into an array element (`at`). */
const BLOCK_ELEMENT: i32 = 9
/**
 * A `using a = arena()` block files a task on a scope declared outside it, or a
 * pass hands one what it allocated (`at`, `name`).
 */
const BLOCK_SPAWN: i32 = 10

/** The walk over one loop body that decides its `LoopScope`. */
class PassWalk {
  unit: AnalysisUnit
  table: TypeTable
  facts: FactsTable
  scope: LoopScope
  /** The locals the body declares, nested loops' included: a fresh binding every pass. */
  locals: Local[]
  /** The `const` variables of the `for...of` loops nested in the body, and the arrays they walk. */
  elementLocals: Local[]
  elementSources: Node[]
  /** The body's own locals it binds to a `readdirSync` listing, whose elements are as new as it (CG-5). */
  listingLocals: Local[]
  /** The pass bumps the arena, itself or through a callee that leaves memory behind. */
  allocates: boolean
  /**
   * The walk is over a `using a = arena()` block rather than a loop's pass
   * (`decideArenaBlock`): the release is the program's, so arena control and
   * a task filed on an outer scope are refused here rather than for the whole
   * function, and the stores the loop rule leaves to `escapingNodes` are named.
   */
  block: boolean
  /** The function returns a `Result` packed into a register (WP17), which a block, or a pass from a register call, may hand back. */
  returnsByValue: boolean
  /**
   * The block's own `using` declarators ahead of its `arena()`: disposed
   * after the arena releases, so as old as the block. A scope declared there
   * joins once the block has released what its tasks were handed.
   */
  outer: Local[]

  constructor(unit: AnalysisUnit, table: TypeTable, facts: FactsTable, scope: LoopScope) {
    this.unit = unit
    this.table = table
    this.facts = facts
    this.scope = scope
    this.locals = []
    this.elementLocals = []
    this.elementSources = []
    this.allocates = false
    this.listingLocals = []
    this.block = false
    this.returnsByValue = false
    this.outer = []
  }

  /** `receiver` is a listing this pass made: the call itself, or one of the body's locals bound to one. */
  isPassListing(receiver: Node): boolean {
    const e = unwrapParens(receiver)
    if (isListingCall(this.unit.program, this.facts, e)) {
      return true
    }
    const local: Local | null = e.kind === NodeKind.Ident ? this.unit.program.nodeLocals[e.id] : null
    return local !== null && holdsLocal(this.listingLocals, local)
  }

  /** Record the first reason, in the order the body is read. */
  refuse(why: i32, at: Node | null, name: string): void {
    if (this.scope.why === LOOP_NOTHING) {
      this.scope.why = why
      this.scope.at = at
      this.scope.name = name
    }
  }

  declaredInPass(local: Local): boolean {
    return holdsLocal(this.locals, local) && !holdsLocal(this.outer, local)
  }

  /**
   * A value stored into an array that is returned with it (`carriedStores`)
   * is in memory older than the pass unless the pass declared the array, so
   * it is a store like any other here. Called after `visit`, which records
   * the pass's own locals.
   */
  refuseCarriedStores(f: FunctionFacts, start: i32, end: i32): void {
    let i = 0
    while (i < f.carriedStores.length) {
      const store = f.carriedStores[i]
      if (store.start >= start && store.end <= end && !this.declaredInPass(f.carriers[i])) {
        this.refuse(LOOP_STORED, store, "")
      }
      i = i + 1
    }
  }

  /**
   * `expr` answers nothing the pass allocated: see the header. Anything not
   * listed is assumed fresh.
   */
  isOld(expr: Node): boolean {
    const program = this.unit.program
    const e = unwrapParens(expr)
    const type = program.nodeTypes[e.id]
    if (type >= 0 && isScalarArgument(this.table, type)) {
      return true
    }
    if (e.kind === NodeKind.Null || e.kind === NodeKind.String || e.kind === NodeKind.This) {
      return true
    }
    if (e.kind === NodeKind.Ident) {
      const local = program.nodeLocals[e.id]
      if (local === null || !this.declaredInPass(local)) {
        return true
      }
      // A `const` element of an array older than the pass is as old as a read of it.
      let i = 0
      while (i < this.elementLocals.length) {
        if (this.elementLocals[i] === local) {
          return this.isOld(this.elementSources[i])
        }
        i = i + 1
      }
      return false
    }
    if (e.kind === NodeKind.Member) {
      return true
    }
    if (e.kind === NodeKind.Index) {
      // An element of a listing's element (`rows[i][j]`) is as new as the listing.
      const holder = unwrapParens(e.children[0])
      if (this.isPassListing(holder) || (holder.kind === NodeKind.Index && !this.isOld(holder))) {
        return false
      }
      return !storesInlineElements(program, this.table, e.children[0]) || this.isOld(e.children[0])
    }
    if (e.kind === NodeKind.Conditional) {
      return this.isOld(e.children[1]) && this.isOld(e.children[2])
    }
    // WP32: `m.get(k) ?? d` is a value read out of the map, or `d`. A
    // `T | null` on the left is either operand, as a ternary's arms are: a
    // fresh object there is as new as it would be on its own.
    if (e.kind === NodeKind.Binary && e.text === "??") {
      if (!coalescesMaybe(program, this.table, e)) {
        return this.isOld(e.children[0]) && this.isOld(e.children[1])
      }
      return this.isOld(e.children[1])
    }
    // A call that answers a `Result` in a register (WP17) is boxed by this
    // function, in the pass, however little its callee allocates (#899).
    if (e.kind === NodeKind.Call && !this.answersInRegister(e)) {
      const callee = program.nodeCallees[e.id]
      const g: FunctionFacts | null = callee === null ? null : this.facts.get(callee.name)
      return g !== null && !g.allocates
    }
    return false
  }

  /** `expr` calls a function that answers a `Result` in a register, which the caller boxes (WP17). */
  answersInRegister(expr: Node): boolean {
    const e = unwrapParens(expr)
    const callee: FunctionSig | null = e.kind === NodeKind.Call ? this.unit.program.nodeCallees[e.id] : null
    return callee !== null && this.table.resultByValue(callee.returnType)
  }

  /** A call of `callee` in the pass, at `node`. */
  visitCallee(callee: FunctionSig, node: Node): void {
    const g = this.facts.get(callee.name)
    if (g === null) {
      this.refuse(LOOP_UNSEEN, node, callee.sourceName)
      return
    }
    if (g.allocEscapes) {
      this.refuse(LOOP_CALLEE_STORES, node, callee.sourceName)
    }
    if (g.netAllocates) {
      this.allocates = true
    }
    // A task runs, and its answer is stored, when its scope joins: after this
    // block has released, for a scope the block did not declare. A pass may
    // file one on an older scope with what is older than the pass: what the
    // pass allocated would be released before the task reads it. A scope the
    // block's own `using` declares ahead of its last `arena()` joins after
    // that release as well, and is held to the pass's rule.
    if (isSpawnEntry(callee) && node.children[0].kind === NodeKind.Member) {
      const receiver = unwrapParens(node.children[0].children[0])
      const local: Local | null =
        receiver.kind === NodeKind.Ident ? this.unit.program.nodeLocals[receiver.id] : null
      if (local === null || !this.declaredInPass(local)) {
        const args = node.children[1].children
        let handsNew = this.block && (local === null || !holdsLocal(this.outer, local))
        let i = 0
        while (!handsNew && i < args.length) {
          handsNew = !this.isOld(args[i])
          i = i + 1
        }
        if (handsNew) {
          this.refuse(BLOCK_SPAWN, node, receiver.kind === NodeKind.Ident ? receiver.text : "")
        }
      }
    }
  }

  /**
   * `xs.push(v)` grows `xs` in the arena, and `spawnPiped` (or `spawnPipedWithin`) its `stdout` and
   * `stderr`: fine for an array this pass made, a leak into any other.
   */
  visitPush(call: Node, grown: Node): void {
    const program = this.unit.program
    const receiver = unwrapParens(grown)
    const local: Local | null = receiver.kind === NodeKind.Ident ? program.nodeLocals[receiver.id] : null
    if (local !== null && !local.mutable && this.declaredInPass(local) && this.freshArray(local)) {
      return
    }
    this.refuse(LOOP_OUTER_PUSH, call, receiver.kind === NodeKind.Ident ? receiver.text : "")
  }

  /** The body declares `local` with a fresh array: a literal or `new Array`. */
  freshArray(local: Local): boolean {
    return this.initialiserIsFresh(this.scope.body, local)
  }

  initialiserIsFresh(node: Node, local: Local): boolean {
    const declared: Local | null =
      node.kind === NodeKind.VarDecl ? this.unit.program.nodeLocals[node.id] : null
    if (declared !== null && declared === local) {
      const init = unwrapParens(node.children[2])
      return init.kind === NodeKind.Array || init.kind === NodeKind.New
    }
    for (const child of node.children) {
      if (this.initialiserIsFresh(child, local)) {
        return true
      }
    }
    return false
  }

  /**
   * One walk, in source order, which is also declaration order: a local is
   * recorded as the body's own when its declaration is reached, before any
   * use of it can be.
   */
  visit(node: Node): void {
    const program = this.unit.program
    if (node.kind === NodeKind.Arrow) {
      return
    }
    if (node.kind === NodeKind.VarDecl) {
      const local = program.nodeLocals[node.id]
      if (local !== null) {
        this.locals.push(local)
        if (this.isPassListing(node.children[2])) {
          this.listingLocals.push(local)
        }
      }
    } else if (node.kind === NodeKind.ForOf) {
      const variable = program.nodeLocals[node.children[0].children[0].children[0].id]
      if (variable !== null && !variable.mutable) {
        this.elementLocals.push(variable)
        this.elementSources.push(node.children[1])
      }
    }
    if (node.kind === NodeKind.Call) {
      const callee = program.nodeCallees[node.id]
      if (callee !== null) {
        this.visitCallee(callee, node)
      } else if (isPushCall(program, this.table, node)) {
        this.visitPush(node, node.children[0].children[0])
      } else if (isSpawnPipedArity(builtinNameOf(program, node), node)) {
        this.visitPush(node, node.children[1].children[2])
        this.visitPush(node, node.children[1].children[3])
      } else if (resultMethodName(program, this.table, node) === "orReturn") {
        // A block's release follows the packing of a register `Result`, whose
        // payloads are numbers; a pass's release does not wait for anything.
        if (!this.block || !this.returnsByValue) {
          this.scope.handsBack = true
          this.refuse(LOOP_RETURN, node, "")
        }
      }
    } else if (node.kind === NodeKind.New) {
      const ctor = constructorOf(program, this.table, intrinsicType(program, node))
      if (ctor !== null) {
        this.visitCallee(ctor, node)
      }
    } else if (node.kind === NodeKind.Binary && isAssignmentOperator(node.text)) {
      const target = unwrapParens(node.children[0])
      const local: Local | null = target.kind === NodeKind.Ident ? program.nodeLocals[target.id] : null
      if (
        local !== null &&
        !this.declaredInPass(local) &&
        !isScalarArgument(this.table, local.type) &&
        (node.text !== "=" || !this.isOld(node.children[1]))
      ) {
        this.refuse(LOOP_OUTER_LOCAL, node, local.name)
      }
      if (local !== null && this.declaredInPass(local) && this.isPassListing(node.children[1])) {
        this.listingLocals.push(local)
      }
      if (this.block && (target.kind === NodeKind.Member || target.kind === NodeKind.Index)) {
        const type = program.nodeTypes[target.id]
        if (
          !(type >= 0 && isScalarArgument(this.table, type)) &&
          (node.text !== "=" || !this.isOld(node.children[1]))
        ) {
          this.refuse(target.kind === NodeKind.Member ? BLOCK_FIELD : BLOCK_ELEMENT, node, "")
        }
      }
    } else if (node.kind === NodeKind.Return) {
      const value = node.children[0]
      // A block hands back nothing through a `void` call. A function that
      // answers a `Result` in a register packs every `return` value before
      // the release (`emitReturnValue`), whatever its form: `f()`,
      // `c ? f() : g()` or `a ?? f()` from a pass, as from a block. The
      // caller's box `isOld` counts as new is read out before the release.
      const handsNothing = this.returnsByValue || (this.block && program.nodeTypes[value.id] === T_VOID)
      if (value.kind !== NodeKind.Empty && !handsNothing && !this.isOld(value)) {
        this.scope.handsBack = true
        this.refuse(LOOP_RETURN, node, "")
      }
    }
    for (const child of node.children) {
      this.visit(child)
    }
  }
}

/** The statement a loop runs on every pass. */
const loopBody = (loop: Node): Node => {
  if (loop.kind === NodeKind.While) {
    return loop.children[1]
  }
  if (loop.kind === NodeKind.Do) {
    return loop.children[0]
  }
  return loop.kind === NodeKind.For ? loop.children[3] : loop.children[2]
}

const within = (outer: Node, node: Node): boolean => node.start >= outer.start && node.end <= outer.end

/** A `for`, `for...of`, `while` or `do...while`: a statement that can have a pass scope. */
export const isLoopKind = (node: Node): boolean =>
  node.kind === NodeKind.For ||
  node.kind === NodeKind.ForOf ||
  node.kind === NodeKind.While ||
  node.kind === NodeKind.Do

/**
 * Decide the per-pass scope of every loop in `sig`, into `f.loopScopes`, once
 * the fixpoint and the function scopes are settled. See the header above.
 */
export const decideLoopScopes = (
  unit: AnalysisUnit,
  table: TypeTable,
  sig: FunctionSig,
  f: FunctionFacts,
  facts: FactsTable
): void => {
  const body = sig.body()
  // A function that allocates nothing, itself or through a callee, has no
  // pass to reclaim and no loop the arena-loop diagnostic could name.
  if (body !== null && f.allocates) {
    collectLoopScopes(unit, table, f, facts, table.resultByValue(sig.returnType), body)
  }
}

/**
 * Every loop under `node`, found through statements alone: a loop is a
 * statement, and an arrow's body is another function's, so no expression can
 * hold one.
 */
const collectLoopScopes = (
  unit: AnalysisUnit,
  table: TypeTable,
  f: FunctionFacts,
  facts: FactsTable,
  returnsByValue: boolean,
  node: Node
): void => {
  const kind = node.kind
  if (isLoopKind(node)) {
    const scope = new LoopScope(node, loopBody(node))
    decidePass(unit, table, f, facts, returnsByValue, scope)
    f.loopScopes.push(scope)
    collectLoopScopes(unit, table, f, facts, returnsByValue, scope.body)
  } else if (
    kind === NodeKind.Block ||
    kind === NodeKind.Labeled ||
    kind === NodeKind.List ||
    kind === NodeKind.Switch ||
    kind === NodeKind.Case ||
    kind === NodeKind.Default
  ) {
    for (const child of node.children) {
      collectLoopScopes(unit, table, f, facts, returnsByValue, child)
    }
  } else if (kind === NodeKind.If) {
    collectLoopScopes(unit, table, f, facts, returnsByValue, node.children[1])
    collectLoopScopes(unit, table, f, facts, returnsByValue, node.children[2])
  }
}

const decidePass = (
  unit: AnalysisUnit,
  table: TypeTable,
  f: FunctionFacts,
  facts: FactsTable,
  returnsByValue: boolean,
  scope: LoopScope
): void => {
  const walk = new PassWalk(unit, table, facts, scope)
  walk.returnsByValue = returnsByValue
  if (f.managesArena) {
    walk.refuse(LOOP_CONTROL, null, "")
    return
  }
  const body = scope.body
  for (const node of f.escapingNodes) {
    if (within(body, node)) {
      walk.refuse(LOOP_STORED, node, "")
    }
  }
  for (const node of f.arenaNodes) {
    if (within(body, node)) {
      walk.allocates = true
    }
  }
  walk.visit(body)
  walk.refuseCarriedStores(f, body.start, body.end)
  scope.allocates = walk.allocates
  scope.scoped = scope.why === LOOP_NOTHING && walk.allocates
}

/**
 * Whether `body` allocates, read off the facts without the walk: an
 * allocation of the function's own inside it, or a call inside it to a
 * function that leaves memory behind, whatever the call answers. What
 * `--explain-memory` asks of a pass the scope decision refused before its
 * walk (`LOOP_CONTROL`, `--no-elision`) or never reached, and of a loop's
 * condition and update.
 */
const passCallsAllocate = (
  unit: AnalysisUnit,
  table: TypeTable,
  f: FunctionFacts,
  facts: FactsTable,
  body: Node
): boolean => {
  for (const node of f.arenaNodes) {
    if (within(body, node)) {
      return true
    }
  }
  return callsLeaveMemory(unit.program, table, facts, body)
}

/**
 * Whether `node` itself calls a function that leaves memory behind: a call,
 * or a `new` whose constructor does, as `PassWalk.visit` charges them.
 */
const leavesMemory = (program: CheckedProgram, table: TypeTable, facts: FactsTable, node: Node): boolean => {
  const callee = calleeAt(program, table, node)
  if (callee === null) {
    return false
  }
  // A callee with no facts may allocate, as `PassWalk.visitCallee` refuses it.
  const g = facts.get(callee.name)
  return g === null || g.netAllocates
}

/** The function `node` itself runs: a call's callee, or a `new`'s constructor; null for anything else. */
const calleeAt = (program: CheckedProgram, table: TypeTable, node: Node): FunctionSig | null => {
  if (node.kind === NodeKind.Call) {
    return program.nodeCallees[node.id]
  }
  if (node.kind === NodeKind.New) {
    return constructorOf(program, table, intrinsicType(program, node))
  }
  return null
}

/** A call or `new` under `node` that leaves memory behind. An arrow's body is another function's. */
const callsLeaveMemory = (
  program: CheckedProgram,
  table: TypeTable,
  facts: FactsTable,
  node: Node
): boolean => {
  if (node.kind === NodeKind.Arrow) {
    return false
  }
  if (leavesMemory(program, table, facts, node)) {
    return true
  }
  for (const child of node.children) {
    if (callsLeaveMemory(program, table, facts, child)) {
      return true
    }
  }
  return false
}

/**
 * A call or `new` under `node` into a function this analysis has no facts
 * for, which `PassWalk.visitCallee` refuses without counting it as
 * allocating. An arrow's body is another function's.
 */
const callsUnseen = (program: CheckedProgram, table: TypeTable, facts: FactsTable, node: Node): boolean => {
  if (node.kind === NodeKind.Arrow) {
    return false
  }
  const callee = calleeAt(program, table, node)
  if (callee !== null && facts.get(callee.name) === null) {
    return true
  }
  for (const child of node.children) {
    if (callsUnseen(program, table, facts, child)) {
      return true
    }
  }
  return false
}

// ---- `using a = arena()` ------------------------------------------------------------------
//
// A block that declares `using a = arena()` takes the mark at the declaration
// and releases to it on every edge that leaves the block (`openScope` in
// emit-parallel.ts). That is the per-pass bracket above written by the
// program, and it is held to the same rule with the block as the pass: from
// the declaration to the block's end, nothing allocated may become reachable
// from a local declared outside, from memory older than the block, or from
// what the function returns. What differs is the answer when the rule fails.
// A loop that fails it only loses an optimisation; a block that fails it is
// refused, naming the value and where it would escape to, because the release
// is the program's and would free memory still in use.
//
// The block adds two refusals a pass leaves to the whole function. A `spawn` on a scope the block did not declare is refused, because that
// task runs and stores its answer when its scope joins, after the release.
// And a store into a field or an element is named as such, ahead of the
// `escapingNodes` sweep that would also find it, so the message says where
// the value went; the sweep stays as the rule, and catches what the syntax
// does not show (a value handed to a callee that keeps it, an object literal
// holding it).
//
// What the release does not need is a proof that the block allocates: an
// empty bracket costs two runtime calls and is what the program wrote.

/** Whether `stmt` is a `using` declaration that opens an arena: one of its initialisers is `arena()`. */
export const isArenaUsing = (program: CheckedProgram, stmt: Node): boolean => {
  if (stmt.kind !== NodeKind.Var || (stmt.flags & FLAG_USING) === 0) {
    return false
  }
  for (const decl of stmt.children[0].children) {
    if (isArenaCall(program, unwrapParens(decl.children[2]))) {
      return true
    }
  }
  return false
}

/**
 * Decide the block that `using` (statement `from` of `block`) opens: the
 * walk the per-pass rule makes, over the statements from the declaration to
 * the block's end. The record is a `LoopScope` whose `why`, `at` and `name`
 * are the first refusal met, `LOOP_NOTHING` when the block passes.
 */
const decideArenaBlock = (
  unit: AnalysisUnit,
  table: TypeTable,
  facts: FactsTable,
  sig: FunctionSig,
  f: FunctionFacts,
  block: Node,
  from: i32
): LoopScope => {
  const scope = new LoopScope(block, block)
  const walk = new PassWalk(unit, table, facts, scope)
  walk.block = true
  walk.returnsByValue = table.resultByValue(sig.returnType)
  // Every declarator ahead of the statement's last `arena()` is disposed after
  // that arena releases: in `using a = arena(), s = scope(), b = arena()`, `b`
  // releases before `s` joins.
  const decls = block.children[from].children[0].children
  let last = 0
  let d = 0
  while (d < decls.length) {
    if (isArenaCall(unit.program, unwrapParens(decls[d].children[2]))) {
      last = d
    }
    d = d + 1
  }
  d = 0
  while (d < last && d < decls.length) {
    const local = unit.program.nodeLocals[decls[d].id]
    if (local !== null) {
      walk.outer.push(local)
    }
    d = d + 1
  }
  let i = from
  while (i < block.children.length) {
    walk.visit(block.children[i])
    i = i + 1
  }
  const start = block.children[from].start
  for (const node of f.escapingNodes) {
    if (node.start >= start && node.end <= block.end && !initialisesUsing(unit, node)) {
      walk.refuse(LOOP_STORED, node, "")
    }
  }
  walk.refuseCarriedStores(f, start, block.end)
  return scope
}

/**
 * `node` initialises a declarator of a `using` statement. Inside a block that
 * is a `scope()` (an `arena()` allocates nothing), and the scope escapes only
 * into its tasks, which have all run and been freed when it joins: at the end
 * of its own block, which closes before any arena around it releases, and
 * ahead of a `return`'s release on that edge (`emitScopeJoins`).
 */
const initialisesUsing = (unit: AnalysisUnit, node: Node): boolean => {
  let at = node
  let parent = unit.parents.parentOf(at)
  while (parent !== null && parent.kind === NodeKind.Paren) {
    at = parent
    parent = unit.parents.parentOf(at)
  }
  if (parent === null || parent.kind !== NodeKind.VarDecl || parent.children[2] !== at) {
    return false
  }
  const list = unit.parents.parentOf(parent)
  const stmt: Node | null = list === null ? null : unit.parents.parentOf(list)
  return stmt !== null && stmt.kind === NodeKind.Var && (stmt.flags & FLAG_USING) !== 0
}

/**
 * The text of `node` as the program wrote it, quoted as code: in double
 * backticks when it holds one itself, which a template literal does.
 */
const sourceText = (unit: AnalysisUnit, node: Node): string => {
  const text = unit.program.source.text.substring(node.start, node.end)
  return text.indexOf("`") >= 0 ? `\`\` ${text} \`\`` : `\`${text}\``
}

/** Why the block that `using` opens is refused, in words, or `""` when it passes. */
const arenaBlockMessage = (unit: AnalysisUnit, scope: LoopScope, using: Node): string => {
  const source = unit.program.source
  const block = `the \`using arena()\` block at ${source.lineOf(using.start)}:${source.columnOf(using.start)}`
  const at = scope.at
  const why = scope.why
  if (at === null || why === LOOP_NOTHING) {
    return ""
  }
  const value = at.kind === NodeKind.Binary ? sourceText(unit, at.children[1]) : sourceText(unit, at)
  const inside = `${value} may be allocated inside ${block}`
  if (why === LOOP_OUTER_LOCAL) {
    return (
      `${inside} and is assigned to \`${scope.name}\`, which is declared outside the block: the block releases ` +
      "what it allocated when it ends, and the local would outlive it pointing into freed memory"
    )
  }
  if (why === BLOCK_FIELD) {
    return (
      `${inside} and is stored into a field of ${sourceText(unit, at.children[0].children[0])}: the block ` +
      "releases what it allocated when it ends, and nothing proves the object it is stored into ends with it " +
      "(allocate what must outlive the block before the block opens)"
    )
  }
  if (why === BLOCK_ELEMENT) {
    return (
      `${inside} and is stored into an element of ${sourceText(unit, at.children[0].children[0])}: the block ` +
      "releases what it allocated when it ends, and nothing proves the array it is stored into ends with it " +
      "(allocate what must outlive the block before the block opens)"
    )
  }
  if (why === LOOP_STORED) {
    return (
      `${inside} and is stored into memory — handed to a callee that keeps it, or held by an object or an array — ` +
      "where this analysis stops following it, so nothing proves it is gone when the block releases"
    )
  }
  if (why === LOOP_OUTER_PUSH) {
    const array = scope.name.length > 0 ? `\`${scope.name}\`` : "an array"
    return (
      `${value} grows ${array} inside ${block}, and the array is older than the block: a \`push\` moves ` +
      "the array's storage into the arena, which the block releases when it ends (push only onto a `const` the block " +
      "binds to a fresh array)"
    )
  }
  if (why === LOOP_RETURN) {
    const how = at.kind === NodeKind.Return ? "`return`" : "`orReturn()`"
    const handed = at.kind === NodeKind.Return ? sourceText(unit, at.children[0]) : value
    return (
      `${handed} may be allocated inside ${block} and is handed back by ${how}: the block releases what it ` +
      "allocated before the function returns, so the caller would be handed freed memory"
    )
  }
  if (why === LOOP_CALLEE_STORES) {
    const stores =
      `\`${scope.name}\` is called inside ${block} and stores an allocation into memory, where this analysis stops ` +
      "following it: what it stores may be the block's and outlive the release"
    // A map whose body answers arrays stores each one into its result, as a
    // loop that pushes arrays would; one that answers numbers or strings is
    // followed (`storedIntoChunkDst`) and may stay in the block. A `spawn`
    // that stores its task's array gets the plain message.
    const callee: FunctionSig | null = at.kind === NodeKind.Call ? unit.program.nodeCallees[at.id] : null
    if (callee !== null && isMapEntry(callee)) {
      return (
        stores +
        " (a map whose body answers arrays stores each one into its result, which the block cannot follow: run that map " +
        "outside the block, or answer numbers or strings, which a map inside a block may)"
      )
    }
    return stores
  }
  if (why === LOOP_UNSEEN) {
    return (
      `\`${scope.name}\` is called inside ${block}, and this analysis cannot see what it does with memory, so ` +
      "nothing proves that what the block allocated is gone when it releases"
    )
  }
  if (why === BLOCK_SPAWN) {
    return (
      `${value} files a task on \`${scope.name}\` inside ${block}, and that scope is declared outside the block: ` +
      "the task runs, and its answer is stored, when the scope joins, after the block has released what it allocated"
    )
  }
  return ""
}

/**
 * Every `using a = arena()` block of `sig`'s body under `node`, refused or
 * not. An arrow's body is another function's, and is walked with it.
 */
const findArenaBlocks = (
  unit: AnalysisUnit,
  table: TypeTable,
  facts: FactsTable,
  sig: FunctionSig,
  f: FunctionFacts,
  node: Node,
  out: ArenaFinding[]
): void => {
  if (node.kind === NodeKind.Arrow) {
    return
  }
  if (node.kind === NodeKind.Block) {
    let i = 0
    while (i < node.children.length) {
      const stmt = node.children[i]
      if (isArenaUsing(unit.program, stmt)) {
        const scope = decideArenaBlock(unit, table, facts, sig, f, node, i)
        const message = arenaBlockMessage(unit, scope, stmt)
        const at = scope.at
        if (at !== null && message.length > 0) {
          out.push(new ArenaFinding(at, message))
        }
      }
      i = i + 1
    }
  }
  for (const child of node.children) {
    findArenaBlocks(unit, table, facts, sig, f, child, out)
  }
}

/**
 * The refusals of every `using a = arena()` block in one module, judged once
 * the whole-program facts are settled (`Compilation.checkScopes`). Each
 * instantiation of a template is judged over its own tables, as its facts
 * are its own; a lifted arrow is a function of its own and is judged as one.
 */
export const arenaBlockFindings = (
  unit: AnalysisUnit,
  table: TypeTable,
  facts: FactsTable
): ArenaFinding[] => {
  const out: ArenaFinding[] = []
  const program = unit.program
  if (program.source.text.indexOf("arena") < 0) {
    return out
  }
  for (const sig of program.functions) {
    const body = sig.body()
    const f = facts.get(sig.name)
    if (body === null || f === null || !sig.definedIn(program.source)) {
      continue
    }
    const instance = sig.instance
    if (instance !== null) {
      program.enterInstance(instance)
    }
    findArenaBlocks(unit, table, facts, sig, f, body, out)
    if (instance !== null) {
      program.leaveInstance()
    }
  }
  return out
}

// ---- The arena-loop diagnostic ------------------------------------------------------------
//
// A WP15 section 8 performance warning, and the one that needs the whole
// program: whether a call leaves memory behind is the fixpoint's answer
// (`netAllocates`), and so is whether the function around the loop gets the
// scope that would take it back. So it is found here, after the analysis, and
// handed to the driver as findings; `Compilation.check` reports them into the
// sink with the checker's warnings. The emitter still reports nothing.

/** One arena-loop warning: where it goes, and what it says. */
export class ArenaFinding {
  node: Node
  message: string

  constructor(node: Node, message: string) {
    this.node = node
    this.message = message
  }
}

/**
 * The arena-loop warnings of one module: a call inside a loop to a function
 * that leaves arena memory behind, whose result does not outlive the pass,
 * where neither a scope around the pass (`decideLoopScopes`) nor one around
 * the function takes that memory back. Each pass adds to memory nothing will
 * release before the function returns, and the function will not release it
 * then either. The message names the first thing that refused the pass its
 * scope, and what refused the function its own.
 *
 * Silent in a function that calls `Arena.mark` itself, because its author is already managing that memory;
 * silent when the result is kept (returned, stored, pushed), because then the
 * program asked for one object per pass; silent in a loop whose pass can
 * `return` what it allocated (`LoopScope.handsBack`), because no bracket
 * could release that pass, so there is no rewrite to name. A generic instantiation is not
 * walked, so that a template instantiated twice warns once, at its template.
 */
export const arenaLoopFindings = (unit: AnalysisUnit, facts: FactsTable): ArenaFinding[] => {
  const out: ArenaFinding[] = []
  for (const sig of unit.program.functions) {
    if (!sig.definedIn(unit.program.source) || sig.instance !== null) {
      continue
    }
    const f = facts.get(sig.name)
    const body = sig.body()
    if (
      f === null ||
      body === null ||
      f.arenaScope ||
      f.managesArena ||
      calleeWhere(facts, f, CALLEE_GARBAGE) === null
    ) {
      continue
    }
    const reason = noScopeReason(unit, facts, f)
    if (reason.length > 0) {
      findArenaLoops(unit, facts, f, reason, body, null, false, false, out)
    }
  }
  return out
}

/**
 * `loop` is the innermost loop around `node` and `reclaimed` says whether a
 * scoped pass encloses it; `head` that `node` is in `loop`'s condition or
 * update, which run outside the bracket its body takes.
 */
const findArenaLoops = (
  unit: AnalysisUnit,
  facts: FactsTable,
  f: FunctionFacts,
  reason: string,
  node: Node,
  loop: LoopScope | null,
  reclaimed: boolean,
  head: boolean,
  out: ArenaFinding[]
): void => {
  if (node.kind === NodeKind.Arrow) {
    return
  }
  if (loop !== null && !reclaimed && !loop.handsBack && node.kind === NodeKind.Call) {
    const callee = unit.program.nodeCallees[node.id]
    const g: FunctionFacts | null = callee === null ? null : facts.get(callee.name)
    const why = head
      ? "the call is in the loop's condition or update, which run outside the scope each pass takes"
      : passReason(unit, loop)
    if (callee !== null && g !== null && leavesGarbage(g) && diesWithPass(f, g, node) && why.length > 0) {
      // One refusal often stops both scopes; it is named once.
      const fn =
        why === reason
          ? `and neither can \`${f.sourceName}\` when it returns`
          : `and \`${f.sourceName}\` cannot release it when it returns because ${reason}`
      out.push(
        new ArenaFinding(
          node.children[0],
          `\`${callee.sourceName}\` leaves arena memory behind on every pass of this loop, which cannot release it ` +
            `after each pass because ${why}, ${fn}, so all of it lives as long as the caller's memory does. Keep ` +
            "what a pass allocates out of locals declared outside the loop and out of memory older than the pass, " +
            "or open the loop body with `using a = arena()`"
        )
      )
    }
  }
  const isLoop = isLoopKind(node)
  const scope: LoopScope | null = isLoop ? loopScopeOf(f, node) : null
  // What a block allocates after its `using a = arena()` is released when the
  // block ends, on every pass that runs it (`arenaBlockFindings` proved it).
  let released = reclaimed
  let i = 0
  while (i < node.children.length) {
    const child = node.children[i]
    released = released || (node.kind === NodeKind.Block && isArenaUsing(unit.program, child))
    // A `for` initialiser and a `for...of` iterable run once, before the first pass.
    const once = (node.kind === NodeKind.For && i === 0) || (node.kind === NodeKind.ForOf && i === 1)
    if (scope === null || once) {
      findArenaLoops(unit, facts, f, reason, child, loop, released, head, out)
    } else if (child === scope.body) {
      findArenaLoops(unit, facts, f, reason, child, scope, reclaimed || scope.scoped, false, out)
    } else {
      findArenaLoops(unit, facts, f, reason, child, scope, reclaimed, scope.scoped, out)
    }
    i = i + 1
  }
}

export const loopScopeOf = (f: FunctionFacts, loop: Node): LoopScope | null => {
  for (const scope of f.loopScopes) {
    if (scope.loop === loop) {
      return scope
    }
  }
  return null
}

/** What refused `loop`'s passes their scope, in words for the diagnostic, or `""`. */
const passReason = (unit: AnalysisUnit, loop: LoopScope): string => {
  const at = loop.at
  const line = at === null ? "" : `${unit.program.source.lineOf(at.start)}`
  const why = loop.why
  if (why === LOOP_STORED) {
    return `the allocation on line ${line} is stored into memory, where this analysis stops following it`
  }
  if (why === LOOP_CALLEE_STORES) {
    return `it calls \`${loop.name}\`, which stores an allocation into memory, where this analysis stops following it`
  }
  if (why === LOOP_OUTER_LOCAL) {
    return `line ${line} keeps what the pass allocated in \`${loop.name}\`, which is declared outside the loop`
  }
  if (why === LOOP_OUTER_PUSH) {
    return loop.name.length > 0
      ? `line ${line} grows \`${loop.name}\`, an array older than the pass`
      : `line ${line} grows an array older than the pass`
  }
  if (why === LOOP_RETURN) {
    return `line ${line} returns what the pass allocated`
  }
  if (why === LOOP_UNSEEN) {
    return `it calls \`${loop.name}\`, whose memory this analysis cannot see`
  }
  if (why === BLOCK_SPAWN) {
    return `line ${line} hands what the pass allocated to a task of \`${loop.name}\`, which runs when that scope joins, after the pass`
  }
  return ""
}

/**
 * The call's result is garbage once the pass is over: a number, a `boolean` or
 * nothing, or a pointer that flows `local` and does not escape.
 */
const diesWithPass = (f: FunctionFacts, g: FunctionFacts, call: Node): boolean => {
  if (g.returnsScalar) {
    return true
  }
  for (const site of f.callSites) {
    if (site.node === call) {
      return site.flow === FLOW_LOCAL && !site.escapes
    }
  }
  return false
}

/**
 * Why `f` has no automatic arena scope, in words for the diagnostic, or `""`
 * when nothing refused it. The order is the rule's, so the reason named is the
 * first one a reader would have to fix.
 */
const noScopeReason = (unit: AnalysisUnit, facts: FactsTable, f: FunctionFacts): string => {
  if (!f.returnsScalar) {
    return "it returns a value that is not a number, a boolean, an enum or nothing"
  }
  if (!f.contained) {
    const site = f.escapeSite
    if (site !== null) {
      return `the allocation on line ${unit.program.source.lineOf(site.start)} is stored into memory, where this analysis stops following it`
    }
    const leaky = calleeWhere(facts, f, CALLEE_ESCAPES)
    if (leaky !== null) {
      return `it calls \`${leaky.sourceName}\`, which stores an allocation into memory, where this analysis stops following it`
    }
  }
  return ""
}

/** What `calleeWhere` looks for. */
const CALLEE_ESCAPES: i32 = 0
const CALLEE_GARBAGE: i32 = 1

/** A callee's allocations are garbage once its result is: it leaves memory behind and lets none of it escape. */
const leavesGarbage = (g: FunctionFacts): boolean => g.netAllocates && g.contained

/** The first callee that lets an allocation escape or leaves garbage, by `mode`. */
const calleeWhere = (facts: FactsTable, f: FunctionFacts, mode: i32): FunctionFacts | null => {
  let c = 0
  while (c < f.callees.size()) {
    const g = facts.get(f.callees.at(c))
    if (
      g !== null &&
      ((mode === CALLEE_ESCAPES && g.allocEscapes) || (mode === CALLEE_GARBAGE && leavesGarbage(g)))
    ) {
      return g
    }
    c = c + 1
  }
  return null
}

/**
 * Where `f`'s `allocLeaks` comes from, when a callee's: `allocLeaks` flows up
 * the call graph, so its callees are searched, depth first, for one none of
 * whose own callees has it, whose leak is its own. A search that only loops
 * back through a recursion names the first callee that has it. Null when no
 * callee of `f` but `f` itself leaks.
 */
const leakRoot = (facts: FactsTable, f: FunctionFacts): FunctionFacts | null => {
  const seen: FunctionFacts[] = [f]
  const root = ownLeak(facts, f, seen)
  if (root === null) {
    return seen.length > 1 ? seen[1] : null
  }
  return root === f ? null : root
}

/**
 * The first function down `f`'s calls with `allocLeaks` none of whose other
 * callees has it: `f` itself when none does. Null when every callee that has
 * it is in `seen`, the functions already searched, or leads only back there.
 */
const ownLeak = (facts: FactsTable, f: FunctionFacts, seen: FunctionFacts[]): FunctionFacts | null => {
  let leaksBelow = false
  let c = 0
  while (c < f.callees.size()) {
    const g = facts.get(f.callees.at(c))
    if (g !== null && g !== f && g.allocLeaks) {
      leaksBelow = true
      // A leak of its own is where the doubt starts, whatever its callees do.
      if (g.leaksItself) {
        return g
      }
      if (!holdsFacts(seen, g)) {
        seen.push(g)
        const found = ownLeak(facts, g, seen)
        if (found !== null) {
          return found
        }
      }
    }
    c = c + 1
  }
  return leaksBelow ? null : f
}

/**
 * The first allocation `f` itself holds past its return, the one
 * `leaksItself` stands for: a site of its own whose flow leaks, or a call
 * to an allocating callee whose result does. `null` when none is on record.
 */
const ownLeakNode = (facts: FactsTable, f: FunctionFacts): Node | null => {
  let first: Node | null = null
  let i = 0
  while (i < f.arenaNodes.length && i < f.arenaFlows.length) {
    const node = f.arenaNodes[i]
    if (f.arenaFlows[i] === FLOW_LEAKS && (first === null || node.start < first.start)) {
      first = node
    }
    i = i + 1
  }
  for (const site of f.callSites) {
    const g = facts.get(site.callee)
    if (
      site.flow === FLOW_LEAKS &&
      g !== null &&
      g.allocates &&
      (first === null || site.node.start < first.start)
    ) {
      first = site.node
    }
  }
  return first
}

/** Whether `list` holds `f`. */
const holdsFacts = (list: FunctionFacts[], f: FunctionFacts): boolean => {
  for (const g of list) {
    if (g === f) {
      return true
    }
  }
  return false
}

// ---- `--explain-memory` -------------------------------------------------------------------
//
// The arena-loop warning above speaks only where it can name a callee whose
// memory piles up and a rewrite. A long-running program needs the wider
// answer: every loop whose passes allocate and keep what they allocated, and
// every function that answers no memory yet keeps what it allocated, each with
// the first thing that refused its scope. The facts are the ones the emitter
// reads, so the report and the IR cannot disagree, and nothing here changes a
// decision.
//
// A function that answers memory is left out: what it allocates goes to its
// caller with the result, and whether that caller gives it back is the
// caller's line in the report (a scoped pass or function releases everything
// its callees bumped, temporaries included).

/** What `--explain-memory` found across the root package's modules: the lines, and the counts its summary adds up. */
export class MemoryReport {
  notes: ArenaFinding[]
  /** Loops whose passes allocate, and how many of them keep what they allocated. */
  loops: i32
  loopsKept: i32
  /** Functions that answer no memory and leave memory behind, and how many of them keep it. */
  functions: i32
  functionsKept: i32

  constructor() {
    this.notes = []
    this.loops = 0
    this.loopsKept = 0
    this.functions = 0
    this.functionsKept = 0
  }
}

/** Why no automatic scope is taken under `--no-elision`. */
const NO_ELISION_REASON: string = "`--no-elision` takes no automatic scope"

/** Why a function that calls `Arena.mark` takes no automatic scope, after its subject. */
const ARENA_MARK_REASON: string =
  "calls `Arena.mark` itself, and no automatic scope moves the position it reads"

/**
 * The `--explain-memory` lines of one module, in the order the program lists
 * its functions (declared ones, then instantiations) and, in each function,
 * the function's own line first and then its loops in source order. A
 * generic function, or one that takes a function parameter, has no signature
 * but its instantiations, and one of them can keep what another lets go, so
 * each is explained under its own name, with its own side tables installed.
 */
export const explainMemory = (
  unit: AnalysisUnit,
  table: TypeTable,
  facts: FactsTable,
  out: MemoryReport
): void => {
  const program = unit.program
  for (const sig of program.functions) {
    const f = facts.get(sig.name)
    const body = sig.body()
    if (!sig.definedIn(program.source) || f === null || body === null) {
      continue
    }
    const instance = sig.instance
    if (instance !== null) {
      program.enterInstance(instance)
    }
    explainFunction(unit, table, facts, sig, f, body, out)
    if (instance !== null) {
      program.leaveInstance()
    }
  }
}

/** The `--explain-memory` lines of one function: its own, then its loops'. */
const explainFunction = (
  unit: AnalysisUnit,
  table: TypeTable,
  facts: FactsTable,
  sig: FunctionSig,
  f: FunctionFacts,
  body: Node,
  out: MemoryReport
): void => {
  const entry = unit.program.entryMain
  const isMain = entry !== null && entry === sig
  // A function that answers memory hands what it allocated to its caller
  // (see the header): only one that answers none can keep it. One with no
  // scope of its own still keeps nothing when every allocation it leaves is
  // inside a scoped pass or a `using a = arena()` block. A constructor
  // answers the object it builds.
  if (f.returnsScalar && sig.role !== ROLE_CONSTRUCTOR && (f.arenaScope || f.netAllocates)) {
    out.functions = out.functions + 1
    const kept: Node | null = f.arenaScope ? null : keptAllocation(unit, table, facts, f, body)
    if (kept !== null) {
      out.functionsKept = out.functionsKept + 1
      const until = isMain ? "for the rest of the run" : "until the memory of its caller is released"
      const reason = keptReason(unit, table, facts, f, kept)
      out.notes.push(
        new ArenaFinding(sig.decl, `\`${f.sourceName}\` keeps what it allocates ${until}, because ${reason}`)
      )
    }
  }
  // Every loop of the body has its entry in `f.loopScopes`
  // (`collectLoopScopes` descends into each statement that can hold one).
  if (f.allocates) {
    explainLoops(unit, table, facts, f, isMain, body, null, null, out)
  }
}

/**
 * The first allocation under `body` that is still held when the function
 * returns: an allocation of its own, or a call or `new` that leaves memory
 * behind, outside every scoped pass and every `using a = arena()` block.
 * Null when there is none.
 */
const keptAllocation = (
  unit: AnalysisUnit,
  table: TypeTable,
  facts: FactsTable,
  f: FunctionFacts,
  body: Node
): Node | null => {
  const starts: i32[] = []
  const ends: i32[] = []
  collectReleased(unit, f, body, starts, ends)
  let first = firstLeavingCall(unit.program, table, facts, body, starts, ends)
  for (const node of f.arenaNodes) {
    if (
      within(body, node) &&
      !inReleased(node, starts, ends) &&
      (first === null || node.start < first.start)
    ) {
      first = node
    }
  }
  return first
}

/**
 * The source ranges under `node` whose allocations go back before the
 * function returns: the body of a scoped pass, and a block from its
 * `using a = arena()` declaration to its end.
 */
const collectReleased = (
  unit: AnalysisUnit,
  f: FunctionFacts,
  node: Node,
  starts: i32[],
  ends: i32[]
): void => {
  if (node.kind === NodeKind.Arrow) {
    return
  }
  const isLoop = isLoopKind(node)
  const scope: LoopScope | null = isLoop ? loopScopeOf(f, node) : null
  for (const child of node.children) {
    if (scope !== null && scope.scoped && child === scope.body) {
      starts.push(child.start)
      ends.push(child.end)
    } else if (node.kind === NodeKind.Block && isArenaUsing(unit.program, child)) {
      starts.push(child.start)
      ends.push(node.end)
      return
    } else {
      collectReleased(unit, f, child, starts, ends)
    }
  }
}

/** Whether `node` lies in one of the ranges `collectReleased` found. */
const inReleased = (node: Node, starts: i32[], ends: i32[]): boolean => {
  let i = 0
  while (i < starts.length && i < ends.length) {
    if (node.start >= starts[i] && node.end <= ends[i]) {
      return true
    }
    i = i + 1
  }
  return false
}

/** The first call or `new` under `node`, outside the released ranges, that leaves memory behind. */
const firstLeavingCall = (
  program: CheckedProgram,
  table: TypeTable,
  facts: FactsTable,
  node: Node,
  starts: i32[],
  ends: i32[]
): Node | null => {
  if (node.kind === NodeKind.Arrow || inReleased(node, starts, ends)) {
    return null
  }
  if (leavesMemory(program, table, facts, node)) {
    return node
  }
  for (const child of node.children) {
    const hit = firstLeavingCall(program, table, facts, child, starts, ends)
    if (hit !== null) {
      return hit
    }
  }
  return null
}

/**
 * Why `f` has no scope, for `--explain-memory`: `noScopeReason`'s answer
 * where it has one, and the refusals that answer leaves to other rules.
 */
const keptReason = (
  unit: AnalysisUnit,
  table: TypeTable,
  facts: FactsTable,
  f: FunctionFacts,
  kept: Node
): string => {
  if (facts.noElision) {
    return NO_ELISION_REASON
  }
  // `Arena.mark` refuses a pass its scope, not the function (`LOOP_CONTROL`).
  const reason = noScopeReason(unit, facts, f)
  if (reason.length > 0) {
    return reason
  }
  if (f.feedsTasks) {
    return "a task it files holds what it allocated after it returns"
  }
  if (f.fillsParam >= 0 && f.fillsParam < f.paramNames.length) {
    return `it fills \`${f.paramNames[f.fillsParam]}\` with what it allocated, and that memory is its caller's`
  }
  const program = unit.program
  const line = program.source.lineOf(kept.start)
  // A leak of its own is the one to fix first: a callee's would not
  // give this function its scope back while its own remains.
  if (f.leaksItself) {
    const held = ownLeakNode(facts, f)
    const where =
      held === null ? "" : `; the first allocation it holds is on line ${program.source.lineOf(held.start)}`
    return (
      "an allocation it makes is held where this analysis does not prove it dead when it returns (a local " +
      `assigned more than once, an array of its own, or a callee that keeps its argument)${where}`
    )
  }
  // What a callee leaves behind is the caller's to release, and with no
  // scope of its own this function releases none of it.
  // A `new` of the function's own whose constructor leaves nothing is the
  // allocation kept, not a call to blame.
  const callee: FunctionSig | null = leavesMemory(program, table, facts, kept)
    ? calleeAt(program, table, kept)
    : null
  if (callee !== null) {
    const what = facts.get(callee.name) === null ? ", which this analysis cannot see into," : ""
    return `\`${callee.sourceName}\`${what} called on line ${line}, leaves memory behind that no scope of this function takes back`
  }
  const root: FunctionFacts | null = f.allocLeaks ? leakRoot(facts, f) : null
  if (root !== null) {
    return (
      `it calls into \`${root.sourceName}\`, which holds an allocation this analysis does not prove dead, and ` +
      `that doubt passes to every caller, so it does not prove dead what line ${line} allocates either`
    )
  }
  return `what line ${line} allocates is held where this analysis cannot prove it dead when the function returns`
}

/**
 * Every loop under `node` whose passes allocate: counted, and explained when
 * it keeps what a pass allocated. `pass` is the innermost scoped loop around
 * `node` and `block` the innermost `using a = arena()` declaration whose block
 * holds it, either of which is where kept memory goes back. Lines go out in
 * source order, so a `do...while` condition follows its body.
 */
const explainLoops = (
  unit: AnalysisUnit,
  table: TypeTable,
  facts: FactsTable,
  f: FunctionFacts,
  isMain: boolean,
  node: Node,
  pass: LoopScope | null,
  block: Node | null,
  out: MemoryReport
): void => {
  if (node.kind === NodeKind.Arrow) {
    return
  }
  const isLoop = isLoopKind(node)
  const scope: LoopScope | null = isLoop ? loopScopeOf(f, node) : null
  let inner = pass
  let lateCondition: Node | null = null
  let until = ""
  if (scope !== null) {
    // The condition and the update run outside the bracket the body takes,
    // so what they allocate stays whether or not the body is scoped.
    const condition = loopCondition(node)
    const update = loopUpdate(node)
    const conditionKeeps = condition !== null && passCallsAllocate(unit, table, f, facts, condition)
    const updateKeeps = update !== null && passCallsAllocate(unit, table, f, facts, update)
    // The pass decision read `netAllocates` with every scope in place, and
    // walked no pass it refused for `Arena.mark`; `--no-elision` took the
    // scopes away, so a call into a function a scope had emptied allocates again.
    // A callee this analysis cannot see may allocate: the pass is listed
    // with that reason rather than counted as allocating nothing.
    const unwalked = facts.noElision || scope.why === LOOP_CONTROL
    const allocates =
      scope.allocates ||
      (!scope.scoped && callsUnseen(unit.program, table, facts, scope.body)) ||
      (unwalked && passCallsAllocate(unit, table, f, facts, scope.body))
    if (allocates || conditionKeeps || updateKeeps) {
      out.loops = out.loops + 1
      // A pass with no scope still keeps nothing when every allocation in it
      // goes back with a scoped loop or a `using a = arena()` block inside it.
      const bodyKeeps =
        allocates && !scope.scoped && keptAllocation(unit, table, facts, f, scope.body) !== null
      if (bodyKeeps || conditionKeeps || updateKeeps) {
        out.loopsKept = out.loopsKept + 1
      }
      until = keptUntil(unit, f, isMain, pass, block)
      if (bodyKeeps) {
        const reason = loopKeptReason(unit, facts, scope)
        out.notes.push(
          new ArenaFinding(node, `this loop keeps what each pass allocates ${until}, because ${reason}`)
        )
      }
      if (conditionKeeps && condition !== null) {
        if (node.kind === NodeKind.Do) {
          lateCondition = condition
        } else {
          out.notes.push(headNote(condition, "condition", until))
        }
      }
      if (updateKeeps && update !== null) {
        out.notes.push(headNote(update, "update", until))
      }
      if (scope.scoped) {
        inner = scope
      }
    }
  }
  let held = block
  for (const child of node.children) {
    if (node.kind === NodeKind.Block && isArenaUsing(unit.program, child)) {
      held = child
    }
    let childPass = pass
    if (scope !== null && child === scope.body) {
      childPass = inner
    }
    explainLoops(unit, table, facts, f, isMain, child, childPass, held, out)
  }
  if (lateCondition !== null) {
    out.notes.push(headNote(lateCondition, "condition", until))
  }
}

/** The line for a loop condition or update that allocates on every pass. */
const headNote = (head: Node, part: string, until: string): ArenaFinding =>
  new ArenaFinding(
    head,
    `this loop's ${part} allocates on every pass, outside the scope a pass takes, and keeps it ${until}`
  )

/** The node of `loop` that is tested before or after every pass, or null for a `for...of`. */
const loopCondition = (loop: Node): Node | null => {
  switch (loop.kind) {
    case NodeKind.While:
      return loop.children.length > 0 ? loop.children[0] : null
    case NodeKind.Do:
    case NodeKind.For:
      return loop.children.length > 1 ? loop.children[1] : null
    default:
      return null
  }
}

/** The node of a `for` that runs after every pass, or null. */
const loopUpdate = (loop: Node): Node | null =>
  loop.kind === NodeKind.For && loop.children.length > 2 ? loop.children[2] : null

/** Where a loop's kept memory goes back: the nearest bracket around it, or the function's own end. */
const keptUntil = (
  unit: AnalysisUnit,
  f: FunctionFacts,
  isMain: boolean,
  pass: LoopScope | null,
  block: Node | null
): string => {
  const source = unit.program.source
  // The nearer of the two brackets releases first.
  if (block !== null && (pass === null || block.start > pass.loop.start)) {
    return `until the \`using a = arena()\` block of line ${source.lineOf(block.start)} ends`
  }
  if (pass !== null) {
    return `until the pass of the loop on line ${source.lineOf(pass.loop.start)} ends`
  }
  if (f.arenaScope) {
    return `until \`${f.sourceName}\` returns`
  }
  return isMain ? "for the rest of the run" : `until the memory of \`${f.sourceName}\`'s caller is released`
}

/** Why a loop that allocates has no scope of its own, for `--explain-memory`. */
const loopKeptReason = (unit: AnalysisUnit, facts: FactsTable, scope: LoopScope): string => {
  if (facts.noElision) {
    return NO_ELISION_REASON
  }
  if (scope.why === LOOP_CONTROL) {
    return `the function ${ARENA_MARK_REASON}`
  }
  const reason = passReason(unit, scope)
  return reason.length > 0 ? reason : "nothing proves that what a pass allocated is unreachable once it ends"
}
