// Arrays for stage1 (`src/checker/arrays.ts`, docs/wp14-selfhost.md milestone
// S3, pass 2): literals, indexing, `length`, the four methods, `new Array<T>`
// and element assignment.

import { resolveType, typedArrayElement } from "./annotations";
import { checkBuiltinArity } from "./builtins";
import { CheckContext } from "./context";
import { checkExpression } from "./expressions";
import { Node } from "./nodes";
import { Scope } from "./symbols";
import { isNumeric, T_ERROR, T_STRING, T_VOID } from "./types";

/** The method set, in the order the "supported:" message lists them. */
const ARRAY_METHODS: string = "push, pop, indexOf, join";

/** `[a, b]`. An empty literal takes its type from context, since there is nothing to read. */
export function checkArrayLiteral(ctx: CheckContext, expr: Node, scope: Scope, want: i32): i32 {
  if (expr.children.length === 0) {
    if (want < 0 || !ctx.table.isArray(want)) {
      return ctx.errorType(
        expr,
        "Empty array literal needs a type annotation, e.g. `const xs: number[] = []`"
      );
    }
    return want;
  }
  const hint = want >= 0 && ctx.table.isArray(want) ? ctx.table.refOf(want) : -1;
  let elem = -1;
  for (const element of expr.children) {
    const type = checkExpression(ctx, element, scope, hint);
    if (type === T_ERROR) {
      continue;
    }
    if (type === T_VOID) {
      ctx.error(element, "Array elements cannot be void");
      continue;
    }
    if (elem < 0) {
      elem = type;
    } else if (elem !== type) {
      const a = ctx.table.typeName(elem);
      ctx.error(
        element,
        `Array literal elements must all have the same type, got ${a} and ${ctx.table.typeName(type)}`
      );
    }
  }
  return elem < 0 ? T_ERROR : ctx.table.arrayOf(elem);
}

/** `a[i]`, which is also the target of `a[i] = v`. */
export function checkIndex(ctx: CheckContext, expr: Node, scope: Scope): i32 {
  const base = checkExpression(ctx, expr.children[0], scope, -1);
  if (base === T_ERROR) {
    return T_ERROR;
  }
  if (ctx.table.isNullable(base)) {
    return ctx.errorType(
      expr.children[0],
      `Cannot index \`${ctx.table.typeName(base)}\`; check for null first: \`if (a !== null) { ... }\``
    );
  }
  if (!ctx.table.isArray(base)) {
    return ctx.errorType(
      expr.children[0],
      `Cannot index a value of type ${ctx.table.typeName(base)} (only arrays can be indexed)`
    );
  }
  const index = checkExpression(ctx, expr.children[1], scope, ctx.numberType());
  if (index !== T_ERROR && !isNumeric(index)) {
    ctx.error(expr.children[1], `Array index must be a number, got ${ctx.table.typeName(index)}`);
  }
  return ctx.table.refOf(base);
}

/** `a[i] = v` and `a[i] op= v`. */
export function checkIndexAssignment(ctx: CheckContext, expr: Node, scope: Scope): i32 {
  const elem = checkIndex(ctx, expr.children[0], scope);
  ctx.program.nodeTypes[expr.children[0].id] = elem;
  const op = expr.text;
  const value = expr.children[1];
  const rhs = checkExpression(ctx, value, scope, elem);
  if (elem === T_ERROR || rhs === T_ERROR) {
    return T_ERROR;
  }
  if (op === "=") {
    if (!ctx.table.assignable(rhs, elem)) {
      const base = ctx.program.nodeTypes[expr.children[0].children[0].id];
      const spelled = base < 0 ? ctx.table.typeName(ctx.table.arrayOf(elem)) : ctx.table.typeName(base);
      return ctx.errorType(value, `Cannot assign ${ctx.table.typeName(rhs)} to an element of ${spelled}`);
    }
    return elem;
  }
  if (!isNumeric(elem) || rhs !== elem) {
    const a = ctx.table.typeName(elem);
    return ctx.errorType(
      expr,
      `Operator \`${op.substring(0, op.length - 1)}\` requires two operands of the same numeric type, got ${a} and ${ctx.table.typeName(rhs)}`
    );
  }
  return elem;
}

export function checkArrayProperty(ctx: CheckContext, expr: Node, receiver: i32): i32 {
  if (expr.text === "length") {
    return ctx.numberType();
  }
  return ctx.errorType(expr, `Unknown property \`${expr.text}\` on ${ctx.table.typeName(receiver)}`);
}

/** `a.push(v)`, `a.pop()`, `a.indexOf(v)`, `a.join(sep)`. */
export function checkArrayMethod(
  ctx: CheckContext,
  call: Node,
  access: Node,
  args: Node,
  receiver: i32,
  scope: Scope
): i32 {
  const name = access.text;
  const elem = ctx.table.refOf(receiver);
  const spelled = ctx.table.typeName(receiver);
  if (name === "push") {
    if (!checkBuiltinArity(ctx, call, "push", args, 1)) {
      return ctx.numberType();
    }
    const got = checkExpression(ctx, args.children[0], scope, elem);
    if (got !== T_ERROR && !ctx.table.assignable(got, elem)) {
      ctx.error(args.children[0], `Cannot push ${ctx.table.typeName(got)} onto ${spelled}`);
    }
    return ctx.numberType();
  }
  if (name === "pop") {
    // No `undefined` in StaticTS, so an empty array panics rather than adding
    // a second return type; the check is the one `a[i]` already pays for.
    checkBuiltinArity(ctx, call, "pop", args, 0);
    return elem;
  }
  if (name === "indexOf") {
    if (!checkBuiltinArity(ctx, call, "indexOf", args, 1)) {
      return ctx.numberType();
    }
    const got = checkExpression(ctx, args.children[0], scope, elem);
    if (got !== T_ERROR && !ctx.table.assignable(got, elem)) {
      const want = ctx.table.typeName(elem);
      ctx.error(
        args.children[0],
        `\`indexOf\` expects ${want} (the element type of ${spelled}), got ${ctx.table.typeName(got)}`
      );
    }
    return ctx.numberType();
  }
  if (name === "join") {
    // `string[]` only: that is the shape that joins in one pass over the
    // lengths and one memcpy per part. Converting elements would allocate per
    // element, which is the quadratic shape `join` exists to avoid.
    if (elem !== T_STRING) {
      return ctx.errorType(
        access,
        `\`join\` requires string[], got ${spelled} (build the parts with template literals first)`
      );
    }
    if (args.children.length > 1) {
      ctx.error(call, `\`join\` expects 0 or 1 arguments, got ${args.children.length}`);
    } else if (args.children.length === 1) {
      const got = checkExpression(ctx, args.children[0], scope, T_STRING);
      if (got !== T_ERROR && got !== T_STRING) {
        ctx.error(args.children[0], `\`join\` expects string, got ${ctx.table.typeName(got)}`);
      }
    }
    return T_STRING;
  }
  return ctx.errorType(access, `Unknown method \`${name}\` on ${spelled} (supported: ${ARRAY_METHODS})`);
}

/**
 * `new Array<T>(n)` and the typed-array aliases. Answers -1 when `name` is
 * not an array constructor, so `checkNew` can fall through to the classes.
 */
export function checkNewArray(ctx: CheckContext, expr: Node, name: string, scope: Scope): i32 {
  const typeArgs = expr.children[1];
  const args = expr.children[2];
  let elem = -1;
  if (name === "Array") {
    if (typeArgs.children.length !== 1) {
      return ctx.errorType(expr, "`new Array` needs exactly one type argument, e.g. `new Array<number>(n)`");
    }
    elem = resolveType(typeArgs.children[0], ctx);
  } else {
    const alias = typedArrayElement(name);
    if (alias < 0) {
      return -1;
    }
    if (typeArgs.children.length > 0) {
      const spelled = ctx.table.typeName(alias);
      return ctx.errorType(
        expr,
        `\`new ${name}\` takes no type argument (it is \`new Array<${spelled}>(n)\`)`
      );
    }
    elem = alias;
  }
  if (elem === T_VOID) {
    return ctx.errorType(expr, "Array elements cannot be void");
  }
  // Zero-filling is a valid value for scalars and for `T | null` — a zero
  // pointer *is* `null` — but a zeroed plain string or array would be a null
  // value StaticTS has no way to represent or to check for.
  if (ctx.table.isPointer(elem)) {
    const spelled = ctx.table.typeName(elem);
    return ctx.errorType(
      expr,
      `\`new Array<${spelled}>(n)\` would zero-fill with null ${spelled} values; build it with \`[]\` and \`push\` instead`
    );
  }
  if (args.children.length !== 1) {
    return ctx.errorType(
      expr,
      `\`new Array<T>(n)\` expects exactly 1 argument (the length), got ${args.children.length}`
    );
  }
  const length = checkExpression(ctx, args.children[0], scope, ctx.numberType());
  if (length !== T_ERROR && !isNumeric(length)) {
    ctx.error(args.children[0], `Array length must be a number, got ${ctx.table.typeName(length)}`);
  }
  return ctx.table.arrayOf(elem);
}
