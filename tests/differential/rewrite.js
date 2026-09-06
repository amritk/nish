/**
 * StaticTS -> JavaScript rewrite for differential testing (WP13).
 *
 * A StaticTS program is valid TypeScript, but its *semantics* are not
 * JavaScript's: `number` is a wrapping 32-bit integer in the default mode,
 * `i64` is a wrapping 64-bit integer, `s.length` is a byte count, `a[i]` is
 * bounds-checked, `throw` traps. To run the same program under Node we
 *
 *   1. check it with the compiler's own checker (dist/compiler.js), which
 *      records the StaticType of every expression in a side table;
 *   2. run a TypeScript AST transformer that consults that table and rewrites
 *      exactly the operations whose JavaScript meaning differs (the rule list
 *      is in docs/wp13-differential.md; each rule is one `case` below);
 *   3. print the transformed AST back to TypeScript and hand it to
 *      `ts.transpileModule` to strip the types and produce an ES module.
 *
 * The output modules import runtime/shim.mjs as `__sts`; a generated
 * `__entry.mjs` calls `main()` and turns its return value into the exit code.
 * Type information comes from the compiler, never from `typescript`'s own
 * checker, so the rewrite agrees with what was actually compiled: a
 * `number` that the checker typed `i32` gets integer semantics, an `f64`
 * (or any `number` under `--number-mode f64`) is left alone.
 */
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..", "..");
const SHIM = path.join(root, "runtime", "shim.mjs");
const { Compilation } = require(path.join(root, "dist", "compiler.js"));

const f = ts.factory;
const SHIM_NS = "__sts";

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

/** Give an arithmetic *result* the wrapping semantics of its StaticType. */
function wrap(kind, expr) {
  if (kind === "i32") return paren(bin(expr, ts.SyntaxKind.BarToken, num(0)));
  if (kind === "i64") return shimCall("wrapI64", [expr]);
  return expr;
}

/** `a op b` with the integer semantics of `kind` (`f64`/string results are plain JS). */
function arith(kind, op, a, b) {
  if (kind === "i32" && op === ts.SyntaxKind.AsteriskToken) {
    // (a * b) | 0 is wrong once the double product exceeds 2^53; imul is the exact `mul i32`.
    return f.createCallExpression(
      f.createPropertyAccessExpression(f.createIdentifier("Math"), "imul"),
      undefined,
      [a, b]
    );
  }
  const plain = bin(a, op, b);
  if (kind === "i32" || kind === "i64") return wrap(kind, paren(plain));
  return paren(plain);
}

const COMPOUND_TO_BINARY = {
  [ts.SyntaxKind.PlusEqualsToken]: ts.SyntaxKind.PlusToken,
  [ts.SyntaxKind.MinusEqualsToken]: ts.SyntaxKind.MinusToken,
  [ts.SyntaxKind.AsteriskEqualsToken]: ts.SyntaxKind.AsteriskToken,
  [ts.SyntaxKind.SlashEqualsToken]: ts.SyntaxKind.SlashToken,
  [ts.SyntaxKind.PercentEqualsToken]: ts.SyntaxKind.PercentToken,
};
const ARITHMETIC = new Set([
  ts.SyntaxKind.PlusToken,
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.AsteriskToken,
  ts.SyntaxKind.SlashToken,
  ts.SyntaxKind.PercentToken,
]);
/** Identifier builtins and the shim function each becomes (`Number` cannot be a shim export name). */
const IDENTIFIER_BUILTINS = new Map([
  ["toI32", "toI32"],
  ["toI64", "toI64"],
  ["toF64", "toF64"],
  ["parseInt", "parseInt"],
  ["parseFloat", "parseFloat"],
  ["Number", "number"],
  ["readFileSync", "readFileSync"],
  ["writeFileSync", "writeFileSync"],
  ["appendFileSync", "appendFileSync"],
]);

function zeroOf(elem) {
  if (elem.kind === "i64") return big(0);
  if (elem.kind === "bool") return f.createFalse();
  if (elem.kind === "nullable") return f.createNull(); // zero-filled pointers are `null`
  return num(0);
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
      // StaticTS lets a derived constructor omit `super()` when no ancestor
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

      // ---- numeric literal typed i64 by context -> BigInt literal ----
      if (ts.isNumericLiteral(node)) {
        if (kindOf(node) === "i64") return big(BigInt(Number(node.text)));
        return node;
      }

      // ---- `throw e` -> trap ----
      if (ts.isThrowStatement(node)) {
        return f.createExpressionStatement(shimCall("trap", []));
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
          if (kind !== "i32" && kind !== "i64") return node; // f64: JS semantics are the fadd/fsub
          const op =
            node.operator === ts.SyntaxKind.PlusPlusToken
              ? ts.SyntaxKind.PlusToken
              : ts.SyntaxKind.MinusToken;
          const one = kind === "i64" ? big(1) : num(1);
          // ++x  ->  (x = wrap(x + 1))
          return paren(f.createAssignment(node.operand, arith(kind, op, node.operand, one)));
        }
        return ts.visitEachChild(node, visit, context);
      }
      if (ts.isPostfixUnaryExpression(node)) {
        const kind = kindOf(node);
        if (kind !== "i32" && kind !== "i64") return node;
        const inc = node.operator === ts.SyntaxKind.PlusPlusToken;
        const one = kind === "i64" ? big(1) : num(1);
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
        if (ARITHMETIC.has(op)) {
          const l = ts.visitNode(node.left, visit);
          const r = ts.visitNode(node.right, visit);
          return arith(kind, op, l, r);
        }
        if (op in COMPOUND_TO_BINARY) {
          const r = ts.visitNode(node.right, visit);
          const binop = COMPOUND_TO_BINARY[op];
          if (ts.isElementAccessExpression(node.left)) {
            // a[i] op= v  ->  __sts.updIdx(a, i, (old) => wrap(old op v))
            const a = ts.visitNode(node.left.expression, visit);
            const i = ts.visitNode(node.left.argumentExpression, visit);
            const old = f.createIdentifier("__old");
            const fn = f.createArrowFunction(
              undefined,
              undefined,
              [f.createParameterDeclaration(undefined, undefined, old)],
              undefined,
              undefined,
              arith(kind, binop, old, r)
            );
            return shimCall("updIdx", [a, i, fn]);
          }
          // x op= v  ->  x = wrap(x op v)  (targets are always simple mutable locals)
          return f.createAssignment(node.left, arith(kind, binop, node.left, r));
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

      // ---- new Array<T>(n) (and the Int32Array/Float64Array/BigInt64Array aliases) -> zero-filled ----
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        /^(Array|Int32Array|Float64Array|BigInt64Array)$/.test(node.expression.text)
      ) {
        const t = typeOf(node);
        const n = ts.visitNode(node.arguments[0], visit);
        return shimCall("newArray", [n, zeroOf(t.elem)]);
      }

      // ---- calls ----
      if (ts.isCallExpression(node)) {
        const args = node.arguments.map((a) => ts.visitNode(a, visit));
        const dotted = dottedName(node.expression);
        if (dotted === "console.log") return shimCall("log", args);
        if (dotted === "process.exit") return shimCall("exit", args);
        if (dotted === "Arena.used") return shimCall("arenaUsed", args);
        if (dotted === "Arena.mark") return shimCall("arenaMark", args);
        if (dotted === "Arena.release") return shimCall("arenaRelease", args);
        if (dotted === "Arena.reset") return shimCall("arenaReset", args);
        if (dotted === "Math.abs") {
          const k = kindOf(node.arguments[0]);
          if (k === "i64") return shimCall("absI64", args);
          if (k === "i32") return wrap("i32", f.updateCallExpression(node, node.expression, undefined, args));
        }
        if ((dotted === "Math.min" || dotted === "Math.max") && kindOf(node.arguments[0]) === "i64") {
          return shimCall(dotted === "Math.min" ? "minI64" : "maxI64", args);
        }
        if (
          ts.isIdentifier(node.expression) &&
          IDENTIFIER_BUILTINS.has(node.expression.text) &&
          !callees.has(node) && // a user function of the same name shadows the builtin
          !bindings.has(node.expression)
        ) {
          return shimCall(IDENTIFIER_BUILTINS.get(node.expression.text), args);
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

module.exports = { rewriteProgram, SHIM };

if (require.main === module) {
  // node tests/differential/rewrite.js <file.ts> [--number-mode f64] [-o <dir>]
  const argv = process.argv.slice(2);
  let numberMode = "i32";
  let out = path.join(root, "build", "test", "differential", "rewrite");
  const inputs = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--number-mode") numberMode = argv[++i];
    else if (argv[i] === "-o") out = argv[++i];
    else if (argv[i] === "--unchecked-indexing") {
      /* no effect on the rewrite */
    } else inputs.push(argv[i]);
  }
  const r = rewriteProgram(inputs[0], { numberMode }, out);
  for (const m of r.modules) process.stdout.write(`// ${m}\n${fs.readFileSync(m, "utf8")}\n`);
}
