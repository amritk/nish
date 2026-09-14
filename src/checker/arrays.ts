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
import {
  F64,
  I32,
  STRING,
  StaticType,
  TYPED_ARRAY_ALIASES,
  arrayOf,
  assignable,
  isNumeric,
  isReadonlyArray,
  llvmType,
  rejectForeignPointer,
  resolveTypeNode,
  sameType,
  typeToString,
} from "../types.js";
import {
  BinaryChecker,
  CheckContext,
  CheckerTable,
  ExpressionChecker,
  LoopInfo,
  StatementChecker,
} from "./context.js";
import { checkBitwiseAssignOperands, isBitwiseCompoundOperator } from "./bitwise.js";
import { checkArgumentType, checkArity } from "./builtins.js";
import { structOf } from "./classes.js";
import { isFunctionResult } from "./declarations.js";
import { isValueReceiver, methodCallCheckers, newCheckers, propertyCheckers } from "./members.js";
import { invalidateNarrowings } from "./narrowing.js";
import { FunctionSig, LocalVar, inlineElementStruct } from "./program.js";
import { Scope } from "./scope.js";
import { CompileError } from "../diagnostics.js";

/** Assignment operators that may target an element: `=` and the compound forms, numeric and bitwise. */
export const ELEMENT_ASSIGNMENT_OPERATORS: readonly ts.SyntaxKind[] = [
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
  ts.SyntaxKind.AmpersandEqualsToken,
  ts.SyntaxKind.BarEqualsToken,
  ts.SyntaxKind.CaretEqualsToken,
  ts.SyntaxKind.LessThanLessThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
];

function numberType(ctx: CheckContext): StaticType {
  return ctx.opts.numberMode === "f64" ? F64 : I32;
}

function unwrapParens(expr: ts.Expression): ts.Expression {
  let inner = expr;
  while (ts.isParenthesizedExpression(inner)) inner = inner.expression;
  return inner;
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
  if (isFunctionResult(node)) return ctx.current.returnType;
  if (
    ts.isBinaryExpression(parent) &&
    parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    parent.right === node
  ) {
    const target = unwrapParens(parent.left);
    if (ts.isIdentifier(target)) return scope.lookup(target.text)?.type;
    if (ts.isElementAccessExpression(target)) {
      const base = ctx.program.types.get(target.expression);
      return base?.kind === "array" ? base.elem : undefined;
    }
    // `this.children = []`: a field is an annotated target like any other, and
    // a constructor filling an array field is the ordinary way to write one,
    // because a field *initializer* may only be a literal (WP2).
    if (ts.isPropertyAccessExpression(target)) return fieldType(ctx, target);
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

/** The declared type of `recv.f`, or undefined when `recv` is not a struct. */
function fieldType(ctx: CheckContext, target: ts.PropertyAccessExpression): StaticType | undefined {
  const receiver = ctx.program.types.get(target.expression);
  if (receiver?.kind !== "struct") return undefined;
  return structOf(ctx, receiver).fieldsByName.get(target.name.text)?.type;
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
    if (ts.isOmittedExpression(element))
      throw ctx.error("Holes in array literals are not supported", element);
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
    throw ctx.error(
      `Cannot index \`${typeToString(base)}\`; check for null first: \`if (a !== null) { ... }\``,
      expr.expression
    );
  }
  if (base.kind !== "array") {
    throw ctx.error(
      `Cannot index a value of type ${typeToString(base)} (only arrays can be indexed)`,
      expr.expression
    );
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

/** The method set, in the order the "supported:" message lists them. */
export const ARRAY_METHODS = ["push", "pop", "indexOf", "join"];

/**
 * The one rule a `readonly T[]` adds: it is the same array, so every read still
 * works, and no write does. `push` and `pop` are the two methods that write;
 * element stores are caught in `checkElementAssignment`, and `a.length = n` was
 * already refused for every array.
 *
 * The message names the fix rather than the rule, because the caller is almost
 * always holding a mutable array that widened on the way in: the parameter's
 * annotation is what has to change, not the call.
 */
function rejectWriteThroughReadonly(
  ctx: CheckContext,
  expr: ts.Node,
  receiver: StaticType,
  what: string
): void {
  if (!isReadonlyArray(receiver)) return;
  const mutable = typeToString(arrayOf((receiver as { elem: StaticType }).elem));
  throw ctx.error(
    `Cannot \`${what}\` through ${typeToString(receiver)} (declare it ${mutable} to write through it)`,
    expr
  );
}

methodCallCheckers.array = (ctx, expr, receiver, scope) => {
  const access = expr.expression as ts.PropertyAccessExpression;
  const name = access.name.text;
  if (receiver.kind !== "array") throw ctx.error("internal: array method on non-array", expr);
  switch (name) {
    case "push": {
      rejectWriteThroughReadonly(ctx, expr, receiver, "push");
      checkArity(ctx, expr, "push", 1);
      const t = ctx.checkExpression(expr.arguments[0], scope);
      if (!assignable(t, receiver.elem)) {
        throw ctx.error(`Cannot push ${typeToString(t)} onto ${typeToString(receiver)}`, expr.arguments[0]);
      }
      return numberType(ctx);
    }
    case "pop":
      // There is no `undefined`, so an empty array is a panic rather than
      // a second return type; the check is the one `a[i]` already pays for.
      rejectWriteThroughReadonly(ctx, expr, receiver, "pop");
      checkArity(ctx, expr, "pop", 0);
      return receiver.elem;
    case "indexOf": {
      checkArity(ctx, expr, "indexOf", 1);
      const t = ctx.checkExpression(expr.arguments[0], scope);
      if (!assignable(t, receiver.elem)) {
        throw ctx.error(
          `\`indexOf\` expects ${typeToString(receiver.elem)} (the element type of ${typeToString(receiver)}), got ${typeToString(t)}`,
          expr.arguments[0]
        );
      }
      return numberType(ctx);
    }
    case "join":
      // `string[]` only: that is the shape that joins in one pass over the
      // lengths and one memcpy per part. Converting elements would mean an
      // allocation each, which is the quadratic shape `join` exists to avoid
      // (docs/wp14-selfhost.md §3).
      if (receiver.elem.kind !== "string") {
        throw ctx.error(
          `\`join\` requires string[], got ${typeToString(receiver)} (build the parts with template literals first)`,
          access.name
        );
      }
      if (expr.arguments.length > 1) {
        throw ctx.error(`\`join\` expects 0 or 1 arguments, got ${expr.arguments.length}`, expr);
      }
      if (expr.arguments.length === 1) checkArgumentType(ctx, expr.arguments[0], scope, "join", STRING);
      return STRING;
    default:
      throw ctx.error(
        `Unknown method \`${name}\` on ${typeToString(receiver)} (supported: ${ARRAY_METHODS.join(", ")})`,
        access.name
      );
  }
};

/** `new Array<T>(n)`: the type argument is required (there is no inference from later pushes). */
newCheckers.Array = (ctx, expr, scope) => {
  if (expr.typeArguments?.length !== 1) {
    throw ctx.error("`new Array` needs exactly one type argument, e.g. `new Array<number>(n)`", expr);
  }
  const elem = resolveTypeNode(expr.typeArguments[0], ctx.sf, ctx.opts);
  rejectForeignPointer(elem, "an array element", expr.typeArguments[0], ctx.sf);
  return checkNewArray(ctx, expr, scope, elem);
};

/** `new Int32Array(n)` / `new Float64Array(n)` / `new BigInt64Array(n)`: `new Array<T>(n)` with `T` fixed by the name. */
for (const [name, elem] of Object.entries(TYPED_ARRAY_ALIASES)) {
  newCheckers[name] = (ctx, expr, scope) => {
    if (expr.typeArguments) {
      throw ctx.error(
        `\`new ${name}\` takes no type argument (it is \`new Array<${typeToString(elem)}>(n)\`)`,
        expr
      );
    }
    return checkNewArray(ctx, expr, scope, elem);
  };
}

function checkNewArray(
  ctx: CheckContext,
  expr: ts.NewExpression,
  scope: Scope,
  elem: StaticType
): StaticType {
  if (elem.kind === "void") throw ctx.error("Array elements cannot be void", expr.typeArguments?.[0] ?? expr);
  // Zero-filling is only a valid value for scalars and for `T | null` (a zero
  // pointer *is* `null`, WP6); a zeroed plain string / array would be a null
  // value the language has no way to represent or check for.
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
}

// ---- Element assignment `a[i] = v`, `a[i] op= v` ---------------------------------------

/**
 * `target` is `expr.left` with any parentheses peeled off; `expr` itself stays
 * the real binary node, because a diagnostic needs a node with a source span
 * and a synthesised stand-in has none.
 */
function checkElementAssignment(
  ctx: CheckContext,
  expr: ts.BinaryExpression,
  target: ts.ElementAccessExpression,
  scope: Scope
): StaticType {
  const elem = ctx.checkExpression(target, scope); // records the base and index types
  const base = ctx.program.types.get(target.expression);
  if (base !== undefined && isReadonlyArray(base)) {
    const mutable = typeToString(arrayOf((base as { elem: StaticType }).elem));
    throw ctx.error(
      `Cannot assign to an element of ${typeToString(base)} (declare it ${mutable} to write through it)`,
      target
    );
  }
  const rhs = ctx.checkExpression(expr.right, scope);
  const op = expr.operatorToken.kind;
  if (op === ts.SyntaxKind.EqualsToken) {
    if (!assignable(rhs, elem)) {
      throw ctx.error(
        `Cannot assign ${typeToString(rhs)} to an element of ${typeToString(ctx.program.types.get(target.expression)!)}`,
        expr.right
      );
    }
    return elem;
  }
  // `a[i] &= e` and the rest of the bitwise family: the element is the target,
  // so the operand rule is `&`'s and the message comes from the same place a
  // local's does.
  if (isBitwiseCompoundOperator(op)) return checkBitwiseAssignOperands(ctx, expr, elem, rhs);
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
  if (!isValueReceiver(ctx, left.expression, scope)) return;
  const receiver = ctx.checkExpression(left.expression, scope);
  if (receiver.kind === "array") {
    throw ctx.error(
      `Cannot assign to \`length\` of ${typeToString(receiver)} (array length is read-only; use \`push\`)`,
      left
    );
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
      const target = unwrapParens(expr.left);
      if (ts.isElementAccessExpression(target)) {
        return checkElementAssignment(ctx, expr, target, scope);
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
    throw ctx.error(
      "`for...of` needs a `const` or `let` declaration, e.g. `for (const x of xs)`",
      stmt.initializer
    );
  }
  const list = stmt.initializer;
  if (!(list.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const)))
    throw ctx.error("`var` is forbidden; use `let` or `const`", list);
  if (list.declarations.length !== 1) throw ctx.error("`for...of` declares exactly one variable", list);
  const decl = list.declarations[0];
  if (!ts.isIdentifier(decl.name)) throw ctx.error("Destructuring is not supported", decl.name);
  if (decl.type)
    throw ctx.error("The `for...of` variable takes the element type; remove the annotation", decl.type);
  if (decl.initializer)
    throw ctx.error("The `for...of` variable cannot have an initializer", decl.initializer);

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

  const loop: LoopInfo = { kind: "loop", hasBreak: false };
  ctx.loops.push(loop);
  if (ts.isBlock(stmt.statement)) ctx.checkBlock(stmt.statement, loopScope);
  else ctx.checkStatement(stmt.statement, loopScope.child());
  ctx.loops.pop();
  return false; // an empty array runs the body zero times
};

// ---- WP15 §2a: element references -----------------------------------------------------------

/**
 * The rule that makes contiguous storage safe: **an element reference may not
 * be held across a mutation of the array it came from.**
 *
 * An array of classes is one block of objects (`inlineElementStruct` in
 * `checker/program.ts`), so `ps[i]` hands out a pointer *into* that block
 * rather than a pointer the array happened to be storing. `push` may move the
 * block — `nish_array_grow` bumps a fresh buffer and copies — and `pop` hands
 * the slot back to the next `push`. Either way a reference taken beforehand
 * names memory that is no longer the element:
 *
 * ```ts
 * const p = ps[0];   // interior pointer into ps's storage
 * ps.push(other);    // may move that storage
 * p.x = 1;           // refused: this would write to the old block
 * ```
 *
 * The analysis is the one `codegen/escape.ts` runs, in the phase that is
 * allowed to report: a source-order walk of one body, references followed from
 * the declaration that binds them through every identifier that names them,
 * with a block's references dropped when the block ends. A loop is the one
 * place source order is not execution order, so a loop is pre-scanned and a
 * reference that is live on the way in is invalidated by any mutation anywhere
 * inside it; a reference *declared* inside the loop (a `const` in the body, or
 * a `for...of` variable, which is re-derived from the header every pass) is
 * fresh each iteration and needs no such treatment.
 *
 * It rejects programs that would have been fine — a call is taken to mutate
 * every mutable array it is handed, because whether the callee pushes is a
 * whole-program question and this phase has no fixpoint — and that is the
 * accepted cost of the layout (WP15 §2a). `readonly T[]` is the way to say a
 * callee does not push, and a `C | null` element array is the way to keep one
 * pointer per slot.
 */
const UNNAMED = "";

/** `xs`, `this.bodies`, `a.b.c` — how two references are told apart; empty when it cannot be named. */
function referenceRoot(expr: ts.Expression): string {
  const inner = unwrapParens(expr);
  if (ts.isIdentifier(inner)) return inner.text;
  if (inner.kind === ts.SyntaxKind.ThisKeyword) return "this";
  if (ts.isPropertyAccessExpression(inner)) {
    const base = referenceRoot(inner.expression);
    return base === UNNAMED ? UNNAMED : `${base}.${inner.name.text}`;
  }
  return UNNAMED;
}

/** How the root is spelled in a message; an unnameable receiver borrows the element type's name. */
function rootText(ctx: CheckContext, expr: ts.Expression): string {
  const root = referenceRoot(expr);
  if (root !== UNNAMED) return root;
  const t = ctx.program.types.get(expr);
  return t === undefined ? "the array" : typeToString(t);
}

/**
 * The class `expr`'s slots hold inline, or undefined when `expr` is not an
 * array that stores its elements by value. The *name* is what two arrays are
 * compared by when one of them cannot be named: element types are exact here
 * (the language has no array covariance), so a `FunctionSig[]` and an
 * `ImportBinding[]` are never the same array however either was spelled.
 */
function inlineArrayElement(ctx: CheckContext, expr: ts.Expression): string | undefined {
  const t = ctx.program.types.get(expr);
  if (t?.kind !== "array") return undefined;
  return inlineElementStruct(ctx.program.structs, t.elem)?.name;
}

/** `expr` is an array whose slots hold their elements inline, so indexing it yields an interior pointer. */
function isInlineArray(ctx: CheckContext, expr: ts.Expression): boolean {
  return inlineArrayElement(ctx, expr) !== undefined;
}

/** The array `expr` reads an element of (`a[i]`, `a.pop()`), or undefined. */
function elementSource(ctx: CheckContext, expr: ts.Expression): ts.Expression | undefined {
  const inner = unwrapParens(expr);
  if (ts.isElementAccessExpression(inner) && isInlineArray(ctx, inner.expression)) return inner.expression;
  if (
    ts.isCallExpression(inner) &&
    ts.isPropertyAccessExpression(inner.expression) &&
    inner.expression.name.text === "pop" &&
    isInlineArray(ctx, inner.expression.expression)
  ) {
    return inner.expression.expression;
  }
  return undefined;
}

/** One array a call may change the length of, named for the message. */
interface Mutation {
  root: string;
  /** The element class, so an unnameable receiver cannot invalidate an unrelated array. */
  elem: string;
  what: string;
}

/**
 * Every inline-element array this call may grow or shorten: the receiver of a
 * `push` / `pop`, and every mutable array argument of a user call, since the
 * callee is free to push through it. A `readonly T[]` parameter is exactly the
 * promise that it does not, and is skipped.
 */
function mutations(ctx: CheckContext, call: ts.CallExpression): Mutation[] {
  const out: Mutation[] = [];
  if (ts.isPropertyAccessExpression(call.expression)) {
    const method = call.expression.name.text;
    const receiver = call.expression.expression;
    const elem = inlineArrayElement(ctx, receiver);
    if ((method === "push" || method === "pop") && elem !== undefined) {
      const name = rootText(ctx, receiver);
      out.push({
        root: referenceRoot(receiver),
        elem,
        what: `${name}.${method}(${method === "push" ? "..." : ""})`,
      });
    }
  }
  const callee = ctx.program.callees.get(call);
  if (!callee) return out;
  const offset = callee.struct ? 1 : 0;
  call.arguments.forEach((arg, i) => {
    const param = callee.params[i + offset];
    const elem = inlineArrayElement(ctx, arg);
    if (!param || elem === undefined || isReadonlyArray(param.type)) return;
    out.push({ root: referenceRoot(arg), elem, what: `${callee.sourceName}(...)` });
  });
  return out;
}

/** A live element reference: the local that names it, the array it points into, and what invalidated it. */
interface ElementRef {
  local: LocalVar;
  array: string;
  elem: string;
  arrayText: string;
  invalidatedBy?: string;
}

/**
 * WP15 §2a. Reported after the body has checked, like the performance
 * warnings, so every type and binding the walk reads is already recorded.
 */
export function checkElementReferences(ctx: CheckContext, sig: FunctionSig): void {
  const live: ElementRef[] = [];
  /**
   * One report per body, which is what `self/`'s error-value threading gives
   * and what keeps the two compilers' diagnostics identical. A body that broke
   * this rule once is poisoned anyway, so the rest would be a cascade.
   */
  let reported = false;
  const refuse = (err: CompileError): void => {
    if (reported) return;
    reported = true;
    ctx.report(err);
  };

  /** Everything `node` may mutate, for the pre-scan of a loop. */
  const mutationsWithin = (node: ts.Node): Mutation[] => {
    const found: Mutation[] = [];
    const scan = (n: ts.Node): void => {
      if (ts.isCallExpression(n)) found.push(...mutations(ctx, n));
      ts.forEachChild(n, scan);
    };
    scan(node);
    return found;
  };

  const invalidate = (m: Mutation): void => {
    for (const ref of live) {
      if (ref.invalidatedBy !== undefined || ref.elem !== m.elem) continue;
      if (m.root === UNNAMED || ref.array === UNNAMED || ref.array === m.root) ref.invalidatedBy = m.what;
    }
  };

  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      const v = ctx.program.bindings.get(node);
      const ref = v === undefined ? undefined : live.find((r) => r.local === v);
      if (ref?.invalidatedBy !== undefined) {
        refuse(
          new CompileError(
            `\`${ref.local.name}\` refers to an element of \`${ref.arrayText}\`, and \`${ref.invalidatedBy}\` may move or reuse that storage; index \`${ref.arrayText}\` again afterwards rather than holding the element across it`,
            node,
            ctx.sf
          )
        );
      }
      return;
    }
    if (ts.isBlock(node) || ts.isCaseClause(node) || ts.isDefaultClause(node)) {
      const depth = live.length;
      ts.forEachChild(node, visit);
      live.length = depth;
      return;
    }
    if (
      ts.isForStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node)
    ) {
      // Source order is not execution order here: a mutation at the bottom of
      // the body reaches a reference taken at the top on the next pass.
      for (const m of mutationsWithin(node)) invalidate(m);
      const depth = live.length;
      // `for (const p of ps)` binds an element reference too. It is re-derived
      // from the header at the top of every pass, so it starts each iteration
      // valid and is only invalidated by a mutation inside the body — which is
      // exactly what the walk below finds in source order.
      if (ts.isForOfStatement(node)) {
        const loopElem = inlineArrayElement(ctx, node.expression);
        const decl = (node.initializer as ts.VariableDeclarationList).declarations[0];
        const local = ctx.program.locals.get(decl);
        if (loopElem !== undefined && local !== undefined) {
          live.push({
            local,
            array: referenceRoot(node.expression),
            elem: loopElem,
            arrayText: rootText(ctx, node.expression),
          });
        }
      }
      ts.forEachChild(node, visit);
      live.length = depth;
      return;
    }
    if (ts.isCallExpression(node)) {
      ts.forEachChild(node, visit);
      for (const m of mutations(ctx, node)) {
        // `xs.push(xs[0])`: the argument is read before `nish_array_grow` runs,
        // and the copy into the new slot reads it after.
        if (m.root !== UNNAMED) {
          for (const arg of node.arguments) {
            const source = elementSource(ctx, arg);
            if (source !== undefined && referenceRoot(source) === m.root) {
              refuse(
                new CompileError(
                  `\`${m.what}\` reads an element of \`${m.root}\`, and the push may move that storage first; copy the fields you need into locals before pushing`,
                  arg,
                  ctx.sf
                )
              );
            }
          }
        }
        invalidate(m);
      }
      return;
    }
    if (ts.isVariableDeclaration(node)) {
      ts.forEachChild(node, visit);
      const local = ctx.program.locals.get(node);
      const source = node.initializer === undefined ? undefined : elementSource(ctx, node.initializer);
      const elem = source === undefined ? undefined : inlineArrayElement(ctx, source);
      if (local !== undefined && source !== undefined && elem !== undefined) {
        live.push({ local, array: referenceRoot(source), elem, arrayText: rootText(ctx, source) });
      }
      return;
    }
    ts.forEachChild(node, visit);
  };

  // WP27 S1: a `declare function` has no body, so it has no locals and no
  // inline arrays to track.
  if (sig.body === undefined) return;
  visit(sig.body);
  // A `for...of` variable over an inline array is an element reference too,
  // re-derived from the header on every pass, so it is only ever invalidated
  // inside its own body — which the loop pre-scan above has already done.
}

// ---- Registration ------------------------------------------------------------------------

export const arrayExpressionCheckers: CheckerTable<ExpressionChecker> = {
  [ts.SyntaxKind.ArrayLiteralExpression]: checkArrayLiteral,
  [ts.SyntaxKind.ElementAccessExpression]: checkElementAccess,
};

export const arrayStatementCheckers: CheckerTable<StatementChecker> = {
  [ts.SyntaxKind.ForOfStatement]: checkForOf,
};
