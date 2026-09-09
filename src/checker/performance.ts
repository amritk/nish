/**
 * The `performance` diagnostic class (WP15 §8): warnings the compiler emits
 * when it *had* to take the slow path and a faster one was available.
 *
 * Two of them ship here, the two that need no analysis the checker does not
 * already have:
 *
 *   1. **Quadratic string building** — `s = <something built from s>`, through
 *      `+` operands or a template hole, where `s` is a string local declared
 *      outside the loop the assignment sits in. Every pass copies the whole
 *      accumulator into a fresh arena string, so the loop is quadratic in time
 *      *and* in arena bytes: 88 KB of output measured 180 MB of peak RSS
 *      (WP15 §1). The rewrite is a `string[]` and one `join`.
 *   2. **Allocation in a loop** — a `new Array<T>(n)` with a non-constant `n`,
 *      declared inside a loop, whose value is only ever read through in that
 *      iteration. A dynamically sized array can never be an entry-block
 *      alloca, so it comes out of the arena once per pass and stays there
 *      until the function returns.
 *
 * **Why here and not in the emitter.** Both facts are syntax plus the types
 * and bindings pass 2 already wrote, so the checker can answer them without a
 * second traversal of anything. The emitter may not: `emit/*.ts` reports no
 * user-facing diagnostics at all, and an unexpected node there is exit 70.
 *
 * **Why so few shapes.** §8 sets the bar: "is there a concrete rewrite this
 * message can name?" A warning that fires where the compiler already did the
 * right thing is the un-actionable kind that trains people to ignore the
 * class, so every case WP6's escape analysis already handles is deliberately
 * silent (`docs/wp6-memory.md` §1):
 *
 *   - `new C(...)`, an object literal and an array literal in a loop are
 *     *stackable*. When their flow is `local` they become one entry-block
 *     alloca whose slot is reused every iteration, which costs nothing and
 *     has nothing to hoist. No warning.
 *   - `new Array<T>(<literal>)` is stackable for the same reason. No warning.
 *   - an allocation that is pushed, stored, returned or handed to a callee
 *     genuinely outlives its iteration: the program wants N objects and there
 *     is no faster form. No warning.
 *   - a concatenation in a loop that does not accumulate into its own target
 *     (`line = prefix + name`) allocates one bounded string per pass, which is
 *     linear and necessary. No warning.
 *
 * That leaves exactly the shapes above, and each of them names a rewrite the
 * reader can apply without knowing anything about the compiler. The stage1
 * half is the WP15 section at the end of `self/checker.ts`, and every rule and
 * every word of both messages is shared with it, byte for byte.
 */
import ts from "typescript";
import { CheckContext } from "./context.js";
import { CheckedProgram, FunctionSig, LocalVar } from "./program.js";

/**
 * The state the walk carries. `loops` is the enclosing loop *statements*,
 * innermost last, so a candidate allocation knows which subtree to scan for
 * the uses of its local. `declared` / `declaredDepth` are parallel: the local
 * a declaration introduced and the loop depth it was introduced at, which is
 * how "the accumulator is reset every pass" is told from "the accumulator
 * outlives the pass". Entries are never popped — a `LocalVar` is compared by
 * identity, so a sibling loop's local can never be mistaken for this one's.
 */
type Walk = {
  ctx: CheckContext;
  loops: ts.Statement[];
  declared: LocalVar[];
  declaredDepth: number[];
};

/** Strip parentheses; every shape test below is about the expression inside them. */
const unwrapParens = (expr: ts.Expression): ts.Expression => {
  let inner = expr;
  while (ts.isParenthesizedExpression(inner)) inner = inner.expression;
  return inner;
};

/**
 * The non-negative integer a literal length denotes, or `undefined` for
 * anything else. Deliberately the same syntactic test `src/codegen/escape.ts`
 * uses to decide whether `new Array<T>(n)` can be a stack slot, because the
 * warning must fire exactly where that decision goes the other way: a
 * `const n = 8` is a local, not a literal, and both sides call it dynamic.
 */
const literalLength = (expr: ts.Expression): number | undefined => {
  const e = unwrapParens(expr);
  if (!ts.isNumericLiteral(e)) return undefined;
  const n = Number(e.text);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
};

/** `expr` is a direct reference to `target` (through parentheses only). */
const isRef = (program: CheckedProgram, expr: ts.Expression, target: LocalVar): boolean => {
  const e = unwrapParens(expr);
  return ts.isIdentifier(e) && program.bindings.get(e) === target;
};

/**
 * The value of `expr` is `target`'s own contents plus something. Only `+`
 * chains and template holes are followed, because those are the two forms
 * that copy the accumulator; `s = f(s)` or `s = cond ? s : t` may do anything
 * or nothing, and guessing would break the "name a concrete rewrite" bar.
 */
const accumulates = (program: CheckedProgram, expr: ts.Expression, target: LocalVar): boolean => {
  const e = unwrapParens(expr);
  if (ts.isIdentifier(e)) return program.bindings.get(e) === target;
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return accumulates(program, e.left, target) || accumulates(program, e.right, target);
  }
  if (ts.isTemplateExpression(e)) {
    return e.templateSpans.some((span) => accumulates(program, span.expression, target));
  }
  return false;
};

/**
 * `expr` allocates an array whose size is not a compile-time constant, so
 * WP6 cannot turn it into an entry-block alloca and it comes out of the arena
 * every time it runs. `new Array<T>(4)`, `[a, b]` and `new C(...)` are all
 * stackable and therefore not this.
 */
const isDynamicArrayAllocation = (program: CheckedProgram, expr: ts.Expression): boolean => {
  const e = unwrapParens(expr);
  if (!ts.isNewExpression(e)) return false;
  if (program.types.get(e)?.kind !== "array") return false;
  const args = e.arguments;
  // The checker already requires exactly one argument; anything else is a
  // rejected program the walk never reaches.
  if (args === undefined || args.length !== 1) return false;
  return literalLength(args[0]) === undefined;
};

/**
 * Every reference to `local` inside `root` is consumed where it stands: an
 * element read or write, a `.length`, or a `for...of` source. Anything else —
 * a `push`, an argument, a store, a `return`, a reassignment, a bare mention —
 * may keep the value past the iteration, and then the allocation is not
 * redundant and hoisting it would be wrong.
 *
 * `own` is the declaration that introduced `local`; its own name is not a use.
 */
const usedOnlyWithinIteration = (
  program: CheckedProgram,
  root: ts.Node,
  local: LocalVar,
  own: ts.VariableDeclaration
): boolean => {
  let confined = true;
  const scan = (node: ts.Node): void => {
    if (!confined) return;
    if (node === own) {
      if (own.initializer) scan(own.initializer);
      return;
    }
    if (ts.isElementAccessExpression(node) && isRef(program, node.expression, local)) {
      scan(node.argumentExpression);
      return;
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      isRef(program, node.expression, local) &&
      node.name.text === "length"
    ) {
      return;
    }
    if (ts.isForOfStatement(node) && isRef(program, node.expression, local)) {
      scan(node.initializer);
      scan(node.statement);
      return;
    }
    if (ts.isIdentifier(node) && program.bindings.get(node) === local) {
      confined = false;
      return;
    }
    ts.forEachChild(node, scan);
  };
  scan(root);
  return confined;
};

/** The loop depth `local` was declared at, or `-1` when it was not declared inside a loop. */
const depthOf = (walk: Walk, local: LocalVar): number => {
  for (let i = 0; i < walk.declared.length; i++) {
    if (walk.declared[i] === local) return walk.declaredDepth[i];
  }
  return -1;
};

/** `s = <something built from s>` inside a loop that does not own `s`. */
const checkStringAccumulation = (walk: Walk, expr: ts.BinaryExpression): void => {
  if (walk.loops.length === 0) return;
  if (!ts.isIdentifier(expr.left)) return;
  const target = walk.ctx.program.bindings.get(expr.left);
  if (!target || target.type.kind !== "string") return;
  // Declared inside the loop it is assigned in: the string is rebuilt from
  // empty every pass, so it is bounded by one iteration, not by the loop.
  if (depthOf(walk, target) === walk.loops.length) return;
  if (!accumulates(walk.ctx.program, expr.right, target)) return;
  walk.ctx.reportPerformance(
    `\`${target.name}\` is rebuilt from its own value on every iteration of this loop, so every pass copies all ` +
      `of it (quadratic in time and in arena bytes): collect the pieces in a \`string[]\` and \`join\` them after the loop`,
    expr.left
  );
};

/** A dynamically sized array allocated per iteration and dead by the end of it. */
const checkLoopAllocation = (walk: Walk, decl: ts.VariableDeclaration): void => {
  if (walk.loops.length === 0 || decl.initializer === undefined) return;
  const local = walk.ctx.program.locals.get(decl);
  if (!local || !ts.isIdentifier(decl.name)) return;
  if (!isDynamicArrayAllocation(walk.ctx.program, decl.initializer)) return;
  const loop = walk.loops[walk.loops.length - 1];
  if (!usedOnlyWithinIteration(walk.ctx.program, loop, local, decl)) return;
  walk.ctx.reportPerformance(
    `\`${local.name}\` allocates a dynamically sized array on every iteration of this loop and nothing keeps it ` +
      `past the iteration, so the arena grows once per pass: hoist the allocation above the loop and reuse it, ` +
      `or bracket the loop body with \`Arena.mark()\` and \`Arena.release(m)\``,
    decl.name
  );
};

/**
 * Walk one function body. The loop stack is pushed around the parts of a loop
 * that run once per iteration and *not* around a `for` initializer, which runs
 * once: `for (let s = ""; ...) { s = s + t; }` accumulates across the whole
 * loop and must warn, while `for (const x of xs) { ... }` gives `x` a fresh
 * binding every pass and must not.
 */
const walkNode = (walk: Walk, node: ts.Node): void => {
  if (ts.isForStatement(node)) {
    if (node.initializer) walkNode(walk, node.initializer);
    walk.loops.push(node);
    if (node.condition) walkNode(walk, node.condition);
    if (node.incrementor) walkNode(walk, node.incrementor);
    walkNode(walk, node.statement);
    walk.loops.pop();
    return;
  }
  if (ts.isForOfStatement(node)) {
    walkNode(walk, node.expression);
    walk.loops.push(node);
    walkNode(walk, node.initializer);
    walkNode(walk, node.statement);
    walk.loops.pop();
    return;
  }
  // `while` and `do` differ only in which of the two children comes first in
  // the source, and both are walked in source order. The order matters: it is
  // the order the warnings come out in, and stage1 walks the same tree the
  // same way.
  if (ts.isWhileStatement(node)) {
    walk.loops.push(node);
    walkNode(walk, node.expression);
    walkNode(walk, node.statement);
    walk.loops.pop();
    return;
  }
  if (ts.isDoStatement(node)) {
    walk.loops.push(node);
    walkNode(walk, node.statement);
    walkNode(walk, node.expression);
    walk.loops.pop();
    return;
  }
  if (ts.isVariableDeclaration(node)) {
    const local = walk.ctx.program.locals.get(node);
    if (local) {
      walk.declared.push(local);
      walk.declaredDepth.push(walk.loops.length);
    }
    checkLoopAllocation(walk, node);
  } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    checkStringAccumulation(walk, node);
  }
  ts.forEachChild(node, (child) => walkNode(walk, child));
};

/**
 * Report the performance warnings of one checked function body. Called after
 * the body has been checked so every type and binding it reads is recorded,
 * and only for a body that checked cleanly — advice about code that does not
 * compile is noise, and a poisoned body has incomplete side tables anyway.
 */
export const checkPerformance = (ctx: CheckContext, sig: FunctionSig): void => {
  const body = sig.decl.body;
  if (!body) return;
  walkNode({ ctx, loops: [], declared: [], declaredDepth: [] }, body);
};
