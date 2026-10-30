// JSONTestSuite through a parse and a write: every y_ file comes back as the
// tokenizer's canonical form of it (byte for byte when it was minified
// already), the two with a repeated key are refused by default and merged as
// JSON.parse merges them under JSON_VALUE_DUPLICATE_LAST, and every other file
// gets the tokenizer's own verdict, code and offset.
import { JSON_WRITER_MAX_DEPTH, JsonWriter } from "nish/json";
import { JSON_TOK_KEY, JSON_TOK_STRING, JsonLimits, JsonTokenizer } from "nish/json-tokenizer";
import {
  JSON_VALUE_ARRAY,
  JSON_VALUE_DUPLICATE_LAST,
  JSON_VALUE_ERR_DUPLICATE,
  JSON_VALUE_OBJECT,
  JsonDocument,
  JsonValue,
} from "nish/json-value";
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
    "ranges: every file of JSONTestSuite, the fuzz corpus and the wide objects parses through parseRanged to the verdict, errorAt and tree parse gives, and every value and key it ranges reparses alone to itself",
    jvRangesAgainstNone(corpus, fuzz, jvWide()),
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

/**
 * Objects of more than 8 members, which take the sorted path of the duplicate
 * check, with a repeated key: neither JSONTestSuite nor the fuzz corpus has
 * one, and `sortPending` and `sortPendingRanged` are two copies.
 */
const jvWide = (): JvCase[] => {
  const texts: string[] = [
    '{"k0":0,"k1":1,"k2":2,"k3":3,"k4":4,"k5":5,"k6":6,"k7":7,"k1":"one"}',
    '{"z":[1],"y":{"a":1,"b":2,"c":3,"d":4,"e":5,"f":6,"g":7,"h":8,"a":[9]},"x":2,"w":3,"v":4,"u":5,"t":6,"s":7,"z":null}',
    '[{"m0":0,"m1":1,"m2":2,"m3":3,"m4":4,"m5":5,"m6":6,"m7":7,"m8":8,"m9":9,"m0":"a","m9":"b"}]',
  ];
  const cases: JvCase[] = [];
  for (let i: i32 = 0; i < toI32(texts.length); i += 1) {
    const text: u8[] = [];
    for (let j: i32 = 0; j < toI32(texts[i].length); j += 1) {
      text.push(toU8(toI32(texts[i].charCodeAt(j))));
    }
    cases.push(new JvCase(`wide/${i}`, text));
  }
  return cases;
};

/** What a parse of `c` by `doc` gives: the tree it writes, or its code and `errorAt`. */
const jvVerdict = (doc: JsonDocument, c: JvCase): string => {
  const r = doc.parse(c.bytes, 0, toI32(c.bytes.length));
  return r >= 0 ? doc.stringify(r) : `error ${r}@${doc.errorAt}`;
};

/**
 * `jvVerdict` through `parseRanged`, and on success every value and key of
 * the tree whose range is not its own bytes: `scratch`, under `doc`'s
 * duplicate policy, reparses each range alone and must give the same value,
 * or the same string for a key. A root without a range is one of them.
 */
const jvRangedVerdict = (doc: JsonDocument, scratch: JsonDocument, c: JvCase): string => {
  const r = doc.parseRanged(c.bytes, 0, toI32(c.bytes.length));
  if (r < 0) {
    return `error ${r}@${doc.errorAt}`;
  }
  const wrong: string[] = [];
  jvRangesOf(doc, scratch, c, r, wrong);
  return wrong.length === 0 ? doc.stringify(r) : `${doc.stringify(r)}, ranges wrong: ${wrong.join(" ")}`;
};

/** `jvRangedVerdict`'s check of `v` and everything under it, each wrong range pushed onto `wrong`. */
const jvRangesOf = (doc: JsonDocument, scratch: JsonDocument, c: JvCase, v: JsonValue, wrong: string[]): void => {
  const a = doc.start(v);
  const b = doc.end(v);
  const alone = a < 0 || b < a || b > toI32(c.bytes.length) ? -1 : scratch.parse(c.bytes, a, b - a);
  if (alone < 0 || scratch.stringify(alone) !== doc.stringify(v)) {
    wrong.push(`value[${a},${b})`);
  }
  const kind = doc.kind(v);
  if (kind !== JSON_VALUE_OBJECT && kind !== JSON_VALUE_ARRAY) {
    return;
  }
  for (let i: i32 = 0; i < doc.length(v); i += 1) {
    if (kind === JSON_VALUE_OBJECT) {
      const ka = doc.keyStart(v, i);
      const kb = doc.keyEnd(v, i);
      const key = ka < 0 || kb < ka || kb > toI32(c.bytes.length) ? -1 : scratch.parse(c.bytes, ka, kb - ka);
      if (key < 0 || !scratch.stringEquals(key, doc.keyAt(v, i))) {
        wrong.push(`key[${ka},${kb})`);
      }
    }
    jvRangesOf(doc, scratch, c, doc.at(v, i), wrong);
  }
};

/**
 * Every file of `corpus`, `fuzz` and `wide` parsed by `parse` and by
 * `parseRanged`, under both duplicate policies, with and without a cap of 16
 * values and of depth 4, and each document reused across files: the files
 * where the two differ, or where a range is wrong. `parse` and `parseRanged`
 * are two loops, `close` and `closeRanged` two closers, and so on, so this
 * holds each pair to one another.
 */
const jvRangesAgainstNone = (corpus: JvCase[], fuzz: JvCase[], wide: JvCase[]): string[] => {
  const differ: string[] = [];
  for (let mode: i32 = 0; mode < 8; mode += 1) {
    const limits = new JsonLimits();
    if ((mode & 4) !== 0) {
      limits.maxDepth = 4;
    }
    const off = new JsonDocument(limits);
    const on = new JsonDocument(limits);
    const scratch = new JsonDocument(new JsonLimits());
    if ((mode & 1) !== 0) {
      off.duplicates = JSON_VALUE_DUPLICATE_LAST;
      on.duplicates = JSON_VALUE_DUPLICATE_LAST;
      scratch.duplicates = JSON_VALUE_DUPLICATE_LAST;
    }
    if ((mode & 2) !== 0) {
      off.maxValues = 16;
      on.maxValues = 16;
    }
    for (const files of [corpus, fuzz, wide]) {
      for (const c of files) {
        const a = jvVerdict(off, c);
        const b = jvRangedVerdict(on, scratch, c);
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
