/** Data model produced by the checker and consumed by the emitter. */
import ts from "typescript";
import { AliasInfo } from "./aliases.js";
import { EnumInfo } from "./enums.js";
import { Instantiation, StructInstantiation, StructTemplateInfo, TemplateInfo } from "./generics.js";
import { ConstInfo } from "./constants.js";
import { BuiltinExport } from "./nish-modules.js";
import { StaticType, alignOf, llvmType } from "../types.js";

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
  /**
   * WP15 §2a: some class in the program `implements` this interface, so it is
   * a *view* rather than a record and an `I[]` keeps one pointer per slot. Set
   * in `checkImplements` (pass 1c), which runs for every module before any
   * body is checked, and read by `inlineElementStruct`.
   */
  implemented?: boolean;
  /** Pass 1b progress, so a struct's members are collected once. */
  collected?: "collecting" | "done";
  decl: ts.ClassDeclaration | ts.InterfaceDeclaration;
  exported: boolean;
  /** A member or heritage clause was rejected (WP10): the layout is incomplete; skip follow-on checks. */
  poisoned?: boolean;
}

export interface FunctionSig {
  /**
   * The LLVM symbol (`@name`), and the key the whole-program fact fixpoint is
   * kept under (`src/codegen/attributes.ts`). It is the declared identifier
   * qualified with the module's package prefix (WP21 S1, `src/packages.ts`),
   * which is empty for the root package and therefore for every module of a
   * single-package program — so it still reads as the bare identifier in every
   * program that could be compiled before packages existed. The two other
   * spellings are unchanged: a method or constructor is `Owner.method`, and
   * the entry module's `export function main` is `@nish_main` so the C-ABI
   * wrapper can own `@main` (see `docs/wp5-modules.md`).
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
   * Where the declaration *begins*, which is what `-g` measures the function's
   * line and column from. For a `function`, a method and a constructor that is
   * `decl` itself; for the arrow form it is the `VariableStatement`, because
   * `export const add = (a: i32): i32 => ...` begins at `export` and not at the
   * arrow's parameter list.
   *
   * It is recorded rather than re-derived for the reason every position here is
   * recorded: `debug.ts` may not climb to a parent to find out what a node is
   * part of. Reading it off `decl` put an arrow-declared function at the column
   * of its parameter list — so the same function's debug info depended on which
   * of the two spellings declared it, and on a multi-line declaration the
   * `DISubprogram` named the wrong line as well. Stage1 needs no such field:
   * its parser normalises both spellings into one `N_FUNCTION` that already
   * spans the whole declaration (`self/parser.ts`, WP22 §8).
   */
  declSite: ts.Node;
  /**
   * The body, normalised. A `function`, a method and a constructor always carry
   * a `Block`; an arrow may carry a concise body (`=> n * 2`), which means
   * exactly what a block with one `return` means (WP22 §4). The four places
   * that walk a body branch on `ts.isBlock`.
   */
  body?: ts.Block | ts.Expression;
  /**
   * `declare function f(...): T;` — a C function this program calls but does
   * not define (WP27 S1). There is no body, so there is nothing to check, emit
   * or analyse: the emitter writes a `declare` line instead of a `define`, and
   * the fact fixpoint treats a call to one as the worst case it cannot see
   * inside (`src/codegen/attributes.ts`). `body` is absent exactly when this is
   * set, which is what the four body walkers branch on.
   */
  foreign?: boolean;
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
  /**
   * WP18: set when this signature is one instantiation of a generic template
   * rather than a declared function. It carries the node-keyed tables the
   * template's body was checked into for *this* type-argument tuple, which is
   * what every pass that walks the body swaps in (`checker/generics.ts`).
   */
  instance?: Instantiation;
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
  /**
   * The package this module belongs to (WP21 S1, `src/packages.ts`). `""` is
   * the root package — the program being compiled — which is where every
   * module of a single-package build lives.
   */
  packageName: string;
  /**
   * The prefix every symbol declared in this module carries; `""` for the root
   * package. `FunctionSig.name` already has it applied, so nothing downstream
   * has to remember to apply it. The field is kept so that a diagnostic can
   * name the package a clash is inside and the `--emit-checked` dump can say
   * which package a module came from.
   */
  symbolPrefix: string;
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
   * Numeric `enum` declarations, by the name they were declared under (WP23).
   * An enum is a distinct type with `i32` representation, and its members are
   * folded here, so this table answers an annotation (`Kind`) and a member
   * reference (`Kind.If`) and the emitter never reads it.
   */
  enums: Map<string, EnumInfo>;
  /**
   * `Kind.If` -> the integer it stands for (WP23). The checker folds it, the
   * emitter writes the literal, exactly as `constRefs` works for a module
   * constant — which is why an enum emits no symbol and no table.
   */
  enumRefs: WeakMap<ts.PropertyAccessExpression, bigint>;
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
  /**
   * Generic function templates declared in this module, by source name (WP18).
   * A template is not a function: it has no signature, no symbol and no body
   * of its own in `functions`, and only its instantiations are checked and
   * emitted.
   */
  templates: Map<string, TemplateInfo>;
  /**
   * Every instantiation this module owns, keyed by its mangled symbol and in
   * discovery order — which is the order they are appended to `functions`, the
   * order they are emitted in, and the order `--emit-checked` prints them, so
   * the two compilers can be compared before the IR is (`docs/wp18-generics.md` §3a).
   */
  instantiations: Map<string, Instantiation>;
  /**
   * Generic classes and interfaces this module declares (WP18 G5), keyed by the
   * name as written. Like a function template, a struct template is *not* in
   * `structs`: it has no fields and no layout until an instantiation binds its
   * parameters, so `Box` on its own never becomes a `%struct`.
   */
  structTemplates: Map<string, StructTemplateInfo>;
  /**
   * Every instantiated generic struct, keyed by its mangled name (`Box$i32`)
   * and in discovery order. The `StructInfo` each one carries is also in
   * `structs` under the same key and is an ordinary struct in every way
   * (`docs/wp18-generics.md` §3c); this map is what remembers the *arguments*
   * it was made from, which the termination rule and inference read back.
   */
  structInstantiations: Map<string, StructInstantiation>;
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
  /**
   * Element accesses and `charCodeAt` calls whose index the bounds analysis
   * proved in range (WP15 §2.1/§2.2, `bounds.ts`). The emitter writes the
   * address and no check for each of them, and `collectArrayFacts` leaves
   * `nish_panic_index` out of the callee set — which is the whole of what the
   * proof buys, and the reason it lives in a table the emitter reads rather
   * than in a decision the emitter makes.
   */
  provenIndices: WeakSet<ts.Node>;
  /**
   * `substring` bounds the same analysis placed in `[0, s.length]`, keyed by
   * the bound expression rather than by the call, because one end of an
   * `s.substring(0, n)` is usually proven and the other is not.
   *
   * This is not a bounds *check*. JavaScript's `substring` clamps each end into
   * `[0, len]`, which `emit/strings.ts` writes as an `llvm.smin` / `llvm.smax`
   * pair, and that clamp is the semantics rather than a safety net —
   * `--unchecked-indexing` does not remove it and must not. What the proof buys
   * is that a bound the clamp cannot move needs no clamp, so the emitter writes
   * the value straight through. A literal `0` is in here for every string,
   * because no string has a negative length, which is why the commonest
   * spelling there is — `s.substring(0, n)` — loses two of its six intrinsic
   * calls without a guard being written anywhere.
   */
  provenClamps: WeakSet<ts.Node>;
}

/**
 * WP15 §2a: how one element of a `T[]` is stored.
 *
 * An array of **records** is contiguous storage — `N` of them end to end in
 * one block — so `ps[i]` is an interior `getelementptr` rather than a load of
 * a pointer followed by a chase to wherever that pointer went. That is what
 * puts a cache line's worth of fields in front of the CPU instead of a cache
 * line's worth of addresses, and what makes a loop over `Point[]` vectorisable.
 *
 * **A record is an `interface`, and only an `interface`.** The language has
 * two struct kinds and they already mean different things
 * (`docs/LANGUAGE.md`): an `interface` is fields and nothing else — no
 * constructor, no methods, no `this` — so the only thing a program can observe
 * about one is its fields, and copying it into a slot is indistinguishable
 * from pointing at it. A `class` has identity: a constructor runs on one
 * object, a method mutates the `this` it was handed, and every other position
 * in the language (a parameter, a field, a return, a local) passes a class
 * value by reference. Making an array the single place a class is *copied*
 * would give `xs.push(c); c.m()` a different meaning from
 * `xs.push(c); xs[n].m()`, and nothing else in the language works that way.
 *
 * This is not a conservative guess, it is measured on the largest Nish program
 * there is. `self/` keeps one `FunctionSig` in `program.functions`, in
 * `StructInfo.methodSigs` and in `StructInfo.ctor` at once and then writes
 * `sig.poisoned` through one of them; with value slots those are three
 * objects and the write is lost. Every registry in that compiler is built the
 * same way, and the aliasing is not confined to registries: 54 comparisons
 * across ten modules ask whether an element of a `Local[]` or a `Node[]` *is*
 * a given object, twenty of them in `self/bounds.ts`, where the seven lines
 * that retract a fact do it by testing `!==` against the variable being
 * clobbered — an identity test that never matches leaves the fact standing and
 * the compiler emits no bounds check where one is needed.
 *
 * So a **contiguous *class* array is not deferred work, it is a decision**: an
 * array of classes is one pointer per slot, permanently, and a program that
 * wants the contiguous layout spells the element type `interface`. §2a of
 * `docs/wp15-performance.md` has the costing, the counting rule behind each
 * number, and the goldens that catch the failure.
 *
 * **An interface some class `implements` is not a record either.** `implements`
 * is prefix subtyping reached through a `bitcast` (WP25), so a `Shape[]` may
 * hold a `Square` and a `Circle` at once and both are longer than `Shape`;
 * storing one by value would copy the prefix and drop the rest, which is C++'s
 * object slicing. That array is the language's only polymorphic container and
 * it keeps the pointer that makes the widening free. The property is
 * program-wide and is recorded on the shared `StructInfo` by `checkImplements`,
 * so every module of one compilation agrees about the layout.
 *
 * `I | null` also stays a pointer: a null element has no bytes to be, and
 * `null` is the pointer. That spelling is the way to ask for a sparse array
 * of records, and the way out of the copy semantics below.
 *
 * The layout is what makes an element *reference* interior rather than
 * independent, and that has two consequences the checker owns rather than the
 * emitter (`checkElementReferences` in `checker/arrays.ts`): a reference into
 * the storage dangles once `push` moves it, and a record stored into an array
 * is *copied* into the slot, the way a C array of structs copies.
 */
export function inlineElementStruct(
  structs: Map<string, StructInfo>,
  elem: StaticType
): StructInfo | undefined {
  if (elem.kind !== "struct") return undefined;
  const info = structs.get(elem.name);
  if (info === undefined || info.kind !== "interface" || info.implemented === true) return undefined;
  return info;
}

/**
 * Bytes from one element to the next. For an inline struct that is `sizeof`
 * exactly as clang computes it — the stride a C `struct Point[]` has, which is
 * what lets a C host walk the same block — and for everything else the value's
 * natural size, which is its alignment.
 */
export function elementStride(structs: Map<string, StructInfo>, elem: StaticType): number {
  return inlineElementStruct(structs, elem)?.size ?? alignOf(elem);
}

/**
 * Alignment of one element slot. An inline struct's is its own maximum field
 * alignment; the block is 8-aligned and the stride is a multiple of that
 * alignment, so every slot is aligned and every field inside it keeps the
 * alignment `emit/classes.ts` states for it.
 */
export function elementAlign(structs: Map<string, StructInfo>, elem: StaticType): number {
  return inlineElementStruct(structs, elem)?.align ?? alignOf(elem);
}

/** The LLVM type of one element slot: `%struct.P` inline, the value type otherwise. */
export function elementLLVMType(structs: Map<string, StructInfo>, elem: StaticType): string {
  const inline = inlineElementStruct(structs, elem);
  return inline === undefined ? llvmType(elem) : `%struct.${inline.name}`;
}
