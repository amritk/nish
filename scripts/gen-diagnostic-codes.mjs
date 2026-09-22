#!/usr/bin/env node
/**
 * Check the stable diagnostic-code registry: the `code` field of `--json`.
 *
 *   node scripts/gen-diagnostic-codes.mjs --check    exit 1 if the registry is malformed
 *   node scripts/gen-diagnostic-codes.mjs            the same, then the next free code per band
 *
 * **The registry is kept by hand now.** It used to be generated: this script
 * scanned `src/` for every diagnostic message, cut each at its interpolations,
 * and wrote the same table into `src/codes.ts` and `self/codes.ts`. That scan
 * read stage0's source, and stage0 is deleted (wp19 §5 R6), so the generator
 * was frozen with the table it last wrote and `self/codes.ts` became the
 * registry. A new diagnostic gets its code by hand: append a fragment and the
 * next free number in its band (the second mode above prints those), at the
 * position the ordering rule below puts it. `tests/diagnostic_coverage.js`
 * is what notices a diagnostic that has no code, by counting `NL0000`.
 *
 * What `--check` still holds, because each is what makes a code worth keying
 * on:
 *
 *   - **Every number is well-formed and in its band.** `NL1xxx` Phase 0,
 *     `NL2xxx` the checker, `NL3xxx` the driver, `NL4xxx` the interop
 *     sidecars, `NL9xxx` a WP15 section 8 performance warning. Band 0 is not
 *     in the tables: `NL0000` (no rule matched), `NL0001` (a syntax error),
 *     `NL0002` (the toolchain) and `NL0003` (an internal error) are constants.
 *     A performance fragment is in `performanceRules` and nowhere else.
 *   - **Nothing is used twice.** A number handed out once is never handed to a
 *     different rule, and a retired rule keeps its entry -- it matches nothing,
 *     so carrying it costs a string -- precisely so that its number stays
 *     reserved. Two entries for one fragment would make the second dead.
 *   - **Longest fragment first**, ties in `localeCompare` order, the order the
 *     generator wrote: the compilers take the first fragment the message
 *     contains, so a specific rule has to come before a general one it
 *     contains ("Cannot assign to `length` of " before "Cannot assign ").
 *   - **No fragment too short to identify a rule** (ten characters, trimmed),
 *     which would match half the suite.
 *   - **`RULE_COUNT` is the number of entries.**
 *   - **While `src/codes.ts` exists, it holds the same table**, pair for pair
 *     and in order: the two compilers answer one code for one message.
 *
 * A fragment is the longest literal run of its message's template -- the rule
 * in words, with every interpolated name, type and count removed -- matched as
 * a substring. Cutting at the interpolations is also what keeps the project's
 * name out of the table: "... is forbidden in ${LANGUAGE}" contributes the run
 * before the name, never the name, so `branding.ts` stays the only place it is
 * spelled (rule 5 in `.claude/orientation.md`). Keep to that when adding one.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCodesRegistry } from "./codes-registry.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY = path.join(ROOT, "self", "codes.ts");
const STAGE0 = path.join(ROOT, "src", "codes.ts");

/** The bands a table entry may use. Band 0 is constants, never a table row. */
const BANDS = new Set(["1", "2", "3", "4", "9"]);

/** Shorter than this, a fragment would match half the suite. */
const MIN_FRAGMENT = 10;

/**
 * The text of one table in `self/codes.ts`: from its `name = (): string[] => [`
 * to the `];` that closes it. Parsed per table, because the table a fragment
 * sits in is part of what it means -- a performance rule is matched only
 * against a performance message.
 */
const tableText = (text, name) => {
  const open = text.indexOf(`export const ${name} = (): string[] => [`);
  if (open < 0) return null;
  const close = text.indexOf("\n];", open);
  return close < 0 ? null : text.slice(open, close + 1);
};

/** The order the compilers rely on: longest fragment first, then `localeCompare`. */
const inOrder = (a, b) => b.fragment.length - a.fragment.length || a.fragment.localeCompare(b.fragment);

/** Every rule of `self/codes.ts` it breaks, as a line each; empty when it holds. */
const problems = (text) => {
  const found = [];
  const tables = [];
  for (const [name, perf] of [
    ["diagnosticRules", false],
    ["performanceRules", true],
  ]) {
    const body = tableText(text, name);
    if (body === null) {
      found.push(`self/codes.ts has no \`${name}\` table`);
      continue;
    }
    try {
      tables.push({ name, perf, pairs: parseCodesRegistry(body, `self/codes.ts ${name}`) });
    } catch (err) {
      found.push(err.message);
    }
  }
  const all = tables.flatMap((t) => t.pairs);

  // The tables are the whole registry: a pair the reader finds outside them is
  // one the compilers never match, and one of theirs the reader misses is one
  // `tests/diagnostic_coverage.js` never asks about.
  let whole = [];
  try {
    whole = parseCodesRegistry(text, "self/codes.ts");
  } catch (err) {
    found.push(err.message);
  }
  if (whole.length !== all.length) {
    found.push(`self/codes.ts holds ${whole.length} pairs, ${all.length} of them inside the two tables`);
  }

  for (const { name, perf, pairs } of tables) {
    for (let i = 0; i < pairs.length; i++) {
      const { fragment, code } = pairs[i];
      const band = code[2];
      if (!BANDS.has(band)) found.push(`${code} is not in a table band (1, 2, 3, 4 or 9): ${JSON.stringify(fragment)}`);
      if (perf !== (band === "9")) {
        found.push(`${code} is in \`${name}\`, which holds ${perf ? "only" : "no"} NL9xxx codes`);
      }
      if (fragment.trim().length < MIN_FRAGMENT) {
        found.push(`${code}'s fragment ${JSON.stringify(fragment)} is under ${MIN_FRAGMENT} characters`);
      }
      if (i > 0 && inOrder(pairs[i - 1], pairs[i]) > 0) {
        found.push(`${code} is out of order in \`${name}\`: it has to come before ${pairs[i - 1].code}`);
      }
    }
  }

  const seen = (key) => {
    const counts = new Map();
    for (const pair of all) counts.set(pair[key], (counts.get(pair[key]) ?? 0) + 1);
    return [...counts].filter(([, n]) => n > 1).map(([value]) => value);
  };
  for (const code of seen("code")) found.push(`${code} names two rules`);
  for (const fragment of seen("fragment")) found.push(`${JSON.stringify(fragment)} has two entries`);

  const count = /export const RULE_COUNT: i32 = (\d+);/.exec(text);
  if (count === null) found.push("self/codes.ts has no `RULE_COUNT`");
  else if (Number(count[1]) !== all.length) {
    found.push(`RULE_COUNT is ${count[1]} and the tables hold ${all.length} rules`);
  }

  // stage0's copy, for as long as there is one. The deletion takes this with it.
  if (fs.existsSync(STAGE0)) {
    const line = (p) => `${p.code} ${JSON.stringify(p.fragment)}`;
    let stage0 = [];
    try {
      stage0 = parseCodesRegistry(fs.readFileSync(STAGE0, "utf8"), "src/codes.ts").map(line);
    } catch (err) {
      found.push(err.message);
    }
    const stage1 = all.map(line);
    const at = stage0.findIndex((l, i) => l !== stage1[i]);
    if (stage0.length !== stage1.length || at >= 0) {
      found.push(
        `src/codes.ts and self/codes.ts differ (${stage0.length} and ${stage1.length} rules` +
          (at >= 0 ? `, first at entry ${at + 1}: ${stage0[at]} / ${stage1[at]}` : "") +
          ")"
      );
    }
  }
  return { found, all };
};

/** The next number nobody has held, per band -- what a hand-added rule takes. */
const nextFree = (pairs) => {
  const highest = new Map();
  for (const { code } of pairs) {
    const band = code[2];
    highest.set(band, Math.max(highest.get(band) ?? 0, Number(code.slice(3))));
  }
  return [...BANDS].map((band) => `NL${band}${String((highest.get(band) ?? 0) + 1).padStart(3, "0")}`);
};

const { found, all } = problems(fs.readFileSync(REGISTRY, "utf8"));
for (const problem of found) console.error(`error: ${problem}`);
if (process.argv.includes("--check")) process.exit(found.length > 0 ? 1 : 0);
if (found.length === 0) {
  console.log(`self/codes.ts: ${all.length} rules, well-formed; next free: ${nextFree(all).join(" ")}`);
}
process.exit(found.length > 0 ? 1 : 0);
