/**
 * DWARF debug info (WP10, `-g`).
 *
 * Builds the metadata a debugger needs and hands the emitter the `!dbg`
 * references to attach:
 *
 *   - one `DICompileUnit` (language C99: no DWARF language code exists for
 *     TypeScript, and C is what every debugger renders best) and one
 *     `DIFile` per module, plus the `Debug Info Version` / `Dwarf Version`
 *     module flags without which LLVM strips the metadata;
 *   - a `DISubprogram` per function (`beginFunction`), attached to the
 *     `define` and used as the scope of every location in the body;
 *   - a `DILocation` per distinct (line, column) the emitter visits
 *     (`locationOf`); the emitter sets it on the `IRFunction` when a statement
 *     or expression begins, and `IRFunction.emit` appends `, !dbg !N` to every
 *     instruction while a location is active;
 *   - `DILocalVariable`s: `llvm.dbg.value` for parameters (SSA values) and
 *     `llvm.dbg.declare` for `let`/`const` slots (entry-block allocas).
 *
 * Types map to what the C ABI header (`runtime/nish.h`) calls them:
 * `i32` is `int`, `i64` `long`, `f64` `double`, `boolean` `bool`, a string a
 * `char*` (the header precedes the bytes, so `p s` in gdb shows the text), a
 * class or interface a pointer to a `DICompositeType` with the exact field
 * offsets the checker computed, and `T[]` a pointer to the array header with
 * `data` typed as `T*` so `p a->data[i]` works. A `Result<T, E>` (WP17) is a
 * pointer to a composite built from `resultLayout` — `ok`, `value`, `error`
 * at their computed offsets — except at a call boundary the ABI packs into a
 * register, where it is the packed `{ int32_t ok; union { T; E; }; }` the C
 * header declares (`docs/wp17-result-abi.md` §3).
 *
 * Without `-g` nothing here runs and the IR is byte-for-byte what it was.
 */
import ts from "typescript";
import { CLI } from "../branding.js";
import { CheckedProgram, FunctionSig, LocalVar, StructInfo } from "../checker/index.js";
import { ResultLayout, ResultSlot, resultLayout } from "../checker/result.js";
import { StaticType, intBits, isInteger, llvmAbiType, llvmType, resultByValue, typeToString } from "../types.js";
import { packageVersion } from "../version.js";
import { IRFunction, IRModule } from "./ir.js";

/** Metadata id of a basic type, keyed by its `StaticType` kind. */
const BASIC_TYPES: Partial<Record<StaticType["kind"], string>> = {
  i32: '!DIBasicType(name: "int", size: 32, encoding: DW_ATE_signed)',
  i64: '!DIBasicType(name: "long", size: 64, encoding: DW_ATE_signed)',
  // WP15: the unsigned widths carry `DW_ATE_unsigned` so a debugger prints
  // 4294967295 rather than -1, which is the whole point of having them.
  u8: '!DIBasicType(name: "unsigned char", size: 8, encoding: DW_ATE_unsigned_char)',
  u16: '!DIBasicType(name: "unsigned short", size: 16, encoding: DW_ATE_unsigned)',
  u32: '!DIBasicType(name: "unsigned int", size: 32, encoding: DW_ATE_unsigned)',
  u64: '!DIBasicType(name: "unsigned long", size: 64, encoding: DW_ATE_unsigned)',
  f32: '!DIBasicType(name: "float", size: 32, encoding: DW_ATE_float)',
  f64: '!DIBasicType(name: "double", size: 64, encoding: DW_ATE_float)',
  bool: '!DIBasicType(name: "bool", size: 8, encoding: DW_ATE_boolean)',
};

export class DebugInfo {
  private readonly cu: string;
  private readonly file: string;
  /**
   * One `DIFile` per source file a declaration comes from, by file name. There
   * is more than one: a class this module never named can still reach it
   * through an imported class's signatures (`tests/link/reachable_struct`), and
   * describing its fields with *this* module's file would point a debugger at
   * lines in the wrong source.
   */
  private readonly files = new Map<string, string>();
  /** `typeToString` -> metadata reference; composites are reserved before their members so self-references resolve. */
  private readonly types = new Map<string, string>();
  /** The `DISubprogram` of the function being emitted; the scope of every location and variable. */
  private subprogram = "";
  private readonly sourceFile: ts.SourceFile;

  constructor(
    private readonly module: IRModule,
    private readonly program: CheckedProgram
  ) {
    this.sourceFile = program.sourceFile;
    // The compile unit refers to the file, so reserve its number first (`!0`, as clang does).
    this.cu = module.reserveMetadata();
    // The name as given on the command line, and `.` for the directory rather
    // than `process.cwd()`. Two things come of spelling it that way, and the
    // second is why it changed: the metadata depends only on the command line,
    // so a `-g` build is reproducible across machines (clang spells the same
    // thing `-fdebug-compilation-dir=.`); and stage1 can produce it, which it
    // could not do for a working directory it has no way to ask the operating
    // system for (WP14 D4). For a relatively-spelled entry the two compilers
    // now agree on the whole `DIFile`, exactly as they already agreed on the
    // module header (docs/wp14-selfhost.md §4).
    this.file = this.fileOf(this.sourceFile);
    module.setMetadata(
      this.cu,
      `distinct !DICompileUnit(language: DW_LANG_C99, file: ${this.file}, producer: ${quote(`${CLI} ${packageVersion()}`)}, isOptimized: false, runtimeVersion: 0, emissionKind: FullDebug)`
    );
    module.addNamedMetadata(`!llvm.dbg.cu = !{${this.cu}}`);
    const dwarf = module.addMetadata('!{i32 7, !"Dwarf Version", i32 5}');
    const version = module.addMetadata('!{i32 2, !"Debug Info Version", i32 3}');
    module.addNamedMetadata(`!llvm.module.flags = !{${dwarf}, ${version}}`);
  }

  /** The `DIFile` of one source file, interned so the module's own is written once. */
  private fileOf(sf: ts.SourceFile): string {
    const known = this.files.get(sf.fileName);
    if (known) return known;
    const ref = this.module.addMetadata(`!DIFile(filename: ${quote(sf.fileName)}, directory: ".")`);
    this.files.set(sf.fileName, ref);
    return ref;
  }

  /**
   * The 1-based line a declaration starts on, in *its own* file: a struct
   * reached through an import is not measured against the importer's lines.
   */
  private lineOf(node: ts.Node): number {
    const sf = node.getSourceFile();
    return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  }

  // ---- Types ------------------------------------------------------------------

  /** Metadata reference for a type; `null` for `void` (only valid in a subroutine type's return slot). */
  typeRef(t: StaticType): string {
    if (t.kind === "void") return "null";
    if (t.kind === "nullable") return this.typeRef(t.inner);
    const key = typeToString(t);
    const known = this.types.get(key);
    if (known) return known;
    let ref: string;
    if (t.kind === "string") {
      const char = this.module.addMetadata('!DIBasicType(name: "char", size: 8, encoding: DW_ATE_signed_char)');
      ref = this.pointerTo(char);
    } else if (t.kind === "array") {
      ref = this.pointerTo(this.arrayHeader(t.elem, key));
    } else if (t.kind === "struct") {
      ref = this.pointerTo(this.composite(this.program.structs.get(t.name)!));
    } else if (t.kind === "result") {
      // WP17: a `Result` has no `StructInfo` — its layout is derived from the
      // type — but `resultLayout` knows everything a `DW_TAG_structure_type`
      // needs, so `p *r` shows `ok`, `value` and `error` rather than an opaque
      // pointer. Only the arm the discriminant selects is meaningful; the
      // other is whatever the construction left there (WP16 does not zero it).
      ref = this.pointerTo(this.resultComposite(resultLayout(t)));
    } else {
      ref = this.module.addMetadata(BASIC_TYPES[t.kind]!);
    }
    this.types.set(key, ref);
    return ref;
  }

  private pointerTo(base: string): string {
    return this.module.addMetadata(`!DIDerivedType(tag: DW_TAG_pointer_type, baseType: ${base}, size: 64)`);
  }

  /** One `DW_TAG_member`; `file` empty is a member with no declaration to point at. */
  private member(
    name: string,
    scope: string,
    type: string,
    sizeBits: number,
    offsetBits: number,
    file: string,
    line: number
  ): string {
    const at = file === "" ? "" : `, file: ${file}, line: ${line}`;
    return this.module.addMetadata(
      `!DIDerivedType(tag: DW_TAG_member, name: ${quote(name)}, scope: ${scope}${at}, baseType: ${type}, size: ${sizeBits}, offset: ${offsetBits})`
    );
  }

  /** `%struct.<name>` with the checker's layout. Reserved before its members so a self-referencing field resolves. */
  private composite(info: StructInfo): string {
    const ref = this.module.reserveMetadata();
    this.types.set(info.name, this.pointerTo(ref));
    const file = this.fileOf(info.decl.getSourceFile());
    const members = info.fields.map((f) =>
      this.member(f.name, ref, this.typeRef(f.type), bitsOf(f.type), f.offset * 8, file, this.lineOf(f.decl))
    );
    const elements = this.module.addMetadata(`!{${members.join(", ")}}`);
    this.module.setMetadata(
      ref,
      `distinct !DICompositeType(tag: DW_TAG_structure_type, name: ${quote(info.name)}, file: ${file}, line: ${this.lineOf(info.decl)}, size: ${info.size * 8}, align: ${info.align * 8}, elements: ${elements})`
    );
    return ref;
  }

  /** The `%struct.nish_array` header `{ i64 len, i64 cap, T* data }`, specialised per element type for the debugger's sake. */
  private arrayHeader(elem: StaticType, name: string): string {
    const ref = this.module.reserveMetadata();
    const long = this.typeRef({ kind: "i64" });
    const members = [
      this.member("len", ref, long, 64, 0, "", 0),
      this.member("cap", ref, long, 64, 64, "", 0),
      this.member("data", ref, this.pointerTo(this.typeRef(elem)), 64, 128, "", 0),
    ];
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
  private resultComposite(layout: ResultLayout): string {
    const ref = this.module.reserveMetadata();
    const slots: [string, ResultSlot][] = [["ok", layout.ok]];
    if (layout.value) slots.push(["value", layout.value]);
    slots.push(["error", layout.error]);
    const members = slots.map(([name, slot]) =>
      this.member(name, ref, this.typeRef(slot.type), bitsOf(slot.type), slot.offset * 8, "", 0)
    );
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
   * told the in-memory layout instead would read a register that does not
   * hold a pointer, so the subroutine type and the parameter variables use
   * this; the in-memory composite is what a local, a field and `p *r` see.
   */
  private resultWord(t: StaticType): string {
    const key = `${typeToString(t)}.word`;
    const known = this.types.get(key);
    if (known) return known;
    const layout = resultLayout(t);
    const ref = this.module.reserveMetadata();
    const union = this.module.reserveMetadata();
    const arms: [string, StaticType][] = [];
    if (layout.value) arms.push(["value", layout.value.type]);
    if (layout.error.type.kind !== "void") arms.push(["error", layout.error.type]);
    const armBits = Math.max(8, ...arms.map(([, a]) => bitsOf(a)));
    this.module.setMetadata(
      union,
      `distinct !DICompositeType(tag: DW_TAG_union_type, name: ${quote(`${layout.name}.arms`)}, file: ${this.file}, size: ${armBits}, elements: ${this.module.addMetadata(
        `!{${arms.map(([name, a]) => this.member(name, union, this.typeRef(a), bitsOf(a), 0, "", 0)).join(", ")}}`
      )})`
    );
    const members = [
      this.member("ok", ref, this.typeRef({ kind: "i32" }), 32, 0, "", 0),
      this.member("as", ref, union, armBits, 32, "", 0),
    ];
    this.module.setMetadata(
      ref,
      `distinct !DICompositeType(tag: DW_TAG_structure_type, name: ${quote(`${layout.name}.word`)}, file: ${this.file}, size: 64, align: 32, elements: ${this.module.addMetadata(`!{${members.join(", ")}}`)})`
    );
    this.types.set(key, ref);
    return ref;
  }

  /** The type a call boundary really carries (WP17: packed, for a small `Result`). */
  private abiTypeRef(t: StaticType): string {
    return resultByValue(t) ? this.resultWord(t) : this.typeRef(t);
  }

  // ---- Functions ----------------------------------------------------------------

  /**
   * Attach a `DISubprogram` to `fn`, make it the current scope, set the
   * function's own line as the default location (so the prologue and any
   * instruction the emitter does not tie to a node still has one), and
   * describe the parameters with `llvm.dbg.value`.
   *
   * The position comes from `sig.declSite`, the node the *declaration* begins
   * at, and never from `sig.decl`: an arrow's own start is its parameter list,
   * which would put `export const add = (a: i32): i32 => ...` several columns
   * into the line and, when the arrow sits on a later line than the `const`,
   * on the wrong line entirely. A debugger asked where `add` is should answer
   * where a reader would say it is declared, and the answer may not depend on
   * which of the two spellings (WP22) was used.
   */
  beginFunction(
    fn: IRFunction,
    sig: FunctionSig,
    privateAbi: boolean,
    options: { artificial?: boolean; name?: string } = {}
  ): void {
    const line = this.lineOf(sig.declSite);
    // The artificial entry wrapper is `int main(int, char**)`; its parameters are not described.
    const types = options.artificial
      ? [this.typeRef({ kind: "i32" })]
      : [this.abiTypeRef(sig.returnType), ...sig.params.map((p) => this.abiTypeRef(p.type))];
    const signature = this.module.addMetadata(`!DISubroutineType(types: ${this.module.addMetadata(`!{${types.join(", ")}}`)})`);
    const name = options.name ?? sig.sourceName; // methods' `sourceName` already reads `Owner.method`
    const flags = ["DIFlagPrototyped", ...(options.artificial ? ["DIFlagArtificial"] : [])].join(" | ");
    const spFlags = ["DISPFlagDefinition", ...(fn.linkage === "internal" ? ["DISPFlagLocalToUnit"] : [])].join(" | ");
    this.subprogram = this.module.addMetadata(
      `distinct !DISubprogram(name: ${quote(name)}, linkageName: ${quote(fn.name)}, scope: ${this.file}, file: ${this.file}, line: ${line}, type: ${signature}, scopeLine: ${line}, flags: ${flags}, spFlags: ${spFlags}, unit: ${this.cu})`
    );
    fn.subprogram = this.subprogram;
    fn.setLocation(this.locationOf(sig.declSite));
    if (options.artificial) return;

    this.module.addDeclaration("declare void @llvm.dbg.value(metadata, metadata, metadata)");
    sig.params.forEach((p, i) => {
      const isThis = sig.struct !== undefined && i === 0;
      const flags = isThis ? ", flags: DIFlagArtificial | DIFlagObjectPointer" : "";
      const variable = this.module.addMetadata(
        `!DILocalVariable(name: ${quote(p.name)}, arg: ${i + 1}, scope: ${this.subprogram}, file: ${this.file}, line: ${line}, type: ${this.abiTypeRef(p.type)}${flags})`
      );
      fn.emit(`call void @llvm.dbg.value(metadata ${llvmAbiType(p.type, privateAbi)} %${p.name}, metadata ${variable}, metadata !DIExpression())`);
    });
  }

  /** `!N` of the `DILocation` for the start of `node` in the current function; identical positions share one. */
  locationOf(node: ts.Node): string {
    const start = node.getStart(this.sourceFile);
    const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(start);
    const column = byteColumn(this.sourceFile.text, start - character, start);
    return this.module.addMetadata(`!DILocation(line: ${line + 1}, column: ${column}, scope: ${this.subprogram})`);
  }

  /** `llvm.dbg.declare` for a `let`/`const` slot, at the current location. */
  declareLocal(fn: IRFunction, local: LocalVar, slot: string, node: ts.Node): void {
    this.module.addDeclaration("declare void @llvm.dbg.declare(metadata, metadata, metadata)");
    const variable = this.module.addMetadata(
      `!DILocalVariable(name: ${quote(local.name)}, scope: ${this.subprogram}, file: ${this.file}, line: ${this.lineOf(node)}, type: ${this.typeRef(local.type)})`
    );
    fn.emit(`call void @llvm.dbg.declare(metadata ${llvmType(local.type)}* ${slot}, metadata ${variable}, metadata !DIExpression())`);
  }
}

/**
 * The 1-based column a `DILocation` carries: the number of **UTF-8 bytes** of
 * `text` between `lineStart` and `pos`, plus one.
 *
 * It is bytes rather than the UTF-16 code units the `typescript` API counts
 * because that is what clang writes and what a debugger reads the column back
 * against — `clang -g` puts `return` at column 13 on a line whose comment holds
 * a three-byte em dash, where a code-unit count says 11. It is also what
 * `self/debug.ts` has always emitted, since every offset in `self/` is a byte
 * offset, so counting code units here made the two compilers disagree about
 * every position that follows a non-ASCII character on its own line
 * (`tests/cases/dbg_utf8`; `docs/wp19-stage0-retirement.md` §A5). Stage0's
 * *diagnostic* columns are unchanged and stay code units: an editor is the
 * consumer there, a debugger is the consumer here.
 */
const byteColumn = (text: string, lineStart: number, pos: number): number => {
  let bytes = 0;
  for (const ch of text.slice(lineStart, pos)) {
    const code = ch.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes + 1;
};

/** Storage size of a field, for `DW_TAG_member`; pointers are 64-bit on every supported target. */
function bitsOf(t: StaticType): number {
  if (isInteger(t)) return intBits(t);
  switch (t.kind) {
    case "f32":
      return 32;
    case "bool":
      return 8;
    case "void":
      return 0;
    default:
      return 64;
  }
}

function quote(text: string): string {
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
