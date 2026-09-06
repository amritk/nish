/** Data model produced by the checker and consumed by the emitter. */
import ts from "typescript";
import { StaticType } from "../types";

export interface Param {
  name: string;
  type: StaticType;
}

export interface FunctionSig {
  /**
   * The LLVM symbol (`@name`). Equal to the declared identifier except for the
   * entry module's `export function main`, which is emitted as `@sts_main` so
   * the C-ABI wrapper can own `@main` (see `docs/wp5-modules.md`).
   */
  name: string;
  /** The identifier as written in the source. */
  sourceName: string;
  params: Param[];
  returnType: StaticType;
  decl: ts.FunctionDeclaration;
  /** Declared with the `export` modifier: callable from other modules, never `internal`. */
  exported: boolean;
}

export interface LocalVar {
  name: string;
  type: StaticType;
  mutable: boolean;
  /** `param` locals are SSA values; `local` ones live in an alloca slot. */
  storage: "param" | "local";
}

/** One name brought in by `import { f, g as h } from "./m"`. */
export interface ImportBinding {
  /** The `import` statement. */
  node: ts.ImportDeclaration;
  /** Module specifier text, e.g. `./math`. Relative specifiers only. */
  specifier: string;
  /** Name inside the exporting module. */
  importedName: string;
  /** Name inside this module (differs only with `as`). */
  localName: string;
  /** The specifier element, for error locations. */
  element: ts.ImportSpecifier;
  /** Resolved after all modules collected their signatures (pass 1b). */
  sig?: FunctionSig;
}

export interface CheckedProgram {
  sourceFile: ts.SourceFile;
  /** Functions defined in this module, in source order. */
  functions: FunctionSig[];
  /** Functions imported from other modules; the emitter emits a `declare` per distinct symbol. */
  imports: ImportBinding[];
  /** Source name -> signature, for every `export function` in this module. */
  exports: Map<string, FunctionSig>;
  /**
   * Set on the entry module when it declares `export function main`. The
   * emitter then adds the `define i32 @main(i32, i8**)` wrapper around it.
   */
  entryMain?: FunctionSig;
  /** Expression node -> resolved StaticType. */
  types: WeakMap<ts.Node, StaticType>;
  /** Identifier node -> the variable it refers to. */
  bindings: WeakMap<ts.Identifier, LocalVar>;
  /** VariableDeclaration node -> the local it introduces. */
  locals: WeakMap<ts.VariableDeclaration, LocalVar>;
  /** CallExpression node -> callee signature. */
  callees: WeakMap<ts.CallExpression, FunctionSig>;
}
