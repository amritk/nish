/**
 * The S1 oracle: `self/lexer.ts` against the `typescript` scanner
 * (docs/wp14-selfhost.md, milestone S1).
 *
 *   node tests/lexer_oracle.js              every tests/cases/*.ts, examples/, self/
 *   node tests/lexer_oracle.js <file>...    just those files
 *   node tests/lexer_oracle.js --verbose    print the first differing line per file
 *
 * Rule 3 of the work package is that stage0 is the oracle for every `self/`
 * phase, and for a lexer stage0's scanner is the `typescript` package's. This
 * script runs that scanner over a file, prints the token stream in the format
 * `self/dump_tokens.ts` prints, and diffs the two. Agreeing on every offset in
 * ~700 files says more than any golden written by hand, and it is the only
 * test that would catch the lexer being subtly one byte out on a construct
 * nobody thought to write a case for.
 *
 * Two translations are needed to make the streams comparable:
 *
 *   - **Offsets.** The scanner counts UTF-16 code units; StaticTS strings are
 *     UTF-8 bytes and so is `charCodeAt`. Every position is mapped through the
 *     byte prefix of the source, which is also the reason a file with a
 *     multi-byte character is worth having in the corpus.
 *   - **Keywords.** TypeScript has ~60 more keywords than StaticTS-0. A word
 *     that is a keyword there and not here is an `IDENT`, which is what it is
 *     to this lexer: the parser refuses `try` as a statement, not as a token.
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

/** Our name for each TypeScript token kind; anything absent is reported as unmapped. */
const NAMES = new Map([
  [ts.SyntaxKind.EndOfFileToken, "END"],
  [ts.SyntaxKind.Identifier, "IDENT"],
  [ts.SyntaxKind.PrivateIdentifier, "PRIVATE_IDENT"],
  [ts.SyntaxKind.NumericLiteral, "NUMBER"],
  [ts.SyntaxKind.BigIntLiteral, "BIGINT"],
  [ts.SyntaxKind.StringLiteral, "STRING"],
  [ts.SyntaxKind.NoSubstitutionTemplateLiteral, "TEMPLATE"],
  [ts.SyntaxKind.TemplateHead, "TEMPLATE_HEAD"],
  [ts.SyntaxKind.TemplateMiddle, "TEMPLATE_MIDDLE"],
  [ts.SyntaxKind.TemplateTail, "TEMPLATE_TAIL"],
  [ts.SyntaxKind.OpenParenToken, "("],
  [ts.SyntaxKind.CloseParenToken, ")"],
  [ts.SyntaxKind.OpenBraceToken, "{"],
  [ts.SyntaxKind.CloseBraceToken, "}"],
  [ts.SyntaxKind.OpenBracketToken, "["],
  [ts.SyntaxKind.CloseBracketToken, "]"],
  [ts.SyntaxKind.CommaToken, ","],
  [ts.SyntaxKind.SemicolonToken, ";"],
  [ts.SyntaxKind.ColonToken, ":"],
  [ts.SyntaxKind.DotToken, "."],
  [ts.SyntaxKind.DotDotDotToken, "..."],
  [ts.SyntaxKind.QuestionToken, "?"],
  [ts.SyntaxKind.QuestionDotToken, "?."],
  [ts.SyntaxKind.QuestionQuestionToken, "??"],
  [ts.SyntaxKind.QuestionQuestionEqualsToken, "??="],
  [ts.SyntaxKind.EqualsGreaterThanToken, "=>"],
  [ts.SyntaxKind.AtToken, "@"],
  [ts.SyntaxKind.PlusToken, "+"],
  [ts.SyntaxKind.MinusToken, "-"],
  [ts.SyntaxKind.AsteriskToken, "*"],
  [ts.SyntaxKind.AsteriskAsteriskToken, "**"],
  [ts.SyntaxKind.SlashToken, "/"],
  [ts.SyntaxKind.PercentToken, "%"],
  [ts.SyntaxKind.EqualsToken, "="],
  [ts.SyntaxKind.PlusEqualsToken, "+="],
  [ts.SyntaxKind.MinusEqualsToken, "-="],
  [ts.SyntaxKind.AsteriskEqualsToken, "*="],
  [ts.SyntaxKind.AsteriskAsteriskEqualsToken, "**="],
  [ts.SyntaxKind.SlashEqualsToken, "/="],
  [ts.SyntaxKind.PercentEqualsToken, "%="],
  [ts.SyntaxKind.PlusPlusToken, "++"],
  [ts.SyntaxKind.MinusMinusToken, "--"],
  [ts.SyntaxKind.EqualsEqualsToken, "=="],
  [ts.SyntaxKind.ExclamationEqualsToken, "!="],
  [ts.SyntaxKind.EqualsEqualsEqualsToken, "==="],
  [ts.SyntaxKind.ExclamationEqualsEqualsToken, "!=="],
  [ts.SyntaxKind.LessThanToken, "<"],
  [ts.SyntaxKind.LessThanEqualsToken, "<="],
  [ts.SyntaxKind.GreaterThanToken, ">"],
  [ts.SyntaxKind.GreaterThanEqualsToken, ">="],
  [ts.SyntaxKind.AmpersandAmpersandToken, "&&"],
  [ts.SyntaxKind.AmpersandAmpersandEqualsToken, "&&="],
  [ts.SyntaxKind.BarBarToken, "||"],
  [ts.SyntaxKind.BarBarEqualsToken, "||="],
  [ts.SyntaxKind.ExclamationToken, "!"],
  [ts.SyntaxKind.AmpersandToken, "&"],
  [ts.SyntaxKind.BarToken, "|"],
  [ts.SyntaxKind.CaretToken, "^"],
  [ts.SyntaxKind.TildeToken, "~"],
  [ts.SyntaxKind.LessThanLessThanToken, "<<"],
  [ts.SyntaxKind.GreaterThanGreaterThanToken, ">>"],
  [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken, ">>>"],
  [ts.SyntaxKind.AmpersandEqualsToken, "&="],
  [ts.SyntaxKind.BarEqualsToken, "|="],
  [ts.SyntaxKind.CaretEqualsToken, "^="],
  [ts.SyntaxKind.LessThanLessThanEqualsToken, "<<="],
  [ts.SyntaxKind.GreaterThanGreaterThanEqualsToken, ">>="],
  [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken, ">>>="],
]);

/** The keywords StaticTS-0 knows; every other TypeScript keyword is an identifier here. */
const KEYWORDS = new Set([
  "function",
  "return",
  "if",
  "else",
  "while",
  "do",
  "for",
  "break",
  "continue",
  "let",
  "const",
  "class",
  "interface",
  "new",
  "this",
  "import",
  "export",
  "true",
  "false",
  "null",
  "throw",
  "switch",
  "case",
  "default",
  "implements",
  "extends",
  "super",
]);

/** Byte offset of every UTF-16 index in `source`, so the two streams can be compared. */
function byteOffsets(source) {
  const offsets = new Int32Array(source.length + 1);
  let bytes = 0;
  for (let i = 0; i < source.length; i++) {
    offsets[i] = bytes;
    const code = source.codePointAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code < 0x10000) bytes += 3;
    else {
      bytes += 4;
      offsets[i + 1] = bytes; // the low surrogate shares the code point's end
      i++;
    }
  }
  offsets[source.length] = bytes;
  return offsets;
}

/**
 * The token stream of `source` as `dump_tokens` would print it, or
 * `{ error }` when the scanner reports a lexical error (an unterminated string
 * or comment): the two sides recover differently by design, and a file that
 * does not lex is not evidence about a lexer that agrees.
 */
function scanWithTypeScript(source) {
  const offsets = byteOffsets(source);
  const lines = [];
  let error;
  const scanner = ts.createScanner(ts.ScriptTarget.ES2020, true, ts.LanguageVariant.Standard, source, (m) => {
    error = error ?? m.message;
  });
  /** Open template substitutions, each counting the `{` inside it, exactly as the lexer does. */
  const braces = [];
  for (;;) {
    let kind = scanner.scan();
    if (error !== undefined) return { error };
    // The scanner hands back a bare `>` so that the parser can close nested
    // type arguments one at a time; it merges `>>` / `>=` / `>>>=` only when
    // asked. `self/lexer.ts` always merges, because StaticTS-0 has no generic
    // type argument list to close, so ask here too.
    if (kind === ts.SyntaxKind.GreaterThanToken) kind = scanner.reScanGreaterToken();
    if (kind === ts.SyntaxKind.CloseBraceToken && braces.length > 0) {
      if (braces[braces.length - 1] === 0) {
        braces.pop();
        kind = scanner.reScanTemplateToken(false);
        if (error !== undefined) return { error };
      } else {
        braces[braces.length - 1] -= 1;
      }
    } else if (kind === ts.SyntaxKind.OpenBraceToken && braces.length > 0) {
      braces[braces.length - 1] += 1;
    }
    if (kind === ts.SyntaxKind.TemplateHead || kind === ts.SyntaxKind.TemplateMiddle) braces.push(0);

    const start = offsets[scanner.getTokenStart()];
    const end = offsets[scanner.getTokenEnd()];
    let name = NAMES.get(kind);
    if (name === undefined) {
      const text = source.slice(scanner.getTokenStart(), scanner.getTokenEnd());
      // A keyword: ours if StaticTS-0 has it, an identifier if not.
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(text)) name = KEYWORDS.has(text) ? text : "IDENT";
      else return { error: `unmapped token ${ts.SyntaxKind[kind]} at ${start}` };
    }
    let line = `${name} ${start} ${end}`;
    if (name === "IDENT") line += ` ${source.slice(scanner.getTokenStart(), scanner.getTokenEnd())}`;
    else if (name === "NUMBER" || name === "BIGINT") {
      line += ` ${source.slice(scanner.getTokenStart(), scanner.getTokenEnd())}`;
    } else if (name.startsWith("TEMPLATE") || name === "STRING") {
      line += ` #${Buffer.byteLength(scanner.getTokenValue(), "utf8")}`;
    } else if (name === "PRIVATE_IDENT") {
      line += ` ${source.slice(scanner.getTokenStart(), scanner.getTokenEnd())}`;
    }
    lines.push(line);
    if (kind === ts.SyntaxKind.EndOfFileToken) break;
  }
  return { lines };
}

function compare(binary, file) {
  const source = fs.readFileSync(file, "utf8");
  const oracle = scanWithTypeScript(source);
  if (oracle.error !== undefined) return { skipped: oracle.error };
  const run = spawnSync(binary, [file], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0)
    return { failed: `dump_tokens exited ${run.status}: ${run.stdout.trim().split("\n").pop()}` };
  const ours = run.stdout.split("\n").filter((l) => l.length > 0);
  const want = oracle.lines;
  for (let i = 0; i < Math.max(ours.length, want.length); i++) {
    if (ours[i] !== want[i]) {
      return {
        failed: `line ${i + 1}: ours \`${ours[i] ?? "<end>"}\`, typescript \`${want[i] ?? "<end>"}\``,
      };
    }
  }
  return { tokens: want.length };
}

function corpus() {
  const dirs = [path.join(root, "tests", "cases"), path.join(root, "examples"), path.join(root, "self")];
  const files = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      if (name.endsWith(".ts")) files.push(path.join(dir, name));
    }
  }
  for (const dir of [
    path.join(root, "tests", "differential", "corpus"),
    path.join(root, "docs", "cookbook"),
    path.join(root, "tests", "lexer"),
  ]) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      // `errors.ts` is the one fixture the oracle cannot judge: the scanner
      // recovers from a lexical error and this lexer stops, so it has a golden
      // of its own in `tests/run.js` instead.
      if (name.endsWith(".ts") && name !== "errors.ts") files.push(path.join(dir, name));
    }
  }
  return files;
}

/** Build `self/dump_tokens.ts` natively; returns the binary path or null without a toolchain. */
function build() {
  const out = path.join(root, "build", "self", "dump_tokens");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const r = spawnSync(
    "node",
    [path.join(root, "dist", "index.js"), path.join(root, "self", "dump_tokens.ts"), "--link", out],
    {
      cwd: root,
      encoding: "utf8",
    }
  );
  if (r.status !== 0) {
    process.stderr.write(`${r.stderr}\n`);
    return null;
  }
  return out;
}

function main(argv) {
  const verbose = argv.includes("--verbose");
  const files = argv.filter((a) => !a.startsWith("--"));
  const binary = build();
  if (binary === null) return 1;
  const inputs = files.length > 0 ? files.map((f) => path.resolve(f)) : corpus();
  let agreed = 0;
  let tokens = 0;
  const skipped = [];
  const failed = [];
  for (const file of inputs) {
    const result = compare(binary, file);
    const name = path.relative(root, file);
    if (result.skipped !== undefined) skipped.push(`${name}: ${result.skipped}`);
    else if (result.failed !== undefined) failed.push(`${name}: ${result.failed}`);
    else {
      agreed++;
      tokens += result.tokens;
    }
  }
  const summary = `${agreed}/${inputs.length - skipped.length} files agree (${tokens} tokens), ${skipped.length} skipped`;
  if (verbose || failed.length > 0) {
    for (const f of failed) process.stdout.write(`  FAIL ${f}\n`);
    if (verbose) for (const s of skipped) process.stdout.write(`  skip ${s}\n`);
  }
  process.stdout.write(`${summary}\n`);
  return failed.length === 0 ? 0 : 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { scanWithTypeScript, compare, corpus, build };
