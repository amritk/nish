/**
 * Minimal textual LLVM IR builder.
 *
 * Responsible only for the *shape* of the output: module header, function
 * definitions, basic blocks, and SSA temporary numbering. It knows nothing
 * about TypeScript. All instructions are plain strings appended to the
 * current block; the emitter decides what those strings are.
 *
 * SSA numbering follows LLVM's rules: unnamed values (`%0`, `%1`, ...) are
 * numbered per function in order of definition. Because every basic block
 * and parameter we emit is *named*, they never consume a number, so the
 * first temporary in a function is always `%0`.
 */

export class IRBlock {
  readonly instructions: string[] = [];
  constructor(readonly label: string) {}

  /** True once a terminator (ret/br) has been emitted. */
  get terminated(): boolean {
    const last = this.instructions[this.instructions.length - 1];
    return last !== undefined && /^(ret|br|unreachable)\b/.test(last);
  }

  toString(): string {
    return `${this.label}:\n` + this.instructions.map((i) => `  ${i}`).join("\n");
  }
}

export interface IRParam {
  name: string; // without leading '%'
  type: string; // LLVM type text
}

export class IRFunction {
  private blocks: IRBlock[] = [];
  private current: IRBlock;
  private nextTemp = 0;
  /** Instructions hoisted into the entry block before everything else (allocas). */
  private readonly entryPrelude: string[] = [];

  constructor(
    readonly name: string,
    readonly params: IRParam[],
    readonly returnType: string
  ) {
    this.current = new IRBlock("entry");
    this.blocks.push(this.current);
  }

  /** Allocate the next unnamed SSA temporary: `%0`, `%1`, ... */
  newTemp(): string {
    return `%${this.nextTemp++}`;
  }

  /** Append an instruction that produces no value. */
  emit(instr: string): void {
    this.current.instructions.push(instr);
  }

  /** Append `%N = <instr>` and return `%N`. */
  emitValue(instr: string): string {
    const tmp = this.newTemp();
    this.emit(`${tmp} = ${instr}`);
    return tmp;
  }

  /**
   * Emit an alloca in the entry block. Keeping every alloca at the top of
   * `entry` is what lets LLVM's mem2reg pass promote them to registers.
   */
  emitAlloca(name: string, type: string): string {
    const slot = `%${name}`;
    this.entryPrelude.push(`${slot} = alloca ${type}`);
    return slot;
  }

  get currentBlock(): IRBlock {
    return this.current;
  }

  toString(): string {
    const params = this.params.map((p) => `${p.type} %${p.name}`).join(", ");
    const header = `define ${this.returnType} @${this.name}(${params}) {`;
    const body = this.blocks
      .map((b, i) => {
        if (i === 0 && this.entryPrelude.length > 0) {
          const withPrelude = new IRBlock(b.label);
          withPrelude.instructions.push(...this.entryPrelude, ...b.instructions);
          return withPrelude.toString();
        }
        return b.toString();
      })
      .join("\n\n");
    return `${header}\n${body}\n}`;
  }
}

export class IRModule {
  private readonly functions: IRFunction[] = [];

  constructor(readonly sourceFileName: string) {}

  addFunction(fn: IRFunction): void {
    this.functions.push(fn);
  }

  toString(): string {
    const header = [`; ModuleID = '${this.sourceFileName}'`, `source_filename = "${this.sourceFileName}"`];
    return [...header, "", this.functions.map((f) => f.toString()).join("\n\n")].join("\n") + "\n";
  }
}
