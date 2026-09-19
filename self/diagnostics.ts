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
//
// The performance warnings of WP15 §8 are the one diagnostic here that is not
// an error. They ride on the same `Diagnostic` with `kind` set to
// `performance`, live in a second list the sink never throws or clears, and
// are dropped whenever the compilation failed — an error report is never
// diluted with advice about code that is about to change. They have a report
// order of their own — by file, then by position, then by diagnostic code —
// which `reportPerformance` keeps as the list is built, for the reason written
// there. `src/diagnostics.ts` orders them the same way and has to, because the
// two are one compiler in two implementations and `--json` promises the same
// stream from either. Only the WP15 block of `tests/run.js` catches a drift —
// it reruns the cases it names through stage1 and compares the whole report —
// and it is a *counted skip* with no C toolchain. Outside those cases, and on
// a machine without clang, this is a rule a reader keeps, not one a test catches.

import { codeFor } from "./codes";
import { compareStrings, jsonQuote, StringBuilder } from "./strings";
import { StringMap } from "./map";

const CH_LF: i32 = 10;
const CH_CR: i32 = 13;
const CH_TAB: i32 = 9;

/** Errors printed in full before the report is cut short with `...and N more`. */
export const MAX_REPORTED_ERRORS: i32 = 20;

/** The `kind` word of a WP15 §8 diagnostic, in the summary line and in `--json`. */
export const PERFORMANCE: string = "performance";

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

  /**
   * The 1-based column of `offset`, counted in bytes.
   *
   * This is the **debugger's** column and not the editor's: a `DILocation`
   * column is read back against the file's bytes, which is what `clang -g`
   * writes and what WP19 §A5 settled for `self/debug.ts`. A diagnostic wants
   * `reportedColumnOf` below instead.
   */
  columnOf(offset: i32): i32 {
    return offset - this.starts[this.lineIndex(offset)] + 1;
  }

  /**
   * The 1-based column of `offset`, counted in UTF-16 code units — the column
   * a diagnostic reports and `--emit-checked` prints.
   *
   * The consumer here is an editor rather than a debugger, so the unit is the
   * one an editor indexes a line by, which is also what stage0 has always
   * answered: its positions come from the `typescript` API and that counts
   * code units. Nothing compared the two until `--json` joined the parity
   * cross product, because the count only differs on a line with a non-ASCII
   * character before the caret and no corpus program had one
   * (`tests/cases/reject_diag_utf8`).
   */
  reportedColumnOf(offset: i32): i32 {
    return this.codeUnits(this.starts[this.lineIndex(offset)], offset) + 1;
  }

  /**
   * How many UTF-16 code units the bytes `[from, to)` spell.
   *
   * Every byte that begins a character is one, except a four-byte sequence:
   * that is a code point above the BMP and costs a surrogate pair, so it is
   * two. Continuation bytes are none of their own.
   */
  codeUnits(from: i32, to: i32): i32 {
    const length = this.text.length;
    const end = to < length ? to : length;
    let units = 0;
    let i = from;
    while (i < end) {
      const byte = this.text.charCodeAt(i);
      if (startsCharacter(byte)) {
        units = units + (isFourByteLead(byte) ? 2 : 1);
      }
      i = i + 1;
    }
    // Past the last byte there is nothing to classify, and an offset does
    // reach there: a span whose end is the end of the file is one past it.
    // stage0 counts the overshoot as characters — `getLineAndCharacterOfPosition`
    // answers `position - lineStart` with no line to bound it — so one byte
    // past the file is one column past its last
    // (`tests/self/diagnostics_fixture.txt`, `error at 325`).
    const beyond = from > length ? from : length;
    return to > beyond ? units + (to - beyond) : units;
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

/** Whether a UTF-8 byte begins a character rather than continuing the one before it. */
const startsCharacter = (byte: i32): boolean => (byte & 0xc0) !== 0x80;

/** Whether a UTF-8 byte opens a four-byte sequence, which is two UTF-16 code units. */
const isFourByteLead = (byte: i32): boolean => (byte & 0xf8) === 0xf0;

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
    this.column = source.reportedColumnOf(start);
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
    const lineStart = this.source.starts[line];
    const lineEnd = lineStart + text.length;
    const markerEnd = this.end < lineEnd ? this.end : lineEnd;
    // In code units, like the column: the caret has to land under the byte the
    // column names, and a terminal counts characters rather than bytes
    // (`formatSourceExcerpt` in `src/diagnostics.ts` pads by code units too).
    let markerLength = this.source.codeUnits(this.start, markerEnd);
    if (markerLength < 1) {
      markerLength = 1;
    }

    const pad = new StringBuilder();
    let i = lineStart;
    while (i < this.start) {
      const byte = text.charCodeAt(i - lineStart);
      if (startsCharacter(byte)) {
        pad.addChar(byte === CH_TAB ? CH_TAB : 32);
        if (isFourByteLead(byte)) {
          pad.addChar(32);
        }
      }
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

  /**
   * The `--json` form: one flat object, no excerpt. `severity` is the field a
   * tool filters on, so a WP15 §8 warning says `performance` there; a syntax
   * error keeps its `syntax error: ` prefix inside `message`, because its
   * severity is still `error`. `code` is the stable identifier from
   * `self/codes.ts` — the field to key on rather than the prose, since the
   * prose may improve and the code may not.
   *
   * The key order matches `diagnosticJson` in `src/diagnostics.ts` exactly:
   * `tests/run.js` compares the two compilers' `--json` byte for byte.
   */
  json(): string {
    const endLine = this.source.lineOf(this.end);
    const endColumn = this.source.reportedColumnOf(this.end);
    const performance = this.kind === PERFORMANCE;
    const severity = performance ? PERFORMANCE : "error";
    const message = this.kind === "error" || performance ? this.text : `${this.kind}: ${this.text}`;
    const code = codeFor(this.kind, this.text);
    return `{"file":${jsonQuote(this.source.path)},"line":${this.line},"column":${this.column},"endLine":${endLine},"endColumn":${endColumn},"severity":"${severity}","code":"${code}","message":${jsonQuote(message)}}`;
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
  /**
   * The WP15 §8 performance warnings, in report order rather than in the order
   * the analysis found them — `reportPerformance` inserts each one where
   * `compareWarnings` puts it. Kept apart from `items` so `hasErrors` stays a
   * statement about errors and nothing here can ever stop a compilation.
   */
  warnings: Diagnostic[];
  /** File path -> the order it was first mentioned in. */
  fileOrder: StringMap;
  /**
   * File path -> the order it was first *warned* about. A table of its own for
   * the reason `reportPerformance` does not touch `fileOrder`: that one is the
   * error report's index, and a warning may not move one error in front of
   * another.
   */
  warningFileOrder: StringMap;

  constructor() {
    this.items = [];
    this.warnings = [];
    this.fileOrder = new StringMap();
    this.warningFileOrder = new StringMap();
  }

  report(source: SourceFile, start: i32, end: i32, text: string): void {
    this.reportKind(source, start, end, "error", text);
  }

  reportKind(source: SourceFile, start: i32, end: i32, kind: string, text: string): void {
    this.add(new Diagnostic(source, start, end, kind, text));
  }

  /**
   * Record a diagnostic somebody else built. The parser builds its own — it
   * refuses before there is a checker to report through — and they belong in
   * the report with every other error, so that the *driver* is what decides
   * whether that report is the human one on stderr or `--json`'s objects on
   * stdout. stage0 has always routed a syntax error this way
   * (`StaticSyntaxError` is a `CompileError` and goes to its sink).
   */
  add(diagnostic: Diagnostic): void {
    if (!this.fileOrder.has(diagnostic.source.path)) {
      this.fileOrder.set(diagnostic.source.path, this.fileOrder.size());
    }
    this.items.push(diagnostic);
  }

  /**
   * Record a performance warning (WP15 §8), at its place in the report order
   * rather than at the end of the list.
   *
   * Inserting is what makes the order an invariant of `warnings` instead of a
   * promise one accessor keeps, and the list is read directly — `--json`
   * prints it warning by warning and `formatWarnings` prints the first `max`
   * of it. It has to be an order rather than the arrival sequence because the
   * analysis does not hand them over sorted: a generic instantiation's body is
   * checked when the instantiation is finished rather than where the generic
   * is written, and a pass-1 warning is found before pass 2 has looked at the
   * file at all. It is a stable insertion sort: the stream arrives in a few
   * nearly sorted runs, one per pass, so the scan back is short, and the list
   * stays under a hundred over the whole of `self/` — no exact count is
   * written here, because it moves with every rule the class gains. `sorted()`
   * needs a merge sort instead because one bad declaration can cascade into
   * thousands of errors, and nothing cascades into a warning.
   */
  reportPerformance(source: SourceFile, start: i32, end: i32, text: string): void {
    if (!this.warningFileOrder.has(source.path)) {
      this.warningFileOrder.set(source.path, this.warningFileOrder.size());
    }
    const warning = new Diagnostic(source, start, end, PERFORMANCE, text);
    this.warnings.push(warning);
    let i = this.warnings.length - 1;
    while (i > 0 && this.compareWarnings(this.warnings[i - 1], warning) > 0) {
      this.warnings[i] = this.warnings[i - 1];
      i = i - 1;
    }
    this.warnings[i] = warning;
  }

  /**
   * Negative, zero or positive as warning `a` should be reported before `b`:
   * by file — in the order files were first warned about, so a warning report
   * follows the import graph the way `compare` makes the error report follow
   * it — then by the start of the span, then by diagnostic code.
   *
   * The code is what breaks a tie at one position, so that two analyses
   * reporting on the same node come out in the same order whichever of them
   * ran first. It is the last key and never a fallback to the prose: two
   * warnings of one code at one position keep the order the analysis produced
   * them in, which is what makes a multi-warning golden reproducible.
   */
  compareWarnings(a: Diagnostic, b: Diagnostic): i32 {
    const fileA = this.warningFileOrder.get(a.source.path, 0);
    const fileB = this.warningFileOrder.get(b.source.path, 0);
    if (fileA !== fileB) {
      return fileA - fileB;
    }
    if (a.line !== b.line) {
      return a.line - b.line;
    }
    if (a.column !== b.column) {
      return a.column - b.column;
    }
    return compareStrings(codeFor(a.kind, a.text), codeFor(b.kind, b.text));
  }

  hasErrors(): boolean {
    return this.items.length > 0;
  }

  warningCount(): i32 {
    return this.warnings.length;
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

  /**
   * The performance report (WP15 §8), shaped exactly like `format` so there
   * is one layout to read on either side: each warning's summary and excerpt,
   * at most `max` of them, then `...and N more performance warnings` and a
   * count line. A lone warning prints exactly its message, and no warnings
   * print nothing at all.
   */
  formatWarnings(max: i32): string {
    if (this.warnings.length === 0) {
      return "";
    }
    if (this.warnings.length === 1) {
      return this.warnings[0].message();
    }
    const lines: string[] = [];
    let i = 0;
    while (i < this.warnings.length && i < max) {
      lines.push(this.warnings[i].message());
      i = i + 1;
    }
    const hidden = this.warnings.length - max;
    if (hidden > 0) {
      lines.push(`...and ${hidden} more performance warning${hidden === 1 ? "" : "s"}`);
    }
    lines.push(`${this.warnings.length} performance warnings`);
    return lines.join("\n");
  }
}
