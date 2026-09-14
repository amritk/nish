/**
 * The Wave C oracle: `self/strings.ts`, `self/map.ts` and `self/paths.ts`
 * against implementations that already exist (docs/wp14-selfhost.md §3, §6
 * rule 3).
 *
 *   node tests/self/support_oracle.js             build, run, diff
 *   node tests/self/support_oracle.js --verbose   print every differing line
 *
 * The support library is the part of `self/` with no counterpart in `src/` to
 * diff against phase by phase, so each function is matched with the thing it
 * has to agree with instead:
 *
 *   - `irEscape` and `f64Hex` / `f32Hex` against **stage0 itself**
 *     (`dist/codegen/emit/strings.js`, `dist/codegen/emit/builtins.js`). These
 *     write bytes into the IR; a disagreement is stage1 emitting a different
 *     module for the same program, which is exactly what §1's equality is
 *     about. This is the one part of the oracle that does not survive R6, and
 *     wp19 §2B's row saying the whole file survives was wrong about it: the
 *     lines are counted and named as skipped when there is no `dist/` to read
 *     rather than quietly not compared, and recovering them as a golden is
 *     G2.4 work that has not been done.
 *   - the path functions against **`node:path`'s POSIX side**, because module
 *     identity is the resolved path and §3a D3 is the note that says a
 *     `..` normalised differently from Node's loads one file twice.
 *   - `jsonQuote` against `JSON.stringify`, `compareStrings` against
 *     `Buffer.compare`, and `StringMap` against a JavaScript `Map` driven
 *     through the same script — insertion order included.
 *
 * The cases are `tests/self/cases.txt`, read by both sides, so the two can
 * never drift onto different inputs.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { linkWith, seedForOracle } from "./seed.js";

const root = path.resolve(import.meta.dirname, "..", "..");

const CASES = path.join(root, "tests", "self", "cases.txt");

/**
 * The lines whose expected value comes out of stage0. They are dropped from
 * both sides when stage0 is not in the tree, so the rest of the oracle still
 * runs; the summary says how many went.
 */
const STAGE0_LINE = /^(?:ir |f64 |f32 |byte \d+ |pkg |spec )/;

/**
 * stage0's IR escape and float-hex, or null when `dist/` is not there — a
 * tree where `src/` has been deleted (R6), or one where nobody has run
 * `npm run build`. Imported here rather than at the top of the module so that
 * a missing stage0 is a named skip instead of a file that will not load.
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
  // project's — so stage0 is the oracle and these lines go with it when `dist/`
  // is not in the tree.
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

async function main(argv) {
  const verbose = argv.includes("--verbose");
  const seed = seedForOracle(argv);
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
  const stage0 = await stage0Escapes();
  const want = expected(fs.readFileSync(CASES, "utf8"), stage0).split("\n");
  // The driver prints its IR-escape lines whatever is in `dist/`; with no
  // stage0 to say what they should be, they come out of the comparison on both
  // sides rather than out of the run.
  const got = (stage0 === null ? run.stdout.split("\n").filter((line) => !STAGE0_LINE.test(line)) : run.stdout.split("\n"));
  const differing = [];
  for (let i = 0; i < Math.max(want.length, got.length); i++) {
    if (want[i] !== got[i]) differing.push(`  line ${i + 1}: want ${want[i]} / got ${got[i]}`);
  }
  if (differing.length > 0) {
    for (const line of verbose ? differing : differing.slice(0, 10)) process.stdout.write(`${line}\n`);
  }
  const escapes = stage0 === null ? ", the IR-escape lines skipped (no stage0 in the tree)" : "";
  process.stdout.write(
    `${want.length - differing.length}/${want.length} lines agree, seed ${seed.label}${escapes}\n`
  );
  return differing.length === 0 ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(await main(process.argv.slice(2)));
export { expected, build };
