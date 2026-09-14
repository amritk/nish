// The `--emit-checked` dump: the side tables stage1's checker filled in, in
// exactly the format `nish --emit-checked` prints them (`src/dump.ts`).
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
// attribute pass's facts, escape sets and stack sites — are printed here too,
// which means running the whole-program fixpoint before the dump exactly as
// `dumpChecked` does (`compilation.analyze()`). They used to be left out and
// filtered away by the oracle, and WP19's `--parity` counted that as the
// biggest single difference between the two compilers: 193 of its 206 rows.

import { FactsTable, FunctionFacts } from "./attributes";
import { Compilation, ModuleUnit } from "./compilation";
import { SourceFile } from "./diagnostics";
import { EFFECT_READ, EFFECT_WRITE } from "./runtime";
import { StringSet } from "./map";
import { compareStrings, jsonQuote } from "./strings";
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

/** A boolean as the dump spells it; the language does not interpolate one. */
const flag = (value: boolean): string => value ? "true" : "false";

/** The strings in byte order, which is what `[...set].sort()` gives stage0. */
const sortedStrings = (set: StringSet): string[] => {
  const out: string[] = [];
  let i = 0;
  while (i < set.size()) {
    out.push(set.at(i));
    i = i + 1;
  }
  // Insertion sort: these are a function's parameter names and its callees, so
  // the lists are short and the constant matters more than the exponent.
  let a = 1;
  while (a < out.length) {
    const key = out[a];
    let b = a - 1;
    while (b >= 0 && compareStrings(out[b], key) > 0) {
      out[b + 1] = out[b];
      b = b - 1;
    }
    out[b + 1] = key;
    a = a + 1;
  }
  return out;
};

/**
 * The attribute pass's facts for one function, in `src/dump.ts`'s `factsText`
 * format and order. Every field is printed the way stage0 prints it, including
 * the two lists it sorts and the `returnDeref` it omits for a function that
 * does not return a struct, because `checked_oracle.js` compares these lines
 * byte for byte like all the others.
 */
const factsText = (table: TypeTable, sig: FunctionSig, facts: FunctionFacts, out: string[]): void => {
  let effect = "none";
  if (facts.effect === EFFECT_READ) {
    effect = "read";
  } else if (facts.effect === EFFECT_WRITE) {
    effect = "write";
  }
  const flags: string[] = [
    `effect=${effect}`,
    `willReturn=${flag(facts.willReturn)}`,
    `hasLoops=${flag(facts.hasLoops)}`,
    `loopsBounded=${flag(facts.loopsBounded)}`,
    `readsMemory=${flag(facts.readsMemory)}`,
    `hasTrap=${flag(facts.hasTrap)}`,
    `callsNoReturn=${flag(facts.callsNoReturn)}`,
    `allocates=${flag(facts.allocates)}`,
    `arenaScope=${flag(facts.arenaScope)}`,
    `freshThis=${flag(facts.freshThis)}`,
  ];
  // stage0 leaves the field undefined unless the return type has a size to
  // dereference, which is a struct or a `Result` (`structSize` in
  // `src/codegen/attributes.ts`); stage1 stores 0 for the same thing, so the
  // condition is the type and not the number.
  const returns = sig.returnType;
  if (table.isStruct(returns) || table.isResult(returns)) {
    flags.push(`returnDeref=${facts.returnDeref}`);
  }
  out.push(`  facts: ${flags.join(" ")}`);
  const escaping = sortedStrings(facts.escaping);
  if (escaping.length > 0) {
    out.push(`  escaping: ${escaping.join(" ")}`);
  }
  const callees = sortedStrings(facts.callees);
  if (callees.length > 0) {
    out.push(`  calls: ${callees.join(" ")}`);
  }
  // Signature order on both sides: stage0 walks a `Map` it filled in that
  // order and stage1 an array it pushed in that order.
  for (const p of facts.pointerParams) {
    const passed: string[] = [];
    let i = 0;
    while (i < p.passedToCallees.length) {
      passed.push(`${p.passedToCallees[i]}#${p.passedToIndices[i]}`);
      i = i + 1;
    }
    const to = passed.length > 0 ? ` passedTo=${passed.join(" ")}` : "";
    out.push(
      `  pointer ${p.name}: size=${p.size} writesThrough=${flag(p.writesThrough)} captured=${flag(p.captured)}${to}`
    );
  }
  let sites = 0;
  for (const site of facts.stackSites) {
    if (site) {
      sites = sites + 1;
    }
  }
  out.push(`  stackSites=${sites} stackLocals=${facts.stackLocals.length}`);
};

/** `name(a: i32, b: string): void`, the signature as `src/dump.ts` writes it. */
const signatureText = (table: TypeTable, sig: FunctionSig): string => {
  const params: string[] = [];
  let i = 0;
  while (i < sig.paramNames.length) {
    params.push(`${sig.paramNames[i]}: ${table.typeName(sig.paramTypes[i])}`);
    i = i + 1;
  }
  return `${sig.sourceName}(${params.join(", ")}): ${table.typeName(sig.returnType)}`;
};

const structText = (table: TypeTable, info: StructInfo, out: string[]): void => {
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
};

/** The folded value in source syntax, so a dump can be pasted back into a program. */
const constantSyntax = (table: TypeTable, info: ConstInfo): string => {
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
};

/** `line:col`, as `src/dump.ts` writes a position. */
const position = (source: SourceFile, offset: i32): string => `${source.lineOf(offset)}:${source.columnOf(offset)}`;

/**
 * The locals and callees of one body, in source order, read back out of the
 * side tables. This is the half of the dump that pass 2 fills in, so it is
 * also the half that says whether pass 2 bound the same things stage0 did.
 */
const bodyTables = (
  program: CheckedProgram,
  source: SourceFile,
  table: TypeTable,
  sig: FunctionSig,
  out: string[]
): void => {
  const body = sig.decl.kind === N_CONSTRUCTOR ? sig.decl.children[1] : sig.decl.children[3];
  // Any body, not just a block: a concise arrow body is the expression it
  // returns, and a call inside it is a callee like any other.
  if (body.kind !== N_EMPTY) {
    walkBody(program, source, table, body, out);
  }
};

const walkBody = (
  program: CheckedProgram,
  source: SourceFile,
  table: TypeTable,
  node: Node,
  out: string[]
): void => {
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
};

/**
 * One module of a checked program, in the order `src/dump.ts` writes it: the
 * module line, what each import bound to, then the constants, structs and
 * functions *this* module declares. An imported constant, struct or signature
 * belongs to the section of the module that defines it, which is why each list
 * is filtered by origin rather than printed as the checker's table holds it —
 * pass 1b adds every imported name to the importer's tables too.
 */
const dumpModule = (unit: ModuleUnit, table: TypeTable, facts: FactsTable, out: string[]): void => {
  const program = unit.checker.program;
  const source = unit.source;
  // The package is printed only when there is one to print (WP21 S1): the root
  // package has no name, so a single-package program's dump is the same text
  // it has always been.
  const pkg = program.packageName.length === 0 ? "" : ` [package ${program.packageName}]`;
  out.push(`module ${unit.path}${unit.isEntry ? " (entry)" : ""}${pkg}`);
  for (const imp of program.imports) {
    const struct = imp.struct;
    const constant = imp.constant;
    const builtin = imp.builtin;
    const sig = imp.sig;
    let what = "unbound";
    if (struct !== null) {
      what = `struct ${struct.name}`;
    } else if (constant !== null) {
      what = `const ${constant.name}`;
    } else if (builtin !== null) {
      what = `builtin ${builtin.canonical}`;
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
    // WP18: the instantiation set, printed in discovery order with the rest of
    // the functions, so a divergence in *which* instantiations exist is caught
    // by `tests/self/checked_oracle.js` before any IR is compared.
    const instance = sig.instance;
    if (instance !== null) {
      tags.push("instance");
    }
    const suffix = tags.length > 0 ? ` [${tags.join(" ")}]` : "";
    out.push(`function ${signatureText(table, sig)} -> @${sig.name}${suffix}`);
    const f = facts.get(sig.name);
    if (f !== null) {
      factsText(table, sig, f, out);
    }
    if (instance !== null) {
      program.enterInstance(instance);
    }
    bodyTables(program, source, table, sig, out);
    if (instance !== null) {
      program.leaveInstance();
    }
  }
};

/**
 * The `--emit-checked` dump of a whole checked program: every module in load
 * order, in the format `src/dump.ts` writes it. `self/compile.ts` prints this
 * for `--emit-checked` and this file's `main` prints it for the oracle, so the
 * two can never drift into two spellings of the same dump.
 */
export const checkedText = (compilation: Compilation): string => {
  // The dump prints the attribute pass's facts, so the fixpoint has to have
  // run: `dumpChecked` in `src/dump.ts` opens with the same call, and it is
  // memoised there and here so a compile that also emits does not pay twice.
  const facts = compilation.analyze();
  const out: string[] = [];
  for (const unit of compilation.modules) {
    dumpModule(unit, compilation.table, facts, out);
  }
  return `${out.join("\n")}\n`;
};

