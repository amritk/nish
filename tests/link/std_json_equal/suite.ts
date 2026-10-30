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
} from "nish/json-value";

export const JSS_CASES_PATH: string = "tests/json-schema-suite/cases.txt";

/** A keyword's verdict: the instance passes it, fails it, or the keyword is one this driver does not read. */
const JSS_VALID: i32 = 1;
const JSS_INVALID: i32 = 0;
const JSS_UNREAD: i32 = -1;

/** Whether `data` is of JSON Schema type `name`: `integer` is a number whose value is whole, `1.0` included. */
const jssType = (doc: JsonDocument, data: i32, name: string): boolean => {
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

/** Whether every element of array `arg` is a string, and each is a `type` name when `names` is set. */
const jssStrings = (doc: JsonDocument, arg: i32, names: boolean): boolean => {
  if (doc.kind(arg) !== JSON_VALUE_ARRAY) {
    return false;
  }
  for (let i: i32 = 0; i < doc.length(arg); i++) {
    const item: i32 = doc.at(arg, i);
    if (doc.kind(item) !== JSON_VALUE_STRING || (names && !jssTypeName(doc.string(item)))) {
      return false;
    }
  }
  return true;
};

/** Whether `name` is one of JSON Schema's seven type names. */
const jssTypeName = (name: string): boolean =>
  name === "null" ||
  name === "boolean" ||
  name === "number" ||
  name === "integer" ||
  name === "string" ||
  name === "array" ||
  name === "object";

/**
 * Whether this driver reads every keyword of `schema` and of every schema
 * nested in it, whatever the instance: a nested schema the instance never
 * reaches, or a keyword an earlier failing one would hide, still counts, so
 * "unread anywhere" wins over any verdict.
 */
const jssReads = (doc: JsonDocument, schema: i32): boolean => {
  if (doc.kind(schema) === JSON_VALUE_BOOLEAN) {
    return true;
  }
  if (doc.kind(schema) !== JSON_VALUE_OBJECT) {
    return false;
  }
  for (let i: i32 = 0; i < doc.length(schema); i++) {
    const key: string = doc.keyAt(schema, i);
    const arg: i32 = doc.at(schema, i);
    const kind: i32 = doc.kind(arg);
    let read: boolean = key === "$schema" || key === "$comment" || key === "const";
    if (key === "type") {
      read = kind === JSON_VALUE_STRING && jssTypeName(doc.string(arg));
    } else if (key === "enum") {
      read = kind === JSON_VALUE_ARRAY;
    } else if (key === "uniqueItems") {
      read = kind === JSON_VALUE_BOOLEAN;
    } else if (
      key === "multipleOf" ||
      key === "minimum" ||
      key === "exclusiveMinimum" ||
      key === "maximum" ||
      key === "exclusiveMaximum"
    ) {
      read = kind === JSON_VALUE_NUMBER;
    } else if (key === "format") {
      read =
        kind === JSON_VALUE_STRING &&
        (doc.string(arg) === "json-pointer" || doc.string(arg) === "relative-json-pointer");
    } else if (key === "required") {
      read = jssStrings(doc, arg, false);
    } else if (key === "items") {
      read = kind === JSON_VALUE_BOOLEAN && !doc.boolean(arg);
    } else if (key === "properties" || key === "prefixItems") {
      read = kind === (key === "properties" ? JSON_VALUE_OBJECT : JSON_VALUE_ARRAY);
      for (let k: i32 = 0; read && k < doc.length(arg); k++) {
        read = jssReads(doc, doc.at(arg, k));
      }
    }
    if (!read) {
      return false;
    }
  }
  return true;
};

/** `jsonNumberCompare(data, bound)` held to `ok`'s answers, for a number instance; a refusal is unread. */
const jssBound = (doc: JsonDocument, data: i32, bound: i32, low: i32, high: i32): i32 => {
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
const jssOneOf = (doc: JsonDocument, list: i32, value: i32): boolean => {
  for (let i: i32 = 0; i < doc.length(list); i++) {
    if (jsonEqual(doc, doc.at(list, i), doc, value)) {
      return true;
    }
  }
  return false;
};

/** The verdict of keyword `key`, whose value is `arg`, of `schema` on `data`. */
const jssKeyword = (doc: JsonDocument, schema: i32, key: string, arg: i32, data: i32): i32 => {
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
      const member: i32 = doc.get(data, doc.keyAt(arg, i));
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
    const prefix: i32 = doc.get(schema, "prefixItems");
    const allowed: i32 = doc.kind(prefix) === JSON_VALUE_ARRAY ? doc.length(prefix) : 0;
    return kind !== JSON_VALUE_ARRAY || doc.length(data) <= allowed ? JSS_VALID : JSS_INVALID;
  }
  return JSS_UNREAD;
};

/**
 * The verdict of every keyword of `schema` on `data`, for a schema `jssReads`
 * accepts: unread when an answer is refused (a number past the bound); else
 * the first that is not valid, else valid. `true` and `false` decide at once;
 * any other schema that is not an object is unread.
 */
const jssSchema = (doc: JsonDocument, schema: i32, data: i32): i32 => {
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
    const group: i32 = doc.parseText(line.slice(space + 1));
    const schema: i32 = doc.get(group, "schema");
    const cases: i32 = doc.get(group, "tests");
    const reads: boolean = jssReads(doc, schema);
    for (let i: i32 = 0; i < doc.length(cases); i++) {
      const test: i32 = doc.at(cases, i);
      const verdict: i32 = reads ? jssSchema(doc, schema, doc.get(test, "data")) : JSS_UNREAD;
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

/** Whether `jssReads` accepts the schema text `text`. */
const jssReadsText = (text: string): boolean => {
  const doc = new JsonDocument(new JsonLimits());
  return jssReads(doc, doc.parseText(text));
};

/** The driver's own rule, that a keyword unread anywhere wins over any verdict, pinned. */
export const jssDriverChecks = (t: Suite): void => {
  t.eqBool("driver: reads what it answers", jssReadsText('{"properties":{"a":{"type":"string"}},"required":["a"]}'), true);
  t.eqBool("driver: an unknown type name is unread", jssReadsText('{"type":"foo"}'), false);
  t.eqBool(
    "driver: a nested schema after a failing one still counts",
    jssReadsText('{"properties":{"a":{"type":"string"},"b":{"bogus":1}}}'),
    false
  );
  t.eqBool("driver: so does a prefix item past the instance", jssReadsText('{"prefixItems":[false,{"bogus":0}]}'), false);
  t.eqBool("driver: and a keyword the instance's kind skips", jssReadsText('{"format":"email"}'), false);
};
