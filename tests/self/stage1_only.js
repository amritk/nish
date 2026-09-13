/**
 * The stage1-only register, read (WP19 §1a).
 *
 *   import { stage1Only, stage1OnlyFor } from "./stage1_only.js";
 *
 * `tests/self/stage1_only.txt` is the file and its header is the contract;
 * this is the parser, kept apart from `corpus.js` because `tests/run.js`, the
 * oracles, `parity.js` and `nish-cmp.js` all have to agree about what is in it
 * and none of them should be reading a text file by hand.
 *
 * The register is the answer to the question the whole of WP19 is about, one
 * construct at a time: **what does it cost to implement a construct in `self/`
 * alone?** Before the register the answer was "you cannot" — a case stage0
 * refuses has no golden (`tests/run.js` compiles with stage0), and three
 * oracles record it as a silent skip, which `.claude/selfhost.md` is explicit
 * is a fact about the port rather than a file allowed to disagree. After it,
 * the answer is "a line here, and the diverse-double-compiling equality on
 * that construct". Everything else in the corpus is still compiled by both
 * implementations and compared byte for byte.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const REGISTER = path.join(root, "tests", "self", "stage1_only.txt");

/**
 * Every entry, by case name: `{ name, kind, fixture, why }`. `fixture` is the
 * register's own test rather than a construct, and is the one kind of entry
 * `tests/run.js` also holds against stage0.
 */
function stage1Only() {
  const entries = new Map();
  if (!fs.existsSync(REGISTER)) return entries;
  const lines = fs.readFileSync(REGISTER, "utf8").split("\n");
  for (const line of lines) {
    const text = line.trim();
    if (text.length === 0 || text.startsWith("#")) continue;
    const [name, kind, ...rest] = text.split(/\t+|\s{2,}/);
    const why = rest.join(" ").trim();
    if (kind === undefined || why.length === 0) {
      throw new Error(`${REGISTER}: \`${text}\` is not \`<case> <kind> <why>\``);
    }
    if (kind !== "fixture" && !kind.startsWith("since:")) {
      throw new Error(`${REGISTER}: \`${kind}\` is neither \`fixture\` nor \`since:<version>\``);
    }
    entries.set(name, { name, kind, fixture: kind === "fixture", why });
  }
  return entries;
}

/**
 * The entry covering a file, or null. Takes a path so that a caller walking
 * the corpus — where a program is a path and not a case name — does not have
 * to know that the register is keyed by `tests/cases` stems.
 */
function stage1OnlyFor(file, entries = stage1Only()) {
  const named = path.resolve(root, file);
  if (path.dirname(named) !== path.join(root, "tests", "cases")) return null;
  return entries.get(path.basename(named).replace(/\.[^.]+$/, "")) ?? null;
}

export { REGISTER, root, stage1Only, stage1OnlyFor };
