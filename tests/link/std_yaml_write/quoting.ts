// The quoting rule, one case per clause: each string written as a value and as
// a key, checked for whether it was quoted, then read back by parseYaml as a
// string with the same text and no diagnostics.
import { Suite } from "../../../std/testing";
import { JsonValue } from "../../../std/json-value";
import { YAML_STRING, parseYaml } from "../../../std/yaml";
import { stringifyYaml } from "../../../std/yaml-write";
import { ywBytes, ywDocument, ywShow } from "./common";

/** The strings the rule quotes, as values and as keys. */
const ywQuoted = (): string[] => [
  // Empty, and the words YAML 1.2 or 1.1 reads as null or a boolean.
  "", "~", "null", "Null", "NULL", "nUlL", "true", "True", "FALSE", "yes", "Yes", "NO", "no",
  "on", "On", "off", "OFF", "y", "Y", "n", "N",
  // Numbers, and what YAML 1.1 reads as one.
  "1", "0", "-1", "+1", "0x1F", "0o17", "1e3", "1.5", ".5", "-.5", "+.5", "1_000", "12:30", "2001-12-14",
  "1a", ".inf", ".Inf", "-.INF", "+.inf", ".nan", ".NaN", "-.nan", "+.NAN",
  // Indicators that cannot start a plain scalar.
  "@a", "`a", "\\a", "*a", "&a", "!a", "|a", ">a", "%a", "'a", "\"a", "#a", ",a", "[a", "]a", "{a", "}a",
  "- a", "-", "? a", "?", ": a", ":",
  // Document markers.
  "---", "--- a", "---a", "...", "... a",
  // `: ` and ` #` inside, `:` at the end.
  "a: b", "a #b", "a:", "a::",
  // Edge spaces.
  " ", " a", "a ", "  a  ",
];

/** Strings with characters a plain scalar may not hold. */
const ywControls = (): string[] => [
  "a\nb", "a\tb", "a\rb", "\n", ywBytes([0]), ywBytes([1]), ywBytes([31]), ywBytes([127]),
  ywBytes([97, 194, 133]), ywBytes([194, 128]), ywBytes([194, 159]), ywBytes([226, 128, 168]),
  ywBytes([226, 128, 169]), ywBytes([239, 187, 191, 97]), ywBytes([239, 191, 190]), ywBytes([239, 191, 191]),
];

/** The strings the rule leaves plain, each a near miss of a clause above. */
const ywPlain = (): string[] => [
  "tea", "a:b", "a#b", "-a", "?a", ":a", "-- a", "..", ".", "+", "a.b", "nul", "nulls", "trueish",
  "yess", "x1", "v1.2", "a, b", "a [b]", "a'b", "a\"b", "a \\ b", "a@b", "..a",
  ywBytes([195, 169]), ywBytes([194, 160, 97]), ywBytes([226, 128, 167]), ywBytes([239, 187, 190]),
];

/** Writes `text` as the value of `k` and as the key of `v`; `""` when both read back, else why not. */
const ywRoundTrip = (text: string, quoted: boolean): string => {
  const doc = ywDocument();
  const asValue: JsonValue = doc.newObject();
  doc.set(asValue, "k", doc.newString(text));
  const asKey: JsonValue = doc.newObject();
  doc.set(asKey, text, doc.newString("v"));
  const valueYaml = stringifyYaml(doc, asValue);
  const keyYaml = stringifyYaml(doc, asKey);
  if (valueYaml.startsWith("k: \"") !== quoted) {
    return `as a value: written ${ywShow(valueYaml)}`;
  }
  if (keyYaml.startsWith("\"") !== quoted) {
    return `as a key: written ${ywShow(keyYaml)}`;
  }
  const value = parseYaml(valueYaml);
  const valuePair: i32 = value.child(value.documentRoot(0), 0);
  const valueNode: i32 = value.value(valuePair);
  if (value.diagnosticCount() > 0 || value.type(valueNode) !== YAML_STRING || value.text(valueNode) !== text) {
    return `as a value: ${ywShow(valueYaml)} reads back as type ${value.type(valueNode)} <${ywShow(value.text(valueNode))}>`;
  }
  const key = parseYaml(keyYaml);
  const keyPair: i32 = key.child(key.documentRoot(0), 0);
  const keyNode: i32 = key.key(keyPair);
  if (key.diagnosticCount() > 0 || key.type(keyNode) !== YAML_STRING || key.text(keyNode) !== text) {
    return `as a key: ${ywShow(keyYaml)} reads back as type ${key.type(keyNode)} <${ywShow(key.text(keyNode))}>`;
  }
  return "";
};

/** Checks every case of `cases` round-trips, quoted or not as `quoted` says, as one check named `name`. */
const ywCheckAll = (t: Suite, name: string, cases: string[], quoted: boolean): void => {
  const failures: string[] = [];
  for (const text of cases) {
    const why = ywRoundTrip(text, quoted);
    if (why !== "") {
      failures.push(`<${ywShow(text)}> ${why}`);
    }
  }
  t.eqStr(`${name} (${cases.length} cases)`, failures.join("; "), "");
};

/** A string as the value of `k`, written. */
const ywValueYaml = (text: string): string => {
  const doc = ywDocument();
  const o: JsonValue = doc.newObject();
  doc.set(o, "k", doc.newString(text));
  return stringifyYaml(doc, o);
};

export const ywQuoting = (t: Suite): void => {
  ywCheckAll(t, "quoting: ambiguous strings are quoted and read back", ywQuoted(), true);
  ywCheckAll(t, "quoting: control characters and line breaks are quoted and read back", ywControls(), true);
  ywCheckAll(t, "quoting: near misses stay plain and read back", ywPlain(), false);

  // The escapes, written exactly.
  t.eqStr("escape: quote and backslash", ywValueYaml("\"a\\"), "k: \"\\\"a\\\\\"\n");
  t.eqStr("escape: newline, tab and return", ywValueYaml("a\nb\tc\rd"), "k: \"a\\nb\\tc\\rd\"\n");
  t.eqStr("escape: other C0 controls and DEL as \\x", ywValueYaml(ywBytes([0, 27, 127])), "k: \"\\x00\\x1B\\x7F\"\n");
  t.eqStr("escape: C1 controls as \\x", ywValueYaml(ywBytes([194, 133, 194, 159])), "k: \"\\x85\\x9F\"\n");
  t.eqStr(
    "escape: U+2028, U+2029, U+FEFF, U+FFFE and U+FFFF as \\u",
    ywValueYaml(ywBytes([226, 128, 168, 226, 128, 169, 239, 187, 191, 239, 191, 190, 239, 191, 191])),
    "k: \"\\u2028\\u2029\\uFEFF\\uFFFE\\uFFFF\"\n",
  );
  t.eqStr("escape: other text is kept as its bytes", ywValueYaml(ywBytes([32, 195, 169])), `k: "${ywBytes([32, 195, 169])}"\n`);

  // `<<` is quoted only as a key, where YAML reads it as a merge key.
  const doc = ywDocument();
  const merge: JsonValue = doc.newObject();
  doc.set(merge, "<<", doc.newString("<<"));
  t.eqStr("quoting: << is quoted as a key and not as a value", stringifyYaml(doc, merge), "\"<<\": <<\n");
};
