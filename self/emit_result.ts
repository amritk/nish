// `Result<T, E>` lowering for stage1 (`src/codegen/emit/result.ts`, WP16),
// checked by `self/result.ts`.
//
// Layout: `%struct.sts_result.<T>.<E> = type { i1, <T>, <E> }`, one
// monomorphisation per pair of payload types, laid out and allocated exactly
// as a class is. `Result<void, E>` has no `value` field at all.
//
//   Ok(v)            `call i8* @sts_alloc_struct(i64 <size>)`, a bitcast, then
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

import { Emitter } from "./emit";
import { ResultLayout, resultLayout } from "./result";
import { N_MEMBER, Node } from "./nodes";
import { CheckedProgram } from "./program";
import { K_ARRAY, K_NULLABLE, K_RESULT, T_BOOL, TypeTable } from "./types";

// ---- Types and addresses --------------------------------------------------

function resultTypeName(layout: ResultLayout): string {
  return `%struct.${layout.name}`;
}

/** `%struct.sts_result.i32.str = type { i1, i32, i8* }`. */
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
function allocateResult(emitter: Emitter, layout: ResultLayout, site: Node | null): string {
  const ty = resultTypeName(layout);
  if (site !== null && emitter.isStackSite(site)) {
    return emitter.fn.emitAlloca(`${layout.name}.obj`, ty, 8);
  }
  const raw = emitter.fn.emitValue(`call i8* ${emitter.useRuntime("sts_alloc_struct")}(i64 ${layout.size})`);
  return emitter.fn.emitValue(`bitcast i8* ${raw} to ${ty}*`);
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
 * are different structs even when the error types agree.
 */
function emitOrReturn(emitter: Emitter, expr: Node, receiver: i32): string {
  const sig = emitter.currentSig;
  if (sig === null) {
    panic("emitter: `orReturn()` outside a function");
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
  const propagated = construct(emitter, returnType, false, error, true, null);
  emitter.emitScopeExit();
  emitter.fn.emit(`ret ${emitter.llvm(returnType)} ${propagated}`);

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
 * `panic(message)` and an out-of-range index have. `sts_exit` is `noreturn`,
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
  emitter.fn.emit(`call void ${emitter.useRuntime("sts_write")}(i8* ${message}, i32 2, i1 true)`);
  emitter.fn.emit(`call void ${emitter.useRuntime("sts_exit")}(i32 1)`);
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
