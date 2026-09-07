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
 * Types map to what the C ABI header (`runtime/statictsc.h`) calls them:
 * `i32` is `int`, `i64` `long`, `f64` `double`, `boolean` `bool`, a string a
 * `char*` (the header precedes the bytes, so `p s` in gdb shows the text), a
 * class or interface a pointer to a `DICompositeType` with the exact field
 * offsets the checker computed, and `T[]` a pointer to the array header with
 * `data` typed as `T*` so `p a->data[i]` works.
 *
 * Without `-g` nothing here runs and the IR is byte-for-byte what it was.
 */
import ts from "typescript";
import { CheckedProgram, FunctionSig, LocalVar, StructInfo } from "../checker";
import { StaticType, intBits, isInteger, llvmType, typeToString } from "../types";
import { packageVersion } from "../version";
import { IRFunction, IRModule } from "./ir";

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
    // clang's convention: the name as given on the command line, resolved against the working directory.
    this.file = module.addMetadata(
      `!DIFile(filename: ${quote(this.sourceFile.fileName)}, directory: ${quote(process.cwd())})`
    );
    module.setMetadata(
      this.cu,
      `distinct !DICompileUnit(language: DW_LANG_C99, file: ${this.file}, producer: ${quote(`statictsc ${packageVersion()}`)}, isOptimized: false, runtimeVersion: 0, emissionKind: FullDebug)`
    );
    module.addNamedMetadata(`!llvm.dbg.cu = !{${this.cu}}`);
    const dwarf = module.addMetadata('!{i32 7, !"Dwarf Version", i32 5}');
    const version = module.addMetadata('!{i32 2, !"Debug Info Version", i32 3}');
    module.addNamedMetadata(`!llvm.module.flags = !{${dwarf}, ${version}}`);
  }

  private lineOf(node: ts.Node): number {
    return this.sourceFile.getLineAndCharacterOfPosition(node.getStart(this.sourceFile)).line + 1;
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
    } else {
      ref = this.module.addMetadata(BASIC_TYPES[t.kind]!);
    }
    this.types.set(key, ref);
    return ref;
  }

  private pointerTo(base: string): string {
    return this.module.addMetadata(`!DIDerivedType(tag: DW_TAG_pointer_type, baseType: ${base}, size: 64)`);
  }

  private member(name: string, scope: string, type: string, sizeBits: number, offsetBits: number, line?: number): string {
    const at = line === undefined ? "" : `, file: ${this.file}, line: ${line}`;
    return this.module.addMetadata(
      `!DIDerivedType(tag: DW_TAG_member, name: ${quote(name)}, scope: ${scope}${at}, baseType: ${type}, size: ${sizeBits}, offset: ${offsetBits})`
    );
  }

  /** `%struct.<name>` with the checker's layout. Reserved before its members so a self-referencing field resolves. */
  private composite(info: StructInfo): string {
    const ref = this.module.reserveMetadata();
    this.types.set(info.name, this.pointerTo(ref));
    const members = info.fields.map((f) =>
      this.member(f.name, ref, this.typeRef(f.type), bitsOf(f.type), f.offset * 8, this.lineOf(f.decl))
    );
    const elements = this.module.addMetadata(`!{${members.join(", ")}}`);
    this.module.setMetadata(
      ref,
      `distinct !DICompositeType(tag: DW_TAG_structure_type, name: ${quote(info.name)}, file: ${this.file}, line: ${this.lineOf(info.decl)}, size: ${info.size * 8}, align: ${info.align * 8}, elements: ${elements})`
    );
    return ref;
  }

  /** The `%struct.sts_array` header `{ i64 len, i64 cap, T* data }`, specialised per element type for the debugger's sake. */
  private arrayHeader(elem: StaticType, name: string): string {
    const ref = this.module.reserveMetadata();
    const long = this.typeRef({ kind: "i64" });
    const members = [
      this.member("len", ref, long, 64, 0),
      this.member("cap", ref, long, 64, 64),
      this.member("data", ref, this.pointerTo(this.typeRef(elem)), 64, 128),
    ];
    const elements = this.module.addMetadata(`!{${members.join(", ")}}`);
    this.module.setMetadata(
      ref,
      `distinct !DICompositeType(tag: DW_TAG_structure_type, name: ${quote(name)}, file: ${this.file}, size: 192, align: 64, elements: ${elements})`
    );
    return ref;
  }

  // ---- Functions ----------------------------------------------------------------

  /**
   * Attach a `DISubprogram` to `fn`, make it the current scope, set the
   * function's own line as the default location (so the prologue and any
   * instruction the emitter does not tie to a node still has one), and
   * describe the parameters with `llvm.dbg.value`.
   */
  beginFunction(fn: IRFunction, sig: FunctionSig, options: { artificial?: boolean; name?: string } = {}): void {
    const line = this.lineOf(sig.decl);
    // The artificial entry wrapper is `int main(int, char**)`; its parameters are not described.
    const types = options.artificial
      ? [this.typeRef({ kind: "i32" })]
      : [this.typeRef(sig.returnType), ...sig.params.map((p) => this.typeRef(p.type))];
    const signature = this.module.addMetadata(`!DISubroutineType(types: ${this.module.addMetadata(`!{${types.join(", ")}}`)})`);
    const name = options.name ?? sig.sourceName; // methods' `sourceName` already reads `Owner.method`
    const flags = ["DIFlagPrototyped", ...(options.artificial ? ["DIFlagArtificial"] : [])].join(" | ");
    const spFlags = ["DISPFlagDefinition", ...(fn.linkage === "internal" ? ["DISPFlagLocalToUnit"] : [])].join(" | ");
    this.subprogram = this.module.addMetadata(
      `distinct !DISubprogram(name: ${quote(name)}, linkageName: ${quote(fn.name)}, scope: ${this.file}, file: ${this.file}, line: ${line}, type: ${signature}, scopeLine: ${line}, flags: ${flags}, spFlags: ${spFlags}, unit: ${this.cu})`
    );
    fn.subprogram = this.subprogram;
    fn.setLocation(this.locationOf(sig.decl));
    if (options.artificial) return;

    this.module.addDeclaration("declare void @llvm.dbg.value(metadata, metadata, metadata)");
    sig.params.forEach((p, i) => {
      const isThis = sig.struct !== undefined && i === 0;
      const flags = isThis ? ", flags: DIFlagArtificial | DIFlagObjectPointer" : "";
      const variable = this.module.addMetadata(
        `!DILocalVariable(name: ${quote(p.name)}, arg: ${i + 1}, scope: ${this.subprogram}, file: ${this.file}, line: ${line}, type: ${this.typeRef(p.type)}${flags})`
      );
      fn.emit(`call void @llvm.dbg.value(metadata ${llvmType(p.type)} %${p.name}, metadata ${variable}, metadata !DIExpression())`);
    });
  }

  /** `!N` of the `DILocation` for the start of `node` in the current function; identical positions share one. */
  locationOf(node: ts.Node): string {
    const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(node.getStart(this.sourceFile));
    return this.module.addMetadata(`!DILocation(line: ${line + 1}, column: ${character + 1}, scope: ${this.subprogram})`);
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
