/**
 * Arrays (WP4): `T[]` / `Array<T>` with one fixed element type.
 *
 *   [a, b, c]            every element has the same type; `[]` takes its type
 *                        from the context (a `T[]` annotation on the variable,
 *                        the function's return type, an assignment target, an
 *                        enclosing literal, or the parameter it is passed to)
 *                        and is an error without one.
 *   new Array<T>(n)      `n` elements, zero-initialised (no holes).
 *   a[i]                 `i` is a number; the element type. Bounds are checked
 *                        at run time (see docs/wp4-arrays.md).
 *   a[i] = v, a[i] op= v element writes; `const` only freezes the binding, not
 *                        the contents (as in JavaScript).
 *   a.length             a number, read-only.
 *   a.push(v)            appends, returns the new length.
 *   for (const x of a)   `x` has the element type; `let x` makes it mutable.
 *
 * Registration: `arrayExpressionCheckers` / `arrayStatementCheckers` are spread
 * into the core tables; the member entries register themselves at load; and
 * `installArrayAssignmentCheckers` wraps whatever `=` / `op=` handlers are
 * already in the binary table so element targets are handled here and every
 * other target keeps going to the previous handler.
 */
import ts from "typescript";
import { F64, I32, StaticType, arrayOf, assignable, isNumeric, llvmType, resolveTypeNode, sameType, typeToString } from "../types";
import {
  BinaryChecker,
  CheckContext,
  CheckerTable,
  ExpressionChecker,
  LoopInfo,
  StatementChecker,
} from "./context";
import { isValueReceiver, methodCallCheckers, newCheckers, propertyCheckers } from "./members";
import { invalidateNarrowings } from "./nullable";
import { LocalVar } from "./program";
import { Scope } from "./scope";

/** Assignment operators that may target an element: `=` and the numeric compound forms. */
export const ELEMENT_ASSIGNMENT_OPERATORS: readonly ts.SyntaxKind[] = [
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
];

function numberType(ctx: CheckContext): StaticType {
  return ctx.opts.numberMode === "f64" ? F64 : I32;
}

function unwrapParens(expr: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(expr)) expr = expr.expression;
  return expr;
}

// ---- Contextual typing (only `[]` needs it) ------------------------------------

/**
 * The type the syntactic position of `expr` expects, or undefined. Receivers
 * (`m[i] = []`, `xs.push([])`) are already checked and recorded by the time
 * the right-hand side or argument is checked, so their types are read back
 * from the side table rather than checked twice.
 */
function contextualType(ctx: CheckContext, expr: ts.Expression, scope: Scope): StaticType | undefined {
  let node: ts.Node = expr;
  while (ts.isParenthesizedExpression(node.parent)) node = node.parent;
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && parent.initializer === node) {
    return parent.type ? resolveTypeNode(parent.type, ctx.sf, ctx.opts) : undefined;
  }
  if (ts.isReturnStatement(parent)) return ctx.current.returnType;
  if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && parent.right === node) {
    const target = unwrapParens(parent.left);
    if (ts.isIdentifier(target)) return scope.lookup(target.text)?.type;
    if (ts.isElementAccessExpression(target)) {
      const base = ctx.program.types.get(target.expression);
      return base?.kind === "array" ? base.elem : undefined;
    }
    return undefined;
  }
  if (ts.isArrayLiteralExpression(parent)) {
    const outer = contextualType(ctx, parent, scope);
    return outer?.kind === "array" ? outer.elem : undefined;
  }
  if (ts.isCallExpression(parent)) {
    const index = parent.arguments.indexOf(node as ts.Expression);
    if (ts.isIdentifier(parent.expression)) return ctx.sigs.get(parent.expression.text)?.params[index]?.type;
    if (ts.isPropertyAccessExpression(parent.expression) && parent.expression.name.text === "push") {
      const receiver = ctx.program.types.get(parent.expression.expression);
      return receiver?.kind === "array" ? receiver.elem : undefined;
    }
  }
  return undefined;
}

// ---- Expressions ------------------------------------------------------------------

const checkArrayLiteral: ExpressionChecker = (ctx, node, scope) => {
  const expr = node as ts.ArrayLiteralExpression;
  if (expr.elements.length === 0) {
    const want = contextualType(ctx, expr, scope);
    if (want?.kind !== "array") {
      throw ctx.error("Empty array literal needs a type annotation, e.g. `const xs: number[] = []`", expr);
    }
    return want;
  }
  let elem: StaticType | undefined;
  for (const element of expr.elements) {
    if (ts.isSpreadElement(element)) throw ctx.error("Spread in array literals is not supported", element);
    if (ts.isOmittedExpression(element)) throw ctx.error("Holes in array literals are not supported", element);
    const t = ctx.checkExpression(element, scope);
    if (t.kind === "void") throw ctx.error("Array elements cannot be void", element);
    if (elem === undefined) elem = t;
    else if (!sameType(elem, t)) {
      throw ctx.error(
        `Array literal elements must all have the same type, got ${typeToString(elem)} and ${typeToString(t)}`,
        element
      );
    }
  }
  return arrayOf(elem!);
};

/** `a[i]`: `a` an array, `i` a number; yields the element type (also used for the target of `a[i] = v`). */
const checkElementAccess: ExpressionChecker = (ctx, node, scope) => {
  const expr = node as ts.ElementAccessExpression;
  const base = ctx.checkExpression(expr.expression, scope);
  if (base.kind === "nullable") {
    throw ctx.error(`Cannot index \`${typeToString(base)}\`; check for null first: \`if (a !== null) { ... }\``, expr.expression);
  }
  if (base.kind !== "array") {
    throw ctx.error(`Cannot index a value of type ${typeToString(base)} (only arrays can be indexed)`, expr.expression);
  }
  const index = ctx.checkExpression(expr.argumentExpression, scope);
  if (!isNumeric(index)) {
    throw ctx.error(`Array index must be a number, got ${typeToString(index)}`, expr.argumentExpression);
  }
  return base.elem;
};

// ---- Members ------------------------------------------------------------------------

propertyCheckers.array = (ctx, expr, receiver) => {
  if (expr.name.text === "length") return numberType(ctx);
  throw ctx.error(`Unknown property \`${expr.name.text}\` on ${typeToString(receiver)}`, expr.name);
};

methodCallCheckers.array = (ctx, expr, receiver, scope) => {
  const access = expr.expression as ts.PropertyAccessExpression;
  if (access.name.text !== "push") {
    throw ctx.error(`Unknown method \`${access.name.text}\` on ${typeToString(receiver)} (supported: push)`, access.name);
  }
  if (receiver.kind !== "array") throw ctx.error("internal: array method on non-array", expr);
  if (expr.arguments.length !== 1) {
    throw ctx.error(`\`push\` expects exactly 1 argument, got ${expr.arguments.length}`, expr);
  }
  const t = ctx.checkExpression(expr.arguments[0], scope);
  if (!assignable(t, receiver.elem)) {
    throw ctx.error(`Cannot push ${typeToString(t)} onto ${typeToString(receiver)}`, expr.arguments[0]);
  }
  return numberType(ctx);
};

/** `new Array<T>(n)`: the type argument is required (there is no inference from later pushes). */
newCheckers.Array = (ctx, expr, scope) => {
  if (expr.typeArguments?.length !== 1) {
    throw ctx.error("`new Array` needs exactly one type argument, e.g. `new Array<number>(n)`", expr);
  }
  const elem = resolveTypeNode(expr.typeArguments[0], ctx.sf, ctx.opts);
  if (elem.kind === "void") throw ctx.error("Array elements cannot be void", expr.typeArguments[0]);
  // Zero-filling is only a valid value for scalars and for `T | null` (a zero
  // pointer *is* `null`, WP6); a zeroed plain string / array would be a null
  // value StaticTS has no way to represent or check for.
  if (llvmType(elem).endsWith("*") && elem.kind !== "nullable") {
    throw ctx.error(
      `\`new Array<${typeToString(elem)}>(n)\` would zero-fill with null ${typeToString(elem)} values; build it with \`[]\` and \`push\` instead`,
      expr
    );
  }
  const args = expr.arguments ?? [];
  if (args.length !== 1) {
    throw ctx.error(`\`new Array<T>(n)\` expects exactly 1 argument (the length), got ${args.length}`, expr);
  }
  const n = ctx.checkExpression(args[0], scope);
  if (!isNumeric(n)) throw ctx.error(`Array length must be a number, got ${typeToString(n)}`, args[0]);
  return arrayOf(elem);
};

// ---- Element assignment `a[i] = v`, `a[i] op= v` ---------------------------------------

function checkElementAssignment(ctx: CheckContext, expr: ts.BinaryExpression, scope: Scope): StaticType {
  const elem = ctx.checkExpression(expr.left, scope); // records the base and index types
  const rhs = ctx.checkExpression(expr.right, scope);
  const op = expr.operatorToken.kind;
  if (op === ts.SyntaxKind.EqualsToken) {
    if (!assignable(rhs, elem)) {
      throw ctx.error(
        `Cannot assign ${typeToString(rhs)} to an element of ${typeToString(ctx.program.types.get((expr.left as ts.ElementAccessExpression).expression)!)}`,
        expr.right
      );
    }
    return elem;
  }
  if (!isNumeric(elem) || !sameType(rhs, elem)) {
    throw ctx.error(
      `Operator \`${ts.tokenToString(op)}\` requires two operands of the same numeric type, got ${typeToString(elem)} and ${typeToString(rhs)}`,
      expr
    );
  }
  return elem;
}

/** `a.length = n` is the one property write an array could tempt; reject it with a pointer to `push`. */
function rejectLengthAssignment(ctx: CheckContext, expr: ts.BinaryExpression, scope: Scope): void {
  const left = unwrapParens(expr.left);
  if (!ts.isPropertyAccessExpression(left) || left.name.text !== "length") return;
  if (!isValueReceiver(left.expression, scope)) return;
  const receiver = ctx.checkExpression(left.expression, scope);
  if (receiver.kind === "array") {
    throw ctx.error(`Cannot assign to \`length\` of ${typeToString(receiver)} (array length is read-only; use \`push\`)`, left);
  }
}

/**
 * Wrap the assignment operators already in `table`: element targets are
 * handled here, everything else goes to the handler that was registered
 * before (so a property-target path installed by another family composes).
 */
export function installArrayAssignmentCheckers(table: CheckerTable<BinaryChecker>): void {
  for (const op of ELEMENT_ASSIGNMENT_OPERATORS) {
    const previous = table[op];
    if (!previous) continue;
    table[op] = (ctx, expr, scope) => {
      if (ts.isElementAccessExpression(unwrapParens(expr.left))) {
        return checkElementAssignment(ctx, { ...expr, left: unwrapParens(expr.left) } as ts.BinaryExpression, scope);
      }
      rejectLengthAssignment(ctx, expr, scope);
      return previous(ctx, expr, scope);
    };
  }
}

// ---- `for (const x of a)` ------------------------------------------------------------------

const checkForOf: StatementChecker = (ctx, node, scope) => {
  const stmt = node as ts.ForOfStatement;
  if (stmt.awaitModifier) throw ctx.error("`for await` is not supported", stmt.awaitModifier);
  if (!ts.isVariableDeclarationList(stmt.initializer)) {
    throw ctx.error("`for...of` needs a `const` or `let` declaration, e.g. `for (const x of xs)`", stmt.initializer);
  }
  const list = stmt.initializer;
  if (!(list.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const))) throw ctx.error("`var` is forbidden; use `let` or `const`", list);
  if (list.declarations.length !== 1) throw ctx.error("`for...of` declares exactly one variable", list);
  const decl = list.declarations[0];
  if (!ts.isIdentifier(decl.name)) throw ctx.error("Destructuring is not supported", decl.name);
  if (decl.type) throw ctx.error("The `for...of` variable takes the element type; remove the annotation", decl.type);
  if (decl.initializer) throw ctx.error("The `for...of` variable cannot have an initializer", decl.initializer);

  invalidateNarrowings(scope, stmt); // WP6: an assignment in the body ends a `p !== null` narrowing
  const iterable = ctx.checkExpression(stmt.expression, scope);
  if (iterable.kind !== "array") {
    throw ctx.error(`\`for...of\` requires an array, got ${typeToString(iterable)}`, stmt.expression);
  }
  const loopScope = scope.child();
  const v: LocalVar = {
    name: decl.name.text,
    type: iterable.elem,
    mutable: (list.flags & ts.NodeFlags.Const) === 0,
    storage: "local",
  };
  loopScope.declare(v, decl.name, ctx.sf);
  ctx.program.locals.set(decl, v);

  const loop: LoopInfo = { hasBreak: false };
  ctx.loops.push(loop);
  if (ts.isBlock(stmt.statement)) ctx.checkBlock(stmt.statement, loopScope);
  else ctx.checkStatement(stmt.statement, loopScope.child());
  ctx.loops.pop();
  return false; // an empty array runs the body zero times
};

// ---- Registration ------------------------------------------------------------------------

export const arrayExpressionCheckers: CheckerTable<ExpressionChecker> = {
  [ts.SyntaxKind.ArrayLiteralExpression]: checkArrayLiteral,
  [ts.SyntaxKind.ElementAccessExpression]: checkElementAccess,
};

export const arrayStatementCheckers: CheckerTable<StatementChecker> = {
  [ts.SyntaxKind.ForOfStatement]: checkForOf,
};
