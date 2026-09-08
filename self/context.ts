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
   * instead of refusing an overflow (`self/constants.ts`). The only compiler
   * option pass 2 reads apart from the number mode, and for the same reason:
   * the fold has to agree with the instruction it replaces.
   */
  wrapping: boolean;
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

  constructor(
    table: TypeTable,
    program: CheckedProgram,
    sink: DiagnosticSink,
    numberMode: i32,
    wrapping: boolean
  ) {
    this.table = table;
    this.program = program;
    this.sink = sink;
    this.source = program.source;
    this.numberMode = numberMode;
    this.wrapping = wrapping;
    this.sigs = new StringMap();
    this.entryHasMain = false;
    this.current = null;
    this.loopKinds = [];
    this.loopBreaks = [];
    this.statementExpression = null;
  }

  /** Report against a node's own span. Nothing is thrown; the caller decides. */
  error(node: Node, message: string): void {
    this.sink.report(this.source, node.start, node.end, message);
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
