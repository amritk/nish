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
 *   a + b          `call i8* @amrit_str_concat(i8* a, i8* b)`
 *   a === b        `call zeroext i1 @amrit_str_eq(i8* a, i8* b)` (`!==` adds `xor i1 .., true`)
 *   s.length       `bitcast i8* s to i64*` + `load i64, align 8`, then `trunc`
 *                  to i32 (i32 mode) or `sitofp` to double (f64 mode). No call.
 *   s.charCodeAt(i)  the array bounds check against the byte length, then
 *                  `getelementptr` past the 8-byte header and `load i8`. No call.
 *   s.substring(a, b)  the JavaScript clamp (`llvm.smin` / `llvm.smax` into
 *                  `[0, len]`, then the two in order), one `getelementptr`
 *                  and one `amrit_str_new`: one allocation, one `memcpy`.
 *   s.startsWith(p)  `amrit_str_at(s, 0, p)`; `endsWith` passes `len - p.len`,
 *                  which is negative, and so false, when `p` is the longer.
 *   s.indexOf(p)   a loop over `amrit_str_at` (`str.find` blocks), inline
 *                  rather than a runtime function so `runtime.c` stays inside
 *                  its budget (docs/wp14-selfhost.md §6 rule 4).
 *   String.fromCharCode(c)  a one-byte `alloca`, `store i8`, `amrit_str_new`.
 *   `a${x}b`       constant parts are literals; holes are converted with
 *                  `amrit_str_from_i32` / `amrit_str_from_f64` / `amrit_str_from_u64`
 *                  (an unsigned hole narrower than 64 bits is `zext`ed first)
 *                  or, for booleans, a `select` between the literals "true" /
 *                  "false"; parts are joined left to right with `amrit_str_concat`.
 *   console.log(x) convert as above, then `call void @amrit_print(i8* s)`.
 *
 * `collectStringFacts` tells `attributes.ts` which runtime symbols these
 * constructs call (for the purity fixpoint) and that `.length` reads memory.
 */
import ts from "typescript";
import { CheckedProgram } from "../../checker/index.js";
import { dottedName } from "../../checker/builtins.js";
import { STRING, StaticType, isFloat, isUnsigned, llvmType } from "../../types.js";
import { IRModule } from "../ir.js";
import { arenaBuiltinCallEmitters } from "./arena.js";
import { BuiltinCall } from "./builtins.js";
import { BinaryEmitter, EmitContext, EmitterTable, ExpressionEmitter, intOpcode } from "./context.js";
import { emitIndex, emitNumberFromI64, emitRangeCheck } from "./arrays.js";
import { isValueReceiver, methodCallEmitters, namespacePropertyEmitters, propertyEmitters } from "./members.js";
import { ioBuiltinCallEmitters } from "./io.js";
import { mathBuiltinCallEmitters, mathPropertyEmitters } from "./math.js";

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
 * expression that points at its header (what every `amrit_str_*` expects).
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

/**
 * Runtime symbol that converts `t` to a string, or undefined when no call is
 * needed. Every unsigned width shares `amrit_str_from_u64`: the value is `zext`ed
 * to i64 first, which is one instruction the optimiser usually folds away and
 * is much cheaper than four formatters in a runtime with a size budget (WP15).
 */
function conversionCallee(t: StaticType): string | undefined {
  if (isUnsigned(t)) return "amrit_str_from_u64";
  if (t.kind === "i32") return "amrit_str_from_i32";
  if (t.kind === "i64") return "amrit_str_from_i64";
  if (isFloat(t)) return "amrit_str_from_f64";
  return undefined; // string: identity; bool: select between two literals
}

/** Lower `expr` (string | number | boolean) and return an `i8*` string value. */
function emitToString(ctx: EmitContext, expr: ts.Expression): string {
  const type = ctx.typeOf(expr);
  let value = ctx.emitExpression(expr);
  if (type.kind === "bool") {
    return ctx.fn.emitValue(
      `select i1 ${value}, i8* ${ctx.stringConstant("true")}, i8* ${ctx.stringConstant("false")}`
    );
  }
  const callee = conversionCallee(type);
  if (!callee) return value;
  let ty = llvmType(type);
  // `zext`, never `sext`: printing a u32 of 0xFFFFFFFF must give 4294967295.
  if (isUnsigned(type) && ty !== "i64") {
    value = ctx.fn.emitValue(`zext ${ty} ${value} to i64`);
    ty = "i64";
  }
  // An `f32` widens to double and reuses the f64 formatter: `fpext` is exact,
  // so the digits are JavaScript's for the float's *value*, and the runtime
  // needs no second formatter (WP15).
  if (type.kind === "f32") {
    value = ctx.fn.emitValue(`fpext float ${value} to double`);
    ty = "double";
  }
  return ctx.fn.emitValue(`call i8* ${ctx.useRuntime(callee)}(${ty} ${value})`);
}

function emitConcat(ctx: EmitContext, lhs: string, rhs: string): string {
  return ctx.fn.emitValue(`call i8* ${ctx.useRuntime("amrit_str_concat")}(i8* ${lhs}, i8* ${rhs})`);
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
  let inner = expr;
  for (;;) {
    if (ts.isParenthesizedExpression(inner)) {
      inner = inner.expression;
      continue;
    }
    if (ts.isTemplateExpression(inner)) {
      const parts = templateParts(inner);
      if (parts.length === 1 && "hole" in parts[0] && program.types.get(parts[0].hole)?.kind === "string") {
        inner = parts[0].hole;
        continue;
      }
    }
    return inner;
  }
}

// ---- `.length` --------------------------------------------------------------------------

for (const [name, prop] of Object.entries(mathPropertyEmitters))
  namespacePropertyEmitters[name] = () => prop.value; // Math.PI, Math.E

propertyEmitters.string = (ctx, expr) => {
  const type = ctx.typeOf(expr);
  const str = ctx.emitExpression(expr.expression);
  const header = ctx.fn.emitValue(`bitcast i8* ${str} to i64*`);
  const len = ctx.fn.emitValue(`load i64, i64* ${header}${ctx.alignSuffix(STRING)}`);
  return type.kind === "f64"
    ? ctx.fn.emitValue(`sitofp i64 ${len} to double`)
    : ctx.fn.emitValue(`trunc i64 ${len} to i32`);
};

// ---- Byte methods (WP14 A2) ---------------------------------------------------------------

/** Method names that lower here; also the list the checker's message prints. */
const STRING_METHODS = new Set(["charCodeAt", "substring", "indexOf", "startsWith", "endsWith"]);

/** Byte length, from the header the string pointer points at. */
function loadStringLength(ctx: EmitContext, str: string): string {
  const header = ctx.fn.emitValue(`bitcast i8* ${str} to i64*`);
  return ctx.fn.emitValue(`load i64, i64* ${header}${ctx.alignSuffix(STRING)}`);
}

/** The bytes themselves: past the 8-byte length header. */
function stringData(ctx: EmitContext, str: string): string {
  return ctx.fn.emitValue(`getelementptr inbounds i8, i8* ${str}, i64 8`);
}

/** `llvm.smax(0, llvm.smin(value, len))`: JavaScript's `substring` clamp. */
function clampToLength(ctx: EmitContext, value: string, len: string): string {
  const low = ctx.fn.emitValue(`call i64 ${ctx.useRuntime("llvm.smin.i64")}(i64 ${value}, i64 ${len})`);
  return ctx.fn.emitValue(`call i64 ${ctx.useRuntime("llvm.smax.i64")}(i64 ${low}, i64 0)`);
}

/** A fresh arena string holding `n` bytes copied from `bytes`. */
function newString(ctx: EmitContext, bytes: string, n: string): string {
  return ctx.fn.emitValue(`call i8* ${ctx.useRuntime("amrit_str_new")}(i8* ${bytes}, i64 ${n})`);
}

/** `s.charCodeAt(i)`: the byte at `i`, bounds-checked exactly as `a[i]` is. */
function emitCharCodeAt(ctx: EmitContext, expr: ts.CallExpression, str: string): string {
  const index = emitIndex(ctx, expr.arguments[0]);
  emitRangeCheck(ctx, index, loadStringLength(ctx, str));
  const at = ctx.fn.emitValue(`getelementptr inbounds i8, i8* ${stringData(ctx, str)}, i64 ${index}`);
  const byte = ctx.fn.emitValue(`load i8, i8* ${at}, align 1`);
  return ctx.typeOf(expr).kind === "f64"
    ? ctx.fn.emitValue(`uitofp i8 ${byte} to double`)
    : ctx.fn.emitValue(`zext i8 ${byte} to i32`);
}

/**
 * `s.substring(a, b)`: both ends clamped into `[0, len]` and then swapped
 * into order, as JavaScript specifies, so the length is never negative and
 * the copy never leaves the string.
 */
function emitSubstring(ctx: EmitContext, expr: ts.CallExpression, str: string): string {
  const len = loadStringLength(ctx, str);
  const first = clampToLength(ctx, emitIndex(ctx, expr.arguments[0]), len);
  const second = expr.arguments.length > 1 ? clampToLength(ctx, emitIndex(ctx, expr.arguments[1]), len) : len;
  const from = ctx.fn.emitValue(`call i64 ${ctx.useRuntime("llvm.smin.i64")}(i64 ${first}, i64 ${second})`);
  const to = ctx.fn.emitValue(`call i64 ${ctx.useRuntime("llvm.smax.i64")}(i64 ${first}, i64 ${second})`);
  const n = ctx.fn.emitValue(`sub i64 ${to}, ${from}`);
  const at = ctx.fn.emitValue(`getelementptr inbounds i8, i8* ${stringData(ctx, str)}, i64 ${from}`);
  return newString(ctx, at, n);
}

/** `amrit_str_at(s, at, sub)`: whether `sub`'s bytes sit at offset `at`. */
function emitOccursAt(ctx: EmitContext, str: string, at: string, sub: string): string {
  return ctx.fn.emitValue(
    `call zeroext i1 ${ctx.useRuntime("amrit_str_at")}(i8* ${str}, i64 ${at}, i8* ${sub})`
  );
}

/**
 * `s.indexOf(sub)`: the first byte offset where `sub` occurs, or -1.
 *
 * This was an inline loop over `amrit_str_at`, one probe per offset, so that
 * `runtime.c` stayed inside its size budget. That made the idiomatic search a
 * byte-at-a-time scan — 51.7 ms against `memmem`'s 2.5 ms over 52 MB of
 * haystack — and WP15 §7's rule is that the budget yields to a measured win,
 * so the search moved into the runtime where it can use the libc's vectorised
 * routines. The empty needle still answers 0 and a too-long one -1, which is
 * what the loop did and what JavaScript says.
 */
function emitIndexOf(ctx: EmitContext, expr: ts.CallExpression, str: string): string {
  const sub = ctx.emitExpression(expr.arguments[0]);
  const found = ctx.fn.emitValue(
    `call i64 ${ctx.useRuntime("amrit_str_index_of")}(i8* ${str}, i8* ${sub})`
  );
  return emitNumberFromI64(ctx, found, expr);
}

methodCallEmitters.string = (ctx, expr) => {
  const access = expr.expression as ts.PropertyAccessExpression;
  const str = ctx.emitExpression(access.expression);
  switch (access.name.text) {
    case "charCodeAt":
      return emitCharCodeAt(ctx, expr, str);
    case "substring":
      return emitSubstring(ctx, expr, str);
    case "indexOf":
      return emitIndexOf(ctx, expr, str);
    case "startsWith":
      return emitOccursAt(ctx, str, "0", ctx.emitExpression(expr.arguments[0]));
    default: {
      // `endsWith`: the suffix sits at `len - sub.len`, which is negative when
      // the suffix is the longer string and `amrit_str_at` then answers false.
      const sub = ctx.emitExpression(expr.arguments[0]);
      const at = ctx.fn.emitValue(`sub i64 ${loadStringLength(ctx, str)}, ${loadStringLength(ctx, sub)}`);
      return emitOccursAt(ctx, str, at, sub);
    }
  }
};

/** `String.fromCharCode(c)`: one byte on the stack, copied into an arena string. */
const fromCharCode: BuiltinCall = {
  emit: (ctx, expr) => {
    const code = emitIndex(ctx, expr.arguments[0]);
    const byte = ctx.fn.emitValue(`trunc i64 ${code} to i8`);
    const slot = ctx.fn.emitAlloca("chr", "i8", 1);
    ctx.fn.emit(`store i8 ${byte}, i8* ${slot}, align 1`);
    return newString(ctx, slot, "1");
  },
  callees: () => ["amrit_str_new"],
};

/** Runtime symbols a string method calls, for the attribute fixpoint. */
function methodCallees(name: string): string[] {
  if (name === "substring") return ["amrit_str_new"];
  return name === "charCodeAt" ? [] : ["amrit_str_at"];
}

/** `expr` is a call of one of the byte methods on a string receiver. */
export function isStringMethodCall(program: CheckedProgram, expr: ts.CallExpression): boolean {
  const access = expr.expression;
  if (!ts.isPropertyAccessExpression(access) || !STRING_METHODS.has(access.name.text)) return false;
  return program.types.get(access.expression)?.kind === "string";
}

/** `expr` allocates a string: `s.substring(...)` or `String.fromCharCode(c)`. */
export function isStringAllocCall(program: CheckedProgram, expr: ts.CallExpression): boolean {
  if (
    dottedName(expr.expression) === "String.fromCharCode" &&
    !isValueReceiver(program, (expr.expression as ts.PropertyAccessExpression).expression)
  ) {
    return true;
  }
  return (
    isStringMethodCall(program, expr) &&
    (expr.expression as ts.PropertyAccessExpression).name.text === "substring"
  );
}

// ---- Operators (string-aware `+`, `===`, `!==`) ---------------------------------------------

const emitPlus: BinaryEmitter = (ctx, expr) => {
  const type = ctx.typeOf(expr.left);
  const lhs = ctx.emitExpression(expr.left);
  const rhs = ctx.emitExpression(expr.right);
  if (type.kind === "string") return emitConcat(ctx, lhs, rhs);
  const opcode = isFloat(type) ? "fadd" : intOpcode(ctx, "add", type);
  return ctx.fn.emitValue(`${opcode} ${llvmType(type)} ${lhs}, ${rhs}`);
};

const emitStrictEquality: BinaryEmitter = (ctx, expr) => {
  const type = ctx.typeOf(expr.left);
  const negate = expr.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken;
  const lhs = ctx.emitExpression(expr.left);
  const rhs = ctx.emitExpression(expr.right);
  if (type.kind === "string") {
    const eq = ctx.fn.emitValue(`call zeroext i1 ${ctx.useRuntime("amrit_str_eq")}(i8* ${lhs}, i8* ${rhs})`);
    return negate ? ctx.fn.emitValue(`xor i1 ${eq}, true`) : eq;
  }
  // `T | null` (WP6) compares against the literal `null` by pointer; the checker allows nothing else.
  const opcode = isFloat(type) ? (negate ? "fcmp une" : "fcmp oeq") : negate ? "icmp ne" : "icmp eq";
  return ctx.fn.emitValue(`${opcode} ${llvmType(type)} ${lhs}, ${rhs}`);
};

// ---- Builtin calls ------------------------------------------------------------------------

/**
 * `console.log` keeps `amrit_print`, its own one-argument entry point;
 * `console.error` goes through the general `amrit_write(s, fd, newline)`.
 */
const consoleLog: BuiltinCall = {
  emit: (ctx, expr) => {
    const text = emitToString(ctx, expr.arguments[0]);
    ctx.fn.emit(`call void ${ctx.useRuntime("amrit_print")}(i8* ${text})`);
    return "void";
  },
  callees: (program, expr) => ["amrit_print", ...conversionCallees(program, expr.arguments[0])],
};

const consoleError: BuiltinCall = {
  emit: (ctx, expr) => {
    const text = emitToString(ctx, expr.arguments[0]);
    ctx.fn.emit(`call void ${ctx.useRuntime("amrit_write")}(i8* ${text}, i32 2, i1 true)`);
    return "void";
  },
  callees: (program, expr) => ["amrit_write", ...conversionCallees(program, expr.arguments[0])],
};

/** Builtins keyed by dotted callee name; mirrors `builtinCalls` in the checker. */
export const builtinCallEmitters: Record<string, BuiltinCall> = {
  "console.log": consoleLog,
  "console.error": consoleError, // WP14 B2
  "String.fromCharCode": fromCharCode, // WP14 A2
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
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    !isValueReceiver(program, node.expression.expression)
  ) {
    for (const c of builtinCallEmitters[dottedName(node.expression)!].callees(program, node))
      facts.callees.add(c);
  } else if (ts.isBinaryExpression(node) && program.types.get(node.left)?.kind === "string") {
    const op = node.operatorToken.kind;
    if (op === ts.SyntaxKind.PlusToken) facts.callees.add("amrit_str_concat");
    else if (
      op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      op === ts.SyntaxKind.ExclamationEqualsEqualsToken
    ) {
      facts.callees.add("amrit_str_eq");
    }
  } else if (ts.isCallExpression(node) && isStringMethodCall(program, node)) {
    // The byte methods all read the string's bytes; `substring` also allocates.
    facts.readsMemory = true;
    for (const c of methodCallees((node.expression as ts.PropertyAccessExpression).name.text))
      facts.callees.add(c);
  } else if (ts.isPropertyAccessExpression(node) && program.types.get(node.expression)?.kind === "string") {
    facts.readsMemory = true; // `.length` loads the header through the string pointer (Math.PI has no typed target)
  } else if (ts.isTemplateExpression(node)) {
    const parts = templateParts(node);
    if (parts.length > 1) facts.callees.add("amrit_str_concat");
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
