// The `--emit-checked` dump: the side tables stage1's checker filled in, in
// exactly the format `amritc --emit-checked` prints them (`src/dump.ts`).
//
// It lives apart from the two programs that print it because both do: the
// `self/compile.ts` driver writes it for `--emit-checked`, and
// `self/dump_checked.ts` is the one-file entry `tests/self/checked_oracle.js`
// spawns. One module means one format, which is the whole point of a dump that
// is compared byte for byte with stage0's.
//
// A *whole program*, not one module: the entry is loaded together with
// everything it imports through `self/compilation.ts` (the S5 driver), checked
// as one program, and every module is dumped in load order, exactly as
// `dumpChecked(compilation)` walks `compilation.modules`. So an `import` line
// names what pass 1b bound it to — a function, a struct or a constant — and
// each module lists only the constants, structs and functions it declares
// itself.
//
// The lines stage0 prints that the checker is not responsible for — the
// attribute pass's facts, escape sets and stack sites — are dropped by the
// oracle rather than left out here.

import { Compilation, ModuleUnit } from "./compilation";
import { SourceFile } from "./diagnostics";
import { jsonQuote } from "./strings";
import { N_CALL, N_CONSTRUCTOR, N_EMPTY, N_IDENT, N_NEW, N_VAR_DECL, Node } from "./nodes";
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
function constantSyntax(table: TypeTable, info: ConstInfo): string {
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
  // Any body, not just a block: a concise arrow body is the expression it
  // returns, and a call inside it is a callee like any other.
  if (body.kind !== N_EMPTY) {
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

/**
 * One module of a checked program, in the order `src/dump.ts` writes it: the
 * module line, what each import bound to, then the constants, structs and
 * functions *this* module declares. An imported constant, struct or signature
 * belongs to the section of the module that defines it, which is why each list
 * is filtered by origin rather than printed as the checker's table holds it —
 * pass 1b adds every imported name to the importer's tables too.
 */
function dumpModule(unit: ModuleUnit, table: TypeTable, out: string[]): void {
  const program = unit.checker.program;
  const source = unit.source;
  out.push(`module ${unit.path}${unit.isEntry ? " (entry)" : ""}`);
  for (const imp of program.imports) {
    const struct = imp.struct;
    const constant = imp.constant;
    const sig = imp.sig;
    let what = "unbound";
    if (struct !== null) {
      what = `struct ${struct.name}`;
    } else if (constant !== null) {
      what = `const ${constant.name}`;
    } else if (sig !== null) {
      what = `function @${sig.name}`;
    }
    out.push(`import ${imp.localName} from ${jsonQuote(imp.specifier)} -> ${what}`);
  }
  for (const info of program.constantList) {
    if (info.origin !== source) {
      continue; // imported: listed by its own module
    }
    const tag = info.exported ? " [exported]" : "";
    out.push(`const ${info.name}: ${table.typeName(info.type)} = ${constantSyntax(table, info)}${tag}`);
  }
  for (const info of program.structList) {
    if (info.origin === source) {
      structText(table, info, out);
    }
  }
  const entry = program.entryMain;
  for (const sig of program.functions) {
    if (!sig.definedIn(source)) {
      continue; // imported: listed by the module that defines it
    }
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
}

/**
 * The `--emit-checked` dump of a whole checked program: every module in load
 * order, in the format `src/dump.ts` writes it. `self/compile.ts` prints this
 * for `--emit-checked` and this file's `main` prints it for the oracle, so the
 * two can never drift into two spellings of the same dump.
 */
export function checkedText(compilation: Compilation): string {
  const out: string[] = [];
  for (const unit of compilation.modules) {
    dumpModule(unit, compilation.table, out);
  }
  return `${out.join("\n")}\n`;
}

