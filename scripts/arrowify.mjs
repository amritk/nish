/**
 * Rewrite a Nish source file's `function` declarations into `const` bound to
 * an arrow, which is how the language declares a function
 * (`docs/wp22-arrow-functions.md` §1).
 *
 *   node scripts/arrowify.mjs self/lexer.ts ...     rewrite in place
 *   node scripts/arrowify.mjs --stdout self/map.ts  print the rewrite, change nothing
 *   node scripts/arrowify.mjs --check self/*.ts     report what is left, exit 1 if any
 *   node scripts/arrowify.mjs --concise tests/cases/fn_arrow.ts
 *
 * The rewrite is **textual, driven by the parse tree**. `typescript` locates
 * each declaration and the splice is computed from its spans, so every byte
 * outside the edit — comments, blank lines, formatting, the body's own
 * indentation — survives untouched. That matters more than it sounds: moving
 * `{` after `=>` leaves every line of the body at the column it was already
 * at, so a block-bodied rewrite **preserves the line count of the file** and
 * cannot move a `-g` line number or a diagnostic's line. Columns hold too,
 * with two enumerable exceptions WP22 §8c measures: the function's own name
 * moves three to the left, and a body written on the same line as its
 * declaration moves three to the right, because ` =>` sits between the return
 * type and the `{`.
 *
 * What it deliberately refuses to touch, and why:
 *
 *   - `declare function f(...): T;` — an ambient declaration defines nothing,
 *     so WP22 §9 keeps it legal and the arrow spelling for it would need a
 *     function type, which Phase 0 forbids. It has no body, which is the test.
 *   - Class methods and constructors. WP22 §3: a method is not an arrow and
 *     will not become one.
 *   - Anything that is not a top-level statement of the file. Nish-0 has no
 *     nested functions, so a nested one is a program this tool has no opinion
 *     about.
 *   - `async function`, and a declaration with no name. Neither compiles here;
 *     converting one would only move the error.
 *
 * `--concise` additionally collapses a body that is exactly one `return expr;`
 * into `=> expr`, for an arrow this run just wrote *and* for one that was
 * already there. The second half is not a flourish: Biome's
 * `useConsistentArrowReturn` is an **error** in `biome.json`, so a block-bodied
 * arrow whose body is one `return` fails `npm run lint` in every directory
 * Biome reads — which is every Nish surface except the test fixtures. A
 * block-only rewrite of `self/` would therefore land hundreds of lint errors,
 * and this is the pass that clears them.
 *
 * It is still a second step rather than the default, and the order matters: a
 * concise body is the one shape where the four declaration kinds stop agreeing,
 * it changes the line count where a block-bodied rewrite does not, and it is
 * what found both bugs in WP22 §8a. Rewrite, verify, *then* collapse and verify
 * again — so that a difference has one cause rather than two.
 */
import fs from "node:fs";
import ts from "typescript";

/** Why one declaration was left alone, for `--check` and the verifier's report. */
const SKIP_REASONS = {
  ambient: "`declare function` stays legal (WP22 §9)",
  anonymous: "no name",
  async: "`async` is forbidden by Phase 0",
  trivia: "a comment sits between the signature and the body",
};

/**
 * The position of the `function` keyword: after the modifiers, if any. Nothing
 * but whitespace and comments can sit between them, so the first occurrence of
 * the word is the keyword itself.
 */
const keywordStart = (text, decl, start) => {
  const mods = decl.modifiers;
  if (mods === undefined || mods.length === 0) return start;
  return text.indexOf("function", mods[mods.length - 1].getEnd());
};

/**
 * Where the callable's *signature* begins once the keyword and the name are
 * gone: the `<` of the type parameters, or the `(` of the parameter list. A
 * generic keeps its type parameters, because `const f = <T>(x: T): T => x` is
 * valid in a `.ts` file — the `<T,>` disambiguation is a `.tsx` problem only
 * (WP22 §9).
 */
const signatureStart = (text, decl) => {
  if (decl.typeParameters !== undefined) return decl.typeParameters.pos - 1;
  return text.indexOf("(", decl.name.getEnd());
};

/** Where it ends: after the return type, or after the `)` when there is none. */
const signatureEnd = (text, decl) => {
  if (decl.type !== undefined) return decl.type.getEnd();
  return text.indexOf(")", decl.parameters.end) + 1;
};

/**
 * A block that means exactly one `return expr;` and nothing else, so `--concise`
 * may drop the braces. A comment anywhere in the block disqualifies it, because
 * the concise form has nowhere to put one — tested by looking at what is
 * *between* the braces and the statement rather than by searching the text for
 * `//`, which would also find one inside a string literal and refuse a
 * collapse that is perfectly fine.
 */
const singleReturn = (text, sf, block) => {
  if (block.statements.length !== 1) return undefined;
  const stmt = block.statements[0];
  if (!ts.isReturnStatement(stmt) || stmt.expression === undefined) return undefined;
  const blank = /^\s*$/;
  if (!blank.test(text.slice(block.getStart(sf) + 1, stmt.getStart(sf)))) return undefined;
  if (!blank.test(text.slice(stmt.getEnd(), block.getEnd() - 1))) return undefined;
  return stmt.expression;
};

/**
 * One declaration's replacement text, or `null` with a reason when it is one of
 * the forms this tool leaves alone.
 */
const replacement = (text, sf, decl, concise) => {
  if (decl.body === undefined) return { skip: "ambient" };
  if (decl.name === undefined) return { skip: "anonymous" };
  const mods = decl.modifiers ?? [];
  if (mods.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) return { skip: "async" };

  const start = decl.getStart(sf);
  const prefix = text.slice(start, keywordStart(text, decl, start));
  const sigEnd = signatureEnd(text, decl);
  const signature = text.slice(signatureStart(text, decl), sigEnd);
  // Whatever sits between the return type and the `{`. Normally one space; a
  // comment there would have to be rewritten rather than moved, so refuse it
  // instead of silently dropping it.
  const gap = text.slice(sigEnd, decl.body.getStart(sf));
  if (!/^\s*$/.test(gap)) return { skip: "trivia" };

  const returned = concise ? singleReturn(text, sf, decl.body) : undefined;
  let body;
  if (returned === undefined) {
    body = text.slice(decl.body.getStart(sf), decl.body.getEnd());
  } else {
    // `=> { ... }` is a block and `=> ({ ... })` is an object literal, so the
    // parentheses are the difference between a value and an empty body.
    const expr = text.slice(returned.getStart(sf), returned.getEnd());
    body = ts.isObjectLiteralExpression(returned) ? `(${expr})` : expr;
  }
  return { start, end: decl.getEnd(), text: `${prefix}const ${decl.name.text} = ${signature} => ${body};` };
};

/**
 * An arrow declaration that is already an arrow but still carries a block for
 * one `return`: `const f = (n: i32): i32 => { return n * 2; };`. Only
 * `--concise` reaches this, and only because Biome's
 * `useConsistentArrowReturn` is an error rather than a warning, so the block
 * form does not merely read worse — it fails the lint.
 */
const conciseArrow = (text, sf, stmt) => {
  const decls = stmt.declarationList.declarations;
  if (decls.length !== 1) return undefined;
  const init = decls[0].initializer;
  if (init === undefined || !ts.isArrowFunction(init) || !ts.isBlock(init.body)) return undefined;
  const returned = singleReturn(text, sf, init.body);
  if (returned === undefined) return undefined;
  const expr = text.slice(returned.getStart(sf), returned.getEnd());
  return {
    start: init.body.getStart(sf),
    end: init.body.getEnd(),
    text: ts.isObjectLiteralExpression(returned) ? `(${expr})` : expr,
  };
};

/**
 * Rewrite every top-level `function` declaration of one file.
 *
 * Returns the new text, whether anything changed, and one entry per
 * declaration that was left alone with the reason it was. Spans are computed
 * against the original text and applied back to front, so no edit moves
 * another edit's offsets.
 */
export const rewrite = (text, fileName, { concise = false } = {}) => {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const edits = [];
  const skipped = [];
  for (const stmt of sf.statements) {
    if (ts.isVariableStatement(stmt)) {
      if (concise) {
        const collapse = conciseArrow(text, sf, stmt);
        if (collapse !== undefined) edits.push(collapse);
      }
      continue;
    }
    if (!ts.isFunctionDeclaration(stmt)) continue;
    const edit = replacement(text, sf, stmt, concise);
    if (edit.skip !== undefined) {
      const name = stmt.name?.text ?? "<anonymous>";
      const { line } = sf.getLineAndCharacterOfPosition(stmt.getStart(sf));
      skipped.push({ name, line: line + 1, reason: SKIP_REASONS[edit.skip] });
      continue;
    }
    edits.push(edit);
  }
  let out = text;
  for (const edit of edits.reverse()) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  return { text: out, changed: edits.length, skipped };
};

const usage = `usage: node scripts/arrowify.mjs [--check|--stdout] [--concise] <file.ts>...

  --check    report what would change and what was skipped; exit 1 if anything would
  --stdout   print the rewrite of a single file instead of writing it
  --concise  also collapse a body that is one \`return expr;\` into \`=> expr\`
`;

const main = (argv) => {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const files = argv.filter((a) => !a.startsWith("--"));
  if (files.length === 0) {
    process.stderr.write(usage);
    return 2;
  }
  const concise = flags.has("--concise");
  let changed = 0;
  let pending = 0;
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const result = rewrite(text, file, { concise });
    for (const skip of result.skipped) {
      process.stderr.write(`${file}:${skip.line}: left \`${skip.name}\` alone: ${skip.reason}\n`);
    }
    // `--stdout` answers with the file whether or not anything changed: a
    // codemod that prints nothing for an unchanged file is a way to truncate
    // one by accident, which is a thing that has happened.
    if (flags.has("--stdout")) {
      process.stdout.write(result.text);
      continue;
    }
    if (result.changed === 0) continue;
    if (flags.has("--check")) pending += result.changed;
    else fs.writeFileSync(file, result.text);
    changed += result.changed;
    process.stdout.write(`${flags.has("--check") ? "would rewrite" : "rewrote"} ${file}: ${result.changed}\n`);
  }
  if (flags.has("--check")) {
    process.stdout.write(`${pending} declaration(s) left to rewrite\n`);
    return pending > 0 ? 1 : 0;
  }
  // `--stdout` answers with the file and nothing else, so a summary there would
  // land in whatever the caller redirected it into.
  if (!flags.has("--stdout")) process.stdout.write(`${changed} declaration(s) rewritten\n`);
  return 0;
};

if (process.argv[1] === import.meta.filename) process.exit(main(process.argv.slice(2)));
