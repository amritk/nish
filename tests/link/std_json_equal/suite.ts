// The JSON-Schema-Test-Suite groups of tests/json-schema-suite/cases.txt (its
// README has the format), each test's instance checked against its schema by
// calling nish/json-equal, nish/json-number and nish/json-pointer directly for
// the keywords they answer. The few structural keywords the groups wrap them
// in (`type`, `properties`, `required`, `prefixItems`, `items: false`) are
// read here too; any other keyword fails the run rather than passing unread.
import { jsonEqual, jsonEqualFirstDuplicate } from "nish/json-equal";
import { jsonNumberCompare, jsonNumberMultipleOf } from "nish/json-number";
import { isJsonPointer, isRelativeJsonPointer } from "nish/json-pointer";
import { Suite } from "nish/testing";
import { splitLines } from "nish/text";
import { JsonLimits } from "nish/json-tokenizer";
import {
  JSON_VALUE_ARRAY,
  JSON_VALUE_BOOLEAN,
  JSON_VALUE_NONE,
  JSON_VALUE_NULL,
  JSON_VALUE_NUMBER,
  JSON_VALUE_OBJECT,
  JSON_VALUE_STRING,
  JsonDocument,
  JsonValue,
} from "nish/json-value";

export const JSS_CASES_PATH: string = "tests/json-schema-suite/cases.txt";

/** A keyword's verdict: the instance passes it, fails it, or the keyword is one this driver does not read. */
const JSS_VALID: i32 = 1;
const JSS_INVALID: i32 = 0;
const JSS_UNREAD: i32 = -1;

/** Whether `data` is of JSON Schema type `name`: `integer` is a number whose value is whole, `1.0` included. */
const jssType = (doc: JsonDocument, data: JsonValue, name: string): boolean => {
  const kind: i32 = doc.kind(data);
  if (name === "integer") {
    return doc.isIntegral(data);
  }
  return (
    (name === "null" && kind === JSON_VALUE_NULL) ||
    (name === "boolean" && kind === JSON_VALUE_BOOLEAN) ||
    (name === "number" && kind === JSON_VALUE_NUMBER) ||
    (name === "string" && kind === JSON_VALUE_STRING) ||
    (name === "array" && kind === JSON_VALUE_ARRAY) ||
    (name === "object" && kind === JSON_VALUE_OBJECT)
  );
};

/** `jsonNumberCompare(data, bound)` held to `ok`'s answers, for a number instance; a refusal is unread. */
const jssBound = (doc: JsonDocument, data: JsonValue, bound: JsonValue, low: i32, high: i32): i32 => {
  if (doc.kind(data) !== JSON_VALUE_NUMBER) {
    return JSS_VALID;
  }
  const order: i32 = jsonNumberCompare(doc.numberText(data), doc.numberText(bound));
  if (order < -1) {
    return JSS_UNREAD;
  }
  return order >= low && order <= high ? JSS_VALID : JSS_INVALID;
};

/** Whether `value` of `doc` equals one of the elements of array `list`. */
const jssOneOf = (doc: JsonDocument, list: JsonValue, value: JsonValue): boolean => {
  for (let i: i32 = 0; i < doc.length(list); i++) {
    if (jsonEqual(doc, doc.at(list, i), doc, value)) {
      return true;
    }
  }
  return false;
};

/** The verdict of keyword `key`, whose value is `arg`, of `schema` on `data`. */
const jssKeyword = (doc: JsonDocument, schema: JsonValue, key: string, arg: JsonValue, data: JsonValue): i32 => {
  const kind: i32 = doc.kind(data);
  if (key === "$schema" || key === "$comment") {
    return JSS_VALID;
  }
  if (key === "type") {
    if (doc.kind(arg) !== JSON_VALUE_STRING) {
      return JSS_UNREAD;
    }
    return jssType(doc, data, doc.string(arg)) ? JSS_VALID : JSS_INVALID;
  }
  if (key === "const") {
    return jsonEqual(doc, data, doc, arg) ? JSS_VALID : JSS_INVALID;
  }
  if (key === "enum") {
    return jssOneOf(doc, arg, data) ? JSS_VALID : JSS_INVALID;
  }
  if (key === "uniqueItems") {
    return !doc.boolean(arg) || jsonEqualFirstDuplicate(doc, data) < 0 ? JSS_VALID : JSS_INVALID;
  }
  if (key === "multipleOf") {
    if (kind !== JSON_VALUE_NUMBER) {
      return JSS_VALID;
    }
    const answer: i32 = jsonNumberMultipleOf(doc.numberText(data), doc.numberText(arg));
    // `jsonNumberMultipleOf`'s answers 1 and 0 are `JSS_VALID` and `JSS_INVALID`.
    return answer < 0 ? JSS_UNREAD : answer;
  }
  if (key === "minimum") {
    return jssBound(doc, data, arg, 0, 1);
  }
  if (key === "exclusiveMinimum") {
    return jssBound(doc, data, arg, 1, 1);
  }
  if (key === "maximum") {
    return jssBound(doc, data, arg, -1, 0);
  }
  if (key === "exclusiveMaximum") {
    return jssBound(doc, data, arg, -1, -1);
  }
  if (key === "format") {
    if (kind !== JSON_VALUE_STRING) {
      return JSS_VALID;
    }
    const format: string = doc.string(arg);
    if (format === "json-pointer") {
      return isJsonPointer(doc.string(data)) ? JSS_VALID : JSS_INVALID;
    }
    if (format === "relative-json-pointer") {
      return isRelativeJsonPointer(doc.string(data)) ? JSS_VALID : JSS_INVALID;
    }
    return JSS_UNREAD;
  }
  if (key === "required") {
    if (kind !== JSON_VALUE_OBJECT) {
      return JSS_VALID;
    }
    for (let i: i32 = 0; i < doc.length(arg); i++) {
      if (doc.kind(doc.get(data, doc.string(doc.at(arg, i)))) === JSON_VALUE_NONE) {
        return JSS_INVALID;
      }
    }
    return JSS_VALID;
  }
  if (key === "properties") {
    for (let i: i32 = 0; i < doc.length(arg); i++) {
      const member: JsonValue = doc.get(data, doc.keyAt(arg, i));
      if (doc.kind(member) !== JSON_VALUE_NONE) {
        const verdict: i32 = jssSchema(doc, doc.at(arg, i), member);
        if (verdict !== JSS_VALID) {
          return verdict;
        }
      }
    }
    return JSS_VALID;
  }
  if (key === "prefixItems") {
    for (let i: i32 = 0; i < doc.length(arg) && i < doc.length(data); i++) {
      const verdict: i32 = jssSchema(doc, doc.at(arg, i), doc.at(data, i));
      if (verdict !== JSS_VALID) {
        return verdict;
      }
    }
    return JSS_VALID;
  }
  if (key === "items" && doc.kind(arg) === JSON_VALUE_BOOLEAN && !doc.boolean(arg)) {
    const prefix: JsonValue = doc.get(schema, "prefixItems");
    const allowed: i32 = doc.kind(prefix) === JSON_VALUE_ARRAY ? doc.length(prefix) : 0;
    return kind !== JSON_VALUE_ARRAY || doc.length(data) <= allowed ? JSS_VALID : JSS_INVALID;
  }
  return JSS_UNREAD;
};

/**
 * The verdict of every keyword of `schema` on `data`: unread when any keyword
 * is unread, so a test is never judged by a schema read only in part; else
 * the first that is not valid, else valid. `true` and `false` decide at once;
 * any other schema that is not an object is unread.
 */
const jssSchema = (doc: JsonDocument, schema: JsonValue, data: JsonValue): i32 => {
  if (doc.kind(schema) === JSON_VALUE_BOOLEAN) {
    return doc.boolean(schema) ? JSS_VALID : JSS_INVALID;
  }
  if (doc.kind(schema) !== JSON_VALUE_OBJECT) {
    return JSS_UNREAD;
  }
  let first: i32 = JSS_VALID;
  for (let i: i32 = 0; i < doc.length(schema); i++) {
    const verdict: i32 = jssKeyword(doc, schema, doc.keyAt(schema, i), doc.at(schema, i), data);
    if (verdict === JSS_UNREAD) {
      return JSS_UNREAD;
    }
    if (first === JSS_VALID) {
      first = verdict;
    }
  }
  return first;
};

/**
 * Every test of the groups of `file` (`const`, `optional/bignum`, ...): one
 * check that each agrees with upstream's `valid`, naming every test that does
 * not, and one that the file holds `tests` tests.
 */
export const jssRunFile = (t: Suite, file: string, tests: i32): void => {
  const text = readFileSyncOrNull(JSS_CASES_PATH);
  if (text === null) {
    t.fail(`${file}: the suite`, `${JSS_CASES_PATH} is missing`);
    return;
  }
  const doc = new JsonDocument(new JsonLimits());
  const wrong: string[] = [];
  let ran: i32 = 0;
  for (const line of splitLines(text)) {
    const space: i32 = toI32(line.indexOf(" "));
    if (line.startsWith("#") || space < 0 || line.slice(0, space) !== file) {
      continue;
    }
    const group: JsonValue = doc.parseText(line.slice(space + 1));
    const schema: JsonValue = doc.get(group, "schema");
    const cases: JsonValue = doc.get(group, "tests");
    for (let i: i32 = 0; i < doc.length(cases); i++) {
      const test: JsonValue = doc.at(cases, i);
      const verdict: i32 = jssSchema(doc, schema, doc.get(test, "data"));
      const valid: boolean = doc.boolean(doc.get(test, "valid"));
      if (verdict === JSS_UNREAD || (verdict === JSS_VALID) !== valid) {
        const why: string = verdict === JSS_UNREAD ? "a keyword is unread or refused" : `valid is ${valid}`;
        wrong.push(`${doc.string(doc.get(group, "description"))} / ${doc.string(doc.get(test, "description"))}: ${why}`);
      }
      ran += 1;
    }
  }
  if (wrong.length === 0) {
    t.pass(`${file}: every test agrees with upstream`);
  } else {
    t.fail(`${file}: every test agrees with upstream`, wrong.join("\n"));
  }
  t.eqI32(`${file}: the suite holds ${tests} tests`, ran, tests);
};
