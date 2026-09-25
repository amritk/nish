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

import { aliasType, builtinTypeName, rejectRangedIntegerName, resolveType } from "./annotations";
import { checkElementReferences } from "./arrays";
import { checkExpression } from "./expressions";
import { checkDefiniteAssignment } from "./assignment";
import { enumMemberValue, foldConstant, parseIntegerLiteral } from "./constants";
import { CheckContext } from "./context";
import { isNishModule, isNishSpecifier, nishExport, nishModuleExports, nishModuleNames } from "./nish_modules";
import { DiagnosticSink, SourceFile } from "./diagnostics";
import { collectFunctionSignature, collectImports, isExported, markEntryMain } from "./declarations";
import {
  checkDeferredConstraints,
  collectStructTypeParamNames,
  collectTypeParamNames,
  declareMethodTypeParameters,
  instantiateStruct,
  isGenericStruct,
  isTemplateFunction,
  refuseNestedFunctionTypes,
  parameterOrigin,
  refuseUninferable,
  rejectDollarInSymbolName,
  resolveStructTemplateConstraints,
  resolveTemplateConstraints,
} from "./generics";
import {
  FLAG_CONST,
  FLAG_FOREIGN,
  FLAG_PREFIX,
  N_ARROW,
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
  N_ARRAY,
  N_CALL,
  N_NEW,
  N_NUMBER,
  N_OBJECT,
  N_PAREN,
  N_PROPERTY,
  N_RETURN,
  N_TEMPLATE,
  N_TEMPLATE_TEXT,
  N_ENUM,
  N_TYPE_ALIAS,
  N_TYPE_REF,
  N_UNARY,
  N_VAR_DECL,
  N_WHILE,
  Node,
} from "./nodes";
import { StringSet } from "./map";
import { COLLECTIONS_SPECIFIER } from "./std_modules";
import {
  AliasInfo,
  CheckedProgram,
  ConstInfo,
  DeferredInstance,
  EnumInfo,
  FunctionSig,
  ImportBinding,
  Instantiation,
  TemplateInfo,
  STRUCT_CLASS,
  STRUCT_INTERFACE,
  StructInfo,
  StructRegistry,
  StructTemplateInfo,
} from "./program";
import { analyzeBounds } from "./bounds";
import { checkResultLocalsHandled } from "./result";
import { checkReturnValue, checkStatements } from "./statements";
import { Local, STORAGE_PARAM, Scope } from "./symbols";
import {
  checkImplements,
  collectStructMembers,
  declareStruct,
  referencedStructNames,
  signatureStructNames,
} from "./structs";
import { T_BOOL, T_ERROR, T_F64, T_I32, T_I64, T_STRING, T_VOID, TypeTable, intBits } from "./types";

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
    wrapping: boolean,
    uncheckedIndexing: boolean,
    strictExports: boolean,
    packageName: string
  ) {
    this.program = new CheckedProgram(source, file, isEntry, nodeCount, packageName);
    this.ctx = new CheckContext(
      table,
      this.program,
      sink,
      numberMode,
      wrapping,
      uncheckedIndexing,
      strictExports
    );
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
      } else if (stmt.kind === N_CLASS || stmt.kind === N_INTERFACE) {
        // WP18 G5: a class or interface with type parameters is a template, not
        // a struct. It declares no layout, so it is registered beside the
        // function templates and the member loop below skips it: its members
        // are collected once per instantiation instead.
        const kind = stmt.kind === N_CLASS ? STRUCT_CLASS : STRUCT_INTERFACE;
        const what = kind === STRUCT_CLASS ? "class" : "interface";
        // Nothing is declared for a refused `integer`: the name is refused as a
        // type wherever it is written, whatever the module declares.
        if (rejectRangedIntegerName(this.ctx, stmt.children[0], what)) {
          continue;
        }
        if (isGenericStruct(stmt)) {
          this.ctx.errored = false;
          this.registerStructTemplate(stmt, kind);
        } else {
          // A `class Box$i32` would be one struct type with the instantiation
          // `Box<i32>` wherever either is declared (#193), so the rule a
          // template's name is held to holds here too. The struct is declared
          // all the same, so that an annotation naming it does not add a
          // second diagnostic to the first.
          rejectDollarInSymbolName(this.ctx, stmt.children[0].text, what, stmt.children[0]);
          const info = declareStruct(this.ctx, stmt, kind);
          if (info !== null) {
            declared.push(info);
          }
        }
      } else if (stmt.kind === N_TYPE_ALIAS) {
        // Names first, resolution last: an alias may name a class declared
        // further down the file, or another alias.
        this.declareAlias(stmt);
      } else if (stmt.kind === N_ENUM) {
        // An enum is complete the moment it is read — its members are
        // literals, not a right-hand side that can name something later — so
        // unlike an alias there is no second pass for it (WP23).
        this.ctx.errored = false;
        this.declareEnum(stmt);
      }
    }
    // WP32: the global `Map` and `Set`, bound before any annotation is resolved.
    this.importCollections();

    for (const stmt of this.program.file.children) {
      // Per declaration: stage0 wraps each of these in `sink.recover`, so one
      // rejected class or constant costs its own diagnostic and no more
      // (`collectSignatures` in `src/checker/index.ts`).
      this.ctx.errored = false;
      if (stmt.kind === N_CLASS || stmt.kind === N_INTERFACE) {
        const info = this.program.struct(stmt.children[0].text);
        if (info !== null && info.decl === stmt) {
          collectStructMembers(this.ctx, info);
        }
        // WP18 G6: a generic one's constraints, for the reason
        // `registerTemplate` resolves a function's. In this loop rather than
        // at registration because a constraint may name a class declared
        // further down, which the loop above has declared by now.
        const template = this.program.structTemplate(stmt.children[0].text);
        if (template !== null && template.decl === stmt) {
          resolveStructTemplateConstraints(template);
        }
        // WP18 G8: the rules about a generic method that are its declaration's,
        // once per class, for the reason the constraints above are resolved
        // here: a generic class's members are collected once per instantiation.
        declareMethodTypeParameters(this.ctx, stmt);
      } else if (stmt.kind === N_MODULE_CONST) {
        this.collectConstants(stmt);
      } else if (stmt.kind === N_FUNCTION) {
        this.collectFunction(stmt);
      }
    }
    this.ctx.errored = false;

    // The checks that need every layout: `implements` compares field lists,
    // and definite assignment needs the fields.
    for (const info of declared) {
      this.ctx.errored = false;
      if (info.kind === STRUCT_CLASS) {
        checkImplements(this.ctx, info);
        checkDefiniteAssignment(this.ctx, info);
      }
    }
    // Every instantiation an annotation in this module's signatures asked for
    // now has its members, and so does every struct declared here, so the two
    // checks that need both can run (WP18 G5).
    this.finishPendingStructs();

    // Last, exactly where stage0 puts it, so two compilers report one file's
    // diagnostics in one order: every alias is resolved even when nothing
    // names it, so a broken right-hand side and a cycle are reported where
    // they are written rather than at the first use -- or never.
    for (const alias of this.program.aliasList) {
      this.ctx.errored = false;
      aliasType(alias, this.ctx);
    }
    this.ctx.errored = false;
    this.qualifySymbols();
  }

  /**
   * WP32: the implicit `import { Map, Set } from "nish/collections"`
   * (docs/wp32-map.md §4.2).
   *
   * A module that names the global `Map` or `Set` — in a type or after `new` —
   * is given a binding for it, synthesised here exactly as `collectImports`
   * would have written it, so everything after this is the ordinary imported
   * generic class (`bindStructTemplateImport`). A module that declares or
   * imports a `Map` or `Set` of its own keeps its own, as it would under `tsc`,
   * and one that names neither loads nothing, so every program that compiled
   * before this compiles to the same bytes.
   */
  importCollections(): void {
    if (this.program.isCollections()) {
      return;
    }
    const names = new CollectionNames();
    scanCollectionNames(this.program.file, names, this.program);
    this.importCollection("Map", names.map);
    this.importCollection("Set", names.set);
  }

  importCollection(name: string, at: Node | null): void {
    if (at === null || this.nameTaken(name)) {
      return;
    }
    for (const imp of this.program.imports) {
      if (imp.localName === name) {
        return;
      }
    }
    this.program.imports.push(new ImportBinding(COLLECTIONS_SPECIFIER, name, name, at, at));
    this.program.typeNames.add(name);
  }

  /**
   * WP21 S1: put every symbol this module declares inside its package.
   *
   * One place, and after every signature exists, so a free function, a method
   * (`Owner.method`) and a constructor are scoped by the same line of code and
   * nothing added later can forget to be. The root package's prefix is empty,
   * which is why a single-package program — every program that could be
   * compiled before this existed — emits exactly the symbols it always did.
   *
   * `main` needs no exception: only the entry module may declare it, and the
   * entry module is the root package by construction (`Compilation` derives
   * every other module's package by comparing it with the entry's own).
   */
  qualifySymbols(): void {
    const prefix = this.program.symbolPrefix;
    if (prefix.length === 0) {
      return;
    }
    for (const sig of this.program.functions) {
      // Pass 1b appends an imported signature to the importer's `functions`
      // (`self/program.ts`), where stage0 leaves that list holding only what
      // the module declares. It has not run yet, but qualifying an imported
      // symbol would rename the *exporter's* function, so say so rather than
      // depend on the order.
      // WP18: an instantiation's symbol carries the prefix from the moment it is
      // minted, because it may be created on either side of this pass — a
      // signature annotation that names `Box<i32>` runs before it, and a
      // `new Box<i32>(v)` in a body runs long after. Qualifying it again would
      // spell the package twice.
      if (sig.instance === null && sig.definedIn(this.program.source)) {
        sig.name = `${prefix}${sig.name}`;
      }
    }
  }

  /**
   * One `type X = T;`. The name goes in now and the right-hand side is
   * resolved later; the language shares one declaration namespace, so a clash
   * with a function, class, interface or constant reads the same way whichever
   * came first.
   */
  declareAlias(stmt: Node): void {
    const nameNode = stmt.children[0];
    const name = nameNode.text;
    if (builtinTypeName(name)) {
      this.ctx.error(nameNode, `\`${name}\` is a built-in type name and cannot be used for a type alias`);
      return;
    }
    if (isExported(stmt)) {
      this.ctx.error(
        stmt,
        "Type aliases cannot be exported: an alias names a type inside one module (declare it in every module that needs it)"
      );
      return;
    }
    if (this.nameTaken(name)) {
      this.ctx.error(nameNode, `\`${name}\` is already declared in this module`);
      return;
    }
    this.program.addAlias(new AliasInfo(name, stmt, this.program.source));
  }

  /**
   * Whether a top-level declaration has already claimed `name` in this module.
   * A generic template counts (WP18): it is a `function` however it is spelled,
   * and it shares the one declaration namespace with everything else, so an
   * `enum` and a `function f<T>()` of the same name clash whichever was written
   * first. Listing every kind in one test is what keeps that symmetric.
   */
  nameTaken(name: string): boolean {
    return (
      this.program.aliases.has(name) ||
      this.program.enums.has(name) ||
      this.program.structs.has(name) ||
      this.program.structTemplates.has(name) ||
      this.program.templates.has(name) ||
      this.ctx.sigs.has(name) ||
      this.program.constants.has(name)
    );
  }

  /**
   * One `enum X { A = 1, B }` (WP23). A distinct type with `i32`
   * representation, complete the moment it is read: the members are literals,
   * so they are folded here and `Kind.If` lowers to its integer with no symbol
   * and no table. Phase 0 owns the shape of an initialiser — anything that is
   * not a numeric literal is refused there — and what is left is what needs
   * the type model: an integer, in range, under a name nothing else has taken.
   */
  declareEnum(stmt: Node): void {
    const nameNode = stmt.children[0];
    const name = nameNode.text;
    if (builtinTypeName(name)) {
      this.ctx.error(nameNode, `\`${name}\` is a built-in type name and cannot be used for an enum`);
      return;
    }
    if (isExported(stmt)) {
      this.ctx.error(
        stmt,
        "Enums cannot be exported: an enum names a type inside one module (declare it in every module that needs it)"
      );
      return;
    }
    if ((stmt.flags & FLAG_CONST) !== 0) {
      this.ctx.error(
        stmt,
        "`const enum` is not supported: an enum member is already folded to its integer, so `const` would ask for nothing"
      );
      return;
    }
    const members = stmt.children[1];
    if (members.children.length === 0) {
      this.ctx.error(nameNode, `Enum \`${name}\` must declare at least one member`);
      return;
    }
    const info = new EnumInfo(name, stmt, this.program.source, this.ctx.table.enumOf(name));
    let next = toI64(0);
    for (const member of members.children) {
      const memberName = member.children[0].text;
      if (info.hasMember(memberName)) {
        this.ctx.error(member.children[0], `Duplicate member \`${memberName}\` in enum \`${name}\``);
        return;
      }
      let value = next;
      const initializer = member.children[1];
      if (initializer.kind !== N_EMPTY) {
        const literal = enumMemberValue(initializer);
        if (!literal.known) {
          this.ctx.error(initializer, `Enum member \`${name}.${memberName}\` must be an integer literal`);
          return;
        }
        value = literal.value;
      }
      if (value < I32_MIN || value > I32_MAX) {
        this.ctx.error(member, `Enum member \`${name}.${memberName}\` does not fit in i32`);
        return;
      }
      info.addMember(memberName, toI32(value));
      next = value + toI64(1);
    }
    if (this.nameTaken(name)) {
      this.ctx.error(nameNode, `\`${name}\` is already declared in this module`);
      return;
    }
    this.program.addEnum(info);
  }

  /** One `function` declaration: its signature, its name, and `main`. */
  collectFunction(stmt: Node): void {
    if (rejectRangedIntegerName(this.ctx, stmt.children[0], "function")) {
      return;
    }
    // WP29: a function with a function-typed parameter is a template too,
    // with or without type parameters, because each callee it is given names
    // a different function.
    if (isTemplateFunction(stmt)) {
      this.registerTemplate(stmt);
      return;
    }
    const sig = collectFunctionSignature(this.ctx, stmt);
    const name = sig.sourceName;
    if (rejectDollarInSymbolName(this.ctx, name, "function", stmt.children[0])) {
      return;
    }
    // Three messages rather than one, because stage0 has three here and a
    // clash is the one thing a reader looks up by its words. A second function
    // of the same name is a duplicate; a name a class or interface already has
    // says so; everything else in the one declaration namespace -- an alias, an
    // enum, a module constant -- reads the way every other clash reads. The
    // order is stage0's `registerFunction`, and so is the node each is
    // reported at: this one at the statement, the two below at the name.
    if (this.ctx.sigs.has(name) || this.program.templates.has(name)) {
      this.ctx.error(stmt, `Duplicate function \`${name}\``);
      return;
    }
    if (this.program.structs.has(name)) {
      this.ctx.error(stmt.children[0], `\`${name}\` is already declared as a class or interface`);
      return;
    }
    if (this.nameTaken(name)) {
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
   * WP18: one generic function declaration. A template shares the declaration
   * namespace with everything else — it is a `function` however it is spelled —
   * but it is not a signature: it has no types until an instantiation binds its
   * parameters, so it never joins `sigs` or `program.functions`.
   */
  registerTemplate(stmt: Node): void {
    const nameNode = stmt.children[0];
    const name = nameNode.text;
    // A generic `declare function` arrives here rather than at
    // `collectFunctionSignature`, because a function with type parameters is a
    // template before it is anything else. Stage0 refuses it in
    // `collectFunctionTemplate` with these words, so stage1 does too (WP27 S1).
    if ((stmt.flags & FLAG_FOREIGN) !== 0) {
      this.ctx.error(
        stmt,
        "`declare function` cannot be generic: a C symbol is one function, not a template to instantiate"
      );
      return;
    }
    // The order is stage0's: the name's own rules before the ones about what
    // else is declared, because that is the order `collectFunctionTemplate`
    // and `registerTemplate` run in over there.
    if (name.startsWith("nish_")) {
      this.ctx.error(nameNode, "Function names starting with `nish_` are reserved for the runtime");
      return;
    }
    if (rejectDollarInSymbolName(this.ctx, name, "function", nameNode)) {
      return;
    }
    if (this.nameTaken(name)) {
      this.ctx.error(nameNode, `\`${name}\` is already declared in this module`);
      return;
    }
    const template = new TemplateInfo(name, stmt, this.program.source, this.ctx);
    template.exported = isExported(stmt);
    template.typeParams = collectTypeParamNames(stmt);
    if (template.exported && name === "main") {
      this.ctx.error(
        nameNode,
        "`main` cannot be generic: the entry point is called by the C runtime, which has no type arguments to give it"
      );
      return;
    }
    if (refuseUninferable(this.ctx, stmt, template.typeParams, name)) {
      return;
    }
    if (refuseNestedFunctionTypes(this.ctx, stmt)) {
      return;
    }
    this.program.addTemplate(template);
    // WP18 G6: here, once, so a constraint that names nothing a constraint may
    // name is reported against the declaration even when nothing calls it.
    resolveTemplateConstraints(template);
  }

  /**
   * WP18 G5: one generic class or interface declaration. It shares the single
   * declaration namespace with everything else, and like a function template it
   * never becomes a layout: `Box` has no fields until an instantiation binds its
   * parameters, so it is not in `structs` and `Box` on its own is not a type.
   */
  registerStructTemplate(stmt: Node, kind: i32): void {
    const nameNode = stmt.children[0];
    const name = nameNode.text;
    const what = kind === STRUCT_CLASS ? "class" : "interface";
    if (name.length === 0) {
      this.ctx.error(stmt, kind === STRUCT_CLASS ? "Classes must be named" : "Interfaces must be named");
      return;
    }
    if (name.startsWith("nish_")) {
      this.ctx.error(nameNode, "Names starting with `nish_` are reserved for the runtime");
      return;
    }
    if (rejectDollarInSymbolName(this.ctx, name, what, nameNode)) {
      return;
    }
    if (this.program.structs.has(name) || this.program.structTemplates.has(name)) {
      this.ctx.error(nameNode, `Duplicate declaration of \`${name}\``);
      return;
    }
    if (this.ctx.sigs.has(name) || this.program.templates.has(name)) {
      this.ctx.error(nameNode, `\`${name}\` is already declared as a function`);
      return;
    }
    if (this.nameTaken(name)) {
      this.ctx.error(nameNode, `\`${name}\` is already declared in this module`);
      return;
    }
    const template = new StructTemplateInfo(name, kind, stmt, this.program.source, this.ctx);
    template.exported = isExported(stmt);
    template.typeParams = collectStructTypeParamNames(stmt);
    this.program.addStructTemplate(template);
  }

  /**
   * Pass 3 (WP18): check every instantiation's body, to a fixed point. Each one
   * may request more, and the queue is drained rather than recursed into, so
   * `from` is a chain of requests and not a call stack.
   */
  drainInstantiations(): boolean {
    const worked = this.ctx.pending.length > 0 || this.ctx.pendingFinish.length > 0;
    this.finishPendingStructs();
    let at = 0;
    while (at < this.ctx.pending.length) {
      const info = this.ctx.pending[at];
      at = at + 1;
      // Appended here rather than at the request, so that `functions` is in the
      // order the bodies are checked and the emitter walks it the same way. A
      // method of an instantiated class is the exception: `collectStructMembers`
      // appended it where a declared class's method is appended, which keeps an
      // instantiated class's functions together and in member order. An
      // instantiation of a generic method (WP18 G8) is a request, not a member
      // collected with its class, so it has a template and is appended here
      // like a function's.
      if (info.template !== null) {
        this.program.functions.push(info.sig);
      }
      this.checkInstanceBody(info);
      this.finishPendingStructs();
    }
    this.ctx.pending = [];
    return worked;
  }

  /**
   * The `implements` and definite-assignment checks owed by struct
   * instantiations, run once every struct in the module has its members.
   *
   * They cannot run at the request, because an annotation that names `Box<i32>`
   * may be resolved before the interface `Box` implements has been collected —
   * the same reason a *declared* struct's two checks are a sub-pass of their
   * own rather than the tail of `collectStructMembers`.
   */
  finishPendingStructs(): void {
    let at = 0;
    while (at < this.ctx.pendingFinish.length) {
      const info = this.ctx.pendingFinish[at];
      at = at + 1;
      this.ctx.errored = false;
      if (info.kind === STRUCT_CLASS && !info.poisoned) {
        checkImplements(this.ctx, info);
        checkDefiniteAssignment(this.ctx, info);
      }
    }
    this.ctx.pendingFinish = [];
    this.ctx.errored = false;
  }

  /** One instantiation's body, over its own side tables and with its own type bindings. */
  checkInstanceBody(info: Instantiation): void {
    const savedBindings = this.ctx.typeBindings;
    const savedInstance = this.ctx.currentInstance;
    const savedStruct = this.ctx.currentStructInstance;
    this.program.enterInstance(info);
    const savedFunctions = this.ctx.functionBindings;
    this.ctx.typeBindings = info.bindings;
    this.ctx.functionBindings = info.functionBindings;
    this.ctx.currentInstance = info;
    // A method of an instantiated class continues its class's chain: a body
    // that names `Box<T[]>` expands exactly as a field of that type would.
    this.ctx.currentStructInstance = info.owner;
    this.checkFunctionBody(info.sig);
    this.ctx.currentStructInstance = savedStruct;
    this.ctx.currentInstance = savedInstance;
    this.ctx.typeBindings = savedBindings;
    this.ctx.functionBindings = savedFunctions;
    this.program.leaveInstance();
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
      if (this.nameTaken(name)) {
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
      // WP18 G5: a method of an instantiated class is already in this list —
      // `collectStructMembers` put it where a declared class's method goes —
      // but its body means something only with its own tables and type bindings
      // installed, so `drainInstantiations` is what checks it.
      // WP29: a lifted arrow was checked where it was written, inside the body
      // of the function this loop is on when it is appended.
      if (sig.instance === null && !sig.lifted && sig.definedIn(this.program.source)) {
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
      // WP29: a compile-time function parameter is no local at all. The body
      // reaches it through `ctx.functionBindings`, and only by calling it or
      // passing it on, so there is nothing for a scope to hold.
      if (sig.isCompileTime(i)) {
        i = i + 1;
        continue;
      }
      // A parameter is an SSA value, so it is immutable, and `this` is one
      // too — which is what makes `this = x` a parameter assignment error.
      const local = new Local(sig.paramNames[i], sig.paramTypes[i], false, STORAGE_PARAM);
      local.origin = parameterOrigin(this.ctx, sig, i);
      if (!scope.declare(local)) {
        this.ctx.error(sig.decl, `Duplicate parameter \`${sig.paramNames[i]}\``);
      }
      i = i + 1;
    }
    checkSignatureBody(this.ctx, sig, scope, false);
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
        // Per constant, as `sink.recover(() => constValue(info))` makes it in
        // stage0: a cycle is reported once for each constant in it, not once
        // for the program (`tests/cases/reject_const_cycle`).
        this.ctx.errored = false;
        foldConstant(this.ctx, info);
      }
    }
    this.ctx.errored = false;
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
      // A self-referential field (`parent: Node | null`) puts the struct's own name in
      // here; `reach` ignores it, since nothing reaches `pending` unless marked seen.
      // @ts-expect-error `pop` is `T` in Nish and `T | undefined` in lib.es5 (runtime/nish.d.ts).
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

  /**
   * `import { readFileSync } from "nish:fs"`: bind a local name to a builtin
   * the checker already has.
   *
   * Nothing is emitted for one of these. The binding exists so the call and
   * identifier checkers can prefer it over the ambient builtin tables, which is
   * the point of the feature: an imported name cannot be taken over by a user
   * function that happens to share it, because declaring one is a collision
   * here rather than a silent shadow.
   */
  bindBuiltinImport(index: i32): void {
    const imp = this.program.imports[index];
    if (!isNishModule(imp.specifier)) {
      this.ctx.errorAtSpecifier(
        imp.decl,
        `Unknown builtin module \`${imp.specifier}\` (the builtin modules are ${nishModuleNames()})`
      );
      return;
    }
    const exported = nishExport(imp.specifier, imp.importedName);
    if (exported === null) {
      this.ctx.error(
        imp.node,
        `Module \`${imp.specifier}\` has no export \`${imp.importedName}\` (it exports ${nishModuleExports(imp.specifier)})`
      );
      return;
    }
    if (this.program.importsUsedAsTypes.has(imp.localName)) {
      this.ctx.error(
        imp.node,
        `\`${imp.localName}\` is a builtin imported from \`${imp.specifier}\`, not a type`
      );
    }
    if (this.ctx.sigs.get(imp.localName, -1) >= 0 || this.program.constant(imp.localName) !== null) {
      this.ctx.error(imp.node, `\`${imp.localName}\` is already declared in this module`);
      return;
    }
    let origin = "";
    for (const other of this.program.imports) {
      if (other.builtin !== null && other.localName === imp.localName && origin.length === 0) {
        origin = other.specifier;
      }
    }
    if (origin.length > 0) {
      this.ctx.error(imp.node, `\`${imp.localName}\` is already imported from \`${origin}\``);
      return;
    }
    imp.builtin = exported;
    this.program.addBuiltinImport(imp.localName, exported);
  }

  bindImport(index: i32, target: CheckedProgram): void {
    const imp = this.program.imports[index];
    // A `nish:` import names a builtin, so it never looks at `target`: there is
    // no module behind it.
    if (isNishSpecifier(imp.specifier)) {
      this.bindBuiltinImport(index);
      return;
    }
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
    // WP18 G7. `origin` is what tells a declaration from the exporter's own
    // import, exactly as it does for a class above: a template is not
    // re-exported by the module that imported it.
    const structTemplate = target.structTemplate(imp.importedName);
    if (structTemplate !== null && structTemplate.origin === target.source) {
      this.bindStructTemplateImport(index, structTemplate);
      return;
    }
    const template = target.template(imp.importedName);
    if (template !== null && template.origin === target.source) {
      this.bindTemplateImport(index, template);
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
   * WP18 G7: an imported generic function. What is bound is the *template*, and
   * that is the whole difference from every other import.
   *
   * A plain import is one name and one symbol, so it binds a `FunctionSig` and
   * the emitter writes one `declare`. A template is one name and as many symbols
   * as the program has distinct type-argument tuples for it, none of which
   * exists yet: each is minted the first time a call site here picks it, defined
   * by the module that declares the template, and recorded in
   * `externalInstances` so this module declares exactly the ones it calls.
   *
   * The local name may differ from the exported one and the *symbol* does not
   * follow it: `import { identity as id }` still calls `@identity$i32`, because
   * one instantiation is one definition for the whole program and the module
   * that defines it never learns what anyone else called it.
   */
  bindTemplateImport(index: i32, template: TemplateInfo): void {
    const imp = this.program.imports[index];
    if (!template.exported) {
      this.ctx.error(
        imp.node,
        `\`${imp.importedName}\` is declared in \`${imp.specifier}\` but not exported (add \`export\`)`
      );
      return;
    }
    if (this.program.importsUsedAsTypes.has(imp.localName)) {
      this.ctx.error(
        imp.node,
        `\`${imp.localName}\` is a function imported from \`${imp.specifier}\`, not a type`
      );
    }
    if (this.ctx.sigs.has(imp.localName) || this.program.templates.has(imp.localName)) {
      let origin = "";
      for (const other of this.program.imports) {
        const bound = other.template;
        if (other !== imp && other.localName === imp.localName && origin.length === 0 && bound !== null) {
          origin = other.specifier;
        }
      }
      this.ctx.error(
        imp.node,
        origin.length > 0
          ? `\`${imp.localName}\` is already imported from \`${origin}\``
          : `\`${imp.localName}\` is already declared in this module`
      );
      return;
    }
    imp.template = template;
    this.program.addTemplateAs(imp.localName, template);
  }

  /**
   * WP18 G7, one level up: an imported generic class or interface. It joins this
   * module's template table rather than its struct table, because a template has
   * no layout — `Box` is not a type here any more than it is in the module that
   * wrote it, and `Box<i32>` is.
   *
   * Unlike a declared class it *may* be renamed on import. The ABI a declared
   * class pins is its own name; a template has no symbol at all, and the
   * instantiation that does is named after the template's source name wherever
   * the request came from, so `import { Box as B }` and `B<i32>` still name
   * `%struct.Box$i32`.
   */
  bindStructTemplateImport(index: i32, template: StructTemplateInfo): void {
    const imp = this.program.imports[index];
    if (!template.exported) {
      this.ctx.error(
        imp.node,
        `\`${imp.importedName}\` is declared in \`${imp.specifier}\` but not exported (add \`export\`)`
      );
      return;
    }
    // Named with no type arguments somewhere in this module's signatures: the
    // arity rule, said in the words a locally declared template says it in.
    if (this.program.importsUsedAsTypes.has(imp.localName)) {
      let example = "";
      let i = 0;
      while (i < template.typeParams.length) {
        example = i === 0 ? "number" : `${example}, number`;
        i = i + 1;
      }
      this.ctx.error(
        imp.node,
        `\`${template.sourceName}\` is generic: it must be written with its type arguments, e.g. ` +
          `\`${template.sourceName}<${example}>\``
      );
      return;
    }
    if (
      this.ctx.sigs.has(imp.localName) ||
      this.program.structs.has(imp.localName) ||
      this.program.structTemplates.has(imp.localName)
    ) {
      this.ctx.error(imp.node, `\`${imp.localName}\` is already declared in this module`);
      return;
    }
    imp.structTemplate = template;
    this.program.addStructTemplateAs(imp.localName, template);
  }

  /**
   * Pass 1b, after every module has bound its imports: make the requests pass 1
   * could only write down (WP18 G7).
   *
   * It runs after *every* module has bound rather than after this one, because
   * the module that answers resolves the template's members in its own scope
   * and those members may name its own imports.
   */
  makeDeferredInstantiations(): void {
    // WP18 G6: every import is bound, so every class a type argument can name
    // has its `implements` clause, and pass 1's constraint checks can run.
    checkDeferredConstraints(this.ctx);
    for (const request of this.program.deferredInstances) {
      this.ctx.errored = false;
      this.makeDeferredInstantiation(request);
    }
    this.ctx.errored = false;
    this.program.deferredInstances = [];
  }

  makeDeferredInstantiation(request: DeferredInstance): void {
    const imp = request.imp;
    const template = imp.structTemplate;
    if (template === null) {
      // An import that bound to nothing at all already has a diagnostic of its
      // own, and a second one about the same name would only bury it.
      if (imp.sig === null && imp.struct === null && imp.constant === null && imp.builtin === null && imp.template === null) {
        return;
      }
      this.ctx.error(
        request.at,
        `\`${imp.importedName}\` in \`${imp.specifier}\` takes no type arguments: only a generic ` +
          "class or interface is written with them"
      );
      return;
    }
    if (request.args.length !== template.typeParams.length) {
      let example = "";
      let i = 0;
      while (i < template.typeParams.length) {
        example = i === 0 ? "number" : `${example}, number`;
        i = i + 1;
      }
      this.ctx.error(
        request.at,
        `\`${template.sourceName}\` is generic: it must be written with its type arguments, e.g. ` +
          `\`${template.sourceName}<${example}>\``
      );
      return;
    }
    instantiateStruct(this.ctx, template, request.args, request.at);
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
// A lifted arrow (WP29) has no name to point at, so the arrow itself is the span.
const nameOf = (sig: FunctionSig): Node =>
  sig.decl.kind === N_CONSTRUCTOR || sig.decl.kind === N_ARROW ? sig.decl : sig.decl.children[0];

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
  /** The function being walked: the arena rule reads its return type. */
  sig: FunctionSig;
  /** Its body, which is the search root when an assignment is not inside a loop. */
  body: Node;
  /**
   * The accesses whose bounds check survived `self/bounds.ts` inside a loop.
   * The proof is not this section's — it is a flow-sensitive analysis of its
   * own — but the *report* is, because every WP15 §8 warning has to come out
   * of one source-order walk or the diagnostics stop being in source order.
   */
  unprovenIndices: Node[];
  loops: Node[];
  declared: Local[];
  declaredDepth: i32[];
  /**
   * Whether each declared local's initializer was itself a visible allocation.
   * Parallel to `declared`, and the difference between "this assignment drops
   * an allocation nobody can reach again" and "this local is being given its
   * one value in a branch", which is ordinary code with nothing to fix.
   */
  declaredAllocates: boolean[];

  constructor(ctx: CheckContext, sig: FunctionSig, body: Node, unprovenIndices: Node[]) {
    this.ctx = ctx;
    this.sig = sig;
    this.body = body;
    this.unprovenIndices = unprovenIndices;
    this.loops = [];
    this.declared = [];
    this.declaredDepth = [];
    this.declaredAllocates = [];
  }

  /** Whether `local` was declared holding an allocation. */
  declaredHoldingAllocation(local: Local): boolean {
    let i = 0;
    while (i < this.declared.length) {
      if (this.declared[i] === local) {
        return this.declaredAllocates[i];
      }
      i = i + 1;
    }
    return false;
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
 * The body of `sig`, checked in `scope`, which already holds its parameters,
 * and every rule that runs over a body once it has checked cleanly. Shared by
 * pass 2 and by an arrow lifted out of a call (WP29), which is checked where it
 * was written rather than on a pass of its own.
 *
 * `inferReturn` is the arrow's case with no return type to check against: a
 * concise body's own type becomes the function's (`map(xs, (x) => x * 2)`
 * binds `U` from `x * 2`). The caller refuses a block body before it gets
 * here, because a block has many returns and no single type to take.
 */
export const checkSignatureBody = (ctx: CheckContext, sig: FunctionSig, scope: Scope, inferReturn: boolean): void => {
  const body = sig.body();
  if (body === null) {
    return;
  }
  // The body shares the parameter scope rather than opening a child, so
  // `function f(a) { let a; }` is a duplicate declaration as in TypeScript.
  const before = ctx.sink.count();
  // A concise arrow body (`=> n * 2`) is a block with one `return`, so it
  // always terminates and its expression is checked as that return's.
  let terminates = true;
  if (body.kind === N_BLOCK) {
    terminates = checkStatements(ctx, body.children, scope);
  } else if (inferReturn) {
    sig.returnType = checkExpression(ctx, body, scope, -1);
  } else {
    checkReturnValue(ctx, body, scope);
  }
  let failed = ctx.sink.count() > before;
  // Outside a statement list the flag is always clear, so a diagnostic from
  // constant folding or from another module is never dropped by this body.
  ctx.errored = false;
  if (failed) {
    sig.poisoned = true;
  } else {
    // WP16: a `Result` local nobody reads is an unhandled failure. Reported
    // after the body so the diagnostic names a variable whose type is known.
    checkResultLocalsHandled(ctx, sig, body);
    // WP15 §2.1/§2.2: prove what indices are in range before the warnings
    // are reported, because one of the warnings is about the proofs that did
    // not come off, and it has to be reported by the same source-order walk
    // as the rest of the class.
    const unprovenIndices = analyzeBounds(ctx, body, ctx.uncheckedIndexing);
    // WP15 §8: the performance warnings, over the same body and the same
    // side tables. Only for a body that checked cleanly — advice about code
    // that does not compile is noise, and a poisoned body has incomplete
    // side tables anyway.
    checkPerformance(ctx, sig, body, unprovenIndices);
    // WP15 §2a: an element reference into contiguous struct storage may not
    // be held across a `push`. Same placement and same reason as the line
    // above — the walk reads types and bindings pass 2 has just written.
    const beforeElements = ctx.sink.count();
    checkElementReferences(ctx, body);
    if (ctx.sink.count() > beforeElements) {
      sig.poisoned = true;
      failed = true;
      ctx.errored = false;
    }
  }
  // A body with a rejected statement may have lost its `return`; reporting
  // a missing one on top of that is a cascade, not a second bug.
  if (sig.returnType !== T_VOID && sig.returnType !== T_ERROR && !terminates && !failed) {
    const spelled = ctx.table.typeName(sig.returnType);
    ctx.error(nameOf(sig), `Function \`${sig.sourceName}\` must return a value of type ${spelled} on every path`);
  }
};

/**
 * Report the performance warnings of one checked function body. Called after
 * the body has been checked so every type and binding it reads is recorded,
 * and only for a body that checked cleanly — advice about code that does not
 * compile is noise, and a poisoned body has incomplete side tables anyway.
 */
export const checkPerformance = (ctx: CheckContext, sig: FunctionSig, body: Node, unprovenIndices: Node[]): void => {
  walkPerformance(new PerfWalk(ctx, sig, body, unprovenIndices), body);
};

/**
 * A bounds check `self/bounds.ts` could not remove, on an access inside a loop
 * whose receiver and index are both plain locals — which is the shape the
 * analysis knows how to prove, so a guard really would remove the check.
 *
 * The hint is one rewrite rather than a list because it is the one that always
 * works: an `i >= 0 && i < xs.length` test reaching the access proves both
 * ends whatever took the proof away, `--wrapping` included, where an
 * incremented counter has no lower bound the compiler may assume. An unsigned
 * index is named beside it because `u8`/`u16`/`u32`/`u64` are the ranged types
 * the language already has, and half the proof comes off their declaration.
 */
const checkSurvivingBoundsCheck = (walk: PerfWalk, access: Node): void => {
  let receiver = access;
  let index = access;
  if (access.kind === N_INDEX) {
    receiver = access.children[0];
    index = access.children[1];
  } else {
    const callee = unwrapPerfParens(access.children[0]);
    if (callee.kind !== N_MEMBER || access.children[1].children.length !== 1) {
      return;
    }
    receiver = callee.children[0];
    index = access.children[1].children[0];
  }
  const holder = perfLocalName(walk.ctx, receiver);
  const name = perfLocalName(walk.ctx, index);
  if (holder.length === 0 || name.length === 0) {
    return;
  }
  walk.ctx.performance(
    index,
    `\`${name}\` is not proven to be in range for \`${holder}\` here, so this access keeps its bounds check and ` +
      `compares against the length on every iteration: guard it with a test that reaches the access — ` +
      `\`if (${name} >= 0 && ${name} < ${holder}.length)\` proves both ends, and an unsigned index needs only ` +
      `the upper one`
  );
};

/**
 * A call, inside a loop, to a function this module does not export, while
 * `--no-strict-exports` is keeping it an external symbol.
 *
 * The default gives a non-exported function `internal` linkage, which is what
 * lets LLVM treat the call sites it can see as all of them: specialise the body
 * to their arguments, and drop the out-of-line copy once they are inlined. The
 * flag withdraws that for every function in the module at once, and the loop is
 * what makes it worth saying.
 *
 * What that is worth is a size, not a time. On `bench/sieve`, whose hot `sieve`
 * is exactly this shape, the flag is 240 bytes — 6,576 against 6,816 — because
 * `opt -O3` inlines and deletes `@sieve` under the default and keeps the
 * out-of-line copy under the flag. The wall clock does not move: five
 * interleaved protocols put the two within 2.4% of each other with the sign
 * flipping between them, and a paired run of 40 rounds had the flagged build
 * ahead 22 times. `bench/spectral` is 64 bytes *smaller* with the flag and the
 * same time either way. So the message names the missed specialisation and no
 * speed figure, and WP15 §8 records the measurement.
 *
 * It cannot be noise for anybody who did not ask for it: the flag is opt-in, so
 * a default build reports none of these, and the rewrite the message names is
 * to stop passing it. An exported function is silent because the ABI is then
 * the point, and a call outside a loop is silent because one call is not a cost
 * anybody is paying.
 *
 * A `declare function` is silent too, and testing `exported` is not enough to
 * get that right. A foreign declaration is external because C defines it, not
 * because this module withheld an `export` — and `export declare function` is
 * refused outright, so `exported` is *always* false for one. Both rewrites the
 * message names are therefore unavailable: exporting it is an error, and
 * dropping the flag would not make it `internal`, because there is no body here
 * to give linkage to. The IR says as much — the `declare` line is the same
 * under the flag as under the default, and a program whose only functions are
 * its entry and the declaration comes out byte for byte identical either way,
 * so the warning would be naming a cost that is not being paid. `foreign()` is
 * the predicate rather
 * than a missing `body()`, because a body can be absent for other reasons
 * (`FunctionSig.foreign`, WP27 S1), and it is exactly the failure
 * `perf_inline_quiet`'s header warns about: a warning that fires where there is
 * nothing to fix is what teaches people to ignore a whole diagnostic class.
 * `tests/cases/perf_inline_foreign` pins it, with a foreign call and an
 * ordinary non-exported one in the *same* loop, so the single diagnostic it
 * reports is what says this guard is not too wide.
 */
const checkNotInlinable = (walk: PerfWalk, call: Node): void => {
  const ctx = walk.ctx;
  if (ctx.strictExports || walk.loops.length === 0) {
    return;
  }
  const callee = ctx.program.nodeCallees[call.id];
  if (callee === null || callee.exported) {
    return;
  }
  // A `declare function` is external because C defines it, not because this
  // module withheld an `export`: the rewrite named below cannot be taken (the
  // checker refuses `export declare function`) and dropping
  // `--no-strict-exports` would not make it `internal` either. WP27 S1.
  if (callee.foreign()) {
    return;
  }
  ctx.performance(
    call.children[0],
    `\`${callee.sourceName}\` is called here inside a loop and \`--no-strict-exports\` keeps it an external ` +
      `symbol, so the whole-program passes must assume there are callers they cannot see: the function is not ` +
      `specialised to these arguments and its out-of-line copy survives even where every call was inlined — ` +
      `drop \`--no-strict-exports\`, and a function this module does not export is \`internal\` instead`
  );
};

/**
 * A `substring` bound the WP15 §2 analysis could not place in `[0, s.length]`,
 * on a call inside a loop.
 *
 * JavaScript's `substring` clamps each end, which is an `llvm.smin` /
 * `llvm.smax` pair per bound, and the compiler writes a bound straight through
 * wherever it can prove the clamp cannot move it (`self/bounds.ts`,
 * `program.nodeProvenClamp`). So a bound it could not prove is two intrinsic
 * calls every pass that a guard would take away — a slow path with a named
 * rewrite, which is the whole bar of this class.
 *
 * Two rewrites are named because they are not the same trade. The guard keeps
 * the semantics exactly: a clamped bound that was already in range clamps to
 * itself. `slice` changes them — it panics where `substring` would have clamped
 * — and it is the faster call whichever way the proof goes, measured 1.18x over
 * `substring` on a lexer-shaped scan (WP15 §4).
 *
 * Not reported outside a loop, where the clamp runs once; not reported unless
 * the receiver and the bound are both plain locals, which is the shape the
 * analysis can prove and therefore the shape a guard would help — the same bar
 * `checkSurvivingBoundsCheck` holds itself to. Unlike that one it ignores
 * `--unchecked-indexing`, because the clamp is not a check: the flag does not
 * remove it and neither rewrite depends on it.
 *
 * TODO(wp15): the named guard does not compile for an unsigned bound. On a
 * `u32` the message still says to write `if (k >= 0 && k <= s.length)`, and the
 * checker refuses the second half — ``Operator `<=` requires two numeric
 * operands, got u32 and i32``. `NL9007` has the identical defect and had it
 * before this rule existed, so the fix belongs to both: either the two messages
 * name a rewrite an unsigned bound can write, or the domain learns `atMost`
 * from an unsigned comparison. `slice`, the other rewrite here, does compile on
 * a `u32` today.
 *
 * That is the only shape here whose advice cannot be written, and it is weaker
 * than it looks: one of the two named rewrites still compiles. The audit that
 * says so was prompted by `NL9008`, which had the stronger version of the same
 * defect — it fired on a `declare function`, where *both* its rewrites were
 * impossible, and is now silent for one. This rule has no `declare function`
 * twin, and cannot: a foreign declaration returns a scalar or `CPtr` only, so
 * the **receiver** can never come from C, and a C-returned **bound** is an
 * ordinary `i32` local that the named guard silences like any other. Both were
 * provoked rather than argued.
 */
const checkUnfoldedClamp = (walk: PerfWalk, call: Node): void => {
  if (walk.loops.length === 0) {
    return;
  }
  const ctx = walk.ctx;
  const callee = unwrapPerfParens(call.children[0]);
  if (callee.kind !== N_MEMBER || callee.text !== "substring") {
    return;
  }
  const count = call.children[1].children.length;
  if (count < 1 || count > 2) {
    return;
  }
  if (ctx.program.nodeTypes[callee.children[0].id] !== T_STRING) {
    return;
  }
  const holder = perfLocalName(ctx, callee.children[0]);
  if (holder.length === 0) {
    return;
  }
  for (const bound of call.children[1].children) {
    if (ctx.program.nodeProvenClamp[bound.id]) {
      continue;
    }
    const name = perfLocalName(ctx, bound);
    if (name.length === 0) {
      continue;
    }
    ctx.performance(
      bound,
      `\`${name}\` is not provably within \`${holder}\`, so this \`substring\` bound keeps the clamp ` +
        `JavaScript specifies — an \`llvm.smin\` and an \`llvm.smax\` on every pass, which the optimiser folds ` +
        `away only where it can hoist the receiver's length, and never where the receiver is a parameter, ` +
        `because the guard compares i32 and the clamp runs on its sext: prove it with a test that reaches the ` +
        `call, as \`if (${name} >= 0 && ${name} <= ${holder}.length)\`, or use \`slice\`, which has no clamp ` +
        `at all and panics where this would have clamped`
    );
  }
};

/** The source name of the local a bare identifier binds, or `""` for anything else. */
const perfLocalName = (ctx: CheckContext, expr: Node): string => {
  const e = unwrapPerfParens(expr);
  if (e.kind !== N_IDENT) {
    return "";
  }
  const local = ctx.program.nodeLocals[e.id];
  return local === null ? "" : local.name;
};

/**
 * Walk one function body. The loop stack is pushed around the parts of a loop
 * that run once per iteration and *not* around a `for` initializer, which runs
 * once: `for (let s = ""; ...) { s = s + t; }` accumulates across the whole
 * loop and must warn, while `for (const x of xs) { ... }` gives `x` a fresh
 * binding every pass and must not.
 */
const walkPerformance = (walk: PerfWalk, node: Node): void => {
  // WP29: an arrow argument is a function of its own, whose body was walked
  // when it was lifted; walking it again here would report its warnings twice.
  if (node.kind === N_ARROW) {
    return;
  }
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
      walk.declaredAllocates.push(perfAllocatesVisibly(walk.ctx, node.children[2]));
    }
    checkLoopAllocation(walk, node);
  } else if (node.kind === N_BINARY) {
    if (node.text === "=") {
      checkStringAccumulation(walk, node);
      checkArenaReassignment(walk, node);
    }
    checkConstantOverflow(walk, node);
    checkShiftCount(walk, node);
  } else if (node.kind === N_CALL) {
    checkWideningConversion(walk, node);
    checkUnfoldedClamp(walk, node);
    checkNotInlinable(walk, node);
  }
  if (isUnprovenIndex(walk, node)) {
    checkSurvivingBoundsCheck(walk, node);
  }
  for (const child of node.children) {
    walkPerformance(walk, child);
  }
};

/** Whether `node` is one of the accesses the bounds analysis could not prove. */
const isUnprovenIndex = (walk: PerfWalk, node: Node): boolean => {
  for (const access of walk.unprovenIndices) {
    if (access === node) {
      return true;
    }
  }
  return false;
};

/**
 * `s = <something built from s>` inside a loop that does not own `s`. Split
 * from the report below because the arena rule has to know whether this one is
 * already speaking about the same assignment: one line gets one warning.
 */
const isQuadraticAccumulation = (walk: PerfWalk, expr: Node): boolean => {
  if (walk.loops.length === 0) {
    return false;
  }
  const left = expr.children[0];
  if (left.kind !== N_IDENT) {
    return false;
  }
  const target = walk.ctx.program.nodeLocals[left.id];
  if (target === null || target.type !== T_STRING) {
    return false;
  }
  // Declared inside the loop it is assigned in: the string is rebuilt from
  // empty every pass, so it is bounded by one iteration, not by the loop.
  if (walk.depthOf(target) === walk.loops.length) {
    return false;
  }
  return accumulates(walk.ctx, expr.children[1], target);
};

/** `s = <something built from s>` inside a loop that does not own `s`. */
const checkStringAccumulation = (walk: PerfWalk, expr: Node): void => {
  if (!isQuadraticAccumulation(walk, expr)) {
    return;
  }
  const left = expr.children[0];
  const target = walk.ctx.program.nodeLocals[left.id];
  if (target === null) {
    return;
  }
  walk.ctx.performance(
    left,
    `\`${target.name}\` is rebuilt from its own value on every iteration of this loop, so every pass copies all ` +
      `of it (quadratic in time and in arena bytes): collect the pieces in a \`string[]\` and \`join\` them after the loop`
  );
};

/** A dynamically sized array allocated per iteration and dead by the end of it. */
const checkLoopAllocation = (walk: PerfWalk, decl: Node): void => {
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
};

/** Strip parentheses; every shape test here is about the expression inside them. */
const unwrapPerfParens = (expr: Node): Node => {
  let inner = expr;
  while (inner.kind === N_PAREN) {
    inner = inner.children[0];
  }
  return inner;
};

/**
 * The value of `expr` is `target`'s own contents plus something. Only `+`
 * chains and template holes are followed, because those are the two forms
 * that copy the accumulator; `s = f(s)` or `s = cond ? s : t` may do anything
 * or nothing, and guessing would break the "name a concrete rewrite" bar.
 */
const accumulates = (ctx: CheckContext, expr: Node, target: Local): boolean => {
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
};

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
const isDynamicArrayAllocation = (ctx: CheckContext, expr: Node): boolean => {
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
};

/** The literal is a non-negative integer as written: no sign, no dot, no exponent. */
const isNonNegativeInteger = (text: string): boolean => {
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
};

/**
 * Every reference to `local` inside `root` is consumed where it stands: an
 * element read or write, a `.length`, or a `for...of` source. Anything else —
 * a `push`, an argument, a store, a `return`, a reassignment, a bare mention —
 * may keep the value past the iteration, and then the allocation is not
 * redundant and hoisting it would be wrong.
 *
 * `own` is the declaration that introduced `local`; its own name is not a use.
 */
const usedOnlyWithinIteration = (ctx: CheckContext, root: Node, local: Local, own: Node): boolean => {
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
};

/** `expr` is a direct reference to `local` (through parentheses only). */
const isLocalRef = (ctx: CheckContext, expr: Node, local: Local): boolean => {
  const e = unwrapPerfParens(expr);
  if (e.kind !== N_IDENT) {
    return false;
  }
  const bound = ctx.program.nodeLocals[e.id];
  return bound !== null && bound === local;
};


// ---- Memory that is allocated and then never released ----------------------------
//
// The stage1 half of the same rule in `src/checker/performance.ts`, where the
// measurement and the reasoning are written out. In short: WP6 releases a
// function's arena temporaries on the way out only when it can prove they all
// die with the frame, and assigning an allocation to a local takes that proof
// away for the whole body — the stack rule needs a fixed binding, so the value
// classifies as `leaks`, `allocLeaks` goes on, and the `nish_arena_mark` /
// `nish_arena_release` bracket is not emitted at all.
//
// The rule fires only where an allocation is *dropped*: the local was declared
// holding one, so the value it held is unreachable after the assignment and
// nothing will ever free it. A local given its one value in a branch (`let
// what = "unbound"` and three arms that assign a template) retains memory too,
// but there is no rewrite worth naming there, and §8 is explicit that a
// warning nobody can act on is worse than no warning.

/** The builtins that hand back freshly allocated memory by plain identifier. */
const perfIsReadBuiltin = (name: string): boolean => name === "readFileSync" || name === "readFileSyncOrNull";

/**
 * `expr` allocates from the arena in a way the checker can see for itself: a
 * `new`, an object or array literal, a template with a hole, a string
 * concatenation, or a `readFileSync`.
 *
 * A call to a user function is deliberately not counted even though it may
 * allocate: whether it does is a whole-program fact the attribute fixpoint
 * owns, and a guess that fires on a call that allocates nothing is the
 * un-actionable kind of warning. A string literal is not counted either — it
 * is constant data, not an allocation.
 */
const perfAllocatesVisibly = (ctx: CheckContext, expr: Node): boolean => {
  const e = unwrapPerfParens(expr);
  if (e.kind === N_NEW || e.kind === N_OBJECT || e.kind === N_ARRAY) {
    return true;
  }
  // A template *with a hole* builds a new string; one without is a literal and
  // allocates nothing. The parser gives both `N_TEMPLATE`, where stage0's
  // `ts.isTemplateExpression` already excludes the hole-less form, so the test
  // has to be made here or the two compilers disagree.
  if (e.kind === N_TEMPLATE) {
    for (const part of e.children) {
      if (part.kind !== N_TEMPLATE_TEXT) {
        return true;
      }
    }
    return false;
  }
  if (e.kind === N_CALL) {
    const callee = unwrapPerfParens(e.children[0]);
    return callee.kind === N_IDENT && perfIsReadBuiltin(callee.text) && !ctx.sigs.has(callee.text);
  }
  return e.kind === N_BINARY && e.text === "+" && ctx.program.nodeTypes[e.id] === T_STRING;
};

/**
 * A type that is a pointer at run time, and so names memory somebody has to
 * own. A `Result` is counted with them even though a small one travels in a
 * register: the rule uses this to decide when to stay quiet, and counting a
 * borderline type as a pointer only ever means one warning fewer.
 */
const perfIsPointerType = (ctx: CheckContext, type: i32): boolean => ctx.table.isPointer(type) || ctx.table.isNullable(type) || ctx.table.isResult(type);

/**
 * A use of `local` that can let the value it holds outlive the statement it
 * appears in: an argument (a `push` is one), a `return`, an element of an
 * array or object literal, the right-hand side of an assignment, or the
 * initializer of another binding. Everything else — an operand, a field or
 * element read or write through it, `.length`, a `for...of` source — consumes
 * the value where it stands and cannot keep it.
 */
const perfCapturesLocal = (ctx: CheckContext, node: Node, local: Local): boolean => {
  if (node.kind === N_CALL) {
    for (const arg of node.children[1].children) {
      if (isLocalRef(ctx, arg, local)) {
        return true;
      }
    }
    return false;
  }
  if (node.kind === N_ARRAY) {
    for (const element of node.children) {
      if (isLocalRef(ctx, element, local)) {
        return true;
      }
    }
    return false;
  }
  if (node.kind === N_RETURN || node.kind === N_PROPERTY) {
    return isLocalRef(ctx, node.children[0], local);
  }
  if (node.kind === N_VAR_DECL) {
    return isLocalRef(ctx, node.children[2], local);
  }
  return node.kind === N_BINARY && node.text === "=" && isLocalRef(ctx, node.children[1], local);
};

/**
 * Whether the value `local` holds *when `expr` runs* may already be reachable
 * from somewhere else, which is what decides whether the assignment really
 * drops it.
 *
 * The question is about order, not about existence, and this compiler's own
 * `astLines` is why. It builds a line, replaces it in a branch, and only then
 * pushes it: the replaced value is dead and the warning is right. Turn the two
 * around — push, then reassign, in a loop — and every pushed value is still
 * reachable through the array and the warning would be wrong.
 *
 * So: inside a loop, any capture anywhere in the outermost enclosing loop
 * counts, because control comes back around to the assignment with the capture
 * behind it. Outside one, only a capture that finishes before the assignment
 * starts can have taken a value the assignment is about to drop.
 */
const perfHeldValueMayBeReachable = (walk: PerfWalk, expr: Node, local: Local): boolean => {
  const inLoop = walk.loops.length > 0;
  const root = inLoop ? walk.loops[0] : walk.body;
  return perfScanForCapture(walk.ctx, root, local, inLoop, expr.start);
};

const perfScanForCapture = (ctx: CheckContext, node: Node, local: Local, inLoop: boolean, before: i32): boolean => {
  if ((inLoop || node.end <= before) && perfCapturesLocal(ctx, node, local)) {
    return true;
  }
  for (const child of node.children) {
    if (perfScanForCapture(ctx, child, local, inLoop, before)) {
      return true;
    }
  }
  return false;
};

/**
 * `s = <an allocation>` where `s` is a local that was declared holding one.
 * Reported on the target, because the assignment is the thing to change. The
 * guards are stage0's, in the same order.
 */
const checkArenaReassignment = (walk: PerfWalk, expr: Node): void => {
  const left = expr.children[0];
  if (left.kind !== N_IDENT) {
    return;
  }
  const ctx = walk.ctx;
  const target = ctx.program.nodeLocals[left.id];
  if (target === null || target.storage === STORAGE_PARAM || !perfIsPointerType(ctx, target.type)) {
    return;
  }
  const sig = walk.sig;
  if (perfIsPointerType(ctx, sig.returnType)) {
    return;
  }
  if (isQuadraticAccumulation(walk, expr)) {
    return;
  }
  if (!walk.declaredHoldingAllocation(target) || !perfAllocatesVisibly(ctx, expr.children[1])) {
    return;
  }
  if (perfHeldValueMayBeReachable(walk, expr, target)) {
    return;
  }
  ctx.performance(
    left,
    `\`${target.name}\` already holds an allocation and this one drops it: nothing can reach the old value from ` +
      `here and nothing frees it, and assigning a local is also what stops this function from releasing its arena ` +
      `memory at all, so both allocations live until the program exits. Give each value its own \`const\`, or ` +
      `bracket the body with \`Arena.mark()\` and \`Arena.release(m)\``
  );
};

// ---- Arithmetic that provably goes wrong (the overflow rules) --------------------
//
// The stage1 half of the same three rules in `src/checker/performance.ts`. The
// reasoning for each one is written out there; what matters here is that every
// guard and every word of every message is that file's, because the oracles
// compare the two compilers byte for byte.
//
// Signed overflow is undefined behaviour by default, so warning wherever it is
// *possible* would mean warning on every `+` and every `*` in the program,
// which is the un-actionable class §8 forbids. These fire only where the
// compiler can point at the value or at a shape whose rewrite is mechanical: a
// constant that does not fit, `i32` arithmetic widened after it has already
// wrapped, and a shift by a count at or beyond the operand width. The unsigned
// widths are silent, because they are *defined* to wrap and a warning there
// would argue with the type the program chose on purpose.

/**
 * Bounds on what the fold carries. Every intermediate stays inside them, so
 * the fold itself can never overflow the `i64` it folds in -- which would be
 * undefined behaviour inside the very check that reports it. A product needs
 * both operands under 2^31 to stay inside an `i64`, and a sum needs both under
 * 2^52, which is also the largest power of two either compiler can *write*: a
 * literal past 2^53 cannot be spelled exactly.
 */
const FOLD_LIMIT: i64 = 2147483648;
const FOLD_SUM_LIMIT: i64 = 4503599627370496;

/**
 * The range the rule reports against. Only `i32` is ever reported: the fold
 * bounds above keep every value it carries well inside `i64`, so an `i64`
 * constant it can evaluate is an `i64` constant that fits.
 */
const I32_MIN: i64 = -2147483648;
const I32_MAX: i64 = 2147483647;

/**
 * A folded constant, or the absence of one. Stage0 answers `bigint |
 * undefined`; Nish has no `undefined`, so the two halves of that answer travel
 * together.
 */
class PerfConst {
  ok: boolean;
  value: i64;

  constructor(ok: boolean, value: i64) {
    this.ok = ok;
    this.value = value;
  }
}

const perfNoConst = (): PerfConst => new PerfConst(false, 0);

const perfMagnitude = (value: i64): i64 => value < 0 ? -value : value;

/**
 * The exact value of a constant integer expression, or "not a constant". Only
 * decimal literals joined by `+`, `-`, `*` and unary minus fold: stage0 has
 * `Number` and this compiler does not, so a hexadecimal or exponent literal is
 * left alone rather than folded differently on each side.
 *
 * A `const n = 8` is deliberately not followed even though the checker knows
 * its value, and a module-level `const` needs nothing from here: `self/
 * constants.ts` folds those eagerly and makes an overflow a hard error, so
 * what is left for a warning is the arithmetic inside a function body.
 */
const perfConstantInt = (expr: Node): PerfConst => {
  const e = unwrapPerfParens(expr);
  if (e.kind === N_NUMBER) {
    if (!isNonNegativeInteger(e.text)) {
      return perfNoConst();
    }
    const value = parseIntegerLiteral(e.text);
    return value > FOLD_LIMIT ? perfNoConst() : new PerfConst(true, value);
  }
  if (e.kind === N_UNARY && e.text === "-" && e.flags === FLAG_PREFIX) {
    const operand = perfConstantInt(e.children[0]);
    return operand.ok ? new PerfConst(true, -operand.value) : perfNoConst();
  }
  if (e.kind !== N_BINARY) {
    return perfNoConst();
  }
  const left = perfConstantInt(e.children[0]);
  const right = perfConstantInt(e.children[1]);
  if (!left.ok || !right.ok) {
    return perfNoConst();
  }
  if (e.text === "*") {
    if (perfMagnitude(left.value) > FOLD_LIMIT || perfMagnitude(right.value) > FOLD_LIMIT) {
      return perfNoConst();
    }
    return new PerfConst(true, left.value * right.value);
  }
  if (perfMagnitude(left.value) > FOLD_SUM_LIMIT || perfMagnitude(right.value) > FOLD_SUM_LIMIT) {
    return perfNoConst();
  }
  if (e.text === "+") {
    return new PerfConst(true, left.value + right.value);
  }
  if (e.text === "-") {
    return new PerfConst(true, left.value - right.value);
  }
  return perfNoConst();
};

/** `expr` is a constant of a signed type whose value does not fit that type. */
const perfOverflowsItsType = (ctx: CheckContext, expr: Node): boolean => {
  const e = unwrapPerfParens(expr);
  if (ctx.program.nodeTypes[e.id] !== T_I32) {
    return false;
  }
  const folded = perfConstantInt(e);
  return folded.ok && (folded.value < I32_MIN || folded.value > I32_MAX);
};

/**
 * A constant `+`, `-` or `*` whose value does not fit the signed type it is
 * computed in. Reported on the *innermost* expression that overflows, because
 * that is the operation that actually goes wrong: in `(a * b) + 1` where the
 * product already overflows, the `+` is a consequence and saying so twice
 * would not tell the reader anything new.
 *
 * Silent under `--wrapping`, where the wrap is the defined answer rather than
 * undefined behaviour and the warning would be arguing with a flag the author
 * passed on purpose.
 */
const checkConstantOverflow = (walk: PerfWalk, expr: Node): void => {
  if (walk.ctx.wrapping) {
    return;
  }
  if (expr.text !== "+" && expr.text !== "-" && expr.text !== "*") {
    return;
  }
  const ctx = walk.ctx;
  if (ctx.program.nodeTypes[expr.id] !== T_I32) {
    return;
  }
  const folded = perfConstantInt(expr);
  if (!folded.ok || (folded.value >= I32_MIN && folded.value <= I32_MAX)) {
    return;
  }
  if (perfOverflowsItsType(ctx, expr.children[0]) || perfOverflowsItsType(ctx, expr.children[1])) {
    return;
  }
  ctx.performance(
    expr,
    `this computes with overflow: the result ${folded.value} does not fit in i32 (the range is ${I32_MIN} to ` +
      `${I32_MAX}), and signed overflow is undefined behaviour rather than a wrap: widen the operands with ` +
      `\`toI64\` first, or use --wrapping for two's-complement arithmetic`
  );
};

/**
 * `toI64(a * b)` and `toF64(a * b)` on `i32` operands: the multiplication is
 * done in `i32` and has already overflowed by the time the conversion widens
 * the result, so the wider type never sees the value the reader expects. The
 * rewrite is mechanical, which is what earns this one its place under the §8
 * bar.
 *
 * Multiplication only, though `+` and `-` can overflow too: this compiler's
 * own `toI64(intBits(type) - 1)` is the shape with nothing wrong with it, and
 * a warning that fires there is the un-actionable kind §8 forbids.
 *
 * A user function of the same name shadows the builtin, so a program that
 * declares one is left alone: the call is not a conversion at all there.
 */
const checkWideningConversion = (walk: PerfWalk, call: Node): void => {
  const callee = unwrapPerfParens(call.children[0]);
  if (callee.kind !== N_IDENT || (callee.text !== "toI64" && callee.text !== "toF64")) {
    return;
  }
  const args = call.children[1];
  if (args.children.length !== 1) {
    return;
  }
  const ctx = walk.ctx;
  if (ctx.sigs.has(callee.text)) {
    return;
  }
  const arg = unwrapPerfParens(args.children[0]);
  if (arg.kind !== N_BINARY || arg.text !== "*") {
    return;
  }
  if (ctx.program.nodeTypes[arg.id] !== T_I32) {
    return;
  }
  ctx.performance(
    arg,
    `this \`${arg.text}\` is computed in i32 and wraps before \`${callee.text}\` widens the result, so the ` +
      `conversion cannot recover an overflow that has already happened: convert the operands first, as ` +
      `\`${callee.text}(a) ${arg.text} ${callee.text}(b)\``
  );
};

/**
 * A shift by a literal count at or beyond the operand's width. The count is
 * masked to the width rather than left undefined, which matches JavaScript but
 * means `x << 32` on an `i32` shifts by nothing at all -- never what the line
 * was written to do.
 */
const checkShiftCount = (walk: PerfWalk, expr: Node): void => {
  if (expr.text !== "<<" && expr.text !== ">>" && expr.text !== ">>>") {
    return;
  }
  const ctx = walk.ctx;
  const bits = intBits(ctx.program.nodeTypes[expr.id]);
  if (bits === 0) {
    return;
  }
  const count = perfConstantInt(expr.children[1]);
  const width = toI64(bits);
  if (!count.ok || count.value < 0 || count.value < width) {
    return;
  }
  ctx.performance(
    expr.children[1],
    `the shift count ${count.value} is at or beyond the ${bits} bits of the operand, so it is masked to ` +
      `${count.value % width} and this shifts by that instead: mask the count yourself if that is intended, or ` +
      `shift a wider value — \`${expr.text}\` never shifts a value out of existence here`
  );
};

/** The first place a module names `Map` and `Set`, in a type or after `new` (WP32). */
class CollectionNames {
  map: Node | null;
  set: Node | null;

  constructor() {
    this.map = null;
    this.set = null;
  }

  note(name: string, at: Node): void {
    if (name === "Map" && this.map === null) {
      this.map = at;
    } else if (name === "Set" && this.set === null) {
      this.set = at;
    }
  }
}

/**
 * Walk `node` for the names of the global collections, and record every
 * `const m: Map<K, V> = new Map()` whose `new` takes its type arguments from
 * the annotation (docs/wp32-map.md §7). One walk, because both are syntax: the
 * import has to exist before pass 1 resolves the first annotation.
 */
const scanCollectionNames = (node: Node, names: CollectionNames, program: CheckedProgram): void => {
  if (node.kind === N_TYPE_REF) {
    names.note(node.text, node);
  } else if (node.kind === N_NEW && node.children[0].kind === N_IDENT) {
    names.note(node.children[0].text, node.children[0]);
  } else if (node.kind === N_VAR_DECL) {
    noteAnnotatedNew(node, program);
  }
  for (const child of node.children) {
    scanCollectionNames(child, names, program);
  }
};

/** `const m: Map<K, V> = new Map()`: the `new` names the annotation's class and writes no type arguments. */
const noteAnnotatedNew = (decl: Node, program: CheckedProgram): void => {
  const annotation = decl.children[1];
  const init = decl.children[2];
  if (annotation.kind !== N_TYPE_REF || init.kind !== N_NEW || init.children[0].kind !== N_IDENT) {
    return;
  }
  const name = init.children[0].text;
  if ((name !== "Map" && name !== "Set") || annotation.text !== name || init.children[1].children.length > 0) {
    return;
  }
  program.newTypeArgumentIds.set(`${init.id}`, program.newTypeArguments.length);
  program.newTypeArguments.push(annotation.children[0]);
};
