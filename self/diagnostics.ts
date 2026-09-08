// Diagnostics for stage1 (docs/wp14-selfhost.md, milestone S3), ported from
// `src/diagnostics.ts`. Every user-facing error has the same fixed shape it
// has today, because the `.err` goldens match on the summary line:
//
//   <file>:<line>:<col>: error: <text>          the summary; the tests match this
//     3 | return a + true;                      the offending source line
//       |            ^~~~~~~~                   a caret at the start, ~ to the end
//
// **No exceptions.** `src/` throws a `CompileError` from 292 sites and catches
// it in six; a `throw` traps and discards its value, so this is the
// error-value threading of §3a D1: a phase reports into a sink and returns a
// sentinel, and the sink is asked at the end of the phase whether to stop.
// That is the classic recursive-descent recovery tax and it is worse than
// `try`/`catch`; it is written out here rather than hidden so the cost stays
// visible.
//
// **Columns are bytes**, as everywhere in `self/`, where stage0's are UTF-16
// code units. The two agree for every ASCII source line, which is every line
// of every `.err` golden; a diagnostic pointing into a line with a multi-byte
// character is the one place stage0 and stage1 can print different columns for
// the same error, and the same mapping the lexer oracle already does resolves
// it.

import { jsonQuote, StringBuilder } from "./strings";
import { StringMap } from "./map";

const CH_LF: i32 = 10;
const CH_CR: i32 = 13;
const CH_TAB: i32 = 9;

/** Errors printed in full before the report is cut short with `...and N more`. */
export const MAX_REPORTED_ERRORS: i32 = 20;

/**
 * One source file and the line index a diagnostic needs. The line starts are
 * computed once: `src/` gets them from `ts.SourceFile.getLineStarts()`, and a
 * scan per diagnostic would be quadratic in a file with many errors.
 */
export class SourceFile {
  path: string;
  text: string;
  /** Byte offset of the first character of each line; `starts[0]` is 0. */
  starts: i32[];

  constructor(path: string, text: string) {
    this.path = path;
    this.text = text;
    this.starts = [];
    this.starts.push(0);
    let i = 0;
    while (i < text.length) {
      if (text.charCodeAt(i) === CH_LF) {
        this.starts.push(i + 1);
      }
      i = i + 1;
    }
  }

  /** The 0-based line containing `offset`, by binary search over the line starts. */
  lineIndex(offset: i32): i32 {
    let low = 0;
    let high = this.starts.length - 1;
    while (low < high) {
      const mid = low + ((high - low + 1) >> 1);
      if (this.starts[mid] <= offset) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    return low;
  }

  /** The 1-based line of `offset`, as the summary line prints it. */
  lineOf(offset: i32): i32 {
    return this.lineIndex(offset) + 1;
  }

  /** The 1-based column of `offset`, counted in bytes. */
  columnOf(offset: i32): i32 {
    return offset - this.starts[this.lineIndex(offset)] + 1;
  }

  /** The text of a 0-based line without its terminator, `\r\n` included. */
  lineText(line: i32): string {
    const from = this.starts[line];
    const to = line + 1 < this.starts.length ? this.starts[line + 1] : this.text.length;
    let end = to;
    if (end > from && this.text.charCodeAt(end - 1) === CH_LF) {
      end = end - 1;
    }
    if (end > from && this.text.charCodeAt(end - 1) === CH_CR) {
      end = end - 1;
    }
    return this.text.substring(from, end);
  }
}

/**
 * One error, anchored to a half-open byte span of one file. `line` and
 * `column` are computed when it is reported rather than when it is printed,
 * because the sort in `DiagnosticSink` reads them for every comparison.
 */
export class Diagnostic {
  source: SourceFile;
  start: i32;
  end: i32;
  /** `error` or `syntax error`: the word before the text in the summary line. */
  kind: string;
  /** The message alone, without location prefix or excerpt. */
  text: string;
  line: i32;
  column: i32;

  constructor(source: SourceFile, start: i32, end: i32, kind: string, text: string) {
    this.source = source;
    this.start = start;
    this.end = end < start ? start : end;
    this.kind = kind;
    this.text = text;
    this.line = source.lineOf(start);
    this.column = source.columnOf(start);
  }

  /** `<file>:<line>:<col>: <kind>: <text>` — the line the tests match on. */
  summary(): string {
    return `${this.source.path}:${this.line}:${this.column}: ${this.kind}: ${this.text}`;
  }

  /**
   * The source line and a caret line under the span: `^` at the start and `~`
   * to the end of the span, never past the end of that line. Tabs in the
   * source are mirrored in the caret line so the markers stay aligned in a
   * terminal.
   */
  excerpt(): string {
    const line = this.source.lineIndex(this.start);
    const text = this.source.lineText(line);
    const lineNo = `${this.line}`;
    const lineEnd = this.source.starts[line] + text.length;
    const markerEnd = this.end < lineEnd ? this.end : lineEnd;
    let markerLength = markerEnd - this.start;
    if (markerLength < 1) {
      markerLength = 1;
    }

    const pad = new StringBuilder();
    let i = 0;
    while (i < this.column - 1) {
      pad.addChar(text.charCodeAt(i) === CH_TAB ? CH_TAB : 32);
      i = i + 1;
    }
    const marker = new StringBuilder();
    marker.addChar(94); // '^'
    let tilde = 1;
    while (tilde < markerLength) {
      marker.addChar(126); // '~'
      tilde = tilde + 1;
    }

    const gutter = new StringBuilder();
    let space = 0;
    while (space < lineNo.length) {
      gutter.addChar(32);
      space = space + 1;
    }
    return `  ${lineNo} | ${text}\n  ${gutter.toText()} | ${pad.toText()}${marker.toText()}`;
  }

  /** The summary and the excerpt: what `CompileError.message` holds in stage0. */
  message(): string {
    return `${this.summary()}\n${this.excerpt()}`;
  }

  /** The `--json` form: one flat object, no excerpt. */
  json(): string {
    const endLine = this.source.lineOf(this.end);
    const endColumn = this.source.columnOf(this.end);
    const message = this.kind === "error" ? this.text : `${this.kind}: ${this.text}`;
    return `{"file":${jsonQuote(this.source.path)},"line":${this.line},"column":${this.column},"endLine":${endLine},"endColumn":${endColumn},"severity":"error","message":${jsonQuote(message)}}`;
  }
}

/**
 * Collects the errors of one compilation so a phase can keep going after the
 * first. The order is by file — in the order files were first mentioned, not
 * alphabetically, so a report follows the import graph the way stage0's does
 * — and then by position.
 */
export class DiagnosticSink {
  items: Diagnostic[];
  /** File path -> the order it was first mentioned in. */
  fileOrder: StringMap;

  constructor() {
    this.items = [];
    this.fileOrder = new StringMap();
  }

  report(source: SourceFile, start: i32, end: i32, text: string): void {
    this.reportKind(source, start, end, "error", text);
  }

  reportKind(source: SourceFile, start: i32, end: i32, kind: string, text: string): void {
    if (!this.fileOrder.has(source.path)) {
      this.fileOrder.set(source.path, this.fileOrder.size());
    }
    this.items.push(new Diagnostic(source, start, end, kind, text));
  }

  hasErrors(): boolean {
    return this.items.length > 0;
  }

  count(): i32 {
    return this.items.length;
  }

  /** Negative, zero or positive as `a` should be reported before `b`. */
  compare(a: Diagnostic, b: Diagnostic): i32 {
    const fileA = this.fileOrder.get(a.source.path, 0);
    const fileB = this.fileOrder.get(b.source.path, 0);
    if (fileA !== fileB) {
      return fileA - fileB;
    }
    if (a.line !== b.line) {
      return a.line - b.line;
    }
    if (a.column !== b.column) {
      return a.column - b.column;
    }
    return 0;
  }

  /**
   * The diagnostics in report order. The sort is **stable** and the
   * comparison never falls back to the message text: two errors at one
   * position keep the order the phases produced them in, which is what makes
   * a multi-error golden reproducible. Bottom-up merge sort, because
   * The language has no `Array.sort` and an insertion sort is quadratic on the
   * cascade a single bad declaration can produce.
   */
  sorted(): Diagnostic[] {
    let source: Diagnostic[] = [];
    let target: Diagnostic[] = [];
    for (const item of this.items) {
      source.push(item);
      target.push(item);
    }
    let width = 1;
    while (width < source.length) {
      let low = 0;
      while (low < source.length) {
        const mid = low + width < source.length ? low + width : source.length;
        const high = low + width * 2 < source.length ? low + width * 2 : source.length;
        let left = low;
        let right = mid;
        let out = low;
        while (out < high) {
          const takeLeft = left < mid && (right >= high || this.compare(source[left], source[right]) <= 0);
          if (takeLeft) {
            target[out] = source[left];
            left = left + 1;
          } else {
            target[out] = source[right];
            right = right + 1;
          }
          out = out + 1;
        }
        low = low + width * 2;
      }
      const swap = source;
      source = target;
      target = swap;
      width = width * 2;
    }
    return source;
  }

  /**
   * The human-readable report: each error's summary and excerpt, at most
   * `max` of them, then `...and N more errors` and a count line. A lone error
   * prints exactly its message, as stage0 does.
   */
  format(max: i32): string {
    const errors = this.sorted();
    if (errors.length === 1) {
      return errors[0].message();
    }
    const lines: string[] = [];
    let i = 0;
    while (i < errors.length && i < max) {
      lines.push(errors[i].message());
      i = i + 1;
    }
    const hidden = errors.length - max;
    if (hidden > 0) {
      lines.push(`...and ${hidden} more error${hidden === 1 ? "" : "s"}`);
    }
    lines.push(`${errors.length} errors`);
    return lines.join("\n");
  }
}
