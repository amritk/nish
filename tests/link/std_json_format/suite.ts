// The suite through `jsonFormatValidate`: each string case must get the
// suite's answer, each case that is not a string is valid (a format applies to
// strings alone, so a validator never calls the check), and each format this
// module does not implement must be answered unknown.
import { Suite } from "nish/testing";
import { JSON_FORMAT_INVALID, JSON_FORMAT_UNKNOWN, JSON_FORMAT_VALID, jsonFormatId, jsonFormatValidate } from "nish/json-format";
import { JftCase, jftLoadCases } from "./cases";

/** The formats checked, with the number of string cases each has upstream. */
const jftFormats = (): string[] => [
  "date-time", "date", "time", "duration", "email", "hostname", "ipv4", "ipv6", "uuid",
  "uri", "uri-reference", "iri", "iri-reference", "uri-template", "regex",
];
const jftStringCases = (): i32[] => [19, 41, 39, 19, 16, 17, 10, 34, 15, 20, 7, 9, 7, 4, 2];

/** The suite's formats that are not checked here: another stage, or IDNA. */
const jftUnchecked = (): string[] => ["idn-email", "idn-hostname", "json-pointer", "relative-json-pointer", "unknown"];

const jftIndexOf = (names: string[], name: string): i32 => {
  for (let i: i32 = 0; i < toI32(names.length); i += 1) {
    if (names[i] === name) {
      return i;
    }
  }
  return -1;
};

export const jftSuiteChecks = (t: Suite): void => {
  const cases: JftCase[] = jftLoadCases();
  const formats = jftFormats();
  const stringCases = jftStringCases();
  const uncheckedFormats = jftUnchecked();
  t.ok("suite: cases.txt holds all 478 cases", toI32(cases.length) === 478);
  const passed: i32[] = [];
  const seen: i32[] = [];
  for (let i: i32 = 0; i < toI32(formats.length); i += 1) {
    passed.push(0);
    seen.push(0);
  }
  let unchecked: i32 = 0;
  for (const c of cases) {
    const k = jftIndexOf(formats, c.format);
    if (k < 0) {
      if (jftIndexOf(uncheckedFormats, c.format) < 0) {
        t.fail(`suite: ${c.key} names a format the test does not know`, c.format);
      } else if (c.isString && jsonFormatValidate(c.format, c.data) !== JSON_FORMAT_UNKNOWN) {
        t.fail(`suite: ${c.key} is answered`, `${c.format} is not checked here, so it must be unknown`);
      } else {
        unchecked += 1;
      }
      continue;
    }
    if (!c.isString) {
      if (!c.valid) {
        t.fail(`suite: ${c.key}`, "the suite expects a case that is not a string invalid, but a format applies only to strings, so the check must answer valid");
      }
      continue;
    }
    seen[k] = seen[k] + 1;
    const want: i32 = c.valid ? JSON_FORMAT_VALID : JSON_FORMAT_INVALID;
    const got: i32 = jsonFormatValidate(c.format, c.data);
    if (got === want) {
      passed[k] = passed[k] + 1;
    } else {
      t.fail(`suite: ${c.key} ${c.description}`, `"${c.data}" answered ${got}, the suite says ${want}`);
    }
  }
  for (let i: i32 = 0; i < toI32(formats.length); i += 1) {
    const name = formats[i];
    t.ok(`suite: ${name} ${passed[i]}/${stringCases[i]}`, jsonFormatId(name) === i && seen[i] === stringCases[i] && passed[i] === seen[i]);
  }
  t.ok(`suite: the unchecked formats are unknown in ${unchecked} cases`, unchecked === 129);
};
