// Every feature of nish/yaml on the smallest input that shows it: how plain
// scalars resolve under the 1.2 core schema, quoting and escapes, block
// scalars and their chomping, properties, aliases, documents and their
// ranges, comments, the options, keyText, paths and the line index.
import {
  YAML_ALIAS,
  YAML_BLOCK,
  YAML_DOUBLE_QUOTED,
  YAML_FLOAT,
  YAML_FLOW,
  YAML_FOLDED,
  YAML_INT,
  YAML_LITERAL,
  YAML_MAP,
  YAML_PAIR,
  YAML_PLAIN,
  YAML_SCALAR,
  YAML_SEQ,
  YAML_SINGLE_QUOTED,
  YamlOptions,
  YamlStream,
  keyText,
  parseYaml,
  parseYamlWith,
  pathMatch,
  pathNode,
  pathPair,
} from "../../../std/yaml";
import { YamlLineIndex } from "../../../std/yaml-lines";
import { Suite } from "../../../std/testing";
import { ytFlow, ytRanges, ytRangesOf, ytScalar, ytShow } from "./common";

/** Checks that plain or quoted `text` resolves to `want`, as `ytScalar` writes it. */
const ytResolves = (t: Suite, text: string, want: string): void => {
  t.eqStr(`resolves ${ytShow(text)}`, ytScalar(text), want);
};

/** Checks that block scalar `text` decodes to `want`, quietly. */
const ytBlock = (t: Suite, text: string, want: string): void => {
  const stream = parseYaml(text);
  t.eqStr(`block ${ytShow(text)}`, stream.text(stream.documentRoot(0)), want);
  t.eqStr(`block ${ytShow(text)} is quiet`, ytRangesOf(text), "");
};

const ytScalarUnits = (t: Suite): void => {
  ytResolves(t, "~", "null <~>");
  ytResolves(t, "null", "null <null>");
  ytResolves(t, "Null", "null <Null>");
  ytResolves(t, "NULL", "null <NULL>");
  ytResolves(t, "nULL", "string <nULL>");
  ytResolves(t, "true", "bool <true>");
  ytResolves(t, "False", "bool <False>");
  ytResolves(t, "yes", "string <yes>");
  ytResolves(t, "0", "int <0>");
  ytResolves(t, "-12", "int <-12>");
  ytResolves(t, "+7", "int <+7>");
  ytResolves(t, "0o17", "int <0o17>");
  ytResolves(t, "0x1F", "int <0x1F>");
  ytResolves(t, "007", "int <007>");
  ytResolves(t, "0x", "string <0x>");
  ytResolves(t, "1_000", "string <1_000>");
  ytResolves(t, "0b11", "string <0b11>");
  ytResolves(t, "1.5", "float <1.5>");
  ytResolves(t, ".5", "float <.5>");
  ytResolves(t, "0.", "float <0.>");
  ytResolves(t, "1e3", "float <1e3>");
  ytResolves(t, "-1.5e-3", "float <-1.5e-3>");
  ytResolves(t, "-.inf", "float <-.inf>");
  ytResolves(t, "+.inf", "float <+.inf>");
  ytResolves(t, ".Inf", "float <.Inf>");
  ytResolves(t, ".NaN", "float <.NaN>");
  ytResolves(t, "1:2", "string <1:2>");
  ytResolves(t, "a b  c", "string <a b  c>");
  ytResolves(t, "'1'", "string <1>");
  ytResolves(t, "'it''s'", "string <it's>");
  ytResolves(t, "\"x\\u00e9\\n\"", "string <x\u00e9\n>");
  ytResolves(t, "\"\\x41\\t\\\"\"", "string <A\t\">");
  ytResolves(t, "!!str 12", "string <12>");
  ytResolves(t, "!!int \"3\"", "int <3>");
  ytResolves(t, "!!float 1", "float <1>");
  ytResolves(t, "!!null ''", "null <>");
  ytResolves(t, "!custom x", "string <x>");
  ytResolves(t, "a\n b\n\n c\n", "string <a b\nc>");
  ytResolves(t, "'a\n  b\n\n  c'\n", "string <a b\nc>");
  ytResolves(t, "\"a\\\n  b\"\n", "string <ab>");
  ytBlock(t, "|\n a\n b\n", "a\nb\n");
  ytBlock(t, "|-\n a\n\n", "a");
  ytBlock(t, "|+\n a\n\n", "a\n\n");
  ytBlock(t, "|\n a\n\n", "a\n");
  ytBlock(t, ">\n a\n b\n\n c\n", "a b\nc\n");
  ytBlock(t, ">\n a\n  b\n c\n", "a\n b\nc\n");
  ytBlock(t, ">-\n a\n b\n", "a b");
  ytBlock(t, "|2\n   a\n", " a\n");
  ytBlock(t, "|1\n  a\n", " a\n");
  ytBlock(t, "|\n", "");
  ytBlock(t, "|\n  a\n   b\n", "a\n b\n");

  const values = parseYaml("[0o17, 0x1F, -12, 9223372036854775807, 9223372036854775808, 1.5, -.inf, .nan, true, false, x]\n");
  const seq: i32 = values.documentRoot(0);
  t.eqI32("eleven items", values.count(seq), 11);
  t.eqI64("0o17 is 15", values.intValue(values.child(seq, 0)), toI64(15));
  t.eqI64("0x1F is 31", values.intValue(values.child(seq, 1)), toI64(31));
  t.eqI64("-12", values.intValue(values.child(seq, 2)), toI64(0) - toI64(12));
  t.eqStr("i64 max", `${values.intValue(values.child(seq, 3))}`, "9223372036854775807");
  t.eqStr("past i64 max wraps", `${values.intValue(values.child(seq, 4))}`, "-9223372036854775808");
  t.eqF64("1.5", values.floatValue(values.child(seq, 5)), toF64(3) / toF64(2));
  t.ok("-.inf is minus infinity", values.floatValue(values.child(seq, 6)) < toF64(-1e308));
  const nan: f64 = values.floatValue(values.child(seq, 7));
  t.ok(".nan is not a number", nan !== nan);
  t.eqF64("an int as a float", values.floatValue(values.child(seq, 0)), toF64(15));
  t.eqBool("true", values.boolValue(values.child(seq, 8)), true);
  t.eqBool("false", values.boolValue(values.child(seq, 9)), false);
  t.eqBool("a string is not true", values.boolValue(values.child(seq, 10)), false);
  t.eqI64("a string's int is 0", values.intValue(values.child(seq, 10)), toI64(0));

  const styles = parseYaml("- a\n- 'b'\n- \"c\"\n- |\n  d\n- >\n  e\n- [f]\n- {g: h}\n");
  const list: i32 = styles.documentRoot(0);
  const want: i32[] = [YAML_PLAIN, YAML_SINGLE_QUOTED, YAML_DOUBLE_QUOTED, YAML_LITERAL, YAML_FOLDED, YAML_FLOW, YAML_FLOW];
  t.eqI32("a block seq", styles.style(list), YAML_BLOCK);
  let k: i32 = 0;
  while (k >= 0 && k < toI32(want.length)) {
    t.eqI32(`style of item ${k}`, styles.style(styles.child(list, k)), want[k]);
    k += 1;
  }
};

const ytNodeUnits = (t: Suite): void => {
  const text = "key: [1, two]\nnested:\n  - &a x\n  - *a\n";
  const stream = parseYaml(text);
  const root: i32 = stream.documentRoot(0);
  t.eqI32("the root is a map", stream.kind(root), YAML_MAP);
  t.eqI32("of two pairs", stream.count(root), 2);
  const first: i32 = stream.child(root, 0);
  t.eqI32("a child of a map is a pair", stream.kind(first), YAML_PAIR);
  t.eqStr("its key", stream.text(stream.key(first)), "key");
  const value: i32 = stream.value(first);
  t.eqI32("its value is a seq", stream.kind(value), YAML_SEQ);
  t.eqI32("the flow seq starts at its [", stream.start(value), 5);
  t.eqI32("and ends past its ]", stream.end(value), 13);
  t.eqStr("its second item", stream.text(stream.child(value, 1)), "two");
  t.eqI32("past the last child", stream.child(value, 2), -1);
  t.eqI32("an item is a scalar", stream.kind(stream.child(value, 0)), YAML_SCALAR);
  t.eqI32("a scalar has no children", stream.count(stream.child(value, 0)), 0);
  t.eqI32("a scalar's start", stream.start(stream.child(value, 1)), 9);
  const items: i32 = stream.value(stream.child(root, 1));
  const anchored: i32 = stream.child(items, 0);
  const alias: i32 = stream.child(items, 1);
  t.eqStr("an anchor", stream.anchor(anchored), "a");
  t.eqI32("a node's range leaves its properties out", stream.start(anchored), 29);
  t.eqI32("an alias", stream.kind(alias), YAML_ALIAS);
  t.eqI32("names its anchor", stream.target(alias), anchored);
  t.eqI32("resolved follows it", stream.resolved(alias), anchored);
  t.eqI32("resolved leaves a scalar", stream.resolved(anchored), anchored);
  t.eqI32("a scalar is no alias", stream.target(anchored), -1);
  t.eqI32("a handle that is no node", stream.kind(-1), 0);
  t.eqI32("a pair's key of a non-pair", stream.key(root), -1);

  const tags = parseYaml("- !!str 12\n- !custom x\n- !<tag:x,1:y> z\n- plain\n");
  const tagged: i32 = tags.documentRoot(0);
  t.eqStr("!!str is the core tag", tags.tag(tags.child(tagged, 0)), "str");
  t.eqI32("a tagged node's range is its text", tags.start(tags.child(tagged, 0)), 8);
  t.eqStr("a local tag", tags.tag(tags.child(tagged, 1)), "!custom");
  t.eqStr("a verbatim tag", tags.tag(tags.child(tagged, 2)), "tag:x,1:y");
  t.eqStr("no tag", tags.tag(tags.child(tagged, 3)), "");
  const hex = parseYaml("[!!int 0x10]\n");
  t.eqI32("an int tag makes an int", hex.type(hex.child(hex.documentRoot(0), 0)), YAML_INT);
  t.eqI32("a float tag makes a float", parseYaml("!!float 2\n").type(0), YAML_FLOAT);

  t.eqI32("an empty text has no documents", parseYaml("").documentCount(), 0);
  t.eqI32("nor does a comment", parseYaml("# c\n").documentCount(), 0);
  const empty = parseYaml("a:\n");
  t.eqStr("an empty value reads as null", ytFlow("a:\n"), "{ a: null }");
  t.eqI32("an empty value is no node", empty.value(empty.child(empty.documentRoot(0), 0)), -1);
};

const ytDocumentUnits = (t: Suite): void => {
  const text = "# head\n%YAML 1.2\n---\na: 1 # c1\n...\n---\n- x\n--- y\n...\n";
  const options = new YamlOptions();
  options.keepComments = true;
  const stream: YamlStream = parseYamlWith(text, options);
  t.eqStr("three documents, quietly", ytRanges(text, options), "");
  t.eqI32("three documents", stream.documentCount(), 3);
  const ranges: i32[] = [17, 34, 35, 42, 43, 52];
  let d: i32 = 0;
  while (d >= 0 && d < 3 && d * 2 + 1 < toI32(ranges.length)) {
    t.eqI32(`document ${d} starts at its ---`, stream.documentStart(d), ranges[d * 2]);
    t.eqI32(`document ${d} ends past its ...`, stream.documentEnd(d), ranges[d * 2 + 1]);
    d += 1;
  }
  t.eqI32("past the last document", stream.documentRoot(3), -1);
  t.eqI32("two comments", stream.commentCount(), 2);
  t.eqStr("a comment's text drops its #", stream.comment(0), " head");
  t.eqI32("its start is the #", stream.commentStart(0), 0);
  t.eqI32("its end is the line's", stream.commentEnd(0), 6);
  t.eqStr("a trailing comment", stream.comment(1), " c1");
  t.eqI32("starts at its #", stream.commentStart(1), 26);
  t.eqI32("comments are not kept by default", parseYaml(text).commentCount(), 0);
  t.eqStr("a bare document", ytFlow("a: 1\n"), "{ a: 1 }");
  const bom = parseYaml("\uFEFFa: 1\n");
  t.eqStr("a byte order mark is skipped", ytFlow("\uFEFFa: 1\n"), "{ a: 1 }");
  t.eqI32("and is quiet", bom.diagnosticCount(), 0);
  t.eqI32("a diagnostic names its document", parseYaml("a\n--- *x\n").diagnosticDocument(0), 1);
};

const ytOptionUnits = (t: Suite): void => {
  const loose = new YamlOptions();
  loose.uniqueKeys = false;
  t.eqStr("uniqueKeys off", ytRanges("a: 1\na: 2\n", loose), "");
  t.eqStr("<< repeats as a merge key", ytRangesOf("<<: {a: 1}\n<<: {b: 2}\n"), "");
  const strict = new YamlOptions();
  strict.merge = false;
  t.eqStr("without merge, << is a plain key", ytRanges("<<: {a: 1}\n<<: {b: 2}\n", strict), "DUPLICATE_KEY@11..13");
  t.eqStr("a quoted key matches a plain one", ytRangesOf("a: 1\n'a': 2\n"), "DUPLICATE_KEY@5..8");
  t.eqStr("1 and 01 are different keys", ytRangesOf("1: a\n01: b\n"), "");
  t.eqStr("null and ~ are the same key", ytRangesOf("null: a\n~: b\n"), "DUPLICATE_KEY@8..9");
  t.eqStr("equal flow keys", ytRangesOf("? [a, b]\n: 1\n? [a, b]\n: 2\n"), "DUPLICATE_KEY@15..21");
  const many: string[] = [];
  let i: i32 = 0;
  while (i < 40) {
    many.push(`k${i}: ${i}\n`);
    i += 1;
  }
  many.push("k7: again\n");
  const hashed = parseYaml(many.join(""));
  t.eqI32("a big map hashes its keys and still finds the repeat", hashed.errorCount(), 1);
  t.eqStr("the hashed check names it", hashed.diagnosticMessage(0), "Map key \"k7\" is duplicated");
};

const ytKeyTextUnits = (t: Suite): void => {
  const stream = parseYaml("? [ a, {b: c} ]\n: 1\n? *x\n: 2\n1.50: 3\n!!str k: 4\n\"\\x41\": 5\n? |\n  lit\n: 6\n~: 7\n");
  const root: i32 = stream.documentRoot(0);
  const want: string[] = ["[ a, { b: c } ]", "*x", "1.50", "k", "A", "lit\n", ""];
  let i: i32 = 0;
  while (i >= 0 && i < toI32(want.length)) {
    const expected: string = want[i];
    t.eqStr(`keyText ${i}`, keyText(stream, stream.key(stream.child(root, i))), expected);
    i += 1;
  }
  const deep: string[] = [];
  let n: i32 = 0;
  while (n < 3000) {
    deep.push("word");
    n += 1;
  }
  const long = parseYaml(`? [${deep.join(", ")}]\n: 1\n`);
  const cut: string = keyText(long, long.key(long.child(long.documentRoot(0), 0)));
  t.ok("a long key is cut", toI32(cut.length) < 4200);
  t.ok("with an ellipsis", cut.endsWith("…"));
};

const ytPathUnits = (t: Suite): void => {
  const stream = parseYaml("a:\n  b: [x, {c: d}]\n  1: one\n  null: n\n'q': z\nr: &r {s: 1}\nt: *r\n");
  const root: i32 = stream.documentRoot(0);
  const paths: string[][] = [["a", "b", "1", "c"], ["a", "1"], ["a", "null"], ["a", ""], ["q"], ["t", "s"]];
  const found: string[] = ["d", "one", "n", "n", "z", "1"];
  let i: i32 = 0;
  while (i >= 0 && i < toI32(paths.length) && i < toI32(found.length)) {
    const path: string[] = paths[i];
    const expected: string = found[i];
    t.eqStr(`path ${path.join("/")}`, stream.text(pathNode(stream, root, path)), expected);
    t.eqI32(`path ${path.join("/")} matches every step`, pathMatch(stream, root, path), toI32(path.length));
    i += 1;
  }
  t.eqI32("an empty path names the root", pathNode(stream, root, []), root);
  t.eqI32("and no pair", pathPair(stream, root, []), -1);
  const ab: string[] = ["a", "b"];
  t.eqI32("pathPair gives the pair stepped through", pathPair(stream, root, ab), stream.child(stream.value(stream.child(root, 0)), 0));
  t.eqI32("a step past the end matches less", pathMatch(stream, root, ["a", "b", "2"]), 2);
  t.eqI32("and pathNode stops at the deepest node reached", pathNode(stream, root, ["a", "b", "2"]), stream.value(pathPair(stream, root, ab)));
  t.eqI32("a missing key matches nothing", pathMatch(stream, root, ["zz"]), 0);
  t.eqI32("a key step on a seq does not match", pathMatch(stream, root, ["a", "b", "x"]), 2);
  t.eqI32("a negative index does not match", pathMatch(stream, root, ["a", "b", "-1"]), 2);
};

const ytLineUnits = (t: Suite): void => {
  const lines = new YamlLineIndex("a\nbc\r\nd\re");
  t.eqI32("LF, CRLF and CR are each one break", lines.lineCount(), 4);
  t.eqI32("line of 0", lines.line(0), 1);
  t.eqI32("line of 3", lines.line(3), 2);
  t.eqI32("column of 3", lines.column(3), 2);
  t.eqI32("line of 6", lines.line(6), 3);
  t.eqI32("line of 8", lines.line(8), 4);
  t.eqI32("the end has a position", lines.column(9), 2);
  t.eqI32("a negative offset clamps", lines.line(-5), 1);
  t.eqI32("lineStart", lines.lineStart(3), 6);
  t.eqI32("lineStart clamps", lines.lineStart(99), 8);
  t.eqI32("byteColumn", lines.byteColumn(4), 3);
  t.eqI32("an empty text has one line", new YamlLineIndex("").lineCount(), 1);
};

export const ytUnits = (t: Suite): void => {
  ytScalarUnits(t);
  ytNodeUnits(t);
  ytDocumentUnits(t);
  ytOptionUnits(t);
  ytKeyTextUnits(t);
  ytPathUnits(t);
  ytLineUnits(t);
};
