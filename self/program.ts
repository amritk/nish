// The data model the checker fills and the emitter reads (`src/checker/program.ts`),
// for stage1 (docs/wp14-selfhost.md, milestone S3).
//
// Two changes of shape, both forced and both improvements:
//
//   - **Side tables are arrays indexed by `Node.id`**, not `WeakMap`s keyed by
//     node. the language has no `WeakMap`; a dense array is also one index rather
//     than a hash of a pointer, and the parser hands out the ids as it builds
//     the tree, so the size is known before the checker starts. The rule the
//     `WeakMap`s exist for still holds: the AST carries syntax only, the
//     checker records, and the emitter reads what was recorded rather than
//     re-deriving it.
//   - **A type is an `i32`** (`self/types.ts`), so every `StaticType` field
//     here is a type id into the compilation's one `TypeTable`.
//
// Everything that can point at another module — a struct, a callee, a base
// class — is a reference to the object rather than an index, because an index
// would be into the wrong module's list. Everything local is an index.

import { CheckContext } from "./context";
import { SourceFile } from "./diagnostics";
import { BuiltinExport } from "./nish_modules";
import { StringMap, StringSet } from "./map";
import { FLAG_FOREIGN, N_CONSTRUCTOR, N_EMPTY, N_MEMBER, Node } from "./nodes";
import { packageSymbolPrefix } from "./packages";
import { Local } from "./symbols";
import { TypeTable } from "./types";

/** What a `FunctionSig` is: a free function, a method, or a constructor. */
export const ROLE_FUNCTION: i32 = 0;
export const ROLE_METHOD: i32 = 1;
export const ROLE_CONSTRUCTOR: i32 = 2;

export const STRUCT_CLASS: i32 = 0;
export const STRUCT_INTERFACE: i32 = 1;

/**
 * One function, method or constructor.
 *
 * Parameters are parallel arrays rather than a `Param[]`: a signature is read
 * far more often than it is built, and this is one allocation instead of one
 * per parameter. For a method or constructor `params[0]` is `this`.
 */
export class FunctionSig {
  /**
   * The LLVM symbol (`@name`), and the key the whole-program fact fixpoint is
   * kept under (`self/attributes.ts`). It is the declared identifier qualified
   * with the module's package prefix (WP21 S1, `self/packages.ts`), which is
   * empty for the root package and so for every module of a single-package
   * program. `Owner.method` for a member, and `main` in the entry module is
   * `@nish_main`.
   */
  name: string;
  /** The identifier as written; for a method it reads `Owner.method`. */
  sourceName: string;
  paramNames: string[];
  paramTypes: i32[];
  returnType: i32;
  decl: Node;
  /** The module that declares it, so pass 2 skips the ones it only imported. */
  origin: SourceFile | null;
  exported: boolean;
  role: i32;
  /** The class this is a member of, or `null` for a free function. */
  owner: StructInfo | null;
  /** A statement of the body was rejected: no IR is emitted for this program. */
  poisoned: boolean;
  /**
   * WP18: set when this signature is one instantiation of a generic template
   * rather than a declared function. It carries the side tables the template's
   * body was checked into for *this* type-argument tuple, which every pass that
   * walks the body installs before it starts (`CheckedProgram.enterInstance`).
   */
  instance: Instantiation | null;

  /**
   * The body, or `null` when the declaration has none. A `BLOCK` for every
   * form but the concise arrow body (`=> n * 2`), which is the expression it
   * returns (docs/wp22-arrow-functions.md §4); the two callers that want a
   * statement list check `kind === N_BLOCK` for themselves, and the analyses
   * that only walk the tree take either.
   */
  body(): Node | null {
    const node = this.decl.kind === N_CONSTRUCTOR ? this.decl.children[1] : this.decl.children[3];
    return node.kind === N_EMPTY ? null : node;
  }

  /**
   * `declare function f(...): T;` — a C function this program calls but does not
   * define (WP27 S1). Derived from the parser's flag rather than stored, so
   * there is one place that decides what a foreign declaration is.
   *
   * `body()` above already answers `null` for one, because the parser puts the
   * empty node where the block goes; this is what tells a foreign declaration
   * apart from the other reason a body can be missing.
   */
  foreign(): boolean {
    return (this.decl.flags & FLAG_FOREIGN) !== 0;
  }

  /**
   * Whether this module *defines* the function rather than importing it. Pass
   * 1b appends an imported signature to the importer's `functions`, so the
   * emitter and the attribute analysis both need the distinction, and
   * `origin` is nullable until pass 1 fills it in.
   */
  definedIn(source: SourceFile): boolean {
    const origin = this.origin;
    return origin !== null && origin === source;
  }

  constructor(name: string, sourceName: string, decl: Node) {
    this.name = name;
    this.sourceName = sourceName;
    this.paramNames = [];
    this.paramTypes = [];
    this.returnType = 0;
    this.decl = decl;
    this.origin = null;
    this.exported = false;
    this.role = ROLE_FUNCTION;
    this.owner = null;
    this.poisoned = false;
    this.instance = null;
  }
}

/**
 * What a template's `<T extends Shape>` clauses resolved to (WP18 G6): one
 * struct type id per type parameter, in declaration order, or -1 for a
 * parameter written without `extends` and for one whose constraint was
 * refused. Resolved once, in the template's own module with no type parameter
 * bound, the first time anybody asks — which is its declaration in pass 1, or
 * an earlier request for it — so a bad constraint is reported once per
 * template however many instantiations there are.
 */
export class ConstraintList {
  types: i32[];
  resolved: boolean;
  /** Set while the list is being resolved, so a constraint that names its own template does not loop. */
  resolving: boolean;

  constructor() {
    this.types = [];
    this.resolved = false;
    this.resolving = false;
  }

  /** The constraint of parameter `index`, or -1 when it has none (or is not resolved yet). */
  at(index: i32): i32 {
    return index >= 0 && index < this.types.length ? this.types[index] : -1;
  }
}

/**
 * A generic function declaration (WP18). Nothing about it is resolved: the
 * parameter and return annotations mention `typeParams`, so they mean nothing
 * until an instantiation binds them, and a template therefore has no signature,
 * no symbol and no entry in `functions`.
 */
export class TemplateInfo {
  /**
   * The identifier as written; what every diagnostic about the template names.
   * A generic method's reads `Owner.method`, with the owner as `typeName`
   * spells it (`Box<i32>.pick`), so its instantiations display as
   * `Box<i32>.pick<string>` (WP18 G8).
   */
  sourceName: string;
  /**
   * The receiver of a generic method (WP18 G8), or `null` for a function. A
   * method template is minted per receiver struct — once for a declared class,
   * once per instantiation of a generic one — so one template is one
   * (receiver × method) and its instantiations are keyed by the method tuple.
   */
  owner: StructInfo | null;
  /** `<T, U>` in declaration order; an instantiation's tuple has the same order. */
  typeParams: string[];
  /** Each parameter's constraint (WP18 G6); see `ConstraintList`. */
  constraints: ConstraintList;
  /** The `N_FUNCTION` node, in either spelling. */
  decl: Node;
  origin: SourceFile;
  exported: boolean;
  /** How many instantiations it has produced, for the per-template cap. */
  count: i32;
  /**
   * The module that declares it, which is where every instantiation of it is
   * made (WP18 G7).
   *
   * A template is monomorphised in the scope its body was written in, whoever
   * asked: the annotations it resolves name that module's classes and its own
   * imports, and its symbols belong to that module's package. A request from
   * another module is forwarded here rather than answered where it was written.
   */
  home: CheckContext;

  constructor(sourceName: string, decl: Node, origin: SourceFile, home: CheckContext) {
    this.sourceName = sourceName;
    this.owner = null;
    this.typeParams = [];
    this.constraints = new ConstraintList();
    this.decl = decl;
    this.origin = origin;
    this.exported = false;
    this.count = 0;
    this.home = home;
  }
}

/**
 * A generic class or interface declaration (WP18 G5). It is `TemplateInfo` one
 * level up: nothing below the name is resolved, because the field, method and
 * heritage annotations mention the type parameters and mean nothing until an
 * instantiation binds them.
 */
export class StructTemplateInfo {
  /** The identifier as written; what every diagnostic about the template names. */
  sourceName: string;
  /** `STRUCT_CLASS` or `STRUCT_INTERFACE`; an instantiation inherits it. */
  kind: i32;
  /** `<T, U>` in declaration order; an instantiation's tuple has the same order. */
  typeParams: string[];
  /** Each parameter's constraint (WP18 G6); see `ConstraintList`. */
  constraints: ConstraintList;
  /** The `N_CLASS` or `N_INTERFACE` node. */
  decl: Node;
  origin: SourceFile;
  exported: boolean;
  /** How many instantiations it has produced, for the per-template cap. */
  count: i32;
  /** The module that declares it; `TemplateInfo.home` one level up (WP18 G7). */
  home: CheckContext;

  constructor(sourceName: string, kind: i32, decl: Node, origin: SourceFile, home: CheckContext) {
    this.sourceName = sourceName;
    this.kind = kind;
    this.typeParams = [];
    this.constraints = new ConstraintList();
    this.decl = decl;
    this.origin = origin;
    this.exported = false;
    this.count = 0;
    this.home = home;
  }
}

/**
 * One (struct template, type-argument tuple): the ordinary struct it names.
 *
 * `docs/wp18-generics.md` §3c is what makes this affordable — `info` is an
 * ordinary `StructInfo` called `Box$i32`, so the layout computation, the
 * `implements` check, the struct type declarations, the debug info and the C
 * header all work on it with no change at all. What this record adds is the
 * memory of which *arguments* produced it, which the termination rule and
 * inference read back because the struct type itself carries none.
 */
export class StructInstantiation {
  template: StructTemplateInfo;
  /** One concrete type id per entry of `template.typeParams`, in that order. */
  typeArgs: i32[];
  info: StructInfo;
  /** Type parameter name -> the type id it stands for. */
  bindings: StringMap;
  /**
   * The struct instantiation whose members or whose method body asked for this
   * one, or `null` for one named by ordinary code. The chain is what the
   * termination rule walks and what its diagnostic quotes.
   */
  from: StructInstantiation | null;

  constructor(template: StructTemplateInfo, typeArgs: i32[], info: StructInfo, bindings: StringMap) {
    this.template = template;
    this.typeArgs = typeArgs;
    this.info = info;
    this.bindings = bindings;
    this.from = null;
  }
}

/**
 * One (template, type-argument tuple): the specialised function it names, and
 * the side tables its body is checked into.
 *
 * The tables are a full copy rather than a window on the template's node-id
 * span (`docs/wp18-generics.md` §3d's fallback): it costs memory on a program
 * that instantiates something and nothing at all on one that does not, and it
 * needs no invariant about how the parser hands out ids.
 */
export class Instantiation {
  /**
   * The generic function or generic method this specialises (a *request*), or
   * `null` when it is a non-generic method or the constructor of an
   * instantiated generic class, collected with its class — which needs the
   * overlay and the type bindings for exactly the same reason and has no
   * template of its own, because the class is the template (WP18 G5). A
   * generic method of a generic class has both this and `owner`: its own type
   * parameters come from the template, its class's from the owner (WP18 G8).
   */
  template: TemplateInfo | null;
  /**
   * The instantiated class whose parameters are bound in this body: the class
   * a collected member belongs to, or the receiver of a generic method (WP18
   * G8), set alongside `template` when that method is itself generic. `null`
   * for a free function and for a generic method of a declared class.
   */
  owner: StructInstantiation | null;
  /** One concrete type id per entry of `template.typeParams`, in that order. */
  typeArgs: i32[];
  sig: FunctionSig;
  /** Type parameter name -> the type id it stands for. */
  bindings: StringMap;
  nodeTypes: i32[];
  nodeLocals: (Local | null)[];
  nodeConstants: (ConstInfo | null)[];
  nodeCallees: (FunctionSig | null)[];
  nodeCoercions: i32[];
  nodeCaseValues: i64[];
  /**
   * The instantiation whose body asked for this one, or `null` for one
   * requested from ordinary code. The chain is what the termination rule walks
   * and what its diagnostic quotes.
   */
  from: Instantiation | null;

  constructor(template: TemplateInfo | null, typeArgs: i32[], sig: FunctionSig, bindings: StringMap, nodeCount: i32) {
    this.template = template;
    this.owner = null;
    this.typeArgs = typeArgs;
    this.sig = sig;
    this.bindings = bindings;
    this.nodeTypes = new Array<i32>(nodeCount);
    this.nodeLocals = new Array<Local | null>(nodeCount);
    this.nodeConstants = new Array<ConstInfo | null>(nodeCount);
    this.nodeCallees = new Array<FunctionSig | null>(nodeCount);
    this.nodeCoercions = new Array<i32>(nodeCount);
    this.nodeCaseValues = new Array<i64>(nodeCount);
    this.from = null;
    let i = 0;
    while (i < nodeCount) {
      this.nodeTypes[i] = -1;
      this.nodeCoercions[i] = -1;
      i = i + 1;
    }
  }
}

/** A field of a class or interface, with its computed layout slot. */
export class FieldInfo {
  name: string;
  type: i32;
  /** Position in the LLVM struct body (`getelementptr ... i32 0, i32 <index>`). */
  index: i32;
  /** Byte offset, laid out exactly as clang lays out the equivalent C struct. */
  offset: i32;
  /** `readonly` fields may only be assigned through `this` in the constructor. */
  readonly: boolean;
  /** `x: number = 0`, stored before the constructor body runs; else `null`. */
  initializer: Node | null;
  decl: Node;

  constructor(name: string, type: i32, decl: Node) {
    this.name = name;
    this.type = type;
    this.index = 0;
    this.offset = 0;
    this.readonly = false;
    this.initializer = null;
    this.decl = decl;
  }
}

/** A class or interface: one `%struct.<name>` LLVM type with fixed fields. */
export class StructInfo {
  name: string;
  kind: i32;
  /** The `TypeTable` id of `%struct.<name>*`. */
  type: i32;
  fields: FieldInfo[];
  /** Field name -> index into `fields`. */
  fieldIndex: StringMap;
  /** `sizeof` in bytes, including trailing padding to `align`. */
  size: i32;
  /** Maximum field alignment; 1 when there are no fields. */
  align: i32;
  /** Method source name -> index into `methodSigs`, in declaration order. */
  methodIndex: StringMap;
  methodSigs: FunctionSig[];
  /**
   * Generic methods (WP18 G8), by source name -> index into `methodTemplateList`.
   * A generic method has no signature until a call picks its type arguments, so
   * it is a template here rather than an entry of `methodSigs`.
   */
  methodTemplates: StringMap;
  methodTemplateList: TemplateInfo[];
  /** The explicit constructor; without one, `new` stores the field initializers inline. */
  ctor: FunctionSig | null;
  /**
   * Interfaces named in `implements`. Each one's fields are the *first* fields
   * of this struct — same order, same types, same offsets — so a
   * `%struct.<name>*` may be `bitcast` to the interface's with no adjustment.
   */
  implementsNames: string[];
  /**
   * WP15 section 2a: some class in the program `implements` this interface, so
   * it is a *view* rather than a record and an `I[]` keeps one pointer per
   * slot. Set in `checkImplements` (pass 1c), which runs for every module
   * before any body is checked, and read by `inlineElementStruct`.
   */
  implemented: boolean;
  decl: Node;
  /** The module that declares it, so an importer can tell it from a re-export. */
  origin: SourceFile;
  exported: boolean;
  /** A member or heritage clause was rejected: the layout is incomplete. */
  poisoned: boolean;
  /** Pass 1b progress, so a struct is collected once. */
  collected: boolean;
  /**
   * The (template, type-argument tuple) this layout was monomorphised from, or
   * `null` for a class or interface somebody declared (WP18 G5).
   *
   * It is on the layout rather than only in `CheckedProgram.structInstantiations`
   * because the arguments have to be readable wherever the *struct* is visible:
   * an instantiated class is an ordinary struct and its type carries no
   * arguments at all, and since G7 the module that declares the template is not
   * necessarily the module asking. `FunctionSig.instance` is the same field one
   * level down, for the same reason.
   */
  instance: StructInstantiation | null;

  constructor(name: string, kind: i32, type: i32, decl: Node, origin: SourceFile) {
    this.name = name;
    this.kind = kind;
    this.origin = origin;
    this.type = type;
    this.instance = null;
    this.fields = [];
    this.fieldIndex = new StringMap();
    this.size = 0;
    this.align = 1;
    this.methodIndex = new StringMap();
    this.methodSigs = [];
    this.methodTemplates = new StringMap();
    this.methodTemplateList = [];
    this.ctor = null;
    this.implementsNames = [];
    this.implemented = false;
    this.decl = decl;
    this.exported = false;
    this.poisoned = false;
    this.collected = false;
  }

  /** The field called `name` on this struct, or `null`. */
  field(name: string): FieldInfo | null {
    const at = this.fieldIndex.get(name, -1);
    return at < 0 ? null : this.fields[at];
  }

  /** The method called `name`, or `null` when there is none. */
  method(name: string): FunctionSig | null {
    const at = this.methodIndex.get(name, -1);
    return at < 0 ? null : this.methodSigs[at];
  }

  /**
   * Whether any member is called `name`: a field, a method or a generic method.
   * One question for both member collectors, so a member table added later
   * cannot be left out of one of them (WP18 G8 added the third).
   */
  hasMember(name: string): boolean {
    return this.fieldIndex.has(name) || this.methodIndex.has(name) || this.methodTemplates.has(name);
  }

  /** The generic method called `name` (WP18 G8), or `null` when there is none. */
  methodTemplate(name: string): TemplateInfo | null {
    const at = this.methodTemplates.get(name, -1);
    return at < 0 ? null : this.methodTemplateList[at];
  }

}

/**
 * A module constant. It emits no symbol — every reference folds to the value —
 * so this record is the whole of its existence. The value lives in the field
 * its type selects: `intValue` for the integer widths and `boolean`,
 * `floatValue` for `f32` and `f64`, `textValue` for `string`.
 */
export class ConstInfo {
  name: string;
  type: i32;
  intValue: i64;
  floatValue: f64;
  textValue: string;
  exported: boolean;
  decl: Node;
  /** The module that declares it, so a dump can list it under its own module. */
  origin: SourceFile;
  /**
   * The constants visible where this one was declared, so an initialiser can
   * name an earlier constant of the same module or one it imported. Set once
   * the declaring module has collected its signatures.
   */
  scope: CheckedProgram | null;
  /** Memoised fold, and the in-progress mark that catches a cycle. */
  folded: boolean;
  folding: boolean;

  constructor(name: string, type: i32, decl: Node, origin: SourceFile) {
    this.name = name;
    this.type = type;
    this.intValue = toI64(0);
    this.floatValue = 0.0;
    this.textValue = "";
    this.exported = false;
    this.decl = decl;
    this.origin = origin;
    this.scope = null;
    this.folded = false;
    this.folding = false;
  }
}

/**
 * A module-level `type` alias. It is not a type of its own: `type Byte = u8`
 * says that `Byte` and `u8` are two spellings of one type, so this record
 * holds a type id and the emitter never hears of it (`src/checker/aliases.ts`).
 *
 * Resolution is lazy and memoised, for the reasons `ConstInfo`'s fold is: an
 * alias may name a class declared further down the file, or another alias, and
 * one that names itself has to be caught rather than followed forever.
 */
export class AliasInfo {
  name: string;
  decl: Node;
  /** The module that declares it; an alias never leaves the one that wrote it. */
  origin: SourceFile;
  /** The resolved type id, or -1 while it is still a name. */
  type: i32;
  /** In progress, which is how a cycle is caught. */
  resolving: boolean;

  constructor(name: string, decl: Node, origin: SourceFile) {
    this.name = name;
    this.decl = decl;
    this.origin = origin;
    this.type = -1;
    this.resolving = false;
  }
}

/**
 * A numeric `enum` declaration (WP23). It is a distinct type with `i32`
 * representation, and its members are folded when the declaration is read, so
 * this record answers an annotation (`Kind`) and a member reference
 * (`Kind.If`) and the emitter never hears of it — `Kind.If` lowers to the
 * literal the checker wrote into `nodeEnumValues` (`src/checker/enums.ts`).
 */
export class EnumInfo {
  name: string;
  decl: Node;
  /** The module that declares it; an enum never leaves the one that wrote it. */
  origin: SourceFile;
  /** The distinct type id, shared by every annotation that names it. */
  type: i32;
  /** Member name -> index into `memberValues`; iteration order is declaration order. */
  members: StringMap;
  memberNames: string[];
  memberValues: i32[];

  constructor(name: string, decl: Node, origin: SourceFile, type: i32) {
    this.name = name;
    this.decl = decl;
    this.origin = origin;
    this.type = type;
    this.members = new StringMap();
    this.memberNames = [];
    this.memberValues = [];
  }

  addMember(name: string, value: i32): void {
    this.members.set(name, this.memberValues.length);
    this.memberNames.push(name);
    this.memberValues.push(value);
  }

  hasMember(name: string): boolean {
    return this.members.has(name);
  }

  /** The integer `name` stands for; the caller has already asked `hasMember`. */
  memberValue(name: string): i32 {
    return this.memberValues[this.members.get(name, 0)];
  }
}

/**
 * `Box<i32>` written in a *signature* annotation, where `Box` is imported
 * (WP18 G7).
 *
 * Pass 1 runs before pass 1b has bound a single import — a module's signatures
 * are collected the moment it is parsed, which is what makes an import cycle
 * legal — so the template is not in hand when the annotation is resolved and
 * there is no layout to build. The *name* is knowable anyway, because an
 * instantiation is `instanceSymbol(<the exporter's name>, <the arguments>)` and
 * both halves are in hand, so the annotation resolves to the struct it is going
 * to be and the request itself is made as soon as every module has bound.
 */
export class DeferredInstance {
  imp: ImportBinding;
  args: i32[];
  at: Node;

  constructor(imp: ImportBinding, args: i32[], at: Node) {
    this.imp = imp;
    this.args = args;
    this.at = at;
  }
}

/**
 * A struct instantiation whose constraints could not be checked when it was
 * requested (WP18 G6), because the request came from pass 1: `Holder<Circle>`
 * in a signature above `class Circle implements Shape` is resolved before
 * Circle's `implements` clause has been read, and an imported class has no
 * members here until its import is bound. The instantiation is made anyway, as
 * every declaration-level request is, and the check runs in pass 1b.
 */
export class DeferredConstraint {
  template: StructTemplateInfo;
  args: i32[];
  at: Node;

  constructor(template: StructTemplateInfo, args: i32[], at: Node) {
    this.template = template;
    this.args = args;
    this.at = at;
  }
}

/** One name brought in by `import { f, g as h } from "./m"`. */
export class ImportBinding {
  /** Module specifier text: a relative path (`./math`) or a builtin module (`nish:fs`). */
  specifier: string;
  /** Name inside the exporting module. */
  importedName: string;
  /** Name inside this module; differs only with `as`. */
  localName: string;
  /** The specifier element, for error spans. */
  node: Node;
  /**
   * The `import` statement it came from. A diagnostic about the *module* —
   * "cannot find" — points at the module specifier, which stage0 has as a node
   * and this tree keeps as text on this one (`CheckContext.errorAtSpecifier`).
   */
  decl: Node;
  /** Exactly one of these is set in pass 1b, or none if the import failed. */
  sig: FunctionSig | null;
  struct: StructInfo | null;
  constant: ConstInfo | null;
  /**
   * Set instead of the three above when the specifier is a `nish:` module: the
   * import names a builtin, so there is no signature to bind and no symbol to
   * declare, only the canonical spelling the builtin checkers are keyed by.
   */
  builtin: BuiltinExport | null;
  /**
   * Set instead of the four above when the imported name is an exported generic
   * function (WP18 G7). There is no one signature to bind: the import names a
   * template, and each type-argument tuple a call site here picks becomes a
   * symbol of its own, defined by the module that declares it and listed in
   * `externalInstances`.
   */
  template: TemplateInfo | null;
  /** The same, one level up: an exported generic class or interface (WP18 G7). */
  structTemplate: StructTemplateInfo | null;

  constructor(specifier: string, importedName: string, localName: string, node: Node, decl: Node) {
    this.specifier = specifier;
    this.importedName = importedName;
    this.localName = localName;
    this.node = node;
    this.decl = decl;
    this.sig = null;
    this.struct = null;
    this.constant = null;
    this.builtin = null;
    this.template = null;
    this.structTemplate = null;
  }
}

/**
 * Every class and interface declared anywhere in the program, by name.
 *
 * A struct name is already a program-wide symbol (`%struct.<name>` and
 * `@<name>.method`), so a collision is a broken program either way and the
 * first declaration wins here, as it does in `src/compilation.ts`.
 */
export class StructRegistry {
  index: StringMap;
  list: StructInfo[];

  constructor() {
    this.index = new StringMap();
    this.list = [];
  }

  add(info: StructInfo): void {
    if (!this.index.has(info.name)) {
      this.index.set(info.name, this.list.length);
      this.list.push(info);
    }
  }

  get(name: string): StructInfo | null {
    const at = this.index.get(name, -1);
    return at < 0 ? null : this.list[at];
  }
}

/**
 * Everything the checker knows about one module.
 *
 * The `node*` arrays are the side tables, indexed by `Node.id`. They are
 * allocated once at the size the parser reports, because growing them per
 * write would cost a bounds check and a possible copy on the checker's
 * hottest path.
 */
export class CheckedProgram {
  source: SourceFile;
  /** The `N_SOURCE_FILE` this module parsed to. */
  file: Node;
  isEntry: boolean;
  /**
   * The package this module belongs to (WP21 S1, `self/packages.ts`). `""` is
   * the root package — the program being compiled — which is where every
   * module of a single-package build lives.
   */
  packageName: string;
  /**
   * The prefix every symbol declared in this module carries; `""` for the root
   * package. `FunctionSig.name` already has it applied, so nothing downstream
   * has to remember to apply it. The field is kept so a diagnostic can name
   * the package a clash is inside and `--emit-checked` can say which package a
   * module came from.
   */
  symbolPrefix: string;

  /** Functions defined in this module, in source order. */
  functions: FunctionSig[];
  /** Source name -> index into `functions`, for every `export function`. */
  exports: StringMap;
  imports: ImportBinding[];

  /**
   * Name -> index into `structList`, for every class and interface whose
   * *layout* is known here: the ones this module declares, the ones it
   * imports, and the ones an imported class dragged in through its members.
   */
  structs: StringMap;
  structList: StructInfo[];
  /** Indices into `structList` that this module never named; see `src/checker/index.ts`. */
  reachableStructs: i32[];
  /**
   * Instantiations this module *calls* but does not define: WP18 G7's half of
   * an import. A generic is monomorphised once, in the module that declares the
   * template, so a caller in another module links against that one `define` and
   * needs a `declare` for it — which is what an imported plain function gets
   * through `imports`, and what a template has no `ImportBinding` to hang on
   * because one import can become any number of symbols.
   */
  externalInstances: FunctionSig[];
  /** The symbols already in `externalInstances`, so each is declared once. */
  externalInstanceNames: StringSet;
  /** Requests pass 1 could only write down; `Checker.makeDeferredInstantiations` makes them. */
  deferredInstances: DeferredInstance[];
  /**
   * The struct names this module may *write* as a type: what it declares and
   * what it imports. Narrower than `structs`, which also holds the reachable
   * layouts, and resolving an annotation against the wider map would make a
   * name legal in a module that never imported it.
   */
  typeNames: StringSet;
  /**
   * Imported names used in type position before pass 1b could say what they
   * are. They resolve provisionally to `%struct.<name>`, and binding rejects
   * the ones that turn out to be functions or constants.
   */
  importsUsedAsTypes: StringSet;

  /** Name -> index into `constantList`, for the constants visible here. */
  constants: StringMap;
  constantList: ConstInfo[];
  /** Local name -> index into `builtinImportList`, for the `nish:` imports. */
  builtinImports: StringMap;
  builtinImportList: BuiltinExport[];

  /** Name -> index into `aliasList`, for the `type` aliases this module declares. */
  aliases: StringMap;
  aliasList: AliasInfo[];

  /**
   * Generic templates this module declares, by source name, and the ones it has
   * instantiated, by mangled symbol (WP18). An instantiation is appended in
   * discovery order, which is the order it is checked, emitted and dumped in —
   * so the two compilers can be compared before any IR is.
   */
  templates: StringMap;
  templateList: TemplateInfo[];
  instantiations: StringMap;
  instantiationList: Instantiation[];
  /**
   * Generic classes and interfaces this module declares, by source name, and
   * the ones it has instantiated, by mangled name (WP18 G5). A struct template
   * is not in `structs` for the reason a function template is not in
   * `functions`: it has no layout until an instantiation binds its parameters.
   */
  structTemplates: StringMap;
  structTemplateList: StructTemplateInfo[];
  structInstantiations: StringMap;
  structInstantiationList: StructInstantiation[];
  /**
   * Every generic-method template this module minted (WP18 G8), one per
   * (receiver struct, method), in the order they were collected. The sidecars
   * read it for message 9: a method nothing instantiates has no symbol.
   */
  methodTemplateList: TemplateInfo[];
  /**
   * One constraint list per generic method *declaration*, by the method node's
   * id -> index into `methodConstraintLists` (WP18 G8). Shared by every
   * receiver the method is minted for, so a constraint is resolved, and a bad
   * one reported, once per declaration rather than once per instantiated class.
   */
  methodConstraints: StringMap;
  methodConstraintLists: ConstraintList[];
  /** Non-null while an instantiation's side tables are installed. */
  activeInstance: Instantiation | null;
  /** The module's own tables, held aside while `activeInstance` is installed. */
  savedNodeTypes: i32[];
  savedNodeLocals: (Local | null)[];
  savedNodeConstants: (ConstInfo | null)[];
  savedNodeCallees: (FunctionSig | null)[];
  savedNodeCoercions: i32[];
  savedNodeCaseValues: i64[];
  /** Name -> index into `enumList`, for the numeric `enum`s this module declares (WP23). */
  enums: StringMap;
  enumList: EnumInfo[];

  /** Set when this module declares `export function main`; the entry wrapper wraps it. */
  entryMain: FunctionSig | null;
  /** Some function reads `process.argv`, so the `@main` wrapper calls `nish_argv_init`. */
  usesArgv: boolean;

  /** Node id -> resolved type, or -1 where nothing was recorded. */
  nodeTypes: i32[];
  /** Identifier node id -> the variable it refers to. */
  nodeLocals: (Local | null)[];
  /** Identifier node id -> the module constant it names, when it is not a variable. */
  nodeConstants: (ConstInfo | null)[];
  /** Call node id -> the callee, free functions and methods alike. */
  nodeCallees: (FunctionSig | null)[];
  /**
   * Call or identifier node id -> the canonical builtin it resolved to, for
   * the names a `nish:` import brought in, and `""` for every other node. The
   * emitter dispatches builtins on the identifier's own text, which under an
   * import is the local name and may be an `as` rename, so the checker records
   * the spelling the emitter is keyed by rather than leaving it to be derived.
   */
  nodeBuiltins: string[];
  /**
   * Node id -> the type a coerced expression *was*, when a class value stands
   * where a base class or an implemented interface is expected. `nodeTypes`
   * records the target; this is the source, and the emitter turns the pair
   * into one `bitcast`.
   */
  nodeCoercions: i32[];
  /** `N_CASE` node id -> the folded label, which a `switch` needs as a constant. */
  nodeCaseValues: i64[];
  /**
   * `N_MEMBER` node id -> the integer an enum member stands for (WP23). There
   * is no presence flag beside it and none is needed: a member's value may be
   * 0 or negative, but the node that carries one is exactly an `N_MEMBER` of
   * enum type whose receiver is not a value, and both of those are already
   * recorded (`isEnumMember`). `src/` uses a `WeakMap`, where presence is the
   * key's own answer.
   */
  nodeEnumValues: i32[];
  /**
   * `N_INDEX` and `charCodeAt` node id -> the bounds analysis proved the index
   * in range (WP15 §2.1/§2.2, `self/bounds.ts`). The emitter writes the address
   * and no check for each of them, and the attribute pass leaves
   * `nish_panic_index` out of the callee set — which is the whole of what the
   * proof buys, and the reason it lives in a table the emitter reads rather
   * than in a decision the emitter makes.
   */
  nodeProvenIndex: boolean[];
  /**
   * A `substring` bound node id -> the same analysis placed it in
   * `[0, s.length]`. Keyed by the bound rather than by the call, because one
   * end of an `s.substring(0, n)` is usually proven and the other is not.
   *
   * This is not a bounds *check*. JavaScript's `substring` clamps each end into
   * `[0, len]`, which `self/emit_strings.ts` writes as an `llvm.smin` /
   * `llvm.smax` pair, and that clamp is the semantics rather than a safety net
   * — `--unchecked-indexing` does not remove it and must not. What the proof
   * buys is that a bound the clamp cannot move needs no clamp, so the emitter
   * writes the value straight through. A literal `0` is in here for every
   * string, because no string has a negative length, which is why the
   * commonest spelling there is — `s.substring(0, n)` — loses two of its six
   * intrinsic calls without a guard being written anywhere.
   */
  nodeProvenClamp: boolean[];

  constructor(source: SourceFile, file: Node, isEntry: boolean, nodeCount: i32, packageName: string) {
    this.source = source;
    this.file = file;
    this.isEntry = isEntry;
    this.packageName = packageName;
    this.symbolPrefix = packageSymbolPrefix(packageName);
    this.functions = [];
    this.exports = new StringMap();
    this.imports = [];
    this.structs = new StringMap();
    this.structList = [];
    this.reachableStructs = [];
    this.externalInstances = [];
    this.externalInstanceNames = new StringSet();
    this.deferredInstances = [];
    this.typeNames = new StringSet();
    this.importsUsedAsTypes = new StringSet();
    this.constants = new StringMap();
    this.constantList = [];
    this.aliases = new StringMap();
    this.aliasList = [];
    this.templates = new StringMap();
    this.templateList = [];
    this.instantiations = new StringMap();
    this.instantiationList = [];
    this.structTemplates = new StringMap();
    this.structTemplateList = [];
    this.structInstantiations = new StringMap();
    this.structInstantiationList = [];
    this.methodTemplateList = [];
    this.methodConstraints = new StringMap();
    this.methodConstraintLists = [];
    this.activeInstance = null;
    this.savedNodeTypes = [];
    this.savedNodeLocals = [];
    this.savedNodeConstants = [];
    this.savedNodeCallees = [];
    this.savedNodeCoercions = [];
    this.savedNodeCaseValues = [];
    this.enums = new StringMap();
    this.enumList = [];
    this.entryMain = null;
    this.usesArgv = false;
    this.nodeTypes = new Array<i32>(nodeCount);
    this.nodeLocals = new Array<Local | null>(nodeCount);
    this.nodeConstants = new Array<ConstInfo | null>(nodeCount);
    this.nodeCallees = new Array<FunctionSig | null>(nodeCount);
    this.nodeBuiltins = [];
    this.builtinImports = new StringMap();
    this.builtinImportList = [];
    this.nodeCoercions = new Array<i32>(nodeCount);
    this.nodeCaseValues = new Array<i64>(nodeCount);
    this.nodeEnumValues = new Array<i32>(nodeCount);
    this.nodeProvenIndex = new Array<boolean>(nodeCount);
    this.nodeProvenClamp = new Array<boolean>(nodeCount);
    let i = 0;
    while (i < nodeCount) {
      this.nodeTypes[i] = -1;
      this.nodeCoercions[i] = -1;
      // `new Array<string>(n)` is refused — it would zero-fill with null
      // strings — so the empty name every node starts at is pushed instead.
      this.nodeBuiltins.push("");
      i = i + 1;
    }
  }

  /** The constraint list of the generic method `decl` declares, made the first time it is asked for. */
  methodConstraintList(decl: Node): ConstraintList {
    const key = `${decl.id}`;
    const at = this.methodConstraints.get(key, -1);
    if (at >= 0) {
      return this.methodConstraintLists[at];
    }
    const list = new ConstraintList();
    this.methodConstraints.set(key, this.methodConstraintLists.length);
    this.methodConstraintLists.push(list);
    return list;
  }

  /** The struct called `name` in this module, or `null`. */
  struct(name: string): StructInfo | null {
    const at = this.structs.get(name, -1);
    return at < 0 ? null : this.structList[at];
  }

  /** Register `info` under `name`; the caller has already checked for a clash. */
  addStruct(name: string, info: StructInfo): void {
    this.structs.set(name, this.structList.length);
    this.structList.push(info);
  }

  constant(name: string): ConstInfo | null {
    const at = this.constants.get(name, -1);
    return at < 0 ? null : this.constantList[at];
  }

  addConstant(info: ConstInfo): void {
    this.constants.set(info.name, this.constantList.length);
    this.constantList.push(info);
  }

  /** The `type` alias called `name` in this module, or `null`. */
  alias(name: string): AliasInfo | null {
    const at = this.aliases.get(name, -1);
    return at < 0 ? null : this.aliasList[at];
  }

  addAlias(info: AliasInfo): void {
    this.aliases.set(info.name, this.aliasList.length);
    this.aliasList.push(info);
  }

  /**
   * The builtin a `nish:` import bound `name` to, or `null`. Consulted before
   * the ambient builtin tables, which is what makes an import shadow-proof: a
   * user function of the same name is a collision at the import rather than a
   * silent replacement of the builtin.
   */
  builtinImport(name: string): BuiltinExport | null {
    const at = this.builtinImports.get(name, -1);
    return at < 0 ? null : this.builtinImportList[at];
  }

  /** Register `info` under the name it is used by; the caller has checked for a clash. */
  addBuiltinImport(name: string, info: BuiltinExport): void {
    this.builtinImports.set(name, this.builtinImportList.length);
    this.builtinImportList.push(info);
  }

  /** The generic template called `name` in this module, or `null` (WP18). */
  template(name: string): TemplateInfo | null {
    const at = this.templates.get(name, -1);
    return at < 0 ? null : this.templateList[at];
  }

  addTemplate(info: TemplateInfo): void {
    this.addTemplateAs(info.sourceName, info);
  }

  /**
   * The same, under a name this module chose: `import { identity as id }`
   * (WP18 G7). Only the *lookup* takes the local name — the symbol an
   * instantiation gets is still built from `info.sourceName`, because one
   * instantiation is one definition for the whole program and the module that
   * defines it never learns what anyone else called it. `info.origin` is what
   * tells a declaration from an import here, exactly as it does for a struct
   * and for an imported `FunctionSig`.
   */
  addTemplateAs(name: string, info: TemplateInfo): void {
    this.templates.set(name, this.templateList.length);
    this.templateList.push(info);
  }

  /** The instantiation emitted under `symbol`, or `null` when there is none yet. */
  instantiation(symbol: string): Instantiation | null {
    const at = this.instantiations.get(symbol, -1);
    return at < 0 ? null : this.instantiationList[at];
  }

  addInstantiation(symbol: string, info: Instantiation): void {
    this.instantiations.set(symbol, this.instantiationList.length);
    this.instantiationList.push(info);
  }

  /** The generic class or interface called `name` in this module, or `null` (WP18 G5). */
  /** The import that gave this module `localName`, or `null` (WP18 G7). */
  importNamed(localName: string): ImportBinding | null {
    for (const imp of this.imports) {
      if (imp.localName === localName) {
        return imp;
      }
    }
    return null;
  }

  structTemplate(name: string): StructTemplateInfo | null {
    const at = this.structTemplates.get(name, -1);
    return at < 0 ? null : this.structTemplateList[at];
  }

  addStructTemplate(info: StructTemplateInfo): void {
    this.addStructTemplateAs(info.sourceName, info);
  }

  /** The same, under a name this module chose on import (WP18 G7). */
  addStructTemplateAs(name: string, info: StructTemplateInfo): void {
    this.structTemplates.set(name, this.structTemplateList.length);
    this.structTemplateList.push(info);
  }

  /**
   * The instantiation a mangled struct name belongs to, or `null` when the name
   * is a struct somebody declared. An instantiated class is an ordinary struct
   * and its type carries no arguments, so this is where the termination rule
   * and inference read them back.
   *
   * This is the module's own request log, which is what decides whether a
   * request has already been answered *here*; `structArguments` below is the
   * other question, and the two are deliberately not one method.
   */
  structInstance(name: string): StructInstantiation | null {
    const at = this.structInstantiations.get(name, -1);
    return at < 0 ? null : this.structInstantiationList[at];
  }

  /**
   * The arguments a mangled struct name was instantiated at, wherever the
   * layout came from (WP18 G7).
   *
   * Answered off the *layout* rather than off this module's request log, so
   * that a `Box$i32` this module imported reads back its arguments exactly as
   * one it asked for itself does. Since G7 those are two different modules, and
   * the termination rule and inference both have to see through the difference
   * — while `structInstance` above must not, because "has this module already
   * registered one?" is what tells two modules declaring one template apart.
   */
  structArguments(name: string): StructInstantiation | null {
    const info = this.struct(name);
    return info === null ? null : info.instance;
  }

  addStructInstance(name: string, info: StructInstantiation): void {
    this.structInstantiations.set(name, this.structInstantiationList.length);
    this.structInstantiationList.push(info);
  }

  /**
   * Install one instantiation's side tables (WP18 §3d). Every pass that walks a
   * function body brackets that walk with this and `leaveInstance`, so a read
   * of `nodeTypes[node.id]` inside an instantiation's body answers for *that*
   * type-argument tuple and the code doing the reading never learns there was a
   * choice. There is never more than one installed at a time: the worklist is
   * drained in a loop and every other caller walks one function at a time.
   */
  enterInstance(info: Instantiation): void {
    this.savedNodeTypes = this.nodeTypes;
    this.savedNodeLocals = this.nodeLocals;
    this.savedNodeConstants = this.nodeConstants;
    this.savedNodeCallees = this.nodeCallees;
    this.savedNodeCoercions = this.nodeCoercions;
    this.savedNodeCaseValues = this.nodeCaseValues;
    this.nodeTypes = info.nodeTypes;
    this.nodeLocals = info.nodeLocals;
    this.nodeConstants = info.nodeConstants;
    this.nodeCallees = info.nodeCallees;
    this.nodeCoercions = info.nodeCoercions;
    this.nodeCaseValues = info.nodeCaseValues;
    this.activeInstance = info;
  }

  /** Put the module's own tables back. */
  leaveInstance(): void {
    this.nodeTypes = this.savedNodeTypes;
    this.nodeLocals = this.savedNodeLocals;
    this.nodeConstants = this.savedNodeConstants;
    this.nodeCallees = this.savedNodeCallees;
    this.nodeCoercions = this.savedNodeCoercions;
    this.nodeCaseValues = this.savedNodeCaseValues;
    this.activeInstance = null;
  }

  /**
   * Whether `node` is an enum member reference — `Kind.If` — whose folded
   * integer is in `nodeEnumValues` (WP23). It is an `N_MEMBER` of enum type
   * whose receiver is a *name* rather than a value, and nothing else in the
   * language has that shape, so the two tables the checker already writes
   * answer the question and no presence flag has to be stored beside them.
   */
  isEnumMember(table: TypeTable, node: Node): boolean {
    if (node.kind !== N_MEMBER || this.nodeTypes[node.children[0].id] >= 0) {
      return false;
    }
    return table.isEnum(this.nodeTypes[node.id]);
  }

  /** The numeric `enum` called `name` in this module, or `null` (WP23). */
  enumNamed(name: string): EnumInfo | null {
    const at = this.enums.get(name, -1);
    return at < 0 ? null : this.enumList[at];
  }

  addEnum(info: EnumInfo): void {
    this.enums.set(info.name, this.enumList.length);
    this.enumList.push(info);  }

  /** The exported function called `name`, or `null`. */
  exported(name: string): FunctionSig | null {
    const at = this.exports.get(name, -1);
    return at < 0 ? null : this.functions[at];
  }
}

// ---- WP15 §2a: element layout ------------------------------------------------

/**
 * How one element of a `T[]` is stored (`src/checker/program.ts`).
 *
 * An array of *records* is contiguous storage — `N` of them end to end in one
 * block — so `ps[i]` is an interior `getelementptr` rather than a load of a
 * pointer and a chase to wherever it went. A record is an `interface` and only
 * an `interface` nobody implements: fields and nothing else, so copying one
 * into a slot is indistinguishable from pointing at it. A `class` has identity
 * — a constructor and methods that run on one object — and every other position
 * in the language passes it by reference, so a class element stays a pointer.
 * An interface some class `implements` stays a pointer too, because that array
 * is the language's only polymorphic container and every implementer is longer
 * than the interface; so does a `C | null`, because a null element has no bytes
 * to be.
 *
 * A class element staying a pointer is a **decision and not deferred work**:
 * the migration was costed against this compiler, which is the program it
 * would cost the most, and the answer was no. The full argument, and the
 * `self/` evidence behind it — the aliased `FunctionSig`, the identity
 * comparisons in `bounds.ts` that a value slot would make a miscompile, and
 * the syntax tree becoming storage — is in `src/checker/program.ts` and in
 * §2a of `docs/wp15-performance.md`.
 */
export const inlineElementStruct = (program: CheckedProgram, table: TypeTable, elem: i32): StructInfo | null => {
  if (!table.isStruct(elem)) {
    return null;
  }
  const info = program.struct(table.nameOf(elem));
  if (info === null || info.kind !== STRUCT_INTERFACE || info.implemented) {
    return null;
  }
  return info;
};

/** Bytes from one element to the next: `sizeof` for an inline class, the value's size otherwise. */
export const elementStride = (program: CheckedProgram, table: TypeTable, elem: i32): i32 => {
  const info = inlineElementStruct(program, table, elem);
  return info === null ? table.alignOf(elem) : info.size;
};

/** Alignment of one element slot: the class's own maximum field alignment when it is inline. */
export const elementAlignOf = (program: CheckedProgram, table: TypeTable, elem: i32): i32 => {
  const info = inlineElementStruct(program, table, elem);
  return info === null ? table.alignOf(elem) : info.align;
};

/** The LLVM type of one element slot: `%struct.P` inline, the value type otherwise. */
export const elementLLVMType = (program: CheckedProgram, table: TypeTable, elem: i32): string => {
  const info = inlineElementStruct(program, table, elem);
  return info === null ? table.llvmType(elem) : `%struct.${info.name}`;
};
