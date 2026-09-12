// What every checker pass is given (`src/checker/context.ts`), for stage1
// (docs/wp14-selfhost.md, milestone S3).
//
// One object rather than the four arguments the passes would otherwise
// thread, and it is where D1's error-value threading lives: `error` reports
// and returns, it never throws, so a caller decides whether to carry on with
// a sentinel or stop. `src/` throws a `CompileError` from 292 sites and
// catches it in six; every one of those catches becomes a status test here.

import { DiagnosticSink, SourceFile } from "./diagnostics";
import { StringMap } from "./map";
import { Node } from "./nodes";
import { CheckedProgram, FunctionSig } from "./program";
import { T_ERROR, T_F64, T_I32, TypeTable } from "./types";

/** `number` is `i32` by default and `f64` under `--number-mode f64`. */
export const NUMBER_MODE_I32: i32 = 0;
export const NUMBER_MODE_F64: i32 = 1;

export const LOOP_ITERATION: i32 = 0;
export const LOOP_SWITCH: i32 = 1;

export class CheckContext {
  /** Shared by every module of one compilation, so a type id means one thing. */
  table: TypeTable;
  program: CheckedProgram;
  sink: DiagnosticSink;
  source: SourceFile;
  numberMode: i32;
  /**
   * `--wrapping` was given, so constant folding wraps at the declared width
   * instead of refusing an overflow (`self/constants.ts`). The fold has to
   * agree with the instruction it replaces, which is why an option reaches
   * pass 2 at all.
   */
  wrapping: boolean;
  /**
   * `--unchecked-indexing` was given, so no bounds check is emitted anywhere
   * and the WP15 §2 warning about a check that survived has nothing to report.
   * Read by that rule and by nothing else in the checker.
   */
  uncheckedIndexing: boolean;
  /** Function source name -> index into `program.functions`, for clash checks. */
  sigs: StringMap;
  /** The program has an entry point, so `process.argv` may be read. */
  entryHasMain: boolean;
  /** The function whose body is being checked, for `return` and `this`. */
  current: FunctionSig | null;
  /**
   * The loops and `switch`es enclosing the statement being checked, innermost
   * last. `break` marks the innermost; `continue` needs a real loop, because a
   * `switch` on the stack is a `break` target only, as it is in JavaScript.
   */
  loopKinds: i32[];
  loopBreaks: boolean[];
  /**
   * The expression of the statement being checked, when it is an expression
   * statement. `console.log` and the other `void` builtins may only appear
   * there; stage0 asks the node's parent, and this is the parent pointer the
   * tree does not have, recorded by the one caller that knows.
   */
  statementExpression: Node | null;
  /**
   * Set by `error` and cleared at the start of each statement: the statement
   * has already been refused, so nothing further *in it* is checked or
   * reported.
   *
   * This is stage0's `throw` in a language that has none. Both compilers
   * recover per statement — `checkStatements` wraps each one in a `try` there
   * — but stage0's throw abandons the rest of the statement it came from and
   * stage1 carried on through it, reporting every consequence of the first
   * mistake where stage0 reported the mistake. Under `--number-mode f64` over
   * a program written for i32 mode that is the difference between one
   * diagnostic and several, and it was about 950 rows of `--parity`
   * (WP19 §A3).
   */
  errored: boolean;

  constructor(
    table: TypeTable,
    program: CheckedProgram,
    sink: DiagnosticSink,
    numberMode: i32,
    wrapping: boolean,
    uncheckedIndexing: boolean
  ) {
    this.table = table;
    this.program = program;
    this.sink = sink;
    this.source = program.source;
    this.numberMode = numberMode;
    this.wrapping = wrapping;
    this.uncheckedIndexing = uncheckedIndexing;
    this.sigs = new StringMap();
    this.entryHasMain = false;
    this.current = null;
    this.loopKinds = [];
    this.loopBreaks = [];
    this.statementExpression = null;
    this.errored = false;
  }

  /**
   * Report against a node's own span. Nothing is thrown; the caller decides —
   * but the *first* diagnostic inside a statement is the only one it gets,
   * because that is what stage0's `throw` leaves behind. Dropping the rest
   * here rather than at each call site is what makes it complete: a check that
   * reports without going through `checkStatement` or `checkExpression` — the
   * `switch` clause rules, say — would otherwise keep talking about a
   * statement stage0 had already left.
   */
  error(node: Node, message: string): void {
    if (this.errored) {
      return;
    }
    this.sink.report(this.source, node.start, node.end, message);
    this.errored = true;
  }

  /**
   * Report against the module specifier of an `import`, which stage0 has as a
   * node (`imp.node.moduleSpecifier`) and this tree does not: `nodes.ts` keeps
   * the specifier as *text* on the import, so the span is recovered from the
   * source by walking back from the statement's end to the string's quotes.
   * The alternative is a child node for it, which would change the layout
   * `nodes.ts` documents, the `--emit-ast` golden and the parser oracle's
   * translation, all to move a caret.
   */
  errorAtSpecifier(node: Node, message: string): void {
    if (this.errored) {
      return;
    }
    const text = this.source.text;
    let end = node.end;
    while (end > node.start && text.charCodeAt(end - 1) !== 34 && text.charCodeAt(end - 1) !== 39) {
      end = end - 1;
    }
    let start = end - 1;
    const quote = start >= node.start ? text.charCodeAt(start) : 0;
    while (start > node.start && text.charCodeAt(start - 1) !== quote) {
      start = start - 1;
    }
    if (start <= node.start || end <= start) {
      // No string literal to point at (the parser already said so); the
      // statement itself is the best span left.
      this.error(node, message);
      return;
    }
    this.sink.report(this.source, start - 1, end, message);
    this.errored = true;
  }

  /**
   * Report against the *property name* of a member access rather than the whole
   * access. stage0 hands `expr.name` to the error and stage1's tree has no node
   * for the name — it is `text` on the member itself — so the span is the tail
   * of the access, which is exactly what `expr.name` covers there
   * (`propertyCheckers.nullable` in `src/checker/nullable.ts`). Without this the
   * caret sits under `g` where stage0 puts it under `paramNames`.
   */
  errorAtProperty(member: Node, message: string): void {
    if (this.errored) {
      return;
    }
    this.sink.report(this.source, member.end - member.text.length, member.end, message);
    this.errored = true;
  }

  /**
   * Report a WP15 §8 performance warning against a node's own span. It never
   * poisons anything and never reaches the exit code: the compilation goes on
   * exactly as it would have without it.
   */
  performance(node: Node, message: string): void {
    this.sink.reportPerformance(this.source, node.start, node.end, message);
  }

  /** Report and answer the sentinel type, for the many callers that want both. */
  errorType(node: Node, message: string): i32 {
    this.error(node, message);
    return T_ERROR;
  }

  /** The source text a node covers, for a message that quotes what was written. */
  textOf(node: Node): string {
    return this.source.text.substring(node.start, node.end);
  }

  /** `number` as this compilation lowers it. */
  numberType(): i32 {
    return this.numberMode === NUMBER_MODE_I32 ? T_I32 : T_F64;
  }

  /** The function called `name` in this module, or `null`. */
  signature(name: string): FunctionSig | null {
    const at = this.sigs.get(name, -1);
    return at < 0 ? null : this.program.functions[at];
  }

  /** Register a function under its source name and add it to the module. */
  addFunction(sig: FunctionSig): void {
    this.sigs.set(sig.sourceName, this.program.functions.length);
    this.program.functions.push(sig);
  }

  /** Enter a loop (`LOOP_ITERATION`) or a `switch` (`LOOP_SWITCH`). */
  pushLoop(kind: i32): void {
    this.loopKinds.push(kind);
    this.loopBreaks.push(false);
  }

  /** Leave it, answering whether a `break` targeted it. */
  popLoop(): boolean {
    const broke = this.loopBreaks[this.loopBreaks.length - 1];
    this.loopKinds.pop();
    this.loopBreaks.pop();
    return broke;
  }
}
