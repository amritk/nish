// Whole documents, written exactly and read back as the same tree: the layout,
// the long key written as an explicit one, the depth limit, and what is
// refused.
import { Suite } from "../../../std/testing";
import { JSON_WRITER_MAX_DEPTH } from "../../../std/json";
import { JsonDocument, JsonValue } from "../../../std/json-value";
import { YAML_FLOAT, YAML_INT, YAML_MAP, YAML_NULL, parseYaml, pathNode } from "../../../std/yaml";
import { stringifyYaml } from "../../../std/yaml-write";
import { YC_NODE_BUDGET, YcComparer } from "../std_yaml_conformance/compare";
import { ywBytes, ywDocument } from "./common";

/** Why `yaml` does not read back as value `v` of `doc`, or `""` when it does. */
const ywReadsBack = (doc: JsonDocument, v: JsonValue, yaml: string): string => {
  const stream = parseYaml(yaml);
  if (stream.diagnosticCount() > 0) {
    return `${stream.diagnosticMessage(0)} at ${stream.diagnosticStart(0)}`;
  }
  if (stream.documentCount() !== 1) {
    return `${stream.documentCount()} documents`;
  }
  const comparer = new YcComparer(stream, doc, YC_NODE_BUDGET);
  return comparer.same(stream.documentRoot(0), v, "$") ? "" : comparer.detail;
};

/** Checks JSON `json` writes as exactly `yaml` and reads back as the same tree. */
const ywWrites = (t: Suite, name: string, json: string, yaml: string): void => {
  const doc = ywDocument();
  const v: JsonValue = doc.parseText(json);
  const written = stringifyYaml(doc, v);
  t.eqStr(`${name}: written`, written, yaml);
  t.eqStr(`${name}: reads back`, ywReadsBack(doc, v, written), "");
};

/** `depth` arrays, each holding the next; the innermost holds `1`, or nothing when `empty`. */
const ywNested = (doc: JsonDocument, depth: i32, empty: boolean): JsonValue => {
  let inner: JsonValue = doc.newArray();
  if (!empty) {
    doc.push(inner, doc.newNumber("1"));
  }
  for (let i: i32 = 1; i < depth; i += 1) {
    const outer: JsonValue = doc.newArray();
    doc.push(outer, inner);
    inner = outer;
  }
  return inner;
};

/** `count` copies of `c`. */
const ywRun = (c: string, count: i32): string => {
  const parts: string[] = [];
  for (let i: i32 = 0; i < count; i += 1) {
    parts.push(c);
  }
  return parts.join("");
};

export const ywDocuments = (t: Suite): void => {
  ywWrites(
    t,
    "every kind of value",
    '{"none":null,"yes":true,"no":false,"int":-12,"exp":1e2,"frac":0.25,' +
      '"text":"tea","on":"yes","list":[1,[2,3],{"y":"z","w":[]}],"map":{"inner":{"deep":"x"}},"empty":{},"nothing":[]}',
    'none: null\n"yes": true\n"no": false\n' +
      "int: -12\nexp: 1e2\nfrac: 0.25\ntext: tea\n" +
      '"on": "yes"\nlist:\n  - 1\n  - - 2\n    - 3\n  - "y": z\n    w: []\nmap:\n  inner:\n    deep: x\nempty: {}\nnothing: []\n',
  );
  ywWrites(t, "a sequence of maps", '[{"a":1,"b":2},{"c":{"d":3}},[]]', "- a: 1\n  b: 2\n- c:\n    d: 3\n- []\n");
  ywWrites(t, "a top-level null", "null", "null\n");
  ywWrites(t, "a top-level number", "-0.5e-3", "-0.5e-3\n");
  ywWrites(t, "a top-level plain string", '"tea"', "tea\n");
  ywWrites(t, "a top-level ambiguous string", '"---"', '"---"\n');
  ywWrites(t, "a top-level empty array", "[]", "[]\n");
  ywWrites(t, "a top-level empty object", "{}", "{}\n");
  ywWrites(t, "keys keep their order", '{"b":1,"a":2,"c":3}', "b: 1\na: 2\nc: 3\n");

  // A number keeps its text, and the core schema reads every JSON number as one. A 20-digit
  // integer wraps as an `i64`, so it is checked by its type and text, not by value.
  const doc = ywDocument();
  const root: JsonValue = doc.parseText('{"big":18446744073709551616,"exp":1E+2,"tiny":-0}');
  const numbers = parseYaml(stringifyYaml(doc, root));
  const big: i32 = pathNode(numbers, numbers.documentRoot(0), ["big"]);
  t.ok("a 20-digit integer reads back as an integer with its text", numbers.type(big) === YAML_INT && numbers.text(big) === "18446744073709551616");
  const exp: i32 = pathNode(numbers, numbers.documentRoot(0), ["exp"]);
  t.ok("1E+2 reads back as the float 100", numbers.type(exp) === YAML_FLOAT && numbers.floatValue(exp) === 100.0);
  const tiny: i32 = pathNode(numbers, numbers.documentRoot(0), ["tiny"]);
  t.ok("-0 reads back as an integer", numbers.type(tiny) === YAML_INT && numbers.text(tiny) === "-0");

  // A key runs at most 1024 bytes before its `:` as an implicit key; past that it is explicit.
  const keys = ywDocument();
  const long: JsonValue = keys.newObject();
  keys.set(long, ywRun("a", 1024), keys.newNumber("1"));
  keys.set(long, ywRun("b", 1025), keys.newNumber("2"));
  keys.set(long, ` ${ywRun("c", 1022)}`, keys.newArray());
  const nested: JsonValue = keys.newObject();
  const one: JsonValue = keys.newArray();
  keys.push(one, keys.newNumber("1"));
  keys.set(nested, "e", one);
  keys.set(long, ywRun("d", 1100), nested);
  const longYaml = stringifyYaml(keys, long);
  t.eqStr(
    "a key past 1024 bytes is written as an explicit key",
    longYaml,
    `${ywRun("a", 1024)}: 1\n? ${ywRun("b", 1025)}\n: 2\n? " ${ywRun("c", 1022)}"\n: []\n? ${ywRun("d", 1100)}\n:\n  e:\n    - 1\n`,
  );
  t.eqStr("explicit keys read back", ywReadsBack(keys, long, longYaml), "");
  const inSequence: JsonValue = keys.newArray();
  keys.push(inSequence, long);
  t.eqStr("explicit keys in a sequence item read back", ywReadsBack(keys, inSequence, stringifyYaml(keys, inSequence)), "");

  // An escape counts as written: `\n` 2 bytes, `\x85` and `\x7F` 4, `\u2028` 6, so each key sits at 1024 or 1025.
  const escapes = ywDocument();
  const edges: string[] = [
    `\n${ywRun("e", 1020)}`,
    `${ywBytes([226, 128, 168])}${ywRun("f", 1017)}`,
    `${ywBytes([194, 133])}${ywRun("g", 1018)}`,
    `${ywBytes([127])}${ywRun("h", 1019)}`,
  ];
  const edgeNames: string[] = ["\\n", "\\u2028", "\\x85", "\\x7F"];
  const explicitAt: boolean[] = [false, true, false, true];
  for (let i: i32 = 0; i < toI32(edges.length); i += 1) {
    const one: JsonValue = escapes.newObject();
    escapes.set(one, edges[i], escapes.newNull());
    const yaml = stringifyYaml(escapes, one);
    t.ok(
      `a quoted key's ${edgeNames[i]} counts toward the 1024 bytes`,
      yaml.startsWith("? \"") === explicitAt[i] && ywReadsBack(escapes, one, yaml) === "",
    );
  }

  // The depth limit is stringify's: JSON_WRITER_MAX_DEPTH collections write, one more is refused.
  const deep = ywDocument();
  const atLimit: JsonValue = ywNested(deep, JSON_WRITER_MAX_DEPTH, false);
  const atLimitYaml = stringifyYaml(deep, atLimit);
  t.ok("a tree JSON_WRITER_MAX_DEPTH deep is written", atLimitYaml !== "" && deep.stringify(atLimit) !== "");
  t.eqStr("a tree JSON_WRITER_MAX_DEPTH deep reads back", ywReadsBack(deep, atLimit, atLimitYaml), "");
  const emptyAtLimit: JsonValue = ywNested(deep, JSON_WRITER_MAX_DEPTH, true);
  t.eqStr("an empty array at the depth limit reads back", ywReadsBack(deep, emptyAtLimit, stringifyYaml(deep, emptyAtLimit)), "");

  // Negatives: what is refused, and what an unquoted look-alike would have read as.
  const pastLimit: JsonValue = ywNested(deep, JSON_WRITER_MAX_DEPTH + 1, false);
  t.eqStr("a tree one deeper than the limit is refused", stringifyYaml(deep, pastLimit), "");
  t.eqStr("stringify refuses the same tree", deep.stringify(pastLimit), "");
  t.eqStr("an empty array one deeper than the limit is refused", stringifyYaml(deep, ywNested(deep, JSON_WRITER_MAX_DEPTH + 1, true)), "");
  const under: JsonValue = deep.newObject();
  deep.set(under, "k", pastLimit);
  t.eqStr("a refused tree under a key refuses the whole text", stringifyYaml(deep, under), "");
  t.eqStr("a handle that names no value writes nothing", stringifyYaml(deep, -1), "");
  t.eqStr("a handle past the document writes nothing", stringifyYaml(deep, 1000000), "");
  const plainNull = parseYaml("k: ~\n");
  t.ok("unquoted, ~ would read as null", plainNull.type(pathNode(plainNull, plainNull.documentRoot(0), ["k"])) === YAML_NULL);
  const plainInt = parseYaml("k: 0x1F\n");
  t.ok("unquoted, 0x1F would read as an integer", plainInt.type(pathNode(plainInt, plainInt.documentRoot(0), ["k"])) === YAML_INT);
  const plainMerge = parseYaml("<<: {a: 1}\n");
  t.ok("unquoted, a << key would merge", plainMerge.type(pathNode(plainMerge, plainMerge.documentRoot(0), ["a"])) === YAML_INT);
  const plainColon = parseYaml("k: a: b\n");
  t.ok("unquoted, a: b would be an error", plainColon.errorCount() > 0);
  const quotedKey = parseYaml(stringifyYaml(deep, deep.parseText('{"<<":{"a":1}}')));
  const merged: i32 = pathNode(quotedKey, quotedKey.documentRoot(0), ["<<"]);
  t.ok("quoted, a << key is an ordinary key", quotedKey.kind(merged) === YAML_MAP && quotedKey.diagnosticCount() === 0);
};
