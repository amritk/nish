/**
 * Array lowering (WP4).
 *
 * Layout (ABI, shared with runtime/runtime.c `struct sts_array`): an array
 * value is a `%struct.sts_array*` to an arena header
 *
 *   %struct.sts_array = type { i64 len, i64 cap, i8* data }
 *
 * `data` points at `cap` elements of `sizeof(T)` bytes, arena-allocated and
 * 8-byte aligned; it is `null` only for a `[]` literal (cap 0), and nothing
 * dereferences it before the first `push` grows the array. Element access
 * bitcasts `data` to `T*` and indexes with an `i64`.
 *
 *   [a, b]           two `sts_alloc_struct` calls (24-byte header, n*sizeof(T)
 *                    data), `len = cap = n`, one store per element.
 *   new Array<T>(n)  header + data as above, data cleared with `llvm.memset`.
 *                    When escape.ts proved the array does not outlive the
 *                    function (WP6) and its size is a literal, both become
 *                    entry-block allocas: `%arr.hdr = alloca %struct.sts_array`
 *                    and `%arr.data = alloca [n x T]`, 8-aligned like arena
 *                    memory. A later `push` moves the data into the arena
 *                    (`sts_array_grow` only touches the header), which is
 *                    still correct: the header keeps pointing at live memory.
 *   a[i]             index widened to i64 (`sext` from i32, `fptosi` from
 *                    double), bounds check, `getelementptr` + `load`.
 *   a[i] = v         same address computation, then `store`; `op=` loads,
 *                    computes and stores.
 *   a.length         `load i64` of the header, then `trunc` to i32 / `sitofp`.
 *   a.push(v)        `len == cap` -> `sts_array_grow`; store at `len`; `len + 1`.
 *   for (x of a)     index loop `forof.cond` / `forof.body` / `forof.inc` /
 *                    `forof.end`; `len` is re-read each iteration (a `push` in
 *                    the body extends the loop, as in JavaScript).
 *
 * Bounds check: `icmp ult i64 %idx, %len` and a branch to a cold block that
 * calls `sts_panic_index(idx, len)` (noreturn) followed by `unreachable`.
 * Comparing unsigned makes a negative index fail too. `--unchecked-indexing`
 * removes the check; an out-of-range index is then undefined behaviour.
 *
 * `collectArrayFacts` feeds attributes.ts with what each construct does to
 * memory; which array parameters are written through or captured is decided
 * there by `classifyUse` (see docs/wp4-arrays.md, "Attributes").
 */
import ts from "typescript";
import { CheckedProgram } from "../../checker";
import { ARRAY_STRUCT, StaticType, alignOf, llvmType } from "../../types";
import { ARRAY_TYPE } from "../runtime";
import { emitIntBinary } from "./arithmetic";
import { BinaryEmitter, EmitContext, EmitterTable, ExpressionEmitter, StatementEmitter } from "./context";
import { FactCollector, factCollectors, methodCallEmitters, newEmitters, propertyEmitters } from "./members";

type ArrayType = Extract<StaticType, { kind: "array" }>;

const HEADER = ARRAY_STRUCT;
const HEADER_PTR = `${ARRAY_STRUCT}*`;
const HEADER_BYTES = 24;
const MEMSET = "llvm.memset.p0i8.i64";

/** Bytes per element. Every StaticTS value is a scalar or a pointer, so its size is its natural alignment. */
function elementSize(elem: StaticType): number {
  return alignOf(elem);
}

/** `, align 8` for header fields and data, or nothing under `--plain`. */
function align8(ctx: EmitContext): string {
  return ctx.opts.optimizeAttributes ? ", align 8" : "";
}

// ---- Header access ------------------------------------------------------------------

/** Address of header field `index` (0 len, 1 cap, 2 data). */
function fieldPointer(ctx: EmitContext, arr: string, index: 0 | 1 | 2): string {
  return ctx.fn.emitValue(`getelementptr inbounds ${HEADER}, ${HEADER_PTR} ${arr}, i64 0, i32 ${index}`);
}

function loadLength(ctx: EmitContext, arr: string): string {
  return ctx.fn.emitValue(`load i64, i64* ${fieldPointer(ctx, arr, 0)}${align8(ctx)}`);
}

/** `T*` to element `idx` (an i64 value) of `arr`. */
function elementPointer(ctx: EmitContext, arr: string, elem: StaticType, idx: string): string {
  const ty = llvmType(elem);
  const data = ctx.fn.emitValue(`load i8*, i8** ${fieldPointer(ctx, arr, 2)}${align8(ctx)}`);
  const typed = ctx.fn.emitValue(`bitcast i8* ${data} to ${ty}*`);
  return ctx.fn.emitValue(`getelementptr inbounds ${ty}, ${ty}* ${typed}, i64 ${idx}`);
}

/** Lower a numeric expression and widen it to i64: `sext` from i32, `fptosi` from double (truncates). */
function emitIndex(ctx: EmitContext, expr: ts.Expression): string {
  const type = ctx.typeOf(expr);
  const literal = unwrapParens(expr);
  if (type.kind === "i32" && ts.isNumericLiteral(literal)) return String(Number(literal.text) | 0); // fold `sext i32 C`
  const value = ctx.emitExpression(expr);
  const ty = llvmType(type);
  if (ty === "i64") return value;
  if (ty === "double") return ctx.fn.emitValue(`fptosi double ${value} to i64`);
  return ctx.fn.emitValue(`sext ${ty} ${value} to i64`);
}

/** Convert an i64 length back to the `number` type the checker recorded for `expr`. */
function emitNumberFromI64(ctx: EmitContext, value: string, expr: ts.Expression): string {
  const type = ctx.typeOf(expr);
  if (type.kind === "f64") return ctx.fn.emitValue(`sitofp i64 ${value} to double`);
  return ctx.fn.emitValue(`trunc i64 ${value} to i32`);
}

/** `idx < len` (unsigned) or branch to a cold block that panics and never returns. */
function emitBoundsCheck(ctx: EmitContext, arr: string, idx: string): void {
  if (ctx.opts.uncheckedIndexing) return;
  const fn = ctx.fn;
  const len = loadLength(ctx, arr);
  const inRange = fn.emitValue(`icmp ult i64 ${idx}, ${len}`);
  const failBlock = fn.newBlock("bounds.fail");
  const okBlock = fn.newBlock("bounds.ok");
  fn.emit(`br i1 ${inRange}, label %${okBlock.label}, label %${failBlock.label}`);
  fn.placeBlock(failBlock);
  fn.emit(`call void ${ctx.useRuntime("sts_panic_index")}(i64 ${idx}, i64 ${len})`);
  fn.emit("unreachable");
  fn.placeBlock(okBlock);
}

/**
 * Allocate a header with `len = cap = n`; `data` is stored by `storeData`.
 * Returns the `%struct.sts_array*`: an alloca when `site` is on the stack (WP6).
 */
function emitHeader(ctx: EmitContext, n: string, site: ts.Node): string {
  ctx.declareType(ARRAY_TYPE);
  let arr: string;
  if (ctx.isStackSite(site)) {
    arr = ctx.fn.emitAlloca("arr.hdr", HEADER, 8);
  } else {
    const raw = ctx.fn.emitValue(`call i8* ${ctx.useRuntime("sts_alloc_struct")}(i64 ${HEADER_BYTES})`);
    arr = ctx.fn.emitValue(`bitcast i8* ${raw} to ${HEADER_PTR}`);
  }
  ctx.fn.emit(`store i64 ${n}, i64* ${fieldPointer(ctx, arr, 0)}${align8(ctx)}`);
  ctx.fn.emit(`store i64 ${n}, i64* ${fieldPointer(ctx, arr, 1)}${align8(ctx)}`);
  return arr;
}

/**
 * Element storage as an `i8*`: `[count x T]` on the stack when `site` is a
 * stack allocation (the count is then a literal, see escape.ts), else
 * `bytes` from the arena.
 */
function emitData(ctx: EmitContext, site: ts.Node, elem: StaticType, count: number | undefined, bytes: string): string {
  if (count !== undefined && ctx.isStackSite(site)) {
    const ty = `[${count} x ${llvmType(elem)}]`;
    const slot = ctx.fn.emitAlloca("arr.data", ty, 8);
    return ctx.fn.emitValue(`bitcast ${ty}* ${slot} to i8*`);
  }
  return ctx.fn.emitValue(`call i8* ${ctx.useRuntime("sts_alloc_struct")}(i64 ${bytes})`);
}

function storeData(ctx: EmitContext, arr: string, data: string): void {
  ctx.fn.emit(`store i8* ${data}, i8** ${fieldPointer(ctx, arr, 2)}${align8(ctx)}`);
}

// ---- Construction -------------------------------------------------------------------

/** `[a, b, c]`: elements are evaluated first (left to right), then stored into fresh arena storage. */
const emitArrayLiteral: ExpressionEmitter = (ctx, node) => {
  const expr = node as ts.ArrayLiteralExpression;
  const { elem } = ctx.typeOf(expr) as ArrayType;
  const ty = llvmType(elem);
  const values = expr.elements.map((e) => ctx.emitExpression(e));
  const n = values.length;
  const arr = emitHeader(ctx, String(n), expr);
  const data = n === 0 ? "null" : emitData(ctx, expr, elem, n, String(n * elementSize(elem)));
  storeData(ctx, arr, data);
  if (n > 0) {
    const typed = ctx.fn.emitValue(`bitcast i8* ${data} to ${ty}*`);
    values.forEach((value, i) => {
      const slot = ctx.fn.emitValue(`getelementptr inbounds ${ty}, ${ty}* ${typed}, i64 ${i}`);
      ctx.fn.emit(`store ${ty} ${value}, ${ty}* ${slot}${ctx.alignSuffix(elem)}`);
    });
  }
  return arr;
};

/** `new Array<T>(n)`: `n` zeroed elements. A negative `n` becomes a huge allocation and aborts in the arena. */
newEmitters.Array = (ctx, expr) => {
  const { elem } = ctx.typeOf(expr) as ArrayType;
  const size = elementSize(elem);
  const n = emitIndex(ctx, expr.arguments![0]);
  const arr = emitHeader(ctx, n, expr);
  const bytes = size === 1 ? n : ctx.fn.emitValue(`mul i64 ${n}, ${size}`);
  const count = ctx.isStackSite(expr) ? Number(n) : undefined; // a stack site always has a literal length
  const data = emitData(ctx, expr, elem, count, bytes);
  ctx.declare(`declare void @${MEMSET}(i8* nocapture writeonly, i8, i64, i1 immarg)`);
  const dataArg = ctx.opts.optimizeAttributes ? `i8* align 8 ${data}` : `i8* ${data}`;
  ctx.fn.emit(`call void @${MEMSET}(${dataArg}, i8 0, i64 ${bytes}, i1 false)`);
  storeData(ctx, arr, data);
  return arr;
};

// ---- Element access -------------------------------------------------------------------

const emitElementAccess: ExpressionEmitter = (ctx, node) => {
  const expr = node as ts.ElementAccessExpression;
  const elem = ctx.typeOf(expr);
  ctx.declareType(ARRAY_TYPE);
  const arr = ctx.emitExpression(expr.expression);
  const idx = emitIndex(ctx, expr.argumentExpression);
  emitBoundsCheck(ctx, arr, idx);
  const ty = llvmType(elem);
  return ctx.fn.emitValue(`load ${ty}, ${ty}* ${elementPointer(ctx, arr, elem, idx)}${ctx.alignSuffix(elem)}`);
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
  while (ts.isParenthesizedExpression(expr)) expr = expr.expression;
  return expr;
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
  const arr = ctx.emitExpression(target.expression);
  const idx = emitIndex(ctx, target.argumentExpression);
  const op = expr.operatorToken.kind;
  if (op === ts.SyntaxKind.EqualsToken) {
    const value = ctx.emitExpression(expr.right);
    emitBoundsCheck(ctx, arr, idx);
    ctx.fn.emit(`store ${ty} ${value}, ${ty}* ${elementPointer(ctx, arr, elem, idx)}${ctx.alignSuffix(elem)}`);
    return value;
  }
  emitBoundsCheck(ctx, arr, idx);
  const slot = elementPointer(ctx, arr, elem, idx);
  const old = ctx.fn.emitValue(`load ${ty}, ${ty}* ${slot}${ctx.alignSuffix(elem)}`);
  const rhs = ctx.emitExpression(expr.right);
  const [intOp, floatOp] = COMPOUND_OPCODES[op]!;
  const value =
    elem.kind === "f64" ? ctx.fn.emitValue(`${floatOp} ${ty} ${old}, ${rhs}`) : emitIntBinary(ctx, intOp, ty, old, rhs);
  ctx.fn.emit(`store ${ty} ${value}, ${ty}* ${slot}${ctx.alignSuffix(elem)}`);
  return value;
};

/** Wrap the `=` / `op=` emitters already in `table`; element targets come here, the rest go to the previous handler. */
export function installArrayAssignmentEmitters(table: EmitterTable<BinaryEmitter>): void {
  for (const op of [ts.SyntaxKind.EqualsToken, ...Object.keys(COMPOUND_OPCODES).map(Number)]) {
    const previous = table[op as ts.SyntaxKind];
    if (!previous) continue;
    table[op as ts.SyntaxKind] = (ctx, expr) =>
      ts.isElementAccessExpression(unwrapParens(expr.left)) ? emitElementAssignment(ctx, expr) : previous(ctx, expr);
  }
}

// ---- Members ----------------------------------------------------------------------------

propertyEmitters.array = (ctx, expr) => {
  ctx.declareType(ARRAY_TYPE);
  const arr = ctx.emitExpression(expr.expression);
  return emitNumberFromI64(ctx, loadLength(ctx, arr), expr);
};

/** `a.push(v)`: grow when full (`push.grow`), store at `len` (`push.store`), bump `len`; yields the new length. */
methodCallEmitters.array = (ctx, expr, receiver) => {
  const { elem } = receiver as ArrayType;
  const ty = llvmType(elem);
  const fn = ctx.fn;
  ctx.declareType(ARRAY_TYPE);
  const arr = ctx.emitExpression((expr.expression as ts.PropertyAccessExpression).expression);
  const value = ctx.emitExpression(expr.arguments[0]);
  const lenPtr = fieldPointer(ctx, arr, 0);
  const len = fn.emitValue(`load i64, i64* ${lenPtr}${align8(ctx)}`);
  const cap = fn.emitValue(`load i64, i64* ${fieldPointer(ctx, arr, 1)}${align8(ctx)}`);
  const full = fn.emitValue(`icmp eq i64 ${len}, ${cap}`);
  const growBlock = fn.newBlock("push.grow");
  const storeBlock = fn.newBlock("push.store");
  fn.emit(`br i1 ${full}, label %${growBlock.label}, label %${storeBlock.label}`);
  fn.placeBlock(growBlock);
  fn.emit(`call void ${ctx.useRuntime("sts_array_grow")}(${HEADER_PTR} ${arr}, i64 ${elementSize(elem)})`);
  fn.emit(`br label %${storeBlock.label}`);
  fn.placeBlock(storeBlock);
  fn.emit(`store ${ty} ${value}, ${ty}* ${elementPointer(ctx, arr, elem, len)}${ctx.alignSuffix(elem)}`);
  const newLen = fn.emitValue(`add i64 ${len}, 1`);
  fn.emit(`store i64 ${newLen}, i64* ${lenPtr}${align8(ctx)}`);
  return emitNumberFromI64(ctx, newLen, expr);
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
  const idxSlot = fn.emitAlloca("forof.idx", "i64", ctx.opts.optimizeAttributes ? 8 : undefined);

  const arr = ctx.emitExpression(stmt.expression);
  fn.emit(`store i64 0, i64* ${idxSlot}${align8(ctx)}`);
  fn.emit(`br label %${condBlock.label}`);

  fn.placeBlock(condBlock);
  const idx = fn.emitValue(`load i64, i64* ${idxSlot}${align8(ctx)}`);
  const more = fn.emitValue(`icmp ult i64 ${idx}, ${loadLength(ctx, arr)}`);
  fn.emit(`br i1 ${more}, label %${bodyBlock.label}, label %${endBlock.label}`);

  fn.placeBlock(bodyBlock);
  const value = fn.emitValue(`load ${ty}, ${ty}* ${elementPointer(ctx, arr, elem, idx)}${ctx.alignSuffix(elem)}`);
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

/** `recv.push(...)` on an array receiver. */
export function isPushCall(program: CheckedProgram, node: ts.Node): node is ts.CallExpression {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "push" &&
    isArray(program, node.expression.expression)
  );
}

function isElementAssignment(node: ts.Node): node is ts.BinaryExpression {
  return (
    ts.isBinaryExpression(node) &&
    COMPOUND_OPCODES[node.operatorToken.kind] !== undefined ||
    (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken)
  ) && ts.isElementAccessExpression(unwrapParens((node as ts.BinaryExpression).left));
}

/**
 * What each construct does to memory. Must mirror the emitters above:
 *   - element reads, `.length`, `for...of` and the address computation of a
 *     write load the header (and elements): `readsMemory`;
 *   - a checked `a[i]` may call `sts_panic_index`, which is noreturn, so the
 *     function loses `willreturn` unless `--unchecked-indexing`;
 *   - literals, `new Array`, element writes and `push` store into the arena
 *     (the inline allocator itself is willreturn, so it is folded into the
 *     effect rather than listed as a callee); `push` may call `sts_array_grow`;
 *   - a literal or `new Array` on the stack (WP6) stores into its own allocas
 *     and is no effect at all. Element accesses are still counted even
 *     through a stack local: a `push` may have moved the data into the arena.
 */
const collectArrayFacts: FactCollector = (program, node, facts, opts) => {
  if (ts.isElementAccessExpression(node) && isArray(program, node.expression)) {
    facts.readsMemory = true;
    if (!opts.uncheckedIndexing) facts.callees.add("sts_panic_index");
  } else if (ts.isPropertyAccessExpression(node) && isArray(program, node.expression)) {
    facts.readsMemory = true; // `.length`
  } else if (ts.isForOfStatement(node)) {
    facts.readsMemory = true;
  } else if (ts.isArrayLiteralExpression(node) || (ts.isNewExpression(node) && isArray(program, node))) {
    if (!facts.stackSites.has(node)) facts.effect = "write";
  } else if (isPushCall(program, node)) {
    facts.effect = "write";
    facts.callees.add("sts_array_grow");
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
