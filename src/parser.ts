/**
 * Phase A: Parsing.
 *
 * Thin wrapper over the official TypeScript compiler API. We only need the
 * syntax tree; StaticTS performs its own (much stricter) type checking, so we
 * never create a full `ts.Program` or use the TS type checker here.
 */
import ts from "typescript";
import fs from "node:fs";
import { StaticSyntaxError } from "./diagnostics";

export function parseSource(fileName: string, sourceText: string): ts.SourceFile {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS
  );

  // Surface syntax errors (unbalanced braces, etc.) before we walk the tree.
  const diagnostics = (sourceFile as unknown as { parseDiagnostics?: ts.DiagnosticWithLocation[] })
    .parseDiagnostics;
  if (diagnostics && diagnostics.length > 0) {
    // Same shape as a CompileError (summary line + source excerpt), prefixed `syntax error:`.
    const d = diagnostics[0];
    const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    throw new StaticSyntaxError(msg, { start: d.start, end: d.start + d.length }, sourceFile);
  }
  return sourceFile;
}

export function parseFile(filePath: string): ts.SourceFile {
  const text = fs.readFileSync(filePath, "utf8");
  return parseSource(filePath, text);
}
