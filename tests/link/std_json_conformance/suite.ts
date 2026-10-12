// JSONTestSuite's y_ files through the rewrite, natively: each must come back a
// whole text, and that text must rewrite to itself. That the rewrite is
// JSON.stringify(JSON.parse(x)) is held by tests/run.js, which has Node's JSON
// to compare with.
import { Suite } from "nish/testing";
import { JC_SUITE_PATH, JcSuiteFile, jcPack, jcRewrite, jcSuiteFiles } from "./rewrite";

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
  const loaded = jcSuiteFiles();
  const files: JcSuiteFile[] = loaded === null ? [] : loaded;
  const problems: string[] = [];
  for (const f of files) {
    const bytes = f.bytes;
    const problem: string = bytes === null ? "does not unpack" : jcRewriteProblem(bytes);
    if (problem !== "") {
      problems.push(`${f.name}: ${problem}`);
    }
  }
  t.eqI32(`JSONTestSuite: ${JC_SUITE_PATH} holds ${JC_Y_FILES} y_ files`, toI32(files.length), JC_Y_FILES);
  const name = "JSONTestSuite: each y_ file rewrites to a whole text, which rewrites to itself";
  if (toI32(files.length) > 0 && toI32(problems.length) === 0) {
    t.pass(name);
  } else {
    t.fail(name, problems.join("\n      "));
  }
};
