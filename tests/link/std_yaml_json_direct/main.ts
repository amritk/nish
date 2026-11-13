// `YamlJsonLoader.loadText` (std/yaml-json.ts) against
// `load(parseYaml(text))`: every document of every yaml-test-suite case
// (tests/yaml-suite/cases.txt), and one past the last, loads both ways with
// the same values, ranges and refusals. Then the refusals the direct path
// must keep, each through `loadText` alone: an alias bomb, merge visits past
// the budget, a document too deep and copies past the byte cap. Last, merge
// and scalar cases that must load both ways alike and, where they load, by
// the direct path rather than its fallback to `load`.
import { JSON_TOK_ERR_TOTAL_LIMIT, JsonLimits } from "nish/json-tokenizer";
import { JsonDocument } from "nish/json-value";
import { Suite } from "nish/testing";
import { parseYaml } from "nish/yaml";
import {
  YAML_JSON_ERR_DEPTH,
  YAML_JSON_ERR_DOCUMENT,
  YAML_JSON_ERR_EXPANSION,
  YAML_JSON_ERR_YAML,
  YamlJsonLoader,
} from "nish/yaml-json";
import { ycLoadCases } from "../std_yaml_conformance/cases";
import { yjdAnswer, yjdRun } from "./compare";

/** How many documents of the suite load both ways, and how many of them load: a change to cases.txt updates them here. */
const YJD_PINNED_DOCUMENTS: i32 = 860;
const YJD_PINNED_LOADS: i32 = 359;

const yjdSuite = (t: Suite): void => {
  const cases = ycLoadCases();
  if (!t.ok("suite: the cases load", cases.length > 0)) {
    return;
  }
  const loader = new YamlJsonLoader();
  const doc = new JsonDocument(new JsonLimits());
  let compared: i32 = 0;
  let loaded: i32 = 0;
  let differ: i32 = 0;
  for (const c of cases) {
    const count = parseYaml(c.yaml).documentCount();
    for (let d: i32 = 0; d <= count; d += 1) {
      const run = yjdRun(loader, doc, c.yaml, d);
      compared += 1;
      if (run.root >= 0) {
        loaded += 1;
      }
      // The same loader's `load` after its `loadText`: nothing the sweep leaves behind may move it.
      const again = yjdAnswer(loader, doc, loader.load(parseYaml(c.yaml), d, doc));
      if (run.differs !== "" || again !== run.answer) {
        differ += 1;
        console.log(`DIFFERS ${c.key} document ${d}\n${run.differs}\nreused load: ${again}`);
      }
    }
  }
  t.eqI32("suite: documents compared, one past the last of each case included", compared, YJD_PINNED_DOCUMENTS);
  t.eqI32("suite: documents that load rather than refuse", loaded, YJD_PINNED_LOADS);
  t.eqI32("suite: loadText answers as load(parseYaml(text)) does on every one, and so does the same loader's load after it", differ, 0);
};

const yjdRefusals = (t: Suite): void => {
  const loader = new YamlJsonLoader();
  let bomb = "a: &a [x, x, x, x, x, x, x, x, x, x]\n";
  const names: string[] = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  for (let i: i32 = 1; i < toI32(names.length); i += 1) {
    const p = names[i - 1];
    bomb = `${bomb}${names[i]}: &${names[i]} [*${p}, *${p}, *${p}, *${p}, *${p}, *${p}, *${p}, *${p}, *${p}, *${p}]\n`;
  }
  const doc = new JsonDocument(new JsonLimits());
  t.eqI32("alias bomb: refused", loader.loadText(bomb, 0, doc), YAML_JSON_ERR_EXPANSION);
  t.eqStr("alias bomb: at *f", bomb.substring(loader.errorStart, loader.errorEnd), "*f");
  t.eqI32("alias bomb: nothing kept", doc.top, 0);

  let wide = "c0: &c0 {}\n";
  for (let i: i32 = 1; i <= 40; i += 1) {
    wide = `${wide}c${i}: &c${i} {<<: *c${i - 1}}\n`;
  }
  wide = `${wide}m:\n`;
  for (let i: i32 = 0; i < 500; i += 1) {
    wide = `${wide}  - {<<: *c40}\n`;
  }
  const narrow = new JsonDocument(new JsonLimits());
  narrow.maxValues = 1000;
  t.eqI32("merge budget: refused", loader.loadText(wide, 0, narrow), YAML_JSON_ERR_EXPANSION);
  t.ok("merge budget: at a merge key", wide.substring(loader.errorStart, loader.errorEnd).startsWith("<<: *c"));
  t.ok("merge budget: the default budget loads it", loader.loadText(wide, 0, doc) >= 0);

  let deep = "";
  for (let i: i32 = 0; i < 65; i += 1) {
    deep = `${deep}[`;
  }
  for (let i: i32 = 0; i < 65; i += 1) {
    deep = `${deep}]`;
  }
  t.eqI32("depth: 65 deep is refused", loader.loadText(deep, 0, doc), YAML_JSON_ERR_DEPTH);
  t.eqI32("depth: at the one too deep", loader.errorStart, 64);
  t.ok("depth: 64 deep loads", loader.loadText(deep.substring(1, 129), 0, doc) >= 0);
  loader.maxDepth = 3;
  t.eqI32("depth: an alias copy counts its own depth", loader.loadText("a: &a [[1]]\nb: [*a]\n", 0, doc), YAML_JSON_ERR_DEPTH);
  loader.maxDepth = 64;

  const limits = new JsonLimits();
  limits.maxTotalBytes = 64;
  const capped = new JsonDocument(limits);
  const long = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
  const text = `a: &a ${long}\nb: [*a, *a, *a]\n`;
  t.eqI32("byte cap: copies past maxTotalBytes are refused", loader.loadText(text, 0, capped), YAML_JSON_ERR_EXPANSION);
  t.eqI32("byte cap: at the copy that does not fit", loader.errorStart, toI32(text.indexOf("*a, *a]")));
  t.eqI32("byte cap: nothing kept", capped.top, 0);

  t.eqI32("yaml: a document with an error", loader.loadText("a: [1\n", 0, doc), YAML_JSON_ERR_YAML);
  t.eqI32("document: past the last", loader.loadText("a: 1\n", 1, doc), YAML_JSON_ERR_DOCUMENT);
  t.ok("after a refusal, a load succeeds and clears the code", loader.loadText("a: 1\n", 0, doc) >= 0 && loader.failed === 0);

  // A collection anchored in a key is not built by the sweep. An alias to it
  // must not copy what the same node number held in an earlier text.
  t.ok("reuse: an earlier text loads", loader.loadText("- [7]\n- 8\n", 0, doc) >= 0);
  const keyed = "? &k [9]\n: 1\nz: *k\n";
  const reused = loader.loadText(keyed, 0, doc);
  t.eqStr("reuse: an alias to a collection in a key is built afresh", reused < 0 ? `refused ${reused}` : doc.stringify(reused), '{"[ 9 ]":1,"z":[9]}');
  t.ok("reuse: an earlier merge sequence loads", loader.loadText("- [7]\n- {a: [8]}\n", 0, doc) >= 0);
  const merged = loader.loadText("<<: &s [{p: 1}]\nq: *s\n", 0, doc);
  t.eqStr("reuse: an alias to a merge sequence is built afresh", merged < 0 ? `refused ${merged}` : doc.stringify(merged), '{"q":[{"p":1}],"p":1}');
};

/** Loads document `d` of `text` both ways; they must agree, and when `direct` the direct path must have answered. */
const yjdSame = (t: Suite, loader: YamlJsonLoader, name: string, text: string, d: i32, direct: boolean): void => {
  const doc = new JsonDocument(new JsonLimits());
  const run = yjdRun(loader, doc, text, d);
  if (run.differs !== "") {
    console.log(`DIFFERS ${name}\n${run.differs}`);
  }
  t.ok(`same: ${name}`, run.differs === "");
  if (direct) {
    t.ok(`same: ${name}: built during the parse`, run.root >= 0 && loader.directLoaded);
  }
};

const yjdMerges = (t: Suite): void => {
  const loader = new YamlJsonLoader();
  yjdSame(t, loader, "nested merges, own keys winning", "b: &b {a: 1, b: 2}\nm: &m {<<: *b, b: 3, c: 4}\nx: {<<: *m, c: 5, d: 6}\n", 0, true);
  yjdSame(t, loader, "one map merged twice", "b: &b {a: 1, z: 0}\nc: &c {<<: *b, d: 2}\nx: {<<: [*b, *c], z: 3}\n", 0, true);
  yjdSame(t, loader, "a merge into a map an alias copies", "b: &b {a: 1}\nm: &m {<<: *b, c: 2}\nn: *m\nk: [*m, *m]\n", 0, true);
  yjdSame(t, loader, "a merged value that is an alias", "v: &v [1, {w: 2}]\nb: &b {a: *v}\nm: {<<: *b, e: *v}\n", 0, true);
  let hops = "c0: &c0 {k0: 0}\n";
  let hops99 = "";
  for (let i: i32 = 1; i <= 100; i += 1) {
    if (i === 100) {
      hops99 = hops;
    }
    hops = `${hops}c${i}: &c${i} {<<: *c${i - 1}, k${i}: ${i}}\n`;
  }
  yjdSame(t, loader, "99 merge hops", hops99, 0, true);
  yjdSame(t, loader, "100 merge hops", hops, 0, false);
  const multi = "a: &a [1]\nb: *a\n---\nc: &c {x: 1}\nd: *c\ne: {<<: *c}\n";
  yjdSame(t, loader, "a stream's first document, with an alias", multi, 0, true);
  yjdSame(t, loader, "a stream's second document, with an alias", multi, 1, true);
  yjdSame(t, loader, "plain scalars JSON spells otherwise, and a tagged one", "- +1\n- .5\n- 0x1F\n- !!str 1\n- -.5\n- 0o17\n", 0, true);

  // A merged member's bytes are charged before it is copied.
  const limits = new JsonLimits();
  limits.maxTotalBytes = 64;
  const capped = new JsonDocument(limits);
  const long = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
  const text = `a: &a {p: ${long}}\nb: {<<: *a}\nc: {<<: *a}\n`;
  t.eqI32("byte cap: merged copies past maxTotalBytes are refused", loader.loadText(text, 0, capped), JSON_TOK_ERR_TOTAL_LIMIT);
  t.ok("byte cap: the direct path refused the merge copy before making it", !loader.directLoaded);
  t.eqI32("byte cap: nothing kept after a merge copy", capped.top, 0);
  yjdSame(t, loader, "byte cap: merged copies past maxTotalBytes", text, 0, false);
};

export const main = (): number => {
  const t = new Suite("std/yaml-json loadText");
  yjdSuite(t);
  yjdRefusals(t);
  yjdMerges(t);
  return t.done();
};
