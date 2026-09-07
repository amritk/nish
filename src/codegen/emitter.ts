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
 *
 * Memory (WP6, see `escape.ts`):
 *   - Allocations in `facts.stackSites` become entry-block allocas (the
 *     class and array emitters ask `isStackSite`).
 *   - A function with `facts.arenaScope` starts with
 *     `%arena.mark = call i64 @sts_arena_mark()` and calls
 *     `@sts_arena_release(i64 %arena.mark)` before every `ret`
 *     (`emitScopeExit`, invoked by the return emitter and by the implicit
 *     `ret void`). `unreachable` paths (`process.exit`, `throw`) need none.
 */
import ts from "typescript";
import { CheckedProgram, FunctionSig, LocalVar } from "../checker";
import { CompilerOptions, StaticType, alignOf, llvmType } from "../types";
import { FunctionFacts, analyzeFunctions, functionAttributes, paramAttributes, returnAttributes } from "./attributes";
import { DebugInfo } from "./debug";
import { emitConstructorPrologue, importedStructFunctions, structFunctions, structTypeDeclarations } from "./emit/classes";
import { EmitContext, LoopTarget } from "./emit/context";
import { expressionEmitters } from "./emit/expressions";
import { emitVariableDeclarationList, statementEmitters } from "./emit/statements";
import { addStringConstant } from "./emit/strings";
import { IRFunction, IRModule } from "./ir";
import {
  ARENA_GLOBAL,
  ARENA_TYPE,
  ARGV_GLOBAL,
  ARRAY_TYPE,
  INLINE_ALLOCATOR_ATTRS,
  RUNTIME_FUNCTIONS,
  inlineAllocator,
} from "./runtime";
import { resolveTarget, targetHeader } from "./target";

export class Emitter implements EmitContext {
  private readonly module: IRModule;
  private readonly facts: Map<string, FunctionFacts>;
  fn!: IRFunction;
  readonly loops: LoopTarget[] = [];
  private slots = new WeakMap<LocalVar, string>();
  /** Facts of the function being emitted (stack sites, arena scope). */
  private current!: FunctionFacts;
  /** Runtime symbols referenced by this module; drives which declarations are emitted. */
  private readonly usedRuntime = new Set<string>();
  /** Interned string literals: text -> `i8*` constant expression. */
  private readonly strings = new Map<string, string>();
  /** DWARF metadata builder (`-g`, WP10); undefined without debug info, and then nothing is attached. */
  readonly debug?: DebugInfo;

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
    if (opts.debugInfo) this.debug = new DebugInfo(this.module, program);
    // `--target` (WP9): pin the module to a data layout so `opt` needs no `-mtriple`.
    // The driver validated the spec; an unknown one here is a programming error.
    if (opts.target !== undefined) {
      const target = resolveTarget(opts.target);
      if (!target) throw new Error(`emitter: unsupported target \`${opts.target}\``);
      this.module.targetHeader = targetHeader(target);
    }
    this.facts = facts ?? analyzeFunctions(program, opts);
  }

  emitModule(): string {
    // `%struct.X = type { ... }` for every class/interface the module can see (WP2).
    for (const decl of structTypeDeclarations(this.program)) this.module.addTypeDecl(decl);
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

  /** Named types a signature mentions must be declared in the module (the array header, WP4). */
  private declareSignatureTypes(sig: FunctionSig): void {
    for (const t of [sig.returnType, ...sig.params.map((p) => p.type)]) {
      if (t.kind === "array") this.module.addTypeDecl(ARRAY_TYPE);
    }
  }

  private emitFunction(sig: FunctionSig): IRFunction {
    const facts = this.factsFor(sig);
    this.declareSignatureTypes(sig);
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
      this.fn.returnAttrs = returnAttributes(sig.returnType, facts.returnDeref);
      this.fn.attrGroup = this.module.attrGroup(functionAttributes(facts));
    }
    this.slots = new WeakMap();
    this.current = facts;
    // `-g`: the DISubprogram, the function's default location, and the parameters' dbg.value calls.
    this.debug?.beginFunction(this.fn, sig);

    // WP6: an automatic arena scope remembers the bump position before anything is allocated.
    if (facts.arenaScope) this.fn.emit(`%arena.mark = call i64 ${this.useRuntime("sts_arena_mark")}()`);
    // A constructor stores the field initializers before its body runs (WP2),
    // and a derived one without an explicit `super(...)` constructs its base part (WP2b).
    if (sig.role === "constructor") emitConstructorPrologue(this, sig);
    this.emitBlock(sig.decl.body!);

    // Void functions may fall off the end; give them an explicit terminator.
    if (!this.fn.currentBlock.terminated) {
      this.emitScopeExit();
      this.fn.emit("ret void");
    }
    return this.fn;
  }

  isStackSite(node: ts.Node): boolean {
    return this.current.stackSites.has(node);
  }

  emitScopeExit(): void {
    if (!this.current.arenaScope) return;
    this.fn.emit(`call void ${this.useRuntime("sts_arena_release")}(i64 %arena.mark)`);
  }

  /**
   * The C-ABI process entry, with the signature every libc start-up code
   * expects. When the program reads `process.argv` (WP7, `usesArgv` is set
   * program-wide by the Compilation), `sts_argv_init(argc, argv)` builds the
   * string array before the user's `main` runs; otherwise the arguments are
   * ignored. Attributes are deliberately minimal: the wrapper calls the
   * runtime, so it is neither pure nor provably returning.
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
    // `-g`: an artificial subprogram at the user's `main`, so `break main` lands somewhere sensible.
    this.debug?.beginFunction(fn, userMain, { artificial: true, name: "main" });
    const freeArena = this.useRuntime("sts_free_arena");
    if (this.program.usesArgv) fn.emit(`call void ${this.useRuntime("sts_argv_init")}(i32 %argc, i8** %argv)`);
    let code = "0";
    if (userMain.returnType.kind === "void") fn.emit(`call void @${userMain.name}()`);
    else code = fn.emitValue(`call i32 @${userMain.name}()`);
    fn.emit(`call void ${freeArena}()`);
    fn.emit(`ret i32 ${code}`);
    return fn;
  }

  // ---- Imports ------------------------------------------------------------

  /**
   * One `declare` per distinct imported symbol, with the exporter's
   * attributes. An imported class (WP2) contributes its constructor and
   * every method; an imported interface contributes nothing but its type,
   * and an imported constant (WP14) nothing at all — it was folded into
   * every use site, so there is no symbol to link against.
   */
  private emitImportDeclarations(): void {
    const seen = new Set<string>();
    const declare = (sigs: FunctionSig[]): void => {
      for (const sig of sigs) {
        if (seen.has(sig.name)) continue;
        seen.add(sig.name);
        this.module.addDeclaration(this.declarationFor(sig));
      }
    };
    for (const imp of this.program.imports) {
      if (imp.constant) continue;
      const sigs = imp.struct ? importedStructFunctions(imp) : imp.sig ? [imp.sig] : undefined;
      if (!sigs) throw new Error(`emitter: unbound import \`${imp.importedName}\` from \`${imp.specifier}\``);
      declare(sigs);
    }
    // A struct this module never named but can hold values of: its methods
    // and constructor are defined by whichever module declared it, so they
    // are `declare`d here for the same reason an imported class's are.
    for (const info of this.program.reachableStructs) declare(structFunctions(info));
  }

  /**
   * Render `declare <ret> @name(<params>) #N` from the same signature and
   * facts the exporter used for its `define`, so the two agree attribute for
   * attribute (parameter names are omitted, as clang does for declarations).
   */
  private declarationFor(sig: FunctionSig): string {
    const facts = this.factsFor(sig);
    this.declareSignatureTypes(sig);
    const optimize = this.opts.optimizeAttributes;
    const params = sig.params
      .map((p) => [llvmType(p.type), ...(optimize ? paramAttributes(p, facts) : [])].join(" "))
      .join(", ");
    const ret = [...(optimize ? returnAttributes(sig.returnType, facts.returnDeref) : []), llvmType(sig.returnType)].join(" ");
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

  declareType(text: string): void {
    this.module.addTypeDecl(text);
  }

  declareGlobal(text: string): void {
    this.module.addGlobal(text);
  }

  private emitRuntimePrelude(): void {
    const all = this.opts.runtimeDecls;
    const wantsAlloc = all || this.usedRuntime.has("sts_alloc_struct");
    if (wantsAlloc) {
      this.usedRuntime.add("sts_arena_grow");
      this.module.addTypeDecl(ARENA_TYPE);
      this.module.addGlobal(ARENA_GLOBAL);
    }
    // The array header type is referenced by `sts_array_grow`'s declaration (WP4).
    if (all || this.usedRuntime.has("sts_array_grow")) this.module.addTypeDecl(ARRAY_TYPE);
    // `@sts_argv` is part of the C ABI too (WP7); modules that read `process.argv` declared it already.
    if (all) this.module.addGlobal(ARGV_GLOBAL);
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
    const saved = this.enterLocation(stmt);
    handler(this, stmt);
    this.fn.setLocation(saved);
  }

  emitExpression(expr: ts.Expression): string {
    const handler = expressionEmitters[expr.kind];
    if (!handler) throw new Error(`emitter: unexpected expression ${ts.SyntaxKind[expr.kind]}`);
    const saved = this.enterLocation(expr);
    const value = handler(this, expr);
    // A class value used as an interface it implements (WP2): same layout, so
    // the conversion the checker recorded is a pointer bitcast.
    const coercion = this.program.coercions.get(expr);
    const result = coercion
      ? this.fn.emitValue(`bitcast ${llvmType(coercion.from)} ${value} to ${llvmType(coercion.to)}`)
      : value;
    this.fn.setLocation(saved);
    return result;
  }

  /**
   * `-g`: make `node`'s start the debug location of the instructions emitted
   * for it and return the location to restore afterwards, so the enclosing
   * construct's own instructions (a loop's back edge, a `store` after its
   * initializer) point at the enclosing node again. Without `-g` this is a
   * no-op and the location stays empty.
   */
  private enterLocation(node: ts.Node): string {
    const saved = this.fn.location;
    if (this.debug) this.fn.setLocation(this.debug.locationOf(node));
    return saved;
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
