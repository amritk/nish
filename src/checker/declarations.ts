/**
 * Top-level declarations: function signatures, `export`, and `import`.
 *
 * Module rules (WP5):
 *   - `export` is accepted on function declarations only.
 *   - `import { f, g as h } from "./m.js"` with a *relative* specifier is the only
 *     import form; default, namespace, side-effect and type-only imports are
 *     rejected here with a specific message.
 *   - `export function main` in the entry module is the program entry. It
 *     takes no parameters (argv arrives in WP7) and returns `void` or an
 *     `i32`-lowered `number`; its symbol becomes `@nish_main` so the emitter's
 *     C-ABI wrapper can be `@main`.
 */
import ts from "typescript";
import { CompileError } from "../diagnostics.js";
import { LANGUAGE } from "../branding.js";
import {
  CompilerOptions,
  StaticType,
  isForeignType,
  rejectForeignPointer,
  resolveTypeNode,
  typeToString,
} from "../types.js";
import { ConstInfo } from "./constants.js";
import { StructTemplateInfo, TemplateInfo } from "./generics.js";
import { FunctionSig, ImportBinding, Param } from "./program.js";
import { isNishSpecifier, nishModuleNames } from "./nish-modules.js";
import { STD_PREFIX } from "../branding.js";

/** Symbol the entry module's `export function main` is emitted under. */
export const ENTRY_MAIN_SYMBOL = "nish_main";

export function hasExportModifier(node: ts.Node): boolean {
  return !!ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

export function collectFunctionSignature(
  decl: ts.FunctionDeclaration,
  sf: ts.SourceFile,
  opts: CompilerOptions
): FunctionSig {
  if (!decl.name) throw new CompileError("Functions must be named", decl, sf);
  const foreign = !!decl.modifiers?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword);
  // A `declare function` is the one function with no body that is not a
  // mistake (WP27 S1), so the body rule is the foreign rule's mirror rather
  // than a check it skips: exactly one of the two must hold.
  if (!foreign && !decl.body) throw new CompileError("Functions must have a body", decl, sf);
  if (foreign && decl.body) {
    throw new CompileError(
      "`declare function` declares a C function this program calls, so it must have no body",
      decl,
      sf
    );
  }
  // WP18 made a generic function a template that is monomorphised per
  // instantiation, which needs a body to stamp out. A C function has none and
  // one C symbol cannot stand for a family of signatures, so the two features
  // do not compose — and saying so here is cheaper than letting it reach the
  // instantiator and fail with an internal error.
  if (foreign && decl.typeParameters) {
    throw new CompileError(
      "`declare function` cannot be generic: a C symbol is one function, not a template to instantiate",
      decl,
      sf
    );
  }
  if (decl.asteriskToken) throw new CompileError("Generators are not supported", decl, sf);
  if (decl.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) {
    throw new CompileError("async functions are not supported", decl, sf);
  }
  if (decl.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) {
    throw new CompileError("`export default` is not supported; use a named `export function`", decl, sf);
  }
  if (!decl.type) {
    throw new CompileError(
      `Function \`${decl.name.text}\` needs an explicit return type annotation`,
      decl.name,
      sf
    );
  }
  if (decl.name.text.startsWith("nish_")) {
    throw new CompileError("Function names starting with `nish_` are reserved for the runtime", decl.name, sf);
  }

  const params = collectPlainParams(decl.parameters, sf, opts, foreign);
  const returnType = resolveTypeNode(decl.type, sf, opts);

  if (foreign) {
    // S1 crossed the boundary with scalars only, and S2 adds exactly one thing
    // to that list: `CPtr`, an address C owns. The soundness argument is the
    // same one, not a weaker one — no pointer *this compiler allocated* crosses
    // the boundary in either direction, so there is still nothing for the
    // escape analysis to be wrong about. What is new is a pointer coming back
    // that the compiler must never mistake for one of its own, which is what
    // `types.ts`'s `cptr` member and `isPointerParam`'s allow-list are for.
    if (hasExportModifier(decl)) {
      throw new CompileError(
        `\`declare function ${decl.name.text}\` cannot be exported: it is a C function this program calls, not one it defines`,
        decl.name,
        sf
      );
    }
    for (const p of params) {
      if (!isForeignType(p.type)) {
        throw new CompileError(
          `Parameter \`${p.name}\` of \`declare function ${decl.name.text}\` is ${typeToString(p.type)}, and a declared C function takes scalars and \`CPtr\` only`,
          decl,
          sf
        );
      }
      // A parameter cannot be `CPtr | null`, and the asymmetry with the return
      // type is the rule §3 states as "`null` only from a foreign call": the
      // callee is the only thing that can say "no address", so `null` arrives
      // from C and is narrowed before it goes back. Without this a program
      // could hand C a null it never got from C, which is the one thing the
      // narrowing was there to stop.
      if (p.type.kind === "nullable") {
        throw new CompileError(
          `Parameter \`${p.name}\` of \`declare function ${decl.name.text}\` cannot be nullable: a foreign pointer is narrowed with \`!== null\` before it is passed back, because only the C function it came from can hand out a null one`,
          decl,
          sf
        );
      }
    }
    if (!isForeignType(returnType)) {
      throw new CompileError(
        `\`declare function ${decl.name.text}\` returns ${typeToString(returnType)}, and a declared C function returns a scalar or \`CPtr\` only`,
        decl.type,
        sf
      );
    }
  } else {
    // WP27 S2: a foreign pointer never crosses a boundary this compiler
    // describes. `--emit-header`, `--emit-dts` and `--emit-napi` all render an
    // exported signature, and none of the three has a spelling for an address
    // whose provenance and lifetime are unknown — so rather than teach three
    // generators to skip it, the type is refused where it would reach them.
    // The parameters were answered for by `collectPlainParams` above.
    rejectForeignPointer(returnType, "the return type of a function this program defines", decl.type ?? decl, sf);
  }

  return {
    name: decl.name.text,
    sourceName: decl.name.text,
    params,
    returnType,
    decl,
    nameNode: decl.name,
    declSite: decl,
    body: decl.body,
    foreign: foreign || undefined,
    exported: hasExportModifier(decl),
  };
}

/**
 * The parameter list of a top-level function, in either spelling. Methods and
 * constructors do not come through here: they prepend `this` and resolve types
 * against their owner (`checker/classes.ts`, `collectParams`).
 */
/** An arrow function's declared return type; an arrow is never foreign (WP27 S2). */
const arrowReturnType = (node: ts.TypeNode, sf: ts.SourceFile, opts: CompilerOptions): StaticType => {
  const type = resolveTypeNode(node, sf, opts);
  rejectForeignPointer(type, "the return type of a function this program defines", node, sf);
  return type;
};

export function collectPlainParams(
  parameters: readonly ts.ParameterDeclaration[],
  sf: ts.SourceFile,
  opts: CompilerOptions,
  /**
   * A `declare function`'s parameters, which are the one place a `CPtr` is
   * welcome (WP27 S2). The flag is here rather than a guard at each caller
   * because this is the single list every non-method signature is built from,
   * so a new spelling of a function cannot arrive without answering the
   * question. Spelled at every call site rather than defaulted, because
   * `self/declarations.ts` has to spell it — the language has no default
   * parameters — and the two files are read side by side.
   */
  foreign: boolean
): Param[] {
  const params: Param[] = [];
  const seen = new Set<string>();
  for (const p of parameters) {
    if (!ts.isIdentifier(p.name)) throw new CompileError("Destructured parameters are not supported", p, sf);
    if (p.dotDotDotToken) throw new CompileError("Rest parameters are not supported", p, sf);
    if (p.questionToken || p.initializer) {
      throw new CompileError("Optional/default parameters are not supported", p, sf);
    }
    if (!p.type) throw new CompileError(`Parameter \`${p.name.text}\` needs a type annotation`, p, sf);
    if (seen.has(p.name.text)) throw new CompileError(`Duplicate parameter \`${p.name.text}\``, p, sf);
    seen.add(p.name.text);
    const type = resolveTypeNode(p.type, sf, opts);
    if (!foreign) rejectForeignPointer(type, "a parameter of a function this program defines", p.type, sf);
    params.push({ name: p.name.text, type });
  }
  return params;
}

/**
 * WP22: the arrow form, `const double = (n: i32): i32 => n * 2`. A module-level
 * `const` whose initialiser is an arrow declares a *function*, not a value, and
 * takes its signature from the arrow's own annotations — so nothing here needs
 * the function type that Phase 0 forbids. The name and the `export` modifier
 * come from the statement, everything else from the arrow.
 */
export function collectArrowSignature(
  stmt: ts.VariableStatement,
  decl: ts.VariableDeclaration,
  arrow: ts.ArrowFunction,
  sf: ts.SourceFile,
  opts: CompilerOptions
): FunctionSig {
  if (!ts.isIdentifier(decl.name)) throw new CompileError("Functions must be named", decl.name, sf);
  const name = decl.name.text;
  if ((stmt.declarationList.flags & ts.NodeFlags.Const) === 0) {
    throw new CompileError(`Function \`${name}\` must be declared \`const\`, not \`let\``, stmt, sf);
  }
  if (stmt.declarationList.declarations.length !== 1) {
    throw new CompileError("A function declaration binds one name", stmt, sf);
  }
  if (decl.type) {
    throw new CompileError(
      `Function \`${name}\` takes its signature from the arrow; drop the annotation on \`${name}\``,
      decl.type,
      sf
    );
  }
  if (arrow.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) {
    throw new CompileError("async functions are not supported", arrow, sf);
  }
  if (!arrow.type) {
    throw new CompileError(`Function \`${name}\` needs an explicit return type annotation`, decl.name, sf);
  }
  if (name.startsWith("nish_")) {
    throw new CompileError("Function names starting with `nish_` are reserved for the runtime", decl.name, sf);
  }
  return {
    name,
    sourceName: name,
    params: collectPlainParams(arrow.parameters, sf, opts, false),
    returnType: arrowReturnType(arrow.type, sf, opts),
    decl: arrow,
    nameNode: decl.name,
    // The declaration is the statement, not the arrow: `-g` measures the
    // function from `export`, exactly as it does for the `function` spelling.
    declSite: stmt,
    body: arrow.body,
    exported: hasExportModifier(stmt),
  };
}

/**
 * WP18 §3c: `$` separates a generic's name from its type arguments in every
 * symbol the compiler emits, so a *declared* name may not contain one — a
 * class literally called `Box$i32` would be the same symbol as `Box<i32>`.
 * Locals, parameters and fields keep it; only names that become symbols are
 * restricted, which is what makes the encoding injective.
 */
export function rejectDollarInSymbolName(name: string, what: string, node: ts.Node, sf: ts.SourceFile): void {
  if (!name.includes("$")) return;
  throw new CompileError(
    `\`${name}\` cannot be the name of a ${what} in ${LANGUAGE}: \`$\` separates a generic's name from its ` +
      "type arguments in the symbols the compiler emits",
    node,
    sf
  );
}

/** The names of `<T, U>`, refusing the constrained and defaulted forms this package does not lower. */
function collectTypeParams(list: readonly ts.TypeParameterDeclaration[], sf: ts.SourceFile): string[] {
  const names: string[] = [];
  for (const p of list) {
    if (p.constraint) {
      throw new CompileError(
        `A constrained type parameter (\`${p.name.text} extends ...\`) is not supported yet: an unconstrained ` +
          "parameter can be passed on, returned and stored, and a constrained one would also have members",
        p.constraint,
        sf
      );
    }
    if (p.default) {
      throw new CompileError(
        `A default type argument (\`${p.name.text} = ...\`) is not supported: a type argument is inferred ` +
          "from the arguments, so there is no position for a default to fill",
        p.default,
        sf
      );
    }
    if (names.includes(p.name.text)) throw new CompileError(`Duplicate type parameter \`${p.name.text}\``, p, sf);
    names.push(p.name.text);
  }
  return names;
}

/**
 * A generic `function` declaration (WP18). Everything a monomorphic signature
 * checks is checked here except the *types*: the annotations mention the type
 * parameters, so they stay as syntax and are resolved once per instantiation.
 */
export function collectFunctionTemplate(decl: ts.FunctionDeclaration, sf: ts.SourceFile): TemplateInfo {
  if (!decl.name) throw new CompileError("Functions must be named", decl, sf);
  // A generic `declare function` arrives here rather than at
  // `collectFunctionSignature`, because a function with type parameters is a
  // template before it is anything else. Without this it is still refused — by
  // the body rule below — but "Functions must have a body" names the wrong
  // mistake: the body is missing on purpose and the real problem is that a C
  // symbol is one function, not a family (WP27 S1).
  if (decl.modifiers?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword)) {
    throw new CompileError(
      "`declare function` cannot be generic: a C symbol is one function, not a template to instantiate",
      decl,
      sf
    );
  }
  if (!decl.body) throw new CompileError("Functions must have a body", decl, sf);
  if (!decl.type) {
    throw new CompileError(`Function \`${decl.name.text}\` needs an explicit return type annotation`, decl.name, sf);
  }
  if (decl.name.text.startsWith("nish_")) {
    throw new CompileError("Function names starting with `nish_` are reserved for the runtime", decl.name, sf);
  }
  rejectDollarInSymbolName(decl.name.text, "function", decl.name, sf);
  return {
    sourceName: decl.name.text,
    typeParams: collectTypeParams(decl.typeParameters ?? [], sf),
    decl,
    nameNode: decl.name,
    declSite: decl,
    body: decl.body,
    exported: hasExportModifier(decl),
    count: 0,
  };
}

/**
 * The modifiers a class or interface declaration may not carry, whichever
 * spelling declares it.
 *
 * It lives here, beside the other declaration-level rules, rather than inside
 * `declareStruct`, because a *generic* class never reaches `declareStruct` —
 * it is a template, and `collectStructTemplate` below is the only pass that
 * sees the declaration itself. Two copies of the loop would mean
 * `export default class Box<T>` compiling while `export default class Box`
 * is refused, which is what happened; one function called from both spellings
 * is what makes "refused identically" a property of the code rather than of a
 * test.
 */
export const rejectStructModifiers = (
  decl: ts.ClassDeclaration | ts.InterfaceDeclaration,
  kind: "class" | "interface",
  sf: ts.SourceFile
): void => {
  const modifiers = ts.canHaveModifiers(decl) ? (ts.getModifiers(decl) ?? []) : [];
  for (const m of modifiers) {
    if (m.kind === ts.SyntaxKind.AbstractKeyword) {
      throw new CompileError("Abstract classes are not supported", decl, sf);
    }
    if (m.kind === ts.SyntaxKind.DeclareKeyword) {
      throw new CompileError(`\`declare ${kind}\` is not supported`, decl, sf);
    }
    if (m.kind === ts.SyntaxKind.DefaultKeyword) {
      throw new CompileError("`export default` is not supported; use a named `export`", decl, sf);
    }
  }
};

/**
 * A generic `class` or `interface` declaration (WP18 G5). Nothing below the
 * name is read here: the field, method and heritage annotations mention the
 * type parameters, so they stay as syntax and are resolved once per
 * instantiation, exactly as a function template's are. The member rules —
 * `static`, getters, index signatures, a missing annotation — are therefore
 * enforced where they always were, at each instantiation's `collectStructMembers`.
 *
 * The *declaration's* own rules are not members and have nowhere else to be
 * enforced, so they are enforced here, out of the same function `declareStruct`
 * calls: a template is refused for exactly what the non-generic spelling is
 * refused for.
 */
export const collectStructTemplate = (
  decl: ts.ClassDeclaration | ts.InterfaceDeclaration,
  sf: ts.SourceFile
): StructTemplateInfo => {
  const kind = ts.isClassDeclaration(decl) ? "class" : "interface";
  if (!decl.name) throw new CompileError(`${kind === "class" ? "Classes" : "Interfaces"} must be named`, decl, sf);
  const name = decl.name.text;
  if (name.startsWith("nish_")) {
    throw new CompileError("Names starting with `nish_` are reserved for the runtime", decl.name, sf);
  }
  rejectDollarInSymbolName(name, kind, decl.name, sf);
  rejectStructModifiers(decl, kind, sf);
  // A generic `interface` has the same one heritage rule a declared one has,
  // and for the same reason: there is no layout to inherit, only fields to
  // list. Refusing it here rather than at the instantiation keeps the message
  // pointing at the `extends` the programmer wrote.
  for (const clause of decl.heritageClauses ?? []) {
    if (clause.token === ts.SyntaxKind.ExtendsKeyword && kind === "interface") {
      throw new CompileError("Interface inheritance (`extends`) is not supported; list every field", clause, sf);
    }
  }
  return {
    sourceName: name,
    kind,
    typeParams: collectTypeParams(decl.typeParameters ?? [], sf),
    decl,
    nameNode: decl.name,
    exported: hasExportModifier(decl),
    count: 0,
  };
};

/** The arrow spelling of the same thing: `const identity = <T>(x: T): T => x`. */
export function collectArrowTemplate(
  stmt: ts.VariableStatement,
  decl: ts.VariableDeclaration,
  arrow: ts.ArrowFunction,
  sf: ts.SourceFile
): TemplateInfo {
  if (!ts.isIdentifier(decl.name)) throw new CompileError("Functions must be named", decl.name, sf);
  const name = decl.name.text;
  if ((stmt.declarationList.flags & ts.NodeFlags.Const) === 0) {
    throw new CompileError(`Function \`${name}\` must be declared \`const\`, not \`let\``, stmt, sf);
  }
  if (!arrow.type) {
    throw new CompileError(`Function \`${name}\` needs an explicit return type annotation`, decl.name, sf);
  }
  if (name.startsWith("nish_")) {
    throw new CompileError("Function names starting with `nish_` are reserved for the runtime", decl.name, sf);
  }
  rejectDollarInSymbolName(name, "function", decl.name, sf);
  return {
    sourceName: name,
    typeParams: collectTypeParams(arrow.typeParameters ?? [], sf),
    decl: arrow,
    nameNode: decl.name,
    // The declaration is the statement, not the arrow, exactly as it is for a
    // non-generic one: every instantiation inherits this as its `declSite`.
    declSite: stmt,
    body: arrow.body,
    exported: hasExportModifier(stmt),
    count: 0,
  };
}

/** The arrow of a module-level `const f = (...) => ...`, or `undefined` for a value `const`. */
export function arrowFunctionOf(decl: ts.VariableDeclaration): ts.ArrowFunction | undefined {
  const init = decl.initializer;
  return init && ts.isArrowFunction(init) ? init : undefined;
}

/**
 * `node` is the value its function answers with: the operand of a `return`, or
 * the concise body of an arrow (`=> n * 2`), which is the one `return` it means
 * (WP22 §4).
 *
 * Every pass that decides what a value is *for* by climbing to its parent has
 * to ask this rather than `ts.isReturnStatement`, because a concise body's
 * parent is the arrow. Four do: the contextual-type walks `contextualType` in
 * `classes.ts` (an object literal's struct, a class value converting to an
 * interface) and `arrays.ts` (the element type of `[]`), `contextType` in
 * `math.ts` (a numeric literal's width), and `flowTarget` in
 * `codegen/escape.ts`, where getting it wrong reads a returned allocation as a
 * local and silently drops WP9's call-site reclaim. Stage1's checker threads
 * the wanted type down as `want` and never needed the first three; its
 * `flowTarget` walks parents like this one and needed the fourth
 * (`tests/cases/fn_arrow_concise`, WP22 §8a).
 */
export const isFunctionResult = (node: ts.Node): boolean => {
  const parent = node.parent;
  if (!parent) return false;
  return ts.isReturnStatement(parent) || (ts.isArrowFunction(parent) && parent.body === node);
};

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
 * but `import { a, b as c } from "./relative.js"` is rejected.
 */
export function collectImports(decl: ts.ImportDeclaration, sf: ts.SourceFile): ImportBinding[] {
  if (!ts.isStringLiteral(decl.moduleSpecifier)) {
    throw new CompileError("Import specifier must be a string literal", decl.moduleSpecifier, sf);
  }
  const specifier = decl.moduleSpecifier.text;
  // `nish:` is the one bare form: it names a builtin module rather than a file,
  // so it is let through here and validated against `NISH_MODULES` in pass 1b,
  // where an unknown module reads as a bad module instead of a missing file.
  // The hint goes after the interpolation deliberately, so that the longest
  // literal run of this template — and with it the diagnostic code the rule has
  // always had — is still the sentence before it.
  // Two bare forms are legal. `nish:` names a builtin and resolves to no file;
  // `nish/` names a standard-library module, which is ordinary source and is
  // resolved like any other file, only from beside the compiler. Everything
  // else is still refused: there is no package resolution (wp21 §5b).
  if (
    !isNishSpecifier(specifier) &&
    !specifier.startsWith(STD_PREFIX) &&
    !specifier.startsWith("./") &&
    !specifier.startsWith("../")
  ) {
    throw new CompileError(
      `Only relative import specifiers are supported (\`./x\` or \`../x\`), got \`${specifier}\` (the bare forms are ${nishModuleNames().join(", ")} and ${STD_PREFIX}<module>)`,
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
  // At the declaration rather than at the braces, which is where this used to
  // point: stage1's tree has no node for `{}` at all -- a list there spans its
  // elements and an empty one spans nothing (`closeList` in `self/parser.ts`,
  // and the S2 parser oracle holds both compilers to that rule) -- so the
  // caret the two can agree on is the `import` statement's
  // (`tests/cases/reject_import_empty`).
  if (bindings.elements.length === 0) throw new CompileError("Empty import list", decl, sf);

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
  return { name: decl.name.text, type, decl, exported: hasExportModifier(stmt), scope, wrapping: !opts.nsw };
};
