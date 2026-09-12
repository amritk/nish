/** Data model produced by the checker and consumed by the emitter. */
import ts from "typescript";
import { AliasInfo } from "./aliases.js";
import { ConstInfo } from "./constants.js";
import { BuiltinExport } from "./nish-modules.js";
import { StaticType } from "../types.js";

export interface Param {
  name: string;
  type: StaticType;
}

/** A field of a class or interface (WP2), with its computed layout slot. */
export interface FieldInfo {
  name: string;
  type: StaticType;
  /** Position in the LLVM struct body (`getelementptr ... i32 0, i32 <index>`). */
  index: number;
  /** Byte offset, computed exactly as clang lays out the equivalent C struct. */
  offset: number;
  /** `readonly` fields may only be assigned through `this` in their class's constructor. */
  readonly: boolean;
  /** Literal initializer (`x: number = 0`); stored before the constructor body runs. */
  initializer?: ts.Expression;
  decl: ts.PropertyDeclaration | ts.PropertySignature;
}

/** A class or interface (WP2): one `%struct.<name>` LLVM type with fixed fields. */
export interface StructInfo {
  name: string;
  kind: "class" | "interface";
  /** The shared StaticType for this struct; identity is by `name`. */
  type: StaticType;
  fields: FieldInfo[];
  /** Name -> field, for O(1) member lookup. */
  fieldsByName: Map<string, FieldInfo>;
  /** `sizeof` in bytes, including trailing padding to `align`. */
  size: number;
  /** Maximum field alignment (1 when there are no fields). */
  align: number;
  /** Methods keyed by source name; each is also in `CheckedProgram.functions`. */
  methods: Map<string, FunctionSig>;
  /** The explicit constructor, if any. Without one, `new` stores the field initializers inline. */
  ctor?: FunctionSig;
  /**
   * Interfaces named in the `implements` clause. Each one's fields are the
   * first fields of this struct, in order and with identical types (WP25), so
   * a `%struct.<name>*` may be `bitcast` to `%struct.<interface>*`.
   */
  implements: string[];
  /** Pass 1b progress, so a struct's members are collected once. */
  collected?: "collecting" | "done";
  decl: ts.ClassDeclaration | ts.InterfaceDeclaration;
  exported: boolean;
  /** A member or heritage clause was rejected (WP10): the layout is incomplete; skip follow-on checks. */
  poisoned?: boolean;
}

export interface FunctionSig {
  /**
   * The LLVM symbol (`@name`). Equal to the declared identifier except for the
   * entry module's `export function main`, which is emitted as `@nish_main` so
   * the C-ABI wrapper can own `@main` (see `docs/wp5-modules.md`).
   */
  name: string;
  /** The identifier as written in the source. */
  sourceName: string;
  /** For methods and constructors the first entry is `this` (WP2). */
  params: Param[];
  returnType: StaticType;
  decl: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ConstructorDeclaration | ts.ArrowFunction;
  /**
   * Where a diagnostic that names the function points. An arrow has no name of
   * its own, so for the arrow form this is the `const`'s identifier (WP22 §5).
   */
  nameNode: ts.Node;
  /**
   * The body, normalised. A `function`, a method and a constructor always carry
   * a `Block`; an arrow may carry a concise body (`=> n * 2`), which means
   * exactly what a block with one `return` means (WP22 §4). The four places
   * that walk a body branch on `ts.isBlock`.
   */
  body: ts.Block | ts.Expression;
  /** Declared with the `export` modifier: callable from other modules, never `internal`. */
  exported: boolean;
  /** Owning class when this is a method or constructor; `params[0]` is then `this`. */
  struct?: StructInfo;
  role?: "method" | "constructor";
  /**
   * A statement of the body was rejected (WP10): the side tables for this
   * function are incomplete, so no IR is ever emitted for a program containing
   * it and whole-body checks (definite return) are skipped to avoid cascades.
   */
  poisoned?: boolean;
}

export interface LocalVar {
  name: string;
  type: StaticType;
  mutable: boolean;
  /** `param` locals are SSA values; `local` ones live in an alloca slot. */
  storage: "param" | "local";
}

/** One name brought in by `import { f, g as h } from "./m.js"`. */
export interface ImportBinding {
  /** The `import` statement. */
  node: ts.ImportDeclaration;
  /** Module specifier text: a relative path (`./math`) or a builtin module (`nish:fs`). */
  specifier: string;
  /** Name inside the exporting module. */
  importedName: string;
  /** Name inside this module (differs only with `as`). */
  localName: string;
  /** The specifier element, for error locations. */
  element: ts.ImportSpecifier;
  /** Resolved after all modules collected their signatures (pass 1b). */
  sig?: FunctionSig;
  /** Set instead of `sig` when the imported name is an exported class or interface (WP2). */
  struct?: StructInfo;
  /** Set instead of `sig` when the imported name is an exported module constant (WP14). */
  constant?: ConstInfo;
  /**
   * Set instead of `sig` when the specifier is a `nish:` module: the import
   * names a builtin, so there is no signature to bind and no symbol to
   * declare — only the canonical spelling the builtin tables are keyed by.
   */
  builtin?: BuiltinExport;
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
   * Module constants visible in this module by the name they are used under
   * (WP14): the ones it declares plus the ones it imports. A constant emits no
   * symbol — every reference folds to its value — so this table is the whole
   * of their existence.
   */
  constants: Map<string, ConstInfo>;
  /** Declared name -> constant, for every `export const` in this module. */
  exportedConstants: Map<string, ConstInfo>;
  /**
   * Local name -> the builtin a `nish:` import bound it to, under the name it
   * is used by (so an `as` rename is the key). Consulted before the ambient
   * builtin tables, which is what makes an import shadow-proof: a user
   * function of the same name is a collision at the import, not a silent
   * replacement of the builtin.
   */
  builtinImports: Map<string, BuiltinExport>;
  /**
   * Module-level `type` aliases, by the name they were declared under (WP23).
   * An alias emits nothing and is not a type of its own — it resolves to the
   * type it names — so this table exists only to answer an annotation and to
   * catch a name that is declared twice.
   */
  aliases: Map<string, AliasInfo>;
  /**
   * Set on the entry module when it declares `export function main`. The
   * emitter then adds the `define i32 @main(i32, i8**)` wrapper around it.
   */
  entryMain?: FunctionSig;
  /**
   * Some function reads `process.argv` (WP7). On the entry module the
   * Compilation also sets it when any imported module does, so the `@main`
   * wrapper calls `nish_argv_init` before the program runs.
   */
  usesArgv?: boolean;
  /** Expression node -> resolved StaticType. */
  types: WeakMap<ts.Node, StaticType>;
  /** Identifier node -> the variable it refers to. */
  bindings: WeakMap<ts.Identifier, LocalVar>;
  /** Identifier node -> the module constant it names, when it is not a variable (WP14). */
  constRefs: WeakMap<ts.Identifier, ConstInfo>;
  /**
   * Call or identifier node -> the canonical builtin it resolved to, for the
   * names a `nish:` import brought in. The emitter dispatches builtins on the
   * identifier's own text, which is the local name and may be an `as` rename,
   * so the checker records the spelling the emitter tables are keyed by rather
   * than leaving the emitter to work it back out.
   */
  builtinRefs: WeakMap<ts.Node, string>;
  /** VariableDeclaration node -> the local it introduces. */
  locals: WeakMap<ts.VariableDeclaration, LocalVar>;
  /** CallExpression node -> callee signature (free functions and methods alike). */
  callees: WeakMap<ts.CallExpression, FunctionSig>;
  /** Classes and interfaces visible in this module (declared or imported), keyed by name (WP2). */
  structs: Map<string, StructInfo>;
  /**
   * The entries of `structs` that this module never named: the layouts an
   * imported class dragged in through its own members (an `all(): Item[]`
   * hands out `Item` values in a module that never wrote `Item`). They are
   * not in scope as type names, and the emitter declares their symbols
   * exactly as it declares an imported class's.
   */
  reachableStructs: StructInfo[];
  /**
   * Expressions whose class-typed value is used where an interface it
   * implements is expected (WP2). `types` records the interface; the emitter
   * inserts one `bitcast` from `from` to `to`.
   */
  coercions: WeakMap<ts.Expression, { from: StaticType; to: StaticType }>;
  /**
   * `case` label -> the integer it selects on (WP14). The label is a constant
   * expression, folded here so the emitter can write LLVM's `switch` table
   * without re-deriving anything.
   */
  caseValues: WeakMap<ts.CaseClause, bigint>;
}
