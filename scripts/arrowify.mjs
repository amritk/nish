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
 *     function type, which Phase 0 forbids. The `declare` modifier is the test,
 *     not the missing body: a body-less declaration without it is an overload
 *     signature the checker refuses, and it is reported as that instead.
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
  bodiless: "no body, and no `declare`: an overload signature, which the language does not have",
  default: "`export default` has no arrow spelling",
  generator: "`function*` has no arrow spelling (WP22 §9)",
  header: "a comment sits between `function` and the parameter list",
  trivia: "a comment sits between the signature and the body",
};

/**
 * The forms with no arrow spelling at all, each identified by the syntax that
 * *makes* it that form rather than by something that usually goes with it.
 *
 * That distinction is the whole of this function, and it was learned the
 * expensive way. `declare` used to be recognised by "has no body", which is
 * true of every `declare function` anybody would write and false of
 * `tests/cases/reject_ffi_body`, where the body is the mistake the case exists
 * to make — so the rewrite turned it into `declare const h = () => {...}` and a
 * program that was refused started compiling. `function* g()` lost its asterisk
 * the same way and became an ordinary function, and `export default function f`
 * became `export default const f = ...`, which is not a sentence.
 *
 * None of the three can appear in `self/`, so none of them would have been
 * caught by the rewrite that matters; all three are in `tests/cases`, which
 * stage C still has to convert. A codemod that silently makes a rejected
 * program compile is the worst thing one can do, because every gate downstream
 * is reading the program it was handed.
 */
const unspellable = (decl) => {
  const mods = decl.modifiers ?? [];
  if (mods.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword)) return "ambient";
  if (mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) return "default";
  if (mods.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) return "async";
  if (decl.asteriskToken !== undefined) return "generator";
  if (decl.name === undefined) return "anonymous";
  return undefined;
};

/**
 * One of a declaration's own child tokens, by kind.
 *
 * Every position this rewrite splices at comes from here rather than from
 * `indexOf`, and the difference is a corrupted file. A comment before the
 * declaration can contain the word `function`, and a comment between the name
 * and the parameter list can contain a parenthesis; a search finds the
 * comment's copy first, so the splice starts or ends in the middle of the
 * comment and writes back a file that no longer parses — silently, because a
 * codemod that located its own edit by guessing has nothing left to check the
 * guess against. The tree knows where each token is, so ask it. It is the same
 * lesson as deciding a concise collapse from the tree rather than from a
 * search for `//`, in the place where getting it wrong costs source rather
 * than a lint error.
 */
const childToken = (sf, decl, kind) => decl.getChildren(sf).find((child) => child.kind === kind);

/**
 * Where the callable's *signature* begins once the keyword and the name are
 * gone: the `<` of the type parameters, or the `(` of the parameter list. A
 * generic keeps its type parameters, because `const f = <T>(x: T): T => x` is
 * valid in a `.ts` file — the `<T,>` disambiguation is a `.tsx` problem only
 * (WP22 §9).
 */
const signatureStart = (sf, decl) => {
  const open =
    decl.typeParameters !== undefined
      ? childToken(sf, decl, ts.SyntaxKind.LessThanToken)
      : childToken(sf, decl, ts.SyntaxKind.OpenParenToken);
  return open.getStart(sf);
};

/** Where it ends: after the return type, or after the `)` when there is none. */
const signatureEnd = (sf, decl) => {
  if (decl.type !== undefined) return decl.type.getEnd();
  return childToken(sf, decl, ts.SyntaxKind.CloseParenToken).getEnd();
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
 * The concise body of an arrow, parenthesised when the grammar requires it.
 *
 * `ConciseBody` is `[lookahead ≠ {] ExpressionBody`, so the rule is about the
 * *first token* of the expression and about nothing else: a body that begins
 * with `{` re-parses as a block. Asking whether the node is an object literal
 * answers that question only for the expression that is one all the way to its
 * last byte, and gets `return { a: 1 } as Pair;` and `return { a: 1 }.a;`
 * wrong in the direction that corrupts source — `=> { a: 1 } as Pair` is a
 * block with two parse errors in it, not a value. That is the same "recognised
 * by what usually accompanies it" mistake WP22 §8c records against the
 * `declare` rule, made one node deeper: an object literal is what usually
 * starts an expression that starts with `{`, not what makes it one.
 */
const conciseBody = (expr) => (expr.startsWith("{") ? `(${expr})` : expr);

/**
 * One declaration's replacement text, or `null` with a reason when it is one of
 * the forms this tool leaves alone.
 */
const replacement = (text, sf, decl, concise) => {
  const unspellableAs = unspellable(decl);
  if (unspellableAs !== undefined) return { skip: unspellableAs };
  // Anything else without a body is an overload signature, which the language
  // does not have; leave it for the checker to refuse in its own words. It is
  // *not* the ambient case and may not be reported as one: `declare` is what
  // makes a declaration legal without a body, and telling a migrator that
  // `function ambient(): void;` is "`declare function` staying legal" names a
  // rule the checker is about to refuse the line under
  // (`tests/wordings/nl2204_function_without_body.ts`).
  if (decl.body === undefined) return { skip: "bodiless" };

  const start = decl.getStart(sf);
  const keyword = childToken(sf, decl, ts.SyntaxKind.FunctionKeyword);
  const prefix = text.slice(start, keyword.getStart(sf));
  const sigStart = signatureStart(sf, decl);
  const sigEnd = signatureEnd(sf, decl);
  const signature = text.slice(sigStart, sigEnd);
  const blank = /^\s*$/;
  // The header is the one region the splice throws away: the keyword, the name
  // and the space around them all become `const NAME = `. Anything else in
  // there is a comment that would have nowhere to go, so refuse the
  // declaration rather than drop it — the same rule the body gap below has,
  // for the same reason.
  if (
    !blank.test(text.slice(keyword.getEnd(), decl.name.getStart(sf))) ||
    !blank.test(text.slice(decl.name.getEnd(), sigStart))
  ) {
    return { skip: "header" };
  }
  // Whatever sits between the return type and the `{`. Normally one space; a
  // comment there would have to be rewritten rather than moved, so refuse it
  // instead of silently dropping it.
  const gap = text.slice(sigEnd, decl.body.getStart(sf));
  if (!blank.test(gap)) return { skip: "trivia" };

  const returned = concise ? singleReturn(text, sf, decl.body) : undefined;
  const body =
    returned === undefined
      ? text.slice(decl.body.getStart(sf), decl.body.getEnd())
      : conciseBody(text.slice(returned.getStart(sf), returned.getEnd()));
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
  return {
    start: init.body.getStart(sf),
    end: init.body.getEnd(),
    text: conciseBody(text.slice(returned.getStart(sf), returned.getEnd())),
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
  --stdout   print the rewrite of a single file instead of writing it (one file only)
  --concise  also collapse a body that is one \`return expr;\` into \`=> expr\`
`;

/**
 * The flags this tool has. A misspelling is refused rather than ignored: the
 * whole of the two-pass recipe is that the block-bodied pass runs *without*
 * `--concise` and the collapse runs *with* it, so a `--consise` that is
 * silently dropped is a pass that did not happen and a verification that
 * blamed the wrong one.
 */
const FLAGS = new Set(["--check", "--stdout", "--concise"]);

const main = (argv) => {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const files = argv.filter((a) => !a.startsWith("--"));
  const unknown = [...flags].filter((flag) => !FLAGS.has(flag));
  if (unknown.length > 0) {
    process.stderr.write(`arrowify: unknown flag ${unknown.join(", ")}\n${usage}`);
    return 2;
  }
  // `--check` answers with an exit code and `--stdout` answers with a file, so
  // asking for both leaves no honest answer: the exit code used to come back 0
  // with the rewrites still pending.
  if (flags.has("--check") && flags.has("--stdout")) {
    process.stderr.write(`arrowify: --check answers with an exit code and --stdout with a file\n${usage}`);
    return 2;
  }
  if (files.length === 0) {
    process.stderr.write(usage);
    return 2;
  }
  // `--stdout` is one file's rewrite on one stream. Handed several it used to
  // concatenate them — a thousand lines of two modules run together, exit 0 —
  // which is not a file anybody can redirect anywhere and is a way to truncate
  // one by accident, the mistake `--stdout` was widened to avoid in the first
  // place.
  if (flags.has("--stdout") && files.length > 1) {
    process.stderr.write(`arrowify: --stdout prints one file; ${files.length} were named\n${usage}`);
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
