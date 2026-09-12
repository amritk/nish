/**
 * Phase B: validation and type checking.
 *
 * The core walks top-level declarations and function bodies, dispatching
 * every statement and expression to the handler tables in `statements.ts`
 * and `expressions.ts`. It records the StaticType of every expression in a
 * side table (`CheckedProgram.types`) that the IR emitter consumes, so the
 * emitter never has to re-derive types.
 *
 * Checking is split into passes so a whole program of modules can be checked
 * together (see `src/compilation.ts`):
 *   1.  `collectSignatures`  own functions, classes/interfaces (WP2), and import statements
 *   1b. `bindImports`        resolve imports against other modules' exports
 *   2.  `checkBodies`        function and method bodies, now that every callee is known
 */
import ts from "typescript";
import { CompileError, DiagnosticSink, PerformanceWarning } from "../diagnostics.js";
import { CompilerOptions, StaticType, registerNamedTypes, typeToString } from "../types.js";
import {
  coerceToContext,
  collectStructMembers,
  declareStruct,
  finishStruct,
  isStructDeclaration,
  referencedStructNames,
  signatureStructNames,
  thisLocal,
} from "./classes.js";
import { AliasInfo, aliasType, collectAlias } from "./aliases.js";
import { EnumInfo, collectEnum } from "./enums.js";
import { ConstInfo, constValue } from "./constants.js";
import {
  arrowFunctionOf,
  collectArrowSignature,
  collectConstant,
  collectFunctionSignature,
  collectImports,
  markEntryMain,
  rejectNonFunctionExport,
} from "./declarations.js";
import { CheckContext, LoopInfo } from "./context.js";
import { expressionCheckers } from "./expressions.js";
import { ROOT_PACKAGE, packageSymbolPrefix } from "../packages.js";
import { CheckedProgram, FunctionSig, ImportBinding, LocalVar, StructInfo } from "./program.js";
import { checkElementReferences } from "./arrays.js";
import { checkPerformance } from "./performance.js";
import { checkResultLocalsHandled } from "./result.js";
import { Scope } from "./scope.js";
import { checkReturnValue, checkStatements, checkVariableDeclarationList, statementCheckers } from "./statements.js";

export * from "./program.js";
export { Scope } from "./scope.js";
export { ENTRY_MAIN_SYMBOL } from "./declarations.js";
export type { CheckContext, StatementChecker, ExpressionChecker, BinaryChecker, UnaryChecker } from "./context.js";

export interface CheckerModuleOptions {
  /** The entry module may (and with `--link` must) declare `export function main`. */
  isEntry: boolean;
  /**
   * The package this module belongs to (WP21 S1). The Compilation derives it
   * from the module's name; a module checked on its own is in the root
   * package, whose prefix is empty, so nothing it emits moves.
   */
  packageName?: string;
  /**
   * Where errors are collected (WP10). Shared by every module of a
   * Compilation, which decides between phases whether to go on. Without one
   * the checker makes its own and `check()` throws at the end.
   */
  sink?: DiagnosticSink;
}

/** Maps an import binding to the checked program its specifier names (resolved by the Compilation). */
export type ImportResolver = (binding: ImportBinding) => CheckedProgram;

export class Checker implements CheckContext {
  readonly sf: ts.SourceFile;
  readonly program: CheckedProgram;
  /** Local name -> signature: own functions plus bound imports. */
  readonly sigs = new Map<string, FunctionSig>();
  readonly loops: LoopInfo[] = [];
  current!: FunctionSig;
  private readonly isEntry: boolean;
  readonly sink: DiagnosticSink;
  /**
   * Whether the program's entry module declares `export function main` (WP7,
   * `process.argv`). The Compilation sets it on every module before bodies
   * are checked; a single-module check falls back to this module's own entry.
   */
  entryHasMain?: boolean;

  get hasEntryMain(): boolean {
    return this.entryHasMain ?? this.program.entryMain !== undefined;
  }
  /**
   * Import names used as types before pass 1b could tell whether they name a
   * class (WP2). Resolved provisionally as `%struct.<name>`; `bindImports`
   * rejects the ones that turn out to be functions.
   */
  private readonly importsUsedAsTypes = new Set<string>();
  /**
   * The struct names this module may *write* as a type: the ones it declares
   * and the ones it imports. `program.structs` is wider than this — it also
   * holds the layouts reached through an imported class's members
   * (`registerReachableStructs`) — and resolving an annotation against that
   * wider map would make `Item` a legal annotation in a module that never
   * imported it.
   */
  private readonly typeNames = new Set<string>();
  /**
   * The entries of `program.structs` that are there only because they were
   * reachable. They are not a declaration, so they must not collide with one:
   * an explicit `import { Item }` after an `import { Box }` that reached it
   * replaces the entry rather than reporting a duplicate.
   */
  private readonly reachableOnly = new Set<string>();

  constructor(
    sourceFile: ts.SourceFile,
    readonly opts: CompilerOptions,
    module: CheckerModuleOptions = { isEntry: true }
  ) {
    this.sf = sourceFile;
    this.isEntry = module.isEntry;
    this.sink = module.sink ?? new DiagnosticSink();
    this.program = {
      sourceFile,
      packageName: module.packageName ?? ROOT_PACKAGE,
      symbolPrefix: packageSymbolPrefix(module.packageName ?? ROOT_PACKAGE),
      functions: [],
      imports: [],
      exports: new Map(),
      constants: new Map(),
      exportedConstants: new Map(),
      types: new WeakMap(),
      bindings: new WeakMap(),
      constRefs: new WeakMap(),
      locals: new WeakMap(),
      callees: new WeakMap(),
      structs: new Map(),
      reachableStructs: [],
      coercions: new WeakMap(),
      caseValues: new WeakMap(),
      aliases: new Map(),
      enums: new Map(),
      enumRefs: new WeakMap(),
    };
    registerNamedTypes(sourceFile, (name) => {
      const own = this.typeNames.has(name) ? this.program.structs.get(name) : undefined;
      if (own) return own.type;
      // An alias is the type it names, so it answers here and the caller never
      // learns that a name was involved (WP23).
      const alias = this.program.aliases.get(name);
      if (alias) return aliasType(alias, this.opts);
      // An enum is a type of its own, and the only way to name it (WP23).
      const declaredEnum = this.program.enums.get(name);
      if (declaredEnum) return declaredEnum.type;
      if (this.program.imports.some((imp) => imp.localName === name)) {
        this.importsUsedAsTypes.add(name);
        return { kind: "struct", name };
      }
      return undefined;
    });
  }

  /**
   * Single-module convenience: every pass in order; imports cannot be
   * resolved here. Throws the first error (with the rest attached) at the end
   * of the pass that found it, so no phase runs over broken tables.
   */
  check(): CheckedProgram {
    this.collectSignatures();
    this.sink.throwIfErrors();
    this.bindImports((b) =>
      this.error(`Cannot resolve import \`${b.specifier}\` when checking a single module`, b.node)
    );
    this.sink.throwIfErrors();
    this.checkBodies();
    this.sink.throwIfErrors();
    return this.program;
  }

  /**
   * Pass 1: collect signatures so functions can call each other in any order.
   * Imports and class/interface names go first so any annotation can name
   * them; then members and function signatures in source order; finally the
   * checks that need every struct's layout (`implements`, definite assignment).
   *
   * Recovery is per declaration (WP10): a rejected class, interface, import or
   * function signature is reported, the struct is marked poisoned (its
   * layout checks are skipped), and the next declaration is collected.
   */
  collectSignatures(): void {
    const structs: StructInfo[] = [];
    const aliases: AliasInfo[] = [];
    for (const stmt of this.sf.statements) {
      this.sink.recover(() => {
        if (ts.isImportDeclaration(stmt)) this.program.imports.push(...collectImports(stmt, this.sf));
        else if (isStructDeclaration(stmt)) {
          const info = declareStruct(this, stmt);
          this.typeNames.add(info.name);
          structs.push(info);
        } else if (ts.isTypeAliasDeclaration(stmt)) {
          // Names first, resolution second (below): an alias may name a class
          // declared further down the file, or another alias (WP23).
          const info = collectAlias(stmt, this.sf);
          this.declareAlias(info);
          aliases.push(info);
        } else if (ts.isEnumDeclaration(stmt)) {
          // An enum is complete the moment it is read — its members are
          // literals, not a right-hand side that can name something later —
          // so unlike an alias there is no second pass for it (WP23).
          this.declareEnum(collectEnum(stmt, this.sf));
        }
      });
    }
    for (const stmt of this.sf.statements) {
      if (ts.isImportDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt) || ts.isEnumDeclaration(stmt)) {
        continue;
      }
      if (isStructDeclaration(stmt)) {
        const info = stmt.name && this.program.structs.get(stmt.name.text);
        if (info && info.decl === stmt && !this.sink.recover(() => collectStructMembers(this, info))) {
          info.poisoned = true;
        }
        continue;
      }
      if (ts.isVariableStatement(stmt)) {
        // WP22: an arrow initialiser makes this a function declaration; every
        // other module-level `const` names a compile-time value.
        const isFunction = stmt.declarationList.declarations.some((d) => arrowFunctionOf(d) !== undefined);
        this.sink.recover(() => (isFunction ? this.collectArrowFunction(stmt) : this.collectConstants(stmt)));
        continue;
      }
      this.sink.recover(() => this.collectFunction(stmt));
    }
    for (const info of structs) {
      if (!info.poisoned && !this.sink.recover(() => finishStruct(this, info))) info.poisoned = true;
    }
    // Every alias is resolved even when nothing names it, so that a broken
    // right-hand side and a cycle are reported where they are written rather
    // than at the first use — or never.
    for (const info of aliases) this.sink.recover(() => aliasType(info, this.opts));
    this.qualifySymbols();
  }

  /**
   * WP21 S1: put every symbol this module declares inside its package.
   *
   * One place, and after every signature exists, so that a free function, a
   * method (`Owner.method`) and a constructor are scoped by the same line of
   * code and nothing can be added later that forgets to be. The root package's
   * prefix is empty, which is why a single-package program — every program
   * that could be compiled before this existed — emits exactly the symbols it
   * always did.
   *
   * `main` needs no exception: only the entry module may declare it, and the
   * entry module is the root package by construction (`Compilation` derives
   * every other module's package by comparing it with the entry's own).
   */
  private qualifySymbols(): void {
    const prefix = this.program.symbolPrefix;
    if (prefix === "") return;
    for (const sig of this.program.functions) sig.name = prefix + sig.name;
  }

  /**
   * Register an alias under its name. A type alias shares the one declaration
   * namespace with functions, classes, interfaces and module constants, so
   * every clash reads the same way whichever came first.
   */
  private declareAlias(info: AliasInfo): void {
    if (this.nameTaken(info.name)) {
      this.error(`\`${info.name}\` is already declared in this module`, info.decl.name);
    }
    this.program.aliases.set(info.name, info);
  }

  /**
   * Register an enum under its name (WP23). An enum declares a type and shares
   * the one declaration namespace every other top-level name is in, so the
   * clash reads the same way whichever declaration came first.
   */
  private declareEnum(info: EnumInfo): void {
    if (this.nameTaken(info.name)) {
      this.error(`\`${info.name}\` is already declared in this module`, info.decl.name);
    }
    this.program.enums.set(info.name, info);
  }

  /** Whether a top-level declaration has already claimed `name` in this module. */
  private nameTaken(name: string): boolean {
    return (
      this.program.aliases.has(name) ||
      this.program.enums.has(name) ||
      this.program.structs.has(name) ||
      this.sigs.has(name) ||
      this.program.constants.has(name)
    );
  }

  /**
   * A top-level `const` names a compile-time value (WP14). The initialiser is
   * not folded here: it may reference a constant imported from a module that
   * has not been checked yet, so folding waits for `foldConstants` in pass 2.
   */
  private collectConstants(stmt: ts.VariableStatement): void {
    for (const decl of stmt.declarationList.declarations) {
      const info = collectConstant(stmt, decl, this.sf, this.opts, this.program.constants);
      if (this.nameTaken(info.name)) {
        this.error(`\`${info.name}\` is already declared in this module`, decl.name);
      }
      this.program.constants.set(info.name, info);
      if (info.exported) this.program.exportedConstants.set(info.name, info);
    }
  }

  private collectFunction(stmt: ts.Statement): void {
    if (!ts.isFunctionDeclaration(stmt)) {
      rejectNonFunctionExport(stmt, this.sf);
      this.error(
        `Only top-level function declarations are supported in Phase 1 (found ${ts.SyntaxKind[stmt.kind]})`,
        stmt
      );
    }
    this.registerFunction(collectFunctionSignature(stmt, this.sf, this.opts), stmt);
  }

  /**
   * WP22: the arrow form. `const double = (n: i32): i32 => n * 2` at module
   * level declares a function, so it is registered in the function table and
   * never in `program.constants` — which is what keeps a function out of the
   * value namespace, and `const g = double` an unknown identifier as it always
   * was for the `function` spelling.
   */
  private collectArrowFunction(stmt: ts.VariableStatement): void {
    const decl = stmt.declarationList.declarations[0];
    const arrow = arrowFunctionOf(decl)!;
    this.registerFunction(collectArrowSignature(stmt, decl, arrow, this.sf, this.opts), stmt);
  }

  /** The name checks and the entry-point wiring, shared by both spellings. */
  private registerFunction(sig: FunctionSig, stmt: ts.Statement): void {
    if (this.sigs.has(sig.sourceName)) this.error(`Duplicate function \`${sig.sourceName}\``, stmt);
    if (this.program.structs.has(sig.sourceName)) {
      this.error(`\`${sig.sourceName}\` is already declared as a class or interface`, sig.nameNode);
    }
    if (this.program.aliases.has(sig.sourceName) || this.program.enums.has(sig.sourceName)) {
      this.error(`\`${sig.sourceName}\` is already declared in this module`, sig.nameNode);
    }
    if (sig.exported && sig.sourceName === "main") {
      if (!this.isEntry) this.error("Only the entry module may declare `export function main`", sig.nameNode);
      this.program.entryMain = markEntryMain(sig, this.sf);
    }
    this.sigs.set(sig.sourceName, sig);
    this.program.functions.push(sig);
    if (sig.exported) this.program.exports.set(sig.sourceName, sig);
  }

  /** Pass 1b: bind every import to the exporter's function signature or struct. */
  bindImports(resolve: ImportResolver): void {
    for (const imp of this.program.imports) this.sink.recover(() => this.bindImport(imp, resolve(imp)));
  }

  private bindImport(imp: ImportBinding, target: CheckedProgram): void {
    const constant = target.exportedConstants.get(imp.importedName);
    if (constant) {
      this.bindConstantImport(imp, constant);
      return;
    }
    const struct = target.structs.get(imp.importedName);
    if (struct && struct.decl.getSourceFile() === target.sourceFile) {
      this.bindStructImport(imp, struct);
      return;
    }
    const sig = target.exports.get(imp.importedName);
    if (!sig) {
      const exists = target.functions.some((f) => f.sourceName === imp.importedName);
      this.error(
        exists
          ? `\`${imp.importedName}\` is declared in \`${imp.specifier}\` but not exported (add \`export\`)`
          : `Module \`${imp.specifier}\` has no exported function \`${imp.importedName}\``,
        imp.element
      );
    }
    if (this.importsUsedAsTypes.has(imp.localName)) {
      this.error(`\`${imp.localName}\` is a function imported from \`${imp.specifier}\`, not a type`, imp.element);
    }
    const clash = this.sigs.get(imp.localName);
    if (clash) {
      const origin = this.program.imports.find((o) => o.sig === clash);
      this.error(
        origin
          ? `\`${imp.localName}\` is already imported from \`${origin.specifier}\``
          : `\`${imp.localName}\` is already declared in this module`,
        imp.element
      );
    }
    imp.sig = sig;
    this.sigs.set(imp.localName, sig);
  }

  /**
   * An imported class or interface (WP2) joins this module's struct registry
   * under its own name: the LLVM type `%struct.<name>` and the method symbols
   * are fixed by the exporter, so `import { P as Q }` cannot be honoured.
   */
  private bindStructImport(imp: ImportBinding, struct: StructInfo): void {
    if (!struct.exported) {
      this.error(`\`${imp.importedName}\` is declared in \`${imp.specifier}\` but not exported (add \`export\`)`, imp.element);
    }
    if (imp.localName !== imp.importedName) {
      this.error(
        `${struct.kind === "class" ? "Classes" : "Interfaces"} cannot be renamed on import (\`${imp.importedName} as ${imp.localName}\`): the type name is part of the ABI`,
        imp.element
      );
    }
    const clash = this.reachableOnly.has(imp.localName) ? undefined : this.program.structs.get(imp.localName);
    if (clash) {
      const origin = this.program.imports.find((o) => o.struct === clash);
      this.error(
        origin
          ? `\`${imp.localName}\` is already imported from \`${origin.specifier}\``
          : `\`${imp.localName}\` is already declared in this module`,
        imp.element
      );
    }
    if (this.sigs.has(imp.localName)) this.error(`\`${imp.localName}\` is already declared in this module`, imp.element);
    imp.struct = struct;
    if (this.reachableOnly.delete(imp.localName)) {
      const at = this.program.reachableStructs.indexOf(struct);
      if (at >= 0) this.program.reachableStructs.splice(at, 1);
    }
    this.typeNames.add(imp.localName);
    this.program.structs.set(imp.localName, struct);
  }

  /**
   * The layouts an imported class drags in with it. `import { Box }` where
   * `Box.all(): Item[]` gives this module `Item` values it can call methods on
   * and read fields of, and both the checker (`structOf`) and the emitter
   * (field offsets, `%struct.Item = type { ... }` rather than `type opaque`)
   * need `Item`'s layout to do it — in a module where `Item` is never written.
   *
   * They go into `program.structs` but not into `typeNames`, so nothing about
   * what may be *spelled* as a type changes: `const x: Item` in this module is
   * still `Unknown type` until `Item` is imported.
   *
   * The same is true of an imported *function*: `parse(): Node` hands this
   * module `Node` values without `Node` appearing anywhere in it.
   *
   * `declared` is every struct declared anywhere in the program, which is why
   * this is a pass of its own after every module has bound its imports: a
   * chain (`A` imports `B`'s class, whose method returns `C`'s) would
   * otherwise depend on the order the modules happened to be bound in.
   */
  closeReachableStructs(declared: ReadonlyMap<string, StructInfo>): void {
    const pending: StructInfo[] = [];
    const seen = new Set<string>();
    const reach = (name: string): void => {
      if (seen.has(name)) return;
      seen.add(name);
      const info = declared.get(name);
      if (!info) return;
      if (!this.program.structs.has(name)) {
        this.program.structs.set(name, info);
        this.program.reachableStructs.push(info);
        this.reachableOnly.add(name);
      }
      pending.push(info);
    };
    for (const imp of this.program.imports) {
      if (imp.struct) {
        // The imported class itself is already registered by name.
        seen.add(imp.struct.name);
        pending.push(imp.struct);
      }
      // An imported *function* drags its types in the same way: `parse(): Node`
      // hands this module `Node` values with no mention of `Node` anywhere.
      if (imp.sig) {
        for (const name of signatureStructNames(imp.sig)) reach(name);
      }
    }
    while (pending.length > 0) {
      // biome-ignore lint/style/noNonNullAssertion: the loop guard is the length check
      const info = pending.pop()!;
      for (const name of referencedStructNames(info)) reach(name);
    }
  }

  /**
   * An imported `export const` (WP14) joins this module's constant table under
   * its local name. Nothing is linked: the value is folded into every use site
   * here exactly as it is in the exporting module, so `import { KIND_IF }`
   * costs no symbol and no relocation.
   */
  private bindConstantImport(imp: ImportBinding, constant: ConstInfo): void {
    if (this.program.constants.has(imp.localName) || this.sigs.has(imp.localName) ||
        (this.program.structs.has(imp.localName) && !this.reachableOnly.has(imp.localName))) {
      this.error(`\`${imp.localName}\` is already declared in this module`, imp.element);
    }
    if (this.importsUsedAsTypes.has(imp.localName)) {
      this.error(`\`${imp.localName}\` is a constant imported from \`${imp.specifier}\`, not a type`, imp.element);
    }
    imp.constant = constant;
    this.program.constants.set(imp.localName, constant);
  }

  /**
   * Fold every constant this module declares. Done before the bodies so a bad
   * initialiser is reported once, against its own declaration, rather than
   * once per use site; an unused constant is still folded, because a constant
   * that cannot be computed is an error whether or not anybody reads it.
   */
  foldConstants(): void {
    for (const info of this.program.constants.values()) {
      if (info.decl.getSourceFile() === this.sf) this.sink.recover(() => constValue(info));
    }
  }

  /** Pass 2: check bodies. Every function is checked even after an earlier one was rejected (WP10). */
  checkBodies(): CheckedProgram {
    this.foldConstants();
    for (const sig of this.program.functions) {
      if (!this.sink.recover(() => this.checkFunctionBody(sig))) sig.poisoned = true;
    }
    return this.program;
  }

  error(message: string, node: ts.Node): never {
    throw new CompileError(message, node, this.sf);
  }

  report(err: CompileError): void {
    this.sink.report(err);
    if (this.current) this.current.poisoned = true;
  }

  /**
   * WP15 §8. Nothing is thrown and nothing is poisoned: a performance warning
   * is advice about code that compiles, so the compilation goes on exactly as
   * it would have without it.
   */
  reportPerformance(message: string, node: ts.Node): void {
    this.sink.reportPerformance(new PerformanceWarning(message, node, this.sf));
  }

  private checkFunctionBody(sig: FunctionSig): void {
    this.current = sig;
    const scope = new Scope();
    // Methods and constructors (WP2) carry `this` as their first parameter.
    const offset = sig.struct ? 1 : 0;
    if (sig.struct) scope.declare(thisLocal(sig), sig.decl, this.sf);
    sig.decl.parameters.forEach((p, i) => {
      const param = sig.params[i + offset];
      const v: LocalVar = { name: param.name, type: param.type, mutable: false, storage: "param" };
      scope.declare(v, p, this.sf);
    });

    // The body shares the parameter scope rather than opening a child, so
    // `function f(a) { let a }` is a duplicate-declaration error as in TS.
    // WP22 §4: a concise arrow body (`=> n * 2`) is a block with one `return`,
    // so it always terminates and its expression is checked as that return's.
    let terminates: boolean;
    if (ts.isBlock(sig.body)) {
      terminates = checkStatements(this, sig.body.statements, scope);
    } else {
      checkReturnValue(this, sig.body, scope);
      terminates = true;
    }
    // WP16: a `Result` local nobody reads is an unhandled failure. Reported
    // after the body so the diagnostic names a variable whose type is known.
    if (!sig.poisoned) {
      checkResultLocalsHandled(this, sig);
      // WP15 §8: the performance warnings, over the same body and the same
      // side tables. Only for a body that checked cleanly — advice about code
      // that does not compile is noise, and a poisoned body has incomplete
      // side tables anyway.
      checkPerformance(this, sig);
      // WP15 §2a: an element reference into contiguous record storage may not
      // be held across a `push`. Same placement and same reason as the line
      // above — the walk reads types and bindings pass 2 has just written.
      checkElementReferences(this, sig);
    }
    // A body with a rejected statement may have lost its `return`: no definite-return cascade.
    if (sig.returnType.kind !== "void" && !terminates && !sig.poisoned) {
      this.error(
        `Function \`${sig.sourceName}\` must return a value of type ${typeToString(sig.returnType)} on every path`,
        sig.nameNode
      );
    }
  }

  checkBlock(block: ts.Block, scope: Scope): boolean {
    return checkStatements(this, block.statements, scope.child());
  }

  checkStatementList(stmts: readonly ts.Statement[], scope: Scope): boolean {
    return checkStatements(this, stmts, scope);
  }

  checkStatement(stmt: ts.Statement, scope: Scope): boolean {
    const handler = statementCheckers[stmt.kind];
    if (!handler) this.error(`Unsupported statement in Phase 1: ${ts.SyntaxKind[stmt.kind]}`, stmt);
    return handler(this, stmt, scope);
  }

  checkExpression(expr: ts.Expression, scope: Scope): StaticType {
    const handler = expressionCheckers[expr.kind];
    if (!handler) this.error(`Unsupported expression in Phase 1: ${ts.SyntaxKind[expr.kind]}`, expr);
    // A class value where an interface it implements is expected takes the
    // interface type here (WP2); the emitter inserts the matching bitcast.
    const t = coerceToContext(this, expr, handler(this, expr, scope), scope);
    this.program.types.set(expr, t);
    return t;
  }

  declareVariables(list: ts.VariableDeclarationList, scope: Scope): void {
    checkVariableDeclarationList(this, list, scope);
  }
}

/** Check a single, import-free module. Multi-module programs go through `Compilation`. */
export function checkProgram(sourceFile: ts.SourceFile, opts: CompilerOptions): CheckedProgram {
  return new Checker(sourceFile, opts).check();
}
