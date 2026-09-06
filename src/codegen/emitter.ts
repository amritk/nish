/**
 * Phase C: LLVM IR emission.
 *
 * Lowers a *checked* program into LLVM IR text. Because the checker already
 * resolved every type and binding, nothing here handles user mistakes: any
 * node the emitter sees is known to be valid.
 *
 * The core owns module assembly, per-function setup (attributes, params,
 * linkage), `declare`s for imported functions, the entry-point wrapper, the
 * runtime prelude, and dispatch. Construct-specific lowering lives in
 * `emit/statements.ts` and `emit/expressions.ts`.
 *
 * Lowering rules:
 *   - Parameters are immutable and used directly as SSA values (`%a`).
 *   - `let`/`const` locals get an `alloca` slot in the entry block; reads are
 *     `load`s and writes are `store`s. `opt -mem2reg` turns these back into
 *     pure SSA registers.
 *   - Every expression lowers to a single LLVM value (a temp, a param name,
 *     or a constant).
 *
 * Modules (WP5):
 *   - Each source file becomes one module. Functions defined here are
 *     `define`d; functions imported from other modules are `declare`d with
 *     exactly the attributes their exporter's `define` carries, taken from
 *     the program-wide facts table handed in by the Compilation.
 *   - Non-exported functions get `internal` linkage under `--strict-exports`.
 *   - The entry module's `export function main` is emitted as `@sts_main`
 *     and wrapped by `define i32 @main(i32 %argc, i8** %argv)`, which calls
 *     it, releases the arena, and returns the exit code (0 for a void main).
 */
import ts from "typescript";
import { CheckedProgram, FunctionSig, LocalVar } from "../checker";
import { CompilerOptions, StaticType, alignOf, llvmType } from "../types";
import { FunctionFacts, analyzeFunctions, functionAttributes, paramAttributes, returnAttributes } from "./attributes";
import { EmitContext, LoopTarget } from "./emit/context";
import { expressionEmitters } from "./emit/expressions";
import { emitVariableDeclarationList, statementEmitters } from "./emit/statements";
import { addStringConstant } from "./emit/strings";
import { IRFunction, IRModule } from "./ir";
import { ARENA_GLOBAL, ARENA_TYPE, INLINE_ALLOCATOR_ATTRS, RUNTIME_FUNCTIONS, inlineAllocator } from "./runtime";

export class Emitter implements EmitContext {
  private readonly module: IRModule;
  private readonly facts: Map<string, FunctionFacts>;
  fn!: IRFunction;
  readonly loops: LoopTarget[] = [];
  private slots = new WeakMap<LocalVar, string>();
  /** Runtime symbols referenced by this module; drives which declarations are emitted. */
  private readonly usedRuntime = new Set<string>();
  /** Interned string literals: text -> `i8*` constant expression. */
  private readonly strings = new Map<string, string>();

  /**
   * `facts` must cover every function this module defines *or imports*; the
   * Compilation computes it over the whole program. Omitting it analyses the
   * single module, which is only correct when it imports nothing.
   */
  constructor(
    readonly program: CheckedProgram,
    readonly opts: CompilerOptions,
    facts?: Map<string, FunctionFacts>
  ) {
    this.module = new IRModule(program.sourceFile.fileName);
    this.facts = facts ?? analyzeFunctions(program);
  }

  emitModule(): string {
    for (const sig of this.program.functions) {
      this.module.addFunction(this.emitFunction(sig));
    }
    if (this.program.entryMain) this.module.addFunction(this.emitEntryWrapper(this.program.entryMain));
    this.emitImportDeclarations();
    this.emitRuntimePrelude();
    return this.module.toString();
  }

  // ---- Functions ----------------------------------------------------------

  private factsFor(sig: FunctionSig): FunctionFacts {
    const facts = this.facts.get(sig.name);
    if (!facts) throw new Error(`emitter: no attribute facts for \`${sig.name}\` (was the whole program analysed?)`);
    return facts;
  }

  private emitFunction(sig: FunctionSig): IRFunction {
    const facts = this.factsFor(sig);
    const optimize = this.opts.optimizeAttributes;
    this.fn = new IRFunction(
      sig.name,
      sig.params.map((p) => ({
        name: p.name,
        type: llvmType(p.type),
        attrs: optimize ? paramAttributes(p, facts) : [],
      })),
      llvmType(sig.returnType)
    );
    // Linkage: exported functions are always external (they are the module's
    // ABI). Others are external too unless --strict-exports hides them.
    if (this.opts.strictExports && !sig.exported) this.fn.linkage = "internal";
    if (optimize) {
      this.fn.returnAttrs = returnAttributes(sig.returnType);
      this.fn.attrGroup = this.module.attrGroup(functionAttributes(facts));
    }
    this.slots = new WeakMap();

    this.emitBlock(sig.decl.body!);

    // Void functions may fall off the end; give them an explicit terminator.
    if (!this.fn.currentBlock.terminated) this.fn.emit("ret void");
    return this.fn;
  }

  /**
   * The C-ABI process entry. `argc`/`argv` are accepted (and ignored until
   * WP7) so the signature is the one every libc start-up code expects.
   * Attributes are deliberately minimal: the wrapper calls the runtime, so
   * it is neither pure nor provably returning.
   */
  private emitEntryWrapper(userMain: FunctionSig): IRFunction {
    const optimize = this.opts.optimizeAttributes;
    const attrs = optimize ? ["noundef"] : [];
    const fn = new IRFunction(
      "main",
      [
        { name: "argc", type: "i32", attrs },
        { name: "argv", type: "i8**", attrs },
      ],
      "i32"
    );
    if (optimize) {
      fn.returnAttrs = ["noundef"];
      fn.attrGroup = this.module.attrGroup(["nounwind"]);
    }
    const freeArena = this.useRuntime("sts_free_arena");
    let code = "0";
    if (userMain.returnType.kind === "void") fn.emit(`call void @${userMain.name}()`);
    else code = fn.emitValue(`call i32 @${userMain.name}()`);
    fn.emit(`call void ${freeArena}()`);
    fn.emit(`ret i32 ${code}`);
    return fn;
  }

  // ---- Imports ------------------------------------------------------------

  /** One `declare` per distinct imported symbol, with the exporter's attributes. */
  private emitImportDeclarations(): void {
    const seen = new Set<string>();
    for (const imp of this.program.imports) {
      const sig = imp.sig;
      if (!sig) throw new Error(`emitter: unbound import \`${imp.importedName}\` from \`${imp.specifier}\``);
      if (seen.has(sig.name)) continue;
      seen.add(sig.name);
      this.module.addDeclaration(this.declarationFor(sig));
    }
  }

  /**
   * Render `declare <ret> @name(<params>) #N` from the same signature and
   * facts the exporter used for its `define`, so the two agree attribute for
   * attribute (parameter names are omitted, as clang does for declarations).
   */
  private declarationFor(sig: FunctionSig): string {
    const facts = this.factsFor(sig);
    const optimize = this.opts.optimizeAttributes;
    const params = sig.params
      .map((p) => [llvmType(p.type), ...(optimize ? paramAttributes(p, facts) : [])].join(" "))
      .join(", ");
    const ret = [...(optimize ? returnAttributes(sig.returnType) : []), llvmType(sig.returnType)].join(" ");
    const group = optimize ? ` ${this.module.attrGroup(functionAttributes(facts))}` : "";
    return `declare ${ret} @${sig.name}(${params})${group}`;
  }

  // ---- Runtime ABI --------------------------------------------------------

  useRuntime(name: string): string {
    this.usedRuntime.add(name);
    return `@${name}`;
  }

  stringConstant(text: string): string {
    let ref = this.strings.get(text);
    if (ref === undefined) {
      ref = addStringConstant(this.module, this.strings.size, text);
      this.strings.set(text, ref);
    }
    return ref;
  }

  declare(text: string): void {
    this.module.addDeclaration(text);
  }

  private emitRuntimePrelude(): void {
    const all = this.opts.runtimeDecls;
    const wantsAlloc = all || this.usedRuntime.has("sts_alloc_struct");
    if (wantsAlloc) {
      this.usedRuntime.add("sts_arena_grow");
      this.module.addTypeDecl(ARENA_TYPE);
      this.module.addGlobal(ARENA_GLOBAL);
    }
    for (const rt of RUNTIME_FUNCTIONS) {
      // Intrinsics are not part of the C ABI prelude: declared only when used.
      if (!this.usedRuntime.has(rt.name) && (!all || rt.intrinsic)) continue;
      const group = this.opts.optimizeAttributes ? ` ${this.module.attrGroup(rt.attrs)}` : "";
      this.module.addDeclaration(`${rt.signature}${group}`);
    }
    if (wantsAlloc) {
      this.module.addRawDefinition(inlineAllocator(this.module.attrGroup(INLINE_ALLOCATOR_ATTRS)));
    }
  }

  // ---- Dispatch -----------------------------------------------------------

  emitBlock(block: ts.Block): void {
    for (const stmt of block.statements) this.emitStatement(stmt);
  }

  emitStatement(stmt: ts.Statement): void {
    const handler = statementEmitters[stmt.kind];
    if (!handler) throw new Error(`emitter: unexpected statement ${ts.SyntaxKind[stmt.kind]}`);
    handler(this, stmt);
  }

  emitExpression(expr: ts.Expression): string {
    const handler = expressionEmitters[expr.kind];
    if (!handler) throw new Error(`emitter: unexpected expression ${ts.SyntaxKind[expr.kind]}`);
    return handler(this, expr);
  }

  emitVariableDeclarations(list: ts.VariableDeclarationList): void {
    emitVariableDeclarationList(this, list);
  }

  // ---- Context helpers ----------------------------------------------------

  slotOf(local: LocalVar): string {
    const slot = this.slots.get(local);
    if (!slot) throw new Error(`emitter: no slot for local \`${local.name}\``);
    return slot;
  }

  setSlot(local: LocalVar, slot: string): void {
    this.slots.set(local, slot);
  }

  typeOf(expr: ts.Expression): StaticType {
    const t = this.program.types.get(expr);
    if (!t) throw new Error(`emitter: no type recorded for ${ts.SyntaxKind[expr.kind]}`);
    return t;
  }

  align(t: StaticType): number | undefined {
    return this.opts.optimizeAttributes ? alignOf(t) : undefined;
  }

  alignSuffix(t: StaticType): string {
    const a = this.align(t);
    return a ? `, align ${a}` : "";
  }
}

/** Emit one module. `facts` is the program-wide table from `analyzeFunctions` when the module has imports. */
export function emitProgram(program: CheckedProgram, opts: CompilerOptions, facts?: Map<string, FunctionFacts>): string {
  return new Emitter(program, opts, facts).emitModule();
}
