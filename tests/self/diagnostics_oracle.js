/**
 * The S3 diagnostics oracle: `self/diagnostics.ts` against
 * `src/diagnostics.ts` (docs/wp14-selfhost.md §6 rule 3).
 *
 *   node tests/self/diagnostics_oracle.js             build, run, diff
 *   node tests/self/diagnostics_oracle.js --verbose   print every differing line
 *
 * The `.err` goldens match on a diagnostic's summary line and the CLI prints
 * its excerpt, so "stage1 reports the same errors" means every byte of both.
 * This runs `CompileError`, `DiagnosticSink`, `formatErrorReport` and
 * `diagnosticJson` over the same fixtures and the same spans the driver uses
 * and diffs the output line by line — the line/column index over every offset
 * in the fixture included, because one wrong line start moves every
 * diagnostic after it.
 *
 * The fixtures are ASCII apart from their line endings, and that is a limit of
 * this oracle rather than a property of the subject: `expected()` builds its
 * spans as "every 13th byte" and diffs them against offsets the `typescript`
 * API indexes in UTF-16 code units, so the two only line up while every
 * character is one byte. Both compilers count a *column* in code units
 * (`docs/LANGUAGE.md`), and until they did, the paragraph here retired the
 * difference on the strength of the fixture — which is the mistake
 * `self/diagnostics.ts`'s header is now about. The end-to-end case is
 * `tests/cases/reject_diag_utf8`; making a fixture here non-ASCII needs the
 * span rule to map between the two indices first.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..", "..");
const {
  CompileError,
  DiagnosticSink,
  MAX_REPORTED_ERRORS,
  allErrors,
  diagnosticJson,
  formatErrorReport,
} = await import(pathToFileURL(path.join(root, "dist", "diagnostics.js")).href);

const FIXTURE = path.join(root, "tests", "self", "diagnostics_fixture.txt");
const SECOND = path.join(root, "tests", "self", "diagnostics_second.txt");

/** The spans the driver generates: every 13th byte, nine bytes long. */
function spanStarts(length) {
  const starts = [];
  for (let i = 0; i < length; i += 13) starts.push(i);
  return starts;
}

function sourceFile(file) {
  // The driver is given the path on its command line and prints it back, so
  // the oracle has to name the file the same way.
  return ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
}

/** `sink.throwIfErrors()` reports by throwing; this is the list it would throw. */
function sortedErrors(sink) {
  try {
    sink.throwIfErrors();
    return [];
  } catch (err) {
    return allErrors(err);
  }
}

function expected() {
  const first = sourceFile(FIXTURE);
  const second = sourceFile(SECOND);
  const out = [];

  for (let offset = 0; offset <= first.text.length; offset++) {
    const at = first.getLineAndCharacterOfPosition(offset);
    out.push(`pos ${offset} ${at.line + 1} ${at.character + 1}`);
  }
  const starts = first.getLineStarts();
  for (let line = 0; line < starts.length; line++) {
    const to = line + 1 < starts.length ? starts[line + 1] : first.text.length;
    out.push(`line ${line} ${first.text.slice(starts[line], to).replace(/\r?\n$/, "")}`);
  }

  const report = [];
  const add = (file, start, end, text, kind) => {
    report.push(new CompileError(text, { start, end }, file, kind ?? "error"));
  };
  for (const start of spanStarts(second.text.length)) add(second, start, start + 9, `second at ${start}`);
  const firstStarts = spanStarts(first.text.length);
  for (let i = firstStarts.length - 1; i >= 0; i--) {
    add(first, firstStarts[i], firstStarts[i] + 9, `error at ${firstStarts[i]}`);
  }
  add(first, 0, 0, "empty span");
  add(first, first.text.length, first.text.length, "at end of file");
  add(first, 5, first.text.length, "runs past the end of the line");
  add(first, 1, 3, "a syntax error keeps its kind", "syntax error");

  const sink = new DiagnosticSink();
  for (const err of report) sink.report(err);
  out.push(`count ${report.length} errors ${sink.hasErrors ? 1 : 0}`);
  const sorted = sortedErrors(sink);
  for (const err of sorted) {
    out.push(err.message);
    out.push(diagnosticJson(err));
  }
  // `formatErrorReport` reads the list off the first error, and the sink was
  // emptied by the throw, so it is rebuilt from the sorted list.
  const head = sorted[0];
  head.additional.length = 0;
  head.additional.push(...sorted.slice(1));
  out.push("---- report ----");
  out.push(formatErrorReport(head, MAX_REPORTED_ERRORS));
  out.push("---- report of 3 ----");
  out.push(formatErrorReport(head, 3));

  out.push("---- lone ----");
  out.push(formatErrorReport(new CompileError("the only error", { start: 60, end: 66 }, first)));
  out.push("empty 0");
  return `${out.join("\n")}\n`;
}

function build() {
  const out = path.join(root, "build", "self", "diagnostics");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const r = spawnSync(
    "node",
    [path.join(root, "dist", "index.js"), path.join(root, "tests", "self", "diagnostics.ts"), "--link", out],
    { cwd: root, encoding: "utf8" }
  );
  if (r.status !== 0) {
    process.stderr.write(`${r.stderr}\n`);
    return null;
  }
  return out;
}

function main(argv) {
  const verbose = argv.includes("--verbose");
  const binary = build();
  if (binary === null) return 1;
  const run = spawnSync(binary, [FIXTURE, SECOND], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (run.status !== 0) {
    process.stderr.write(`diagnostics exited ${run.status}\n${run.stderr}`);
    return 1;
  }
  const want = expected().split("\n");
  const got = run.stdout.split("\n");
  const differing = [];
  for (let i = 0; i < Math.max(want.length, got.length); i++) {
    if (want[i] !== got[i]) differing.push(`  line ${i + 1}: want ${want[i]} / got ${got[i]}`);
  }
  if (differing.length > 0) {
    for (const line of verbose ? differing : differing.slice(0, 10)) process.stdout.write(`${line}\n`);
  }
  process.stdout.write(`${want.length - differing.length}/${want.length} lines agree\n`);
  return differing.length === 0 ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
export { expected, build };
