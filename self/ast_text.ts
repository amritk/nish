// The `--emit-ast` text, printed by both the driver (`compile.ts`) and the
// dump entry point (`dump_ast.ts`) — the same arrangement `dump.ts` has for
// `--emit-checked`, and for the same reason: one printer means the flag and
// the oracle can never drift into two spellings of the same tree.
//
// **This dump is deliberately not stage0's** (docs/wp19-stage0-retirement.md
// §2A). stage0 prints the *`typescript` package's* node names and 1-based
// `line:col` spans, because that is the tree it has; this one prints the
// flattened vocabulary `self/nodes.ts` defines and byte offsets, because that
// is the tree *this* compiler has. Mirroring stage0's names here would put
// someone else's `SyntaxKind` naming inside the self-hosted compiler, which
// §7 of wp14-selfhost.md turned down and this package agreed with. So the two
// compilers both answer `--emit-ast`, and they answer it about their own
// trees; the goldens are per compiler and there is no oracle between them.
//
// The per-node format, one node per line, indented two spaces per level:
//
//   <indent><KIND> <start> <end>          a node with nothing else to say
//   <indent><KIND> <start> <end> <text>   a name, an operator, a literal as written
//   <indent><KIND> <start> <end> #<bytes> STRING and TEMPLATE_TEXT: the decoded length
//
// `tests/parser_oracle.js` reproduces exactly that from the `typescript` tree,
// which is what makes it a parser oracle, so nothing about a line may change
// without changing the oracle in the same commit.

import {
  FLAG_CONST,
  FLAG_DEFINITE,
  FLAG_EXPORTED,
  FLAG_OPTIONAL,
  FLAG_POSTFIX,
  FLAG_READONLY,
  FLAG_STATIC,
  N_STRING,
  N_TEMPLATE_TEXT,
  N_UNARY,
  Node,
  nodeName,
} from "./nodes";

/** Two spaces per level of depth. */
const indent = (depth: i32): string => {
  let out = "";
  let i = 0;
  while (i < depth) {
    out = out + "  ";
    i = i + 1;
  }
  return out;
};

/**
 * The modifiers a node carries, appended to its kind so that `export` and
 * `const` are compared too: `FUNCTION+export`, `VAR+const`, `UNARY+postfix`.
 *
 * The member-header three — `+static`, `+optional`, `+definite` — are here for
 * the reason the others are: a flag the dump does not print is a flag
 * `tests/parser_oracle.js` cannot compare, and these three are the whole
 * difference between a field the checker refuses and one it accepts
 * (docs/wp19-stage0-retirement.md R3). `FLAG_STATIC_FIRST` is deliberately not
 * printed: it is not a modifier the source wrote, it is which of two the source
 * wrote first, and the TypeScript tree has the modifier list rather than the
 * answer.
 */
const kindWithFlags = (node: Node): string => {
  let name = nodeName(node.kind);
  if (node.kind === N_UNARY) return node.flags === FLAG_POSTFIX ? `${name}+postfix` : `${name}+prefix`;
  if ((node.flags & FLAG_EXPORTED) !== 0) name = `${name}+export`;
  if ((node.flags & FLAG_CONST) !== 0) name = `${name}+const`;
  if ((node.flags & FLAG_STATIC) !== 0) name = `${name}+static`;
  if ((node.flags & FLAG_READONLY) !== 0) name = `${name}+readonly`;
  if ((node.flags & FLAG_OPTIONAL) !== 0) name = `${name}+optional`;
  if ((node.flags & FLAG_DEFINITE) !== 0) name = `${name}+definite`;
  return name;
};

/** One line for `node`, then its children one level deeper. */
export const astLines = (node: Node, depth: i32, lines: string[]): void => {
  let line = `${indent(depth)}${kindWithFlags(node)} ${node.start} ${node.end}`;
  if (node.kind === N_STRING || node.kind === N_TEMPLATE_TEXT) {
    line = `${line} #${node.text.length}`;
  } else if (node.text.length > 0) {
    line = `${line} ${node.text}`;
  }
  lines.push(line);
  for (const child of node.children) {
    astLines(child, depth + 1, lines);
  }
};

/**
 * One module as `--emit-ast` prints it: the file it came from, then its tree
 * one level in. The root line carries the path where the oracle's carries a
 * span, because a whole file's span is `0 <length>` and says nothing, while
 * the path is the only thing that tells two modules of one program apart —
 * stage0's `SourceFile <path>` header makes the same trade.
 */
export const astText = (file: Node, path: string): string => {
  const lines: string[] = [];
  lines.push(`${nodeName(file.kind)} ${path}`);
  for (const child of file.children) {
    astLines(child, 1, lines);
  }
  return `${lines.join("\n")}\n`;
};
