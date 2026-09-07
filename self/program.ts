// The data model the checker fills and the emitter reads (`src/checker/program.ts`),
// for stage1 (docs/wp14-selfhost.md, milestone S3).
//
// Two changes of shape, both forced and both improvements:
//
//   - **Side tables are arrays indexed by `Node.id`**, not `WeakMap`s keyed by
//     node. StaticTS has no `WeakMap`; a dense array is also one index rather
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

import { SourceFile } from "./diagnostics";
import { StringMap, StringSet } from "./map";
import { N_BLOCK, N_CONSTRUCTOR, Node } from "./nodes";
import { Local } from "./symbols";

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
  /** The LLVM symbol (`@name`). `main` in the entry module is `@sts_main`. */
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

  /** The `BLOCK` of the body, or `null` when the declaration has none. */
  body(): Node | null {
    const block = this.decl.kind === N_CONSTRUCTOR ? this.decl.children[1] : this.decl.children[3];
    return block.kind === N_BLOCK ? block : null;
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
  /** The explicit constructor; without one, `new` stores the field initializers inline. */
  ctor: FunctionSig | null;
  /** Interfaces named in `implements`, checked to have the identical layout. */
  implementsNames: string[];
  /**
   * The class named in `extends`. Its fields are the prefix of `fields` — same
   * indices, same offsets — so a `%struct.<name>*` may be `bitcast` to the
   * base's. `methodSigs` holds only what this class declares; an inherited
   * method is found by walking `base`.
   */
  base: StructInfo | null;
  decl: Node;
  /** The module that declares it, so an importer can tell it from a re-export. */
  origin: SourceFile;
  exported: boolean;
  /** A member or heritage clause was rejected: the layout is incomplete. */
  poisoned: boolean;
  /** Pass 1b progress, so a derived class can pull its base in first... */
  collecting: boolean;
  /** ...and so a base pulled in twice is collected once. */
  collected: boolean;

  constructor(name: string, kind: i32, type: i32, decl: Node, origin: SourceFile) {
    this.name = name;
    this.kind = kind;
    this.origin = origin;
    this.type = type;
    this.fields = [];
    this.fieldIndex = new StringMap();
    this.size = 0;
    this.align = 1;
    this.methodIndex = new StringMap();
    this.methodSigs = [];
    this.ctor = null;
    this.implementsNames = [];
    this.base = null;
    this.decl = decl;
    this.exported = false;
    this.poisoned = false;
    this.collecting = false;
    this.collected = false;
  }

  /** The field called `name` on this struct, or `null`. Base fields are already in `fields`. */
  field(name: string): FieldInfo | null {
    const at = this.fieldIndex.get(name, -1);
    return at < 0 ? null : this.fields[at];
  }

  /** The method called `name`, declared here or inherited; `null` when there is none. */
  method(name: string): FunctionSig | null {
    const at = this.methodIndex.get(name, -1);
    if (at >= 0) {
      return this.methodSigs[at];
    }
    const base = this.base;
    return base === null ? null : base.method(name);
  }

  /** The constructor that `new` calls: this class's, else the nearest inherited one. */
  effectiveConstructor(): FunctionSig | null {
    const own = this.ctor;
    if (own !== null) {
      return own;
    }
    const base = this.base;
    return base === null ? null : base.effectiveConstructor();
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

/** One name brought in by `import { f, g as h } from "./m"`. */
export class ImportBinding {
  /** Module specifier text, e.g. `./math`. Relative specifiers only. */
  specifier: string;
  /** Name inside the exporting module. */
  importedName: string;
  /** Name inside this module; differs only with `as`. */
  localName: string;
  /** The specifier element, for error spans. */
  node: Node;
  /** Exactly one of these is set in pass 1b, or none if the import failed. */
  sig: FunctionSig | null;
  struct: StructInfo | null;
  constant: ConstInfo | null;

  constructor(specifier: string, importedName: string, localName: string, node: Node) {
    this.specifier = specifier;
    this.importedName = importedName;
    this.localName = localName;
    this.node = node;
    this.sig = null;
    this.struct = null;
    this.constant = null;
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

  /** Set when this module declares `export function main`; the entry wrapper wraps it. */
  entryMain: FunctionSig | null;
  /** Some function reads `process.argv`, so the `@main` wrapper calls `sts_argv_init`. */
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
   * Node id -> the type a coerced expression *was*, when a class value stands
   * where a base class or an implemented interface is expected. `nodeTypes`
   * records the target; this is the source, and the emitter turns the pair
   * into one `bitcast`.
   */
  nodeCoercions: i32[];
  /** `N_CASE` node id -> the folded label, which a `switch` needs as a constant. */
  nodeCaseValues: i64[];

  constructor(source: SourceFile, file: Node, isEntry: boolean, nodeCount: i32) {
    this.source = source;
    this.file = file;
    this.isEntry = isEntry;
    this.functions = [];
    this.exports = new StringMap();
    this.imports = [];
    this.structs = new StringMap();
    this.structList = [];
    this.reachableStructs = [];
    this.typeNames = new StringSet();
    this.importsUsedAsTypes = new StringSet();
    this.constants = new StringMap();
    this.constantList = [];
    this.entryMain = null;
    this.usesArgv = false;
    this.nodeTypes = new Array<i32>(nodeCount);
    this.nodeLocals = new Array<Local | null>(nodeCount);
    this.nodeConstants = new Array<ConstInfo | null>(nodeCount);
    this.nodeCallees = new Array<FunctionSig | null>(nodeCount);
    this.nodeCoercions = new Array<i32>(nodeCount);
    this.nodeCaseValues = new Array<i64>(nodeCount);
    let i = 0;
    while (i < nodeCount) {
      this.nodeTypes[i] = -1;
      this.nodeCoercions[i] = -1;
      i = i + 1;
    }
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

  /** The exported function called `name`, or `null`. */
  exported(name: string): FunctionSig | null {
    const at = this.exports.get(name, -1);
    return at < 0 ? null : this.functions[at];
  }
}
