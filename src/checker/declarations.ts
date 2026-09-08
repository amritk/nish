/**
 * Top-level declarations: function signatures, `export`, and `import`.
 *
 * Module rules (WP5):
 *   - `export` is accepted on function declarations only.
 *   - `import { f, g as h } from "./m"` with a *relative* specifier is the only
 *     import form; default, namespace, side-effect and type-only imports are
 *     rejected here with a specific message.
 *   - `export function main` in the entry module is the program entry. It
 *     takes no parameters (argv arrives in WP7) and returns `void` or an
 *     `i32`-lowered `number`; its symbol becomes `@amrit_main` so the emitter's
 *     C-ABI wrapper can be `@main`.
 */
import ts from "typescript";
import { CompileError } from "../diagnostics";
import { CompilerOptions, resolveTypeNode, typeToString } from "../types";
import { ConstInfo } from "./constants";
import { FunctionSig, ImportBinding, Param } from "./program";

/** Symbol the entry module's `export function main` is emitted under. */
export const ENTRY_MAIN_SYMBOL = "amrit_main";

export function hasExportModifier(node: ts.Node): boolean {
  return !!ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

export function collectFunctionSignature(
  decl: ts.FunctionDeclaration,
  sf: ts.SourceFile,
  opts: CompilerOptions
): FunctionSig {
  if (!decl.name) throw new CompileError("Functions must be named", decl, sf);
  if (!decl.body) throw new CompileError("Functions must have a body", decl, sf);
  if (decl.typeParameters) throw new CompileError("Generic functions are not supported", decl, sf);
  if (decl.asteriskToken) throw new CompileError("Generators are not supported", decl, sf);
  if (decl.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) {
    throw new CompileError("async functions are not supported", decl, sf);
  }
  if (decl.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) {
    throw new CompileError("`export default` is not supported; use a named `export function`", decl, sf);
  }
  if (decl.modifiers?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword)) {
    throw new CompileError("`declare function` is not supported yet", decl, sf);
  }
  if (!decl.type) {
    throw new CompileError(
      `Function \`${decl.name.text}\` needs an explicit return type annotation`,
      decl.name,
      sf
    );
  }
  if (decl.name.text.startsWith("amrit_")) {
    throw new CompileError("Function names starting with `amrit_` are reserved for the runtime", decl.name, sf);
  }

  const params: Param[] = [];
  const seen = new Set<string>();
  for (const p of decl.parameters) {
    if (!ts.isIdentifier(p.name)) throw new CompileError("Destructured parameters are not supported", p, sf);
    if (p.dotDotDotToken) throw new CompileError("Rest parameters are not supported", p, sf);
    if (p.questionToken || p.initializer) {
      throw new CompileError("Optional/default parameters are not supported", p, sf);
    }
    if (!p.type) throw new CompileError(`Parameter \`${p.name.text}\` needs a type annotation`, p, sf);
    if (seen.has(p.name.text)) throw new CompileError(`Duplicate parameter \`${p.name.text}\``, p, sf);
    seen.add(p.name.text);
    params.push({ name: p.name.text, type: resolveTypeNode(p.type, sf, opts) });
  }

  return {
    name: decl.name.text,
    sourceName: decl.name.text,
    params,
    returnType: resolveTypeNode(decl.type, sf, opts),
    decl,
    exported: hasExportModifier(decl),
  };
}

/**
 * Validate the entry module's `export function main` and rename its symbol.
 * The wrapper hands an `i32` to the OS, so `main` returns `void` or an
 * `i32`-lowered number (`main(): i32` under `--number-mode f64`).
 */
export function markEntryMain(sig: FunctionSig, sf: ts.SourceFile): FunctionSig {
  if (sig.params.length > 0) {
    throw new CompileError(
      "`main` cannot take parameters (command-line arguments are not supported yet)",
      sig.decl.parameters[0],
      sf
    );
  }
  if (sig.returnType.kind !== "void" && sig.returnType.kind !== "i32") {
    throw new CompileError(
      `\`main\` must return void or an i32 number (the process exit code), not ${typeToString(sig.returnType)}` +
        (sig.returnType.kind === "f64" ? "; under --number-mode f64 declare `main(): i32`" : ""),
      sig.decl.type!,
      sf
    );
  }
  sig.name = ENTRY_MAIN_SYMBOL;
  return sig;
}

/** Reject every exportable non-function statement with a targeted message. */
export function rejectNonFunctionExport(stmt: ts.Statement, sf: ts.SourceFile): void {
  if (ts.isExportDeclaration(stmt)) {
    throw new CompileError(
      "`export { ... }` / `export * from` are not supported; put `export` on the function declaration itself",
      stmt,
      sf
    );
  }
  if (ts.isExportAssignment(stmt)) {
    throw new CompileError("`export default` / `export =` are not supported; use a named `export function`", stmt, sf);
  }
  if (hasExportModifier(stmt)) {
    throw new CompileError(
      `Only functions can be exported for now, plus classes and interfaces (found \`export\` on ${ts.SyntaxKind[stmt.kind]})`,
      stmt,
      sf
    );
  }
}

/**
 * Turn an `import` statement into one binding per imported name. Everything
 * but `import { a, b as c } from "./relative"` is rejected.
 */
export function collectImports(decl: ts.ImportDeclaration, sf: ts.SourceFile): ImportBinding[] {
  if (!ts.isStringLiteral(decl.moduleSpecifier)) {
    throw new CompileError("Import specifier must be a string literal", decl.moduleSpecifier, sf);
  }
  const specifier = decl.moduleSpecifier.text;
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    throw new CompileError(
      `Only relative import specifiers are supported (\`./x\` or \`../x\`), got \`${specifier}\``,
      decl.moduleSpecifier,
      sf
    );
  }
  const clause = decl.importClause;
  if (!clause) {
    throw new CompileError(
      `Side-effect imports (\`import "${specifier}"\`) are not supported; modules have no top-level code`,
      decl,
      sf
    );
  }
  if (clause.isTypeOnly) throw new CompileError("Type-only imports are not supported", clause, sf);
  if (clause.name) {
    throw new CompileError(
      `Default imports are not supported; use \`import { ${clause.name.text} } from "${specifier}"\``,
      clause.name,
      sf
    );
  }
  const bindings = clause.namedBindings;
  if (!bindings) throw new CompileError("Import must name the functions it imports", decl, sf);
  if (ts.isNamespaceImport(bindings)) {
    throw new CompileError(
      `Namespace imports (\`import * as ${bindings.name.text}\`) are not supported; import functions by name`,
      bindings,
      sf
    );
  }
  if (bindings.elements.length === 0) throw new CompileError("Empty import list", bindings, sf);

  return bindings.elements.map((element) => {
    if (element.isTypeOnly) throw new CompileError("Type-only imports are not supported", element, sf);
    const importedName = (element.propertyName ?? element.name).text;
    return { node: decl, specifier, importedName, localName: element.name.text, element };
  });
}

/**
 * `const NAME: T = <constant expression>;` at the top level (WP14). The
 * annotation is required, as it is on every other top-level declaration, and
 * the initialiser is folded lazily by `constValue` once every module has
 * collected its signatures — an initialiser may name an imported constant.
 *
 * `let` and `var` are rejected here rather than by the generic top-level
 * message, because "a module has no top-level code" is the reason and it is
 * worth saying.
 */
export const collectConstant = (
  stmt: ts.VariableStatement,
  decl: ts.VariableDeclaration,
  sf: ts.SourceFile,
  opts: CompilerOptions,
  scope: Map<string, ConstInfo>
): ConstInfo => {
  if ((stmt.declarationList.flags & ts.NodeFlags.Const) === 0) {
    const keyword = (stmt.declarationList.flags & ts.NodeFlags.Let) !== 0 ? "let" : "var";
    throw new CompileError(
      `Top-level \`${keyword}\` is not supported; a module has no top-level code, so only \`const\` is available`,
      stmt,
      sf
    );
  }
  if (!ts.isIdentifier(decl.name)) throw new CompileError("Destructured constants are not supported", decl, sf);
  if (!decl.type) {
    throw new CompileError(`Module constant \`${decl.name.text}\` needs a type annotation`, decl.name, sf);
  }
  if (!decl.initializer) {
    throw new CompileError(`Module constant \`${decl.name.text}\` needs an initialiser`, decl.name, sf);
  }
  const type = resolveTypeNode(decl.type, sf, opts);
  if (type.kind !== "i32" && type.kind !== "i64" && type.kind !== "f64" && type.kind !== "bool" && type.kind !== "string") {
    throw new CompileError(
      `Module constant \`${decl.name.text}\` must be a number, boolean, or string, not ${typeToString(type)}; there is no top-level code to build anything else`,
      decl.type,
      sf
    );
  }
  return { name: decl.name.text, type, decl, exported: hasExportModifier(stmt), scope };
};
