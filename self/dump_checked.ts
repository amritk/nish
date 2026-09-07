// `dump_checked <file>`: the signatures stage1's pass 1 collected, in exactly
// the format `statictsc --emit-checked` prints them (`src/dump.ts`).
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
import { Parser } from "./parser";
import { ROLE_CONSTRUCTOR, ROLE_METHOD, STRUCT_CLASS, ConstInfo, FunctionSig, StructInfo } from "./program";
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
  checker.collectSignatures();
  checker.foldConstants();
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
  }
  write(`${out.join("\n")}\n`);
  return 0;
}
