// Arrays for stage1 (`src/checker/arrays.ts`, docs/wp14-selfhost.md milestone
// S3, pass 2): literals, indexing, `length`, the four methods, `new Array<T>`
// and element assignment.

import { resolveType, typedArrayElement } from "./annotations";
import { checkBuiltinArity, isArgvExpression } from "./builtins";
import { CheckContext } from "./context";
import { checkBitwiseAssignOperands, checkExpression, isBitwiseCompound } from "./expressions";
import { unwrapParens } from "./emit_util";
import {
  N_BLOCK,
  N_CALL,
  N_CASE,
  N_DEFAULT,
  N_DO,
  N_EMPTY,
  N_FOR,
  N_FOR_OF,
  N_IDENT,
  N_INDEX,
  N_MEMBER,
  N_THIS,
  N_VAR_DECL,
  N_WHILE,
  Node,
} from "./nodes";
import { inlineElementStruct } from "./program";
import { Local, Scope } from "./symbols";
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

/**
 * The one rule a `readonly T[]` adds: it is the same array, so every read still
 * works and no write does. The message names the fix rather than the rule,
 * because the caller is almost always holding a mutable array that widened on
 * the way in — the parameter's annotation is what has to change, not the call.
 */
function readonlyWriteMessage(ctx: CheckContext, receiver: i32, what: string): string {
  const mutable = ctx.table.typeName(ctx.table.arrayOf(ctx.table.refOf(receiver)));
  return `Cannot ${what} ${ctx.table.typeName(receiver)} (declare it ${mutable} to write through it)`;
}

/** `a[i] = v` and `a[i] op= v`. */
export function checkIndexAssignment(ctx: CheckContext, expr: Node, scope: Scope): i32 {
  if (isArgvExpression(ctx, expr.children[0].children[0], scope)) {
    // At the `process.argv` itself, parentheses stepped through, where stage0
    // puts it (`checkProcessArgv` in `src/checker/io.ts`).
    return ctx.errorType(unwrapParens(expr.children[0].children[0]), "`process.argv` is read-only");
  }
  const elem = checkIndex(ctx, expr.children[0], scope);
  ctx.program.nodeTypes[expr.children[0].id] = elem;
  const target = ctx.program.nodeTypes[expr.children[0].children[0].id];
  if (ctx.table.isReadonlyArray(target)) {
    return ctx.errorType(expr.children[0], readonlyWriteMessage(ctx, target, "assign to an element of"));
  }
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
  // `a[i] &= v` and the rest of the bitwise family: the element is the target,
  // so the operand rule is `&`'s and the words are a local's.
  if (isBitwiseCompound(op)) {
    return checkBitwiseAssignOperands(ctx, expr, elem, rhs);
  }
  if (!isNumeric(elem) || rhs !== elem) {
    const a = ctx.table.typeName(elem);
    return ctx.errorType(
      expr,
      // The token as it was written, `*=` and not `*`: stage0's element path
      // names the compound one (`src/checker/arrays.ts`), as its local and
      // field paths do (WP19 §A2).
      `Operator \`${op}\` requires two operands of the same numeric type, got ${a} and ${ctx.table.typeName(rhs)}`
    );
  }
  return elem;
}

export function checkArrayProperty(ctx: CheckContext, expr: Node, receiver: i32): i32 {
  if (expr.text === "length") {
    return ctx.numberType();
  }
  ctx.errorAtProperty(expr, `Unknown property \`${expr.text}\` on ${ctx.table.typeName(receiver)}`);
  return T_ERROR;
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
  if ((name === "push" || name === "pop") && isArgvExpression(ctx, access.children[0], scope)) {
    return ctx.errorType(unwrapParens(access.children[0]), "`process.argv` is read-only");
  }
  if ((name === "push" || name === "pop") && ctx.table.isReadonlyArray(receiver)) {
    return ctx.errorType(call, readonlyWriteMessage(ctx, receiver, `\`${name}\` through`));
  }
  const elem = ctx.table.refOf(receiver);
  const spelled = ctx.table.typeName(receiver);
  // `xs.push(3)` and `xs.indexOf(3)` give a bare literal the element type — but
  // only when the receiver is a plain identifier. stage0 reaches that rule
  // through `calleeName`, which names `xs.push` and gives up on `b.xs.push`
  // (its receiver is not an identifier), so `b.xs.push(0)` in f64 mode is an
  // f64 pushed onto an `i32[]` there and was accepted here
  // (`reject_push_field_literal`, WP19 §A3).
  const elemContext = access.children[0].kind === N_IDENT ? elem : -1;
  if (name === "push") {
    if (!checkBuiltinArity(ctx, call, "push", args, 1)) {
      return ctx.numberType();
    }
    const got = checkExpression(ctx, args.children[0], scope, elemContext);
    if (got !== T_ERROR && !ctx.table.assignable(got, elem)) {
      ctx.error(args.children[0], `Cannot push ${ctx.table.typeName(got)} onto ${spelled}`);
    }
    return ctx.numberType();
  }
  if (name === "pop") {
    // There is no `undefined`, so an empty array panics rather than adding
    // a second return type; the check is the one `a[i]` already pays for.
    checkBuiltinArity(ctx, call, "pop", args, 0);
    return elem;
  }
  if (name === "indexOf") {
    if (!checkBuiltinArity(ctx, call, "indexOf", args, 1)) {
      return ctx.numberType();
    }
    const got = checkExpression(ctx, args.children[0], scope, elemContext);
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
      ctx.errorAtProperty(
        access,
        `\`join\` requires string[], got ${spelled} (build the parts with template literals first)`
      );
      return T_ERROR;
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
  ctx.errorAtProperty(access, `Unknown method \`${name}\` on ${spelled} (supported: ${ARRAY_METHODS})`);
  return T_ERROR;
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
  // value the language has no way to represent or to check for.
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

// ---- WP15 §2a: element references ------------------------------------------------

// The rule that makes contiguous storage safe: an element reference may not be
// held across a mutation of the array it came from (`src/checker/arrays.ts`,
// where the whole argument is written out).
//
// An array of classes is one block of objects, so `ps[i]` hands out a pointer
// *into* that block. `push` may move the block and `pop` hands the slot back to
// the next `push`, so a reference taken beforehand names memory that is no
// longer the element. The analysis is a source-order walk of one body with a
// loop pre-scanned, because a mutation at the bottom of a loop reaches a
// reference taken at the top on the next pass.

/** The array root a reference or a mutation names; the empty string when it cannot be named. */
const UNNAMED: string = "";

/** One array a call may change the length of, named for the message. */
export class Mutation {
  root: string;
  /** The element class, so an unnameable receiver cannot invalidate an unrelated array. */
  elem: string;
  what: string;

  constructor(root: string, elem: string, what: string) {
    this.root = root;
    this.elem = elem;
    this.what = what;
  }
}

/** A live element reference: the local naming it, the array it points into, what invalidated it. */
export class ElementRef {
  local: Local;
  array: string;
  elem: string;
  arrayText: string;
  /** The mutation that may have moved the storage, or the empty string while the reference is good. */
  invalidatedBy: string;

  constructor(local: Local, array: string, elem: string, arrayText: string) {
    this.local = local;
    this.array = array;
    this.elem = elem;
    this.arrayText = arrayText;
    this.invalidatedBy = "";
  }
}

/** `xs`, `this.bodies`, `a.b.c` — how two references are told apart. */
function referenceRoot(expr: Node): string {
  const inner = unwrapParens(expr);
  if (inner.kind === N_IDENT) {
    return inner.text;
  }
  if (inner.kind === N_THIS) {
    return "this";
  }
  if (inner.kind === N_MEMBER) {
    const base = referenceRoot(inner.children[0]);
    return base === UNNAMED ? UNNAMED : `${base}.${inner.text}`;
  }
  return UNNAMED;
}

/**
 * The class `expr`'s slots hold inline, or the empty string when `expr` is not
 * an array that stores its elements by value. The *name* is what two arrays are
 * compared by when one of them cannot be named: element types are exact here,
 * so a `FunctionSig[]` and an `ImportBinding[]` are never the same array.
 */
function inlineArrayElement(ctx: CheckContext, expr: Node): string {
  const type = ctx.program.nodeTypes[expr.id];
  if (type < 0 || !ctx.table.isArray(type)) {
    return "";
  }
  const info = inlineElementStruct(ctx.program, ctx.table, ctx.table.refOf(type));
  return info === null ? "" : info.name;
}

/** How the root is spelled in a message; an unnameable receiver borrows the type's name. */
function rootText(ctx: CheckContext, expr: Node): string {
  const root = referenceRoot(expr);
  if (root !== UNNAMED) {
    return root;
  }
  const type = ctx.program.nodeTypes[expr.id];
  return type < 0 ? "the array" : ctx.table.typeName(type);
}

/** The array `expr` reads an element of (`a[i]`, `a.pop()`), or `null`. */
function elementSource(ctx: CheckContext, expr: Node): Node | null {
  const inner = unwrapParens(expr);
  if (inner.kind === N_INDEX && inlineArrayElement(ctx, inner.children[0]) !== "") {
    return inner.children[0];
  }
  if (inner.kind === N_CALL && inner.children[0].kind === N_MEMBER && inner.children[0].text === "pop") {
    const receiver = inner.children[0].children[0];
    if (inlineArrayElement(ctx, receiver) !== "") {
      return receiver;
    }
  }
  return null;
}

/**
 * Every inline-element array this call may grow or shorten: the receiver of a
 * `push` / `pop`, and every mutable array argument of a user call, since the
 * callee is free to push through it. A `readonly T[]` parameter is exactly the
 * promise that it does not, and is skipped.
 */
function collectMutations(ctx: CheckContext, call: Node, out: Mutation[]): void {
  if (call.children[0].kind === N_MEMBER) {
    const method = call.children[0].text;
    const receiver = call.children[0].children[0];
    const elem = inlineArrayElement(ctx, receiver);
    if ((method === "push" || method === "pop") && elem !== "") {
      const args = method === "push" ? "..." : "";
      out.push(new Mutation(referenceRoot(receiver), elem, `${rootText(ctx, receiver)}.${method}(${args})`));
    }
  }
  const callee = ctx.program.nodeCallees[call.id];
  if (callee === null) {
    return;
  }
  const offset = callee.owner === null ? 0 : 1;
  const args = call.children[1];
  let i = 0;
  while (i < args.children.length) {
    const arg = args.children[i];
    const elem = inlineArrayElement(ctx, arg);
    const at = i + offset;
    if (elem !== "" && at < callee.paramTypes.length && !ctx.table.isReadonlyArray(callee.paramTypes[at])) {
      out.push(new Mutation(referenceRoot(arg), elem, `${callee.sourceName}(...)`));
    }
    i = i + 1;
  }
}

/** The walk's state, a class because Nish-0 has no closures (as `PerfWalk` is). */
export class RefWalk {
  ctx: CheckContext;
  live: ElementRef[];
  /** One report per body: `ctx.error` suppresses the rest anyway, and stage0 stops here too. */
  reported: boolean;

  constructor(ctx: CheckContext) {
    this.ctx = ctx;
    this.live = [];
    this.reported = false;
  }

  /** Forget every reference declared since `depth`: its block has ended. */
  dropTo(depth: i32): void {
    while (this.live.length > depth) {
      this.live.pop();
    }
  }

  /** Mark every live reference the mutation may have invalidated. */
  invalidate(m: Mutation): void {
    let i = 0;
    while (i < this.live.length) {
      const ref = this.live[i];
      const unrelated = ref.invalidatedBy !== "" || ref.elem !== m.elem;
      if (!unrelated && (m.root === UNNAMED || ref.array === UNNAMED || ref.array === m.root)) {
        this.live[i].invalidatedBy = m.what;
      }
      i = i + 1;
    }
  }

  /** Every mutation anywhere inside `node`, for the pre-scan of a loop. */
  mutationsWithin(node: Node, out: Mutation[]): void {
    if (node.kind === N_CALL) {
      collectMutations(this.ctx, node, out);
    }
    for (const child of node.children) {
      this.mutationsWithin(child, out);
    }
  }

  visit(node: Node): void {
    if (node.kind === N_IDENT) {
      this.visitIdentifier(node);
      return;
    }
    if (node.kind === N_BLOCK || node.kind === N_CASE || node.kind === N_DEFAULT) {
      const depth = this.live.length;
      this.visitChildren(node);
      this.dropTo(depth);
      return;
    }
    if (node.kind === N_FOR || node.kind === N_FOR_OF || node.kind === N_WHILE || node.kind === N_DO) {
      this.visitLoop(node);
      return;
    }
    if (node.kind === N_CALL) {
      this.visitCall(node);
      return;
    }
    if (node.kind === N_VAR_DECL) {
      this.visitDeclaration(node);
      return;
    }
    this.visitChildren(node);
  }

  visitChildren(node: Node): void {
    for (const child of node.children) {
      this.visit(child);
    }
  }

  visitIdentifier(node: Node): void {
    const local = this.ctx.program.nodeLocals[node.id];
    if (local === null || this.reported) {
      return;
    }
    let i = 0;
    while (i < this.live.length) {
      const ref = this.live[i];
      if (ref.local === local && ref.invalidatedBy !== "") {
        this.ctx.error(
          node,
          `\`${ref.local.name}\` refers to an element of \`${ref.arrayText}\`, and \`${ref.invalidatedBy}\` may move or reuse that storage; index \`${ref.arrayText}\` again afterwards rather than holding the element across it`
        );
        this.reported = true;
        return;
      }
      i = i + 1;
    }
  }

  visitLoop(node: Node): void {
    // Source order is not execution order here: a mutation at the bottom of the
    // body reaches a reference taken at the top on the next pass.
    const found: Mutation[] = [];
    this.mutationsWithin(node, found);
    for (const m of found) {
      this.invalidate(m);
    }
    const depth = this.live.length;
    // `for (const p of ps)` binds an element reference too. It is re-derived
    // from the header at the top of every pass, so it starts each iteration
    // valid and is only invalidated by a mutation inside the body.
    if (node.kind === N_FOR_OF) {
      const iterable = node.children[1];
      const elem = inlineArrayElement(this.ctx, iterable);
      const decl = node.children[0].children[0].children[0];
      const local = this.ctx.program.nodeLocals[decl.id];
      if (elem !== "" && local !== null) {
        this.live.push(new ElementRef(local, referenceRoot(iterable), elem, rootText(this.ctx, iterable)));
      }
    }
    this.visitChildren(node);
    this.dropTo(depth);
  }

  visitCall(node: Node): void {
    this.visitChildren(node);
    const found: Mutation[] = [];
    collectMutations(this.ctx, node, found);
    for (const m of found) {
      // `xs.push(xs[0])`: the argument is read before `nish_array_grow` runs,
      // and the copy into the new slot reads it after.
      if (m.root !== UNNAMED && !this.reported) {
        for (const arg of node.children[1].children) {
          const source = elementSource(this.ctx, arg);
          if (source !== null && referenceRoot(source) === m.root && !this.reported) {
            this.ctx.error(
              arg,
              `\`${m.what}\` reads an element of \`${m.root}\`, and the push may move that storage first; copy the fields you need into locals before pushing`
            );
            this.reported = true;
          }
        }
      }
      this.invalidate(m);
    }
  }

  visitDeclaration(node: Node): void {
    this.visitChildren(node);
    const local = this.ctx.program.nodeLocals[node.id];
    const initializer = node.children[2];
    if (local === null || initializer.kind === N_EMPTY) {
      return;
    }
    const source = elementSource(this.ctx, initializer);
    if (source === null) {
      return;
    }
    const elem = inlineArrayElement(this.ctx, source);
    if (elem !== "") {
      this.live.push(new ElementRef(local, referenceRoot(source), elem, rootText(this.ctx, source)));
    }
  }
}

/**
 * WP15 §2a. Reported after the body has checked, like the performance
 * warnings, so every type and binding the walk reads is already recorded.
 */
export function checkElementReferences(ctx: CheckContext, body: Node): void {
  const walk = new RefWalk(ctx);
  walk.visit(body);
}
