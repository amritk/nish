// `nish/json-tokenizer` (std/json-tokenizer.ts): every token kind, error code,
// limit and method; JSONTestSuite's verdicts; a seeded mutation fuzz over its
// corpus; and an arena that stays flat while a reused body is tokenized.
//
// With `--tokens` it prints the token stream of every y_ file instead, which
// the Node check in tests/run.js holds against a walk of JSON.parse's value;
// with `--verdicts` it prints every file's verdict, which is how
// tests/json-suite/i-verdicts.txt was written.
import { Suite } from "../../../std/testing";
import { jtAlloc } from "./alloc";
import { jtCorpusChecks, jtPrintTokens, jtPrintVerdicts } from "./conformance";
import { jtFuzz } from "./fuzz";
import { jtUnits } from "./units";

export const main = (): number => {
  const mode = process.argv.length > 1 ? process.argv[1] : "";
  if (mode === "--tokens") {
    return jtPrintTokens();
  }
  if (mode === "--verdicts") {
    return jtPrintVerdicts();
  }
  const t = new Suite("std/json-tokenizer");
  jtUnits(t);
  jtCorpusChecks(t);
  jtFuzz(t);
  jtAlloc(t);
  return t.done();
};
