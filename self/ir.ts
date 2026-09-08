// The textual LLVM IR builder for stage1 (`src/codegen/ir.ts`,
// docs/wp14-selfhost.md milestone S4).
//
// Responsible only for the *shape* of the output: module header, type and
// global declarations, function definitions, basic blocks, attribute groups
// and SSA temporary numbering. It knows nothing about the language; every
// instruction is a string the emitter decided on.
//
// SSA numbering follows LLVM's rules: unnamed values (`%0`, `%1`, ...) are
// numbered per function in order of definition. Every block and every
// parameter this builder emits is *named*, so they never consume a number and
// the first temporary of a function is always `%0`.
//
// Two shape changes from `src/`, both forced by the language and neither
// visible in the output:
//
//   - `Map<string, i32>` becomes `StringMap`, for the label and alloca
//     counters that suffix a reused name (`if.then.1`, `x.addr.1`).
//   - Deduplication of the module's declaration lists is `indexOf` on a
//     `string[]` rather than a `Set`. The lists are short — a module declares
//     a few dozen symbols — and they have to keep insertion order anyway,
//     which is what makes the output stable enough to diff against stage0.
//
// The metadata list is the `-g` half (`self/debug.ts`): numbered nodes that
// are interned by text so identical `!DILocation`s share one, plus the named
// lines (`!llvm.dbg.cu`) that must precede them. Without `-g` nothing is
// added and the module text is byte for byte what it was.

import { StringBuilder } from "./strings";
import { StringMap } from "./map";

/** One basic block: a label and the instructions under it. */
export class IRBlock {
  label: string;
  instructions: string[];

  constructor(label: string) {
    this.label = label;
    this.instructions = [];
  }

  /**
   * Whether a terminator has been emitted. `src/` asks this with the regular
   * expression `^(ret|br|switch|unreachable)\b`; the language has no regular
   * expressions, and a prefix test with the word boundary spelled out is the
   * same predicate over the instructions this builder can produce.
   */
  terminated(): boolean {
    if (this.instructions.length === 0) {
      return false;
    }
    const last = this.instructions[this.instructions.length - 1];
    return (
      startsWithWord(last, "ret") ||
      startsWithWord(last, "br") ||
      startsWithWord(last, "switch") ||
      startsWithWord(last, "unreachable")
    );
  }

  toText(): string {
    const out = new StringBuilder();
    out.add(this.label);
    out.add(":\n");
    let i = 0;
    while (i < this.instructions.length) {
      if (i > 0) {
        out.add("\n");
      }
      out.add("  ");
      out.add(this.instructions[i]);
      i = i + 1;
    }
    return out.toText();
  }
}

/**
 * `text` begins with `word` at a word boundary, which is `\b` in the regular
 * expression `src/` uses. The boundary matters: with `-g` an `unreachable` is
 * written `unreachable, !dbg !9`, so testing only for a following space would
 * miss the terminator and the emitter would add a second one.
 */
function startsWithWord(text: string, word: string): boolean {
  if (!text.startsWith(word)) {
    return false;
  }
  return text.length === word.length || !isWordByte(text.charCodeAt(word.length));
}

/** The `\w` of a regular expression: a letter, a digit or an underscore. */
function isWordByte(code: i32): boolean {
  if (code >= 48 && code <= 57) {
    return true;
  }
  if (code >= 65 && code <= 90) {
    return true;
  }
  if (code >= 97 && code <= 122) {
    return true;
  }
  return code === 95;
}

/** One parameter of a `define`: `<type> <attrs...> %<name>`. */
export class IRParam {
  name: string;
  type: string;
  attrs: string[];

  constructor(name: string, type: string, attrs: string[]) {
    this.name = name;
    this.type = type;
    this.attrs = attrs;
  }
}

export class IRFunction {
  name: string;
  params: IRParam[];
  returnType: string;
  blocks: IRBlock[];
  current: IRBlock;
  nextTemp: i32;
  /** Instructions hoisted into the entry block before everything else (allocas). */
  entryPrelude: string[];
  /** How many times each block base name has been handed out (`if.then`, `if.then.1`, ...). */
  labelCounts: StringMap;
  /** The same for alloca names (`x.addr`, `x.addr.1`, ...). */
  allocaCounts: StringMap;
  /** Function attribute group reference, e.g. `#0`. Empty when there is none. */
  attrGroup: string;
  returnAttrs: string[];
  /** Linkage keyword (`internal`, ...). Empty means LLVM's default, external. */
  linkage: string;
  /** `!N` of the function's `DISubprogram` (`-g`); empty without debug info. */
  subprogram: string;
  /**
   * `!N` of the `DILocation` to attach to every instruction emitted from now
   * on (`-g`). Empty means none: the emitter sets it when a statement or an
   * expression begins and restores the previous one afterwards.
   */
  dbgLocation: string;

  constructor(name: string, params: IRParam[], returnType: string) {
    this.name = name;
    this.params = params;
    this.returnType = returnType;
    this.current = new IRBlock("entry");
    this.blocks = [this.current];
    this.nextTemp = 0;
    this.entryPrelude = [];
    this.labelCounts = new StringMap();
    this.allocaCounts = new StringMap();
    this.attrGroup = "";
    this.returnAttrs = [];
    this.linkage = "";
    this.subprogram = "";
    this.dbgLocation = "";
  }

  /** Allocate the next unnamed SSA temporary: `%0`, `%1`, ... */
  newTemp(): string {
    const temp = `%${this.nextTemp}`;
    this.nextTemp = this.nextTemp + 1;
    return temp;
  }

  /** The debug location instructions currently carry, so a caller can restore it. */
  location(): string {
    return this.dbgLocation;
  }

  /** Set (or with `""` clear) the debug location appended to subsequent instructions. */
  setLocation(ref: string): void {
    this.dbgLocation = ref;
  }

  /** Append an instruction that produces no value, with `, !dbg !N` while a location is active. */
  emit(instr: string): void {
    if (this.dbgLocation.length > 0) {
      this.current.instructions.push(`${instr}, !dbg ${this.dbgLocation}`);
    } else {
      this.current.instructions.push(instr);
    }
  }

  /** Append `%N = <instr>` and answer `%N`. */
  emitValue(instr: string): string {
    const temp = this.newTemp();
    this.emit(`${temp} = ${instr}`);
    return temp;
  }

  /**
   * Emit an alloca in the entry block. Keeping every alloca at the top of
   * `entry` is what lets LLVM's mem2reg promote them to registers. A name
   * handed out before (two `let i` in sibling blocks, two `for (const x of
   * ...)` loops) gets a `.N` suffix, as block labels do. `align` of 0 means
   * none, which is what `--plain` asks for.
   */
  emitAlloca(name: string, type: string, align: i32): string {
    const n = this.allocaCounts.get(name, 0);
    this.allocaCounts.set(name, n + 1);
    const slot = n === 0 ? `%${name}` : `%${name}.${n}`;
    const suffix = align > 0 ? `, align ${align}` : "";
    this.entryPrelude.push(`${slot} = alloca ${type}${suffix}`);
    return slot;
  }

  currentBlock(): IRBlock {
    return this.current;
  }

  /**
   * Create a block whose label is unique within the function: the first
   * `if.then` is `if.then`, later ones `if.then.1`, `if.then.2`, ... The block
   * is not part of the function until `placeBlock` appends it, so labels can
   * be reserved in source order while blocks are laid out in control-flow
   * order. Named blocks never consume an SSA number.
   */
  newBlock(base: string): IRBlock {
    const n = this.labelCounts.get(base, 0);
    this.labelCounts.set(base, n + 1);
    return new IRBlock(n === 0 ? base : `${base}.${n}`);
  }

  /** Append a block to the function body and make it the insertion point. */
  placeBlock(block: IRBlock): void {
    this.blocks.push(block);
    this.current = block;
  }

  toText(): string {
    const params: string[] = [];
    for (const p of this.params) {
      const parts: string[] = [p.type];
      for (const attr of p.attrs) {
        parts.push(attr);
      }
      parts.push(`%${p.name}`);
      params.push(parts.join(" "));
    }
    const retParts: string[] = [];
    for (const attr of this.returnAttrs) {
      retParts.push(attr);
    }
    retParts.push(this.returnType);
    const attrs = this.attrGroup.length > 0 ? ` ${this.attrGroup}` : "";
    const linkage = this.linkage.length > 0 ? `${this.linkage} ` : "";
    const dbg = this.subprogram.length > 0 ? ` !dbg ${this.subprogram}` : "";
    const out = new StringBuilder();
    out.add(`define ${linkage}${retParts.join(" ")} @${this.name}(${params.join(", ")})${attrs}${dbg} {\n`);
    let i = 0;
    while (i < this.blocks.length) {
      if (i > 0) {
        out.add("\n\n");
      }
      const block = this.blocks[i];
      if (i === 0 && this.entryPrelude.length > 0) {
        const withPrelude = new IRBlock(block.label);
        for (const instr of this.entryPrelude) {
          withPrelude.instructions.push(instr);
        }
        for (const instr of block.instructions) {
          withPrelude.instructions.push(instr);
        }
        out.add(withPrelude.toText());
      } else {
        out.add(block.toText());
      }
      i = i + 1;
    }
    out.add("\n}");
    return out.toText();
  }
}

export class IRModule {
  sourceFileName: string;
  typeDecls: string[];
  globals: string[];
  declarations: string[];
  functions: IRFunction[];
  /** Raw IR text (the inline allocator) placed after the declarations. */
  rawDefinitions: string[];
  attrGroups: string[];
  /** `target datalayout` / `target triple`; empty keeps the module target-neutral. */
  targetHeader: string[];
  /** Metadata nodes by number (`!N = <text>`), for debug info (`-g`). Identical texts share a node. */
  metadata: string[];
  /** Named metadata lines (`!llvm.dbg.cu = !{...}`), printed before the numbered nodes. */
  namedMetadata: string[];

  constructor(sourceFileName: string) {
    this.sourceFileName = sourceFileName;
    this.typeDecls = [];
    this.globals = [];
    this.declarations = [];
    this.functions = [];
    this.rawDefinitions = [];
    this.attrGroups = [];
    this.targetHeader = [];
    this.metadata = [];
    this.namedMetadata = [];
  }

  /** Intern a metadata node and answer its reference (`!N`). */
  addMetadata(text: string): string {
    let index = this.metadata.indexOf(text);
    if (index < 0) {
      index = this.metadata.length;
      this.metadata.push(text);
    }
    return `!${index}`;
  }

  /**
   * Reserve a number for `setMetadata` to fill later. A composite type has to
   * be referenced before its members are built — a field of a class may be the
   * class itself — so its number is handed out before its text exists.
   */
  reserveMetadata(): string {
    const index = this.metadata.length;
    this.metadata.push("");
    return `!${index}`;
  }

  setMetadata(ref: string, text: string): void {
    this.metadata[metadataIndex(ref)] = text;
  }

  addNamedMetadata(line: string): void {
    if (this.namedMetadata.indexOf(line) < 0) {
      this.namedMetadata.push(line);
    }
  }

  addTypeDecl(text: string): void {
    if (this.typeDecls.indexOf(text) < 0) {
      this.typeDecls.push(text);
    }
  }

  addGlobal(text: string): void {
    if (this.globals.indexOf(text) < 0) {
      this.globals.push(text);
    }
  }

  addDeclaration(text: string): void {
    if (this.declarations.indexOf(text) < 0) {
      this.declarations.push(text);
    }
  }

  addRawDefinition(text: string): void {
    if (this.rawDefinitions.indexOf(text) < 0) {
      this.rawDefinitions.push(text);
    }
  }

  addFunction(fn: IRFunction): void {
    this.functions.push(fn);
  }

  /** Intern an attribute set and answer its group reference (`#N`). */
  attrGroupFor(attrs: string[]): string {
    const text = attrs.join(" ");
    let index = this.attrGroups.indexOf(text);
    if (index < 0) {
      index = this.attrGroups.length;
      this.attrGroups.push(text);
    }
    return `#${index}`;
  }

  toText(): string {
    const sections: string[] = [];
    const header: string[] = [`; ModuleID = '${this.sourceFileName}'`, `source_filename = "${this.sourceFileName}"`];
    for (const line of this.targetHeader) {
      header.push(line);
    }
    sections.push(header.join("\n"));
    if (this.typeDecls.length > 0) {
      sections.push(this.typeDecls.join("\n"));
    }
    if (this.globals.length > 0) {
      sections.push(this.globals.join("\n"));
    }
    if (this.declarations.length > 0) {
      sections.push(this.declarations.join("\n"));
    }
    if (this.rawDefinitions.length > 0) {
      sections.push(this.rawDefinitions.join("\n\n"));
    }
    if (this.functions.length > 0) {
      const bodies: string[] = [];
      for (const fn of this.functions) {
        bodies.push(fn.toText());
      }
      sections.push(bodies.join("\n\n"));
    }
    if (this.attrGroups.length > 0) {
      const groups: string[] = [];
      let i = 0;
      while (i < this.attrGroups.length) {
        groups.push(`attributes #${i} = { ${this.attrGroups[i]} }`);
        i = i + 1;
      }
      sections.push(groups.join("\n"));
    }
    if (this.metadata.length > 0) {
      const nodes: string[] = [];
      for (const line of this.namedMetadata) {
        nodes.push(line);
      }
      let m = 0;
      while (m < this.metadata.length) {
        nodes.push(`!${m} = ${this.metadata[m]}`);
        m = m + 1;
      }
      sections.push(nodes.join("\n"));
    }
    return `${sections.join("\n\n")}\n`;
  }
}

/**
 * The number in a `!N` reference. `src/` writes `Number(ref.slice(1))`; the
 * digits are read here instead so that filling a reserved slot needs no
 * `parseInt` call at run time.
 */
function metadataIndex(ref: string): i32 {
  let value = 0;
  let i = 1; // past the `!`
  while (i < ref.length) {
    value = value * 10 + (ref.charCodeAt(i) - 48);
    i = i + 1;
  }
  return value;
}
