// Module constants for stage1 (`src/checker/constants.ts`,
// docs/wp14-selfhost.md milestone S3).
//
// A module constant is a name for a value the compiler already knows, not a
// global variable: `const KIND_IF: i32 = 3` emits no symbol and no
// initialiser, and every use lowers to the literal. That keeps the rule that
// a module has no top-level code, and it is what lets `self/nodes.ts` name
// fifty-six node kinds without a load on the checker's hot path.
//
// Folding is lazy and memoised, because an initialiser may name a constant
// imported from a module that has not been checked yet; `folding` is the
// in-progress mark, which is how a cycle is caught. Errors are reported
// against the *declaring* module's source even when an importer triggered the
// fold, so a bad constant is named where it was written.
//
// Integer arithmetic here wraps at the declared width exactly as the emitted
// `add`/`sub`/`mul` do, so folding never changes what a program computes.
// stage0 needs `bigint` and an explicit `wrap` for that; the language's `i64`
// arithmetic already wraps, and the i32 case is one `toI32` round trip.

import { CheckContext } from "./context";
import {
  N_BINARY,
  N_FALSE,
  N_IDENT,
  N_NUMBER,
  N_PAREN,
  N_STRING,
  N_TEMPLATE,
  N_TRUE,
  N_UNARY,
  Node,
} from "./nodes";
import { ConstInfo } from "./program";
import { T_BOOL, T_ERROR, T_F64, T_I32, T_I64, T_STRING } from "./types";

/**
 * A folded value. One class with a type discriminant rather than the
 * four-way union `src/` writes, per §2.1: the field the type selects is the
 * live one, and `bool` lives in `intValue` as 0 or 1.
 */
export class ConstValue {
  type: i32;
  intValue: i64;
  floatValue: f64;
  textValue: string;

  constructor(type: i32) {
    this.type = type;
    this.intValue = toI64(0);
    this.floatValue = 0.0;
    this.textValue = "";
  }
}

function intValue(type: i32, value: i64): ConstValue {
  const out = new ConstValue(type);
  out.intValue = type === T_I32 ? toI64(toI32(value)) : value;
  return out;
}

function floatValue(value: f64): ConstValue {
  const out = new ConstValue(T_F64);
  out.floatValue = value;
  return out;
}

function boolValue(value: boolean): ConstValue {
  const out = new ConstValue(T_BOOL);
  out.intValue = value ? toI64(1) : toI64(0);
  return out;
}

function stringValue(value: string): ConstValue {
  const out = new ConstValue(T_STRING);
  out.textValue = value;
  return out;
}

/** Digits of an integer literal as written: decimal, `0x`, `0b`, `0o`, with `_` separators. */
export function parseIntegerLiteral(text: string): i64 {
  let radix = toI64(10);
  let i = 0;
  if (text.length > 2 && text.charCodeAt(0) === 48) {
    const marker = text.charCodeAt(1);
    if (marker === 120 || marker === 88) {
      radix = toI64(16);
      i = 2;
    } else if (marker === 98 || marker === 66) {
      radix = toI64(2);
      i = 2;
    } else if (marker === 111 || marker === 79) {
      radix = toI64(8);
      i = 2;
    }
  }
  let value = toI64(0);
  while (i < text.length) {
    const c = text.charCodeAt(i);
    if (c !== 95) {
      let digit = -1;
      if (c >= 48 && c <= 57) {
        digit = c - 48;
      } else if (c >= 97 && c <= 102) {
        digit = c - 87;
      } else if (c >= 65 && c <= 70) {
        digit = c - 55;
      }
      if (digit >= 0) {
        value = value * radix + toI64(digit);
      }
    }
    i = i + 1;
  }
  return value;
}

/** Whether a literal as written has a fraction or an exponent, so it is not an integer. */
function isFractional(text: string): boolean {
  if (text.startsWith("0x") || text.startsWith("0X") || text.startsWith("0b") || text.startsWith("0o")) {
    return false;
  }
  let i = 0;
  while (i < text.length) {
    const c = text.charCodeAt(i);
    if (c === 46 || c === 101 || c === 69) {
      return true; // `.`, `e`, `E`
    }
    i = i + 1;
  }
  return false;
}

/** The name a diagnostic gives a folded value's type. */
function valueTypeName(ctx: CheckContext, value: ConstValue): string {
  return ctx.table.typeName(value.type);
}

/** Report against the module that *declared* the constant, not the one folding it. */
function reject(ctx: CheckContext, info: ConstInfo, node: Node, message: string): ConstValue {
  ctx.sink.report(info.origin, node.start, node.end, message);
  return new ConstValue(T_ERROR);
}

/**
 * Fold `info`'s initialiser, once. The result is checked against the
 * annotation, so `expected` below is a hint that gives a bare literal its
 * width — `const N: i64 = 3` is an `i64` three — and never a coercion.
 */
export function foldConstant(ctx: CheckContext, info: ConstInfo): void {
  if (info.folded) {
    return;
  }
  if (info.folding) {
    ctx.sink.report(
      info.origin,
      info.decl.start,
      info.decl.end,
      `Module constant \`${info.name}\` is defined in terms of itself`
    );
    info.folded = true;
    return;
  }
  info.folding = true;
  const initializer = info.decl.children[2];
  const value = fold(ctx, info, initializer, info.type);
  info.folding = false;
  info.folded = true;
  if (value.type === T_ERROR || info.type === T_ERROR) {
    return;
  }
  if (value.type !== info.type) {
    reject(
      ctx,
      info,
      initializer,
      `Module constant \`${info.name}\` is declared ${ctx.table.typeName(info.type)} but its value is ${valueTypeName(ctx, value)}`
    );
    return;
  }
  if (info.type === T_I32 && value.intValue !== toI64(toI32(value.intValue))) {
    reject(
      ctx,
      info,
      initializer,
      `Constant \`${info.name}\` does not fit in ${ctx.table.typeName(info.type)}`
    );
    return;
  }
  info.intValue = value.intValue;
  info.floatValue = value.floatValue;
  info.textValue = value.textValue;
}

function fold(ctx: CheckContext, info: ConstInfo, expr: Node, expected: i32): ConstValue {
  switch (expr.kind) {
    case N_PAREN:
      return fold(ctx, info, expr.children[0], expected);
    case N_STRING:
      return stringValue(expr.text);
    case N_TEMPLATE:
      if (expr.children.length === 1) {
        return stringValue(expr.children[0].text);
      }
      return reject(
        ctx,
        info,
        expr,
        "A module constant's initialiser must be a literal, another constant, or arithmetic over them"
      );
    case N_TRUE:
      return boolValue(true);
    case N_FALSE:
      return boolValue(false);
    case N_NUMBER:
      return foldNumber(ctx, info, expr, expected);
    case N_IDENT:
      return foldIdentifier(ctx, info, expr);
    case N_UNARY:
      return foldUnary(ctx, info, expr, expected);
    case N_BINARY:
      return foldBinary(ctx, info, expr, expected);
    default:
      return reject(
        ctx,
        info,
        expr,
        "A module constant's initialiser must be a literal, another constant, or arithmetic over them"
      );
  }
}

function foldNumber(ctx: CheckContext, info: ConstInfo, expr: Node, expected: i32): ConstValue {
  if (expected === T_F64) {
    return floatValue(Number(expr.text));
  }
  if (isFractional(expr.text)) {
    return reject(
      ctx,
      info,
      expr,
      `Non-integer literal \`${expr.text}\` in a constant of integer type (annotate it \`f64\`)`
    );
  }
  const type = expected === T_I64 ? T_I64 : T_I32;
  const out = new ConstValue(type);
  out.intValue = parseIntegerLiteral(expr.text);
  return out;
}

function foldIdentifier(ctx: CheckContext, info: ConstInfo, expr: Node): ConstValue {
  const scope = info.scope;
  const target: ConstInfo | null = scope === null ? null : scope.constant(expr.text);
  if (target === null) {
    return reject(
      ctx,
      info,
      expr,
      `\`${expr.text}\` is not a module constant, and a module constant's value must be known at compile time`
    );
  }
  foldConstant(ctx, target);
  const value = new ConstValue(target.type);
  value.intValue = target.intValue;
  value.floatValue = target.floatValue;
  value.textValue = target.textValue;
  return value;
}

function foldUnary(ctx: CheckContext, info: ConstInfo, expr: Node, expected: i32): ConstValue {
  const operand = fold(ctx, info, expr.children[0], expected);
  if (operand.type === T_ERROR) {
    return operand;
  }
  if (expr.text === "-") {
    if (operand.type === T_I32 || operand.type === T_I64) {
      return intValue(operand.type, -operand.intValue);
    }
    if (operand.type === T_F64) {
      return floatValue(-operand.floatValue);
    }
  }
  if (expr.text === "!" && operand.type === T_BOOL) {
    return boolValue(operand.intValue === toI64(0));
  }
  return reject(
    ctx,
    info,
    expr,
    `Unsupported unary operator \`${expr.text}\` on ${valueTypeName(ctx, operand)} in a constant`
  );
}

/**
 * Whether an operator answers a boolean whatever its operands are. The
 * checker has the same predicate over a wider set (`==` and `!=` reach it and
 * are refused); the folder never sees those, because the parser turns them
 * down before a constant is folded.
 */
function foldsToBool(op: string): boolean {
  return op === "<" || op === "<=" || op === ">" || op === ">=" || op === "===" || op === "!==";
}

function foldBinary(ctx: CheckContext, info: ConstInfo, expr: Node, expected: i32): ConstValue {
  const op = expr.text;
  const left = expr.children[0];
  const right = expr.children[1];
  // A comparison says nothing about its operands' width, so a bare literal on
  // one side takes it from the other: `KIND === 3` folds with `KIND: i64`.
  const hint = foldsToBool(op) ? -1 : expected;
  let a = new ConstValue(T_ERROR);
  let b = new ConstValue(T_ERROR);
  if (left.kind === N_NUMBER && right.kind !== N_NUMBER) {
    b = fold(ctx, info, right, hint < 0 ? T_I32 : hint);
    a = fold(ctx, info, left, hint < 0 ? b.type : hint);
  } else {
    a = fold(ctx, info, left, hint < 0 ? T_I32 : hint);
    b = fold(ctx, info, right, hint < 0 ? a.type : hint);
  }
  if (a.type === T_ERROR || b.type === T_ERROR) {
    return new ConstValue(T_ERROR);
  }

  if (op === "&&" || op === "||") {
    if (a.type !== T_BOOL || b.type !== T_BOOL) {
      return reject(ctx, info, expr, `Operator \`${op}\` in a constant requires boolean operands`);
    }
    const both = a.intValue !== toI64(0) && b.intValue !== toI64(0);
    const either = a.intValue !== toI64(0) || b.intValue !== toI64(0);
    return boolValue(op === "&&" ? both : either);
  }
  if (a.type !== b.type) {
    return reject(
      ctx,
      info,
      expr,
      `Operator \`${op}\` in a constant requires two operands of the same type, got ${valueTypeName(ctx, a)} and ${valueTypeName(ctx, b)}`
    );
  }
  if (op === "===" || op === "!==") {
    const equal =
      a.type === T_STRING
        ? a.textValue === b.textValue
        : a.type === T_F64
          ? a.floatValue === b.floatValue
          : a.intValue === b.intValue;
    return boolValue(op === "===" ? equal : !equal);
  }
  if (op === "+" && a.type === T_STRING) {
    return stringValue(a.textValue + b.textValue);
  }
  if (a.type === T_BOOL || a.type === T_STRING) {
    return reject(
      ctx,
      info,
      expr,
      `Operator \`${op}\` is not available on ${valueTypeName(ctx, a)} in a constant`
    );
  }
  if (foldsToBool(op)) {
    return foldComparison(op, a, b);
  }
  if (a.type === T_F64) {
    return foldFloat(ctx, info, op, expr, a.floatValue, b.floatValue);
  }
  return foldInt(ctx, info, op, expr, a, b);
}

function foldComparison(op: string, a: ConstValue, b: ConstValue): ConstValue {
  if (a.type === T_F64) {
    if (op === "<") {
      return boolValue(a.floatValue < b.floatValue);
    }
    if (op === "<=") {
      return boolValue(a.floatValue <= b.floatValue);
    }
    if (op === ">") {
      return boolValue(a.floatValue > b.floatValue);
    }
    return boolValue(a.floatValue >= b.floatValue);
  }
  if (op === "<") {
    return boolValue(a.intValue < b.intValue);
  }
  if (op === "<=") {
    return boolValue(a.intValue <= b.intValue);
  }
  if (op === ">") {
    return boolValue(a.intValue > b.intValue);
  }
  return boolValue(a.intValue >= b.intValue);
}

function foldInt(
  ctx: CheckContext,
  info: ConstInfo,
  op: string,
  expr: Node,
  a: ConstValue,
  b: ConstValue
): ConstValue {
  if (op === "/" || op === "%") {
    // The two failures the emitted divisor check catches at run time
    // (docs/LANGUAGE.md, "Checked integer division"), refused at compile time.
    if (b.intValue === toI64(0)) {
      return reject(ctx, info, expr, "attempt to divide by zero in a constant");
    }
    // i64's minimum as bits: the language has no literal for it, and shifting
    // one into the sign bit is exact where a decimal literal would round.
    const min = a.type === T_I64 ? toI64(1) << toI64(63) : toI64(-2147483648);
    if (a.intValue === min && b.intValue === toI64(-1)) {
      return reject(ctx, info, expr, "attempt to divide with overflow in a constant");
    }
    return intValue(a.type, op === "/" ? a.intValue / b.intValue : a.intValue % b.intValue);
  }
  if (op === "+") {
    return intValue(a.type, a.intValue + b.intValue);
  }
  if (op === "-") {
    return intValue(a.type, a.intValue - b.intValue);
  }
  if (op === "*") {
    return intValue(a.type, a.intValue * b.intValue);
  }
  return reject(ctx, info, expr, `Unsupported operator \`${op}\` in a constant`);
}

function foldFloat(ctx: CheckContext, info: ConstInfo, op: string, expr: Node, x: f64, y: f64): ConstValue {
  if (op === "+") {
    return floatValue(x + y);
  }
  if (op === "-") {
    return floatValue(x - y);
  }
  if (op === "*") {
    return floatValue(x * y);
  }
  if (op === "/") {
    return floatValue(x / y); // IEEE-754: `1 / 0` is Infinity, never an error
  }
  if (op === "%") {
    return floatValue(x % y);
  }
  return reject(ctx, info, expr, `Unsupported operator \`${op}\` on f64 in a constant`);
}

/** A compile-time integer, and whether there was one. */
export class CaseValue {
  known: boolean;
  value: i64;

  constructor(known: boolean, value: i64) {
    this.known = known;
    this.value = value;
  }
}

/**
 * The value a `case` label selects on. It has to be known at compile time,
 * because LLVM's `switch` table holds constants: an integer literal, its
 * negation, or a module constant — which is where a program's token and node
 * kinds live. Anything else is a runtime value and belongs in an `if`.
 */
export function caseValue(ctx: CheckContext, expr: Node): CaseValue {
  if (expr.kind === N_PAREN) {
    return caseValue(ctx, expr.children[0]);
  }
  if (expr.kind === N_NUMBER) {
    return isFractional(expr.text)
      ? new CaseValue(false, toI64(0))
      : new CaseValue(true, parseIntegerLiteral(expr.text));
  }
  if (expr.kind === N_UNARY && expr.text === "-") {
    const operand = caseValue(ctx, expr.children[0]);
    return new CaseValue(operand.known, -operand.value);
  }
  if (expr.kind === N_IDENT) {
    const constant = ctx.program.nodeConstants[expr.id];
    if (constant === null || (constant.type !== T_I32 && constant.type !== T_I64)) {
      return new CaseValue(false, toI64(0));
    }
    foldConstant(ctx, constant);
    return new CaseValue(true, constant.intValue);
  }
  return new CaseValue(false, toI64(0));
}
