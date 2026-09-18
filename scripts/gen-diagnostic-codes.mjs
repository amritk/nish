#!/usr/bin/env node
/**
 * Generate the stable diagnostic-code registry that both compilers use for the
 * `code` field of `--json`.
 *
 * Why generated rather than written by hand: the registry has to be identical
 * in `src/` and `self/` (like `branding.ts`, and for the same reason -- the
 * oracles compare the two compilers' output byte for byte), and it has to stay
 * in step with the diagnostics the compiler actually has. Deriving it from the
 * source means a new diagnostic without a code is a failing check rather than
 * something noticed a release later.
 *
 * Why the numbers never move: a code is only worth keying on if it means the
 * same thing next release. This script *preserves* every assignment already in
 * `src/codes.ts` and only appends numbers for fragments it has not seen, one
 * past the highest in that band. A retired fragment keeps its number reserved;
 * the number is never reused for a different rule.
 *
 *   node scripts/gen-diagnostic-codes.mjs            rewrite both files
 *   node scripts/gen-diagnostic-codes.mjs --check    exit 1 if either is stale
 *
 * The bands mirror the pipeline (`.claude/architecture.md`):
 *
 *   NL0001         a syntax error; the text is the `typescript` package's, not
 *                  ours, so every one of them shares the code
 *   NL0002         the C toolchain `--link` needs could not be used (exit 3)
 *   NL0003         an internal compiler error (exit 70)
 *   NL1xxx         Phase 0, the forbidden-syntax sweep (`src/validator.ts`)
 *   NL2xxx         the checker: signatures, bodies, types
 *   NL3xxx         the driver and module loading
 *   NL4xxx         the interop sidecar generators
 *   NL9xxx         WP15 section 8 performance warnings
 *   NL0000         no rule matched: a diagnostic that has no code yet
 *
 * A fragment is the longest literal run of the message's template -- the rule
 * stated in words, with every interpolated name, type and count removed. It is
 * matched as a substring, because plenty of messages open with the thing they
 * are about (`Operator \`${op}\` requires ...`) and only say which rule was
 * broken after it.
 *
 * Cutting at the interpolations is also what keeps the project's name out of
 * this file: "... is forbidden in ${LANGUAGE}" contributes the run before the
 * name, never the name, so `branding.ts` stays the only place it is spelled
 * (rule 5 in `.claude/orientation.md`).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGE0 = path.join(ROOT, "src", "codes.ts");
const STAGE1 = path.join(ROOT, "self", "codes.ts");

/** Which band a file's diagnostics belong to. */
const bandOf = (file) => {
  if (file === "src/validator.ts") return 1;
  if (file.startsWith("src/checker/") || file === "src/types.ts") return 2;
  if (file.startsWith("src/interop/")) return 4;
  return 3; // compilation.ts, index.ts, codegen/*
};

/**
 * The WP15 section 8 rules, and the whole of the class: the scan below passes
 * over every literal handed to `reportPerformance`, wherever it is written, so
 * a wording reaches the registry through this list or not at all. That is
 * deliberate -- a message there opens with the interpolated name of the thing
 * it is about as often as not, and `codeFor` matches these with `indexOf`
 * rather than `startsWith`. Keep each fragment distinctive and inside one
 * literal run of its message.
 *
 * Nine of the ten live in `src/checker/performance.ts`; the tenth, wasteful
 * struct padding, is decided in pass 1 beside the layout it is about and so
 * lives in `src/checker/classes.ts`, among that file's NL2xxx checker rules.
 * The sink is what bands it, not the path.
 */
const PERFORMANCE = [
  "is rebuilt from its own value on every iteration of this loop",
  "allocates a dynamically sized array on every iteration of this loop",
  "already holds an allocation and this one drops it",
  "this computes with overflow: the result",
  "is computed in i32 and wraps before",
  "is at or beyond the",
  "is not proven to be in range for",
  "is not provably within",
  "is called here inside a loop and",
  "are padding the alignment rules insert and nothing reads",
];

/** Every `.ts` under a directory, in a stable order. */
const sources = (dir) => {
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (p.endsWith(".ts")) out.push(p);
    }
  };
  walk(dir);
  return out;
};

/**
 * The literal leading text of every diagnostic message in `src/`, cut at the
 * first interpolation, with the band it belongs to. A fragment reached from two
 * bands takes the lower one, so a rule shared by the validator and the checker
 * is a Phase 0 code.
 */
const collect = () => {
  const found = new Map();
  const call = /(\bfail|\berror|ctx\.error|\.error|reportPerformance|new CompileError|new StaticSyntaxError)\(\s*(`(?:[^`\\]|\\.)*?`|"(?:[^"\\]|\\.)*?")/gs;
  // Some messages never appear at a call: the validator keeps tables of them
  // keyed by the name it refuses (`Reflect`, `globalThis`, `Function`). Any
  // template mentioning the language name is one of ours, wherever it sits.
  const table = /(`(?:[^`\\]|\\.)*?\$\{LANGUAGE\}(?:[^`\\]|\\.)*?`)/gs;
  for (const abs of sources(path.join(ROOT, "src"))) {
    const file = path.relative(ROOT, abs).split(path.sep).join("/");
    // Not its own output: the generated header quotes the very patterns this
    // scans for, and a generator that reads what it wrote grows a rule per run.
    if (file === "src/codes.ts") continue;
    // Every message in this file is a WP15 section 8 warning, so neither scan
    // has anything to find here that the hand-written list above does not
    // already hold -- including the `${LANGUAGE}` templates, which the `table`
    // pattern would otherwise pick up as error rules.
    if (file === "src/checker/performance.ts") continue;
    const text = fs.readFileSync(abs, "utf8");
    for (const m of [...text.matchAll(call), ...text.matchAll(table)]) {
      // `call` captures the sink in group 1 and the literal in group 2; `table`
      // has only the literal. A message handed to `reportPerformance` is a WP15
      // section 8 wording, which is band 9 wherever it is written, so it is
      // registered above by hand rather than banded by the path of the file it
      // sits in -- otherwise the padding rule in `src/checker/classes.ts` would
      // pick up a second, unreachable NL2xxx code beside its NL9010.
      if (m[1] === "reportPerformance") continue;
      let lit = m[2] ?? m[1];
      const template = lit[0] === "`";
      lit = lit.slice(1, -1);
      // The *longest* literal run of the template, not the first: many messages
      // open with the thing they are about (`Operator \`${op}\` requires ...`,
      // `Field \`${f}\` of class ...`), so the head is empty or too short to
      // identify anything, while the run after it is the rule in words.
      const chunks = template ? lit.split(/\$\{[^}]*\}/g) : [lit];
      lit = chunks.sort((a, b) => b.length - a.length)[0] ?? "";
      lit = lit.replace(/\\`/g, "`").replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
      // Too short to identify a rule on its own: it would match half the suite.
      // Such a diagnostic stays NL0000 until its wording grows something to key
      // on -- honest about the gap rather than guessing.
      if (lit.trim().length < 10) continue;
      const band = bandOf(file);
      const prev = found.get(lit);
      if (prev === undefined || band < prev) found.set(lit, band);
    }
  }
  return found;
};

/** Read the assignments already committed, so the numbers survive a regeneration. */
const existing = () => {
  const assigned = new Map();
  if (!fs.existsSync(STAGE0)) return assigned;
  const text = fs.readFileSync(STAGE0, "utf8");
  // The emitted shape: a fragment line, then its code line. Parsed back so a
  // regeneration keeps every number it already handed out -- the whole promise
  // of a code is that it does not move.
  for (const m of text.matchAll(/^ {4}("(?:[^"\\]|\\.)*"),\n {4}"(NL\d{4})",$/gm)) {
    assigned.set(JSON.parse(m[1]), m[2]);
  }
  return assigned;
};

const build = () => {
  const found = collect();
  const assigned = existing();

  // Highest number used in each band, so an appended rule never reuses one.
  const highest = new Map();
  for (const code of assigned.values()) {
    const band = Number(code[2]);
    const n = Number(code.slice(3));
    if (!highest.has(band) || highest.get(band) < n) highest.set(band, n);
  }

  const entries = [];
  for (const [fragment, band] of found) {
    entries.push({ fragment, band, perf: false });
  }
  for (const fragment of PERFORMANCE) entries.push({ fragment, band: 9, perf: true });

  // A rule that no longer exists keeps its entry, and with it its number. The
  // alternative -- dropping the line -- would let the next new rule be handed a
  // number a released compiler had already used for something else, which is
  // the one thing a stable code may not do. A retired fragment matches nothing,
  // so carrying it costs a string.
  const live = new Set(entries.map((e) => e.fragment));
  for (const [fragment, code] of assigned) {
    if (live.has(fragment)) continue;
    entries.push({ fragment, band: Number(code[2]), perf: code.startsWith("NL9"), retired: true });
  }

  // Assign in a deterministic order so a fresh generation is reproducible,
  // then let the committed assignments win.
  entries.sort((a, b) => a.band - b.band || a.fragment.localeCompare(b.fragment));
  for (const e of entries) {
    const already = assigned.get(e.fragment);
    if (already !== undefined) {
      e.code = already;
      continue;
    }
    const next = (highest.get(e.band) ?? 0) + 1;
    highest.set(e.band, next);
    e.code = `NL${e.band}${String(next).padStart(3, "0")}`;
  }

  // Longest fragment first: a specific rule must win over a general one it
  // contains ("Cannot assign to `length` of " over "Cannot assign ").
  entries.sort((a, b) => b.fragment.length - a.fragment.length || a.fragment.localeCompare(b.fragment));
  return entries;
};

const HEADER = `/**
 * Stable diagnostic codes: the \`code\` field of every \`--json\` object.
 *
 * GENERATED by scripts/gen-diagnostic-codes.mjs -- do not edit by hand. Run the
 * script after adding a diagnostic; \`npm test\` fails while this file is stale.
 *
 * A code is a promise: NL2043 means the same rule next release as it does now.
 * \`NL\` is for Nish Lang -- the language is \`Nish\` everywhere a human reads it,
 * and \`Nish Lang\` is the longer form the project uses where a bare name would
 * be ambiguous, the way Rust writes \`rust-lang\`. The prefix is a literal here
 * rather than a value from \`branding.ts\`: a code is matched on by tooling that
 * has to keep working across a rename, so it is frozen by design.
 * The generator therefore only ever *appends* numbers, and a retired rule keeps
 * its number reserved. The bands follow the pipeline: NL0001 a syntax error,
 * NL1xxx Phase 0, NL2xxx the checker, NL3xxx the driver, NL4xxx the interop
 * sidecars, NL9xxx a WP15 section 8 performance warning, and NL0000 a
 * diagnostic no rule matched yet.
 *
 * Codes are carried in \`--json\` only. The human summary line
 * \`file:line:col: error: <text>\` is unchanged and stays byte-for-byte what it
 * has always been, because the \`.err\` goldens and \`tests/self/reject_oracle.js\`
 * match on it.
 *
 * A fragment is the longest literal run of a message's template -- the rule in
 * words, with the interpolated names, types and counts removed -- and is matched
 * as a substring, because many messages open with the thing they are about and
 * name the broken rule only afterwards. Cutting at the interpolations is also
 * why no fragment here spells the project's name: "... is forbidden in
 * \${LANGUAGE}" contributes the run before the name, leaving \`branding.ts\` the
 * only place it lives.
 */`;

const stage0Source = (entries) => {
  const perf = entries.filter((e) => e.perf);
  const rules = entries.filter((e) => !e.perf);
  const rows = (list) =>
    list.map((e) => `    ${JSON.stringify(e.fragment)},\n    "${e.code}",`).join("\n");
  return `${HEADER}

/** No rule matched: the diagnostic has no code yet. */
export const UNCODED = "NL0000";

/** Every syntax error shares one code: the text is the \`typescript\` package's, not ours. */
export const SYNTAX = "NL0001";

/**
 * Band 0 is what is wrong with the *run* rather than with the program: the C
 * toolchain \`--link\` needs could not be used (exit 3), and an internal compiler
 * error (exit 70). Neither has a source location, so their \`--json\` object
 * carries \`code\`, \`severity\` and \`message\` and nothing else.
 */
export const TOOLCHAIN = "NL0002";
export const INTERNAL = "NL0003";

/**
 * Fragment, code, fragment, code -- flat rather than tuples so the stage1 twin
 * can hold it too (Nish has no tuple type). Longest fragment first, so a
 * specific rule wins over a general one it contains.
 */
const RULES: string[] = [
${rows(rules)}
];

/** The WP15 section 8 rules, matched by substring: their message opens with a variable name. */
const PERFORMANCE_RULES: string[] = [
${rows(perf)}
];

/** Number of rules that carry a code; \`tests/run.js\` reports it. */
export const RULE_COUNT = ${rules.length + perf.length};

/**
 * The code for one diagnostic. \`kind\` is the word in the summary line
 * (\`error\`, \`syntax error\`, \`performance\`) and \`text\` the message without
 * its location prefix.
 */
export const codeFor = (kind: string, text: string): string => {
  if (kind === "syntax error") return SYNTAX;
  if (kind === "performance") {
    for (let i = 0; i < PERFORMANCE_RULES.length; i += 2) {
      if (text.indexOf(PERFORMANCE_RULES[i]) >= 0) return PERFORMANCE_RULES[i + 1];
    }
    return UNCODED;
  }
  for (let i = 0; i < RULES.length; i += 2) {
    if (text.includes(RULES[i])) return RULES[i + 1];
  }
  return UNCODED;
};
`;
};

const stage1Source = (entries) => {
  const perf = entries.filter((e) => e.perf);
  const rules = entries.filter((e) => !e.perf);
  const rows = (list) =>
    list.map((e) => `  ${JSON.stringify(e.fragment)},\n  "${e.code}",`).join("\n");
  // Nish has no module-level array constant (a constant's initialiser
  // must be a literal or arithmetic over one), so each table is a function
  // returning its literal, the idiom `self/target.ts` already uses.
  return `${HEADER}

/** No rule matched: the diagnostic has no code yet. */
export const UNCODED: string = "NL0000";

/** Every syntax error shares one code: stage0 takes that text from the \`typescript\` package. */
export const SYNTAX: string = "NL0001";

/**
 * Band 0 is what is wrong with the *run* rather than with the program: the C
 * toolchain \`--link\` needs could not be used (exit 3), and an internal compiler
 * error (exit 70). Neither has a source location.
 */
export const TOOLCHAIN: string = "NL0002";
export const INTERNAL: string = "NL0003";

/** Number of rules that carry a code; \`tests/run.js\` checks it against stage0's. */
export const RULE_COUNT: i32 = ${rules.length + perf.length};

/**
 * Fragment, code, fragment, code -- flat because the language has no tuple, and
 * a function rather than a module constant because a constant's initialiser
 * must be a literal (\`self/target.ts\` holds its table the same way). The
 * function is an arrow bound to a \`const\`, which is how \`self/\` declares one
 * since WP22 stage C; a concise body is exactly what a table-returning function
 * wants. Longest fragment first, so a specific rule wins over a general one it
 * contains.
 */
export const diagnosticRules = (): string[] => [
${rows(rules)}
];

/** The WP15 section 8 rules, matched by substring: their message opens with a variable name. */
export const performanceRules = (): string[] => [
${rows(perf)}
];

/**
 * The code for one diagnostic. \`kind\` is the word in the summary line
 * (\`error\`, \`syntax error\`, \`performance\`) and \`text\` the message without
 * its location prefix.
 */
export const codeFor = (kind: string, text: string): string => {
  if (kind === "syntax error") {
    return SYNTAX;
  }
  if (kind === "performance") {
    const perf: string[] = performanceRules();
    let i: i32 = 0;
    while (i < perf.length) {
      if (text.indexOf(perf[i]) >= 0) {
        return perf[i + 1];
      }
      i = i + 2;
    }
    return UNCODED;
  }
  const rules: string[] = diagnosticRules();
  let j: i32 = 0;
  while (j < rules.length) {
    if (text.indexOf(rules[j]) >= 0) {
      return rules[j + 1];
    }
    j = j + 2;
  }
  return UNCODED;
};
`;
};

const entries = build();
const want = [
  [STAGE0, stage0Source(entries)],
  [STAGE1, stage1Source(entries)],
];

if (process.argv.includes("--check")) {
  let stale = false;
  for (const [file, text] of want) {
    const have = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    if (have !== text) {
      console.error(`error: ${path.relative(ROOT, file)} is out of date; run node scripts/gen-diagnostic-codes.mjs`);
      stale = true;
    }
  }
  process.exit(stale ? 1 : 0);
}

for (const [file, text] of want) fs.writeFileSync(file, text);
console.log(`wrote src/codes.ts and self/codes.ts (${entries.length} rules)`);
