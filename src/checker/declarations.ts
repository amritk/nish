/** Top-level declarations: function signatures. */
import ts from "typescript";
import { CompileError } from "../diagnostics";
import { CompilerOptions, resolveTypeNode } from "../types";
import { FunctionSig, Param } from "./program";

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
  if (!decl.type) {
    throw new CompileError(
      `Function \`${decl.name.text}\` needs an explicit return type annotation`,
      decl.name,
      sf
    );
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

  return { name: decl.name.text, params, returnType: resolveTypeNode(decl.type, sf, opts), decl };
}
