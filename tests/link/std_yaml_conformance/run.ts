// Runs every yaml-test-suite case through parseYamlWith, uniqueKeys on.
import { JSON_VALUE_DUPLICATE_LAST, JsonDocument } from "../../../std/json-value";
import { JsonLimits } from "../../../std/json-tokenizer";
import { YamlOptions, YamlStream, parseYamlWith, yamlErrorName } from "../../../std/yaml";
import { YcCase } from "./cases";
import { YcComparer, ycSplitJson } from "./compare";

/** Why case `c` fails, or `""` when it passes; a document may visit `budget` nodes. */
export const ycVerdict = (c: YcCase, json: JsonDocument, budget: i32): string => {
  const options = new YamlOptions();
  options.uniqueKeys = true;
  const stream: YamlStream = parseYamlWith(c.yaml, options);
  if (c.error) {
    return stream.errorCount() > 0 ? "" : "no error reported";
  }
  if (stream.errorCount() > 0) {
    let i: i32 = 0;
    while (stream.diagnosticIsWarning(i)) {
      i += 1;
    }
    return `${yamlErrorName(stream.diagnosticCode(i))} at ${stream.diagnosticStart(i)}: ${stream.diagnosticMessage(i)}`;
  }
  const text = c.json;
  if (text === null) {
    return "";
  }
  const values = ycSplitJson(text);
  if (values === null) {
    return "the expected JSON does not split";
  }
  if (toI32(values.length) !== stream.documentCount()) {
    return `expected ${values.length} documents, got ${stream.documentCount()}`;
  }
  for (let d: i32 = 0; d < stream.documentCount(); d += 1) {
    const root: i32 = json.parseText(values[d]);
    if (root < 0) {
      return `the expected JSON of document ${d} does not parse`;
    }
    const comparer = new YcComparer(stream, json, budget);
    if (!comparer.same(stream.documentRoot(d), root, `$${d}`)) {
      return comparer.detail;
    }
  }
  return "";
};

/** A document the expected JSON is parsed into, a later duplicate key winning. */
export const ycJsonDocument = (): JsonDocument => {
  const json = new JsonDocument(new JsonLimits());
  json.duplicates = JSON_VALUE_DUPLICATE_LAST;
  return json;
};
