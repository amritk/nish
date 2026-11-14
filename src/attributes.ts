// Function and parameter attribute analysis for stage1
// (stage0's `src/codegen/attributes.ts`, docs/wp14-selfhost.md milestone S4).
//
// Everything emitted here must be a *guarantee*, never a hope: a wrong
// attribute is undefined behaviour, not a missed optimisation. The proofs are
// the ones stage0's `src/codegen/attributes.ts` states at length and they are not
// repeated here; what follows is only what is different about this
// implementation, because the rules themselves must not drift.
//
//   nounwind    The language has no exceptions.
//   willreturn  Every loop is counted (`isCountedLoop`), the body has no
//               `throw`, it cannot reach a `noreturn` runtime call, it is on
//               no call-graph cycle (`clearRecursiveWillReturn`), and every
//               callee is itself willreturn (fixpoint over the call graph).
//   readnone / readonly
//               The body touches no memory it does not own, or only reads it,
//               and every callee agrees (the same fixpoint).
//   noundef     Every value is initialised.
//   Pointer parameters carry `nonnull align 8 dereferenceable(N)` from the
//               allocator's guarantees, and `readonly` / `nocapture` from the
//               `pointerParams` fixpoint.
//
// Three shape changes, all forced and none visible in the output:
//
//   - **The fact collectors live here**, not beside the lowerings. stage0's `src/`
//     registers them into a `factCollectors` array from each `emit/*.ts`,
//     which needs function values; D2 already took the central `switch` for
//     the same reason. The invariant that mattered — a collector says exactly
//     what its lowering does — is now kept by the IR oracle rather than by
//     locality, which is the test D2 said this would need.
//   - **`Set`/`Map` become `StringSet` and index scans.** `stackSites` is a
//     `boolean[]` indexed by `Node.id`, the same side-table shape the checker
//     uses; `stackLocals` and `pointerParams` are short lists scanned by
//     identity, because a function has a handful of parameters and a scan
//     beats a hash there.
//   - **Parent links come from a side table** (`src/parents.ts`), since the
//     tree has none. The walks are otherwise the same walks.

import { WIPE_MEMSET } from "./emit-secret"
import { isPureRuntime, SECRET_MAKE, SECRET_WIPE, secretRoleOf } from "./secret"
import { isRegionIntrinsic } from "./region-check"
import { isShmSource, isShmWindowIntrinsic } from "./shm-window"
import { jsonRouteCallees, jsonRouteOf } from "./json-typed"
import { openedHandle } from "./handles"
import { layoutClass } from "./structs"
import {
  builtinCalleesNamed,
  checksRangesInPrologue,
  identifierBuiltinCallees,
  identifierBuiltinCalleesNamed,
  isSpawnCall,
  panicTailCallees,
} from "./emit-builtins"
import { isBuiltinFunction } from "./builtins"
import { isExecutorCall } from "./nish-modules"
import { numericLiteralValue } from "./constants"
import { builtinCapability, CAP_FFI, CAP_NONE, CAP_UNLABELLED, CAPABILITY_COUNT } from "./capabilities"
import { newArrayLengthChecked } from "./emit-arrays"
import {
  foreignResultCallees,
  foreignStringCallees,
  foreignStringIsNulFree,
  stringifyCallee,
  stringConstructCallees,
} from "./emit-strings"
import { internalError, unlabelledBuiltinError } from "./ice"
import {
  analyzeEscapes,
  decideLoopScopes,
  EscapeResult,
  FLOW_LEAKS,
  FLOW_LOCAL,
  FLOW_RETURNED,
  isScalarArgument,
  rootsHoldNoPointer,
} from "./escape"
import {
  arrayMethodName,
  builtinNameOf,
  isArrayWriteMethod,
  dottedName,
  intrinsicType,
  isAssignmentOperator,
  isAssignmentTarget,
  isArenaCall,
  isJoinCall,
  isPushCall,
  builtinArgumentLetters,
  isWrittenArgument,
  isStringMethodCall,
  isTemplateExpression,
  rangedStoreOf,
  receiverIsValue,
  methodReceiver,
  storesInlineElements,
  templateParts,
  unwrapParens,
} from "./emit-util"
import { StringMap, StringSet } from "./map"
import { compareStrings } from "./strings"
import { FLAG_CONST, FLAG_OBJECT_SPREAD, Node, NodeKind, PATTERN_NAMES_AT } from "./nodes"
import { Options } from "./options"
import {
  CaptureTarget,
  arrowCallee,
  captureTarget,
  capturesOf,
  isAtomicMethod,
  isChannelReader,
  isChannelSend,
  isGuardedAccess,
  isLockMethod,
  isRegionEntry,
  isSpawnEntry,
  parallelBodyOf,
  parallelRoleOf,
  recyclesPerElement,
} from "./parallel"
import { ParentTable } from "./parents"
import {
  CheckedProgram,
  FunctionSig,
  inlineElementStruct,
  JSON_DECODE,
  JSON_DECODE_UNION,
  JSON_NONE,
  MAP_GET_OR_INSERT,
  PAR_MAP,
  ROLE_CONSTRUCTOR,
  StructInfo,
} from "./program"
import {
  EFFECT_NONE,
  EFFECT_READ,
  EFFECT_WRITE,
  inlineAllocatorAttrs,
  maxEffect,
  RuntimeFunction,
  RuntimeTable,
} from "./runtime"
import { Local, STORAGE_LOCAL, STORAGE_PARAM, sourceLocal } from "./symbols"
import { checksOverflow, isBuiltinConversion } from "./bounds"
import { isResultConstructorCall, resultMethodName } from "./emit-result"
import { isResultConstructor, resultLayout } from "./result"
import {
  isForeignBuffer,
  isHostWindow,
  isInteger,
  K_ARRAY,
  K_NULLABLE,
  K_RESULT,
  K_STRUCT,
  T_BOOL,
  T_I32,
  T_STRING,
  T_VOID,
  TypeTable,
} from "./types"
import {
  fusedCalleesOf,
  isMapRoute,
  mapIntrinsicOf,
  routeCalleesOf,
  valueReaderOf,
  walkMethodsOf,
} from "./emit-map"
import { isCollectionStruct } from "./generics"
import { isSimdLoad } from "./simd"
import {
  builtinPanicKind,
  PANIC_ARRAY_LENGTH,
  PANIC_CALL,
  PANIC_DIVIDE,
  PANIC_EXPECT,
  PANIC_FFI_LENGTH,
  PANIC_FFI_NUL,
  PANIC_FFI_NULL,
  PANIC_INDEX,
  PANIC_OVERFLOW,
  PANIC_PARALLEL_LENGTH,
  PANIC_POP,
  PANIC_RANGE,
  PANIC_REGION,
  PANIC_SLICE,
  PanicSite,
} from "./panics"

/** `sizeof(%struct.nish_array)`: `{ i64 len, i64 cap, i8* data }` (WP4 layout). */
const ARRAY_HEADER_BYTES: i32 = 24

/** One module and the parent links its analyses walk. */
export class AnalysisUnit {
  program: CheckedProgram
  parents: ParentTable

  constructor(program: CheckedProgram, parents: ParentTable) {
    this.program = program
    this.parents = parents
  }
}

/** What a function does with one pointer-typed parameter: a struct (`this` included) or an array. */
export class PointerParamFacts {
  name: string
  /** Calls the pointer is passed to, by callee symbol and parameter index (0 is `this`). */
  passedToCallees: string[]
  passedToIndices: i32[]
  /** `passedToCallees` resolved in the table being propagated, `null` for a callee not in it (`FactGraph`). */
  passedToFacts: (FunctionFacts | null)[]
  /** `sizeof` of the pointee, for `dereferenceable`; 0 when it is not emitted (arrays). */
  size: i32
  /** The alignment the pointer is guaranteed to have; see `pointerAlign`. */
  align: i32
  /** Stores through the pointer, directly or via a callee (fixpoint). */
  writesThrough: boolean
  /**
   * `writesThrough`, less a `string` element handed to a call (`p[i]` as an
   * argument), which `classifyElementUse` counts as a write for LLVM's sake
   * though a string has no slot a callee can store into: what a caller's
   * shared write asks of its callee (`writesArgument`), so a function that
   * reads `hashes[k]` into a callee does not write the caller's `hashes`.
   */
  writesShared: boolean
  /** The pointer may outlive the call: returned, stored, aliased, or captured by a callee. */
  captured: boolean
  /**
   * `captured`, less a parallel region's hold on it: escape analysis's
   * question, where `captured` is LLVM's. A region entry hands every
   * parameter to other threads and joins them before it returns
   * (`markParallelEntry`), so the address is kept, and no `nocapture` may be
   * claimed, but not past the call: an array the caller made and passed in is
   * still the caller's alone once the call has returned.
   */
  outlives: boolean
  /**
   * WP29: the function writes memory reachable from the pointer, its own slots
   * or anything deeper, directly or via a callee (fixpoint). `writesThrough`
   * is LLVM's narrower question: a store through `p.inner.x` writes through a
   * pointer loaded out of `*p`, not through `p`, and leaves it `readonly`. A
   * scope's region asks this one (`writesThroughMessage` in `src/parallel.ts`),
   * because a task holding `p` reads `p.inner.x` too (#564's review).
   */
  writesReach: boolean
  /** The part of `writesReach` deeper than the pointer's own slots: through a field, an element or an alias. */
  writesDeep: boolean
  /** A constructor's: memory the parameter reaches is stored into what `this` reaches (fixpoint). */
  keptInThis: boolean
  /**
   * Memory that may not be the caller's own is stored somewhere the parameter
   * reaches, directly or by a callee (fixpoint): after the call, an object of
   * the caller's own handed here may hold anything (`DIRT_CALL`).
   */
  polluted: boolean
  /**
   * A `string[]` parameter none of whose elements the function keeps past the
   * call or hands back (`freeElementParams` in `src/escape.ts`), settled with
   * the fresh-element fixpoint (`markFreshElements`). A caller's listing
   * passed here is not handed on, so its frame may still release it.
   */
  elementsFree: boolean

  constructor(name: string, size: i32, align: i32) {
    this.name = name
    this.size = size
    this.align = align
    this.writesThrough = false
    this.writesShared = false
    this.captured = false
    this.outlives = false
    this.writesReach = false
    this.writesDeep = false
    this.keptInThis = false
    this.polluted = false
    this.passedToCallees = []
    this.passedToIndices = []
    this.passedToFacts = []
    this.elementsFree = false
  }
}

/** A call to a pointer-returning user function, and where its result flows. */
export class CallSite {
  callee: string
  flow: i32
  /** WP9: the result is reachable after this function returns, other than through its return value. */
  escapes: boolean
  /** The call, which the arena-loop diagnostic reports at and names the line of. */
  node: Node
  /** `callee` resolved in the table being propagated, or `null` (`FactGraph`). */
  target: FunctionFacts | null

  constructor(callee: string, flow: i32, escapes: boolean, node: Node) {
    this.callee = callee
    this.flow = flow
    this.escapes = escapes
    this.node = node
    this.target = null
  }
}

/**
 * One loop of a function, and whether each pass of its body is bracketed with
 * `nish_arena_mark` / `nish_arena_release` (`decideLoopScopes`, escape.ts).
 * When it is not, `why`, `at` and `name` say what refused it, which is what the
 * arena-loop diagnostic names.
 */
export class LoopScope {
  loop: Node
  /** The statement each pass runs: what the scope brackets. */
  body: Node
  /** The node whose line the reason names, or null. */
  at: Node | null
  /** The local or the callee the reason names, or `""`. */
  name: string
  /** A `LOOP_*` reason from escape.ts; `LOOP_NOTHING` when nothing refused the scope. */
  why: i32
  scoped: boolean
  /**
   * A pass can `return` what it allocated, whatever else refused it: no
   * bracket, automatic or written, could release that pass, so the
   * arena-loop diagnostic has no rewrite to offer and says nothing.
   */
  handsBack: boolean
  /**
   * A pass bumps the arena, itself or through a callee that leaves memory
   * behind: whether there is anything for a scope to release, which is what
   * `--explain-memory` reads to tell a loop that keeps memory from one that
   * has none to give back.
   */
  allocates: boolean

  constructor(loop: Node, body: Node) {
    this.loop = loop
    this.body = body
    this.scoped = false
    this.allocates = false
    this.why = 0
    this.at = null
    this.name = ""
    this.handsBack = false
  }
}

/**
 * One array's header, read once in the preheader of the loop that reads the
 * array: the header pointer, its `len` and its `data`, and the path they were
 * read through.
 *
 * It lives here rather than in `emit-arrays.ts` because `FunctionFacts` is the
 * per-function record the emitter already carries (`Emitter.current`), and the
 * language's one module-level mutable state, module storage, is a fixed
 * pointer-free array with no room for a scope stack --
 * which is how stage0's `src/codegen/emit/arrays.ts` holds the same thing.
 */
export class HoistedHeader {
  /** The binding the path is rooted at; identity, not name, is what matches. */
  root: Local
  /** The property chain below the root: `".xs"`, `".state.atMostIndex"`, or `""`. */
  path: string
  arr: string
  /** `""` when the loop never asks for it, so nothing is loaded for it either. */
  len: string
  data: string

  constructor(root: Local, path: string, arr: string, len: string, data: string) {
    this.root = root
    this.path = path
    this.arr = arr
    this.len = len
    this.data = data
  }
}

/**
 * One array only this call reaches: a `const` the function binds to its own
 * array literal or `new Array`, whose elements are not stored inline, and
 * whose every reference is consumed on the spot (an element or a `.length`, a
 * store into a slot, an array method, a `for...of`) or is an argument of a
 * user function that keeps nothing of it. The fixpoint sets `lost` when a
 * callee turns out to keep it, and its first store, `site`, is then a shared
 * write after all.
 */
export class PrivateArray {
  local: Local
  site: Node | null
  lost: boolean

  constructor(local: Local) {
    this.local = local
    this.site = null
    this.lost = false
  }
}

/** What a `MemPath` starts at. */
const ROOT_NONE: i32 = 0 // a number, a `boolean` or a string: nothing a store can reach
const ROOT_PARAM: i32 = 1 // a pointer parameter (`this` in a method)
const ROOT_OWN: i32 = 2 // an object this call made: a fresh `const`, or `this` in a constructor
const ROOT_UNKNOWN: i32 = 3 // anything at all

/**
 * WP29: where the memory an expression names lives, for
 * `PointerParamFacts.writesReach`: a root and the fields and elements below
 * it, as `.f` and `[]` steps (`FactCollector.pathOf`). A `const` is followed
 * into its initialiser; a call's result, a `let`, a loop variable, a `?:` are
 * `ROOT_UNKNOWN`.
 */
export class MemPath {
  /** The parameter's name for `ROOT_PARAM`, the object's key (`FactCollector.ownKeyOf`) for `ROOT_OWN`. */
  name: string
  steps: string
  kind: i32

  constructor(kind: i32, name: string, steps: string) {
    this.name = name
    this.steps = steps
    this.kind = kind
  }
}

/**
 * What a stored value may be (`FactCollector.valueOf`): memory of the
 * parameters in `params`, of the objects in `owns`, anything (`unknown`), or
 * objects made by the constructors in `ctors`. With all four empty it is a
 * number, a string, `null` or a fresh allocation of such values: clean.
 */
export class ValueDesc {
  params: string[]
  owns: string[]
  ctors: string[]
  /** `ctors` resolved in the table being propagated, `null` for one not in it (`FactGraph`). */
  ctorFacts: (FunctionFacts | null)[]
  unknown: boolean

  constructor() {
    this.params = []
    this.owns = []
    this.ctors = []
    this.ctorFacts = []
    this.unknown = false
  }
}

/** Why a `DirtMark` exists, and so what makes the fixpoint set `active`. */
const DIRT_STORE: i32 = 0 // a value stored into the slot: active while the value is not clean
const DIRT_INIT: i32 = 1 // `const o = new C(...)`: active when `C` keeps an argument that is not clean
const DIRT_ESCAPE: i32 = 2 // the object used as a value the analysis does not follow: active from the start
const DIRT_CALL: i32 = 3 // the object handed to a call: active once the callee writes what it is handed

/**
 * Memory below an object of this call's own (`ROOT_OWN`) that may be memory
 * a parameter reaches, or anything (`unknown`): the slot `steps` itself
 * (`below` false), or everything strictly below `steps` (`below` true). Every
 * mark is made when the body is walked; the fixpoint only sets `active` and
 * `unknown`, so it allocates nothing however many passes it takes.
 */
export class DirtMark {
  root: string
  steps: string
  params: string[]
  /** For `DIRT_STORE`, the value; for `DIRT_INIT`, the constructor in `ctor` and one value per argument. */
  value: ValueDesc | null
  args: ValueDesc[]
  ctor: string
  /** `ctor` resolved in the table being propagated, or `null` (`FactGraph`). */
  ctorFacts: FunctionFacts | null
  kind: i32
  below: boolean
  active: boolean
  unknown: boolean

  constructor(kind: i32, root: string, steps: string, below: boolean) {
    this.root = root
    this.steps = steps
    this.params = []
    this.value = null
    this.args = []
    this.ctor = ""
    this.ctorFacts = null
    this.kind = kind
    this.below = below
    this.active = kind === DIRT_ESCAPE
    this.unknown = kind === DIRT_ESCAPE || kind === DIRT_CALL
  }
}

/** A value stored somewhere a parameter reaches (`name`), or somewhere unknown (`name` ""): what may pollute it (`PointerParamFacts.polluted`). */
class ParamStore {
  name: string
  value: ValueDesc

  constructor(name: string, value: ValueDesc) {
    this.name = name
    this.value = value
  }
}

/** A `const` of this function and the path its name resolves to, cached (`FactCollector.pathOf`). */
class LocalPath {
  local: Local
  path: MemPath

  constructor(local: Local, path: MemPath) {
    this.local = local
    this.path = path
  }
}

/**
 * One argument of a call whose callee's writes are composed with what each
 * argument is: the callee's symbol and parameter index (`this` counts as 0),
 * and what the argument is in the caller — one of its private arrays
 * (`owner`), one of its own pointer parameters as it is (`param`), or
 * anything else (neither).
 */
export class ArgEdge {
  callee: string
  /** `callee` resolved in the table being propagated, or `null` (`FactGraph`). */
  target: FunctionFacts | null
  param: string
  owner: PrivateArray | null
  /** Where the argument's memory lives (`MemPath`). */
  path: MemPath
  /** For an argument that is an object of the caller's own, what a callee that writes or keeps it makes of it (`DIRT_CALL`). */
  dirt: DirtMark | null
  /**
   * The caller's own object a `new` that is handed this argument initialises
   * (`const b = new C(w)`), or "": a constructor that keeps the argument puts
   * it inside that object, which is only as clean as the object is.
   */
  heldBy: string
  index: i32
  /**
   * For a capture read as an argument to its arrow (`noteCaptured`), the
   * instance this function called to hand it over, or "": the write the edge
   * carries is that call's, so it is the callee a shared write is named by
   * (`writesAnArgument`).
   */
  via: string

  constructor(callee: string, index: i32, param: string, owner: PrivateArray | null, path: MemPath) {
    this.callee = callee
    this.target = null
    this.param = param
    this.owner = owner
    this.path = path
    this.dirt = null
    this.heldBy = ""
    this.index = index
    this.via = ""
  }

  /** Whether the argument is memory only the caller reaches: a private array no callee keeps. */
  isPrivate(): boolean {
    const owner = this.owner
    return owner !== null && !owner.lost
  }
}

export class FunctionFacts {
  hasLoops: boolean
  /** The body loads from memory it does not own (a header read, a field or element read). */
  readsMemory: boolean
  /** Every loop in the body is counted; vacuously true without loops. */
  loopsBounded: boolean
  /** Contains `throw`, which lowers to `llvm.trap`: a side effect that never returns. */
  hasTrap: boolean
  /**
   * WP15 section 2c: the function may move an array's `len` -- `a.push(v)`,
   * which also moves `cap` and `data` when it grows, or `a.pop()`, which moves
   * `len` alone -- directly or through a callee (fixpoint over the call graph).
   *
   * This is the whole-program "does not grow an array" fact, and the point of
   * it is what it leaves out. `PointerParamFacts.writesThrough` lumps a `push`
   * in with every other store, so a function that only writes elements is
   * indistinguishable from one that reallocates the buffer. An element write
   * leaves the header alone -- that is exactly what the section 2b alias
   * domains encode -- so a header fact built on `writesThrough` would refuse
   * every loop that writes an element, which is the loop a header hoist exists
   * for. Separating the two is the whole change: this is about the 24 bytes of
   * `{ len, cap, data }` and nothing else.
   *
   * It is deliberately not per parameter. A `push` anywhere a loop can reach
   * may be a push to the array that loop is reading, because two names can
   * hold one array and nothing here proves they do not.
   */
  resizesArray: boolean
  /**
   * #1328: a `BodilessStance` was applied to these facts (`applyStance`). An
   * instance that `needsStance` and has none is given the unknown stance
   * (`assumeUnknownStance`), so a helper or a route that forgets to state one
   * fails closed rather than leaving the pure defaults.
   */
  stanceStated: boolean
  /**
   * WP29 P1: the function writes memory its caller could observe, directly or
   * through a callee (fixpoint over the call graph). `effect` is the wrong
   * question for that, because it is about what LLVM may reorder: a panic, a
   * `throw` and an arena allocation are all `EFFECT_WRITE` there, and a data
   * parallel body with a bounds check or an integer division would be refused
   * for them. This leaves those three out, and is what a caller asks when it
   * needs to know whether two calls can run at once.
   *
   * Why each is safe to leave out:
   *   - A panic (`nish_panic` for `panic`, `expect` and a range entry,
   *     `nish_panic_index`, `_slice`, `_div`, `_overflow`) claims the process,
   *     prints to fd 2 and `_exit`s (runtime/runtime.c): no user memory is
   *     written, no caller runs again to observe any, and when two threads
   *     panic at once only the first prints and exits (`nish_panic_claim`).
   *   - A `throw` lowers to `llvm.trap`, which writes nothing and never returns.
   *   - An arena allocation writes the arena's bump state and the fresh block.
   *     The block is unreachable until the function hands it out, and the bump
   *     state is per thread under `--threads` (`ARENA_GLOBAL_TLS`).
   *
   * A store into the function's own stack object (`stackLocals`), or into the
   * `this` a constructor initialises, is to memory nobody else holds yet, and
   * does not count either. `writesThrough` per pointer parameter is the finer
   * fact; this one is whole-function and deliberately coarse.
   */
  sharedWrite: boolean
  /**
   * The function is a method of an `AtomicI32` or an `AtomicI64`, whose body
   * the emitter writes as one atomic operation. R7 walks the callees for it
   * (`reachesAtomic` in `src/parallel.ts`), as it walks them for a lock.
   */
  atomic: boolean
  /**
   * `sharedWrite`, less the writes made straight through one of this
   * function's own pointer parameters (`p[i] = v`, `p.f = v`, `p.push(v)`, or
   * a call that writes a parameter handed on as it is), each of which also
   * sets that parameter's `writesThrough` (fixpoint). It is what a caller
   * composes with its arguments: a function that writes only through its
   * parameters writes nothing shared when every argument it writes through is
   * memory only its caller reaches (`privateArrays`). A callee whose
   * arguments are not composed (`wholeCallees`) hands its caller its whole
   * `sharedWrite` instead.
   */
  writesPastParams: boolean
  /**
   * `writesPastParams`, less the writes made below one of this function's own
   * pointer parameters (`p.xs[i] = v`, `this.xs.push(v)`), each of which also
   * sets that parameter's `writesDeep` (fixpoint). A caller that hands such a
   * callee only objects of its own, whose memory below them no parameter
   * reaches (`DirtMark`), writes nothing shared through it (`pastBelow`):
   * `const h = new H(); h.op()`, where `op` pushes onto `this.xs`.
   */
  writesElsewhere: boolean
  /**
   * The body itself writes to a stream or exits: `nish_write` or `nish_exit`,
   * which `console.log`, `console.error`, `write`, `writeError` and
   * `process.exit` call. A panic calls `nish_panic` instead
   * (`FunctionFacts.sharedWrite`).
   */
  writesOutput: boolean
  /**
   * Every argument of a call this function makes whose arguments are
   * composed: what the fixpoint asks each callee about (`composeArguments`).
   */
  argEdges: ArgEdge[]
  /**
   * The receivers of calls to callees taken whole (`wholeCallees`): a fused
   * lookup, a walk's methods, a `Map`'s value reader. Each edge's `index` is
   * -1, and a callee that writes shared memory is taken to write anything its
   * receiver reaches (`composeArguments`).
   */
  wholeReaches: ArgEdge[]
  /** Every slot this body writes, as a path (`MemPath`): what `composeArguments` turns into `writesReach`. */
  memWrites: MemPath[]
  /**
   * The slots this body writes of an object of its own (`ROOT_OWN`), with the
   * store at `ownSlotSites` beside each: a shared write only where a
   * `DirtMark` says the object there may be memory that is not its own
   * (`composeArguments`), as a call on one is.
   */
  ownSlotWrites: MemPath[]
  ownSlotSites: Node[]
  /**
   * The `const`s naming objects this call made, the one at `i` keyed `o<i>`
   * (`FactCollector.ownKeyOf`): a fresh allocation, or a fresh `Secret` the
   * body wipes. And the names it has resolved (`LocalPath`).
   */
  ownLocals: Local[]
  localPaths: LocalPath[]
  /** What may hold memory a parameter reaches below this call's own objects (`DirtMark`). */
  dirt: DirtMark[]
  /** The stores this body makes somewhere a parameter, or something unknown, reaches (`ParamStore`). */
  paramStores: ParamStore[]
  /**
   * A constructor that keeps in `this` memory it cannot name the parameter
   * of: `this` handed to a call, used as a value, or a value of unknown origin
   * stored into it (fixpoint). A `new` of the class then may hold anything.
   */
  keepsUnknown: boolean
  /**
   * The user callees reached other than through a call whose arguments are
   * composed: a fused lookup, a walk's methods, a routed map instance. Their
   * `sharedWrite` reaches this function whole.
   */
  wholeCallees: StringSet
  /**
   * A `nish/map` instance lowered at every call (`markMapRoute`): its body
   * is not what runs, so how far its routed callees write its receiver
   * reaches it only along `passedToCallees` (`propagate`).
   */
  routed: boolean
  /**
   * The arrays only this call reaches (`PrivateArray`). A store into one of
   * their own slots writes nothing a caller, a thread or a task can see.
   */
  privateArrays: PrivateArray[]
  /** The first node in the body that writes shared memory; `null` when a callee is the reason. */
  writeSite: Node | null
  /**
   * The first callee, by symbol and in the order the body reaches them, that
   * carries `sharedWrite`; `""` when `writeSite` is set.
   */
  writeVia: string
  /**
   * `nish:secret`: the first thing this body *itself* does that reaches the
   * world — a builtin that reads or writes a file, a process, the
   * environment, a socket, the clock, entropy or a stream, or a `panic`,
   * `process.exit` or `expect` whose message or status is computed — named as
   * the program spells it, or "". A `panic("...")` or `process.exit(1)` with a
   * literal is left out: what leaves then is a constant the program wrote. Not
   * a fixpoint: `exposeMessages` walks the callees itself, so it can name the
   * path.
   */
  worldVia: string
  effect: i32
  willReturn: boolean
  /** Can reach a `noreturn` runtime call, directly or through a callee. */
  callsNoReturn: boolean
  /** Parameter names that escape; decides `nocapture` for strings. */
  escaping: StringSet
  /**
   * The `escaping` names that escape other than by being handed to a user
   * function under the conservative rule in `noteUse`: returned, stored,
   * aliased, or given to a runtime entry.
   */
  keptOutright: StringSet
  /**
   * Pairs, name then callee as the source spells it: a parameter that
   * escapes because it is handed to that user function, the first such call
   * only. The escape-join refusal names the callee when this is the only
   * reason (`keptOutright` lacks the name).
   */
  passedOn: string[]
  /** User functions and runtime symbols called directly, by LLVM symbol. */
  callees: StringSet
  /** Parameter names in signature order (`this` first for methods). */
  paramNames: string[]
  /** Per pointer-typed parameter, in signature order. */
  pointerParams: PointerParamFacts[]
  /** A constructor: `this` is a fresh allocation, so it is `noalias`. */
  freshThis: boolean
  /** `sizeof` the returned struct, or 0 when the return type is not a struct. */
  returnDeref: i32
  /** The alignment a returned pointer is guaranteed to have; see `pointerAlign`. */
  returnAlign: i32
  // ---- WP6 memory strategy (see escape.ts) ----
  /** Node id -> the allocation there is lowered to an entry-block alloca. */
  stackSites: boolean[]
  /** Locals that only ever hold a stack object: accesses through them are own memory. */
  stackLocals: Local[]
  /** WP17: by-value `Result` parameters whose unpacked object is an entry-block alloca. */
  stackParams: StringSet
  /** Bracket the body with `nish_arena_mark` / `nish_arena_release`. Decided after the fixpoint. */
  arenaScope: boolean
  /** Performs an arena allocation, directly or through a callee (fixpoint). */
  allocates: boolean
  /** The body has an arena allocation of its own that flows `local`. */
  directArena: boolean
  /** An allocation may survive the call other than through the return value. */
  allocLeaks: boolean
  /**
   * `allocLeaks` for an allocation of the function's own, before any callee's
   * flows up: which of the two `--explain-memory` names as the reason.
   */
  leaksItself: boolean
  /**
   * WP9: an allocation is reachable *by the caller* after the call, other than
   * through the return value (fixpoint over callees). Refines `allocLeaks`,
   * which also counts a value assigned to a local of the frame; see the header
   * of escape.ts. `allocEscapes` implies `allocLeaks`, never the reverse.
   */
  allocEscapes: boolean
  /** An allocation of this function is returned: the caller owns it, so no scope here. */
  returnsAllocation: boolean
  /** The returned array may hold elements the call allocated (escape.ts, `isListingCall`). */
  returnsFreshElements: boolean
  /** The parameter whose elements the call fills with strings it allocated, or -1 (escape.ts, `fillsParam`). */
  fillsParam: i32
  /**
   * Reads the arena's bump position — `Arena.mark`, `Arena.used` — directly or
   * through a callee (fixpoint). Such a function answers a number that depends
   * on *when* the arena was last reclaimed, which is what stops
   * `marksTailCall` (escape.ts) from moving a scope release across a call to
   * it. Reading the position invalidates nothing, so it costs no function its
   * scope.
   */
  readsArenaState: boolean
  /**
   * Opens a `using a = arena()` block, directly or through a callee
   * (fixpoint). Kept apart from `readsArenaState` and `managesArena`, which
   * read `nish_arena_mark` out of `callees`: the block's mark is the
   * compiler's, checked like a pass's, so it costs no function its scopes. It
   * is what refuses the block in a parallel body (`arenaMessage`).
   */
  opensArena: boolean
  /**
   * WP46: calls one of `nish:region`'s functions, directly or through a
   * callee (fixpoint): it swaps the thread's arena for a region's. What
   * refuses `region`, `enter` and the rest in a parallel body or a task
   * (`arenaMessage`), and what a region's own `f` is not refused for.
   */
  usesRegion: boolean
  /**
   * WP49 stage 5, part 3: spawns a task with an object or array it shares,
   * directly or through a callee (fixpoint). The task holds it past the call
   * and past the spawner's return, in the executor's queue, which is a root
   * no parameter names: so no scope of this function's may release what the
   * call allocated, whatever `contained` reads off its roots.
   */
  feedsTasks: boolean
  /** Calls to pointer-returning user functions and where each result flows. */
  callSites: CallSite[]
  /** `EscapeResult.escapingNodes`: the sites whose value escapes. */
  escapingNodes: Node[]
  /** `EscapeResult.carriedStores` and `carriers`: the stores into a returned fresh array, and each array. */
  carriedStores: Node[]
  carriers: Local[]
  /** `EscapeResult.arenaNodes`: the sites that bump the arena themselves. */
  arenaNodes: Node[]
  /** `EscapeResult.arenaFlows`: each of those sites' flow, for the placement report. */
  arenaFlows: i32[]
  /** Every loop of the body, and whether its passes are scoped. Decided after the scopes are settled. */
  loopScopes: LoopScope[]
  /**
   * Every arena allocation made while this function runs, by itself or by
   * anything it calls, is unreachable once it returns except through its
   * return value. Decided after the fixpoint, from two proofs of it:
   *
   *  - `!allocEscapes`, WP9's fact, already propagated over every callee. The
   *    escape analysis follows values, not memory, so it counts *any* store of
   *    an allocation into memory as an escape, a store into another fresh
   *    object included; that is what makes it sound here, because it means
   *    no pointer read back out of memory can be one allocated during the call.
   *  - `rootsHoldNoPointer` (escape.ts), which needs nothing from the callees:
   *    nothing older than the call has a slot a pointer fits in.
   *
   * It is deliberately not a fixpoint of its own, falling from "contained" to
   * "not" over the callees the way `allocEscapes` rises. That version is
   * unsound: a callee whose parameters hold no pointers is contained however
   * it nests allocations inside the object it returns, and its caller can
   * read one back out of that object (`o.x`) and store it through its own
   * parameter. The read is not an allocation site, so nothing sees it, and
   * `tests/cases/mem_callee_scope_nested` is that program.
   */
  contained: boolean
  /** The first allocation of this function's own that escapes, or null; see `EscapeResult.escapeSite`. */
  escapeSite: Node | null
  /** The return type is a number, a `boolean`, an `enum` or `void`: nothing a release could free. */
  returnsScalar: boolean
  /** The function as a diagnostic names it: `Owner.method` for a member. */
  sourceName: string
  /** Allocates from the arena in its own body, before any callee is counted. */
  allocatesItself: boolean
  /** Calls `Arena.mark` in its own body: the program is managing this memory. */
  managesArena: boolean
  /**
   * Leaves arena memory behind when it returns: it allocates, itself or
   * through a callee that does, and has no scope to take it back. Settled with
   * the scopes; what the callee rule and the arena-loop diagnostic ask.
   */
  netAllocates: boolean
  /**
   * WP15 section 2c: the array headers the enclosing loops lifted into their
   * preheaders, innermost scope last, with `hoistedScopeStarts` marking where
   * each open scope begins. Emission scratch rather than an analysis result:
   * `emit-arrays.ts` fills it when a loop opens and truncates it when the loop
   * closes, and it is empty outside one.
   */
  hoistedHeaders: HoistedHeader[]
  hoistedScopeStarts: i32[]
  /**
   * The panic sites of this body as the walk met them, calls included as
   * candidates (`src/panics.ts`); `resolvePanicSites` settles them. Recorded
   * beside the callee each one adds, so the two cannot disagree, and only when
   * the build asks for them (`Options.recordsPanics`).
   */
  panicSites: PanicSite[]
  /** `clearRecursiveWillReturn`'s visit number, from 1; 0 until the walk reaches this function. */
  cycleOrder: i32
  /** The lowest visit number this function reaches back to, in the same walk. */
  cycleLow: i32
  /** On the walk's stack: in the component still being collected. */
  onCycleStack: boolean
  // ---- WP35 capabilities (docs/wp35-capabilities.md) ----
  /**
   * The capabilities this function can reach, one bit each (`src/capabilities.ts`),
   * directly or through a callee (`propagateCapabilities`). Round 2 only: round
   * 1's facts carry none, because nothing reads them before the report.
   */
  caps: i32
  /**
   * The witness of each capability in `caps`, by the capability's index:
   * what the chain calls next (a builtin's name, a `declare function`'s name,
   * or a user callee's symbol), the call that does it, and how many calls
   * away the builtin is (0 when `via` is the builtin itself). Empty until the
   * first bit is set, so a function that reaches nothing allocates nothing.
   */
  capVia: string[]
  capSite: (Node | null)[]
  capDist: i32[]
  /** Every call to a user function, by callee symbol and call node, in walk order: the edges the witnesses follow. */
  capCallees: string[]
  capSites: Node[]

  constructor(paramNames: string[], nodeCount: i32) {
    this.hasLoops = false
    this.readsMemory = false
    this.loopsBounded = true
    this.hasTrap = false
    this.resizesArray = false
    this.stanceStated = false
    this.sharedWrite = false
    this.atomic = false
    this.writesPastParams = false
    this.writesElsewhere = false
    this.argEdges = []
    this.wholeReaches = []
    this.memWrites = []
    this.ownSlotWrites = []
    this.ownSlotSites = []
    this.ownLocals = []
    this.localPaths = []
    this.dirt = []
    this.paramStores = []
    this.keepsUnknown = false
    this.wholeCallees = new StringSet()
    this.routed = false
    this.privateArrays = []
    this.writesOutput = false
    this.writeSite = null
    this.writeVia = ""
    this.worldVia = ""
    this.effect = EFFECT_NONE
    this.willReturn = true
    this.callsNoReturn = false
    this.escaping = new StringSet()
    this.keptOutright = new StringSet()
    this.passedOn = []
    this.callees = new StringSet()
    this.paramNames = paramNames
    this.pointerParams = []
    this.freshThis = false
    this.returnDeref = 0
    this.returnAlign = 8
    this.hoistedHeaders = []
    this.hoistedScopeStarts = []
    this.panicSites = []
    this.cycleOrder = 0
    this.cycleLow = 0
    this.onCycleStack = false
    this.stackSites = new Array<boolean>(nodeCount)
    this.stackLocals = []
    this.stackParams = new StringSet()
    this.arenaScope = false
    this.allocates = false
    this.directArena = false
    this.allocLeaks = false
    this.leaksItself = false
    this.allocEscapes = false
    this.returnsAllocation = false
    this.returnsFreshElements = false
    this.fillsParam = -1
    this.readsArenaState = false
    this.opensArena = false
    this.usesRegion = false
    this.feedsTasks = false
    this.callSites = []
    this.escapingNodes = []
    this.carriedStores = []
    this.carriers = []
    this.arenaNodes = []
    this.arenaFlows = []
    this.loopScopes = []
    this.contained = false
    this.escapeSite = null
    this.returnsScalar = false
    this.sourceName = ""
    this.allocatesItself = false
    this.managesArena = false
    this.netAllocates = false
    this.caps = 0
    this.capVia = []
    this.capSite = []
    this.capDist = []
    this.capCallees = []
    this.capSites = []
  }

  /**
   * WP35: offer `site` as the witness of the capability with index `index`,
   * `dist` calls from the builtin, through `via`; answers whether it was
   * taken. The shorter chain wins, then the earlier site in this function's
   * source, then the smaller `via`, so the witness the fixpoint settles on is
   * the same whatever order it visited the program in.
   */
  offerCapability(index: i32, via: string, site: Node, dist: i32): boolean {
    if (this.capVia.length === 0) {
      const none: Node | null = null
      let i = 0
      while (i < CAPABILITY_COUNT) {
        this.capVia.push("")
        this.capSite.push(none)
        this.capDist.push(0)
        i = i + 1
      }
    }
    const bit = 1 << index
    const held = this.capSite[index]
    if ((this.caps & bit) !== 0 && held !== null) {
      const heldDist = this.capDist[index]
      if (dist > heldDist) {
        return false
      }
      if (dist === heldDist) {
        if (site.start > held.start) {
          return false
        }
        if (site.start === held.start && compareStrings(via, this.capVia[index]) >= 0) {
          return false
        }
      }
    }
    this.caps = this.caps | bit
    this.capVia[index] = via
    this.capSite[index] = site
    this.capDist[index] = dist
    return true
  }

  /** The pointer facts of the parameter called `name`, or `null` when it is not one. */
  pointerParam(name: string): PointerParamFacts | null {
    for (const pp of this.pointerParams) {
      if (pp.name === name) {
        return pp
      }
    }
    return null
  }

  /** The pointer facts of parameter `index`, resolved through `paramNames`. */
  pointerParamAt(index: i32): PointerParamFacts | null {
    if (index < 0 || index >= this.paramNames.length) {
      return null
    }
    return this.pointerParam(this.paramNames[index])
  }

  /** WP6: the allocation at `node` was proved not to outlive the function. */
  isStackSite(node: Node): boolean {
    return node.id < this.stackSites.length && this.stackSites[node.id]
  }

  /** Each pass of `body` is bracketed with its own arena scope: it is the body of a scoped loop. */
  scopesPass(body: Node): boolean {
    for (const scope of this.loopScopes) {
      if (scope.body === body) {
        return scope.scoped
      }
    }
    return false
  }

  scopesAnyPass(): boolean {
    for (const scope of this.loopScopes) {
      if (scope.scoped) {
        return true
      }
    }
    return false
  }

  /** WP17: the object the by-value `Result` parameter `name` unpacks into is an alloca. */
  isStackParam(name: string): boolean {
    return this.stackParams.has(name)
  }

  holdsStackObject(local: Local): boolean {
    for (const candidate of this.stackLocals) {
      if (candidate === local) {
        return true
      }
    }
    return false
  }
}

/**
 * Facts for every function of a whole program, keyed by LLVM symbol.
 *
 * A symbol and no longer a bare name, since WP21 S1: every symbol carries its
 * module's package prefix (`src/packages.ts`), so two dependencies that each
 * keep a private `helper()` get two entries here instead of one. Sharing an
 * entry would emit each of them with the other's purity, escape and pointer
 * facts, which is a miscompile rather than a missed optimisation. Nothing here
 * changed for it: the root package's prefix is empty, so a single-package
 * program is analysed under exactly the keys it always was.
 */
export class FactsTable {
  index: StringMap
  list: FunctionFacts[]
  /**
   * `--no-elision` (`Options.noElision`): no inferred arena scope, so no call
   * site reclaims what its callee left (`reclaimsReturnedString`), which the
   * tail-call proof and the arena report read as well as the emitter.
   */
  noElision: boolean

  constructor() {
    this.index = new StringMap()
    this.list = []
    this.noElision = false
  }

  set(name: string, facts: FunctionFacts): void {
    const at = this.index.get(name, -1)
    if (at >= 0) {
      // A symbol is unique across a program (the driver rejects clashes), so
      // this only happens on the second collection round, which replaces the
      // first round's facts in place.
      this.list[at] = facts
      return
    }
    this.index.set(name, this.list.length)
    this.list.push(facts)
  }

  get(name: string): FunctionFacts | null {
    const at = this.index.get(name, -1)
    return at < 0 ? null : this.list[at]
  }

  /** The position of `name`'s facts in `list`, or -1 for a symbol with none (a runtime function). */
  indexOf(name: string): i32 {
    return this.index.get(name, -1)
  }
}

// ---- Escape classification --------------------------------------------------------------

/** How the enclosing construct consumes a parameter reference. */
export const USE_NONE: i32 = 0 // consumed on the spot
const USE_ESCAPE: i32 = 1 // retained: returned, stored, aliased, or not modelled
export const USE_ARGUMENT: i32 = 2 // passed to a user function
export const USE_READ: i32 = 3 // receiver of a field, element, `.length` or `for...of` read
export const USE_WRITE: i32 = 4 // receiver of a field store, element store or `push`

export class ParamUse {
  kind: i32
  /** For `USE_ARGUMENT`: the callee and the parameter index (`this` counts as 0). */
  callee: FunctionSig | null
  index: i32

  constructor(kind: i32) {
    this.kind = kind
    this.callee = null
    this.index = 0
  }
}

const use = (kind: i32): ParamUse => new ParamUse(kind)

const argumentUse = (callee: FunctionSig, index: i32): ParamUse => {
  const result = new ParamUse(USE_ARGUMENT)
  result.callee = callee
  result.index = index
  return result
}

/** The position of `node` in its `NodeKind.List` parent, which is the argument index. */
const indexInList = (list: Node, node: Node): i32 => {
  let i = 0
  while (i < list.children.length) {
    if (list.children[i] === node) {
      return i
    }
    i = i + 1
  }
  return -1
}

/**
 * Classify a reference to a parameter by walking up through the transparent
 * wrappers (parentheses, ternary arms, single-hole templates) to the construct
 * that consumes the value. Anything not explicitly harmless escapes.
 */
export const classifyUse = (unit: AnalysisUnit, table: TypeTable, ref: Node): ParamUse => {
  const program = unit.program
  let node = ref
  // Set once the value is an inline element: the address of a slot in the array.
  let interior = false
  for (;;) {
    const parent = unit.parents.parentOf(node)
    if (parent === null) {
      return use(USE_ESCAPE)
    }
    if (parent.kind === NodeKind.Paren) {
      node = parent
      continue
    }
    if (parent.kind === NodeKind.Conditional) {
      if (parent.children[0] === node) {
        return use(USE_NONE)
      }
      node = parent
      continue
    }
    if (parent.kind === NodeKind.Template) {
      // A concatenating template copies its holes and the runtime keeps
      // nothing; only the single-hole passthrough hands the value on.
      if (!isStringPassthrough(program, parent)) {
        return use(USE_NONE)
      }
      node = parent
      continue
    }
    if (parent.kind === NodeKind.Index && parent.children[0] === node) {
      if (yieldsInteriorPointer(unit, table, parent)) {
        node = parent
        interior = true
        continue
      }
      return classifyElementUse(unit, parent)
    }
    if (parent.kind === NodeKind.Member) {
      return classifyMemberUse(unit, table, parent)
    }
    if (parent.kind === NodeKind.List) {
      return classifyArgumentUse(unit, table, parent, node)
    }
    // `{ ...s }` copies each of `s`'s fields into the literal's object
    // (`emitSpreadCopy`): the source is read, and nothing keeps it.
    if (parent.kind === NodeKind.Spread && (parent.flags & FLAG_OBJECT_SPREAD) !== 0) {
      return use(USE_READ)
    }
    if (parent.kind === NodeKind.Call) {
      return use(USE_NONE) // the callee position of `p(...)`, which the checker refuses anyway
    }
    if (parent.kind === NodeKind.New) {
      return use(USE_ESCAPE) // the constructed name, not an argument
    }
    if (parent.kind === NodeKind.Binary) {
      // WP32: `a ?? d` hands on whichever operand it answers, as a ternary does.
      if (parent.text === "??") {
        node = parent
        continue
      }
      // Assignment retains the right-hand side; every other operator consumes both operands.
      if (isAssignmentOperator(parent.text)) {
        if (parent.children[1] !== node) {
          return use(USE_NONE)
        }
        // WP15 §2a: `xs[i] = p` into an inline-element array copies `p`'s bytes
        // into the slot, exactly as `push` does; nothing keeps the pointer.
        const target = unwrapParens(parent.children[0])
        if (target.kind === NodeKind.Index && storesInlineElements(program, table, target.children[0])) {
          return use(USE_READ)
        }
        return use(USE_ESCAPE)
      }
      return use(USE_NONE)
    }
    // An element of an array literal whose elements are inline is copied into
    // the fresh block the literal allocates, so the value is read, not kept.
    if (parent.kind === NodeKind.Array && storesInlineElements(program, table, parent)) {
      return use(USE_READ)
    }
    if (parent.kind === NodeKind.ForOf) {
      // WP32: a walk of a `Set` itself hands it to the table's walk methods,
      // `walkOpen` first, whose stores into the table are the walk's only
      // writes; `m.keys()` reaches here as the receiver of that call instead.
      const read = program.nodeCallees[parent.id]
      if (read !== null && parent.children[1] === node) {
        const owner = read.owner
        const open: FunctionSig | null = owner === null ? null : owner.method("walkOpen")
        return open === null ? use(USE_ESCAPE) : argumentUse(open, 0)
      }
      // The loop variable of an inline-element array is each slot's address,
      // so the array itself is what the body holds (`yieldsInteriorPointer`).
      if (parent.children[1] !== node) {
        return use(USE_ESCAPE)
      }
      if (!storesInlineElements(program, table, node)) {
        return use(USE_READ)
      }
      return classifyElementHolder(
        unit,
        table,
        program.nodeLocals[parent.children[0].children[0].children[0].id],
        parent
      )
    }
    // `const p = xs[i]`: the local holds the slot, and is what uses it.
    if (interior && parent.kind === NodeKind.VarDecl && parent.children[2] === node) {
      return classifyElementHolder(unit, table, program.nodeLocals[parent.id], enclosingBlock(unit, parent))
    }
    if (
      parent.kind === NodeKind.VarDecl &&
      parent.children[2] === node &&
      parent.children[0].kind === NodeKind.BindingPattern
    ) {
      return classifyPatternUse(unit, table, parent)
    }
    if (parent.kind === NodeKind.Unary) {
      return use(USE_NONE)
    }
    if (parent.kind === NodeKind.ExprStmt || parent.kind === NodeKind.Throw) {
      return use(USE_NONE)
    }
    if (parent.kind === NodeKind.If || parent.kind === NodeKind.While || parent.kind === NodeKind.Do) {
      return use(USE_NONE)
    }
    if (parent.kind === NodeKind.For) {
      return use(USE_NONE)
    }
    return use(USE_ESCAPE) // return, variable initializer, array/object literal element, ...
  }
}

/**
 * `const { x, y } = p`: the hidden receiver holds `p` only for the names the
 * parser declared after it (`decl.children[3..]`), each `recv.key` or
 * `recv[i]`, so `p` is used as those reads use the receiver: read, written
 * through, or escaping if any of them is.
 */
const classifyPatternUse = (unit: AnalysisUnit, table: TypeTable, decl: Node): ParamUse => {
  let kind = USE_NONE
  let i = PATTERN_NAMES_AT
  while (i < decl.children.length) {
    const found = classifyUse(unit, table, decl.children[i].children[2].children[0])
    if (found.kind === USE_WRITE || (found.kind === USE_READ && kind !== USE_WRITE)) {
      kind = found.kind
    } else if (found.kind !== USE_NONE) {
      return use(USE_ESCAPE)
    }
    i = i + 1
  }
  return use(kind)
}

/** `p.f`, `p.f = v`, `p.m(...)`, `p.length`: the member access is the consumer. */
const classifyMemberUse = (unit: AnalysisUnit, table: TypeTable, access: Node): ParamUse => {
  const program = unit.program
  const above = unit.parents.parentOf(access)
  if (above !== null && above.kind === NodeKind.Call && above.children[0] === access) {
    const callee = program.nodeCallees[above.id]
    if (callee !== null) {
      return argumentUse(callee, 0)
    }
    // `p.push(v)` and `p.pop()` store into the array header, and `p.set(q)`
    // and `p.fill(v)` into its elements (WP34 N2); `indexOf` and `join` only
    // read it, and so do the string byte methods, whose runtime parameters
    // are all `nocapture readonly` and whose `substring` copies what it keeps.
    // Anything else is treated as retaining the receiver.
    const method = arrayMethodName(program, table, above)
    if (isArrayWriteMethod(method)) {
      return use(USE_WRITE)
    }
    if (method.length > 0) {
      return use(USE_READ)
    }
    // WP16: `r.orReturn()`, `r.unwrapOr(d)` and `r.expect(m)` load out of the
    // receiver and never store the pointer itself anywhere.
    if (resultMethodName(program, table, above).length > 0) {
      return use(USE_READ)
    }
    return use(isStringMethodCall(program, above) ? USE_READ : USE_ESCAPE)
  }
  // An inline array field's slots are bytes of the object itself, so writing
  // an element of `p.f` writes through `p` (`src/inline-arrays.ts`). The
  // pointer layout's slots are an allocation of their own, and there the
  // same store is only a read of `p`.
  if (
    above !== null &&
    above.kind === NodeKind.Index &&
    above.children[0] === access &&
    isInlineField(program, table, access)
  ) {
    const store = unit.parents.parentOf(above)
    if (
      isAssignmentTarget(store, above) ||
      (store !== null && store.kind === NodeKind.Unary && (store.text === "++" || store.text === "--"))
    ) {
      return use(USE_WRITE)
    }
  }
  return use(isAssignmentTarget(above, access) ? USE_WRITE : USE_READ)
}

/** Whether `access` reads an array field stored inside its object (`FieldInfo.inlineCapacity`). */
const isInlineField = (program: CheckedProgram, table: TypeTable, access: Node): boolean => {
  const receiver = program.nodeTypes[access.children[0].id]
  if (receiver < 0) {
    return false
  }
  const t = table.stripNull(receiver)
  if (!table.isStruct(t)) {
    return false
  }
  const info = program.struct(table.nameOf(t))
  if (info === null) {
    return false
  }
  const field = info.field(access.text)
  return field !== null && field.inline()
}

/**
 * Whether the `spawn(...)` at `node` hands its task an object or array it
 * shares (`TypeTable.sharedWithTask`): a value the task holds in place.
 */
const spawnsShared = (program: CheckedProgram, table: TypeTable, node: Node): boolean => {
  const args = node.children[1].children
  if (args.length !== 1) {
    return false
  }
  const callee = program.nodeCallees[unwrapParens(args[0]).id]
  if (callee === null) {
    return false
  }
  for (let i = 0; i < callee.paramTypes.length; i++) {
    if (!callee.isCompileTime(i) && table.sharedWithTask(callee.paramTypes[i])) {
      return true
    }
  }
  // WP49 stage 5, part 8: an arrow the task is handed may capture an object it shares.
  for (const slot of capturesOf(callee)) {
    if (table.sharedWithTask(slot.type())) {
      return true
    }
  }
  return false
}

/** Whether `call` is the task of a `spawn(...)` from `nish:async`. */
const isSpawnedTask = (unit: AnalysisUnit, call: Node): boolean => {
  let node = call
  let parent = unit.parents.parentOf(node)
  while (parent !== null && parent.kind === NodeKind.Paren) {
    node = parent
    parent = unit.parents.parentOf(node)
  }
  if (parent === null) {
    return false
  }
  const spawn = unit.parents.parentOf(parent)
  return (
    spawn !== null && spawn.kind === NodeKind.Call && unit.program.nodeBuiltins[spawn.id] === "async.spawn"
  )
}

/** An argument of `f(...)` or `new C(...)`: the list is the parent, the call is above it. */
const classifyArgumentUse = (unit: AnalysisUnit, table: TypeTable, list: Node, node: Node): ParamUse => {
  const program = unit.program
  const owner = unit.parents.parentOf(list)
  if (owner === null) {
    return use(USE_ESCAPE)
  }
  if (owner.kind === NodeKind.Call) {
    const index = indexInList(list, node)
    if (index < 0) {
      return use(USE_ESCAPE)
    }
    const callee = program.nodeCallees[owner.id]
    if (callee !== null) {
      // WP49 stage 5: a spawned task holds an object or array it is handed
      // in place for as long as it runs, past the spawner's return, so the
      // spawner's region must too. A string is copied into the task's region.
      const at = index + (callee.owner !== null ? 1 : 0)
      if (
        at < callee.paramTypes.length &&
        table.sharedWithTask(callee.paramTypes[at]) &&
        isSpawnedTask(unit, owner)
      ) {
        return use(USE_ESCAPE)
      }
      return argumentUse(callee, at)
    }
    // `xs.push(p)` stores `p` into the array, `Ok(p)` / `Err(p)` store it into
    // the `Result` they build (WP16), `r.unwrapOr(p)` hands it back as the
    // expression's value, and `spawnSync(p)` leaves the runtime holding an
    // arena vector of pointers into `p`'s strings (WP14 D4); every other
    // builtin lowers to runtime functions whose pointer params are all
    // declared `nocapture`.
    // WP15 §2a: a push into an array that holds its elements inline *copies*
    // the object into the slot, so the pointer is read and then forgotten —
    // the one shape where a push does not retain what it was given.
    if (isPushCall(program, table, owner)) {
      const receiver = methodReceiver(owner)
      const inline = receiver !== null && storesInlineElements(program, table, receiver)
      return use(inline ? USE_READ : USE_ESCAPE)
    }
    if (isResultConstructorCall(program, table, owner) || isSpawnCall(program, owner)) {
      return use(USE_ESCAPE)
    }
    // WP34 N3 and N5: `crypto.getRandomValues(p)` writes every element of
    // `p`, and `netRead(fd, p, off, len)` the range it reads into, and each
    // keeps nothing, as `p.fill(v)` would; without this `p` would be `readonly`.
    if (isWrittenArgument(builtinArgumentLetters(program, owner), index)) {
      return use(USE_WRITE)
    }
    // `uncheckedGet(p, i)` (`nish:unsafe`) is one load of an element of `p`,
    // inline, and the element is a number, so `p` is read and kept by nothing
    // -- which is all `readonly nocapture` claims of it. `uncheckedSet`'s `p`
    // is the written argument above.
    // A `nish:simd` load reads elements of its array the same way.
    const read = builtinNameOf(program, owner)
    if (index === 0 && (read === "uncheckedGet" || isSimdLoad(read))) {
      return use(USE_READ)
    }
    // WP34 N2: `dst.set(p)` reads `p`'s elements into `dst`'s buffer and keeps
    // nothing — the elements are numbers, and the copy is a `memmove` whose
    // source is `nocapture readonly`.
    if (arrayMethodName(program, table, owner) === "set") {
      return use(USE_READ)
    }
    return use(resultMethodName(program, table, owner) === "unwrapOr" ? USE_ESCAPE : USE_NONE)
  }
  if (owner.kind === NodeKind.New) {
    // `new C(...)` has two lists: type arguments and value arguments.
    if (owner.children[2] !== list) {
      return use(USE_ESCAPE)
    }
    const index = indexInList(list, node)
    const ctor = constructorOf(program, table, intrinsicType(program, owner))
    if (index < 0 || ctor === null) {
      return use(USE_ESCAPE)
    }
    return argumentUse(ctor, index + 1)
  }
  return use(USE_ESCAPE)
}

/**
 * `xs[i]` whose value is the address of a slot inside `xs`'s data block
 * rather than a pointer loaded out of it: `xs` holds its elements inline
 * (WP15 §2a), and the element is used as a value — kept in a local, passed,
 * returned, stored — rather than read from or written through on the spot.
 *
 * Whoever holds that value holds `xs`'s memory, so a use of it is a use of
 * `xs`, and the classifiers see through the index to it. Reading a field of
 * the element (`xs[i].x`) or writing the slot (`xs[i] = p`, which copies)
 * keeps nothing, and neither is this. Before this was seen through, a
 * function could store `xs[i]` into its parameter's object, be told nothing
 * escaped, and release the arena it pointed into
 * (`tests/cases/mem_loop_scope_interior`).
 */
export const yieldsInteriorPointer = (unit: AnalysisUnit, table: TypeTable, access: Node): boolean => {
  if (!storesInlineElements(unit.program, table, access.children[0])) {
    return false
  }
  let node = access
  let parent = unit.parents.parentOf(node)
  while (parent !== null && parent.kind === NodeKind.Paren) {
    node = parent
    parent = unit.parents.parentOf(node)
  }
  return parent !== null && parent.kind !== NodeKind.Member && !isAssignmentTarget(parent, node)
}

/**
 * A local that holds an inline element (`const p = xs[i]`, or the variable of
 * a `for...of` over such an array), classified as a use of the array: every
 * reference to it reads or writes one of the slot's fields on the spot, which
 * is `USE_READ` or `USE_WRITE` exactly as `xs[i].x` is, or anything else, which
 * keeps the slot's address and escapes. `within` is where the local is
 * visible: its block, or the `for...of`.
 */
const classifyElementHolder = (
  unit: AnalysisUnit,
  table: TypeTable,
  holder: Local | null,
  within: Node | null
): ParamUse => {
  if (holder === null || within === null) {
    return use(USE_ESCAPE)
  }
  const refs: Node[] = []
  collectRefs(unit.program, within, holder, refs)
  let kind = USE_READ
  for (const ref of refs) {
    let node = ref
    let parent = unit.parents.parentOf(node)
    while (parent !== null && parent.kind === NodeKind.Paren) {
      node = parent
      parent = unit.parents.parentOf(node)
    }
    if (parent === null || parent.kind !== NodeKind.Member) {
      return use(USE_ESCAPE)
    }
    const found = classifyMemberUse(unit, table, parent)
    if (found.kind === USE_WRITE) {
      kind = USE_WRITE
    } else if (found.kind !== USE_READ) {
      return use(USE_ESCAPE)
    }
  }
  return use(kind)
}

/** Every identifier under `node` that names `local`, skipping lifted arrow bodies. */
const collectRefs = (program: CheckedProgram, node: Node, local: Local, out: Node[]): void => {
  if (node.kind === NodeKind.Arrow) {
    return
  }
  if (node.kind === NodeKind.Ident) {
    const named = program.nodeLocals[node.id]
    if (named !== null && named === local) {
      out.push(node)
    }
  }
  for (const child of node.children) {
    collectRefs(program, child, local, out)
  }
}

/**
 * Whether `local` is named inside an arrow under `node` (`inside` when `node`
 * is in one already). `collectRefs` does not look there, because an arrow is
 * a function of its own; a private array named in one would be reachable from
 * whatever runs it, so it is not private (`FactCollector.notePrivateArray`).
 */
const namedInArrow = (program: CheckedProgram, node: Node, local: Local, inside: boolean): boolean => {
  if (inside && node.kind === NodeKind.Ident) {
    // A data-parallel arrow's capture names the local it was made from (WP29).
    const named = sourceLocal(program.nodeLocals[node.id])
    if (named !== null && named === local) {
      return true
    }
  }
  const deeper = inside || node.kind === NodeKind.Arrow
  for (const child of node.children) {
    if (namedInArrow(program, child, local, deeper)) {
      return true
    }
  }
  return false
}

/**
 * The local `parts` when `expr`, seen through parentheses, is an argument of
 * `parts.push(...)`, or null.
 */
export const pushedOnto = (unit: AnalysisUnit, table: TypeTable, expr: Node): Local | null => {
  const program = unit.program
  let list = unit.parents.parentOf(expr)
  while (list !== null && list.kind === NodeKind.Paren) {
    list = unit.parents.parentOf(list)
  }
  if (list === null || list.kind !== NodeKind.List) {
    return null
  }
  const call = unit.parents.parentOf(list)
  if (call === null || !isPushCall(program, table, call) || call.children[1] !== list) {
    return null
  }
  const receiver = unwrapParens(call.children[0].children[0])
  return receiver.kind === NodeKind.Ident ? program.nodeLocals[receiver.id] : null
}

/** `v` is a local of this function that `decl` binds to its own array literal or `new Array`. */
export const isFreshArrayLocal = (table: TypeTable, v: Local, decl: Node | null): boolean => {
  if (v.storage !== STORAGE_LOCAL || !table.isArray(v.type) || decl === null) {
    return false
  }
  const init = unwrapParens(decl.children[2])
  return init.kind === NodeKind.Array || init.kind === NodeKind.New
}

/**
 * `parts` is a `string[]` that `decl` binds to a fresh array of this function
 * (`isFreshArrayLocal`), and every one of `refs`, its references, pushes onto
 * it, joins it or reads its length (`isPartsUse`).
 *
 * A string pushed onto such an array is reachable only through its elements,
 * and nothing reads those but `join`, which copies every part into a string of
 * its own (`emitJoin`). So once the frame that owns `parts` returns, nothing
 * can reach what was pushed through it. The escape analysis uses this for a
 * string the function allocates (`pushedIntoJoinedParts`), and `noteUse` for
 * a string it is handed (#503). Any other use of `parts` could hand a part
 * back out, and so could an alias of an array that is not this function's
 * own, so each keeps the conservative answer (`tests/cases/mem_join_parts_*`).
 */
export const isJoinedParts = (
  unit: AnalysisUnit,
  table: TypeTable,
  parts: Local,
  decl: Node | null,
  refs: Node[]
): boolean => {
  if (decl === null || !isFreshArrayLocal(table, parts, decl) || table.refOf(parts.type) !== T_STRING) {
    return false
  }
  // `refs` skips lifted arrow bodies, but an arrow argument that captures
  // `parts` reads it when the call runs, later than the join may release it.
  let body: Node = decl
  let above = unit.parents.parentOf(body)
  while (above !== null && above.kind !== NodeKind.Arrow && above.kind !== NodeKind.FunctionDecl) {
    body = above
    above = unit.parents.parentOf(body)
  }
  if (namedInArrow(unit.program, body, parts, false)) {
    return false
  }
  for (const ref of refs) {
    if (!isPartsUse(unit, table, ref)) {
      return false
    }
  }
  return true
}

/** `ref` is `parts.push(...)`, `parts.join(...)` or `parts.length`, and nothing else. */
const isPartsUse = (unit: AnalysisUnit, table: TypeTable, ref: Node): boolean => {
  const program = unit.program
  const access = unit.parents.parentOf(ref)
  if (access === null || access.kind !== NodeKind.Member || access.children[0] !== ref) {
    return false
  }
  const above = unit.parents.parentOf(access)
  if (above !== null && above.kind === NodeKind.Call && above.children[0] === access) {
    return isPushCall(program, table, above) || isJoinCall(program, table, above)
  }
  // `parts.length = n` is refused for every array, so a `length` here is a read.
  return access.text === "length"
}

/**
 * Every declaration under `node` that binds a local, in the order a walk
 * from `node` meets them, filed by the local's name: `names` answers a
 * bucket of `buckets`. It skips lifted arrow bodies as `collectRefs` does,
 * so the two walks see the same function.
 */
const gatherDeclarations = (
  program: CheckedProgram,
  node: Node,
  names: StringMap,
  buckets: Node[][]
): void => {
  if (node.kind === NodeKind.Arrow) {
    return
  }
  const declared: Local | null = node.kind === NodeKind.VarDecl ? program.nodeLocals[node.id] : null
  if (declared !== null) {
    let at = names.get(declared.name, -1)
    if (at < 0) {
      at = buckets.length
      names.set(declared.name, at)
      buckets.push([])
    }
    buckets[at].push(node)
  }
  for (const child of node.children) {
    gatherDeclarations(program, child, names, buckets)
  }
}

/**
 * The parameter every `return` of `callee` hands back, when each returns
 * either that parameter or a fresh allocation (`new`, an array or an object
 * literal); -1 otherwise, and for a method, whose answer may be its
 * receiver's. A call to such a function answers memory no further from its
 * caller than that argument, since a parameter is never reassigned
 * (`checkAssignment` and `checkIncrement` in `expressions.ts` refuse it, NL2179):
 * `rebuiltSlots` in `std/collections.ts`, which `Map.rebuild` refiles into.
 * A fresh return may hold another argument's memory, `[ys]` or `new H(ys)`,
 * and the path still names only the one parameter: that is sound because a
 * task's own write through the answer lands in its top-level slots, which a
 * fresh allocation owns, and any deeper write or a field's is refused
 * (`reject_thread_task_own_fresh_holds_*`).
 */
const returnedParameter = (callee: FunctionSig): i32 => {
  const body = callee.body()
  if (body === null || callee.owner !== null || callee.foreign()) {
    return -1
  }
  const returned: Node[] = []
  const bound: string[] = []
  if (body.kind === NodeKind.Block) {
    returnsAndBindings(body, returned, bound)
  } else {
    returned.push(body)
  }
  let at = -1
  for (const r of returned) {
    const e = unwrapParens(r)
    if (e.kind === NodeKind.New || e.kind === NodeKind.Array || e.kind === NodeKind.Object) {
      continue
    }
    const index =
      e.kind === NodeKind.Ident && bound.indexOf(e.text) < 0 ? callee.paramNames.indexOf(e.text) : -1
    if (index < 0 || index >= callee.writtenArity() || (at >= 0 && at !== index)) {
      return -1
    }
    at = index
  }
  return at
}

/**
 * The expressions `node`'s `return`s give, outside nested arrows, into
 * `returned` (a bare `return` gives its EMPTY), and every name it binds into
 * `bound`, so a name that shadows a parameter is never taken for it.
 */
const returnsAndBindings = (node: Node, returned: Node[], bound: string[]): void => {
  if (node.kind === NodeKind.Return) {
    returned.push(node.children[0])
  }
  if (node.kind === NodeKind.VarDecl || node.kind === NodeKind.Param) {
    bound.push(node.children[0].text)
  }
  if (node.kind === NodeKind.Try && node.children[1].kind === NodeKind.Ident) {
    bound.push(node.children[1].text)
  }
  if (node.kind === NodeKind.Arrow) {
    return
  }
  for (const child of node.children) {
    returnsAndBindings(child, returned, bound)
  }
}

/** The block a declaration's scope ends with, or null when it is not in one. */
const enclosingBlock = (unit: AnalysisUnit, decl: Node): Node | null => {
  let node: Node | null = unit.parents.parentOf(decl)
  while (node !== null && node.kind !== NodeKind.Block) {
    node = unit.parents.parentOf(node)
  }
  return node
}

/**
 * The parameter is the indexing base of `access` (`p[i]`, `p[i][j]`, ...).
 * The value obtained is a loaded element, not the pointer, so the pointer can
 * never be captured this way; but a store through the element counts as a
 * write through `p`, conservatively, as docs/wp4-arrays.md specifies.
 */
const classifyElementUse = (unit: AnalysisUnit, access: Node): ParamUse => {
  const program = unit.program
  let node = access
  for (;;) {
    const parent = unit.parents.parentOf(node)
    if (parent === null) {
      return use(USE_READ)
    }
    if (
      parent.kind === NodeKind.Paren ||
      (parent.kind === NodeKind.Index && parent.children[0] === node) ||
      (parent.kind === NodeKind.Binary && parent.text === "??") // WP32: as a ternary's arm
    ) {
      node = parent
      continue
    }
    if (parent.kind === NodeKind.Conditional) {
      if (parent.children[0] === node) {
        return use(USE_READ)
      }
      node = parent
      continue
    }
    if (isAssignmentTarget(parent, node)) {
      return use(USE_WRITE)
    }
    if (parent.kind === NodeKind.Member) {
      const above = unit.parents.parentOf(parent)
      const called = above !== null && above.kind === NodeKind.Call && above.children[0] === parent
      return use(called || isAssignmentTarget(above, parent) ? USE_WRITE : USE_READ)
    }
    if (parent.kind === NodeKind.List) {
      const owner = unit.parents.parentOf(parent)
      if (owner !== null && owner.kind === NodeKind.Call) {
        // The constructor or function may store through the element; builtins are nocapture.
        return use(program.nodeCallees[owner.id] !== null ? USE_WRITE : USE_READ)
      }
      if (owner !== null && owner.kind === NodeKind.New) {
        return use(USE_WRITE)
      }
      return use(USE_READ)
    }
    if (parent.kind === NodeKind.Call || parent.kind === NodeKind.New) {
      return use(parent.kind === NodeKind.New ? USE_WRITE : USE_READ)
    }
    return use(USE_READ)
  }
}

/**
 * The constructor `new` runs for a struct type. `null` when the type is not
 * a struct or nothing constructs it.
 */
export const constructorOf = (program: CheckedProgram, table: TypeTable, type: i32): FunctionSig | null => {
  if (type < 0 || !table.isStruct(type)) {
    return null
  }
  const info = program.struct(table.nameOf(type))
  return info === null ? null : info.ctor
}

/** `` `${s}` ``: a template that lowers to its single string hole unchanged. */
const isStringPassthrough = (program: CheckedProgram, template: Node): boolean => {
  if (!isTemplateExpression(template)) {
    return false
  }
  const parts = templateParts(template)
  if (parts.length !== 1 || parts[0].kind === NodeKind.TemplateText) {
    return false
  }
  return program.nodeTypes[parts[0].id] === T_STRING
}

// ---- Per-function collection ------------------------------------------------------------

/**
 * `sizeof` the pointee, for `dereferenceable`; 0 where there is nothing fixed
 * to claim. A `Result` layout is derived from the type, not declared (WP16),
 * so it is computed rather than looked up.
 */
const structSize = (program: CheckedProgram, table: TypeTable, type: i32): i32 => {
  if (type < 0) {
    return 0
  }
  if (table.isResult(type)) {
    return resultLayout(table, type).size
  }
  if (!table.isStruct(type)) {
    return 0
  }
  const info = program.struct(table.nameOf(type))
  return info === null ? 0 : info.size
}

/**
 * The alignment a pointer of this type is *guaranteed* to have, which is 8 for
 * everything the allocator hands out and less for exactly one shape.
 *
 * WP15 section 2a: an array of records is contiguous storage, so `ps[i]` is an
 * interior pointer at `i * sizeof(P)` into an 8-aligned block. When `sizeof(P)`
 * is not a multiple of 8 — `interface Q { a: i32; b: i32 }` is eight bytes
 * aligned to four — element 1 is 4-aligned and `align 8` would be a lie. The
 * record's own alignment is the true bound: the block is 8-aligned and the
 * stride is a multiple of `align`, so every slot is `align`-aligned and no more
 * can be promised. Every other pointer keeps `align 8`, because it comes from
 * `nish_alloc_struct` (which rounds to 8) or an entry-block alloca the emitter
 * gives `align 8`.
 */
const pointerAlign = (program: CheckedProgram, table: TypeTable, type: i32): i32 => {
  if (type < 0) {
    return 8
  }
  const record = inlineElementStruct(program, table, table.stripNull(type))
  if (record === null || record.align >= 8) {
    return 8
  }
  return record.align
}

/** Struct, array and `Result` params, plain or `T | null`, get pointer facts. */
/**
 * Struct, array and `Result` params get pointer facts — except a `Result` the
 * ABI packs into a register (WP17), which is not a pointer at all, so there is
 * nothing for the fixpoint to say about it.
 */
const isPointerParam = (table: TypeTable, type: i32): boolean => {
  // An **allow-list**, and WP27 S2 is why that matters rather than being a
  // stylistic preference. Every fact this predicate opens the door to —
  // `dereferenceable`, `nonnull`, `align`, `nocapture`, `readonly` — is a claim
  // about memory *this compiler laid out*: it knows the struct's size because
  // it chose it, and the alignment because it emitted it. A `CPtr` is an
  // address a C function owns, of unknown size, alignment and lifetime, and not
  // one of those attributes could be justified for it. Because the answer below
  // names what is allowed rather than what is not, `T_CPTR` falls out of it by
  // construction; if it named exclusions instead, the next pointer-shaped type
  // would be admitted by a case nobody remembered to write, and a wrong
  // attribute is undefined behaviour rather than a missed optimisation.
  const inner = table.stripNull(type)
  if (table.isResult(inner)) {
    return !table.resultByValue(inner)
  }
  return table.isStruct(inner) || table.isArray(inner)
}

class FactCollector {
  unit: AnalysisUnit
  table: TypeTable
  opts: Options
  sig: FunctionSig
  facts: FunctionFacts
  /** Round 1's fixpoint, or `null` in round 1 itself; see `bodyMayExtend`. */
  known: FactsTable | null
  /**
   * The body's declarations by local name (`gatherDeclarations`), gathered
   * the first time `declarationOf` is asked, so that a body of many
   * references walks itself once rather than once per reference.
   */
  declNames: StringMap
  declBuckets: Node[][]
  /** The next `PanicSite.order`: how many sites the walk has put in evaluation order. */
  siteOrder: i32
  declsGathered: boolean

  constructor(
    unit: AnalysisUnit,
    table: TypeTable,
    opts: Options,
    sig: FunctionSig,
    facts: FunctionFacts,
    known: FactsTable | null
  ) {
    this.unit = unit
    this.table = table
    this.opts = opts
    this.sig = sig
    this.facts = facts
    this.known = known
    this.siteOrder = 0
    this.declNames = new StringMap()
    this.declBuckets = []
    this.declsGathered = false
  }

  /**
   * The declaration in `body`, this function's body, that binds `local`, or
   * null: the first one a walk of the body meets.
   */
  declarationOf(body: Node, local: Local): Node | null {
    if (!this.declsGathered) {
      gatherDeclarations(this.unit.program, body, this.declNames, this.declBuckets)
      this.declsGathered = true
    }
    const at = this.declNames.get(local.name, -1)
    if (at < 0) {
      return null
    }
    for (const decl of this.declBuckets[at]) {
      const declared = this.unit.program.nodeLocals[decl.id]
      if (declared !== null && declared === local) {
        return decl
      }
    }
    return null
  }

  /** A reference to one of this function's parameters (`this` and `super` included), by name. */
  paramRef(node: Node): string {
    if (node.kind !== NodeKind.Ident && node.kind !== NodeKind.This) {
      return ""
    }
    const local = this.unit.program.nodeLocals[node.id]
    if (local === null || local.storage !== STORAGE_PARAM) {
      return ""
    }
    for (const name of this.facts.paramNames) {
      if (name === local.name) {
        return name
      }
    }
    return ""
  }

  /** A panic site of this body (`src/panics.ts`), when the build reads them. */
  noteSite(node: Node, kind: i32, proven: boolean, callee: string): void {
    if (this.opts.recordsPanics()) {
      this.facts.panicSites.push(
        new PanicSite(node, this.unit.program.source, kind, this.sig.name, proven, callee)
      )
    }
  }

  /**
   * Put the sites `node` itself recorded, `panicSites[from]` up to `to`, next
   * in evaluation order (`PanicSite.order`). The walk calls it once the
   * node's operands are visited, because a check is made on their values and
   * a call once its arguments are evaluated, so an operand's sites come first;
   * a `for...of`'s walk calls are made before its body, and it calls it then.
   */
  orderSites(from: i32, to: i32): void {
    let k = from
    while (k < to) {
      this.facts.panicSites[k].order = this.siteOrder
      this.siteOrder = this.siteOrder + 1
      k = k + 1
    }
  }

  /**
   * A call into `callee`, a candidate `call` site the resolution keeps when
   * the callee may panic; a `parallelMapInto` instance's is the length check
   * its body makes before it divides the work.
   */
  noteCall(node: Node, callee: FunctionSig): void {
    this.noteSite(
      node,
      parallelRoleOf(callee) === PAR_MAP ? PANIC_PARALLEL_LENGTH : PANIC_CALL,
      false,
      callee.name
    )
  }

  /**
   * What an arrow argument captures from this function (WP29) is handed, at
   * the call, to a parameter of the instance it is given to. That instance
   * and every one it forwards the value through only pass it on, so the one
   * function that can do anything with it is the arrow, at its own parameter
   * for the capture (`captureTarget`). Each capture is therefore read as an
   * argument to the arrow at that index, by the same two routes `f(x)` takes:
   * a parameter inherits the arrow parameter's facts through the fixpoint
   * (`passedToCallees`), and its writes, pollution and an object of this
   * call's own compose with the arrow's facts (`ArgEdge`). With no target (a
   * parallel form, a task or an async instance on the way) the capture is an
   * escape of what it names: a parameter loses `readonly` and `nocapture`,
   * and an object of this call's own is dirt below it.
   */
  noteCaptures(arrow: Node, lifted: FunctionSig): void {
    const callee = arrowCallee(this.unit.program, this.unit.parents, arrow)
    let k = 0
    while (k < lifted.captures.length) {
      const target: CaptureTarget | null = callee === null ? null : captureTarget(callee, lifted, k)
      this.noteCaptured(lifted.captures[k], target, callee === null ? "" : callee.name)
      k = k + 1
    }
  }

  noteCaptured(source: Local, target: CaptureTarget | null, via: string): void {
    if (source.storage === STORAGE_PARAM) {
      const pointer = this.facts.pointerParam(source.name)
      if (target === null || pointer === null) {
        // A string is an escape handed to any user function, as `noteUse` has it.
        this.escapeParam(source.name)
        return
      }
      pointer.passedToCallees.push(target.sig.name)
      pointer.passedToIndices.push(target.index)
      const edge = new ArgEdge(
        target.sig.name,
        target.index,
        pointer.name,
        null,
        new MemPath(ROOT_PARAM, pointer.name, "")
      )
      edge.via = via
      this.facts.argEdges.push(edge)
      return
    }
    const path = this.localPathAt(source, 0)
    if (path.kind === ROOT_OWN) {
      if (target === null) {
        this.facts.dirt.push(new DirtMark(DIRT_ESCAPE, path.name, path.steps, true))
      } else {
        const edge = this.ownEdge(new ArgEdge(target.sig.name, target.index, "", null, path))
        edge.via = via
        this.facts.argEdges.push(edge)
      }
    } else if (path.kind === ROOT_PARAM) {
      // An alias of a parameter, or of memory one reaches, keeps the escape.
      this.escapeParam(path.name)
    }
  }

  escapeParam(name: string): void {
    this.facts.escaping.add(name)
    this.facts.keptOutright.add(name)
    const pointer = this.facts.pointerParam(name)
    if (pointer !== null) {
      pointer.captured = true
      pointer.outlives = true
      pointer.writesThrough = true // an alias may be written through later
      pointer.writesShared = true
    }
  }

  noteUse(name: string, ref: Node): void {
    const found = classifyUse(this.unit, this.table, ref)
    const pointer = this.facts.pointerParam(name)
    if (found.kind === USE_ESCAPE) {
      if (this.pushedOntoJoinedParts(ref)) {
        return
      }
      this.escapeParam(name)
      return
    }
    if (found.kind === USE_ARGUMENT) {
      // Strings escape conservatively when handed to any user function;
      // structs and arrays are resolved by the fixpoint against the callee.
      const callee = found.callee
      if (pointer !== null && callee !== null) {
        pointer.passedToCallees.push(callee.name)
        pointer.passedToIndices.push(found.index)
      } else if (this.facts.escaping.add(name) && callee !== null) {
        this.facts.passedOn.push(name)
        this.facts.passedOn.push(callee.sourceName)
      } else if (callee === null) {
        this.facts.keptOutright.add(name)
      }
      return
    }
    if (found.kind === USE_WRITE && pointer !== null) {
      pointer.writesThrough = true
      if (!this.handsStringElement(ref)) {
        pointer.writesShared = true
      }
    }
  }

  /**
   * `ref` is indexed for a `string` handed straight to a call: `f(p[i])`
   * (`PointerParamFacts.writesShared`).
   */
  handsStringElement(ref: Node): boolean {
    const access = this.unit.parents.parentOf(ref)
    if (access === null || access.kind !== NodeKind.Index || access.children[0] !== ref) {
      return false
    }
    const list = this.unit.parents.parentOf(access)
    const type = this.unit.program.nodeTypes[access.id]
    return list !== null && list.kind === NodeKind.List && type === T_STRING
  }

  /**
   * `ref`, a string parameter, is pushed onto a `parts` of this function that
   * is only pushed onto, joined and measured (`isJoinedParts`). The parameter
   * is read by the `join` before the call returns and is unreachable once it
   * has, so it is not kept: a loop that builds the argument in the same pass
   * keeps its per-pass release (#503).
   */
  pushedOntoJoinedParts(ref: Node): boolean {
    const parts = pushedOnto(this.unit, this.table, ref)
    // The storage and type are answered without the two walks of the body.
    if (
      parts === null ||
      parts.storage !== STORAGE_LOCAL ||
      !this.table.isArray(parts.type) ||
      this.table.refOf(parts.type) !== T_STRING
    ) {
      return false
    }
    const body = this.sig.body()
    if (body === null) {
      return false
    }
    const refs: Node[] = []
    collectRefs(this.unit.program, body, parts, refs)
    return isJoinedParts(this.unit, this.table, parts, this.declarationOf(body, parts), refs)
  }

  /** `expr` denotes a stack object: a stack allocation itself, or a local that only holds one. */
  isStackOwned(expr: Node): boolean {
    const e = unwrapParens(expr)
    if (this.facts.isStackSite(e)) {
      return true
    }
    if (e.kind !== NodeKind.Ident) {
      return false
    }
    const local = this.unit.program.nodeLocals[e.id]
    return local !== null && this.facts.holdsStackObject(local)
  }

  /** WP29 P1: `node` writes memory a caller could observe. The first one in the walk is the one named. */
  noteSharedWrite(node: Node): void {
    if (!this.facts.sharedWrite) {
      this.facts.sharedWrite = true
      this.facts.writeSite = node
    }
  }

  /**
   * `this.f = v` in a constructor: `this` is the fresh object the `new` that
   * called it allocated, so the store initialises an allocation rather than
   * writing anything a caller already holds. Only `this` itself qualifies; a
   * store through `this.inner` may reach an object that came from outside.
   */
  initialisesThis(receiver: Node): boolean {
    return this.facts.freshThis && unwrapParens(receiver).kind === NodeKind.This
  }

  /** A store into `receiver`'s array: shared unless the array is this function's own stack object or private array. */
  noteArrayWrite(node: Node, receiver: Node | null): void {
    if (receiver === null) {
      this.notePastWrite(node)
    } else if (!this.isStackOwned(receiver)) {
      this.noteSlotWrite(node, receiver)
    }
  }

  /** `node` writes shared memory that is not a parameter's own slots, so no argument a caller picks can make it private. */
  notePastWrite(node: Node): void {
    this.noteSharedWrite(node)
    this.facts.writesPastParams = true
    this.facts.writesElsewhere = true
  }

  /**
   * `node` stores into the own slots of `receiver` (an element, a field, or
   * the header a `push` moves): nothing when it is a private array of this
   * function (`FunctionFacts.privateArrays`), a write through the parameter
   * when it is one of this function's pointer parameters as it is, a write
   * below it when it is under one, one the fixpoint settles when it is an
   * object of this function's own (`ownSlotWrites`), and a shared write past
   * them otherwise.
   */
  noteSlotWrite(node: Node, receiver: Node): void {
    const e = unwrapParens(receiver)
    const owned = this.privateArrayOf(e)
    if (owned !== null) {
      if (owned.site === null) {
        owned.site = node
      }
      return
    }
    const path = this.pathOf(e)
    this.facts.memWrites.push(path)
    const pointer = this.pointerParamOf(e)
    if (pointer === null && path.kind === ROOT_PARAM) {
      // Below a parameter: past its own slots, but nowhere its caller cannot
      // name (`writesElsewhere`).
      this.noteSharedWrite(node)
      this.facts.writesPastParams = true
      return
    }
    if (path.kind === ROOT_OWN) {
      this.facts.ownSlotWrites.push(path)
      this.facts.ownSlotSites.push(node)
      return
    }
    if (pointer === null) {
      this.notePastWrite(node)
      return
    }
    pointer.writesThrough = true
    pointer.writesShared = true
    this.noteSharedWrite(node)
  }

  /** Where the memory `expr` names lives (`MemPath`). */
  pathOf(expr: Node): MemPath {
    return this.pathFrom(expr, 0)
  }

  pathFrom(e: Node, depth: i32): MemPath {
    if (e.kind === NodeKind.Paren) {
      return this.pathFrom(e.children[0], depth)
    }
    if (e.kind === NodeKind.Member) {
      const base = this.pathFrom(e.children[0], depth)
      return new MemPath(base.kind, base.name, `${base.steps}.${e.text}`)
    }
    if (e.kind === NodeKind.Index) {
      const base = this.pathFrom(e.children[0], depth)
      return new MemPath(base.kind, base.name, `${base.steps}[]`)
    }
    if (e.kind === NodeKind.This) {
      if (this.facts.freshThis) {
        return new MemPath(ROOT_OWN, "this", "")
      }
      return this.pointerParamOf(e) === null
        ? new MemPath(ROOT_NONE, "", "")
        : new MemPath(ROOT_PARAM, "this", "")
    }
    if (e.kind === NodeKind.Call) {
      const read = this.readBackPath(e, depth)
      return read === null ? this.returnedPath(e, depth) : read
    }
    if (e.kind !== NodeKind.Ident) {
      return new MemPath(ROOT_UNKNOWN, "", "")
    }
    const pointer = this.pointerParamOf(e)
    if (pointer !== null) {
      return new MemPath(ROOT_PARAM, pointer.name, "")
    }
    const local: Local | null = this.unit.program.nodeLocals[e.id]
    if (local === null) {
      return new MemPath(ROOT_UNKNOWN, "", "")
    }
    if (local.storage === STORAGE_PARAM) {
      return new MemPath(ROOT_NONE, "", "") // a number, a `boolean` or a string
    }
    return this.localPathAt(local, depth)
  }

  /** What the `const` or `let` `local` resolves to (`resolveLocal`), cached. */
  localPathAt(local: Local, depth: i32): MemPath {
    for (const seen of this.facts.localPaths) {
      if (seen.local === local) {
        return seen.path
      }
    }
    const path = this.resolveLocal(local, depth)
    this.facts.localPaths.push(new LocalPath(local, path))
    return path
  }

  /**
   * A `const` bound to a fresh object or array, or to a fresh `Secret` the
   * body wipes, is an object of this call's own (`ownKeyOf`); a `const` bound
   * to anything else is what it is bound to; a `let`, a loop variable or a
   * name with no initialiser may be anything.
   */
  resolveLocal(local: Local, depth: i32): MemPath {
    const key = this.ownKeyOf(local)
    if (key.length > 0) {
      return new MemPath(ROOT_OWN, key, "")
    }
    const body = this.sig.body()
    const decl: Node | null =
      local.mutable || body === null || depth >= 8 ? null : this.declarationOf(body, local)
    if (decl === null) {
      return new MemPath(ROOT_UNKNOWN, "", "")
    }
    // A `for...of` head is a `const` statement of one declaration.
    let loop = this.unit.parents.parentOf(decl)
    while (loop !== null && (loop.kind === NodeKind.List || loop.kind === NodeKind.Var)) {
      loop = this.unit.parents.parentOf(loop)
    }
    if (loop !== null && loop.kind === NodeKind.ForOf) {
      return this.elementPath(loop.children[1], depth + 1)
    }
    if (decl.children[2].kind === NodeKind.Empty) {
      return new MemPath(ROOT_UNKNOWN, "", "")
    }
    return this.pathFrom(decl.children[2], depth + 1)
  }

  /**
   * Where each element a walk of `iterable` gives lives: an element of the
   * array, of the `Set`, or of the `Map` whose `keys()` or `values()` it is,
   * `[]` below that container's path. Anything else a `for...of` walks — a
   * `Channel`, whose messages are another task's — may be anything.
   */
  elementPath(iterable: Node, depth: i32): MemPath {
    const program = this.unit.program
    const e = unwrapParens(iterable)
    const table = walkTable(e)
    const type = program.nodeTypes[table.id]
    if (type < 0 || !(this.table.isArray(type) || this.isCollectionType(type))) {
      return new MemPath(ROOT_UNKNOWN, "", "")
    }
    const base = this.pathFrom(table, depth)
    return new MemPath(base.kind, base.name, `${base.steps}[]`)
  }

  /** Whether `type` is an instance of the global `Map` or `Set`. */
  isCollectionType(type: i32): boolean {
    const info: StructInfo | null = this.table.isStruct(type)
      ? this.unit.program.struct(this.table.nameOf(type))
      : null
    return info !== null && isCollectionStruct(info)
  }

  /**
   * Where what a `Map` or `Set` call answers lives: the table itself for a
   * call that answers it (`set`, `add`), an element, `[]` below the table,
   * for one that reads one back (`get`, `getOrInsert` from `nish/map`), and
   * null for a call that is not one of a table's.
   */
  readBackPath(call: Node, depth: i32): MemPath | null {
    const program = this.unit.program
    const callee = program.nodeCallees[call.id]
    const receiver = tableReceiver(program, call)
    if (callee === null || receiver === null) {
      return null
    }
    const owner = callee.owner
    if (!isMapRoute(callee) && (owner === null || !isCollectionStruct(owner))) {
      return null
    }
    const base = this.pathFrom(receiver, depth)
    if (program.nodeTypes[call.id] === program.nodeTypes[receiver.id]) {
      return base
    }
    return new MemPath(base.kind, base.name, `${base.steps}[]`)
  }

  /**
   * Where what a call to a function of `returnedParameter`'s shape answers
   * lives: where the argument it hands back does. Any other call's answer
   * may be anything.
   */
  returnedPath(call: Node, depth: i32): MemPath {
    const callee = this.unit.program.nodeCallees[call.id]
    const at = callee === null || depth >= 8 ? -1 : returnedParameter(callee)
    const args = call.children[1].children
    if (at < 0 || at >= args.length) {
      return new MemPath(ROOT_UNKNOWN, "", "")
    }
    return this.pathFrom(args[at], depth + 1)
  }

  /**
   * The key of the object `local` names when it is a `const` bound to a fresh
   * allocation (`new`, an array or an object literal) or to a fresh `Secret`
   * the body wipes (`isWipedFreshSecret`), registering it and what its
   * initialiser stores (`DIRT_INIT`, `DIRT_STORE`); "" otherwise.
   */
  ownKeyOf(local: Local): string {
    const at = this.facts.ownLocals.indexOf(local)
    if (at >= 0) {
      return `o${at}`
    }
    const body = this.sig.body()
    const decl: Node | null = local.mutable || body === null ? null : this.declarationOf(body, local)
    const init: Node | null = decl === null ? null : unwrapParens(decl.children[2])
    if (init === null) {
      return ""
    }
    const fresh = init.kind === NodeKind.New || init.kind === NodeKind.Array || init.kind === NodeKind.Object
    if (!fresh && !this.isWipedFreshSecret(local, init)) {
      return ""
    }
    const key = `o${this.facts.ownLocals.length}`
    this.facts.ownLocals.push(local)
    if (fresh) {
      this.noteFreshInit(key, init)
    } else {
      // `new Secret(v)` stores `v` in `value`: one more object of this call's own.
      this.noteStore(key, ".value", init.children[1].children[0])
    }
    return key
  }

  /**
   * #873: whether `init`, the initialiser of the `const` `local`, is
   * `nish:secret`'s `secret(v)` of a fresh `v` (a `new`, an array literal or
   * an object literal written in the call) and the body wipes `local` itself.
   * `secret` answers `new Secret(v)`, so `ownKeyOf` makes the `Secret` an
   * object of this call's own and records `v` as stored in its `value`: what
   * `v` holds of anyone else's is a `DirtMark` like any field's. A `secret`
   * of a parameter, a field, a call's answer or a moved local, and a `Secret`
   * the body does not wipe, stay what `pathOf` makes of a call: anything
   * (`tests/link/thread_task_wipe_secret`, `tests/cases/reject_thread_wipe_secret_*`).
   */
  isWipedFreshSecret(local: Local, init: Node): boolean {
    const program = this.unit.program
    if (init.kind !== NodeKind.Call || secretRoleOf(program.nodeCallees[init.id]) !== SECRET_MAKE) {
      return false
    }
    const args = init.children[1].children
    if (args.length !== 1) {
      return false
    }
    const value = unwrapParens(args[0])
    if (value.kind !== NodeKind.New && value.kind !== NodeKind.Array && value.kind !== NodeKind.Object) {
      return false
    }
    const body = this.sig.body()
    if (body === null) {
      return false
    }
    const refs: Node[] = []
    collectRefs(program, body, local, refs)
    for (const ref of refs) {
      let at = ref
      let list = this.unit.parents.parentOf(at)
      while (list !== null && list.kind === NodeKind.Paren) {
        at = list
        list = this.unit.parents.parentOf(at)
      }
      if (list !== null && list.kind === NodeKind.List) {
        const call = this.unit.parents.parentOf(list)
        if (call !== null && call.kind === NodeKind.Call && call.children[1] === list) {
          if (secretRoleOf(program.nodeCallees[call.id]) === SECRET_WIPE) {
            return true
          }
        }
      }
    }
    return false
  }

  /** What `init`, the fresh allocation an object of this call's own was made by, put in it. */
  noteFreshInit(key: string, init: Node): void {
    const program = this.unit.program
    const type = program.nodeTypes[init.id]
    if (init.kind === NodeKind.Array) {
      for (const element of init.children) {
        this.noteStore(key, "[]", element)
      }
      return
    }
    if (init.kind === NodeKind.Object) {
      // A NodeKind.Property keeps its key in `text` and its value, a name for the
      // shorthand `{ k }` included, in its one child.
      for (const property of init.children) {
        if (property.kind === NodeKind.Property && property.children.length > 0) {
          this.noteStore(key, `.${property.text}`, property.children[0])
        } else if (property.kind === NodeKind.Spread) {
          // `...s` stores each field it copies with what `s` reaches, the
          // root a written-out `f: s.f` would name.
          const copy = program.nodeSpreadCopies[property.id]
          if (copy !== null) {
            for (const name of copy.fields) {
              this.noteStore(key, `.${name}`, property.children[0])
            }
          } else {
            // Which fields it copies is unknown, so anything below the
            // object may be anything.
            const mark = new DirtMark(DIRT_STORE, key, "", true)
            const desc = this.valueOf(property.children[0])
            desc.unknown = true
            mark.value = desc
            this.facts.dirt.push(mark)
          }
        }
      }
      return
    }
    if (type < 0 || !this.table.isStruct(type)) {
      return // `new Array(n)`: nothing but zeros and nulls
    }
    const ctor = constructorOf(program, this.table, intrinsicType(program, init))
    const mark = new DirtMark(DIRT_INIT, key, "", true)
    mark.ctor = ctor === null ? "" : ctor.name
    for (const arg of init.children[2].children) {
      const value = this.valueOf(arg)
      mark.args.push(value)
      for (const name of value.params) {
        mark.params.push(name)
      }
    }
    this.facts.dirt.push(mark)
  }

  /**
   * `value` stored into the slot `slot` names: into an object of this call's
   * own a `DIRT_STORE`, anywhere a parameter or something unknown reaches a
   * `ParamStore`, unless the value is plainly clean.
   */
  noteSlotStore(slot: MemPath, value: Node): void {
    if (slot.kind === ROOT_OWN) {
      this.noteStore(slot.name, slot.steps, value)
      return
    }
    if (slot.kind === ROOT_NONE) {
      return
    }
    const desc = this.valueOf(value)
    if (desc.params.length > 0 || desc.owns.length > 0 || desc.ctors.length > 0 || desc.unknown) {
      this.facts.paramStores.push(new ParamStore(slot.kind === ROOT_PARAM ? slot.name : "", desc))
    }
  }

  /** `value` stored into the slot `steps` of the object `key`: a `DIRT_STORE` unless it is plainly clean. */
  noteStore(key: string, steps: string, value: Node): void {
    const desc = this.valueOf(value)
    if (desc.params.length === 0 && desc.owns.length === 0 && desc.ctors.length === 0 && !desc.unknown) {
      return
    }
    const mark = new DirtMark(DIRT_STORE, key, steps, false)
    mark.value = desc
    for (const name of desc.params) {
      mark.params.push(name)
    }
    this.facts.dirt.push(mark)
  }

  /**
   * Whether a value of `type` holds no memory: a number, a ranged integer, a
   * `boolean`, an enum or a string, or any of them through `| null` or the
   * `| undefined` a `get` answers. A type the checker did not record may hold
   * anything.
   */
  isPlainValue(type: i32): boolean {
    if (type < 0) {
      return true // no recorded type: not an expression a value can be read from
    }
    const table = this.table
    let t = table.stripNull(type)
    if (table.isMaybe(t)) {
      t = table.stripNull(table.refOf(t))
    }
    return t === T_STRING || table.isRanged(t) || isScalarArgument(table, t)
  }

  /** What `value` may be (`ValueDesc`). */
  valueOf(value: Node): ValueDesc {
    const desc = new ValueDesc()
    this.describe(value, desc)
    return desc
  }

  describe(value: Node, desc: ValueDesc): void {
    const program = this.unit.program
    const table = this.table
    const v = unwrapParens(value)
    const type = program.nodeTypes[v.id]
    if (type >= 0 && this.isPlainValue(type)) {
      return
    }
    if (v.kind === NodeKind.Null) {
      return
    }
    if (v.kind === NodeKind.New && type >= 0 && table.isArray(type)) {
      return
    }
    if (v.kind === NodeKind.New && type >= 0 && table.isStruct(type)) {
      const ctor = constructorOf(program, table, intrinsicType(program, v))
      if (ctor !== null) {
        desc.ctors.push(ctor.name)
      }
      for (const arg of v.children[2].children) {
        this.describe(arg, desc)
      }
      return
    }
    if (v.kind === NodeKind.Array) {
      for (const element of v.children) {
        this.describe(element, desc)
      }
      return
    }
    // Either arm of a `?:`, either side of a `??`: what one of them may be.
    if (v.kind === NodeKind.Conditional) {
      this.describe(v.children[1], desc)
      this.describe(v.children[2], desc)
      return
    }
    if (v.kind === NodeKind.Binary && v.text === "??") {
      this.describe(v.children[0], desc)
      this.describe(v.children[1], desc)
      return
    }
    if (v.kind === NodeKind.Object) {
      for (const property of v.children) {
        if (property.kind === NodeKind.Property && property.children.length > 0) {
          this.describe(property.children[0], desc)
        } else if (property.kind === NodeKind.Spread) {
          this.describe(property.children[0], desc) // its fields reach what the source reaches
        } else {
          desc.unknown = true
        }
      }
      return
    }
    const path = this.pathOf(v)
    if (path.kind === ROOT_PARAM) {
      desc.params.push(path.name)
    } else if (path.kind === ROOT_OWN) {
      desc.owns.push(path.name)
    } else if (path.kind === ROOT_UNKNOWN) {
      desc.unknown = true
    }
  }

  /**
   * A store `node` makes into an object of this call's own: an assignment to
   * a field or an element, or a `push` or `fill` onto an array one reaches.
   */
  noteOwnStore(node: Node): void {
    if (node.kind === NodeKind.Binary && isAssignmentOperator(node.text)) {
      const target = unwrapParens(node.children[0])
      if (target.kind === NodeKind.Member || target.kind === NodeKind.Index) {
        this.noteSlotStore(this.pathOf(target), node.children[1])
      }
      return
    }
    const method = arrayMethodName(this.unit.program, this.table, node)
    const receiver = methodReceiver(node)
    if ((method === "push" || method === "fill") && receiver !== null) {
      const array = this.pathOf(receiver)
      const slot = new MemPath(array.kind, array.name, `${array.steps}[]`)
      for (const arg of node.children[1].children) {
        this.noteSlotStore(slot, arg)
      }
    }
  }

  /**
   * The one rule for an object of this call's own (or a part of one) used as
   * a value: every expression with a path (`pathOf`) — a name, `this`, a
   * field or an element chain, a call that answers a table or reads one back
   * — of a type that is not a number, a `boolean` or a string, rooted at
   * such an object, makes everything below what it names may-be-anything
   * (`DIRT_ESCAPE`), unless where it stands is one the analysis follows: the
   * target of an assignment or of `++`/`--`, the initialiser of a `const`
   * (which `pathOf` follows), an argument of a user function or a `new`
   * (composed with the callee, `DIRT_CALL`), the callee of a call, an operand
   * of a comparison, a `return` (what the caller does with it is the
   * caller's), or a statement of its own. Every other place — the right side
   * of an assignment, an element of an array literal, a property of an object
   * literal, an argument of `push`, of a `Map` or `Set` call that keeps it
   * (`set`, `add`, `getOrInsert`) or of any builtin, an arm of a `?:` — hands
   * the object on to something the analysis does not follow. A lookup's key
   * (`has`, `get`, `delete`) is only read, and so is the iterable of a
   * `for...of`: what its loop variable names is judged where that is used.
   */
  noteEscape(node: Node): void {
    if (node.kind === NodeKind.Paren) {
      return // what it wraps is judged where the parentheses stand
    }
    const program = this.unit.program
    let at = node
    let parent = this.unit.parents.parentOf(at)
    while (parent !== null && parent.kind === NodeKind.Paren) {
      at = parent
      parent = this.unit.parents.parentOf(at)
    }
    if (
      parent !== null &&
      (parent.kind === NodeKind.Member || parent.kind === NodeKind.Index) &&
      parent.children[0] === at
    ) {
      return // part of a longer path, `(t).mid` included, which is judged where it ends
    }
    if (parent !== null && parent.kind === NodeKind.VarDecl && parent.children[0] === at) {
      return // the name a declaration binds
    }
    if (this.isPlainValue(program.nodeTypes[node.id])) {
      return
    }
    if (node.kind === NodeKind.This && !this.facts.freshThis) {
      return
    }
    if (node.kind === NodeKind.Ident) {
      const local: Local | null = program.nodeLocals[node.id]
      if (local === null || local.storage === STORAGE_PARAM) {
        return
      }
    }
    if (parent !== null && this.followsUse(parent, at)) {
      return
    }
    // Whatever the expression's form, its path decides: a name, a field or an
    // element chain, `this`, or a call that answers a table or what one holds.
    const path = this.pathOf(node)
    if (path.kind === ROOT_OWN) {
      this.facts.dirt.push(new DirtMark(DIRT_ESCAPE, path.name, path.steps, true))
    }
  }

  /** Whether `at`, a path expression under `parent`, stands where the analysis follows it (`noteEscape`). */
  followsUse(parent: Node, at: Node): boolean {
    const program = this.unit.program
    if (parent.kind === NodeKind.Binary) {
      if (isAssignmentOperator(parent.text)) {
        return parent.children[0] === at
      }
      return parent.text !== "??"
    }
    if (
      parent.kind === NodeKind.Unary ||
      parent.kind === NodeKind.Return ||
      parent.kind === NodeKind.ExprStmt
    ) {
      return true
    }
    if (parent.kind === NodeKind.Call) {
      return parent.children[0] === at
    }
    if (parent.kind === NodeKind.ForOf) {
      // The walk only reads it; what the loop variable names is judged where it is used.
      return parent.children[1] === at
    }
    if (parent.kind === NodeKind.VarDecl && parent.children[2] === at) {
      const bound: Local | null = program.nodeLocals[parent.id]
      return bound !== null && !bound.mutable
    }
    if (parent.kind === NodeKind.List) {
      const call = this.unit.parents.parentOf(parent)
      if (
        call === null ||
        (call.kind !== NodeKind.Call && call.kind !== NodeKind.New) ||
        program.nodeCallees[call.id] === null
      ) {
        return false
      }
      // A table call that keeps what it is handed stores it (`noteTableStores`), so only
      // its receiver is followed; a lookup keeps nothing, so its key is followed too.
      const callee = program.nodeCallees[call.id]
      const owner: StructInfo | null = callee === null ? null : callee.owner
      const collection = owner !== null && isCollectionStruct(owner)
      if (!collection && fusedCalleesOf(program, this.table, call) === null) {
        return true
      }
      const receiver = tableReceiver(program, call)
      return (receiver !== null && receiver === at) || !keepsArguments(program, call)
    }
    return false
  }

  /** The private array `e` names (`FunctionFacts.privateArrays`), or null. */
  privateArrayOf(e: Node): PrivateArray | null {
    const local: Local | null = e.kind === NodeKind.Ident ? this.unit.program.nodeLocals[e.id] : null
    if (local !== null) {
      for (const owned of this.facts.privateArrays) {
        if (owned.local === local) {
          return owned
        }
      }
    }
    return null
  }

  /** The pointer facts of the parameter `e` names as it is (`this` included), or null. */
  pointerParamOf(e: Node): PointerParamFacts | null {
    const param = this.paramRef(e)
    return param.length > 0 ? this.facts.pointerParam(param) : null
  }

  /**
   * Find this body's private arrays (`FunctionFacts.privateArrays`) before
   * the walk asks about any store into one. Every reference is classified as
   * a parameter's is (`classifyUse`), which already sees through a ternary,
   * a `??` and an inline element's address; anything it calls an escape —
   * stored, pushed, aliased, a task's argument — makes the array shared, but
   * a `return` of it does not (`isReturned`). An argument of a user function is kept for the fixpoint, which
   * asks whether that callee keeps it.
   */
  findPrivateArrays(node: Node): void {
    if (node.kind === NodeKind.Arrow) {
      return
    }
    if (node.kind === NodeKind.Var && (node.flags & FLAG_CONST) !== 0) {
      for (const decl of node.children[0].children) {
        const local = this.unit.program.nodeLocals[decl.id]
        if (local !== null) {
          this.notePrivateArray(local, decl)
        }
      }
    }
    for (const child of node.children) {
      this.findPrivateArrays(child)
    }
  }

  /**
   * Whether `ref` is what this function returns, directly or through a
   * parenthesis, a ternary arm or a `??`. A returned array is no caller's
   * while the call runs, so stores into it before the `return` write
   * nothing shared: a task or a map body may fill one and answer it
   * (copy-at-join). The caller holds the answer as a call result, memory it
   * does not know, so its own writes into it stay shared ones.
   */
  isReturned(ref: Node): boolean {
    let node = ref
    for (;;) {
      const parent = this.unit.parents.parentOf(node)
      if (parent === null) {
        return false
      }
      if (parent.kind === NodeKind.Return) {
        return true
      }
      const arm = parent.kind === NodeKind.Conditional && parent.children[0] !== node
      if (
        parent.kind !== NodeKind.Paren &&
        !arm &&
        !(parent.kind === NodeKind.Binary && parent.text === "??")
      ) {
        return false
      }
      node = parent
    }
  }

  notePrivateArray(local: Local, decl: Node): void {
    const program = this.unit.program
    const table = this.table
    if (
      !isFreshArrayLocal(table, local, decl) ||
      inlineElementStruct(program, table, table.refOf(local.type)) !== null
    ) {
      return
    }
    const body = this.sig.body()
    if (body === null || namedInArrow(program, body, local, false)) {
      return
    }
    const refs: Node[] = []
    collectRefs(program, body, local, refs)
    const handed: ParamUse[] = []
    const sites: Node[] = []
    for (const ref of refs) {
      const found = classifyUse(this.unit, table, ref)
      if (found.kind === USE_ESCAPE && this.isReturned(ref)) {
        continue
      }
      if (found.kind === USE_ESCAPE || (found.kind === USE_ARGUMENT && found.callee === null)) {
        return
      }
      if (found.kind === USE_ARGUMENT) {
        handed.push(found)
        sites.push(ref)
      }
    }
    const owned = new PrivateArray(local)
    this.facts.privateArrays.push(owned)
    const key = this.ownKeyOf(local)
    for (const found of handed) {
      const callee = found.callee
      if (callee !== null) {
        const path = key.length > 0 ? new MemPath(ROOT_OWN, key, "") : new MemPath(ROOT_UNKNOWN, "", "")
        const edge = this.ownEdge(new ArgEdge(callee.name, found.index, "", owned, path))
        this.facts.argEdges.push(edge)
      }
    }
    // A private array handed to a `new` that initialises an object of this
    // call's own is held by that object (`ArgEdge.heldBy`), as any argument is.
    for (const ref of sites) {
      const call = this.callAround(ref)
      if (call !== null && call.kind === NodeKind.New) {
        this.holdArray(key, this.heldByOf(call))
      }
    }
  }

  /** The call or `new` `ref` is an argument of, through parentheses and the arms of a `?:`, or null. */
  callAround(ref: Node): Node | null {
    let at: Node | null = this.unit.parents.parentOf(ref)
    while (at !== null && (at.kind === NodeKind.Paren || at.kind === NodeKind.Conditional)) {
      at = this.unit.parents.parentOf(at)
    }
    if (at === null || at.kind !== NodeKind.List) {
      return null
    }
    return this.unit.parents.parentOf(at)
  }

  /** Mark the private array `key`'s edges as held by the object `holder` (`ArgEdge.heldBy`). */
  holdArray(key: string, holder: string): void {
    if (key.length === 0 || holder.length === 0) {
      return
    }
    for (const edge of this.facts.argEdges) {
      if (edge.owner !== null && edge.path.kind === ROOT_OWN && edge.path.name === key) {
        edge.heldBy = holder
      }
    }
  }

  /**
   * The arguments of `call`, whose callee `callee` the fixpoint composes
   * rather than taking whole: a function or method call, or a `new`, whose
   * `this` is the fresh object it allocates and is not an argument any caller
   * holds (a constructor that hands `this` on stores it through another of
   * its parameters, which is a write through that one). A private array is
   * the walk's business (`findPrivateArrays`) and is left out.
   */
  noteArguments(call: Node, callee: FunctionSig): void {
    if (call.kind === NodeKind.New) {
      const first = this.facts.argEdges.length
      this.noteArgumentList(callee, call.children[2].children, 1)
      const holder = this.heldByOf(call)
      let i = first
      while (i < this.facts.argEdges.length) {
        this.facts.argEdges[i].heldBy = holder
        i = i + 1
      }
      return
    }
    const receiver = methodReceiver(call)
    const owner = callee.owner
    if (owner !== null && receiver !== null && isCollectionStruct(owner)) {
      // A `Map` or `Set` keeps only what it is handed (`noteTableStores`), and
      // writes only its own storage (`FunctionFacts.wholeReaches`).
      this.noteWholeReach(callee.name, receiver)
      this.noteTableStores(call, receiver)
    } else if (owner !== null && receiver !== null) {
      this.noteArgument(callee, receiver, 0)
    }
    this.noteArgumentList(callee, call.children[1].children, callee.owner !== null ? 1 : 0)
  }

  /** The key of the object of this call's own a `new` initialises, when it is a `const`'s initialiser (`ArgEdge.heldBy`), or "". */
  heldByOf(call: Node): string {
    let at = call
    let parent = this.unit.parents.parentOf(at)
    while (parent !== null && parent.kind === NodeKind.Paren) {
      at = parent
      parent = this.unit.parents.parentOf(at)
    }
    if (parent === null || parent.kind !== NodeKind.VarDecl || parent.children[2] !== at) {
      return ""
    }
    const local: Local | null = this.unit.program.nodeLocals[parent.id]
    return local === null ? "" : this.ownKeyOf(local)
  }

  noteArgumentList(callee: FunctionSig, args: Node[], offset: i32): void {
    let i = 0
    while (i < args.length) {
      this.noteArgument(callee, args[i], i + offset)
      i = i + 1
    }
  }

  noteArgument(callee: FunctionSig, arg: Node, index: i32): void {
    const e = unwrapParens(arg)
    if (this.privateArrayOf(e) !== null) {
      return
    }
    const pointer = this.pointerParamOf(e)
    const name = pointer === null ? "" : pointer.name
    // A number, a `boolean`, an enum or a string names no memory a store can
    // reach, and a function given for a compile-time function parameter is no
    // value at run time (WP29): a callee can neither write below it nor store
    // into it, so it pollutes none of the caller's.
    const type = this.unit.program.nodeTypes[e.id]
    const path =
      callee.isCompileTime(index) || type === T_STRING || (type >= 0 && isScalarArgument(this.table, type))
        ? new MemPath(ROOT_NONE, "", "")
        : this.pathOf(e)
    this.facts.argEdges.push(this.ownEdge(new ArgEdge(callee.name, index, name, null, path)))
  }

  visit(node: Node): void {
    const program = this.unit.program
    // WP29: an arrow argument is lifted into a function of its own, which has
    // facts of its own; its body is not this function's, and neither it nor a
    // function named as an argument is a value this function holds. What an
    // arrow given to an ordinary function parameter captures escapes; a
    // data-parallel form's or a task's captures stay read-only inside the call.
    if (node.kind === NodeKind.Arrow) {
      const lifted = program.nodeCallees[node.id]
      if (lifted !== null && lifted.capturesForCall) {
        this.noteCaptures(node, lifted)
      }
      return
    }
    if (
      node.kind === NodeKind.For ||
      node.kind === NodeKind.While ||
      node.kind === NodeKind.Do ||
      node.kind === NodeKind.ForOf
    ) {
      this.facts.hasLoops = true
      if (!isCountedLoop(this.unit, this.table, node, this.known)) {
        this.facts.loopsBounded = false
      }
    }
    if (node.kind === NodeKind.Throw) {
      this.facts.hasTrap = true
    }
    const ownSites = this.facts.panicSites.length
    // WP32 S5: a fused lookup, and a `nish/map` call, call the table's
    // pieces rather than what they were checked as (`fusedCalleesOf`).
    const fused: FunctionSig[] | null =
      node.kind === NodeKind.Call ? fusedCalleesOf(program, this.table, node) : null
    if (fused !== null) {
      const receiver = tableReceiver(program, node)
      for (const sig of fused) {
        this.addUserCallee(sig.name, node)
        this.noteCall(node, sig)
        this.noteWholeReach(sig.name, receiver)
      }
      this.noteTableStores(node, receiver)
    } else if (node.kind === NodeKind.Call) {
      const callee = program.nodeCallees[node.id]
      if (callee !== null) {
        this.addCallee(callee, node)
        this.noteCall(node, callee)
      }
      // WP32: `m.get(k)`, whose type is a maybe, is a `probe` and, when it
      // finds the key, that table's `valueAt` (`checkMapGet`).
      const reads: FunctionSig | null =
        callee !== null && this.table.isMaybe(program.nodeTypes[node.id]) ? valueReaderOf(callee) : null
      if (reads !== null) {
        this.addUserCallee(reads.name, node)
        this.noteCall(node, reads)
        this.noteWholeReach(reads.name, methodReceiver(node))
      }
    }
    // WP50 S5: a page module's float `%` calls `fmodF64` (`floatRemainderOf`).
    const rem = program.floatRemainderOf(node)
    if (rem !== null) {
      this.addUserCallee(rem.name, node)
    }
    // WP32: a walk of a `Map` or `Set` calls the table's four walk methods
    // (`emitWalk`); the loop records the reader, and the rest are its owner's.
    if (node.kind === NodeKind.ForOf) {
      const read = program.nodeCallees[node.id]
      if (read !== null && isChannelReader(read)) {
        // WP29 P3: a loop over a `Channel` is the emitter's, a receive per pass
        // (`emitChannelWalk`); the reader it records is Node's and is never called.
        this.facts.effect = EFFECT_WRITE
        this.facts.readsMemory = true
        this.facts.callees.add("nish_channel_receive")
      } else if (read !== null) {
        for (const sig of walkMethodsOf(read)) {
          this.addUserCallee(sig.name, node)
          this.noteCall(node, sig)
          this.noteWholeReach(sig.name, walkTable(node.children[1]))
        }
      }
    }
    const param = this.paramRef(node)
    if (param.length > 0) {
      this.noteUse(param, node)
    }
    this.collectStringFacts(node)
    this.noteOwnStore(node)
    this.noteEscape(node)
    this.collectClassFacts(node)
    this.collectResultFacts(node)
    this.collectArrayFacts(node)
    this.collectDivisionFacts(node)
    this.collectOverflowFacts(node)
    this.collectRangeFacts(node)
    this.collectNamespacePropertyFacts(node)
    this.collectIdentifierBuiltinFacts(node)
    const ownEnd = this.facts.panicSites.length
    if (node.kind === NodeKind.ForOf) {
      this.orderSites(ownSites, ownEnd)
    }
    for (const child of node.children) {
      this.visit(child)
    }
    if (node.kind !== NodeKind.ForOf) {
      this.orderSites(ownSites, ownEnd)
    }
  }

  /**
   * A call to a user function: a callee for the attribute fixpoint and, in
   * round 2, an edge a capability can arrive along (WP35). One helper for
   * both, so that no kind of call can reach the first and miss the second.
   */
  addUserCallee(callee: string, site: Node): void {
    this.facts.wholeCallees.add(callee)
    this.addComposedCallee(callee, site)
  }

  /** The receiver of a call to `callee`, taken whole: what it may write is anything `receiver` reaches (`FunctionFacts.wholeReaches`). */
  noteWholeReach(callee: string, receiver: Node | null): void {
    const path = receiver === null ? new MemPath(ROOT_UNKNOWN, "", "") : this.pathOf(receiver)
    this.facts.wholeReaches.push(new ArgEdge(callee, -1, "", null, path))
  }

  /**
   * A `Map` or `Set` call fused into its table's pieces keeps exactly the
   * values it is handed, the key and the value of a `set` or the element of
   * an `add`: each is a store into the table its receiver names, judged as a
   * `push` is (`noteSlotStore`).
   */
  noteTableStores(call: Node, receiver: Node | null): void {
    if (!keepsArguments(this.unit.program, call)) {
      return // a lookup: `has`, `get`, `delete` keep nothing they are handed
    }
    const table = receiver === null ? new MemPath(ROOT_UNKNOWN, "", "") : this.pathOf(receiver)
    const slot = new MemPath(table.kind, table.name, `${table.steps}[]`)
    for (const arg of call.children[1].children) {
      if (receiver === null || arg !== receiver) {
        this.noteSlotStore(slot, arg)
      }
    }
  }

  /** `edge`, with the `DIRT_CALL` mark an argument of this call's own gets, which the fixpoint sets when the callee writes it. */
  ownEdge(edge: ArgEdge): ArgEdge {
    if (edge.path.kind === ROOT_OWN) {
      const mark = new DirtMark(DIRT_CALL, edge.path.name, edge.path.steps, true)
      this.facts.dirt.push(mark)
      edge.dirt = mark
    }
    return edge
  }

  /** `addUserCallee` for a call whose arguments are recorded (`noteArguments`), so the callee's writes through them are composed with what each argument is. */
  addComposedCallee(callee: string, site: Node): void {
    this.facts.callees.add(callee)
    if (this.known !== null) {
      this.facts.capCallees.push(callee)
      this.facts.capSites.push(site)
    }
  }

  /**
   * WP53 H1.2: a `new` of a handle class is a `using`'s initialiser, and every
   * exit of its block calls the close the class's dispose names, which is C's:
   * `ffi` is exercised there, named at the `using`, as a call written there
   * would be (`addCallee`).
   */
  noteHandleClose(node: Node): void {
    const info = openedHandle(this.unit.program, this.table, node)
    if (info === null) {
      return
    }
    const close = info.handleClose
    if (close === null) {
      return
    }
    this.facts.callees.add(close.name)
    this.facts.wholeCallees.add(close.name)
    if (this.known !== null) {
      this.facts.offerCapability(CAP_FFI, close.sourceName, node, 0)
    }
  }

  /**
   * A call whose callee has a signature. A `declare function`'s body is C, so
   * the call is where `ffi` is exercised and the chain ends there, named by the
   * declaration as written (WP35); any other callee is a user one.
   */
  addCallee(callee: FunctionSig, call: Node): void {
    if (!callee.foreign()) {
      this.addComposedCallee(callee.name, call)
      this.noteArguments(call, callee)
      return
    }
    this.facts.callees.add(callee.name)
    this.facts.wholeCallees.add(callee.name)
    if (this.known !== null) {
      this.facts.offerCapability(CAP_FFI, callee.sourceName, call, 0)
    }
    // WP27 S3.1: a string that may hold a NUL is searched for one before C
    // reads it, and a hit panics (`emitForeignString`). A host function reads
    // the string as `(p, n)`, so it has no such check (WP50 S4).
    const args = call.children[1].children
    const host = hostFunction(callee)
    let i = 0
    while (i < args.length && i < callee.paramTypes.length) {
      const arg = args[i]
      if (!host && this.table.stripNull(callee.paramTypes[i]) === T_STRING && !foreignStringIsNulFree(arg)) {
        const checks: string[] = []
        foreignStringCallees(checks)
        this.addCallees(checks)
        this.noteSite(arg, PANIC_FFI_NUL, false, "")
      }
      i = i + 1
    }
    // WP27 S5: errno is zeroed through `nish_errno_ptr` around the call.
    if (!host && this.unit.program.capturesErrno) {
      this.addCallees(["nish_errno_ptr"])
    }
    // WP53 B1.2: C writes into a `u8[]` it is handed, which is a store into
    // the array's own slots here, and a count that may be larger than a
    // buffer's length is held against it before the call
    // (`emitForeignBuffers`).
    // WP50 S3: a host function's window is the same loan, its `at + n` held
    // against the length the same way (`hostWindowProven`).
    let b = 0
    while (b < args.length && b < callee.paramTypes.length) {
      const buffer = args[b]
      // WP27 S4.1: C fills a `declare class` it is lent, and `o.inner` is
      // `o`'s own memory, so the write is to the argument and to every
      // object that embeds it.
      if (
        !host &&
        layoutClass(this.unit.program, this.table, this.table.stripNull(callee.paramTypes[b])) !== null
      ) {
        let held = unwrapParens(buffer)
        this.noteSlotWrite(call, held)
        while (held.kind === NodeKind.Member) {
          held = unwrapParens(held.children[0])
          this.noteSlotWrite(call, held)
        }
      }
      if (lentBuffer(this.table, callee, b)) {
        if (!this.table.isReadonlyArray(callee.paramTypes[b])) {
          this.noteSlotWrite(call, buffer)
        }
        const proven = hostFunction(callee)
          ? hostWindowProven(this.unit.program, this.table, call, b, this.known)
          : foreignBufferCountProven(
              this.unit.program,
              this.table,
              call,
              b,
              foreignBufferCount(this.table, callee, b),
              this.known,
              "toU64"
            )
        if (!proven) {
          const tail: string[] = []
          panicTailCallees(tail)
          this.addCallees(tail)
        }
        this.noteSite(buffer, PANIC_FFI_LENGTH, proven, "")
      }
      b = b + 1
    }
    // WP27 S3.2: a `string` result is copied out of C, and a `NULL` one that
    // is not declared `string | null` panics (`emitForeignStringResult`).
    if (this.table.stripNull(callee.returnType) === T_STRING) {
      const nullable = this.table.isNullable(callee.returnType)
      const copy: string[] = []
      foreignResultCallees(copy, nullable)
      this.addCallees(copy)
      if (!nullable) {
        this.noteSite(call, PANIC_FFI_NULL, false, "")
      }
    }
  }

  /**
   * WP35: a builtin call, by the name the checker knows it by, seeds its one
   * label (`builtinCapability`); round 2 only, which its callers check. A
   * builtin with no row is a broken invariant rather than a program error --
   * the table is meant to be total, and `tests/capabilities.js` holds it to
   * that -- so it ends the compile with the exit-70 report. `Options.unlabelledBuiltin` is the suite's way of
   * provoking that path (`NISH_SIMULATE_ICE=unlabelled:<name>`).
   */
  noteBuiltin(name: string, call: Node, resolved: boolean): void {
    const label = name === this.opts.unlabelledBuiltin ? CAP_UNLABELLED : builtinCapability(name)
    if (label === CAP_UNLABELLED) {
      // `resolved` says the checker recorded the call as a builtin. A plain
      // name with no row is one only if the checker accepts it as one; any
      // other call with no recorded callee is none this table speaks for.
      if (!resolved && !isBuiltinFunction(name) && !isResultConstructor(name)) {
        return
      }
      process.exit(unlabelledBuiltinError(name, this.opts.json))
    }
    if (label !== CAP_NONE) {
      this.facts.offerCapability(label, name, call, 0)
    }
  }

  addCallees(names: string[]): void {
    for (const name of names) {
      this.facts.callees.add(name)
      if (name === "nish_write" || name === "nish_exit") {
        this.facts.writesOutput = true
      }
    }
  }

  /**
   * `nish:secret`: whether the builtin call `node`, spelled `name`, which
   * lowers to `symbols`, reaches the world (`FunctionFacts.worldVia`). A
   * `panic` or an exit given a literal is the one call that ends the process
   * without saying anything computed, and it is let through.
   */
  noteWorld(node: Node, symbols: string[], name: string): void {
    if (this.facts.worldVia.length > 0) {
      return
    }
    const args = node.children[1].children
    const constant = args.length === 1 && (args[0].kind === NodeKind.String || isNumericLiteral(args[0]))
    if (constant && (name === "panic" || name === "process.exit")) {
      return
    }
    for (const symbol of symbols) {
      if (!isPureRuntime(symbol)) {
        this.facts.worldVia = `\`${name}\``
        return
      }
    }
  }

  /**
   * What a string construct does to memory: the runtime symbols it calls and
   * the header reads `.length` and the byte methods perform. Mirrors
   * `src/emit-strings.ts` exactly; an omission here is a wrong attribute.
   */
  collectStringFacts(node: Node): void {
    const program = this.unit.program
    const table = this.table
    if (
      node.kind === NodeKind.Call &&
      node.children[0].kind === NodeKind.Member &&
      !receiverIsValue(program, node.children[0].children[0])
    ) {
      const name = dottedName(node.children[0])
      const dotted = builtinCalleesNamed(program, table, this.opts, node, name)
      this.addCallees(dotted)
      this.noteWorld(node, dotted, name)
      if (this.known !== null) {
        this.noteBuiltin(name, node, true)
      }
      this.noteBuiltinSite(node, name)
      // WP34 N3: the entropy fill writes its argument's elements, which is
      // a write to a shared array unless the array is this function's own.
      this.noteWrittenArguments(node)
      return
    }
    if (node.kind === NodeKind.Binary && program.nodeTypes[node.children[0].id] === T_STRING) {
      const op = node.text
      if (op === "+") {
        this.facts.callees.add("nish_str_concat")
      } else if (op === "===" || op === "!==") {
        this.facts.callees.add("nish_str_eq")
      }
      return
    }
    if (node.kind === NodeKind.Call && isStringMethodCall(program, node)) {
      // The byte methods all read the string's bytes; `substring` and `slice`
      // also allocate, and `slice` and an unproven `charCodeAt` can reach a panic.
      this.facts.readsMemory = true
      const name = node.children[0].text
      this.addCallees(stringConstructCallees(name, program.nodeProvenIndex[node.id]))
      if (name === "charCodeAt") {
        this.noteSite(node, PANIC_INDEX, program.nodeProvenIndex[node.id], "")
      } else if (name === "slice") {
        this.noteSite(node, PANIC_SLICE, false, "")
      }
      return
    }
    if (node.kind === NodeKind.Member && program.nodeTypes[node.children[0].id] === T_STRING) {
      this.facts.readsMemory = true // `.length` loads the header through the string pointer
      return
    }
    if (isTemplateExpression(node)) {
      const parts = templateParts(node)
      if (parts.length > 1) {
        this.facts.callees.add("nish_str_concat")
      }
      for (const part of parts) {
        if (part.kind !== NodeKind.TemplateText) {
          const callee = stringifyCallee(program.nodeTypes[part.id])
          if (callee.length > 0) {
            this.facts.callees.add(callee)
          }
        }
      }
    }
  }

  /**
   * Class constructs: a field read is a read, a field store a write, and a
   * `new` or object literal an allocator call plus whatever the constructor
   * does. A stack object is the function's own alloca and is none of those.
   * A union's tag read is a load through the variant's pointer, and a `new`
   * checked into a union is still its class's allocation.
   */
  collectClassFacts(node: Node): void {
    const program = this.unit.program
    const table = this.table
    if (node.kind === NodeKind.Spread && (node.flags & FLAG_OBJECT_SPREAD) !== 0) {
      // `{ ...s }` loads each field it copies off `s`, the reads a written-out
      // `f: s.f` makes; with no record of what it copies, it reads anyway.
      const copy = program.nodeSpreadCopies[node.id]
      if ((copy === null || copy.fields.length > 0) && !this.isStackOwned(node.children[0])) {
        this.facts.readsMemory = true
      }
      return
    }
    if (node.kind === NodeKind.Member) {
      const receiver = node.children[0]
      const type = program.nodeTypes[receiver.id]
      if (type < 0) {
        return
      }
      if (table.isUnion(table.stripNull(type))) {
        this.facts.readsMemory = true
        return
      }
      if (!table.isStruct(type)) {
        return
      }
      const above = this.unit.parents.parentOf(node)
      if (above !== null && above.kind === NodeKind.Call && above.children[0] === node) {
        return // the call itself is reported through `nodeCallees`
      }
      if (this.isStackOwned(receiver)) {
        return // own alloca (WP6)
      }
      if (isAssignmentTarget(above, node) && above !== null) {
        this.facts.effect = EFFECT_WRITE
        // WP29 P3, R6: a store through a guard is made while its lock is held,
        // the one shared write a task may make.
        if (!this.initialisesThis(receiver) && !isGuardedAccess(program, table, node)) {
          this.noteSlotWrite(above, receiver)
        }
        if (above.text !== "=") {
          this.facts.readsMemory = true
        }
      } else {
        this.facts.readsMemory = true
      }
      return
    }
    if (node.kind === NodeKind.New) {
      const type = intrinsicType(program, node)
      if (type < 0 || !table.isStruct(type)) {
        return
      }
      if (!this.facts.isStackSite(node)) {
        this.facts.effect = EFFECT_WRITE
        this.facts.callees.add("nish_alloc_struct")
      }
      const ctor = constructorOf(program, table, intrinsicType(program, node))
      if (ctor !== null) {
        this.addComposedCallee(ctor.name, node)
        this.noteArguments(node, ctor)
        this.noteCall(node, ctor)
      }
      this.noteHandleClose(node)
      return
    }
    if (node.kind === NodeKind.Object && !this.facts.isStackSite(node)) {
      this.facts.effect = EFFECT_WRITE
      this.facts.callees.add("nish_alloc_struct")
    }
  }

  /**
   * `Result` constructs (WP16), mirroring `src/emit-result.ts`:
   *   a call answering a packed `Result`   the caller's own object (WP17)
   *   Ok / Err                write, calls the allocator unless it is a stack site
   *   r.ok / .value / .error  read
   *   orReturn                read plus the allocation of the propagated Result
   *   unwrapOr / expect       read; `expect` also calls the two runtime symbols
   */
  collectResultFacts(node: Node): void {
    const program = this.unit.program
    const table = this.table
    if (node.kind === NodeKind.Call) {
      // WP17: a call that answers a `Result` in a register hands back no
      // memory, so the *caller* builds the object the rest of the lowering
      // reads. That is an allocation of this function — an own alloca when the
      // escape analysis says so, an arena bump otherwise — and the allocator
      // call has to be reported here, because the callee no longer makes it.
      const callee = program.nodeCallees[node.id]
      if (callee !== null) {
        if (table.resultByValue(callee.returnType)) {
          if (!this.facts.isStackSite(node)) {
            this.facts.callees.add("nish_alloc_struct")
          }
          this.facts.effect = EFFECT_WRITE
        }
        return
      }
      const method = resultMethodName(program, table, node)
      if (method.length > 0) {
        // Before the stack test below: the panic tail is emitted whoever owns
        // the `Result` (`emitExpect`).
        if (method === "expect") {
          this.noteSite(node, PANIC_EXPECT, false, "")
        }
        if (this.isStackOwned(node.children[0].children[0])) {
          return // own alloca (WP6)
        }
        this.facts.readsMemory = true
        if (method === "orReturn") {
          this.facts.effect = EFFECT_WRITE
          this.facts.callees.add("nish_alloc_struct")
        } else if (method === "expect") {
          const tail: string[] = []
          panicTailCallees(tail)
          this.addCallees(tail)
          const args = node.children[1].children
          if (this.facts.worldVia.length === 0 && (args.length === 0 || args[0].kind !== NodeKind.String)) {
            this.facts.worldVia = "`expect` with a computed message"
          }
        }
        return
      }
      // `Ok(...)` / `Err(...)`: a user function of that name is in `nodeCallees`
      // and is reported through the call graph instead.
      if (!isResultConstructorCall(program, table, node)) {
        return
      }
      if (!this.facts.isStackSite(node)) {
        this.facts.callees.add("nish_alloc_struct")
      }
      this.facts.effect = EFFECT_WRITE
      return
    }
    if (node.kind === NodeKind.Member) {
      const receiver = node.children[0]
      if (!table.isResult(program.nodeTypes[receiver.id])) {
        return
      }
      const above = this.unit.parents.parentOf(node)
      if (above !== null && above.kind === NodeKind.Call && above.children[0] === node) {
        return // the method call above
      }
      if (this.isStackOwned(receiver)) {
        return // own alloca (WP6)
      }
      this.facts.readsMemory = true
    }
  }

  /** Array constructs, mirroring `src/emit-arrays.ts`. */
  collectArrayFacts(node: Node): void {
    const program = this.unit.program
    const table = this.table
    if (node.kind === NodeKind.Index && this.isArrayValued(node.children[0])) {
      this.facts.readsMemory = true
      // Mirrors `emitBoundsCheck` exactly, proof and all: an access the checker
      // proved in range emits no call, so listing `nish_panic_index` here would
      // cost the function `willreturn` for a `noreturn` callee that is not in
      // its IR.
      if (!program.nodeProvenIndex[node.id]) {
        this.facts.callees.add("nish_panic_index")
      }
      this.noteSite(node, PANIC_INDEX, program.nodeProvenIndex[node.id], "")
      return
    }
    if (node.kind === NodeKind.Member && this.isArrayValued(node.children[0])) {
      this.facts.readsMemory = true // `.length`
      return
    }
    if (node.kind === NodeKind.ForOf) {
      this.facts.readsMemory = true
      return
    }
    if (node.kind === NodeKind.Array || (node.kind === NodeKind.New && this.isArrayValued(node))) {
      if (!this.facts.isStackSite(node)) {
        this.facts.effect = EFFECT_WRITE
      }
      // Mirrors `emitNewArray`: a length it checks can panic, which costs the
      // function `willreturn` exactly where the check is in its IR.
      if (node.kind === NodeKind.New) {
        const length = node.children[2].children[0]
        if (newArrayLengthChecked(length, program.nodeTypes[length.id], this.opts.numberMode, table)) {
          const tail: string[] = []
          panicTailCallees(tail)
          // A panic's tail, not output (`FunctionFacts.writesOutput`).
          for (const name of tail) {
            this.facts.callees.add(name)
          }
          this.noteSite(node, PANIC_ARRAY_LENGTH, false, "")
        }
      }
      return
    }
    const method = arrayMethodName(program, table, node)
    if (method.length > 0) {
      this.collectMethodFacts(node, method)
      return
    }
    if (
      node.kind === NodeKind.Binary &&
      isAssignmentOperator(node.text) &&
      node.children[0].kind === NodeKind.Index
    ) {
      this.facts.effect = EFFECT_WRITE
      if (!isGuardedAccess(program, table, node.children[0])) {
        this.noteArrayWrite(node, node.children[0].children[0]) // a guarded one is R6's, as above
      }
      // A compound store whose right side can resize the array checks its
      // index again after it (`emitElementAssignment`, CG-10), even where the
      // first check was proved away. The emitter asks the fixpoint which calls
      // resize, which is not settled yet here, so any call or `new` counts:
      // a function may lose `willreturn` for a check its IR turns out not to
      // hold, and never keeps it past one its IR does.
      if (
        node.text !== "=" &&
        program.nodeProvenIndex[node.children[0].id] &&
        callsAnything(node.children[1])
      ) {
        this.facts.callees.add("nish_panic_index")
        // The check after the right side is a panic site of its own, and an
        // unproven one: the first check's proof does not survive the call.
        this.noteSite(node, PANIC_INDEX, false, "")
      }
    }
  }

  isArrayValued(expr: Node): boolean {
    const type = this.unit.program.nodeTypes[expr.id]
    return type >= 0 && this.table.isArray(type)
  }

  /** What each array method does to memory; mirrors the lowerings exactly. */
  collectMethodFacts(call: Node, method: string): void {
    if (method === "push") {
      this.facts.effect = EFFECT_WRITE
      this.noteArrayWrite(call, methodReceiver(call))
      this.facts.resizesArray = true
      this.facts.callees.add("nish_array_grow")
      return
    }
    if (method === "pop") {
      // Stores the shortened length back, and panics on an empty array.
      this.facts.effect = EFFECT_WRITE
      this.noteArrayWrite(call, methodReceiver(call))
      this.facts.resizesArray = true
      const proven = this.unit.program.nodeProvenIndex[call.id]
      if (!proven) {
        this.facts.callees.add("nish_panic_index")
      }
      this.noteSite(call, PANIC_POP, proven, "")
      return
    }
    if (method === "join") {
      this.facts.effect = EFFECT_WRITE // one arena allocation
      this.facts.callees.add("nish_alloc_struct")
      return
    }
    // WP34 N2: both write the receiver's elements. `fill` stores into a
    // clamped range and calls nothing; `set` also reads its source's elements
    // and fails a range check through the slice panic.
    if (method === "set" || method === "fill") {
      this.facts.effect = EFFECT_WRITE
      this.noteArrayWrite(call, methodReceiver(call))
      if (method === "set") {
        this.facts.readsMemory = true
        this.facts.callees.add("nish_panic_slice")
        this.noteSite(call, PANIC_SLICE, false, "")
      }
      return
    }
    this.facts.readsMemory = true // `indexOf` scans the elements
    const receiver = methodReceiver(call)
    if (receiver === null) {
      return
    }
    const type = this.unit.program.nodeTypes[receiver.id]
    if (type >= 0 && this.table.isArray(type) && this.table.refOf(type) === T_STRING) {
      this.facts.callees.add("nish_str_eq")
    }
  }

  /** An integer division may call the noreturn panic, unless its divisor is proven. */
  collectDivisionFacts(node: Node): void {
    if (node.kind !== NodeKind.Binary) {
      return
    }
    const op = node.text
    if (op !== "/" && op !== "%" && op !== "/=" && op !== "%=") {
      return
    }
    // A ranged target of `/=` keeps its range on its node (WP31); the
    // division is its base's, `i32`.
    const left = this.unit.program.nodeTypes[node.children[0].id]
    if (left >= 0 && isInteger(this.table.baseOf(left))) {
      // Mirrors `emitIntBinary`: a proven divisor (`judgeDivision`) has no check.
      const proven = this.unit.program.nodeProvenIndex[node.id]
      if (!proven) {
        this.facts.callees.add("nish_panic_div")
      }
      this.noteSite(node, PANIC_DIVIDE, proven, "")
    }
  }

  /**
   * Every checked signed `+ - *`, negation and step may call the noreturn
   * overflow panic, as a division may call its own, and is an `overflow` site.
   * One the bounds walk proved fits (`nodeProvenNoOverflow`) is a plain
   * `add nsw` and calls nothing, so its site is proven. The question is `checksOverflow`'s,
   * the one `emitIntBinary` is reached on, so the two cannot drift apart.
   */
  collectOverflowFacts(node: Node): void {
    const program = this.unit.program
    if (!checksOverflow(program, this.table, node)) {
      return
    }
    const proven = program.nodeProvenNoOverflow[node.id]
    if (!proven) {
      this.facts.callees.add("nish_panic_overflow")
    }
    this.noteSite(node, PANIC_OVERFLOW, proven, "")
  }

  /**
   * A value entering a range may take the panic tail (WP31 §6): an entry the
   * checker recorded that neither `entryIsFree` nor the proof in
   * `nodeProvenRange` (§8) excuses, and the store of a compound assignment or
   * an increment into a ranged place. Mirrors `emitRangeEntry` and
   * `emitRangedStore`.
   */
  collectRangeFacts(node: Node): void {
    const program = this.unit.program
    const from = program.nodeCoercions[node.id]
    const to = program.nodeTypes[node.id]
    const checked = from >= 0 && this.table.isRanged(to) && !this.table.entryIsFree(from, to)
    const entered = checked && !program.nodeProvenRange[node.id]
    const stored = rangedStoreOf(program, this.table, node) >= 0
    if (entered || stored) {
      const tail: string[] = []
      panicTailCallees(tail)
      this.addCallees(tail)
    }
    if (checked) {
      this.noteSite(node, PANIC_RANGE, program.nodeProvenRange[node.id], "")
    }
    if (stored) {
      this.noteSite(node, PANIC_RANGE, false, "")
    }
  }

  /**
   * The namespace properties that are not constants. The load of `@nish_argv`
   * reads memory the function does not own, so the caller is at most
   * `readonly`; `process.platform` and `process.arch` are one `readnone`
   * runtime call each (WP14 §7a), which changes no attribute today. The call
   * is named anyway, because the rule is that what a construct emits and what
   * the analysis is told it emits never drift apart.
   */
  collectNamespacePropertyFacts(node: Node): void {
    let name = ""
    if (node.kind === NodeKind.Member) {
      if (receiverIsValue(this.unit.program, node.children[0])) {
        return
      }
      name = dottedName(node)
    } else if (node.kind === NodeKind.Ident) {
      // The same property, reached through `import { argv } from
      // "nish:process"`. An attribute that depended on which spelling a
      // program used would be a miscompile waiting for the other one.
      name = this.unit.program.nodeBuiltins[node.id]
    } else {
      return
    }
    if (name === "process.argv") {
      this.facts.readsMemory = true
    } else if (name === "process.platform") {
      this.facts.callees.add("nish_platform")
    } else if (name === "process.arch") {
      this.facts.callees.add("nish_arch")
    }
  }

  /** The site a builtin call is, by the name the analysis resolved it to (`builtinPanicKind`). */
  noteBuiltinSite(call: Node, name: string): void {
    const kind = builtinPanicKind(name)
    if (kind >= 0) {
      this.noteSite(call, kind, false, "")
    }
  }

  /** Every array a builtin call writes the elements of (`builtinArgumentLetters`), each a write of its own. */
  noteWrittenArguments(call: Node): void {
    const letters = builtinArgumentLetters(this.unit.program, call)
    const args = call.children[1].children
    for (let i = 0; i < args.length; i++) {
      if (isWrittenArgument(letters, i)) {
        this.noteArrayWrite(call, args[i])
      }
    }
  }

  /** WP7: `toI32`, `parseInt`, `readFileSync` and the rest, called by plain identifier. */
  collectIdentifierBuiltinFacts(node: Node): void {
    if (node.kind !== NodeKind.Call || node.children[0].kind !== NodeKind.Ident) {
      return
    }
    if (this.unit.program.nodeCallees[node.id] !== null) {
      return // a user function of that name wins
    }
    // Under a `nish:` import the identifier is the local name, so the checker
    // recorded which builtin it is; a dotted one is what the other helper
    // answers for. Reading the text here instead would leave a call to `exit`
    // looking like no call at all, and the function would keep a `willreturn`
    // it has not earned.
    const imported = this.unit.program.nodeBuiltins[node.id]
    // WP49: `spawn` and `awaitAll` are operators on the direct call they are
    // given, whose facts are that call's; they carry no capability row
    // (tests/capabilities.js). `spawn` allocates its task's frame and files
    // it on the driver's queue, a write no caller may drop, and a task that
    // pends runs on later, so the call is neither pure nor sure to return.
    if (imported === "async.spawn") {
      this.facts.effect = EFFECT_WRITE
      this.facts.willReturn = false
      if (spawnsShared(this.unit.program, this.table, node)) {
        this.facts.feedsTasks = true
      }
      return
    }
    if (imported === "async.awaitAll") {
      return
    }
    // WP49 stage 5: `await sleep(ms)` and the descriptor waits make a wait on
    // the executor and may suspend the function at it; the cancellation calls
    // (part 7) write the executor's state.
    if (isExecutorCall(imported)) {
      this.facts.effect = EFFECT_WRITE
      this.facts.willReturn = false
      return
    }
    this.noteBuiltinSite(node, imported.length > 0 ? imported : node.children[0].text)
    if (this.known !== null) {
      this.noteBuiltin(builtinNameOf(this.unit.program, node), node, imported.length > 0)
    }
    if (imported.length > 0) {
      const named =
        imported.indexOf(".") < 0
          ? identifierBuiltinCalleesNamed(this.unit.program, this.table, node, imported)
          : builtinCalleesNamed(this.unit.program, this.table, this.opts, node, imported)
      this.addCallees(named)
      this.noteWorld(node, named, imported)
    } else {
      const plain = identifierBuiltinCallees(this.unit.program, this.table, node)
      this.addCallees(plain)
      this.noteWorld(node, plain, node.children[0].text)
    }
    if (isArenaCall(this.unit.program, node)) {
      this.facts.opensArena = true
    }
    // WP34 N5: `netAddress`, `tcpAccept` and `netRead` write a `u8[]` they
    // are handed.
    this.noteWrittenArguments(node)
    // `nish:unsafe`: `uncheckedGet` is the load `xs[i]` is and
    // `uncheckedSet` the store `xs[i] = v` is (`collectArrayFacts`), less the
    // bounds check, so neither lists `nish_panic_index`. The store's receiver
    // is a shared write above, through its `w`. `readCString` reads C's bytes
    // up to the `NUL` (WP27 S3.3), `readStruct` a struct's worth (S4.2).
    const name = builtinNameOf(this.unit.program, node)
    // `nish:simd`'s load reads elements and its store writes them, as an
    // element access does, through a bounds check (`isSimdAccess`).
    // `cErrno` reads the slot the foreign calls write (WP27 S5).
    if (
      name === "uncheckedGet" ||
      name === "readCString" ||
      name === "readStruct" ||
      name === "cErrno" ||
      isSimdLoad(name)
    ) {
      this.facts.readsMemory = true
    } else if (name === "uncheckedSet" || name === "store") {
      this.facts.effect = EFFECT_WRITE
    } else if (name === "spawnPiped" || name === "spawnPipedWithin") {
      // The runtime appends to `stdout` and `stderr` as `push` does, moving
      // their `len` and perhaps their `data` (`isResizeCall`).
      this.facts.effect = EFFECT_WRITE
      this.facts.resizesArray = true
      this.facts.callees.add("nish_array_grow")
    }
  }
}

/** `sig` is a constructor whose prologue stores at least one field initialiser. */
const initialisesFields = (sig: FunctionSig): boolean => {
  const owner = sig.owner
  if (sig.role !== ROLE_CONSTRUCTOR || owner === null) {
    return false
  }
  for (const field of owner.fields) {
    if (field.initializer !== null) {
      return true
    }
  }
  return false
}

/**
 * One function's facts, before the fixpoint. An instance that `needsStance`
 * and stated none (a `mark*` helper's answer dropped, or a route that calls
 * none) is given the unknown stance here, once, whichever way the build
 * returned (#1328).
 */
const collectFacts = (
  unit: AnalysisUnit,
  table: TypeTable,
  opts: Options,
  sig: FunctionSig,
  memory: EscapeResult | null,
  nodeCount: i32,
  known: FactsTable | null
): FunctionFacts => {
  const facts = collectStatedFacts(unit, table, opts, sig, memory, nodeCount, known)
  // `NISH_SIMULATE_ICE=nostance:<name>` forgets one instance's stance. Stances
  // only add, and the unknown one adds everything, so applying it over the
  // stated one is what a missing stance would have given.
  const forgotten = opts.statelessInstance !== "" && sig.sourceName === opts.statelessInstance
  if ((!facts.stanceStated || forgotten) && needsStance(unit.program, sig)) {
    assumeUnknownStance(facts)
  }
  return facts
}

/**
 * Per-function facts from one walk of the body and the stated stances,
 * without `collectFacts`' unknown-stance fallback. `memory` (round 2, see
 * `analyzeFunctions`) tells the collectors which allocations are allocas and
 * which locals hold them, and carries the allocation facts into the result.
 */
const collectStatedFacts = (
  unit: AnalysisUnit,
  table: TypeTable,
  opts: Options,
  sig: FunctionSig,
  memory: EscapeResult | null,
  nodeCount: i32,
  known: FactsTable | null
): FunctionFacts => {
  const program = unit.program
  // WP29 P3: what a channel's `send` allocates in its source body is Node's
  // (`markChannelSend`), so its escape analysis is not this instance's.
  const ownMemory = memory !== null && !isChannelSend(sig) && jsonRouteOf(sig) === JSON_NONE
  // `stackSites` is sized by the whole program's node count, so a table per
  // function is quadratic. Round 1 (`known` is null) has no escape analysis yet
  // and proves no site, and a function that takes the analysis's table needs
  // none of its own; `isStackSite` reads past the end as false.
  const facts = new FunctionFacts(sig.paramNames, known === null || ownMemory ? 0 : nodeCount)
  facts.freshThis = sig.role === ROLE_CONSTRUCTOR
  facts.returnDeref = structSize(program, table, sig.returnType)
  facts.returnAlign = pointerAlign(program, table, sig.returnType)
  if (memory !== null && ownMemory) {
    facts.stackSites = memory.stackSites
    facts.stackLocals = memory.stackLocals
    facts.stackParams = memory.stackParams
    facts.directArena = memory.directArena
    facts.allocates = memory.directArena
    facts.allocLeaks = memory.allocLeaks
    facts.leaksItself = memory.allocLeaks
    facts.allocEscapes = memory.allocEscapes
    facts.returnsAllocation = memory.returnsAllocation
    facts.returnsFreshElements = memory.returnsFreshElements
    facts.fillsParam = memory.fillsParam
    facts.callSites = memory.callSites
    facts.escapingNodes = memory.escapingNodes
    facts.carriedStores = memory.carriedStores
    facts.carriers = memory.carriers
    facts.arenaNodes = memory.arenaNodes
    facts.arenaFlows = memory.arenaFlows
    facts.escapeSite = memory.escapeSite
    // The half of `contained` that needs no fixpoint; the other is added after
    // it. Root storage (WP55) is a module constant whose elements hold
    // pointers, which any function can store through, so where a program has
    // one only the escape half proves anything.
    facts.contained = !opts.holdsRoots && rootsHoldNoPointer(program, table, sig)
  }
  // A `returned` or `leaked` allocation is still an allocation.
  if (facts.returnsAllocation || facts.allocLeaks) {
    facts.allocates = true
  }
  facts.allocatesItself = facts.allocates
  facts.sourceName = sig.sourceName
  facts.returnsScalar = sig.returnType === T_VOID || isScalarArgument(table, sig.returnType)
  let i = 0
  while (i < sig.paramNames.length) {
    const type = sig.paramTypes[i]
    if (isPointerParam(table, type)) {
      facts.pointerParams.push(
        new PointerParamFacts(
          sig.paramNames[i],
          structSize(program, table, table.stripNull(type)),
          pointerAlign(program, table, type)
        )
      )
    }
    i = i + 1
  }

  // Typed JSON: a call of `jsonDecode` or `jsonEncode`, whose code the emitter writes at the call.
  if (jsonRouteOf(sig) !== JSON_NONE) {
    applyStance(facts, markJsonRoute(program, table, sig, facts))
    return facts
  }

  // WP29 P3: a channel's `send`, whose body the emitter writes.
  if (isChannelSend(sig)) {
    applyStance(facts, markChannelSend(facts))
    return facts
  }

  // An atomic's method, whose body the emitter writes.
  if (isAtomicMethod(sig)) {
    applyStance(facts, markAtomic(facts))
    return facts
  }

  // WP46: one of `nish:region`'s intrinsics, whose body the emitter writes.
  if (isRegionIntrinsic(program, sig)) {
    applyStance(facts, markRegionIntrinsic(facts))
    if (opts.recordsPanics()) {
      facts.panicSites.push(new PanicSite(sig.decl, program.source, PANIC_REGION, sig.name, false, ""))
    }
    return facts
  }

  // One of `std/sync/shm.ts`'s window intrinsics, whose body the emitter writes.
  if (isShmWindowIntrinsic(program, sig)) {
    applyStance(facts, markShmWindow(facts))
    return facts
  }

  // WP27 S1: a `declare function` has no body, and `FunctionFacts` starts from
  // the *pure* defaults because purity here is discovered by walking a body and
  // finding nothing impure in it. An absent body is not an empty one: leaving
  // the defaults would mark every caller of a C function `readnone willreturn`,
  // which miscompiles rather than pessimises. So a foreign function asserts the
  // worst of everything it cannot be seen to avoid, and the fixpoint carries
  // that outward exactly as it carries any other impurity. `escaping` stays
  // empty: a `string` argument (S3.1) and a `u8[]` or `readonly u8[]` one
  // (WP53 B1.2) are borrowed for the call and never kept, by the rule
  // `docs/wp27-ffi.md` §8b decides rather than proves. A buffer is a pointer
  // parameter, so the borrow is written as its facts: `captured` stays
  // `false`, and a `u8[]` one is `writesThrough`, because C fills it. A
  // `declare class` one (WP27 S4.1) is the same loan of a struct C fills. The
  // call site records the same write on the caller's side (`noteSlotWrite`
  // in `addCallee`); a `readonly u8[]` one is neither.
  if (sig.foreign()) {
    let at = 0
    let p = 0
    while (p < sig.paramTypes.length) {
      if (isPointerParam(table, sig.paramTypes[p])) {
        if (filledByC(program, table, sig, p)) {
          facts.pointerParams[at].writesThrough = true
          facts.pointerParams[at].writesShared = true
        }
        at = at + 1
      }
      p = p + 1
    }
    facts.effect = EFFECT_WRITE
    facts.sharedWrite = true // no site and no callee to name: the body is C
    facts.writesPastParams = true
    facts.writesElsewhere = true
    facts.worldVia = `the C function \`${sig.sourceName}\`` // `nish:secret`: nothing about C is proved
    facts.willReturn = false
    facts.readsMemory = true
    // WP53 B1.3: no array header crosses to C. A `u8[]` argument is lent as
    // `buf->data` for the call and a `string` as `s->data`; `len`, `cap` and
    // the header's own address never leave Nish, and a `CPtr` only ever comes
    // from C. So a C body can write bytes but cannot move a length or the
    // block (docs/wp53-ffi-buffers-handles.md §3c), unlike the worst cases
    // above, which stay. Nor can C re-enter Nish to do it: an exported function
    // it calls back reaches no array the caller holds, because a module has no
    // `let` and no `static` field to keep one in, and its one array `const`,
    // module storage, has a static header whose length never moves. It holds
    // only while no header crosses: a stage that hands C a `nish_array *` sets
    // it back to `true` here, as `std/sync/shm.ts`'s `nishshm_close` does,
    // because closing a region empties every window it lent (`markShmWindow`).
    // The checker's index proof does not read it, and still forgets every
    // length at a foreign call (§10, Q15).
    facts.resizesArray = sig.sourceName === "nishshm_close" && isShmSource(program)
    // WP27 S3.2: a `string` result is a fresh arena copy at every call
    // (`emitForeignStringResult`), so the call allocates and answers what it
    // allocated, as a body that returns `s.substring(...)` does. Every caller
    // that asks whether a call's result is fresh, a loop pass or a `using a =
    // arena()` block deciding what it may release, reads it here.
    if (table.stripNull(sig.returnType) === T_STRING) {
      facts.allocates = true
      facts.allocatesItself = true
      facts.returnsAllocation = true
    }
    return facts
  }

  const collector = new FactCollector(unit, table, opts, sig, facts, known)
  const body = sig.body()
  if (body !== null) {
    collector.findPrivateArrays(body)
    collector.visit(body)
  }
  // A constructor's prologue stores the field initialisers, a variant's tag
  // among them, into `this` before the body runs (`emitConstructorPrologue`),
  // and the walk above sees only the body. Without these writes a constructor
  // whose body never stores a field had a `readonly` `this`, and `-O2` deleted
  // the stores (#740). Like `this.f = v` in the body, they initialise the
  // fresh object, so they are not a shared write (`initialisesThis`).
  if (initialisesFields(sig)) {
    facts.effect = EFFECT_WRITE
    const self = facts.pointerParam("this")
    if (self !== null) {
      self.writesThrough = true
      self.writesShared = true
    }
  }
  // WP31 §9: the prologue that checks a host's arguments may take the panic
  // tail (`emitParamRangeChecks`). Its callers keep the tail they recorded for
  // the entry they no longer check, which is sound and costs nothing: they call
  // this function, and it calls the same two.
  // WP51: a dispatcher whose set is empty traps (`emitEmptyDispatcher`), and
  // a debug build checks a dispatcher's tag on entry, which may panic
  // (`emitTagCheck`). Its body, a `switch` of direct calls, says neither.
  if (sig.dispatcher && sig.refMembers.length === 0) {
    facts.hasTrap = true
  } else if (sig.dispatcher && opts.profile === "debug") {
    const tail: string[] = []
    panicTailCallees(tail)
    collector.addCallees(tail)
  }
  if (checksRangesInPrologue(table, opts, sig)) {
    const tail: string[] = []
    panicTailCallees(tail)
    collector.addCallees(tail)
    for (const type of sig.paramTypes) {
      if (table.isRanged(type)) {
        collector.noteSite(sig.decl, PANIC_RANGE, false, "")
      }
    }
  }

  // The two arena builtins that report the bump position. Read here rather
  // than in escape.ts because the walk has already put every runtime symbol a
  // call lowers to in `callees`, and because this has to hold in round 1:
  // `analyzeFunctions` adds the scope's own `nish_arena_mark` to `callees`
  // after the fixpoint, and that one is the compiler's, not the program's.
  if (isRegionEntry(sig)) {
    applyStance(facts, markParallelEntry(facts, "nish_parallel_range", true))
  }
  if (isSpawnEntry(sig)) {
    applyStance(facts, markParallelEntry(facts, "nish_scope_spawn", false)) // WP29 P2: the payload is kept until the join
  }
  if (isMapRoute(sig)) {
    applyStance(facts, markMapRoute(table, sig, facts))
    // WP35: the routed code runs in place of the body, so its capabilities
    // are this instance's, arriving at the declaration (no call names them).
    if (known !== null) {
      for (const callee of routeCalleesOf(table, sig)) {
        collector.addUserCallee(callee.name, sig.decl)
      }
    }
  }
  if (secretRoleOf(sig) === SECRET_WIPE) {
    applyStance(facts, markWipe(facts))
  }
  if (isLockMethod(sig)) {
    applyStance(facts, markLock(facts))
  }

  facts.readsArenaState = facts.callees.has("nish_arena_mark") || facts.callees.has("nish_arena_used")
  facts.managesArena = facts.callees.has("nish_arena_mark")

  if (facts.readsMemory) {
    facts.effect = maxEffect(facts.effect, EFFECT_READ)
  }
  if (facts.hasTrap) {
    facts.effect = EFFECT_WRITE
  }
  facts.willReturn = facts.loopsBounded && !facts.hasTrap && !facts.callsNoReturn
  // WP49: a function that awaits is called through its resume, which stores
  // its state and answers into the frame and may leave it pending, so a
  // caller's facts may not treat it as pure or as sure to return.
  if (sig.suspends()) {
    facts.effect = EFFECT_WRITE
    facts.willReturn = false
  }
  return facts
}

// ---- What a bodiless instance states --------------------------------------------------------

/*
 * #1328: an instance whose code is not its walked source body (a routed `nish/map`
 * method, a typed-JSON route, a channel's `send`, an atomic, a lock, a wipe,
 * a region or shm intrinsic, a parallel or spawn entry) has its facts written
 * by hand, by one `mark*` helper each. The facts start from the pure defaults,
 * so a helper that forgets a write leaves the instance writing nothing, and a
 * task that calls it on memory its spawner shares is let through: #1307's
 * fourth round found `reserve` and `jsonDecode` doing exactly that. So every
 * such helper answers a `BodilessStance`, whose fields are all constructor
 * arguments: a helper that states no write, keep or growth stance does not
 * compile, under `tsc` or under the seed, and "writes nothing" is a word
 * (`STANCE_WRITES_NONE`) its author had to type. `applyStance` is the one
 * place those facts are set for such an instance, and it records that it ran
 * (`FunctionFacts.stanceStated`).
 *
 * What the type cannot refuse is an answer dropped at the call, or a new
 * routed instance that calls no helper at all. So the instances that need a
 * stance are one list (`needsStance`), and `collectFacts` gives any of them
 * that stated none the unknown stance (`assumeUnknownStance`): every
 * parameter written deep, kept past the call and polluted, and arrays grown.
 * That is `jsonDecode`'s stance, which a task handed shared memory is refused
 * for, so a forgotten stance fails closed. `tests/bodiless-stance.js` checks
 * the text around it: every helper's answer is applied, and every predicate
 * the emitter's body dispatch asks is on the list.
 *
 * A bodiless helper is named `mark*` and declared in this section, which is
 * how that check finds it.
 */

/** Adds no write to the parameter: it is only read, or what writes it is a routed callee the fixpoint resolves. */
const STANCE_WRITES_NONE: i32 = 0
/** Stores into the parameter's own slots: `writesThrough` and `writesShared`. */
const STANCE_WRITES_SLOTS: i32 = 1
/** As `STANCE_WRITES_SLOTS`, and the write is one a task holding the parameter sees: `writesReach`. */
const STANCE_WRITES_REACH: i32 = 2
/** As `STANCE_WRITES_REACH`, and the write lands below the parameter's own slots: `writesDeep`. */
const STANCE_WRITES_DEEP: i32 = 3

/** Keeps nothing of the parameter past the call, or what keeps it is a routed callee. */
const STANCE_KEEPS_NONE: i32 = 0
/** Holds the parameter until a join inside the call: `captured`, and `outlives` as the walk found it. */
const STANCE_KEEPS_JOINED: i32 = 1
/** Holds the parameter past the call: `captured` and `outlives`. */
const STANCE_KEEPS_PAST: i32 = 2

/** What a bodiless instance's emitted code does with one pointer parameter. */
class ParamStance {
  /** A `STANCE_WRITES_*`. */
  writes: i32
  /** A `STANCE_KEEPS_*`. */
  keeps: i32
  /** Memory that may not be the caller's is stored below the parameter: `polluted`. */
  pollutes: boolean

  constructor(writes: i32, keeps: i32, pollutes: boolean) {
    this.writes = writes
    this.keeps = keeps
    this.pollutes = pollutes
  }
}

/**
 * A bodiless instance's write, keep and growth stance: one for its first
 * pointer parameter (the receiver, where it has one) and one for the rest.
 * Each only adds to what the facts already hold, so for an instance whose
 * source body is walked as well (a spawn, a region entry, a map route, a
 * lock, a wipe) the walk's facts stand beside it.
 */
class BodilessStance {
  first: ParamStance
  rest: ParamStance
  /** Moves an array's length or storage: `resizesArray`. */
  grows: boolean

  constructor(first: ParamStance, rest: ParamStance, grows: boolean) {
    this.first = first
    this.rest = rest
    this.grows = grows
  }
}

/** A stance that adds nothing to any parameter, for an instance that writes and keeps none of them. */
const statesNothing = (): ParamStance => new ParamStance(STANCE_WRITES_NONE, STANCE_KEEPS_NONE, false)

/** Set one pointer parameter's facts from its stance; never clears one. */
const applyParamStance = (pp: PointerParamFacts, stance: ParamStance): void => {
  // The levels are compared by order, so a value outside them would silently
  // read as the nearest end; it is a broken invariant instead.
  if (
    stance.writes < STANCE_WRITES_NONE ||
    stance.writes > STANCE_WRITES_DEEP ||
    stance.keeps < STANCE_KEEPS_NONE ||
    stance.keeps > STANCE_KEEPS_PAST
  ) {
    process.exit(
      internalError(`attributes: a stance for \`${pp.name}\` has no level ${stance.writes}/${stance.keeps}`)
    )
  }
  if (stance.writes >= STANCE_WRITES_SLOTS) {
    pp.writesThrough = true
    pp.writesShared = true
  }
  if (stance.writes >= STANCE_WRITES_REACH) {
    pp.writesReach = true
  }
  if (stance.writes >= STANCE_WRITES_DEEP) {
    pp.writesDeep = true
  }
  if (stance.keeps >= STANCE_KEEPS_JOINED) {
    pp.captured = true
  }
  if (stance.keeps >= STANCE_KEEPS_PAST) {
    pp.outlives = true
  }
  if (stance.pollutes) {
    pp.polluted = true
  }
}

/**
 * The one writer of a bodiless instance's parameter write, keep and pollute
 * facts and of its `resizesArray` (#1328). It owns only those: the
 * function-level facts a helper also sets (`effect`, `sharedWrite`,
 * `writesPastParams`, `writesElsewhere`, `atomic`, `callees`) stay the
 * helper's, because the pure defaults of those are not what lets a task
 * through.
 */
const applyStance = (facts: FunctionFacts, stance: BodilessStance): void => {
  facts.stanceStated = true
  let i = 0
  while (i < facts.pointerParams.length) {
    applyParamStance(facts.pointerParams[i], i === 0 ? stance.first : stance.rest)
    i = i + 1
  }
  if (stance.grows) {
    facts.resizesArray = true
  }
}

/**
 * Every instance whose code is not, or not only, its walked source body: the
 * ones the emitter writes or wraps (`emitFunction`'s body dispatch, the JSON
 * route at the call, `src/emit-map.ts`, `src/emit-parallel.ts`). Each states
 * its stance through a `mark*` helper; one that states none is given the
 * unknown stance. A new such instance joins this list, and
 * `tests/bodiless-stance.js` refuses an emitter body dispatch that asks a
 * predicate this does not.
 */
const needsStance = (program: CheckedProgram, sig: FunctionSig): boolean =>
  jsonRouteOf(sig) !== JSON_NONE ||
  isChannelSend(sig) ||
  isAtomicMethod(sig) ||
  isRegionIntrinsic(program, sig) ||
  isShmWindowIntrinsic(program, sig) ||
  isRegionEntry(sig) ||
  isSpawnEntry(sig) ||
  isMapRoute(sig) ||
  secretRoleOf(sig) === SECRET_WIPE ||
  isLockMethod(sig)

/**
 * What an instance that `needsStance` and stated none is taken to do: the
 * worst of everything, as a `declare function` is (`collectFacts`). Every
 * pointer parameter is written deep, kept past the call and polluted, arrays
 * grow, and the instance writes and reads memory past its parameters and may
 * not return. Inside a task that is a refusal wherever the task hands it
 * memory its spawner shares.
 */
const assumeUnknownStance = (facts: FunctionFacts): void => {
  const unknown = new ParamStance(STANCE_WRITES_DEEP, STANCE_KEEPS_PAST, true)
  applyStance(facts, new BodilessStance(unknown, unknown, true))
  facts.effect = EFFECT_WRITE
  facts.sharedWrite = true
  facts.writesPastParams = true
  facts.writesElsewhere = true
  facts.readsMemory = true
  facts.willReturn = false
  if (facts.worldVia.length === 0) {
    facts.worldVia = `\`${facts.sourceName}\`, whose emitted code states no stance`
  }
}

/**
 * WP29 P1: the facts of a `parallelMapInto` or `parallelReduce` instance are
 * its source walk's, plus what the region the emitter builds in place of one
 * call does (`src/emit-parallel.ts`). The walk sees a direct call to the
 * chunk loop with the parameters as arguments; the IR stores them into a
 * context block and hands its address to `nish_parallel_range`, which passes
 * it to other threads. So the runtime entry is a callee — it is a shared
 * write and not `willreturn`, and the fixpoint carries both — and every
 * parameter is treated as escaping, written through and captured:
 *
 *   - no `nocapture`, because the address is stored in memory another thread
 *     reads, and whether that copy outlives the call is the partitioner's
 *     join rather than anything this analysis can see;
 *   - no `readonly`, because `dst` is written by those threads through the
 *     copy, not through the parameter this function was handed.
 *
 * Both are claims LLVM would act on, and what each would buy is nothing: the
 * instance is called once per region, and the loop inside it is the chunk
 * function, whose own facts are unaffected.
 *
 * What the copy does not do is outlive the call: `nish_parallel_range` keeps
 * its jobs on its own stack and returns once every chunk has, so a region
 * entry (`joined`) leaves `outlives` as its source walk found it. An array the
 * caller made and handed to `parallelMapInto` is then the caller's alone
 * again, and the frame or the pass that made it releases it as it would after
 * a sequential loop; without this every `parallelMap` let its result out of
 * the caller's frame, and a function that called one and answered a scalar
 * never reclaimed it (`tests/link/par_map_reclaim`).
 *
 * A `spawn` instance (WP29 P2) is the same shape with a longer wait: its
 * payload — the argument and the destination — is copied into the scope's
 * task and read when the scope joins, after `spawn` has returned. So every
 * parameter outlives the call there, which is also what keeps an argument out
 * of a stack slot a later pass of a loop would reuse and out of a loop pass
 * the arena would release before the join.
 */
const markParallelEntry = (facts: FunctionFacts, runtime: string, joined: boolean): BodilessStance => {
  handsParamsTo(facts, runtime)
  const each = new ParamStance(STANCE_WRITES_SLOTS, joined ? STANCE_KEEPS_JOINED : STANCE_KEEPS_PAST, false)
  return new BodilessStance(each, each, false)
}

/** What a runtime entry that is handed every parameter adds besides the stance: the callee, and every parameter escaping. */
const handsParamsTo = (facts: FunctionFacts, runtime: string): void => {
  facts.callees.add(runtime)
  for (const name of facts.paramNames) {
    facts.escaping.add(name)
    facts.keptOutright.add(name)
  }
}

/**
 * WP32 S5: the body of a `nish/map` instance is what Node runs, and natively
 * it never does: every call of it is lowered to the table's own code instead
 * (`emitMapRoute`), and that code is what its callers' facts have to see.
 * `reserve`'s body in particular does nothing, where `reserveSlots` writes the
 * table and allocates a bucket array the table keeps, so facts read off the
 * body would let a caller's map be `readonly` and a loop that presizes one
 * reclaim the new buckets at the end of its pass. So the routed functions are
 * this instance's callees too, and the table is handed to each as its
 * receiver, which the fixpoint resolves against their own parameter facts.
 * `getOrInsert`'s body already reads, writes and keeps what its routed code
 * does, so for it this changes nothing but the order the facts are found in.
 * The stance adds nothing of its own: every write, keep and growth of the
 * table is a routed callee's, and reaches the receiver through them.
 */
const markMapRoute = (table: TypeTable, sig: FunctionSig, facts: FunctionFacts): BodilessStance => {
  const routed = routeCalleesOf(table, sig)
  facts.routed = true
  const receiver: PointerParamFacts | null =
    sig.paramNames.length > 0 ? facts.pointerParam(sig.paramNames[0]) : null
  for (const callee of routed) {
    facts.callees.add(callee.name)
    // No call names its arguments, so what it writes reaches this instance whole.
    facts.wholeCallees.add(callee.name)
    if (receiver !== null) {
      receiver.passedToCallees.push(callee.name)
      receiver.passedToIndices.push(0)
    }
  }
  return new BodilessStance(statesNothing(), statesNothing(), false)
}

/**
 * `nish:secret`'s `wipe`: the source body is empty and the emitter writes the
 * real one, a volatile `llvm.memset` over the target's storage
 * (`src/emit-secret.ts`). Facts read off the empty body would call the
 * instance `readnone` and its parameter `readonly`, and a caller's buffer
 * `readonly` through it — a store into memory LLVM was told is never written,
 * which is undefined behaviour and the licence to drop the wipe. So the
 * instance says what its emitted body does: it reads the header or the field
 * that leads to the bytes, writes through its parameter, and the write is one
 * its caller can see, because the caller's key is what it zeroes. It keeps
 * nothing, so the parameter stays uncaptured. The bytes it zeroes lie below
 * the parameter's own slots, so the write reaches past them too: a caller that
 * hands it `this.k` writes what `this` reaches, which is what a scope's region
 * rule reads of a holder's `wipe()` called beside a task that borrows the key.
 * That parameter write is the whole of it: the `llvm.memset` the instance
 * calls stores only into the target's bytes, so `writesShared` does not count
 * it again as a write elsewhere. A caller's wipe then composes as its argument
 * does (`composeArguments`): a fresh array of its own stays private, and a
 * parameter, a field or anything it does not know is written as before.
 */
const markWipe = (facts: FunctionFacts): BodilessStance => {
  facts.effect = EFFECT_WRITE
  facts.readsMemory = true
  facts.sharedWrite = true
  facts.callees.add(WIPE_MEMSET)
  facts.writeVia = WIPE_MEMSET // the reason is the memset still, though `writesShared` skips it
  return new BodilessStance(
    new ParamStance(STANCE_WRITES_DEEP, STANCE_KEEPS_NONE, false),
    statesNothing(),
    false
  )
}

/**
 * WP29 P3: a `Mutex`'s `lock()`. The source body only reads the guard out of
 * the `Mutex`, and the emitter writes the real one, which takes the guard's
 * lock word with a compare-and-swap and calls `nish_mutex_wait` when the word
 * is held (`src/emit-parallel.ts`). Facts read off the source would call it
 * `readonly` and `willreturn`, and LLVM could then drop it, or move a guarded
 * access across it. So the instance says what its emitted body does: it
 * writes, and it calls the wait, which is not `willreturn` and which every
 * caller inherits through the fixpoint; R5 and R7 (`src/parallel.ts`) find a
 * function that takes a lock by that callee. The word is reached through the
 * guard the `Mutex` holds rather than through `this`, so `this` keeps its own
 * facts, and the write is not a shared one: it is the lock itself (R6).
 */
const markLock = (facts: FunctionFacts): BodilessStance => {
  facts.effect = EFFECT_WRITE
  facts.readsMemory = true
  facts.callees.add("nish_mutex_wait")
  return new BodilessStance(statesNothing(), statesNothing(), false)
}

/**
 * WP29 P3: a `Channel`'s `send`. The source body is Node's, a `push` onto the
 * channel's queue, and the emitter writes the real one, which widens the value
 * into a slot and hands it to `nish_channel_send` with the address of the
 * channel's `state` word (`src/emit-parallel.ts`). So nothing is read off the
 * source: the instance allocates nothing, keeps nothing and answers nothing;
 * it writes through `this`, whose word the runtime may set; it calls the
 * runtime, which takes the channel's lock and so is not `willreturn`. The
 * write is not a shared one: a send is what R6 admits in a task beside a
 * guarded store.
 */
const markChannelSend = (facts: FunctionFacts): BodilessStance => {
  facts.effect = EFFECT_WRITE
  facts.readsMemory = true
  facts.willReturn = false
  facts.contained = true
  facts.returnsScalar = true
  facts.callees.add("nish_channel_send")
  return new BodilessStance(
    new ParamStance(STANCE_WRITES_SLOTS, STANCE_KEEPS_NONE, false),
    statesNothing(),
    false
  )
}

/**
 * An `AtomicI32` or `AtomicI64` method. The source body is Node's, and the
 * emitter writes one sequentially consistent instruction on `this`'s `value`
 * (`src/emit-parallel.ts`). Every one of them, `load` included, writes: a
 * read-only call could be hoisted out of the loop that spins on it, or merged
 * with the one before it. It allocates nothing, keeps nothing, answers a
 * scalar and returns. The write is through `this` and is not a shared one: an
 * atomic update is what a task and a data-parallel body may make beside the
 * guarded store and the send.
 */
const markAtomic = (facts: FunctionFacts): BodilessStance => {
  facts.atomic = true
  facts.effect = EFFECT_WRITE
  facts.readsMemory = true
  facts.contained = true
  facts.returnsScalar = true
  return new BodilessStance(
    new ParamStance(STANCE_WRITES_SLOTS, STANCE_KEEPS_NONE, false),
    statesNothing(),
    false
  )
}

/**
 * WP46: one of `std/region.ts`'s intrinsics (`src/emit-region.ts`). Each source
 * body is a call of itself, so nothing is read off it: the instance says what
 * its one runtime call does. Each swaps or reads the thread's arena, or the
 * region table, so it writes memory no parameter reaches and is not
 * `willreturn` (a bad handle panics). A root handed to `close` or `leave` is
 * kept by the region past the call, so it is captured and outlives it: an
 * arena scope around the call may not release it, and no caller may put it on
 * the stack.
 */
const markRegionIntrinsic = (facts: FunctionFacts): BodilessStance => {
  facts.usesRegion = true
  facts.effect = EFFECT_WRITE
  facts.readsMemory = true
  facts.willReturn = false
  facts.sharedWrite = true
  facts.writesPastParams = true
  facts.writesElsewhere = true
  const each = new ParamStance(STANCE_WRITES_NONE, STANCE_KEEPS_PAST, false)
  return new BodilessStance(each, each, false)
}

/**
 * One of `std/sync/shm.ts`'s window intrinsics (`src/emit-shm-window.ts`), each
 * a call of itself in source, so the facts are the runtime call's. `shmLend`
 * answers a header the region keeps and `shmGiveBack` empties one, setting its
 * `len`, `cap` and `data` from C, so both resize an array and write through
 * every pointer they take, which the region holds past the call. Either stops
 * the program on a bad handle, range or window, so neither is `willreturn`.
 */
const markShmWindow = (facts: FunctionFacts): BodilessStance => {
  facts.effect = EFFECT_WRITE
  facts.readsMemory = true
  facts.willReturn = false
  facts.sharedWrite = true
  facts.writesPastParams = true
  facts.writesElsewhere = true
  const each = new ParamStance(STANCE_WRITES_REACH, STANCE_KEEPS_PAST, false)
  return new BodilessStance(each, each, true)
}

/**
 * Typed JSON: an instantiation of `jsonDecode` or `jsonEncode` is never called
 * and never defined. Every call of it is lowered in place to code written from
 * the class's fields (`src/emit-json.ts`), and its source body is Node's, so
 * nothing is read off it: the instance says what that code does.
 *
 *   - Both call the receiver's methods and `nish/json-typed`'s helpers that
 *     `jsonRouteCallees` names, each with the receiver as its first argument,
 *     so the fixpoint gives the receiver what those callees do with theirs and
 *     the instance their effects, allocations and termination. Both recurse
 *     as the data does and loop over arrays, so neither is `willreturn`.
 *   - An encoding only reads `value`: it loads fields and hands what they hold
 *     to the writer, so `value` keeps the facts of a parameter nothing writes
 *     or keeps, and the encoding allocates only what its callees do.
 *   - A decoding writes into `out` and stores into it every string, array and
 *     object it makes, constructors included, so it says the worst of every
 *     parameter, as a parallel entry does, and that what it allocates escapes:
 *     no loop, arena scope or `using a = arena()` block around a call
 *     reclaims it (NL2424 refuses the block).
 *   - `jsonDecodeUnion` is a decoding that answers `prev` or a variant it
 *     made, so `prev` outlives the call and the result is an allocation.
 */
const markJsonRoute = (
  program: CheckedProgram,
  table: TypeTable,
  sig: FunctionSig,
  facts: FunctionFacts
): BodilessStance => {
  facts.readsMemory = true
  facts.hasLoops = true
  facts.loopsBounded = false
  facts.willReturn = false
  const receiver: PointerParamFacts | null =
    sig.paramNames.length > 0 ? facts.pointerParam(sig.paramNames[0]) : null
  for (const callee of jsonRouteCallees(program, table, sig)) {
    facts.callees.add(callee.name)
    if (receiver !== null && callee.role !== ROLE_CONSTRUCTOR) {
      receiver.passedToCallees.push(callee.name)
      receiver.passedToIndices.push(0)
    }
  }
  const route = jsonRouteOf(sig)
  if (route !== JSON_DECODE && route !== JSON_DECODE_UNION) {
    return new BodilessStance(statesNothing(), statesNothing(), false)
  }
  facts.effect = EFFECT_WRITE
  facts.sharedWrite = true
  facts.allocates = true
  facts.allocatesItself = true
  facts.allocLeaks = true
  facts.leaksItself = true
  facts.allocEscapes = true
  facts.callees.add("nish_array_grow")
  handsParamsTo(facts, "nish_alloc_struct")
  // A union's decoding answers `prev`, or an object it made.
  facts.returnsAllocation = route === JSON_DECODE_UNION
  // What it makes is stored below `out`: a region or a task that hands it
  // an object of another's is told so (`judgeCallee`), as for a body that
  // stores a fresh allocation there. And it is kept there past the call,
  // which is also what a union's `prev`, answered back, needs.
  const each = new ParamStance(STANCE_WRITES_DEEP, STANCE_KEEPS_PAST, true)
  return new BodilessStance(each, each, true)
}

// ---- The fixpoint ------------------------------------------------------------------------

/**
 * `analyzeEscapes` over one function. WP18: over the instantiation's own side
 * tables, so `Box<i32>` being stack-allocated in one instantiation and
 * arena-allocated in another is two answers rather than one.
 */
const analyzeInstanceEscapes = (
  unit: AnalysisUnit,
  table: TypeTable,
  sig: FunctionSig,
  known: FactsTable,
  opts: Options
): EscapeResult => {
  const instance = sig.instance
  if (instance !== null) {
    unit.program.enterInstance(instance)
  }
  const result = analyzeEscapes(unit, table, sig, known, opts)
  if (instance !== null) {
    unit.program.leaveInstance()
  }
  return result
}

/**
 * Record in `known` each function whose result now says it returns fresh
 * elements, fills a parameter or keeps no element of one; answer the new
 * ones.
 */
const markFreshElements = (escapes: EscapeSet, sigs: FunctionSig[], known: FactsTable): StringSet => {
  const added = new StringSet()
  for (const sig of sigs) {
    const result = escapes.get(sig.name)
    const f = known.get(sig.name)
    if (result !== null && f !== null && result.returnsFreshElements && !f.returnsFreshElements) {
      f.returnsFreshElements = true
      added.add(sig.name)
    }
    if (result !== null && f !== null && result.fillsParam >= 0 && f.fillsParam < 0) {
      f.fillsParam = result.fillsParam
      added.add(sig.name)
    }
    if (result !== null && f !== null) {
      for (const name of result.freeElementParams) {
        const pointer = f.pointerParam(name)
        if (pointer !== null && !pointer.elementsFree) {
          pointer.elementsFree = true
          added.add(sig.name)
        }
      }
    }
  }
  return added
}

/** `f` calls one of `names`, for any result: a call that fills a parameter answers nothing. */
const callsAnyCallee = (f: FunctionFacts | null, names: StringSet): boolean => {
  if (f === null) {
    return false
  }
  let c = 0
  while (c < f.callees.size()) {
    if (names.has(f.callees.at(c))) {
      return true
    }
    c = c + 1
  }
  return false
}

/** `result`'s function calls one of `names` for a pointer. */
const callsAnyOf = (result: EscapeResult | null, names: StringSet): boolean => {
  if (result === null) {
    return false
  }
  for (const site of result.callSites) {
    if (names.has(site.callee)) {
      return true
    }
  }
  return false
}

/**
 * Gather per-function facts for a whole program, then propagate over the
 * (cross-module) call graph to a fixpoint: a function is as impure as the most
 * impure thing it calls, it is willreturn only if everything it calls is, and
 * a pointer parameter is written or captured if any callee it is passed to
 * writes or captures the matching parameter. The result is keyed by LLVM
 * symbol, so a caller in one module sees exactly what the exporter proved.
 */
export const analyzeFunctions = (
  units: AnalysisUnit[],
  table: TypeTable,
  opts: Options,
  runtime: RuntimeTable
): FactsTable => {
  // Round 1: plain facts and the capture fixpoint, which the escape analysis needs.
  const first = collectRound(units, table, opts, null, null)
  propagate(first, runtime)
  if (checkingPropagate()) {
    checkPropagate(first, collectRound(units, table, opts, null, null), runtime)
  }
  const escapes = new EscapeSet()
  const owners: AnalysisUnit[] = []
  const sigs: FunctionSig[] = []
  for (const unit of units) {
    for (const sig of unit.program.functions) {
      if (sig.definedIn(unit.program.source)) {
        owners.push(unit)
        sigs.push(sig)
        escapes.set(sig.name, analyzeInstanceEscapes(unit, table, sig, first, opts))
      }
    }
  }
  // A function that returns an array of fresh elements makes each call of it
  // a listing its callers follow, and a caller that returns the listing on
  // returns fresh elements in turn. The set only grows, so this settles; each
  // round re-reads only the callers of what the last one added.
  let added = markFreshElements(escapes, sigs, first)
  while (added.size() > 0) {
    let i = 0
    while (i < sigs.length && i < owners.length) {
      if (callsAnyOf(escapes.get(sigs[i].name), added) || callsAnyCallee(first.get(sigs[i].name), added)) {
        escapes.set(sigs[i].name, analyzeInstanceEscapes(owners[i], table, sigs[i], first, opts))
      }
      i = i + 1
    }
    added = markFreshElements(escapes, sigs, first)
  }
  // Round 2: the same facts with stack allocations applied, then the scope
  // decision. `first` carries round 1's fixpoint, which is what lets a
  // `for...of` ask whether its calls actually grow an array (WP15 section 2c)
  // rather than assuming every one of them does. `resizesArray` is settled by
  // then: it is syntax plus the call graph, and neither moves between rounds.
  const facts = collectRound(units, table, opts, escapes, first)
  propagate(facts, runtime)
  if (checkingPropagate()) {
    checkPropagate(facts, collectRound(units, table, opts, escapes, first), runtime)
  }
  propagateCapabilities(facts)
  for (const f of facts.list) {
    f.arenaScope = f.directArena && !f.allocLeaks && !f.returnsAllocation && !f.feedsTasks
    // What a function stores into a parameter it fills is its caller's, so
    // no scope of its own may release it; nor what a task it spawned holds.
    f.contained = (f.contained || !f.allocEscapes) && f.fillsParam < 0 && !f.feedsTasks
  }
  scopeParallelBodies(units, facts)
  settleCalleeScopes(facts)
  // The per-pass scopes read the settled answers: which callees still leave
  // memory behind, and which let an allocation escape.
  for (const unit of units) {
    for (const sig of unit.program.functions) {
      const f = facts.get(sig.name)
      if (f === null || !f.hasLoops || !sig.definedIn(unit.program.source)) {
        continue
      }
      const instance = sig.instance
      if (instance !== null) {
        unit.program.enterInstance(instance)
      }
      decideLoopScopes(unit, table, sig, f, facts)
      if (instance !== null) {
        unit.program.leaveInstance()
      }
    }
  }
  // `--no-elision`: every scope above is a proof that what it releases is
  // dead, so none is taken; a `using` arena the program writes is not inferred
  // and stays. `netAllocates` was settled with those scopes in place, so it is
  // settled again without them.
  if (opts.noElision) {
    for (const f of facts.list) {
      f.arenaScope = false
      f.netAllocates = f.allocatesItself
      for (const scope of f.loopScopes) {
        scope.scoped = false
      }
    }
    let changed = true
    while (changed) {
      changed = false
      for (const f of facts.list) {
        if (!f.netAllocates && someCalleeNetAllocates(facts, f)) {
          f.netAllocates = true
          changed = true
        }
      }
    }
  }
  for (const f of facts.list) {
    // Both are `willreturn` and the function already writes (it allocates),
    // so nothing else moves. A scoped pass reads its mark inline and calls
    // only the release.
    if (f.arenaScope) {
      f.callees.add("nish_arena_mark")
    }
    if (f.arenaScope || f.scopesAnyPass()) {
      f.callees.add("nish_arena_release")
    }
  }
  return facts
}

/**
 * WP29: a data-parallel body that allocates gets an arena scope of its own, so
 * every element gives back what it allocated before the next one starts. The
 * WP6 rule above asks the function's own allocations to stay out of every
 * local that is assigned, and the callee rule below asks for a callee that
 * allocates; a body can fail both and still be one whose memory is garbage
 * the moment it answers, and for a body that runs a million times on one
 * thread's arena that difference is the peak resident size (wp20 §8a).
 *
 * **Why it is sound.** `recyclesPerElement` (`src/parallel.ts`) is the callee
 * rule's own condition — contained, a scalar result, no arena control — plus
 * not reading the bump position, and `Compilation.checkParallel` refuses any
 * body that allocates without it, so a scope added here never frees what
 * outlives the element. The arena is thread-local under `--threads`
 * (`ARENA_GLOBAL_TLS`), and importing `nish/threads` implies `--threads`, so
 * the mark and the release run in whichever thread the element runs in and
 * name that thread's arena: a worker rewinds only what it bumped itself, and
 * the calling thread, which runs chunk 0, rewinds its own arena to where the
 * element found it. No other thread's allocation can sit between the two.
 *
 * It is set before the callee scopes are settled, so a caller that only calls
 * the body — the chunk loop — sees a callee that no longer net-allocates and
 * does not get a scope of its own around a whole chunk.
 */
const scopeParallelBodies = (units: AnalysisUnit[], facts: FactsTable): void => {
  for (const unit of units) {
    for (const call of unit.program.parallelCalls) {
      const body = parallelBodyOf(call.sig)
      const f: FunctionFacts | null = body === null ? null : facts.get(body.name)
      if (f !== null && f.allocates && !f.arenaScope && recyclesPerElement(f)) {
        f.arenaScope = true
      }
    }
  }
}

/**
 * The automatic arena scope for a function whose callees are what allocate.
 *
 * The rule of WP6 (`arenaScope` above) asks for an allocation of the
 * function's *own* that flows `local`, so a function that only calls
 * allocating functions and throws their results away never reclaimed
 * anything: `List.benchmark` in the Are We Fast Yet suite builds three lists
 * through `makeList` and keeps one `i32`, and every list lived until the
 * harness released its own mark. This adds a second way to earn the bracket:
 *
 *     contained && returnsScalar && some callee net-allocates
 *
 * **Why it is sound.** The release rewinds the arena to where it stood on
 * entry, freeing exactly what was allocated while the function ran, by it or
 * by anything it called. After the `ret` the only things that leave the frame
 * are the return value and whatever the body and its callees wrote into
 * memory that existed before the call. The return value is a number, a
 * `boolean`, an `enum` or nothing, so it names no memory. `contained` says no
 * allocation made during the call is reachable any other way, which covers the
 * writes. Nothing in the call can move the arena below the mark, so the mark
 * still names the entry position when the release runs. Reading the position (`Arena.mark`,
 * `Arena.used`) is allowed, exactly as the WP6 rule allows it: it answers a
 * smaller number after a scope reclaimed memory, which is the point, and
 * `readsArenaState` keeps a release from moving ahead of a tail call to one.
 *
 * **Why "net-allocates".** That clause is profit rather than proof. A callee
 * with a scope of its own gives its memory back before it returns, so a scope
 * around the caller would bracket nothing but two runtime calls. Whether a
 * function net-allocates depends on whether it got a scope, which depends on
 * whether its callees net-allocate, so the functions are settled callees
 * first, depth-first over the call graph. A recursion back to a function still
 * being settled reads the answer computed with the WP6 scopes alone, which can
 * only say "allocates" where the settled one would not: the cost of that is a
 * scope nobody needed, never a missing one.
 */
const settleCalleeScopes = (facts: FactsTable): void => {
  let changed = true
  while (changed) {
    changed = false
    for (const f of facts.list) {
      if (!f.netAllocates && !f.arenaScope && (f.allocatesItself || someCalleeNetAllocates(facts, f))) {
        f.netAllocates = true
        changed = true
      }
    }
  }
  const before: boolean[] = []
  const state: i32[] = []
  for (const f of facts.list) {
    before.push(f.netAllocates)
    state.push(0)
  }
  let i = 0
  while (i < state.length) {
    if (state[i] === 0) {
      settleScope(facts, i, state, before)
    }
    i = i + 1
  }
}

const someCalleeNetAllocates = (facts: FactsTable, f: FunctionFacts): boolean => {
  let c = 0
  while (c < f.callees.size()) {
    const g = facts.get(f.callees.at(c))
    if (g !== null && g.netAllocates) {
      return true
    }
    c = c + 1
  }
  return false
}

/** `state`: 0 not yet visited, 1 being settled (on the walk), 2 settled. */
const settleScope = (facts: FactsTable, i: i32, state: i32[], before: boolean[]): void => {
  state[i] = 1
  const f = facts.list[i]
  let calleeAllocates = false
  let c = 0
  while (c < f.callees.size()) {
    const j = facts.indexOf(f.callees.at(c))
    // `state` and `before` hold one entry per function, so a symbol with facts
    // is always inside both; the tests are what let the bounds prover see it,
    // and the second is repeated because the recursive call drops the first.
    if (j >= 0 && j < state.length && state[j] === 0) {
      settleScope(facts, j, state, before)
    }
    if (j >= 0 && j < state.length && j < before.length) {
      if (state[j] === 2 ? facts.list[j].netAllocates : before[j]) {
        calleeAllocates = true
      }
    }
    c = c + 1
  }
  if (!f.arenaScope && calleeAllocates && f.contained && f.returnsScalar) {
    f.arenaScope = true
  }
  f.netAllocates = !f.arenaScope && (f.allocatesItself || calleeAllocates)
  state[i] = 2
}

/** Escape results by symbol, the second round's input. */
class EscapeSet {
  index: StringMap
  list: EscapeResult[]

  constructor() {
    this.index = new StringMap()
    this.list = []
  }

  set(name: string, result: EscapeResult): void {
    const at = this.index.get(name, -1)
    if (at >= 0) {
      this.list[at] = result
      return
    }
    this.index.set(name, this.list.length)
    this.list.push(result)
  }

  get(name: string): EscapeResult | null {
    const at = this.index.get(name, -1)
    return at < 0 ? null : this.list[at]
  }
}

const collectRound = (
  units: AnalysisUnit[],
  table: TypeTable,
  opts: Options,
  escapes: EscapeSet | null,
  known: FactsTable | null
): FactsTable => {
  const facts = new FactsTable()
  facts.noElision = opts.noElision
  for (const unit of units) {
    for (const sig of unit.program.functions) {
      if (!sig.definedIn(unit.program.source)) {
        continue // an imported signature belongs to the module that defines it
      }
      let memory: EscapeResult | null = null
      if (escapes !== null) {
        memory = escapes.get(sig.name)
      }
      // WP18: per instantiation, over that instantiation's side tables. The
      // facts are keyed by symbol already, so `eq$i32` being `readnone` and
      // `eq$str` `readonly` needs nothing but the right tables here.
      const instance = sig.instance
      if (instance !== null) {
        unit.program.enterInstance(instance)
      }
      facts.set(sig.name, collectFacts(unit, table, opts, sig, memory, unit.program.nodeTypes.length, known))
      if (instance !== null) {
        unit.program.leaveInstance()
      }
    }
  }
  return facts
}

/**
 * Whether evaluating `node` can run a call or a constructor: a superset of
 * `mayResize` in `src/emit-arrays.ts`, which the fixpoint narrows.
 */
const callsAnything = (node: Node): boolean => {
  if (node.kind === NodeKind.Call || node.kind === NodeKind.New) {
    return true
  }
  for (const child of node.children) {
    if (callsAnything(child)) {
      return true
    }
  }
  return false
}

/** The state of one `clearRecursiveWillReturn` walk: the visit counter and Tarjan's stack. */
class CycleWalk {
  visited: i32
  stack: FunctionFacts[]

  constructor() {
    this.visited = 0
    this.stack = []
  }
}

/**
 * Tarjan's algorithm from `v` over the user call graph, keeping its state on
 * the facts themselves (`cycleOrder`, `cycleLow`, `onCycleStack`). A function
 * that calls itself, and every member of a component of two or more, loses
 * `willReturn`. It recurses once per function on the call chain it is
 * following, so its depth is bounded by the number of functions.
 */
const visitCycles = (walk: CycleWalk, facts: FactsTable, v: FunctionFacts): void => {
  walk.visited = walk.visited + 1
  v.cycleOrder = walk.visited
  v.cycleLow = walk.visited
  walk.stack.push(v)
  v.onCycleStack = true
  let c = 0
  while (c < v.callees.size()) {
    const w = facts.get(v.callees.at(c))
    if (w !== null) {
      if (w === v) {
        v.willReturn = false
      }
      if (w.cycleOrder === 0) {
        visitCycles(walk, facts, w)
        if (w.cycleLow < v.cycleLow) {
          v.cycleLow = w.cycleLow
        }
      } else if (w.onCycleStack && w.cycleOrder < v.cycleLow) {
        v.cycleLow = w.cycleOrder
      }
    }
    c = c + 1
  }
  if (v.cycleLow !== v.cycleOrder) {
    return
  }
  // `v` roots a component: itself and everything pushed after it. The first
  // one off the stack is `v` itself exactly when `v` is alone in it.
  let cyclic = false
  let more = true
  while (more) {
    // @ts-expect-error `pop` is `T` in Nish and `T | undefined` in lib.es5 (runtime/nish.d.ts).
    const w: FunctionFacts = walk.stack.pop()
    w.onCycleStack = false
    more = w !== v
    cyclic = cyclic || more
    if (cyclic) {
      w.willReturn = false
    }
  }
}

/**
 * Take `willreturn` from every function on a call-graph cycle: one that calls
 * itself, or calls something that leads back to it (docs/security/codegen.md,
 * CG-4). `willReturn` starts true and only a callee that does not return
 * clears it, so a cycle would otherwise keep it however deep it goes, and
 * LangRef's `willreturn` promises the call comes back: `spin(x)` calling
 * itself with the same `x` was `willreturn readnone` and `opt -O2` deleted the
 * call. Nothing here tries to prove that a recursion ends, which is the line
 * LLVM's own FunctionAttrs draws, and the fixpoint then carries the loss to
 * every caller.
 */
const clearRecursiveWillReturn = (facts: FactsTable): void => {
  const walk = new CycleWalk()
  for (const f of facts.list) {
    if (f.cycleOrder === 0) {
      visitCycles(walk, facts, f)
    }
  }
}

/**
 * The call graph `propagate` works over, built once per table so no pass
 * hashes a symbol. A function's callees are one flat run, `calleeStart[i]` up
 * to `calleeStart[i + 1]` for the function at index i of `FactsTable.list`,
 * each with its facts (`null` for a runtime or unknown symbol), its runtime
 * entry, its name and whether the caller hands it a receiver whole
 * (`FunctionFacts.wholeCallees`). Every other name a visit reads is resolved
 * onto the record that holds it: `ArgEdge.target`, `CallSite.target`,
 * `PointerParamFacts.passedToFacts`, `DirtMark.ctorFacts` and
 * `ValueDesc.ctorFacts`.
 *
 * `callers` is each of those reads turned round, once per pair: the functions
 * whose visit reads the facts of the function at index g are
 * `callers[callerStart[g]]` up to `callerStart[g + 1]`. A read missing from it
 * is one the worklist would not revisit on, which is what
 * `NISH_CHECK_PROPAGATE` is there to catch (`checkPropagate`).
 */
class FactGraph {
  calleeStart: i32[]
  calleeFacts: (FunctionFacts | null)[]
  calleeRuntime: (RuntimeFunction | null)[]
  calleeName: string[]
  calleeWhole: boolean[]
  callerStart: i32[]
  callers: i32[]

  constructor() {
    this.calleeStart = []
    this.calleeFacts = []
    this.calleeRuntime = []
    this.calleeName = []
    this.calleeWhole = []
    this.callerStart = []
    this.callers = []
  }
}

/**
 * Resolves the names one function's visit reads (`resolve`) and keeps each
 * function it reads once, as a (reader, read) pair `buildFactGraph` turns
 * round. `seen[g]` is the last reader that recorded g.
 */
class GraphReads {
  facts: FactsTable
  reader: i32
  seen: i32[]
  from: i32[]
  to: i32[]

  constructor(facts: FactsTable) {
    this.facts = facts
    this.reader = -1
    this.seen = []
    this.from = []
    this.to = []
    while (this.seen.length < facts.list.length) {
      this.seen.push(-1)
    }
  }

  /** The facts of `name`, or `null`; the reader now depends on them. */
  resolve(name: string): FunctionFacts | null {
    const g = this.facts.indexOf(name)
    if (g < 0 || g >= this.facts.list.length || g >= this.seen.length) {
      return null
    }
    if (this.seen[g] !== this.reader) {
      this.seen[g] = this.reader
      this.from.push(this.reader)
      this.to.push(g)
    }
    return this.facts.list[g]
  }

  /** `value.ctors` resolved into `value.ctorFacts`. */
  resolveValue(value: ValueDesc): void {
    value.ctorFacts = []
    for (const name of value.ctors) {
      value.ctorFacts.push(this.resolve(name))
    }
  }
}

/** Build `facts`' `FactGraph`, resolving every name `visitFacts` reads; see `FactGraph`. */
const buildFactGraph = (facts: FactsTable, runtime: RuntimeTable): FactGraph => {
  const graph = new FactGraph()
  const reads = new GraphReads(facts)
  let fi = 0
  for (const f of facts.list) {
    reads.reader = fi
    graph.calleeStart.push(graph.calleeName.length)
    let c = 0
    while (c < f.callees.size()) {
      const name = f.callees.at(c)
      graph.calleeFacts.push(reads.resolve(name))
      graph.calleeRuntime.push(runtime.lookup(name))
      graph.calleeName.push(name)
      graph.calleeWhole.push(f.wholeCallees.has(name))
      c = c + 1
    }
    for (const site of f.callSites) {
      site.target = reads.resolve(site.callee)
    }
    for (const pp of f.pointerParams) {
      pp.passedToFacts = []
      for (const name of pp.passedToCallees) {
        pp.passedToFacts.push(reads.resolve(name))
      }
    }
    for (const edge of f.argEdges) {
      edge.target = reads.resolve(edge.callee)
    }
    for (const edge of f.wholeReaches) {
      edge.target = reads.resolve(edge.callee)
    }
    for (const d of f.dirt) {
      d.ctorFacts = d.ctor.length > 0 ? reads.resolve(d.ctor) : null
      const value = d.value
      if (value !== null) {
        reads.resolveValue(value)
      }
      for (const arg of d.args) {
        reads.resolveValue(arg)
      }
    }
    for (const store of f.paramStores) {
      reads.resolveValue(store.value)
    }
    fi = fi + 1
  }
  graph.calleeStart.push(graph.calleeName.length)
  // The pairs turned round, grouped by the function read.
  const counts: i32[] = []
  while (counts.length < facts.list.length) {
    counts.push(0)
  }
  for (const g of reads.to) {
    if (g >= 0 && g < counts.length) {
      counts[g] = counts[g] + 1
    }
  }
  const next: i32[] = []
  let total = 0
  for (const count of counts) {
    graph.callerStart.push(total)
    next.push(total)
    total = total + count
  }
  graph.callerStart.push(total)
  while (graph.callers.length < total) {
    graph.callers.push(0)
  }
  let k = 0
  while (k < reads.to.length && k < reads.from.length) {
    const g = reads.to[k]
    if (g >= 0 && g < next.length) {
      const at = next[g]
      next[g] = at + 1
      if (at >= 0 && at < graph.callers.length) {
        graph.callers[at] = reads.from[k]
      }
    }
    k = k + 1
  }
  return graph
}

/**
 * Propagate effects, termination, pointer facts and allocation facts to a fixpoint.
 *
 * The answer is the one whole passes over `facts.list` in order, until a pass
 * changes nothing, would give, and is reached the same way: a pass visits, in
 * list order, only the functions marked since their last visit. A visit
 * (`visitFacts`) that changes a function marks it and every function that
 * reads it (`FactGraph.callers`); one at or before the visit's own index waits
 * for the next pass, one after it comes in this one, which is where a whole
 * pass would reach it. A function nothing marked would change nothing, so the
 * visits that do change something are the whole passes' own, in their order.
 * That order is part of the answer: `writeSite` names the own-slot store that
 * first set `writesElsewhere`, and another order could reach a different one.
 * `NISH_CHECK_PROPAGATE` checks the result twice: one more whole pass must
 * change nothing (`checkSettled`), and whole passes run from the start must
 * agree (`checkPropagate`).
 */
const propagate = (facts: FactsTable, runtime: RuntimeTable): void => {
  clearRecursiveWillReturn(facts)
  const graph = buildFactGraph(facts, runtime)
  const list = facts.list
  const marked: boolean[] = []
  while (marked.length < list.length) {
    marked.push(true)
  }
  let again = true
  while (again) {
    again = false
    let i = 0
    while (i < list.length && i < marked.length) {
      if (marked[i]) {
        marked[i] = false
        // The visit is a call, which ends what the loop bound proved about
        // `i`, so the write after it tests the bound again.
        if (visitFacts(graph, i, list[i]) && i < marked.length) {
          marked[i] = true
          again = true
          let r = i + 1 < graph.callerStart.length ? graph.callerStart[i] : 0
          const end = i + 1 < graph.callerStart.length ? graph.callerStart[i + 1] : 0
          while (r >= 0 && r < end && r < graph.callers.length) {
            const ci = graph.callers[r]
            if (ci >= 0 && ci < marked.length) {
              marked[ci] = true
            }
            r = r + 1
          }
        }
      }
      i = i + 1
    }
  }
  if (checkingPropagate()) {
    checkSettled(graph, list)
  }
  nameWriteVia(graph, list)
}

/**
 * `NISH_CHECK_PROPAGATE`'s first test: one more whole pass over what the
 * worklist settled must change nothing. `visitFacts` reports a move of any
 * fact it settles, so this sees an incomplete fixpoint in every field; a
 * function that moves stops the compile with an internal error naming it.
 */
const checkSettled = (graph: FactGraph, list: FunctionFacts[]): void => {
  let i = 0
  for (const f of list) {
    if (visitFacts(graph, i, f)) {
      process.exit(
        internalError(
          `propagate: \`${f.sourceName}\` moved on one more whole pass over the settled facts (NISH_CHECK_PROPAGATE)`
        )
      )
    }
    i = i + 1
  }
}

/**
 * The answer `propagate` reproduces, the slow way: whole passes over
 * `facts.list` in order, every function visited on each, until a pass changes
 * nothing. Only `checkPropagate` runs it.
 */
const propagateWhole = (facts: FactsTable, runtime: RuntimeTable): void => {
  clearRecursiveWillReturn(facts)
  const graph = buildFactGraph(facts, runtime)
  const list = facts.list
  let again = true
  while (again) {
    again = false
    let i = 0
    for (const f of list) {
      if (visitFacts(graph, i, f)) {
        again = true
      }
      i = i + 1
    }
  }
  nameWriteVia(graph, list)
}

/** Whether `a` and `b` name the same store, or both none (`checkPropagate`). */
const sameSite = (a: Node | null, b: Node | null): boolean => {
  if (a === null || b === null) {
    return a === null && b === null
  }
  return a === b
}

/** Whether `f` and `g` say the same of every pointer parameter (`checkPropagate`). */
const sameParams = (f: FunctionFacts, g: FunctionFacts): boolean => {
  if (f.pointerParams.length !== g.pointerParams.length) {
    return false
  }
  let i = 0
  while (i < f.pointerParams.length && i < g.pointerParams.length) {
    const a = f.pointerParams[i]
    const b = g.pointerParams[i]
    if (
      a.name !== b.name ||
      a.writesThrough !== b.writesThrough ||
      a.writesShared !== b.writesShared ||
      a.captured !== b.captured ||
      a.outlives !== b.outlives ||
      a.writesReach !== b.writesReach ||
      a.writesDeep !== b.writesDeep ||
      a.keptInThis !== b.keptInThis ||
      a.polluted !== b.polluted ||
      a.elementsFree !== b.elementsFree
    ) {
      return false
    }
    i = i + 1
  }
  return true
}

/** Whether `NISH_CHECK_PROPAGATE` is set to anything (`checkPropagate`). */
const checkingPropagate = (): boolean => {
  const flag: string | null = getenv("NISH_CHECK_PROPAGATE")
  return flag !== null && flag.length > 0
}

/**
 * `NISH_CHECK_PROPAGATE`'s second test (`checkSettled` is the first):
 * `fresh`, the same table collected
 * again, is settled by whole passes (`propagateWhole`), and every function of
 * `facts`, which the worklist settled, must agree with it: its attributes,
 * its pointer parameters, the shared-write flags, and the `writeSite` and
 * `writeVia` it names. A difference means a read is missing from
 * `FactGraph.callers`, or the worklist's visits left round-robin order.
 * `writeSite` is first-come, so either can move it with every flag still
 * right, and one more pass over the settled table would change nothing: only
 * a run from the start sees it. The compile then stops with an internal error
 * naming the function and what differs; when every function agrees it says
 * so on stderr, which is how a test knows the check ran. Unset, nothing is
 * collected twice.
 */
const checkPropagate = (facts: FactsTable, fresh: FactsTable, runtime: RuntimeTable): void => {
  // `fresh` shares its `CallSite`s with `facts` (`collectRound` hands both
  // `memory.callSites`), so this rewrites `site.target`; nothing reads it after.
  propagateWhole(fresh, runtime)
  if (fresh.list.length !== facts.list.length) {
    process.exit(internalError("propagate: the table collected again differs (NISH_CHECK_PROPAGATE)"))
  }
  let i = 0
  while (i < facts.list.length && i < fresh.list.length) {
    const f = facts.list[i]
    const what = differsFrom(f, fresh.list[i])
    if (what.length > 0) {
      process.exit(
        internalError(
          `propagate: \`${f.sourceName}\`'s ${what} differs from whole passes' (NISH_CHECK_PROPAGATE)`
        )
      )
    }
    i = i + 1
  }
  console.error(`propagate: ${facts.list.length} functions agree with whole passes (NISH_CHECK_PROPAGATE)`)
}

/** What `f`, settled by the worklist, says that `g`, settled by whole passes, does not; `""` when they agree (`checkPropagate`). */
const differsFrom = (f: FunctionFacts, g: FunctionFacts): string => {
  if (f.sourceName !== g.sourceName) {
    return "name"
  }
  if (!sameSite(f.writeSite, g.writeSite)) {
    return "writeSite"
  }
  if (f.writeVia !== g.writeVia) {
    return "writeVia"
  }
  if (
    f.sharedWrite !== g.sharedWrite ||
    f.writesPastParams !== g.writesPastParams ||
    f.writesElsewhere !== g.writesElsewhere
  ) {
    return "shared-write flags"
  }
  if (functionAttributes(f).join(" ") !== functionAttributes(g).join(" ")) {
    return "attributes"
  }
  if (!sameParams(f, g)) {
    return "pointer parameters"
  }
  if (f.leaksItself !== g.leaksItself) {
    return "leaksItself"
  }
  return ""
}

/** One visit of `f`, the function at index `fi`, against what everything it reads now says; answers whether anything about `f` moved. */
const visitFacts = (graph: FactGraph, fi: i32, f: FunctionFacts): boolean => {
  let changed = false
  let c = fi < graph.calleeStart.length ? graph.calleeStart[fi] : 0
  const end = fi + 1 < graph.calleeStart.length ? graph.calleeStart[fi + 1] : 0
  // `buildFactGraph` pushes the four callee arrays together, so they are one
  // length; the tests against each are what proves every access in range.
  while (c >= 0 && c < end && c < graph.calleeFacts.length && c < graph.calleeRuntime.length) {
    if (c < graph.calleeName.length && c < graph.calleeWhole.length) {
      const callee = graph.calleeName[c]
      if (propagateCallee(f, graph.calleeFacts[c], graph.calleeRuntime[c], callee, graph.calleeWhole[c])) {
        changed = true
      }
    }
    c = c + 1
  }
  if (composeArguments(f)) {
    changed = true
  }
  if (settleKeeps(f)) {
    changed = true
  }
  // A pointer-returning callee that allocates makes its result an allocation of this function.
  for (const site of f.callSites) {
    const callee = site.target
    if (callee === null || !callee.allocates) {
      continue
    }
    if (site.escapes && !f.allocEscapes) {
      // WP9: this function stored the callee's result where its own caller can reach it.
      f.allocEscapes = true
      changed = true
    }
    if (site.flow === FLOW_LOCAL && !f.directArena) {
      f.directArena = true
      changed = true
    } else if (site.flow === FLOW_RETURNED && !f.returnsAllocation) {
      f.returnsAllocation = true
      changed = true
    } else if (site.flow === FLOW_LEAKS) {
      f.leaksItself = true
      if (!f.allocLeaks) {
        f.allocLeaks = true
        changed = true
      }
    }
  }
  // A pointer inherits what every callee it is passed to does with the
  // corresponding parameter. An unknown callee is assumed to do both.
  for (const pp of f.pointerParams) {
    let i = 0
    while (i < pp.passedToFacts.length && i < pp.passedToIndices.length) {
      const g = pp.passedToFacts[i]
      let writes = true
      let shared = true
      let captures = true
      let outlives = true
      let reach = true
      let deep = true
      if (g !== null) {
        const target = g.pointerParamAt(pp.passedToIndices[i])
        if (target !== null) {
          writes = target.writesThrough
          shared = target.writesShared
          captures = target.captured
          outlives = target.outlives
          reach = target.writesReach
          deep = target.writesDeep
        }
      }
      // A routed instance (`markMapRoute`) has no body whose argument
      // edges carry how far its routed callees write: this is the only
      // path that reaches it by. A body's own edges carry it already
      // (`callWrites`), and more narrowly. `polluted` is not carried:
      // the routed table code is type-erased, so it would call a map of
      // numbers dirty.
      if (f.routed && reach && !pp.writesReach) {
        pp.writesReach = true
        changed = true
      }
      if (f.routed && deep && !pp.writesDeep) {
        pp.writesDeep = true
        changed = true
      }
      if (writes && !pp.writesThrough) {
        pp.writesThrough = true
        changed = true
      }
      if (shared && !pp.writesShared) {
        pp.writesShared = true
        changed = true
      }
      if (captures && !pp.captured) {
        pp.captured = true
        changed = true
      }
      if (outlives && !pp.outlives) {
        pp.outlives = true
        changed = true
      }
      i = i + 1
    }
  }
  return changed
}

/**
 * One caller/callee edge, the callee's facts and runtime entry already looked
 * up (`FactGraph`), and `whole` when `f` hands it a receiver whole; answers
 * whether anything about the caller moved.
 */
const propagateCallee = (
  f: FunctionFacts,
  calleeFacts: FunctionFacts | null,
  rt: RuntimeFunction | null,
  callee: string,
  whole: boolean
): boolean => {
  let changed = false
  // The inline arena allocator is not in the runtime table (it is emitted as
  // an IR definition), but callers must still see it as a writing, willreturn
  // callee.
  const isAllocator = callee === "nish_alloc_struct"
  let calleeEffect = EFFECT_WRITE
  let calleeReturns = false
  let calleeNoReturn = false
  if (calleeFacts !== null) {
    calleeEffect = calleeFacts.effect
    calleeReturns = calleeFacts.willReturn
    calleeNoReturn = calleeFacts.callsNoReturn
  } else if (isAllocator) {
    calleeEffect = EFFECT_WRITE
    calleeReturns = hasAttr(inlineAllocatorAttrs(), "willreturn")
  } else if (rt !== null) {
    calleeEffect = rt.effect
    calleeReturns = hasAttr(rt.attrs, "willreturn")
    calleeNoReturn = rt.noreturn
  }
  if (!f.writesElsewhere && writesShared(f, calleeFacts, rt, callee, whole) && markPastWrite(f, true)) {
    changed = true
  }
  const merged = maxEffect(f.effect, calleeEffect)
  if (merged !== f.effect) {
    f.effect = merged
    changed = true
  }
  if (f.willReturn && !calleeReturns) {
    f.willReturn = false
    changed = true
  }
  if (calleeNoReturn && !f.callsNoReturn) {
    f.callsNoReturn = true
    f.willReturn = false
    changed = true
  }
  if (calleeFacts !== null) {
    // WP6: allocation facts flow up the call graph (see escape.ts).
    if (calleeFacts.allocates && !f.allocates) {
      f.allocates = true
      changed = true
    }
    if (calleeFacts.allocLeaks && !f.allocLeaks) {
      f.allocLeaks = true
      changed = true
    }
    // WP9: whatever a callee lets out of its own frame is out of this one too.
    if (calleeFacts.allocEscapes && !f.allocEscapes) {
      f.allocEscapes = true
      changed = true
    }
    // WP15 section 2c: growing an array is a property of the whole closure,
    // the same way allocation is -- a caller that pushes nothing still moves a
    // header when the callee it invokes does.
    if (calleeFacts.resizesArray && !f.resizesArray) {
      f.resizesArray = true
      changed = true
    }
    if (calleeFacts.readsArenaState && !f.readsArenaState) {
      f.readsArenaState = true
      changed = true
    }
    if (calleeFacts.opensArena && !f.opensArena) {
      f.opensArena = true
      changed = true
    }
    if (calleeFacts.usesRegion && !f.usesRegion) {
      f.usesRegion = true
      changed = true
    }
    if (calleeFacts.feedsTasks && !f.feedsTasks) {
      f.feedsTasks = true
      changed = true
    }
  }
  return changed
}

const hasAttr = (attrs: string[], name: string): boolean => attrs.indexOf(name) >= 0

/**
 * WP35: carry every function's capabilities to its callers, over the edges
 * round 2's walk recorded, until nothing moves (docs/wp35-capabilities.md
 * §3). A caller reaches what each callee reaches, one call further away, and
 * keeps the shortest chain per capability (`offerCapability`).
 *
 * It is a relaxation of its own rather than more of `propagateCallee`: no
 * attribute reads a capability, so the attribute fixpoint converges exactly
 * as it did, and a witness needs each edge's call site, which `callees` -- a
 * set of symbols -- does not keep.
 *
 * A worklist over the edges turned round, rather than whole passes over the
 * program until one changes nothing: only a function whose witnesses just
 * moved can move its callers', and on `src/` the passes cost three times what
 * this does. The order the list is worked in cannot change the answer. A
 * callee's offers only ever get shorter, so the smallest offer a caller holds
 * at the end is the smallest of the callees' final ones, and that minimum is
 * one value whichever order it was reached in. It terminates because a bit is
 * only ever set and a witness only ever replaced by a shorter or earlier one.
 */
const propagateCapabilities = (facts: FactsTable): void => {
  const list = facts.list
  // The edges turned round, as one flat list grouped by callee: the callers of
  // the function at index g are `fromFn[starts[g]]` up to `ends[g]`, and
  // `fromEdge` is the edge's index in that caller's `capCallees`.
  const calleeAt: i32[] = []
  const counts: i32[] = []
  while (counts.length < list.length) {
    counts.push(0)
  }
  for (const f of list) {
    for (const callee of f.capCallees) {
      const g = facts.indexOf(callee)
      calleeAt.push(g)
      if (g >= 0 && g < counts.length) {
        counts[g] = counts[g] + 1
      }
    }
  }
  const starts: i32[] = []
  const ends: i32[] = []
  let total = 0
  for (const count of counts) {
    starts.push(total)
    total = total + count
    ends.push(total)
  }
  const next: i32[] = []
  for (const start of starts) {
    next.push(start)
  }
  const fromFn: i32[] = []
  const fromEdge: i32[] = []
  let slot = 0
  while (slot < total) {
    fromFn.push(0)
    fromEdge.push(0)
    slot = slot + 1
  }
  let k = 0
  let fi = 0
  for (const f of list) {
    let e = 0
    while (e < f.capCallees.length && k < calleeAt.length) {
      const g = calleeAt[k]
      if (g >= 0 && g < next.length) {
        const at = next[g]
        next[g] = at + 1
        if (at >= 0 && at < fromFn.length && at < fromEdge.length) {
          fromFn[at] = fi
          fromEdge[at] = e
        }
      }
      e = e + 1
      k = k + 1
    }
    fi = fi + 1
  }
  // Every function that reaches something starts on the list.
  const queue: i32[] = []
  const queued: boolean[] = []
  let i = 0
  for (const f of list) {
    const seeded = f.caps !== 0
    queued.push(seeded)
    if (seeded) {
      queue.push(i)
    }
    i = i + 1
  }
  let head = 0
  while (head < queue.length) {
    const gi = queue[head]
    head = head + 1
    if (gi < 0 || gi >= list.length || gi >= queued.length || gi >= starts.length || gi >= ends.length) {
      continue
    }
    queued[gi] = false
    const g = list[gi]
    let r = starts[gi]
    const end = ends[gi]
    while (r >= 0 && r < end && r < fromFn.length && r < fromEdge.length) {
      const ci = fromFn[r]
      const e = fromEdge[r]
      // The call ends what a guard before it proved, so `queued` is guarded after it.
      if (ci >= 0 && ci < list.length && relaxEdge(list[ci], e, g)) {
        if (ci < queued.length && !queued[ci]) {
          queued[ci] = true
          queue.push(ci)
        }
      }
      r = r + 1
    }
  }
}

/** Offer each of `g`'s capabilities to `f` along `f`'s edge `e`; answers whether any witness of `f`'s moved. */
const relaxEdge = (f: FunctionFacts, e: i32, g: FunctionFacts): boolean => {
  if (e < 0 || e >= f.capCallees.length || e >= f.capSites.length) {
    return false
  }
  let moved = false
  let c = 0
  while (c < CAPABILITY_COUNT && c < g.capDist.length) {
    if ((g.caps & (1 << c)) !== 0 && f.offerCapability(c, f.capCallees[e], f.capSites[e], g.capDist[c] + 1)) {
      moved = true
    }
    c = c + 1
  }
  return moved
}

/**
 * WP29 P1: calling `callee` from `f`, whose facts and runtime entry the caller
 * has already looked up, writes shared memory whatever `f` hands it, `whole`
 * when `f` hands it a receiver whole (`FunctionFacts.wholeCallees`). An
 * unknown callee is assumed to, as it is assumed to write at all. A user
 * callee whose arguments `f` records answers only for what it writes past its
 * parameters (`FunctionFacts.writesPastParams`); `composeArguments` answers
 * for the rest.
 */
const writesShared = (
  f: FunctionFacts,
  calleeFacts: FunctionFacts | null,
  rt: RuntimeFunction | null,
  callee: string,
  whole: boolean
): boolean => {
  if (calleeFacts !== null) {
    return whole ? calleeFacts.sharedWrite : calleeFacts.writesElsewhere
  }
  if (callee === "nish_alloc_struct") {
    return false // the inline arena allocator; see `FunctionFacts.sharedWrite`
  }
  if (callee === WIPE_MEMSET) {
    return false // only a `wipe` calls it, into its target's bytes; see `markWipe`
  }
  if ((callee === "nish_write" || callee === "nish_exit") && !f.writesOutput) {
    return false // only a panic's tail (`FunctionFacts.writesOutput`)
  }
  return rt === null || rt.sharedWrite()
}

/**
 * Whether `g`, called with an argument as its parameter `index`, writes
 * shared memory through it: it writes through that parameter, and the write
 * is one `sharedWrite` counts (a `send`, a lock, a guarded store are not). An
 * unknown callee is assumed to.
 */
const writesArgument = (g: FunctionFacts | null, index: i32): boolean => {
  if (g === null) {
    return true
  }
  const target = g.pointerParamAt(index)
  return g.sharedWrite && target !== null && target.writesShared
}

/** Whether `g` may keep an array it is handed as its parameter `index`. An unknown callee is assumed to. */
const keepsArgument = (g: FunctionFacts | null, index: i32): boolean => {
  if (g === null) {
    return true
  }
  const target = g.pointerParamAt(index)
  return target === null || target.captured
}

/** Mark the parameter `name` as written in `f` (`PointerParamFacts.writesReach`), `deep` past its own slots; answers whether that moved anything. */
const markParam = (f: FunctionFacts, name: string, deep: boolean): boolean => {
  const pp = f.pointerParam(name)
  if (pp === null) {
    return false
  }
  let changed = false
  if (!pp.writesReach) {
    pp.writesReach = true
    changed = true
  }
  if (deep && !pp.writesDeep) {
    pp.writesDeep = true
    changed = true
  }
  return changed
}

/** Mark every pointer parameter of `f` as written, past its own slots: a write that may land anywhere. */
const markAll = (f: FunctionFacts): boolean => {
  let changed = false
  for (const pp of f.pointerParams) {
    if (markParam(f, pp.name, true)) {
      changed = true
    }
  }
  return changed
}

/**
 * Whether `steps` starts with `prefix`, at a step boundary: equal, or followed
 * by the next `.f` or `[]`. `strict` asks for a step more. Compares codes, so
 * a fixpoint pass allocates nothing.
 */
const stepsUnder = (prefix: string, steps: string, strict: boolean): boolean => {
  if (steps.length < prefix.length) {
    return false
  }
  let i = 0
  while (i < prefix.length && i < steps.length) {
    if (prefix.charCodeAt(i) !== steps.charCodeAt(i)) {
      return false
    }
    i = i + 1
  }
  if (steps.length === prefix.length) {
    return !strict
  }
  const next = steps.charCodeAt(prefix.length)
  return next === 46 || next === 91 // `.` or `[`
}

/**
 * A write into the object at `steps` below the object `root` of `f`'s own,
 * and below it too when `below`: mark what the active `DirtMark`s over it say
 * the memory may be. Memory no mark covers is `f`'s own, and marks nothing.
 */
const markForeign = (f: FunctionFacts, root: string, steps: string, below: boolean): boolean => {
  let changed = false
  for (const d of f.dirt) {
    if (!d.active || d.root !== root) {
      continue
    }
    const over = stepsUnder(d.steps, steps, d.below)
    const under = below && stepsUnder(steps, d.steps, false)
    if (!over && !under) {
      continue
    }
    if (d.unknown) {
      if (markAll(f)) {
        changed = true
      }
      continue
    }
    for (const name of d.params) {
      if (markParam(f, name, true)) {
        changed = true
      }
    }
  }
  return changed
}

/**
 * Whether a write into `steps` of `f`'s own object `root`, `below` past those
 * slots too, may land in memory a parameter reaches or in memory of unknown
 * origin: the question `markForeign` answers by marking, asked without marking.
 */
const reachesForeign = (f: FunctionFacts, root: string, steps: string, below: boolean): boolean => {
  for (const d of f.dirt) {
    if (!d.active || d.root !== root) {
      continue
    }
    const over = stepsUnder(d.steps, steps, d.below)
    const under = below && stepsUnder(steps, d.steps, false)
    if ((over || under) && (d.unknown || d.params.length > 0)) {
      return true
    }
  }
  return false
}

/** A write into what `path` names, `deep` past its own slots, made by `f` or by a callee it hands `path` to. */
const markPath = (f: FunctionFacts, path: MemPath, deep: boolean): boolean => {
  if (path.kind === ROOT_PARAM) {
    return markParam(f, path.name, deep || path.steps.length > 0)
  }
  if (path.kind === ROOT_UNKNOWN) {
    return markAll(f)
  }
  if (path.kind === ROOT_OWN) {
    return markForeign(f, path.name, path.steps, deep)
  }
  return false
}

/** Whether `value` is clean as `f` now sees it: no parameter's memory, nothing of unknown origin. */
const valueClean = (f: FunctionFacts, value: ValueDesc): boolean =>
  value.params.length === 0 && !valueUnknown(f, value)

/** Mark the parameter `name` of `f` as polluted, or every pointer parameter when `name` is ""; answers whether that moved anything. */
const polluteName = (f: FunctionFacts, name: string): boolean => {
  let changed = false
  for (const pp of f.pointerParams) {
    if ((name.length === 0 || pp.name === name) && !pp.polluted) {
      pp.polluted = true
      changed = true
    }
  }
  return changed
}

/** A callee may store memory not the caller's into what `path` names: pollute the parameter it is rooted at, or every one for an unknown root. */
const pollutePath = (f: FunctionFacts, path: MemPath): boolean => {
  if (path.kind === ROOT_PARAM) {
    return polluteName(f, path.name)
  }
  if (path.kind === ROOT_UNKNOWN) {
    return polluteName(f, "")
  }
  return false
}

/**
 * The table a fused `Map` or `Set` call works on: the receiver of a method
 * call, or the first argument of a `nish/map` route such as `getOrInsert(m, k, v)`.
 */
const tableReceiver = (program: CheckedProgram, call: Node): Node | null => {
  const receiver = methodReceiver(call)
  if (receiver !== null) {
    return receiver
  }
  const sig = program.nodeCallees[call.id]
  const args = call.children[1].children
  return sig !== null && isMapRoute(sig) && args.length > 0 ? args[0] : null
}

/**
 * Whether a table call keeps what it is handed: a `Map`'s `set` its key and
 * value, a `Set`'s `add` its element, and `getOrInsert` from `nish/map` its
 * key and default. A lookup — `has`, `get`, `delete` — keeps nothing.
 */
const keepsArguments = (program: CheckedProgram, call: Node): boolean => {
  const callee = program.nodeCallees[call.id]
  if (callee === null) {
    return true
  }
  if (isMapRoute(callee)) {
    return mapIntrinsicOf(callee) === MAP_GET_OR_INSERT
  }
  const owner = callee.owner
  if (owner === null || !isCollectionStruct(owner)) {
    return true
  }
  const set = owner.method("set")
  const add = owner.method("add")
  return (set !== null && set === callee) || (add !== null && add === callee)
}

/** The table a walk of `iterable` reads: the receiver of `m.keys()` or `m.values()`, or `iterable` itself. */
const walkTable = (iterable: Node): Node => {
  const e = unwrapParens(iterable)
  const receiver = methodReceiver(e)
  return receiver === null ? e : receiver
}

/** Whether `f` has an active `DirtMark` on its object `key`. */
const isDirty = (f: FunctionFacts, key: string): boolean => {
  for (const d of f.dirt) {
    if (d.active && d.root === key) {
      return true
    }
  }
  return false
}

/** Whether a constructor in `ctors` (`ValueDesc.ctorFacts`) may keep anything, or is unknown. */
const keepsAnything = (ctors: (FunctionFacts | null)[]): boolean => {
  for (const g of ctors) {
    if (g === null || g.keepsUnknown) {
      return true
    }
  }
  return false
}

/** Whether `value`, as `f` sees it now, may be memory of unknown origin: an object of `f`'s own that is dirty, or a constructor that keeps anything. */
const valueUnknown = (f: FunctionFacts, value: ValueDesc): boolean => {
  if (value.unknown || keepsAnything(value.ctorFacts)) {
    return true
  }
  for (const key of value.owns) {
    if (isDirty(f, key)) {
      return true
    }
  }
  return false
}

/** Set `d`'s `active` and `unknown` from what `f`'s callees and objects now say (`DirtMark`); answers whether anything moved. */
const settleDirt = (f: FunctionFacts, d: DirtMark): boolean => {
  let active = d.active
  let unknown = d.unknown
  const value = d.value
  if (d.kind === DIRT_STORE && value !== null) {
    unknown = unknown || valueUnknown(f, value)
    active = active || unknown || value.params.length > 0
  } else if (d.kind === DIRT_INIT) {
    const g = d.ctorFacts
    if (g === null || g.keepsUnknown) {
      active = true
      unknown = true
    } else {
      let i = 0
      for (const arg of d.args) {
        i = i + 1 // the constructor's parameter 0 is `this`
        const kept = g.pointerParamAt(i)
        if (kept !== null && kept.keptInThis) {
          const vague = valueUnknown(f, arg)
          if (vague || arg.params.length > 0) {
            active = true
          }
          unknown = unknown || vague
        }
      }
    }
  }
  if (active === d.active && unknown === d.unknown) {
    return false
  }
  d.active = active
  d.unknown = unknown
  return true
}

/** Mark `f` as writing shared memory past its parameters, and `elsewhere` than below them (`writesElsewhere`); answers whether that moved anything. */
const markPastWrite = (f: FunctionFacts, elsewhere: boolean): boolean => {
  if (f.writesPastParams && (f.writesElsewhere || !elsewhere)) {
    return false
  }
  f.sharedWrite = true
  f.writesPastParams = true
  f.writesElsewhere = f.writesElsewhere || elsewhere
  return true
}

const PAST_NONE: i32 = 0
const PAST_BELOW: i32 = 1 // below one of the caller's own parameters
const PAST_ELSEWHERE: i32 = 2

/**
 * The past write the call along `edge` makes its caller when the callee
 * writes below its parameters (`writesElsewhere` clear): none when it writes
 * nothing through the one it is handed, none for an object
 * of the caller's own whose memory below it no parameter reaches, below the
 * caller's parameter for memory rooted at one, and anywhere otherwise. A
 * private array is taken as anywhere, as it was before the distinction.
 */
const pastBelow = (f: FunctionFacts, edge: ArgEdge): i32 => {
  const g = edge.target
  // A table's receiver, taken whole (`wholeReaches`), is its `this`.
  const index = edge.index < 0 ? 0 : edge.index
  // Every write to or below a parameter marks it `writesReach`, or
  // `writesThrough` for an escape: a callee writes below the one it is handed
  // only when that one is marked.
  const target: PointerParamFacts | null = g === null ? null : g.pointerParamAt(index)
  if (g === null || !g.writesPastParams || g.writesElsewhere || target === null) {
    return PAST_NONE
  }
  if (!target.writesReach && !target.writesThrough) {
    return PAST_NONE
  }
  if (edge.owner !== null) {
    return PAST_ELSEWHERE
  }
  if (edge.path.kind === ROOT_OWN) {
    return reachesForeign(f, edge.path.name, edge.path.steps, true) ? PAST_ELSEWHERE : PAST_NONE
  }
  return edge.path.kind === ROOT_PARAM ? PAST_BELOW : PAST_ELSEWHERE
}

/** Whether the call along `edge` writes shared memory through its argument: one not private, that the callee writes. */
const edgeWrites = (edge: ArgEdge): boolean => !edge.isPrivate() && writesArgument(edge.target, edge.index)

/**
 * A callee writes what `edge` hands it, `deep` past its slots: the caller
 * writes what the argument names, and an argument of the caller's own may
 * hold anything from then on (`DIRT_CALL`).
 */
const callWrites = (f: FunctionFacts, edge: ArgEdge, deep: boolean): boolean => markPath(f, edge.path, deep)

/**
 * An object of the caller's own handed to a callee that keeps it: whatever
 * now holds it may put anything in it (`DIRT_CALL`). A function keeps what it
 * captures; a constructor what it stores into `this` (`keptInThis`), and when
 * that `new` initialises an object of the caller's own (`heldBy`), the
 * argument is only as clean as that object, so it is marked once the object
 * is dirty. Answers whether the mark moved.
 */
const keepsOwn = (f: FunctionFacts, edge: ArgEdge): boolean => {
  const mark = edge.dirt
  if (mark === null || mark.active) {
    return false
  }
  const g = edge.target
  const target: PointerParamFacts | null = g === null ? null : g.pointerParamAt(edge.index)
  // A callee that may store memory not the caller's into what it is handed.
  const polluted = g === null || target === null || target.polluted
  let keeps = polluted
  if (g !== null && target !== null) {
    const held = g.freshThis ? g.keepsUnknown || target.keptInThis : target.captured
    keeps = keeps || (held && (edge.heldBy.length === 0 || isDirty(f, edge.heldBy)))
  }
  if (!keeps) {
    return false
  }
  mark.active = true
  return true
}

/**
 * A constructor's summary from its active marks on `this`: each parameter
 * whose memory is stored into what `this` reaches (`keptInThis`), and whether
 * something of unknown origin is (`keepsUnknown`).
 */
const settleKeeps = (f: FunctionFacts): boolean => {
  if (!f.freshThis) {
    return false
  }
  let changed = false
  for (const d of f.dirt) {
    if (!d.active || d.root !== "this") {
      continue
    }
    if (d.unknown && !f.keepsUnknown) {
      f.keepsUnknown = true
      changed = true
    }
    for (const name of d.params) {
      const pp = f.pointerParam(name)
      if (pp !== null && !pp.keptInThis) {
        pp.keptInThis = true
        changed = true
      }
    }
  }
  return changed
}

/**
 * One function's arguments against what its callees now say they do
 * (`FunctionFacts.argEdges`); answers whether anything about it moved. A
 * private array a callee may keep is shared from then on: its first store
 * counts, and so does every callee that writes through it. A callee that
 * writes through an argument writes shared memory, past this function's
 * parameters unless the argument is one of them as it is, which then writes
 * through too. A change here is seen again on the fixpoint's next pass.
 */
const composeArguments = (f: FunctionFacts): boolean => {
  let changed = false
  for (const d of f.dirt) {
    if (settleDirt(f, d)) {
      changed = true
    }
  }
  for (const path of f.memWrites) {
    if (markPath(f, path, false)) {
      changed = true
    }
  }
  let w = 0
  while (w < f.ownSlotWrites.length) {
    const path = f.ownSlotWrites[w]
    if (reachesForeign(f, path.name, path.steps, false) && markPastWrite(f, true)) {
      if (f.writeSite === null) {
        f.writeSite = f.ownSlotSites[w]
      }
      changed = true
    }
    w = w + 1
  }
  for (const edge of f.wholeReaches) {
    // A table's method writes its receiver only when it writes through its
    // `this` (parameter 0): `has` and a fused `get`'s `probe` read it.
    const g = edge.target
    const self: PointerParamFacts | null = g === null ? null : g.pointerParamAt(0)
    const writes = g === null || (g.sharedWrite && (self === null || self.writesReach))
    if (writes && callWrites(f, edge, false)) {
      changed = true
    }
    const past = pastBelow(f, edge)
    if (past !== PAST_NONE && markPastWrite(f, past === PAST_ELSEWHERE)) {
      changed = true
    }
  }
  for (const store of f.paramStores) {
    if (!valueClean(f, store.value) && polluteName(f, store.name)) {
      changed = true
    }
  }
  for (const edge of f.argEdges) {
    if (keepsOwn(f, edge)) {
      changed = true
    }
    const past = pastBelow(f, edge)
    if (past !== PAST_NONE && markPastWrite(f, past === PAST_ELSEWHERE)) {
      changed = true
    }
  }
  for (const edge of f.argEdges) {
    // What the callee writes of the argument, the caller writes of what the argument reaches.
    const g = edge.target
    const target: PointerParamFacts | null = g === null ? null : g.pointerParamAt(edge.index)
    const reached = g === null || (target !== null && target.writesReach && g.sharedWrite)
    if (reached && callWrites(f, edge, target === null || target.writesDeep)) {
      changed = true
    }
    if (
      (g === null || target === null || target.polluted) &&
      edge.owner === null &&
      pollutePath(f, edge.path)
    ) {
      changed = true
    }
    const owner = edge.owner
    if (owner !== null && !owner.lost && keepsArgument(g, edge.index)) {
      owner.lost = true
      changed = true
      if (owner.site !== null && markPastWrite(f, true)) {
        changed = true
      }
    }
    if (!edgeWrites(edge)) {
      continue
    }
    // WP29: an object this call made itself (`ROOT_OWN`) is memory no caller,
    // thread or task can see while the call runs, as a private array is, so
    // `const r = new Rng(seed); r.nextI32()` writes nothing shared. But a
    // field or an element of it, or anything below its own slots, may be
    // memory a parameter reaches, or anything (`DirtMark`): `hs.push(box);
    // hs[0].bump()` writes `box`. Such a write is a shared one, as it would be
    // through the parameter itself, and not only a `writesReach` of it
    // (`callWrites`), which is all the parent's region rule reads.
    if (edge.path.kind === ROOT_OWN) {
      const deep = target === null || target.writesDeep
      if (reachesForeign(f, edge.path.name, edge.path.steps, deep) && markPastWrite(f, true)) {
        changed = true
      }
      continue
    }
    const pointer: PointerParamFacts | null = edge.param.length > 0 ? f.pointerParam(edge.param) : null
    if (pointer === null) {
      if (markPastWrite(f, edge.path.kind !== ROOT_PARAM)) {
        changed = true
      }
      continue
    }
    if (!f.sharedWrite) {
      f.sharedWrite = true
      changed = true
    }
    if (!pointer.writesThrough) {
      pointer.writesThrough = true
      changed = true
    }
    if (!pointer.writesShared) {
      pointer.writesShared = true
      changed = true
    }
  }
  return changed
}

/** Whether `f` hands `callee` an argument or a table it writes shared memory through (`composeArguments`). */
const writesAnArgument = (f: FunctionFacts, callee: string): boolean => {
  for (const edge of f.wholeReaches) {
    if (edge.callee === callee && pastBelow(f, edge) !== PAST_NONE) {
      return true
    }
  }
  for (const edge of f.argEdges) {
    // A capture's edge is to the arrow, which this function never calls: the
    // instance it called to hand the capture over is the one to name.
    const named = edge.callee === callee || edge.via === callee
    if (named && pastBelow(f, edge) !== PAST_NONE) {
      return true
    }
    if (!named || !edgeWrites(edge)) {
      continue
    }
    // An object of the caller's own is a shared write only where it may hold
    // memory that is not, as the fixpoint judges it: `h.poke()` on a fresh
    // `h` is not the write to name.
    if (edge.path.kind !== ROOT_OWN) {
      return true
    }
    const g = edge.target
    const target: PointerParamFacts | null = g === null ? null : g.pointerParamAt(edge.index)
    if (reachesForeign(f, edge.path.name, edge.path.steps, target === null || target.writesDeep)) {
      return true
    }
  }
  return false
}

/**
 * WP29 P1: `writeVia` for every function whose shared write is a callee's,
 * named once the fixpoint has settled. Naming it inside the loop would name
 * whichever callee the loop happened to reach first, and that order is the
 * whole program's function order, so one module would name different callees
 * depending on which entry point loaded it. Here it is the first callee in the
 * function's own call order: the order its body reaches them.
 */
const nameWriteVia = (graph: FactGraph, list: FunctionFacts[]): void => {
  let fi = -1
  for (const f of list) {
    fi = fi + 1
    if (!f.sharedWrite || f.writeSite !== null) {
      continue
    }
    // A private array a callee turned out to keep: its first store is the site.
    for (const owned of f.privateArrays) {
      const site = owned.site
      const first = f.writeSite
      if (owned.lost && site !== null && (first === null || site.start < first.start)) {
        f.writeSite = site
      }
    }
    if (f.writeSite !== null) {
      continue
    }
    let c = fi < graph.calleeStart.length ? graph.calleeStart[fi] : 0
    const end = fi + 1 < graph.calleeStart.length ? graph.calleeStart[fi + 1] : 0
    // The four callee arrays are one length (`buildFactGraph` pushes them
    // together); testing each is what proves every access in range.
    while (c >= 0 && c < end && f.writeVia.length === 0) {
      if (
        c < graph.calleeName.length &&
        c < graph.calleeFacts.length &&
        c < graph.calleeRuntime.length &&
        c < graph.calleeWhole.length
      ) {
        const callee = graph.calleeName[c]
        if (
          writesShared(f, graph.calleeFacts[c], graph.calleeRuntime[c], callee, graph.calleeWhole[c]) ||
          writesAnArgument(f, callee)
        ) {
          f.writeVia = callee
        }
      }
      c = c + 1
    }
  }
}

// ---- Counted loops ------------------------------------------------------------------------

const INT32_MAX: f64 = 2147483647.0

/**
 * True for `for (let i = <init>; i CMP bound; STEP) body` over i32 when the
 * trip count is finite by construction, which is what lets the enclosing
 * function keep `willreturn`. The rules, and the reasoning behind each, are in
 * stage0's `src/codegen/attributes.ts`; this is the same predicate over this tree.
 *
 * A `for...of` over an array is counted unless its body may extend the array.
 * Every other loop (`while`, `do`, other `for` shapes) is unbounded.
 */
const isCountedLoop = (
  unit: AnalysisUnit,
  table: TypeTable,
  loop: Node,
  known: FactsTable | null
): boolean => {
  const program = unit.program
  if (loop.kind === NodeKind.ForOf) {
    // WP32: a walk re-reads the entry count every pass, and a body that sets
    // a new key extends it forever, as JavaScript's does; it is never counted.
    if (program.nodeCallees[loop.id] !== null) {
      return false
    }
    return !bodyMayExtend(unit.program, table, loop.children[2], known)
  }
  if (loop.kind !== NodeKind.For) {
    return false
  }
  const init = loop.children[0]
  const condition = loop.children[1]
  const step = loop.children[2]
  if (init.kind !== NodeKind.Var || condition.kind === NodeKind.Empty || step.kind === NodeKind.Empty) {
    return false
  }
  const declarations = init.children[0]
  if (declarations.children.length !== 1) {
    return false
  }
  const iv = program.nodeLocals[declarations.children[0].id]
  if (iv === null || iv.type !== T_I32) {
    return false
  }

  const cond = unwrapParens(condition)
  if (cond.kind !== NodeKind.Binary || !isName(cond.children[0], iv.name)) {
    return false
  }
  const cmp = cond.text
  const upward = cmp === "<" || cmp === "<="
  const downward = cmp === ">" || cmp === ">="
  const inclusive = cmp === "<=" || cmp === ">="
  const bound = unwrapParens(cond.children[1])
  if (bound.kind !== NodeKind.Ident && bound.kind !== NodeKind.Number) {
    return false
  }

  const delta = stepOf(unwrapParens(step), iv.name)
  if (delta === 0) {
    return false
  }
  if (!((upward && delta > 0) || (downward && delta < 0))) {
    return false
  }

  if (bound.kind === NodeKind.Ident) {
    if (absOf(delta) !== 1 || inclusive) {
      return false
    }
  } else if (upward) {
    // In `f64`, as stage0's `src/` computes it: a bound past the i32 range must still
    // compare as out of range rather than wrapping into it.
    const written: f64 = numericLiteralValue(bound.text)
    const last: f64 = inclusive ? written : written - 1.0
    if (last + toF64(delta) > INT32_MAX) {
      return false
    }
  }
  // Downward from a non-negative literal bound: `bound - |step| >= -INT32_MAX`, so no wrap.

  const guarded: string[] = [iv.name]
  if (bound.kind === NodeKind.Ident) {
    guarded.push(bound.text)
  }
  return !bodyDisturbs(loop.children[3], guarded)
}

const absOf = (value: i32): i32 => (value < 0 ? -value : value)

const isName = (expr: Node, name: string): boolean => {
  const e = unwrapParens(expr)
  return e.kind === NodeKind.Ident && e.text === name
}

/** Signed step of `i++`, `++i`, `i--`, `--i`, `i += c`, `i -= c`; 0 for anything else. */
export const stepOf = (expr: Node, name: string): i32 => {
  if (expr.kind === NodeKind.Unary && isName(expr.children[0], name)) {
    if (expr.text === "++") {
      return 1
    }
    if (expr.text === "--") {
      return -1
    }
    return 0
  }
  if (expr.kind === NodeKind.Binary && isName(expr.children[0], name)) {
    const rhs = unwrapParens(expr.children[1])
    if (rhs.kind !== NodeKind.Number) {
      return 0
    }
    if (expr.text === "+=") {
      return toI32(numericLiteralValue(rhs.text))
    }
    if (expr.text === "-=") {
      return -toI32(numericLiteralValue(rhs.text))
    }
  }
  return 0
}

/**
 * `for (const x of a)` re-reads `a.length` every iteration, so it is bounded
 * unless the body can grow an array: any `push` or `pop`, a call that can grow
 * one, or a `throw`.
 *
 * `known` is the call-graph fixpoint's answer for the callees, or `null` when
 * there is not one yet. Without it every user call has to count as growing the
 * array, because a callee handed the same array may push through it -- which
 * is what this asked before `resizesArray` existed, and is still what round 1
 * asks, since the fixpoint has not run. With it the question is the one that
 * was always meant: does anything this body reaches actually move a `len`?
 */
const bodyMayExtend = (
  program: CheckedProgram,
  table: TypeTable,
  body: Node,
  known: FactsTable | null
): boolean => {
  if (body.kind === NodeKind.Throw || isResizeCall(program, table, body)) {
    return true
  }
  // A `new` holds its class's constructor (CG-11), and a class with none
  // stores constants only.
  if (body.kind === NodeKind.Call || body.kind === NodeKind.New) {
    const callee = program.nodeCallees[body.id]
    // An unresolved callee is a builtin, and no builtin but `push`, `pop`
    // and `spawnPiped` reaches a user array's header; those are above.
    if (callee !== null) {
      if (known === null) {
        return true
      }
      const calleeFacts = known.get(callee.name)
      if (calleeFacts === null || calleeFacts.resizesArray) {
        return true
      }
    }
  }
  for (const child of body.children) {
    if (bodyMayExtend(program, table, child, known)) {
      return true
    }
  }
  return false
}

/** Whether `sig` is a host module's export, a wasm import from the page (WP50 S2). */
export const hostFunction = (sig: FunctionSig): boolean => {
  const origin = sig.origin
  return origin !== null && origin.host
}

/**
 * Whether parameter `i` of the foreign function `sig` is a buffer lent for
 * the call: a C function's `u8[]` (WP53 B1) or a host function's window
 * (WP50 S3, `isHostWindow`). Either crosses as its data pointer.
 */
export const lentBuffer = (table: TypeTable, sig: FunctionSig, i: i32): boolean =>
  hostFunction(sig) ? isHostWindow(table, sig.paramTypes[i]) : isForeignBuffer(table, sig.paramTypes[i])

/** Whether C writes through pointer parameter `i` of the foreign `sig`: a `u8[]` buffer, or a `declare class` it fills (WP27 S4.1). */
const filledByC = (program: CheckedProgram, table: TypeTable, sig: FunctionSig, i: i32): boolean =>
  (lentBuffer(table, sig, i) && !table.isReadonlyArray(sig.paramTypes[i])) ||
  layoutClass(program, table, table.stripNull(sig.paramTypes[i])) !== null

/**
 * Whether the window check of buffer argument `index` of the host call `call`
 * is proven (WP50 S3, §5.3): `at` is the literal `0` and `n` is
 * `toU32(x.length)` of the buffer itself, which is `foreignBufferCountProven`'s
 * rule with the count one argument further on and in the window's width.
 */
export const hostWindowProven = (
  program: CheckedProgram,
  table: TypeTable,
  call: Node,
  index: i32,
  known: FactsTable | null
): boolean => {
  const at = call.children[1].children[index + 1]
  return (
    at.kind === NodeKind.Number &&
    at.text === "0" &&
    foreignBufferCountProven(program, table, call, index, index + 2, known, "toU32")
  )
}

/**
 * The parameter that counts buffer parameter `index` of the `declare function`
 * `sig`: the `u64` that closes its run, the first parameter after it that is
 * not a buffer (WP53 §3a; `checkForeignSignature` refuses every other shape).
 */
export const foreignBufferCount = (table: TypeTable, sig: FunctionSig, index: i32): i32 => {
  let at = index + 1
  while (at < sig.paramTypes.length && isForeignBuffer(table, sig.paramTypes[at])) {
    at = at + 1
  }
  return at
}

/**
 * Whether the `ffi-length` check of buffer argument `index` of the foreign
 * call `call` is proven, so that neither the attribute pass records it as a
 * panic nor the emitter writes it (WP53 B1.2, §3a). The count is spelled
 * `toU64(x.length)` in the call, where `x` is the buffer argument itself, a
 * `const` local or a parameter named alone, so the count is the length it was
 * when the count ran; and no argument after the count can move an array's
 * `len` (`bodyMayExtend`, with any receiver, since aliases are not tracked),
 * so it is still that length when the emitter loads it after the last one.
 *
 * `known` is the fixpoint the callees' `resizesArray` is read from, and
 * `null` -- round 1 -- proves nothing, as an unanalysed callee may resize.
 * Under `--no-elision` (`known.noElision`) nothing is proven.
 */
export const foreignBufferCountProven = (
  program: CheckedProgram,
  table: TypeTable,
  call: Node,
  index: i32,
  count: i32,
  known: FactsTable | null,
  conversion: string
): boolean => {
  if (known !== null && known.noElision) {
    return false
  }
  const args = call.children[1].children
  const buffer = args[index]
  const local: Local | null = buffer.kind === NodeKind.Ident ? program.nodeLocals[buffer.id] : null
  if (
    local === null ||
    local.mutable ||
    args[count].kind !== NodeKind.Call ||
    !isBuiltinConversion(program, args[count], conversion)
  ) {
    return false
  }
  const access = args[count].children[1].children[0]
  if (
    access.kind !== NodeKind.Member ||
    access.text !== "length" ||
    access.children[0].kind !== NodeKind.Ident
  ) {
    return false
  }
  const counted = program.nodeLocals[access.children[0].id]
  if (counted === null || counted !== local) {
    return false
  }
  let at = count + 1
  while (at < args.length) {
    if (bodyMayExtend(program, table, args[at], known)) {
      return false
    }
    at = at + 1
  }
  return true
}

/**
 * `a.push(v)`, `a.pop()`, `spawnPiped(...)` or `spawnPipedWithin(...)`: the
 * calls that move an array's `len`, and so the ones a hoisted header has to be
 * safe from. Every other array method reads (`indexOf`, `join`), builds
 * something new, or writes elements and leaves the header alone (`set`,
 * `fill`); the two spawns append to their `stdout` and `stderr` in the runtime.
 */
export const isResizeCall = (program: CheckedProgram, table: TypeTable, node: Node): boolean => {
  const method = arrayMethodName(program, table, node)
  if (method === "push" || method === "pop") {
    return true
  }
  if (
    node.kind !== NodeKind.Call ||
    node.children[0].kind !== NodeKind.Ident ||
    program.nodeCallees[node.id] !== null
  ) {
    return false
  }
  const name = builtinNameOf(program, node)
  return name === "spawnPiped" || name === "spawnPipedWithin"
}

/** True when `body` may assign one of `names` (by any assignment form) or may throw. */
const bodyDisturbs = (body: Node, names: string[]): boolean => {
  if (body.kind === NodeKind.Throw) {
    return true
  }
  if (
    body.kind === NodeKind.Binary &&
    isAssignmentOperator(body.text) &&
    body.children[0].kind === NodeKind.Ident &&
    names.indexOf(body.children[0].text) >= 0
  ) {
    return true
  }
  if (
    body.kind === NodeKind.Unary &&
    (body.text === "++" || body.text === "--") &&
    body.children[0].kind === NodeKind.Ident &&
    names.indexOf(body.children[0].text) >= 0
  ) {
    return true
  }
  for (const child of body.children) {
    if (bodyDisturbs(child, names)) {
      return true
    }
  }
  return false
}

// ---- Attribute rendering --------------------------------------------------------------------

export const functionAttributes = (f: FunctionFacts): string[] => {
  const attrs: string[] = []
  attrs.push("nounwind")
  if (f.willReturn) {
    attrs.push("willreturn")
  }
  if (f.effect === EFFECT_NONE) {
    attrs.push("readnone")
  } else if (f.effect === EFFECT_READ) {
    attrs.push("readonly")
  }
  return attrs
}

export const paramAttributes = (
  table: TypeTable,
  name: string,
  type: i32,
  f: FunctionFacts,
  privateAbi: boolean
): string[] => {
  const attrs: string[] = []
  // `noundef` on everything except a by-value `Result` under the private ABI
  // (WP15 §7b), whose dead arm's slot is deliberately `undef` — and `noundef`
  // on an aggregate is about every element of it, not just the live one.
  if (!privateAbi || !table.resultByValue(type)) {
    attrs.push("noundef")
  }
  // See the header comment: every pointer fact here is proved by `collectFacts`
  // plus the `pointerParams` fixpoint in `analyzeFunctions`.
  const pointer = f.pointerParam(name)
  const kind = table.kindOf(type)
  if (type === T_BOOL) {
    attrs.push("zeroext") // `boolean` is i1; the C ABI wants it zero-extended
    return attrs
  }
  if (type === T_STRING) {
    attrs.push("nonnull")
    attrs.push("noalias")
    attrs.push("readonly")
    attrs.push("align 8")
    if (!f.escaping.has(name)) {
      attrs.push("nocapture")
    }
    return attrs
  }
  if (kind === K_ARRAY) {
    // dereferenceable(24): every array value points at a full header (len,
    // cap, data), allocated by the arena or built by a literal; there is no
    // null and no partial header.
    attrs.push("nonnull")
    attrs.push("align 8")
    attrs.push(`dereferenceable(${ARRAY_HEADER_BYTES})`)
    if (pointer !== null && !pointer.writesThrough && !pointer.captured) {
      attrs.push("readonly")
    }
    if (pointer !== null && !pointer.captured) {
      attrs.push("nocapture")
    }
    return attrs
  }
  if (kind === K_STRUCT) {
    attrs.push("nonnull")
    if (name === "this" && f.freshThis) {
      attrs.push("noalias")
    }
    if (pointer !== null && !pointer.writesThrough && !pointer.captured) {
      attrs.push("readonly")
    }
    // Not always 8: a record that is an array element sits at `i * sizeof(P)`
    // into the block, so its own alignment is all that can be promised.
    attrs.push(`align ${pointer === null ? 8 : pointer.align}`)
    if (pointer !== null && pointer.size > 0) {
      attrs.push(`dereferenceable(${pointer.size})`)
    }
    if (pointer !== null && !pointer.captured) {
      attrs.push("nocapture")
    }
    return attrs
  }
  if (kind === K_RESULT && table.resultByValue(type)) {
    // WP17: a small `Result` arrives packed in an `i64`, so none of the
    // pointer facts are about it; `noundef` alone, as for any scalar — or
    // nothing at all under the private ABI, as above.
    return attrs
  }
  if (kind === K_RESULT) {
    // WP16: every `Result` comes from `Ok(...)` / `Err(...)`, so the object is
    // whole and never null, and nothing in the language can store through one.
    attrs.push("nonnull")
    attrs.push("align 8")
    if (pointer !== null && pointer.size > 0) {
      attrs.push(`dereferenceable(${pointer.size})`)
    }
    if (pointer !== null && !pointer.writesThrough && !pointer.captured) {
      attrs.push("readonly")
    }
    if (pointer !== null && !pointer.captured) {
      attrs.push("nocapture")
    }
    return attrs
  }
  if (kind === K_NULLABLE && table.isFnRef(table.refOf(type))) {
    return attrs // WP51 stage 2: an `i32` tag, so no pointer fact applies
  }
  if (kind === K_NULLABLE) {
    // WP6: no `nonnull` / `dereferenceable`; the rest as for the pointee kind.
    if (table.refOf(type) === T_STRING) {
      attrs.push("noalias")
      attrs.push("readonly")
    } else if (pointer !== null && !pointer.writesThrough && !pointer.captured) {
      attrs.push("readonly")
    }
    attrs.push(`align ${pointer === null ? 8 : pointer.align}`)
    const uncaptured = pointer !== null ? !pointer.captured : !f.escaping.has(name)
    if (uncaptured) {
      attrs.push("nocapture")
    }
  }
  return attrs
}

/**
 * `deref` is the struct size for struct-returning functions, 0 otherwise;
 * `privateAbi` is whether this function answers a by-value `Result` as the
 * arms rather than the word (WP15 §7b).
 */
export const returnAttributes = (
  table: TypeTable,
  type: i32,
  deref: i32,
  privateAbi: boolean,
  align: i32
): string[] => {
  const attrs: string[] = []
  const kind = table.kindOf(type)
  if (type === T_VOID) {
    return attrs
  }
  // The private ABI's arms are the one shape in the language that is not
  // fully defined: the arm that is not live is `undef` by construction, so
  // they carry no `noundef` at all (WP15 §7b).
  if (privateAbi && table.resultByValue(type)) {
    return attrs
  }
  attrs.push("noundef")
  if (type === T_BOOL) {
    attrs.push("zeroext")
    return attrs
  }
  if (type === T_STRING) {
    attrs.push("nonnull")
    attrs.push("align 8")
    return attrs
  }
  if (kind === K_ARRAY) {
    attrs.push("nonnull")
    attrs.push("align 8")
    attrs.push(`dereferenceable(${ARRAY_HEADER_BYTES})`)
    return attrs
  }
  if (kind === K_RESULT && table.resultByValue(type)) {
    // WP17: a small `Result` comes back packed in an `i64`, so none of the
    // pointer facts are about it; the word is always fully defined, because
    // the dead arm is discarded by a `select` before it is shifted in.
    return attrs
  }
  if (kind === K_STRUCT || kind === K_RESULT) {
    // WP16: a `Result` is a whole, never-null object, exactly like a struct.
    // `align` is the record alignment for a record type, 8 otherwise.
    attrs.push("nonnull")
    attrs.push(`align ${align}`)
    if (deref > 0) {
      attrs.push(`dereferenceable(${deref})`)
    }
    return attrs
  }
  if (kind === K_NULLABLE && !table.isFnRef(table.refOf(type))) {
    attrs.push(`align ${align}`) // WP6: may be null
  }
  return attrs
}

/** A numeric literal, negated or not: `process.exit(1)`, `process.exit(-1)`. */
const isNumericLiteral = (node: Node): boolean =>
  node.kind === NodeKind.Number ||
  (node.kind === NodeKind.Unary && node.text === "-" && node.children[0].kind === NodeKind.Number)
