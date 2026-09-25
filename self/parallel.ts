// WP29 P1: the rules a data-parallel call is held to, and how `nish/threads`'s
// templates are recognised (docs/wp29-thread-surface.md §4.1, §7, §11).
//
// `std/threads.ts` is ordinary Nish: its two exported templates carry the
// sequential meaning, and the compiler recognises them by module and name and
// replaces one call inside each instance with a region over
// `nish_parallel_range` (`self/emit_parallel.ts`). Everything that makes the
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
//     own (`scopeParallelBodies` in `self/attributes.ts`), and each element
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

import { FactsTable, FunctionFacts } from "./attributes";
import { CLI, STD_PREFIX } from "./branding";
import { isScalarArgument } from "./escape";
import { isTemplateExpression } from "./emit_util";
import {
  N_ARRAY,
  N_ARROW,
  N_BLOCK,
  N_CALL,
  N_DO,
  N_FALSE,
  N_FOR,
  N_FOR_OF,
  N_IDENT,
  N_NEW,
  N_NUMBER,
  N_OBJECT,
  N_PAREN,
  N_RETURN,
  N_TRUE,
  N_UNARY,
  N_BINARY,
  N_WHILE,
  Node,
} from "./nodes";
import {
  CheckedProgram,
  FunctionSig,
  PAR_CHUNK,
  PAR_MAP,
  PAR_NONE,
  PAR_REDUCE,
  ParallelCall,
  TemplateInfo,
} from "./program";
import { stdModuleName } from "./std_modules";
import { StringSet } from "./map";
import { K_ARRAY, K_NULLABLE, K_RESULT, K_STRUCT, TypeTable } from "./types";

/** `std/threads.ts`: the name `nish/threads` loads under, and the module its templates are recognised in. */
export const threadsModuleName = (): string => stdModuleName(`${STD_PREFIX}threads`);

/**
 * Whether `program` is the standard library's `std/threads.ts`. The package is
 * part of the test: a root-package file that happens to sit at `std/threads.ts`
 * is an ordinary module, and its templates run as they are written.
 */
export const isThreadsModule = (program: CheckedProgram): boolean =>
  program.packageName === CLI && program.source.path === threadsModuleName();

/** The `PAR_*` role of an instantiation of `template`. */
export const parallelRole = (template: TemplateInfo): i32 => {
  if (template.owner !== null || !isThreadsModule(template.home.program)) {
    return PAR_NONE;
  }
  const name = template.sourceName;
  if (name === "parallelMapInto") {
    return PAR_MAP;
  }
  if (name === "parallelReduce") {
    return PAR_REDUCE;
  }
  if (name === "mapRange" || name === "reduceBlocks") {
    return PAR_CHUNK;
  }
  return PAR_NONE;
};

/** The role of the function `sig` is, or `PAR_NONE` when it is not an instantiation. */
export const parallelRoleOf = (sig: FunctionSig): i32 => {
  const instance = sig.instance;
  return instance === null ? PAR_NONE : instance.parallel;
};

/** Whether `sig` is an instance of `parallelMapInto` or `parallelReduce`: one whose region the emitter builds. */
export const isParallelEntry = (sig: FunctionSig): boolean => {
  const role = parallelRoleOf(sig);
  return role === PAR_MAP || role === PAR_REDUCE;
};

/**
 * Remember a call of `sig` for `Compilation.checkParallel`, once. A body that
 * is checked again — a generic caller's, once per instantiation — reaches here
 * again with the same node and, for the same tuple, the same instance.
 */
export const recordParallelCall = (program: CheckedProgram, node: Node, sig: FunctionSig): void => {
  if (!isParallelEntry(sig)) {
    return;
  }
  for (const call of program.parallelCalls) {
    if (call.node === node && call.sig === sig) {
      return;
    }
  }
  program.parallelCalls.push(new ParallelCall(node, sig));
};

// ---- The rules ---------------------------------------------------------------------------

/** Where a diagnostic about `f` can say `node` is: `file:line:col` in `f`'s module, or "" without one. */
const positionIn = (fn: FunctionSig, node: Node): string => {
  const origin = fn.origin;
  return origin === null ? "" : `${origin.path}:${origin.lineOf(node.start)}:${origin.columnOf(node.start)}`;
};

/** What the template is called in a diagnostic: its source name, without the instance's type arguments. */
const intrinsicName = (sig: FunctionSig): string =>
  parallelRoleOf(sig) === PAR_MAP ? "parallelMapInto" : "parallelReduce";

/**
 * The body writes memory its caller could observe, which two threads running
 * it at once could both write. It names the first such write the fixpoint
 * found: the node, or the callee that carries it.
 */
export const sharedWriteMessage = (sig: FunctionSig, fn: FunctionSig, facts: FactsTable): string => {
  const own = facts.get(fn.name);
  if (own === null || !own.sharedWrite) {
    return "";
  }
  let where = "";
  const site = own.writeSite;
  if (site !== null) {
    const at = positionIn(fn, site);
    where = at.length > 0 ? ` at ${at}` : "";
  } else if (own.writeVia.length > 0) {
    // A user function by the name it was written with; a runtime symbol, which
    // is what a builtin such as `console.log` lowers to, by its C name.
    const via = facts.get(own.writeVia);
    where = via === null ? ` in the runtime's \`${own.writeVia}\`` : ` through \`${via.sourceName}\``;
  }
  return (
    `\`${fn.sourceName}\` writes memory its caller can see${where}, and \`${intrinsicName(sig)}\` runs it on several ` +
    "threads at once: a parallel body may read what its caller owns and write nothing but its result"
  );
};

/**
 * Whether the allocations of a body with facts `f` can be given back after
 * every element, which is what makes a body that allocates legal. Four things
 * have to hold, and they are the ones the callee-scope rule in
 * `self/attributes.ts` asks for (`settleCalleeScopes`), for the same reasons:
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
  f.contained && f.returnsScalar && !f.usesArenaControl && !f.readsArenaState;

/**
 * The body reads or moves the arena. Every thread has an arena of its own, so
 * `Arena.used()` would answer differently depending on which thread ran the
 * element, and a body that rewinds the arena could rewind past what the
 * element scope is about to release.
 */
export const arenaMessage = (sig: FunctionSig, fn: FunctionSig, facts: FactsTable): string => {
  const own: FunctionFacts | null = facts.get(fn.name);
  if (own === null || (!own.readsArenaState && !own.usesArenaControl)) {
    return "";
  }
  return (
    `\`${fn.sourceName}\` reads or moves the arena, and \`${intrinsicName(sig)}\` runs it on several threads that ` +
    "each have an arena of their own: a parallel body may not call `Arena.mark`, `Arena.used`, `Arena.release` or `Arena.reset`"
  );
};

/**
 * The body allocates and the escape analysis cannot see every allocation die
 * before it returns, so the scope that gives an element's memory back after
 * it could free something still in use. The analysis stops following a value
 * once it is stored into memory, so that is what this usually means, and the
 * site is named when the function's own allocation is the one that escapes.
 */
export const escapeMessage = (sig: FunctionSig, fn: FunctionSig, facts: FactsTable): string => {
  const own: FunctionFacts | null = facts.get(fn.name);
  if (own === null || !own.allocates || own.contained) {
    return "";
  }
  let where = "";
  const site = own.escapeSite;
  if (site !== null) {
    const at = positionIn(fn, site);
    where = at.length > 0 ? ` at ${at}` : "";
  }
  return (
    `\`${fn.sourceName}\` allocates${where} and stores the allocation into memory, and \`${intrinsicName(sig)}\` ` +
    "releases what a body allocates after every element: a parallel body may allocate only temporaries it drops " +
    "before it returns, and this analysis stops following a value once it is stored"
  );
};

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
  const own: FunctionFacts | null = facts.get(fn.name);
  if (own === null || !own.allocates) {
    return "";
  }
  return (
    `the body of this \`${intrinsicName(sig)}\` allocates per element: \`${fn.sourceName}\` answers ` +
    `\`${table.typeName(type)}\` but allocates on every call, so each thread marks and releases its arena around ` +
    "every element. Compute the answer without building a string, an array or an object to save both"
  );
};

/** A result the join could hand back: a number, a `boolean` or an enum, and nothing that points. */
export const resultMessage = (table: TypeTable, sig: FunctionSig, fn: FunctionSig, type: i32): string => {
  if (isScalarArgument(table, type)) {
    return "";
  }
  return (
    `\`${fn.sourceName}\` answers \`${table.typeName(type)}\`, and \`${intrinsicName(sig)}\` hands back only a ` +
    "number, a `boolean` or an enum: a worker's arena is freed when its thread exits, so anything else would point into freed memory"
  );
};

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
  const kind = table.kindOf(type);
  if (kind === K_NULLABLE) {
    return reachingPath(table, program, table.refOf(type), element, root, seen);
  }
  if (kind === K_ARRAY) {
    const inner = table.refOf(type);
    if (inner === element) {
      return root;
    }
    return reachingPath(table, program, inner, element, `${root}[i]`, seen);
  }
  if (kind === K_RESULT) {
    const ok = reachingPath(table, program, table.okOf(type), element, `${root}.value`, seen);
    return ok.length > 0
      ? ok
      : reachingPath(table, program, table.errOf(type), element, `${root}.error`, seen);
  }
  if (kind !== K_STRUCT) {
    return "";
  }
  const name = table.nameOf(type);
  if (seen.has(name)) {
    return "";
  }
  seen.add(name);
  const info = program.struct(name);
  if (info === null) {
    // Every layout a module can hold a value of is in its table
    // (`closeReachableStructs`), so this is not expected; a layout the rule
    // cannot see is refused rather than trusted.
    return root;
  }
  for (const field of info.fields) {
    const path = reachingPath(table, program, field.type, element, `${root}.${field.name}`, seen);
    if (path.length > 0) {
      return path;
    }
  }
  return "";
};

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
  const instance = sig.instance;
  if (instance === null || instance.parallel !== PAR_MAP || instance.typeArgs.length < 2) {
    return "";
  }
  const element = instance.typeArgs[0];
  const target = instance.typeArgs[1];
  const root = fn.paramNames.length > 0 ? fn.paramNames[0] : "x";
  const path = reachingPath(table, program, element, target, root, new StringSet());
  if (path.length === 0) {
    return "";
  }
  return (
    `\`${fn.sourceName}\` can reach a \`${table.typeName(target)}[]\` through \`${path}\`, which could be ` +
    "the array `parallelMapInto` is writing: another thread would be writing it while this one reads, so `dst` may not be reachable from an element of `src`"
  );
};

/** `(expr)` as the expression inside every pair of parentheses. */
const unparen = (node: Node): Node => (node.kind === N_PAREN ? unparen(node.children[0]) : node);

/**
 * The operator an arrow's whole body applies to its two parameters, in either
 * order, or "" when the body is anything else: a named function, a block with
 * more than a `return`, or an operator on anything but the two parameters.
 */
const combiningOperator = (fn: FunctionSig): string => {
  if (!fn.lifted || fn.paramNames.length !== 2) {
    return "";
  }
  let body = fn.decl.children[3];
  if (body.kind === N_BLOCK) {
    if (body.children.length !== 1 || body.children[0].kind !== N_RETURN) {
      return "";
    }
    body = body.children[0].children[0];
  }
  body = unparen(body);
  if (body.kind !== N_BINARY) {
    return "";
  }
  const left = unparen(body.children[0]);
  const right = unparen(body.children[1]);
  if (left.kind !== N_IDENT || right.kind !== N_IDENT) {
    return "";
  }
  const a = fn.paramNames[0];
  const b = fn.paramNames[1];
  if ((left.text === a && right.text === b) || (left.text === b && right.text === a)) {
    return body.text;
  }
  return "";
};

/** An operator whose result depends on how its operands are grouped. */
const isNonAssociative = (op: string): boolean =>
  op === "-" || op === "/" || op === "%" || op === "**" || op === "<<" || op === ">>" || op === ">>>";

/** The identity an associative operator folds from, as written, or "" for one it has no single literal for. */
const identityOf = (op: string): string => {
  if (op === "+" || op === "|" || op === "^") {
    return "0";
  }
  if (op === "*") {
    return "1";
  }
  if (op === "&&") {
    return "true";
  }
  if (op === "||") {
    return "false";
  }
  return "";
};

/**
 * Whether `node` is the literal `want` spells: a number of the same value in
 * any spelling (`0`, `0.0`, `-0`, `0x0`), or the same `boolean`. Anything else
 * — a variable, a call, a constant's name — is not, because an identity the
 * checker cannot see is one it cannot hold to the rule.
 */
const isLiteral = (node: Node, want: string): boolean => {
  const e = unparen(node);
  if (want === "true") {
    return e.kind === N_TRUE;
  }
  if (want === "false") {
    return e.kind === N_FALSE;
  }
  if (e.kind === N_UNARY && (e.text === "-" || e.text === "+")) {
    const operand = unparen(e.children[0]);
    return operand.kind === N_NUMBER && want === "0" && Number(operand.text) === 0;
  }
  return e.kind === N_NUMBER && Number(e.text) === Number(want);
};

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
    return "";
  }
  const op = combiningOperator(fn);
  if (op.length === 0) {
    return "";
  }
  if (isNonAssociative(op)) {
    return (
      `\`${fn.sourceName}\` combines with \`${op}\`, which is not associative: \`parallelReduce\` folds each block ` +
      "from the identity and then combines the blocks, which is a left fold only for an associative operator"
    );
  }
  const want = identityOf(op);
  if (want.length === 0 || isLiteral(identity, want)) {
    return "";
  }
  return (
    `\`parallelReduce\` folds every block from its identity, and the identity of \`${op}\` is \`${want}\`, not ` +
    `\`${identityText}\`: any other value would be counted once per block`
  );
};

// ---- The grain ---------------------------------------------------------------------------
//
// A map region is divided into at most one chunk per `grain` elements, so the
// grain decides whether a map is worth threads at all. A region divided four
// ways costs about 125 µs of `pthread_create` and join (docs/wp20-threads.md
// §8e), and it needs about a millisecond of work in each chunk before that is
// under a tenth of the chunk. How many elements make a millisecond depends on
// the body, so the grain is that target over an estimate of one element:
//
//     grain = clamp(REGION_COST / elementCost(f), 1, REGION_COST)
//
// The estimate is read off the body's syntax, in units of roughly one simple
// operation — about a nanosecond on the machine it was calibrated on, which
// is what makes `REGION_COST` a millisecond (the calibration is in
// docs/wp29-thread-surface.md §8a). It is deliberately crude, and it errs one
// way: a callee counts as a call and not as its body, so a body that hides its
// work behind a call is estimated cheap and divided too little, which costs
// speed and never makes a short array slower than the loop.

/** The work, in estimate units, that one chunk of a map region should carry: about a millisecond. */
export const REGION_COST: i32 = 4194304;

/** One call: the jump, the frame and the return, beyond the arguments. */
const CALL_COST: i32 = 4;

/** One arena allocation: the bump and its initialisation, or formatting a number into a string. */
const ALLOC_COST: i32 = 32;

/** The iterations a loop is assumed to run when its bound is not a literal. */
const DEFAULT_TRIPS: i32 = 64;

/** `a * b`, saturated at `REGION_COST`: nothing above it changes the grain. */
const scaled = (a: i32, b: i32): i32 => {
  if (a <= 0 || b <= 0) {
    return 0;
  }
  return a >= REGION_COST / b ? REGION_COST : a * b;
};

/** `a + b`, saturated at `REGION_COST`. */
const summed = (a: i32, b: i32): i32 => (a >= REGION_COST - b ? REGION_COST : a + b);

/**
 * How many times the loop `node` runs its body: the literal of a
 * `for (...; i < N; ...)` or `i <= N`, and `DEFAULT_TRIPS` for anything the
 * syntax does not state.
 */
const tripsOf = (node: Node): i32 => {
  if (node.kind !== N_FOR || node.children.length < 2) {
    return DEFAULT_TRIPS;
  }
  const cond = unparen(node.children[1]);
  if (cond.kind !== N_BINARY || cond.children.length < 2) {
    return DEFAULT_TRIPS;
  }
  const bound = unparen(cond.children[1]);
  if (bound.kind !== N_NUMBER || (cond.text !== "<" && cond.text !== "<=")) {
    return DEFAULT_TRIPS;
  }
  const n = Number(bound.text);
  if (n < 1.0) {
    return 1;
  }
  if (n >= toF64(REGION_COST)) {
    return REGION_COST;
  }
  return cond.text === "<=" ? toI32(n) + 1 : toI32(n);
};

/** The estimate for `node` and everything under it. */
const costOf = (node: Node): i32 => {
  // A nested arrow is lifted into a function of its own and runs only when called.
  if (node.kind === N_ARROW) {
    return 0;
  }
  let own = 1;
  if (node.kind === N_CALL) {
    own = CALL_COST;
  } else if (node.kind === N_NEW || node.kind === N_OBJECT || node.kind === N_ARRAY || isTemplateExpression(node)) {
    own = ALLOC_COST;
  }
  let inner = 0;
  for (const child of node.children) {
    inner = summed(inner, costOf(child));
  }
  if (node.kind === N_FOR || node.kind === N_WHILE || node.kind === N_DO || node.kind === N_FOR_OF) {
    inner = scaled(inner, tripsOf(node));
  }
  return summed(own, inner);
};

/** What one call of `fn` is estimated to cost, at least 1. */
export const elementCost = (fn: FunctionSig): i32 => {
  const body = fn.body();
  if (body === null) {
    return 1;
  }
  const cost = costOf(body);
  return cost < 1 ? 1 : cost;
};

/** The grain of a map whose body is `fn`: `REGION_COST` over its estimate, in `[1, REGION_COST]`. */
export const mapGrain = (fn: FunctionSig): i32 => {
  const grain = REGION_COST / elementCost(fn);
  return grain < 1 ? 1 : grain;
};
