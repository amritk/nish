// DWARF debug info for stage1 (`src/codegen/debug.ts`, WP10 `-g`), for
// docs/wp14-selfhost.md milestone S4.
//
// Builds the metadata a debugger needs and hands the emitter the `!dbg`
// references to attach:
//
//   - one `DICompileUnit` (language C99: no DWARF language code exists for
//     TypeScript, and C is what every debugger renders best) and one `DIFile`
//     per module, plus the `Debug Info Version` / `Dwarf Version` module flags
//     without which LLVM strips the metadata;
//   - a `DISubprogram` per function (`beginFunction`), attached to the
//     `define` and used as the scope of every location in the body;
//   - a `DILocation` per distinct (line, column) the emitter visits
//     (`locationOf`); the emitter sets it on the `IRFunction` when a statement
//     or expression begins, and `IRFunction.emit` appends `, !dbg !N` to every
//     instruction while a location is active;
//   - `DILocalVariable`s: `llvm.dbg.value` for parameters (SSA values) and
//     `llvm.dbg.declare` for `let`/`const` slots (entry-block allocas).
//
// The type mapping is stage0's and is not restated here; `src/codegen/debug.ts`
// has it, and `tests/self/ir_oracle.js` compares the two byte for byte over
// every `-g` case in the corpus, metadata numbering included.
//
// **Two things differ from `src/`, and neither is visible in the output:**
//
//   - The type cache is keyed by `TypeTable.typeName`, not by the type id. Two
//     ids can name one type — a `Result` carries the checker's proof about the
//     use site in its id (`R_OK`, `R_ERR`) and stage0's `typeToString` cannot
//     see that proof — so keying by the id would describe one struct twice and
//     the metadata numbers would drift apart.
//   - There are no optional parameters, so `beginFunction` takes `artificial`
//     and `name` positionally and `member` takes an empty `file` for a member
//     with no declaration to point at.
//
// **Columns are bytes**, as everywhere in `self/`, where stage0's are UTF-16
// code units — the same caveat `self/diagnostics.ts` opens with, and it bites
// in the same one place: a `DILocation` for an instruction whose line holds a
// multi-byte character above the column. Every line of every `-g` case is
// ASCII, where the two counts are equal.
//
// **The one host dependency, and what was done about it.** A `DIFile` carries
// a filename and a directory, and stage0 used to spell the directory
// `process.cwd()`. stage1 has no working directory to ask for — D4 keeps the
// host-dependent half of the driver in stage0 and will not grow the runtime
// for one string — so *both* compilers now spell it `.`, and the filename
// stays the name the entry was given, exactly as the module header does
// (docs/wp14-selfhost.md §4). For a relatively-spelled entry the two agree
// string for string, and the metadata is reproducible across machines into the
// bargain, which is what clang's `-fdebug-compilation-dir=.` is for.
//
// Without `-g` nothing here runs and the IR is byte for byte what it was.

import { CLI, VERSION } from "./branding";
import { SourceFile } from "./diagnostics";
import { internalError } from "./ice";
import { IRFunction, IRModule } from "./ir";
import { StringMap } from "./map";
import { Node } from "./nodes";
import { CheckedProgram, EnumInfo, FunctionSig, StructInfo } from "./program";
import { ResultLayout, resultLayout } from "./result";
import { StringBuilder } from "./strings";
import { Local } from "./symbols";
import {
  intBits,
  T_BOOL,
  T_F32,
  T_F64,
  T_I32,
  T_I64,
  T_STRING,
  T_U16,
  T_U32,
  T_U64,
  T_U8,
  T_VOID,
  TypeTable,
} from "./types";

/** The directory a `DIFile` names; see the header for why it is not the working directory. */
const DEBUG_COMPILATION_DIR: string = ".";

/**
 * The `!DIBasicType` of a scalar, named as the C ABI header
 * (`runtime/nish.h`) names it. The unsigned widths carry `DW_ATE_unsigned`
 * so a debugger prints 4294967295 rather than -1, which is the whole point of
 * having them (WP15).
 */
function basicType(type: i32): string {
  switch (type) {
    case T_I32:
      return '!DIBasicType(name: "int", size: 32, encoding: DW_ATE_signed)';
    case T_I64:
      return '!DIBasicType(name: "long", size: 64, encoding: DW_ATE_signed)';
    case T_U8:
      return '!DIBasicType(name: "unsigned char", size: 8, encoding: DW_ATE_unsigned_char)';
    case T_U16:
      return '!DIBasicType(name: "unsigned short", size: 16, encoding: DW_ATE_unsigned)';
    case T_U32:
      return '!DIBasicType(name: "unsigned int", size: 32, encoding: DW_ATE_unsigned)';
    case T_U64:
      return '!DIBasicType(name: "unsigned long", size: 64, encoding: DW_ATE_unsigned)';
    case T_F32:
      return '!DIBasicType(name: "float", size: 32, encoding: DW_ATE_float)';
    case T_F64:
      return '!DIBasicType(name: "double", size: 64, encoding: DW_ATE_float)';
    case T_BOOL:
      return '!DIBasicType(name: "bool", size: 8, encoding: DW_ATE_boolean)';
    default:
      process.exit(internalError(`debug: no DWARF basic type for type id ${type}`));
  }
}

/** Storage size of a field, for `DW_TAG_member`; pointers are 64-bit on every supported target. */
function bitsOf(type: i32): i32 {
  const bits = intBits(type);
  if (bits > 0) {
    return bits;
  }
  if (type === T_F32) {
    return 32;
  }
  if (type === T_BOOL) {
    return 8;
  }
  if (type === T_VOID) {
    return 0;
  }
  return 64;
}

/**
 * `bitsOf` for a type id that may be an enum (WP23): an enum is an `i32`, and
 * `intBits` is deliberately 0 for it so that arithmetic stays refused.
 */
function bitsOfIn(table: TypeTable, type: i32): i32 {
  return table.isEnum(type) ? 32 : bitsOf(type);
}

/**
 * A metadata string literal: backslash and double quote escaped, as `src/`
 * does it with two `String.replace` calls. Nothing else needs escaping — the
 * only strings that reach here are file paths and source identifiers.
 */
function quote(text: string): string {
  const out = new StringBuilder();
  out.addChar(34);
  let i = 0;
  while (i < text.length) {
    const code = text.charCodeAt(i);
    if (code === 92 || code === 34) {
      out.addChar(92);
    }
    out.addChar(code);
    i = i + 1;
  }
  out.addChar(34);
  return out.toText();
}

export class DebugInfo {
  module: IRModule;
  program: CheckedProgram;
  table: TypeTable;
  source: SourceFile;
  /** `!N` of the `DICompileUnit` every `DISubprogram` names as its `unit`. */
  cu: string;
  /** `!N` of this module's own `DIFile`. */
  file: string;
  /**
   * One `DIFile` per source file a declaration comes from, by path. There is
   * more than one: a class this module never named can still reach it through
   * an imported class's signatures (`tests/link/reachable_struct`), and
   * describing its fields with *this* module's file would point a debugger at
   * lines in the wrong source.
   */
  fileKeys: StringMap;
  fileRefs: string[];
  /**
   * `TypeTable.typeName` -> index into `typeRefs`. A composite is reserved
   * before its members are built, so a field whose type is the struct itself
   * finds the reference already there instead of recursing forever.
   */
  typeKeys: StringMap;
  typeRefs: string[];
  /** The `DISubprogram` of the function being emitted: the scope of every location and variable. */
  subprogram: string;

  constructor(module: IRModule, program: CheckedProgram, table: TypeTable) {
    this.module = module;
    this.program = program;
    this.table = table;
    this.source = program.source;
    this.typeKeys = new StringMap();
    this.typeRefs = [];
    this.fileKeys = new StringMap();
    this.fileRefs = [];
    this.subprogram = "";
    // Every field carries a value before a method is called on `this`, which is
    // what the language asks of a constructor; the two that matter are filled
    // in immediately below.
    this.cu = "";
    this.file = "";
    // The compile unit refers to the file, so reserve its number first (`!0`, as clang does).
    this.cu = module.reserveMetadata();
    this.file = this.fileOf(program.source);
    module.setMetadata(
      this.cu,
      `distinct !DICompileUnit(language: DW_LANG_C99, file: ${this.file}, producer: ${quote(`${CLI} ${VERSION}`)}, isOptimized: false, runtimeVersion: 0, emissionKind: FullDebug)`
    );
    module.addNamedMetadata(`!llvm.dbg.cu = !{${this.cu}}`);
    const dwarf = module.addMetadata('!{i32 7, !"Dwarf Version", i32 5}');
    const version = module.addMetadata('!{i32 2, !"Debug Info Version", i32 3}');
    module.addNamedMetadata(`!llvm.module.flags = !{${dwarf}, ${version}}`);
  }

  /** The `DIFile` of one source file, interned so the module's own is written once. */
  fileOf(source: SourceFile): string {
    const known = this.fileKeys.get(source.path, -1);
    if (known >= 0) {
      return this.fileRefs[known];
    }
    const ref = this.module.addMetadata(
      `!DIFile(filename: ${quote(source.path)}, directory: ${quote(DEBUG_COMPILATION_DIR)})`
    );
    this.fileKeys.set(source.path, this.fileRefs.length);
    this.fileRefs.push(ref);
    return ref;
  }

  /**
   * The 1-based line a node starts on, in `source` — a struct reached through
   * an import is not measured against the importer's lines, which is why the
   * file is a parameter rather than this module's.
   */
  lineOf(source: SourceFile, node: Node): i32 {
    return source.lineOf(node.start);
  }

  // ---- Types ----------------------------------------------------------------

  /** Metadata reference for a type; `null` for `void` (only valid in a subroutine type's return slot). */
  typeRef(type: i32): string {
    if (type === T_VOID) {
      return "null";
    }
    if (this.table.isNullable(type)) {
      return this.typeRef(this.table.refOf(type));
    }
    const key = this.table.typeName(type);
    const known = this.typeKeys.get(key, -1);
    if (known >= 0) {
      return this.typeRefs[known];
    }
    let ref = "";
    if (type === T_STRING) {
      const ch = this.module.addMetadata('!DIBasicType(name: "char", size: 8, encoding: DW_ATE_signed_char)');
      ref = this.pointerTo(ch);
    } else if (this.table.isArray(type)) {
      ref = this.pointerTo(this.arrayHeader(this.table.refOf(type), key));
    } else if (this.table.isStruct(type)) {
      const info = this.program.struct(this.table.nameOf(type));
      if (info === null) {
        process.exit(internalError(`debug: no struct recorded for \`${this.table.nameOf(type)}\``));
      } else {
        ref = this.pointerTo(this.composite(info));
      }
    } else if (this.table.isEnum(type)) {
      // WP23: an enum is an `i32` with names attached, which is exactly what
      // DWARF's enumeration type is for — so a debugger prints `While` rather
      // than `2`, and the distinctness the checker enforces survives into the
      // debugger.
      const declared = this.program.enumNamed(this.table.nameOf(type));
      if (declared === null) {
        process.exit(internalError(`debug: no enum recorded for \`${this.table.nameOf(type)}\``));
      } else {
        ref = this.enumeration(declared);
      }
    } else if (this.table.isResult(type)) {
      // A `Result` has no `StructInfo` — its layout is derived from the type —
      // but `resultLayout` knows everything a `DW_TAG_structure_type` needs, so
      // `p *r` shows `ok`, `value` and `error` rather than an opaque pointer.
      // Only the arm the discriminant selects is meaningful; the other is
      // whatever the construction left there (WP16 does not zero it).
      ref = this.pointerTo(this.resultComposite(resultLayout(this.table, type)));
    } else {
      ref = this.module.addMetadata(basicType(type));
    }
    this.setTypeRef(key, ref);
    return ref;
  }

  /** Record `ref` as the metadata for `key`, replacing a reservation made by `composite`. */
  setTypeRef(key: string, ref: string): void {
    const known = this.typeKeys.get(key, -1);
    if (known >= 0) {
      this.typeRefs[known] = ref;
      return;
    }
    this.typeKeys.set(key, this.typeRefs.length);
    this.typeRefs.push(ref);
  }

  pointerTo(base: string): string {
    return this.module.addMetadata(`!DIDerivedType(tag: DW_TAG_pointer_type, baseType: ${base}, size: 64)`);
  }

  /** One `DW_TAG_member`; an empty `file` is a member with no declaration to point at. */
  member(
    name: string,
    scope: string,
    type: string,
    sizeBits: i32,
    offsetBits: i32,
    file: string,
    line: i32
  ): string {
    const at = file.length === 0 ? "" : `, file: ${file}, line: ${line}`;
    return this.module.addMetadata(
      `!DIDerivedType(tag: DW_TAG_member, name: ${quote(name)}, scope: ${scope}${at}, baseType: ${type}, size: ${sizeBits}, offset: ${offsetBits})`
    );
  }

  /** `%struct.<name>` with the checker's layout. Reserved before its members so a self-referencing field resolves. */
  composite(info: StructInfo): string {
    const ref = this.module.reserveMetadata();
    this.setTypeRef(info.name, this.pointerTo(ref));
    const file = this.fileOf(info.origin);
    const members: string[] = [];
    for (const f of info.fields) {
      const base = this.typeRef(f.type);
      const line = this.lineOf(info.origin, f.decl);
      members.push(this.member(f.name, ref, base, bitsOfIn(this.table, f.type), f.offset * 8, file, line));
    }
    const elements = this.module.addMetadata(`!{${members.join(", ")}}`);
    this.module.setMetadata(
      ref,
      `distinct !DICompositeType(tag: DW_TAG_structure_type, name: ${quote(info.name)}, file: ${file}, line: ${this.lineOf(info.origin, info.decl)}, size: ${info.size * 8}, align: ${info.align * 8}, elements: ${elements})`
    );
    return ref;
  }

  /** `enum Kind { ... }` as DWARF sees it: a 32-bit signed enumeration with one enumerator per member (WP23). */
  enumeration(info: EnumInfo): string {
    const file = this.fileOf(info.origin);
    const enumerators: string[] = [];
    let i = 0;
    while (i < info.memberNames.length) {
      enumerators.push(
        this.module.addMetadata(
          `!DIEnumerator(name: ${quote(info.memberNames[i])}, value: ${info.memberValues[i]})`
        )
      );
      i = i + 1;
    }
    const elements = this.module.addMetadata(`!{${enumerators.join(", ")}}`);
    return this.module.addMetadata(
      `!DICompositeType(tag: DW_TAG_enumeration_type, name: ${quote(info.name)}, file: ${file}, line: ${this.lineOf(info.origin, info.decl)}, size: 32, align: 32, elements: ${elements}, baseType: ${this.typeRef(T_I32)})`
    );
  }

  /** The `%struct.nish_array` header `{ i64 len, i64 cap, T* data }`, specialised per element type for the debugger's sake. */
  arrayHeader(elem: i32, name: string): string {
    const ref = this.module.reserveMetadata();
    const long = this.typeRef(T_I64);
    const members: string[] = [];
    members.push(this.member("len", ref, long, 64, 0, "", 0));
    members.push(this.member("cap", ref, long, 64, 64, "", 0));
    members.push(this.member("data", ref, this.pointerTo(this.typeRef(elem)), 64, 128, "", 0));
    const elements = this.module.addMetadata(`!{${members.join(", ")}}`);
    this.module.setMetadata(
      ref,
      `distinct !DICompositeType(tag: DW_TAG_structure_type, name: ${quote(name)}, file: ${this.file}, size: 192, align: 64, elements: ${elements})`
    );
    return ref;
  }

  /**
   * `%struct.nish_result.<T>.<E>` with the layout the checker derived: the
   * discriminant, the success payload (absent for `Result<void, E>`) and the
   * error payload, each at its computed byte offset. There is no declaration
   * to take a source line from, so the members carry none.
   */
  resultComposite(layout: ResultLayout): string {
    const ref = this.module.reserveMetadata();
    const names: string[] = [];
    const types: i32[] = [];
    const offsets: i32[] = [];
    names.push("ok");
    types.push(T_BOOL);
    offsets.push(layout.okOffset);
    if (layout.hasValue) {
      names.push("value");
      types.push(layout.valueType);
      offsets.push(layout.valueOffset);
    }
    names.push("error");
    types.push(layout.errorType);
    offsets.push(layout.errorOffset);
    const members: string[] = [];
    let i = 0;
    while (i < names.length) {
      const base = this.typeRef(types[i]);
      members.push(this.member(names[i], ref, base, bitsOfIn(this.table, types[i]), offsets[i] * 8, "", 0));
      i = i + 1;
    }
    const elements = this.module.addMetadata(`!{${members.join(", ")}}`);
    this.module.setMetadata(
      ref,
      `distinct !DICompositeType(tag: DW_TAG_structure_type, name: ${quote(layout.name)}, file: ${this.file}, size: ${layout.size * 8}, align: ${layout.align * 8}, elements: ${elements})`
    );
    return ref;
  }

  /**
   * WP17: the *packed* shape of a `Result` that is returned in a register —
   * `struct { int32_t ok; union { T value; E error; }; }`, which is the C type
   * `--emit-header` writes and the one the ABI actually carries. A debugger
   * told the in-memory layout instead would read a register that does not hold
   * a pointer, so the subroutine type and the parameter variables use this;
   * the in-memory composite is what a local, a field and `p *r` see.
   */
  resultWord(type: i32): string {
    const key = `${this.table.typeName(type)}.word`;
    const known = this.typeKeys.get(key, -1);
    if (known >= 0) {
      return this.typeRefs[known];
    }
    const layout = resultLayout(this.table, type);
    const ref = this.module.reserveMetadata();
    const union = this.module.reserveMetadata();
    const armNames: string[] = [];
    const armTypes: i32[] = [];
    if (layout.hasValue) {
      armNames.push("value");
      armTypes.push(layout.valueType);
    }
    if (layout.errorType !== T_VOID) {
      armNames.push("error");
      armTypes.push(layout.errorType);
    }
    let armBits = 8;
    for (const arm of armTypes) {
      const bits = bitsOfIn(this.table, arm);
      if (bits > armBits) {
        armBits = bits;
      }
    }
    const arms: string[] = [];
    let i = 0;
    while (i < armNames.length) {
      const base = this.typeRef(armTypes[i]);
      arms.push(this.member(armNames[i], union, base, bitsOfIn(this.table, armTypes[i]), 0, "", 0));
      i = i + 1;
    }
    const armElements = this.module.addMetadata(`!{${arms.join(", ")}}`);
    this.module.setMetadata(
      union,
      `distinct !DICompositeType(tag: DW_TAG_union_type, name: ${quote(`${layout.name}.arms`)}, file: ${this.file}, size: ${armBits}, elements: ${armElements})`
    );
    const members: string[] = [];
    members.push(this.member("ok", ref, this.typeRef(T_I32), 32, 0, "", 0));
    members.push(this.member("as", ref, union, armBits, 32, "", 0));
    const elements = this.module.addMetadata(`!{${members.join(", ")}}`);
    this.module.setMetadata(
      ref,
      `distinct !DICompositeType(tag: DW_TAG_structure_type, name: ${quote(`${layout.name}.word`)}, file: ${this.file}, size: 64, align: 32, elements: ${elements})`
    );
    this.setTypeRef(key, ref);
    return ref;
  }

  /** The type a call boundary really carries (WP17: packed, for a small `Result`). */
  abiTypeRef(type: i32): string {
    return this.table.resultByValue(type) ? this.resultWord(type) : this.typeRef(type);
  }

  // ---- Functions --------------------------------------------------------------

  /**
   * Attach a `DISubprogram` to `fn`, make it the current scope, set the
   * function's own line as the default location (so the prologue and any
   * instruction the emitter does not tie to a node still has one), and
   * describe the parameters with `llvm.dbg.value`.
   *
   * `artificial` is the C-ABI entry wrapper, whose signature is
   * `int main(int, char**)` and whose parameters are not described; `name`
   * overrides `sig.sourceName` for it, and is empty everywhere else.
   */
  beginFunction(fn: IRFunction, sig: FunctionSig, artificial: boolean, name: string, privateAbi: boolean): void {
    const line = this.lineOf(this.source, sig.decl);
    const types: string[] = [];
    if (artificial) {
      types.push(this.typeRef(T_I32));
    } else {
      types.push(this.abiTypeRef(sig.returnType));
      for (const paramType of sig.paramTypes) {
        types.push(this.abiTypeRef(paramType));
      }
    }
    const signature = this.module.addMetadata(
      `!DISubroutineType(types: ${this.module.addMetadata(`!{${types.join(", ")}}`)})`
    );
    // A method's `sourceName` already reads `Owner.method`.
    const printed = name.length > 0 ? name : sig.sourceName;
    const flags = artificial ? "DIFlagPrototyped | DIFlagArtificial" : "DIFlagPrototyped";
    const spFlags = fn.linkage === "internal" ? "DISPFlagDefinition | DISPFlagLocalToUnit" : "DISPFlagDefinition";
    this.subprogram = this.module.addMetadata(
      `distinct !DISubprogram(name: ${quote(printed)}, linkageName: ${quote(fn.name)}, scope: ${this.file}, file: ${this.file}, line: ${line}, type: ${signature}, scopeLine: ${line}, flags: ${flags}, spFlags: ${spFlags}, unit: ${this.cu})`
    );
    fn.subprogram = this.subprogram;
    fn.setLocation(this.locationOf(sig.decl));
    if (artificial) {
      return;
    }

    this.module.addDeclaration("declare void @llvm.dbg.value(metadata, metadata, metadata)");
    let i = 0;
    while (i < sig.paramNames.length) {
      const isThis = sig.owner !== null && i === 0;
      const extra = isThis ? ", flags: DIFlagArtificial | DIFlagObjectPointer" : "";
      const variable = this.module.addMetadata(
        `!DILocalVariable(name: ${quote(sig.paramNames[i])}, arg: ${i + 1}, scope: ${this.subprogram}, file: ${this.file}, line: ${line}, type: ${this.abiTypeRef(sig.paramTypes[i])}${extra})`
      );
      fn.emit(
        `call void @llvm.dbg.value(metadata ${this.table.llvmAbiType(sig.paramTypes[i], privateAbi)} %${sig.paramNames[i]}, metadata ${variable}, metadata !DIExpression())`
      );
      i = i + 1;
    }
  }

  /** `!N` of the `DILocation` for the start of `node` in the current function; identical positions share one. */
  locationOf(node: Node): string {
    const line = this.source.lineOf(node.start);
    const column = this.source.columnOf(node.start);
    return this.module.addMetadata(`!DILocation(line: ${line}, column: ${column}, scope: ${this.subprogram})`);
  }

  /** `llvm.dbg.declare` for a `let`/`const` slot, at the current location. */
  declareLocal(fn: IRFunction, local: Local, slot: string, node: Node): void {
    this.module.addDeclaration("declare void @llvm.dbg.declare(metadata, metadata, metadata)");
    const variable = this.module.addMetadata(
      `!DILocalVariable(name: ${quote(local.name)}, scope: ${this.subprogram}, file: ${this.file}, line: ${this.lineOf(this.source, node)}, type: ${this.typeRef(local.type)})`
    );
    fn.emit(
      `call void @llvm.dbg.declare(metadata ${this.table.llvmType(local.type)}* ${slot}, metadata ${variable}, metadata !DIExpression())`
    );
  }
}
