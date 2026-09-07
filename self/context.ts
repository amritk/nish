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

export class CheckContext {
  /** Shared by every module of one compilation, so a type id means one thing. */
  table: TypeTable;
  program: CheckedProgram;
  sink: DiagnosticSink;
  source: SourceFile;
  numberMode: i32;
  /** Function source name -> index into `program.functions`, for clash checks. */
  sigs: StringMap;
  /** The program has an entry point, so `process.argv` may be read. */
  entryHasMain: boolean;

  constructor(table: TypeTable, program: CheckedProgram, sink: DiagnosticSink, numberMode: i32) {
    this.table = table;
    this.program = program;
    this.sink = sink;
    this.source = program.source;
    this.numberMode = numberMode;
    this.sigs = new StringMap();
    this.entryHasMain = false;
  }

  /** Report against a node's own span. Nothing is thrown; the caller decides. */
  error(node: Node, message: string): void {
    this.sink.report(this.source, node.start, node.end, message);
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
}
