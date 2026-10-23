// Every diagnostic code but BAD_MERGE (merge keys are not applied, so nothing
// reports it yet), each on the smallest input that reaches it: the code, its
// kind (`~` marks a warning) and its exact byte range, then the
// `line:col kind CODE message` form a person reads.
import { YamlOptions, YamlStream, parseYamlWith } from "../../../std/yaml";
import { Suite } from "../../../std/testing";
import { ytDiagnostics, ytDiagnosticsOf, ytRanges, ytRangesOf, ytShow } from "./common";

/** Checks that `text` reports `want`, as `ytRanges` writes it. */
const ytCase = (t: Suite, text: string, want: string): void => {
  t.eqStr(`ranges of ${ytShow(text)}`, ytRangesOf(text), want);
};

/** `text` parsed with `maxDepth` of `depth`. */
const ytAtDepth = (text: string, depth: i32): string => {
  const options = new YamlOptions();
  options.maxDepth = depth;
  return ytRanges(text, options);
};

export const ytNegatives = (t: Suite): void => {
  ytCase(t, "a: &x: 1\n", "~AMBIGUOUS_ANCHOR_NAME@3..6");
  ytCase(t, "a: & 1\n", "BAD_ANCHOR@3..4");
  ytCase(t, "a: |x\n  b\n", "BAD_BLOCK_HEADER@4..5");
  ytCase(t, "a: |--\n  b\n", "BAD_BLOCK_HEADER@5..6");
  ytCase(t, "a: |12\n  b\n", "BAD_BLOCK_HEADER@5..6");
  ytCase(t, "a: |#c\n  b\n", "BAD_BLOCK_HEADER@4..6");
  ytCase(t, "[1,#c\n]\n", "BAD_COMMENT@3..5");
  ytCase(t, "%TAG !x\n--- 1\n", "~BAD_DIRECTIVE@0..7");
  ytCase(t, "%YAML 1.x\n--- 1\n", "BAD_DIRECTIVE@0..9");
  ytCase(t, "%YAML 1.2 x\n--- 1\n", "BAD_DIRECTIVE@10..11");
  ytCase(t, "\"\\q\"\n", "BAD_ESCAPE@1..3");
  ytCase(t, "\"\\x4\"\n", "BAD_ESCAPE@1..4");
  ytCase(t, "\"\\U00110000\"\n", "BAD_ESCAPE@1..11");
  ytCase(t, "\"a\nb\": 1\n", "BAD_IMPLICIT_KEY@0..5");
  ytCase(t, "a:\n  \"x\ny\"\n", "BAD_INDENT@8..8");
  ytCase(t, "a: |\n    \n  x\n", "BAD_INDENT@10..12");
  ytCase(t, "a:\n  - [1,\n  2]\n", "BAD_INDENT@11..13");
  ytCase(t, "&a &b x\n", "BAD_PROPERTY@3..5");
  ytCase(t, "!x !y x\n", "BAD_PROPERTY@3..5");
  ytCase(t, "&a ? x\n: y\n", "BAD_PROPERTY@3..4");
  ytCase(t, "&a *b\n", "UNRESOLVED_ALIAS@3..5 BAD_PROPERTY@3..5");
  ytCase(t, "a: b: c\n", "BAD_SCALAR_CONTENT@4..5");
  ytCase(t, "a\n: 1\n", "BAD_SCALAR_CONTENT@2..3");
  ytCase(t, "[- x]\n", "BAD_SCALAR_START@1..2");
  ytCase(t, "@x\n", "BAD_SCALAR_START@0..1");
  ytCase(t, "!<x 1\n", "BAD_TAG@0..3");
  ytCase(t, "!x{ 1\n", "BAD_TAG@0..3");
  ytCase(t, "!!map x\n", "~BAD_TAG_VALUE@6..7");
  ytCase(t, "!!int x\n", "~BAD_TAG_VALUE@6..7");
  ytCase(t, "!!str &a\n- x\n", "~BAD_TAG_VALUE@9..12");
  ytCase(t, "%TAG !e! x:\n%TAG !e! y:\n--- 1\n", "~DUPLICATE_DIRECTIVE@12..23");
  ytCase(t, "%YAML 1.2\n%YAML 1.2\n--- 1\n", "DUPLICATE_DIRECTIVE@10..19");
  ytCase(t, "a: 1\na: 2\n", "DUPLICATE_KEY@5..6");
  ytCase(t, "&a [*a]\n", "RECURSIVE_ALIAS@4..6");
  ytCase(t, "a:\n\t- b\n", "TAB_INDENT@3..4");
  ytCase(t, "[1,,2]\n", "UNEXPECTED_COMMA@3..4");
  ytCase(t, "'x' y\n", "UNEXPECTED_CONTENT@4..5");
  ytCase(t, "a: - b\n", "UNEXPECTED_CONTENT@3..4");
  ytCase(t, "[1,\n---\n]\n", "UNEXPECTED_CONTENT@4..7");
  ytCase(t, "... x\n", "UNEXPECTED_CONTENT@4..5");
  ytCase(t, "--- a: 1\n", "UNEXPECTED_CONTENT@4..8");
  ytCase(t, "'a'\n'b'\n", "UNEXPECTED_CONTENT@4..7");
  ytCase(t, "%YAML 1.2\n", "UNEXPECTED_DIRECTIVE@10..10");
  ytCase(t, "%FOO bar\n--- 1\n", "~UNKNOWN_DIRECTIVE@0..4");
  ytCase(t, "!e!x 1\n", "UNKNOWN_TAG_HANDLE@0..4");
  ytCase(t, "*nope\n", "UNRESOLVED_ALIAS@0..5");
  ytCase(t, "%YAML 1.1\n--- 1\n", "~UNSUPPORTED_YAML_VERSION@0..9");
  ytCase(t, "%YAML 2.0\n--- 1\n", "~UNSUPPORTED_YAML_VERSION@0..9");
  ytCase(t, "{a: 1\n", "UNTERMINATED_FLOW@0..6");
  ytCase(t, "[1, 2\n", "UNTERMINATED_FLOW@0..6");
  ytCase(t, "'abc\n", "UNTERMINATED_QUOTE@0..5");
  ytCase(t, "a: 'x\n", "UNTERMINATED_QUOTE@3..6");

  const first = new YamlOptions();
  first.firstDocumentOnly = true;
  t.eqStr("MULTIPLE_DOCUMENTS warns at the second marker", ytRanges("a\n---\nb\n--- c\n", first), "~MULTIPLE_DOCUMENTS@2..5");
  const only: YamlStream = parseYamlWith("a\n---\nb\n--- c\n", first);
  t.eqI32("firstDocumentOnly keeps one document", only.documentCount(), 1);
  t.eqStr("firstDocumentOnly with one document is quiet", ytRanges("a\n...\n", first), "");

  t.eqStr("DEPTH_LIMIT at the third flow level", ytAtDepth("[[[1]]]\n", 2), "DEPTH_LIMIT@2..2");
  t.eqStr("DEPTH_LIMIT at the third block level", ytAtDepth("a:\n b:\n  c: 1\n", 2), "DEPTH_LIMIT@9..9");
  t.eqStr("scalars do not count toward maxDepth", ytAtDepth("[[1]]\n", 2), "");
  t.eqStr("maxDepth 1 allows one collection", ytAtDepth("a: 1\n", 1), "");
  t.eqStr("maxDepth 1 stops a nested one", ytAtDepth("- [1]\n", 1), "DEPTH_LIMIT@2..2");

  t.eqStr("the message form of DUPLICATE_KEY", ytDiagnosticsOf("a: 1\na: 2\n"), "2:1 error DUPLICATE_KEY Map key \"a\" is duplicated\n");
  t.eqStr("the message form of a warning", ytDiagnosticsOf("%FOO bar\n--- 1\n"), "1:1 warning UNKNOWN_DIRECTIVE Unknown directive \"%FOO\"\n");
  const two: YamlStream = parseYamlWith("x: [1,,2]\ny: *nope\n", new YamlOptions());
  t.eqI32("two errors", two.errorCount(), 2);
  t.eqI32("no warnings", two.warningCount(), 0);
  t.eqStr("diagnostics are in source order", ytDiagnostics(two), "1:7 error UNEXPECTED_COMMA Missing value before \",\"\n2:4 error UNRESOLVED_ALIAS Alias \"*nope\" has no matching anchor\n");
};
