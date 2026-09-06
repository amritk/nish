/**
 * Phase C: LLVM IR emission.
 *
 * Lowers a *checked* program into LLVM IR text. Because the checker already
 * resolved every type and binding, nothing here handles user mistakes: any
 * node the emitter sees is known to be valid.
 *
 * The core owns module assembly, per-function setup (attributes, params),
 * the runtime prelude, and dispatch. Construct-specific lowering lives in
 * `emit/statements.ts` and `emit/expressions.ts`.
 *
 * Lowering rules:
 *   - Parameters are immutable and used directly as SSA values (`%a`).
 *   - `let`/`const` locals get an `alloca` slot in the entry block; reads are
 *     `load`s and writes are `store`s. `opt -mem2reg` turns these back into
 *     pure SSA registers.
 *   - Every expression lowers to a single LLVM value (a temp, a param name,
 *     or a constant).
 */
import ts from "typescript";
import { CheckedProgram, FunctionSig, LocalVar } from "../checker";
import { CompilerOptions, StaticType, alignOf, llvmType } from "../types";
import { FunctionFacts, analyzeFunctions, functionAttributes, paramAttributes, returnAttributes } from "./attributes";
import { EmitContext } from "./emit/context";
import { expressionEmitters } from "./emit/expressions";
import { statementEmitters } from "./emit/statements";
import { IRFunction, IRModule } from "./ir";
import { ARENA_GLOBAL, ARENA_TYPE, INLINE_ALLOCATOR_ATTRS, RUNTIME_FUNCTIONS, inlineAllocator } from "./runtime";

export class Emitter implements EmitContext {
  private readonly module: IRModule;
  private readonly facts: Map<string, FunctionFacts>;
  fn!: IRFunction;
  private slots = new WeakMap<LocalVar, string>();
  /** Runtime symbols referenced by this module; drives which declarations are emitted. */
  private readonly usedRuntime = new Set<string>();

  constructor(
    readonly program: CheckedProgram,
    readonly opts: CompilerOptions
  ) {
    this.module = new IRModule(program.sourceFile.fileName);
    this.facts = analyzeFunctions(program);
  }

  emitModule(): string {
    for (const sig of this.program.functions) {
      this.module.addFunction(this.emitFunction(sig));
    }
    this.emitRuntimePrelude();
    return this.module.toString();
  }

  // ---- Functions ----------------------------------------------------------

  private emitFunction(sig: FunctionSig): IRFunction {
    const facts = this.facts.get(sig.name)!;
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

  // ---- Runtime ABI --------------------------------------------------------

  useRuntime(name: string): string {
    this.usedRuntime.add(name);
    return `@${name}`;
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
      if (!all && !this.usedRuntime.has(rt.name)) continue;
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

export function emitProgram(program: CheckedProgram, opts: CompilerOptions): string {
  return new Emitter(program, opts).emitModule();
}
