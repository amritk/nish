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
import { foldConstant } from "./constants";
import { CheckContext } from "./context";
import { DiagnosticSink, SourceFile } from "./diagnostics";
import { collectFunctionSignature, collectImports, isExported, markEntryMain } from "./declarations";
import { N_CLASS, N_FUNCTION, N_IMPORT, N_INTERFACE, N_MODULE_CONST, Node } from "./nodes";
import { CheckedProgram, ConstInfo, STRUCT_CLASS, STRUCT_INTERFACE, StructInfo } from "./program";
import { checkImplements, collectStructMembers, declareStruct } from "./structs";
import { T_BOOL, T_ERROR, T_F64, T_I32, T_I64, T_STRING, TypeTable } from "./types";

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
    numberMode: i32
  ) {
    this.program = new CheckedProgram(source, file, isEntry, nodeCount);
    this.ctx = new CheckContext(table, this.program, sink, numberMode);
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

    for (const info of declared) {
      if (info.kind === STRUCT_CLASS) {
        checkImplements(this.ctx, info);
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
    if (name === "main" && sig.exported && this.program.isEntry) {
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
