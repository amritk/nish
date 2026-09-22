/**
 * The Wave C oracle: `self/strings.ts`, `self/map.ts` and `self/paths.ts`
 * against implementations that already exist (docs/wp14-selfhost.md §3, §6
 * rule 3).
 *
 *   node tests/self/support_oracle.js             build, run, diff
 *   node tests/self/support_oracle.js --verbose   print every differing line
 *   node tests/self/support_oracle.js --update    rewrite goldens/support.txt
 *
 * The support library is the part of `self/` with no counterpart in `src/` to
 * diff against phase by phase, so each function is matched with the thing it
 * has to agree with instead:
 *
 *   - `irEscape` and `f64Hex` / `f32Hex`, and WP21's `nishExportTarget` and
 *     `parseBareSpecifier`, against **stage0's answers, recorded** in
 *     `tests/self/goldens/support.txt` (R6). These write bytes into the IR or
 *     pick the file a specifier loads, and there is no third implementation
 *     to ask — the rule is this project's — so stage0 was the oracle, and its
 *     answers were written down while it was still in the tree. When `dist/`
 *     is there the golden is checked against stage0 too, so it cannot have
 *     been recorded wrong; when it is not, the golden is the whole answer.
 *   - the path functions against **`node:path`'s POSIX side**, because module
 *     identity is the resolved path and §3a D3 is the note that says a
 *     `..` normalised differently from Node's loads one file twice.
 *   - `jsonQuote` against `JSON.stringify`, `compareStrings` against
 *     `Buffer.compare`, and `StringMap` against a JavaScript `Map` driven
 *     through the same script — insertion order included.
 *
 * The golden holds the whole expected output, not only stage0's lines, so a
 * reader sees each recorded answer beside the case that produced it. Its
 * other lines are checked against Node on every run, which is what makes an
 * edit to `cases.txt` without a matching `--update` fail rather than pass.
 *
 * The cases are `tests/self/cases.txt`, read by both sides, so the two can
 * never drift onto different inputs.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { defaultSeedSpec, linkWith, namedSeedSpec, resolveSeed } from "./seed.js";

const root = path.resolve(import.meta.dirname, "..", "..");

const CASES = path.join(root, "tests", "self", "cases.txt");

/** stage0's answers, recorded while it was in the tree (R6). */
const GOLDEN = path.join(root, "tests", "self", "goldens", "support.txt");

/**
 * The lines whose expected value came out of stage0. Everything else in the
 * golden is recomputed from Node on every run; these are read from it.
 */
const STAGE0_LINE = /^(?:ir |f64 |f32 |byte \d+ |pkg |spec )/;

/**
 * stage0's IR escape and float-hex, or null when `dist/` is not there — a
 * tree where `src/` has been deleted (R6), or one where nobody has run
 * `npm run build`. Imported here rather than at the top of the module so that
 * a missing stage0 means "read the golden" instead of a file that will not load.
 */
async function stage0Escapes() {
  const strings = path.join(root, "dist", "codegen", "emit", "strings.js");
  const builtins = path.join(root, "dist", "codegen", "emit", "builtins.js");
  const manifest = path.join(root, "dist", "manifest.js");
  const packages = path.join(root, "dist", "packages.js");
  if (!fs.existsSync(strings) || !fs.existsSync(builtins)) return null;
  if (!fs.existsSync(manifest) || !fs.existsSync(packages)) return null;
  const { escapeBytes } = await import(pathToFileURL(strings).href);
  const { f32Constant, f64Constant } = await import(pathToFileURL(builtins).href);
  // WP21 S2: the manifest reader and the specifier split, whose stage1 twins
  // must answer the same file for the same `package.json`. Unlike `node:path`
  // there is no third implementation to compare against — the rule is this
  // project's — so stage0 is the oracle, and the golden is what it said.
  const { nishExportTarget } = await import(pathToFileURL(manifest).href);
  const { parseBareSpecifier } = await import(pathToFileURL(packages).href);
  return { escapeBytes, f32Constant, f64Constant, nishExportTarget, parseBareSpecifier };
}

// ---- The pieces the driver prints -----------------------------------------------------

/** FNV-1a as an i32, the hash `self/map.ts` uses; `Math.imul` is its wrapping multiply. */
function hashString(s) {
  let hash = -2128831035;
  for (const byte of Buffer.from(s, "utf8")) {
    hash = Math.imul(hash ^ byte, 16777619);
  }
  return hash;
}

/**
 * `path.posix.normalize` with the trailing slash `self/paths.ts` drops: a
 * module path names a file, so `a/b/` and `a/b` must be one identity and not
 * two.
 */
function normalizePath(p) {
  const normalized = path.posix.normalize(p);
  return normalized.length > 1 && normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function resolvePath(base, spec) {
  if (spec.startsWith("/")) return normalizePath(spec);
  if (base.length === 0) return normalizePath(spec);
  return normalizePath(path.posix.join(base, spec));
}

function resolveModule(base, spec) {
  const resolved = resolvePath(base, spec);
  if (resolved.endsWith(".js")) return `${resolved.slice(0, -3)}.ts`;
  return resolved.endsWith(".ts") ? resolved : `${resolved}.ts`;
}

/** `self/paths.ts`'s `dirname` and `basename` are Node's, so Node is the oracle. */
function dirname(p) {
  return path.posix.dirname(p);
}

/**
 * `basenameWithout` is the one function here that is *not* Node's: this is a
 * spec check rather than an oracle, because `path.posix.basename(p, ext)`
 * answers `"///"` for `basename("///", ".ts")` and disagrees with itself
 * about `".ts"`. The rule `self/paths.ts` documents is the one below.
 */
function basenameWithout(p, suffix) {
  const name = path.posix.basename(p);
  const strip = suffix.length > 0 && suffix.length < name.length && name.endsWith(suffix);
  return strip ? name.slice(0, -suffix.length) : name;
}

/** The sign of a byte-wise comparison, which is what a sort reads. */
function compareStrings(a, b) {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/** The growth policy documented in `self/map.ts`, to check the table actually rehashed. */
function slotsAfter(entries) {
  let slots = 16;
  for (let i = 1; i <= entries; i++) {
    if (i * 4 > slots * 3) slots *= 2;
  }
  return slots;
}

// ---- The expected output ---------------------------------------------------------------

function expected(caseText, stage0) {
  const out = [];
  const texts = [];
  for (const line of caseText.split("\n")) {
    if (line.length === 0 || line.startsWith("#")) continue;
    const fields = line.split("\t");
    const [section, first, second] = fields;
    if (section === "text") {
      texts.push(first);
      out.push(`# text ${JSON.stringify(first)}`);
      out.push(`json ${JSON.stringify(first)}`);
      if (stage0 !== null) out.push(`ir ${stage0.escapeBytes(Buffer.from(first, "utf8"))}`);
      out.push(`hash ${hashString(first)}`);
      out.push(`split ${JSON.stringify(first.split("/").join("|"))}`);
      out.push(`repeat ${JSON.stringify(first.repeat(3))}`);
    } else if (section === "path") {
      out.push(`# path ${JSON.stringify(first)} ${JSON.stringify(second)}`);
      out.push(`normalize ${JSON.stringify(normalizePath(first))}`);
      out.push(`dirname ${JSON.stringify(dirname(first))}`);
      out.push(`basename ${JSON.stringify(path.posix.basename(first))}`);
      out.push(`stem ${JSON.stringify(basenameWithout(first, ".ts"))}`);
      out.push(`resolve ${JSON.stringify(resolvePath(first, second))}`);
      out.push(`module ${JSON.stringify(resolveModule(first, second))}`);
    } else if (section === "rel") {
      out.push(`# rel ${JSON.stringify(first)} ${JSON.stringify(second)}`);
      out.push(`relative ${JSON.stringify(path.posix.relative(first, second))}`);
    } else if (section === "pkg") {
      const [, subpath, primary, fallback, manifest] = fields;
      out.push(`# pkg ${JSON.stringify(subpath)} ${primary} ${fallback} ${JSON.stringify(manifest)}`);
      if (stage0 !== null) {
        const target = stage0.nishExportTarget(manifest, subpath, primary, fallback);
        out.push(`pkg ${target === null ? "null" : JSON.stringify(target)}`);
      }
    } else if (section === "spec") {
      out.push(`# spec ${JSON.stringify(first)}`);
      if (stage0 !== null) {
        const parsed = stage0.parseBareSpecifier(first);
        out.push(
          parsed === null ? "spec null" : `spec ${JSON.stringify(parsed.name)} ${JSON.stringify(parsed.subpath)}`
        );
      }
    } else if (section === "num") {
      out.push(`# num ${first}`);
      if (stage0 !== null) {
        out.push(`f64 ${stage0.f64Constant(Number(first))}`);
        out.push(`f32 ${stage0.f32Constant(Number(first))}`);
      }
    } else {
      throw new Error(`unknown section \`${section}\` in ${CASES}`);
    }
  }

  for (const a of texts) {
    for (const b of texts) {
      out.push(`compare ${JSON.stringify(a)} ${JSON.stringify(b)} ${compareStrings(a, b)}`);
    }
  }

  for (let byte = 0; byte < 256; byte++) {
    if (stage0 !== null) out.push(`byte ${byte} ${stage0.escapeBytes(Buffer.from([byte]))}`);
    // Only the ASCII half: above it a lone byte is not a JavaScript string,
    // and the multi-byte text cases above already pin the pass-through.
    if (byte < 128) out.push(`byte json ${byte} ${JSON.stringify(String.fromCharCode(byte))}`);
  }

  for (let bit = 0; bit < 64; bit++) {
    out.push(`bit ${bit} ${(1n << BigInt(bit)).toString(16).toUpperCase().padStart(16, "0")}`);
  }

  out.push(`join ${JSON.stringify(normalizePath(["a", "b/../c", "."].join("/")))}`);
  out.push("builder empty 1 0");
  out.push(`builder ${JSON.stringify("abc")} 3 0`);
  out.push(`builder reset ${JSON.stringify("")} 1`);

  // The map, driven through the driver's script with a JavaScript `Map`.
  const map = new Map();
  for (let i = 0; i < texts.length; i++) map.set(texts[i], i);
  out.push(`map size ${map.size}`);
  const order = [...map.keys()];
  for (let i = 0; i < order.length; i++) {
    out.push(`map entry ${i} ${JSON.stringify(order[i])} ${map.get(order[i])}`);
  }
  for (const key of texts) out.push(`map get ${JSON.stringify(key)} ${map.get(key)}`);
  out.push(`map missing -1 ${map.has("no such key") ? 1 : 0}`);
  for (const key of texts) map.set(key, 1000);
  out.push(`map size after overwrite ${map.size}`);
  const first = [...map.keys()][0];
  out.push(`map first after overwrite ${JSON.stringify(first)} ${map.get(first)}`);
  const set = new Set();
  let added = 0;
  for (const key of texts) {
    if (!set.has(key)) {
      set.add(key);
      added++;
    }
  }
  out.push(`set size ${set.size} added ${added}`);

  let sum = 0;
  for (let i = 0; i < 300; i++) sum += i * 7;
  out.push(`grow size 300 sum ${sum} slots ${slotsAfter(300)}`);
  out.push(`grow order ${JSON.stringify("key0")} ${JSON.stringify("key299")}`);

  return `${out.join("\n")}\n`;
}

// ---- Running the driver -----------------------------------------------------------------

/**
 * The driver, linked by the seed rather than by stage0 (WP19 G2.3). Most of
 * what this oracle compares against — `node:path`, `JSON.stringify`, `Buffer`,
 * `Map` — outlives `src/`, so the compiler that builds the driver has to too.
 */
function build(seed) {
  return linkWith(seed, path.join("tests", "self", "support.ts"), path.join(root, "build", "self", "support"));
}

/**
 * The compiler that links the driver: `--seed`, then `NISH_BOOTSTRAP`, then
 * `build/nish` -- `tests/self/seed.js`'s order -- and nothing after it. This
 * oracle used to fall back to stage0's `dist/index.js` when no seed was named;
 * it compares against something that outlives `src/`, so the compiler that
 * builds its subject has to outlive it too, and R6 took the fallback out.
 */
const seedWithoutStage0 = (argv) => {
  const spec = namedSeedSpec(argv) ?? defaultSeedSpec();
  if (spec === null) {
    return {
      error:
        "no seed: pass --seed <nish>, set NISH_BOOTSTRAP, or run `npm run bootstrap` to leave one in build/nish",
    };
  }
  return resolveSeed(spec);
};

/** `want` against `got` line by line: the differing lines, as a report prints them. */
const differences = (want, got) => {
  const differing = [];
  for (let i = 0; i < Math.max(want.length, got.length); i++) {
    if (want[i] !== got[i]) differing.push(`  line ${i + 1}: want ${want[i]} / got ${got[i]}`);
  }
  return differing;
};

/**
 * The golden's own staleness check: its lines that do not come from stage0
 * must be exactly what Node says today. A case added to `cases.txt` without an
 * `--update` fails here, naming the line, instead of comparing the driver
 * against an answer recorded for different input.
 */
const staleLines = (golden, caseText) =>
  differences(
    expected(caseText, null).split("\n"),
    golden.split("\n").filter((line) => !STAGE0_LINE.test(line))
  );

const report = (differing, verbose) => {
  for (const line of verbose ? differing : differing.slice(0, 10)) process.stdout.write(`${line}\n`);
};

async function main(argv) {
  const verbose = argv.includes("--verbose");
  const update = argv.includes("--update");
  const seed = seedWithoutStage0(argv);
  if (seed.error !== undefined) {
    process.stderr.write(`${seed.error}\n`);
    return 1;
  }
  const binary = build(seed);
  if (binary === null) return 1;
  const run = spawnSync(binary, [CASES], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0) {
    process.stderr.write(`support exited ${run.status}\n${run.stderr}`);
    return 1;
  }
  const caseText = fs.readFileSync(CASES, "utf8");
  const stage0 = await stage0Escapes();

  if (update) {
    // With stage0 in the tree the golden is stage0's answer. Without it, the
    // only thing left to record is stage1's own output, which is a golden in
    // the ordinary sense — reviewed as a diff — and is only written when every
    // line Node can still answer agrees with it.
    const recorded = stage0 !== null ? expected(caseText, stage0) : run.stdout;
    const stale = staleLines(recorded, caseText);
    if (stale.length > 0) {
      report(stale, verbose);
      process.stdout.write("support: stage1 disagrees with Node, so there is nothing trustworthy to record\n");
      return 1;
    }
    fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
    fs.writeFileSync(GOLDEN, recorded);
    const from = stage0 !== null ? "stage0" : "stage1 (no stage0 in the tree)";
    process.stdout.write(`wrote ${path.relative(root, GOLDEN)} from ${from}\n`);
    return 0;
  }

  if (!fs.existsSync(GOLDEN)) {
    process.stdout.write(`${path.relative(root, GOLDEN)} is missing; run with --update\n`);
    return 1;
  }
  const golden = fs.readFileSync(GOLDEN, "utf8");
  const stale = staleLines(golden, caseText);
  if (stale.length > 0) {
    report(stale, verbose);
    process.stdout.write(
      `${path.relative(root, GOLDEN)} is stale against tests/self/cases.txt (${stale.length} lines); run with --update\n`
    );
    return 1;
  }
  // While stage0 lives, the recorded answers are held to it as well: a golden
  // that stage0 no longer agrees with was recorded from something else.
  if (stage0 !== null) {
    const drift = differences(expected(caseText, stage0).split("\n"), golden.split("\n"));
    if (drift.length > 0) {
      report(drift, verbose);
      process.stdout.write(`${path.relative(root, GOLDEN)} disagrees with stage0 (${drift.length} lines); run with --update\n`);
      return 1;
    }
  }
  const want = golden.split("\n");
  const differing = differences(want, run.stdout.split("\n"));
  report(differing, verbose);
  const recorded = want.filter((line) => STAGE0_LINE.test(line)).length;
  const against = stage0 !== null ? "the golden and stage0" : "the golden";
  process.stdout.write(
    `${want.length - differing.length}/${want.length} lines agree (${recorded} recorded from stage0, checked against ${against}), seed ${seed.label}\n`
  );
  return differing.length === 0 ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(await main(process.argv.slice(2)));
export { expected, build, GOLDEN };
