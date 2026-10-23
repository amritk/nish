// The yaml-test-suite (tests/yaml-suite/cases.txt) through nish/yaml, uniqueKeys
// on. Every case passes but the expected failures below, each with its reason;
// a regression, a stale expected failure, one failing with another error and an
// unknown id each fail the run.
// With `--failures` it prints every failing case and why instead.
import { Suite } from "nish/testing";
import { YcCase, ycLoadCases } from "./cases";
import { ycComparerChecks } from "./checks";
import { YC_NODE_BUDGET } from "./compare";
import { ycJsonDocument, ycVerdict } from "./run";

/** How many cases pass: a change that moves it updates it here. */
const YC_PINNED_PASSES: i32 = 400;

/** The cases that fail, each as its id, the error it fails on and why. */
const ycExpectedFailures = (): string[] => [
  "2JQS DUPLICATE_KEY two empty keys are one key, a duplicate under uniqueKeys",
  "X38W DUPLICATE_KEY *a repeats the key [ a, b ], a duplicate under uniqueKeys",
];

const ycPrintFailures = (cases: YcCase[]): number => {
  const json = ycJsonDocument();
  let passed: i32 = 0;
  for (const c of cases) {
    const why = ycVerdict(c, json, YC_NODE_BUDGET);
    if (why === "") {
      passed += 1;
    } else {
      console.log(`${c.key}: ${why}`);
    }
  }
  console.log(`${passed} of ${cases.length} pass`);
  return 0;
};

/** Whether `ids` holds `id`. */
const ycListed = (ids: string[], id: string): boolean => {
  for (const each of ids) {
    if (each === id) {
      return true;
    }
  }
  return false;
};

/** The id an expected-failure line names. */
const ycFailureId = (line: string): string => {
  const space: i32 = toI32(line.indexOf(" "));
  return space < 0 ? line : line.slice(0, space);
};

/** The error an expected-failure line names: its second word. */
const ycFailureCode = (line: string): string => {
  const rest: string = line.slice(ycFailureId(line).length + 1);
  const space: i32 = toI32(rest.indexOf(" "));
  return space < 0 ? rest : rest.slice(0, space);
};

/** The code of the expected failure `id` of `ids`, as `codes` holds them; `""` when it is not listed. */
const ycListedCode = (ids: string[], codes: string[], id: string): string => {
  let i: i32 = 0;
  while (i < toI32(ids.length) && i < toI32(codes.length)) {
    if (ids[i] === id) {
      return codes[i];
    }
    i += 1;
  }
  return "";
};

export const main = (): number => {
  const mode = process.argv.length > 1 ? process.argv[1] : "";
  const cases = ycLoadCases();
  if (mode === "--failures") {
    return ycPrintFailures(cases);
  }
  const t = new Suite("std/yaml conformance");
  ycComparerChecks(t);
  t.ok("the cases load from tests/yaml-suite/cases.txt", toI32(cases.length) > 0);
  const json = ycJsonDocument();
  const expected: string[] = [];
  const codes: string[] = [];
  for (const line of ycExpectedFailures()) {
    expected.push(ycFailureId(line));
    codes.push(ycFailureCode(line));
  }
  let passed: i32 = 0;
  let regressions: i32 = 0;
  for (const c of cases) {
    const why = ycVerdict(c, json, YC_NODE_BUDGET);
    const code: string = ycListedCode(expected, codes, c.key);
    const listed: boolean = code !== "";
    if (why === "") {
      passed += 1;
      if (listed) {
        t.fail(`${c.key} passes`, "it is listed as an expected failure: take it off the list");
        regressions += 1;
      }
    } else if (!listed) {
      t.fail(`${c.key} passes`, why);
      regressions += 1;
    } else if (!why.startsWith(`${code} at `)) {
      t.fail(`${c.key} fails on ${code}`, why);
      regressions += 1;
    }
  }
  const keys: string[] = [];
  for (const c of cases) {
    keys.push(c.key);
  }
  for (const id of expected) {
    if (!ycListed(keys, id)) {
      t.fail(`expected failure ${id} is a case`, "no case has this id");
      regressions += 1;
    }
  }
  t.eqI32("every case passes but the expected failures", regressions, 0);
  console.log(`${passed} of ${cases.length} cases pass`);
  t.eqI32("the pass count is the pinned one", passed, YC_PINNED_PASSES);
  return t.done();
};
