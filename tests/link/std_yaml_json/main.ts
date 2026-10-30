// `nish/yaml-json` (std/yaml-json.ts): a YAML document loaded into a
// `JsonDocument` with its source ranges. JSON and YAML twins load into equal
// trees, one `YamlLineIndex` places every value and key of either text, every
// value's range slices the YAML text to its node through block and flow
// styles, and every refusal answers its code and range: `.inf` and `.nan`, an
// alias bomb, too deep a document, a repeated key. Numbers keep exact JSON
// text, hex and octal included, and merge keys let the map's own keys win.
import { JSON_TOK_ERR_TOTAL_LIMIT, JsonLimits } from "nish/json-tokenizer";
import {
  JSON_VALUE_ARRAY,
  JSON_VALUE_BOOLEAN,
  JSON_VALUE_DUPLICATE_LAST,
  JSON_VALUE_ERR_DUPLICATE,
  JSON_VALUE_ERR_VALUES,
  JSON_VALUE_NULL,
  JSON_VALUE_NUMBER,
  JSON_VALUE_OBJECT,
  JsonDocument,
  JsonValue,
} from "nish/json-value";
import { Suite } from "nish/testing";
import { YamlOptions, parseYaml, parseYamlWith } from "nish/yaml";
import {
  YAML_JSON_ERR_DEPTH,
  YAML_JSON_ERR_DOCUMENT,
  YAML_JSON_ERR_EXPANSION,
  YAML_JSON_ERR_NOT_FINITE,
  YAML_JSON_ERR_NUMBER,
  YAML_JSON_ERR_YAML,
  YamlJsonLoader,
  yamlJsonErrorName,
} from "nish/yaml-json";
import { YamlLineIndex } from "nish/yaml-lines";

const yjDoc = (): JsonDocument => new JsonDocument(new JsonLimits());

/** `text[a, b)`, or `-` and the offsets when the range is not one. */
const yjSlice = (text: string, a: i32, b: i32): string =>
  a < 0 || b < a || b > toI32(text.length) ? `- ${a} ${b}` : text.substring(a, b);

/** Loads document 0 of `text`; the root, or the loader's code. */
const yjLoad = (loader: YamlJsonLoader, doc: JsonDocument, text: string): JsonValue =>
  loader.load(parseYaml(text), 0, doc);

/** Loads document 0 of `text`, parsed with repeated keys let through to the loader. */
const yjLoose = (loader: YamlJsonLoader, doc: JsonDocument, text: string): JsonValue => {
  const options = new YamlOptions();
  options.uniqueKeys = false;
  return loader.load(parseYamlWith(text, options), 0, doc);
};

/** A value written out by walking it: what two trees are compared by. */
const yjWalk = (doc: JsonDocument, v: JsonValue): string => {
  const kind: i32 = doc.kind(v);
  if (kind === JSON_VALUE_NULL) {
    return "null";
  }
  if (kind === JSON_VALUE_BOOLEAN) {
    return doc.boolean(v) ? "true" : "false";
  }
  if (kind === JSON_VALUE_NUMBER) {
    return `#${doc.numberText(v)}`;
  }
  if (kind === JSON_VALUE_ARRAY) {
    const parts: string[] = [];
    for (let i: i32 = 0; i < doc.length(v); i += 1) {
      parts.push(yjWalk(doc, doc.at(v, i)));
    }
    return `[${parts.join(",")}]`;
  }
  if (kind === JSON_VALUE_OBJECT) {
    const parts: string[] = [];
    for (let i: i32 = 0; i < doc.length(v); i += 1) {
      parts.push(`<${doc.keyAt(v, i)}>:${yjWalk(doc, doc.at(v, i))}`);
    }
    return `{${parts.join(",")}}`;
  }
  return `<${doc.string(v)}>`;
};

/** Every value's and key's place in `text`, `line:column` from one index, in walk order. */
const yjPlaces = (doc: JsonDocument, lines: YamlLineIndex, v: JsonValue, out: string[]): void => {
  out.push(`${lines.line(doc.start(v))}:${lines.column(doc.start(v))}`);
  const kind: i32 = doc.kind(v);
  if (kind === JSON_VALUE_ARRAY || kind === JSON_VALUE_OBJECT) {
    for (let i: i32 = 0; i < doc.length(v); i += 1) {
      if (kind === JSON_VALUE_OBJECT) {
        out.push(`k${lines.line(doc.keyStart(v, i))}:${lines.column(doc.keyStart(v, i))}`);
      }
      yjPlaces(doc, lines, doc.at(v, i), out);
    }
  }
};

/** Every value's and key's source text, in walk order. */
const yjSlices = (doc: JsonDocument, text: string, v: JsonValue, out: string[]): void => {
  out.push(yjSlice(text, doc.start(v), doc.end(v)));
  const kind: i32 = doc.kind(v);
  if (kind === JSON_VALUE_ARRAY || kind === JSON_VALUE_OBJECT) {
    for (let i: i32 = 0; i < doc.length(v); i += 1) {
      if (kind === JSON_VALUE_OBJECT) {
        out.push(`k(${yjSlice(text, doc.keyStart(v, i), doc.keyEnd(v, i))})`);
      }
      yjSlices(doc, text, doc.at(v, i), out);
    }
  }
};

const yjTwins = (t: Suite): void => {
  const json = '{\n  "name": "pets",\n  "n": 3,\n  "ok": true,\n  "none": null,\n  "tags": ["a", "b"],\n  "deep": {"x": [1.5, {"y": "z"}]}\n}';
  const yaml = "name: pets\nn: 3\nok: true\nnone: null\ntags:\n  - a\n  - b\ndeep:\n  x: [1.5, {y: z}]\n";
  const jd = yjDoc();
  const jr = jd.parseTextRanged(json);
  const yd = yjDoc();
  const loader = new YamlJsonLoader();
  const yr = yjLoad(loader, yd, yaml);
  if (!t.ok("twins: both load", jr >= 0 && yr >= 0)) {
    return;
  }
  t.eqStr("twins: equal trees", yjWalk(yd, yr), yjWalk(jd, jr));
  const jp: string[] = [];
  yjPlaces(jd, new YamlLineIndex(json), jr, jp);
  const yp: string[] = [];
  yjPlaces(yd, new YamlLineIndex(yaml), yr, yp);
  t.eqStr(
    "twins: line:column of every JSON value and key",
    jp.join(" "),
    "1:1 k2:3 2:11 k3:3 3:8 k4:3 4:9 k5:3 5:11 k6:3 6:11 6:12 6:17 k7:3 7:11 k7:12 7:17 7:18 7:23 k7:24 7:29",
  );
  t.eqStr(
    "twins: line:column of every YAML value and key",
    yp.join(" "),
    "1:1 k1:1 1:7 k2:1 2:4 k3:1 3:5 k4:1 4:7 k5:1 6:3 6:5 7:5 k8:1 9:3 k9:3 9:6 9:7 9:12 k9:13 9:16",
  );
};

const yjRanges = (t: Suite): void => {
  const text =
    "plain: just words\nsingle: 'it''s'\ndouble: \"a\\tb\"\nfolded: >\n  one\n  two\nliteral: |\n  x\n  y\nflow: {a: [1, 'q'], \"b\": ~}\nseq:\n- &anc deep\n- *anc\nempty:\nmulti: plain\n  across lines\n";
  const doc = yjDoc();
  const loader = new YamlJsonLoader();
  const root = yjLoad(loader, doc, text);
  if (!t.ok("ranges: loads", root >= 0)) {
    return;
  }
  const all: string[] = [];
  yjSlices(doc, text, root, all);
  const out: string[] = [];
  for (let i: i32 = 1; i < toI32(all.length); i += 1) {
    out.push(all[i]);
  }
  t.eqStr(
    "ranges: every value and key slices to its node",
    out.join("|"),
    "k(plain)|just words|k(single)|'it''s'|k(double)|\"a\\tb\"|k(folded)|>\n  one\n  two|k(literal)||\n  x\n  y|k(flow)|{a: [1, 'q'], \"b\": ~}|k(a)|[1, 'q']|1|'q'|k(\"b\")|~|k(seq)|- &anc deep\n- *anc|deep|*anc|k(empty)||k(multi)|plain\n  across lines",
  );
  t.eqStr("ranges: decoded strings", `${doc.string(doc.get(root, "single"))}|${doc.string(doc.get(root, "double"))}|${doc.string(doc.get(root, "folded"))}|${doc.string(doc.get(root, "literal"))}|${doc.string(doc.get(root, "multi"))}`, "it's|a\tb|one two\n|x\ny\n|plain across lines");
  t.ok("ranges: an empty value is null", doc.kind(doc.get(root, "empty")) === JSON_VALUE_NULL);
};

const yjNumbers = (t: Suite): void => {
  const text =
    "[0x1F, 0o17, 0xffffffffffffffffffff, +12, 007, -0, 0, .5, -.5, 1., +1.5e3, 01.25, 1e5, 0x0, 3.0]";
  const doc = yjDoc();
  const root = yjLoad(new YamlJsonLoader(), doc, text);
  if (!t.ok("numbers: load", root >= 0)) {
    return;
  }
  const out: string[] = [];
  for (let i: i32 = 0; i < doc.length(root); i += 1) {
    out.push(yjWalk(doc, doc.at(root, i)));
  }
  t.eqStr(
    "numbers: exact JSON text",
    out.join(" "),
    "#31 #15 #1208925819614629174706175 #12 #7 #0 #0 #0.5 #-0.5 #1.0 #1.5e3 #1.25 #1e5 #0 #3.0",
  );
  let wide = "0x";
  for (let i: i32 = 0; i < 257; i += 1) {
    wide = `${wide}f`;
  }
  const loader = new YamlJsonLoader();
  t.eqI32("numbers: a hex integer past 256 digits", yjLoad(loader, doc, `[1, ${wide}]`), YAML_JSON_ERR_NUMBER);
  t.eqI32("numbers: at it", loader.errorStart, 4);
};

const yjNotFinite = (t: Suite): void => {
  const cases: string[] = [".inf", "-.inf", "+.INF", ".nan", ".NaN"];
  for (let i: i32 = 0; i < toI32(cases.length); i += 1) {
    const text = `a: 1\nb: [2, ${cases[i]}]\n`;
    const doc = yjDoc();
    const loader = new YamlJsonLoader();
    const code = yjLoad(loader, doc, text);
    t.eqI32(`not finite: ${cases[i]} is refused`, code, YAML_JSON_ERR_NOT_FINITE);
    t.eqStr(`not finite: ${cases[i]} at its node`, yjSlice(text, loader.errorStart, loader.errorEnd), cases[i]);
    t.eqI32(`not finite: ${cases[i]} leaves the document empty`, doc.top, 0);
  }
  t.eqStr("not finite: named", yamlJsonErrorName(YAML_JSON_ERR_NOT_FINITE), "NOT_FINITE");
  const doc = yjDoc();
  const root = yjLoad(new YamlJsonLoader(), doc, "['.inf', !!str .nan]");
  t.eqStr("not finite: a quoted or tagged one is a string", yjWalk(doc, root), "[<.inf>,<.nan>]");
};

const yjBomb = (t: Suite): void => {
  let text = "a: &a [x, x, x, x, x, x, x, x, x, x]\n";
  const names: string[] = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  for (let i: i32 = 1; i < toI32(names.length); i += 1) {
    const p = names[i - 1];
    text = `${text}${names[i]}: &${names[i]} [*${p}, *${p}, *${p}, *${p}, *${p}, *${p}, *${p}, *${p}, *${p}, *${p}]\n`;
  }
  const doc = yjDoc();
  const loader = new YamlJsonLoader();
  const code = yjLoad(loader, doc, text);
  t.eqI32("bomb: a billion laughs is refused", code, YAML_JSON_ERR_EXPANSION);
  // `*f` is the first alias whose copy alone is past the limit.
  t.eqStr("bomb: at the first alias whose copy is past the limit", yjSlice(text, loader.errorStart, loader.errorEnd), "*f");
  t.eqI32("bomb: nothing was built", doc.top, 0);
  t.eqStr("bomb: named", yamlJsonErrorName(code), "EXPANSION");
  const small = yjDoc();
  small.maxValues = 12;
  const fits = yjLoad(loader, small, "a: &a [1, 2, 3]\nb: *a\n");
  t.ok("bomb: an expansion within maxValues loads", fits >= 0);
  t.eqStr("bomb: as copies", yjWalk(small, fits), "{<a>:[#1,#2,#3],<b>:[#1,#2,#3]}");
  t.eqStr("bomb: the copy's root has the alias's range", yjSlice("a: &a [1, 2, 3]\nb: *a\n", small.start(small.get(fits, "b")), small.end(small.get(fits, "b"))), "*a");
  t.eqStr("bomb: inside it, the anchored text's", yjSlice("a: &a [1, 2, 3]\nb: *a\n", small.start(small.at(small.get(fits, "b"), 2)), small.end(small.at(small.get(fits, "b"), 2))), "3");
  small.maxValues = 8;
  t.eqI32("bomb: one past maxValues is refused", yjLoad(loader, small, "a: &a [1, 2, 3]\nb: *a\n"), YAML_JSON_ERR_EXPANSION);
  t.eqI32("bomb: no alias, too many values", yjLoad(loader, small, "[1, 2, 3, 4, 5, 6, 7, 8]"), JSON_VALUE_ERR_VALUES);
};

const yjTextBomb = (t: Suite): void => {
  const limits = new JsonLimits();
  limits.maxTotalBytes = 64;
  const doc = new JsonDocument(limits);
  const loader = new YamlJsonLoader();
  const long = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
  // 30 bytes, its key, and one copy fit in 64; the second copy does not.
  const text = `a: &a ${long}\nb: [*a, *a, *a]\n`;
  const code = yjLoad(loader, doc, text);
  t.eqI32("text bomb: copies of a long string past maxTotalBytes are refused", code, YAML_JSON_ERR_EXPANSION);
  t.eqI32("text bomb: at the copy that does not fit", loader.errorStart, toI32(text.indexOf("*a, *a]")));
  t.eqI32("text bomb: nothing is kept", doc.top, 0);
  const one = yjLoad(loader, doc, `a: &a ${long}\nb: [*a]\n`);
  t.ok("text bomb: one copy fits", one >= 0);
  const plain = yjLoad(loader, doc, `a: ${long}${long}${long}\n`);
  t.eqI32("text bomb: no alias, too much text", plain, JSON_TOK_ERR_TOTAL_LIMIT);
  t.eqI32("text bomb: at the string", loader.errorStart, 3);
};

const yjKeys = (t: Suite): void => {
  const text = "1: one\ntrue: yes\n~: nothing\n[a, b]: list\n0x10: hex\n";
  const doc = yjDoc();
  const loader = new YamlJsonLoader();
  const root = yjLoad(loader, doc, text);
  t.eqStr("keys: non-string keys are their source text", yjWalk(doc, root), "{<1>:<one>,<true>:<yes>,<>:<nothing>,<[ a, b ]>:<list>,<0x10>:<hex>}");
  t.eqStr("keys: with their ranges", yjSlice(text, doc.keyStart(root, 3), doc.keyEnd(root, 3)), "[a, b]");
  const dup = "1: a\n'1': b\n";
  t.eqI32("keys: the stream reports 1 and '1' as one key", yjLoad(loader, doc, dup), YAML_JSON_ERR_YAML);
  t.eqI32("keys: 1 and '1' are one JSON key", yjLoose(loader, doc, dup), JSON_VALUE_ERR_DUPLICATE);
  t.eqStr("keys: refused at the second", yjSlice(dup, loader.errorStart, loader.errorEnd), "'1'");
  doc.duplicates = JSON_VALUE_DUPLICATE_LAST;
  const last = yjLoose(loader, doc, dup);
  t.eqStr("keys: or the last value, in the first one's place", yjWalk(doc, last), "{<1>:<b>}");
  t.eqStr("keys: with the first key's range", yjSlice(dup, doc.keyStart(last, 0), doc.keyEnd(last, 0)), "1");
  // Wide maps: keys past the scan go through the hash map.
  let wide = "";
  for (let i: i32 = 0; i < 40; i += 1) {
    wide = `${wide}k${i}: ${i}\n`;
  }
  const wd = yjDoc();
  const w = yjLoad(loader, wd, wide);
  t.ok("keys: a wide map loads", w >= 0 && wd.length(w) === 40 && wd.numberText(wd.get(w, "k39")) === "39");
  t.eqI32("keys: a repeat past the scan is found", yjLoose(loader, wd, `${wide}k33: again\n`), JSON_VALUE_ERR_DUPLICATE);
};

const yjMerge = (t: Suite): void => {
  const text =
    "base: &base {a: 1, b: 2}\nmore: &more {c: 3, <<: *base}\nown:\n  b: own\n  <<: [*more, {a: late, d: 4}]\n  e: 5\n";
  const doc = yjDoc();
  const root = yjLoad(new YamlJsonLoader(), doc, text);
  if (!t.ok("merge: loads", root >= 0)) {
    return;
  }
  t.eqStr("merge: a merge in a merged map", yjWalk(doc, doc.get(root, "more")), "{<c>:#3,<a>:#1,<b>:#2}");
  t.eqStr("merge: own keys win, then the first map listed", yjWalk(doc, doc.get(root, "own")), "{<b>:<own>,<e>:#5,<c>:#3,<a>:#1,<d>:#4}");
  const own = doc.get(root, "own");
  t.eqStr("merge: a merged key keeps its source range", yjSlice(text, doc.keyStart(own, 3), doc.keyEnd(own, 3)), "a");
  t.eqI32("merge: from the anchored map", doc.keyStart(own, 3), 13);
};

const yjRefusals = (t: Suite): void => {
  const doc = yjDoc();
  const loader = new YamlJsonLoader();
  t.eqI32("document: past the last", loader.load(parseYaml("a: 1\n"), 1, doc), YAML_JSON_ERR_DOCUMENT);
  const bad = "a: [1, 2\n";
  t.eqI32("yaml: a document with an error", yjLoad(loader, doc, bad), YAML_JSON_ERR_YAML);
  t.ok("yaml: at its diagnostic", loader.errorStart >= 0 && loader.errorEnd >= loader.errorStart);
  let deep = "";
  for (let i: i32 = 0; i < 65; i += 1) {
    deep = `${deep}[`;
  }
  for (let i: i32 = 0; i < 65; i += 1) {
    deep = `${deep}]`;
  }
  t.eqI32("depth: 65 deep is refused", yjLoad(loader, doc, deep), YAML_JSON_ERR_DEPTH);
  t.eqI32("depth: at the one too deep", loader.errorStart, 64);
  t.ok("depth: 64 deep loads", yjLoad(loader, doc, deep.substring(1, 129)) >= 0);
  const empty = yjLoad(loader, doc, "--- a\n---\n");
  t.ok("document: the first loads", empty >= 0);
  const second = loader.load(parseYaml("--- a\n---\n"), 1, doc);
  t.ok("document: an empty one is null", second >= 0 && doc.kind(second) === JSON_VALUE_NULL);
  t.eqStr("names: an unknown code", yamlJsonErrorName(-1), "");
};

export const main = (): number => {
  const t = new Suite("std/yaml-json");
  yjTwins(t);
  yjRanges(t);
  yjNumbers(t);
  yjNotFinite(t);
  yjBomb(t);
  yjTextBomb(t);
  yjKeys(t);
  yjMerge(t);
  yjRefusals(t);
  return t.done();
};
