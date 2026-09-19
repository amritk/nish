/**
 * Array lowering (WP4).
 *
 * Layout (ABI, shared with runtime/runtime.c `struct nish_array`): an array
 * value is a `%struct.nish_array*` to an arena header
 *
 *   %struct.nish_array = type { i64 len, i64 cap, i8* data }
 *
 * `data` points at `cap` elements of `sizeof(T)` bytes, arena-allocated and
 * 8-byte aligned; it is `null` only for a `[]` literal (cap 0), and nothing
 * dereferences it before the first `push` grows the array. Element access
 * bitcasts `data` to `T*` and indexes with an `i64`.
 *
 * WP15 §2a: when `T` is a **record** (an Nish `interface`), the slot type is
 * `%struct.T` rather than `%struct.T*` — the array holds the records
 * themselves, `sizeof(T)` apart, exactly as a C array of that struct does.
 * `a[i]` is then the `getelementptr` itself, with no load, because a struct
 * value *is* its address everywhere else in the emitter; a write into a slot
 * is an `llvm.memcpy` of the object, because the array owns the storage.
 * `inlineElementStruct` in `checker/program.ts` carries the rule and the
 * argument for why a `class` element is not one of these.
 *
 *   [a, b]           two `nish_alloc_struct` calls (24-byte header, n*sizeof(T)
 *                    data), `len = cap = n`, one store per element — one
 *                    `llvm.memcpy` per element for a record.
 *   new Array<T>(n)  header + data as above, data cleared with `llvm.memset`.
 *                    When escape.ts proved the array does not outlive the
 *                    function (WP6) and its size is a literal, both become
 *                    entry-block allocas: `%arr.hdr = alloca %struct.nish_array`
 *                    and `%arr.data = alloca [n x T]`, 8-aligned like arena
 *                    memory. A later `push` moves the data into the arena
 *                    (`nish_array_grow` only touches the header), which is
 *                    still correct: the header keeps pointing at live memory.
 *   a[i]             index widened to i64 (`sext` from i32, `fptosi` from
 *                    double), bounds check, `getelementptr` + `load`.
 *   a[i] = v         same address computation, then `store`; `op=` loads,
 *                    computes and stores.
 *   a.length         `load i64` of the header, then `trunc` to i32 / `sitofp`.
 *   a.push(v)        `len == cap` -> `nish_array_grow`; store at `len`; `len + 1`.
 *   a.pop()          empty -> `nish_panic_index(0, 0)`; else `len - 1` stored
 *                    back and the element loaded. The capacity is untouched,
 *                    so the storage is reused by the next `push`.
 *   a.indexOf(v)     a scan (`idx.scan` / `idx.test` / `idx.next`) comparing
 *                    with `===` for the element type; -1 when it falls out.
 *   a.join(sep)      `string[]` only: one pass summing the lengths
 *                    (`join.sum`), one `nish_alloc_struct`, then one
 *                    `llvm.memcpy` per part and per separator (`join.copy`).
 *                    Never `nish_str_concat` in a loop, which is quadratic in
 *                    both time and arena (docs/wp14-selfhost.md §3).
 *   for (x of a)     index loop `forof.cond` / `forof.body` / `forof.inc` /
 *                    `forof.end`; `len` is re-read each iteration (a `push` in
 *                    the body extends the loop, as in JavaScript).
 *
 * Bounds check: `icmp ult i64 %idx, %len` and a branch to a cold block that
 * calls `nish_panic_index(idx, len)` (noreturn) followed by `unreachable`.
 * Comparing unsigned makes a negative index fail too. `--unchecked-indexing`
 * removes the check; an out-of-range index is then undefined behaviour.
 *
 * The check is also dropped for an access the checker *proved* in range
 * (WP15 §2.1/§2.2, `checker/bounds.ts` -> `program.provenIndices`). That is
 * not the same thing as the flag: the flag removes every check and trusts the
 * program, while a proof removes one check and the safety is unchanged. The
 * emitter re-derives nothing here — it reads the table, as it does for every
 * other fact.
 *
 * `collectArrayFacts` feeds attributes.ts with what each construct does to
 * memory; which array parameters are written through or captured is decided
 * there by `classifyUse` (see docs/wp4-arrays.md, "Attributes").
 */
import ts from "typescript";
import {
  CheckedProgram,
  LocalVar,
  StructInfo,
  elementLLVMType,
  elementStride,
  inlineElementStruct,
} from "../../checker/index.js";
// Type-only, so `tsc` erases it and no import cycle exists at run time:
// `attributes.ts` imports *this* module for `isPushCall` and friends, and
// `setProgramFacts` below is how its answers come back the other way.
import { FunctionFacts } from "../attributes.js";
import { ELEMENT_ASSIGNMENT_OPERATORS } from "../../checker/arrays.js";
import { isAssignmentOperator } from "../../checker/classes.js";
import {
  ARRAY_STRUCT,
  STRING,
  StaticType,
  TYPED_ARRAY_ALIASES,
  isFloat,
  isUnsigned,
  llvmType,
} from "../../types.js";
import { ARRAY_TYPE } from "../runtime.js";
import { emitIntBinary } from "./arithmetic.js";
import { emitBitwiseCombine, isBitwiseCompoundOperator } from "./bitwise.js";
import { BinaryEmitter, EmitContext, EmitterTable, ExpressionEmitter, StatementEmitter } from "./context.js";
import {
  FactCollector,
  factCollectors,
  methodCallEmitters,
  newEmitters,
  propertyEmitters,
} from "./members.js";

type ArrayType = Extract<StaticType, { kind: "array" }>;

const HEADER = ARRAY_STRUCT;
const HEADER_PTR = `${ARRAY_STRUCT}*`;
const HEADER_BYTES = 24;
const MEMSET = "llvm.memset.p0i8.i64";
const MEMCPY = "llvm.memcpy.p0i8.p0i8.i64";

/**
 * WP15 §2a: the record stored inline in this array's slots, or undefined when
 * a slot holds a value (a scalar, a string, an array header pointer, a class
 * pointer, a `C | null`). `inlineElementStruct` carries the rule and the two
 * exclusions.
 */
function inlineStruct(ctx: EmitContext, elem: StaticType): StructInfo | undefined {
  return inlineElementStruct(ctx.program.structs, elem);
}

/** Bytes from one element to the next: `sizeof` for an inline record, the value's size otherwise. */
function elementSize(ctx: EmitContext, elem: StaticType): number {
  return elementStride(ctx.program.structs, elem);
}

/** The LLVM type of one slot: `%struct.P` inline, the value type otherwise. */
function slotType(ctx: EmitContext, elem: StaticType): string {
  return elementLLVMType(ctx.program.structs, elem);
}

/** `, align 8` for header fields and data, or nothing under `--plain`. */
function align8(ctx: EmitContext): string {
  return ctx.opts.optimizeAttributes ? ", align 8" : "";
}

// ---- Alias domains ------------------------------------------------------------------

/**
 * WP15: an array's 24-byte header and the element buffer it points at never
 * share a byte, and saying so is worth more than every other array
 * optimisation measured so far.
 *
 * Without it, LLVM must assume `a[i] = v` might land on some array's `len` or
 * `data`, so it reloads the header on every iteration of every loop that
 * writes an element — which blocks LICM, and with it the loop vectoriser. On
 * `dst[i] = src[i] * 2.0` over 8192 doubles the reload alone costs 1.58x
 * (1205 ms against 763 ms, `--profile speed`).
 *
 * **The proof is about bytes, not allocations.** Every header the compiler
 * produces is either a 24-byte `nish_alloc_struct` bump, an entry-block
 * `alloca %struct.nish_array` (WP6), or the malloc'd block `nish_argv_init`
 * builds; every element buffer is a separate bump, a separate `alloca [n x T]`,
 * or — for argv alone — the bytes *after* the header in that one block. In all
 * four shapes the header's three fields and the `cap * sizeof(T)` of element
 * storage occupy disjoint byte ranges, so no store through an element pointer
 * can reach a header field and no store to a header field can reach element
 * data. `nish_array_grow` bumps a fresh buffer and writes `data`/`cap`, which
 * is a header write, and stays inside the same split.
 *
 * The domains cover *arrays* only. A string is one block whose length header
 * and bytes are contiguous, so it has no such split to describe. Struct fields
 * were left alone until there was a measurement behind them; there is one now,
 * and what it bought is `!tbaa` rather than a scope (`emit/tbaa.ts`).
 *
 * The nodes are spelled with names rather than as self-referential nodes so
 * that LLVM's uniquing merges module A's header domain with module B's under
 * LTO; distinct domains would answer "may alias" across an inlined boundary,
 * which is exactly where the array traffic is.
 */
function aliasDomains(ctx: EmitContext): { header: string; element: string } {
  const domain = ctx.metadata(`!{!"nish array"}`);
  const header = ctx.metadata(`!{!"header", ${domain}}`);
  const element = ctx.metadata(`!{!"elements", ${domain}}`);
  return { header: ctx.metadata(`!{${header}}`), element: ctx.metadata(`!{${element}}`) };
}

/**
 * `, !alias.scope ..., !noalias ...` for a load or store of an array header
 * field. Both halves are needed: `alias.scope` alone says where the access is,
 * and only the `noalias` on the other side makes the pair a NoAlias answer.
 */
function headerAccess(ctx: EmitContext): string {
  if (!ctx.opts.optimizeAttributes) return "";
  const { header, element } = aliasDomains(ctx);
  return `, !alias.scope ${header}, !noalias ${element}`;
}

/** The same, for a load or store of array element data. */
export function elementAccess(ctx: EmitContext): string {
  if (!ctx.opts.optimizeAttributes) return "";
  const { header, element } = aliasDomains(ctx);
  return `, !alias.scope ${element}, !noalias ${header}`;
}

// ---- Loop header hoisting (WP15 2c) -------------------------------------------------

/**
 * One array's header, read once in the preheader of the loop that reads the
 * array: the header pointer, its `len` and its `data`.
 *
 * The point of holding all three is the middle one. A loop over an array in a
 * class field reads the length *twice* -- once for the `while` condition and
 * once for the bounds check -- and those are two loads of one address that
 * GVN is not obliged to merge, so the loop ends up with two length values, two
 * compares and two exits. One `len` here is one value in both places by
 * construction rather than by hope, which is the criterion 2c sets and the
 * thing a preheader load on its own does not give.
 */
type HoistedHeader = { root: LocalVar; path: string; arr: string; len: string; data: string };

/**
 * The array an expression denotes: the header pointer, plus the hoisted
 * fields when an enclosing loop lifted them. Every read of `len` or `data`
 * goes through `baseLength` / `baseData` so that a hoisted loop and an
 * ordinary one differ in one place rather than at every access.
 */
type ArrayBase = { arr: string; header?: HoistedHeader };

/**
 * A stable array location: the binding a property path is rooted at, the chain
 * below it, and the type that chain *declares*.
 *
 * The declared type is carried rather than looked up at the use site because
 * the two differ exactly where it matters. The checker records the *narrowed*
 * type for an identifier inside `if (h !== null)`, and a hoist lifts the load
 * to the preheader, which is outside that guard: taking the narrowed answer
 * would dereference a null `h` in a loop whose body never runs.
 */
type ArrayPath = { root: LocalVar; path: string; type: StaticType };

/**
 * The whole-program facts, published by `analyzeFunctions` once per program.
 *
 * The direction is forced and worth stating: `attributes.ts` imports this
 * module (`isPushCall`, `storesInlineElements`, `literalLength`), so importing
 * it back for a *value* would close an ESM cycle -- the failure mode
 * `literalLength`'s own comment describes, a dispatch table read before its
 * initializer. Phase C0 runs to a fixpoint before Phase C1 emits a byte, so
 * handing the answers over at the end of it is an ordering this pipeline
 * already guarantees.
 */
let programFacts: ReadonlyMap<string, FunctionFacts> | undefined;

/** Enclosing loops' hoisted headers, innermost last; `scopeStarts` marks where each begins. */
const headerScopes: HoistedHeader[] = [];
const scopeStarts: number[] = [];

export function setProgramFacts(facts: ReadonlyMap<string, FunctionFacts>): void {
  programFacts = facts;
  headerScopes.length = 0;
  scopeStarts.length = 0;
}

/**
 * A key for the location `expr` reads, or undefined when `expr` is not a shape
 * whose value a preheader can stand in for.
 *
 * What qualifies is an identifier (or `this`) bound to a parameter or a
 * `readonly` local, optionally followed by property accesses: `src`, `h.xs`,
 * `this.state.atMostIndex`. Every link has to be non-nullable, because the
 * preheader load happens whether or not the body runs and a `T | null`
 * narrowed *inside* the loop would be dereferenced before its guard.
 *
 * Anything else -- a call, an element access, a reassignable local -- is left
 * alone. Re-evaluating those in the preheader could panic, allocate or simply
 * answer something different, and none of that is a hoist.
 */
function pathOf(ctx: EmitContext, expr: ts.Expression): ArrayPath | undefined {
  const inner = unwrapParens(expr);
  if (ts.isIdentifier(inner) || inner.kind === ts.SyntaxKind.ThisKeyword) {
    const local = ctx.program.bindings.get(inner as ts.Identifier);
    if (!local || (local.storage !== "param" && local.mutable)) return undefined;
    // The *binding*, not the spelling: two `xs` in sibling scopes are two
    // locals and must not share a hoisted header, which comparing names by
    // themselves would let them do. `local.type` is what it was declared as,
    // which is the answer a preheader needs.
    return { root: local, path: "", type: local.type };
  }
  if (!ts.isPropertyAccessExpression(inner)) return undefined;
  const base = pathOf(ctx, inner.expression);
  // A plain struct, declared: `T | null` is refused here whatever a guard
  // inside the loop narrowed it to. Anything with no struct to look the field
  // up in -- an imported module's name, a class named in a `new`, an enum --
  // falls out of the same test rather than needing a case of its own.
  if (base === undefined || base.type.kind !== "struct") return undefined;
  const field = ctx.program.structs.get(base.type.name)?.fieldsByName.get(inner.name.text);
  if (!field) return undefined;
  return { root: base.root, path: `${base.path}.${inner.name.text}`, type: field.type };
}

/** The hoisted header for `expr`, when an enclosing loop's preheader loaded one. */
function hoistedFor(ctx: EmitContext, expr: ts.Expression): HoistedHeader | undefined {
  if (headerScopes.length === 0) return undefined;
  const path = pathOf(ctx, expr);
  if (path === undefined) return undefined;
  for (let i = headerScopes.length - 1; i >= 0; i--) {
    const found = headerScopes[i];
    if (found.root === path.root && found.path === path.path) return found;
  }
  return undefined;
}

/** Lower the receiver of an element access or a `.length`, reusing a hoisted header where there is one. */
function emitArrayBase(ctx: EmitContext, expr: ts.Expression): ArrayBase {
  const header = hoistedFor(ctx, expr);
  return header ? { arr: header.arr, header } : { arr: ctx.emitExpression(expr) };
}

/** The array's `len`: the preheader's value inside a hoisted loop, a fresh load outside one. */
function baseLength(ctx: EmitContext, base: ArrayBase): string {
  return base.header ? base.header.len : loadHeaderField(ctx, base.arr, 0);
}

/** The array's `data`, on the same terms as `baseLength`. */
function baseData(ctx: EmitContext, base: ArrayBase): string {
  return base.header ? base.header.data : loadHeaderField(ctx, base.arr, 2, "i8*");
}

/**
 * Whether anything `loop` does can move an array header, which is the whole
 * of what a hoisted `len` and `data` depend on.
 *
 * Two things can: a `push` or a `pop` written in the loop, and a call to a
 * user function the fixpoint says grows an array (`FunctionFacts.
 * resizesArray`). A builtin cannot -- `push` and `pop` are the only builtins
 * that reach a user array's header and both are caught in the first place --
 * and an element store cannot either, which is the reason the fact is not
 * `writesThrough`: a loop that writes `dst[i]` is exactly the loop this is
 * for.
 *
 * A callee with no facts is treated as growing one. That is the same answer
 * this gave everywhere before the fact existed, so an unanalysed program
 * hoists nothing rather than hoisting wrongly.
 */
function loopMayResize(ctx: EmitContext, loop: ts.Node): boolean {
  let resizes = false;
  const visit = (node: ts.Node): void => {
    if (resizes) return;
    if (isResizeCall(ctx.program, node)) {
      resizes = true;
      return;
    }
    if (ts.isCallExpression(node)) {
      const callee = ctx.program.callees.get(node);
      if (callee && (programFacts?.get(callee.name)?.resizesArray ?? true)) {
        resizes = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(loop);
  return resizes;
}

/**
 * The field names `loop` stores to, plus whether it can store to a field it
 * cannot name -- a `new`, or a call to a user function that writes memory.
 *
 * A hoisted `h.xs` is a field load lifted into the preheader, so it stands
 * only while nothing in the loop puts a different array in that field. A store
 * to a field of *another* name cannot, whatever it aliases, which is why the
 * names are collected rather than a single flag: a loop that advances
 * `this.pos` may still hoist `this.source`.
 *
 * `effect === "write"` is a blunt instrument for the calls -- it is also true
 * of a callee that only allocates -- and a narrower "writes a field" fact
 * would let more loops through. It is the fact that exists today, and being
 * too careful here costs a hoist rather than an answer.
 */
function storedFields(ctx: EmitContext, loop: ts.Node): { names: Set<string>; opaque: boolean } {
  const names = new Set<string>();
  let opaque = false;
  const visit = (node: ts.Node): void => {
    if (ts.isBinaryExpression(node) && isAssignmentOperator(node.operatorToken.kind)) {
      const target = unwrapParens(node.left);
      if (ts.isPropertyAccessExpression(target)) names.add(target.name.text);
    } else if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
      const target = unwrapParens(node.operand);
      if (ts.isPropertyAccessExpression(target)) names.add(target.name.text);
    } else if (ts.isNewExpression(node)) {
      opaque = true; // the constructor stores fields, and not only its own
    } else if (ts.isCallExpression(node)) {
      const callee = ctx.program.callees.get(node);
      if (callee && (programFacts?.get(callee.name)?.effect ?? "write") === "write") opaque = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(loop);
  return { names, opaque };
}

/** Every local `loop` declares: a path rooted at one of them cannot be lifted above its declaration. */
function localsDeclaredIn(ctx: EmitContext, loop: ts.Node): Set<LocalVar> {
  const declared = new Set<LocalVar>();
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node)) {
      // `locals`, not `bindings`: the checker keys a declaration by its node
      // and only a *reference* by its identifier, so asking `bindings` about
      // the name being declared answers nothing and the guard never fires.
      const local = ctx.program.locals.get(node);
      if (local) declared.add(local);
    }
    ts.forEachChild(node, visit);
  };
  visit(loop);
  return declared;
}

/** Whether any link of a path names a field the loop stores to. */
function pathIsShadowed(expr: ts.Expression, names: Set<string>): boolean {
  let link = unwrapParens(expr);
  while (ts.isPropertyAccessExpression(link)) {
    if (names.has(link.name.text)) return true;
    link = unwrapParens(link.expression);
  }
  return false;
}

/**
 * Collect the array receivers `loop` reads through, innermost expression per
 * distinct location, along with whether the loop needs that array's `len`
 * (a `.length` read or a bounds check) and its `data` (any element access).
 *
 * Nested loops are walked too: their preheaders sit inside this one, so an
 * array both of them read is better hoisted here, and an array only the inner
 * loop reads is hoisted by the inner loop's own scope.
 */
/** One array a loop reads, and which header fields the loop asks for. */
type ArrayUse = { expr: ts.Expression; path: ArrayPath; len: boolean; data: boolean };

function arrayUses(ctx: EmitContext, loop: ts.Node): ArrayUse[] {
  const uses: ArrayUse[] = [];
  const note = (expr: ts.Expression, len: boolean, data: boolean): void => {
    const path = pathOf(ctx, expr);
    // Again the declared type: an `i32[] | null` narrowed inside the loop is
    // still nullable where the preheader would read its header.
    if (path === undefined || path.type.kind !== "array") return;
    const found = uses.find((u) => u.path.root === path.root && u.path.path === path.path);
    if (found) {
      found.len = found.len || len;
      found.data = found.data || data;
    } else {
      uses.push({ expr, path, len, data });
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isElementAccessExpression(node)) {
      // A proven index reads no length (`emitBoundsCheck` skips the check), so
      // asking for one here would put a load in the preheader that the loop
      // never uses. `provenIndices` is read in both places or in neither.
      note(node.expression, !ctx.opts.uncheckedIndexing && !ctx.program.provenIndices.has(node), true);
    } else if (ts.isPropertyAccessExpression(node) && node.name.text === "length") {
      note(node.expression, true, false);
    }
    ts.forEachChild(node, visit);
  };
  visit(loop);
  return uses;
}

/**
 * Lift every array header `loop` reads into the block being emitted, which is
 * the loop's preheader, and push a scope so the loop body reads them back.
 *
 * `emit/control-flow.ts` calls this with the branch into the loop head not yet
 * written, so what this emits lands in the block that dominates the whole
 * loop and runs once. `closeHeaderScope` pops it.
 */
export function openHeaderScope(ctx: EmitContext, loop: ts.IterationStatement): void {
  scopeStarts.push(headerScopes.length);
  if (!ctx.opts.optimizeAttributes || loopMayResize(ctx, loop)) return;
  const uses = arrayUses(ctx, loop);
  if (uses.length === 0) return;
  const { names, opaque } = storedFields(ctx, loop);
  const declared = localsDeclaredIn(ctx, loop);
  for (const use of uses) {
    if (declared.has(use.path.root)) continue; // declared inside the loop: no value to lift
    // A property path moves the field loads too, so they have to be stable.
    if (use.path.path.length > 0 && (opaque || pathIsShadowed(use.expr, names))) continue;
    ctx.declareType(ARRAY_TYPE);
    const arr = ctx.emitExpression(use.expr);
    headerScopes.push({
      root: use.path.root,
      path: use.path.path,
      arr,
      // An array's header is `dereferenceable(24)` wherever one is reachable,
      // so both loads are safe in a preheader the body may never leave. The
      // unused one is not emitted: a loop that only reads `.length` should not
      // grow a `data` load it never asks for.
      len: use.len ? loadHeaderField(ctx, arr, 0) : "",
      data: use.data ? loadHeaderField(ctx, arr, 2, "i8*") : "",
    });
  }
}

/** Close the innermost scope `openHeaderScope` opened. */
export function closeHeaderScope(): void {
  headerScopes.length = scopeStarts.pop() ?? 0;
}

// ---- Header access ------------------------------------------------------------------

/** Address of header field `index` (0 len, 1 cap, 2 data). */
function fieldPointer(ctx: EmitContext, arr: string, index: 0 | 1 | 2): string {
  return ctx.fn.emitValue(`getelementptr inbounds ${HEADER}, ${HEADER_PTR} ${arr}, i64 0, i32 ${index}`);
}

/** Load header field `index`, in the header alias domain. */
function loadHeaderField(ctx: EmitContext, arr: string, index: 0 | 1 | 2, type = "i64"): string {
  return ctx.fn.emitValue(
    `load ${type}, ${type}* ${fieldPointer(ctx, arr, index)}${align8(ctx)}${headerAccess(ctx)}`
  );
}

/** Store `value` into header field `index`, in the header alias domain. */
function storeHeaderField(
  ctx: EmitContext,
  arr: string,
  index: 0 | 1 | 2,
  value: string,
  type = "i64"
): void {
  ctx.fn.emit(
    `store ${type} ${value}, ${type}* ${fieldPointer(ctx, arr, index)}${align8(ctx)}${headerAccess(ctx)}`
  );
}

function loadLength(ctx: EmitContext, arr: string): string {
  return loadHeaderField(ctx, arr, 0);
}

/**
 * Address of element `idx` (an i64 value) of `arr`, as a `<slot type>*`.
 *
 * For an inline record (WP15 §2a) the slot type is the struct itself, so this
 * *is* the element's value: the GEP strides by `sizeof` and lands on the
 * object, where the old layout landed on a pointer that had to be chased.
 */
function elementPointer(ctx: EmitContext, base: ArrayBase, elem: StaticType, idx: string): string {
  const ty = slotType(ctx, elem);
  const data = baseData(ctx, base);
  const typed = ctx.fn.emitValue(`bitcast i8* ${data} to ${ty}*`);
  return ctx.fn.emitValue(`getelementptr inbounds ${ty}, ${ty}* ${typed}, i64 ${idx}`);
}

/**
 * Read element `idx`: the slot's value, or — for an inline record — the slot's
 * *address*, which is what a struct value is everywhere else in the emitter.
 * No load: the object is already there.
 */
function loadElement(ctx: EmitContext, base: ArrayBase, elem: StaticType, idx: string): string {
  const slot = elementPointer(ctx, base, elem, idx);
  if (inlineStruct(ctx, elem)) return slot;
  const ty = llvmType(elem);
  return ctx.fn.emitValue(`load ${ty}, ${ty}* ${slot}${ctx.alignSuffix(elem)}${elementAccess(ctx)}`);
}

/**
 * Write `value` into the slot at `ptr`. For an inline record that is a copy of
 * the object's bytes, the way a C `ps[i] = *q` copies: the array owns its
 * storage, so a struct entering it is duplicated into the slot rather than
 * referenced from it (`docs/LANGUAGE.md`, "Arrays of classes are contiguous").
 *
 * `llvm.memcpy` requires the two ranges to be equal or disjoint, and they
 * always are: both operands are whole objects of one class, and two such
 * objects are either the same object or two separate allocations — the
 * language has no way to spell a pointer part-way into one.
 */
function storeElement(ctx: EmitContext, ptr: string, elem: StaticType, value: string): void {
  const inline = inlineStruct(ctx, elem);
  if (!inline) {
    const ty = llvmType(elem);
    ctx.fn.emit(`store ${ty} ${value}, ${ty}* ${ptr}${ctx.alignSuffix(elem)}${elementAccess(ctx)}`);
    return;
  }
  const ty = `%struct.${inline.name}`;
  ctx.declare(
    `declare void @${MEMCPY}(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)`
  );
  const dst = ctx.fn.emitValue(`bitcast ${ty}* ${ptr} to i8*`);
  const src = ctx.fn.emitValue(`bitcast ${ty}* ${value} to i8*`);
  const a = ctx.opts.optimizeAttributes ? `align ${inline.align} ` : "";
  ctx.fn.emit(
    `call void @${MEMCPY}(i8* ${a}${dst}, i8* ${a}${src}, i64 ${inline.size}, i1 false)${elementAccess(ctx)}`
  );
}

/**
 * Lower a numeric expression and widen it to i64: `sext` from a signed
 * integer, `zext` from an unsigned one (WP15: `zext` is what keeps a `u32`
 * index above `INT_MAX` from becoming a negative i64 and failing the
 * unsigned bounds compare), `fptosi` from double (truncates).
 */
export function emitIndex(ctx: EmitContext, expr: ts.Expression): string {
  const type = ctx.typeOf(expr);
  const literal = unwrapParens(expr);
  // Fold the widening of a constant index. `| 0` is the i32 truncation the
  // checker already allows for; an i64 or unsigned literal is exact as written.
  if (type.kind === "i32" && ts.isNumericLiteral(literal)) return String(Number(literal.text) | 0);
  if (isUnsigned(type) && ts.isNumericLiteral(literal)) return String(Number(literal.text));
  const value = ctx.emitExpression(expr);
  const ty = llvmType(type);
  if (ty === "i64") return value;
  if (isFloat(type)) return ctx.fn.emitValue(`fptosi ${ty} ${value} to i64`);
  return ctx.fn.emitValue(`${isUnsigned(type) ? "zext" : "sext"} ${ty} ${value} to i64`);
}

/** Convert an i64 length back to the `number` type the checker recorded for `expr`. */
export function emitNumberFromI64(ctx: EmitContext, value: string, expr: ts.Expression): string {
  const type = ctx.typeOf(expr);
  if (type.kind === "f64") return ctx.fn.emitValue(`sitofp i64 ${value} to double`);
  return ctx.fn.emitValue(`trunc i64 ${value} to i32`);
}

/**
 * `idx < len` (unsigned) or branch to a cold block that panics and never
 * returns. `len` is a value rather than an array, so `s.charCodeAt(i)`
 * (WP14) shares this one check, this one panic and this one message.
 */
export function emitRangeCheck(ctx: EmitContext, idx: string, len: string): void {
  if (ctx.opts.uncheckedIndexing) return;
  const fn = ctx.fn;
  const inRange = fn.emitValue(`icmp ult i64 ${idx}, ${len}`);
  const failBlock = fn.newBlock("bounds.fail");
  const okBlock = fn.newBlock("bounds.ok");
  fn.emit(`br i1 ${inRange}, label %${okBlock.label}, label %${failBlock.label}`);
  fn.placeBlock(failBlock);
  fn.emit(`call void ${ctx.useRuntime("nish_panic_index")}(i64 ${idx}, i64 ${len})`);
  fn.emit("unreachable");
  fn.placeBlock(okBlock);
}

/**
 * The bounds check of `a[i]`: the array's length, then the shared range check.
 * `site` is the access node, which is how the checker's proof is looked up —
 * a proven access loads no length at all, so the header read goes with the
 * compare rather than being left behind for LICM to hoist.
 */
function emitBoundsCheck(ctx: EmitContext, base: ArrayBase, idx: string, site: ts.Node): void {
  if (ctx.opts.uncheckedIndexing || ctx.program.provenIndices.has(site)) return;
  emitRangeCheck(ctx, idx, baseLength(ctx, base));
}

/**
 * Allocate a header with `len = cap = n`; `data` is stored by `storeData`.
 * Returns the `%struct.nish_array*`: an alloca when `site` is on the stack (WP6).
 */
function emitHeader(ctx: EmitContext, n: string, site: ts.Node): string {
  ctx.declareType(ARRAY_TYPE);
  let arr: string;
  if (ctx.isStackSite(site)) {
    arr = ctx.fn.emitAlloca("arr.hdr", HEADER, 8);
  } else {
    const raw = ctx.fn.emitValue(`call i8* ${ctx.useRuntime("nish_alloc_struct")}(i64 ${HEADER_BYTES})`);
    arr = ctx.fn.emitValue(`bitcast i8* ${raw} to ${HEADER_PTR}`);
  }
  storeHeaderField(ctx, arr, 0, n);
  storeHeaderField(ctx, arr, 1, n);
  return arr;
}

/**
 * The non-negative integer a literal length denotes, or undefined for anything
 * else. It lives here rather than in `escape.ts`, which is the phase that
 * *asks* it whether a `new Array` site can be a stack slot, because that file
 * already imports this one (`isPushCall`, `isJoinCall`) and the reverse import
 * would close an ESM cycle — one that shows up as a dispatch table read before
 * its initializer, not as an error anyone would connect to this. Both callers
 * have to agree: the analysis decides the site is stackable from the literal
 * and the emitter types the slot `[n x T]` from it.
 */
export function literalLength(expr: ts.Expression): number | undefined {
  let inner = expr;
  while (ts.isParenthesizedExpression(inner)) inner = inner.expression;
  if (!ts.isNumericLiteral(inner)) return undefined;
  const n = Number(inner.text);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

/**
 * Element storage as an `i8*`: `[count x T]` on the stack when `site` is a
 * stack allocation (the count is then a literal, see escape.ts), else
 * `bytes` from the arena.
 */
function emitData(
  ctx: EmitContext,
  site: ts.Node,
  elem: StaticType,
  count: number | undefined,
  bytes: string
): string {
  if (count !== undefined && ctx.isStackSite(site)) {
    const ty = `[${count} x ${slotType(ctx, elem)}]`;
    const slot = ctx.fn.emitAlloca("arr.data", ty, 8);
    return ctx.fn.emitValue(`bitcast ${ty}* ${slot} to i8*`);
  }
  return ctx.fn.emitValue(`call i8* ${ctx.useRuntime("nish_alloc_struct")}(i64 ${bytes})`);
}

function storeData(ctx: EmitContext, arr: string, data: string): void {
  storeHeaderField(ctx, arr, 2, data, "i8*");
}

// ---- Construction -------------------------------------------------------------------

/** `[a, b, c]`: elements are evaluated first (left to right), then stored into fresh arena storage. */
const emitArrayLiteral: ExpressionEmitter = (ctx, node) => {
  const expr = node as ts.ArrayLiteralExpression;
  const { elem } = ctx.typeOf(expr) as ArrayType;
  const ty = slotType(ctx, elem);
  const values = expr.elements.map((e) => ctx.emitExpression(e));
  const n = values.length;
  const arr = emitHeader(ctx, String(n), expr);
  const data = n === 0 ? "null" : emitData(ctx, expr, elem, n, String(n * elementSize(ctx, elem)));
  storeData(ctx, arr, data);
  if (n > 0) {
    const typed = ctx.fn.emitValue(`bitcast i8* ${data} to ${ty}*`);
    values.forEach((value, i) => {
      const slot = ctx.fn.emitValue(`getelementptr inbounds ${ty}, ${ty}* ${typed}, i64 ${i}`);
      storeElement(ctx, slot, elem, value);
    });
  }
  return arr;
};

/** `new Array<T>(n)`: `n` zeroed elements. A negative `n` becomes a huge allocation and aborts in the arena. */
newEmitters.Array = (ctx, expr) => {
  const { elem } = ctx.typeOf(expr) as ArrayType;
  const size = elementSize(ctx, elem);
  const n = emitIndex(ctx, expr.arguments![0]);
  const arr = emitHeader(ctx, n, expr);
  const bytes = size === 1 ? n : ctx.fn.emitValue(`mul i64 ${n}, ${size}`);
  // The slot's type spells the length out, so it has to come from the literal
  // and not from `n`, which is an IR operand: under `--number-mode f64` the
  // literal reaches here as a register (it has been through a conversion) and
  // parsing it back gave `[NaN x T]`, IR `llvm-as` refuses, from a compile that
  // exited 0. `escape.ts` decided this was a stack site from the same literal,
  // so ask it the same question rather than a different one.
  const count = ctx.isStackSite(expr) ? literalLength(expr.arguments![0]) : undefined;
  if (count === undefined && ctx.isStackSite(expr)) {
    throw new Error("emitter: a stack array whose length is not a literal");
  }
  const data = emitData(ctx, expr, elem, count, bytes);
  ctx.declare(`declare void @${MEMSET}(i8* nocapture writeonly, i8, i64, i1 immarg)`);
  const dataArg = ctx.opts.optimizeAttributes ? `i8* align 8 ${data}` : `i8* ${data}`;
  // The zero fill is element traffic like any other store, and saying so keeps
  // it from being read as a clobber of the `len`/`cap` written just above.
  ctx.fn.emit(`call void @${MEMSET}(${dataArg}, i8 0, i64 ${bytes}, i1 false)${elementAccess(ctx)}`);
  storeData(ctx, arr, data);
  return arr;
};
// `new Int32Array(n)` and friends are `new Array<T>(n)` with `T` fixed by the checker: same lowering.
for (const name of Object.keys(TYPED_ARRAY_ALIASES)) newEmitters[name] = newEmitters.Array;

// ---- Element access -------------------------------------------------------------------

const emitElementAccess: ExpressionEmitter = (ctx, node) => {
  const expr = node as ts.ElementAccessExpression;
  const elem = ctx.typeOf(expr);
  ctx.declareType(ARRAY_TYPE);
  const base = emitArrayBase(ctx, expr.expression);
  const idx = emitIndex(ctx, expr.argumentExpression);
  emitBoundsCheck(ctx, base, idx, expr);
  return loadElement(ctx, base, elem, idx);
};

/** Opcode per compound operator: [integer form, floating-point form]. */
const COMPOUND_OPCODES: Partial<Record<ts.SyntaxKind, [string, string]>> = {
  [ts.SyntaxKind.PlusEqualsToken]: ["add", "fadd"],
  [ts.SyntaxKind.MinusEqualsToken]: ["sub", "fsub"],
  [ts.SyntaxKind.AsteriskEqualsToken]: ["mul", "fmul"],
  [ts.SyntaxKind.SlashEqualsToken]: ["sdiv", "fdiv"],
  [ts.SyntaxKind.PercentEqualsToken]: ["srem", "frem"],
};

function unwrapParens(expr: ts.Expression): ts.Expression {
  let inner = expr;
  while (ts.isParenthesizedExpression(inner)) inner = inner.expression;
  return inner;
}

/**
 * `a[i] = v`: array, index, value, then the check and the store (the value is
 * the expression's result). `a[i] op= v`: array, index, check, load, value,
 * op, store, matching JavaScript's read-before-right-operand order.
 */
const emitElementAssignment: BinaryEmitter = (ctx, expr) => {
  const target = unwrapParens(expr.left) as ts.ElementAccessExpression;
  const elem = ctx.typeOf(target);
  const ty = llvmType(elem);
  ctx.declareType(ARRAY_TYPE);
  const base = emitArrayBase(ctx, target.expression);
  const idx = emitIndex(ctx, target.argumentExpression);
  const op = expr.operatorToken.kind;
  if (op === ts.SyntaxKind.EqualsToken) {
    const value = ctx.emitExpression(expr.right);
    emitBoundsCheck(ctx, base, idx, target);
    storeElement(ctx, elementPointer(ctx, base, elem, idx), elem, value);
    return value;
  }
  // The array and the index were evaluated once, above; the check and the GEP
  // are done once here, and the load and the store share the address. That is
  // what keeps `xs[next()] |= 1` to one call and one bounds check.
  emitBoundsCheck(ctx, base, idx, target);
  const slot = elementPointer(ctx, base, elem, idx);
  const old = ctx.fn.emitValue(`load ${ty}, ${ty}* ${slot}${ctx.alignSuffix(elem)}${elementAccess(ctx)}`);
  let value: string;
  if (isBitwiseCompoundOperator(op)) {
    value = emitBitwiseCombine(ctx, op, elem, old, expr.right);
  } else {
    const rhs = ctx.emitExpression(expr.right);
    const [intOp, floatOp] = COMPOUND_OPCODES[op]!;
    value = isFloat(elem)
      ? ctx.fn.emitValue(`${floatOp} ${ty} ${old}, ${rhs}`)
      : emitIntBinary(ctx, intOp, elem, old, rhs);
  }
  ctx.fn.emit(`store ${ty} ${value}, ${ty}* ${slot}${ctx.alignSuffix(elem)}${elementAccess(ctx)}`);
  return value;
};

/** Wrap the `=` / `op=` emitters already in `table`; element targets come here, the rest go to the previous handler. */
export function installArrayAssignmentEmitters(table: EmitterTable<BinaryEmitter>): void {
  for (const op of ELEMENT_ASSIGNMENT_OPERATORS) {
    const previous = table[op];
    if (!previous) continue;
    table[op] = (ctx, expr) =>
      ts.isElementAccessExpression(unwrapParens(expr.left))
        ? emitElementAssignment(ctx, expr)
        : previous(ctx, expr);
  }
}

// ---- Members ----------------------------------------------------------------------------

propertyEmitters.array = (ctx, expr) => {
  ctx.declareType(ARRAY_TYPE);
  return emitNumberFromI64(ctx, baseLength(ctx, emitArrayBase(ctx, expr.expression)), expr);
};

/** `a.push(v)`: grow when full (`push.grow`), store at `len` (`push.store`), bump `len`; yields the new length. */
/** Runtime `i8*` of a string element, plus its length; shared by `join`. */
function stringLength(ctx: EmitContext, str: string): string {
  const header = ctx.fn.emitValue(`bitcast i8* ${str} to i64*`);
  return ctx.fn.emitValue(`load i64, i64* ${header}${align8(ctx)}`);
}

/**
 * `===` for an element type, mirroring `emitStrictEquality` in `strings.ts`:
 * strings compare by content, floats with `fcmp oeq` (so a `NaN` element is
 * never found, as in JavaScript), and everything else — integers, booleans,
 * and the pointers of classes, interfaces and arrays — with `icmp eq`.
 */
function emitElementEquals(ctx: EmitContext, elem: StaticType, a: string, b: string): string {
  if (elem.kind === "string") {
    return ctx.fn.emitValue(`call zeroext i1 ${ctx.useRuntime("nish_str_eq")}(i8* ${a}, i8* ${b})`);
  }
  const opcode = isFloat(elem) ? "fcmp oeq" : "icmp eq";
  return ctx.fn.emitValue(`${opcode} ${llvmType(elem)} ${a}, ${b}`);
}

/** `a.push(v)`: grow when full, store at `len`, and answer the new length. */
function emitPush(ctx: EmitContext, expr: ts.CallExpression, arr: string, elem: StaticType): string {
  const fn = ctx.fn;
  const value = ctx.emitExpression(expr.arguments[0]);
  const lenPtr = fieldPointer(ctx, arr, 0);
  const len = fn.emitValue(`load i64, i64* ${lenPtr}${align8(ctx)}${headerAccess(ctx)}`);
  const cap = loadHeaderField(ctx, arr, 1);
  const full = fn.emitValue(`icmp eq i64 ${len}, ${cap}`);
  const growBlock = fn.newBlock("push.grow");
  const storeBlock = fn.newBlock("push.store");
  fn.emit(`br i1 ${full}, label %${growBlock.label}, label %${storeBlock.label}`);
  fn.placeBlock(growBlock);
  fn.emit(
    `call void ${ctx.useRuntime("nish_array_grow")}(${HEADER_PTR} ${arr}, i64 ${elementSize(ctx, elem)})`
  );
  fn.emit(`br label %${storeBlock.label}`);
  fn.placeBlock(storeBlock);
  storeElement(ctx, elementPointer(ctx, { arr }, elem, len), elem, value);
  const newLen = fn.emitValue(`add i64 ${len}, 1`);
  fn.emit(`store i64 ${newLen}, i64* ${lenPtr}${align8(ctx)}${headerAccess(ctx)}`);
  return emitNumberFromI64(ctx, newLen, expr);
}

/**
 * `a.pop()`: the last element, with the length decremented. An empty array
 * panics through the same `nish_panic_index` an index does — reported as
 * `0 >= 0`, which is the access being attempted — because there is no
 * `undefined` to return and no second return type to widen to.
 */
function emitPop(ctx: EmitContext, arr: string, elem: StaticType): string {
  const fn = ctx.fn;
  const lenPtr = fieldPointer(ctx, arr, 0);
  const len = fn.emitValue(`load i64, i64* ${lenPtr}${align8(ctx)}${headerAccess(ctx)}`);
  if (!ctx.opts.uncheckedIndexing) {
    const empty = fn.emitValue(`icmp eq i64 ${len}, 0`);
    const failBlock = fn.newBlock("pop.empty");
    const okBlock = fn.newBlock("pop.ok");
    fn.emit(`br i1 ${empty}, label %${failBlock.label}, label %${okBlock.label}`);
    fn.placeBlock(failBlock);
    fn.emit(`call void ${ctx.useRuntime("nish_panic_index")}(i64 0, i64 0)`);
    fn.emit("unreachable");
    fn.placeBlock(okBlock);
  }
  const last = fn.emitValue(`sub i64 ${len}, 1`);
  fn.emit(`store i64 ${last}, i64* ${lenPtr}${align8(ctx)}${headerAccess(ctx)}`);
  // An inline record comes back as the address of the slot that was just
  // dropped. The bytes are still there and still valid; the next `push` reuses
  // them, which is why `checkElementReferences` counts `pop` as a mutation.
  return loadElement(ctx, { arr }, elem, last);
}

/**
 * `a.indexOf(v)`: the first index whose element is `=== v`, or -1. The scan
 * is emitted here rather than in `runtime.c`, which has a budget and would
 * need one search per element type anyway.
 *
 * The loop is invisible to `attributes.ts`, which counts *source* loops, so
 * it must terminate on its own for `willreturn` to stay sound: the index
 * rises by one per pass and stops at `len`.
 */
function emitIndexOf(ctx: EmitContext, expr: ts.CallExpression, arr: string, elem: StaticType): string {
  const fn = ctx.fn;
  const value = ctx.emitExpression(expr.arguments[0]);
  const len = loadLength(ctx, arr);
  const slot = fn.emitAlloca("idx.at", "i64", 8);
  fn.emit(`store i64 0, i64* ${slot}, align 8`);
  const scanBlock = fn.newBlock("idx.scan");
  const testBlock = fn.newBlock("idx.test");
  const nextBlock = fn.newBlock("idx.next");
  const missBlock = fn.newBlock("idx.miss");
  const endBlock = fn.newBlock("idx.found");

  fn.emit(`br label %${scanBlock.label}`);
  fn.placeBlock(scanBlock);
  const at = fn.emitValue(`load i64, i64* ${slot}, align 8`);
  const more = fn.emitValue(`icmp ult i64 ${at}, ${len}`);
  fn.emit(`br i1 ${more}, label %${testBlock.label}, label %${missBlock.label}`);

  fn.placeBlock(testBlock);
  // For an inline record the element *is* the slot address, so the `icmp eq`
  // below still asks what it always asked: is this the same object? Identity
  // is now "the same slot", which is the only identity a contiguous array has.
  const element = loadElement(ctx, { arr }, elem, at);
  const hit = emitElementEquals(ctx, elem, element, value);
  fn.emit(`br i1 ${hit}, label %${endBlock.label}, label %${nextBlock.label}`);

  fn.placeBlock(nextBlock);
  const next = fn.emitValue(`add i64 ${at}, 1`);
  fn.emit(`store i64 ${next}, i64* ${slot}, align 8`);
  fn.emit(`br label %${scanBlock.label}`);

  fn.placeBlock(missBlock);
  fn.emit(`br label %${endBlock.label}`);

  fn.placeBlock(endBlock);
  const found = fn.emitValue(`phi i64 [ ${at}, %${testBlock.label} ], [ -1, %${missBlock.label} ]`);
  return emitNumberFromI64(ctx, found, expr);
}

/**
 * `parts.join(sep)` on a `string[]`: one pass over the lengths, one
 * allocation, one `memcpy` per part. Building the same text with `+` in a
 * loop copies everything again per part and never reclaims, which measured
 * 180 MB of peak arena for 88 KB of output (docs/wp14-selfhost.md §3); this
 * is the shape that replaces it.
 *
 * The separator is copied before every part but the first, with the *length*
 * selected rather than the branch taken, so the copy loop stays one block.
 * Both loops count up to `len` and terminate, which is what keeps
 * `willreturn` sound (see `indexOf` above).
 */
function emitJoin(ctx: EmitContext, expr: ts.CallExpression, arr: string): string {
  const fn = ctx.fn;
  const sep = expr.arguments.length > 0 ? ctx.emitExpression(expr.arguments[0]) : ctx.stringConstant(",");
  const len = loadLength(ctx, arr);
  const sepLen = stringLength(ctx, sep);
  ctx.declare(
    `declare void @${MEMCPY}(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)`
  );

  // The separators: `len - 1` of them, and none at all for an empty array.
  const gaps = fn.emitValue(`sub i64 ${len}, 1`);
  const sepBytes = fn.emitValue(`mul i64 ${sepLen}, ${gaps}`);
  const empty = fn.emitValue(`icmp eq i64 ${len}, 0`);
  const totalSlot = fn.emitAlloca("join.total", "i64", 8);
  const indexSlot = fn.emitAlloca("join.at", "i64", 8);
  const cursorSlot = fn.emitAlloca("join.p", "i8*", 8);
  const base = fn.emitValue(`select i1 ${empty}, i64 0, i64 ${sepBytes}`);
  fn.emit(`store i64 ${base}, i64* ${totalSlot}, align 8`);
  fn.emit(`store i64 0, i64* ${indexSlot}, align 8`);

  const sumBlock = fn.newBlock("join.sum");
  const sumBodyBlock = fn.newBlock("join.sum.body");
  const copyBlock = fn.newBlock("join.copy");
  const copyBodyBlock = fn.newBlock("join.copy.body");
  const endBlock = fn.newBlock("join.end");

  fn.emit(`br label %${sumBlock.label}`);
  fn.placeBlock(sumBlock);
  const sumAt = fn.emitValue(`load i64, i64* ${indexSlot}, align 8`);
  const sumMore = fn.emitValue(`icmp ult i64 ${sumAt}, ${len}`);
  fn.emit(`br i1 ${sumMore}, label %${sumBodyBlock.label}, label %${copyBlock.label}`);

  fn.placeBlock(sumBodyBlock);
  const partPtr = elementPointer(ctx, { arr }, STRING, sumAt);
  const part = fn.emitValue(`load i8*, i8** ${partPtr}${align8(ctx)}${elementAccess(ctx)}`);
  const total = fn.emitValue(`load i64, i64* ${totalSlot}, align 8`);
  const grown = fn.emitValue(`add i64 ${total}, ${stringLength(ctx, part)}`);
  fn.emit(`store i64 ${grown}, i64* ${totalSlot}, align 8`);
  const sumNext = fn.emitValue(`add i64 ${sumAt}, 1`);
  fn.emit(`store i64 ${sumNext}, i64* ${indexSlot}, align 8`);
  fn.emit(`br label %${sumBlock.label}`);

  // One string of exactly that length: the 8-byte header, the bytes, the NUL.
  fn.placeBlock(copyBlock);
  const size = fn.emitValue(`load i64, i64* ${totalSlot}, align 8`);
  const bytes = fn.emitValue(`add i64 ${size}, 9`);
  const out = fn.emitValue(`call i8* ${ctx.useRuntime("nish_alloc_struct")}(i64 ${bytes})`);
  const outHeader = fn.emitValue(`bitcast i8* ${out} to i64*`);
  fn.emit(`store i64 ${size}, i64* ${outHeader}${align8(ctx)}`);
  const outData = fn.emitValue(`getelementptr inbounds i8, i8* ${out}, i64 8`);
  fn.emit(`store i8* ${outData}, i8** ${cursorSlot}, align 8`);
  fn.emit(`store i64 0, i64* ${indexSlot}, align 8`);
  fn.emit(`br label %${copyBodyBlock.label}`);

  fn.placeBlock(copyBodyBlock);
  const copyAt = fn.emitValue(`load i64, i64* ${indexSlot}, align 8`);
  const copyMore = fn.emitValue(`icmp ult i64 ${copyAt}, ${len}`);
  const copyPartBlock = fn.newBlock("join.part");
  fn.emit(`br i1 ${copyMore}, label %${copyPartBlock.label}, label %${endBlock.label}`);

  fn.placeBlock(copyPartBlock);
  const cursor = fn.emitValue(`load i8*, i8** ${cursorSlot}, align 8`);
  const first = fn.emitValue(`icmp eq i64 ${copyAt}, 0`);
  const gapLen = fn.emitValue(`select i1 ${first}, i64 0, i64 ${sepLen}`);
  const sepData = fn.emitValue(`getelementptr inbounds i8, i8* ${sep}, i64 8`);
  fn.emit(`call void @${MEMCPY}(i8* ${cursor}, i8* ${sepData}, i64 ${gapLen}, i1 false)`);
  const afterGap = fn.emitValue(`getelementptr inbounds i8, i8* ${cursor}, i64 ${gapLen}`);
  const item = fn.emitValue(
    `load i8*, i8** ${elementPointer(ctx, { arr }, STRING, copyAt)}${align8(ctx)}${elementAccess(ctx)}`
  );
  const itemLen = stringLength(ctx, item);
  const itemData = fn.emitValue(`getelementptr inbounds i8, i8* ${item}, i64 8`);
  fn.emit(`call void @${MEMCPY}(i8* ${afterGap}, i8* ${itemData}, i64 ${itemLen}, i1 false)`);
  const afterItem = fn.emitValue(`getelementptr inbounds i8, i8* ${afterGap}, i64 ${itemLen}`);
  fn.emit(`store i8* ${afterItem}, i8** ${cursorSlot}, align 8`);
  const copyNext = fn.emitValue(`add i64 ${copyAt}, 1`);
  fn.emit(`store i64 ${copyNext}, i64* ${indexSlot}, align 8`);
  fn.emit(`br label %${copyBodyBlock.label}`);

  fn.placeBlock(endBlock);
  const tail = fn.emitValue(`load i8*, i8** ${cursorSlot}, align 8`);
  fn.emit(`store i8 0, i8* ${tail}, align 1`);
  return out;
}

methodCallEmitters.array = (ctx, expr, receiver) => {
  const { elem } = receiver as ArrayType;
  ctx.declareType(ARRAY_TYPE);
  const arr = ctx.emitExpression((expr.expression as ts.PropertyAccessExpression).expression);
  switch ((expr.expression as ts.PropertyAccessExpression).name.text) {
    case "push":
      return emitPush(ctx, expr, arr, elem);
    case "pop":
      return emitPop(ctx, arr, elem);
    case "indexOf":
      return emitIndexOf(ctx, expr, arr, elem);
    default:
      return emitJoin(ctx, expr, arr);
  }
};

// ---- `for (const x of a)` ------------------------------------------------------------------

/**
 * The index lives in an i64 alloca (`%forof.idx`, mem2reg promotes it) and
 * the element is copied into the loop variable's slot at the top of the body,
 * so the body reads and writes it like any local. `break` leaves to
 * `forof.end`, `continue` goes to `forof.inc`.
 */
const emitForOf: StatementEmitter = (ctx, node) => {
  const stmt = node as ts.ForOfStatement;
  const decl = (stmt.initializer as ts.VariableDeclarationList).declarations[0];
  const local = ctx.program.locals.get(decl)!;
  const elem = local.type;
  const ty = llvmType(elem);
  const fn = ctx.fn;
  ctx.declareType(ARRAY_TYPE);

  const condBlock = fn.newBlock("forof.cond");
  const bodyBlock = fn.newBlock("forof.body");
  const incBlock = fn.newBlock("forof.inc");
  const endBlock = fn.newBlock("forof.end");
  const slot = fn.emitAlloca(`${local.name}.addr`, ty, ctx.align(elem));
  ctx.setSlot(local, slot);
  ctx.debug?.declareLocal(fn, local, slot, decl); // `-g`
  const idxSlot = fn.emitAlloca("forof.idx", "i64", ctx.opts.optimizeAttributes ? 8 : undefined);

  const arr = ctx.emitExpression(stmt.expression);
  fn.emit(`store i64 0, i64* ${idxSlot}${align8(ctx)}`);
  fn.emit(`br label %${condBlock.label}`);

  fn.placeBlock(condBlock);
  const idx = fn.emitValue(`load i64, i64* ${idxSlot}${align8(ctx)}`);
  const more = fn.emitValue(`icmp ult i64 ${idx}, ${loadLength(ctx, arr)}`);
  fn.emit(`br i1 ${more}, label %${bodyBlock.label}, label %${endBlock.label}`);

  fn.placeBlock(bodyBlock);
  // The loop variable holds what `a[i]` holds: for an inline record that is the
  // slot's address, so the body reads and writes the element in place rather
  // than a copy of it.
  const value = loadElement(ctx, { arr }, elem, idx);
  fn.emit(`store ${ty} ${value}, ${ty}* ${slot}${ctx.alignSuffix(elem)}`);
  ctx.loops.push({ breakBlock: endBlock, continueBlock: incBlock, hasBreak: false });
  ctx.emitStatement(stmt.statement);
  ctx.loops.pop();
  if (!fn.currentBlock.terminated) fn.emit(`br label %${incBlock.label}`);

  fn.placeBlock(incBlock);
  const next = fn.emitValue(`add i64 ${fn.emitValue(`load i64, i64* ${idxSlot}${align8(ctx)}`)}, 1`);
  fn.emit(`store i64 ${next}, i64* ${idxSlot}${align8(ctx)}`);
  fn.emit(`br label %${condBlock.label}`);

  fn.placeBlock(endBlock);
};

// ---- Facts for attributes.ts ------------------------------------------------------------------

function isArray(program: CheckedProgram, expr: ts.Expression): boolean {
  return program.types.get(expr)?.kind === "array";
}

/**
 * `a.push(v)` or `a.pop()`: the two calls that move an array's `len`, and so
 * the two a hoisted header has to be safe from (WP15 §2c). Every other array
 * method reads (`indexOf`, `join`) or builds something new.
 */
export function isResizeCall(program: CheckedProgram, node: ts.Node): boolean {
  const method = arrayMethodName(program, node);
  return method === "push" || method === "pop";
}

/** `recv.push(...)` on an array receiver. */
export function isPushCall(program: CheckedProgram, node: ts.Node): node is ts.CallExpression {
  return arrayMethodName(program, node) === "push";
}

/** The array method `node` calls (`push`, `pop`, `indexOf`, `join`), or undefined. */
export function arrayMethodName(program: CheckedProgram, node: ts.Node): string | undefined {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return undefined;
  return isArray(program, node.expression.expression) ? node.expression.name.text : undefined;
}

/**
 * WP15 §2a: `expr` is an array whose slots hold their elements *inline*, so a
 * value stored into one is copied into the slot rather than pointed at from
 * it. `attributes.ts` reads this to keep `nocapture` exact: a struct handed to
 * `xs.push(p)` or written with `xs[i] = p` is read, not retained, and an
 * object built only to be stored into such an array does not escape its frame
 * — which is what lets it be an entry-block alloca the `memcpy` reads from.
 */
export function storesInlineElements(program: CheckedProgram, expr: ts.Expression): boolean {
  const t = program.types.get(expr);
  return t?.kind === "array" && inlineElementStruct(program.structs, t.elem) !== undefined;
}

/** `a.join(sep)` bumps one string out of the arena, so it is an allocation site. */
export function isJoinCall(program: CheckedProgram, node: ts.Node): boolean {
  return arrayMethodName(program, node) === "join";
}

function isElementAssignment(node: ts.Node): node is ts.BinaryExpression {
  return (
    ts.isBinaryExpression(node) &&
    ELEMENT_ASSIGNMENT_OPERATORS.includes(node.operatorToken.kind) &&
    ts.isElementAccessExpression(unwrapParens(node.left))
  );
}

/**
 * What each construct does to memory. Must mirror the emitters above:
 *   - element reads, `.length`, `for...of` and the address computation of a
 *     write load the header (and elements): `readsMemory`;
 *   - a checked `a[i]` may call `nish_panic_index`, which is noreturn, so the
 *     function loses `willreturn` unless `--unchecked-indexing`;
 *   - literals, `new Array`, element writes and `push` store into the arena
 *     (the inline allocator itself is willreturn, so it is folded into the
 *     effect rather than listed as a callee); `push` may call `nish_array_grow`;
 *   - a literal or `new Array` on the stack (WP6) stores into its own allocas
 *     and is no effect at all. Element accesses are still counted even
 *     through a stack local: a `push` may have moved the data into the arena.
 */
/** What each array method does to memory; mirrors the emitters above exactly. */
const collectMethodFacts: FactCollector = (program, node, facts, opts) => {
  const call = node as ts.CallExpression;
  const elem = program.types.get((call.expression as ts.PropertyAccessExpression).expression);
  switch (arrayMethodName(program, node)) {
    case "push":
      facts.effect = "write";
      facts.callees.add("nish_array_grow");
      break;
    case "pop":
      // Stores the shortened length back, and panics on an empty array.
      facts.effect = "write";
      if (!opts.uncheckedIndexing) facts.callees.add("nish_panic_index");
      break;
    case "join":
      facts.effect = "write"; // one arena allocation
      facts.callees.add("nish_alloc_struct");
      break;
    default:
      facts.readsMemory = true; // `indexOf` scans the elements
      if (elem?.kind === "array" && elem.elem.kind === "string") facts.callees.add("nish_str_eq");
      break;
  }
};

const collectArrayFacts: FactCollector = (program, node, facts, opts) => {
  if (ts.isElementAccessExpression(node) && isArray(program, node.expression)) {
    facts.readsMemory = true;
    // Mirrors `emitBoundsCheck` exactly, proof and all: an access the checker
    // proved in range emits no call, so listing `nish_panic_index` here would
    // cost the function `willreturn` for a `noreturn` callee that is not in
    // its IR.
    if (!opts.uncheckedIndexing && !program.provenIndices.has(node)) facts.callees.add("nish_panic_index");
  } else if (ts.isPropertyAccessExpression(node) && isArray(program, node.expression)) {
    facts.readsMemory = true; // `.length`
  } else if (ts.isForOfStatement(node)) {
    facts.readsMemory = true;
  } else if (ts.isArrayLiteralExpression(node) || (ts.isNewExpression(node) && isArray(program, node))) {
    if (!facts.stackSites.has(node)) facts.effect = "write";
  } else if (ts.isCallExpression(node) && arrayMethodName(program, node) !== undefined) {
    collectMethodFacts(program, node, facts, opts);
  } else if (isElementAssignment(node)) {
    facts.effect = "write";
  }
};
factCollectors.push(collectArrayFacts);

// ---- Registration ----------------------------------------------------------------------------

export const arrayExpressionEmitters: EmitterTable<ExpressionEmitter> = {
  [ts.SyntaxKind.ArrayLiteralExpression]: emitArrayLiteral,
  [ts.SyntaxKind.ElementAccessExpression]: emitElementAccess,
};

export const arrayStatementEmitters: EmitterTable<StatementEmitter> = {
  [ts.SyntaxKind.ForOfStatement]: emitForOf,
};
