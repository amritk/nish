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
  ytBlock(t, ">+\n a\n b\n\n", "a b\n\n");
  ytBlock(t, "|\n \t\n x\n", "\t\nx\n");
  ytBlock(t, "|\r\n  l1\r\n  l2\r\n", "l1\nl2\n");
  ytBlock(t, "|\r  l1\r  l2\r", "l1\nl2\n");
  const emptyBlock = parseYaml("a: |\nb: 1\n");
  const emptyValue: i32 = emptyBlock.value(emptyBlock.child(emptyBlock.documentRoot(0), 0));
  t.eqStr("an empty block scalar ends at its header", `${emptyBlock.start(emptyValue)}..${emptyBlock.end(emptyValue)}`, "3..4");
  t.eqStr("and is empty", emptyBlock.text(emptyValue), "");
  const commented = parseYaml("a: |  # c\n");
  const commentedValue: i32 = commented.value(commented.child(commented.documentRoot(0), 0));
  t.eqStr("its header's comment is not part of it", `${commented.start(commentedValue)}..${commented.end(commentedValue)}`, "3..4");
  t.eqStr("a document marker ends a block scalar of blank lines", ytRangesOf("--- |\n  \n---\n"), "");
  t.eqI32("and starts the next document", parseYaml("--- |\n  \n---\n").documentCount(), 2);
  t.eqStr("so does a document end", ytRangesOf("--- >\n\n  \n...\n"), "");
  const crlf = "a: x\r\nb: 'y\r\n  z'\r\n# c\r\nd: \"p\r\n  q\"\r\ne: f\r\n  g\r\n";
  t.eqStr("CR LF breaks in every scalar style and a comment", ytFlow(crlf), "{ a: x, b: y z, d: p q, e: f g }");
  t.eqStr("are quiet", ytRangesOf(crlf), "");
  const cr = "a: x\rb: 'y\r  z'\r# c\rd: \"p\r  q\"\re: f\r  g\r";
  t.eqStr("a lone CR is a break too", ytFlow(cr), "{ a: x, b: y z, d: p q, e: f g }");
  t.eqStr("and is quiet", ytRangesOf(cr), "");
  t.eqStr("a surrogate pair escape is one character", ytScalar("\"\\ud83d\\ude00\""), "string <😀>");
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
  const verbatim = parseYaml("[ !<tag:yaml.org,2002:str> a, !<x,y> b ]\n");
  const flowSeq: i32 = verbatim.documentRoot(0);
  t.eqStr("a verbatim tag in a flow seq keeps its comma", verbatim.tag(verbatim.child(flowSeq, 0)), "str");
  t.eqStr("and its next item", verbatim.tag(verbatim.child(flowSeq, 1)), "x,y");
  t.eqStr("a verbatim tag in a flow seq is quiet", ytRangesOf("[ !<tag:yaml.org,2002:str> a ]\n"), "");
  t.eqStr("a verbatim tag on a flow key", ytFlow("{ !<x,y> k: v }\n"), "{ k: v }");
  t.eqStr("a verbatim tag on a flow key is quiet", ytRangesOf("{ !<x,y> k: v }\n"), "");
  const named = parseYaml("%TAG !e! tag:example.com,2000:\n--- !e!x 1\n");
  t.eqStr("a %TAG handle resolves", named.tag(named.documentRoot(0)), "tag:example.com,2000:x");
  t.eqI32("a %TAG handle is quiet", named.diagnosticCount(), 0);
  const hex = parseYaml("[!!int 0x10]\n");
  t.eqI32("an int tag makes an int", hex.type(hex.child(hex.documentRoot(0), 0)), YAML_INT);
  t.eqI32("a float tag makes a float", parseYaml("!!float 2\n").type(parseYaml("!!float 2\n").documentRoot(0)), YAML_FLOAT);

  t.eqI32("an empty text has no documents", parseYaml("").documentCount(), 0);
  t.eqI32("nor does a comment", parseYaml("# c\n").documentCount(), 0);
  const empty = parseYaml("a:\n");
  t.eqStr("an empty value reads as null", ytFlow("a:\n"), "{ a: null }");
  t.eqI32("an empty value is no node", empty.value(empty.child(empty.documentRoot(0), 0)), -1);
  t.eqStr("a single pair in a flow seq is a map", ytFlow("[k: v]\n"), "[ { k: v } ]");
  t.eqStr("a single pair is quiet", ytRangesOf("[k: v]\n"), "");
  const spread = "{a: [1,\n  2],\n b: c}\n";
  t.eqStr("a flow collection across lines", ytFlow(spread), "{ a: [ 1, 2 ], b: c }");
  t.eqStr("a flow collection across lines is quiet", ytRangesOf(spread), "");
  const wide: string[] = [];
  let w: i32 = 0;
  while (w < 5000) {
    wide.push(`k${w} : ${w}`);
    w += 1;
  }
  const line = parseYaml(`[${wide.join(", ")}]\n`);
  t.eqI32("a long flow line of single pairs", line.count(line.documentRoot(0)), 5000);
  t.eqI32("parses quietly", line.diagnosticCount(), 0);
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
  t.eqStr("~ and !!str ~ are different keys", ytRangesOf("~: 1\n!!str ~: 2\n"), "");
  t.eqStr("null and !!str null are different keys", ytRangesOf("null: 1\n!!str null: 2\n"), "");
  t.eqStr("two !!str ~ keys are the same key", ytRangesOf("!!str ~: 1\n!!str ~: 2\n"), "DUPLICATE_KEY@17..18");
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
  const paths: string[][] = [["a", "b", "1", "c"], ["a", "1"], ["a", ""], ["q"], ["t", "s"]];
  const found: string[] = ["d", "one", "n", "z", "1"];
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
  t.eqI32("a null key is matched by \"\" only, not ~", pathMatch(stream, root, ["a", "~"]), 1);
  t.eqI32("nor null", pathMatch(stream, root, ["a", "null"]), 1);
  t.eqI32("an index has no leading zero", pathMatch(stream, root, ["a", "b", "01"]), 2);
  t.eqI32("nor 00", pathMatch(stream, root, ["a", "b", "00"]), 2);
  const aliased: i32 = pathNode(stream, root, ["t"]);
  t.eqI32("a path ending on an alias names the alias", stream.kind(aliased), YAML_ALIAS);
  t.eqI32("which resolves to the anchored node", stream.resolved(aliased), pathNode(stream, root, ["r"]));
  const ranged = parseYaml("a:\n  bb: 1\n");
  const bb: i32 = pathPair(ranged, ranged.documentRoot(0), ["a", "bb"]);
  t.eqI32("pathPair's key starts at the key", ranged.start(ranged.key(bb)), 5);
  t.eqI32("and ends past it", ranged.end(ranged.key(bb)), 7);
  const twice = parseYaml("a: 1\na: 2\n");
  const twiceRoot: i32 = twice.documentRoot(0);
  t.eqStr("the last duplicate key wins", twice.text(pathNode(twice, twiceRoot, ["a"])), "2");
  t.eqI32("its pair", twice.start(twice.key(pathPair(twice, twiceRoot, ["a"]))), 5);
  const multi = parseYaml("? a\n  b\n: v\n");
  t.eqI32("a key across lines matches its folded text", pathMatch(multi, multi.documentRoot(0), ["a b"]), 1);
  t.eqI32("not its first line", pathMatch(multi, multi.documentRoot(0), ["a"]), 0);
  const blank = parseYaml("a:\n");
  const blankRoot: i32 = blank.documentRoot(0);
  t.eqI32("a step onto an empty value matches", pathMatch(blank, blankRoot, ["a"]), 1);
  t.eqI32("names its pair", pathPair(blank, blankRoot, ["a"]), blank.child(blankRoot, 0));
  t.eqI32("and no node", pathNode(blank, blankRoot, ["a"]), -1);
  const loop = parseYaml("l: &l [*l]\n");
  t.eqI32("an alias to its own unfinished anchor stops the walk at the unresolved alias", pathMatch(loop, loop.documentRoot(0), ["l", "0", "0", "0"]), 2);
};

/** The text of the node `path` names below the first document of `text`, merging; `"-"` for an empty value. */
const ytMergedText = (text: string, path: string[]): string => {
  const stream = parseYaml(text);
  const node: i32 = pathNode(stream, stream.documentRoot(0), path);
  return node < 0 ? "-" : stream.text(node);
};

const ytMergeUnits = (t: Suite): void => {
  const base = "base: &b {x: 1, y: 2}\n";
  t.eqStr("an alias to a map merges", ytMergedText(`${base}m: {<<: *b, z: 3}\n`, ["m", "x"]), "1");
  t.eqStr("a map merges", ytMergedText("m:\n  <<: {x: 1}\n", ["m", "x"]), "1");
  t.eqStr("a sequence of maps merges", ytMergedText("m:\n  <<: [{x: 1}, {y: 2}]\n", ["m", "y"]), "2");
  t.eqStr("a sequence of aliases merges", ytMergedText(`${base}c: &c {w: 4}\nm:\n  <<: [*c, *b]\n`, ["m", "y"]), "2");
  t.eqStr("the map's own key wins", ytMergedText(`${base}m:\n  x: own\n  <<: *b\n`, ["m", "x"]), "own");
  t.eqStr("whether before or after the merge key", ytMergedText(`${base}m:\n  <<: *b\n  x: own\n`, ["m", "x"]), "own");
  t.eqStr("the first map listed wins", ytMergedText("m:\n  <<: [{x: first}, {x: second}]\n", ["m", "x"]), "first");
  t.eqStr("so does the first merge key", ytMergedText("m:\n  <<: {x: first}\n  <<: {x: second}\n", ["m", "x"]), "first");
  t.eqStr("a merged map's own merge keys merge too", ytMergedText("a: &a {x: 1}\nb: &b {<<: *a}\nm: {<<: *b}\n", ["m", "x"]), "1");
  t.eqStr("searched depth first", ytMergedText("a: &a {x: deep}\nb: &b {<<: *a}\nm: {<<: [*b, {x: flat}]}\n", ["m", "x"]), "deep");
  t.eqStr("a path keeps walking below a merged key", ytMergedText("a: &a {x: {y: 5}}\nm: {<<: *a}\n", ["m", "x", "y"]), "5");
  t.eqStr("a << step names the merge value itself", ytMergedText("m: {<<: {x: 1}}\n", ["m", "<<", "x"]), "1");
  const missing = parseYaml(`${base}m: {<<: *b}\n`);
  t.eqI32("a missing key is still missing", pathMatch(missing, missing.documentRoot(0), ["m", "q"]), 1);
  const text = "base: &b\n  x: 1\nm:\n  <<: *b\n";
  const stream = parseYaml(text);
  const root: i32 = stream.documentRoot(0);
  const pair: i32 = pathPair(stream, root, ["m", "x"]);
  t.eqI32("pathPair names the pair inside the merged map", pair, pathPair(stream, root, ["base", "x"]));
  const lines = new YamlLineIndex(text);
  const node: i32 = pathNode(stream, root, ["m", "x"]);
  t.eqStr("at the merged key's line and column", `${lines.line(stream.start(node))}:${lines.column(stream.start(node))}`, "2:6");
  t.eqI32("every step matches", pathMatch(stream, root, ["m", "x"]), 2);
  const loop = parseYaml("a: &a\n  <<: *a\n  x: 1\nm:\n  <<: *a\n");
  t.eqI32("a recursive alias in a merge ends the walk", pathMatch(loop, loop.documentRoot(0), ["m", "q"]), 1);
  t.eqStr("and still finds what is there", ytMergedText("a: &a\n  <<: *a\n  x: 1\nm:\n  <<: *a\n", ["m", "x"]), "1");
  const cycle = parseYaml("a: &a {b: &b {<<: *a}, <<: *b}\n");
  t.eqI32("a cycle through two maps ends the walk", pathMatch(cycle, cycle.documentRoot(0), ["a", "q"]), 1);
  const scalar = parseYaml("m: {<<: 1}\n");
  t.eqI32("a scalar merges nothing", pathMatch(scalar, scalar.documentRoot(0), ["m", "x"]), 1);
  const off = new YamlOptions();
  off.merge = false;
  const plain = parseYamlWith("m:\n  <<: {x: 1}\n", off);
  const plainRoot: i32 = plain.documentRoot(0);
  t.eqI32("without merge, a path does not look in <<", pathMatch(plain, plainRoot, ["m", "x"]), 1);
  t.eqI32("and << is an ordinary key", pathMatch(plain, plainRoot, ["m", "<<", "x"]), 3);
  const quoted = parseYaml("m: {'<<': {x: 1}}\n");
  t.eqI32("a quoted << is not a merge key", pathMatch(quoted, quoted.documentRoot(0), ["m", "x"]), 1);
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
  const wideChars = new YamlLineIndex("é😀x");
  t.eqI32("a column counts characters", wideChars.column(6), 3);
  t.eqI32("a byteColumn counts bytes", wideChars.byteColumn(6), 7);
};

export const ytUnits = (t: Suite): void => {
  ytScalarUnits(t);
  ytNodeUnits(t);
  ytDocumentUnits(t);
  ytOptionUnits(t);
  ytKeyTextUnits(t);
  ytPathUnits(t);
  ytMergeUnits(t);
  ytLineUnits(t);
};
