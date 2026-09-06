/**
 * Expression lowering, one handler per `ts.SyntaxKind`, plus a table of
 * binary operators keyed by operator token. Every handler returns the LLVM
 * value (temp, parameter, or constant) that holds the expression's result.
 */
import ts from "typescript";
import { StaticType, isInteger, llvmType } from "../../types";
import { emitIntBinary } from "./arithmetic";
import { arrayExpressionEmitters, installArrayAssignmentEmitters } from "./arrays";
import { bitwiseBinaryEmitters, bitwiseUnaryEmitters } from "./bitwise";
import { CheckedProgram } from "../../checker";
import { ConstValue, constValue } from "../../checker/constants";
import { BuiltinCall, f64Constant } from "./builtins";
import { ioFunctionEmitters } from "./io";
import { conversionEmitters, parseEmitters } from "./math";
import { isAssignmentOperator } from "../../checker/classes";
import { classExpressionEmitters, emitSuperCall } from "./classes";
import { assignmentTargetEmitters, emitMethodCall, isValueReceiver, memberExpressionEmitters } from "./members";
import { emitBuiltinCall, stringBinaryEmitters, stringExpressionEmitters } from "./strings";
import { BinaryEmitter, EmitContext, EmitterTable, ExpressionEmitter, UnaryEmitter, intOpcode } from "./context";
import {
  controlFlowBinaryEmitters,
  controlFlowExpressionEmitters,
  controlFlowUnaryEmitters,
} from "./control-flow";
import { lookup } from "../../lookup";

// ---- Constants --------------------------------------------------------------------

/** The LLVM constant for a folded module constant, by shape. */
export function constantValue(ctx: EmitContext, value: ConstValue): string {
  if (value.kind === "bool") return value.value ? "true" : "false";
  if (value.kind === "string") return ctx.stringConstant(value.value);
  if (value.kind === "f64") return f64Constant(value.value);
  return String(value.value);
}

export function numericConstant(text: string, type: StaticType): string {
  const n = Number(text);
  if (type.kind === "i32") return String(n | 0);
  if (type.kind === "i64") return String(n); // an integer with |n| <= 2^53 (checker-enforced): exact
  // LLVM only accepts decimal float literals that round-trip exactly, so
  // emit the IEEE-754 bit pattern instead; that is always valid.
  return f64Constant(n);
}

const emitParenthesized: ExpressionEmitter = (ctx, expr) =>
  ctx.emitExpression((expr as ts.ParenthesizedExpression).expression);

const emitNumericLiteral: ExpressionEmitter = (ctx, expr) =>
  numericConstant((expr as ts.NumericLiteral).text, ctx.typeOf(expr));

const emitTrue: ExpressionEmitter = () => "true";
const emitFalse: ExpressionEmitter = () => "false";
/** `null` of a `T | null` type: the pointer constant (WP6). */
const emitNull: ExpressionEmitter = () => "null";

/**
 * Parameters are SSA values; locals are loaded from their alloca slot; a
 * module constant (WP14) is neither, because the checker already folded it —
 * the name lowers to the value, with no global and no load.
 */
const emitIdentifier: ExpressionEmitter = (ctx, expr) => {
  const constant = ctx.program.constRefs.get(expr as ts.Identifier);
  if (constant) return constantValue(ctx, constValue(constant));
  const local = ctx.program.bindings.get(expr as ts.Identifier)!;
  if (local.storage === "param") return `%${local.name}`;
  const ty = llvmType(local.type);
  return ctx.fn.emitValue(`load ${ty}, ${ty}* ${ctx.slotOf(local)}${ctx.alignSuffix(local.type)}`);
};

// ---- Operators --------------------------------------------------------------------

const emitNegate: UnaryEmitter = (ctx, expr) => {
  const type = ctx.typeOf(expr.operand);
  const operand = ctx.emitExpression(expr.operand);
  return isInteger(type)
    ? ctx.fn.emitValue(`${intOpcode(ctx, "sub")} ${llvmType(type)} 0, ${operand}`)
    : ctx.fn.emitValue(`fneg double ${operand}`);
};

const emitNot: UnaryEmitter = (ctx, expr) => ctx.fn.emitValue(`xor i1 ${ctx.emitExpression(expr.operand)}, true`);

/** Prefix operators keyed by operator token, mirroring `unaryCheckers`. */
export const unaryEmitters: EmitterTable<UnaryEmitter> = {
  [ts.SyntaxKind.MinusToken]: emitNegate,
  [ts.SyntaxKind.ExclamationToken]: emitNot,
  ...bitwiseUnaryEmitters, // `~`
  ...controlFlowUnaryEmitters,
};

const emitPrefixUnary: ExpressionEmitter = (ctx, node) => {
  const expr = node as ts.PrefixUnaryExpression;
  const handler = unaryEmitters[expr.operator];
  if (!handler) throw new Error(`emitter: unexpected unary operator ${ts.SyntaxKind[expr.operator]}`);
  return handler(ctx, expr);
};

/** Opcode per operator: [integer form, floating-point form]. */
const ARITHMETIC_OPCODES: Partial<Record<ts.SyntaxKind, [string, string]>> = {
  [ts.SyntaxKind.PlusToken]: ["add", "fadd"],
  [ts.SyntaxKind.MinusToken]: ["sub", "fsub"],
  [ts.SyntaxKind.AsteriskToken]: ["mul", "fmul"],
  [ts.SyntaxKind.SlashToken]: ["sdiv", "fdiv"],
  [ts.SyntaxKind.PercentToken]: ["srem", "frem"],
  [ts.SyntaxKind.LessThanToken]: ["icmp slt", "fcmp olt"],
  [ts.SyntaxKind.LessThanEqualsToken]: ["icmp sle", "fcmp ole"],
  [ts.SyntaxKind.GreaterThanToken]: ["icmp sgt", "fcmp ogt"],
  [ts.SyntaxKind.GreaterThanEqualsToken]: ["icmp sge", "fcmp oge"],
  [ts.SyntaxKind.EqualsEqualsEqualsToken]: ["icmp eq", "fcmp oeq"],
  [ts.SyntaxKind.ExclamationEqualsEqualsToken]: ["icmp ne", "fcmp une"],
};

export function binaryOpcode(op: ts.SyntaxKind, type: StaticType, ctx?: EmitContext): string {
  const pair = ARITHMETIC_OPCODES[op];
  if (!pair) throw new Error(`emitter: unexpected binary operator ${ts.SyntaxKind[op]}`);
  return type.kind === "f64" ? pair[1] : ctx ? intOpcode(ctx, pair[0]) : pair[0];
}

/** Arithmetic and comparison: evaluate left then right (JS order), one instruction. */
const emitArithmetic: BinaryEmitter = (ctx, expr) => {
  const operandType = ctx.typeOf(expr.left);
  const lhs = ctx.emitExpression(expr.left);
  const rhs = ctx.emitExpression(expr.right);
  const ty = llvmType(operandType);
  if (isInteger(operandType)) return emitIntBinary(ctx, binaryOpcode(expr.operatorToken.kind, operandType), ty, lhs, rhs);
  return ctx.fn.emitValue(`${binaryOpcode(expr.operatorToken.kind, operandType, ctx)} ${ty} ${lhs}, ${rhs}`);
};

/** `x = e`: store into the local's slot; the expression's value is `e`. */
const emitAssignment: BinaryEmitter = (ctx, expr) => {
  const target = ctx.program.bindings.get(expr.left as ts.Identifier)!;
  const ty = llvmType(target.type);
  const value = ctx.emitExpression(expr.right);
  ctx.fn.emit(`store ${ty} ${value}, ${ty}* ${ctx.slotOf(target)}${ctx.alignSuffix(target.type)}`);
  return value;
};

export const binaryEmitters: EmitterTable<BinaryEmitter> = {
  [ts.SyntaxKind.EqualsToken]: emitAssignment,
  ...Object.fromEntries(Object.keys(ARITHMETIC_OPCODES).map((k) => [k, emitArithmetic])),
  ...stringBinaryEmitters, // string-aware `+`, `===`, `!==` (numeric lowering unchanged)
  ...bitwiseBinaryEmitters, // `& | ^ << >> >>>` and their compound forms
  ...controlFlowBinaryEmitters,
};
installArrayAssignmentEmitters(binaryEmitters); // `a[i] = v`, `a[i] op= v`; other targets keep the handlers above

const emitBinary: ExpressionEmitter = (ctx, node) => {
  const expr = node as ts.BinaryExpression;
  const op = expr.operatorToken.kind;
  const handler = (isAssignmentOperator(op) && assignmentTargetEmitters[expr.left.kind]) || binaryEmitters[op];
  if (!handler) throw new Error(`emitter: unexpected binary operator ${ts.SyntaxKind[expr.operatorToken.kind]}`);
  return handler(ctx, expr);
};

// ---- Calls ---------------------------------------------------------------------------

/** Builtins called by plain identifier; mirrors `builtinFunctions` in the checker. */
export const builtinFunctionEmitters: Record<string, BuiltinCall> = {
  ...conversionEmitters, // WP7: toI32, toI64, toF64
  ...parseEmitters, // WP7: parseInt, parseFloat, Number
  ...ioFunctionEmitters, // WP7: readFileSync, writeFileSync, appendFileSync
};

/** The identifier builtin a call resolves to, or undefined for calls to user functions. */
function builtinFunctionOf(program: CheckedProgram, expr: ts.CallExpression): BuiltinCall | undefined {
  if (!ts.isIdentifier(expr.expression) || program.callees.has(expr)) return undefined;
  return lookup(builtinFunctionEmitters, expr.expression.text);
}

/**
 * Runtime symbols an identifier builtin call lowers to, for attributes.ts
 * (dotted builtins are covered by `collectStringFacts`).
 */
export function collectBuiltinFacts(program: CheckedProgram, node: ts.Node, facts: { callees: Set<string> }): void {
  if (!ts.isCallExpression(node)) return;
  const builtin = builtinFunctionOf(program, node);
  if (builtin) for (const c of builtin.callees(program, node)) facts.callees.add(c);
}

const emitCall: ExpressionEmitter = (ctx, node) => {
  const expr = node as ts.CallExpression;
  if (expr.expression.kind === ts.SyntaxKind.SuperKeyword) return emitSuperCall(ctx, expr); // WP2b
  if (ts.isPropertyAccessExpression(expr.expression)) {
    return isValueReceiver(ctx.program, expr.expression.expression)
      ? emitMethodCall(ctx, expr)
      : emitBuiltinCall(ctx, expr);
  }
  const builtin = builtinFunctionOf(ctx.program, expr);
  if (builtin) return builtin.emit(ctx, expr);
  const callee = ctx.program.callees.get(expr)!;
  const args = expr.arguments
    .map((arg, i) => `${llvmType(callee.params[i].type)} ${ctx.emitExpression(arg)}`)
    .join(", ");
  const call = `call ${llvmType(callee.returnType)} @${callee.name}(${args})`;
  if (callee.returnType.kind === "void") {
    ctx.fn.emit(call);
    return "void";
  }
  return ctx.fn.emitValue(call);
};

export const expressionEmitters: EmitterTable<ExpressionEmitter> = {
  [ts.SyntaxKind.ParenthesizedExpression]: emitParenthesized,
  [ts.SyntaxKind.NumericLiteral]: emitNumericLiteral,
  [ts.SyntaxKind.TrueKeyword]: emitTrue,
  [ts.SyntaxKind.FalseKeyword]: emitFalse,
  [ts.SyntaxKind.NullKeyword]: emitNull,
  [ts.SyntaxKind.Identifier]: emitIdentifier,
  [ts.SyntaxKind.PrefixUnaryExpression]: emitPrefixUnary,
  [ts.SyntaxKind.BinaryExpression]: emitBinary,
  [ts.SyntaxKind.CallExpression]: emitCall,
  ...stringExpressionEmitters,
  ...memberExpressionEmitters, // property access, method calls, `new` (dispatch by receiver type)
  ...controlFlowExpressionEmitters,
  ...arrayExpressionEmitters, // `[a, b]`, `a[i]`
  ...classExpressionEmitters, // `this`, object literals (WP2)
};
