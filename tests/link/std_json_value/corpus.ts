// JSONTestSuite through a parse and a write: every y_ file comes back as the
// tokenizer's canonical form of it (byte for byte when it was minified
// already), the two with a repeated key are refused by default and merged as
// JSON.parse merges them under JSON_VALUE_DUPLICATE_LAST, and every other file
// gets the tokenizer's own verdict, code and offset.
import { JSON_WRITER_MAX_DEPTH, JsonWriter } from "nish/json";
import { JSON_TOK_KEY, JSON_TOK_STRING, JsonLimits, JsonTokenizer } from "nish/json-tokenizer";
import { JSON_VALUE_DUPLICATE_LAST, JSON_VALUE_ERR_DUPLICATE, JsonDocument } from "nish/json-value";
import { Suite } from "nish/testing";
import { JvCase, jvCanonical, jvHex, jvHexOf, jvLoadCorpus, jvTokVerdict } from "./common";

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
  const writerDepth = new JsonLimits();
  writerDepth.maxDepth = JSON_WRITER_MAX_DEPTH;
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
    // The document's depth is the writer's 64, so the tokenizer is asked with that limit too.
    const tok = jvTokVerdict(c.bytes, 0, n, writerDepth);
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
  t.eqLines(
    "JSONTestSuite: every key and string of every y_ file is written by keyBytes and stringBytes as key and string write it",
    jvBytesAgainstStrings(corpus),
    jvNone()
  );
  const fuzz = jvLoadFuzzCorpus();
  t.ok("corpus: tests/fuzz/corpus/json-value holds files", fuzz.length > 0);
  t.eqLines(
    "ranges: every file of JSONTestSuite and the fuzz corpus parses with keepRanges on to the verdict, errorAt and tree it parses to with it off",
    jvRangesAgainstNone(corpus, fuzz),
    jvNone()
  );
};

/**
 * Every file of tests/fuzz/corpus/json-value, its first byte dropped: the
 * mode tests/fuzz/targets/json-value.ts reads from it, which
 * `jvRangesAgainstNone` runs every file under anyway.
 */
const jvLoadFuzzCorpus = (): JvCase[] => {
  const cases: JvCase[] = [];
  const dir = "tests/fuzz/corpus/json-value";
  const names = readdirSync(dir);
  if (names === null) {
    return cases;
  }
  for (const name of names) {
    const bytes = readFileBytesSync(`${dir}/${name}`);
    if (bytes !== null && bytes.length > 0) {
      const text: u8[] = [];
      for (let i: i32 = 1; i < toI32(bytes.length); i += 1) {
        text.push(bytes[i]);
      }
      cases.push(new JvCase(`fuzz/${name}`, text));
    }
  }
  return cases;
};

/** What a parse of `c` by `doc` gives: the tree it writes, or its code and `errorAt`. */
const jvVerdict = (doc: JsonDocument, c: JvCase): string => {
  const r = doc.parse(c.bytes, 0, toI32(c.bytes.length));
  return r >= 0 ? doc.stringify(r) : `error ${r}@${doc.errorAt}`;
};

/**
 * Every file of `corpus` and `fuzz` parsed by a document that keeps ranges
 * and one that does not, under both duplicate policies, with and without a
 * cap of 16 values and of depth 4, and each document reused across files:
 * the files where the two differ. `parse` and `parseRanged` are two loops,
 * and `close` and `closeRanged` two closers, so this holds each pair to one
 * another.
 */
const jvRangesAgainstNone = (corpus: JvCase[], fuzz: JvCase[]): string[] => {
  const differ: string[] = [];
  for (let mode: i32 = 0; mode < 8; mode += 1) {
    const limits = new JsonLimits();
    if ((mode & 4) !== 0) {
      limits.maxDepth = 4;
    }
    const off = new JsonDocument(limits);
    const on = new JsonDocument(limits);
    on.keepRanges = true;
    on.clear();
    if ((mode & 1) !== 0) {
      off.duplicates = JSON_VALUE_DUPLICATE_LAST;
      on.duplicates = JSON_VALUE_DUPLICATE_LAST;
    }
    if ((mode & 2) !== 0) {
      off.maxValues = 16;
      on.maxValues = 16;
    }
    for (const files of [corpus, fuzz]) {
      for (const c of files) {
        const a = jvVerdict(off, c);
        const b = jvVerdict(on, c);
        if (a !== b) {
          differ.push(`${c.name}, mode ${mode}: off ${a}, on ${b}`);
        }
      }
    }
  }
  return differ;
};

/**
 * Every key and string of every y_ file, decoded, written by `stringBytes`
 * and `keyBytes` from the decoded bytes and by `string` and `key` from a
 * string of them: the names of the files where the two differ.
 */
const jvBytesAgainstStrings = (corpus: JvCase[]): string[] => {
  const differ: string[] = [];
  const outA = new Array<u8>(4096);
  const outB = new Array<u8>(4096);
  const a = new JsonWriter(outA, 0);
  const b = new JsonWriter(outB, 0);
  for (const c of corpus) {
    if (!c.name.startsWith("y_")) {
      continue;
    }
    const tok = new JsonTokenizer(c.bytes, 0, toI32(c.bytes.length), new JsonLimits());
    const scratch = new Array<u8>(toI32(c.bytes.length));
    let k: i32 = tok.next();
    let same = true;
    while (k > 0) {
      if (k === JSON_TOK_KEY || k === JSON_TOK_STRING) {
        const n: i32 = tok.stringInto(scratch, 0);
        const text = n > 0 ? String.fromBytes(scratch, 0, n) : "";
        a.reset(outA, 0);
        b.reset(outB, 0);
        a.beginObject();
        a.key(text);
        a.string(text);
        a.endObject();
        b.beginObject();
        b.keyBytes(scratch, 0, n);
        b.stringBytes(scratch, 0, n);
        b.endObject();
        if (!a.complete() || !b.complete() || a.end !== b.end || jvHex(outA, a.end) !== jvHex(outB, b.end)) {
          same = false;
        }
      }
      k = tok.next();
    }
    if (!same) {
      differ.push(c.name);
    }
  }
  return differ;
};

/**
 * `--roundtrip`: every y_ file parsed under LAST and written back minified and
 * indented by two spaces, as `name minified-hex indented-hex`, for
 * tests/run.js to hold to JSON.parse.
 */
export const jvPrintRoundTrips = (): number => {
  const doc = new JsonDocument(new JsonLimits());
  doc.duplicates = JSON_VALUE_DUPLICATE_LAST;
  for (const c of jvLoadCorpus()) {
    if (c.name.startsWith("y_")) {
      const n: i32 = toI32(c.bytes.length);
      const r = doc.parse(c.bytes, 0, n);
      const out = new Array<u8>(n * 8 + 64);
      const w = new JsonWriter(out, 0);
      w.setIndent(2);
      w.reset(out, 0);
      doc.write(r, w);
      const pretty = w.complete() ? jvHex(out, w.end) : "error";
      console.log(`${c.name} ${r >= 0 ? jvHexOf(doc.stringify(r)) : `error${r}`} ${pretty}`);
    }
  }
  return 0;
};
