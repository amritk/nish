// `Result<T, E>` lowering for stage1 (`src/codegen/emit/result.ts`, WP16),
// checked by `self/result.ts`.
//
// Layout: `%struct.amrit_result.<T>.<E> = type { i1, <T>, <E> }`, one
// monomorphisation per pair of payload types, laid out and allocated exactly
// as a class is. `Result<void, E>` has no `value` field at all.
//
//   Ok(v)            `call i8* @amrit_alloc_struct(i64 <size>)`, a bitcast, then
//                    the discriminant store and the payload store. When the
//                    escape analysis proved the site does not outlive the
//                    function it is an entry-block `alloca` and there is no
//                    call at all.
//   Err(e)           the same with `i1 false` and the error payload.
//   r.ok / r.isOk()  gep + `load i1`; `r.isErr()` is that with an `xor`.
//   r.value          gep + `load <T>`; the checker only allows it where `ok`.
//   r.error          gep + `load <E>`; likewise where `!ok`.
//   r.orReturn()     `br i1` on the discriminant: the error arm builds this
//                    function's own `Err(...)`, releases the arena scope and
//                    `ret`s it; the ok arm loads the payload and carries on.
//   r.unwrapOr(d)    `br i1`, the two arms meet in a `phi`; `d` is evaluated
//                    only on the error arm.
//   r.expect(m)      `br i1`; the error arm writes `m` to stderr and exits 1,
//                    the same ending `panic(m)` has, then `unreachable`.
//
// The unused arm of a fresh `Result` is left uninitialised: the checker proves
// no path can read it, and zeroing it would cost a store on every construction
// to make a value nobody may observe.
//
// WP17 adds one thing and changes nothing else: a `Result` whose two payloads
// are each a scalar of at most four bytes is *returned in a register*, packed
// into an `i64` (`TypeTable.resultByValue`; the reasoning and the measured
// assembly are in `docs/wp17-result-abi.md`). The packed word exists only at
// the return boundary —
//
//   callee   `packArm` / `packObject` where it would have allocated, `ret i64`
//   caller   `%w = call i64 @f(...)`, then `unpackResult` into the entry-block
//            object every construct above already reads
//
// — so the layout, the narrowing, the payload accessors and the escape
// analysis are WP16's, unchanged.

import { Emitter } from "./emit";
import { internalError } from "./ice";
import { ResultLayout, resultLayout } from "./result";
import { N_CALL, N_MEMBER, Node } from "./nodes";
import { CheckedProgram } from "./program";
import {
  K_ARRAY,
  K_NULLABLE,
  K_RESULT,
  RESULT_PAYLOAD_SHIFT,
  T_BOOL,
  T_F32,
  T_VOID,
  TypeTable,
} from "./types";

// ---- Types and addresses --------------------------------------------------

function resultTypeName(layout: ResultLayout): string {
  return `%struct.${layout.name}`;
}

/** `%struct.amrit_result.i32.str = type { i1, i32, i8* }`. */
export function resultTypeDecl(table: TypeTable, type: i32): string {
  const layout = resultLayout(table, type);
  const parts: string[] = ["i1"];
  if (layout.hasValue) {
    parts.push(table.llvmType(layout.valueType));
  }
  parts.push(table.llvmType(layout.errorType));
  return `${resultTypeName(layout)} = type { ${parts.join(", ")} }`;
}

/**
 * Make sure every `Result` struct mentioned by `type` is declared in this
 * module. Called from every site that can introduce one — a construction, a
 * member access, a signature — because a `Result` layout is derived from the
 * type rather than declared, so nothing else would put it in the header.
 * Innermost first, exactly as stage0 collects them.
 */
export function declareResultTypes(emitter: Emitter, type: i32): void {
  const kind = emitter.table.kindOf(type);
  if (kind === K_ARRAY || kind === K_NULLABLE) {
    declareResultTypes(emitter, emitter.table.refOf(type));
    return;
  }
  if (kind !== K_RESULT) {
    return;
  }
  declareResultTypes(emitter, emitter.table.okOf(type));
  declareResultTypes(emitter, emitter.table.errOf(type));
  emitter.declareType(resultTypeDecl(emitter.table, type));
}

function slotPointer(emitter: Emitter, layout: ResultLayout, receiver: string, index: i32): string {
  const ty = resultTypeName(layout);
  return emitter.fn.emitValue(`getelementptr inbounds ${ty}, ${ty}* ${receiver}, i32 0, i32 ${index}`);
}

function loadSlot(emitter: Emitter, layout: ResultLayout, receiver: string, index: i32, type: i32): string {
  const ty = emitter.llvm(type);
  const ptr = slotPointer(emitter, layout, receiver, index);
  return emitter.fn.emitValue(`load ${ty}, ${ty}* ${ptr}${emitter.alignSuffix(type)}`);
}

function storeSlot(
  emitter: Emitter,
  layout: ResultLayout,
  receiver: string,
  index: i32,
  type: i32,
  value: string
): void {
  const ty = emitter.llvm(type);
  const ptr = slotPointer(emitter, layout, receiver, index);
  emitter.fn.emit(`store ${ty} ${value}, ${ty}* ${ptr}${emitter.alignSuffix(type)}`);
}

/** The discriminant: a `boolean` field, so one byte at offset 0. */
function loadOk(emitter: Emitter, layout: ResultLayout, receiver: string): string {
  return loadSlot(emitter, layout, receiver, layout.okIndex, T_BOOL);
}

/**
 * Storage for one `Result`: an entry-block alloca when the escape analysis
 * proved this site does not outlive the function, else an arena bump. A site
 * of -1 is the `Result` that `orReturn` builds, which is returned by
 * construction and therefore always arena memory.
 */
function allocateResultIn(emitter: Emitter, layout: ResultLayout, stack: boolean): string {
  const ty = resultTypeName(layout);
  if (stack) {
    return emitter.fn.emitAlloca(`${layout.name}.obj`, ty, 8);
  }
  const raw = emitter.fn.emitValue(`call i8* ${emitter.useRuntime("amrit_alloc_struct")}(i64 ${layout.size})`);
  return emitter.fn.emitValue(`bitcast i8* ${raw} to ${ty}*`);
}

function allocateResult(emitter: Emitter, layout: ResultLayout, site: Node | null): string {
  return allocateResultIn(emitter, layout, site !== null && emitter.isStackSite(site));
}

function construct(
  emitter: Emitter,
  type: i32,
  isOk: boolean,
  payload: string,
  hasPayload: boolean,
  site: Node | null
): string {
  declareResultTypes(emitter, type);
  const layout = resultLayout(emitter.table, type);
  const object = allocateResult(emitter, layout, site);
  const flag = isOk ? "true" : "false";
  storeSlot(emitter, layout, object, layout.okIndex, T_BOOL, flag);
  if (hasPayload) {
    const index = isOk ? layout.valueIndex : layout.errorIndex;
    const slotType = isOk ? layout.valueType : layout.errorType;
    storeSlot(emitter, layout, object, index, slotType, payload);
  }
  return object;
}

// ---- `Ok(...)` and `Err(...)` ---------------------------------------------

/** True for the builtin `Ok(...)` / `Err(...)` rather than a user function of that name. */
export function isResultConstructorCall(program: CheckedProgram, table: TypeTable, call: Node): boolean {
  const callee = call.children[0];
  if (program.nodeCallees[call.id] !== null) {
    return false;
  }
  if (callee.text !== "Ok" && callee.text !== "Err") {
    return false;
  }
  return table.isResult(program.nodeTypes[call.id]);
}

export function emitResultConstructor(emitter: Emitter, expr: Node, name: string): string {
  const type = emitter.typeOf(expr);
  const args = expr.children[1];
  // `Ok()` on a `Result<void, E>` carries nothing; the checker enforced the arity.
  const hasPayload = args.children.length > 0;
  const payload = hasPayload ? emitter.emitExpression(args.children[0]) : "";
  return construct(emitter, type, name === "Ok", payload, hasPayload, expr);
}

// ---- The packed by-value word (WP17) --------------------------------------

/**
 * Widen one payload to the high half of the word. `f32` goes through a
 * bitcast rather than a conversion: the word carries the bits the caller
 * stored, not a number the ABI is free to round.
 *
 * The word is assembled with `shl`/`or` rather than coerced through a two-word
 * alloca the way clang lowers an eight-byte struct return. Both were measured
 * on `bench/result` and `llc` produces the same instructions from either, so
 * the shorter IR wins (`docs/wp17-result-abi.md` §4).
 */
function payloadToWord(emitter: Emitter, type: i32, value: string): string {
  if (emitter.table.kindOf(type) === T_VOID) {
    return "0";
  }
  const isF32 = emitter.table.kindOf(type) === T_F32;
  const bits = isF32 ? emitter.fn.emitValue(`bitcast float ${value} to i32`) : value;
  const from = isF32 ? "i32" : emitter.llvm(type);
  if (from === "i64") {
    return bits;
  }
  return emitter.fn.emitValue(`zext ${from} ${bits} to i64`);
}

/** The inverse: the low bits of the high half, read back as the payload type. */
function wordToPayload(emitter: Emitter, type: i32, high: string): string {
  const isF32 = emitter.table.kindOf(type) === T_F32;
  const to = isF32 ? "i32" : emitter.llvm(type);
  const bits = to === "i64" ? high : emitter.fn.emitValue(`trunc i64 ${high} to ${to}`);
  if (isF32) {
    return emitter.fn.emitValue(`bitcast i32 ${bits} to float`);
  }
  return bits;
}

/**
 * The word for an arm that is being built here and now — `return Ok(v)` and
 * the `Err(...)` `orReturn()` propagates. No object is constructed at all,
 * which is the whole point: the ok path of a small `Result` costs a shift.
 *
 * The tag is the low half, so `Err(e)` needs no `or` (its tag is zero) and
 * `Ok()` on a `Result<void, E>` is the constant `1`.
 */
function packArm(emitter: Emitter, type: i32, isOk: boolean, payload: string, hasPayload: boolean): string {
  const payloadType = isOk ? emitter.table.okOf(type) : emitter.table.errOf(type);
  if (!hasPayload || emitter.table.kindOf(payloadType) === T_VOID) {
    return isOk ? "1" : "0";
  }
  const wide = payloadToWord(emitter, payloadType, payload);
  const shifted = emitter.fn.emitValue(`shl i64 ${wide}, ${RESULT_PAYLOAD_SHIFT}`);
  if (!isOk) {
    return shifted;
  }
  return emitter.fn.emitValue(`or i64 ${shifted}, 1`);
}

/**
 * The word for a `Result` that already exists in memory — `return r` where
 * `r` is a variable. Both arms are loaded and a `select` keeps the live one:
 * the dead arm is `undef` in an alloca and a stale byte in the arena, and
 * `select` discards it either way, which is cheaper than a branch.
 */
function packObject(emitter: Emitter, type: i32, object: string): string {
  const layout = resultLayout(emitter.table, type);
  const ok = loadOk(emitter, layout, object);
  const error = payloadToWord(
    emitter,
    layout.errorType,
    loadSlot(emitter, layout, object, layout.errorIndex, layout.errorType)
  );
  let payload = error;
  if (layout.hasValue) {
    const value = payloadToWord(
      emitter,
      layout.valueType,
      loadSlot(emitter, layout, object, layout.valueIndex, layout.valueType)
    );
    payload = emitter.fn.emitValue(`select i1 ${ok}, i64 ${value}, i64 ${error}`);
  }
  const shifted = emitter.fn.emitValue(`shl i64 ${payload}, ${RESULT_PAYLOAD_SHIFT}`);
  const tag = emitter.fn.emitValue(`zext i1 ${ok} to i64`);
  return emitter.fn.emitValue(`or i64 ${shifted}, ${tag}`);
}

/**
 * The word to hand across a call boundary — what a `Result`-returning
 * function `ret`s, and what a by-value `Result` argument is passed as. A
 * construction is packed without ever being built (`packArm`); anything else
 * is emitted as WP16's pointer and read back out of it. At a `return` this
 * runs before the arena scope is released, because the object it may be read
 * out of is arena memory the release reclaims.
 */
export function emitPackedResult(emitter: Emitter, expr: Node, type: i32): string {
  declareResultTypes(emitter, type);
  if (expr.kind === N_CALL && isResultConstructorCall(emitter.program, emitter.table, expr)) {
    const args = expr.children[1];
    const hasPayload = args.children.length > 0;
    const payload = hasPayload ? emitter.emitExpression(args.children[0]) : "";
    return packArm(emitter, type, expr.children[0].text === "Ok", payload, hasPayload);
  }
  return packObject(emitter, type, emitter.emitExpression(expr));
}

/**
 * The caller's half: materialise the word as the object every other construct
 * reads. `site` is the call, which the escape analysis records as an ordinary
 * allocation site of the *caller* — so this is an entry-block `alloca` unless
 * the `Result` is handed on to something that keeps the pointer, and SROA
 * folds the alloca, the stores and the shifts away once the call is inlined.
 *
 * Both payload slots get the same bits. Only the arm the discriminant selects
 * may be read (the checker proves it), so the copy in the dead slot is never
 * observed, and writing it unconditionally costs less than a branch.
 *
 * The same function serves a `Result` *parameter* (WP17): the word arrives in
 * a register and the callee builds the object once, in its prologue, with
 * `stack` from `stackParams` rather than from a call site.
 */
export function unpackResult(emitter: Emitter, type: i32, word: string, stack: boolean): string {
  declareResultTypes(emitter, type);
  const layout = resultLayout(emitter.table, type);
  const object = allocateResultIn(emitter, layout, stack);
  const ok = emitter.fn.emitValue(`trunc i64 ${word} to i1`);
  storeSlot(emitter, layout, object, layout.okIndex, T_BOOL, ok);
  const high = emitter.fn.emitValue(`lshr i64 ${word}, ${RESULT_PAYLOAD_SHIFT}`);
  let value = "";
  if (layout.hasValue) {
    value = wordToPayload(emitter, layout.valueType, high);
    storeSlot(emitter, layout, object, layout.valueIndex, layout.valueType, value);
  }
  // The two arms share the narrowing when they narrow to the same LLVM type,
  // which is the common `Result<i32, i32>` shape.
  const sameShape =
    layout.hasValue && emitter.llvm(layout.valueType) === emitter.llvm(layout.errorType);
  const error = sameShape ? value : wordToPayload(emitter, layout.errorType, high);
  storeSlot(emitter, layout, object, layout.errorIndex, layout.errorType, error);
  return object;
}

/**
 * Wrap a call that answers a by-value `Result`: the call itself, then the
 * unpack. The finished `call` text is handed in, because who builds the
 * operand list differs between a plain call and a method call.
 */
export function emitResultReturningCall(emitter: Emitter, call: string, type: i32, site: Node): string {
  const word = emitter.fn.emitValue(call);
  return unpackResult(emitter, type, word, emitter.isStackSite(site));
}

// ---- `r.ok` / `r.value` / `r.error` ---------------------------------------

export function emitResultProperty(emitter: Emitter, expr: Node, receiver: i32): string {
  declareResultTypes(emitter, receiver);
  const layout = resultLayout(emitter.table, receiver);
  const object = emitter.emitExpression(expr.children[0]);
  if (expr.text === "ok") {
    return loadOk(emitter, layout, object);
  }
  if (expr.text === "value") {
    return loadSlot(emitter, layout, object, layout.valueIndex, layout.valueType);
  }
  return loadSlot(emitter, layout, object, layout.errorIndex, layout.errorType);
}

// ---- The methods ----------------------------------------------------------

/**
 * `r.orReturn()`: Rust's `?`. The error arm is an early `return Err(r.error)`
 * of *this* function's `Result` type, so the payload is copied into a fresh
 * object rather than the callee's being handed on — the two monomorphisations
 * are different structs even when the error types agree. When this function
 * returns by value (WP17) there is no object at all: the propagated error is
 * packed into the word and `ret`urned, so propagation costs a shift.
 */
function emitOrReturn(emitter: Emitter, expr: Node, receiver: i32): string {
  const sig = emitter.currentSig;
  if (sig === null) {
    process.exit(internalError("emitter: `orReturn()` outside a function"));
  }
  const returnType = sig.returnType;
  declareResultTypes(emitter, receiver);
  declareResultTypes(emitter, returnType);
  const layout = resultLayout(emitter.table, receiver);
  const access = expr.children[0];
  const object = emitter.emitExpression(access.children[0]);
  const okBlock = emitter.fn.newBlock("res.ok");
  const errBlock = emitter.fn.newBlock("res.propagate");
  const flag = loadOk(emitter, layout, object);
  emitter.fn.emit(`br i1 ${flag}, label %${okBlock.label}, label %${errBlock.label}`);

  emitter.fn.placeBlock(errBlock);
  const error = loadSlot(emitter, layout, object, layout.errorIndex, layout.errorType);
  if (emitter.table.resultByValue(returnType)) {
    const word = packArm(emitter, returnType, false, error, true);
    emitter.emitScopeExit();
    emitter.fn.emit(`ret i64 ${word}`);
  } else {
    const propagated = construct(emitter, returnType, false, error, true, null);
    emitter.emitScopeExit();
    emitter.fn.emit(`ret ${emitter.llvm(returnType)} ${propagated}`);
  }

  emitter.fn.placeBlock(okBlock);
  if (!layout.hasValue) {
    return "void";
  }
  return loadSlot(emitter, layout, object, layout.valueIndex, layout.valueType);
}

/** `r.unwrapOr(d)`: the fallback is evaluated only where it is needed. */
function emitUnwrapOr(emitter: Emitter, expr: Node, receiver: i32): string {
  declareResultTypes(emitter, receiver);
  const layout = resultLayout(emitter.table, receiver);
  const access = expr.children[0];
  const object = emitter.emitExpression(access.children[0]);
  const endBlock = emitter.fn.newBlock("res.end");
  const okBlock = emitter.fn.newBlock("res.ok");
  const errBlock = emitter.fn.newBlock("res.alt");
  const flag = loadOk(emitter, layout, object);
  emitter.fn.emit(`br i1 ${flag}, label %${okBlock.label}, label %${errBlock.label}`);

  emitter.fn.placeBlock(okBlock);
  const value = loadSlot(emitter, layout, object, layout.valueIndex, layout.valueType);
  const okEdge = emitter.fn.currentBlock().label;
  emitter.fn.emit(`br label %${endBlock.label}`);

  emitter.fn.placeBlock(errBlock);
  const fallback = emitter.emitExpression(expr.children[1].children[0]);
  const errEdge = emitter.fn.currentBlock().label;
  emitter.fn.emit(`br label %${endBlock.label}`);

  emitter.fn.placeBlock(endBlock);
  const ty = emitter.llvm(layout.valueType);
  return emitter.fn.emitValue(`phi ${ty} [ ${value}, %${okEdge} ], [ ${fallback}, %${errEdge} ]`);
}

/**
 * `r.expect(message)`: the message on stderr and exit 1, the same ending
 * `panic(message)` and an out-of-range index have. `amrit_exit` is `noreturn`,
 * which is what makes the `unreachable` legal.
 */
function emitExpect(emitter: Emitter, expr: Node, receiver: i32): string {
  declareResultTypes(emitter, receiver);
  const layout = resultLayout(emitter.table, receiver);
  const access = expr.children[0];
  const object = emitter.emitExpression(access.children[0]);
  const okBlock = emitter.fn.newBlock("res.ok");
  const errBlock = emitter.fn.newBlock("res.panic");
  const flag = loadOk(emitter, layout, object);
  emitter.fn.emit(`br i1 ${flag}, label %${okBlock.label}, label %${errBlock.label}`);

  emitter.fn.placeBlock(errBlock);
  const message = emitter.emitExpression(expr.children[1].children[0]);
  emitter.fn.emit(`call void ${emitter.useRuntime("amrit_write")}(i8* ${message}, i32 2, i1 true)`);
  emitter.fn.emit(`call void ${emitter.useRuntime("amrit_exit")}(i32 1)`);
  emitter.fn.emit("unreachable");

  emitter.fn.placeBlock(okBlock);
  if (!layout.hasValue) {
    return "void";
  }
  return loadSlot(emitter, layout, object, layout.valueIndex, layout.valueType);
}

/** `r.isOk()` / `r.isErr()`: the discriminant, inverted for `isErr`. */
function emitDiscriminantTest(emitter: Emitter, expr: Node, receiver: i32, positive: boolean): string {
  declareResultTypes(emitter, receiver);
  const layout = resultLayout(emitter.table, receiver);
  const access = expr.children[0];
  const flag = loadOk(emitter, layout, emitter.emitExpression(access.children[0]));
  if (positive) {
    return flag;
  }
  return emitter.fn.emitValue(`xor i1 ${flag}, true`);
}

export function emitResultMethod(emitter: Emitter, expr: Node, receiver: i32): string {
  const access = expr.children[0];
  const name = access.text;
  if (name === "isOk" || name === "isErr") {
    return emitDiscriminantTest(emitter, expr, receiver, name === "isOk");
  }
  if (name === "orReturn") {
    return emitOrReturn(emitter, expr, receiver);
  }
  if (name === "unwrapOr") {
    return emitUnwrapOr(emitter, expr, receiver);
  }
  return emitExpect(emitter, expr, receiver);
}

/** The `Result` method a call invokes, or "" for anything else. */
export function resultMethodName(program: CheckedProgram, table: TypeTable, call: Node): string {
  const access = call.children[0];
  if (access.kind !== N_MEMBER) {
    return "";
  }
  if (!table.isResult(program.nodeTypes[access.children[0].id])) {
    return "";
  }
  const name = access.text;
  if (
    name === "isOk" ||
    name === "isErr" ||
    name === "orReturn" ||
    name === "unwrapOr" ||
    name === "expect"
  ) {
    return name;
  }
  return "";
}
