// `dump_ast <file>`: the syntax tree, one node per line, indented by depth.
// This is how the S2 parser is tested (docs/wp14-selfhost.md, milestone S2):
// `tests/parser_oracle.js` walks the `typescript` AST of the same file, prints
// it in this format, and diffs.
//
//   <indent><KIND> <start> <end>          a node with nothing else to say
//   <indent><KIND> <start> <end> <text>   a name, an operator, a literal as written
//   <indent><KIND> <start> <end> #<bytes> STRING and TEMPLATE_TEXT: the decoded length
//
// Offsets are bytes, as everywhere in `self/`. A parse error prints as an
// `ERROR` node with its message and the exit status is 1, which is how the
// oracle knows the file needs grammar the subset does not have yet rather than
// that the two disagree.

import { SourceFile } from "./diagnostics";
import { Parser } from "./parser";
import {
  FLAG_CONST,
  FLAG_EXPORTED,
  FLAG_POSTFIX,
  FLAG_READONLY,
  N_STRING,
  N_TEMPLATE_TEXT,
  N_UNARY,
  Node,
  nodeName,
} from "./nodes";

/** Two spaces per level of depth. */
function indent(depth: i32): string {
  let out = "";
  let i = 0;
  while (i < depth) {
    out = out + "  ";
    i = i + 1;
  }
  return out;
}

/**
 * The modifiers a node carries, appended to its kind so that `export` and
 * `const` are compared too: `FUNCTION+export`, `VAR+const`, `UNARY+postfix`.
 */
function kindWithFlags(node: Node): string {
  let name = nodeName(node.kind);
  if (node.kind === N_UNARY) return node.flags === FLAG_POSTFIX ? `${name}+postfix` : `${name}+prefix`;
  if ((node.flags & FLAG_EXPORTED) !== 0) name = `${name}+export`;
  if ((node.flags & FLAG_CONST) !== 0) name = `${name}+const`;
  if ((node.flags & FLAG_READONLY) !== 0) name = `${name}+readonly`;
  return name;
}

/** One line for `node`, then its children one level deeper. */
function dump(node: Node, depth: i32, lines: string[]): void {
  let line = `${indent(depth)}${kindWithFlags(node)} ${node.start} ${node.end}`;
  if (node.kind === N_STRING || node.kind === N_TEMPLATE_TEXT) {
    line = `${line} #${node.text.length}`;
  } else if (node.text.length > 0) {
    line = `${line} ${node.text}`;
  }
  lines.push(line);
  for (const child of node.children) {
    dump(child, depth + 1, lines);
  }
}

export function main(): number {
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
  dump(file, 0, lines);
  write(`${lines.join("\n")}\n`);

  for (const diagnostic of parser.diagnostics) {
    writeError(`${diagnostic.message()}\n`);
  }
  return parser.diagnostics.length > 0 ? 1 : 0;
}
