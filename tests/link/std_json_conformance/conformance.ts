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
import { JcOutcome, jcPack, jcRewrite, jcStringify, jcUnpack } from "./rewrite";

const JC_TEST262_PATH: string = "tests/json-conformance/test262.txt";
const JC_V8_PATH: string = "tests/json-conformance/v8.txt";
const JC_DIVERGENCES_PATH: string = "tests/json-conformance/divergences.txt";

/** How many cases each data file holds, at the upstream commit its header names. */
const JC_TEST262_CASES: i32 = 772;
const JC_V8_CASES: i32 = 66220;

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

/** The index of the first space in `s` from `from`, or `s.length`. */
const jcNextSpace = (s: string, from: i32): i32 => {
  const space: i32 = 32;
  const n: i32 = toI32(s.length);
  let i: i32 = from;
  while (i >= 0 && i < n && toI32(s.charCodeAt(i)) !== space) {
    i += 1;
  }
  return i < n ? i : n;
};

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
const jcSameBytes = (out: u8[], len: i32, want: u8[]): boolean => {
  if (len !== toI32(want.length) || len > toI32(out.length)) {
    return false;
  }
  for (let i: i32 = 0; i < len && i < toI32(out.length) && i < toI32(want.length); i += 1) {
    if (out[i] !== want[i]) {
      return false;
    }
  }
  return true;
};

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
    // A refusal is the tokenizer's: a writer's refusal of a text JSON.parse refuses is no answer.
    return o.error !== "" && o.error !== JC_BAD_DATA && !o.error.startsWith("write ");
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

/** Whether `o` is the answer reason `r` says a case listed under it gives instead. */
const jcDivergesAs = (c: JcCase, o: JcOutcome, r: JcReason): boolean => {
  if (r.answer === "text") {
    return o.error === "" && !jcMatches(c, o);
  }
  if (r.answer === "unindented") {
    const want = jcUnpack(c.expected);
    const gap: u8[] | null = c.op.startsWith("indent:") ? jcUnpack(c.op.substring(7)) : null;
    return (
      o.error === "" && want !== null && gap !== null && !jcMatches(c, o) && jcSameBytes(o.out, o.len, jcUnindent(want, gap))
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
 * Judges one case: `0` when it answers as it should (upstream's value, or the
 * divergence its reason names), `1` when it is unlisted and differs, `2` when
 * it is listed but answers upstream's value, `3` when it is listed but differs
 * in another way than its reason says. A function of its own so that each
 * case's allocations are released when it returns.
 */
const jcJudge = (c: JcCase, r: JcReason | null): i32 => {
  const o = jcOutcome(c);
  const matches: boolean = jcMatches(c, o);
  if (r === null) {
    return matches ? 0 : 1;
  }
  if (matches) {
    return 2;
  }
  return jcDivergesAs(c, o, r) ? 0 : 3;
};

/** The failed check's line for one case. */
const jcExplain = (c: JcCase, verdict: i32): string => {
  const what: string[] = ["", "answers", "is listed but answers as upstream:", "answers otherwise than its reason says:"];
  const expected: string = c.expected.length > 80 ? `${c.expected.slice(0, 80)}...` : c.expected;
  return `${c.name} ${what[verdict]} ${jcAnswer(jcOutcome(c))}, upstream ${expected}`;
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
  problems: string[];

  constructor() {
    this.reasons = [];
    this.reasonOf = new Map<string, i32>();
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
      reg.reasons.push(new JcReason(line.slice(a + 1, b), line.slice(b + 1, c), line.substring(c + 1)));
      continue;
    }
    const name = line.slice(0, a);
    const key = line.substring(a + 1);
    let found: i32 = -1;
    for (let i: i32 = 0; i < toI32(reg.reasons.length); i += 1) {
      if (reg.reasons[i].key === key) {
        found = i;
      }
    }
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

export const jcConformance = (t: Suite): void => {
  const test262 = jcLoadCases(JC_TEST262_PATH);
  const v8 = jcLoadCases(JC_V8_PATH);
  const okCounts: boolean =
    t.eqI32(`the data: ${JC_TEST262_PATH} holds ${JC_TEST262_CASES} cases`, toI32(test262.length), JC_TEST262_CASES) &&
    t.eqI32(`the data: ${JC_V8_PATH} holds ${JC_V8_CASES} cases`, toI32(v8.length), JC_V8_CASES);
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
      const verdict: i32 = jcJudge(c, r);
      if (at >= 0 && at < toI32(listedCounts.length) && at < toI32(listedFailures.length)) {
        listedCounts[at] = listedCounts[at] + 1;
        if (verdict !== 0 && toI32(listedFailures[at].length) < JC_SHOWN) {
          listedFailures[at].push(jcExplain(c, verdict));
        }
        continue;
      }
      for (const g of groups) {
        if (c.name.startsWith(g.upstream) && (c.op === "parse") === g.parse) {
          g.count += 1;
          if (verdict !== 0 && toI32(g.failures.length) < JC_SHOWN) {
            g.failures.push(jcExplain(c, verdict));
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
  const regName = "divergences.txt: every line names a case once, under a reason it defines";
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
