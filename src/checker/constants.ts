/**
 * Module-level `const` (WP14).
 *
 * A module constant is a name for a value the compiler already knows, not a
 * global variable: `const KIND_IF: i32 = 3;` emits no symbol and no
 * initialiser, and every use of `KIND_IF` lowers to the literal `3`. That
 * keeps the rule that a module has no top-level code and therefore no
 * initialisation order, while giving a program somewhere to put its token
 * kinds and its limits.
 *
 * The initialiser is an ordinary expression restricted to literals
 * and other constants: exactly the operators of `docs/LANGUAGE.md`, no more.
 * A constant that could compute something a runtime expression cannot would
 * be a second, larger language hiding inside the first.
 *
 * Folding happens here rather than in the emitter because the fold is where
 * the errors live: a division by zero, an overflow, a cycle. It is lazy and
 * memoised on `ConstInfo.value`, so a constant in one module may name one in
 * another whatever order the modules are checked in.
 */
import ts from "typescript";
import { CompileError } from "../diagnostics.js";
import { BOOL, F64, I32, I64, STRING, StaticType, sameType, typeToString } from "../types.js";

/** The folded value of a module constant, always exactly one of four shapes. */
export type ConstValue =
  | { kind: "int"; type: StaticType; value: bigint }
  | { kind: "f64"; value: number }
  | { kind: "bool"; value: boolean }
  | { kind: "string"; value: string };

export type ConstInfo = {
  name: string;
  type: StaticType;
  decl: ts.VariableDeclaration;
  exported: boolean;
  /**
   * The constants visible where this one was declared, so an initialiser can
   * name an earlier constant of the same module or one it imported. Shared
   * with the declaring module's checker, and complete before anything folds.
   */
  scope: Map<string, ConstInfo>;
  /**
   * `--wrapping` was given, so integer folding wraps at the width instead of
   * refusing an overflow. Recorded per constant because the fold happens long
   * after the flags are parsed and `ConstInfo` is all the folder is handed.
   */
  wrapping: boolean;
  /** Memoised fold; `"folding"` while in progress, which is how a cycle is caught. */
  value?: ConstValue | "folding";
};

const INT_RANGE: Record<string, { min: bigint; max: bigint }> = {
  i32: { min: -(2n ** 31n), max: 2n ** 31n - 1n },
  i64: { min: -(2n ** 63n), max: 2n ** 63n - 1n },
};

export const typeOfValue = (v: ConstValue): StaticType => {
  if (v.kind === "int") return v.type;
  if (v.kind === "f64") return F64;
  return v.kind === "bool" ? BOOL : STRING;
};

/**
 * Fold `info`'s initialiser, once. Errors carry the declaring module's source
 * file, so a bad constant is reported against the file that wrote it even when
 * an importer triggered the fold.
 */
export const constValue = (info: ConstInfo): ConstValue => {
  if (info.value === "folding") {
    throw error(`Module constant \`${info.name}\` is defined in terms of itself`, info.decl, info);
  }
  if (info.value !== undefined) return info.value;
  info.value = "folding";
  let folded: ConstValue;
  try {
    folded = fold(info.decl.initializer!, info.type, info.scope, info.decl.getSourceFile(), info.wrapping);
  } catch (e) {
    info.value = undefined; // let a second reference report the same error rather than a stale `"folding"`
    throw e;
  }
  info.value = undefined;
  const actual = typeOfValue(folded);
  if (!sameType(actual, info.type)) {
    throw error(
      `Module constant \`${info.name}\` is declared ${typeToString(info.type)} but its value is ${typeToString(actual)}`,
      info.decl.initializer!,
      info
    );
  }
  if (folded.kind === "int") {
    const range = INT_RANGE[folded.type.kind];
    if (folded.value < range.min || folded.value > range.max) {
      throw error(
        `Constant \`${info.name}\` does not fit in ${typeToString(info.type)}`,
        info.decl.initializer!,
        info
      );
    }
  }
  info.value = folded;
  return folded;
};

const error = (message: string, node: ts.Node, info: ConstInfo): CompileError =>
  new CompileError(message, node, info.decl.getSourceFile());

/**
 * `expected` is the type the value is being folded *into*, threaded down so a
 * bare integer literal takes the width it is stored in: `const N: i64 = 3` is
 * an `i64` three. It is a hint, never a coercion — the result is checked
 * against the annotation by `constValue`, and mixing widths inside the
 * expression is still an error.
 */
const fold = (
  expr: ts.Expression,
  expected: StaticType,
  scope: Map<string, ConstInfo>,
  sf: ts.SourceFile,
  wrapping: boolean
): ConstValue => {
  if (ts.isParenthesizedExpression(expr)) return fold(expr.expression, expected, scope, sf, wrapping);
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return { kind: "string", value: expr.text };
  }
  if (expr.kind === ts.SyntaxKind.TrueKeyword) return { kind: "bool", value: true };
  if (expr.kind === ts.SyntaxKind.FalseKeyword) return { kind: "bool", value: false };
  if (ts.isNumericLiteral(expr)) return foldNumericLiteral(expr, expected, sf);
  if (ts.isIdentifier(expr)) {
    const target = scope.get(expr.text);
    if (!target) {
      throw new CompileError(
        `\`${expr.text}\` is not a module constant, and a module constant's value must be known at compile time`,
        expr,
        sf
      );
    }
    return constValue(target);
  }
  if (ts.isPrefixUnaryExpression(expr)) return foldUnary(expr, expected, scope, sf, wrapping);
  if (ts.isBinaryExpression(expr)) return foldBinary(expr, expected, scope, sf, wrapping);
  throw new CompileError(
    "A module constant's initialiser must be a literal, another constant, or arithmetic over them",
    expr,
    sf
  );
};

const foldNumericLiteral = (expr: ts.NumericLiteral, expected: StaticType, sf: ts.SourceFile): ConstValue => {
  if (expected.kind === "f64") return { kind: "f64", value: Number(expr.text) };
  if (!Number.isInteger(Number(expr.text))) {
    throw new CompileError(
      `Non-integer literal \`${expr.text}\` in a constant of integer type (annotate it \`f64\`)`,
      expr,
      sf
    );
  }
  // Read the digits rather than `Number(text)`, which has already rounded past 2^53.
  const type = expected.kind === "i64" ? I64 : I32;
  return { kind: "int", type, value: BigInt(expr.text) };
};

const foldUnary = (
  expr: ts.PrefixUnaryExpression,
  expected: StaticType,
  scope: Map<string, ConstInfo>,
  sf: ts.SourceFile,
  wrapping: boolean
): ConstValue => {
  const operand = fold(expr.operand, expected, scope, sf, wrapping);
  if (expr.operator === ts.SyntaxKind.MinusToken) {
    if (operand.kind === "int")
      return { kind: "int", type: operand.type, value: narrow(-operand.value, operand.type, expr, sf, wrapping) };
    if (operand.kind === "f64") return { kind: "f64", value: -operand.value };
  }
  if (expr.operator === ts.SyntaxKind.ExclamationToken && operand.kind === "bool") {
    return { kind: "bool", value: !operand.value };
  }
  throw new CompileError(
    `Unsupported unary operator \`${ts.tokenToString(expr.operator)}\` on ${typeToString(typeOfValue(operand))} in a constant`,
    expr,
    sf
  );
};

const COMPARISONS: Record<number, (a: bigint | number, b: bigint | number) => boolean> = {
  [ts.SyntaxKind.LessThanToken]: (a, b) => a < b,
  [ts.SyntaxKind.LessThanEqualsToken]: (a, b) => a <= b,
  [ts.SyntaxKind.GreaterThanToken]: (a, b) => a > b,
  [ts.SyntaxKind.GreaterThanEqualsToken]: (a, b) => a >= b,
};

const foldBinary = (
  expr: ts.BinaryExpression,
  expected: StaticType,
  scope: Map<string, ConstInfo>,
  sf: ts.SourceFile,
  wrapping: boolean
): ConstValue => {
  const op = expr.operatorToken.kind;
  // Comparisons and `===` yield a boolean, so `expected` says nothing about
  // the operands; a bare literal on one side then takes its width from the
  // other side, which is what makes `KIND === 3` fold with `KIND: i64`.
  const yieldsBool =
    op in COMPARISONS ||
    op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
    op === ts.SyntaxKind.ExclamationEqualsEqualsToken;
  const operandHint = yieldsBool ? undefined : expected;
  const literalLeft = ts.isNumericLiteral(expr.left) && !ts.isNumericLiteral(expr.right);
  let a: ConstValue;
  let b: ConstValue;
  if (literalLeft) {
    b = fold(expr.right, operandHint ?? I32, scope, sf, wrapping);
    a = fold(expr.left, operandHint ?? typeOfValue(b), scope, sf, wrapping);
  } else {
    a = fold(expr.left, operandHint ?? I32, scope, sf, wrapping);
    b = fold(expr.right, operandHint ?? typeOfValue(a), scope, sf, wrapping);
  }

  if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken) {
    if (a.kind !== "bool" || b.kind !== "bool") {
      throw new CompileError(
        `Operator \`${ts.tokenToString(op)}\` in a constant requires boolean operands`,
        expr,
        sf
      );
    }
    const value = op === ts.SyntaxKind.AmpersandAmpersandToken ? a.value && b.value : a.value || b.value;
    return { kind: "bool", value };
  }
  requireSameType(a, b, op, expr, sf);
  if (op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
    const eq = a.value === b.value;
    return { kind: "bool", value: op === ts.SyntaxKind.EqualsEqualsEqualsToken ? eq : !eq };
  }
  if (op === ts.SyntaxKind.PlusToken && a.kind === "string" && b.kind === "string") {
    return { kind: "string", value: a.value + b.value };
  }
  if (a.kind === "bool" || a.kind === "string") {
    throw new CompileError(
      `Operator \`${ts.tokenToString(op)}\` is not available on ${typeToString(typeOfValue(a))} in a constant`,
      expr,
      sf
    );
  }
  const compare = COMPARISONS[op];
  if (compare) return { kind: "bool", value: compare(a.value, (b as typeof a).value) };
  if (a.kind === "f64")
    return { kind: "f64", value: foldFloat(op, a.value, (b as typeof a).value, expr, sf) };
  return foldInt(op, a, b as typeof a, expr, sf, wrapping);
};

const foldInt = (
  op: ts.SyntaxKind,
  a: ConstValue & { kind: "int" },
  b: ConstValue & { kind: "int" },
  expr: ts.Expression,
  sf: ts.SourceFile,
  wrapping: boolean
): ConstValue => {
  if (op === ts.SyntaxKind.SlashToken || op === ts.SyntaxKind.PercentToken) {
    // The same two failures the emitted divisor check catches at run time
    // (`docs/LANGUAGE.md`, "Checked integer division"), refused at compile time.
    if (b.value === 0n) throw new CompileError("attempt to divide by zero in a constant", expr, sf);
    const min = INT_RANGE[a.type.kind].min;
    if (a.value === min && b.value === -1n) {
      throw new CompileError("attempt to divide with overflow in a constant", expr, sf);
    }
    const q = op === ts.SyntaxKind.SlashToken ? a.value / b.value : a.value % b.value;
    return { kind: "int", type: a.type, value: q }; // bigint `/` truncates, like `sdiv`
  }
  const apply =
    op === ts.SyntaxKind.PlusToken
      ? (x: bigint, y: bigint) => x + y
      : op === ts.SyntaxKind.MinusToken
        ? (x: bigint, y: bigint) => x - y
        : op === ts.SyntaxKind.AsteriskToken
          ? (x: bigint, y: bigint) => x * y
          : undefined;
  if (!apply)
    throw new CompileError(`Unsupported operator \`${ts.tokenToString(op)}\` in a constant`, expr, sf);
  // Folding follows the language's own arithmetic, whichever it is today: the
  // fold and the `add`/`sub`/`mul` it replaces must agree, or a constant would
  // be a second, quieter semantics (`docs/LANGUAGE.md`, "Module constants").
  return { kind: "int", type: a.type, value: narrow(apply(a.value, b.value), a.type, expr, sf, wrapping) };
};

const foldFloat = (
  op: ts.SyntaxKind,
  x: number,
  y: number,
  expr: ts.Expression,
  sf: ts.SourceFile
): number => {
  if (op === ts.SyntaxKind.PlusToken) return x + y;
  if (op === ts.SyntaxKind.MinusToken) return x - y;
  if (op === ts.SyntaxKind.AsteriskToken) return x * y;
  if (op === ts.SyntaxKind.SlashToken) return x / y; // IEEE-754: `1 / 0` is Infinity, never an error
  if (op === ts.SyntaxKind.PercentToken) return x % y;
  throw new CompileError(`Unsupported operator \`${ts.tokenToString(op)}\` on f64 in a constant`, expr, sf);
};

const requireSameType = (
  a: ConstValue,
  b: ConstValue,
  op: ts.SyntaxKind,
  expr: ts.Expression,
  sf: ts.SourceFile
): void => {
  if (sameType(typeOfValue(a), typeOfValue(b))) return;
  throw new CompileError(
    `Operator \`${ts.tokenToString(op)}\` in a constant requires two operands of the same type, got ${typeToString(typeOfValue(a))} and ${typeToString(typeOfValue(b))}`,
    expr,
    sf
  );
};

/**
 * Bring an exact `bigint` result back into the type, the way the instruction
 * it replaces would.
 *
 * Under `--wrapping` that instruction wraps, so the fold wraps. By default it
 * carries `nsw`, so signed overflow at run time is undefined — and a compiler
 * that quietly folded `2147483647 + 1` to `-2147483648` would be handing back
 * the one answer the optimiser is entitled to assume cannot happen. It is
 * refused instead, which is the treatment the two divisor failures above
 * already get: what traps at run time is a compile error once the operands are
 * known.
 */
const narrow = (
  value: bigint,
  type: StaticType,
  expr: ts.Expression,
  sf: ts.SourceFile,
  wrapping: boolean
): bigint => {
  if (wrapping) return wrap(value, type);
  const range = INT_RANGE[type.kind];
  if (value < range.min || value > range.max) {
    throw new CompileError(
      `attempt to compute with overflow in a constant: the result does not fit in ${typeToString(type)} (use --wrapping for two's-complement arithmetic)`,
      expr,
      sf
    );
  }
  return value;
};

const wrap = (value: bigint, type: StaticType): bigint => {
  const modulus = 1n << (type.kind === "i64" ? 64n : 32n);
  const masked = ((value % modulus) + modulus) % modulus;
  return masked >= modulus >> 1n ? masked - modulus : masked;
};
