// JSONTestSuite's y_ files through the rewrite, natively: each must come back a
// whole text, and that text must rewrite to itself. That the rewrite is
// JSON.stringify(JSON.parse(x)) is held by tests/run.js, which has Node's JSON
// to compare with.
import { splitLines } from "nish/text";
import { Suite } from "nish/testing";
import { JC_SUITE_PATH, jcPack, jcRewrite, jcUnpack } from "./rewrite";

/** How many y_ files the corpus holds at the commit test-parsing.txt names. */
const JC_Y_FILES: i32 = 95;

/** `""` when `bytes` rewrites to a whole text that rewrites to itself, or what went wrong. */
const jcRewriteProblem = (bytes: u8[]): string => {
  const once = jcRewrite(bytes);
  if (once.error !== "") {
    return once.error;
  }
  const text: u8[] = [];
  for (let i: i32 = 0; i < once.len && i < toI32(once.out.length); i += 1) {
    text.push(once.out[i]);
  }
  const twice = jcRewrite(text);
  if (twice.error !== "") {
    return `its rewrite is refused: ${twice.error}`;
  }
  const a = jcPack(once.out, once.len);
  const b = jcPack(twice.out, twice.len);
  return a === b ? "" : `rewrites to ${a}, which rewrites to ${b}`;
};

export const jcSuiteChecks = (t: Suite): void => {
  const text = readFileSyncOrNull(JC_SUITE_PATH);
  const lines: string[] = text === null ? [] : splitLines(text);
  const problems: string[] = [];
  let files: i32 = 0;
  for (const line of lines) {
    if (!line.startsWith("y_")) {
      continue;
    }
    files += 1;
    const space: i32 = toI32(line.indexOf(" "));
    const bytes: u8[] | null = space > 0 ? jcUnpack(line.slice(space + 1)) : null;
    const problem: string = bytes === null ? "does not unpack" : jcRewriteProblem(bytes);
    if (problem !== "") {
      problems.push(`${line.slice(0, space)}: ${problem}`);
    }
  }
  t.eqI32(`JSONTestSuite: ${JC_SUITE_PATH} holds ${JC_Y_FILES} y_ files`, files, JC_Y_FILES);
  const name = "JSONTestSuite: each y_ file rewrites to a whole text, which rewrites to itself";
  if (files > 0 && toI32(problems.length) === 0) {
    t.pass(name);
  } else {
    t.fail(name, problems.join("\n"));
  }
};
