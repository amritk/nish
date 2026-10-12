// `nish/json-value` (std/json-value.ts): every reader, builder and writer of
// JsonDocument, JSONTestSuite through a parse and a write, and a document
// reused across bodies with the arena flat and every value intact after
// churn.
//
// With `--roundtrip` it prints every y_ file parsed and written back instead,
// which the check in tests/run.js holds to JSON.parse with every number's text
// kept.
import { Suite } from "nish/testing";
import { jvAlloc } from "./alloc";
import { jvCorpusChecks, jvPrintRoundTrips } from "./corpus";
import { jvUnits } from "./units";

export const main = (): number => {
  if (process.argv.length > 1 && process.argv[1] === "--roundtrip") {
    return jvPrintRoundTrips();
  }
  const t = new Suite("std/json-value");
  jvUnits(t);
  jvCorpusChecks(t);
  jvAlloc(t);
  return t.done();
};
