// The JSON conformance of nish/json-tokenizer and nish/json's JsonWriter
// together: test262's and V8's JSON.parse and JSON.stringify cases, kept as data
// in tests/json-conformance/ (conformance.ts), and every y_ file of
// JSONTestSuite rewritten to a whole text.
//
// With `--rewrite` it prints each y_ file's rewrite instead, which tests/run.js
// holds to JSON.stringify(JSON.parse(x)); the same function runs there under
// Node (rewrite.ts).
import { Suite } from "nish/testing";
import { jcConformance, jcPrintMismatches } from "./conformance";
import { jcPrintRewrites } from "./rewrite";
import { jcSuiteChecks } from "./suite";

export const main = (): number => {
  const mode = process.argv.length > 1 ? process.argv[1] : "";
  if (mode === "--rewrite") {
    return jcPrintRewrites();
  }
  if (mode === "--mismatches") {
    return jcPrintMismatches();
  }
  const t = new Suite("std/json conformance");
  jcConformance(t);
  jcSuiteChecks(t);
  return t.done();
};
