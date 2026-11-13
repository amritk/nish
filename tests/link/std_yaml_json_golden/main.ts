// `nish/yaml-json`'s every answer, written out: each document of each
// yaml-test-suite case (tests/yaml-suite/cases.txt), of each input
// tests/link/std_yaml_json gives the loader and of each edge case below,
// loaded under every option set below with one loader and one document
// reused throughout, as a program would. A load that succeeds prints the
// values the document holds (`top`), the JSON it wrote and every value's and
// key's range in walk order; a refusal prints its code, its range and what
// the document holds after it. The expected output was written by the loader
// as it was before its fast paths, so it pins them to the old answers, not to
// their own.
import { crc32 } from "nish/compress/checksum";
import { JsonLimits } from "nish/json-tokenizer";
import {
  JSON_VALUE_ARRAY,
  JSON_VALUE_DUPLICATE_LAST,
  JSON_VALUE_OBJECT,
  JsonDocument,
  JsonValue,
} from "nish/json-value";
import { YamlOptions, YamlStream, parseYamlWith } from "nish/yaml";
import { YamlJsonLoader } from "nish/yaml-json";
import { YcCase, ycLoadCases } from "../std_yaml_conformance/cases";

/** One option set: how the text is parsed, and the loader's and document's limits. */
class YgConfig {
  name: string;
  uniqueKeys: boolean;
  merge: boolean;
  /** Parse with `merge` off, then turn it on, so only the loader checks merge values. */
  forceMerge: boolean;
  last: boolean;
  maxValues: i32;
  maxTotalBytes: i32;
  maxDepth: i32;

  constructor(
    name: string,
    uniqueKeys: boolean,
    merge: boolean,
    forceMerge: boolean,
    last: boolean,
  ) {
    this.name = name;
    this.uniqueKeys = uniqueKeys;
    this.merge = merge;
    this.forceMerge = forceMerge;
    this.last = last;
    this.maxValues = 0;
    this.maxTotalBytes = 0;
    this.maxDepth = 0;
  }
}

/** A config with limits; `0` keeps the default. */
const ygLimited = (
  name: string,
  maxValues: i32,
  maxTotalBytes: i32,
  maxDepth: i32,
): YgConfig => {
  const c = new YgConfig(name, true, true, false, false);
  c.maxValues = maxValues;
  c.maxTotalBytes = maxTotalBytes;
  c.maxDepth = maxDepth;
  return c;
};

const ygConfigs = (): YgConfig[] => {
  const configs: YgConfig[] = [
    new YgConfig("default", true, true, false, false),
    new YgConfig("loose", false, true, false, false),
    new YgConfig("loose-last", false, true, false, true),
    new YgConfig("unique-last", true, true, false, true),
    new YgConfig("no-merge", true, false, false, false),
    new YgConfig("loader-merge", true, false, true, false),
    new YgConfig("loose-loader-merge", false, false, true, true),
  ];
  configs.push(ygLimited("values-8", 8, 0, 0));
  configs.push(ygLimited("values-12", 12, 0, 0));
  configs.push(ygLimited("values-1000", 1000, 0, 0));
  configs.push(ygLimited("bytes-64", 0, 64, 0));
  configs.push(ygLimited("depth-3", 0, 0, 3));
  return configs;
};

/** Every value's and key's range under `v`, in walk order. */
const ygRanges = (doc: JsonDocument, v: JsonValue, out: string[]): void => {
  out.push(`${doc.start(v)}-${doc.end(v)}`);
  const kind: i32 = doc.kind(v);
  if (kind === JSON_VALUE_ARRAY || kind === JSON_VALUE_OBJECT) {
    for (let i: i32 = 0; i < doc.length(v); i += 1) {
      if (kind === JSON_VALUE_OBJECT) {
        out.push(`k${doc.keyStart(v, i)}-${doc.keyEnd(v, i)}`);
      }
      ygRanges(doc, doc.at(v, i), out);
    }
  }
};

/** `line` itself, or past 1000 characters its head, its length and a CRC-32 of its characters' low bytes. */
const ygPrint = (line: string): void => {
  const n: i32 = toI32(line.length);
  if (n <= 1000) {
    console.log(line);
    return;
  }
  const bytes: u8[] = new Array<u8>(n);
  for (let i: i32 = 0; i < n && i < toI32(bytes.length); i += 1) {
    bytes[i] = toU8(line.charCodeAt(i));
  }
  console.log(
    `${line.slice(0, 200)} ... ${n} chars, crc ${crc32(bytes, 0, n)}`,
  );
};

/** Loads every document of `text`, and one past the last, under `c`, printing each answer. */
const ygRun = (
  c: YgConfig,
  loader: YamlJsonLoader,
  doc: JsonDocument,
  key: string,
  text: string,
): void => {
  const options = new YamlOptions();
  options.uniqueKeys = c.uniqueKeys;
  options.merge = c.merge;
  const stream: YamlStream = parseYamlWith(text, options);
  if (c.forceMerge) {
    stream.merge = true;
  }
  for (let d: i32 = 0; d <= stream.documentCount(); d += 1) {
    const root: JsonValue = loader.load(stream, d, doc);
    if (root < 0) {
      ygPrint(
        `${c.name} ${key} ${d} fail ${root} ${loader.failed} ${loader.errorStart} ${loader.errorEnd} top ${doc.top}`,
      );
    } else {
      const ranges: string[] = [];
      ygRanges(doc, root, ranges);
      ygPrint(`${c.name} ${key} ${d} ok top ${doc.top} ${doc.stringify(root)}`);
      ygPrint(
        `  ${ranges.join(" ")} | ${loader.errorStart} ${loader.errorEnd} ${loader.failed}`,
      );
    }
  }
};

/** `n` copies of `unit`. */
const ygRepeat = (unit: string, n: i32): string => {
  const parts: string[] = [];
  for (let i: i32 = 0; i < n; i += 1) {
    parts.push(unit);
  }
  return parts.join("");
};

/** The inputs tests/link/std_yaml_json gives the loader, the loader's fast paths' edge cases, and a small OpenAPI-shaped one like the bench's. */
const ygInputs = (): string[] => {
  const inputs: string[] = [
    "name: pets\nn: 3\nok: true\nnone: null\ntags:\n  - a\n  - b\ndeep:\n  x: [1.5, {y: z}]\n",
    "plain: just words\nsingle: 'it''s'\ndouble: \"a\\tb\"\nfolded: >\n  one\n  two\nliteral: |\n  x\n  y\nflow: {a: [1, 'q'], \"b\": ~}\nseq:\n- &anc deep\n- *anc\nempty:\nmulti: plain\n  across lines\n",
    "[0x1F, 0o17, 0xffffffffffffffffffff, +12, 007, -0, 0, .5, -.5, 1., +1.5e3, 01.25, 1e5, 0x0, 3.0]",
    `[1, 0x${ygRepeat("f", 257)}]`,
    `[0x${ygRepeat("f", 256)}, 0o${ygRepeat("7", 256)}, -0x10, +0o7, 1.e5, -01.50, 0.0e-0]`,
    "['.inf', !!str .nan]",
    "a: &a [1, 2, 3]\nb: *a\n",
    "[1, 2, 3, 4, 5, 6, 7, 8]",
    `a: &a ${ygRepeat("x", 30)}\nb: [*a, *a, *a]\n`,
    `a: &a ${ygRepeat("x", 30)}\nb: [*a]\n`,
    `a: ${ygRepeat("x", 90)}\n`,
    "1: one\ntrue: yes\n~: nothing\n[a, b]: list\n0x10: hex\n",
    "1: a\n'1': b\n",
    "a: x\n'a': y\n\"a\": z\n",
    "? [a, b]\n: 1\n? [ a,  b ]\n: 2\n",
    "? {x: 1}\n: 1\n? {x:  1}\n: 2\n",
    "1.0: a\n1: b\n0x1: c\n01: d\n",
    "null: a\n~: b\n'': c\n",
    ": a\n'': b\n",
    "<<: {a: 1}\n'<<': 2\n",
    "base: &base {a: 1, b: 2}\nmore: &more {c: 3, <<: *base}\nown:\n  b: own\n  <<: [*more, {a: late, d: 4}]\n  e: 5\n",
    "a: &a {x: 1, <<: *a}\n",
    "m: {<<: 5, x: 1}\n",
    "m: {<<: [1, 2]}\n",
    "s: &s 5\nm: {<<: *s}\n",
    "m: {<<: [{a: 1}, x]}\n",
    "m:\n  <<:\n  x: 1\n",
    "m: {<<: {a: 1}, b: 2}\n",
    "m: {<<: {a: 1}, a: 2, <<: {a: 3, b: 4}}\n",
    "b: &b {k: 1, k2: 2}\nm: {k: 0, <<: [*b, *b], <<: *b}\n",
    "a: [1, 2, 3, 4, 5, 6, 7, 8]\n<<: [{}, {}]\n",
    "a: [1, 2\n",
    "--- a\n---\n",
    "--- 1\n--- [2]\n...\n--- {3: 4}\n",
    `${ygRepeat("[", 65)}${ygRepeat("]", 65)}`,
    `${ygRepeat("[", 64)}${ygRepeat("]", 64)}`,
    "a: {b: {c: {d: 1}}}\n",
    "a: &a {b: {c: 1}}\nx: {y: *a}\n",
    // Keys spelled two ways that are one JSON key, or two that look alike and are not.
    "a: &k x\n*k : 1\nx: 2\n",
    "a: &k x\n*k : 1\nb: 2\n",
    "!!str ~: 1\n\"~\": 2\n",
    "!!str ~: 1\n~: 2\n",
    "\"a\\tb\": 1\n\"a\tb\": 2\n",
    "\"a\\tb\": 1\na b: 2\n",
    "? |\n  ab\n: 1\n\"ab\\n\": 2\n",
    "? >-\n  ab\n: 1\nab: 2\n",
    // Numbers as values and as keys.
    "[-0, 0, 1.5e3, 01, +1, 1., 0x1F, -0.0, 1_0, 0b1, 1e, .e1, -a, +a]",
    "-0: a\n0: b\n1.5e3: c\n01: d\n+1: e\n1.: f\n0x1F: g\n",
    "0: a\n-0: b\n",
    // Keys that are null, and keys that start like one and are not.
    "~: a\n",
    "null: a\n",
    "Null: a\n",
    "NULL: a\n",
    "n: a\nN: b\nnul: c\nnulls: d\nnULL: e\n~~: f\nNo: g\n",
    ": a\n",
    "'null': a\n\"~\": b\n",
    "null: a\nNULL: b\n",
    "[true, True, TRUE, tRUE, t, false, False, FALSE, fALSE, f, null, Null, NULL, nULL, ~, ~~, truex, falsey, nullx]",
    "!!null x: a\n!!bool true: b\n!!int 1: c\n!!float 2.5: d\n",
    // A stream of several documents, each sized from its own nodes.
    "--- {a: 1}\n--- {b: [1, 2, {c: 3}]}\n--- 3\n--- [x, {y: z}]\n",
    "--- &a [1, 2]\n--- {k: v}\n--- &b {x: [1, 2, 3]}\n",
  ];
  const bomb: string[] = ["a: &a [x, x, x, x, x, x, x, x, x, x]\n"];
  const names: string[] = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  for (let i: i32 = 1; i < toI32(names.length); i += 1) {
    const p = names[i - 1];
    bomb.push(`${names[i]}: &${names[i]} [`);
    for (let j: i32 = 0; j < 9; j += 1) {
      bomb.push(`*${p}, `);
    }
    bomb.push(`*${p}]\n`);
  }
  inputs.push(bomb.join(""));
  const wideParts: string[] = [];
  for (let i: i32 = 0; i < 40; i += 1) {
    wideParts.push(`k${i}: ${i}\n`);
  }
  const wide = wideParts.join("");
  inputs.push(wide);
  inputs.push(`${wide}k33: again\n`);
  inputs.push(`${wide}'k3': quoted\n`);
  const chain: string[] = ["a0: &a0 {}\n"];
  for (let i: i32 = 1; i <= 60; i += 1) {
    chain.push(`a${i}: &a${i} {<<: [*a${i - 1}, *a${i - 1}]}\n`);
  }
  chain.push("r: *a60\n");
  inputs.push(chain.join(""));
  const deepMerge: string[] = ["c0: &c0 {}\n"];
  for (let i: i32 = 1; i <= 40; i += 1) {
    deepMerge.push(`c${i}: &c${i} {<<: *c${i - 1}}\n`);
  }
  deepMerge.push(`m:\n${ygRepeat("  - {<<: *c40}\n", 500)}`);
  inputs.push(deepMerge.join(""));
  const wideMerge: string[] = ["w: &w {"];
  for (let i: i32 = 0; i < 30; i += 1) {
    wideMerge.push(`m${i}: ${i}, `);
  }
  wideMerge.push("z: end}\nm: {m3: own, <<: *w, m40: x}\n");
  inputs.push(wideMerge.join(""));
  inputs.push(
    `x: &x {}\ns: &s [*x${ygRepeat(", *x", 199)}]\nm:\n${ygRepeat("  - {<<: *s}\n", 200)}`,
  );
  const api: string[] = [
    "openapi: 3.0.3\nx-shared:\n  limit: &limit\n    name: limit\n    in: query\n    schema: {type: integer, minimum: 1, maximum: 0x3e8, default: 20}\n  errors: &errors\n    '400':\n      description: Bad.\n    '404':\n      description: Nothing is there.\npaths:\n",
  ];
  for (let i: i32 = 0; i < 20; i += 1) {
    api.push(
      `  /things${i}/{id}:\n    get:\n      operationId: getThing${i}\n      parameters:\n        - *limit\n        - {name: id, in: path, required: true}\n      responses:\n        '200':\n          description: \"The thing \\u00e9 ${i}.\"\n        <<: *errors\n`,
    );
  }
  inputs.push(api.join(""));
  return inputs;
};

export const main = (): i32 => {
  const cases: YcCase[] = ycLoadCases();
  if (cases.length === 0) {
    console.log("no cases: run from the repository root");
    return 1;
  }
  const inputs: string[] = ygInputs();
  for (const c of ygConfigs()) {
    const limits = new JsonLimits();
    if (c.maxTotalBytes > 0) {
      limits.maxTotalBytes = c.maxTotalBytes;
    }
    const doc = new JsonDocument(limits);
    if (c.maxValues > 0) {
      doc.maxValues = c.maxValues;
    }
    if (c.last) {
      doc.duplicates = JSON_VALUE_DUPLICATE_LAST;
    }
    const loader = new YamlJsonLoader();
    if (c.maxDepth > 0) {
      loader.maxDepth = c.maxDepth;
    }
    for (const each of cases) {
      ygRun(c, loader, doc, each.key, each.yaml);
    }
    for (let i: i32 = 0; i < toI32(inputs.length); i += 1) {
      ygRun(c, loader, doc, `input${i}`, inputs[i]);
    }
  }
  return 0;
};
