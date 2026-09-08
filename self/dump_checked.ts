// `dump_checked <file>`: the signatures stage1's pass 1 collected, in exactly
// the format `amritc --emit-checked` prints them (`src/dump.ts`).
//
// This is how S3 is tested (docs/wp14-selfhost.md §6 rule 3):
// `tests/self/checked_oracle.js` runs stage0 with `--emit-checked` over the
// same file, keeps the lines pass 1 is responsible for, and diffs. The lines
// it drops are the ones later phases fill in — the attribute facts and the
// per-body locals and callees — so the whitelist of files that agree grows
// as those land rather than the format changing.
//
// One module at a time: `import` is reported as `unbound`, because resolving
// a specifier means loading another file and that is the driver's job in S5.

import { Checker } from "./checker";
import { DiagnosticSink, SourceFile } from "./diagnostics";
import { NUMBER_MODE_F64, NUMBER_MODE_I32 } from "./context";
import { jsonQuote } from "./strings";
import { N_BLOCK, N_CALL, N_CONSTRUCTOR, N_IDENT, N_NEW, N_VAR_DECL, Node } from "./nodes";
import { Parser } from "./parser";
import { validate } from "./validator";
import {
  CheckedProgram,
  ConstInfo,
  FunctionSig,
  ROLE_CONSTRUCTOR,
  ROLE_METHOD,
  STRUCT_CLASS,
  StructInfo,
} from "./program";
import { T_BOOL, T_F64, T_STRING, TypeTable } from "./types";

/** `name(a: i32, b: string): void`, the signature as `src/dump.ts` writes it. */
function signatureText(table: TypeTable, sig: FunctionSig): string {
  const params: string[] = [];
  let i = 0;
  while (i < sig.paramNames.length) {
    params.push(`${sig.paramNames[i]}: ${table.typeName(sig.paramTypes[i])}`);
    i = i + 1;
  }
  return `${sig.sourceName}(${params.join(", ")}): ${table.typeName(sig.returnType)}`;
}

function structText(table: TypeTable, info: StructInfo, out: string[]): void {
  const kind = info.kind === STRUCT_CLASS ? "class" : "interface";
  const exported = info.exported ? " exported" : "";
  out.push(`struct ${info.name} (${kind}) size=${info.size} align=${info.align}${exported}`);
  if (info.implementsNames.length > 0) {
    out.push(`  implements ${info.implementsNames.join(", ")}`);
  }
  for (const field of info.fields) {
    const parts: string[] = [];
    if (field.readonly) {
      parts.push("readonly");
    }
    if (field.initializer !== null) {
      parts.push("initialized");
    }
    const extras = parts.length > 0 ? ` ${parts.join(" ")}` : "";
    out.push(
      `  field ${field.name}: ${table.typeName(field.type)} index=${field.index} offset=${field.offset}${extras}`
    );
  }
  const ctor = info.ctor;
  if (ctor !== null) {
    out.push(`  constructor -> @${ctor.name}`);
  }
  let i = 0;
  while (i < info.methodSigs.length) {
    out.push(`  method ${info.methodIndex.keyAt(i)} -> @${info.methodSigs[i].name}`);
    i = i + 1;
  }
}

/** The folded value in source syntax, so a dump can be pasted back into a program. */
function constantText(table: TypeTable, info: ConstInfo): string {
  if (info.type === T_STRING) {
    return jsonQuote(info.textValue);
  }
  if (info.type === T_F64) {
    return `${info.floatValue}`;
  }
  if (info.type === T_BOOL) {
    return info.intValue === toI64(0) ? "false" : "true";
  }
  return `${info.intValue}`;
}

/** `line:col`, as `src/dump.ts` writes a position. */
function position(source: SourceFile, offset: i32): string {
  return `${source.lineOf(offset)}:${source.columnOf(offset)}`;
}

/**
 * The locals and callees of one body, in source order, read back out of the
 * side tables. This is the half of the dump that pass 2 fills in, so it is
 * also the half that says whether pass 2 bound the same things stage0 did.
 */
function bodyTables(
  program: CheckedProgram,
  source: SourceFile,
  table: TypeTable,
  sig: FunctionSig,
  out: string[]
): void {
  const body = sig.decl.kind === N_CONSTRUCTOR ? sig.decl.children[1] : sig.decl.children[3];
  if (body.kind === N_BLOCK) {
    walkBody(program, source, table, body, out);
  }
}

function walkBody(
  program: CheckedProgram,
  source: SourceFile,
  table: TypeTable,
  node: Node,
  out: string[]
): void {
  if (node.kind === N_VAR_DECL) {
    const local = program.nodeLocals[node.id];
    if (local !== null) {
      const kind = local.mutable ? "let" : "const";
      out.push(
        `  local ${position(source, node.start)} ${local.name}: ${table.typeName(local.type)} (${kind})`
      );
    }
  } else if (node.kind === N_CALL) {
    const callee = program.nodeCallees[node.id];
    if (callee !== null) {
      out.push(`  callee ${position(source, node.start)} ${callee.sourceName} -> @${callee.name}`);
    }
  } else if (node.kind === N_NEW && node.children[0].kind === N_IDENT) {
    // `new C(...)` is bound through the struct registry rather than the
    // callee table, and only a class's *own* constructor is named there.
    const info = program.struct(node.children[0].text);
    if (info !== null) {
      const ctor = info.ctor;
      if (ctor !== null) {
        out.push(`  callee ${position(source, node.start)} new ${info.name} -> @${ctor.name}`);
      }
    }
  }
  for (const child of node.children) {
    walkBody(program, source, table, child, out);
  }
}

export function main(): number {
  if (process.argv.length < 2) {
    console.error("usage: dump_checked [--number-mode f64] <file>");
    return 2;
  }
  let numberMode = NUMBER_MODE_I32;
  let path = "";
  let arg = 1;
  while (arg < process.argv.length) {
    const value = process.argv[arg];
    if (value === "--number-mode") {
      arg = arg + 1;
      if (arg < process.argv.length && process.argv[arg] === "f64") {
        numberMode = NUMBER_MODE_F64;
      }
    } else {
      path = value;
    }
    arg = arg + 1;
  }
  const text = readFileSyncOrNull(path);
  if (text === null) {
    console.error(`dump_checked: cannot read ${path}`);
    return 1;
  }

  const source = new SourceFile(path, text);
  const parser = new Parser(source);
  const file = parser.parseSourceFile();
  for (const diagnostic of parser.diagnostics) {
    writeError(`${diagnostic.message()}\n`);
  }
  if (parser.diagnostics.length > 0) {
    return 1;
  }

  const sink = new DiagnosticSink();
  const table = new TypeTable();
  const checker = new Checker(table, source, file, true, parser.nodeCount, sink, numberMode);
  // Phase 0 first: what is forbidden by design is refused before the checker
  // has a chance to report it as something merely unsupported.
  validate(checker.ctx, file);
  if (sink.hasErrors()) {
    writeError(`${sink.format(20)}\n`);
    return 1;
  }
  checker.collectSignatures();
  // A whole compilation asks the *entry* module; one module on its own is the
  // entry, so its own `main` is the answer.
  checker.ctx.entryHasMain = checker.program.entryMain !== null;
  checker.foldConstants();
  checker.checkBodies();
  if (sink.hasErrors()) {
    writeError(`${sink.format(20)}\n`);
    return 1;
  }

  const program = checker.program;
  const out: string[] = [];
  out.push(`module ${path}${program.isEntry ? " (entry)" : ""}`);
  for (const imp of program.imports) {
    out.push(`import ${imp.localName} from ${jsonQuote(imp.specifier)} -> unbound`);
  }
  for (const info of program.constantList) {
    const tag = info.exported ? " [exported]" : "";
    out.push(`const ${info.name}: ${table.typeName(info.type)} = ${constantText(table, info)}${tag}`);
  }
  for (const info of program.structList) {
    if (info.origin === source) {
      structText(table, info, out);
    }
  }
  const entry = program.entryMain;
  for (const sig of program.functions) {
    const tags: string[] = [];
    if (sig.exported) {
      tags.push("exported");
    }
    if (sig.role === ROLE_METHOD) {
      tags.push("method");
    } else if (sig.role === ROLE_CONSTRUCTOR) {
      tags.push("constructor");
    }
    if (entry !== null && entry === sig) {
      tags.push("entry");
    }
    const suffix = tags.length > 0 ? ` [${tags.join(" ")}]` : "";
    out.push(`function ${signatureText(table, sig)} -> @${sig.name}${suffix}`);
    bodyTables(program, source, table, sig, out);
  }
  write(`${out.join("\n")}\n`);
  return 0;
}
