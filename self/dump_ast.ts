// `dump_ast <file>`: the syntax tree, one node per line, indented by depth.
// This is how the S2 parser is tested (docs/wp14-selfhost.md, milestone S2):
// `tests/parser_oracle.js` walks the `typescript` AST of the same file, prints
// it in this format, and diffs.
//
// The printer itself lives in `ast_text.ts`, because `--emit-ast` prints the
// same tree (WP19 R1) and one printer is what keeps the flag and the oracle
// from drifting. What is left here is the entry point: one file, its tree from
// the root down, and the parse diagnostics after it.
//
// A parse error prints as an `ERROR` node with its message and the exit status
// is 1, which is how the oracle knows the file needs grammar the subset does
// not have yet rather than that the two disagree.

import { astLines } from "./ast_text";
import { SourceFile } from "./diagnostics";
import { Parser } from "./parser";

export const main = (): number => {
  if (process.argv.length < 2) {
    console.error("usage: dump_ast <file>");
    return 2;
  }
  const path = process.argv[1];
  const source = readFileSyncOrNull(path);
  if (source === null) {
    console.error(`dump_ast: cannot read ${path}`);
    return 1;
  }

  const parser = new Parser(new SourceFile(path, source));
  const file = parser.parseSourceFile();
  const lines: string[] = [];
  // From the root, where `--emit-ast` starts from the children and puts the
  // path on the root line instead: this output is compared against a printer
  // that has no path to print (`tests/parser_oracle.js`).
  astLines(file, 0, lines);
  write(`${lines.join("\n")}\n`);

  for (const diagnostic of parser.diagnostics) {
    writeError(`${diagnostic.message()}\n`);
  }
  return parser.diagnostics.length > 0 ? 1 : 0;
};
