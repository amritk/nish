import ts from "typescript";
import { codeFor } from "./codes.js";

/**
 * Diagnostics.
 *
 * Every user-facing error is a `CompileError`. Its `message` has a fixed shape:
 *
 *   <file>:<line>:<col>: error: <text>          <- line 1, the "summary"; tests match on it
 *     3 | return a + true;                       <- the offending source line
 *       |            ^~~~~~~~                    <- caret under the start column, ~ to node end
 *
 * The summary line is byte-for-byte what earlier versions printed, so anything
 * that matches on `file:line:col: error: <msg>` keeps working; the excerpt is
 * appended on its own lines.
 *
 * Multi-error reporting (WP10): the phases that can recover (the validator,
 * signature collection, body checking) do not throw on the first error but
 * hand every `CompileError` to a `DiagnosticSink`. At the end of a phase the
 * sink throws the *first* error in source order with the rest attached as
 * `additional`, so a caller that only knows about single errors still sees
 * exactly the message it always saw, and one that knows about the list
 * (`src/index.ts`) prints them all (`formatErrorReport`, `diagnosticJson`).
 *
 * Performance warnings (WP15 §8) are the second kind of diagnostic and the
 * only one that is not an error. They share the summary/excerpt shape and the
 * sink, and differ in three ways that are the whole of their contract:
 *
 *   - the word in the summary line is `performance`, not `error`, so nothing
 *     that greps `: error: ` picks one up, and `--json` says
 *     `"severity":"performance"` for a tool to filter on;
 *   - they never throw and never touch the exit code, so a program that trips
 *     one still compiles and still exits 0;
 *   - they are *dropped* when the compilation failed. An error report is never
 *     diluted with advice about code that is about to change anyway, which is
 *     also what keeps the single-error output byte-identical to what it was.
 *
 * They have a report order of their own — by file, then by position, then by
 * diagnostic code — which `reportPerformance` keeps as the list is built, for
 * the reason written there. `--json` prints one object per warning, so that is
 * the order of a machine-readable stream and part of what it promises.
 * `self/diagnostics.ts` orders them the same way and has to, because the two
 * are one compiler in two implementations and `--json` answers the same stream
 * from either — but nothing in the suite would catch it if they drifted:
 * `tests/self/parity.js` compares the stderr lines matching ` error: ` and
 * ` warning: `, which a `performance` line is neither of, and no variation of
 * it passes `--json`. This is a rule a reader keeps, not one a test catches.
 */

/** A half-open character range `[start, end)` into a source file's text. */
export interface SourceSpan {
  start: number;
  end: number;
}

function spanOf(where: ts.Node | SourceSpan, sourceFile: ts.SourceFile): SourceSpan {
  if ("kind" in where) {
    // A ts.Node: `pos` includes leading trivia, so use getStart() for the caret.
    const node = where as ts.Node;
    return { start: node.getStart(sourceFile), end: node.getEnd() };
  }
  return { start: where.start, end: Math.max(where.start, where.end) };
}

/** The text of line `line` (0-based) without its line terminator. */
function lineTextAt(sourceFile: ts.SourceFile, line: number): string {
  const starts = sourceFile.getLineStarts();
  const from = starts[line];
  const to = line + 1 < starts.length ? starts[line + 1] : sourceFile.text.length;
  return sourceFile.text.slice(from, to).replace(/\r?\n$/, "");
}

/**
 * Render the source excerpt for a span: the first line of the span, then a caret
 * line with `^` under the start column and `~` extending to the end of the span
 * on that line (capped at the line end). Tabs in the source line are mirrored in
 * the caret line so the markers stay aligned in a terminal.
 */
export function formatSourceExcerpt(sourceFile: ts.SourceFile, span: SourceSpan): string {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(span.start);
  const text = lineTextAt(sourceFile, line);
  const lineNo = String(line + 1);
  const gutter = " ".repeat(lineNo.length);

  // Marker length: to the span end, but never past the end of this line.
  const lineEnd = sourceFile.getLineStarts()[line] + text.length;
  const markerEnd = Math.min(span.end, lineEnd);
  const markerLen = Math.max(1, markerEnd - span.start);

  let pad = "";
  for (let i = 0; i < character; i++) pad += text[i] === "\t" ? "\t" : " ";
  const marker = "^" + "~".repeat(markerLen - 1);

  return [`  ${lineNo} | ${text}`, `  ${gutter} | ${pad}${marker}`].join("\n");
}

/** Build the diagnostic text: summary line plus the excerpt, and the 1-based position. */
export function formatDiagnostic(
  sourceFile: ts.SourceFile,
  span: SourceSpan,
  kind: string,
  message: string
): { summary: string; excerpt: string; line: number; column: number } {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(span.start);
  const summary = `${sourceFile.fileName}:${line + 1}:${character + 1}: ${kind}: ${message}`;
  const excerpt = formatSourceExcerpt(sourceFile, span);
  return { summary, excerpt, line: line + 1, column: character + 1 };
}

/**
 * A compile error anchored to a source location. `message` is the summary line
 * `file:line:col: error: <text>` followed by the source excerpt (see above).
 * `where` is normally a `ts.Node`; a raw `SourceSpan` is accepted for callers
 * that only have character offsets (the parser's syntax diagnostics).
 */
export class CompileError extends Error {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  /** 1-based end of the offending span (exclusive column), for editors. */
  readonly endLine: number;
  readonly endColumn: number;
  /** The diagnostic text alone, without location prefix or excerpt. */
  readonly text: string;
  /** `error` or `syntax error`: the word before the text in the summary line. */
  readonly kind: string;
  /** First line of `message` only: `file:line:col: error: <text>`. */
  readonly summary: string;
  /** The source line and the caret line, without the summary. */
  readonly excerpt: string;
  /**
   * Further errors of the same compilation, in source order after this one.
   * Filled by `DiagnosticSink.throwIfErrors`; empty for a lone error.
   */
  readonly additional: CompileError[] = [];

  constructor(message: string, where: ts.Node | SourceSpan, sourceFile: ts.SourceFile, kind = "error") {
    const span = spanOf(where, sourceFile);
    const d = formatDiagnostic(sourceFile, span, kind, message);
    super(`${d.summary}\n${d.excerpt}`);
    this.name = "CompileError";
    this.file = sourceFile.fileName;
    this.line = d.line;
    this.column = d.column;
    const end = sourceFile.getLineAndCharacterOfPosition(span.end);
    this.endLine = end.line + 1;
    this.endColumn = end.character + 1;
    this.text = message;
    this.kind = kind;
    this.summary = d.summary;
    this.excerpt = d.excerpt;
  }
}

/**
 * One performance warning (WP15 §8): the same anchored, excerpted shape a
 * `CompileError` has, without being an `Error`. It is deliberately not a
 * subclass: a warning must never be throwable, because every `catch` in the
 * driver treats a `CompileError` as a failed compilation.
 *
 * `kind` is always `performance`, so the summary line reads
 * `file:line:col: performance: <text>` and `diagnosticJson` can answer the
 * severity from the diagnostic itself.
 */
export class PerformanceWarning {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly endLine: number;
  readonly endColumn: number;
  /** The advice alone, without location prefix or excerpt. */
  readonly text: string;
  readonly kind = "performance";
  /** First line only: `file:line:col: performance: <text>`. */
  readonly summary: string;
  /** The source line and the caret line, without the summary. */
  readonly excerpt: string;
  /** Summary and excerpt, as `CompileError.message` holds them. */
  readonly message: string;

  constructor(message: string, where: ts.Node | SourceSpan, sourceFile: ts.SourceFile) {
    const span = spanOf(where, sourceFile);
    const d = formatDiagnostic(sourceFile, span, "performance", message);
    this.file = sourceFile.fileName;
    this.line = d.line;
    this.column = d.column;
    const end = sourceFile.getLineAndCharacterOfPosition(span.end);
    this.endLine = end.line + 1;
    this.endColumn = end.character + 1;
    this.text = message;
    this.summary = d.summary;
    this.excerpt = d.excerpt;
    this.message = `${d.summary}\n${d.excerpt}`;
  }
}

/**
 * Collects the errors of one compilation so a phase can keep going after the
 * first one. `throwIfErrors` ends the phase: it sorts what was collected by
 * file (in the order files were first mentioned) and position, throws the
 * first as a plain `CompileError`, and attaches the rest as `additional`.
 */
export class DiagnosticSink {
  private readonly errors: CompileError[] = [];
  private readonly fileOrder = new Map<string, number>();
  /**
   * Performance warnings (WP15 §8), in report order rather than in the order
   * the analysis found them — `reportPerformance` inserts each one where
   * `compareWarnings` puts it. They are never thrown and never cleared between
   * phases: the driver reads them once, after the whole compilation has
   * succeeded.
   */
  private readonly warnings: PerformanceWarning[] = [];
  /**
   * File path -> the order it was first *warned* about. A table of its own,
   * because `fileOrder` is the error report's index and a warning must never
   * be able to move one error in front of another.
   */
  private readonly warningFileOrder = new Map<string, number>();

  /** Record an error. One that already carries `additional` errors (thrown by a nested sink) is flattened. */
  report(err: CompileError): void {
    for (const e of allErrors(err)) {
      if (!this.fileOrder.has(e.file)) this.fileOrder.set(e.file, this.fileOrder.size);
      this.errors.push(e);
    }
    err.additional.length = 0;
  }

  /**
   * Record a performance warning, at its place in the report order rather than
   * at the end of the list. Nothing else about the compilation changes.
   *
   * The insertion is what makes the order an invariant of the list instead of
   * a promise one accessor keeps, which matters because the analysis does not
   * hand the warnings over in order: a generic instantiation's body is checked
   * when the instantiation is finished rather than where the generic is
   * written, and a pass-1 warning is found before pass 2 has looked at the
   * file at all. It is an insertion rather than a sort in the getter so that
   * `self/diagnostics.ts` can be the same code: the language has no
   * `Array.sort` and `self/compile.ts` reads the list directly, and the two
   * halves of a diagnostic are worth more when they read alike. It is a stable
   * insertion sort: the stream arrives in a few nearly sorted runs, one per
   * pass, so the scan back is short, and the list is small whatever happens —
   * compiling all sixty modules of `self/` produces about seventy warnings.
   */
  reportPerformance(warning: PerformanceWarning): void {
    if (!this.warningFileOrder.has(warning.file))
      this.warningFileOrder.set(warning.file, this.warningFileOrder.size);
    this.warnings.push(warning);
    let i = this.warnings.length - 1;
    while (i > 0 && this.compareWarnings(this.warnings[i - 1], warning) > 0) {
      this.warnings[i] = this.warnings[i - 1];
      i--;
    }
    this.warnings[i] = warning;
  }

  /**
   * Negative, zero or positive as warning `a` should be reported before `b`:
   * by file — in the order files were first warned about, so a report follows
   * the import graph the way the error report does — then by the start of the
   * span, then by diagnostic code.
   *
   * The code is what breaks a tie at one position, so that two analyses
   * reporting on the same node come out in the same order whichever of them
   * ran first. It is the last key and never a fallback to the prose: two
   * warnings of the same code at the same position keep the order the analysis
   * produced them in, which is what makes a multi-warning golden reproducible.
   * Comparing `line` and `column` rather than the raw offset is the same
   * ordering — both are monotonic in the offset within a file — and is the
   * comparison `self/diagnostics.ts` can make, where an offset is a byte count
   * and this one is a UTF-16 index.
   */
  private compareWarnings(a: PerformanceWarning, b: PerformanceWarning): number {
    const fileA = this.warningFileOrder.get(a.file)!;
    const fileB = this.warningFileOrder.get(b.file)!;
    if (fileA !== fileB) return fileA - fileB;
    if (a.line !== b.line) return a.line - b.line;
    if (a.column !== b.column) return a.column - b.column;
    const codeA = codeFor(a.kind, a.text);
    const codeB = codeFor(b.kind, b.text);
    // A code is `NL` and four digits, so a code-unit comparison is the byte
    // comparison `compareStrings` makes on the stage1 side.
    return codeA < codeB ? -1 : codeA > codeB ? 1 : 0;
  }

  /** The warnings collected so far, in report order (see `compareWarnings`). */
  get performanceWarnings(): PerformanceWarning[] {
    return this.warnings;
  }

  get hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Run `fn`; a `CompileError` it throws is recorded and the result is false.
   * Anything else is an internal error and propagates untouched.
   */
  recover(fn: () => void): boolean {
    try {
      fn();
      return true;
    } catch (err) {
      if (!(err instanceof CompileError)) throw err;
      this.report(err);
      return false;
    }
  }

  throwIfErrors(): void {
    if (this.errors.length === 0) return;
    const sorted = [...this.errors].sort(
      (a, b) =>
        this.fileOrder.get(a.file)! - this.fileOrder.get(b.file)! || a.line - b.line || a.column - b.column
    );
    const first = sorted[0];
    first.additional.push(...sorted.slice(1));
    this.errors.length = 0;
    throw first;
  }
}

/** The error and every error attached to it, in report order. */
export function allErrors(err: CompileError): CompileError[] {
  return [err, ...err.additional];
}

/** Errors printed in full before the report is cut short with `...and N more`. */
export const MAX_REPORTED_ERRORS = 20;

/**
 * Human-readable report: each error's summary and excerpt, at most `max` of
 * them, then `...and N more errors` and a count line. A lone error prints
 * exactly its `message`, as earlier releases did.
 */
export function formatErrorReport(err: CompileError, max = MAX_REPORTED_ERRORS): string {
  const errors = allErrors(err);
  if (errors.length === 1) return err.message;
  const lines = errors.slice(0, max).map((e) => e.message);
  const hidden = errors.length - max;
  if (hidden > 0) lines.push(`...and ${hidden} more error${hidden === 1 ? "" : "s"}`);
  lines.push(`${errors.length} errors`);
  return lines.join("\n");
}

/**
 * The human-readable report for the performance warnings of one compilation
 * (WP15 §8), shaped exactly like `formatErrorReport` so there is one format
 * to read and one to port: each warning's summary and excerpt, at most `max`
 * of them, then `...and N more performance warnings` and a count line. A lone
 * warning prints exactly its message, and no warnings print nothing at all.
 */
export function formatWarningReport(
  warnings: PerformanceWarning[],
  max = MAX_REPORTED_ERRORS
): string {
  if (warnings.length === 0) return "";
  if (warnings.length === 1) return warnings[0].message;
  const lines = warnings.slice(0, max).map((w) => w.message);
  const hidden = warnings.length - max;
  if (hidden > 0) lines.push(`...and ${hidden} more performance warning${hidden === 1 ? "" : "s"}`);
  lines.push(`${warnings.length} performance warnings`);
  return lines.join("\n");
}

/**
 * The machine-readable form of one diagnostic (`--json`): one flat object, no
 * excerpt. `severity` is `"error"` for every `CompileError` and
 * `"performance"` for a WP15 §8 warning, which is the field a tool filters
 * on; `code` is the stable identifier from `./codes` (`NL0000` when no rule
 * matches the message yet), and is the field to key on rather than the prose,
 * because the prose is allowed to improve and the code is not. The
 * `syntax error: ` prefix stays in `message` because the severity of a syntax
 * error is still `error`.
 *
 * The key order is part of the contract: `tests/run.js` compares stage0's
 * output with stage1's byte for byte, so `self/diagnostics.ts` builds the same
 * object in the same order.
 */
export function diagnosticJson(err: CompileError | PerformanceWarning): string {
  const severity = err.kind === "performance" ? "performance" : "error";
  return JSON.stringify({
    file: err.file,
    line: err.line,
    column: err.column,
    endLine: err.endLine,
    endColumn: err.endColumn,
    severity,
    code: codeFor(err.kind, err.text),
    message: err.kind === "error" || err.kind === "performance" ? err.text : `${err.kind}: ${err.text}`,
  });
}

/**
 * A syntax error reported by the TypeScript parser, formatted exactly like a
 * `CompileError` but with the `syntax error:` prefix in the summary line.
 */
export class StaticSyntaxError extends CompileError {
  constructor(message: string, span: SourceSpan, sourceFile: ts.SourceFile) {
    super(message, span, sourceFile, "syntax error");
    this.name = "StaticSyntaxError";
  }
}
