// WP29 P1: the rules a data-parallel call is held to, and how `nish/threads`'s
// templates are recognised (docs/wp29-thread-surface.md §4.1, §7, §11).
//
// `std/threads.ts` is ordinary Nish: its two exported templates carry the
// sequential meaning, and the compiler recognises them by module and name and
// replaces one call inside each instance with a region over
// `nish_parallel_range` (`src/emit-parallel.ts`). Everything that makes the
// region safe to run on several threads is judged here, at the user's call,
// from the whole-program facts — which is why it runs after the fixpoint,
// from `Compilation.checkParallel`, rather than while the call is checked:
//
//   - **The body writes nothing its caller can see** (`FunctionFacts.sharedWrite`).
//     It is the body `f` that is judged and never the instance: the instance's
//     own sequential loop writes `dst[i]`, so it is always a shared write.
//     The intrinsic performs every store, into slots the partitioner has made
//     disjoint, so a body that writes nothing cannot race with anything.
//   - **What the body allocates dies with its element.** A worker's arena is
//     its own under `--threads` and is freed when its thread exits, so nothing
//     a body allocates may outlive its element — and so it does not have to
//     live even that long: a body that allocates gets an arena scope of its
//     own (`scopeParallelBodies` in `src/attributes.ts`), and each element
//     gives its temporaries back before the next one starts. That needs the
//     escape analysis to see every allocation die (`escapeMessage`) and the
//     body to leave the arena alone (`arenaMessage`); what is left is legal,
//     and costs a mark and a release per element, which is what NL9012 says
//     (`allocationWarning`).
//   - **`dst` is not reachable from an element of `src`.** Purity is not
//     enough: a body that only reads can still read `dst` through its argument
//     (`T = Row { cells: f64[] }` with a `f64[]` `dst`) while another thread
//     writes it. An array of `dst`'s element type reachable from `T` is
//     refused, naming the path. A reduce writes no memory of its caller's and
//     is exempt.
//   - **The result is a number, a `boolean` or an enum**, for the arena reason
//     above: anything else would be a pointer into memory freed at the join.
//   - **A reduce's operator is associative and its identity is one.** The
//     blocks are folded from the identity and then combined, which is a left
//     fold only when both hold. An arrow whose body is one operator on its two
//     parameters is read; a named function is opaque, and the obligation is
//     written in docs/LANGUAGE.md instead.
//
// And one thing that is not a rule: how finely a map is divided. That is sized
// from a static estimate of what one element costs (`mapGrain`), so a region
// is only divided once each thread's share is worth a thread.

import { FactsTable, FunctionFacts, stepOf } from "./attributes"
import { CLI, STD_PREFIX } from "./branding"
import { numericLiteralValue } from "./constants"
import { isScalarArgument } from "./escape"
import {
  isArrayWriteMethod,
  isAssignmentOperator,
  builtinArgumentLetters,
  builtinNameOf,
  dottedName,
  isArenaCall,
  isWrittenArgument,
  isTemplateExpression,
  unwrapParens,
} from "./emit-util"
import {
  N_ARRAY,
  N_ARROW,
  N_BLOCK,
  N_CALL,
  N_CONDITIONAL,
  N_EXPR_STMT,
  FLAG_COMPUTED,
  FLAG_CONST,
  N_INDEX,
  N_MEMBER,
  N_PAREN,
  N_PARAM,
  N_PROPERTY,
  N_VAR_DECL,
  FLAG_USING,
  N_DO,
  N_FALSE,
  N_FOR,
  N_FOR_OF,
  N_IDENT,
  N_LIST,
  N_METHOD,
  N_NEW,
  N_NUMBER,
  N_OBJECT,
  N_RETURN,
  N_STRING,
  N_THIS,
  N_TRUE,
  N_UNARY,
  N_BINARY,
  N_VAR,
  N_WHILE,
  Node,
} from "./nodes"
import {
  CheckedProgram,
  FunctionSig,
  PAR_CHUNK,
  PAR_MAP,
  PAR_NONE,
  PAR_REDUCE,
  PAR_SPAWN,
  PAR_TASK,
  ParallelCall,
  ROLE_CONSTRUCTOR,
  ScopeChannels,
  StructInfo,
  StructInstantiation,
  TemplateInfo,
} from "./program"
import { resultMethodName } from "./emit-result"
import { stdModuleName } from "./std-modules"
import { StringMap, StringSet } from "./map"
import { Local, STORAGE_PARAM } from "./symbols"
import { K_ARRAY, K_NULLABLE, K_RESULT, K_STRUCT, TypeTable } from "./types"

/** The class `scope()` answers, as `nish/threads` declares it (WP29 P2). */
const THREAD_SCOPE: string = "ThreadScope"

/** The name the parser gives a method declared as `[Symbol.dispose]` (WP29 P2). */
export const DISPOSE_METHOD: string = "[Symbol.dispose]"

/**
 * Whether `decl` is a method named `[Symbol.iterator]`, a computed name the
 * parser keeps as the member expression it is: `nish/threads`'s `Channel`
 * declares one for Node's `for...of` (WP29 P3), and nothing else may.
 */
export const isIteratorMethod = (decl: Node): boolean => {
  if (decl.kind !== N_METHOD || (decl.flags & FLAG_COMPUTED) === 0) {
    return false
  }
  const name = decl.children[0]
  return (
    name.kind === N_MEMBER &&
    name.text === "iterator" &&
    name.children[0].kind === N_IDENT &&
    name.children[0].text === "Symbol"
  )
}

/** The refusal of a `[Symbol.dispose]` method anywhere but `nish/threads`'s `ThreadScope`. */
export const disposeElsewhereMessage = (owner: string): string =>
  `\`${owner}\` cannot declare \`[Symbol.dispose]\`: in this version \`using\` takes only a \`scope()\` or a ` +
  "`lock()` from `nish/threads` or the builtin `arena()`, whose join and releases the compiler emits itself, so a " +
  "disposal method of any other class would never be called"

/** `std/threads.ts`: the name `nish/threads` loads under, and the module its templates are recognised in. */
export const threadsModuleName = (): string => stdModuleName(`${STD_PREFIX}threads`)

/**
 * Whether `program` is the standard library's `std/threads.ts`. The package is
 * part of the test: a root-package file that happens to sit at `std/threads.ts`
 * is an ordinary module, and its templates run as they are written.
 */
const isThreadsModule = (program: CheckedProgram): boolean =>
  program.packageName === CLI && program.source.path === threadsModuleName()

/**
 * Whether `program` is `std/threads.ts` read as a file of its own, in any
 * package: what the declarations only `nish/threads` may make are allowed in
 * (`[Symbol.dispose]`, a method with a function parameter). It is the path
 * alone because the performance gate compiles `std/threads.ts` as a root, and
 * because a file that declares them without being the module gets no scope's
 * lowering from them: `spawn`'s role is still `isThreadsModule`'s.
 */
export const isThreadsSource = (program: CheckedProgram): boolean =>
  program.source.path === threadsModuleName()

/** Whether `template` is `ThreadScope.spawn` from `nish/threads` (WP29 P2). */
export const isSpawnTemplate = (template: TemplateInfo): boolean => {
  const owner = template.owner
  return (
    owner !== null &&
    owner.name === THREAD_SCOPE &&
    template.decl.children[0].text === "spawn" &&
    isThreadsModule(template.home.program)
  )
}

/** The `PAR_*` role of an instantiation of `template`. */
export const parallelRole = (template: TemplateInfo): i32 => {
  if (isSpawnTemplate(template)) {
    return PAR_SPAWN
  }
  if (template.owner !== null || !isThreadsModule(template.home.program)) {
    return PAR_NONE
  }
  if (template.sourceName === "runTask") {
    return PAR_TASK
  }
  const name = template.sourceName
  if (name === "parallelMapInto") {
    return PAR_MAP
  }
  if (name === "parallelReduce") {
    return PAR_REDUCE
  }
  if (name === "mapRange" || name === "reduceBlocks") {
    return PAR_CHUNK
  }
  return PAR_NONE
}

/** The role of the function `sig` is, or `PAR_NONE` when it is not an instantiation. */
export const parallelRoleOf = (sig: FunctionSig): i32 => {
  const instance = sig.instance
  return instance === null ? PAR_NONE : instance.parallel
}

/** The body a `parallelMapInto` or `parallelReduce` instance runs per element: its one function argument. */
export const parallelBodyOf = (sig: FunctionSig): FunctionSig | null => {
  const instance = sig.instance
  return instance === null || instance.functionArgs.length !== 1 ? null : instance.functionArgs[0]
}

/**
 * The `storeResult` instance a `runTask` instance calls: the store a task's
 * scope makes when it joins. `runTask`'s body is that one call, and which
 * instance it reaches is in the instance's own tables.
 */
export const taskStoreOf = (task: FunctionSig): FunctionSig | null => {
  const instance = task.instance
  const body = task.body()
  if (instance === null || body === null || body.kind !== N_CALL) {
    return null
  }
  return instance.nodeCallees[body.id]
}

/** Whether `sig` is an instance of `ThreadScope.spawn` (WP29 P2). */
export const isSpawnEntry = (sig: FunctionSig): boolean => parallelRoleOf(sig) === PAR_SPAWN

/** Whether `sig` is an instance of `parallelMapInto` or `parallelReduce`: one whose region the emitter builds. */
export const isParallelEntry = (sig: FunctionSig): boolean => {
  const role = parallelRoleOf(sig)
  return role === PAR_MAP || role === PAR_REDUCE
}

/**
 * Remember a call of `sig` for `Compilation.checkParallel`, once. A body that
 * is checked again — a generic caller's, once per instantiation — reaches here
 * again with the same node and, for the same tuple, the same instance.
 */
export const recordParallelCall = (program: CheckedProgram, node: Node, sig: FunctionSig): void => {
  // WP29 P2: a `spawn` is judged by the same facts, and kept apart because a
  // task is not an element: nothing about it is scoped per call.
  const calls = isSpawnEntry(sig) ? program.spawnCalls : program.parallelCalls
  if (!isParallelEntry(sig) && !isSpawnEntry(sig)) {
    return
  }
  for (const call of calls) {
    if (call.node === node && call.sig === sig) {
      return
    }
  }
  calls.push(new ParallelCall(node, sig))
}

// ---- The rules ---------------------------------------------------------------------------

/** Where a diagnostic about `f` can say `node` is: `file:line:col` in `f`'s module, or "" without one. */
const positionIn = (fn: FunctionSig, node: Node): string => {
  const origin = fn.origin
  return origin === null ? "" : `${origin.path}:${origin.lineOf(node.start)}:${origin.columnOf(node.start)}`
}

/** What the template is called in a diagnostic: its source name, without the instance's type arguments. */
const intrinsicName = (sig: FunctionSig): string => {
  const role = parallelRoleOf(sig)
  if (role === PAR_SPAWN) {
    return "spawn"
  }
  return role === PAR_MAP ? "parallelMapInto" : "parallelReduce"
}

/**
 * The body writes memory its caller could observe, which two threads running
 * it at once could both write. It names the first such write the fixpoint
 * found: the node, or the callee that carries it.
 */
export const sharedWriteMessage = (sig: FunctionSig, fn: FunctionSig, facts: FactsTable): string => {
  const own = facts.get(fn.name)
  if (own === null || !own.sharedWrite) {
    return ""
  }
  let where = ""
  const site = own.writeSite
  if (site !== null) {
    const at = positionIn(fn, site)
    where = at.length > 0 ? ` at ${at}` : ""
  } else if (own.writeVia.length > 0) {
    // A user function by the name it was written with; a runtime symbol, which
    // is what a builtin such as `console.log` lowers to, by its C name.
    const via = facts.get(own.writeVia)
    where = via === null ? ` in the runtime's \`${own.writeVia}\`` : ` through \`${via.sourceName}\``
  }
  // WP29 P3, R6: a task's one shared write is through a guard, which the
  // fixpoint does not count (`isGuardedAccess`), so this names what is left.
  if (parallelRoleOf(sig) === PAR_SPAWN) {
    return `\`${fn.sourceName}\` writes memory its caller can see${where}${TASK_WRITE_TAIL}`
  }
  return (
    `\`${fn.sourceName}\` writes memory its caller can see${where}, and \`${intrinsicName(sig)}\` runs it on several ` +
    "threads at once: a parallel body may read what its caller owns and write nothing but its result"
  )
}

/**
 * Whether the allocations of a body with facts `f` can be given back after
 * every element, which is what makes a body that allocates legal. Four things
 * have to hold, and they are the ones the callee-scope rule in
 * `src/attributes.ts` asks for (`settleCalleeScopes`), for the same reasons:
 *
 *   - `contained`: nothing allocated during the call is reachable once it
 *     returns, except through the result;
 *   - `returnsScalar`: and the result is not a pointer, so nothing is;
 *   - `!usesArenaControl`: nothing in the call rewound the arena, so the mark
 *     taken on entry still names where the element started;
 *   - `!readsArenaState`: nothing in the call reads the bump position, whose
 *     answer would depend on which thread's arena the element ran in.
 */
export const recyclesPerElement = (f: FunctionFacts): boolean =>
  f.contained && f.returnsScalar && !f.usesArenaControl && !f.readsArenaState

/**
 * The body reads or moves the arena. Every thread has an arena of its own, so
 * `Arena.used()` would answer differently depending on which thread ran the
 * element, and a body that rewinds the arena could rewind past what the
 * element scope is about to release.
 */
export const arenaMessage = (sig: FunctionSig, fn: FunctionSig, facts: FactsTable): string => {
  const own: FunctionFacts | null = facts.get(fn.name)
  if (own === null || (!own.readsArenaState && !own.usesArenaControl && !own.opensArena)) {
    return ""
  }
  return (
    `\`${fn.sourceName}\` reads or moves the arena, and \`${intrinsicName(sig)}\` runs it on several threads that ` +
    "each have an arena of their own: a parallel body may not call `Arena.mark`, `Arena.used`, `Arena.release` or " +
    "`Arena.reset`, nor open a `using a = arena()` block"
  )
}

/**
 * The body allocates and the escape analysis cannot see every allocation die
 * before it returns, so the scope that gives an element's memory back after
 * it could free something still in use. The analysis stops following a value
 * once it is stored into memory, so that is what this usually means, and the
 * site is named when the function's own allocation is the one that escapes.
 */
export const escapeMessage = (sig: FunctionSig, fn: FunctionSig, facts: FactsTable): string => {
  const own: FunctionFacts | null = facts.get(fn.name)
  if (own === null || !own.allocates || own.contained) {
    return ""
  }
  let where = ""
  const site = own.escapeSite
  if (site !== null) {
    const at = positionIn(fn, site)
    where = at.length > 0 ? ` at ${at}` : ""
  }
  return (
    `\`${fn.sourceName}\` allocates${where} and stores the allocation into memory, and \`${intrinsicName(sig)}\` ` +
    "releases what a body allocates after every element: a parallel body may allocate only temporaries it drops " +
    "before it returns, and this analysis stops following a value once it is stored"
  )
}

/**
 * NL9012, wp29 §8a: a legal body that allocates. Each element pays for its
 * allocations and for the mark and release around it, which a body computing
 * over what it was handed does not, and the fixpoint can see that before the
 * program runs. `type` is the body's result type.
 */
export const allocationWarning = (
  table: TypeTable,
  sig: FunctionSig,
  fn: FunctionSig,
  type: i32,
  facts: FactsTable
): string => {
  const own: FunctionFacts | null = facts.get(fn.name)
  if (own === null || !own.allocates) {
    return ""
  }
  return (
    `the body of this \`${intrinsicName(sig)}\` allocates per element: \`${fn.sourceName}\` answers ` +
    `\`${table.typeName(type)}\` but allocates on every call, so each thread marks and releases its arena around ` +
    "every element. Compute the answer without building a string, an array or an object to save both"
  )
}

/** The refusal of a body answering `type`, which is not a number, a `boolean` or an enum, from `intrinsic`. */
const resultWording = (table: TypeTable, intrinsic: string, fn: FunctionSig, type: i32): string => {
  if (isScalarArgument(table, type)) {
    return ""
  }
  return (
    `\`${fn.sourceName}\` answers \`${table.typeName(type)}\`, and \`${intrinsic}\` hands back only a ` +
    "number, a `boolean` or an enum: a worker's arena is freed when its thread exits, so anything else would point into freed memory"
  )
}

/** A result the join could hand back: a number, a `boolean` or an enum, and nothing that points. */
export const resultMessage = (table: TypeTable, sig: FunctionSig, fn: FunctionSig, type: i32): string =>
  resultWording(table, intrinsicName(sig), fn, type)

/**
 * The same rule for a reduce, asked before `template` is instantiated rather
 * than once the fixpoint has run. A reduce's `T` is its element, its identity
 * and its result at once, and the template's body is written for a scalar `T`
 * (`new Array<T>(blocks)` zero-fills its partials), so instantiating it for a
 * string or a class would report errors inside `std/threads.ts` and never
 * reach the call. `functions` and `typeArgs` are the call's, in the
 * template's order: the combining function, and `T`.
 */
export const reduceElementMessage = (
  table: TypeTable,
  template: TemplateInfo,
  functions: FunctionSig[],
  typeArgs: i32[]
): string => {
  if (parallelRole(template) !== PAR_REDUCE || functions.length !== 1 || typeArgs.length !== 1) {
    return ""
  }
  return resultWording(table, "parallelReduce", functions[0], typeArgs[0])
}

/**
 * The field path from an element of `src` to an array whose element type is
 * `element`, or "" when there is none. `root` is how the path starts, and
 * `seen` keeps a recursive struct from being walked twice.
 */
const reachingPath = (
  table: TypeTable,
  program: CheckedProgram,
  type: i32,
  element: i32,
  root: string,
  seen: StringSet
): string => {
  const kind = table.kindOf(type)
  if (kind === K_NULLABLE) {
    return reachingPath(table, program, table.refOf(type), element, root, seen)
  }
  if (kind === K_ARRAY) {
    const inner = table.refOf(type)
    if (inner === element) {
      return root
    }
    return reachingPath(table, program, inner, element, `${root}[i]`, seen)
  }
  if (kind === K_RESULT) {
    const ok = reachingPath(table, program, table.okOf(type), element, `${root}.value`, seen)
    return ok.length > 0
      ? ok
      : reachingPath(table, program, table.errOf(type), element, `${root}.error`, seen)
  }
  if (kind !== K_STRUCT) {
    return ""
  }
  const name = table.nameOf(type)
  if (seen.has(name)) {
    return ""
  }
  seen.add(name)
  const info = program.struct(name)
  if (info === null) {
    // Every layout a module can hold a value of is in its table
    // (`closeReachableStructs`), so this is not expected; a layout the rule
    // cannot see is refused rather than trusted.
    return root
  }
  for (const field of info.fields) {
    const path = reachingPath(table, program, field.type, element, `${root}.${field.name}`, seen)
    if (path.length > 0) {
      return path
    }
  }
  return ""
}

/**
 * `dst` could be read by the body through its argument while another thread
 * writes it. Judged by type, because that is the whole of what can alias an
 * array here: an array of `dst`'s element type reachable from `T`, whether or
 * not it is `dst` at run time.
 */
export const reachesDstMessage = (
  table: TypeTable,
  program: CheckedProgram,
  sig: FunctionSig,
  fn: FunctionSig
): string => {
  const instance = sig.instance
  if (instance === null || instance.parallel !== PAR_MAP || instance.typeArgs.length < 2) {
    return ""
  }
  const element = instance.typeArgs[0]
  const target = instance.typeArgs[1]
  const root = fn.paramNames.length > 0 ? fn.paramNames[0] : "x"
  const path = reachingPath(table, program, element, target, root, new StringSet())
  if (path.length === 0) {
    return ""
  }
  return (
    `\`${fn.sourceName}\` can reach a \`${table.typeName(target)}[]\` through \`${path}\`, which could be ` +
    "the array `parallelMapInto` is writing: another thread would be writing it while this one reads, so `dst` may not be reachable from an element of `src`"
  )
}

/**
 * The operator an arrow's whole body applies to its two parameters, in either
 * order, or "" when the body is anything else: a named function, a block with
 * more than a `return`, or an operator on anything but the two parameters.
 */
const combiningOperator = (fn: FunctionSig): string => {
  if (!fn.lifted || fn.paramNames.length !== 2) {
    return ""
  }
  let body = fn.decl.children[3]
  if (body.kind === N_BLOCK) {
    if (body.children.length !== 1 || body.children[0].kind !== N_RETURN) {
      return ""
    }
    body = body.children[0].children[0]
  }
  body = unwrapParens(body)
  if (body.kind !== N_BINARY) {
    return ""
  }
  const left = unwrapParens(body.children[0])
  const right = unwrapParens(body.children[1])
  if (left.kind !== N_IDENT || right.kind !== N_IDENT) {
    return ""
  }
  const a = fn.paramNames[0]
  const b = fn.paramNames[1]
  if ((left.text === a && right.text === b) || (left.text === b && right.text === a)) {
    return body.text
  }
  return ""
}

/** An operator whose result depends on how its operands are grouped. */
const isNonAssociative = (op: string): boolean =>
  op === "-" || op === "/" || op === "%" || op === "**" || op === "<<" || op === ">>" || op === ">>>"

/** The identity an associative operator folds from, as written, or "" for one it has no single literal for. */
const identityOf = (op: string): string => {
  if (op === "+" || op === "|" || op === "^") {
    return "0"
  }
  if (op === "*") {
    return "1"
  }
  if (op === "&&") {
    return "true"
  }
  if (op === "||") {
    return "false"
  }
  return ""
}

/**
 * Whether `node` is the literal `want` spells: a number of the same value in
 * any spelling (`0`, `0.0`, `-0`, `0x0`), or the same `boolean`. Anything else
 * — a variable, a call, a constant's name — is not, because an identity the
 * checker cannot see is one it cannot hold to the rule.
 */
const isLiteral = (node: Node, want: string): boolean => {
  const e = unwrapParens(node)
  if (want === "true") {
    return e.kind === N_TRUE
  }
  if (want === "false") {
    return e.kind === N_FALSE
  }
  if (e.kind === N_UNARY && (e.text === "-" || e.text === "+")) {
    const operand = unwrapParens(e.children[0])
    return operand.kind === N_NUMBER && want === "0" && numericLiteralValue(operand.text) === 0
  }
  return e.kind === N_NUMBER && numericLiteralValue(e.text) === Number(want)
}

/**
 * A reduce's two obligations, where they can be read off the call: an arrow
 * that is one non-associative operator, or a recognised associative one given
 * something other than its identity. `identityText` is the argument as written.
 */
export const reduceMessage = (
  sig: FunctionSig,
  fn: FunctionSig,
  identity: Node,
  identityText: string
): string => {
  if (parallelRoleOf(sig) !== PAR_REDUCE) {
    return ""
  }
  const op = combiningOperator(fn)
  if (op.length === 0) {
    return ""
  }
  if (isNonAssociative(op)) {
    return (
      `\`${fn.sourceName}\` combines with \`${op}\`, which is not associative: \`parallelReduce\` folds each block ` +
      "from the identity and then combines the blocks, which is a left fold only for an associative operator"
    )
  }
  const want = identityOf(op)
  if (want.length === 0 || isLiteral(identity, want)) {
    return ""
  }
  return (
    `\`parallelReduce\` folds every block from its identity, and the identity of \`${op}\` is \`${want}\`, not ` +
    `\`${identityText}\`: any other value would be counted once per block`
  )
}

// ---- The grain ---------------------------------------------------------------------------
//
// A map region is divided into at most one chunk per `grain` elements, so the
// grain decides whether a map is worth threads at all. A region divided four
// ways costs about 125 µs of `pthread_create` and join (docs/wp20-threads.md
// §8e), and it needs about a millisecond of work in each chunk before that is
// under a tenth of the chunk. How many elements make a millisecond depends on
// the body, so the grain is that target over an estimate of one element:
//
//     grain = REGION_COST / cost(f), which is in [1, REGION_COST]
//
// The estimate is read off the body's syntax, in units of roughly one simple
// operation, and `REGION_COST` was set by measurement rather than by what a
// unit is worth: the cheapest body there is has to win at two chunks
// (docs/wp29-thread-surface.md §8a has the calibration). It is deliberately
// crude, and it errs both ways. A callee counts as a call and not as its body,
// so work hidden behind a call is estimated cheap and divided too little. A
// loop whose trip count the header does not state counts `DEFAULT_TRIPS`, which
// overestimates a loop over a short array; that costs threads only once the
// estimate reaches `REGION_COST` over the length, which for a map of eight
// elements takes three such loops nested, or two around a hundred operations.

/**
 * The work, in estimate units, that one chunk of a map region should carry:
 * what the cheapest body, `(x) => x * 3 + 1`, needs at two chunks to beat the
 * loop it replaces (2^20 lost to it by 12%; 2^22 wins by 1.54x).
 */
const REGION_COST: i32 = 4194304

/** One call: the jump, the frame and the return, beyond the arguments. */
const CALL_COST: i32 = 4

/** One arena allocation: the bump and its initialisation, or formatting a number into a string. */
const ALLOC_COST: i32 = 32

/** The iterations a loop is assumed to run when its bound is not a literal. */
const DEFAULT_TRIPS: i32 = 64

/** `a * b`, saturated at `REGION_COST`: nothing above it changes the grain. */
const scaled = (a: i32, b: i32): i32 => {
  if (a <= 0 || b <= 0) {
    return 0
  }
  return a >= REGION_COST / b ? REGION_COST : a * b
}

/** `a + b`, saturated at `REGION_COST`. */
const summed = (a: i32, b: i32): i32 => (a >= REGION_COST - b ? REGION_COST : a + b)

/**
 * How many times the loop `node` runs its body, when its header says so
 * outright — `for (let i = A; i < B; i += C)` with `A`, `B` and `C` literals
 * (`<=` and `i++` too) — and `DEFAULT_TRIPS` for anything else. A `break` is
 * not looked for.
 */
const tripsOf = (node: Node): i32 => {
  if (node.kind !== N_FOR || node.children.length < 3 || node.children[0].kind !== N_VAR) {
    return DEFAULT_TRIPS
  }
  const decls = node.children[0].children[0]
  if (decls.children.length !== 1 || decls.children[0].children.length < 3) {
    return DEFAULT_TRIPS
  }
  const name = decls.children[0].children[0].text
  const first = unwrapParens(decls.children[0].children[2])
  const cond = unwrapParens(node.children[1])
  if (first.kind !== N_NUMBER || cond.kind !== N_BINARY || cond.children.length < 2) {
    return DEFAULT_TRIPS
  }
  const iv = unwrapParens(cond.children[0])
  const bound = unwrapParens(cond.children[1])
  const step = stepOf(unwrapParens(node.children[2]), name)
  if (iv.kind !== N_IDENT || iv.text !== name || bound.kind !== N_NUMBER || step <= 0) {
    return DEFAULT_TRIPS
  }
  if (cond.text !== "<" && cond.text !== "<=") {
    return DEFAULT_TRIPS
  }
  const span =
    numericLiteralValue(bound.text) - numericLiteralValue(first.text) + (cond.text === "<=" ? 1.0 : 0.0)
  const trips = Math.ceil(span / toF64(step))
  if (trips < 1.0) {
    return 1
  }
  return trips >= toF64(REGION_COST) ? REGION_COST : toI32(trips)
}

/** The estimate for `node` and everything under it. */
const costOf = (node: Node): i32 => {
  // A nested arrow is lifted into a function of its own and runs only when called.
  if (node.kind === N_ARROW) {
    return 0
  }
  let own = 1
  if (node.kind === N_CALL) {
    own = CALL_COST
  } else if (
    node.kind === N_NEW ||
    node.kind === N_OBJECT ||
    node.kind === N_ARRAY ||
    isTemplateExpression(node)
  ) {
    own = ALLOC_COST
  }
  let inner = 0
  for (const child of node.children) {
    inner = summed(inner, costOf(child))
  }
  if (node.kind === N_FOR || node.kind === N_WHILE || node.kind === N_DO || node.kind === N_FOR_OF) {
    inner = scaled(inner, tripsOf(node))
  }
  return summed(own, inner)
}

/**
 * The grain of a map whose body is `fn`: `REGION_COST` over its estimate. The
 * estimate is at least 1 and saturates at `REGION_COST`, so the grain is in
 * `[1, REGION_COST]` without a clamp of its own.
 */
export const mapGrain = (fn: FunctionSig): i32 => {
  const body = fn.body()
  return body === null ? REGION_COST : REGION_COST / costOf(body)
}

// ---- WP29 P2: the scope ------------------------------------------------------------------
//
// `using s = scope(); s.spawn(entry, arg, dst, at)`. What keeps a scope free
// of races is when its tasks run: at the join, not at the spawn
// (runtime/runtime-parallel.c). While they run, the thread that opened the
// scope is inside the join and runs nothing else; each task may write nothing
// another can see (`sharedWriteMessage`, the rule a data-parallel body is held
// to) and answers a number, a `boolean` or an enum; and each answer is stored
// into `dst[at]` by the thread that opened the scope, after the last task has
// finished. So any argument may be handed to a task — nothing writes it while
// the tasks read it. What the parent may do between its spawns is limited for
// another reason, that Node runs each task at its spawn: see "the region" below.
//
// What is left to check is that every scope is joined, which the construct
// guarantees once a scope cannot get away from its block: it is made only by
// `scope()` as the initialiser of a `using` declaration, which is a statement
// of a block, and used only as the receiver of a `spawn` statement.

/** One refusal the scope rules make, where it is reported. */
export class ScopeFinding {
  node: Node
  message: string

  constructor(node: Node, message: string) {
    this.node = node
    this.message = message
  }
}

const usingNotScopeMessage = (): string =>
  "`using` takes only `scope()` or a `Mutex`'s `lock()` from `nish/threads`, or the builtin `arena()`, in this " +
  "version: they are the values whose disposal the language defines — a scope joins its tasks, a guard releases " +
  "its lock, an arena releases what its block allocated — so a `using` of anything else would promise a disposal " +
  "nothing performs"

const arenaNotUsingMessage = (): string =>
  "`arena()` must be the initialiser of a `using` declaration, `using a = arena()`: the arena releases what was " +
  "allocated after it when the block that declares it ends, and an `arena()` written anywhere else has no block to end"

const arenaBindingMessage = (name: string): string =>
  `\`${name}\` is the binding of a \`using\` declaration of \`arena()\` and cannot be read: it holds the mark ` +
  "its block releases to when it ends, and nothing but that release may see or move the mark"

const scopeNotUsingMessage = (): string =>
  "`scope()` must be the initialiser of a `using` declaration: a scope joins its tasks when the block that " +
  "declares it ends, so a scope bound any other way would be one nobody joins"

const scopeEscapesMessage = (): string =>
  `A \`${THREAD_SCOPE}\` can only be the receiver of a \`spawn\` statement: passed, stored, returned or copied, ` +
  "it could be given a task after its block has joined it"

const usingPlaceMessage = (): string =>
  "A `using` declaration must be a statement of a block, `{ ... }`: its scope joins when that block ends, " +
  "and a single-statement body is not a block"

/** The task given to `spawn` is an arrow. */
export const taskArrowMessage = (): string =>
  "The task given to `spawn` must be a top-level function named at the call, not an arrow: a task is a " +
  "unit of work a thread runs on its own, and its name is what a debugger or a profiler shows for that thread " +
  "(declare the arrow as a `const` of the module and pass its name)"

/** The argument of a task is a `Result` the ABI passes as its parts. */
export const taskArgumentMessage = (table: TypeTable, sig: FunctionSig): string => {
  const instance = sig.instance
  if (instance === null || instance.typeArgs.length === 0 || !table.resultByValue(instance.typeArgs[0])) {
    return ""
  }
  return (
    `The argument of \`spawn\` is \`${table.typeName(instance.typeArgs[0])}\`, which a task cannot be handed: ` +
    "a `Result` is passed as its parts rather than as one value, so hand the task the value it holds"
  )
}

/** Whether `program` loaded `nish/threads`, without which there is no scope to check. */
const threadsLoaded = (programs: CheckedProgram[]): boolean => {
  for (const program of programs) {
    if (isThreadsModule(program)) {
      return true
    }
  }
  return false
}

/** Whether `call` is `scope()` from `nish/threads`: a call of a free function answering a `ThreadScope`. */
const isScopeCall = (program: CheckedProgram, call: Node, scopeType: i32): boolean => {
  if (call.kind !== N_CALL || program.nodeTypes[call.id] !== scopeType) {
    return false
  }
  const callee = program.nodeCallees[call.id]
  return callee !== null && callee.sourceName === "scope" && callee.instance === null
}

/**
 * Whether `node`, a `ThreadScope` identifier under the first `n` of
 * `parents`, is the receiver of a `spawn` statement: `s.spawn(...)` standing
 * alone.
 */
const isSpawnReceiver = (node: Node, parents: Node[], n: i32): boolean => {
  if (n < 3) {
    return false
  }
  const member = parents[n - 1]
  const call = parents[n - 2]
  const stmt = parents[n - 3]
  return (
    member.kind === N_MEMBER &&
    member.text === "spawn" &&
    member.children[0] === node &&
    call.kind === N_CALL &&
    call.children[0] === member &&
    stmt.kind === N_EXPR_STMT
  )
}

/** Whether `node` is the initialiser of a declarator of a `using` statement, under the first `n` of `parents`. */
const isUsingInitialiser = (node: Node, parents: Node[], n: i32): boolean => {
  if (n < 3) {
    return false
  }
  const decl = parents[n - 1]
  const stmt = parents[n - 3]
  return (
    decl.kind === N_VAR_DECL &&
    decl.children[2] === node &&
    stmt.kind === N_VAR &&
    (stmt.flags & FLAG_USING) !== 0
  )
}

/** The walk: `node` under `parents`, outermost first, with every refusal pushed onto `out`. */
const walkScopes = (
  program: CheckedProgram,
  node: Node,
  parents: Node[],
  scopeType: i32,
  arenas: Local[],
  out: ScopeFinding[]
): void => {
  const n = parents.length
  const parent: Node | null = n > 0 ? parents[n - 1] : null
  if (node.kind === N_VAR && (node.flags & FLAG_USING) !== 0) {
    // A `case` clause's declarations are refused as every declaration there is.
    if (parent === null || parent.kind !== N_BLOCK) {
      out.push(new ScopeFinding(node, usingPlaceMessage()))
    }
    for (const decl of node.children[0].children) {
      const init = unwrapParens(decl.children[2])
      const local = program.nodeLocals[decl.id]
      if (isArenaCall(program, init)) {
        if (local !== null) {
          arenas.push(local)
        }
      } else if (!isScopeCall(program, init, scopeType) && !isLockCall(program, init)) {
        out.push(new ScopeFinding(decl, usingNotScopeMessage()))
      }
    }
  }
  const declaresName =
    parent !== null && (parent.kind === N_VAR_DECL || parent.kind === N_PARAM) && parent.children[0] === node
  // A parenthesised call or name is judged as what it wraps, where it stands.
  let at = node
  let depth = n
  while (depth > 0 && parents[depth - 1].kind === N_PAREN) {
    at = parents[depth - 1]
    depth = depth - 1
  }
  if (isArenaCall(program, node) && !isUsingInitialiser(at, parents, depth)) {
    out.push(new ScopeFinding(node, arenaNotUsingMessage()))
  }
  const named: Local | null = node.kind === N_IDENT && !declaresName ? program.nodeLocals[node.id] : null
  if (named !== null && arenas.indexOf(named) >= 0) {
    out.push(new ScopeFinding(node, arenaBindingMessage(named.name)))
  }
  if (!declaresName && node.kind !== N_PAREN && program.nodeTypes[node.id] === scopeType) {
    if (node.kind === N_CALL && isScopeCall(program, node, scopeType)) {
      if (!isUsingInitialiser(at, parents, depth)) {
        out.push(new ScopeFinding(node, scopeNotUsingMessage()))
      }
    } else if (!(node.kind === N_IDENT && isSpawnReceiver(at, parents, depth))) {
      out.push(new ScopeFinding(node, scopeEscapesMessage()))
    }
  }
  parents.push(node)
  for (const child of node.children) {
    walkScopes(program, child, parents, scopeType, arenas, out)
  }
  parents.pop()
}

/**
 * Every refusal of the scope rules in `program`'s bodies. The bodies of
 * `nish/threads` itself are the scope's own and are not judged; a generic
 * body is judged once per instantiation, over that instantiation's tables,
 * and an arrow inside a body with the body, whose tables it shares.
 */
export const scopeFindings = (
  programs: CheckedProgram[],
  program: CheckedProgram,
  table: TypeTable,
  facts: FactsTable,
  summaries: ChannelSummaries
): ScopeFinding[] => {
  const out: ScopeFinding[] = []
  // Without `nish/threads` there is no scope, and all that can be wrong is a
  // `using` of something else, or an `arena()` out of place, which a module
  // that spells neither word cannot have: the text answers that without a walk.
  const loaded = threadsLoaded(programs)
  const text = program.source.text
  if (isThreadsModule(program) || (!loaded && text.indexOf("using") < 0 && text.indexOf("arena") < 0)) {
    return out
  }
  // No node has type -2, so without the module only the `using` rule applies.
  const scopeType = loaded ? table.structOf(THREAD_SCOPE) : -2
  for (const sig of program.functions) {
    const body = sig.body()
    if (body === null || sig.lifted || !sig.definedIn(program.source)) {
      continue
    }
    const instance = sig.instance
    if (instance !== null) {
      program.enterInstance(instance)
    }
    const parents: Node[] = []
    const arenas: Local[] = []
    walkScopes(program, body, parents, scopeType, arenas, out)
    if (loaded) {
      checkBody(program, table, facts, body, out)
      walkMutexes(program, table, body, parents, out)
      findGuardBlocks(program, facts, body, scopeType, out)
      checkChannels(program, table, facts, summaries, sig, body, scopeType, out)
    }
    if (instance !== null) {
      program.leaveInstance()
    }
  }
  return out
}

// ---- WP29 P2: what the thread that opened a scope may do before it joins -----------------
//
// A task runs, and its answer is stored, when its scope joins; under Node the
// same task runs and stores where it is spawned. The two print the same only if
// nothing between a scope's first `spawn` and the end of its block can tell
// when that happened. That stretch is the *region*: from the statement of the
// block that holds the first `spawn` on the scope to the block's end, except a
// `return`'s value, which is computed after the join.
//
// Memory is reached only through a function's parameters and what it
// allocates: a module constant is a number, a boolean or a string, and nothing
// is `static`. So two local facts about each variable of the function decide
// the rule, and no alias analysis is needed:
//
//   - **A destination is a `const` bound to a fresh array** (a literal or
//     `new Array`) that is only ever indexed, walked, asked its `.length` or a
//     method, or named as a `spawn`'s destination: never handed on — not an
//     argument, not a task's argument, not stored, not returned. Nothing else
//     can reach it, so the region may not read *it*, by name.
//   - **A write in the region must miss everything a task reads.** A task
//     reads only what its argument reaches. So a store is allowed into the own
//     slots of a *private* local — a `const` bound to a fresh array or object
//     literal that is never handed on and never a destination — and a call is
//     allowed unless it writes through a pointer it is handed
//     (`PointerParamFacts.writesThrough`): a function that only fills memory it
//     allocated itself, such as one that builds and returns an array, writes
//     nothing a task can see. Every other write is refused: a store through
//     anything else, `push` or `pop` on anything else, `Arena`, and a task of
//     another scope, whose join stores.

/** The tail every refusal of the rule shares, which is what its code is keyed on. */
const REGION_TAIL: string =
  ": a scope's tasks run, and store their answers, when its block ends, and under Node each runs and stores " +
  "where it is spawned, so a destination is a fresh `const` array that is never handed on, and between a " +
  "scope's first `spawn` and the end of its block its thread neither reads a destination nor writes memory a task may read"

/**
 * What the function's body does with each of its variables, read once before
 * its regions are judged: whether it is a `const` bound to a fresh array (and
 * so may be a destination) or to a fresh array or object literal (and so may
 * be private), and whether any use of it hands it on or names it a destination.
 */
class VariableUses {
  locals: Local[]
  freshArray: boolean[]
  freshLiteral: boolean[]
  handedOn: boolean[]
  destination: boolean[]

  constructor() {
    this.locals = []
    this.freshArray = []
    this.freshLiteral = []
    this.handedOn = []
    this.destination = []
  }

  indexOf(local: Local | null): i32 {
    return local === null ? -1 : this.locals.indexOf(local)
  }

  add(local: Local): i32 {
    const at = this.indexOf(local)
    if (at >= 0) {
      return at
    }
    this.locals.push(local)
    this.freshArray.push(false)
    this.freshLiteral.push(false)
    this.handedOn.push(false)
    this.destination.push(false)
    return this.locals.length - 1
  }

  /** A `const` bound to a fresh array, never handed on: what a destination has to be. */
  isDestinationShaped(local: Local | null): boolean {
    const at = this.indexOf(local)
    return at >= 0 && this.freshArray[at] && !this.handedOn[at]
  }

  /** A `const` bound to a fresh literal, never handed on and never a destination: nothing but this function reaches it. */
  isPrivate(local: Local | null): boolean {
    const at = this.indexOf(local)
    return at >= 0 && this.freshLiteral[at] && !this.handedOn[at] && !this.destination[at]
  }
}

/** Whether `init` is a fresh array: a literal, or `new Array(...)`. */
const isFreshArray = (init: Node): boolean => {
  const e = unwrapParens(init)
  return (
    e.kind === N_ARRAY ||
    (e.kind === N_NEW && e.children[0].kind === N_IDENT && e.children[0].text === "Array")
  )
}

/** Whether `init` is a fresh array or object literal, whose own slots nothing else reaches. */
const isFreshLiteral = (init: Node): boolean => isFreshArray(init) || unwrapParens(init).kind === N_OBJECT

/** The `spawn` instance `node` calls, when it is a call of one; `null` otherwise. */
const spawnCallee = (program: CheckedProgram, node: Node): FunctionSig | null => {
  if (node.kind !== N_CALL || node.children[0].kind !== N_MEMBER) {
    return null
  }
  const callee = program.nodeCallees[node.id]
  return callee !== null && isSpawnEntry(callee) ? callee : null
}

/** The local `node` names, when it is an identifier (parenthesised or not); `null` otherwise. */
const namedLocal = (program: CheckedProgram, node: Node): Local | null => {
  const e = unwrapParens(node)
  return e.kind === N_IDENT ? program.nodeLocals[e.id] : null
}

/**
 * A task's argument read out of a variable, `ps[0]` or `p.f`, hands that
 * variable on, although a base use elsewhere does not: the task reads its
 * argument when the scope joins, and an element of a record array is the
 * address of its slot, so a store into `ps[0]` before the join changed what
 * the task saw and raced with it under `--threads` (docs/security/codegen.md,
 * CG-7). Handed on, the variable is no longer private, and the region refuses
 * the store. Each arm of a `?:` or a `??` is an argument the task may get.
 */
const handOnRoot = (program: CheckedProgram, arg: Node, uses: VariableUses): void => {
  const top = unwrapParens(arg)
  if (top.kind === N_CONDITIONAL) {
    handOnRoot(program, top.children[1], uses)
    handOnRoot(program, top.children[2], uses)
    return
  }
  if (top.kind === N_BINARY && top.text === "??") {
    handOnRoot(program, top.children[0], uses)
    handOnRoot(program, top.children[1], uses)
    return
  }
  let e = top
  while (e.kind === N_INDEX || e.kind === N_MEMBER) {
    e = unwrapParens(e.children[0])
  }
  const local: Local | null = e !== top ? namedLocal(program, e) : null
  if (local !== null) {
    uses.handedOn[uses.add(local)] = true
  }
}

/**
 * Record what `node` does with the variables it names. A use of a variable
 * keeps it unhanded only as the base of an index or a member, as the iterable
 * of a `for...of`, or as a `spawn`'s destination, which is recorded as such.
 */
const collectUses = (program: CheckedProgram, node: Node, parent: Node | null, uses: VariableUses): void => {
  if (node.kind === N_VAR) {
    const constant = (node.flags & FLAG_CONST) !== 0
    for (const decl of node.children[0].children) {
      const local = program.nodeLocals[decl.id]
      if (local !== null) {
        const at = uses.add(local)
        uses.freshArray[at] = constant && isFreshArray(decl.children[2])
        uses.freshLiteral[at] = constant && isFreshLiteral(decl.children[2])
      }
    }
  }
  if (node.kind === N_IDENT && parent !== null) {
    const local = program.nodeLocals[node.id]
    if (local !== null) {
      const at = uses.add(local)
      const base =
        ((parent.kind === N_INDEX || parent.kind === N_MEMBER) &&
          unwrapParens(parent.children[0]) === node) ||
        (parent.kind === N_FOR_OF && unwrapParens(parent.children[1]) === node)
      const declared = parent.kind === N_VAR_DECL && parent.children[0] === node
      if (!base && !declared) {
        uses.handedOn[at] = true
      }
    }
  }
  const callee = spawnCallee(program, node)
  if (callee !== null) {
    const args = node.children[1].children
    let k = 0
    while (k < args.length) {
      const arg = args[k]
      const local: Local | null = k === 2 ? namedLocal(program, arg) : null
      if (local !== null) {
        uses.destination[uses.add(local)] = true
      } else {
        collectUses(program, arg, node.children[1], uses)
        handOnRoot(program, arg, uses)
      }
      k = k + 1
    }
    collectUses(program, node.children[0], node, uses)
    return
  }
  if (node.kind === N_PAREN && parent !== null) {
    // A parenthesised name is used as its parentheses are.
    for (const child of node.children) {
      collectUses(program, child, parent, uses)
    }
    return
  }
  for (const child of node.children) {
    collectUses(program, child, node, uses)
  }
}

/** One scope's region being walked: the scope's locals, its name, and the destinations its tasks store into so far. */
class RegionState {
  locals: Local[]
  name: string
  destinations: Local[]
  /** WP29 P3: the argument type of every task of the scope, which is what R7 asks a lock about. */
  taskArgs: i32[]

  constructor(locals: Local[], name: string) {
    this.locals = locals
    this.name = name
    this.destinations = []
    this.taskArgs = []
  }

  owns(local: Local | null): boolean {
    return local !== null && this.locals.indexOf(local) >= 0
  }

  isDestination(local: Local | null): boolean {
    return local !== null && this.destinations.indexOf(local) >= 0
  }

  addDestination(local: Local | null): void {
    if (local !== null && this.destinations.indexOf(local) < 0) {
      this.destinations.push(local)
    }
  }

  /** Whether a task can have been filed by now: the first `spawn`, or one in a loop around this. */
  live(): boolean {
    return this.destinations.length > 0
  }
}

/** The local a `spawn` call's receiver names, or `null`. */
const spawnReceiver = (program: CheckedProgram, node: Node): Local | null =>
  namedLocal(program, node.children[0].children[0])

/** The local a `spawn` call names as its destination, or `null`. */
const spawnDestination = (program: CheckedProgram, node: Node): Local | null => {
  const args = node.children[1].children
  return args.length > 2 ? namedLocal(program, args[2]) : null
}

/** Whether `node` or anything under it (outside an arrow) is a `spawn` on `state`'s scope. */
const holdsSpawnOn = (program: CheckedProgram, node: Node, state: RegionState): boolean => {
  if (node.kind === N_ARROW) {
    return false
  }
  if (spawnCallee(program, node) !== null && state.owns(spawnReceiver(program, node))) {
    return true
  }
  for (const child of node.children) {
    if (holdsSpawnOn(program, child, state)) {
      return true
    }
  }
  return false
}

/** The argument type of every `spawn` on `state`'s scope under `node`, for R7. */
const collectTaskArgs = (program: CheckedProgram, node: Node, state: RegionState): void => {
  if (node.kind === N_ARROW) {
    return
  }
  const callee = spawnCallee(program, node)
  if (callee !== null && state.owns(spawnReceiver(program, node))) {
    const instance = callee.instance
    if (instance !== null && instance.typeArgs.length > 0) {
      state.taskArgs.push(instance.typeArgs[0])
    }
  }
  for (const child of node.children) {
    collectTaskArgs(program, child, state)
  }
}

/** Every destination of a `spawn` on `state`'s scope under `node`: what a loop's later passes will have stored into. */
const collectDestinations = (program: CheckedProgram, node: Node, state: RegionState): void => {
  if (node.kind === N_ARROW) {
    return
  }
  if (spawnCallee(program, node) !== null && state.owns(spawnReceiver(program, node))) {
    state.addDestination(spawnDestination(program, node))
  }
  for (const child of node.children) {
    collectDestinations(program, child, state)
  }
}

const destinationMessage = (): string =>
  "The destination of this `spawn` must be a `const` local bound to a fresh array (a literal or `new Array`), " +
  `used only by index, \`.length\`, its methods and as a destination${REGION_TAIL}`

const regionReadMessage = (state: RegionState, name: string): string =>
  `This reads \`${name}\`, a destination of a task of \`${state.name}\`, before the scope joins${REGION_TAIL}`

const regionWriteMessage = (state: RegionState, what: string): string =>
  `${what} writes memory a task of \`${state.name}\` may read, before the scope joins${REGION_TAIL}`

/** Whether `target` is memory rather than a local: an element or a field. */
const isMemoryTarget = (target: Node): boolean => {
  const t = unwrapParens(target)
  return t.kind === N_INDEX || t.kind === N_MEMBER
}

/** Whether `target`, an assignment's left side, is one of a private local's own slots: `p[i]` or `p.f`. */
const isPrivateSlot = (program: CheckedProgram, target: Node, uses: VariableUses): boolean => {
  const t = unwrapParens(target)
  return (t.kind === N_INDEX || t.kind === N_MEMBER) && uses.isPrivate(namedLocal(program, t.children[0]))
}

/**
 * The builtin a call is, when it writes the elements of an array that is not
 * a private local (`builtinArgumentLetters`), or "": `crypto.getRandomValues`
 * (WP34 N3) and the `nish:net` calls that fill a `u8[]` (WP34 N5).
 */
const sharedWriteBuiltin = (program: CheckedProgram, call: Node, uses: VariableUses): string => {
  const letters = builtinArgumentLetters(program, call)
  const args = call.children[1].children
  for (let i = 0; i < args.length; i++) {
    if (isWrittenArgument(letters, i) && !uses.isPrivate(namedLocal(program, args[i]))) {
      const callee = call.children[0]
      return callee.kind === N_IDENT ? builtinNameOf(program, call) : dottedName(callee)
    }
  }
  return ""
}

/**
 * The refusal for a call in the region, or "": `Arena`, `push`, `pop`, `set` or `fill` on
 * anything but a private local, a builtin that fills such an array, a task of
 * another scope, or a function that writes through a pointer it is handed.
 */
const regionCallMessage = (
  program: CheckedProgram,
  table: TypeTable,
  facts: FactsTable,
  node: Node,
  state: RegionState,
  uses: VariableUses
): string => {
  const callee = node.children[0]
  // WP34 N3 and N5: a builtin that fills an array writes its elements as
  // `fill` does, so it is refused where `fill` is.
  const writer = sharedWriteBuiltin(program, node, uses)
  if (writer.length > 0) {
    return regionWriteMessage(state, `\`${writer}\``)
  }
  if (callee.kind === N_MEMBER) {
    const receiver = unwrapParens(callee.children[0])
    // `r.orReturn()` returns early through its own path, which leaves the
    // block without the join a `return` or the block's end makes: the task
    // stayed filed, and the next scope's join ran it through pointers into
    // memory this function's arena scope had released (CG-6).
    if (resultMethodName(program, table, node) === "orReturn") {
      return `\`orReturn\` returns without joining \`${state.name}\`, before the scope joins${REGION_TAIL}`
    }
    if (receiver.kind === N_IDENT && receiver.text === "Arena" && program.nodeLocals[receiver.id] === null) {
      return regionWriteMessage(state, `\`Arena.${callee.text}\``)
    }
    if (state.isDestination(namedLocal(program, receiver))) {
      return regionReadMessage(state, receiver.text)
    }
    // WP34 N2: `set` and `fill` write the receiver's elements as surely as a
    // store to `a[i]` does, so they are refused where `push` and `pop` are.
    if (isArrayWriteMethod(callee.text) && !uses.isPrivate(namedLocal(program, receiver))) {
      const type = program.nodeTypes[receiver.id]
      if (type >= 0 && program.nodeCallees[node.id] === null) {
        return regionWriteMessage(state, `\`${callee.text}\``)
      }
    }
  }
  const sig = program.nodeCallees[node.id]
  if (sig === null) {
    return ""
  }
  if (isSpawnEntry(sig)) {
    return regionWriteMessage(state, "A task of another scope, whose join stores its answer,")
  }
  const own = facts.get(sig.name)
  if (own === null) {
    return regionWriteMessage(state, `\`${sig.sourceName}\``)
  }
  for (const pp of own.pointerParams) {
    // WP29 P3: what a call does to a channel is C4's and C5's to judge (`checkChannels`).
    if (pp.writesThrough && !isChannelParam(program, table, sig, pp.name)) {
      return regionWriteMessage(state, `\`${sig.sourceName}\``)
    }
  }
  return ""
}

/** Whether `sig`'s parameter `name` is a `Channel`. */
const isChannelParam = (
  program: CheckedProgram,
  table: TypeTable,
  sig: FunctionSig,
  name: string
): boolean => {
  const at = sig.paramNames.indexOf(name)
  return at >= 0 && isChannelType(program, table, sig.paramTypes[at])
}

/** Walk `node`, parent code inside `state`'s region, pushing each refusal. */
const walkRegion = (
  program: CheckedProgram,
  table: TypeTable,
  facts: FactsTable,
  uses: VariableUses,
  node: Node,
  state: RegionState,
  out: ScopeFinding[]
): void => {
  if (node.kind === N_ARROW) {
    return // a lifted function of its own; it runs only when called
  }
  if (node.kind === N_RETURN) {
    return // every scope joins before a `return` computes its value
  }
  if (node.kind === N_FOR || node.kind === N_WHILE || node.kind === N_DO || node.kind === N_FOR_OF) {
    // A later pass sees what every spawn inside the loop stored on the passes before.
    collectDestinations(program, node, state)
  }
  if (spawnCallee(program, node) !== null && state.owns(spawnReceiver(program, node))) {
    // The task's argument and destination are the parent's code, evaluated
    // before the task is filed.
    for (const arg of node.children[1].children) {
      walkRegion(program, table, facts, uses, arg, state, out)
    }
    state.addDestination(spawnDestination(program, node))
    return
  }
  // WP29 P3, R7: a lock anywhere from the statement that holds the first
  // `spawn` — before that spawn too, as on a loop's next pass — to the end of
  // the block, directly or through a call.
  if (node.kind === N_CALL) {
    const locked = regionLockMessageFor(program, table, facts, node, state)
    if (locked.length > 0) {
      out.push(new ScopeFinding(node, locked))
      return
    }
  }
  // Until a task can have been filed, nothing can tell when it runs.
  if (!state.live()) {
    for (const child of node.children) {
      walkRegion(program, table, facts, uses, child, state, out)
    }
    return
  }
  let message = ""
  if (node.kind === N_BINARY && isAssignmentOperator(node.text) && isMemoryTarget(node.children[0])) {
    if (!isPrivateSlot(program, node.children[0], uses)) {
      message = regionWriteMessage(state, "This assignment")
    }
  } else if (
    node.kind === N_UNARY &&
    (node.text === "++" || node.text === "--") &&
    isMemoryTarget(node.children[0]) &&
    !isPrivateSlot(program, node.children[0], uses)
  ) {
    message = regionWriteMessage(state, `This \`${node.text}\``)
  } else if (node.kind === N_INDEX && state.isDestination(namedLocal(program, node.children[0]))) {
    message = regionReadMessage(state, unwrapParens(node.children[0]).text)
  } else if (node.kind === N_FOR_OF && state.isDestination(namedLocal(program, node.children[1]))) {
    message = regionReadMessage(state, unwrapParens(node.children[1]).text)
  } else if (node.kind === N_CALL) {
    message = regionCallMessage(program, table, facts, node, state, uses)
  }
  if (message.length > 0) {
    out.push(new ScopeFinding(node, message))
    return
  }
  for (const child of node.children) {
    walkRegion(program, table, facts, uses, child, state, out)
  }
}

/** Every `spawn` under `node` whose destination is not a fresh, unhanded `const` array. */
const checkDestinations = (
  program: CheckedProgram,
  node: Node,
  uses: VariableUses,
  out: ScopeFinding[]
): void => {
  if (node.kind === N_ARROW) {
    return
  }
  if (spawnCallee(program, node) !== null) {
    const args = node.children[1].children
    if (args.length > 2 && !uses.isDestinationShaped(namedLocal(program, args[2]))) {
      out.push(new ScopeFinding(args[2], destinationMessage()))
    }
  }
  for (const child of node.children) {
    checkDestinations(program, child, uses, out)
  }
}

/**
 * Every block under `node` that declares a scope, with that scope's region
 * judged: from the block's first statement to hold a `spawn` on the scope to
 * the block's end.
 */
const findRegions = (
  program: CheckedProgram,
  table: TypeTable,
  facts: FactsTable,
  uses: VariableUses,
  node: Node,
  out: ScopeFinding[]
): void => {
  if (node.kind === N_ARROW) {
    return
  }
  if (node.kind === N_BLOCK) {
    let i = 0
    while (i < node.children.length) {
      const stmt = node.children[i]
      if (stmt.kind === N_VAR && (stmt.flags & FLAG_USING) !== 0) {
        const locals: Local[] = []
        for (const decl of stmt.children[0].children) {
          const local = program.nodeLocals[decl.id]
          if (local !== null) {
            locals.push(local)
          }
        }
        const state = new RegionState(locals, locals.length > 0 ? locals[0].name : "scope")
        let k = i + 1
        while (k < node.children.length) {
          collectTaskArgs(program, node.children[k], state)
          k = k + 1
        }
        let started = false
        let j = i + 1
        while (j < node.children.length) {
          const later = node.children[j]
          started = started || holdsSpawnOn(program, later, state)
          if (started) {
            walkRegion(program, table, facts, uses, later, state, out)
          }
          j = j + 1
        }
      }
      i = i + 1
    }
  }
  for (const child of node.children) {
    findRegions(program, table, facts, uses, child, out)
  }
}

/** The destination rule and every region of one function's body. */
const checkBody = (
  program: CheckedProgram,
  table: TypeTable,
  facts: FactsTable,
  body: Node,
  out: ScopeFinding[]
): void => {
  const uses = new VariableUses()
  collectUses(program, body, null, uses)
  checkDestinations(program, body, uses, out)
  findRegions(program, table, facts, uses, body, out)
}

// ---- WP29 P3: a lock that owns its data ---------------------------------------------------
//
// `const m = new Mutex<Hist>(new Hist()); ... { using g = m.lock(); g.value.n = g.value.n + 1 }`.
// A `Mutex`'s data is reachable only through the guard its `lock()` answers,
// which `using` binds, and every rule below keeps it that way
// (docs/wp29-thread-surface.md §4.3, R1–R8):
//
//   - R1: the data is fresh when it is locked away, and a `Mutex` has no
//     member a program may name but `lock`;
//   - R2: `m.lock()` is only the initialiser of a `using` declaration, whose
//     block releases the lock at every exit (`src/emit-parallel.ts`);
//   - R3 and R4: a guard is only `g.value`, and what is derived from it is
//     only the base of another access, a scalar read, or a scalar store into
//     a field or an element that already exists: nothing derived from it
//     outlives the block, and nothing a task's arena holds is stored into it;
//   - R5: inside a guard's block, directly or through any call, no second
//     lock, no scope, no `spawn` and no data-parallel call, so one lock is
//     held at a time and nothing is waited on while it is held: a program
//     cannot deadlock;
//   - R6: a store through a guard is the one shared write a task may make
//     (`isGuardedAccess`, which the fixpoint asks before it counts a store);
//   - R7: between a scope's first `spawn` and the end of its block the parent
//     does not lock a mutex the scope's tasks can reach, because natively
//     they have not run yet and under Node they have;
//   - R8: a `Mutex` reaches a task as its argument or as a field of the class
//     its argument is, which keeps R7's reachability a question about types.

/** The classes `nish/threads` declares for the lock. */
const MUTEX: string = "Mutex"
const MUTEX_GUARD: string = "MutexGuard"

/** Whether `info` is an instantiation of `nish/threads`'s generic class `name`. */
const isThreadsClass = (info: StructInfo | null, name: string): boolean => {
  if (info === null) {
    return false
  }
  const instance = info.instance
  return (
    instance !== null &&
    instance.template.sourceName === name &&
    isThreadsModule(instance.template.home.program)
  )
}

/** The layout of `type` when it is a class, `null` otherwise. */
const classLayoutOf = (program: CheckedProgram, table: TypeTable, type: i32): StructInfo | null =>
  type >= 0 && table.isStruct(type) ? program.struct(table.nameOf(type)) : null

/** Whether `type` is a `Mutex<T>` from `nish/threads`. */
const isMutexType = (program: CheckedProgram, table: TypeTable, type: i32): boolean =>
  isThreadsClass(classLayoutOf(program, table, type), MUTEX)

/** Whether `type` is a `MutexGuard<T>` from `nish/threads`. */
const isGuardType = (program: CheckedProgram, table: TypeTable, type: i32): boolean =>
  isThreadsClass(classLayoutOf(program, table, type), MUTEX_GUARD)

// ---- WP29 P3: the channel's members, as the checker, the fixpoint and the emitter see them ----

/** The class `nish/threads` declares for a channel. */
const CHANNEL: string = "Channel"

/** Whether `info` is a `Channel<T>` from `nish/threads`. */
export const isChannelClass = (info: StructInfo): boolean => isThreadsClass(info, CHANNEL)

/** Whether `type` is a `Channel<T>` from `nish/threads`. */
export const isChannelType = (program: CheckedProgram, table: TypeTable, type: i32): boolean =>
  isThreadsClass(classLayoutOf(program, table, type), CHANNEL)

/** Whether `sig` is the method `name` of a `Channel<T>` from `nish/threads`. */
const isChannelMethod = (sig: FunctionSig, name: string): boolean =>
  isThreadsClass(sig.owner, CHANNEL) && sig.decl.kind === N_METHOD && sig.decl.children[0].text === name

/** Whether `sig` is `Channel<T>.send`, whose body the emitter writes. */
export const isChannelSend = (sig: FunctionSig): boolean => isChannelMethod(sig, "send")

/** Whether `sig` is `Channel<T>.take`, the reader a loop over a channel records and never calls. */
export const isChannelReader = (sig: FunctionSig): boolean => isChannelMethod(sig, "take")

/** Whether `sig` is `Mutex<T>.lock` from `nish/threads`, whose body the emitter writes. */
export const isLockMethod = (sig: FunctionSig): boolean =>
  isThreadsClass(sig.owner, MUTEX) && sig.decl.kind === N_METHOD && sig.decl.children[0].text === "lock"

/** Whether `node` is a call of a `Mutex`'s `lock()`. */
export const isLockCall = (program: CheckedProgram, node: Node): boolean => {
  if (node.kind !== N_CALL) {
    return false
  }
  const callee = program.nodeCallees[node.id]
  return callee !== null && isLockMethod(callee)
}

/**
 * Whether `node` is `g.value` or an access through it — `g.value.f`,
 * `g.value.xs[i]` — for a guard `g`: what R3 and R4 hold to their rules, and
 * the one shared memory a task may write (R6). A guard is only ever a `using`
 * binding named as `g.value` (R3), so its type is the whole test.
 */
export const isGuardedAccess = (program: CheckedProgram, table: TypeTable, node: Node): boolean => {
  const e = unwrapParens(node)
  if (e.kind !== N_MEMBER && e.kind !== N_INDEX) {
    return false
  }
  const base = unwrapParens(e.children[0])
  if (e.kind === N_MEMBER && e.text === "value" && isGuardType(program, table, program.nodeTypes[base.id])) {
    return true
  }
  return isGuardedAccess(program, table, base)
}

/** The tail every refusal of R5 shares, which is what its code is keyed on. */
const GUARD_HELD_TAIL: string =
  ": inside a guard's block, directly or through any function it calls, there is no second `lock()`, " +
  "no `scope()` or `spawn`, and no `parallelMapInto` or `parallelReduce`, so one lock is held at a time " +
  "and nothing is waited on while it is held"

const mutexFreshMessage = (): string =>
  "`new Mutex` takes a value that is fresh all the way down — a `new` expression or a literal whose every " +
  "argument or element is a number, a `boolean`, an enum, a string literal or itself fresh — because the data a " +
  "`Mutex` owns is reachable only through its guard, and a value the program already holds would be a path to " +
  "it that skips the lock"

const mutexMemberMessage = (name: string): string =>
  `\`${name}\` is not a member a program may name: the data a \`Mutex\` owns is reachable only through ` +
  "the guard its `lock()` answers, `using g = m.lock()`, so every path to it takes the lock"

const lockNotUsingMessage = (): string =>
  "`lock()` must be the initialiser of a `using` declaration, `using g = m.lock()`: the lock is released " +
  "when the block that declares it ends, so a guard bound any other way would be one nobody releases"

const guardUseMessage = (name: string): string =>
  `A guard is used only as \`${name}.value\`, and \`${name}.value\` only as the base of a field or element ` +
  "read or store: passed, bound, stored, returned or walked, what it reaches would outlive the block that holds the lock"

const guardDerivedMessage = (table: TypeTable, type: i32): string =>
  `This is a \`${table.typeName(type)}\` read through a guard, which is used only as the base of a field or ` +
  "element read or store: a value that is not a number, a `boolean` or an enum would outlive the block that holds the lock"

const guardStoreMessage = (table: TypeTable, type: i32): string =>
  `This stores a \`${table.typeName(type)}\` through a guard, which stores only a number, a \`boolean\` or ` +
  "an enum, into a field or an element that already exists: a task's arena is freed when it is joined, and " +
  "a pointer into it stored here would dangle"

const guardMethodMessage = (name: string): string =>
  `\`${name}\` is called through a guard, which reads and stores fields and elements and calls no method: ` +
  "a method could keep what it reaches, or grow an array into a task's arena, which is freed when it is joined"

const guardHeldMessage = (what: string, guard: string): string =>
  `${what} is reached while \`${guard}\` holds its lock${GUARD_HELD_TAIL}`

/** R6, in `sharedWriteMessage`'s words for a task. */
const TASK_WRITE_TAIL: string =
  ", and `spawn` runs it beside the scope's other tasks: a task may write shared memory only through the " +
  "guard of a `Mutex`, `using g = m.lock()`"

const regionLockMessage = (state: RegionState, what: string, path: string): string =>
  `${what} locks a \`Mutex\` a task of \`${state.name}\` can reach through \`${path}\`, before the scope ` +
  "joins: natively the scope's tasks run when its block ends and under Node each runs where it is spawned, " +
  "so the parent locks what they share only before the statement that holds the first `spawn` or after the join"

const taskMutexMessage = (table: TypeTable, type: i32, path: string): string =>
  `The argument of \`spawn\` is \`${table.typeName(type)}\`, which reaches a \`Mutex\` through \`${path}\`: ` +
  "a `Mutex` reaches a task as its argument or as a field of the class its argument is, never deeper, so " +
  "which tasks share a lock is a question the checker can answer"

const bodyLockMessage = (sig: FunctionSig, fn: FunctionSig): string =>
  `\`${fn.sourceName}\` takes a \`Mutex\`'s lock, and \`${intrinsicName(sig)}\` runs it on several threads ` +
  "at once: a lock is taken by a scope's task or by the thread that opened the scope, never by a parallel body"

/**
 * Whether `init`, the argument of `new Mutex` or a part of it, is fresh all
 * the way down (R1): a scalar, which is copied in; a string literal, which is
 * immutable and which R4 never stores over; or a `new` expression, an array
 * literal or an object literal whose every argument, element or value is
 * fresh by this rule. `new Hist(bins)` with a named `bins` is not: the
 * program would still hold `bins` after the lock owned it.
 */
const isFreshValue = (program: CheckedProgram, table: TypeTable, init: Node): boolean => {
  const e = unwrapParens(init)
  const type = program.nodeTypes[e.id]
  if ((type >= 0 && isScalarArgument(table, type)) || e.kind === N_STRING) {
    return true
  }
  let parts: Node[] = []
  if (e.kind === N_NEW) {
    parts = e.children[2].children
  } else if (e.kind === N_ARRAY) {
    parts = e.children
  } else if (e.kind === N_OBJECT) {
    for (const property of e.children) {
      if (property.kind !== N_PROPERTY) {
        return false // a spread copies what another object holds
      }
      parts.push(property.children[0])
    }
  } else {
    return false
  }
  for (const part of parts) {
    if (!isFreshValue(program, table, part)) {
      return false
    }
  }
  return true
}

/** Whether `name`, among the runtime symbols a call can reach, is one R5 refuses while a lock is held. */
const isWaitSymbol = (name: string, locksOnly: boolean): boolean =>
  name === "nish_mutex_wait" ||
  (!locksOnly &&
    (name === "nish_scope_spawn" || name === "nish_parallel_range" || name === "nish_scope_join"))

/**
 * Whether a call of `name` reaches, through its callees, a lock (`locksOnly`)
 * or anything R5 refuses inside a guard's block: a lock, a task filed or
 * joined, or a data-parallel region. Each is a runtime symbol the fixpoint has
 * put among the callees of the function that reaches it (`markLock`,
 * `markParallelEntry` in `src/attributes.ts`).
 */
const reachesWait = (facts: FactsTable, name: string, locksOnly: boolean, seen: StringSet): boolean => {
  if (isWaitSymbol(name, locksOnly)) {
    return true
  }
  if (!seen.add(name)) {
    return false
  }
  const own = facts.get(name)
  if (own === null) {
    return false
  }
  let c = 0
  while (c < own.callees.size()) {
    if (reachesWait(facts, own.callees.at(c), locksOnly, seen)) {
      return true
    }
    c = c + 1
  }
  return false
}

/** Whether a call of `fn` takes a lock, directly or through any callee. */
const takesLock = (facts: FactsTable, fn: FunctionSig): boolean =>
  reachesWait(facts, fn.name, true, new StringSet())

/** The refusal of a parallel body that takes a lock, or "". */
export const bodyLockMessageFor = (sig: FunctionSig, fn: FunctionSig, facts: FactsTable): string =>
  takesLock(facts, fn) ? bodyLockMessage(sig, fn) : ""

/**
 * The field path from a value of `type` to a `Mutex` — `want`, or any when
 * `want` is -1 — or "" when there is none. `root` is how the path starts, and
 * `seen` keeps a recursive struct from being walked twice. A `Mutex`'s own
 * data is reached through its guard, as the program reaches it.
 */
const mutexPath = (
  table: TypeTable,
  program: CheckedProgram,
  type: i32,
  want: i32,
  root: string,
  seen: StringSet
): string => {
  const kind = table.kindOf(type)
  if (kind === K_NULLABLE) {
    return mutexPath(table, program, table.refOf(type), want, root, seen)
  }
  if (kind === K_ARRAY) {
    return mutexPath(table, program, table.refOf(type), want, `${root}[i]`, seen)
  }
  if (kind === K_RESULT) {
    const ok = mutexPath(table, program, table.okOf(type), want, `${root}.value`, seen)
    return ok.length > 0 ? ok : mutexPath(table, program, table.errOf(type), want, `${root}.error`, seen)
  }
  const info = classLayoutOf(program, table, type)
  if (info === null) {
    return ""
  }
  if (isThreadsClass(info, MUTEX) && (want < 0 || type === want)) {
    return root
  }
  if (!seen.add(info.name)) {
    return ""
  }
  for (const field of info.fields) {
    const path = mutexPath(table, program, field.type, want, `${root}.${field.name}`, seen)
    if (path.length > 0) {
      return path
    }
  }
  return ""
}

/**
 * The path to a `Mutex` held inside the data of the `Mutex` `type`, which R8
 * refuses: one task would reach the inner lock only while it holds the outer.
 */
const mutexInside = (table: TypeTable, program: CheckedProgram, type: i32, root: string): string => {
  const info = classLayoutOf(program, table, type)
  if (info === null) {
    return ""
  }
  for (const field of info.fields) {
    const path = mutexPath(table, program, field.type, -1, `${root}.${field.name}`, new StringSet())
    if (path.length > 0) {
      return path
    }
  }
  return ""
}

/**
 * R8: the argument of a task reaches a `Mutex` only as itself or as a field of
 * the class it is, and no `Mutex`'s data holds another. The refusal, or "".
 */
export const taskMutexMessageFor = (table: TypeTable, program: CheckedProgram, sig: FunctionSig): string => {
  const instance = sig.instance
  if (instance === null || instance.typeArgs.length === 0) {
    return ""
  }
  const arg = instance.typeArgs[0]
  const info = classLayoutOf(program, table, arg)
  let path = ""
  if (info === null) {
    path = mutexPath(table, program, arg, -1, "arg", new StringSet())
  } else if (isThreadsClass(info, MUTEX)) {
    path = mutexInside(table, program, arg, "arg")
  } else {
    let k = 0
    while (k < info.fields.length && path.length === 0) {
      const field = info.fields[k]
      const root = `arg.${field.name}`
      path = isMutexType(program, table, field.type)
        ? mutexInside(table, program, field.type, root)
        : mutexPath(table, program, field.type, -1, root, new StringSet())
      k = k + 1
    }
  }
  return path.length === 0 ? "" : taskMutexMessage(table, arg, path)
}

/** Whether `node`, at `at` under the first `depth` of `parents`, is a store's target: `x = v`, `x += v`, `x++`. */
const isStoreTarget = (at: Node, parents: Node[], depth: i32): boolean => {
  if (depth < 1) {
    return false
  }
  const parent = parents[depth - 1]
  if (parent.kind === N_BINARY && isAssignmentOperator(parent.text)) {
    return parent.children[0] === at
  }
  return parent.kind === N_UNARY && (parent.text === "++" || parent.text === "--")
}

/** R1–R4 at `node` and under it, with `parents` outermost first: every refusal is pushed onto `out`. */
const walkMutexes = (
  program: CheckedProgram,
  table: TypeTable,
  node: Node,
  parents: Node[],
  out: ScopeFinding[]
): void => {
  // A parenthesised expression is judged as what it wraps, where it stands.
  let at = node
  let depth = parents.length
  while (depth > 0 && parents[depth - 1].kind === N_PAREN) {
    at = parents[depth - 1]
    depth = depth - 1
  }
  const parent: Node | null = depth > 0 ? parents[depth - 1] : null
  const type = program.nodeTypes[node.id]
  const declaresName =
    parent !== null && (parent.kind === N_VAR_DECL || parent.kind === N_PARAM) && parent.children[0] === at
  const called = parent !== null && parent.kind === N_CALL && parent.children[0] === at
  if (node.kind === N_PAREN || declaresName) {
    // judged as what it wraps, or a declaration rather than a use
  } else if (node.kind === N_NEW && isMutexType(program, table, type)) {
    const args = node.children[2].children
    if (args.length > 0 && !isFreshValue(program, table, args[0])) {
      out.push(new ScopeFinding(args[0], mutexFreshMessage()))
    }
  } else if (node.kind === N_MEMBER && isMutexType(program, table, program.nodeTypes[node.children[0].id])) {
    if (!(node.text === "lock" && called)) {
      out.push(new ScopeFinding(node, mutexMemberMessage(node.text)))
      return
    }
  } else if (isLockCall(program, node)) {
    if (!isUsingInitialiser(at, parents, depth)) {
      out.push(new ScopeFinding(node, lockNotUsingMessage()))
    }
  } else if (isGuardType(program, table, type)) {
    const named = node.kind === N_IDENT ? node.text : "g"
    const asValue =
      node.kind === N_IDENT &&
      parent !== null &&
      parent.kind === N_MEMBER &&
      parent.text === "value" &&
      parent.children[0] === at
    if (!asValue) {
      out.push(new ScopeFinding(node, guardUseMessage(named)))
      return
    }
  } else if (isGuardedAccess(program, table, node) && parent !== null) {
    const base = (parent.kind === N_MEMBER || parent.kind === N_INDEX) && parent.children[0] === at
    const above: Node | null = depth > 1 ? parents[depth - 2] : null
    if (
      base &&
      parent.kind === N_MEMBER &&
      above !== null &&
      above.kind === N_CALL &&
      above.children[0] === parent
    ) {
      out.push(new ScopeFinding(above, guardMethodMessage(parent.text)))
    } else if (base) {
      // an access through it: judged where it ends
    } else if (isStoreTarget(at, parents, depth)) {
      // A store's target has no type of its own in the tables; what is stored is the value's.
      const stored = parent.kind === N_BINARY ? program.nodeTypes[parent.children[1].id] : type
      if (stored >= 0 && !isScalarArgument(table, stored)) {
        out.push(new ScopeFinding(parent, guardStoreMessage(table, stored)))
      }
    } else if (type >= 0 && !isScalarArgument(table, type)) {
      out.push(new ScopeFinding(node, guardDerivedMessage(table, type)))
      return
    }
  }
  parents.push(node)
  for (const child of node.children) {
    walkMutexes(program, table, child, parents, out)
  }
  parents.pop()
}

/** What R5 refuses at `node` while a lock is held, in words, or "". */
const heldWhat = (program: CheckedProgram, facts: FactsTable, node: Node, scopeType: i32): string => {
  if (node.kind !== N_CALL) {
    return ""
  }
  if (isLockCall(program, node)) {
    return "A second `lock()`"
  }
  if (isScopeCall(program, node, scopeType)) {
    return "`scope()`"
  }
  const callee = program.nodeCallees[node.id]
  if (callee === null) {
    return ""
  }
  if (isSpawnEntry(callee) || isParallelEntry(callee)) {
    return `\`${intrinsicName(callee)}\``
  }
  if (reachesWait(facts, callee.name, false, new StringSet())) {
    return `\`${callee.sourceName}\`, which takes a lock or waits for threads,`
  }
  return ""
}

/** R5 over `node`, a statement after the `using` that bound the guard `name`, and everything under it. */
const walkHeld = (
  program: CheckedProgram,
  facts: FactsTable,
  node: Node,
  name: string,
  scopeType: i32,
  out: ScopeFinding[]
): void => {
  if (node.kind === N_ARROW) {
    return // a lifted function of its own; a call that runs it is judged where it is
  }
  // WP29 P3, C7: a receive waits, as surely as a second lock does.
  const receive = receiveWhat(program, facts, node)
  if (receive.length > 0) {
    out.push(new ScopeFinding(node, guardReceiveMessage(receive, name)))
    return
  }
  const what = heldWhat(program, facts, node, scopeType)
  if (what.length > 0) {
    out.push(new ScopeFinding(node, guardHeldMessage(what, name)))
    return
  }
  for (const child of node.children) {
    walkHeld(program, facts, child, name, scopeType, out)
  }
}

/** Every block under `node` that binds a guard, with R5 judged from the `using` to the block's end. */
const findGuardBlocks = (
  program: CheckedProgram,
  facts: FactsTable,
  node: Node,
  scopeType: i32,
  out: ScopeFinding[]
): void => {
  if (node.kind === N_BLOCK) {
    let i = 0
    while (i < node.children.length) {
      const stmt = node.children[i]
      if (stmt.kind === N_VAR && (stmt.flags & FLAG_USING) !== 0) {
        for (const decl of stmt.children[0].children) {
          if (isLockCall(program, unwrapParens(decl.children[2]))) {
            let j = i + 1
            while (j < node.children.length) {
              walkHeld(program, facts, node.children[j], decl.children[0].text, scopeType, out)
              j = j + 1
            }
          }
        }
      }
      i = i + 1
    }
  }
  for (const child of node.children) {
    findGuardBlocks(program, facts, child, scopeType, out)
  }
}

/**
 * R7: the refusal of `node`, a call in `state`'s region, when it takes a lock
 * a task of the scope can reach — `m.lock()` on a `Mutex` of a type a task's
 * argument reaches, or a call that takes any lock when a task reaches any —
 * or "".
 */
const regionLockMessageFor = (
  program: CheckedProgram,
  table: TypeTable,
  facts: FactsTable,
  node: Node,
  state: RegionState
): string => {
  const callee = program.nodeCallees[node.id]
  if (callee === null) {
    return ""
  }
  let want = -1
  let what = `\`${callee.sourceName}\``
  if (isLockMethod(callee)) {
    want = program.nodeTypes[unwrapParens(node.children[0].children[0]).id]
    what = "This `lock()`"
  } else if (!takesLock(facts, callee)) {
    return ""
  }
  for (const arg of state.taskArgs) {
    const path = mutexPath(table, program, arg, want, "arg", new StringSet())
    if (path.length > 0) {
      return regionLockMessage(state, what, path)
    }
  }
  return ""
}

// ---- WP29 P3: channels of scalars ---------------------------------------------------------
//
// `const ch = new Channel<i32>(); { using s = scope(); s.spawn(produce, new
// Pipe(ch, 100), done, 0); s.spawn(consume, new Pipe(ch, 0), sums, 0) }`.
// A channel serves one run of one scope, and every rule below is what keeps
// "it closes when every sender has returned" one moment, and its one receiver
// from waiting on something that never comes (docs/wp29-thread-surface.md
// §4.4, C1–C7):
//
//   - C1: what it carries is a number, a `boolean` or an enum;
//   - C2: `new Channel` is a `const` declared beside its scope, and a channel
//     is used only as the receiver of `send`, the iterable of a `for...of`, an
//     argument, or a field its class's constructor sets from a parameter, and
//     reaches a task only as the task's argument, or a field of it, made at
//     the `spawn` out of a channel declared there;
//   - C3: it takes no capacity: `send` never waits;
//   - C4: one scope's tasks reach it, and the parent sends on it only before
//     that scope's block;
//   - C5: it has one receiver, a task spawned outside any loop or the parent
//     after the join, and the parent receives nothing inside a scope's block;
//   - C6: every task that may send on it is spawned before the one that
//     receives on it, and no task does both;
//   - C7: nothing receives while a lock is held.
//
// "May send" and "may receive" are read off the call graph from a task's
// entry: each function's summary says which of its parameters' channels it may
// send or receive on (`ChannelSummaries`), and a channel it reaches any other
// way counts as every channel its parameters reach. An over-count closes a
// channel later, or refuses a program, and never closes one early.

/** The tail every refusal of C2's declaration shares, which is what its code is keyed on. */
const CHANNEL_DECLARE_TAIL: string =
  ": a channel is a `const` declared in the block that holds its scope's `using s = scope()`, or in the " +
  "block that has the scope's block as one of its statements, before it, so each run of the declaration " +
  "makes a channel for one run of one scope"

/** C2's use. */
const CHANNEL_USE_TAIL: string =
  ": a channel is used only as the receiver of `send`, the iterable of a `for...of`, an argument, or a field " +
  "its class's constructor sets from a parameter, so it is never bound, stored, returned or captured, and " +
  "which tasks reach it is a question the checker can answer"

/** C4. */
const CHANNEL_SENDERS_TAIL: string =
  ": a channel is reachable from the tasks of one scope, the parent sends on it only before the block that " +
  "holds that scope's spawns, and nobody closes it: it closes once the scope has started to join and every " +
  "task that may send on it has returned"

/** C5. */
const CHANNEL_RECEIVER_TAIL: string =
  ": a channel has one receiver, either one task spawned outside any loop or the parent in a later statement " +
  "of the block that has the scope's block as one of its statements, and inside a scope's block the parent " +
  "receives nothing, so the parent's one wait is the join"

/** C6. */
const CHANNEL_ORDER_TAIL: string =
  ": under Node a task runs where it is spawned, so every task that may send on a channel is spawned, in the " +
  "block's statement order, before the one task that receives on it, and no task both sends and receives on " +
  "one channel, which is also what keeps channels from deadlocking"

/** C3: a channel takes no capacity. */
export const channelCapacityMessage = (): string =>
  "`new Channel` takes no capacity: a channel is unbounded and `send` never waits, because under Node a " +
  "scope's tasks run one at a time and nothing would drain a channel that was full"

const channelElementMessage = (table: TypeTable, type: i32): string =>
  `A \`Channel\` carries a number, a \`boolean\` or an enum, and this one would carry \`${table.typeName(type)}\`: ` +
  "a sender's arena is freed when its scope joins, so anything else would point into freed memory"

const channelDeclareMessage = (what: string): string => `${what}${CHANNEL_DECLARE_TAIL}`

const channelUseMessage = (what: string): string => `${what}${CHANNEL_USE_TAIL}`

const channelSendersMessage = (what: string): string => `${what}${CHANNEL_SENDERS_TAIL}`

const channelReceiverMessage = (what: string): string => `${what}${CHANNEL_RECEIVER_TAIL}`

const channelOrderMessage = (what: string): string => `${what}${CHANNEL_ORDER_TAIL}`

const guardReceiveMessage = (what: string, guard: string): string =>
  `${what} is reached while \`${guard}\` holds its lock: a receive waits, and nothing waits while a lock is ` +
  "held, so there is no receive inside a guard's block, directly or through any function it calls (a `send` " +
  "never waits, and may stay)"

/** Whether a call of `name` reaches the runtime symbol `symbol`, through its callees. */
const reachesSymbol = (facts: FactsTable, name: string, symbol: string, seen: StringSet): boolean => {
  if (name === symbol) {
    return true
  }
  if (!seen.add(name)) {
    return false
  }
  const own = facts.get(name)
  if (own === null) {
    return false
  }
  let c = 0
  while (c < own.callees.size()) {
    if (reachesSymbol(facts, own.callees.at(c), symbol, seen)) {
      return true
    }
    c = c + 1
  }
  return false
}

/** Whether a call of `fn` receives on a channel, directly or through any callee. */
const receivesAnywhere = (facts: FactsTable, fn: FunctionSig): boolean =>
  reachesSymbol(facts, fn.name, "nish_channel_receive", new StringSet())

/** A reference to a channel, as a function's body names it. */
const REF_UNKNOWN: i32 = 0
/** A path from a parameter: `p`, `p.ch`, `this.ch`. */
const REF_PARAM: i32 = 1
/** A local the function declared, `const ch = new Channel<T>()`. */
const REF_LOCAL: i32 = 2

/** Where a channel a body names comes from: a parameter's path, a local, or neither. */
class ChannelRef {
  kind: i32
  /** For a parameter: its index, and the field after it when there is one (`"0"`, `"0.ch"`). */
  path: string
  local: Local | null

  constructor(kind: i32, path: string, local: Local | null) {
    this.kind = kind
    this.path = path
    this.local = local
  }
}

/** The channel `expr` names, followed by `.field` when `field` is not empty, inside `sig`. */
const channelRef = (program: CheckedProgram, sig: FunctionSig, expr: Node, field: string): ChannelRef => {
  const e = unwrapParens(expr)
  const none: Local | null = null
  let index = -1
  if (e.kind === N_THIS) {
    index = sig.paramNames.length > 0 && sig.paramNames[0] === "this" ? 0 : -1
  } else if (e.kind === N_IDENT) {
    const local = program.nodeLocals[e.id]
    if (local !== null && local.storage === STORAGE_PARAM) {
      index = sig.paramNames.indexOf(local.name)
    } else if (local !== null && field.length === 0) {
      return new ChannelRef(REF_LOCAL, "", local)
    }
  } else if (e.kind === N_MEMBER && field.length === 0) {
    return channelRef(program, sig, e.children[0], e.text)
  }
  if (index < 0) {
    return new ChannelRef(REF_UNKNOWN, "", none)
  }
  return new ChannelRef(REF_PARAM, field.length === 0 ? `${index}` : `${index}.${field}`, none)
}

/**
 * Every send and receive one body makes, in source order: the node that makes
 * it, the channel it is on, and which it is. A call of a function whose
 * summary sends or receives on a parameter's channel is one on what the call
 * hands that parameter.
 */
class ChannelOps {
  sites: Node[]
  refs: ChannelRef[]
  sends: boolean[]

  constructor() {
    this.sites = []
    this.refs = []
    this.sends = []
  }

  add(site: Node, ref: ChannelRef, send: boolean): void {
    this.sites.push(site)
    this.refs.push(ref)
    this.sends.push(send)
  }
}

/**
 * What each function may do to the channels its parameters reach, by symbol:
 * the parameter paths it may send and receive on, and whether it may send or
 * receive on a channel it reached any other way.
 */
export class ChannelSummaries {
  index: StringMap
  sends: StringSet[]
  receives: StringSet[]
  sendsAny: boolean[]
  receivesAny: boolean[]

  constructor() {
    this.index = new StringMap()
    this.sends = []
    this.receives = []
    this.sendsAny = []
    this.receivesAny = []
  }

  at(name: string): i32 {
    return this.index.get(name, -1)
  }

  slot(name: string): i32 {
    const at = this.at(name)
    if (at >= 0) {
      return at
    }
    this.index.set(name, this.sends.length)
    this.sends.push(new StringSet())
    this.receives.push(new StringSet())
    this.sendsAny.push(false)
    this.receivesAny.push(false)
    return this.sends.length - 1
  }

  /** Fold `ops` into `name`'s summary; answers whether it grew. */
  merge(name: string, ops: ChannelOps): boolean {
    const at = this.slot(name)
    let grew = false
    let k = 0
    while (k < ops.refs.length) {
      const ref = ops.refs[k]
      const send = ops.sends[k]
      if (ref.kind === REF_PARAM) {
        grew = (send ? this.sends[at].add(ref.path) : this.receives[at].add(ref.path)) || grew
      } else if (ref.kind === REF_UNKNOWN && send && !this.sendsAny[at]) {
        this.sendsAny[at] = true
        grew = true
      } else if (ref.kind === REF_UNKNOWN && !send && !this.receivesAny[at]) {
        this.receivesAny[at] = true
        grew = true
      }
      k = k + 1
    }
    return grew
  }

  /** Whether `name` may send (`send`) or receive on the channel at `path` of its parameters. */
  may(name: string, path: string, send: boolean): boolean {
    const at = this.at(name)
    if (at < 0) {
      return false
    }
    return send
      ? this.sendsAny[at] || this.sends[at].has(path)
      : this.receivesAny[at] || this.receives[at].has(path)
  }
}

/** The expression a call hands `callee`'s parameter `k`: an argument, the receiver for `this`, or `null`. */
const operandFor = (node: Node, callee: FunctionSig, k: i32): Node | null => {
  const args = node.kind === N_NEW ? node.children[2].children : node.children[1].children
  let at = k
  if (callee.paramNames.length > 0 && callee.paramNames[0] === "this") {
    if (k === 0) {
      const target = node.children[0]
      return node.kind === N_CALL && target.kind === N_MEMBER ? target.children[0] : null
    }
    at = k - 1
  }
  return at < args.length ? args[at] : null
}

/** `path`, a summary's `"k"` or `"k.f"`, as the channel it names at a call of `callee` from `sig`. */
const mappedRef = (
  program: CheckedProgram,
  sig: FunctionSig,
  node: Node,
  callee: FunctionSig,
  path: string
): ChannelRef | null => {
  const dot = path.indexOf(".")
  const k = toI32(Number(dot < 0 ? path : path.substring(0, dot)))
  const operand = operandFor(node, callee, k)
  if (operand === null) {
    return null
  }
  return channelRef(program, sig, operand, dot < 0 ? "" : path.substring(dot + 1))
}

/** The sends and receives a call of `callee` at `node` makes, by its summary, added to `ops`. */
const addCalleeOps = (
  program: CheckedProgram,
  sig: FunctionSig,
  node: Node,
  callee: FunctionSig,
  summaries: ChannelSummaries,
  ops: ChannelOps
): void => {
  const at = summaries.at(callee.name)
  if (at < 0) {
    return
  }
  const none: Local | null = null
  let k = 0
  while (k < 2) {
    const send = k === 0
    const paths = send ? summaries.sends[at] : summaries.receives[at]
    let p = 0
    while (p < paths.size()) {
      const ref = mappedRef(program, sig, node, callee, paths.at(p))
      if (ref !== null) {
        ops.add(node, ref, send)
      }
      p = p + 1
    }
    if (send ? summaries.sendsAny[at] : summaries.receivesAny[at]) {
      ops.add(node, new ChannelRef(REF_UNKNOWN, "", none), send)
      // Any channel it reaches includes every one of this function's own it is handed.
      let o = 0
      while (o < callee.paramNames.length) {
        const operand = operandFor(node, callee, o)
        const ref: ChannelRef | null = operand === null ? null : channelRef(program, sig, operand, "")
        if (ref !== null && ref.kind === REF_LOCAL) {
          ops.add(node, ref, send)
        }
        o = o + 1
      }
    }
    k = k + 1
  }
}

/** Every send and receive under `node`, in `sig`'s body, onto `ops`. A `spawn`'s task is its scope's, not this body's. */
const collectChannelOps = (
  program: CheckedProgram,
  sig: FunctionSig,
  node: Node,
  summaries: ChannelSummaries,
  ops: ChannelOps
): void => {
  if (node.kind === N_ARROW) {
    return // a lifted function of its own, with a summary of its own
  }
  if (node.kind === N_FOR_OF) {
    const read = program.nodeCallees[node.id]
    if (read !== null && isChannelReader(read)) {
      ops.add(node, channelRef(program, sig, node.children[1], ""), false)
    }
  }
  if (node.kind === N_CALL || node.kind === N_NEW) {
    const callee = program.nodeCallees[node.id]
    if (callee !== null && isChannelSend(callee)) {
      ops.add(node, channelRef(program, sig, node.children[0].children[0], ""), true)
    } else if (callee !== null && !isSpawnEntry(callee)) {
      addCalleeOps(program, sig, node, callee, summaries, ops)
    }
  }
  for (const child of node.children) {
    collectChannelOps(program, sig, child, summaries, ops)
  }
}

/** The sends and receives of `sig`'s body, read with its instance's tables. */
const channelOpsOf = (program: CheckedProgram, sig: FunctionSig, summaries: ChannelSummaries): ChannelOps => {
  const ops = new ChannelOps()
  const body = sig.body()
  if (body === null) {
    return ops
  }
  const instance = sig.instance
  if (instance !== null) {
    program.enterInstance(instance)
  }
  collectChannelOps(program, sig, body, summaries, ops)
  if (instance !== null) {
    program.leaveInstance()
  }
  return ops
}

/**
 * Every function's summary, to a fixpoint: a summary only grows, and each is
 * a subset of its parameters' paths, so the loop ends. Nothing is walked
 * without `nish/threads`, where there is no channel to summarise.
 */
export const channelSummaries = (programs: CheckedProgram[]): ChannelSummaries => {
  const out = new ChannelSummaries()
  if (!threadsLoaded(programs) || !namesChannel(programs)) {
    return out
  }
  let changed = true
  while (changed) {
    changed = false
    for (const program of programs) {
      for (const sig of program.functions) {
        if (sig.definedIn(program.source) && out.merge(sig.name, channelOpsOf(program, sig, out))) {
          changed = true
        }
      }
    }
  }
  return out
}

/** Whether any module but `nish/threads` itself spells `Channel`, without which no function has a channel to summarise. */
const namesChannel = (programs: CheckedProgram[]): boolean => {
  for (const program of programs) {
    if (!isThreadsModule(program) && program.source.text.indexOf(CHANNEL) >= 0) {
      return true
    }
  }
  return false
}

/** The type `T` a `Channel<T>` carries, or -1. */
const channelElement = (program: CheckedProgram, table: TypeTable, type: i32): i32 => {
  const info = classLayoutOf(program, table, type)
  const instance: StructInstantiation | null = info === null ? null : info.instance
  return instance === null || instance.typeArgs.length === 0 ? -1 : instance.typeArgs[0]
}

/** Whether `node`, a channel under the first `depth` of `parents`, is the argument a `spawn` hands its task. */
const isTaskArgument = (program: CheckedProgram, at: Node, parents: Node[], depth: i32): boolean => {
  if (depth < 2) {
    return false
  }
  const list = parents[depth - 1]
  const call = parents[depth - 2]
  return (
    call.kind === N_CALL &&
    call.children[1] === list &&
    list.children.length > 1 &&
    list.children[1] === at &&
    spawnCallee(program, call) !== null
  )
}

/** Whether `node` names a local bound by `const ch = new Channel<T>()`. */
const isChannelLocal = (program: CheckedProgram, node: Node, locals: Local[]): boolean => {
  const local = namedLocal(program, node)
  return local !== null && locals.indexOf(local) >= 0
}

/**
 * C1, C2's use and C4's hand-over, at `node` and under it, with `parents`
 * outermost first: what each expression of a channel type stands in. `locals`
 * are the function's own channels, the only ones it may give a task.
 */
const walkChannelUses = (
  program: CheckedProgram,
  table: TypeTable,
  sig: FunctionSig,
  node: Node,
  parents: Node[],
  locals: Local[],
  out: ScopeFinding[]
): void => {
  // An arrow is walked with the body it is written in, whose tables it shares:
  // what it does with a channel it is handed is held to the same rule.
  let at = node
  let depth = parents.length
  while (depth > 0 && parents[depth - 1].kind === N_PAREN) {
    at = parents[depth - 1]
    depth = depth - 1
  }
  const parent: Node | null = depth > 0 ? parents[depth - 1] : null
  const type = program.nodeTypes[node.id]
  const declaresName =
    parent !== null && (parent.kind === N_VAR_DECL || parent.kind === N_PARAM) && parent.children[0] === at
  if (node.kind !== N_PAREN && !declaresName && parent !== null && isChannelType(program, table, type)) {
    const message = channelUseFinding(program, table, sig, node, at, parents, depth, locals)
    if (message.length > 0) {
      out.push(new ScopeFinding(node, message))
      return
    }
  }
  parents.push(node)
  for (const child of node.children) {
    walkChannelUses(program, table, sig, child, parents, locals, out)
  }
  parents.pop()
}

/** What `walkChannelUses` refuses about `node`, a channel standing as `at` under `parents`, or "". */
const channelUseFinding = (
  program: CheckedProgram,
  table: TypeTable,
  sig: FunctionSig,
  node: Node,
  at: Node,
  parents: Node[],
  depth: i32,
  locals: Local[]
): string => {
  const parent = parents[depth - 1]
  const type = program.nodeTypes[node.id]
  if (node.kind === N_NEW) {
    const element = channelElement(program, table, type)
    if (element >= 0 && !isScalarArgument(table, element)) {
      return channelElementMessage(table, element)
    }
    const declared =
      parent.kind === N_VAR_DECL &&
      parent.children[2] === at &&
      depth > 2 &&
      isConstDeclaration(parents[depth - 3])
    return declared ? "" : channelDeclareMessage("`new Channel` must be the initialiser of a `const`")
  }
  const constructing = sig.role === ROLE_CONSTRUCTOR
  // An assignment standing as a statement answers nothing; its two sides are judged on their own.
  if (node.kind === N_BINARY && isAssignmentOperator(node.text) && parent.kind === N_EXPR_STMT) {
    return ""
  }
  // `this.ch = ch` in a constructor, either side: how a class comes to hold a channel.
  if (constructing && parent.kind === N_BINARY && parent.text === "=" && isFieldFromParam(program, parent)) {
    return ""
  }
  if (!constructing && parent.kind === N_MEMBER && parent.children[0] === at) {
    const above: Node | null = depth > 1 ? parents[depth - 2] : null
    if (parent.text === "send" && above !== null && above.kind === N_CALL && above.children[0] === parent) {
      return ""
    }
    return channelUseMessage(`\`${parent.text}\` is not a member of a \`Channel\` a program may name`)
  }
  if (!constructing && parent.kind === N_FOR_OF && parent.children[1] === at) {
    return ""
  }
  if (!constructing && parent.kind === N_LIST && depth > 1) {
    const call = parents[depth - 2]
    if (call.kind === N_CALL && call.children[1] === parent) {
      if (spawnCallee(program, call) === null || isChannelLocal(program, node, locals)) {
        return ""
      }
      return channelSendersMessage("A `spawn` hands its task only a channel this function declared")
    }
    if (
      call.kind === N_NEW &&
      call.children[2] === parent &&
      isTaskArgument(program, call, parents, depth - 2)
    ) {
      if (isChannelLocal(program, node, locals)) {
        return ""
      }
      return channelSendersMessage("A `spawn` hands its task only a channel this function declared")
    }
  }
  return channelUseMessage("A `Channel` cannot be bound, stored, returned or compared here")
}

/** Whether `stmt`, the statement around a declarator, is a plain `const`. */
const isConstDeclaration = (stmt: Node): boolean =>
  stmt.kind === N_VAR && (stmt.flags & FLAG_CONST) !== 0 && (stmt.flags & FLAG_USING) === 0

/** Whether `assign` is `this.f = p`, a field of the object being made set from a parameter. */
const isFieldFromParam = (program: CheckedProgram, assign: Node): boolean => {
  const target = unwrapParens(assign.children[0])
  const value = unwrapParens(assign.children[1])
  if (
    target.kind !== N_MEMBER ||
    unwrapParens(target.children[0]).kind !== N_THIS ||
    value.kind !== N_IDENT
  ) {
    return false
  }
  const local = program.nodeLocals[value.id]
  return local !== null && local.storage === STORAGE_PARAM
}

/** Whether `init` is `new Channel<T>()`. */
const isNewChannel = (program: CheckedProgram, table: TypeTable, init: Node): boolean => {
  const e = unwrapParens(init)
  return e.kind === N_NEW && isChannelType(program, table, program.nodeTypes[e.id])
}

/** Every local of `node`'s body bound by `const ch = new Channel<T>()`, with its declarator. */
const collectChannelLocals = (
  program: CheckedProgram,
  table: TypeTable,
  node: Node,
  locals: Local[],
  decls: Node[]
): void => {
  if (node.kind === N_ARROW) {
    return
  }
  // A `let` is C2's to refuse, once; its channel is still the function's own.
  if (node.kind === N_VAR) {
    for (const decl of node.children[0].children) {
      const local = program.nodeLocals[decl.id]
      if (local !== null && isNewChannel(program, table, decl.children[2])) {
        locals.push(local)
        decls.push(decl)
      }
    }
  }
  for (const child of node.children) {
    collectChannelLocals(program, table, child, locals, decls)
  }
}

/** Every `scope()` declarator of `stmt` when it is a `using`, in order: `using s = scope(), t = scope()` opens two. */
const scopeDeclaratorsOf = (program: CheckedProgram, stmt: Node, scopeType: i32): Node[] => {
  const out: Node[] = []
  if (stmt.kind === N_VAR && (stmt.flags & FLAG_USING) !== 0) {
    for (const decl of stmt.children[0].children) {
      if (isScopeCall(program, unwrapParens(decl.children[2]), scopeType)) {
        out.push(decl)
      }
    }
  }
  return out
}

/**
 * One scope a channel declared at statement `index` of `block` may serve
 * (C2): a `using s = scope()` later in the same block, or in a block that is a
 * later statement of it. `body` is the block whose end joins it, and `stmt`
 * the statement of `block` that is the `using` or holds it.
 */
class ScopeSite {
  decl: Node
  local: Local | null
  body: Node
  stmt: i32

  constructor(decl: Node, local: Local | null, body: Node, stmt: i32) {
    this.decl = decl
    this.local = local
    this.body = body
    this.stmt = stmt
  }
}

/** The scopes a channel declared at statement `index` of `block` may serve, in statement order. */
const candidateScopes = (program: CheckedProgram, block: Node, index: i32, scopeType: i32): ScopeSite[] => {
  const out: ScopeSite[] = []
  let j = index + 1
  while (j < block.children.length) {
    const stmt = block.children[j]
    for (const own of scopeDeclaratorsOf(program, stmt, scopeType)) {
      out.push(new ScopeSite(own, program.nodeLocals[own.id], block, j))
    }
    if (stmt.kind === N_BLOCK) {
      for (const inner of stmt.children) {
        for (const decl of scopeDeclaratorsOf(program, inner, scopeType)) {
          out.push(new ScopeSite(decl, program.nodeLocals[decl.id], stmt, j))
        }
      }
    }
    j = j + 1
  }
  return out
}

/** The block `decl`'s statement is in and its index there, found under `node`; the block is `null` when none is. */
class StatementSite {
  block: Node | null
  index: i32

  constructor(block: Node | null, index: i32) {
    this.block = block
    this.index = index
  }
}

const statementSiteOf = (node: Node, decl: Node): StatementSite => {
  if (node.kind === N_BLOCK) {
    let i = 0
    while (i < node.children.length) {
      const stmt = node.children[i]
      if (stmt.kind === N_VAR && stmt.children[0].children.indexOf(decl) >= 0) {
        return new StatementSite(node, i)
      }
      i = i + 1
    }
  }
  for (const child of node.children) {
    if (child.kind !== N_ARROW) {
      const found = statementSiteOf(child, decl)
      if (found.block !== null) {
        return found
      }
    }
  }
  const none: Node | null = null
  return new StatementSite(none, -1)
}

/** Whether `inner` is `outer` or under it. */
const isWithin = (outer: Node, inner: Node): boolean => inner.start >= outer.start && inner.end <= outer.end

/** Every `spawn` call under `node`, in source order. */
const collectSpawns = (program: CheckedProgram, node: Node, out: Node[]): void => {
  if (node.kind === N_ARROW) {
    return
  }
  if (spawnCallee(program, node) !== null) {
    out.push(node)
  }
  for (const child of node.children) {
    collectSpawns(program, child, out)
  }
}

/**
 * Where the argument a `spawn` hands its task holds `local`: `""` when it is
 * the channel itself, the field a constructor parameter sets when the
 * argument is `new C(..., ch, ...)`, or `null` when it does not hold it.
 */
const pathInTaskArgument = (program: CheckedProgram, spawn: Node, local: Local): string | null => {
  const args = spawn.children[1].children
  if (args.length < 2) {
    return null
  }
  const arg = unwrapParens(args[1])
  if (holdsChannelLocal(program, arg, local)) {
    return ""
  }
  const ctor: FunctionSig | null = arg.kind === N_NEW ? program.nodeCallees[arg.id] : null
  if (ctor === null) {
    return null
  }
  const values = arg.children[2].children
  let k = 0
  while (k < values.length) {
    if (holdsChannelLocal(program, values[k], local)) {
      const field = fieldSetFrom(ctor, ctor.paramNames.length > k + 1 ? ctor.paramNames[k + 1] : "")
      if (field.length > 0) {
        return field
      }
    }
    k = k + 1
  }
  return null
}

/** Whether `node` names `local`, parenthesised or not. */
const holdsChannelLocal = (program: CheckedProgram, node: Node, local: Local): boolean => {
  const named = namedLocal(program, node)
  return named !== null && named === local
}

/** The field a constructor sets from its parameter `param`, `this.f = param`, or "". */
const fieldSetFrom = (ctor: FunctionSig, param: string): string => {
  const body = ctor.body()
  return body === null || param.length === 0 ? "" : fieldAssignedIn(body, param)
}

const fieldAssignedIn = (node: Node, param: string): string => {
  if (node.kind === N_BINARY && node.text === "=") {
    const target = unwrapParens(node.children[0])
    const value = unwrapParens(node.children[1])
    if (
      target.kind === N_MEMBER &&
      unwrapParens(target.children[0]).kind === N_THIS &&
      value.kind === N_IDENT &&
      value.text === param
    ) {
      return target.text
    }
  }
  for (const child of node.children) {
    const found = fieldAssignedIn(child, param)
    if (found.length > 0) {
      return found
    }
  }
  return ""
}

/** The summary path of a task's argument holding a channel at `path`: `"0"` or `"0.f"`. */
const taskPath = (path: string): string => (path.length === 0 ? "0" : `0.${path}`)

/** Whether `node` is inside a loop that is itself inside `outer`. */
const inLoopWithin = (outer: Node, node: Node, at: Node): boolean => {
  if (at === node) {
    return false
  }
  if (!isWithin(at, node)) {
    return false
  }
  const loop = at.kind === N_FOR || at.kind === N_WHILE || at.kind === N_DO || at.kind === N_FOR_OF
  if (loop && at !== outer) {
    return true
  }
  for (const child of at.children) {
    if (inLoopWithin(outer, node, child)) {
      return true
    }
  }
  return false
}

/**
 * C2's placement, C4, C5 and C6 for one function's channels, and the record
 * the emitter reads: which channels each scope seals, and which of a task's
 * channels its `spawn` counts as a sender.
 */
const checkChannels = (
  program: CheckedProgram,
  table: TypeTable,
  facts: FactsTable,
  summaries: ChannelSummaries,
  sig: FunctionSig,
  body: Node,
  scopeType: i32,
  out: ScopeFinding[]
): void => {
  const locals: Local[] = []
  const decls: Node[] = []
  collectChannelLocals(program, table, body, locals, decls)
  walkChannelUses(program, table, sig, body, [], locals, out)
  const spawns: Node[] = []
  collectSpawns(program, body, spawns)
  recordSenders(program, table, summaries, spawns)
  findScopeReceives(program, facts, body, scopeType, out)
  const ops = new ChannelOps()
  collectChannelOps(program, sig, body, summaries, ops)
  let c = 0
  while (c < locals.length) {
    checkChannel(program, summaries, body, locals[c], decls[c], spawns, ops, scopeType, out)
    c = c + 1
  }
}

/**
 * The fields of each `spawn`'s task argument that hold a channel the task may
 * send on, onto its instance, for the emitter's sender count. A task that may
 * send on a channel it reaches some other way counts every channel its
 * argument holds.
 */
const recordSenders = (
  program: CheckedProgram,
  table: TypeTable,
  summaries: ChannelSummaries,
  spawns: Node[]
): void => {
  for (const spawn of spawns) {
    const callee = spawnCallee(program, spawn)
    if (callee === null) {
      continue
    }
    const instance = callee.instance
    const entry = parallelBodyOf(callee)
    if (instance === null || entry === null || instance.typeArgs.length === 0) {
      continue
    }
    const arg = instance.typeArgs[0]
    const paths: string[] = []
    if (isChannelType(program, table, arg)) {
      paths.push("")
    } else {
      const info = classLayoutOf(program, table, arg)
      if (info !== null) {
        for (const field of info.fields) {
          if (isChannelType(program, table, field.type)) {
            paths.push(field.name)
          }
        }
      }
    }
    const senders: string[] = []
    for (const path of paths) {
      if (summaries.may(entry.name, taskPath(path), true)) {
        senders.push(path)
      }
    }
    instance.channelSenders = senders
  }
}

/** C5: inside every scope's block under `node`, the parent receives nothing, directly or through a call. */
const findScopeReceives = (
  program: CheckedProgram,
  facts: FactsTable,
  node: Node,
  scopeType: i32,
  out: ScopeFinding[]
): void => {
  if (node.kind === N_ARROW) {
    return
  }
  if (node.kind === N_BLOCK) {
    let i = 0
    while (i < node.children.length) {
      const decls = scopeDeclaratorsOf(program, node.children[i], scopeType)
      if (decls.length > 0) {
        let j = i + 1
        while (j < node.children.length) {
          walkScopeReceives(program, facts, node.children[j], decls[0].children[0].text, out)
          j = j + 1
        }
      }
      i = i + 1
    }
  }
  for (const child of node.children) {
    findScopeReceives(program, facts, child, scopeType, out)
  }
}

/** What `findScopeReceives` refuses at `node` and under it, in the block of the scope `name`. */
const walkScopeReceives = (
  program: CheckedProgram,
  facts: FactsTable,
  node: Node,
  name: string,
  out: ScopeFinding[]
): void => {
  if (node.kind === N_ARROW) {
    return
  }
  const what = receiveWhat(program, facts, node)
  if (what.length > 0) {
    out.push(new ScopeFinding(node, channelReceiverMessage(`${what} is inside the block of \`${name}\``)))
    return
  }
  if (spawnCallee(program, node) !== null) {
    return // the task's receives are its own
  }
  for (const child of node.children) {
    walkScopeReceives(program, facts, child, name, out)
  }
}

/** The receive `node` is, in words — a loop over a channel, or a call that receives — or "". */
const receiveWhat = (program: CheckedProgram, facts: FactsTable, node: Node): string => {
  if (node.kind === N_FOR_OF) {
    const read = program.nodeCallees[node.id]
    return read !== null && isChannelReader(read) ? "A loop over a channel" : ""
  }
  // A `new` is a call of its class's constructor.
  if (node.kind !== N_CALL && node.kind !== N_NEW) {
    return ""
  }
  const callee = program.nodeCallees[node.id]
  if (callee === null || isSpawnEntry(callee) || !receivesAnywhere(facts, callee)) {
    return ""
  }
  return `\`${callee.sourceName}\`, which receives on a channel,`
}

/** C2's placement, C4, C5 and C6 for the channel `local`, declared by `decl` in `body`. */
const checkChannel = (
  program: CheckedProgram,
  summaries: ChannelSummaries,
  body: Node,
  local: Local,
  decl: Node,
  spawns: Node[],
  ops: ChannelOps,
  scopeType: i32,
  out: ScopeFinding[]
): void => {
  const site = statementSiteOf(body, decl)
  const block = site.block
  if (block === null) {
    out.push(new ScopeFinding(decl, channelDeclareMessage(`\`${local.name}\` serves no scope`)))
    return
  }
  const candidates = candidateScopes(program, block, site.index, scopeType)
  // The spawns that hand a task this channel, and the scope each is on.
  const holders: Node[] = []
  const paths: string[] = []
  for (const spawn of spawns) {
    const path = pathInTaskArgument(program, spawn, local)
    if (path !== null) {
      holders.push(spawn)
      paths.push(path)
    }
  }
  let chosen: ScopeSite | null = null
  for (const spawn of holders) {
    const receiver = spawnReceiver(program, spawn)
    let found: ScopeSite | null = null
    for (const candidate of candidates) {
      const own = candidate.local
      if (own !== null && receiver !== null && own === receiver) {
        found = candidate
      }
    }
    if (found === null) {
      out.push(
        new ScopeFinding(
          spawn,
          channelDeclareMessage(`\`${local.name}\` is not declared for the scope of this \`spawn\``)
        )
      )
      return
    }
    if (chosen !== null && chosen !== found) {
      out.push(
        new ScopeFinding(
          spawn,
          channelSendersMessage(`\`${local.name}\` is reachable from the tasks of two scopes`)
        )
      )
      return
    }
    chosen = found
  }
  if (chosen === null) {
    chosen = candidates.length > 0 ? candidates[0] : null
  }
  if (chosen === null) {
    out.push(new ScopeFinding(decl, channelDeclareMessage(`\`${local.name}\` serves no scope`)))
    return
  }
  recordSeal(program, chosen.decl, decl)
  // The tasks: who may send, who may receive, in statement order.
  let receiver: Node | null = null
  let k = 0
  while (k < holders.length) {
    const spawn = holders[k]
    const callee = spawnCallee(program, spawn)
    const entry: FunctionSig | null = callee === null ? null : parallelBodyOf(callee)
    if (entry !== null) {
      const path = taskPath(paths[k])
      const sends = summaries.may(entry.name, path, true)
      const receives = summaries.may(entry.name, path, false)
      if (sends && receives) {
        out.push(
          new ScopeFinding(
            spawn,
            channelOrderMessage(`\`${entry.sourceName}\` may both send and receive on \`${local.name}\``)
          )
        )
        return
      }
      if (receives && receiver !== null) {
        out.push(
          new ScopeFinding(spawn, channelReceiverMessage(`\`${local.name}\` has a second receiver here`))
        )
        return
      }
      if (receives && inLoopWithin(chosen.body, spawn, chosen.body)) {
        out.push(
          new ScopeFinding(
            spawn,
            channelReceiverMessage(`This task receives on \`${local.name}\` from a \`spawn\` inside a loop`)
          )
        )
        return
      }
      if (sends && receiver !== null) {
        out.push(
          new ScopeFinding(
            spawn,
            channelOrderMessage(
              `\`${entry.sourceName}\` may send on \`${local.name}\` and is spawned after its receiver`
            )
          )
        )
        return
      }
      if (receives) {
        receiver = spawn
      }
    }
    k = k + 1
  }
  checkParentOps(block, site.index, chosen, local, receiver !== null, ops, out)
}

/**
 * C4 and C5 for what the parent itself does with `local`: a send only between
 * its declaration and the statement that holds the scope's block, and a
 * receive only after that statement, when the scope's block is a statement of
 * `block` and no task receives.
 */
const checkParentOps = (
  block: Node,
  index: i32,
  chosen: ScopeSite,
  local: Local,
  taskReceives: boolean,
  ops: ChannelOps,
  out: ScopeFinding[]
): void => {
  const apart = chosen.body !== block
  let k = 0
  while (k < ops.sites.length) {
    const ref = ops.refs[k]
    const node = ops.sites[k]
    const named = ref.local
    if (ref.kind === REF_LOCAL && named !== null && named === local) {
      const at = statementIndexIn(block, node)
      if (ops.sends[k] && !(apart && at > index && at < chosen.stmt)) {
        out.push(
          new ScopeFinding(
            node,
            channelSendersMessage(`This sends on \`${local.name}\` once its scope's block has begun`)
          )
        )
        return
      }
      // A receive inside the scope's block is `findScopeReceives`'s to refuse.
      const inScope = apart ? at === chosen.stmt : at > chosen.stmt
      if (!ops.sends[k] && inScope) {
        k = k + 1
        continue
      }
      if (!ops.sends[k] && taskReceives) {
        out.push(
          new ScopeFinding(node, channelReceiverMessage(`\`${local.name}\` has a second receiver here`))
        )
        return
      }
      if (!ops.sends[k] && !(apart && at > chosen.stmt)) {
        out.push(
          new ScopeFinding(
            node,
            channelReceiverMessage(`This receives on \`${local.name}\` before its scope has joined`)
          )
        )
        return
      }
    }
    k = k + 1
  }
}

/** The index of the statement of `block` that holds `node`, or -1. */
const statementIndexIn = (block: Node, node: Node): i32 => {
  let i = 0
  while (i < block.children.length) {
    if (isWithin(block.children[i], node)) {
      return i
    }
    i = i + 1
  }
  return -1
}

/** Remember that the scope declared by `scope` seals the channel declared by `channel`, once. */
const recordSeal = (program: CheckedProgram, scope: Node, channel: Node): void => {
  for (const record of program.scopeChannels) {
    if (record.scope === scope) {
      if (record.channels.indexOf(channel) < 0) {
        record.channels.push(channel)
      }
      return
    }
  }
  const record = new ScopeChannels(scope)
  record.channels.push(channel)
  program.scopeChannels.push(record)
}
