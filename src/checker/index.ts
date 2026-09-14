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
import { CompilerOptions, StaticType, registerNamedTypes, resolveTypeNode, typeToString } from "../types.js";
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
  collectArrowTemplate,
  collectConstant,
  collectFunctionSignature,
  collectFunctionTemplate,
  collectImports,
  collectStructTemplate,
  collectPlainParams,
  markEntryMain,
  rejectDollarInSymbolName,
  rejectNonFunctionExport,
} from "./declarations.js";
import { CheckContext, LoopInfo } from "./context.js";
import {
  Instantiation,
  MAX_INSTANTIATIONS,
  MAX_INSTANTIATIONS_PER_TEMPLATE,
  StructInstantiation,
  StructTemplateInfo,
  TemplateInfo,
  TemplateOwner,
  expandingAncestor,
  expandingStructAncestor,
  instanceDisplayName,
  instanceSymbol,
  instantiateWritten,
  mentionsTypeParam,
  newNodeTables,
  nonTerminatingParts,
  nonTerminatingStructParts,
  swapTables,
} from "./generics.js";
import { expressionCheckers } from "./expressions.js";
import { ROOT_PACKAGE, packageSymbolPrefix } from "../packages.js";
import { CheckedProgram, FunctionSig, ImportBinding, LocalVar, Param, StructInfo } from "./program.js";
import { analyzeBounds } from "./bounds.js";
import { checkElementReferences } from "./arrays.js";
import { isNishSpecifier, nishModule, nishModuleNames } from "./nish-modules.js";
import { lookup } from "../lookup.js";
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
  /** Local name -> generic template (WP18). A template is not in `sigs`: it has no signature. */
  readonly templates = new Map<string, TemplateInfo>();
  /**
   * Local name -> generic class or interface (WP18 G5). A struct template is
   * not in `program.structs` for the same reason a function template is not in
   * `sigs`: it has no layout until an instantiation binds its parameters, so
   * `Box` on its own is not a type and never becomes a `%struct`.
   */
  readonly structTemplates = new Map<string, StructTemplateInfo>();
  /**
   * The type parameters in scope, bound to the types this instantiation gives
   * them. Set only while an instantiation's signature is resolved or its body
   * is checked, and read by the named-type resolver below — which is the whole
   * of how `T` becomes `i32` (`docs/wp18-generics.md` §3d).
   */
  private typeBindings?: Map<string, StaticType>;
  /** The instantiation whose body is being checked, so a request from it records its parent. */
  private currentInstance?: Instantiation;
  /**
   * The struct instantiation whose members are being collected, or whose method
   * body is being checked. It is the struct half of `currentInstance`, and the
   * chain the struct termination rule walks — a field's type is resolved during
   * collection rather than while a body runs, so this is what makes
   * `class Nest<T> { inner: Nest<T[]> | null }` refusable by name (G5).
   */
  private currentStructInstance?: StructInstantiation;
  /** Requested but not yet checked, FIFO so the enumeration order is the discovery order. */
  private readonly pending: Instantiation[] = [];
  /**
   * Instantiated structs whose `implements` and definite-assignment checks are
   * still owed. They wait for the same reason a declared struct's do: both need
   * every struct in the module to have its members, and an instantiation can be
   * requested by an annotation resolved before the interface it implements has
   * been collected.
   */
  private readonly pendingFinish: StructInfo[] = [];
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
      builtinRefs: new WeakMap(),
      locals: new WeakMap(),
      callees: new WeakMap(),
      structs: new Map(),
      reachableStructs: [],
      coercions: new WeakMap(),
      caseValues: new WeakMap(),
      provenIndices: new WeakSet(),
      aliases: new Map(),
      builtinImports: new Map(),
      enums: new Map(),
      enumRefs: new WeakMap(),
      templates: new Map(),
      instantiations: new Map(),
      externalInstances: [],
      structTemplates: new Map(),
      structInstantiations: new Map(),
    };
    registerNamedTypes(sourceFile, (name, ref) => {
      // WP18 G5: `Box<i32>` names one instantiated struct. It is answered first
      // because it is the only branch that reads the type arguments at all; a
      // template's name with the wrong number of them, or with none, is refused
      // in there rather than falling through to "unsupported type reference".
      const structTemplate = this.structTemplates.get(name);
      if (structTemplate) return this.instantiateStructNode(structTemplate, ref);
      // Beyond this point the name takes no type arguments: a type parameter,
      // an ordinary class, an alias, an enum or an import. Leaving those to the
      // caller's refusal keeps `Point<i32>` saying "unsupported type reference",
      // which is what it said before generic classes existed.
      //
      // It sits *above* the type-parameter lookup rather than below it, and
      // that is the whole of the rule: a `T` that was written `T<i32>` is not
      // the `T` the tuple bound, so answering with the binding would drop the
      // arguments in silence and compile `const y: T<i32> = x` as `T`.
      if (ref?.typeArguments && ref.typeArguments.length > 0) return undefined;
      // WP18: a type parameter shadows everything while an instantiation is
      // being resolved, and exists at no other time — which is why no pass
      // below this line has ever met a type variable.
      const bound = this.typeBindings?.get(name);
      if (bound) return bound;
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
    this.drainInstantiations();
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
          // WP18 G5: a class or interface with type parameters is a template,
          // not a struct. It declares no layout, so it is registered beside the
          // function templates and `collectStructMembers` below skips it: its
          // members are collected once per instantiation instead.
          if (stmt.typeParameters && stmt.typeParameters.length > 0) {
            this.registerStructTemplate(collectStructTemplate(stmt, this.sf));
            return;
          }
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
    // Every instantiation an annotation in this module's signatures asked for
    // now has its members, and so does every struct declared here, so the two
    // checks that need both can run (WP18 G5).
    this.finishPendingStructs();
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
    for (const sig of this.program.functions) {
      // WP18: an instantiation's symbol carries the prefix from the moment it
      // is minted, because it may be created on either side of this pass —
      // a signature annotation that names `Box<i32>` runs before it, and a
      // `new Box<i32>(v)` in a body runs long after. Qualifying it again would
      // spell the package twice.
      if (sig.instance) continue;
      sig.name = prefix + sig.name;
    }
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
      this.structTemplates.has(name) ||
      this.sigs.has(name) ||
      this.templates.has(name) ||
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
    if (stmt.typeParameters && stmt.typeParameters.length > 0) {
      this.registerTemplate(collectFunctionTemplate(stmt, this.sf));
      return;
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
    if (arrow.typeParameters && arrow.typeParameters.length > 0) {
      this.registerTemplate(collectArrowTemplate(stmt, decl, arrow, this.sf));
      return;
    }
    this.registerFunction(collectArrowSignature(stmt, decl, arrow, this.sf, this.opts), stmt);
  }

  /** The name checks and the entry-point wiring, shared by both spellings. */
  private registerFunction(sig: FunctionSig, stmt: ts.Statement): void {
    rejectDollarInSymbolName(sig.sourceName, "function", sig.nameNode, this.sf);
    if (this.sigs.has(sig.sourceName) || this.templates.has(sig.sourceName)) {
      this.error(`Duplicate function \`${sig.sourceName}\``, stmt);
    }
    if (this.program.structs.has(sig.sourceName)) {
      this.error(`\`${sig.sourceName}\` is already declared as a class or interface`, sig.nameNode);
    }
    // Constants belong in this list for the same reason the three above do:
    // one name, one meaning, whichever declaration came first. They were
    // missing, and only in this direction -- `collectConstants` asks
    // `nameTaken`, which knows about functions, so a constant after a function
    // was refused while a function after a constant compiled, emitting a
    // module with two things called one name (`tests/cases/reject_fn_after_const`).
    if (this.program.constants.has(sig.sourceName)) {
      this.error(`\`${sig.sourceName}\` is already declared in this module`, sig.nameNode);
    }
    // A generic class belongs in this list and not in the one above it: the
    // structs pass runs before this one, so `class Box<T>` is already
    // registered whichever of the two was written first, and stage1 answers
    // from `nameTaken`, which counts a template. Without it a module compiled
    // with `%struct.Box$i32` and `@Box$i32.constructor` beside a
    // `define internal i32 @Box$i32(i32)` and no diagnostic at all.
    if (
      this.program.aliases.has(sig.sourceName) ||
      this.program.enums.has(sig.sourceName) ||
      this.structTemplates.has(sig.sourceName)
    ) {
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

  /**
   * WP18: one generic function declaration. A template shares the declaration
   * namespace with everything else — it is a `function` however it is spelled
   * — but it is not a signature: it has no types until an instantiation binds
   * its parameters, so it never joins `sigs` or `program.functions`.
   */
  private registerTemplate(template: TemplateInfo): void {
    const name = template.sourceName;
    if (this.sigs.has(name) || this.templates.has(name)) {
      this.error(`Duplicate function \`${name}\``, template.nameNode);
    }
    if (this.program.structs.has(name)) {
      this.error(`\`${name}\` is already declared as a class or interface`, template.nameNode);
    }
    if (
      this.program.aliases.has(name) ||
      this.program.constants.has(name) ||
      this.program.enums.has(name) ||
      this.structTemplates.has(name)
    ) {
      this.error(`\`${name}\` is already declared in this module`, template.nameNode);
    }
    if (template.exported && name === "main") {
      this.error(
        "`main` cannot be generic: the entry point is called by the C runtime, which has no type arguments to give it",
        template.nameNode
      );
    }
    // A type parameter is inferred from the arguments and from nothing else
    // (§2a), so one that appears in no parameter can never be inferred and the
    // function could never be called. Reported here, once, against the
    // declaration rather than against every call.
    for (const param of template.typeParams) {
      const mentioned = template.decl.parameters.some(
        (p) => p.type !== undefined && mentionsTypeParam(p.type, new Set([param]))
      );
      if (mentioned) continue;
      this.error(
        `Cannot infer \`${param}\` for \`${name}\`: a type parameter is inferred from the arguments, and ` +
          `\`${param}\` appears in none of them; give \`${name}\` a parameter that mentions \`${param}\``,
        template.nameNode
      );
    }
    // WP18 G7: every instantiation of it belongs to this module, whoever calls
    // it, which is what makes the symbol's prefix this package's.
    template.owner = this;
    this.templates.set(name, template);
    this.program.templates.set(name, template);
  }

  /**
   * WP18: the instantiation request. Answers the specialised signature for one
   * (template, type-argument tuple), creating and queueing it the first time it
   * is asked for — so a tuple seen twice is one `define`, and the FIFO queue
   * makes the order the discovery order in both compilers.
   */
  instantiate(template: TemplateInfo, args: StaticType[], at: ts.Node): FunctionSig {
    // WP18 G7: the instantiation belongs to the module that *declares* the
    // template, whoever wrote the call. Two things follow, and the second is
    // the one that would be a miscompile rather than a link error.
    //
    // WP21 S1: the symbol is minted inside the package that declares the
    // template, never the one that instantiates it. `qualifySymbols` runs at
    // the end of pass 1 and instantiations are created during pass 2, so an
    // instantiation never passes through it -- the prefix has to be part of the
    // symbol from the moment it is minted, and it has to be the *owner's*. Read
    // from `this` instead, two packages importing one generic would mint one
    // symbol, and the whole-program fact table in `codegen/attributes.ts`, which
    // is keyed by symbol, would hand one instantiation the other's purity and
    // escape facts (`docs/wp18-generics.md` §16 item 2,
    // `tests/link/package_generic_import`).
    const owner = template.owner ?? this;
    const symbol = instanceSymbol(owner.program.symbolPrefix + template.sourceName, args);
    const existing = owner.program.instantiations.get(symbol);
    if (existing) {
      this.noteExternalInstance(owner, existing.sig);
      return existing.sig;
    }

    // Termination (§4). A request that puts one of its own type arguments
    // under a constructor is the shape whose chain has no end, and it is
    // refused by name rather than by a depth count.
    const growing = expandingAncestor(this.currentInstance, template, args, (n) => this.structInstance(n));
    if (growing) {
      // Written here rather than returned from a helper, for the reason the
      // clash message in `compilation.ts` is one literal: the code generator
      // reads the string at the diagnostic call and nothing else, so a message
      // assembled behind a function call is invisible to it and carries NL0000
      // however many words of its own it has. `nonTerminatingParts` keeps the
      // computing out of the sentence.
      const parts = nonTerminatingParts(template, growing.ancestor, args, growing.index);
      this.error(
        `Monomorphising \`${template.sourceName}\` would not terminate: \`${parts.from}\` asks for \`${parts.to}\`, which puts \`${parts.under}\` under a type constructor instead of passing it on, so the chain has no end; pass \`${parts.param}\` itself, or a type that does not mention it`,
        at
      );
    }
    // The caps are the backstop for everything the rule does not see, and they
    // say they are this compiler's limit rather than a rule of the language.
    if (template.count >= MAX_INSTANTIATIONS_PER_TEMPLATE) {
      this.error(
        `\`${template.sourceName}\` has been instantiated ${MAX_INSTANTIATIONS_PER_TEMPLATE} times, which is ` +
          "this compiler's limit rather than a rule of the language",
        at
      );
    }
    if (owner.program.instantiations.size >= MAX_INSTANTIATIONS) {
      this.error(
        `This module has reached ${MAX_INSTANTIATIONS} generic instantiations, which is this compiler's limit ` +
          "rather than a rule of the language",
        at
      );
    }

    // Created *there* and checked *there*: the body is resolved against the
    // declaring module's scope, so `identity` means the same thing however many
    // modules call it. The termination chain above is the caller's, because it
    // is the caller's request that grows.
    const sig = owner.ownInstantiation(template, args, symbol, this.currentInstance);
    this.noteExternalInstance(owner, sig);
    return sig;
  }

  /**
   * WP18 G7: create and queue one instantiation, in the module that declares
   * its template. Only `instantiate` above calls it, and it calls it on the
   * owner rather than on itself.
   */
  ownInstantiation(
    template: TemplateInfo,
    args: StaticType[],
    symbol: string,
    from?: Instantiation
  ): FunctionSig {
    const bindings = new Map<string, StaticType>();
    template.typeParams.forEach((name, i) => {
      bindings.set(name, args[i]);
    });
    const sig = this.instanceSignature(template, args, bindings, symbol);
    const instance: Instantiation = {
      template,
      typeArgs: args,
      sig,
      bindings,
      tables: newNodeTables(),
      from,
    };
    sig.instance = instance;
    template.count += 1;
    this.program.instantiations.set(symbol, instance);
    this.pending.push(instance);
    return sig;
  }

  /**
   * Record that this module *calls* an instantiation another module defines, so
   * the emitter writes a `declare` for it beside the ones it writes for an
   * imported function (§3b). Insertion order is the discovery order, which is
   * what keeps the two compilers' `declare` blocks in the same order.
   */
  private noteExternalInstance(owner: TemplateOwner, sig: FunctionSig): void {
    if (owner === this) return;
    if (this.program.externalInstances.includes(sig)) return;
    this.program.externalInstances.push(sig);
  }

  /** The template's own annotations, resolved once with its type parameters bound. */
  private instanceSignature(
    template: TemplateInfo,
    args: StaticType[],
    bindings: Map<string, StaticType>,
    symbol: string
  ): FunctionSig {
    const saved = this.typeBindings;
    this.typeBindings = bindings;
    let params: Param[];
    let returnType: StaticType;
    try {
      params = collectPlainParams(template.decl.parameters, this.sf, this.opts);
      returnType = resolveTypeNode(template.decl.type as ts.TypeNode, this.sf, this.opts);
    } finally {
      this.typeBindings = saved;
    }
    return {
      name: symbol,
      sourceName: instanceDisplayName(template.sourceName, args),
      params,
      returnType,
      decl: template.decl,
      nameNode: template.nameNode,
      // Every instantiation is declared where the template is written: one
      // `DISubprogram` per specialisation, all of them pointing at the one
      // source line a reader would call the declaration (WP22, `declSite`).
      declSite: template.declSite,
      body: template.body,
      exported: template.exported,
    };
  }

  /**
   * Pass 3 (WP18): check every instantiation's body, to a fixed point. Each one
   * may request more, and the queue is drained rather than recursed into, so
   * `from` is a chain of requests and not a call stack.
   */
  drainInstantiations(): boolean {
    this.finishPendingStructs();
    // WP18 G7: whether this module had work, so `Compilation.check` knows to go
    // round again. An instantiation is owned by the module that declares its
    // template, so one module's body can queue work in another's queue.
    const did = this.pending.length > 0;
    while (this.pending.length > 0) {
      // biome-ignore lint/style/noNonNullAssertion: the loop guard is the length check
      const instance = this.pending.shift()!;
      // Appended here rather than at the request, so that `functions` is in
      // the order the bodies are checked and the emitter walks it the same way.
      // A method of an instantiated class is the exception: `collectStructMembers`
      // appended it where a declared class's method is appended, which is what
      // keeps an instantiated class's functions together and in member order.
      if (!instance.owner) this.program.functions.push(instance.sig);
      if (!this.sink.recover(() => this.checkInstanceBody(instance))) instance.sig.poisoned = true;
      this.finishPendingStructs();
    }
    return did;
  }

  /**
   * The `implements` and definite-assignment checks owed by struct
   * instantiations, run once every struct in the module has its members.
   *
   * They cannot run at the request, because an annotation that names
   * `Box<i32>` may be resolved before the interface `Box` implements has been
   * collected — the same reason a *declared* struct's two checks are a
   * sub-pass of their own rather than the tail of `collectStructMembers`.
   */
  private finishPendingStructs(): void {
    while (this.pendingFinish.length > 0) {
      const info = this.pendingFinish.shift()!;
      if (info.poisoned) continue;
      if (!this.sink.recover(() => finishStruct(this, info))) info.poisoned = true;
    }
  }

  /**
   * WP18 G5: one generic class or interface declaration. It shares the single
   * declaration namespace with everything else, and like a function template it
   * never becomes a layout: `Box` has no fields until an instantiation binds
   * its parameters, so it is not in `program.structs` and `Box` on its own is
   * not a type.
   */
  private registerStructTemplate(template: StructTemplateInfo): void {
    const name = template.sourceName;
    if (this.program.structs.has(name) || this.structTemplates.has(name)) {
      this.error(`Duplicate declaration of \`${name}\``, template.nameNode);
    }
    if (this.sigs.has(name) || this.templates.has(name)) {
      this.error(`\`${name}\` is already declared as a function`, template.nameNode);
    }
    if (this.program.aliases.has(name) || this.program.enums.has(name) || this.program.constants.has(name)) {
      this.error(`\`${name}\` is already declared in this module`, template.nameNode);
    }
    this.structTemplates.set(name, template);
    this.program.structTemplates.set(name, template);
  }

  /** The instantiation a mangled struct name belongs to; `undefined` for a declared struct. */
  structInstance(name: string): StructInstantiation | undefined {
    return this.program.structInstantiations.get(name);
  }

  /**
   * `Box<i32>` in an annotation. The arguments are resolved in the scope the
   * annotation sits in, so `Box<T>` inside another template resolves `T`
   * through `typeBindings` and `Box<Box<i32>>` nests without a special case.
   */
  private instantiateStructNode(template: StructTemplateInfo, ref?: ts.TypeReferenceNode): StaticType {
    return instantiateWritten(this, template, ref?.typeArguments ?? [], ref ?? template.nameNode).type;
  }

  /**
   * WP18 G5: the struct instantiation request. Answers the ordinary
   * `StructInfo` one (template, type-argument tuple) names, creating it the
   * first time it is asked for — and collecting its members immediately rather
   * than queueing them, because the answer is a *type*, and a type has to have
   * a layout the moment an annotation resolves to it.
   *
   * What is queued instead is each method's and the constructor's *body*, on
   * the same worklist a generic function's body goes on. That is the whole of
   * why an instantiated class costs so little: `info` is an ordinary struct
   * (§3c), its members are ordinary signatures, and the only new thing about
   * them is the side-table overlay every specialised body already needed.
   */
  instantiateStruct(template: StructTemplateInfo, args: StaticType[], at: ts.Node): StructInfo {
    const name = instanceSymbol(template.sourceName, args);
    const existing = this.program.structInstantiations.get(name);
    if (existing) return existing.info;

    // Termination, the struct half (§4). A field whose type puts one of the
    // struct's own type arguments under a constructor starts a chain with no
    // end, and it is refused by name rather than by a depth count.
    const growing = expandingStructAncestor(this.currentStructInstance, template, args, (n) =>
      this.structInstance(n)
    );
    if (growing) {
      // Written out here rather than returned from a helper, for the reason the
      // function half's is: the code generator reads the string literal at the
      // diagnostic call, so a sentence assembled behind a function call carries
      // NL0000 however many words of its own it has.
      const parts = nonTerminatingStructParts(template, growing.ancestor, args, growing.index);
      this.error(
        `Monomorphising \`${template.sourceName}\` would not terminate: \`${parts.from}\` names \`${parts.to}\`, which puts \`${parts.under}\` under a type constructor instead of passing it on, so the chain has no end; name \`${parts.param}\` itself, or a type that does not mention it`,
        at
      );
    }
    if (template.count >= MAX_INSTANTIATIONS_PER_TEMPLATE) {
      this.error(
        `\`${template.sourceName}\` has been instantiated ${MAX_INSTANTIATIONS_PER_TEMPLATE} times, which is ` +
          "this compiler's limit rather than a rule of the language",
        at
      );
    }
    if (this.program.instantiations.size + this.program.structInstantiations.size >= MAX_INSTANTIATIONS) {
      this.error(
        `This module has reached ${MAX_INSTANTIATIONS} generic instantiations, which is this compiler's limit ` +
          "rather than a rule of the language",
        at
      );
    }

    const bindings = new Map<string, StaticType>();
    template.typeParams.forEach((param, i) => {
      bindings.set(param, args[i]);
    });
    const info: StructInfo = {
      name,
      kind: template.kind,
      type: { kind: "struct", name },
      fields: [],
      fieldsByName: new Map(),
      size: 0,
      align: 1,
      methods: new Map(),
      implements: [],
      decl: template.decl,
      exported: template.exported,
    };
    const instance: StructInstantiation = {
      template,
      typeArgs: args,
      info,
      bindings,
      from: this.currentStructInstance,
    };
    template.count += 1;
    // Registered before the members are collected, so a field that mentions the
    // struct's own instantiation (`next: Node<i32> | null`) finds it rather
    // than asking for it a second time.
    this.program.structs.set(name, info);
    this.program.structInstantiations.set(name, instance);
    this.collectInstanceMembers(instance);
    return info;
  }

  /**
   * The fields, layout and member signatures of one instantiated struct, with
   * its type parameters bound — and one queued body per method and
   * constructor, each with side tables of its own.
   */
  private collectInstanceMembers(instance: StructInstantiation): void {
    const savedBindings = this.typeBindings;
    const savedStruct = this.currentStructInstance;
    const savedInstance = this.currentInstance;
    this.typeBindings = instance.bindings;
    this.currentStructInstance = instance;
    // A request made while collecting these members belongs to *this* struct's
    // chain, not to whichever function body happened to name it first.
    this.currentInstance = undefined;
    const before = this.program.functions.length;
    try {
      if (!this.sink.recover(() => collectStructMembers(this, instance.info))) instance.info.poisoned = true;
    } finally {
      this.currentInstance = savedInstance;
      this.currentStructInstance = savedStruct;
      this.typeBindings = savedBindings;
    }
    const prefix = this.program.symbolPrefix;
    for (let i = before; i < this.program.functions.length; i++) {
      const sig = this.program.functions[i];
      // A nested instantiation's member: `collectStructMembers` above resolved a
      // field that asked for another struct, and that struct's own call here has
      // already qualified and queued its members.
      if (sig.instance) continue;
      // WP21 S1: an instantiation's symbol is complete from the moment it is
      // minted, because `qualifySymbols` runs once at the end of pass 1 and an
      // instantiation may be created on either side of it.
      // TODO(WP18 G7): the prefix must become the *template's* rather than this
      // module's once a generic may be instantiated from another module; the
      // two are the same one only because importing a template is refused.
      sig.name = prefix + sig.name;
      const member: Instantiation = {
        owner: instance,
        typeArgs: instance.typeArgs,
        sig,
        bindings: instance.bindings,
        tables: newNodeTables(),
        from: savedInstance,
      };
      sig.instance = member;
      this.pending.push(member);
    }
    this.pendingFinish.push(instance.info);
  }

  /** One instantiation's body, over its own side tables and with its own type bindings. */
  private checkInstanceBody(instance: Instantiation): void {
    const savedTables = swapTables(this.program, instance.tables);
    const savedBindings = this.typeBindings;
    const savedInstance = this.currentInstance;
    const savedStruct = this.currentStructInstance;
    this.typeBindings = instance.bindings;
    this.currentInstance = instance;
    // A method of an instantiated class continues its class's chain: a body
    // that names `Box<T[]>` expands exactly as a field of that type would.
    this.currentStructInstance = instance.owner;
    try {
      this.checkFunctionBody(instance.sig);
    } finally {
      this.currentStructInstance = savedStruct;
      this.currentInstance = savedInstance;
      this.typeBindings = savedBindings;
      swapTables(this.program, savedTables);
    }
  }

  /** Pass 1b: bind every import to the exporter's function signature or struct. */
  bindImports(resolve: ImportResolver): void {
    for (const imp of this.program.imports)
      this.sink.recover(() =>
        // A `nish:` import names a builtin, so it never reaches the resolver:
        // there is no module to load, which is also what lets a single-module
        // check use one without a Compilation around it.
        isNishSpecifier(imp.specifier) ? this.bindBuiltinImport(imp) : this.bindImport(imp, resolve(imp))
      );
  }

  /**
   * `import { readFileSync } from "nish:fs"`, `import { exit } from
   * "nish:process"`: bind a local name to a builtin the checker already has.
   *
   * Nothing is emitted for one of these. The binding exists so that the call
   * and identifier checkers can prefer it over the ambient global table, which
   * is the whole point of the feature: an imported name cannot be taken over
   * by a user function that happens to share it, because declaring one is a
   * collision here rather than a silent shadow.
   */
  private bindBuiltinImport(imp: ImportBinding): void {
    const module = nishModule(imp.specifier);
    if (!module) {
      this.error(
        `Unknown builtin module \`${imp.specifier}\` (the builtin modules are ${nishModuleNames().join(", ")})`,
        imp.node.moduleSpecifier
      );
    }
    const exported = lookup(module, imp.importedName);
    if (!exported) {
      this.error(
        `Module \`${imp.specifier}\` has no export \`${imp.importedName}\` (it exports ${Object.keys(module).join(", ")})`,
        imp.element
      );
    }
    if (this.importsUsedAsTypes.has(imp.localName)) {
      this.error(`\`${imp.localName}\` is a builtin imported from \`${imp.specifier}\`, not a type`, imp.element);
    }
    if (this.sigs.has(imp.localName) || this.program.constants.has(imp.localName)) {
      this.error(`\`${imp.localName}\` is already declared in this module`, imp.element);
    }
    const origin = this.program.imports.find((o) => o !== imp && o.localName === imp.localName && o.builtin);
    if (origin) {
      this.error(`\`${imp.localName}\` is already imported from \`${origin.specifier}\``, imp.element);
    }
    imp.builtin = exported;
    this.program.builtinImports.set(imp.localName, exported);
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
    const structTemplate = target.structTemplates.get(imp.importedName);
    if (structTemplate) {
      // WP18 §11 G7, the same rule one level up: an instantiation is defined in
      // the module that declares its template, and that half has not landed.
      // Refusing by name beats "has no exported function".
      this.error(
        `\`${imp.importedName}\` in \`${imp.specifier}\` is a generic ${structTemplate.kind}, and a generic ` +
          "class or interface cannot yet be instantiated from another module; declare it in the module that uses it",
        imp.element
      );
    }
    const template = target.templates.get(imp.importedName);
    if (template) {
      this.bindTemplateImport(imp, template);
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
   * WP18 G7: an imported generic function. The template joins this module's
   * template table so a call resolves it, and nothing else moves: the
   * instantiation it asks for is created, checked, counted and emitted by the
   * module that *declares* it (§3b), so this module only ever gets a `declare`.
   *
   * A template is renameable on import where a class is not, because unlike
   * `%struct.<name>` nothing about the local spelling reaches the symbol: the
   * instantiation is named from `template.sourceName` in the declaring module.
   */
  private bindTemplateImport(imp: ImportBinding, template: TemplateInfo): void {
    if (!template.exported) {
      this.error(
        `\`${imp.importedName}\` is declared in \`${imp.specifier}\` but not exported (add \`export\`)`,
        imp.element
      );
    }
    if (this.importsUsedAsTypes.has(imp.localName)) {
      this.error(`\`${imp.localName}\` is a function imported from \`${imp.specifier}\`, not a type`, imp.element);
    }
    if (this.sigs.has(imp.localName) || this.templates.has(imp.localName)) {
      const origin = this.program.imports.find(
        (o) => o !== imp && o.localName === imp.localName && (o.sig !== undefined || o.template !== undefined)
      );
      this.error(
        origin
          ? `\`${imp.localName}\` is already imported from \`${origin.specifier}\``
          : `\`${imp.localName}\` is already declared in this module`,
        imp.element
      );
    }
    imp.template = template;
    this.templates.set(imp.localName, template);
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
      // WP27 S1: a `declare function` has no body, so pass 2 has nothing to do
      // for it. Its signature was fully checked in pass 1.
      if (sig.foreign) continue;
      // WP18 G5: a method of an instantiated class is already in this list —
      // `collectStructMembers` put it where a declared class's method goes —
      // but its body means something only with its own tables and type
      // bindings installed, so `drainInstantiations` is what checks it.
      if (sig.instance) continue;
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

  checkFunctionBody(sig: FunctionSig): void {
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
    if (sig.body === undefined) return; // WP27 S1: foreign, filtered by the caller.
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
      // WP15 §2.1/§2.2: prove what indices are in range before the warnings
      // are reported, because one of the warnings is about the proofs that did
      // not come off, and it has to be reported by the same source-order walk
      // as the rest of the class.
      const unprovenIndices = analyzeBounds(this, sig);
      // WP15 §8: the performance warnings, over the same body and the same
      // side tables. Only for a body that checked cleanly — advice about code
      // that does not compile is noise, and a poisoned body has incomplete
      // side tables anyway.
      checkPerformance(this, sig, unprovenIndices);
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
