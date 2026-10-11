// JSONTestSuite's verdicts: every y_ file accepted, every n_ file refused, and
// every i_ file's verdict as tests/json-suite/i-verdicts.txt records it.
import { JsonLimits } from "../../../std/json-tokenizer";
import { Suite } from "../../../std/testing";
import { splitLines } from "../../../std/text";
import { jtTokensOf, jtVerdictOf } from "./common";
import { JT_I_VERDICTS_PATH, JtCase, jtLoadCorpus } from "./corpus";

/** How many files the corpus holds, per class, at the commit `test-parsing.txt` names. */
const JT_Y_FILES: i32 = 95;
const JT_N_FILES: i32 = 188;
const JT_I_FILES: i32 = 35;

/** `name verdict`, the line `--verdicts` prints and `i-verdicts.txt` holds. */
const jtVerdictLine = (c: JtCase): string => `${c.name} ${jtVerdictOf(c.bytes, new JsonLimits())}`;

export const jtCorpusChecks = (t: Suite): void => {
  const corpus = jtLoadCorpus();
  if (!t.eqI32("the corpus: tests/json-suite/test-parsing.txt holds 318 files", toI32(corpus.length), 318)) {
    return;
  }
  let ys: i32 = 0;
  let ns: i32 = 0;
  const yRefused: string[] = [];
  const nAccepted: string[] = [];
  const iLines: string[] = [];
  for (const c of corpus) {
    const verdict = jtVerdictOf(c.bytes, new JsonLimits());
    if (c.name.startsWith("y_")) {
      ys += 1;
      if (verdict !== "END") {
        yRefused.push(`${c.name} ${verdict}`);
      }
    } else if (c.name.startsWith("n_")) {
      ns += 1;
      if (verdict === "END") {
        nAccepted.push(c.name);
      }
    } else {
      iLines.push(`${c.name} ${verdict}`);
    }
  }
  t.eqI32("the corpus: 95 y_ files", ys, JT_Y_FILES);
  t.eqI32("the corpus: 188 n_ files", ns, JT_N_FILES);
  t.eqI32("the corpus: 35 i_ files", toI32(iLines.length), JT_I_FILES);
  if (toI32(yRefused.length) === 0) {
    t.pass("JSONTestSuite: every y_ file is accepted");
  } else {
    t.fail("JSONTestSuite: every y_ file is accepted", yRefused.join(", "));
  }
  if (toI32(nAccepted.length) === 0) {
    t.pass("JSONTestSuite: every n_ file is refused");
  } else {
    t.fail("JSONTestSuite: every n_ file is refused", nAccepted.join(", "));
  }
  const recorded = readFileSyncOrNull(JT_I_VERDICTS_PATH);
  if (recorded === null) {
    t.fail("JSONTestSuite: every i_ verdict is the one i-verdicts.txt records", `no ${JT_I_VERDICTS_PATH}`);
    return;
  }
  const want: string[] = [];
  for (const line of splitLines(recorded)) {
    if (line.length > 0 && !line.startsWith("#")) {
      want.push(line);
    }
  }
  t.eqLines("JSONTestSuite: every i_ verdict is the one i-verdicts.txt records", iLines, want);
};

/** `--verdicts`: every file's verdict, one line each. */
export const jtPrintVerdicts = (): number => {
  for (const c of jtLoadCorpus()) {
    console.log(jtVerdictLine(c));
  }
  return 0;
};

/** `--tokens`: every y_ file's token stream, with strings in hex and numbers as their bits. */
export const jtPrintTokens = (): number => {
  for (const c of jtLoadCorpus()) {
    if (c.name.startsWith("y_")) {
      console.log(`${c.name} ${jtTokensOf(c.bytes, new JsonLimits(), true)}`);
    }
  }
  return 0;
};
