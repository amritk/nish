// The two ways `nish/yaml-json` loads YAML text, side by side: `loadText`,
// which loads it without a node tree, and `load(parseYaml(text))`. Their
// answers are compared as text: on a refusal the code and range, else the
// JSON written out and every value's and key's source range.
import { JsonLimits } from "nish/json-tokenizer";
import { JSON_VALUE_ARRAY, JSON_VALUE_OBJECT, JsonDocument, JsonValue } from "nish/json-value";
import { parseYaml } from "nish/yaml";
import { YamlJsonLoader } from "nish/yaml-json";

/** One document loaded both ways. */
export class YjdRun {
  /** What `loadText` answered into the caller's document. */
  root: JsonValue = -1;
  /** `loadText`'s answer, as `yjdAnswer` writes it. */
  answer: string = "";
  /** `""` when both ways agree, else both answers. */
  differs: string = "";
}

/** Every value's range, and every key's, in walk order. */
const yjdRanges = (doc: JsonDocument, v: JsonValue, out: string[]): void => {
  out.push(`${doc.start(v)}-${doc.end(v)}`);
  const kind: i32 = doc.kind(v);
  if (kind === JSON_VALUE_ARRAY || kind === JSON_VALUE_OBJECT) {
    for (let i: i32 = 0; i < doc.length(v); i += 1) {
      if (kind === JSON_VALUE_OBJECT) {
        out.push(`k${doc.keyStart(v, i)}-${doc.keyEnd(v, i)}`);
      }
      yjdRanges(doc, doc.at(v, i), out);
    }
  }
};

/** What a load answered: the code, range and values held on a refusal, else the JSON and every range. */
export const yjdAnswer = (loader: YamlJsonLoader, doc: JsonDocument, v: JsonValue): string => {
  if (v < 0) {
    return `refused ${v} ${loader.failed} ${loader.errorStart}-${loader.errorEnd} top ${doc.top}`;
  }
  const out: string[] = [doc.stringify(v)];
  yjdRanges(doc, v, out);
  return out.join(" ");
};

/**
 * Loads document `d` of `text` into `doc` with `loader.loadText`, and into a
 * fresh document with the same limits with a fresh loader's
 * `load(parseYaml(text))`, and compares the two.
 */
export const yjdRun = (loader: YamlJsonLoader, doc: JsonDocument, text: string, d: i32): YjdRun => {
  const twin = new JsonDocument(new JsonLimits());
  twin.maxValues = doc.maxValues;
  twin.duplicates = doc.duplicates;
  twin.tok.maxTotalBytes = doc.tok.maxTotalBytes;
  const other = new YamlJsonLoader();
  other.maxDepth = loader.maxDepth;
  const want = yjdAnswer(other, twin, other.load(parseYaml(text), d, twin));
  const run = new YjdRun();
  run.root = loader.loadText(text, d, doc);
  run.answer = yjdAnswer(loader, doc, run.root);
  if (run.answer !== want) {
    run.differs = `loadText: ${run.answer}\nload:     ${want}`;
  }
  return run;
};
