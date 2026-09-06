import ts from "typescript";

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
 * Collects the errors of one compilation so a phase can keep going after the
 * first one. `throwIfErrors` ends the phase: it sorts what was collected by
 * file (in the order files were first mentioned) and position, throws the
 * first as a plain `CompileError`, and attaches the rest as `additional`.
 */
export class DiagnosticSink {
  private readonly errors: CompileError[] = [];
  private readonly fileOrder = new Map<string, number>();

  /** Record an error. One that already carries `additional` errors (thrown by a nested sink) is flattened. */
  report(err: CompileError): void {
    for (const e of allErrors(err)) {
      if (!this.fileOrder.has(e.file)) this.fileOrder.set(e.file, this.fileOrder.size);
      this.errors.push(e);
    }
    err.additional.length = 0;
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
 * The machine-readable form of one error (`--json`): one flat object, no
 * excerpt. `severity` is always `"error"` (the compiler has no warnings);
 * `code` is reserved for stable diagnostic codes and absent for now.
 */
export function diagnosticJson(err: CompileError): string {
  return JSON.stringify({
    file: err.file,
    line: err.line,
    column: err.column,
    endLine: err.endLine,
    endColumn: err.endColumn,
    severity: "error",
    message: err.kind === "error" ? err.text : `${err.kind}: ${err.text}`,
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
