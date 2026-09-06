/**
 * Minimal textual LLVM IR builder.
 *
 * Responsible only for the *shape* of the output: module header, type and
 * global declarations, function definitions, basic blocks, attribute groups,
 * and SSA temporary numbering. It knows nothing about TypeScript. All
 * instructions are plain strings appended to the current block; the emitter
 * decides what those strings are.
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
  attrs?: string[]; // e.g. ["noundef", "noalias"]
}

export class IRFunction {
  private blocks: IRBlock[] = [];
  private current: IRBlock;
  private nextTemp = 0;
  /** Instructions hoisted into the entry block before everything else (allocas). */
  private readonly entryPrelude: string[] = [];
  /** Function attribute group reference, e.g. "#0". Empty when none. */
  attrGroup = "";
  returnAttrs: string[] = [];

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
  emitAlloca(name: string, type: string, align?: number): string {
    const slot = `%${name}`;
    const suffix = align ? `, align ${align}` : "";
    this.entryPrelude.push(`${slot} = alloca ${type}${suffix}`);
    return slot;
  }

  get currentBlock(): IRBlock {
    return this.current;
  }

  toString(): string {
    const params = this.params
      .map((p) => [p.type, ...(p.attrs ?? []), `%${p.name}`].join(" "))
      .join(", ");
    const ret = [...this.returnAttrs, this.returnType].join(" ");
    const attrs = this.attrGroup ? ` ${this.attrGroup}` : "";
    const header = `define ${ret} @${this.name}(${params})${attrs} {`;
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
  private readonly typeDecls: string[] = [];
  private readonly globals: string[] = [];
  private readonly declarations: string[] = [];
  private readonly functions: IRFunction[] = [];
  /** Raw IR text (e.g. the inline allocator) placed after declarations. */
  private readonly rawDefinitions: string[] = [];
  private readonly attrGroups: string[] = [];

  constructor(readonly sourceFileName: string) {}

  addTypeDecl(text: string): void {
    if (!this.typeDecls.includes(text)) this.typeDecls.push(text);
  }
  addGlobal(text: string): void {
    if (!this.globals.includes(text)) this.globals.push(text);
  }
  addDeclaration(text: string): void {
    if (!this.declarations.includes(text)) this.declarations.push(text);
  }
  addRawDefinition(text: string): void {
    if (!this.rawDefinitions.includes(text)) this.rawDefinitions.push(text);
  }
  addFunction(fn: IRFunction): void {
    this.functions.push(fn);
  }

  /** Intern an attribute set and return its group reference (`#N`). */
  attrGroup(attrs: string[]): string {
    const text = attrs.join(" ");
    let idx = this.attrGroups.indexOf(text);
    if (idx < 0) idx = this.attrGroups.push(text) - 1;
    return `#${idx}`;
  }

  toString(): string {
    const sections: string[] = [
      [`; ModuleID = '${this.sourceFileName}'`, `source_filename = "${this.sourceFileName}"`].join("\n"),
    ];
    if (this.typeDecls.length) sections.push(this.typeDecls.join("\n"));
    if (this.globals.length) sections.push(this.globals.join("\n"));
    if (this.declarations.length) sections.push(this.declarations.join("\n"));
    if (this.rawDefinitions.length) sections.push(this.rawDefinitions.join("\n\n"));
    if (this.functions.length) sections.push(this.functions.map((f) => f.toString()).join("\n\n"));
    if (this.attrGroups.length) {
      sections.push(this.attrGroups.map((a, i) => `attributes #${i} = { ${a} }`).join("\n"));
    }
    return sections.join("\n\n") + "\n";
  }
}
