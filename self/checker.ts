// The checker's first pass for stage1 (`src/checker/index.ts`,
// docs/wp14-selfhost.md milestone S3): signatures, so that functions can call
// each other in any order and an annotation anywhere can name any class.
//
// The order inside pass 1 is the same as stage0's and it matters: imports and
// class names first, so any annotation can resolve; then members and function
// signatures in source order; then the checks that need every layout
// (`implements`). Recovery is per declaration — a rejected class, import or
// signature is reported and the next declaration is collected — which is
// WP10's multi-error guarantee, and here it is D1's status returns rather
// than the six `try`/`catch` sites `src/` uses.

import { resolveType } from "./annotations";
import { checkDefiniteAssignment } from "./assignment";
import { foldConstant } from "./constants";
import { CheckContext } from "./context";
import { DiagnosticSink, SourceFile } from "./diagnostics";
import { collectFunctionSignature, collectImports, isExported, markEntryMain } from "./declarations";
import {
  N_BINARY,
  N_BLOCK,
  N_CLASS,
  N_CONSTRUCTOR,
  N_DO,
  N_EMPTY,
  N_FOR,
  N_FOR_OF,
  N_FUNCTION,
  N_IDENT,
  N_IMPORT,
  N_INDEX,
  N_INTERFACE,
  N_MEMBER,
  N_MODULE_CONST,
  N_NEW,
  N_NUMBER,
  N_PAREN,
  N_TEMPLATE,
  N_TEMPLATE_TEXT,
  N_VAR_DECL,
  N_WHILE,
  Node,
} from "./nodes";
import { StringSet } from "./map";
import {
  CheckedProgram,
  ConstInfo,
  FunctionSig,
  STRUCT_CLASS,
  STRUCT_INTERFACE,
  StructInfo,
  StructRegistry,
} from "./program";
import { checkResultLocalsHandled } from "./result";
import { checkStatements } from "./statements";
import { Local, STORAGE_PARAM, Scope } from "./symbols";
import {
  checkImplements,
  collectStructMembers,
  declareStruct,
  referencedStructNames,
  signatureStructNames,
} from "./structs";
import { T_BOOL, T_ERROR, T_F64, T_I32, T_I64, T_STRING, T_VOID, TypeTable } from "./types";

export class Checker {
  ctx: CheckContext;
  program: CheckedProgram;

  constructor(
    table: TypeTable,
    source: SourceFile,
    file: Node,
    isEntry: boolean,
    nodeCount: i32,
    sink: DiagnosticSink,
    numberMode: i32,
    wrapping: boolean
  ) {
    this.program = new CheckedProgram(source, file, isEntry, nodeCount);
    this.ctx = new CheckContext(table, this.program, sink, numberMode, wrapping);
  }

  /**
   * Pass 1. Names first — imports and structs — then members and signatures,
   * then the layout checks. A struct that fails at any step is left in the
   * registry so annotations still resolve; it is the diagnostics that stop
   * the compilation, not a missing entry.
   */
  collectSignatures(): void {
    const declared: StructInfo[] = [];
    for (const stmt of this.program.file.children) {
      if (stmt.kind === N_IMPORT) {
        collectImports(this.ctx, stmt);
      } else if (stmt.kind === N_CLASS) {
        const info = declareStruct(this.ctx, stmt, STRUCT_CLASS);
        if (info !== null) {
          declared.push(info);
        }
      } else if (stmt.kind === N_INTERFACE) {
        const info = declareStruct(this.ctx, stmt, STRUCT_INTERFACE);
        if (info !== null) {
          declared.push(info);
        }
      }
    }

    for (const stmt of this.program.file.children) {
      if (stmt.kind === N_CLASS || stmt.kind === N_INTERFACE) {
        const info = this.program.struct(stmt.children[0].text);
        if (info !== null && info.decl === stmt) {
          collectStructMembers(this.ctx, info);
        }
      } else if (stmt.kind === N_MODULE_CONST) {
        this.collectConstants(stmt);
      } else if (stmt.kind === N_FUNCTION) {
        this.collectFunction(stmt);
      }
    }

    // The checks that need every layout: `implements` compares field lists,
    // and definite assignment needs the inherited prefix to know what
    // `super(...)` covers.
    for (const info of declared) {
      if (info.kind === STRUCT_CLASS) {
        checkImplements(this.ctx, info);
        checkDefiniteAssignment(this.ctx, info);
      }
    }
  }

  /** One `function` declaration: its signature, its name, and `main`. */
  collectFunction(stmt: Node): void {
    const sig = collectFunctionSignature(this.ctx, stmt);
    const name = sig.sourceName;
    if (this.ctx.sigs.has(name) || this.program.structs.has(name) || this.program.constants.has(name)) {
      this.ctx.error(stmt.children[0], `\`${name}\` is already declared in this module`);
      return;
    }
    this.ctx.addFunction(sig);
    if (sig.exported) {
      this.program.exports.set(name, this.program.functions.length - 1);
    }
    if (name === "main" && sig.exported) {
      // Reported, not returned: stage0 marks the entry anyway, so a module that
      // wrongly declares `main` is still checked as one that has it and the
      // reader gets every follow-on error at once (`tests/link/main_in_import`).
      if (!this.program.isEntry) {
        this.ctx.error(stmt.children[0], "Only the entry module may declare `export function main`");
      }
      markEntryMain(this.ctx, sig);
    }
  }

  /**
   * `const NAME: T = <constant expression>` at the top level. The initialiser
   * is *not* folded here: it may name a constant imported from a module that
   * has not been checked yet, so folding waits until every module has its
   * signatures.
   */
  collectConstants(stmt: Node): void {
    const exported = isExported(stmt);
    for (const decl of stmt.children[0].children) {
      const name = decl.children[0].text;
      if (decl.children[1].kind === N_EMPTY) {
        this.ctx.error(decl.children[0], `Module constant \`${name}\` needs a type annotation`);
        continue;
      }
      if (decl.children[2].kind === N_EMPTY) {
        this.ctx.error(decl.children[0], `Module constant \`${name}\` needs an initialiser`);
        continue;
      }
      const type = resolveType(decl.children[1], this.ctx);
      if (
        type !== T_ERROR &&
        type !== T_I32 &&
        type !== T_I64 &&
        type !== T_F64 &&
        type !== T_BOOL &&
        type !== T_STRING
      ) {
        const spelled = this.ctx.table.typeName(type);
        this.ctx.error(
          decl.children[1],
          `Module constant \`${name}\` must be a number, boolean, or string, not ${spelled}; there is no top-level code to build anything else`
        );
        continue;
      }
      if (this.program.constants.has(name) || this.ctx.sigs.has(name) || this.program.structs.has(name)) {
        this.ctx.error(decl.children[0], `\`${name}\` is already declared in this module`);
        continue;
      }
      const info = new ConstInfo(name, type, decl, this.program.source);
      info.exported = exported;
      info.scope = this.program;
      this.program.addConstant(info);
    }
  }

  /**
   * Pass 2: every body, now that every callee in the program is known.
   * Recovery is per statement, so one bad expression costs one statement's
   * worth of checking and the rest of the function is still checked — the
   * granularity stage0's `try` per statement gives it, and `errored` in
   * `context.ts` is how a language without exceptions reaches it.
   */
  checkBodies(): void {
    for (const sig of this.program.functions) {
      if (sig.definedIn(this.program.source)) {
        this.checkFunctionBody(sig);
      }
    }
  }

  checkFunctionBody(sig: FunctionSig): void {
    this.ctx.current = sig;
    this.ctx.errored = false;
    this.ctx.loopKinds = [];
    this.ctx.loopBreaks = [];
    const scope = new Scope(null);
    let i = 0;
    while (i < sig.paramNames.length) {
      // A parameter is an SSA value, so it is immutable, and `this` is one
      // too — which is what makes `this = x` a parameter assignment error.
      const local = new Local(sig.paramNames[i], sig.paramTypes[i], false, STORAGE_PARAM);
      if (!scope.declare(local)) {
        this.ctx.error(sig.decl, `Duplicate parameter \`${sig.paramNames[i]}\``);
      }
      i = i + 1;
    }
    const body = sig.body();
    if (body === null) {
      return;
    }
    // The body shares the parameter scope rather than opening a child, so
    // `function f(a) { let a; }` is a duplicate declaration as in TypeScript.
    const before = this.ctx.sink.count();
    const terminates = checkStatements(this.ctx, body.children, scope);
    const failed = this.ctx.sink.count() > before;
    // Outside a statement list the flag is always clear, so a diagnostic from
    // constant folding or from another module is never dropped by this body.
    this.ctx.errored = false;
    if (failed) {
      sig.poisoned = true;
    } else {
      // WP16: a `Result` local nobody reads is an unhandled failure. Reported
      // after the body so the diagnostic names a variable whose type is known.
      checkResultLocalsHandled(this.ctx, sig, body);
      // WP15 §8: the performance warnings, over the same body and the same
      // side tables. Only for a body that checked cleanly — advice about code
      // that does not compile is noise, and a poisoned body has incomplete
      // side tables anyway.
      checkPerformance(this.ctx, body);
    }
    // A body with a rejected statement may have lost its `return`; reporting
    // a missing one on top of that is a cascade, not a second bug.
    if (sig.returnType !== T_VOID && sig.returnType !== T_ERROR && !terminates && !failed) {
      const spelled = this.ctx.table.typeName(sig.returnType);
      this.ctx.error(
        nameOf(sig),
        `Function \`${sig.sourceName}\` must return a value of type ${spelled} on every path`
      );
    }
    this.ctx.current = null;
  }

  /**
   * Pass 1b: bind each import to what the exporting module actually exports.
   * `targets[i]` is the checked program `imports[i]`'s specifier resolved to;
   * the caller builds that list because module loading is the driver's job,
   * not the checker's.
   */
  /**
   * Fold every constant this module declares. Separate from collecting them
   * because an initialiser may name a constant imported from a module that
   * has not been checked yet, so nothing may fold until every module has its
   * signatures.
   */
  foldConstants(): void {
    for (const info of this.program.constantList) {
      if (info.origin === this.program.source) {
        foldConstant(this.ctx, info);
      }
    }
  }

  /**
   * The layouts an imported class or function drags in with it. `import
   * { Box }` where `Box.all(): Item[]` gives this module `Item` values it can
   * call methods on and read fields of, and both the checker and the emitter
   * need the layout — a `%struct.Item = type opaque` would make a field access
   * impossible to emit. Run after *every* module is bound, so that a struct
   * reached through a chain of modules does not depend on the binding order.
   */
  closeReachableStructs(declared: StructRegistry): void {
    const pending: StructInfo[] = [];
    const seen = new StringSet();
    for (const imp of this.program.imports) {
      const struct = imp.struct;
      if (struct !== null) {
        // The imported class itself is already registered under its name.
        seen.add(struct.name);
        pending.push(struct);
      }
      // An imported *function* drags its types in the same way: `parse(): Node`
      // hands this module `Node` values with no mention of `Node` anywhere.
      const sig = imp.sig;
      if (sig !== null) {
        const names = new StringSet();
        signatureStructNames(this.ctx.table, sig, names);
        this.reachAll(declared, seen, pending, names);
      }
    }
    while (pending.length > 0) {
      const info = pending.pop();
      const names = new StringSet();
      // A self-referential field (`parent: Node | null`) puts the struct's own
      // name in here. `src/` deletes it; `reach` already ignores it, because
      // nothing reaches `pending` without its name being marked seen first.
      referencedStructNames(this.ctx.table, info, names);
      this.reachAll(declared, seen, pending, names);
    }
  }

  reachAll(declared: StructRegistry, seen: StringSet, pending: StructInfo[], names: StringSet): void {
    let i = 0;
    while (i < names.size()) {
      this.reach(declared, seen, pending, names.at(i));
      i = i + 1;
    }
  }

  /** Register `name`'s layout here, if the program declares it and this module has not seen it. */
  reach(declared: StructRegistry, seen: StringSet, pending: StructInfo[], name: string): void {
    if (!seen.add(name)) {
      return;
    }
    const info = declared.get(name);
    if (info === null) {
      return;
    }
    if (!this.program.structs.has(name)) {
      this.program.reachableStructs.push(this.program.structList.length);
      this.program.addStruct(name, info);
    }
    pending.push(info);
  }

  bindImports(targets: CheckedProgram[]): void {
    let i = 0;
    while (i < this.program.imports.length) {
      this.bindImport(i, targets[i]);
      i = i + 1;
    }
  }

  bindImport(index: i32, target: CheckedProgram): void {
    const imp = this.program.imports[index];
    const constant = target.constant(imp.importedName);
    if (constant !== null && constant.exported) {
      this.bindConstantImport(index, constant);
      return;
    }
    const struct = target.struct(imp.importedName);
    if (struct !== null && struct.origin === target.source) {
      this.bindStructImport(index, struct);
      return;
    }
    const sig = target.exported(imp.importedName);
    if (sig === null) {
      let exists = false;
      for (const candidate of target.functions) {
        if (candidate.sourceName === imp.importedName) {
          exists = true;
        }
      }
      this.ctx.error(
        imp.node,
        exists
          ? `\`${imp.importedName}\` is declared in \`${imp.specifier}\` but not exported (add \`export\`)`
          : `Module \`${imp.specifier}\` has no exported function \`${imp.importedName}\``
      );
      return;
    }
    if (this.program.importsUsedAsTypes.has(imp.localName)) {
      this.ctx.error(
        imp.node,
        `\`${imp.localName}\` is a function imported from \`${imp.specifier}\`, not a type`
      );
    }
    // Two imports of one local name are two symbols under one spelling. Naming
    // the module the name came from first is what makes the second `import`
    // readable (`tests/link/duplicate_import`); a name the module declares
    // itself has no such origin to name.
    const clashAt = this.ctx.sigs.get(imp.localName, -1);
    if (clashAt >= 0) {
      const clash = this.program.functions[clashAt];
      let origin = "";
      for (const other of this.program.imports) {
        const bound = other.sig;
        if (bound !== null && bound === clash && origin.length === 0) {
          origin = other.specifier;
        }
      }
      this.ctx.error(
        imp.node,
        origin.length > 0
          ? `\`${imp.localName}\` is already imported from \`${origin}\``
          : `\`${imp.localName}\` is already declared in this module`
      );
    }
    imp.sig = sig;
    this.ctx.sigs.set(imp.localName, this.program.functions.length);
    this.program.functions.push(sig);
  }

  /**
   * An imported class or interface joins this module's registry under its own
   * name: the LLVM type `%struct.<name>` and the method symbols are fixed by
   * the exporter, so `import { P as Q }` cannot be honoured.
   */
  bindStructImport(index: i32, struct: StructInfo): void {
    const imp = this.program.imports[index];
    if (!struct.exported) {
      this.ctx.error(
        imp.node,
        `\`${imp.importedName}\` is declared in \`${imp.specifier}\` but not exported (add \`export\`)`
      );
    }
    if (imp.localName !== imp.importedName) {
      const what = struct.kind === STRUCT_CLASS ? "Classes" : "Interfaces";
      this.ctx.error(
        imp.node,
        `${what} cannot be renamed on import (\`${imp.importedName} as ${imp.localName}\`): the type name is part of the ABI`
      );
    }
    if (this.program.structs.has(imp.localName) || this.ctx.sigs.has(imp.localName)) {
      this.ctx.error(imp.node, `\`${imp.localName}\` is already declared in this module`);
      return;
    }
    imp.struct = struct;
    this.program.addStruct(imp.localName, struct);
    this.program.typeNames.add(imp.localName);
  }

  /**
   * An imported `export const` joins this module's constant table under its
   * local name. Nothing is linked: the value is folded into every use site
   * here exactly as it is in the exporting module, so the import costs no
   * symbol and no relocation.
   */
  bindConstantImport(index: i32, constant: ConstInfo): void {
    const imp = this.program.imports[index];
    const localName = imp.localName;
    if (
      this.program.constants.has(localName) ||
      this.ctx.sigs.has(localName) ||
      this.program.structs.has(localName)
    ) {
      this.ctx.error(imp.node, `\`${localName}\` is already declared in this module`);
      return;
    }
    if (this.program.importsUsedAsTypes.has(localName)) {
      this.ctx.error(
        imp.node,
        `\`${localName}\` is a constant imported from \`${imp.specifier}\`, not a type`
      );
    }
    imp.constant = constant;
    this.program.constants.set(localName, this.program.constantList.length);
    this.program.constantList.push(constant);
  }
}

/** The node a "must return on every path" diagnostic points at: the name, or the declaration. */
function nameOf(sig: FunctionSig): Node {
  return sig.decl.kind === N_CONSTRUCTOR ? sig.decl : sig.decl.children[0];
}

// ---- WP15 §8: the `performance` diagnostic class --------------------------------
//
// The stage1 half of `src/checker/performance.ts`; every rule, every guard and
// every word of both messages is that file's, because `tests/run.js` and the
// stage1 oracles compare the two compilers byte for byte.
//
// Two warnings ship, the two that need no analysis the checker does not have:
//
//   1. **Quadratic string building** — `s = <something built from s>` where
//      `s` is a string local declared outside the loop the assignment sits in.
//      Every pass copies the whole accumulator into a fresh arena string, so
//      the loop is quadratic in time *and* in arena bytes: 88 KB of output
//      measured 180 MB of peak RSS (WP15 §1). The rewrite is `StringBuilder`
//      or a `string[]` and one `join`, which is what this compiler's own
//      subset rules already require of `self/`.
//   2. **Allocation in a loop** — a `new Array<T>(n)` with a non-constant `n`,
//      declared inside a loop, whose value is only ever read through in that
//      iteration. A dynamically sized array can never be an entry-block
//      alloca (`docs/wp6-memory.md` §1), so it comes out of the arena once per
//      pass and stays there until the function returns.
//
// Everything WP6 already handles is deliberately silent: a `new C(...)`, an
// object literal, an array literal and a `new Array<T>(<literal>)` in a loop
// are stackable, so when their flow is local they become one entry-block
// alloca whose slot is reused every pass and there is nothing to hoist; and an
// allocation that escapes the iteration is memory the program asked for. A
// warning that fires where the compiler already did the right thing is exactly
// the un-actionable kind §8 forbids.

/**
 * The state the walk carries. `loops` is the enclosing loop *statements*,
 * innermost last, so a candidate allocation knows which subtree to scan for
 * the uses of its local. `declared` and `declaredDepth` are parallel: the
 * local a declaration introduced and the loop depth it was introduced at,
 * which is how "the accumulator is reset every pass" is told from "the
 * accumulator outlives the pass". Entries are never popped — locals are
 * compared by identity, so a sibling loop's local can never be mistaken for
 * this one's.
 */
class PerfWalk {
  ctx: CheckContext;
  loops: Node[];
  declared: Local[];
  declaredDepth: i32[];

  constructor(ctx: CheckContext) {
    this.ctx = ctx;
    this.loops = [];
    this.declared = [];
    this.declaredDepth = [];
  }

  /** The loop depth `local` was declared at, or -1 when it was not declared inside a loop. */
  depthOf(local: Local): i32 {
    let i = 0;
    while (i < this.declared.length) {
      if (this.declared[i] === local) {
        return this.declaredDepth[i];
      }
      i = i + 1;
    }
    return -1;
  }
}

/**
 * Report the performance warnings of one checked function body. Called after
 * the body has been checked so every type and binding it reads is recorded,
 * and only for a body that checked cleanly — advice about code that does not
 * compile is noise, and a poisoned body has incomplete side tables anyway.
 */
export function checkPerformance(ctx: CheckContext, body: Node): void {
  walkPerformance(new PerfWalk(ctx), body);
}

/**
 * Walk one function body. The loop stack is pushed around the parts of a loop
 * that run once per iteration and *not* around a `for` initializer, which runs
 * once: `for (let s = ""; ...) { s = s + t; }` accumulates across the whole
 * loop and must warn, while `for (const x of xs) { ... }` gives `x` a fresh
 * binding every pass and must not.
 */
function walkPerformance(walk: PerfWalk, node: Node): void {
  if (node.kind === N_FOR) {
    walkPerformance(walk, node.children[0]);
    walk.loops.push(node);
    walkPerformance(walk, node.children[1]);
    walkPerformance(walk, node.children[2]);
    walkPerformance(walk, node.children[3]);
    walk.loops.pop();
    return;
  }
  if (node.kind === N_FOR_OF) {
    walkPerformance(walk, node.children[1]);
    walk.loops.push(node);
    walkPerformance(walk, node.children[0]);
    walkPerformance(walk, node.children[2]);
    walk.loops.pop();
    return;
  }
  // `while` and `do` differ only in which of the two children comes first, and
  // both are walked in source order — which is the order the warnings come out
  // in, and stage0 walks the same tree in the same direction.
  if (node.kind === N_WHILE || node.kind === N_DO) {
    walk.loops.push(node);
    walkPerformance(walk, node.children[0]);
    walkPerformance(walk, node.children[1]);
    walk.loops.pop();
    return;
  }
  if (node.kind === N_VAR_DECL) {
    const local = walk.ctx.program.nodeLocals[node.id];
    if (local !== null) {
      walk.declared.push(local);
      walk.declaredDepth.push(walk.loops.length);
    }
    checkLoopAllocation(walk, node);
  } else if (node.kind === N_BINARY && node.text === "=") {
    checkStringAccumulation(walk, node);
  }
  for (const child of node.children) {
    walkPerformance(walk, child);
  }
}

/** `s = <something built from s>` inside a loop that does not own `s`. */
function checkStringAccumulation(walk: PerfWalk, expr: Node): void {
  if (walk.loops.length === 0) {
    return;
  }
  const left = expr.children[0];
  if (left.kind !== N_IDENT) {
    return;
  }
  const target = walk.ctx.program.nodeLocals[left.id];
  if (target === null || target.type !== T_STRING) {
    return;
  }
  // Declared inside the loop it is assigned in: the string is rebuilt from
  // empty every pass, so it is bounded by one iteration, not by the loop.
  if (walk.depthOf(target) === walk.loops.length) {
    return;
  }
  if (!accumulates(walk.ctx, expr.children[1], target)) {
    return;
  }
  walk.ctx.performance(
    left,
    `\`${target.name}\` is rebuilt from its own value on every iteration of this loop, so every pass copies all ` +
      `of it (quadratic in time and in arena bytes): collect the pieces in a \`string[]\` and \`join\` them after the loop`
  );
}

/** A dynamically sized array allocated per iteration and dead by the end of it. */
function checkLoopAllocation(walk: PerfWalk, decl: Node): void {
  if (walk.loops.length === 0) {
    return;
  }
  const local = walk.ctx.program.nodeLocals[decl.id];
  const name = decl.children[0];
  if (local === null || name.kind !== N_IDENT) {
    return;
  }
  if (!isDynamicArrayAllocation(walk.ctx, decl.children[2])) {
    return;
  }
  const loop = walk.loops[walk.loops.length - 1];
  if (!usedOnlyWithinIteration(walk.ctx, loop, local, decl)) {
    return;
  }
  walk.ctx.performance(
    name,
    `\`${local.name}\` allocates a dynamically sized array on every iteration of this loop and nothing keeps it ` +
      `past the iteration, so the arena grows once per pass: hoist the allocation above the loop and reuse it, ` +
      `or bracket the loop body with \`Arena.mark()\` and \`Arena.release(m)\``
  );
}

/** Strip parentheses; every shape test here is about the expression inside them. */
function unwrapPerfParens(expr: Node): Node {
  let inner = expr;
  while (inner.kind === N_PAREN) {
    inner = inner.children[0];
  }
  return inner;
}

/**
 * The value of `expr` is `target`'s own contents plus something. Only `+`
 * chains and template holes are followed, because those are the two forms
 * that copy the accumulator; `s = f(s)` or `s = cond ? s : t` may do anything
 * or nothing, and guessing would break the "name a concrete rewrite" bar.
 */
function accumulates(ctx: CheckContext, expr: Node, target: Local): boolean {
  const e = unwrapPerfParens(expr);
  if (e.kind === N_IDENT) {
    const bound = ctx.program.nodeLocals[e.id];
    return bound !== null && bound === target;
  }
  if (e.kind === N_BINARY && e.text === "+") {
    return accumulates(ctx, e.children[0], target) || accumulates(ctx, e.children[1], target);
  }
  if (e.kind === N_TEMPLATE) {
    for (const part of e.children) {
      if (part.kind !== N_TEMPLATE_TEXT && accumulates(ctx, part, target)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * `expr` allocates an array whose size is not a compile-time constant, so WP6
 * cannot turn it into an entry-block alloca and it comes out of the arena
 * every time it runs. `new Array<T>(4)`, `[a, b]` and `new C(...)` are all
 * stackable and therefore not this.
 *
 * The literal test is deliberately the syntactic one `self/escape.ts` uses to
 * decide the stack slot, because the warning must fire exactly where that
 * decision goes the other way: a `const n = 8` is a local, not a literal, and
 * both sides agree it is dynamic.
 */
function isDynamicArrayAllocation(ctx: CheckContext, expr: Node): boolean {
  const e = unwrapPerfParens(expr);
  if (e.kind !== N_NEW || !ctx.table.isArray(ctx.program.nodeTypes[e.id])) {
    return false;
  }
  const args = e.children[2];
  // The checker already requires exactly one argument; anything else is a
  // rejected program the walk never reaches.
  if (args.children.length !== 1) {
    return false;
  }
  const length = unwrapPerfParens(args.children[0]);
  return length.kind !== N_NUMBER || !isNonNegativeInteger(length.text);
}

/** The literal is a non-negative integer as written: no sign, no dot, no exponent. */
function isNonNegativeInteger(text: string): boolean {
  if (text.length === 0) {
    return false;
  }
  let i = 0;
  while (i < text.length) {
    const c = text.charCodeAt(i);
    if (c < 48 || c > 57) {
      return false;
    }
    i = i + 1;
  }
  return true;
}

/**
 * Every reference to `local` inside `root` is consumed where it stands: an
 * element read or write, a `.length`, or a `for...of` source. Anything else —
 * a `push`, an argument, a store, a `return`, a reassignment, a bare mention —
 * may keep the value past the iteration, and then the allocation is not
 * redundant and hoisting it would be wrong.
 *
 * `own` is the declaration that introduced `local`; its own name is not a use.
 */
function usedOnlyWithinIteration(ctx: CheckContext, root: Node, local: Local, own: Node): boolean {
  if (root === own) {
    return usedOnlyWithinIteration(ctx, own.children[2], local, own);
  }
  if (root.kind === N_INDEX && isLocalRef(ctx, root.children[0], local)) {
    return usedOnlyWithinIteration(ctx, root.children[1], local, own);
  }
  if (root.kind === N_MEMBER && root.text === "length" && isLocalRef(ctx, root.children[0], local)) {
    return true;
  }
  if (root.kind === N_FOR_OF && isLocalRef(ctx, root.children[1], local)) {
    return (
      usedOnlyWithinIteration(ctx, root.children[0], local, own) &&
      usedOnlyWithinIteration(ctx, root.children[2], local, own)
    );
  }
  if (root.kind === N_IDENT) {
    const bound = ctx.program.nodeLocals[root.id];
    return bound === null || bound !== local;
  }
  for (const child of root.children) {
    if (!usedOnlyWithinIteration(ctx, child, local, own)) {
      return false;
    }
  }
  return true;
}

/** `expr` is a direct reference to `local` (through parentheses only). */
function isLocalRef(ctx: CheckContext, expr: Node, local: Local): boolean {
  const e = unwrapPerfParens(expr);
  if (e.kind !== N_IDENT) {
    return false;
  }
  const bound = ctx.program.nodeLocals[e.id];
  return bound !== null && bound === local;
}
