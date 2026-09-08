// Array lowering for stage1 (`src/codegen/emit/arrays.ts`,
// docs/wp14-selfhost.md milestone S4).
//
// Layout (ABI, shared with `runtime/runtime.c`'s `struct amrit_array`): an array
// value is a `%struct.amrit_array*` to an arena header
//
//   %struct.amrit_array = type { i64 len, i64 cap, i8* data }
//
// `data` points at `cap` elements of `sizeof(T)` bytes, arena-allocated and
// 8-byte aligned. The lowerings are `src/codegen/emit/arrays.ts`'s: literals
// and `new Array` allocate a header and a block (or two entry-block allocas
// when the escape analysis proved the array does not outlive the function),
// `a[i]` bounds-checks and indexes, and `indexOf` and `join` are emitted
// inline rather than added to `runtime.c`, which has a budget.
//
// The bounds check is `icmp ult i64 %idx, %len` and a branch to a cold block
// that calls `amrit_panic_index` and never returns. Comparing *unsigned* makes a
// negative index fail too.

import { parseIntegerLiteral } from "./constants";
import { Emitter, LoopTarget } from "./emit";
import { compoundFloatOpcode, compoundIntegerOpcode, emitIntBinary } from "./emit_ops";
import { unwrapParens } from "./emit_util";
import { N_NUMBER, Node } from "./nodes";
import { ARRAY_TYPE } from "./runtime";
import { ARRAY_STRUCT, isFloat, isUnsigned, T_F64, T_I32, T_STRING } from "./types";

const HEADER: string = ARRAY_STRUCT;
const HEADER_PTR: string = "%struct.amrit_array*";
const HEADER_BYTES: i32 = 24;
const MEMSET: string = "llvm.memset.p0i8.i64";
const MEMCPY: string = "llvm.memcpy.p0i8.p0i8.i64";

/** Bytes per element. Every value is a scalar or a pointer, so its size is its alignment. */
function elementSize(emitter: Emitter, elem: i32): i32 {
  return emitter.table.alignOf(elem);
}

// ---- Header access ------------------------------------------------------------------

/** Address of header field `index` (0 len, 1 cap, 2 data). */
function headerFieldPointer(emitter: Emitter, arr: string, index: i32): string {
  return emitter.fn.emitValue(
    `getelementptr inbounds ${HEADER}, ${HEADER_PTR} ${arr}, i64 0, i32 ${index}`
  );
}

function loadLength(emitter: Emitter, arr: string): string {
  return emitter.fn.emitValue(`load i64, i64* ${headerFieldPointer(emitter, arr, 0)}${emitter.align8()}`);
}

/** `T*` to element `idx` (an i64 value) of `arr`. */
function elementPointer(emitter: Emitter, arr: string, elem: i32, idx: string): string {
  const ty = emitter.llvm(elem);
  const data = emitter.fn.emitValue(`load i8*, i8** ${headerFieldPointer(emitter, arr, 2)}${emitter.align8()}`);
  const typed = emitter.fn.emitValue(`bitcast i8* ${data} to ${ty}*`);
  return emitter.fn.emitValue(`getelementptr inbounds ${ty}, ${ty}* ${typed}, i64 ${idx}`);
}

/**
 * Lower a numeric expression and widen it to i64: `sext` from a signed
 * integer, `zext` from an unsigned one (which is what keeps a `u32` index
 * above `INT_MAX` from becoming a negative i64 and failing the unsigned bounds
 * compare), `fptosi` from double (truncates).
 */
export function emitIndex(emitter: Emitter, expr: Node): string {
  const type = emitter.typeOf(expr);
  const literal = unwrapParens(expr);
  // Fold the widening of a constant index. The `i32` truncation is the one the
  // checker already allows for; an i64 or unsigned literal is exact as written.
  if (literal.kind === N_NUMBER && !isFloat(type)) {
    const value = parseIntegerLiteral(literal.text);
    return type === T_I32 ? `${toI32(value)}` : `${value}`;
  }
  const value = emitter.emitExpression(expr);
  const ty = emitter.llvm(type);
  if (ty === "i64") {
    return value;
  }
  if (isFloat(type)) {
    return emitter.fn.emitValue(`fptosi ${ty} ${value} to i64`);
  }
  return emitter.fn.emitValue(`${isUnsigned(type) ? "zext" : "sext"} ${ty} ${value} to i64`);
}

/** Convert an i64 length back to the `number` type the checker recorded for `expr`. */
export function emitNumberFromI64(emitter: Emitter, value: string, expr: Node): string {
  if (emitter.typeOf(expr) === T_F64) {
    return emitter.fn.emitValue(`sitofp i64 ${value} to double`);
  }
  return emitter.fn.emitValue(`trunc i64 ${value} to i32`);
}

/**
 * `idx < len` (unsigned) or a branch to a cold block that panics and never
 * returns. `len` is a value rather than an array, so `s.charCodeAt(i)` shares
 * this one check, this one panic and this one message.
 */
export function emitRangeCheck(emitter: Emitter, idx: string, len: string): void {
  if (emitter.opts.uncheckedIndexing) {
    return;
  }
  const fn = emitter.fn;
  const inRange = fn.emitValue(`icmp ult i64 ${idx}, ${len}`);
  const failBlock = fn.newBlock("bounds.fail");
  const okBlock = fn.newBlock("bounds.ok");
  fn.emit(`br i1 ${inRange}, label %${okBlock.label}, label %${failBlock.label}`);
  fn.placeBlock(failBlock);
  fn.emit(`call void ${emitter.useRuntime("amrit_panic_index")}(i64 ${idx}, i64 ${len})`);
  fn.emit("unreachable");
  fn.placeBlock(okBlock);
}

/** The bounds check of `a[i]`: the array's length, then the shared range check. */
function emitBoundsCheck(emitter: Emitter, arr: string, idx: string): void {
  if (emitter.opts.uncheckedIndexing) {
    return;
  }
  emitRangeCheck(emitter, idx, loadLength(emitter, arr));
}

/**
 * Allocate a header with `len = cap = n`; `data` is stored by `storeData`.
 * Answers the `%struct.amrit_array*`: an alloca when `site` is on the stack.
 */
function emitHeader(emitter: Emitter, n: string, site: Node): string {
  emitter.declareType(ARRAY_TYPE);
  let arr = "";
  if (emitter.isStackSite(site)) {
    arr = emitter.fn.emitAlloca("arr.hdr", HEADER, 8);
  } else {
    const raw = emitter.fn.emitValue(
      `call i8* ${emitter.useRuntime("amrit_alloc_struct")}(i64 ${HEADER_BYTES})`
    );
    arr = emitter.fn.emitValue(`bitcast i8* ${raw} to ${HEADER_PTR}`);
  }
  emitter.fn.emit(`store i64 ${n}, i64* ${headerFieldPointer(emitter, arr, 0)}${emitter.align8()}`);
  emitter.fn.emit(`store i64 ${n}, i64* ${headerFieldPointer(emitter, arr, 1)}${emitter.align8()}`);
  return arr;
}

/**
 * Element storage as an `i8*`: `[count x T]` on the stack when `site` is a
 * stack allocation (the count is then a literal), else `bytes` from the arena.
 * A `count` of -1 means the length is not a literal.
 */
function emitData(emitter: Emitter, site: Node, elem: i32, count: i32, bytes: string): string {
  if (count >= 0 && emitter.isStackSite(site)) {
    const ty = `[${count} x ${emitter.llvm(elem)}]`;
    const slot = emitter.fn.emitAlloca("arr.data", ty, 8);
    return emitter.fn.emitValue(`bitcast ${ty}* ${slot} to i8*`);
  }
  return emitter.fn.emitValue(`call i8* ${emitter.useRuntime("amrit_alloc_struct")}(i64 ${bytes})`);
}

function storeData(emitter: Emitter, arr: string, data: string): void {
  emitter.fn.emit(`store i8* ${data}, i8** ${headerFieldPointer(emitter, arr, 2)}${emitter.align8()}`);
}

// ---- Construction -------------------------------------------------------------------

/** `[a, b, c]`: elements are evaluated first (left to right), then stored into fresh storage. */
export function emitArrayLiteral(emitter: Emitter, expr: Node): string {
  const elem = emitter.table.refOf(emitter.typeOf(expr));
  const ty = emitter.llvm(elem);
  const values: string[] = [];
  for (const element of expr.children) {
    values.push(emitter.emitExpression(element));
  }
  const n = values.length;
  const arr = emitHeader(emitter, `${n}`, expr);
  const data = n === 0 ? "null" : emitData(emitter, expr, elem, n, `${n * elementSize(emitter, elem)}`);
  storeData(emitter, arr, data);
  if (n > 0) {
    const typed = emitter.fn.emitValue(`bitcast i8* ${data} to ${ty}*`);
    let i = 0;
    while (i < n) {
      const slot = emitter.fn.emitValue(`getelementptr inbounds ${ty}, ${ty}* ${typed}, i64 ${i}`);
      emitter.fn.emit(`store ${ty} ${values[i]}, ${ty}* ${slot}${emitter.alignSuffix(elem)}`);
      i = i + 1;
    }
  }
  return arr;
}

/**
 * `new Array<T>(n)`: `n` zeroed elements. A negative `n` becomes a huge
 * allocation and aborts in the arena. `new Int32Array(n)` and friends are the
 * same lowering with `T` fixed by the checker.
 */
export function emitNewArray(emitter: Emitter, expr: Node): string {
  const elem = emitter.table.refOf(emitter.typeOf(expr));
  const size = elementSize(emitter, elem);
  const n = emitIndex(emitter, expr.children[2].children[0]);
  const arr = emitHeader(emitter, n, expr);
  const bytes = size === 1 ? n : emitter.fn.emitValue(`mul i64 ${n}, ${size}`);
  // A stack site always has a literal length, so the decimal `n` parses back.
  const count = emitter.isStackSite(expr) ? toI32(Number(n)) : -1;
  const data = emitData(emitter, expr, elem, count, bytes);
  emitter.declare(`declare void @${MEMSET}(i8* nocapture writeonly, i8, i64, i1 immarg)`);
  const dataArg = emitter.opts.optimizeAttributes ? `i8* align 8 ${data}` : `i8* ${data}`;
  emitter.fn.emit(`call void @${MEMSET}(${dataArg}, i8 0, i64 ${bytes}, i1 false)`);
  storeData(emitter, arr, data);
  return arr;
}

// ---- Element access -------------------------------------------------------------------

export function emitElementAccess(emitter: Emitter, expr: Node): string {
  const elem = emitter.typeOf(expr);
  emitter.declareType(ARRAY_TYPE);
  const arr = emitter.emitExpression(expr.children[0]);
  const idx = emitIndex(emitter, expr.children[1]);
  emitBoundsCheck(emitter, arr, idx);
  const ty = emitter.llvm(elem);
  return emitter.fn.emitValue(
    `load ${ty}, ${ty}* ${elementPointer(emitter, arr, elem, idx)}${emitter.alignSuffix(elem)}`
  );
}

/**
 * `a[i] = v`: array, index, value, then the check and the store (the value is
 * the expression's result). `a[i] op= v`: array, index, check, load, value,
 * op, store, matching JavaScript's read-before-right-operand order.
 */
export function emitElementAssignment(emitter: Emitter, expr: Node): string {
  const target = expr.children[0];
  const elem = emitter.typeOf(target);
  const ty = emitter.llvm(elem);
  emitter.declareType(ARRAY_TYPE);
  const arr = emitter.emitExpression(target.children[0]);
  const idx = emitIndex(emitter, target.children[1]);
  if (expr.text === "=") {
    const value = emitter.emitExpression(expr.children[1]);
    emitBoundsCheck(emitter, arr, idx);
    emitter.fn.emit(
      `store ${ty} ${value}, ${ty}* ${elementPointer(emitter, arr, elem, idx)}${emitter.alignSuffix(elem)}`
    );
    return value;
  }
  emitBoundsCheck(emitter, arr, idx);
  const slot = elementPointer(emitter, arr, elem, idx);
  const old = emitter.fn.emitValue(`load ${ty}, ${ty}* ${slot}${emitter.alignSuffix(elem)}`);
  const rhs = emitter.emitExpression(expr.children[1]);
  const value = isFloat(elem)
    ? emitter.fn.emitValue(`${compoundFloatOpcode(expr.text)} ${ty} ${old}, ${rhs}`)
    : emitIntBinary(emitter, compoundIntegerOpcode(expr.text), elem, old, rhs);
  emitter.fn.emit(`store ${ty} ${value}, ${ty}* ${slot}${emitter.alignSuffix(elem)}`);
  return value;
}

// ---- Members ----------------------------------------------------------------------------

/** `a.length`, in the `number` width the checker recorded. */
export function emitArrayLength(emitter: Emitter, expr: Node): string {
  emitter.declareType(ARRAY_TYPE);
  const arr = emitter.emitExpression(expr.children[0]);
  return emitNumberFromI64(emitter, loadLength(emitter, arr), expr);
}

/** The byte length of a runtime string, shared by `join`. */
function stringLength(emitter: Emitter, str: string): string {
  const header = emitter.fn.emitValue(`bitcast i8* ${str} to i64*`);
  return emitter.fn.emitValue(`load i64, i64* ${header}${emitter.align8()}`);
}

/**
 * `===` for an element type: strings compare by content, floats with
 * `fcmp oeq` (so a `NaN` element is never found, as in JavaScript), and
 * everything else — integers, booleans, and the pointers of classes,
 * interfaces and arrays — with `icmp eq`.
 */
function emitElementEquals(emitter: Emitter, elem: i32, a: string, b: string): string {
  if (elem === T_STRING) {
    return emitter.fn.emitValue(
      `call zeroext i1 ${emitter.useRuntime("amrit_str_eq")}(i8* ${a}, i8* ${b})`
    );
  }
  const opcode = isFloat(elem) ? "fcmp oeq" : "icmp eq";
  return emitter.fn.emitValue(`${opcode} ${emitter.llvm(elem)} ${a}, ${b}`);
}

/** `a.push(v)`: grow when full, store at `len`, and answer the new length. */
function emitPush(emitter: Emitter, expr: Node, arr: string, elem: i32): string {
  const ty = emitter.llvm(elem);
  const fn = emitter.fn;
  const value = emitter.emitExpression(expr.children[1].children[0]);
  const lenPtr = headerFieldPointer(emitter, arr, 0);
  const len = fn.emitValue(`load i64, i64* ${lenPtr}${emitter.align8()}`);
  const cap = fn.emitValue(`load i64, i64* ${headerFieldPointer(emitter, arr, 1)}${emitter.align8()}`);
  const full = fn.emitValue(`icmp eq i64 ${len}, ${cap}`);
  const growBlock = fn.newBlock("push.grow");
  const storeBlock = fn.newBlock("push.store");
  fn.emit(`br i1 ${full}, label %${growBlock.label}, label %${storeBlock.label}`);
  fn.placeBlock(growBlock);
  fn.emit(
    `call void ${emitter.useRuntime("amrit_array_grow")}(${HEADER_PTR} ${arr}, i64 ${elementSize(emitter, elem)})`
  );
  fn.emit(`br label %${storeBlock.label}`);
  fn.placeBlock(storeBlock);
  fn.emit(
    `store ${ty} ${value}, ${ty}* ${elementPointer(emitter, arr, elem, len)}${emitter.alignSuffix(elem)}`
  );
  const newLen = fn.emitValue(`add i64 ${len}, 1`);
  fn.emit(`store i64 ${newLen}, i64* ${lenPtr}${emitter.align8()}`);
  return emitNumberFromI64(emitter, newLen, expr);
}

/**
 * `a.pop()`: the last element, with the length decremented. An empty array
 * panics through the same `amrit_panic_index` an index does — reported as
 * `0 >= 0`, which is the access being attempted — because there is no
 * `undefined` to return and no second return type to widen to.
 */
function emitPop(emitter: Emitter, arr: string, elem: i32): string {
  const fn = emitter.fn;
  const lenPtr = headerFieldPointer(emitter, arr, 0);
  const len = fn.emitValue(`load i64, i64* ${lenPtr}${emitter.align8()}`);
  if (!emitter.opts.uncheckedIndexing) {
    const empty = fn.emitValue(`icmp eq i64 ${len}, 0`);
    const failBlock = fn.newBlock("pop.empty");
    const okBlock = fn.newBlock("pop.ok");
    fn.emit(`br i1 ${empty}, label %${failBlock.label}, label %${okBlock.label}`);
    fn.placeBlock(failBlock);
    fn.emit(`call void ${emitter.useRuntime("amrit_panic_index")}(i64 0, i64 0)`);
    fn.emit("unreachable");
    fn.placeBlock(okBlock);
  }
  const last = fn.emitValue(`sub i64 ${len}, 1`);
  fn.emit(`store i64 ${last}, i64* ${lenPtr}${emitter.align8()}`);
  const ty = emitter.llvm(elem);
  return fn.emitValue(
    `load ${ty}, ${ty}* ${elementPointer(emitter, arr, elem, last)}${emitter.alignSuffix(elem)}`
  );
}

/**
 * `a.indexOf(v)`: the first index whose element is `=== v`, or -1. The scan is
 * emitted here rather than in `runtime.c`, which has a budget and would need
 * one search per element type anyway. The loop counts up to `len` and
 * terminates on its own, which is what keeps `willreturn` sound.
 */
function emitArrayIndexOf(emitter: Emitter, expr: Node, arr: string, elem: i32): string {
  const fn = emitter.fn;
  const value = emitter.emitExpression(expr.children[1].children[0]);
  const len = loadLength(emitter, arr);
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
  const ty = emitter.llvm(elem);
  const element = fn.emitValue(
    `load ${ty}, ${ty}* ${elementPointer(emitter, arr, elem, at)}${emitter.alignSuffix(elem)}`
  );
  const hit = emitElementEquals(emitter, elem, element, value);
  fn.emit(`br i1 ${hit}, label %${endBlock.label}, label %${nextBlock.label}`);

  fn.placeBlock(nextBlock);
  const next = fn.emitValue(`add i64 ${at}, 1`);
  fn.emit(`store i64 ${next}, i64* ${slot}, align 8`);
  fn.emit(`br label %${scanBlock.label}`);

  fn.placeBlock(missBlock);
  fn.emit(`br label %${endBlock.label}`);

  fn.placeBlock(endBlock);
  const found = fn.emitValue(`phi i64 [ ${at}, %${testBlock.label} ], [ -1, %${missBlock.label} ]`);
  return emitNumberFromI64(emitter, found, expr);
}

/**
 * `parts.join(sep)` on a `string[]`: one pass over the lengths, one
 * allocation, one `memcpy` per part. Building the same text with `+` in a loop
 * copies everything again per part and never reclaims, which measured 180 MB
 * of peak arena for 88 KB of output (docs/wp14-selfhost.md §3); this is the
 * shape that replaces it.
 *
 * The separator is copied before every part but the first, with the *length*
 * selected rather than the branch taken, so the copy loop stays one block.
 */
function emitJoin(emitter: Emitter, expr: Node, arr: string): string {
  const fn = emitter.fn;
  const args = expr.children[1];
  const sep = args.children.length > 0 ? emitter.emitExpression(args.children[0]) : emitter.stringConstant(",");
  const len = loadLength(emitter, arr);
  const sepLen = stringLength(emitter, sep);
  emitter.declare(
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
  const partPtr = elementPointer(emitter, arr, T_STRING, sumAt);
  const part = fn.emitValue(`load i8*, i8** ${partPtr}${emitter.align8()}`);
  const total = fn.emitValue(`load i64, i64* ${totalSlot}, align 8`);
  const grown = fn.emitValue(`add i64 ${total}, ${stringLength(emitter, part)}`);
  fn.emit(`store i64 ${grown}, i64* ${totalSlot}, align 8`);
  const sumNext = fn.emitValue(`add i64 ${sumAt}, 1`);
  fn.emit(`store i64 ${sumNext}, i64* ${indexSlot}, align 8`);
  fn.emit(`br label %${sumBlock.label}`);

  // One string of exactly that length: the 8-byte header, the bytes, the NUL.
  fn.placeBlock(copyBlock);
  const size = fn.emitValue(`load i64, i64* ${totalSlot}, align 8`);
  const bytes = fn.emitValue(`add i64 ${size}, 9`);
  const out = fn.emitValue(`call i8* ${emitter.useRuntime("amrit_alloc_struct")}(i64 ${bytes})`);
  const outHeader = fn.emitValue(`bitcast i8* ${out} to i64*`);
  fn.emit(`store i64 ${size}, i64* ${outHeader}${emitter.align8()}`);
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
  const itemPtr = elementPointer(emitter, arr, T_STRING, copyAt);
  const item = fn.emitValue(`load i8*, i8** ${itemPtr}${emitter.align8()}`);
  const itemLen = stringLength(emitter, item);
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

export function emitArrayMethodCall(emitter: Emitter, expr: Node, receiver: i32): string {
  const elem = emitter.table.refOf(receiver);
  emitter.declareType(ARRAY_TYPE);
  const arr = emitter.emitExpression(expr.children[0].children[0]);
  const name = expr.children[0].text;
  if (name === "push") {
    return emitPush(emitter, expr, arr, elem);
  }
  if (name === "pop") {
    return emitPop(emitter, arr, elem);
  }
  if (name === "indexOf") {
    return emitArrayIndexOf(emitter, expr, arr, elem);
  }
  return emitJoin(emitter, expr, arr);
}

// ---- `for (const x of a)` ------------------------------------------------------------------

/**
 * The index lives in an i64 alloca (`%forof.idx`, which mem2reg promotes) and
 * the element is copied into the loop variable's slot at the top of the body,
 * so the body reads and writes it like any local. `break` leaves to
 * `forof.end`, `continue` goes to `forof.inc`.
 */
export function emitForOf(emitter: Emitter, stmt: Node): void {
  const decl = stmt.children[0].children[0].children[0];
  const local = emitter.program.nodeLocals[decl.id];
  if (local === null) {
    panic("emitter: a `for...of` variable with no local recorded");
  }
  const elem = local.type;
  const ty = emitter.llvm(elem);
  const fn = emitter.fn;
  emitter.declareType(ARRAY_TYPE);

  const condBlock = fn.newBlock("forof.cond");
  const bodyBlock = fn.newBlock("forof.body");
  const incBlock = fn.newBlock("forof.inc");
  const endBlock = fn.newBlock("forof.end");
  const slot = fn.emitAlloca(`${local.name}.addr`, ty, emitter.align(elem));
  emitter.setSlot(local, slot);
  const debug = emitter.debug;
  if (debug !== null) {
    debug.declareLocal(fn, local, slot, decl); // `-g`
  }
  const idxSlot = fn.emitAlloca("forof.idx", "i64", emitter.opts.optimizeAttributes ? 8 : 0);

  const arr = emitter.emitExpression(stmt.children[1]);
  fn.emit(`store i64 0, i64* ${idxSlot}${emitter.align8()}`);
  fn.emit(`br label %${condBlock.label}`);

  fn.placeBlock(condBlock);
  const idx = fn.emitValue(`load i64, i64* ${idxSlot}${emitter.align8()}`);
  const more = fn.emitValue(`icmp ult i64 ${idx}, ${loadLength(emitter, arr)}`);
  fn.emit(`br i1 ${more}, label %${bodyBlock.label}, label %${endBlock.label}`);

  fn.placeBlock(bodyBlock);
  const value = fn.emitValue(
    `load ${ty}, ${ty}* ${elementPointer(emitter, arr, elem, idx)}${emitter.alignSuffix(elem)}`
  );
  fn.emit(`store ${ty} ${value}, ${ty}* ${slot}${emitter.alignSuffix(elem)}`);
  emitter.loops.push(new LoopTarget(endBlock, incBlock));
  emitter.emitStatement(stmt.children[2]);
  emitter.loops.pop();
  if (!fn.currentBlock().terminated()) {
    fn.emit(`br label %${incBlock.label}`);
  }

  fn.placeBlock(incBlock);
  const current = fn.emitValue(`load i64, i64* ${idxSlot}${emitter.align8()}`);
  const next = fn.emitValue(`add i64 ${current}, 1`);
  fn.emit(`store i64 ${next}, i64* ${idxSlot}${emitter.align8()}`);
  fn.emit(`br label %${condBlock.label}`);

  fn.placeBlock(endBlock);
}
