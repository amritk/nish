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
  /** How many times each block base name has been handed out (`if.then`, `if.then.1`, ...). */
  private readonly labelCounts = new Map<string, number>();
  /** Same for alloca names (`x.addr`, `x.addr.1`, ...). */
  private readonly allocaCounts = new Map<string, number>();
  /** Function attribute group reference, e.g. "#0". Empty when none. */
  attrGroup = "";
  returnAttrs: string[] = [];
  /** Linkage keyword (`internal`, ...). Empty means LLVM's default, external. */
  linkage = "";
  /** `!N` of the function's `DISubprogram` (`-g`, WP10); empty without debug info. */
  subprogram = "";
  /**
   * `!N` of the `DILocation` to attach to every instruction emitted from now
   * on (`-g`). Empty means none: the emitter sets it when a statement or
   * expression begins and restores the previous one after.
   */
  private dbgLocation = "";

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

  get location(): string {
    return this.dbgLocation;
  }

  /** Set (or with `""` clear) the debug location appended to subsequent instructions. */
  setLocation(ref: string): void {
    this.dbgLocation = ref;
  }

  /** Append an instruction that produces no value (with `, !dbg !N` while a debug location is active). */
  emit(instr: string): void {
    this.current.instructions.push(this.dbgLocation ? `${instr}, !dbg ${this.dbgLocation}` : instr);
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
   * A name handed out before (two `let i` in sibling blocks, two `for (const
   * x of ...)` loops) gets a `.N` suffix, as block labels do.
   */
  emitAlloca(name: string, type: string, align?: number): string {
    const n = this.allocaCounts.get(name) ?? 0;
    this.allocaCounts.set(name, n + 1);
    const slot = n === 0 ? `%${name}` : `%${name}.${n}`;
    const suffix = align ? `, align ${align}` : "";
    this.entryPrelude.push(`${slot} = alloca ${type}${suffix}`);
    return slot;
  }

  get currentBlock(): IRBlock {
    return this.current;
  }

  /**
   * Create a block whose label is unique within the function: the first
   * `if.then` is `if.then`, later ones `if.then.1`, `if.then.2`, ... The
   * block is not part of the function until `placeBlock` appends it, so
   * labels can be reserved in source order while blocks are laid out in
   * control-flow order. Named blocks never consume an SSA number.
   */
  newBlock(base: string): IRBlock {
    const n = this.labelCounts.get(base) ?? 0;
    this.labelCounts.set(base, n + 1);
    return new IRBlock(n === 0 ? base : `${base}.${n}`);
  }

  /** Append a block to the function body and make it the insertion point. */
  placeBlock(block: IRBlock): void {
    this.blocks.push(block);
    this.current = block;
  }

  toString(): string {
    const params = this.params
      .map((p) => [p.type, ...(p.attrs ?? []), `%${p.name}`].join(" "))
      .join(", ");
    const ret = [...this.returnAttrs, this.returnType].join(" ");
    const attrs = this.attrGroup ? ` ${this.attrGroup}` : "";
    const linkage = this.linkage ? `${this.linkage} ` : "";
    const dbg = this.subprogram ? ` !dbg ${this.subprogram}` : "";
    const header = `define ${linkage}${ret} @${this.name}(${params})${attrs}${dbg} {`;
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
  /** `target datalayout` / `target triple` lines (WP9, `--target`); empty keeps the module target-neutral. */
  targetHeader: string[] = [];
  /** Metadata nodes by number (`!N = <text>`), for debug info (`-g`, WP10). Identical texts share a node. */
  private readonly metadata: string[] = [];
  /** Named metadata lines (`!llvm.dbg.cu = !{...}`), printed before the numbered nodes. */
  private readonly namedMetadata: string[] = [];

  constructor(readonly sourceFileName: string) {}

  /** Intern a metadata node and return its reference (`!N`). */
  addMetadata(text: string): string {
    let idx = this.metadata.indexOf(text);
    if (idx < 0) idx = this.metadata.push(text) - 1;
    return `!${idx}`;
  }
  /** Reserve a number to be filled by `setMetadata`, for nodes that must be referenced before they are complete. */
  reserveMetadata(): string {
    return `!${this.metadata.push("") - 1}`;
  }
  setMetadata(ref: string, text: string): void {
    this.metadata[Number(ref.slice(1))] = text;
  }
  addNamedMetadata(line: string): void {
    if (!this.namedMetadata.includes(line)) this.namedMetadata.push(line);
  }

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
      [`; ModuleID = '${this.sourceFileName}'`, `source_filename = "${this.sourceFileName}"`, ...this.targetHeader].join(
        "\n"
      ),
    ];
    if (this.typeDecls.length > 0) sections.push(this.typeDecls.join("\n"));
    if (this.globals.length > 0) sections.push(this.globals.join("\n"));
    if (this.declarations.length > 0) sections.push(this.declarations.join("\n"));
    if (this.rawDefinitions.length > 0) sections.push(this.rawDefinitions.join("\n\n"));
    if (this.functions.length > 0) sections.push(this.functions.map((f) => f.toString()).join("\n\n"));
    if (this.attrGroups.length > 0) {
      sections.push(this.attrGroups.map((a, i) => `attributes #${i} = { ${a} }`).join("\n"));
    }
    if (this.metadata.length > 0) {
      sections.push([...this.namedMetadata, ...this.metadata.map((m, i) => `!${i} = ${m}`)].join("\n"));
    }
    return sections.join("\n\n") + "\n";
  }
}
