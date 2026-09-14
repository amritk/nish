// `dump_tokens <file>`: one line per token, which is how the S1 lexer is
// tested (docs/wp14-selfhost.md, milestone S1). Two things read this output:
// a human, and `tests/lexer_oracle.mjs`, which produces the same lines from
// the `typescript` scanner and diffs them over the whole `tests/cases/`
// corpus. Agreeing with a 60,000-line scanner on every offset in 700 files is
// a stronger statement than any golden written by hand.
//
// The format is one token per line:
//
//   <NAME> <start> <end>            punctuation, keywords, END
//   <NAME> <start> <end> <text>     IDENT and NUMBER, whose text is their meaning
//   <NAME> <start> <end> #<bytes>   STRING and the template parts: the *decoded*
//                                   byte length, so an escape that decodes to the
//                                   wrong bytes is a diff rather than a silence
//   ERROR <start> <end> <message>
//
// It is also the first `self/` program that runs: built by stage0 and executed
// natively, which is the other half of the S1 proof.

import { Lexer } from "./lexer";
import {
  TOK_BIGINT,
  TOK_END,
  TOK_ERROR,
  TOK_IDENT,
  TOK_NUMBER,
  TOK_PRIVATE_IDENT,
  TOK_STRING,
  TOK_TEMPLATE,
  TOK_TEMPLATE_HEAD,
  TOK_TEMPLATE_MIDDLE,
  TOK_TEMPLATE_TAIL,
  tokenName,
} from "./tokens";

/** Whether the token's `value` is text the reader wants to see as it is. */
const hasText = (kind: i32): boolean => {
  return kind === TOK_IDENT || kind === TOK_NUMBER || kind === TOK_BIGINT || kind === TOK_PRIVATE_IDENT;
};

/** Whether the token's `value` is decoded bytes, reported as a length. */
const hasBytes = (kind: i32): boolean => {
  return (
    kind === TOK_STRING ||
    kind === TOK_TEMPLATE ||
    kind === TOK_TEMPLATE_HEAD ||
    kind === TOK_TEMPLATE_MIDDLE ||
    kind === TOK_TEMPLATE_TAIL
  );
};

export const main = (): number => {
  if (process.argv.length < 2) {
    console.error("usage: dump_tokens <file>");
    return 2;
  }
  const path = process.argv[1];
  const source = readFileSyncOrNull(path);
  if (source === null) {
    console.error(`dump_tokens: cannot read ${path}`);
    return 1;
  }

  const lexer = new Lexer(source);
  const lines: string[] = [];
  let failed = false;
  while (true) {
    lexer.next();
    const name = tokenName(lexer.kind);
    let line = `${name} ${lexer.start} ${lexer.end}`;
    if (hasText(lexer.kind)) line = `${line} ${lexer.value}`;
    else if (hasBytes(lexer.kind)) line = `${line} #${lexer.value.length}`;
    else if (lexer.kind === TOK_ERROR) line = `${line} ${lexer.value}`;
    lines.push(line);
    if (lexer.kind === TOK_END) break;
    if (lexer.kind === TOK_ERROR) {
      // A lexical error stops the dump: the cursor has already moved past the
      // offending bytes, but everything after it is guesswork, and a dump that
      // keeps guessing is a dump nobody can diff.
      failed = true;
      break;
    }
  }
  write(`${lines.join("\n")}\n`);
  return failed ? 1 : 0;
};
