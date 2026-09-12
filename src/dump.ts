/**
 * Debug dumps (WP10): `--emit-ast` and `--emit-checked`.
 *
 * Both print to stdout instead of writing IR, in a stable, line-oriented
 * form that goldens can compare (`tests/cases/dump_*.stdout`). File names are
 * printed relative to the working directory so the output does not depend on
 * where the repository lives.
 *
 * `--emit-ast`: the TypeScript syntax tree after parsing and Phase 0, one
 * node per line, indented by depth, as `<SyntaxKind> <line:col>-<line:col>`
 * with the text of identifiers and literals appended. Positions are 1-based
 * and exclude leading trivia (`getStart`).
 *
 * `--emit-checked`: the checker's side tables after every pass, plus the
 * attribute facts the emitter would use: for each module its structs
 * (fields with index/offset, size, align, methods), imports, and functions
 * (resolved signature, LLVM symbol, facts, locals with types, callees).
 */
import path from "node:path";
import ts from "typescript";
import { FunctionSig, LocalVar, StructInfo } from "./checker/index.js";
import { withInstance } from "./checker/generics.js";
import { ConstInfo, constValue } from "./checker/constants.js";
import { FunctionFacts } from "./codegen/attributes.js";
import { Compilation, ModuleUnit } from "./compilation.js";
import { typeToString } from "./types.js";

/**
 * `ts.SyntaxKind[kind]` returns the *last* name declared for a value, which
 * for many tokens is a range marker (`FirstAssignment` for `=`). Prefer the
 * real name.
 */
const KIND_NAMES: Map<number, string> = (() => {
  const names = new Map<number, string>();
  for (const [name, value] of Object.entries(ts.SyntaxKind)) {
    if (typeof value !== "number" || /^(First|Last|Count)/.test(name)) continue;
    if (!names.has(value)) names.set(value, name);
  }
  return names;
})();

export function syntaxKindName(kind: ts.SyntaxKind): string {
  return KIND_NAMES.get(kind) ?? ts.SyntaxKind[kind];
}

/** cwd-relative when the file is under cwd, else as given. */
function displayName(fileName: string): string {
  const rel = path.relative(process.cwd(), path.resolve(fileName));
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel.split(path.sep).join("/") : fileName;
}

function position(sf: ts.SourceFile, pos: number): string {
  const { line, character } = sf.getLineAndCharacterOfPosition(pos);
  return `${line + 1}:${character + 1}`;
}

/** The payload worth showing next to a node: identifier names and literal text. */
function nodeText(node: ts.Node): string {
  if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) return ` \`${node.text}\``;
  if (ts.isStringLiteralLike(node)) return ` ${JSON.stringify(node.text)}`;
  if (ts.isNumericLiteral(node) || ts.isBigIntLiteral(node)) return ` ${node.text}`;
  if (ts.isTemplateLiteralToken(node)) return ` ${JSON.stringify(node.text)}`;
  return "";
}

/** One module's syntax tree, `SourceFile <name>` first, children indented by two spaces per level. */
export function dumpAst(sf: ts.SourceFile, fileName: string = sf.fileName): string {
  const lines: string[] = [`SourceFile ${displayName(fileName)}`];
  const visit = (node: ts.Node, depth: number): void => {
    const span = `${position(sf, node.getStart(sf))}-${position(sf, node.getEnd())}`;
    lines.push(`${"  ".repeat(depth)}${syntaxKindName(node.kind)} ${span}${nodeText(node)}`);
    ts.forEachChild(node, (child) => visit(child, depth + 1));
  };
  ts.forEachChild(sf, (child) => visit(child, 1));
  return `${lines.join("\n")}\n`;
}

function signatureText(sig: FunctionSig): string {
  const params = sig.params.map((p) => `${p.name}: ${typeToString(p.type)}`).join(", ");
  return `${sig.sourceName}(${params}): ${typeToString(sig.returnType)}`;
}

function factsText(facts: FunctionFacts): string[] {
  const flags = [
    `effect=${facts.effect}`,
    `willReturn=${facts.willReturn}`,
    `hasLoops=${facts.hasLoops}`,
    `loopsBounded=${facts.loopsBounded}`,
    `readsMemory=${facts.readsMemory}`,
    `hasTrap=${facts.hasTrap}`,
    `callsNoReturn=${facts.callsNoReturn}`,
    `allocates=${facts.allocates}`,
    `arenaScope=${facts.arenaScope}`,
    `freshThis=${facts.freshThis}`,
  ];
  if (facts.returnDeref !== undefined) flags.push(`returnDeref=${facts.returnDeref}`);
  const lines = [`  facts: ${flags.join(" ")}`];
  const list = (label: string, items: Iterable<string>) => {
    const sorted = [...items].sort();
    if (sorted.length > 0) lines.push(`  ${label}: ${sorted.join(" ")}`);
  };
  list("escaping", facts.escaping);
  list("calls", facts.callees);
  for (const [name, p] of facts.pointerParams) {
    const passed = p.passedTo.map((c) => `${c.callee}#${c.index}`).join(" ");
    lines.push(
      `  pointer ${name}: size=${p.size} writesThrough=${p.writesThrough} captured=${p.captured}${passed ? ` passedTo=${passed}` : ""}`
    );
  }
  lines.push(`  stackSites=${facts.stackSites.size} stackLocals=${facts.stackLocals.size}`);
  return lines;
}

/** Locals and callees of one body, in source order, from the checker's side tables. */
function bodyTables(unit: ModuleUnit, sig: FunctionSig): string[] {
  const lines: string[] = [];
  const program = unit.checker.program;
  const sf = unit.sourceFile;
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node)) {
      const local: LocalVar | undefined = program.locals.get(node);
      if (local) {
        lines.push(`  local ${position(sf, node.getStart(sf))} ${local.name}: ${typeToString(local.type)} (${local.mutable ? "let" : "const"})`);
      }
    } else if (ts.isCallExpression(node)) {
      const callee = program.callees.get(node);
      if (callee) lines.push(`  callee ${position(sf, node.getStart(sf))} ${callee.sourceName} -> @${callee.name}`);
    } else if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
      // `new C(...)` is bound through the struct registry, not the callee table.
      const ctor = program.structs.get(node.expression.text)?.ctor;
      if (ctor) lines.push(`  callee ${position(sf, node.getStart(sf))} new ${node.expression.text} -> @${ctor.name}`);
    }
    ts.forEachChild(node, visit);
  };
  if (sig.decl.body) visit(sig.decl.body);
  return lines;
}

function structText(info: StructInfo): string[] {
  const lines = [`struct ${info.name} (${info.kind}) size=${info.size} align=${info.align}${info.exported ? " exported" : ""}`];
  if (info.implements.length > 0) lines.push(`  implements ${info.implements.join(", ")}`);
  for (const f of info.fields) {
    const extras = [f.readonly ? "readonly" : "", f.initializer ? "initialized" : ""].filter(Boolean).join(" ");
    lines.push(`  field ${f.name}: ${typeToString(f.type)} index=${f.index} offset=${f.offset}${extras ? ` ${extras}` : ""}`);
  }
  if (info.ctor) lines.push(`  constructor -> @${info.ctor.name}`);
  for (const [name, m] of info.methods) lines.push(`  method ${name} -> @${m.name}`);
  return lines;
}

/** Every module of a checked compilation, in load order. */
/** The folded value, in source syntax, so the dump can be pasted back into a program. */
function constantText(info: ConstInfo): string {
  const value = constValue(info);
  return value.kind === "string" ? JSON.stringify(value.value) : String(value.value);
}

export function dumpChecked(compilation: Compilation): string {
  const facts = compilation.analyze();
  const lines: string[] = [];
  for (const unit of compilation.modules) {
    const program = unit.checker.program;
    lines.push(`module ${displayName(unit.fileName)}${unit.isEntry ? " (entry)" : ""}`);
    for (const imp of program.imports) {
      const what = imp.struct
        ? `struct ${imp.struct.name}`
        : imp.constant
          ? `const ${imp.constant.name}`
          : imp.sig
            ? `function @${imp.sig.name}`
            : "unbound";
      lines.push(`import ${imp.localName} from ${JSON.stringify(imp.specifier)} -> ${what}`);
    }
    // Module constants (WP14) carry their folded value: it is the whole of
    // what the emitter will see, so the dump is the place to read it.
    for (const info of program.constants.values()) {
      if (info.decl.getSourceFile() !== unit.sourceFile) continue; // imported: listed by its own module
      const tag = info.exported ? " [exported]" : "";
      lines.push(`const ${info.name}: ${typeToString(info.type)} = ${constantText(info)}${tag}`);
    }
    for (const info of program.structs.values()) {
      if (info.decl.getSourceFile() !== unit.sourceFile) continue; // imported: listed by its own module
      lines.push(...structText(info));
    }
    for (const sig of program.functions) {
      const tags = [
        sig.exported ? "exported" : "",
        sig.role ?? "",
        program.entryMain === sig ? "entry" : "",
        // WP18: the instantiation set, printed in discovery order with the rest
        // of the functions, so a divergence in *which* instantiations exist is
        // caught by `tests/self/checked_oracle.js` before any IR is compared.
        sig.instance ? "instance" : "",
      ]
        .filter(Boolean)
        .join(" ");
      // Methods' `sourceName` already reads `Owner.method`; an instantiation's
      // reads `identity<i32>`.
      lines.push(`function ${signatureText(sig)} -> @${sig.name}${tags ? ` [${tags}]` : ""}`);
      const f = facts.get(sig.name);
      if (f) lines.push(...factsText(f));
      lines.push(...withInstance(program, sig, () => bodyTables(unit, sig)));
    }
  }
  return `${lines.join("\n")}\n`;
}
