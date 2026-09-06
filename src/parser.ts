/**
 * Phase A: Parsing.
 *
 * Thin wrapper over the official TypeScript compiler API. We only need the
 * syntax tree; StaticTS performs its own (much stricter) type checking, so we
 * never create a full `ts.Program` or use the TS type checker here.
 */
import ts from "typescript";
import fs from "node:fs";
import { DiagnosticSink, StaticSyntaxError } from "./diagnostics";

/**
 * Parse one file. Syntax errors (unbalanced braces, etc.) are surfaced before
 * anything walks the tree: with a `sink` every parse diagnostic is reported
 * and the sink throws them together; without one the first is thrown.
 */
export function parseSource(fileName: string, sourceText: string, sink?: DiagnosticSink): ts.SourceFile {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS
  );

  const diagnostics = (sourceFile as unknown as { parseDiagnostics?: ts.DiagnosticWithLocation[] })
    .parseDiagnostics;
  if (diagnostics && diagnostics.length > 0) {
    // Same shape as a CompileError (summary line + source excerpt), prefixed `syntax error:`.
    for (const d of diagnostics) {
      const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
      const err = new StaticSyntaxError(msg, { start: d.start, end: d.start + d.length }, sourceFile);
      if (!sink) throw err;
      sink.report(err);
    }
    sink!.throwIfErrors();
  }
  return sourceFile;
}

export function parseFile(filePath: string): ts.SourceFile {
  const text = fs.readFileSync(filePath, "utf8");
  return parseSource(filePath, text);
}
