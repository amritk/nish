// Constants, operators and assignment for stage1 (`src/codegen/emit/
// arithmetic.ts`, `bitwise.ts` and the operator half of `emit/expressions.ts`;
// docs/wp14-selfhost.md milestone S4).
//
// Two rules from `src/` that this file is the whole of:
//
//   - **Signedness lives in the opcode.** LLVM has no unsigned types, so
//     `u8`..`u64` are `i8`..`i64` and `signedOpcode` swaps `sdiv`/`srem`/
//     `icmp s*`/`ashr` for their unsigned forms. `add`, `sub` and `mul` are
//     the same instruction for both, which is why an unsigned type costs
//     nothing to represent.
//   - **Division follows Rust, not C.** `a / b` and `a % b` check the divisor
//     first and panic instead of executing a division LLVM defines as poison.
//     The signed check tests a zero divisor *and* `MIN / -1`; unsigned
//     division has no overflow case, so one compare decides.
//
// Shift counts are masked to the operand width, because LLVM makes an
// over-wide shift poison and JavaScript wraps the count. A literal count is
// masked here at compile time, so the common `x << 3` stays one instruction.

import { internalError } from "./ice";
import { parseIntegerLiteral } from "./constants";
import { Emitter } from "./emit";
import { emitCompoundAssignment, emitIncDec, emitLogical } from "./emit_control";
import { emitElementAssignment } from "./emit_arrays";
import { emitFieldAssignment } from "./emit_classes";
import { emitConcat, emitStrictEquality } from "./emit_strings";
import { N_INDEX, N_MEMBER, N_NUMBER, N_PAREN, N_UNARY, Node } from "./nodes";
import { ConstInfo } from "./program";
import { f32Hex, f64Hex } from "./strings";
import { Local } from "./symbols";
import { intBits, isFloat, isInteger, isUnsigned, T_BOOL, T_F32, T_I32, T_STRING } from "./types";

// ---- Constants --------------------------------------------------------------------

/**
 * The LLVM constant for a float literal at either width. LLVM only accepts
 * decimal float literals that round-trip exactly, so the IEEE-754 bit pattern
 * is emitted instead; an `f32` is written with the hex of the *double* it
 * equals, rounded through `toF32` so that double is exactly a float.
 */
export const floatText = (value: f64, type: i32): string => {
  return type === T_F32 ? f32Hex(value) : f64Hex(value);
};

/**
 * A numeric literal as LLVM writes it. `i32` truncates to 32 bits, which is
 * what makes `-2147483648` spell `INT_MIN`; the wider integers are exact as
 * written, because the checker proved the literal fits.
 */
export const numericConstant = (text: string, type: i32): string => {
  if (isInteger(type)) {
    const value = parseIntegerLiteral(text);
    return type === T_I32 ? `${toI32(value)}` : `${value}`;
  }
  return floatText(Number(text), type);
};

/** The LLVM constant for a folded module constant, by the type it was declared with. */
export const constantText = (emitter: Emitter, info: ConstInfo): string => {
  if (info.type === T_BOOL) {
    return info.intValue === toI64(0) ? "false" : "true";
  }
  if (info.type === T_STRING) {
    return emitter.stringConstant(info.textValue);
  }
  if (isFloat(info.type)) {
    return floatText(info.floatValue, info.type);
  }
  return `${info.intValue}`;
};

// ---- Integer arithmetic -----------------------------------------------------------

/**
 * The instruction for `add` / `sub` / `mul`, which carries `nsw` by default
 * (WP15 §3): signed overflow becomes poison (C semantics) instead of
 * wrapping, and `--wrapping` turns that back off.
 *
 * An unsigned type never gets a flag in either mode. `u8`/`u16`/`u32`/`u64`
 * are defined as wrapping, which is what hashing and bit-packing are written
 * against, so `nuw` would be a claim the language does not make; and `nsw` on
 * an unsigned value that has merely passed 2^31 would poison an ordinary
 * result. The proof under the attribute is "the checker recorded a signed
 * type", and `isUnsigned` is where that proof is read.
 */
export const intOpcode = (emitter: Emitter, opcode: string, type: i32): string => {
  if (!emitter.opts.nsw || isUnsigned(type)) {
    return opcode;
  }
  if (opcode !== "add" && opcode !== "sub" && opcode !== "mul") {
    return opcode;
  }
  return `${opcode} nsw`;
};

/**
 * The unsigned instruction that means on an unsigned type what the signed one
 * means on a signed type. Anything absent (`add`, `sub`, `mul`, `icmp eq`,
 * `icmp ne`, the bitwise ops) is bit-identical for both signednesses.
 */
export const signedOpcode = (opcode: string, type: i32): string => {
  if (!isUnsigned(type)) {
    return opcode;
  }
  if (opcode === "sdiv") {
    return "udiv";
  }
  if (opcode === "srem") {
    return "urem";
  }
  if (opcode === "ashr") {
    return "lshr";
  }
  if (opcode === "icmp slt") {
    return "icmp ult";
  }
  if (opcode === "icmp sle") {
    return "icmp ule";
  }
  if (opcode === "icmp sgt") {
    return "icmp ugt";
  }
  if (opcode === "icmp sge") {
    return "icmp uge";
  }
  return opcode;
};

const isDivision = (opcode: string): boolean => {
  return opcode === "sdiv" || opcode === "srem" || opcode === "udiv" || opcode === "urem";
};

/** `INT_MIN` at the width `ty` names, for the signed division overflow check. */
const intMin = (ty: string): string => {
  return ty === "i32" ? "-2147483648" : "-9223372036854775808";
};

/**
 * `<opcode> <ty> lhs, rhs` for an integer type, with the checked division
 * described above. `opcode` is the *signed* spelling; the unsigned form is
 * selected from `type`, so every caller names one opcode per operator.
 */
export const emitIntBinary = (emitter: Emitter, opcode: string, type: i32, lhs: string, rhs: string): string => {
  const ty = emitter.llvm(type);
  const op = signedOpcode(opcode, type);
  const fn = emitter.fn;
  if (!isDivision(op)) {
    return fn.emitValue(`${intOpcode(emitter, op, type)} ${ty} ${lhs}, ${rhs}`);
  }
  const byZero = fn.emitValue(`icmp eq ${ty} ${rhs}, 0`);
  // Unsigned division cannot overflow: there is no value whose negation is out
  // of range, so `MIN / -1` has no unsigned counterpart and one compare decides.
  let bad = byZero;
  if (!isUnsigned(type)) {
    const minLhs = fn.emitValue(`icmp eq ${ty} ${lhs}, ${intMin(ty)}`);
    const negOne = fn.emitValue(`icmp eq ${ty} ${rhs}, -1`);
    const overflow = fn.emitValue(`and i1 ${minLhs}, ${negOne}`);
    bad = fn.emitValue(`or i1 ${byZero}, ${overflow}`);
  }
  const failBlock = fn.newBlock("div.fail");
  const okBlock = fn.newBlock("div.ok");
  fn.emit(`br i1 ${bad}, label %${failBlock.label}, label %${okBlock.label}`);
  fn.placeBlock(failBlock);
  fn.emit(`call void ${emitter.useRuntime("nish_panic_div")}(i1 zeroext ${byZero})`);
  fn.emit("unreachable");
  fn.placeBlock(okBlock);
  return fn.emitValue(`${op} ${ty} ${lhs}, ${rhs}`);
};

// ---- Operator tables --------------------------------------------------------------

/** The integer opcode for an arithmetic or comparison operator, in its signed spelling. */
const integerOpcode = (op: string): string => {
  if (op === "+") {
    return "add";
  }
  if (op === "-") {
    return "sub";
  }
  if (op === "*") {
    return "mul";
  }
  if (op === "/") {
    return "sdiv";
  }
  if (op === "%") {
    return "srem";
  }
  if (op === "<") {
    return "icmp slt";
  }
  if (op === "<=") {
    return "icmp sle";
  }
  if (op === ">") {
    return "icmp sgt";
  }
  if (op === ">=") {
    return "icmp sge";
  }
  if (op === "===") {
    return "icmp eq";
  }
  if (op === "!==") {
    return "icmp ne";
  }
  process.exit(internalError(`emitter: unexpected binary operator \`${op}\``));
};

/** The floating-point opcode for the same operator. */
export const floatOpcode = (op: string): string => {
  if (op === "+") {
    return "fadd";
  }
  if (op === "-") {
    return "fsub";
  }
  if (op === "*") {
    return "fmul";
  }
  if (op === "/") {
    return "fdiv";
  }
  if (op === "%") {
    return "frem";
  }
  if (op === "<") {
    return "fcmp olt";
  }
  if (op === "<=") {
    return "fcmp ole";
  }
  if (op === ">") {
    return "fcmp ogt";
  }
  if (op === ">=") {
    return "fcmp oge";
  }
  if (op === "===") {
    return "fcmp oeq";
  }
  if (op === "!==") {
    return "fcmp une";
  }
  process.exit(internalError(`emitter: unexpected binary operator \`${op}\``));
};

/** The bitwise opcode for `& | ^ << >> >>>` and their compound forms. */
const bitwiseOpcode = (op: string): string => {
  if (op === "&" || op === "&=") {
    return "and";
  }
  if (op === "|" || op === "|=") {
    return "or";
  }
  if (op === "^" || op === "^=") {
    return "xor";
  }
  if (op === "<<" || op === "<<=") {
    return "shl";
  }
  if (op === ">>" || op === ">>=") {
    return "ashr";
  }
  if (op === ">>>" || op === ">>>=") {
    return "lshr";
  }
  return "";
};

/**
 * `>>` is the one operator whose opcode depends on the operand's signedness:
 * sign-filling on `i32`/`i64`, zero-filling on the unsigned widths, which
 * makes `>>` and `>>>` the same instruction there.
 */
const shiftOpcodeFor = (opcode: string, type: i32): string => {
  return opcode === "ashr" && isUnsigned(type) ? "lshr" : opcode;
};

const isShiftOpcode = (opcode: string): boolean => {
  return opcode === "shl" || opcode === "ashr" || opcode === "lshr";
};

/**
 * The value of a shift count the compiler can already see: an integer
 * literal, possibly parenthesised or negated. `found` is false for anything
 * else, which is what makes the emitter fall back to an `and` instruction.
 */
class ConstantCount {
  found: boolean;
  value: i64;

  constructor(found: boolean, value: i64) {
    this.found = found;
    this.value = value;
  }
}

const constantCount = (expr: Node): ConstantCount => {
  let inner = expr;
  let negative = false;
  for (;;) {
    if (inner.kind === N_PAREN) {
      inner = inner.children[0];
    } else if (inner.kind === N_UNARY && inner.text === "-") {
      negative = !negative;
      inner = inner.children[0];
    } else {
      break;
    }
  }
  if (inner.kind !== N_NUMBER) {
    return new ConstantCount(false, toI64(0));
  }
  const value = parseIntegerLiteral(inner.text);
  return new ConstantCount(true, negative ? -value : value);
};

/**
 * The masked count as an LLVM value. A literal is masked here (`x << 33`
 * becomes `shl i32 %x, 1`, as in JavaScript); anything else costs one `and`.
 * The count is a value of the shifted type, because LLVM requires both
 * operands of a shift to agree.
 */
const emitShiftCount = (emitter: Emitter, type: i32, count: Node): string => {
  const ty = emitter.llvm(type);
  const mask = toI64(intBits(type) - 1);
  const literal = constantCount(count);
  if (literal.found) {
    return `${literal.value & mask}`;
  }
  return emitter.fn.emitValue(`and ${ty} ${emitter.emitExpression(count)}, ${mask}`);
};

/** The right operand: a masked count for a shift, the plain value for `& | ^`. */
const emitRightOperand = (emitter: Emitter, opcode: string, type: i32, right: Node): string => {
  return isShiftOpcode(opcode) ? emitShiftCount(emitter, type, right) : emitter.emitExpression(right);
};

// ---- Binary expressions ------------------------------------------------------------

/** Every operator that reads both operands and writes neither. */
export const emitBinary = (emitter: Emitter, expr: Node): string => {
  const op = expr.text;
  if (op === "&&" || op === "||") {
    return emitLogical(emitter, expr);
  }
  if (op === "===" || op === "!==") {
    return emitStrictEquality(emitter, expr);
  }
  const type = emitter.typeOf(expr.children[0]);
  if (op === "+" && type === T_STRING) {
    const lhs = emitter.emitExpression(expr.children[0]);
    const rhs = emitter.emitExpression(expr.children[1]);
    return emitConcat(emitter, lhs, rhs);
  }
  if (bitwiseOpcode(op).length > 0) {
    return emitBitwise(emitter, expr, type);
  }
  // Arithmetic and comparison: evaluate left then right (JS order), one instruction.
  const lhs = emitter.emitExpression(expr.children[0]);
  const rhs = emitter.emitExpression(expr.children[1]);
  if (isInteger(type)) {
    return emitIntBinary(emitter, integerOpcode(op), type, lhs, rhs);
  }
  return emitter.fn.emitValue(`${floatOpcode(op)} ${emitter.llvm(type)} ${lhs}, ${rhs}`);
};

/** `a & b` and friends: evaluate left then right (JS order), then one instruction. */
const emitBitwise = (emitter: Emitter, expr: Node, type: i32): string => {
  const opcode = shiftOpcodeFor(bitwiseOpcode(expr.text), type);
  const lhs = emitter.emitExpression(expr.children[0]);
  const rhs = emitRightOperand(emitter, opcode, type, expr.children[1]);
  return emitter.fn.emitValue(`${opcode} ${emitter.llvm(type)} ${lhs}, ${rhs}`);
};

// ---- Unary expressions -------------------------------------------------------------

export const emitUnary = (emitter: Emitter, expr: Node): string => {
  const op = expr.text;
  if (op === "++" || op === "--") {
    return emitIncDec(emitter, expr);
  }
  const operand = expr.children[0];
  if (op === "-") {
    const type = emitter.typeOf(operand);
    const value = emitter.emitExpression(operand);
    const ty = emitter.llvm(type);
    if (isInteger(type)) {
      return emitter.fn.emitValue(`${intOpcode(emitter, "sub", type)} ${ty} 0, ${value}`);
    }
    return emitter.fn.emitValue(`fneg ${ty} ${value}`);
  }
  if (op === "!") {
    return emitter.fn.emitValue(`xor i1 ${emitter.emitExpression(operand)}, true`);
  }
  if (op === "~") {
    // The all-ones constant is spelled `-1` at every width.
    const ty = emitter.llvm(emitter.typeOf(operand));
    return emitter.fn.emitValue(`xor ${ty} ${emitter.emitExpression(operand)}, -1`);
  }
  process.exit(internalError(`emitter: unexpected unary operator \`${op}\``));
};

// ---- Locals ------------------------------------------------------------------------

/** Read a mutable local from its alloca slot. */
export const loadLocal = (emitter: Emitter, local: Local): string => {
  const ty = emitter.llvm(local.type);
  return emitter.fn.emitValue(`load ${ty}, ${ty}* ${emitter.slotOf(local)}${emitter.alignSuffix(local.type)}`);
};

/** Write a mutable local back to its alloca slot. */
export const storeLocal = (emitter: Emitter, local: Local, value: string): void => {
  const ty = emitter.llvm(local.type);
  emitter.fn.emit(`store ${ty} ${value}, ${ty}* ${emitter.slotOf(local)}${emitter.alignSuffix(local.type)}`);
};

/** The local a simple assignment target names. */
export const targetLocal = (emitter: Emitter, target: Node): Local => {
  const local = emitter.program.nodeLocals[target.id];
  if (local !== null) {
    return local;
  }
  process.exit(internalError(`emitter: no binding for the assignment target \`${target.text}\``));
};

// ---- Assignment ---------------------------------------------------------------------

/** `x = e`, `x op= e` and their field and element forms, keyed by the target. */
export const emitAssignment = (emitter: Emitter, expr: Node): string => {
  const target = expr.children[0];
  if (target.kind === N_MEMBER) {
    return emitFieldAssignment(emitter, expr);
  }
  if (target.kind === N_INDEX) {
    return emitElementAssignment(emitter, expr);
  }
  const op = expr.text;
  if (op === "=") {
    // `x = e`: store into the local's slot; the expression's value is `e`.
    const local = targetLocal(emitter, target);
    const ty = emitter.llvm(local.type);
    const value = emitter.emitExpression(expr.children[1]);
    emitter.fn.emit(`store ${ty} ${value}, ${ty}* ${emitter.slotOf(local)}${emitter.alignSuffix(local.type)}`);
    return value;
  }
  if (bitwiseOpcode(op).length > 0) {
    return emitBitwiseAssignment(emitter, expr);
  }
  return emitCompoundAssignment(emitter, expr);
};

/** Whether `op` is one of `&= |= ^= <<= >>= >>>=`, which the field and element emitters ask too. */
export const isBitwiseAssignment = (op: string): boolean => {
  return op.length > 1 && op.endsWith("=") && bitwiseOpcode(op).length > 0;
};

/**
 * The right-hand half of `t op= e` once `old` — whatever the target held — is
 * in hand: evaluate `e` (masked when the opcode is a shift) and apply the
 * operator. A local, a field and an element differ only in how they read `old`
 * and where they store the result, so all three come here and the shift-count
 * mask cannot go missing on one of them.
 */
export const emitBitwiseCombine = (emitter: Emitter, op: string, type: i32, old: string, right: Node): string => {
  const opcode = shiftOpcodeFor(bitwiseOpcode(op), type);
  const rhs = emitRightOperand(emitter, opcode, type, right);
  return emitter.fn.emitValue(`${opcode} ${emitter.llvm(type)} ${old}, ${rhs}`);
};

/** `x &= e`: JS reads `x` before evaluating `e`; the expression's value is what was stored. */
const emitBitwiseAssignment = (emitter: Emitter, expr: Node): string => {
  const local = targetLocal(emitter, expr.children[0]);
  const old = loadLocal(emitter, local);
  const value = emitBitwiseCombine(emitter, expr.text, local.type, old, expr.children[1]);
  storeLocal(emitter, local, value);
  return value;
};

/** The arithmetic behind a compound assignment: `+=` is `+`. */
export const withoutEquals = (op: string): string => {
  return op.substring(0, op.length - 1);
};

/** The integer opcode of a compound arithmetic assignment, in its signed spelling. */
export const compoundIntegerOpcode = (op: string): string => {
  return integerOpcode(withoutEquals(op));
};

/** The floating-point opcode of the same. */
export const compoundFloatOpcode = (op: string): string => {
  return floatOpcode(withoutEquals(op));
};
