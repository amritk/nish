// What every checker pass is given (`src/checker/context.ts`), for stage1
// (docs/wp14-selfhost.md, milestone S3).
//
// One object rather than the four arguments the passes would otherwise
// thread, and it is where D1's error-value threading lives: `error` reports
// and returns, it never throws, so a caller decides whether to carry on with
// a sentinel or stop. `src/` throws a `CompileError` from 292 sites and
// catches it in six; every one of those catches becomes a status test here.

import { DiagnosticSink, SourceFile } from "./diagnostics";
import { StringMap, StringSet } from "./map";
import { Node } from "./nodes";
import {
  CheckedProgram,
  DeferredConstraint,
  FunctionBindings,
  FunctionSig,
  Instantiation,
  StructInfo,
  StructInstantiation,
  TemplateInfo,
} from "./program";
import { Scope } from "./symbols";
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
  /**
   * `--strict-exports`, which is the default. Off, a non-exported function
   * keeps external linkage, and the WP15 §8 walk says so at a call inside a
   * loop; nothing else in the checker reads it, because linkage is the
   * emitter's business.
   */
  strictExports: boolean;
  /** Function source name -> index into `program.functions`, for clash checks. */
  sigs: StringMap;
  /** The program has an entry point, so `process.argv` may be read. */
  entryHasMain: boolean;
  /** The function whose body is being checked, for `return` and `this`. */
  current: FunctionSig | null;
  /**
   * WP18: the type parameters in scope, bound to the types this instantiation
   * gives them. Non-empty only while an instantiation's signature is resolved
   * or its body is checked, and read by `resolveReference` — which is the whole
   * of how `T` becomes `i32`.
   */
  typeBindings: StringMap;
  /**
   * WP29: the compile-time function parameters in scope, bound to the
   * functions this instantiation was given. Empty outside an instantiation's
   * body, and read by `checkCall`, which is the whole of how `f(x)` becomes a
   * direct call to `square`.
   */
  functionBindings: FunctionBindings;
  /**
   * WP29: while the body of an arrow argument is checked, the scopes and the
   * function bindings of every function it is written inside, innermost last.
   * Nothing in them is visible to the arrow, which becomes a function of its
   * own; they are kept only so that reading one is refused as a capture,
   * naming what was captured, rather than as an unknown name.
   */
  arrowOuterScopes: Scope[];
  arrowOuterFunctions: FunctionBindings[];
  /** The instantiation whose body is being checked, so a request from it records its parent. */
  currentInstance: Instantiation | null;
  /**
   * The struct instantiation whose members are being collected, or whose method
   * body is being checked (WP18 G5). It is the struct half of `currentInstance`
   * and the chain the struct termination rule walks — a field's type is
   * resolved during collection rather than while a body runs, so this is what
   * makes `class Nest<T> { inner: Nest<T[]> | null }` refusable by name.
   */
  currentStructInstance: StructInstantiation | null;
  /**
   * WP18 G6: pass 1 is still running, so a struct instantiation's constraints
   * are written down in `deferredConstraints` rather than checked. Cleared once
   * every import is bound, when every class a type argument can name has its
   * `implements` clause.
   */
  constraintsDeferred: boolean;
  deferredConstraints: DeferredConstraint[];
  /**
   * Node ids a once-per-template diagnostic has been reported against (WP18
   * G6). A template's body is checked once per instantiation, and a mistake in
   * it is the template's, so the second instantiation refuses it silently.
   */
  reportedOnce: StringSet;
  /** Requested but not yet checked, FIFO so the enumeration order is the discovery order. */
  pending: Instantiation[];
  /**
   * Instantiated structs whose `implements` and definite-assignment checks are
   * still owed. They wait for the same reason a declared struct's do: both need
   * every struct in the module to have its members, and an instantiation can be
   * requested by an annotation resolved before the interface it implements has
   * been collected.
   */
  pendingFinish: StructInfo[];
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
    uncheckedIndexing: boolean,
    strictExports: boolean
  ) {
    this.table = table;
    this.program = program;
    this.sink = sink;
    this.source = program.source;
    this.numberMode = numberMode;
    this.wrapping = wrapping;
    this.uncheckedIndexing = uncheckedIndexing;
    this.strictExports = strictExports;
    this.sigs = new StringMap();
    this.entryHasMain = false;
    this.current = null;
    this.loopKinds = [];
    this.loopBreaks = [];
    this.statementExpression = null;
    this.errored = false;
    this.typeBindings = new StringMap();
    this.functionBindings = new FunctionBindings();
    this.arrowOuterScopes = [];
    this.arrowOuterFunctions = [];
    this.currentInstance = null;
    this.currentStructInstance = null;
    this.constraintsDeferred = true;
    this.deferredConstraints = [];
    this.reportedOnce = new StringSet();
    this.pending = [];
    this.pendingFinish = [];
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
    this.errorAtSpan(node.start, node.end, message);
  }

  /**
   * Report against a span the tree has no node for, and poison the statement.
   *
   * The guard and the flag live here rather than at each `errorAt*` below, so
   * that a fifth of them cannot be written without the invariant `error`'s
   * comment describes. What each caller supplies is the span and nothing else.
   */
  errorAtSpan(start: i32, end: i32, message: string): void {
    if (this.errored) {
      return;
    }
    this.sink.report(this.source, start, end, message);
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
    this.errorAtSpan(start - 1, end, message);
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
    this.errorAtSpan(member.end - member.text.length, member.end, message);
  }

  /**
   * Report against the *key* of an object-literal property rather than the
   * whole `key: value`, which is where stage0 puts it (`prop.name` in
   * `src/validator.ts`). The key is the property's own first `text.length`
   * bytes, because `parseObjectLiteral` accepts only a plain identifier there.
   *
   * It and `errorAtProperty` are mirror images — the head of a node's `text`
   * and the tail of it — and both exist because `nodes.ts` has no child node
   * for a name. A third of them is the signal to carry a `textStart` on `Node`
   * instead; two are cheaper than four bytes on every node in the program.
   */
  errorAtKey(property: Node, message: string): void {
    this.errorAtSpan(property.start, property.start + property.text.length, message);
  }

  /**
   * Report a WP15 §8 performance warning against a node's own span. It never
   * poisons anything and never reaches the exit code: the compilation goes on
   * exactly as it would have without it.
   */
  performance(node: Node, message: string): void {
    this.sink.reportPerformance(this.source, node.start, node.end, message);
  }

  /**
   * Report a mistake in a generic template's body the first time one of its
   * instantiations reaches it, and refuse it without a word every time after
   * (WP18 G6). The statement and the body are poisoned either way, exactly as
   * `error` poisons them, so the second instantiation stops where the first
   * one did rather than carrying on over a node whose type it never recorded.
   */
  errorOnce(node: Node, start: i32, message: string): void {
    const key = `${node.id}`;
    if (this.reportedOnce.has(key)) {
      this.errored = true;
    } else {
      this.reportedOnce.add(key);
      this.errorAtSpan(start, node.end, message);
    }
    const current = this.current;
    if (current !== null) {
      current.poisoned = true;
    }
  }

  /**
   * WP29: whether `name` would be read from a function an arrow argument is
   * written inside — a local, a parameter, `this` or a function parameter of
   * it — rather than from the arrow's own scope or the module. The caller
   * has already looked in the arrow's scope, which shadows these.
   */
  capturesOuter(name: string): boolean {
    for (const scope of this.arrowOuterScopes) {
      if (scope.lookup(name) !== null) {
        return true;
      }
    }
    for (const bindings of this.arrowOuterFunctions) {
      if (bindings.get(name) !== null) {
        return true;
      }
    }
    return false;
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

  /** The generic template called `name` in this module, or `null` (WP18). */
  template(name: string): TemplateInfo | null {
    return this.program.template(name);
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
