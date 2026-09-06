/**
 * String lowering (WP3).
 *
 * Layout (ABI, shared with runtime/runtime.c): a `string` is an `i8*` to
 * `{ i64 len, i8 data[len], i8 0 }`, 8-byte aligned, immutable.
 *
 *   literal        `@.str.N = private unnamed_addr constant { i64, [len+1 x i8] }
 *                  { i64 len, [len+1 x i8] c"...\00" }, align 8`, interned per
 *                  module and referenced as `bitcast ({...}* @.str.N to i8*)`.
 *                  Bytes are UTF-8; anything outside printable ASCII is `\XX`.
 *   a + b          `call i8* @sts_str_concat(i8* a, i8* b)`
 *   a === b        `call zeroext i1 @sts_str_eq(i8* a, i8* b)` (`!==` adds `xor i1 .., true`)
 *   s.length       `bitcast i8* s to i64*` + `load i64, align 8`, then `trunc`
 *                  to i32 (i32 mode) or `sitofp` to double (f64 mode). No call.
 *   `a${x}b`       constant parts are literals; holes are converted with
 *                  `sts_str_from_i32` / `sts_str_from_f64` or, for booleans, a
 *                  `select` between the literals "true" / "false"; parts are
 *                  joined left to right with `sts_str_concat`.
 *   console.log(x) convert as above, then `call void @sts_print(i8* s)`.
 *
 * `collectStringFacts` tells `attributes.ts` which runtime symbols these
 * constructs call (for the purity fixpoint) and that `.length` reads memory.
 */
import ts from "typescript";
import { CheckedProgram } from "../../checker";
import { dottedName } from "../../checker/builtins";
import { STRING, StaticType, llvmType } from "../../types";
import { IRModule } from "../ir";
import { arenaBuiltinCallEmitters } from "./arena";
import { BuiltinCall } from "./builtins";
import { BinaryEmitter, EmitContext, EmitterTable, ExpressionEmitter } from "./context";
import { isValueReceiver, namespacePropertyEmitters, propertyEmitters } from "./members";
import { ioBuiltinCallEmitters } from "./io";
import { mathBuiltinCallEmitters, mathPropertyEmitters } from "./math";

// ---- Constants --------------------------------------------------------------------

/** LLVM `c"..."` body: printable ASCII verbatim (except `"` and `\`), everything else `\XX`. */
export function escapeBytes(bytes: Buffer): string {
  let out = "";
  for (const b of bytes) {
    if (b >= 0x20 && b <= 0x7e && b !== 0x22 && b !== 0x5c) out += String.fromCharCode(b);
    else out += "\\" + b.toString(16).toUpperCase().padStart(2, "0");
  }
  return out;
}

/**
 * Add `@.str.<index>` for `text` to the module and return the `i8*` constant
 * expression that points at its header (what every `sts_str_*` expects).
 */
export function addStringConstant(module: IRModule, index: number, text: string): string {
  const bytes = Buffer.from(text, "utf8");
  const array = `[${bytes.length + 1} x i8]`;
  const type = `{ i64, ${array} }`;
  module.addGlobal(
    `@.str.${index} = private unnamed_addr constant ${type} { i64 ${bytes.length}, ${array} c"${escapeBytes(bytes)}\\00" }, align 8`
  );
  return `bitcast (${type}* @.str.${index} to i8*)`;
}

const emitStringLiteral: ExpressionEmitter = (ctx, expr) =>
  ctx.stringConstant((expr as ts.StringLiteral | ts.NoSubstitutionTemplateLiteral).text);

// ---- Conversion to string -----------------------------------------------------------

/** Runtime symbol that converts `t` to a string, or undefined when no call is needed. */
function conversionCallee(t: StaticType): string | undefined {
  if (t.kind === "i32") return "sts_str_from_i32";
  if (t.kind === "i64") return "sts_str_from_i64";
  if (t.kind === "f64") return "sts_str_from_f64";
  return undefined; // string: identity; bool: select between two literals
}

/** Lower `expr` (string | number | boolean) and return an `i8*` string value. */
function emitToString(ctx: EmitContext, expr: ts.Expression): string {
  const type = ctx.typeOf(expr);
  const value = ctx.emitExpression(expr);
  if (type.kind === "bool") {
    return ctx.fn.emitValue(`select i1 ${value}, i8* ${ctx.stringConstant("true")}, i8* ${ctx.stringConstant("false")}`);
  }
  const callee = conversionCallee(type);
  if (!callee) return value;
  return ctx.fn.emitValue(`call i8* ${ctx.useRuntime(callee)}(${llvmType(type)} ${value})`);
}

function emitConcat(ctx: EmitContext, lhs: string, rhs: string): string {
  return ctx.fn.emitValue(`call i8* ${ctx.useRuntime("sts_str_concat")}(i8* ${lhs}, i8* ${rhs})`);
}

// ---- Template literals ----------------------------------------------------------------

type TemplatePart = { text: string } | { hole: ts.Expression };

/** Head, holes and middles/tail in order, with empty text parts dropped. */
function templateParts(expr: ts.TemplateExpression): TemplatePart[] {
  const parts: TemplatePart[] = [];
  if (expr.head.text) parts.push({ text: expr.head.text });
  for (const span of expr.templateSpans) {
    parts.push({ hole: span.expression });
    if (span.literal.text) parts.push({ text: span.literal.text });
  }
  return parts;
}

const emitTemplateExpression: ExpressionEmitter = (ctx, node) => {
  const parts = templateParts(node as ts.TemplateExpression);
  let acc: string | undefined;
  for (const part of parts) {
    const value = "text" in part ? ctx.stringConstant(part.text) : emitToString(ctx, part.hole);
    acc = acc === undefined ? value : emitConcat(ctx, acc, value);
  }
  return acc ?? ctx.stringConstant("");
};

/**
 * A template whose only part is a string-typed hole lowers to that hole's
 * value unchanged. Escape analysis must see through it (and parentheses), or
 * `return \`${s}\`` would wrongly keep `nocapture` on `s`.
 */
export function unwrapStringPassthrough(program: CheckedProgram, expr: ts.Expression): ts.Expression {
  for (;;) {
    if (ts.isParenthesizedExpression(expr)) {
      expr = expr.expression;
      continue;
    }
    if (ts.isTemplateExpression(expr)) {
      const parts = templateParts(expr);
      if (parts.length === 1 && "hole" in parts[0] && program.types.get(parts[0].hole)?.kind === "string") {
        expr = parts[0].hole;
        continue;
      }
    }
    return expr;
  }
}

// ---- `.length` --------------------------------------------------------------------------

for (const [name, prop] of Object.entries(mathPropertyEmitters)) namespacePropertyEmitters[name] = () => prop.value; // Math.PI, Math.E

propertyEmitters.string = (ctx, expr) => {
  const type = ctx.typeOf(expr);
  const str = ctx.emitExpression(expr.expression);
  const header = ctx.fn.emitValue(`bitcast i8* ${str} to i64*`);
  const len = ctx.fn.emitValue(`load i64, i64* ${header}${ctx.alignSuffix(STRING)}`);
  return type.kind === "f64"
    ? ctx.fn.emitValue(`sitofp i64 ${len} to double`)
    : ctx.fn.emitValue(`trunc i64 ${len} to i32`);
};

// ---- Operators (string-aware `+`, `===`, `!==`) ---------------------------------------------

const emitPlus: BinaryEmitter = (ctx, expr) => {
  const type = ctx.typeOf(expr.left);
  const lhs = ctx.emitExpression(expr.left);
  const rhs = ctx.emitExpression(expr.right);
  if (type.kind === "string") return emitConcat(ctx, lhs, rhs);
  return ctx.fn.emitValue(`${type.kind === "f64" ? "fadd" : "add"} ${llvmType(type)} ${lhs}, ${rhs}`);
};

const emitStrictEquality: BinaryEmitter = (ctx, expr) => {
  const type = ctx.typeOf(expr.left);
  const negate = expr.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken;
  const lhs = ctx.emitExpression(expr.left);
  const rhs = ctx.emitExpression(expr.right);
  if (type.kind === "string") {
    const eq = ctx.fn.emitValue(`call zeroext i1 ${ctx.useRuntime("sts_str_eq")}(i8* ${lhs}, i8* ${rhs})`);
    return negate ? ctx.fn.emitValue(`xor i1 ${eq}, true`) : eq;
  }
  // `T | null` (WP6) compares against the literal `null` by pointer; the checker allows nothing else.
  const opcode = type.kind === "f64" ? (negate ? "fcmp une" : "fcmp oeq") : negate ? "icmp ne" : "icmp eq";
  return ctx.fn.emitValue(`${opcode} ${llvmType(type)} ${lhs}, ${rhs}`);
};

// ---- Builtin calls ------------------------------------------------------------------------

const consoleLog: BuiltinCall = {
  emit: (ctx, expr) => {
    const text = emitToString(ctx, expr.arguments[0]);
    ctx.fn.emit(`call void ${ctx.useRuntime("sts_print")}(i8* ${text})`);
    return "void";
  },
  callees: (program, expr) => ["sts_print", ...conversionCallees(program, expr.arguments[0])],
};

/** Builtins keyed by dotted callee name; mirrors `builtinCalls` in the checker. */
export const builtinCallEmitters: Record<string, BuiltinCall> = {
  "console.log": consoleLog,
  ...mathBuiltinCallEmitters, // WP7: Math.sqrt, ..., Math.random
  ...ioBuiltinCallEmitters, // WP7: process.exit
  ...arenaBuiltinCallEmitters, // WP6: Arena.reset / mark / release / used
};

/** Entry point for `emitCall` when the callee is a property access. */
export function emitBuiltinCall(ctx: EmitContext, expr: ts.CallExpression): string {
  return builtinCallEmitters[dottedName(expr.expression)!].emit(ctx, expr);
}

// ---- Facts for attributes.ts ----------------------------------------------------------------

function conversionCallees(program: CheckedProgram, expr: ts.Expression): string[] {
  const callee = conversionCallee(program.types.get(expr)!);
  return callee ? [callee] : [];
}

/**
 * Record what a string construct does to memory: runtime symbols it calls
 * (their effects come from `RUNTIME_BY_NAME`) and header reads by `.length`.
 * Must mirror the emitters above exactly; an omission here is a wrong attribute.
 */
export function collectStringFacts(
  program: CheckedProgram,
  node: ts.Node,
  facts: { readsMemory: boolean; callees: Set<string> }
): void {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && !isValueReceiver(program, node.expression.expression)) {
    for (const c of builtinCallEmitters[dottedName(node.expression)!].callees(program, node)) facts.callees.add(c);
  } else if (ts.isBinaryExpression(node) && program.types.get(node.left)?.kind === "string") {
    const op = node.operatorToken.kind;
    if (op === ts.SyntaxKind.PlusToken) facts.callees.add("sts_str_concat");
    else if (op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
      facts.callees.add("sts_str_eq");
    }
  } else if (ts.isPropertyAccessExpression(node) && program.types.get(node.expression)?.kind === "string") {
    facts.readsMemory = true; // `.length` loads the header through the string pointer (Math.PI has no typed target)
  } else if (ts.isTemplateExpression(node)) {
    const parts = templateParts(node);
    if (parts.length > 1) facts.callees.add("sts_str_concat");
    for (const part of parts) {
      if ("hole" in part) for (const c of conversionCallees(program, part.hole)) facts.callees.add(c);
    }
  }
}

// ---- Registration -----------------------------------------------------------------------------

export const stringExpressionEmitters: EmitterTable<ExpressionEmitter> = {
  [ts.SyntaxKind.StringLiteral]: emitStringLiteral,
  [ts.SyntaxKind.NoSubstitutionTemplateLiteral]: emitStringLiteral,
  [ts.SyntaxKind.TemplateExpression]: emitTemplateExpression,
};

/** Overrides the numeric-only `+`, `===`, `!==` entries (spread after them). */
export const stringBinaryEmitters: EmitterTable<BinaryEmitter> = {
  [ts.SyntaxKind.PlusToken]: emitPlus,
  [ts.SyntaxKind.EqualsEqualsEqualsToken]: emitStrictEquality,
  [ts.SyntaxKind.ExclamationEqualsEqualsToken]: emitStrictEquality,
};
