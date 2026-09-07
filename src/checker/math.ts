/**
 * Math builtins, numeric conversions, and contextual typing of numeric
 * literals (WP7). Lowering lives in `codegen/emit/math.ts`.
 *
 * Math:
 *   - `Math.sqrt/floor/ceil/trunc/round/sin/cos/exp/log(x: f64): f64` and
 *     `Math.pow(x: f64, y: f64): f64` are f64-only. Applying them to an
 *     `i32`/`i64` (for example `number` in the default i32 mode) is an error
 *     that points at `--number-mode f64` or `toF64(x)`; there is no implicit
 *     widening anywhere in StaticTS.
 *   - `Math.abs(x: T): T`, `Math.min(a: T, b: T): T`, `Math.max(a: T, b: T): T`
 *     work for every numeric T (i32, i64, f64); both operands must agree.
 *   - `Math.random(): f64`.
 *   - `Math.PI`, `Math.E`: f64 constants (also in i32 mode: `f64` always exists).
 *
 * Conversions (plain identifier calls, any numeric argument):
 *   `toI32(x)`, `toI64(x)`, `toU8(x)`, `toU16(x)`, `toU32(x)`, `toU64(x)`,
 *   `toF64(x)`. Same-type calls are identities, and so is a conversion between
 *   two integers of the same width that differ only in signedness (WP15):
 *   `toU32(i)` on an `i32` emits no instruction at all.
 *
 * String to number (plain identifier calls, lowered to the runtime):
 *   `parseInt(s: string): i32`, `parseFloat(s: string): f64`, and
 *   `Number(x: string | i32 | i64 | f64 | boolean): f64`, which parses a
 *   string and converts anything else numerically (`true` is 1).
 *
 * Numeric literals are typed by context. A literal is the mode's default
 * (`i32`, or `f64` under `--number-mode f64`) unless its immediate context
 * demands another numeric type, in which case it takes that type:
 *   - `let x: T = 5`            (annotated initializer)
 *   - `return 5`                (function returning T)
 *   - `f(5)`                    (user function whose parameter is T)
 *   - `x = 5`, `x + 5`, `5 * x`, `x < 5`, ... (other operand typed T: a
 *     variable, a call to a user function or to `toI32/toI64/toF64`, or an
 *     already-checked left operand)
 *   - `Math.min(x, 5)`, `Math.max(5, x)`, `process.exit(5)`, `toF64(5)`,
 *     and the f64-only Math functions (`Math.sqrt(2)`, `Math.pow(x, 0.5)`)
 *   - an element of an array literal whose own context is a `T[]`
 *     (`const bytes: u8[] = [0, 255]`), a class field's literal initializer
 *     (`b: u8 = 255`), and a constructor argument (`new Pixel(255, 0, 0)`)
 *   - a field or element assignment (`p.b = 255`, `bytes[i] = 255`), through
 *     the target's recorded type
 * `-5` and `(5)` count as the literal. A literal in an integer context must
 * be an integer with |n| <= 2^53 (TypeScript's parser has already rounded
 * larger literals to a double); build bigger i64 values arithmetically. In an
 * *unsigned* context it must also be non-negative and within the width, so
 * `const b: u8 = -1` and `const b: u8 = 256` are both errors naming `u8`.
 */
import ts from "typescript";
import {
  F32,
  F64,
  I32,
  I64,
  StaticType,
  U8,
  U16,
  U32,
  U64,
  isFloat,
  isNumeric,
  isUnsigned,
  resolveTypeNode,
  sameType,
  typeToString,
  unsignedMax,
} from "../types";
import { BuiltinCallChecker, calleeName, checkArity } from "./builtins";
import { CheckContext } from "./context";
import { Scope } from "./scope";

// ---- Math.* -------------------------------------------------------------------

const F64_UNARY = ["sqrt", "floor", "ceil", "trunc", "round", "sin", "cos", "exp", "log"];

function requireF64(ctx: CheckContext, name: string, arg: ts.Expression, scope: Scope): void {
  const t = ctx.checkExpression(arg, scope);
  if (t.kind === "f64") return;
  if (isNumeric(t)) {
    throw ctx.error(
      `\`${name}\` requires an f64 argument, got ${typeToString(t)} (use --number-mode f64 or toF64(x))`,
      arg
    );
  }
  throw ctx.error(`\`${name}\` expects f64, got ${typeToString(t)}`, arg);
}

function f64Builtin(name: string, arity: number): BuiltinCallChecker {
  return (ctx, expr, scope) => {
    checkArity(ctx, expr, name, arity);
    for (const arg of expr.arguments) requireF64(ctx, name, arg, scope);
    return F64;
  };
}

/** `Math.abs(x)`: any numeric type, result of the same type. */
const checkMathAbs: BuiltinCallChecker = (ctx, expr, scope) => {
  checkArity(ctx, expr, "Math.abs", 1);
  const t = ctx.checkExpression(expr.arguments[0], scope);
  if (!isNumeric(t)) throw ctx.error(`\`Math.abs\` expects a number, got ${typeToString(t)}`, expr.arguments[0]);
  return t;
};

/** `Math.min/max(a, b)`: two operands of one numeric type. */
function minMaxBuiltin(name: string): BuiltinCallChecker {
  return (ctx, expr, scope) => {
    checkArity(ctx, expr, name, 2);
    const a = ctx.checkExpression(expr.arguments[0], scope);
    const b = ctx.checkExpression(expr.arguments[1], scope);
    if (!isNumeric(a) || !sameType(a, b)) {
      throw ctx.error(
        `\`${name}\` requires two operands of the same numeric type, got ${typeToString(a)} and ${typeToString(b)}`,
        expr
      );
    }
    return a;
  };
}

const checkMathRandom: BuiltinCallChecker = (ctx, expr) => {
  checkArity(ctx, expr, "Math.random", 0);
  return F64;
};

export const mathBuiltinCalls: Record<string, BuiltinCallChecker> = {
  ...Object.fromEntries(F64_UNARY.map((f) => [`Math.${f}`, f64Builtin(`Math.${f}`, 1)])),
  "Math.pow": f64Builtin("Math.pow", 2),
  "Math.abs": checkMathAbs,
  "Math.min": minMaxBuiltin("Math.min"),
  "Math.max": minMaxBuiltin("Math.max"),
  "Math.random": checkMathRandom,
};

/** Builtin constants read as `Identifier.name`, keyed by dotted name. */
export const mathBuiltinProperties: Record<string, StaticType> = {
  "Math.PI": F64,
  "Math.E": F64,
};

// ---- Conversions --------------------------------------------------------------

function conversionBuiltin(name: string, target: StaticType): BuiltinCallChecker {
  return (ctx, expr, scope) => {
    checkArity(ctx, expr, name, 1);
    const t = ctx.checkExpression(expr.arguments[0], scope);
    if (!isNumeric(t)) {
      throw ctx.error(
        `\`${name}\` expects a number (i32, i64, u8, u16, u32, u64, f32, or f64), got ${typeToString(t)}`,
        expr.arguments[0]
      );
    }
    return target;
  };
}

const CONVERSION_TARGETS: Record<string, StaticType> = {
  toI32: I32,
  toI64: I64,
  toU8: U8,
  toU16: U16,
  toU32: U32,
  toU64: U64,
  toF32: F32,
  toF64: F64,
};

export const conversionBuiltins: Record<string, BuiltinCallChecker> = Object.fromEntries(
  Object.entries(CONVERSION_TARGETS).map(([name, target]) => [name, conversionBuiltin(name, target)])
);

// ---- String to number (WP7) ---------------------------------------------------------

/** `parseInt(s: string): i32`, `parseFloat(s: string): f64`: one string argument. */
function stringParser(name: string, result: StaticType): BuiltinCallChecker {
  return (ctx, expr, scope) => {
    checkArity(ctx, expr, name, 1);
    const t = ctx.checkExpression(expr.arguments[0], scope);
    if (t.kind !== "string") throw ctx.error(`\`${name}\` expects a string, got ${typeToString(t)}`, expr.arguments[0]);
    return result;
  };
}

/** `Number(x): f64`: parses a string; converts i32/i64/f64/boolean numerically. */
const checkNumber: BuiltinCallChecker = (ctx, expr, scope) => {
  checkArity(ctx, expr, "Number", 1);
  const t = ctx.checkExpression(expr.arguments[0], scope);
  if (t.kind !== "string" && t.kind !== "bool" && !isNumeric(t)) {
    throw ctx.error(`\`Number\` expects a string, number, or boolean, got ${typeToString(t)}`, expr.arguments[0]);
  }
  return F64;
};

const PARSE_RETURNS: Record<string, StaticType> = { parseInt: I32, parseFloat: F64, Number: F64 };

export const parseBuiltins: Record<string, BuiltinCallChecker> = {
  parseInt: stringParser("parseInt", I32),
  parseFloat: stringParser("parseFloat", F64),
  Number: checkNumber,
};

// ---- Contextual typing of numeric literals -----------------------------------------

/** Builtin calls whose arguments give literals a type: the other operand's, or a fixed one. */
const LITERAL_CONTEXT_CALLS: Record<string, "other" | StaticType> = {
  ...Object.fromEntries([...F64_UNARY, "pow"].map((f) => [`Math.${f}`, F64])), // `Math.sqrt(2)` in i32 mode
  "Math.min": "other",
  "Math.max": "other",
  "process.exit": I32,
  "Arena.release": I64, // WP6: `Arena.release(0)` reads naturally
  toF32: F32, // `toF32(2.75)` likewise, and the literal is rounded to f32
  toF64: F64, // so `toF64(2.75)` is legal in i32 mode; toI32/toI64 leave integer literals alone
  Number: F64, // `Number(2.5)` likewise
};

/** Return types of the identifier builtins, for `peekType`. */
const BUILTIN_RETURNS: Record<string, StaticType> = { ...CONVERSION_TARGETS, ...PARSE_RETURNS };

/**
 * Type of `expr` without checking it, when it is cheap to see: an
 * already-checked node, a variable, a field or element of one of those, a call
 * to a user function, or any of them behind parentheses / unary minus.
 * Undefined otherwise.
 */
function peekType(ctx: CheckContext, expr: ts.Expression, scope: Scope): StaticType | undefined {
  const known = ctx.program.types.get(expr);
  if (known) return known;
  if (ts.isParenthesizedExpression(expr)) return peekType(ctx, expr.expression, scope);
  if (ts.isPrefixUnaryExpression(expr) && expr.operator === ts.SyntaxKind.MinusToken) {
    return peekType(ctx, expr.operand, scope);
  }
  if (ts.isIdentifier(expr)) return scope.lookup(expr.text)?.type;
  // A field or element of something whose type is already visible. This is what
  // gives `p.b = 255` and `bytes[i] = 255` their narrow type, and it matters
  // most for the widths a literal cannot otherwise reach (i64, u8, u16, ...).
  if (ts.isPropertyAccessExpression(expr)) {
    const receiver = peekType(ctx, expr.expression, scope);
    if (receiver?.kind !== "struct") return undefined;
    return ctx.program.structs.get(receiver.name)?.fieldsByName.get(expr.name.text)?.type;
  }
  if (ts.isElementAccessExpression(expr)) {
    const receiver = peekType(ctx, expr.expression, scope);
    return receiver?.kind === "array" ? receiver.elem : undefined;
  }
  if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
    const name = expr.expression.text;
    return ctx.sigs.get(name)?.returnType ?? BUILTIN_RETURNS[name];
  }
  return undefined;
}

/**
 * The numeric type the surrounding context demands for `node`, if any.
 *
 * `node` is the literal itself on the way in, but the array-literal case
 * recurses with the enclosing `[...]`, which is how `const bytes: u8[] = [0, 255]`
 * types its elements: the element type of whatever context the array itself
 * is in.
 */
function contextType(ctx: CheckContext, node: ts.Expression, scope: Scope): StaticType | undefined {
  let expr: ts.Expression = node;
  let parent = expr.parent;
  while (
    parent &&
    (ts.isParenthesizedExpression(parent) ||
      (ts.isPrefixUnaryExpression(parent) && parent.operator === ts.SyntaxKind.MinusToken))
  ) {
    expr = parent;
    parent = parent.parent;
  }
  if (!parent) return undefined;
  if (ts.isVariableDeclaration(parent)) {
    return parent.initializer === expr && parent.type ? resolveTypeNode(parent.type, ctx.sf, ctx.opts) : undefined;
  }
  // A class field's literal initializer (`b: u8 = 255`) is checked with an empty
  // scope before any body, so the annotation is the only context there is.
  if (ts.isPropertyDeclaration(parent)) {
    return parent.initializer === expr && parent.type ? resolveTypeNode(parent.type, ctx.sf, ctx.opts) : undefined;
  }
  if (ts.isArrayLiteralExpression(parent)) {
    const array = contextType(ctx, parent, scope);
    return array?.kind === "array" ? array.elem : undefined;
  }
  if (ts.isReturnStatement(parent)) return ctx.current.returnType;
  if (ts.isBinaryExpression(parent)) {
    return peekType(ctx, parent.left === expr ? parent.right : parent.left, scope);
  }
  if (ts.isNewExpression(parent) && ts.isIdentifier(parent.expression)) {
    const index = parent.arguments?.indexOf(expr) ?? -1;
    if (index < 0) return undefined;
    // `new Pixel(255, 0, 0)`: the class's constructor or the nearest ancestor's.
    // `params[0]` is `this`, so the argument at `index` is `params[index + 1]`.
    for (let c = ctx.program.structs.get(parent.expression.text); c; c = c.base) {
      if (c.ctor) return c.ctor.params[index + 1]?.type;
    }
    return undefined;
  }
  if (ts.isCallExpression(parent)) {
    const index = parent.arguments.indexOf(expr);
    const name = calleeName(parent);
    if (index < 0 || name === undefined) return undefined;
    const userParam = ctx.sigs.get(name)?.params[index]?.type;
    if (userParam) return userParam;
    const rule = LITERAL_CONTEXT_CALLS[name];
    if (rule === undefined) return undefined;
    return rule === "other" ? peekType(ctx, parent.arguments[1 - index], scope) : rule;
  }
  return undefined;
}

/**
 * Contextual type for a numeric literal (see the module comment), or
 * undefined when the literal keeps the mode's default type. Validates that
 * the literal fits the demanded type.
 */
export function contextualLiteralType(
  ctx: CheckContext,
  literal: ts.NumericLiteral,
  scope: Scope
): StaticType | undefined {
  const want = contextType(ctx, literal, scope);
  if (!want || !isNumeric(want)) return undefined;
  if (isFloat(want)) return want; // `const x: f32 = 0.1` rounds at emit time
  const n = Number(literal.text);
  if (!Number.isInteger(n)) {
    throw ctx.error(`Non-integer literal \`${literal.text}\` where ${want.kind} is expected`, literal);
  }
  const negated = ts.isPrefixUnaryExpression(literal.parent) && literal.parent.operator === ts.SyntaxKind.MinusToken;
  if (isUnsigned(want)) {
    // WP15: an unsigned context takes no negative value at all, and the range
    // is the width's, so `-1` and `256` are both errors on a `u8`. Naming the
    // width is the whole point of the message: it is what the reader must fix.
    if (negated && n !== 0) {
      // Point the caret at the whole `-1`, not just the digits after the sign.
      throw ctx.error(
        `Negative literal \`-${literal.text}\` where ${want.kind} is expected (${want.kind} is unsigned)`,
        literal.parent
      );
    }
    if (n > 2 ** 53) {
      throw ctx.error(
        `Literal \`${literal.text}\` exceeds 2^53 and cannot be written exactly (the parser already rounded it); compute the ${want.kind} value instead`,
        literal
      );
    }
    if (BigInt(n) > unsignedMax(want)) {
      throw ctx.error(`Literal \`${literal.text}\` does not fit in ${want.kind}`, literal);
    }
    return want;
  }
  if (want.kind === "i32" && n > 0x7fffffff + (negated ? 1 : 0)) {
    throw ctx.error(`Literal \`${literal.text}\` does not fit in i32`, literal);
  }
  if (want.kind === "i64" && Math.abs(n) > 2 ** 53) {
    throw ctx.error(
      `Literal \`${literal.text}\` exceeds 2^53 and cannot be written exactly (the parser already rounded it); compute the i64 value instead`,
      literal
    );
  }
  return want;
}
