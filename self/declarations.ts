// Top-level declarations for stage1 (`src/checker/declarations.ts`,
// docs/wp14-selfhost.md milestone S3): function signatures, `export`,
// `import`, and the entry point.
//
// It is shorter than stage0's, and the reason is worth writing down: half of
// that file rejects TypeScript the *parser* here never builds a node for.
// `function f<T>()`, `async function`, `export default`, `import * as ns`,
// a destructured or defaulted parameter — the S2 parser reads each one and
// turns it down by name, because a message about what the programmer wrote
// beats one about a node kind. What is left is the semantic half: names,
// types, arity and the rules about `main`.

import { CheckContext } from "./context";
import { resolveType } from "./annotations";
import { FLAG_EXPORTED, N_EMPTY, N_FUNCTION, N_IMPORT, N_LIST, Node } from "./nodes";
import { FunctionSig, ImportBinding, ROLE_FUNCTION } from "./program";
import { T_ERROR, T_I32, T_VOID } from "./types";

/** Symbol the entry module's `export function main` is emitted under. */
export const ENTRY_MAIN_SYMBOL: string = "nish_main";

export function isExported(node: Node): boolean {
  return (node.flags & FLAG_EXPORTED) !== 0;
}

/**
 * The parameters of a function, method or constructor, appended to `sig`.
 * `owner` is the type of `this` for a member and -1 for a free function; a
 * member's `this` is `params[0]`, which is the calling convention the whole
 * emitter is written against.
 */
export function collectParams(ctx: CheckContext, sig: FunctionSig, list: Node, owner: i32): void {
  if (owner >= 0) {
    sig.paramNames.push("this");
    sig.paramTypes.push(owner);
  }
  for (const param of list.children) {
    const name = param.children[0].text;
    const type = resolveType(param.children[1], ctx);
    let duplicate = false;
    for (const seen of sig.paramNames) {
      if (seen === name) {
        duplicate = true;
      }
    }
    if (duplicate) {
      ctx.error(param, `Duplicate parameter \`${name}\``);
      continue;
    }
    sig.paramNames.push(name);
    sig.paramTypes.push(type);
  }
}

/**
 * One `function` declaration's signature. The body is not looked at: pass 2
 * checks bodies once every callee in the program is known, which is what lets
 * functions call each other in any order.
 */
export function collectFunctionSignature(ctx: CheckContext, decl: Node): FunctionSig {
  const name = decl.children[0].text;
  const sig = new FunctionSig(name, name, decl);
  sig.origin = ctx.source;
  sig.exported = isExported(decl);
  sig.role = ROLE_FUNCTION;
  if (name.startsWith("nish_")) {
    ctx.error(decl.children[0], "Function names starting with `nish_` are reserved for the runtime");
  }
  collectParams(ctx, sig, decl.children[1], -1);
  const returnAnnotation = decl.children[2];
  if (returnAnnotation.kind === N_EMPTY) {
    ctx.error(decl.children[0], `Function \`${name}\` needs an explicit return type annotation`);
    sig.returnType = T_ERROR;
  } else {
    sig.returnType = resolveType(returnAnnotation, ctx);
  }
  return sig;
}

/**
 * The entry module's `export function main`, renamed to `@nish_main` so the
 * emitter's C-ABI wrapper can own `@main`. The wrapper hands an `i32` to the
 * OS, so `main` returns `void` or an `i32`-lowered number.
 */
export function markEntryMain(ctx: CheckContext, sig: FunctionSig): void {
  if (sig.paramTypes.length > 0) {
    // Against the first parameter, as stage0 hands `sig.decl.parameters[0]` to
    // the error (`markEntryMain` in `src/checker/declarations.ts`), not against
    // the whole declaration.
    ctx.error(
      sig.decl.children[1].children[0],
      "`main` cannot take parameters (command-line arguments are not supported yet)"
    );
  }
  if (sig.returnType !== T_VOID && sig.returnType !== T_I32 && sig.returnType !== T_ERROR) {
    const spelled = ctx.table.typeName(sig.returnType);
    const hint =
      ctx.table.typeName(sig.returnType) === "f64" ? "; under --number-mode f64 declare `main(): i32`" : "";
    ctx.error(
      sig.decl.children[2],
      `\`main\` must return void or an i32 number (the process exit code), not ${spelled}${hint}`
    );
  }
  if (ctx.errored) {
    // A rejected `main` is not the entry's `main`: stage0 throws from here and
    // never records it, so a *second* module declaring one is not yet a second
    // (`tests/link/main_in_import` in f64 mode reported both there and one
    // here).
    return;
  }
  sig.name = ENTRY_MAIN_SYMBOL;
  ctx.program.entryMain = sig;
}

/**
 * One binding per name in an `import`. The parser has already refused every
 * form but `import { a, b as c } from "..."`, so what is left is the
 * specifier rule and the empty list.
 */
export function collectImports(ctx: CheckContext, decl: Node): void {
  const specifier = decl.text;
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    ctx.errorAtSpecifier(
      decl,
      `Only relative import specifiers are supported (\`./x\` or \`../x\`), got \`${specifier}\``
    );
    return;
  }
  const specs = decl.children[0];
  if (specs.kind !== N_LIST || specs.children.length === 0) {
    ctx.error(decl, "Empty import list");
    return;
  }
  for (const spec of specs.children) {
    const importedName = spec.children[0].text;
    ctx.program.imports.push(new ImportBinding(specifier, importedName, spec.text, spec, decl));
    // An imported name may be written as a type before pass 1b can say what
    // it is; `resolveType` resolves it provisionally and binding rejects the
    // ones that turn out to be functions or constants.
    ctx.program.typeNames.add(spec.text);
  }
}

/** Whether a top-level node is a declaration this pass collects a signature for. */
export function isFunctionDeclaration(node: Node): boolean {
  return node.kind === N_FUNCTION;
}

export function isImportDeclaration(node: Node): boolean {
  return node.kind === N_IMPORT;
}
