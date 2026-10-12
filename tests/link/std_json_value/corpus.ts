// JSONTestSuite through a parse and a write: every y_ file comes back as the
// tokenizer's canonical form of it (byte for byte when it was minified
// already), the two with a repeated key are refused by default and merged as
// JSON.parse merges them under JSON_VALUE_DUPLICATE_LAST, and every other file
// gets the tokenizer's own verdict, code and offset.
import { JsonLimits } from "nish/json-tokenizer";
import { JSON_VALUE_DUPLICATE_LAST, JSON_VALUE_ERR_DUPLICATE, JsonDocument } from "nish/json-value";
import { Suite } from "nish/testing";
import { jvCanonical, jvHexOf, jvLoadCorpus, jvTokVerdict } from "./common";

/** No lines: what a list of problems is held to. */
const jvNone = (): string[] => {
  const none: string[] = [];
  return none;
};

export const jvCorpusChecks = (t: Suite): void => {
  const corpus = jvLoadCorpus();
  if (!t.eqI32("corpus: tests/json-suite/test-parsing.txt holds 318 files", toI32(corpus.length), 318)) {
    return;
  }
  const strict = new JsonDocument(new JsonLimits());
  const lenient = new JsonDocument(new JsonLimits());
  lenient.duplicates = JSON_VALUE_DUPLICATE_LAST;
  let ys: i32 = 0;
  let minified: i32 = 0;
  let others: i32 = 0;
  const yWrong: string[] = [];
  const refusedForDuplicates: string[] = [];
  const verdictWrong: string[] = [];
  for (const c of corpus) {
    const n: i32 = toI32(c.bytes.length);
    if (c.name.startsWith("y_")) {
      ys += 1;
      const r = strict.parse(c.bytes, 0, n);
      if (r === JSON_VALUE_ERR_DUPLICATE) {
        refusedForDuplicates.push(c.name);
        continue;
      }
      const got = r >= 0 ? strict.stringify(r) : `error ${r}@${strict.errorAt}`;
      const want = jvCanonical(c.bytes, n * 2 + 16);
      if (want.length === 0 || got !== want) {
        yWrong.push(`${c.name}: ${got} != ${want}`);
      } else if (toI32(want.length) === n && jvHexOf(want) === jvHexOf(String.fromBytes(c.bytes, 0, n))) {
        minified += 1;
      }
      continue;
    }
    others += 1;
    const tok = jvTokVerdict(c.bytes, 0, n, new JsonLimits());
    const r = lenient.parse(c.bytes, 0, n);
    const mine = r >= 0 ? "0@-1" : `${r}@${lenient.errorAt}`;
    if (mine !== tok || (c.name.startsWith("n_") && r >= 0)) {
      verdictWrong.push(`${c.name}: ${mine} != ${tok}`);
    }
  }
  t.eqI32("corpus: 95 y_ files", ys, 95);
  t.eqI32("corpus: 223 n_ and i_ files", others, 223);
  t.eqLines("JSONTestSuite: every y_ file parsed and written is the tokenizer's canonical form of it", yWrong, jvNone());
  t.eqI32("JSONTestSuite: 55 y_ files were minified already and come back byte for byte", minified, 55);
  t.eqStr(
    "JSONTestSuite: the y_ files with a repeated key are refused by default",
    refusedForDuplicates.join(" "),
    "y_object_duplicated_key.json y_object_duplicated_key_and_value.json"
  );
  const merged: string[] = [];
  for (const c of corpus) {
    if (c.name === "y_object_duplicated_key.json" || c.name === "y_object_duplicated_key_and_value.json") {
      merged.push(lenient.stringify(lenient.parse(c.bytes, 0, toI32(c.bytes.length))));
    }
  }
  t.eqStr("JSONTestSuite: and merged as JSON.parse merges them under LAST", merged.join(" "), '{"a":"c"} {"a":"b"}');
  t.eqLines("JSONTestSuite: every n_ and i_ file gets the tokenizer's verdict, code and offset", verdictWrong, jvNone());
};

/** `--roundtrip`: every y_ file parsed under LAST and written back, as `name hex`, for tests/run.js to hold to JSON.parse. */
export const jvPrintRoundTrips = (): number => {
  const doc = new JsonDocument(new JsonLimits());
  doc.duplicates = JSON_VALUE_DUPLICATE_LAST;
  for (const c of jvLoadCorpus()) {
    if (c.name.startsWith("y_")) {
      const r = doc.parse(c.bytes, 0, toI32(c.bytes.length));
      console.log(`${c.name} ${r >= 0 ? jvHexOf(doc.stringify(r)) : `error${r}`}`);
    }
  }
  return 0;
};
