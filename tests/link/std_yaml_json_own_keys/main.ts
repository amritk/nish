// `nish/yaml-json` (std/yaml-json.ts): a map with no merge key, in a stream
// whose parser checked for repeated keys, is built from its own pairs without
// a second check. These pin that the parser's check is the loader's: each
// pair of keys spelled two ways but one JSON key is refused by the parser,
// and with the parser's check off the loader refuses it itself.
import { JsonLimits } from "nish/json-tokenizer";
import { JSON_VALUE_ERR_DUPLICATE, JsonDocument, JsonValue } from "nish/json-value";
import { Suite } from "nish/testing";
import { YamlOptions, parseYaml, parseYamlWith } from "nish/yaml";
import { YAML_JSON_ERR_YAML, YamlJsonLoader } from "nish/yaml-json";

/** `text[a, b)`, or `-` and the offsets when the range is not one. */
const okSlice = (text: string, a: i32, b: i32): string =>
  a < 0 || b < a || b > toI32(text.length) ? `- ${a} ${b}` : text.substring(a, b);

/** Loads document 0 of `text`, parsed with repeated keys let through to the loader. */
const okLoose = (loader: YamlJsonLoader, doc: JsonDocument, text: string): JsonValue => {
  const options = new YamlOptions();
  options.uniqueKeys = false;
  return loader.load(parseYamlWith(text, options), 0, doc);
};

/** The keys of object `o`, each in `<>`. */
const okKeys = (doc: JsonDocument, o: JsonValue): string => {
  let out = "";
  for (let i: i32 = 0; i < doc.length(o); i += 1) {
    out = `${out}<${doc.keyAt(o, i)}>`;
  }
  return out;
};

export const main = (): number => {
  const t = new Suite("std/yaml-json own keys");
  const loader = new YamlJsonLoader();
  const doc = new JsonDocument(new JsonLimits());
  const pairs: string[] = ['1: a\n"1": b\n', "a: 1\n'a': 2\n", '[a, b]: 1\n"[ a, b ]": 2\n', '~: 1\n"": 2\n'];
  const names: string[] = ['1 and "1"', "a and 'a'", "a flow key and its text", "a null key and the empty string"];
  const seconds: string[] = ['"1"', "'a'", '"[ a, b ]"', '""'];
  for (let i: i32 = 0; i < toI32(pairs.length); i += 1) {
    t.eqI32(`${names[i]}: refused by the parser`, loader.load(parseYaml(pairs[i]), 0, doc), YAML_JSON_ERR_YAML);
    t.eqI32(`${names[i]}: refused by the loader`, okLoose(loader, doc, pairs[i]), JSON_VALUE_ERR_DUPLICATE);
    t.eqStr(`${names[i]}: at the second key`, okSlice(pairs[i], loader.errorStart, loader.errorEnd), seconds[i]);
  }
  const text = "'a': 1\n\"b\": 2\nc: 3\n[x]: 4\n";
  const root = loader.load(parseYaml(text), 0, doc);
  t.eqStr("quoted and flow keys, in order", okKeys(doc, root), "<a><b><c><[ x ]>");
  t.eqStr("a quoted key's range has its quotes", okSlice(text, doc.keyStart(root, 1), doc.keyEnd(root, 1)), '"b"');
  t.eqStr("a flow key's range is its source", okSlice(text, doc.keyStart(root, 3), doc.keyEnd(root, 3)), "[x]");
  // An empty key at the end of the text starts where the text ends.
  const last = loader.load(parseYaml("a: 1\n?"), 0, doc);
  t.eqStr("an empty last key loads", okKeys(doc, last), "<a><>");
  // `<<` repeats are let through by a parse with merging on; with it turned off
  // before the load they are ordinary keys, and alike.
  const merged = parseYaml("a: &a {x: 1}\nb: {<<: *a, <<: *a}\n");
  merged.merge = false;
  t.eqI32("merge off after the parse: repeated << refused", loader.load(merged, 0, doc), JSON_VALUE_ERR_DUPLICATE);
  return t.done();
};
