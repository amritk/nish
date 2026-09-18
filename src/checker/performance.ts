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
import { StaticType, intBits } from "../types.js";

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
  /** The function being walked: the arena rule reads its return type. */
  sig: FunctionSig;
  /**
   * The accesses whose bounds check survived `bounds.ts` inside a loop. The
   * proof is not this file's — it is a flow-sensitive analysis of its own —
   * but the *report* is, because every WP15 §8 warning has to come out of one
   * source-order walk or the diagnostics stop being in source order.
   */
  unprovenIndices: ts.Node[];
  loops: ts.Statement[];
  declared: LocalVar[];
  declaredDepth: number[];
  /**
   * Whether each declared local's initializer was itself a visible allocation.
   * Parallel to `declared`, and the difference between "this assignment drops
   * an allocation nobody can reach again" and "this local is being given its
   * one value in a branch", which is ordinary code with nothing to fix.
   */
  declaredAllocates: boolean[];
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

/** Whether `local` was declared holding an allocation. False for one declared elsewhere. */
const declaredHoldingAllocation = (walk: Walk, local: LocalVar): boolean => {
  for (let i = 0; i < walk.declared.length; i++) {
    if (walk.declared[i] === local) return walk.declaredAllocates[i];
  }
  return false;
};

/** The loop depth `local` was declared at, or `-1` when it was not declared inside a loop. */
const depthOf = (walk: Walk, local: LocalVar): number => {
  for (let i = 0; i < walk.declared.length; i++) {
    if (walk.declared[i] === local) return walk.declaredDepth[i];
  }
  return -1;
};

/**
 * `s = <something built from s>` inside a loop that does not own `s`. Split
 * from the report below because the arena rule has to know whether this one is
 * already speaking about the same assignment: one line gets one warning.
 */
const isQuadraticAccumulation = (walk: Walk, expr: ts.BinaryExpression): boolean => {
  if (walk.loops.length === 0) return false;
  if (!ts.isIdentifier(expr.left)) return false;
  const target = walk.ctx.program.bindings.get(expr.left);
  if (!target || target.type.kind !== "string") return false;
  // Declared inside the loop it is assigned in: the string is rebuilt from
  // empty every pass, so it is bounded by one iteration, not by the loop.
  if (depthOf(walk, target) === walk.loops.length) return false;
  return accumulates(walk.ctx.program, expr.right, target);
};

/** `s = <something built from s>` inside a loop that does not own `s`. */
const checkStringAccumulation = (walk: Walk, expr: ts.BinaryExpression): void => {
  if (!isQuadraticAccumulation(walk, expr)) return;
  const target = walk.ctx.program.bindings.get(expr.left as ts.Identifier)!;
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



// ---- Memory that is allocated and then never released --------------------------------
//
// WP6 releases a function's arena temporaries on the way out, but only when it
// can prove that every allocation the body made dies with the frame. One
// syntactic shape takes that proof away, and it is easy to write by accident:
// assigning an allocation to a local that already exists.
//
//   let p = new Point(1);
//   p = new Point(n);      // <- both Points now live until the program exits
//
// The stack rule needs a fixed binding, so an assignment classifies the value
// as `leaks` (`src/codegen/escape.ts`), `allocLeaks` goes on, and the whole
// function loses its `nish_arena_mark` / `nish_arena_release` bracket -- not
// just the assigned value, but *every* allocation in the body, including the
// ones that were going to be stack slots. Measured on the two-line function
// above: two `nish_alloc_struct` calls and no scope at all, where the same
// function written with two `const`s allocates nothing.
//
// This is the warning that answers "the compiler could not prove it, so the
// memory is simply never freed" with a line number. What keeps it inside the
// section 8 bar is that both rewrites are always available: a fresh `const`
// per value, and failing that, an explicit `Arena.mark()` / `Arena.release(m)`
// bracket, which is what the explicit-control builtins are for.

/**
 * `expr` allocates from the arena in a way the checker can see for itself: a
 * `new`, an object or array literal, a template with a hole, a string
 * concatenation, or a `readFileSync`.
 *
 * A call to a user function is deliberately not counted even though it may
 * allocate: whether it does is a whole-program fact the fixpoint in
 * `src/codegen/attributes.ts` owns, the checker would have to guess, and a
 * guess that fires on a call that allocates nothing is the un-actionable kind
 * of warning. A string literal is not counted either -- it is constant data,
 * not an allocation.
 */
const READ_BUILTINS = ["readFileSync", "readFileSyncOrNull"];

const allocatesVisibly = (program: CheckedProgram, expr: ts.Expression): boolean => {
  const e = unwrapParens(expr);
  if (ts.isNewExpression(e) || ts.isObjectLiteralExpression(e) || ts.isArrayLiteralExpression(e)) return true;
  if (ts.isTemplateExpression(e)) return true; // a template *with* holes; a plain one is a literal
  if (ts.isCallExpression(e)) {
    const callee = unwrapParens(e.expression);
    return (
      ts.isIdentifier(callee) &&
      READ_BUILTINS.includes(callee.text) &&
      !program.functions.some((f) => f.sourceName === callee.text)
    );
  }
  return (
    ts.isBinaryExpression(e) &&
    e.operatorToken.kind === ts.SyntaxKind.PlusToken &&
    program.types.get(e)?.kind === "string"
  );
};

/**
 * A type that is a pointer at run time, and so names memory somebody has to
 * own. `result` is counted with them even though WP17 passes a small one in a
 * register: the rule uses this to decide when to stay quiet, and counting a
 * borderline type as a pointer only ever means one warning fewer.
 *
 * This is deliberately narrower than stage1's `TypeTable.isPointer`, which WP27
 * S2 widened to answer true for `cptr` as well — `CPtr | null` is the only way a
 * foreign call can report failure, so the null rules there have to see one as a
 * pointer. The two predicates are allowed to differ because no program can reach
 * a diagnostic that tells them apart:
 *
 *   - stage1's other two callers are shadowed on this side by rules the
 *     compilers already agree on. `new Array<CPtr>(n)` is refused as an array
 *     element by `rejectForeignPointer` before the zero-fill rule is consulted,
 *     and the `null`-in-a-pointer-slot message is answered here by the checker's
 *     own type test, not by this predicate (`reject_ffi_pointer_array`, and
 *     `` `null` is not a CPtr `` from both compilers).
 *   - this predicate's only caller is the arena-reassignment warning below,
 *     which also requires `allocatesVisibly` of the right-hand side. A `CPtr`
 *     only ever comes out of a `declare function` call, which is not a `new`, a
 *     literal, or a read builtin, so the warning cannot fire on one however this
 *     answers. The `isPointerType(walk.sig.returnType)` guard is unreachable for
 *     the same reason twice over: a function this program defines may not return
 *     a `CPtr` at all.
 *
 * Widening it would therefore change no output. Leaving it narrow keeps the
 * predicate saying what it means here — memory this compiler laid out — which a
 * `CPtr` is not.
 */
const isPointerType = (t: StaticType | undefined): boolean =>
  t !== undefined &&
  (t.kind === "string" || t.kind === "array" || t.kind === "struct" || t.kind === "nullable" || t.kind === "result");

/**
 * A use of `local` that can let the value it holds outlive the statement it
 * appears in: an argument (a `push` is one), a `return`, an element of an
 * array or object literal, the right-hand side of an assignment, or the
 * initializer of another binding. Everything else -- an operand, a field or
 * element read or write through it, `.length`, a `for...of` source --
 * consumes the value where it stands and cannot keep it.
 */
const capturesLocal = (program: CheckedProgram, node: ts.Node, local: LocalVar): boolean => {
  const refers = (e: ts.Expression): boolean => {
    const inner = unwrapParens(e);
    return ts.isIdentifier(inner) && program.bindings.get(inner) === local;
  };
  if (ts.isCallExpression(node)) return node.arguments.some(refers);
  if (ts.isReturnStatement(node)) return node.expression !== undefined && refers(node.expression);
  if (ts.isArrayLiteralExpression(node)) return node.elements.some(refers);
  if (ts.isPropertyAssignment(node)) return refers(node.initializer);
  if (ts.isVariableDeclaration(node)) return node.initializer !== undefined && refers(node.initializer);
  return (
    ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && refers(node.right)
  );
};

/**
 * Whether the value `local` holds *when `expr` runs* may already be reachable
 * from somewhere else, which is what decides whether the assignment really
 * drops it.
 *
 * The question is about order, not about existence, and this compiler's own
 * `astLines` is why. It builds a line, replaces it in a branch, and only then
 * pushes it: the replaced value is dead and the warning is right. Turn the two
 * around -- push, then reassign, in a loop -- and every pushed value is still
 * reachable through the array and the warning would be wrong.
 *
 * So: inside a loop, any capture anywhere in the outermost enclosing loop
 * counts, because control comes back around to the assignment with the capture
 * behind it. Outside one, only a capture that finishes before the assignment
 * starts can have taken a value the assignment is about to drop.
 */
const heldValueMayBeReachable = (walk: Walk, expr: ts.BinaryExpression, local: LocalVar): boolean => {
  const inLoop = walk.loops.length > 0;
  const root: ts.Node = inLoop ? walk.loops[0] : (walk.sig.body ?? walk.sig.decl);
  const before = expr.getStart(expr.getSourceFile());
  let reachable = false;
  const scan = (node: ts.Node): void => {
    if (reachable) return;
    if ((inLoop || node.end <= before) && capturesLocal(walk.ctx.program, node, local)) {
      reachable = true;
      return;
    }
    ts.forEachChild(node, scan);
  };
  scan(root);
  return reachable;
};

/**
 * `s = <an allocation>` where `s` is a local that was *declared* holding an
 * allocation: the value it held is unreachable from here on, and nothing frees
 * it. Reported on the target, because the assignment is the thing to change.
 *
 * Five guards keep the message true, and the first two are what the rule turns
 * on. Running an earlier draft over this compiler's own source found `let what
 * = "unbound"` followed by three branches that each assign a template -- real
 * retention, one allocation, and no rewrite worth naming, because assigning a
 * local in a branch is how a language without a match expression computes a
 * value. Requiring the declaration to allocate as well leaves exactly the case
 * where an allocation is *dropped*, which is the one with something to fix:
 *
 *   - the declaration's initializer must itself be a visible allocation;
 *   - the function must not return a pointer, because a function that hands
 *     memory back was never getting a scope and its caller owns what it made
 *     (WP9's call-site reclaim is the mechanism there, not this one);
 *   - the quadratic-string rule must not already be reporting this very
 *     assignment, which it does for an accumulator in a loop -- one line
 *     deserves one warning, and that message names a rewrite that fixes this
 *     as well;
 *   - the right-hand side has to be an allocation the checker can see, not a
 *     call it would be guessing about;
 *   - and the value being dropped must not already be reachable from
 *     somewhere else, which `heldValueMayBeReachable` decides.
 */
const checkArenaReassignment = (walk: Walk, expr: ts.BinaryExpression): void => {
  if (!ts.isIdentifier(expr.left)) return;
  const program = walk.ctx.program;
  const target = program.bindings.get(expr.left);
  if (!target || target.storage !== "local" || !isPointerType(target.type)) return;
  if (isPointerType(walk.sig.returnType)) return;
  if (isQuadraticAccumulation(walk, expr)) return;
  if (!declaredHoldingAllocation(walk, target)) return;
  if (!allocatesVisibly(program, expr.right)) return;
  if (heldValueMayBeReachable(walk, expr, target)) return;
  walk.ctx.reportPerformance(
    `\`${target.name}\` already holds an allocation and this one drops it: nothing can reach the old value from ` +
      `here and nothing frees it, and assigning a local is also what stops this function from releasing its arena ` +
      `memory at all, so both allocations live until the program exits. Give each value its own \`const\`, or ` +
      `bracket the body with \`Arena.mark()\` and \`Arena.release(m)\``,
    expr.left
  );
};

// ---- Arithmetic that provably goes wrong (the overflow rules) -------------------------
//
// Signed overflow is undefined behaviour by default (`--wrapping` opts out,
// `docs/LANGUAGE.md` -> "Semantics decisions"), so a program that overflows an
// `i32` by accident has no defined meaning at all. The temptation is to warn
// wherever overflow is *possible*, but on an `i32` that is every `+` and every
// `*` in the program, which is the un-actionable kind of warning section 8
// rules out in as many words. So these three rules fire only where the
// compiler can point at the value, or at a shape whose rewrite is mechanical:
//
//   1. a constant that does not fit the type it is computed in,
//   2. `i32` arithmetic widened *after* the fact by `toI64` / `toF64`, which
//      is the classic overflow bug: the multiply has already wrapped by the
//      time the conversion sees it,
//   3. a shift by a literal count at or beyond the operand width, which is
//      masked and therefore never the shift that was written.
//
// Unsigned widths are deliberately silent. `u8`, `u16`, `u32` and `u64` are
// *defined* to wrap (`(255: u8) + 1` is `0`), so wrapping there is the
// language working as documented rather than a program with a bug, and a
// warning would fire on the very code that chose an unsigned type to get it.

/**
 * The source spelling of an arithmetic or shift operator. Spelled out rather
 * than taken from the token's source text so that the message is the same in
 * both compilers: stage1 has its own token kinds and no `getText`.
 */
const operatorText = (kind: ts.SyntaxKind): string => {
  switch (kind) {
    case ts.SyntaxKind.PlusToken:
      return "+";
    case ts.SyntaxKind.MinusToken:
      return "-";
    case ts.SyntaxKind.AsteriskToken:
      return "*";
    case ts.SyntaxKind.LessThanLessThanToken:
      return "<<";
    case ts.SyntaxKind.GreaterThanGreaterThanToken:
      return ">>";
    default:
      return ">>>";
  }
};

/**
 * The range the constant rule reports against. Only `i32` is ever reported:
 * the fold bounds below keep every value the fold carries well inside `i64`,
 * so an `i64` constant it can evaluate is an `i64` constant that fits.
 */
const I32_MIN = -2147483648n;
const I32_MAX = 2147483647n;

/** `t` is the one type the constant rule reports against. */
const isI32 = (t: StaticType | undefined): boolean => t?.kind === "i32";

/**
 * Bounds on what the fold will carry. Every intermediate stays inside them, so
 * the fold itself can never be the thing that overflows -- which matters far
 * more than it looks: stage1 folds in `i64`, and a fold that overflowed there
 * would be undefined behaviour inside the very check that reports it. A
 * product needs both operands under 2^31 to stay inside an `i64`, and a sum
 * needs both under 2^52 -- which is also the largest power of two either
 * compiler can *write*, since a literal past 2^53 cannot be spelled exactly
 * (`docs/LANGUAGE.md`, NL2055). Anything larger is answered "not a constant",
 * which costs a warning nobody was going to get anyway.
 */
const FOLD_LIMIT = 2147483648n; // 2^31
const FOLD_SUM_LIMIT = 4503599627370496n; // 2^52

/**
 * A run of decimal digits, which is the only literal shape both compilers fold
 * the same way. Stage1 has no `Number`, so hexadecimal, binary, octal,
 * exponent and separated literals are left alone rather than folded
 * differently on each side.
 *
 * This has to be asked of the literal *as written*. `ts.NumericLiteral.text`
 * is normalised -- `0x20` arrives as `"32"` and `100_000` as `"100000"` --
 * so testing it would fold exactly the spellings stage1 refuses, and the two
 * compilers would disagree about whether to warn.
 */
const isDecimalInteger = (text: string): boolean => {
  if (text.length === 0) return false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  return true;
};

const magnitude = (value: bigint): bigint => (value < 0n ? -value : value);

/**
 * The exact value of a constant integer expression, or `undefined` for
 * anything that is not one. Only decimal literals joined by `+`, `-`, `*` and
 * unary minus are folded.
 *
 * A `const n = 8` is deliberately not followed even though the checker knows
 * its value: the warning below names a value the reader can see on the line
 * the caret points at, and chasing bindings would start naming values that are
 * not written there. A module-level `const` needs no help from here either --
 * `src/checker/constants.ts` folds those eagerly and makes an overflow a hard
 * error, so what is left for a warning is exactly the arithmetic inside a
 * function body.
 */
const constantInt = (expr: ts.Expression): bigint | undefined => {
  const e = unwrapParens(expr);
  if (ts.isNumericLiteral(e)) {
    const written = e.getText(e.getSourceFile());
    if (!isDecimalInteger(written)) return undefined;
    const value = BigInt(written);
    return value > FOLD_LIMIT ? undefined : value;
  }
  if (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.MinusToken) {
    const operand = constantInt(e.operand);
    return operand === undefined ? undefined : -operand;
  }
  if (!ts.isBinaryExpression(e)) return undefined;
  const left = constantInt(e.left);
  const right = constantInt(e.right);
  if (left === undefined || right === undefined) return undefined;
  const kind = e.operatorToken.kind;
  if (kind === ts.SyntaxKind.AsteriskToken) {
    if (magnitude(left) > FOLD_LIMIT || magnitude(right) > FOLD_LIMIT) return undefined;
    return left * right;
  }
  if (magnitude(left) > FOLD_SUM_LIMIT || magnitude(right) > FOLD_SUM_LIMIT) return undefined;
  if (kind === ts.SyntaxKind.PlusToken) return left + right;
  if (kind === ts.SyntaxKind.MinusToken) return left - right;
  return undefined;
};

/** `expr` is a constant of a signed type whose value does not fit that type. */
const overflowsItsType = (program: CheckedProgram, expr: ts.Expression): boolean => {
  const e = unwrapParens(expr);
  if (!isI32(program.types.get(e))) return false;
  const value = constantInt(e);
  return value !== undefined && (value < I32_MIN || value > I32_MAX);
};

/**
 * A constant `+`, `-` or `*` whose value does not fit the signed type it is
 * computed in. Reported on the *innermost* expression that overflows, because
 * that is the operation that actually goes wrong: in `(a * b) + 1` where the
 * product already overflows, the `+` is a consequence and warning about both
 * would say the same thing twice.
 *
 * Silent under `--wrapping`, where the wrap is the defined answer rather than
 * undefined behaviour. A program compiled that way has said that it wants
 * `2147483647 + 1` to be `-2147483648`, and the warning would be arguing with
 * a flag the author passed on purpose.
 */
const checkConstantOverflow = (walk: Walk, expr: ts.BinaryExpression): void => {
  if (!walk.ctx.opts.nsw) return;
  const kind = expr.operatorToken.kind;
  if (kind !== ts.SyntaxKind.PlusToken && kind !== ts.SyntaxKind.MinusToken && kind !== ts.SyntaxKind.AsteriskToken)
    return;
  const program = walk.ctx.program;
  if (!isI32(program.types.get(expr))) return;
  const value = constantInt(expr);
  if (value === undefined || (value >= I32_MIN && value <= I32_MAX)) return;
  if (overflowsItsType(program, expr.left) || overflowsItsType(program, expr.right)) return;
  walk.ctx.reportPerformance(
    `this computes with overflow: the result ${value} does not fit in i32 (the range is ${I32_MIN} to ` +
      `${I32_MAX}), and signed overflow is undefined behaviour rather than a wrap: widen the operands with ` +
      `\`toI64\` first, or use --wrapping for two's-complement arithmetic`,
    expr
  );
};

/**
 * `toI64(a * b)` and `toF64(a * b)` on `i32` operands: the multiplication is
 * done in `i32` and has already overflowed by the time the conversion widens
 * the result, so the wider type never sees the value the reader expects. The
 * rewrite is mechanical — convert the operands and multiply in the wider type
 * — which is what earns this one its place under the section 8 bar.
 *
 * **Multiplication only**, though `+` and `-` can overflow too. The bar is
 * that the warning must not fire on code with nothing wrong with it, and the
 * compiler's own source settled the question the first time this rule ran over
 * it: `toI64(intBits(type) - 1)` is the shape, and there is nothing to fix,
 * because a width minus one has no way to reach the end of an `i32`. A
 * product of two values the compiler knows nothing about does, and that is the
 * bug this rule is named after.
 *
 * A user function named `toI64` shadows the builtin (`docs/LANGUAGE.md` ->
 * "Builtins"), so a program that declares one is left alone: the call is not a
 * conversion at all there.
 */
const WIDENING_CONVERSIONS = ["toI64", "toF64"];

const checkWideningConversion = (walk: Walk, call: ts.CallExpression): void => {
  const callee = unwrapParens(call.expression);
  if (!ts.isIdentifier(callee) || !WIDENING_CONVERSIONS.includes(callee.text)) return;
  if (call.arguments.length !== 1) return;
  const program = walk.ctx.program;
  if (program.functions.some((f) => f.sourceName === callee.text)) return;
  const arg = unwrapParens(call.arguments[0]);
  if (!ts.isBinaryExpression(arg)) return;
  if (arg.operatorToken.kind !== ts.SyntaxKind.AsteriskToken) return;
  if (program.types.get(arg)?.kind !== "i32") return;
  const op = operatorText(arg.operatorToken.kind);
  walk.ctx.reportPerformance(
    `this \`${op}\` is computed in i32 and wraps before \`${callee.text}\` widens the result, so the conversion cannot ` +
      `recover an overflow that has already happened: convert the operands first, as ` +
      `\`${callee.text}(a) ${op} ${callee.text}(b)\``,
    arg
  );
};

/**
 * A shift by a literal count at or beyond the operand's width. The count is
 * masked to the width rather than left undefined (`docs/LANGUAGE.md` ->
 * "Shifts"), which matches JavaScript but means `x << 32` on an `i32` shifts
 * by nothing at all — never what the line was written to do.
 */
const SHIFT_OPERATORS = [
  ts.SyntaxKind.LessThanLessThanToken,
  ts.SyntaxKind.GreaterThanGreaterThanToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
];

const checkShiftCount = (walk: Walk, expr: ts.BinaryExpression): void => {
  if (!SHIFT_OPERATORS.includes(expr.operatorToken.kind)) return;
  const bits = intBits(walk.ctx.program.types.get(expr) ?? { kind: "void" });
  if (bits === 0) return;
  const count = constantInt(expr.right);
  if (count === undefined || count < 0n || count < BigInt(bits)) return;
  const op = operatorText(expr.operatorToken.kind);
  walk.ctx.reportPerformance(
    `the shift count ${count} is at or beyond the ${bits} bits of the operand, so it is masked to ` +
      `${count % BigInt(bits)} and this shifts by that instead: mask the count yourself if that is intended, or ` +
      `shift a wider value — \`${op}\` never shifts a value out of existence here`,
    expr.right
  );
};

/**
 * A bounds check `bounds.ts` could not remove, on an access inside a loop
 * whose receiver and index are both plain locals — which is the shape the
 * analysis knows how to prove, so a guard really would remove the check.
 *
 * The hint is one rewrite rather than a list because it is the one that always
 * works: a `i >= 0 && i < xs.length` test reaching the access proves both ends
 * whatever took the proof away, `--wrapping` included, where an incremented
 * counter has no lower bound the compiler may assume. An unsigned index is
 * named beside it because `u8`/`u16`/`u32`/`u64` are the ranged types the
 * language already has, and half the proof comes off their declaration.
 */
const checkSurvivingBoundsCheck = (walk: Walk, access: ts.Node): void => {
  const program = walk.ctx.program;
  const parts = accessParts(access);
  if (!parts) return;
  const holder = nameOfLocal(program, parts.receiver);
  const index = nameOfLocal(program, parts.index);
  if (holder === undefined || index === undefined) return;
  walk.ctx.reportPerformance(
    `\`${index}\` is not proven to be in range for \`${holder}\` here, so this access keeps its bounds check and ` +
      `compares against the length on every iteration: guard it with a test that reaches the access — ` +
      `\`if (${index} >= 0 && ${index} < ${holder}.length)\` proves both ends, and an unsigned index needs only ` +
      `the upper one`,
    parts.index
  );
};

/**
 * A call, inside a loop, to a function this module does not export, while
 * `--no-strict-exports` is keeping it an external symbol.
 *
 * The default gives a non-exported function `internal` linkage, which is what
 * lets LLVM treat the call sites it can see as all of them: specialise the
 * body to their arguments, and drop the out-of-line copy once they are
 * inlined. The flag withdraws that for every function in the module at once,
 * and the loop is what makes it worth saying.
 *
 * **What that is worth is a size, not a time.** On `bench/sieve`, whose hot
 * `sieve` is exactly this shape, the flag is 240 bytes — 6,576 against 6,816 —
 * because `opt -O3` inlines and deletes `@sieve` under the default and keeps
 * the out-of-line copy under the flag. The wall clock does not move: five
 * interleaved protocols put the two within 2.4% of each other with the sign
 * flipping between them, and a paired run of 40 rounds had the flagged build
 * ahead 22 times. `bench/spectral` is 64 bytes *smaller* with the flag and the
 * same time either way. So the message names the missed specialisation and no
 * speed figure, and WP15 §8 records the measurement.
 *
 * It cannot be noise for anybody who did not ask for it: the flag is opt-in,
 * so a default build reports none of these, and the rewrite the message names
 * is to stop passing it. An exported function is silent because the ABI is
 * then the point, and a call outside a loop is silent because one indirect
 * call is not a cost anybody is paying.
 */
const checkNotInlinable = (walk: Walk, call: ts.CallExpression): void => {
  if (walk.ctx.opts.strictExports) return;
  if (walk.loops.length === 0) return;
  const callee = walk.ctx.program.callees.get(call);
  if (callee === undefined || callee.exported) return;
  // A `declare function` is external because C defines it, not because this
  // module withheld an `export`: the rewrite named below cannot be taken (the
  // checker refuses `export declare function`) and dropping
  // `--no-strict-exports` would not make it `internal` either. WP27 S1.
  if (callee.foreign === true) return;
  walk.ctx.reportPerformance(
    `\`${callee.sourceName}\` is called here inside a loop and \`--no-strict-exports\` keeps it an external ` +
      `symbol, so the whole-program passes must assume there are callers they cannot see: the function is not ` +
      `specialised to these arguments and its out-of-line copy survives even where every call was inlined — ` +
      `drop \`--no-strict-exports\`, and a function this module does not export is \`internal\` instead`,
    call.expression
  );
};

/**
 * A `substring` bound the WP15 §2 analysis could not place in `[0, s.length]`,
 * on a call inside a loop.
 *
 * JavaScript's `substring` clamps each end, which is an `llvm.smin` /
 * `llvm.smax` pair per bound, and the compiler writes a bound straight through
 * wherever it can prove the clamp cannot move it (`bounds.ts`,
 * `CheckedProgram.provenClamps`). So a bound it could not prove is two
 * intrinsic calls every pass that a guard would take away — which is the one
 * thing this class is for, a slow path with a named rewrite.
 *
 * Two rewrites are named because they are not the same trade. The guard keeps
 * the semantics exactly: a clamped bound that was already in range clamps to
 * itself. `slice` changes them — it panics where `substring` would have
 * clamped — and it is the faster call whichever way the proof goes, measured
 * 1.18x over `substring` on a lexer-shaped scan (WP15 §4).
 *
 * Not reported outside a loop, where the clamp runs once; not reported unless
 * the receiver and the bound are both plain locals, which is the shape the
 * analysis can prove and therefore the shape a guard would help — the same bar
 * `checkSurvivingBoundsCheck` holds itself to. Unlike that one it ignores
 * `--unchecked-indexing`, because the clamp is not a check: the flag does not
 * remove it and neither rewrite depends on it.
 *
 * TODO(wp15): the named guard does not compile for an unsigned bound. On a
 * `u32` the message still says to write `if (k >= 0 && k <= s.length)`, and
 * the checker refuses the second half — ``Operator `<=` requires two numeric
 * operands, got u32 and i32``. `NL9007` has the identical defect and had it
 * before this rule existed, so the fix belongs to both: either the two
 * messages name a rewrite an unsigned bound can write, or the domain learns
 * `atMost` from an unsigned comparison. `slice`, the other rewrite here, does
 * compile on a `u32` today.
 */
const checkUnfoldedClamp = (walk: Walk, call: ts.CallExpression): void => {
  if (walk.loops.length === 0) return;
  const program = walk.ctx.program;
  const callee = unwrapParens(call.expression);
  if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== "substring") return;
  if (call.arguments.length === 0 || call.arguments.length > 2) return;
  if (program.types.get(callee.expression)?.kind !== "string") return;
  const holder = nameOfLocal(program, callee.expression);
  if (holder === undefined) return;
  for (const bound of call.arguments) {
    if (program.provenClamps.has(bound)) continue;
    const name = nameOfLocal(program, bound);
    if (name === undefined) continue;
    walk.ctx.reportPerformance(
      `\`${name}\` is not provably within \`${holder}\`, so this \`substring\` bound keeps the clamp ` +
        `JavaScript specifies — an \`llvm.smin\` and an \`llvm.smax\` on every pass, which the optimiser folds ` +
        `away only where it can hoist the receiver's length, and never where the receiver is a parameter, ` +
        `because the guard compares i32 and the clamp runs on its sext: prove it with a test that reaches the ` +
        `call, as \`if (${name} >= 0 && ${name} <= ${holder}.length)\`, or use \`slice\`, which has no clamp ` +
        `at all and panics where this would have clamped`,
      bound
    );
  }
};

/** The receiver and index of `a[i]` or `s.charCodeAt(i)`; the two shapes that bounds-check. */
const accessParts = (node: ts.Node): { receiver: ts.Expression; index: ts.Expression } | undefined => {
  if (ts.isElementAccessExpression(node)) {
    return { receiver: node.expression, index: node.argumentExpression };
  }
  if (!ts.isCallExpression(node)) return undefined;
  const callee = unwrapParens(node.expression);
  if (!ts.isPropertyAccessExpression(callee) || node.arguments.length !== 1) return undefined;
  return { receiver: callee.expression, index: node.arguments[0] };
};

/** The source name of the local a bare identifier binds, for the message to quote. */
const nameOfLocal = (program: CheckedProgram, expr: ts.Expression): string | undefined => {
  const e = unwrapParens(expr);
  if (!ts.isIdentifier(e)) return undefined;
  return program.bindings.get(e)?.name;
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
      walk.declaredAllocates.push(
        node.initializer !== undefined && allocatesVisibly(walk.ctx.program, node.initializer)
      );
    }
    checkLoopAllocation(walk, node);
  } else if (ts.isBinaryExpression(node)) {
    if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      checkStringAccumulation(walk, node);
      checkArenaReassignment(walk, node);
    }
    checkConstantOverflow(walk, node);
    checkShiftCount(walk, node);
  } else if (ts.isCallExpression(node)) {
    checkWideningConversion(walk, node);
    checkUnfoldedClamp(walk, node);
    checkNotInlinable(walk, node);
  }
  if (walk.unprovenIndices.includes(node)) checkSurvivingBoundsCheck(walk, node);
  ts.forEachChild(node, (child) => walkNode(walk, child));
};

/**
 * Report the performance warnings of one checked function body. Called after
 * the body has been checked so every type and binding it reads is recorded,
 * and only for a body that checked cleanly — advice about code that does not
 * compile is noise, and a poisoned body has incomplete side tables anyway.
 */
export const checkPerformance = (ctx: CheckContext, sig: FunctionSig, unprovenIndices: ts.Node[]): void => {
  const body = sig.body;
  if (!body) return;
  walkNode(
    { ctx, sig, unprovenIndices, loops: [], declared: [], declaredDepth: [], declaredAllocates: [] },
    body
  );
};
