// WP29 P1: the rules a data-parallel call is held to, and how `nish/threads`'s
// templates are recognised (docs/wp29-thread-surface.md §4.1, §7, §11).
//
// `std/threads.ts` is ordinary Nish: its exported templates carry the
// sequential meaning, and the compiler recognises them by module and name and
// replaces one call inside each instance with a region over
// `nish_parallel_range` (`src/emit-parallel.ts`). `parallelMap` is the one
// with no region of its own: it allocates its result and calls
// `parallelMapInto`, and is judged at its call as the other three are. Everything that makes the
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
  N_CLASS,
  N_FIELD,
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
  FieldInfo,
  FunctionSig,
  PAR_CHUNK,
  PAR_FROM,
  PAR_MAP,
  PAR_MAP_NEW,
  PAR_NONE,
  PAR_REDUCE,
  PAR_SPAWN,
  PAR_TASK,
  ParallelCall,
  ROLE_CONSTRUCTOR,
  STRUCT_CLASS,
  ScopeChannels,
  StructInfo,
  StructInstantiation,
  TemplateInfo,
  capturedReads,
} from "./program"
import { isCollectionStruct } from "./generics"
import { resultMethodName } from "./emit-result"
import { stdModuleName } from "./std-modules"
import { StringMap, StringSet } from "./map"
import { Local, STORAGE_PARAM, sourceLocal } from "./symbols"
import { K_ARRAY, K_NULLABLE, K_RESULT, K_STRUCT, T_STRING, T_VOID, TypeTable } from "./types"

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
  `\`${owner}\` cannot declare \`[Symbol.dispose]\`: in this version \`using\` takes only \`scope()\` or a ` +
  "`Mutex`'s `lock()` from `nish/threads`, or the builtin `arena()`, whose disposal the compiler emits itself, " +
  "so a disposal method of any other class would never be called"

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

/**
 * The methods of `ThreadScope` a `spawn` statement calls: `spawn` itself, with
 * a destination, and the two the compiler gives the forms without one
 * (`spawnFormFor`), which the source never names.
 */
const isSpawnMethodName = (name: string): boolean =>
  name === "spawn" || name === SPAWN_WITH || name === SPAWN_THUNK

/** `ThreadScope`'s method for `s.spawn(entry, arg)`, whose task stores nothing. */
const SPAWN_WITH: string = "spawnWith"

/** `ThreadScope`'s method for `s.spawn(() => ...)`, whose task takes no argument and stores nothing. */
const SPAWN_THUNK: string = "spawnThunk"

/** Whether `template` is one of `ThreadScope`'s spawn methods from `nish/threads` (WP29 P2). */
export const isSpawnTemplate = (template: TemplateInfo): boolean => {
  const owner = template.owner
  return (
    owner !== null &&
    owner.name === THREAD_SCOPE &&
    isSpawnMethodName(template.decl.children[0].text) &&
    isThreadsModule(template.home.program)
  )
}

/**
 * The `ThreadScope` method a `spawn` written with `count` arguments calls: the
 * four-argument form is `spawn` itself, `s.spawn(entry, arg)` is `spawnWith`
 * and `s.spawn(() => ...)` is `spawnThunk` (docs/LANGUAGE.md, "Scoped tasks").
 * TypeScript would spell the three as overloads; the language has none, so
 * the checker picks the method by the count, and under Node, where every form
 * reaches `spawn`, that method's body tells them apart (`slotWritten` in
 * `std/threads.ts`). Any other count is `spawn`'s, whose arity refuses it.
 */
export const spawnFormFor = (template: TemplateInfo, count: i32): string => {
  if (!isSpawnTemplate(template) || template.decl.children[0].text !== "spawn") {
    return ""
  }
  if (count === 2) {
    return SPAWN_WITH
  }
  return count === 1 ? SPAWN_THUNK : ""
}

/** Whether `template` is `spawnWith` or `spawnThunk`, whose task stores nothing. */
export const isVoidSpawnTemplate = (template: TemplateInfo): boolean => {
  const name = template.decl.children[0].text
  return isSpawnTemplate(template) && (name === SPAWN_WITH || name === SPAWN_THUNK)
}

/** Whether `sig` is a spawn whose task stores nothing: an instance of `spawnWith` or `spawnThunk`. */
export const isVoidSpawn = (sig: FunctionSig): boolean => {
  const instance = sig.instance
  const template: TemplateInfo | null = instance === null ? null : instance.template
  if (template === null || instance === null || instance.parallel !== PAR_SPAWN) {
    return false
  }
  const name = template.decl.children[0].text
  return name === SPAWN_WITH || name === SPAWN_THUNK
}

/**
 * The type of the argument a spawn instance hands its task, or -1 for
 * `spawnThunk`, whose task takes none: its first type argument is the answer.
 */
const taskArgTypeOf = (sig: FunctionSig): i32 => {
  const instance = sig.instance
  const template: TemplateInfo | null = instance === null ? null : instance.template
  if (instance === null || template === null || instance.typeArgs.length === 0) {
    return -1
  }
  return template.decl.children[0].text === SPAWN_THUNK ? -1 : instance.typeArgs[0]
}

/** The `PAR_*` role of an instantiation of `template`. */
export const parallelRole = (template: TemplateInfo): i32 => {
  if (isSpawnTemplate(template)) {
    return PAR_SPAWN
  }
  if (template.owner !== null || !isThreadsModule(template.home.program)) {
    return PAR_NONE
  }
  if (
    template.sourceName === "runTask" ||
    template.sourceName === "runWith" ||
    template.sourceName === "runThunk"
  ) {
    return PAR_TASK
  }
  const name = template.sourceName
  if (name === "parallelMapInto") {
    return PAR_MAP
  }
  if (name === "parallelReduce") {
    return PAR_REDUCE
  }
  if (name === "parallelMap") {
    return PAR_MAP_NEW
  }
  if (name === "parallelFrom") {
    return PAR_FROM
  }
  if (name === "mapRange" || name === "fromRange" || name === "reduceBlocks") {
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

/**
 * Whether `sig` is an instance of one of the four data-parallel forms
 * (`parallelMapInto`, `parallelMap`, `parallelFrom`, `parallelReduce`): one
 * whose call is judged by the rules below.
 */
export const isParallelEntry = (sig: FunctionSig): boolean => {
  const role = parallelRoleOf(sig)
  return role === PAR_MAP || role === PAR_REDUCE || role === PAR_MAP_NEW || role === PAR_FROM
}

/**
 * Whether `sig` is an instance whose call to its chunk loop the emitter turns
 * into a region: every form but `parallelMap`, which reaches its region
 * through the `parallelMapInto` it calls.
 */
export const isRegionEntry = (sig: FunctionSig): boolean => {
  const role = parallelRoleOf(sig)
  return role === PAR_MAP || role === PAR_REDUCE || role === PAR_FROM
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
  // `dst` is read now, while the tables of the body that holds the call are
  // the ones installed: an instantiation of a generic caller has its own.
  let dst: Local | null = null
  if (parallelRoleOf(sig) === PAR_MAP && node.kind === N_CALL && node.children[1].children.length > 1) {
    dst = namedLocal(program, node.children[1].children[1])
  }
  calls.push(new ParallelCall(node, sig, dst))
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
  if (role === PAR_MAP_NEW) {
    return "parallelMap"
  }
  if (role === PAR_FROM) {
    return "parallelFrom"
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
  // A string or a scalar array answered across threads has to be allocated:
  // building it is the work, and no element scope recycles it.
  if (own === null || !own.allocates || crossesByCopy(table, type)) {
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

/**
 * A value that crosses from one thread's arena to another's by being copied
 * (`crossingSize` in emit-parallel.ts, runtime/runtime-parallel.c's copy at
 * join): a string, or an array whose elements are numbers, booleans or enums,
 * which holds no pointer, so one flat copy is the whole value. An array of
 * strings, of arrays or of objects is not one: its copy would have to follow
 * every element, and is refused rather than made deep.
 */
export const crossesByCopy = (table: TypeTable, type: i32): boolean =>
  type === T_STRING || (table.isArray(type) && isScalarArgument(table, table.refOf(type)))

/** The refusal of a task answering `type`, which is not a scalar, a string or an array of scalars. */
const crossingWording = (table: TypeTable, intrinsic: string, fn: FunctionSig, type: i32): string => {
  if (isScalarArgument(table, type) || crossesByCopy(table, type)) {
    return ""
  }
  return (
    `\`${fn.sourceName}\` answers \`${table.typeName(type)}\`, and \`${intrinsic}\` hands back only a ` +
    "number, a `boolean`, an enum, a `string` or an array of numbers, booleans or enums, which the join copies " +
    "out of the worker's arena: anything else would point into memory the worker frees or reuses"
  )
}

/**
 * A result the join could hand back. A reduce's `T` is its partials and its
 * identity as well as its answer, folded on several threads, so it stays a
 * number, a `boolean` or an enum; a map's or a `parallelFrom`'s element may
 * also be a value the join copies (`crossesByCopy`): each chunk copies what
 * it wrote out of its arena before the arena is reused, and the caller copies
 * it into its own once every chunk has finished.
 */
export const resultMessage = (table: TypeTable, sig: FunctionSig, fn: FunctionSig, type: i32): string =>
  parallelRoleOf(sig) === PAR_REDUCE
    ? resultWording(table, intrinsicName(sig), fn, type)
    : crossingWording(table, intrinsicName(sig), fn, type)

/** A task's result: a scalar, or a value the join copies (`crossesByCopy`). */
export const taskResultMessage = (table: TypeTable, sig: FunctionSig, fn: FunctionSig, type: i32): string =>
  crossingWording(table, intrinsicName(sig), fn, type)

/**
 * The same rule, asked before `template` is instantiated rather than once the
 * fixpoint has run, for the forms whose template allocates the result type: a
 * reduce's `T` is its element, its identity and its result at once, and its
 * body is written for a scalar `T` (`new Array<T>(blocks)` zero-fills its
 * partials), and `parallelMap` and `parallelFrom` allocate their `U[]` the
 * same way. Instantiating any of them for a string or a class would report
 * errors inside `std/threads.ts` and never reach the call. `functions` and
 * `typeArgs` are the call's, in the template's order: the body, and the type
 * arguments, whose last is the result type in all three.
 */
export const reduceElementMessage = (
  table: TypeTable,
  template: TemplateInfo,
  functions: FunctionSig[],
  typeArgs: i32[]
): string => {
  const role = parallelRole(template)
  if (role !== PAR_REDUCE && role !== PAR_MAP_NEW && role !== PAR_FROM) {
    return ""
  }
  if (functions.length !== 1 || typeArgs.length === 0) {
    return ""
  }
  let intrinsic = "parallelMap"
  if (role === PAR_REDUCE) {
    intrinsic = "parallelReduce"
  } else if (role === PAR_FROM) {
    intrinsic = "parallelFrom"
  }
  const result = typeArgs[typeArgs.length - 1]
  return role === PAR_REDUCE
    ? resultWording(table, intrinsic, functions[0], result)
    : crossingWording(table, intrinsic, functions[0], result)
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
  if (!fn.lifted || fn.writtenArity() !== 2) {
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

// ---- Captures ----------------------------------------------------------------------------
//
// An arrow passed to one of the four forms may read the `const` locals and the
// parameters of the function it is written in (docs/LANGUAGE.md, "Data
// parallelism"). The checker appends each one it reads to the arrow's
// parameters (`captureOuter` in `src/generics.ts`), so inside the arrow a
// capture is a parameter like any other, and the rules above hold of it as
// they hold of the element: a store through it is a shared write, which
// `sharedWriteMessage` refuses. The value travels from the call to the body as
// a parameter of every instance between them, which the emitter adds
// (`capturesOf`), and through the region's context with the other arguments.

/** One value an instance carries for an arrow it was handed: capture `index` of `arrow`. */
export class CaptureSlot {
  arrow: FunctionSig
  index: i32

  constructor(arrow: FunctionSig, index: i32) {
    this.arrow = arrow
    this.index = index
  }

  /** The captured local's type, as the arrow's parameter has it. */
  type(): i32 {
    return this.arrow.paramTypes[this.arrow.writtenArity() + this.index]
  }
}

const collectCaptures = (sig: FunctionSig, out: CaptureSlot[]): void => {
  if (sig.lifted) {
    let k = 0
    while (k < sig.captures.length) {
      out.push(new CaptureSlot(sig, k))
      k = k + 1
    }
    return
  }
  const instance = sig.instance
  if (instance === null) {
    return
  }
  for (const fn of instance.functionArgs) {
    collectCaptures(fn, out)
  }
}

/**
 * Every captured value a call of `sig` passes after its written arguments: an
 * arrow's own captures, or, for an instance, those of every arrow it was
 * given, in argument order, and through the instances those were given on.
 */
export const capturesOf = (sig: FunctionSig): CaptureSlot[] => {
  const out: CaptureSlot[] = []
  collectCaptures(sig, out)
  return out
}

/** The refusal for a `let` an arrow reads. */
export const letCaptureMessage = (name: string): string =>
  `The arrow reads \`${name}\`, a \`let\` of the function it is written in: a data-parallel body may read only ` +
  "a `const` or a parameter of that function, whose value no thread can change while the body runs; bind the " +
  "value to a `const` before the call"

/** The refusal for a name an arrow inside an arrow reads from outside both. */
export const nestedCaptureMessage = (name: string): string =>
  `The arrow reads \`${name}\` from outside the arrow it is written in: only an arrow written directly in a ` +
  "function's body and passed to `parallelMap`, `parallelFrom`, `parallelMapInto` or `parallelReduce` may read " +
  "that function's `const` locals, and an arrow inside another arrow captures nothing"

/** The refusal for `this` in an arrow passed to a data-parallel form. */
export const thisCaptureMessage = (): string =>
  "The arrow reads `this`: a data-parallel body may read the `const` locals and the parameters of the function " +
  "it is written in, and `this` is neither; bind it, or what the body needs of it, to a `const` before the call " +
  "(`const self = this`, `const k = this.k`)"

/** The refusal for a `let` a task's arrow reads. */
export const taskLetCaptureMessage = (name: string): string =>
  `The arrow reads \`${name}\`, a \`let\` of the function it is written in: a task's arrow may read only a ` +
  "`const` or a parameter of that function, which is handed to the task when it is spawned as its argument is " +
  "and cannot change before it runs; bind the value to a `const` before the `spawn`"

/** The refusal for `this` in a task's arrow. */
export const taskThisCaptureMessage = (): string =>
  "The arrow reads `this`: a task's arrow may read the `const` locals and the parameters of the function it is " +
  "written in, and `this` is neither; bind it, or what the task needs of it, to a `const` before the `spawn` " +
  "(`const self = this`, `const k = this.k`)"

/** The refusal for an assignment to a name a task's arrow captures. */
export const taskCaptureWriteMessage = (name: string): string =>
  `The arrow assigns to \`${name}\`, which belongs to the function it is written in: a task reads a captured ` +
  "value and never writes it, because it is handed a copy of the value when it is spawned, as it is its argument"

/** The refusal for an assignment to a captured name. */
export const captureWriteMessage = (name: string): string =>
  `The arrow assigns to \`${name}\`, which belongs to the function it is written in: a data-parallel body ` +
  "reads a captured value and never writes it, because every thread reads the same one"

/** Whether `info` is a class `nish/threads` declares: a scope, a lock, its guard or a channel. */
const isThreadsLayout = (info: StructInfo): boolean => {
  const instance = info.instance
  if (instance !== null) {
    return isThreadsModule(instance.template.home.program)
  }
  return info.origin.path === threadsModuleName() && info.name === THREAD_SCOPE
}

/**
 * Why a value of `type` may not be captured, or "" when it may; `seen` stops a
 * recursive class. A scope's `task` may capture a `Mutex`, as it may be handed
 * one as its argument, and R7 and R8 hold of it as of an argument; a guard, a
 * channel and a scope it may not, since each is shared only by its own rules.
 */
const captureObstacle = (
  program: CheckedProgram,
  table: TypeTable,
  type: i32,
  seen: StringSet,
  task: boolean
): string => {
  if (table.isMaybe(type)) {
    return "a value that may be absent is read through the test that found it, which the body cannot repeat"
  }
  if (table.isSecret(type)) {
    return "a `Secret` is read only inside `expose`"
  }
  const kind = table.kindOf(type)
  if (kind === K_RESULT) {
    return "a `Result` is read through the test that narrowed it; bind the value it holds to a `const` instead"
  }
  if (kind === K_NULLABLE || kind === K_ARRAY) {
    return captureObstacle(program, table, table.refOf(type), seen, task)
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
    return "its layout is not known here"
  }
  if (task && isThreadsClass(info, MUTEX)) {
    return "" // the lock's data is reached only through its guard, by the task that takes it
  }
  if (task && isThreadsLayout(info)) {
    return (
      "a guard, a channel or a scope is shared only by the rules of its own block; a task reaches a " +
      "channel through its argument, `s.spawn(entry, arg)`, where the scope counts its senders"
    )
  }
  if (isThreadsLayout(info)) {
    return "a scope, a lock, a guard or a channel is shared only by the rules of its own block"
  }
  for (const field of info.fields) {
    const inner = captureObstacle(program, table, field.type, seen, task)
    if (inner.length > 0) {
      return inner
    }
  }
  return ""
}

/** The refusal for capturing `name` of `type`, or "" when it may be captured. */
export const captureTypeMessage = (
  program: CheckedProgram,
  table: TypeTable,
  name: string,
  type: i32,
  task: boolean
): string => {
  const why = captureObstacle(program, table, type, new StringSet(), task)
  if (why.length === 0) {
    return ""
  }
  if (task) {
    return `The arrow reads \`${name}\`, which is \`${table.typeName(type)}\`, and a task cannot capture it: ${why}`
  }
  return (
    `The arrow reads \`${name}\`, which is \`${table.typeName(type)}\`, and a data-parallel body cannot capture it: ` +
    why
  )
}

/** A `const` whose initialiser allocated an array of its own (`Local.fresh`). */
const isFreshConst = (local: Local): boolean =>
  local.fresh && !local.mutable && local.storage !== STORAGE_PARAM

/**
 * Whether the captured array `captured` and `dst` are two arrays: two
 * different bindings, one of them a `const` that allocated its own array and
 * the other that or a parameter. A fresh array is memory no binding held
 * before it was made, a parameter's value was fixed before the function ran,
 * and neither name can be bound again, so nothing makes them one array.
 */
const knownApart = (captured: Local, dst: Local | null): boolean => {
  if (dst === null || dst === captured) {
    return false
  }
  const capturedParam = captured.storage === STORAGE_PARAM && captured.name !== "this"
  const dstParam = dst.storage === STORAGE_PARAM && dst.name !== "this"
  return (isFreshConst(captured) && (isFreshConst(dst) || dstParam)) || (isFreshConst(dst) && capturedParam)
}

/**
 * A captured value through which the body could read `dst` while another
 * thread writes it: the capture's form of `reachesDstMessage`. A capture is a
 * binding the call can name, so one case is admitted by identity rather than
 * refused by type: a captured array of `dst`'s type that is a `const` bound to
 * an array of its own (`Local.fresh`), when `dst` is a different such `const`.
 * Two fresh arrays are two buffers. Everything else that reaches an array of
 * `dst`'s element type is refused, naming the path.
 */
export const captureReachesDstMessage = (
  table: TypeTable,
  program: CheckedProgram,
  sig: FunctionSig,
  fn: FunctionSig,
  dstLocal: Local | null
): string => {
  const instance = sig.instance
  if (instance === null || instance.parallel !== PAR_MAP || instance.typeArgs.length < 2) {
    return ""
  }
  const target = instance.typeArgs[1]
  for (const captured of fn.captures) {
    const path = reachingPath(table, program, captured.type, target, captured.name, new StringSet())
    if (path.length === 0) {
      continue
    }
    if (path === captured.name && knownApart(captured, dstLocal)) {
      continue
    }
    return (
      `\`${fn.sourceName}\` reads \`${captured.name}\`, and can reach a \`${table.typeName(target)}[]\` through ` +
      `\`${path}\`, which could be the array \`parallelMapInto\` is writing: another thread would be writing it ` +
      "while this one reads; a captured array is known not to be `dst` only when one of the two is a `const` bound " +
      "to an array of its own, such as a literal or a `new Array`, and the other is another such `const` or a parameter"
    )
  }
  return ""
}

// ---- The grain ---------------------------------------------------------------------------
//
// A map region is divided into `ceil(length / grain)` chunks, at most one per
// core, so the grain decides whether a map is worth threads at all. A region divided four
// ways costs about 11 µs on the worker pool (docs/wp20-threads.md §8e), where
// it cost about 100 µs of `pthread_create` and join before it, and the chunks
// also pay for the caches they no longer share. How many elements cover that
// depends on the body, so the grain is a target over an estimate of one
// element:
//
//     grain = REGION_COST / cost(f), which is in [1, REGION_COST]
//
// The estimate is read off the body's syntax, in units of roughly one simple
// operation, and `REGION_COST` was set by measurement rather than by what a
// unit is worth: a body that does one operation on its element has to win
// at two chunks (docs/wp29-thread-surface.md §8a has the calibration). It is
// deliberately crude, and it errs both ways. A callee counts as a call and not
// as its body, so work hidden behind a call is estimated cheap and divided too
// little. A loop whose trip count the header does not state counts
// `DEFAULT_TRIPS`, which overestimates a loop over a short array; that costs
// threads only once the estimate reaches `REGION_COST` over the length, which
// for a map of eight elements takes three such loops nested, or two around a
// hundred operations.

/**
 * The grain, in estimate units: a map divides once its length passes
 * `REGION_COST` over the body's estimate, and its first division is two
 * chunks of half that. It was measured with `(x) => x + 1`, estimated at 3:
 * at two chunks of 2^20 units it beat its loop by 1.31x on the minimum and
 * 1.19x on the median, more than any difference between the loop and a
 * byte-identical copy of it (at most 3.3% on a minimum and 9.1% on a median).
 * At two chunks of 2^19 units the minimum won by 1.16x but the median by only
 * 1.04x, inside that 9.1%, so the grain is 2^21. With a thread started per
 * region it was 2^22 (docs/wp29-thread-surface.md §8a). A body estimated
 * below 3, such as `(x) => x`, divides later.
 */
const REGION_COST: i32 = 2097152

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

/** A task with no destination whose entry answers something, which nothing would store. */
export const voidTaskResultMessage = (table: TypeTable, fn: FunctionSig): string => {
  if (fn.returnType === T_VOID) {
    return ""
  }
  const shown = fn.lifted ? "The arrow" : `\`${fn.sourceName}\``
  return (
    `${shown} answers \`${table.typeName(fn.returnType)}\`, and a \`spawn\` without a destination stores nothing: ` +
    "a task's answer is kept only by `s.spawn(entry, arg, dst, at)`, which stores it in `dst[at]` when the scope " +
    "joins, so make the task answer `void` or give it a destination"
  )
}

/** The argument of a task is a `Result` the ABI passes as its parts. */
export const taskArgumentMessage = (table: TypeTable, sig: FunctionSig): string => {
  const arg = taskArgTypeOf(sig)
  if (arg < 0 || !table.resultByValue(arg)) {
    return ""
  }
  return (
    `The argument of \`spawn\` is \`${table.typeName(arg)}\`, which a task cannot be handed: ` +
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

/** The symbol `nish/threads`'s `scope()` is called by, or "" when no program loaded the module. */
const scopeSymbol = (programs: CheckedProgram[]): string => {
  for (const program of programs) {
    if (isThreadsModule(program)) {
      for (const sig of program.functions) {
        if (sig.sourceName === "scope" && sig.instance === null && sig.owner === null) {
          return sig.name
        }
      }
    }
  }
  return ""
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
  const named: Local | null =
    node.kind === N_IDENT && !declaresName ? sourceLocal(program.nodeLocals[node.id]) : null
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
  if (loaded && program.packageName !== CLI) {
    checkFieldTypes(program, table, program.file, out)
  }
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
      findGuardBlocks(program, facts, body, new HeldContext(scopeType, scopeSymbol(programs), summaries), out)
      // The standard library holds no channel of its own; one handed to it is
      // refused at the user's call (`takesChannelParameter`), not inside it.
      if (program.packageName !== CLI) {
        checkChannels(program, table, summaries, sig, body, scopeType, out)
      }
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
  /** A `const` bound to a `new`: an object no other binding held when it was made. */
  freshNew: boolean[]
  handedOn: boolean[]
  destination: boolean[]

  constructor() {
    this.locals = []
    this.freshArray = []
    this.freshLiteral = []
    this.freshNew = []
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
    this.freshNew.push(false)
    this.handedOn.push(false)
    this.destination.push(false)
    return this.locals.length - 1
  }

  /** A `const` bound to a fresh array, never handed on: what a destination has to be. */
  isDestinationShaped(local: Local | null): boolean {
    const at = this.indexOf(local)
    return at >= 0 && this.freshArray[at] && !this.handedOn[at]
  }

  /** A `const` bound to a `new`, whose object no other binding of this function's names. */
  isFreshNew(local: Local | null): boolean {
    const at = this.indexOf(local)
    return at >= 0 && this.freshNew[at]
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
  // A data-parallel arrow's capture is the local it was made from (WP29).
  return e.kind === N_IDENT ? sourceLocal(program.nodeLocals[e.id]) : null
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

/** Every local an arrow task captures, handed on: the task holds each one until its scope joins. */
const handOnCaptures = (program: CheckedProgram, arrow: Node, uses: VariableUses): void => {
  const reads: Node[] = []
  capturedReads(program, arrow, reads)
  for (const read of reads) {
    const local = sourceLocal(program.nodeLocals[read.id])
    if (local !== null) {
      uses.handedOn[uses.add(local)] = true
    }
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
        uses.freshNew[at] = constant && unwrapParens(decl.children[2]).kind === N_NEW
      }
    }
  }
  if (node.kind === N_IDENT && parent !== null) {
    const local = sourceLocal(program.nodeLocals[node.id])
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
      } else if (arg.kind === N_ARROW) {
        // An arrow task reads what it captures when the scope joins, as a task
        // reads its argument, so each one is handed on however the arrow uses it.
        handOnCaptures(program, arg, uses)
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
  /**
   * WP29 P3: the argument type of every task of the scope, and of every
   * `const` an arrow task captures, which is what R7 asks a lock about.
   */
  taskArgs: i32[]
  /** Parallel to `taskArgs`: how R7 names each, `arg` or the captured local's name. */
  taskArgRoots: string[]
  /** Whether a task of the scope can have been filed by now, with a destination or without one. */
  started: boolean

  constructor(locals: Local[], name: string) {
    this.locals = locals
    this.name = name
    this.destinations = []
    this.taskArgs = []
    this.taskArgRoots = []
    this.started = false
  }

  owns(local: Local | null): boolean {
    return local !== null && this.locals.indexOf(local) >= 0
  }

  isDestination(local: Local | null): boolean {
    return local !== null && this.destinations.indexOf(local) >= 0
  }

  /** A `spawn` on the scope has been passed: its destination, if it has one, is `local`. */
  addDestination(local: Local | null): void {
    this.started = true
    if (local !== null && this.destinations.indexOf(local) < 0) {
      this.destinations.push(local)
    }
  }

  /** Whether a task can have been filed by now: the first `spawn`, or one in a loop around this. */
  live(): boolean {
    return this.started
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
    // An arrow's captures reach the task as its argument does.
    const arg = taskArgTypeOf(callee)
    if (arg >= 0) {
      state.taskArgs.push(arg)
      state.taskArgRoots.push("arg")
    }
    for (const slot of capturesOf(callee)) {
      state.taskArgs.push(slot.type())
      state.taskArgRoots.push(slot.arrow.captures[slot.index].name)
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
  // An atomic's method writes only its own word, and whether a task reaches
  // that word is `regionAtomicMessageFor`'s to judge, by the types the tasks
  // hold: an atomic none of them reaches is the parent's alone.
  if (isAtomicMethod(sig)) {
    return ""
  }
  return writesThroughMessage(program, table, facts, node, sig, state)
}

/**
 * The refusal for a call or a `new` of `sig` at `node` in the region when it
 * writes through a pointer it is handed, or "". A constructor's own `this` is
 * the fresh object the `new` allocated, which no task can hold yet (#564), so
 * a store into it is not counted, and neither is a constructor that writes
 * nothing shared: `writesThrough` also marks a parameter it keeps, as
 * `this.hist = hist` does, for an alias that may be written later, and what is
 * written through the new object later is judged where it is. A constructor
 * that hands `this` on does so by a store through another parameter, which is
 * counted.
 */
const writesThroughMessage = (
  program: CheckedProgram,
  table: TypeTable,
  facts: FactsTable,
  node: Node,
  sig: FunctionSig,
  state: RegionState
): string => {
  const constructing = node.kind === N_NEW
  const own = facts.get(sig.name)
  if (own === null) {
    return regionWriteMessage(state, lockCallName(node, sig))
  }
  if (constructing && !own.sharedWrite) {
    return ""
  }
  for (const pp of own.pointerParams) {
    // WP29 P3: what a call does to a channel is C4's and C5's to judge (`checkChannels`).
    // `writesReach` too: a store into `p.inner.x` is not a write through `p`
    // for LLVM, but a task holding `p` reads it.
    if (
      (pp.writesThrough || pp.writesReach) &&
      !(constructing && pp.name === "this") &&
      !isChannelParam(program, table, sig, pp.name)
    ) {
      return regionWriteMessage(state, lockCallName(node, sig))
    }
  }
  return ""
}

/**
 * The `walkOpen` a `for...of` straight over a `Map` or `Set` calls where the
 * loop is entered, or null for any other loop. A walk of `m.keys()` or
 * `m.values()` is a call of its own, which the region judges as one.
 */
const walkOpenOf = (program: CheckedProgram, loop: Node): FunctionSig | null => {
  if (unwrapParens(loop.children[1]).kind === N_CALL) {
    return null
  }
  const read = program.nodeCallees[loop.id]
  const owner: StructInfo | null = read === null ? null : read.owner
  return owner === null || !isCollectionStruct(owner) ? null : owner.method("walkOpen")
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
    // A lifted function of its own, which runs only when called — but an arrow
    // given to a data-parallel form runs here, and reads what it captures.
    if (state.live()) {
      regionCaptureReads(program, node, state, out)
    }
    return
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
  if (node.kind === N_CALL || node.kind === N_NEW) {
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
  } else if (node.kind === N_FOR_OF && walkOpenOf(program, node) !== null) {
    // A walk of a `Map` or `Set` itself is a call of its `walkOpen`, which
    // counts the walk into the table, as `s.keys()` in the same place is.
    const open = walkOpenOf(program, node)
    message = open === null ? "" : writesThroughMessage(program, table, facts, node, open, state)
  } else if (node.kind === N_CALL) {
    message = regionCallMessage(program, table, facts, node, state, uses)
  } else if (node.kind === N_NEW) {
    // #564: a constructor is a call.
    const sig = program.nodeCallees[node.id]
    message = sig === null ? "" : writesThroughMessage(program, table, facts, node, sig, state)
  }
  if (message.length > 0) {
    out.push(new ScopeFinding(node, message))
    if (node.kind === N_CALL) {
      // A refused data-parallel call still reads, there, what its arrow captures.
      for (const arg of node.children[1].children) {
        if (arg.kind === N_ARROW) {
          regionCaptureReads(program, arg, state, out)
        }
      }
    }
    return
  }
  for (const child of node.children) {
    walkRegion(program, table, facts, uses, child, state, out)
  }
}

/**
 * WP29: the captures an arrow given to a data-parallel form reads, judged as
 * reads where the call runs it. Any use of a destination is one: the body may
 * index it, walk it, or hand it to a call, and it runs before the scope joins.
 */
const regionCaptureReads = (
  program: CheckedProgram,
  arrow: Node,
  state: RegionState,
  out: ScopeFinding[]
): void => {
  const reads: Node[] = []
  capturedReads(program, arrow, reads)
  for (const read of reads) {
    if (state.isDestination(sourceLocal(program.nodeLocals[read.id]))) {
      out.push(new ScopeFinding(read, regionReadMessage(state, read.text)))
      return
    }
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
        if (locals.length > 1) {
          checkSiblingScopes(program, table, facts, uses, node, i, locals, out)
        }
      }
      i = i + 1
    }
  }
  for (const child of node.children) {
    findRegions(program, table, facts, uses, child, out)
  }
}

/**
 * R7 across the scopes one `using` statement opens, `using s = scope(), t =
 * scope()`: natively they join one after the other, the last declared first,
 * so every task of `t` runs before any of `s`, while under Node each runs
 * where it is spawned. Tasks of two of them may therefore share no lock, no
 * atomic and no destination, whichever is spawned first. What a task shares
 * is judged by what it reaches: a `Mutex` or an atomic it is handed as a
 * `const` bound to a `new` is that binding's object alone, and one it reaches
 * any other way is every object of its type.
 */
const checkSiblingScopes = (
  program: CheckedProgram,
  table: TypeTable,
  facts: FactsTable,
  uses: VariableUses,
  block: Node,
  at: i32,
  locals: Local[],
  out: ScopeFinding[]
): void => {
  const spawns: SiblingSpawn[] = []
  let k = at + 1
  while (k < block.children.length) {
    collectSiblingSpawns(program, table, facts, uses, block.children[k], locals, spawns)
    k = k + 1
  }
  let j = 0
  while (j < spawns.length) {
    let i = 0
    let message = ""
    while (i < j && message.length === 0) {
      if (spawns[i].scope !== spawns[j].scope) {
        message = siblingShareMessage(spawns[i], spawns[j])
      }
      i = i + 1
    }
    if (message.length > 0) {
      out.push(new ScopeFinding(spawns[j].node, message))
    }
    j = j + 1
  }
}

/**
 * A lock or an atomic a task reaches, for `checkSiblingScopes`: `local` when
 * it is that `const`'s own object, `null` when it is any object of `type`,
 * and `path` how the task reaches it.
 */
class SiblingReach {
  local: Local | null
  path: string
  type: i32
  atomic: boolean

  constructor(atomic: boolean, local: Local | null, type: i32, path: string) {
    this.atomic = atomic
    this.local = local
    this.type = type
    this.path = path
  }

  /** Whether `other` may be the same object. */
  meets(other: SiblingReach): boolean {
    if (this.atomic !== other.atomic || this.type !== other.type) {
      return false
    }
    const mine = this.local
    const theirs = other.local
    return mine === null || theirs === null || mine === theirs
  }
}

/** One `spawn` on a scope of a `using` that opens several: its scope, destination, and the locks and atomics its task reaches. */
class SiblingSpawn {
  node: Node
  scope: Local
  destination: Local | null
  reaches: SiblingReach[]

  constructor(node: Node, scope: Local, destination: Local | null) {
    this.node = node
    this.scope = scope
    this.destination = destination
    this.reaches = []
  }
}

/** Every `spawn` under `node` on one of `locals`' scopes, with what its task reaches. */
const collectSiblingSpawns = (
  program: CheckedProgram,
  table: TypeTable,
  facts: FactsTable,
  uses: VariableUses,
  node: Node,
  locals: Local[],
  out: SiblingSpawn[]
): void => {
  if (node.kind === N_ARROW) {
    return
  }
  const callee = spawnCallee(program, node)
  const receiver: Local | null = callee === null ? null : spawnReceiver(program, node)
  if (callee !== null && receiver !== null && locals.indexOf(receiver) >= 0) {
    const spawn = new SiblingSpawn(node, receiver, spawnDestination(program, node))
    // A task that takes no lock shares none, and one that reaches no atomic method no atomic.
    const locks = takesLock(facts, callee)
    const atomics = reachesAtomic(facts, callee.name, new StringSet())
    const arg = taskArgTypeOf(callee)
    if (arg >= 0) {
      const args = node.children[1].children
      const local: Local | null = args.length > 1 ? namedLocal(program, args[1]) : null
      const root = local === null ? "arg" : local.name
      siblingReaches(program, table, uses, arg, local, root, locks, atomics, spawn.reaches)
    }
    for (const slot of capturesOf(callee)) {
      const local = sourceLocal(slot.arrow.captures[slot.index])
      const name = slot.arrow.captures[slot.index].name
      siblingReaches(program, table, uses, slot.type(), local, name, locks, atomics, spawn.reaches)
    }
    out.push(spawn)
  }
  for (const child of node.children) {
    collectSiblingSpawns(program, table, facts, uses, child, locals, out)
  }
}

/** What a task input of `type`, read from `local` and named `root`, reaches: pushed onto `out`. */
const siblingReaches = (
  program: CheckedProgram,
  table: TypeTable,
  uses: VariableUses,
  type: i32,
  local: Local | null,
  root: string,
  locks: boolean,
  atomics: boolean,
  out: SiblingReach[]
): void => {
  const info = classLayoutOf(program, table, type)
  let own: Local | null = null
  if (local !== null && uses.isFreshNew(local)) {
    own = local
  }
  if (own !== null && isAtomicClass(info)) {
    if (atomics) {
      out.push(new SiblingReach(true, own, type, own.name))
    }
    return
  }
  if (own !== null && info !== null && isThreadsClass(info, MUTEX)) {
    if (locks) {
      out.push(new SiblingReach(false, own, type, own.name))
    }
    // What its data holds is reached through the lock, as any field is.
    for (const field of info.fields) {
      heldReaches(
        program,
        table,
        field.type,
        `${own.name}.${field.name}`,
        locks,
        atomics,
        new StringSet(),
        out
      )
    }
    return
  }
  heldReaches(program, table, type, root, locks, atomics, new StringSet(), out)
}

/** Every `Mutex` and atomic a value of `type` reaches, by type: `heldPath`'s walk, collecting. */
const heldReaches = (
  program: CheckedProgram,
  table: TypeTable,
  type: i32,
  root: string,
  locks: boolean,
  atomics: boolean,
  seen: StringSet,
  out: SiblingReach[]
): void => {
  const kind = table.kindOf(type)
  if (kind === K_NULLABLE) {
    heldReaches(program, table, table.refOf(type), root, locks, atomics, seen, out)
    return
  }
  if (kind === K_ARRAY) {
    heldReaches(program, table, table.refOf(type), `${root}[i]`, locks, atomics, seen, out)
    return
  }
  if (kind === K_RESULT) {
    heldReaches(program, table, table.okOf(type), `${root}.value`, locks, atomics, seen, out)
    heldReaches(program, table, table.errOf(type), `${root}.error`, locks, atomics, seen, out)
    return
  }
  const info = classLayoutOf(program, table, type)
  if (info === null) {
    return
  }
  if (isAtomicClass(info)) {
    if (atomics) {
      out.push(new SiblingReach(true, null, type, root))
    }
    return
  }
  if (isThreadsClass(info, MUTEX) && locks) {
    out.push(new SiblingReach(false, null, type, root))
  }
  if (!seen.add(info.name)) {
    return
  }
  for (const field of info.fields) {
    heldReaches(program, table, field.type, `${root}.${field.name}`, locks, atomics, seen, out)
  }
}

/** The refusal of `later`, a `spawn` on a scope sibling to `earlier`'s, when their tasks share something, or "". */
const siblingShareMessage = (earlier: SiblingSpawn, later: SiblingSpawn): string => {
  const destination = later.destination
  const shared = earlier.destination
  if (destination !== null && shared !== null && destination === shared) {
    return siblingMessage(later, earlier, `the destination \`${destination.name}\``)
  }
  for (const reach of later.reaches) {
    for (const other of earlier.reaches) {
      if (reach.meets(other)) {
        const what = reach.atomic ? "an atomic" : "a `Mutex`"
        return siblingMessage(later, earlier, `${what} through \`${reach.path}\``)
      }
    }
  }
  return ""
}

const siblingMessage = (later: SiblingSpawn, earlier: SiblingSpawn, what: string): string =>
  `This \`spawn\` on \`${later.scope.name}\` hands its task ${what}, which a task of \`${earlier.scope.name}\` ` +
  "also reaches: the scopes one `using` statement opens join one after the other natively, the last declared " +
  "first, while under Node each task runs where it is spawned, so the tasks of sibling scopes share no lock, no " +
  "atomic and no destination; open the scopes in `using` statements of their own"

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
const isChannelType = (program: CheckedProgram, table: TypeTable, type: i32): boolean =>
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

// ---- Atomics: `AtomicI32` and `AtomicI64` ------------------------------------------------
//
// An atomic is a class of one scalar whose methods the emitter writes as one
// sequentially consistent instruction each (`emitAtomicBody`). It reaches a
// task as a `Mutex` does, by its argument or a capture, and R7 holds of it as
// of a lock; an atomic method's write is not a shared one, so a task and a
// data-parallel body may make it beside the guarded store and the send.

/** The two classes `nish/threads` declares for atomics. */
const ATOMIC_I32: string = "AtomicI32"
const ATOMIC_I64: string = "AtomicI64"

/**
 * Mark `info` as an atomic when it is `AtomicI32` or `AtomicI64` and `program`
 * is `nish/threads` itself, as the class is collected. The package is part of
 * the test, as `isThreadsModule`'s is: a root-package `std/threads.ts` that
 * declares an `AtomicI32` declares an ordinary class, whose bodies run as they
 * are written.
 */
export const markAtomicClass = (program: CheckedProgram, info: StructInfo): void => {
  if (
    info.kind === STRUCT_CLASS &&
    (info.name === ATOMIC_I32 || info.name === ATOMIC_I64) &&
    isThreadsModule(program)
  ) {
    info.atomic = true
  }
}

/** Whether `info` is `nish/threads`'s `AtomicI32` or `AtomicI64`. */
const isAtomicClass = (info: StructInfo | null): boolean => info !== null && info.atomic

/** Whether `type` is an `AtomicI32` or an `AtomicI64`. */
const isAtomicType = (program: CheckedProgram, table: TypeTable, type: i32): boolean =>
  isAtomicClass(classLayoutOf(program, table, type))

/** Whether `type` is a class `nish/threads` declares, an atomic included. */
const isThreadsObjectType = (program: CheckedProgram, table: TypeTable, type: i32): boolean => {
  const info = classLayoutOf(program, table, type)
  return info !== null && (isAtomicClass(info) || isThreadsLayout(info))
}

/** Whether `sig` is a method of an atomic, whose body the emitter writes. */
export const isAtomicMethod = (sig: FunctionSig): boolean =>
  isAtomicClass(sig.owner) && sig.decl.kind === N_METHOD

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

const atomicMemberMessage = (name: string): string =>
  `\`${name}\` is not a member a program may name: an atomic is read and updated only by calling its ` +
  "methods, `load()`, `add(n)` and the rest, each one indivisible: a plain read or store of its word would race " +
  "with the update a task makes at the same moment"

const threadsLiteralMessage = (table: TypeTable, type: i32): string =>
  `\`${table.typeName(type)}\` is a class of \`nish/threads\`, and its objects are made only as the module ` +
  "makes them: `new AtomicI32(v)`, `new AtomicI64(v)`, `new Mutex(v)`, `new Channel()`, `m.lock()` and `scope()`. " +
  "An object literal would be a plain record under Node, with none of the methods the class is used through"

const lockNotUsingMessage = (): string =>
  "`lock()` must be the initialiser of a `using` declaration, `using g = m.lock()`: the lock is released " +
  "when the block that declares it ends, so a guard bound any other way would be one nobody releases"

const guardUseMessage = (name: string): string =>
  `A guard is used only as \`${name}.value\`, and \`${name}.value\` only as the base of a field or element ` +
  "read or store: passed, bound, stored, returned or walked, what it reaches would outlive the block that holds the lock"

const guardDerivedMessage = (table: TypeTable, type: i32): string =>
  `This reads \`${table.typeName(type)}\` through a guard, whose chains are only the base of a further field or ` +
  "element read or store: a value that is not a number, a `boolean` or an enum would outlive the block that holds the lock"

const guardStoreMessage = (table: TypeTable, type: i32): string =>
  `This stores \`${table.typeName(type)}\` through a guard, which stores only a number, a \`boolean\` or ` +
  "an enum, into a field or an element that already exists: anything else is a pointer, which may point into " +
  "a task's arena, freed when the task is joined"

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

const regionAtomicMessage = (state: RegionState, what: string, path: string): string =>
  `${what} reaches an atomic a task of \`${state.name}\` can reach through \`${path}\`, before the scope ` +
  "joins: natively the scope's tasks run when its block ends and under Node each runs where it is spawned, " +
  "so the parent touches what they share only before the statement that holds the first `spawn` or after the join"

const taskCaptureMutexMessage = (table: TypeTable, name: string, type: i32, path: string): string =>
  `The task's arrow reads \`${name}\`, which is \`${table.typeName(type)}\` and reaches a \`Mutex\` through ` +
  `\`${path}\`: a captured value is the task's argument, and a \`Mutex\` reaches a task as an argument or as a ` +
  "field of the class an argument is, never deeper, so which tasks share a lock is a question the checker can answer"

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

/**
 * Whether `name`, among the symbols a call can reach, is one R5 refuses while
 * a lock is held: the lock's wait, or — unless `locksOnly` — a task filed, a
 * data-parallel region, or `scopeName`, the symbol of `nish/threads`'s
 * `scope()`, whose block joins when it ends.
 */
const isWaitSymbol = (name: string, locksOnly: boolean, scopeName: string): boolean =>
  name === "nish_mutex_wait" ||
  (!locksOnly &&
    (name === "nish_scope_spawn" ||
      name === "nish_parallel_range" ||
      name === "nish_scope_join" ||
      name === scopeName))

/**
 * Whether a call of `name` reaches, through its callees, a lock (`locksOnly`)
 * or anything R5 refuses inside a guard's block: a lock, a scope opened, a
 * task filed or joined, or a data-parallel region. Each is a symbol the
 * fixpoint has put among the callees of the function that reaches it
 * (`markLock`, `markParallelEntry` in `src/attributes.ts`); a constructor a
 * `new` runs is one of them, as any callee is.
 */
const reachesWait = (
  facts: FactsTable,
  name: string,
  locksOnly: boolean,
  scopeName: string,
  seen: StringSet
): boolean => {
  if (isWaitSymbol(name, locksOnly, scopeName)) {
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
    if (reachesWait(facts, own.callees.at(c), locksOnly, scopeName, seen)) {
      return true
    }
    c = c + 1
  }
  return false
}

/** Whether the function `name` is an atomic method or calls one, directly or through any callee. */
const reachesAtomic = (facts: FactsTable, name: string, seen: StringSet): boolean => {
  if (!seen.add(name)) {
    return false
  }
  const own = facts.get(name)
  if (own === null) {
    return false
  }
  if (own.atomic) {
    return true
  }
  let c = 0
  while (c < own.callees.size()) {
    if (reachesAtomic(facts, own.callees.at(c), seen)) {
      return true
    }
    c = c + 1
  }
  return false
}

/** Whether a call of `fn` takes a lock, directly or through any callee. */
const takesLock = (facts: FactsTable, fn: FunctionSig): boolean =>
  reachesWait(facts, fn.name, true, "", new StringSet())

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
): string => heldPath(table, program, type, want, false, root, seen)

/**
 * `mutexPath`, or with `atomics` the same walk to an `AtomicI32` or an
 * `AtomicI64` — `want`, or any when `want` is -1.
 */
const heldPath = (
  table: TypeTable,
  program: CheckedProgram,
  type: i32,
  want: i32,
  atomics: boolean,
  root: string,
  seen: StringSet
): string => {
  const kind = table.kindOf(type)
  if (kind === K_NULLABLE) {
    return heldPath(table, program, table.refOf(type), want, atomics, root, seen)
  }
  if (kind === K_ARRAY) {
    return heldPath(table, program, table.refOf(type), want, atomics, `${root}[i]`, seen)
  }
  if (kind === K_RESULT) {
    const ok = heldPath(table, program, table.okOf(type), want, atomics, `${root}.value`, seen)
    return ok.length > 0
      ? ok
      : heldPath(table, program, table.errOf(type), want, atomics, `${root}.error`, seen)
  }
  const info = classLayoutOf(program, table, type)
  if (info === null) {
    return ""
  }
  const held = atomics ? isAtomicClass(info) : isThreadsClass(info, MUTEX)
  if (held && (want < 0 || type === want)) {
    return root
  }
  if (!seen.add(info.name)) {
    return ""
  }
  for (const field of info.fields) {
    const path = heldPath(table, program, field.type, want, atomics, `${root}.${field.name}`, seen)
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
  const arg = taskArgTypeOf(sig)
  if (arg >= 0) {
    const path = taskMutexPath(table, program, arg, "arg")
    if (path.length > 0) {
      return taskMutexMessage(table, arg, path)
    }
  }
  // An arrow's captures are the task's arguments too, each held to the same rule.
  for (const slot of capturesOf(sig)) {
    const name = slot.arrow.captures[slot.index].name
    const path = taskMutexPath(table, program, slot.type(), name)
    if (path.length > 0) {
      return taskCaptureMutexMessage(table, name, slot.type(), path)
    }
  }
  return ""
}

/** R8's path from a task's input of `type`, named `root`, to a `Mutex` deeper than it allows, or "". */
const taskMutexPath = (table: TypeTable, program: CheckedProgram, type: i32, root: string): string => {
  const info = classLayoutOf(program, table, type)
  if (info === null) {
    return mutexPath(table, program, type, -1, root, new StringSet())
  }
  if (isThreadsClass(info, MUTEX)) {
    return mutexInside(table, program, type, root)
  }
  let path = ""
  let k = 0
  while (k < info.fields.length && path.length === 0) {
    const field = info.fields[k]
    const at = `${root}.${field.name}`
    path = isMutexType(program, table, field.type)
      ? mutexInside(table, program, field.type, at)
      : mutexPath(table, program, field.type, -1, at, new StringSet())
    k = k + 1
  }
  return path
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
  } else if (node.kind === N_OBJECT && isThreadsObjectType(program, table, type)) {
    out.push(new ScopeFinding(node, threadsLiteralMessage(table, type)))
    return
  } else if (node.kind === N_MEMBER && isAtomicType(program, table, program.nodeTypes[node.children[0].id])) {
    if (!called) {
      out.push(new ScopeFinding(node, atomicMemberMessage(node.text)))
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

/**
 * How a diagnostic names the call `node` makes of `callee`: the function by its
 * name, or a `new` by the class it makes, whose constructor is the callee.
 */
const lockCallName = (node: Node, callee: FunctionSig): string =>
  node.kind === N_NEW ? `\`new ${node.children[0].text}\`` : `\`${callee.sourceName}\``

/** What R5 refuses at `node`, a call or a `new`, while a lock is held, in words, or "". */
const heldWhat = (
  program: CheckedProgram,
  facts: FactsTable,
  node: Node,
  scopeType: i32,
  scopeName: string
): string => {
  if (node.kind !== N_CALL && node.kind !== N_NEW) {
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
  if (reachesWait(facts, callee.name, false, scopeName, new StringSet())) {
    return `${lockCallName(node, callee)}, which takes a lock or waits for threads,`
  }
  return ""
}

/** The two `nish/threads` facts R5 needs: the type `scope()` answers, and the symbol it is called by. */
class HeldContext {
  /** WP29 P3: what each function may receive on, for C7. */
  summaries: ChannelSummaries
  scopeName: string
  scopeType: i32

  constructor(scopeType: i32, scopeName: string, summaries: ChannelSummaries) {
    this.scopeType = scopeType
    this.scopeName = scopeName
    this.summaries = summaries
  }
}

/**
 * R5 over `node`, which runs after the `using` that bound the guard `name` —
 * a later statement of its block, or a later declarator of the same `using` —
 * and everything under it.
 */
const walkHeld = (
  program: CheckedProgram,
  facts: FactsTable,
  node: Node,
  name: string,
  held: HeldContext,
  out: ScopeFinding[]
): void => {
  if (node.kind === N_ARROW) {
    return // a lifted function of its own; a call that runs it is judged where it is
  }
  // WP29 P3, C7: a receive waits, as surely as a second lock does.
  const receive = receiveWhat(program, held.summaries, node)
  if (receive.length > 0) {
    out.push(new ScopeFinding(node, guardReceiveMessage(receive, name)))
    return
  }
  const what = heldWhat(program, facts, node, held.scopeType, held.scopeName)
  if (what.length > 0) {
    out.push(new ScopeFinding(node, guardHeldMessage(what, name)))
    return
  }
  for (const child of node.children) {
    walkHeld(program, facts, child, name, held, out)
  }
}

/**
 * Every block under `node` that binds a guard, with R5 judged from the guard's
 * declarator to the block's end: the later declarators of its own `using`
 * (`using g = a.lock(), h = b.lock()` takes two locks), then every later
 * statement.
 */
const findGuardBlocks = (
  program: CheckedProgram,
  facts: FactsTable,
  node: Node,
  held: HeldContext,
  out: ScopeFinding[]
): void => {
  if (node.kind === N_BLOCK) {
    let i = 0
    while (i < node.children.length) {
      const stmt = node.children[i]
      if (stmt.kind === N_VAR && (stmt.flags & FLAG_USING) !== 0) {
        const decls = stmt.children[0].children
        let d = 0
        while (d < decls.length) {
          const name = decls[d].children[0].text
          if (isLockCall(program, unwrapParens(decls[d].children[2]))) {
            let e = d + 1
            while (e < decls.length) {
              walkHeld(program, facts, decls[e].children[2], name, held, out)
              e = e + 1
            }
            let j = i + 1
            while (j < node.children.length) {
              walkHeld(program, facts, node.children[j], name, held, out)
              j = j + 1
            }
          }
          d = d + 1
        }
      }
      i = i + 1
    }
  }
  for (const child of node.children) {
    findGuardBlocks(program, facts, child, held, out)
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
  let what = lockCallName(node, callee)
  if (isLockMethod(callee)) {
    want = program.nodeTypes[unwrapParens(node.children[0].children[0]).id]
    what = "This `lock()`"
  } else if (!takesLock(facts, callee)) {
    return regionAtomicMessageFor(program, table, facts, node, callee, state)
  }
  let k = 0
  while (k < state.taskArgs.length && k < state.taskArgRoots.length) {
    const path = mutexPath(table, program, state.taskArgs[k], want, state.taskArgRoots[k], new StringSet())
    k = k + 1
    if (path.length > 0) {
      return regionLockMessage(state, what, path)
    }
  }
  return regionAtomicMessageFor(program, table, facts, node, callee, state)
}

/**
 * R7 for atomics: the refusal of `node`, a call of `callee` in `state`'s
 * region, when it updates or reads an atomic a task of the scope can reach —
 * a method of an atomic of a type a task's argument reaches, or a call that
 * reaches any atomic method when a task reaches any atomic — or "".
 */
const regionAtomicMessageFor = (
  program: CheckedProgram,
  table: TypeTable,
  facts: FactsTable,
  node: Node,
  callee: FunctionSig,
  state: RegionState
): string => {
  let want = -1
  let what = lockCallName(node, callee)
  if (isAtomicMethod(callee)) {
    want = program.nodeTypes[unwrapParens(node.children[0].children[0]).id]
    what = `This \`${callee.decl.children[0].text}()\``
  } else if (!reachesAtomic(facts, callee.name, new StringSet())) {
    return ""
  }
  let k = 0
  while (k < state.taskArgs.length && k < state.taskArgRoots.length) {
    const path = heldPath(
      table,
      program,
      state.taskArgs[k],
      want,
      true,
      state.taskArgRoots[k],
      new StringSet()
    )
    k = k + 1
    if (path.length > 0) {
      return regionAtomicMessage(state, what, path)
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
//   - C1: what it carries is a number, a `boolean`, an enum or a `string`,
//     which a send copies out of the sender's arena and the receive copies in;
//   - C2: `new Channel` is a `const` declared beside its scope, and a channel
//     is used only as the receiver of `send`, the iterable of a `for...of`, an
//     argument to a parameter declared a `Channel`, or a field its class's
//     constructor sets from a parameter, and reaches a task only as the task's
//     argument, or a field of it, made at the `spawn` out of a channel
//     declared there, by one path and never through a `null`-able one;
//   - C3: it takes no capacity: `send` never waits;
//   - C4: one scope's tasks reach it, and the parent sends on it only before
//     that scope's block;
//   - C5: it has one receiver, a task spawned outside any loop or the parent
//     after the join, and the parent receives nothing inside a scope's block,
//     a `spawn`'s argument included;
//   - C6: every task that may send on it is spawned before the one that
//     receives on it, and no task does both;
//   - C7: nothing receives while a lock is held.
//
// A call is a receive, for C5 and C7, when its function may receive on a
// channel it is handed (`ChannelSummaries.receivesHanded`): one that receives
// only on a channel of its own has joined that channel's scope first.
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

/** C6's order. */
const CHANNEL_ORDER_TAIL: string =
  ": under Node a task runs where it is spawned, so every task that may send on a channel is spawned, in the " +
  "block's statement order, before the one task that receives on it, which is also what keeps channels from " +
  "deadlocking"

/** C6's other half: one task's two roles on one channel. */
const CHANNEL_BOTH_TAIL: string =
  ": no task both sends and receives on one channel, because a channel closes only once every task that may " +
  "send on it has returned, and this one would wait in its own loop for its own return"

/** C3: a channel takes no capacity. */
export const channelCapacityMessage = (): string =>
  "`new Channel` takes no capacity: a channel is unbounded and `send` never waits, because under Node a " +
  "scope's tasks run one at a time and nothing would drain a channel that was full"

const channelElementMessage = (table: TypeTable, type: i32): string =>
  `A \`Channel\` carries a number, a \`boolean\`, an enum or a \`string\`, and this one would carry ` +
  `\`${table.typeName(type)}\`: a sender's arena is freed when its scope joins, and only a string is copied ` +
  "out of it on the way, so anything else would point into freed memory"

const channelDeclareMessage = (what: string): string => `${what}${CHANNEL_DECLARE_TAIL}`

const channelUseMessage = (what: string): string => `${what}${CHANNEL_USE_TAIL}`

/** A channel inside an arrow's body. */
const channelArrowMessage = (): string =>
  "A `Channel` is used inside an arrow here: an arrow is lifted into a function of its own that the channel " +
  "rules do not follow, so a channel is declared, sent on and received from only in a top-level function's own body"

const channelSendersMessage = (what: string): string => `${what}${CHANNEL_SENDERS_TAIL}`

const channelReceiverMessage = (what: string): string => `${what}${CHANNEL_RECEIVER_TAIL}`

const channelOrderMessage = (what: string): string => `${what}${CHANNEL_ORDER_TAIL}`

const channelBothMessage = (what: string): string => `${what}${CHANNEL_BOTH_TAIL}`

const guardReceiveMessage = (what: string, guard: string): string =>
  `${what} is reached while \`${guard}\` holds its lock: a receive waits, and nothing waits while a lock is ` +
  "held, so there is no receive inside a guard's block, directly or through any function it calls (a `send` " +
  "never waits, and may stay)"

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

  /**
   * Whether `name` may receive on a channel it is handed. A function that
   * receives only on a channel of its own does so after that channel's scope
   * has joined (C5), and opening that scope is R5's to refuse under a lock.
   */
  receivesHanded(name: string): boolean {
    const at = this.at(name)
    return at >= 0 && (this.receivesAny[at] || this.receives[at].size() > 0)
  }

  /** Whether `name` reaches a channel through a name the summary cannot follow, and so counts every one. */
  untraceable(name: string): boolean {
    const at = this.at(name)
    return at >= 0 && (this.sendsAny[at] || this.receivesAny[at])
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
  // An arrow is lifted into a function of its own, which none of the rules
  // below follow into: a channel is refused there outright (`arrowChannel`).
  if (node.kind === N_ARROW) {
    const used = arrowChannel(program, table, node)
    if (used !== null) {
      out.push(new ScopeFinding(used, channelArrowMessage()))
    } else if (liftedTakesChannel(program, table, node)) {
      out.push(new ScopeFinding(node, channelArrowMessage()))
    }
    return
  }
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

/** The first expression of a channel type under `node`, an arrow's body, or `null`. */
const arrowChannel = (program: CheckedProgram, table: TypeTable, node: Node): Node | null => {
  for (const child of node.children) {
    const local: Local | null =
      child.kind === N_VAR_DECL || child.kind === N_PARAM ? program.nodeLocals[child.id] : null
    let type = child.kind === N_PAREN ? -1 : program.nodeTypes[child.id]
    if (local !== null) {
      type = local.type
    }
    if (holdsChannelType(program, table, type)) {
      return child
    }
    const below = arrowChannel(program, table, child)
    if (below !== null) {
      return below
    }
  }
  return null
}

/**
 * Whether the arrow `node` declares a parameter whose type holds a channel. The
 * parameters are the lifted function's, which the checker records on the
 * arrow, and a parameter the body never names leaves no expression of its type.
 */
const liftedTakesChannel = (program: CheckedProgram, table: TypeTable, node: Node): boolean => {
  const lifted = program.nodeCallees[node.id]
  if (lifted === null) {
    return false
  }
  for (const type of lifted.paramTypes) {
    if (holdsChannelType(program, table, type)) {
      return true
    }
  }
  return false
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
    if (element >= 0 && !isScalarArgument(table, element) && element !== T_STRING) {
      return channelElementMessage(table, element)
    }
    const declared =
      parent.kind === N_VAR_DECL &&
      parent.children[2] === at &&
      depth > 2 &&
      isConstDeclaration(parents[depth - 3])
    return declared ? "" : channelDeclareMessage("`new Channel` must be the initialiser of a `const`")
  }
  // A constructor holds a channel it is handed only to set a field from it;
  // one it declares itself is used as in any other function.
  const constructing = sig.role === ROLE_CONSTRUCTOR && !isChannelLocal(program, node, locals)
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
    if (call.kind === N_CALL && call.children[1] === parent && spawnCallee(program, call) !== null) {
      return isChannelLocal(program, node, locals)
        ? ""
        : channelSendersMessage("A `spawn` hands its task only a channel this function declared")
    }
    if (call.kind === N_CALL && call.children[1] === parent) {
      return takesChannelParameter(program, table, call, at)
        ? ""
        : channelUseMessage(
            "A `Channel` is an argument only where the function's parameter is declared a `Channel`, not to a method of an array or a collection, or a generic's `T`"
          )
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
  if (constructing) {
    return channelUseMessage(
      "A constructor uses a channel it is handed only to set a field from it, `this.ch = ch`, and sends, receives and passes on none"
    )
  }
  return channelUseMessage("A `Channel` cannot be bound, stored, returned or compared here")
}

/**
 * Whether `call` hands `arg` to a parameter its callee declares a `Channel`:
 * a function or method that is not an instantiation, so the parameter is a
 * channel in what was written rather than a `T`, and no array or collection
 * method, which could keep it where the checker cannot follow.
 */
const takesChannelParameter = (program: CheckedProgram, table: TypeTable, call: Node, arg: Node): boolean => {
  const callee = program.nodeCallees[call.id]
  if (callee === null || callee.instance !== null) {
    return false
  }
  let k = 0
  while (k < callee.paramNames.length && k < callee.paramTypes.length) {
    const operand = operandFor(call, callee, k)
    if (operand !== null && operand === arg) {
      return isChannelType(program, table, callee.paramTypes[k])
    }
    k = k + 1
  }
  return false
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

/** Whether `decl` is a declarator of the `using` `stmt` that opens a scope: `using s = scope(), t = scope()` has two. */
const opensScope = (program: CheckedProgram, stmt: Node, decl: Node, scopeType: i32): boolean =>
  stmt.kind === N_VAR &&
  (stmt.flags & FLAG_USING) !== 0 &&
  isScopeCall(program, unwrapParens(decl.children[2]), scopeType)

/** The name of the first scope the `using` `stmt` opens, or "" when it opens none. */
const firstScopeName = (program: CheckedProgram, stmt: Node, scopeType: i32): string => {
  if (stmt.kind === N_VAR) {
    for (const decl of stmt.children[0].children) {
      if (opensScope(program, stmt, decl, scopeType)) {
        return decl.children[0].text
      }
    }
  }
  return ""
}

/** Every scope the `using` `stmt` opens, as a site whose block is `body`, onto `out`. */
const addScopeSites = (
  program: CheckedProgram,
  stmt: Node,
  scopeType: i32,
  body: Node,
  index: i32,
  out: ScopeSite[]
): void => {
  if (stmt.kind !== N_VAR) {
    return
  }
  for (const decl of stmt.children[0].children) {
    if (opensScope(program, stmt, decl, scopeType)) {
      out.push(new ScopeSite(decl, program.nodeLocals[decl.id], body, index))
    }
  }
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
    addScopeSites(program, stmt, scopeType, block, j, out)
    if (stmt.kind === N_BLOCK) {
      for (const inner of stmt.children) {
        addScopeSites(program, inner, scopeType, stmt, j, out)
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
 * Every place the argument a `spawn` hands its task holds `local`: `""` when
 * it is the channel itself, and each field a constructor parameter sets when
 * the argument is `new C(..., ch, ...)`. More than one is refused: a task
 * that reached one channel by two paths could send on one and receive on the
 * other, and the sender count and C6 would each see only half of it.
 */
const pathsInTaskArgument = (program: CheckedProgram, spawn: Node, local: Local): string[] => {
  const out: string[] = []
  const args = spawn.children[1].children
  if (args.length < 2) {
    return out
  }
  const arg = unwrapParens(args[1])
  if (holdsChannelLocal(program, arg, local)) {
    out.push("")
    return out
  }
  const ctor: FunctionSig | null = arg.kind === N_NEW ? program.nodeCallees[arg.id] : null
  if (ctor === null) {
    return out
  }
  const body = ctor.body()
  const values = arg.children[2].children
  let k = 0
  while (k < values.length) {
    if (body !== null && ctor.paramNames.length > k + 1 && holdsChannelLocal(program, values[k], local)) {
      fieldsAssignedIn(body, ctor.paramNames[k + 1], out)
    }
    k = k + 1
  }
  return out
}

/** Whether `node` names `local`, parenthesised or not. */
const holdsChannelLocal = (program: CheckedProgram, node: Node, local: Local): boolean => {
  const named = namedLocal(program, node)
  return named !== null && named === local
}

/** Every field a constructor's body sets from its parameter `param`, `this.f = param`, onto `out`. */
const fieldsAssignedIn = (node: Node, param: string, out: string[]): void => {
  if (node.kind === N_BINARY && node.text === "=") {
    const target = unwrapParens(node.children[0])
    const value = unwrapParens(node.children[1])
    if (
      target.kind === N_MEMBER &&
      unwrapParens(target.children[0]).kind === N_THIS &&
      value.kind === N_IDENT &&
      value.text === param
    ) {
      out.push(target.text)
    }
  }
  for (const child of node.children) {
    fieldsAssignedIn(child, param, out)
  }
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
  summaries: ChannelSummaries,
  sig: FunctionSig,
  body: Node,
  scopeType: i32,
  out: ScopeFinding[]
): void => {
  const locals: Local[] = []
  const decls: Node[] = []
  checkChannelTypes(program, table, sig, body, out)
  if (sig.role === ROLE_CONSTRUCTOR && holdsChannelDeep(program, table, sig.paramTypes[0])) {
    const parents: Node[] = []
    findThisEscapes(program, table, body, parents, out)
  }
  collectChannelLocals(program, table, body, locals, decls)
  walkChannelUses(program, table, sig, body, [], locals, out)
  const spawns: Node[] = []
  collectSpawns(program, body, spawns)
  recordSenders(program, table, summaries, spawns)
  for (const spawn of spawns) {
    if (handsNullableChannel(program, table, spawn)) {
      out.push(
        new ScopeFinding(spawn, channelUseMessage("This task's argument holds a channel that may be `null`"))
      )
    }
  }
  findScopeReceives(program, summaries, body, scopeType, out)
  const ops = new ChannelOps()
  collectChannelOps(program, sig, body, summaries, ops)
  let c = 0
  while (c < locals.length && c < decls.length) {
    checkChannel(program, summaries, body, locals[c], decls[c], spawns, ops, scopeType, out)
    c = c + 1
  }
}

/**
 * Whether `type` holds a channel anywhere but as exactly `Channel<T>` — as a
 * `null`-able one, an array element, a `Result` arm or another generic's type
 * argument — where the rules, which read a channel's type, could not see it
 * (C2). A class with a `Channel<T>` field is a carrier and holds none.
 */
const wrapsChannel = (program: CheckedProgram, table: TypeTable, type: i32): boolean => {
  if (type < 0 || isChannelType(program, table, type)) {
    return false
  }
  return holdsChannelType(program, table, type)
}

/** Whether `type` is a channel or holds one inside a `null`-able, an array, a `Result` or a generic's type argument. */
const holdsChannelType = (program: CheckedProgram, table: TypeTable, type: i32): boolean => {
  if (type < 0) {
    return false
  }
  if (isChannelType(program, table, type)) {
    return true
  }
  const kind = table.kindOf(type)
  if (kind === K_NULLABLE || kind === K_ARRAY) {
    return holdsChannelType(program, table, table.refOf(type))
  }
  if (kind === K_RESULT) {
    return (
      holdsChannelType(program, table, table.okOf(type)) ||
      holdsChannelType(program, table, table.errOf(type))
    )
  }
  const info = classLayoutOf(program, table, type)
  const instance: StructInstantiation | null = info === null ? null : info.instance
  if (instance === null) {
    return false
  }
  for (const arg of instance.typeArgs) {
    if (holdsChannelType(program, table, arg)) {
      return true
    }
  }
  return false
}

const wrappedChannelMessage = (table: TypeTable, type: i32): string =>
  channelUseMessage(`\`${table.typeName(type)}\` holds a channel other than as a \`Channel<T>\` itself`)

/**
 * C2 over the types `sig` writes: each parameter, the result and every local
 * of its body (a class's fields are `checkFieldTypes`'s). One finding at most.
 */
const checkChannelTypes = (
  program: CheckedProgram,
  table: TypeTable,
  sig: FunctionSig,
  body: Node,
  out: ScopeFinding[]
): void => {
  // An instantiation's types are its type arguments', which are refused where
  // they are written (a field, a local, an argument), not again in each member.
  let k = sig.instance === null ? 0 : sig.paramTypes.length
  while (k < sig.paramTypes.length) {
    if (wrapsChannel(program, table, sig.paramTypes[k])) {
      out.push(new ScopeFinding(sig.decl, wrappedChannelMessage(table, sig.paramTypes[k])))
      return
    }
    k = k + 1
  }
  if (sig.instance === null && wrapsChannel(program, table, sig.returnType)) {
    out.push(new ScopeFinding(sig.decl, wrappedChannelMessage(table, sig.returnType)))
    return
  }
  checkLocalTypes(program, table, body, out)
}

/** C2 over the fields of every class `node`, a module, declares: a field holds a channel only as `Channel<T>`. */
const checkFieldTypes = (
  program: CheckedProgram,
  table: TypeTable,
  node: Node,
  out: ScopeFinding[]
): void => {
  for (const decl of node.children) {
    const info: StructInfo | null = decl.kind === N_CLASS ? program.struct(decl.children[0].text) : null
    if (info !== null) {
      for (const member of decl.children[3].children) {
        const field: FieldInfo | null = member.kind === N_FIELD ? info.field(member.children[0].text) : null
        if (field !== null && wrapsChannel(program, table, field.type)) {
          out.push(new ScopeFinding(member, wrappedChannelMessage(table, field.type)))
        }
      }
    }
  }
}

/** The first local under `node` whose type wraps a channel. */
const checkLocalTypes = (
  program: CheckedProgram,
  table: TypeTable,
  node: Node,
  out: ScopeFinding[]
): boolean => {
  if (node.kind === N_ARROW) {
    return false
  }
  if (node.kind === N_VAR_DECL) {
    const local = program.nodeLocals[node.id]
    if (local !== null && wrapsChannel(program, table, local.type)) {
      out.push(new ScopeFinding(node, wrappedChannelMessage(table, local.type)))
      return true
    }
  }
  for (const child of node.children) {
    if (checkLocalTypes(program, table, child, out)) {
      return true
    }
  }
  return false
}

/**
 * C4 in the constructor of a class that holds a channel, directly or through a
 * carrier: `this` appears only as the base of an access to one of its own
 * fields, `this.f`, that cannot carry it out (`isOwnFieldUse`). The summary of
 * what a constructor sends follows only its parameters, so any other way
 * `this` got out — a method called on it, an argument, a store elsewhere, a
 * second name, an array element — could carry a send the sender count never
 * saw. `parents` holds `node`'s ancestors, outermost first, parentheses and all.
 */
const findThisEscapes = (
  program: CheckedProgram,
  table: TypeTable,
  node: Node,
  parents: Node[],
  out: ScopeFinding[]
): boolean => {
  if (node.kind === N_ARROW) {
    return false
  }
  if (node.kind === N_THIS && !isOwnFieldUse(program, table, parents)) {
    out.push(
      new ScopeFinding(
        node,
        channelSendersMessage(
          "The constructor of a class that holds a channel uses `this` other than to read or set its own fields, `this.f`, where a send made through it could not be counted"
        )
      )
    )
    return true
  }
  parents.push(node)
  let found = false
  for (const child of node.children) {
    found = found || findThisEscapes(program, table, child, parents, out)
  }
  parents.pop()
  return found
}

/** How many of `parents` are above the node at `depth`, once the parentheses around it are counted as it. */
const outsideParens = (parents: Node[], depth: i32): i32 => {
  let d = depth
  while (d > 0 && parents[d - 1].kind === N_PAREN) {
    d = d - 1
  }
  return d
}

/**
 * Whether a `this` under `parents` (its ancestors, outermost first) is the
 * base of a use of its own field `this.f` that cannot carry `this` out (#567):
 *
 *   - a store into the field, `this.f = v`, `this.f += v` or `this.f++`;
 *   - any use but a call of a field whose value is inert (`isInertValue`): a
 *     number, a `boolean`, an enum, a string, or an array of those, from
 *     which nothing can reach a channel or the object;
 *   - a store into a field or an element of the field's own value,
 *     `this.a.b = v` or `this.a[i] = v`, where that value neither is a channel
 *     nor holds one.
 *
 * What a store stores is judged on its own, so `this.f = this` and
 * `this.a.b = this` are each refused at their right-hand `this`.
 */
const isOwnFieldUse = (program: CheckedProgram, table: TypeTable, parents: Node[]): boolean => {
  const fieldDepth = outsideParens(parents, parents.length) - 1
  if (fieldDepth < 0 || parents[fieldDepth].kind !== N_MEMBER) {
    return false
  }
  const field = parents[fieldDepth]
  const usedAt = outsideParens(parents, fieldDepth)
  const fieldAt = parents[usedAt]
  if (isStoreTarget(fieldAt, parents, usedAt)) {
    return true
  }
  const user: Node | null = usedAt > 0 ? parents[usedAt - 1] : null
  if (user !== null && user.kind === N_CALL && user.children[0] === fieldAt) {
    return false // `this.m()`: the method is handed `this`
  }
  const type = program.nodeTypes[field.id]
  if (isInertValue(table, type)) {
    return true
  }
  if (
    user === null ||
    (user.kind !== N_MEMBER && user.kind !== N_INDEX) ||
    user.children[0] !== fieldAt ||
    type < 0 ||
    isChannelType(program, table, table.stripNull(type)) ||
    holdsChannelDeep(program, table, table.stripNull(type))
  ) {
    return false
  }
  const storedAt = outsideParens(parents, usedAt - 1)
  return isStoreTarget(parents[storedAt], parents, storedAt)
}

/** A value of `type` reaches no object: a number, a `boolean`, an enum, a string, or an array of those. */
const isInertValue = (table: TypeTable, type: i32): boolean => {
  if (type < 0) {
    return false
  }
  const t = table.stripNull(type)
  if (t === T_STRING || isScalarArgument(table, t)) {
    return true
  }
  return table.isArray(t) && isInertValue(table, table.refOf(t))
}

/** Whether the class `type` holds a channel in a field, or in a field of a class one of its fields is. */
const holdsChannelDeep = (program: CheckedProgram, table: TypeTable, type: i32): boolean => {
  if (holdsChannelField(program, table, type, false)) {
    return true
  }
  const info = classLayoutOf(program, table, type)
  if (info === null) {
    return false
  }
  for (const field of info.fields) {
    if (holdsChannelField(program, table, table.stripNull(field.type), false)) {
      return true
    }
  }
  return false
}

/**
 * Whether the argument a `spawn` hands its task is `null`-able and holds a
 * channel, or holds one in a field that may be `null`. The spawn counts a
 * sender by reading the channel out of the argument, and one it cannot read
 * would be a sender the count never saw, which could close the channel early.
 */
const handsNullableChannel = (program: CheckedProgram, table: TypeTable, spawn: Node): boolean => {
  const callee = spawnCallee(program, spawn)
  const arg = callee === null ? -1 : taskArgTypeOf(callee)
  if (arg >= 0 && table.isNullable(arg)) {
    const inner = table.stripNull(arg)
    return isChannelType(program, table, inner) || holdsChannelField(program, table, inner, false)
  }
  return false
}

/** Whether the class `type` has a field of a channel type — only a `null`-able one when `nullable` is set. */
const holdsChannelField = (
  program: CheckedProgram,
  table: TypeTable,
  type: i32,
  nullable: boolean
): boolean => {
  const info = classLayoutOf(program, table, type)
  if (info === null) {
    return false
  }
  for (const field of info.fields) {
    const maybe = table.isNullable(field.type)
    if ((maybe || !nullable) && isChannelType(program, table, table.stripNull(field.type))) {
      return true
    }
  }
  return false
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
    const arg = taskArgTypeOf(callee)
    if (instance === null || entry === null || arg < 0) {
      continue
    }
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
  summaries: ChannelSummaries,
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
      const name = firstScopeName(program, node.children[i], scopeType)
      if (name.length > 0) {
        let j = i + 1
        while (j < node.children.length) {
          walkScopeReceives(program, summaries, node.children[j], name, out)
          j = j + 1
        }
      }
      i = i + 1
    }
  }
  for (const child of node.children) {
    findScopeReceives(program, summaries, child, scopeType, out)
  }
}

/** What `findScopeReceives` refuses at `node` and under it, in the block of the scope `name`. */
const walkScopeReceives = (
  program: CheckedProgram,
  summaries: ChannelSummaries,
  node: Node,
  name: string,
  out: ScopeFinding[]
): void => {
  if (node.kind === N_ARROW) {
    return
  }
  const what = receiveWhat(program, summaries, node)
  if (what.length > 0) {
    out.push(new ScopeFinding(node, channelReceiverMessage(`${what} is inside the block of \`${name}\``)))
    return
  }
  // A task's entry is its own, and runs at the join; its argument is the
  // parent's code, evaluated at the spawn.
  const below = spawnCallee(program, node) !== null ? node.children[1] : node
  for (const child of below.children) {
    walkScopeReceives(program, summaries, child, name, out)
  }
}

/** The receive `node` is, in words — a loop over a channel, or a call that receives — or "". */
const receiveWhat = (program: CheckedProgram, summaries: ChannelSummaries, node: Node): string => {
  if (node.kind === N_FOR_OF) {
    const read = program.nodeCallees[node.id]
    return read !== null && isChannelReader(read) ? "A loop over a channel" : ""
  }
  // A `new` is a call of its class's constructor.
  if (node.kind !== N_CALL && node.kind !== N_NEW) {
    return ""
  }
  const callee = program.nodeCallees[node.id]
  if (callee === null || isSpawnEntry(callee) || !summaries.receivesHanded(callee.name)) {
    return ""
  }
  return `\`${callee.sourceName}\`, which receives on a channel it is handed,`
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
    const found = pathsInTaskArgument(program, spawn, local)
    if (found.length > 1) {
      out.push(new ScopeFinding(spawn, channelUseMessage(`\`${local.name}\` reaches this task by two paths`)))
      return
    }
    if (found.length === 1) {
      holders.push(spawn)
      paths.push(found[0])
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
  while (k < holders.length && k < paths.length) {
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
            channelBothMessage(
              summaries.untraceable(entry.name)
                ? `\`${entry.sourceName}\` may both send and receive on \`${local.name}\`, counted as using every channel it holds because it reaches one through a name the checker cannot follow (bind no other name to what holds a channel)`
                : `\`${entry.sourceName}\` may both send and receive on \`${local.name}\``
            )
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
      // A receive after the scope's `using`, in its block, is `findScopeReceives`'s
      // to refuse; one before it, in the same block, is refused below.
      const using = statementIndexIn(chosen.body, chosen.decl)
      const afterUsing = apart
        ? at === chosen.stmt && statementIndexIn(chosen.body, node) > using
        : at > chosen.stmt
      if (!ops.sends[k] && afterUsing) {
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
