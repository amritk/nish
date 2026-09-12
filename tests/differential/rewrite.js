/**
 * Nish -> JavaScript rewrite for differential testing (WP13).
 *
 * An Nish program is valid TypeScript, but its *semantics* are not
 * JavaScript's: `number` is a wrapping 32-bit integer in the default mode,
 * `i64` is a wrapping 64-bit integer, `u8`/`u16`/`u32`/`u64` are unsigned and
 * JavaScript has no unsigned integers at all, `f32` is a 32-bit float and
 * JavaScript has only doubles, `s.length` is a byte count,
 * `a[i]` is bounds-checked, an unmet invariant panics. To run the same program under Node we
 *
 *   1. check it with the compiler's own checker (dist/compiler.js), which
 *      records the StaticType of every expression in a side table;
 *   2. run a TypeScript AST transformer that consults that table and rewrites
 *      exactly the operations whose JavaScript meaning differs (the rule list
 *      is in docs/wp13-differential.md; each rule is one `case` below);
 *   3. print the transformed AST back to TypeScript and hand it to
 *      `ts.transpileModule` to strip the types and produce an ES module.
 *
 * The output modules import runtime/shim.mjs as `__nish`; a generated
 * `__entry.mjs` calls `main()` and turns its return value into the exit code.
 * Type information comes from the compiler, never from `typescript`'s own
 * checker, so the rewrite agrees with what was actually compiled: a
 * `number` that the checker typed `i32` gets integer semantics, an `f64`
 * (or any `number` under `--number-mode f64`) is left alone.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..", "..");
const SHIM = path.join(root, "runtime", "shim.mjs");
const { Compilation } = await import(pathToFileURL(path.join(root, "dist", "compiler.js")).href);

const f = ts.factory;
const SHIM_NS = "__nish";

const shimCall = (name, args) =>
  f.createCallExpression(
    f.createPropertyAccessExpression(f.createIdentifier(SHIM_NS), name),
    undefined,
    args
  );
const paren = (e) => f.createParenthesizedExpression(e);
const bin = (l, op, r) => f.createBinaryExpression(l, op, r);
const num = (n) => f.createNumericLiteral(String(n));
const big = (n) => f.createBigIntLiteral(`${n}n`);

const str = (s) => f.createStringLiteral(s);

/** String methods whose offsets are UTF-8 byte offsets, so the shim owns them (WP14 A2). */
const STRING_METHODS = new Set(["charCodeAt", "substring", "indexOf", "startsWith", "endsWith"]);

/** The integer kinds and how a value of each is held in JavaScript. */
const INT_KINDS = new Set(["i32", "i64", "u8", "u16", "u32", "u64"]);
const UNSIGNED_KINDS = new Set(["u8", "u16", "u32", "u64"]);
/** BigInt kinds: the two 64-bit widths, which do not fit a JavaScript `number`. */
const BIG_KINDS = new Set(["i64", "u64"]);

/** `Math.fround(x)`: the nearest 32-bit float, which is what an `f32` holds. */
const froundCall = (expr) =>
  f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier("Math"), "fround"), undefined, [
    expr,
  ]);

/**
 * Give an arithmetic *result* the wrapping semantics of its StaticType.
 *
 * JavaScript has no unsigned integers, so an unsigned result is masked back
 * into its width: `& 0xFF` / `& 0xFFFF` for the narrow pair (whose ToInt32
 * truncation also handles a negative intermediate) and `>>> 0` for u32, whose
 * ToUint32 is exactly `trunc ... to i32` read as unsigned. u64 is a BigInt and
 * goes through `BigInt.asUintN(64, x)` the way i64 goes through `asIntN`.
 */
function wrap(kind, expr) {
  if (kind === "i32") return paren(bin(expr, ts.SyntaxKind.BarToken, num(0)));
  if (kind === "i64") return shimCall("wrapI64", [expr]);
  if (kind === "u8") return paren(bin(expr, ts.SyntaxKind.AmpersandToken, num(0xff)));
  if (kind === "u16") return paren(bin(expr, ts.SyntaxKind.AmpersandToken, num(0xffff)));
  if (kind === "u32") return paren(bin(expr, ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken, num(0)));
  if (kind === "u64") return shimCall("wrapU64", [expr]);
  // f32: JavaScript has only doubles, so every f32 result is rounded to the
  // nearest float with `Math.fround`. Without it 0.1 stays 0.1 here and is
  // 0.10000000149011612 natively, which is where a missing round shows up.
  if (kind === "f32") return froundCall(expr);
  return expr;
}

/** `a op b` with the integer semantics of `kind` (`f64`/string results are plain JS). */
function arith(kind, op, a, b) {
  if ((kind === "i32" || kind === "u32") && op === ts.SyntaxKind.AsteriskToken) {
    // (a * b) | 0 is wrong once the double product exceeds 2^53; imul is the
    // exact `mul i32`, and its low 32 bits are the same for both signednesses.
    const imul = f.createCallExpression(
      f.createPropertyAccessExpression(f.createIdentifier("Math"), "imul"),
      undefined,
      [a, b]
    );
    return kind === "u32" ? wrap(kind, imul) : imul;
  }
  const plain = bin(a, op, b);
  if (INT_KINDS.has(kind) || kind === "f32") return wrap(kind, paren(plain));
  return paren(plain);
}

/** The bit width of each integer kind, which is what a shift count is masked to. */
const KIND_BITS = { i32: 32, i64: 64, u8: 8, u16: 16, u32: 32, u64: 64 };

/**
 * The 64-bit shifts, which JavaScript's BigInt operators cannot express: BigInt
 * has no `>>>`, its `>>` is arbitrary-precision, and neither masks the count.
 * Picked by kind and operator, so `>>` lands on `ashr` for i64 and `lshr` for
 * u64, exactly as the emitter picks the opcode.
 */
const BIG_SHIFT_SHIMS = {
  i64: {
    [ts.SyntaxKind.LessThanLessThanToken]: "shlI64",
    [ts.SyntaxKind.GreaterThanGreaterThanToken]: "ashrI64",
    [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken]: "lshrI64",
  },
  u64: {
    [ts.SyntaxKind.LessThanLessThanToken]: "shlU64",
    [ts.SyntaxKind.GreaterThanGreaterThanToken]: "lshrU64",
    [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken]: "lshrU64",
  },
};

/** The shift operators, whose right operand is a count rather than a value. */
const SHIFT_OPS = new Set([
  ts.SyntaxKind.LessThanLessThanToken,
  ts.SyntaxKind.GreaterThanGreaterThanToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
]);

/**
 * `a op b` for a bitwise operator.
 *
 * `& | ^` are JavaScript's own once the result is wrapped back into the width.
 * The shifts need two adjustments:
 *
 *   - **The count.** Nish masks it to the operand width. JavaScript's
 *     number shifts already mask to 31, which is that rule at 32 bits, so only
 *     `u8` and `u16` need the mask spelled out.
 *   - **The opcode.** `>>` is arithmetic on a signed type and logical on an
 *     unsigned one, so an unsigned `>>` is rewritten to JavaScript's `>>>`.
 *     An `i32 >>>` is the reverse case: JavaScript yields the *unsigned*
 *     32-bit value in a double where an `i32` is signed, and `wrap` puts those
 *     bits back with `| 0`. That wart is the reason `u32` exists.
 */
function bitwise(kind, op, a, b) {
  const shim = SHIFT_OPS.has(op) ? BIG_SHIFT_SHIMS[kind]?.[op] : undefined;
  if (shim !== undefined) return shimCall(shim, [a, b]);
  let right = b;
  let operator = op;
  if (SHIFT_OPS.has(op)) {
    const bits = KIND_BITS[kind];
    if (bits !== undefined && bits < 32) right = paren(bin(b, ts.SyntaxKind.AmpersandToken, num(bits - 1)));
    if (op === ts.SyntaxKind.GreaterThanGreaterThanToken && UNSIGNED_KINDS.has(kind)) {
      operator = ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken;
    }
  }
  return wrap(kind, paren(bin(a, operator, right)));
}

const COMPOUND_TO_BINARY = {
  [ts.SyntaxKind.PlusEqualsToken]: ts.SyntaxKind.PlusToken,
  [ts.SyntaxKind.MinusEqualsToken]: ts.SyntaxKind.MinusToken,
  [ts.SyntaxKind.AsteriskEqualsToken]: ts.SyntaxKind.AsteriskToken,
  [ts.SyntaxKind.SlashEqualsToken]: ts.SyntaxKind.SlashToken,
  [ts.SyntaxKind.PercentEqualsToken]: ts.SyntaxKind.PercentToken,
  [ts.SyntaxKind.AmpersandEqualsToken]: ts.SyntaxKind.AmpersandToken,
  [ts.SyntaxKind.BarEqualsToken]: ts.SyntaxKind.BarToken,
  [ts.SyntaxKind.CaretEqualsToken]: ts.SyntaxKind.CaretToken,
  [ts.SyntaxKind.LessThanLessThanEqualsToken]: ts.SyntaxKind.LessThanLessThanToken,
  [ts.SyntaxKind.GreaterThanGreaterThanEqualsToken]: ts.SyntaxKind.GreaterThanGreaterThanToken,
  [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken]:
    ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
};
const ARITHMETIC = new Set([
  ts.SyntaxKind.PlusToken,
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.AsteriskToken,
  ts.SyntaxKind.SlashToken,
  ts.SyntaxKind.PercentToken,
]);
const BITWISE = new Set([
  ts.SyntaxKind.AmpersandToken,
  ts.SyntaxKind.BarToken,
  ts.SyntaxKind.CaretToken,
  ts.SyntaxKind.LessThanLessThanToken,
  ts.SyntaxKind.GreaterThanGreaterThanToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
]);

/** `a op b` with the Nish semantics of `kind`, whichever family `op` belongs to. */
const apply = (kind, op, a, b) => (BITWISE.has(op) ? bitwise(kind, op, a, b) : arith(kind, op, a, b));

/**
 * The numeric conversion builtins and the StaticType each produces. A
 * conversion with an unsigned type or an `f32` on either side goes through
 * `__nish.convert`, which takes both kinds; the plain signed/f64 ones keep
 * their own shim helpers.
 */
const CONVERSION_TARGETS = {
  toI32: "i32",
  toI64: "i64",
  toU8: "u8",
  toU16: "u16",
  toU32: "u32",
  toU64: "u64",
  toF32: "f32",
  toF64: "f64",
};

/** Identifier builtins and the shim function each becomes (`Number` cannot be a shim export name). */
const IDENTIFIER_BUILTINS = new Map([
  ["toI32", "toI32"],
  ["toI64", "toI64"],
  ["toF64", "toF64"],
  ["f64ToBits", "f64ToBits"],
  ["bitsToF64", "bitsToF64"],
  ["parseInt", "parseInt"],
  ["parseFloat", "parseFloat"],
  ["Number", "number"],
  ["readFileSync", "readFileSync"],
  ["readFileSyncOrNull", "readFileSyncOrNull"],
  ["write", "write"],
  ["writeError", "writeError"],
  ["panic", "panic"],
  ["writeFileSync", "writeFileSync"],
  ["appendFileSync", "appendFileSync"],
  ["mkdirSync", "mkdirSync"],
  ["spawnSync", "spawnSync"],
  ["isDirectorySync", "isDirectorySync"],
  ["getenv", "getenv"],
  // WP16: natively these bump a struct out of the arena; in JavaScript they
  // build the object with the same three field names (`runtime/shim.mjs`).
  ["Ok", "Ok"],
  ["Err", "Err"],
]);

/**
 * `orReturn()` returns from the *enclosing* function, and no JavaScript
 * expression can do that. The shim's method throws a sentinel instead and the
 * body that contains the call is wrapped in the `try`/`catch` this predicate
 * selects; `__nish.caught` turns the sentinel back into the `Err` the function
 * should have returned, and re-raises anything else.
 */
function propagates(body) {
  let found = false;
  const walk = (node) => {
    if (found) return;
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "orReturn"
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, walk);
  };
  walk(body);
  return found;
}

/** `{ try { <body> } catch (e) { return __nish.caught(e); } }` */
function wrapPropagation(body) {
  const thrown = f.createIdentifier("__propagated");
  return f.createBlock(
    [
      f.createTryStatement(
        f.createBlock(body.statements, true),
        f.createCatchClause(
          f.createVariableDeclaration(thrown),
          f.createBlock([f.createReturnStatement(shimCall("caught", [thrown]))], true)
        ),
        undefined
      ),
    ],
    true
  );
}

function zeroOf(elem) {
  if (BIG_KINDS.has(elem.kind)) return big(0);
  if (elem.kind === "bool") return f.createFalse();
  if (elem.kind === "nullable") return f.createNull(); // zero-filled pointers are `null`
  return num(0);
}

/**
 * The JavaScript literal for a folded module constant (WP14). An Nish
 * module constant *is* its folded value — the compiler emits no global and no
 * initialiser — so substituting the value is the faithful rewrite, and it
 * carries the wrapping, the i64 width and the constant-folded string concat
 * across for free.
 */
function constantLiteral(value) {
  if (value.kind === "bool") return value.value ? f.createTrue() : f.createFalse();
  if (value.kind === "string") return f.createStringLiteral(value.value);
  if (value.kind === "f64") {
    if (Number.isNaN(value.value)) return f.createIdentifier("NaN");
    if (!Number.isFinite(value.value)) {
      const inf = f.createIdentifier("Infinity");
      return value.value > 0 ? inf : f.createPrefixUnaryExpression(ts.SyntaxKind.MinusToken, inf);
    }
    return negatable(value.value < 0, num(Math.abs(value.value)));
  }
  const magnitude = value.value < 0n ? -value.value : value.value;
  const literal = value.type.kind === "i64" ? big(magnitude) : num(magnitude.toString());
  return negatable(value.value < 0n, literal);
}

/** Numeric literals have no sign of their own; a negative one is unary minus. */
function negatable(negative, literal) {
  return negative ? f.createPrefixUnaryExpression(ts.SyntaxKind.MinusToken, literal) : literal;
}

function dottedName(expr) {
  return ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)
    ? `${expr.expression.text}.${expr.name.text}`
    : undefined;
}

/** The transformer for one module; `stemOf(unit)` names the sibling `.mjs` files. */
function makeTransformer(unit, stems) {
  const program = unit.checker.program;
  const { types, callees, bindings } = program;
  const typeOf = (node) => types.get(node);
  const kindOf = (node) => typeOf(node)?.kind;

  return (context) => {
    const visit = (node) => {
      // ---- imports: `./math` -> `./math.mjs` ----
      if (ts.isImportDeclaration(node)) {
        const target = unit.resolved.get(node.moduleSpecifier.text);
        const spec = target ? `./${stems.get(target)}.mjs` : node.moduleSpecifier.text;
        return f.updateImportDeclaration(
          node,
          node.modifiers,
          node.importClause,
          f.createStringLiteral(spec),
          node.attributes
        );
      }

      // ---- implicit super() (WP2b) ----
      // Nish lets a derived constructor omit `super()` when no ancestor
      // constructor takes parameters and calls it before the body; JavaScript
      // throws on the first `this` instead, so the call is made explicit.
      if (ts.isConstructorDeclaration(node) && node.body && ts.isClassDeclaration(node.parent)) {
        const derived = (node.parent.heritageClauses ?? []).some(
          (c) => c.token === ts.SyntaxKind.ExtendsKeyword
        );
        const first = node.body.statements[0];
        const explicitSuper =
          first &&
          ts.isExpressionStatement(first) &&
          ts.isCallExpression(first.expression) &&
          first.expression.expression.kind === ts.SyntaxKind.SuperKeyword;
        if (derived && !explicitSuper) {
          const body = ts.visitNode(node.body, visit);
          const superCall = f.createExpressionStatement(
            f.createCallExpression(f.createSuper(), undefined, [])
          );
          return f.updateConstructorDeclaration(
            node,
            node.modifiers,
            node.parameters,
            f.updateBlock(body, [superCall, ...body.statements])
          );
        }
        return ts.visitEachChild(node, visit, context);
      }

      // ---- top-level `const` -> its folded value (WP14) ----
      // A declaration the checker folded becomes its literal. One it did not is
      // visited like any other node, and that is not a detail: since WP22 a
      // *function* is an arrow bound to a top-level `const`, so returning such a
      // declaration unvisited swallowed every arrow-declared function body — the
      // builtins inside it were left as bare `mkdirSync(...)` and `console.log`,
      // which either threw `ReferenceError` under Node or, worse, silently ran
      // JavaScript's own version of a call the shim exists to emulate. Every
      // arrow-written program in the corpus was being compared that way.
      if (ts.isVariableStatement(node) && ts.isSourceFile(node.parent)) {
        const declarations = node.declarationList.declarations.map((decl) => {
          const info = program.constants.get(decl.name.text);
          if (!info || info.value === undefined) return ts.visitEachChild(decl, visit, context);
          return f.updateVariableDeclaration(
            decl,
            decl.name,
            undefined,
            decl.type,
            constantLiteral(info.value)
          );
        });
        return f.updateVariableStatement(
          node,
          node.modifiers,
          f.updateVariableDeclarationList(node.declarationList, declarations)
        );
      }

      // ---- numeric literal typed i64/u64 by context -> BigInt literal ----
      if (ts.isNumericLiteral(node)) {
        const k = kindOf(node);
        if (BIG_KINDS.has(k)) return big(BigInt(Number(node.text)));
        if (k === "f32") return froundCall(node); // `0.1` is not a float
        return node; // u8/u16/u32 literals are non-negative and in range already
      }

      // ---- unary minus and ++/-- ----
      if (ts.isPrefixUnaryExpression(node)) {
        const kind = kindOf(node);
        if (node.operator === ts.SyntaxKind.MinusToken) {
          const inner = ts.visitNode(node.operand, visit);
          return wrap(kind, paren(f.createPrefixUnaryExpression(ts.SyntaxKind.MinusToken, inner)));
        }
        if (
          node.operator === ts.SyntaxKind.PlusPlusToken ||
          node.operator === ts.SyntaxKind.MinusMinusToken
        ) {
          if (!INT_KINDS.has(kind) && kind !== "f32") return node; // f64: JS semantics are the fadd/fsub
          const op =
            node.operator === ts.SyntaxKind.PlusPlusToken
              ? ts.SyntaxKind.PlusToken
              : ts.SyntaxKind.MinusToken;
          const one = BIG_KINDS.has(kind) ? big(1) : num(1);
          // ++x  ->  (x = wrap(x + 1))
          return paren(f.createAssignment(node.operand, arith(kind, op, node.operand, one)));
        }
        return ts.visitEachChild(node, visit, context);
      }
      if (ts.isPostfixUnaryExpression(node)) {
        const kind = kindOf(node);
        if (!INT_KINDS.has(kind) && kind !== "f32") return node;
        const inc = node.operator === ts.SyntaxKind.PlusPlusToken;
        const one = BIG_KINDS.has(kind) ? big(1) : num(1);
        // x++  ->  wrap((x = wrap(x + 1)) - 1): the old value, recovered with wrapping arithmetic.
        const assign = paren(
          f.createAssignment(
            node.operand,
            arith(kind, inc ? ts.SyntaxKind.PlusToken : ts.SyntaxKind.MinusToken, node.operand, one)
          )
        );
        return arith(kind, inc ? ts.SyntaxKind.MinusToken : ts.SyntaxKind.PlusToken, assign, one);
      }

      // ---- binary operators ----
      if (ts.isBinaryExpression(node)) {
        const op = node.operatorToken.kind;
        const kind = kindOf(node);
        if (ARITHMETIC.has(op) || BITWISE.has(op)) {
          const l = ts.visitNode(node.left, visit);
          const r = ts.visitNode(node.right, visit);
          return apply(kind, op, l, r);
        }
        if (op in COMPOUND_TO_BINARY) {
          const r = ts.visitNode(node.right, visit);
          const binop = COMPOUND_TO_BINARY[op];
          if (ts.isElementAccessExpression(node.left)) {
            // a[i] op= v  ->  __nish.updIdx(a, i, (old) => wrap(old op v))
            const a = ts.visitNode(node.left.expression, visit);
            const i = ts.visitNode(node.left.argumentExpression, visit);
            const old = f.createIdentifier("__old");
            const fn = f.createArrowFunction(
              undefined,
              undefined,
              [f.createParameterDeclaration(undefined, undefined, old)],
              undefined,
              undefined,
              apply(kind, binop, old, r)
            );
            return shimCall("updIdx", [a, i, fn]);
          }
          // x op= v  ->  x = wrap(x op v), for a local and for a field alike.
          // The target is rewritten once and reused on both sides, so a
          // receiver that itself needs rewriting is not visited twice.
          const l = ts.visitNode(node.left, visit);
          return f.createAssignment(l, apply(kind, binop, l, r));
        }
        if (op === ts.SyntaxKind.EqualsToken && ts.isElementAccessExpression(node.left)) {
          const a = ts.visitNode(node.left.expression, visit);
          const i = ts.visitNode(node.left.argumentExpression, visit);
          const v = ts.visitNode(node.right, visit);
          return shimCall("setIdx", [a, i, v]);
        }
        return ts.visitEachChild(node, visit, context);
      }

      // ---- a[i] read ----
      if (ts.isElementAccessExpression(node)) {
        const a = ts.visitNode(node.expression, visit);
        const i = ts.visitNode(node.argumentExpression, visit);
        return shimCall("idx", [a, i]);
      }

      // ---- s.length on strings -> byte length ----
      if (
        ts.isPropertyAccessExpression(node) &&
        node.name.text === "length" &&
        kindOf(node.expression) === "string"
      ) {
        return shimCall("strLen", [ts.visitNode(node.expression, visit)]);
      }

      // ---- process.argv -> the script and its arguments (argv[0] is the program, as natively) ----
      if (dottedName(node) === "process.argv" && !bindings.has(node.expression)) {
        return shimCall("argv", []);
      }

      // ---- process.platform / process.arch -> Node's own, which is what the runtime answers ----
      if (dottedName(node) === "process.platform" && !bindings.has(node.expression)) {
        return shimCall("platform", []);
      }
      if (dottedName(node) === "process.arch" && !bindings.has(node.expression)) {
        return shimCall("arch", []);
      }

      // ---- new Array<T>(n) (and the Int32Array/Float64Array/BigInt64Array aliases) -> zero-filled ----
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        /^(Array|Int32Array|Float32Array|Float64Array|BigInt64Array)$/.test(node.expression.text)
      ) {
        const t = typeOf(node);
        const n = ts.visitNode(node.arguments[0], visit);
        return shimCall("newArray", [n, zeroOf(t.elem)]);
      }

      // ---- a body that propagates (WP16) ----
      if (ts.isFunctionDeclaration(node) && node.body && propagates(node.body)) {
        const body = ts.visitNode(node.body, visit);
        return f.updateFunctionDeclaration(
          node,
          node.modifiers,
          node.asteriskToken,
          node.name,
          node.typeParameters,
          node.parameters.map((p) => ts.visitNode(p, visit)),
          node.type,
          wrapPropagation(body)
        );
      }

      // ---- calls ----
      if (ts.isCallExpression(node)) {
        const args = node.arguments.map((a) => ts.visitNode(a, visit));
        const dotted = dottedName(node.expression);
        if (dotted === "console.log") return shimCall("log", args);
        if (dotted === "console.error") return shimCall("error", args);
        // The string byte methods (WP14 A2): every offset is a UTF-8 byte
        // offset, which JavaScript's own methods do not use.
        if (
          ts.isPropertyAccessExpression(node.expression) &&
          STRING_METHODS.has(node.expression.name.text) &&
          kindOf(node.expression.expression) === "string"
        ) {
          const receiver = ts.visitNode(node.expression.expression, visit);
          return shimCall(node.expression.name.text, [receiver, ...args]);
        }
        if (dotted === "String.fromCharCode" && !bindings.has(node.expression.expression)) {
          return shimCall("fromCharCode", args);
        }
        // `a.pop()` panics on an empty array; `push`, `indexOf` and `join`
        // mean the same thing on both sides and pass through.
        if (
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === "pop" &&
          typeOf(node.expression.expression)?.kind === "array"
        ) {
          return shimCall("pop", [ts.visitNode(node.expression.expression, visit)]);
        }
        if (dotted === "process.exit") return shimCall("exit", args);
        if (dotted === "Arena.used") return shimCall("arenaUsed", args);
        if (dotted === "Arena.mark") return shimCall("arenaMark", args);
        if (dotted === "Arena.release") return shimCall("arenaRelease", args);
        if (dotted === "Arena.reset") return shimCall("arenaReset", args);
        if (dotted === "Math.abs") {
          const k = kindOf(node.arguments[0]);
          if (k === "i64") return shimCall("absI64", args);
          // An unsigned value is already its own magnitude, and `Math.abs`
          // throws on a BigInt, so the call simply disappears.
          if (UNSIGNED_KINDS.has(k)) return args[0];
          if (k === "i32") return wrap("i32", f.updateCallExpression(node, node.expression, undefined, args));
        }
        if (dotted === "Math.min" || dotted === "Math.max") {
          const k = kindOf(node.arguments[0]);
          const isMin = dotted === "Math.min";
          if (k === "i64") return shimCall(isMin ? "minI64" : "maxI64", args);
          if (k === "u64") return shimCall(isMin ? "minU64" : "maxU64", args); // Math.* rejects BigInt
        }
        if (
          ts.isIdentifier(node.expression) &&
          !callees.has(node) && // a user function of the same name shadows the builtin
          !bindings.has(node.expression)
        ) {
          // A conversion with an unsigned type or an `f32` on either side goes
          // through the one shim helper that knows the whole
          // sext/zext/trunc/fptrunc/fround matrix (WP15).
          const to = CONVERSION_TARGETS[node.expression.text];
          const from = to === undefined ? undefined : kindOf(node.arguments[0]);
          const touchesF32 = to === "f32" || from === "f32";
          if (to !== undefined && (touchesF32 || UNSIGNED_KINDS.has(to) || UNSIGNED_KINDS.has(from))) {
            return shimCall("convert", [args[0], str(from), str(to)]);
          }
          if (IDENTIFIER_BUILTINS.has(node.expression.text)) {
            return shimCall(IDENTIFIER_BUILTINS.get(node.expression.text), args);
          }
        }
        return f.updateCallExpression(node, ts.visitNode(node.expression, visit), undefined, args);
      }

      return ts.visitEachChild(node, visit, context);
    };
    return (sf) => ts.visitEachChild(sf, visit, context);
  };
}

/**
 * Rewrite the program rooted at `entry` into `outDir/<stem>.mjs` files plus
 * `outDir/__entry.mjs`. Returns `{ entry, modules }` with absolute paths.
 * Throws if the compiler rejects the program (the checker is what types it).
 */
function rewriteProgram(entry, opts, outDir) {
  const compilation = new Compilation({
    numberMode: opts.numberMode ?? "i32",
    uncheckedIndexing: opts.uncheckedIndexing ?? false,
    // The rewrite only needs the checker's types, but the checker also folds
    // module constants, and folding follows the compilation's overflow mode: a
    // program compiled with `--wrapping` may hold a constant that the default
    // refuses. Pass the flag through or the JavaScript side would fail to build
    // for a program the native side compiled happily.
    nsw: opts.nsw ?? true,
  });
  compilation.addRoot(entry);
  compilation.check();
  const stems = compilation.outputStems();
  fs.mkdirSync(outDir, { recursive: true });

  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const modules = [];
  for (const unit of compilation.modules) {
    const result = ts.transform(unit.sourceFile, [makeTransformer(unit, stems)]);
    const rewrittenTs = `import * as ${SHIM_NS} from ${JSON.stringify(SHIM)};\n${printer.printFile(result.transformed[0])}`;
    result.dispose();
    const stem = stems.get(unit);
    fs.writeFileSync(path.join(outDir, `${stem}.rewritten.ts`), rewrittenTs);
    const js = ts.transpileModule(rewrittenTs, {
      fileName: `${stem}.ts`,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        removeComments: false,
        newLine: ts.NewLineKind.LineFeed,
      },
    }).outputText;
    const out = path.join(outDir, `${stem}.mjs`);
    fs.writeFileSync(out, js);
    modules.push(out);
  }

  const entryUnit = compilation.entry;
  const entryJs = path.join(outDir, "__entry.mjs");
  const hasMain = Boolean(entryUnit.checker.program.entryMain);
  fs.writeFileSync(
    entryJs,
    [
      `import * as m from "./${stems.get(entryUnit)}.mjs";`,
      hasMain ? "const r = m.main();" : "const r = 0;",
      // The C wrapper returns main's i32 to the OS, which keeps the low 8 bits; Node's exit does the same.
      "process.exit(r === undefined ? 0 : Number(r) | 0);",
      "",
    ].join("\n")
  );
  return { entry: entryJs, modules, hasMain };
}

export { rewriteProgram, SHIM };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // node tests/differential/rewrite.js <file.ts> [--number-mode f64] [--wrapping] [-o <dir>]
  const argv = process.argv.slice(2);
  let numberMode = "i32";
  let nsw = true;
  let out = path.join(root, "build", "test", "differential", "rewrite");
  const inputs = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--number-mode") numberMode = argv[++i];
    else if (argv[i] === "--wrapping") nsw = false;
    else if (argv[i] === "-o") out = argv[++i];
    else if (argv[i] === "--unchecked-indexing") {
      /* no effect on the rewrite */
    } else inputs.push(argv[i]);
  }
  const r = rewriteProgram(inputs[0], { numberMode, nsw }, out);
  for (const m of r.modules) process.stdout.write(`// ${m}\n${fs.readFileSync(m, "utf8")}\n`);
}
