import ts from "typescript";

/** A compile error anchored to a source location, formatted `file:line:col: message`. */
export class CompileError extends Error {
  readonly file: string;
  readonly line: number;
  readonly column: number;

  constructor(message: string, node: ts.Node, sourceFile: ts.SourceFile) {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile)
    );
    super(`${sourceFile.fileName}:${line + 1}:${character + 1}: error: ${message}`);
    this.name = "CompileError";
    this.file = sourceFile.fileName;
    this.line = line + 1;
    this.column = character + 1;
  }
}
