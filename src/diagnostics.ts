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
  /** First line of `message` only: `file:line:col: error: <text>`. */
  readonly summary: string;
  /** The source line and the caret line, without the summary. */
  readonly excerpt: string;

  constructor(message: string, where: ts.Node | SourceSpan, sourceFile: ts.SourceFile, kind = "error") {
    const d = formatDiagnostic(sourceFile, spanOf(where, sourceFile), kind, message);
    super(`${d.summary}\n${d.excerpt}`);
    this.name = "CompileError";
    this.file = sourceFile.fileName;
    this.line = d.line;
    this.column = d.column;
    this.summary = d.summary;
    this.excerpt = d.excerpt;
  }
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
