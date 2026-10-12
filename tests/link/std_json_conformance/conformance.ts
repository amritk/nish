// test262's and V8's JSON.parse and JSON.stringify cases, kept as data in
// tests/json-conformance/ (extract.js there says how they were taken and what a
// line holds), run through the tokenizer and the writer. A parse case is the
// text rewritten (rewrite.ts); a stringify case is the value its words spell,
// written. Every case answers as upstream expects or is named in
// divergences.txt, whose reasons each say what the case must answer instead;
// nothing is skipped.
import { JSON_TOK_END, JSON_TOK_NUMBER, JsonLimits, JsonTokenizer } from "nish/json-tokenizer";
import { splitLines } from "nish/text";
import { Suite } from "nish/testing";
import { JcOutcome, jcNextSpace, jcPack, jcRewrite, jcStringify, jcUnpack } from "./rewrite";

const JC_TEST262_PATH: string = "tests/json-conformance/test262.txt";
const JC_V8_PATH: string = "tests/json-conformance/v8.txt";
const JC_DIVERGENCES_PATH: string = "tests/json-conformance/divergences.txt";

/** How many cases each data file holds, at the upstream commit its header names. */
const JC_TEST262_CASES: i32 = 772;
const JC_V8_CASES: i32 = 684;
/** How many upstream files those cases come from; each data file's header lists them. */
const JC_TEST262_FILES: i32 = 64;
const JC_V8_FILES: i32 = 9;

/**
 * The tokenizer's refusals that are about the grammar. A case JSON.parse
 * refuses must be refused for one of these: a refusal by a limit (DEPTH, the
 * byte limits) or of the window is no agreement, and such a case is listed.
 */
const JC_GRAMMAR_ERRORS: string = ",SYNTAX,TRUNCATED,TRAILING,UTF8,ESCAPE,SURROGATE,CONTROL,NUMBER,";

/** What a case answers when its packed input does not unpack, which no expected value matches. */
const JC_BAD_DATA: string = "malformed data";

/** How many failing names a check prints before it stops. */
const JC_SHOWN: i32 = 20;

/** One line of a data file: `<name> <op> <expected> <input>`, the last three still packed or as words. */
class JcCase {
  name: string;
  op: string;
  expected: string;
  input: string;

  constructor(name: string, op: string, expected: string, input: string) {
    this.name = name;
    this.op = op;
    this.expected = expected;
    this.input = input;
  }
}

/**
 * One reason of divergences.txt: `reason <key> <answer> <sentence>`. `answer`
 * is what a case listed under it must answer instead of upstream's value:
 * `unindented`, the expected text with the indentation its gap made taken out
 * (an indented stringify, which the writer does not write); `text`, a whole text
 * other than the expected one; or a comma-separated list of the error names
 * one of which the rewrite must stop at.
 */
class JcReason {
  key: string;
  answer: string;
  sentence: string;

  constructor(key: string, answer: string, sentence: string) {
    this.key = key;
    this.answer = answer;
    this.sentence = sentence;
  }
}

/** Every case of the data file at `path`, in file order; empty when it is missing. */
const jcLoadCases = (path: string): JcCase[] => {
  const cases: JcCase[] = [];
  const text = readFileSyncOrNull(path);
  if (text === null) {
    return cases;
  }
  for (const line of splitLines(text)) {
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    const n: i32 = toI32(line.length);
    const a: i32 = jcNextSpace(line, 0);
    const b: i32 = jcNextSpace(line, a + 1);
    const c: i32 = jcNextSpace(line, b + 1);
    if (c >= n) {
      return [];
    }
    cases.push(new JcCase(line.slice(0, a), line.slice(a + 1, b), line.slice(b + 1, c), line.slice(c + 1, n)));
  }
  return cases;
};

/** Whether `out[0, len)` is exactly `want`. */
const jcSameBytes = (out: u8[], len: i32, want: u8[]): boolean =>
  len === toI32(want.length) && len <= toI32(out.length) && jcGapAt(out, 0, want);

/**
 * An indented `text` with its indentation taken out, as `JSON.stringify(v,
 * null, gap)` puts it in: outside a string, each newline and the copies of
 * `gap` after it, and the one space after each colon.
 */
const jcUnindent = (text: u8[], gap: u8[]): u8[] => {
  const quote: i32 = 34;
  const backslash: i32 = 92;
  const colon: i32 = 58;
  const newline: i32 = 10;
  const space: i32 = 32;
  const g: i32 = toI32(gap.length);
  const out: u8[] = [];
  let inString: boolean = false;
  let escaped: boolean = false;
  let i: i32 = 0;
  while (i >= 0 && i < toI32(text.length)) {
    const c: i32 = toI32(text[i]);
    i += 1;
    if (inString) {
      inString = escaped || c !== quote;
      escaped = !escaped && c === backslash;
    } else if (c === quote) {
      inString = true;
    } else if (c === newline) {
      while (g > 0 && jcGapAt(text, i, gap)) {
        i += g;
      }
      continue;
    } else if (c === colon && i < toI32(text.length) && toI32(text[i]) === space) {
      i += 1;
    }
    out.push(toU8(c));
  }
  return out;
};

/** Whether `gap` stands in `text` at `at`. */
const jcGapAt = (text: u8[], at: i32, gap: u8[]): boolean => {
  if (at < 0 || at > toI32(text.length) - toI32(gap.length)) {
    return false;
  }
  for (let k: i32 = 0; k < toI32(gap.length) && at + k < toI32(text.length); k += 1) {
    if (text[at + k] !== gap[k]) {
      return false;
    }
  }
  return true;
};

/** Whether the parse text `src` is one number token whose double is negative zero. */
const jcIsNegativeZero = (src: u8[]): boolean => {
  const t = new JsonTokenizer(src, 0, toI32(src.length), new JsonLimits());
  if (t.next() !== JSON_TOK_NUMBER) {
    return false;
  }
  const negative: boolean = f64ToBits(t.numberF64()) < toI64(0);
  return negative && t.next() === JSON_TOK_END;
};

/** What the case answers: its text rewritten, or the value its words spell, written. */
const jcOutcome = (c: JcCase): JcOutcome => {
  if (c.op === "parse") {
    const src = jcUnpack(c.input);
    return src === null ? new JcOutcome(JC_BAD_DATA, [], 0) : jcRewrite(src);
  }
  return jcStringify(c.input);
};

/** Whether `o` is the answer upstream expects of `c`. */
const jcMatches = (c: JcCase, o: JcOutcome): boolean => {
  if (c.expected === "throws") {
    return o.error !== "" && JC_GRAMMAR_ERRORS.indexOf(`,${o.error},`) >= 0;
  }
  if (o.error !== "") {
    return false;
  }
  if (c.expected === "-0") {
    const src = jcUnpack(c.input);
    return src !== null && jcIsNegativeZero(src) && jcSameBytes(o.out, o.len, [toU8(48)]);
  }
  const want = jcUnpack(c.expected);
  return want !== null && jcSameBytes(o.out, o.len, want);
};

/** Whether `o`, which is not upstream's answer, is the one reason `r` says a case listed under it gives instead. */
const jcDivergesAs = (c: JcCase, o: JcOutcome, r: JcReason, exact: string): boolean => {
  if (r.answer === "exact") {
    return o.error === "" && jcPack(o.out, o.len) === exact;
  }
  if (r.answer === "unindented") {
    const want = jcUnpack(c.expected);
    const gap: u8[] | null = c.op.startsWith("indent:") ? jcUnpack(c.op.substring(7)) : null;
    return (
      o.error === "" && want !== null && gap !== null && jcSameBytes(o.out, o.len, jcUnindent(want, gap))
    );
  }
  return o.error !== "" && `,${r.answer},`.indexOf(`,${o.error},`) >= 0;
};

/** What the case answered, short, for a failed check's message. */
const jcAnswer = (o: JcOutcome): string => {
  if (o.error !== "") {
    return o.error;
  }
  const shown: i32 = o.len < 80 ? o.len : 80;
  return `${jcPack(o.out, shown)}${shown < o.len ? "..." : ""}`;
};

/**
 * Judges one case: `""` when it answers as it should (upstream's value, or the
 * divergence its reason names), or the failed check's line for it. A function
 * of its own so that each case's allocations are released when it returns.
 */
const jcJudge = (c: JcCase, r: JcReason | null, exact: string): string => {
  const o = jcOutcome(c);
  const matches: boolean = jcMatches(c, o);
  let what: string = "";
  if (r === null) {
    what = matches ? "" : "answers";
  } else if (matches) {
    what = "is listed but answers as upstream:";
  } else if (!jcDivergesAs(c, o, r, exact)) {
    what = "answers otherwise than its reason says:";
  }
  if (what === "") {
    return "";
  }
  const expected: string = c.expected.length > 80 ? `${c.expected.slice(0, 80)}...` : c.expected;
  return `${c.name} ${what} ${jcAnswer(o)}, upstream ${expected}`;
};

/** One group of cases reported together: an upstream and an operation. */
class JcGroup {
  label: string;
  upstream: string;
  parse: boolean;
  count: i32 = 0;
  failures: string[];

  constructor(label: string, upstream: string, parse: boolean) {
    this.label = label;
    this.upstream = upstream;
    this.parse = parse;
    this.failures = [];
  }
}

/** The divergence register: its reasons, and the reason of each case it names, by name. */
class JcRegister {
  reasons: JcReason[];
  reasonOf: Map<string, i32>;
  /** The packed text a case listed under an `exact` reason must answer, by name. */
  textOf: Map<string, string>;
  /** Each reason's index in `reasons`, by key. */
  reasonAt: Map<string, i32>;
  problems: string[];

  constructor() {
    this.reasons = [];
    this.reasonOf = new Map<string, i32>();
    this.textOf = new Map<string, string>();
    this.reasonAt = new Map<string, i32>();
    this.problems = [];
  }
}

/** divergences.txt, read; a malformed line, an unknown reason or a name listed twice is a problem. */
const jcLoadRegister = (): JcRegister => {
  const reg = new JcRegister();
  const text = readFileSyncOrNull(JC_DIVERGENCES_PATH);
  if (text === null) {
    reg.problems.push(`no ${JC_DIVERGENCES_PATH}`);
    return reg;
  }
  for (const line of splitLines(text)) {
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    const a: i32 = jcNextSpace(line, 0);
    const b: i32 = jcNextSpace(line, a + 1);
    if (line.startsWith("reason ")) {
      const c: i32 = jcNextSpace(line, b + 1);
      const reasonKey = line.slice(a + 1, b);
      if (reg.reasonAt.has(reasonKey)) {
        reg.problems.push(`reason ${reasonKey}: defined twice`);
      }
      reg.reasonAt.set(reasonKey, toI32(reg.reasons.length));
      reg.reasons.push(new JcReason(reasonKey, line.slice(b + 1, c), line.substring(c + 1)));
      continue;
    }
    const name = line.slice(0, a);
    const key = line.slice(a + 1, b);
    if (b < toI32(line.length)) {
      reg.textOf.set(line.slice(0, a), line.substring(b + 1));
    }
    const found: i32 = reg.reasonAt.get(key) ?? -1;
    if (found < 0) {
      reg.problems.push(`${name}: no reason ${key}`);
    } else if (reg.reasonOf.has(name)) {
      reg.problems.push(`${name}: listed twice`);
    } else {
      reg.reasonOf.set(name, found);
    }
  }
  return reg;
};

/** How many upstream files `cases` come from: the distinct names before `#`. */
const jcFileCount = (cases: JcCase[]): i32 => {
  const files = new Set<string>();
  for (const c of cases) {
    files.add(c.name.slice(0, toI32(c.name.indexOf("#"))));
  }
  return toI32(files.size);
};

export const jcConformance = (t: Suite): void => {
  const test262 = jcLoadCases(JC_TEST262_PATH);
  const v8 = jcLoadCases(JC_V8_PATH);
  const okCounts: boolean =
    t.eqI32(`the data: ${JC_TEST262_PATH} holds ${JC_TEST262_CASES} cases`, toI32(test262.length), JC_TEST262_CASES) &&
    t.eqI32(`the data: ${JC_V8_PATH} holds ${JC_V8_CASES} cases`, toI32(v8.length), JC_V8_CASES);
  t.eqI32(`the data: ${JC_TEST262_PATH}'s cases come from ${JC_TEST262_FILES} upstream files`, jcFileCount(test262), JC_TEST262_FILES);
  t.eqI32(`the data: ${JC_V8_PATH}'s cases come from ${JC_V8_FILES} upstream files`, jcFileCount(v8), JC_V8_FILES);
  const reg = jcLoadRegister();
  if (!okCounts) {
    return;
  }
  const groups: JcGroup[] = [
    new JcGroup("test262 JSON.parse", "test262/", true),
    new JcGroup("test262 JSON.stringify", "test262/", false),
    new JcGroup("V8 JSON.parse", "v8/", true),
    new JcGroup("V8 JSON.stringify", "v8/", false),
  ];
  const listedCounts: i32[] = [];
  const listedFailures: string[][] = [];
  for (const _r of reg.reasons) {
    listedCounts.push(0);
    listedFailures.push([]);
  }
  const seen = new Set<string>();
  for (const upstream of [test262, v8]) {
    for (const c of upstream) {
      seen.add(c.name);
      const at: i32 = reg.reasonOf.get(c.name) ?? -1;
      const r: JcReason | null = at >= 0 && at < toI32(reg.reasons.length) ? reg.reasons[at] : null;
      const failure: string = jcJudge(c, r, reg.textOf.get(c.name) ?? "");
      if (at >= 0 && at < toI32(listedCounts.length) && at < toI32(listedFailures.length)) {
        listedCounts[at] = listedCounts[at] + 1;
        if (failure !== "" && toI32(listedFailures[at].length) < JC_SHOWN) {
          listedFailures[at].push(failure);
        }
        continue;
      }
      for (const g of groups) {
        if (c.name.startsWith(g.upstream) && (c.op === "parse") === g.parse) {
          g.count += 1;
          if (failure !== "" && toI32(g.failures.length) < JC_SHOWN) {
            g.failures.push(failure);
          }
        }
      }
    }
  }
  for (const g of groups) {
    const name = `${g.label}: each of the ${g.count} cases divergences.txt does not list answers as upstream`;
    if (toI32(g.failures.length) === 0) {
      t.pass(name);
    } else {
      t.fail(name, g.failures.join("\n      "));
    }
  }
  for (let i: i32 = 0; i < toI32(reg.reasons.length) && i < toI32(listedCounts.length) && i < toI32(listedFailures.length); i += 1) {
    const r = reg.reasons[i];
    const name = `divergence ${r.key}: each of the ${listedCounts[i]} cases listed answers ${r.answer}, not upstream's value`;
    if (listedCounts[i] > 0 && toI32(listedFailures[i].length) === 0) {
      t.pass(name);
    } else {
      t.fail(name, listedCounts[i] === 0 ? "no case is listed under it" : listedFailures[i].join("\n      "));
    }
  }
  for (const name of reg.reasonOf.keys()) {
    if (!seen.has(name)) {
      reg.problems.push(`${name}: listed, but no data file holds it`);
    }
  }
  const regName = "divergences.txt: every line names a case once, under a reason it defines once";
  if (toI32(reg.problems.length) === 0) {
    t.pass(regName);
  } else {
    t.fail(regName, reg.problems.join("\n      "));
  }
};

/**
 * `--mismatches`: every case whose answer is not upstream's, listed or not, as
 * `<name> <op> <answer>`. What a change to the data or to the modules is read
 * against before divergences.txt is edited.
 */
export const jcPrintMismatches = (): number => {
  for (const path of [JC_TEST262_PATH, JC_V8_PATH]) {
    for (const c of jcLoadCases(path)) {
      const o = jcOutcome(c);
      if (!jcMatches(c, o)) {
        console.log(`${c.name} ${c.op} ${jcAnswer(o)}`);
      }
    }
  }
  return 0;
};

/**
 * `--code-units`: V8's json.js stringifies every UTF-16 code unit in one loop,
 * and extract.js leaves those 65,536 cases to be generated here instead of
 * kept as data. For each unit, its `\\uXXXX` literal is read by the tokenizer
 * and the string it decodes to written by the writer, packed; a surrogate
 * prints `!` and the tokenizer's error, the lone-surrogate divergence of
 * divergences.txt. tests/run.js holds each line to Node's JSON.stringify.
 */
export const jcPrintCodeUnits = (): number => {
  const digits = "0123456789abcdef";
  for (let unit: i32 = 0; unit < 65536; unit += 1) {
    const hex = `${digits.substring((unit >> 12) & 15, ((unit >> 12) & 15) + 1)}${digits.substring((unit >> 8) & 15, ((unit >> 8) & 15) + 1)}${digits.substring((unit >> 4) & 15, ((unit >> 4) & 15) + 1)}${digits.substring(unit & 15, (unit & 15) + 1)}`;
    const o = jcStringify(`s:"\\u${hex}"`);
    console.log(o.error === "" ? jcPack(o.out, o.len) : `!${o.error}`);
  }
  return 0;
};
