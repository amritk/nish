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
 *     about.
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
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");
const { escapeBytes } = require(path.join(root, "dist", "codegen", "emit", "strings.js"));
const { f32Constant, f64Constant } = require(path.join(root, "dist", "codegen", "emit", "builtins.js"));

const CASES = path.join(root, "tests", "self", "cases.txt");

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

function expected(caseText) {
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
      out.push(`ir ${escapeBytes(Buffer.from(first, "utf8"))}`);
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
    } else if (section === "num") {
      out.push(`# num ${first}`);
      out.push(`f64 ${f64Constant(Number(first))}`);
      out.push(`f32 ${f32Constant(Number(first))}`);
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
    out.push(`byte ${byte} ${escapeBytes(Buffer.from([byte]))}`);
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

function build() {
  const out = path.join(root, "build", "self", "support");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const r = spawnSync(
    "node",
    [path.join(root, "dist", "index.js"), path.join(root, "tests", "self", "support.ts"), "--link", out],
    { cwd: root, encoding: "utf8" }
  );
  if (r.status !== 0) {
    process.stderr.write(`${r.stderr}\n`);
    return null;
  }
  return out;
}

function main(argv) {
  const verbose = argv.includes("--verbose");
  const binary = build();
  if (binary === null) return 1;
  const run = spawnSync(binary, [CASES], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0) {
    process.stderr.write(`support exited ${run.status}\n${run.stderr}`);
    return 1;
  }
  const want = expected(fs.readFileSync(CASES, "utf8")).split("\n");
  const got = run.stdout.split("\n");
  const differing = [];
  for (let i = 0; i < Math.max(want.length, got.length); i++) {
    if (want[i] !== got[i]) differing.push(`  line ${i + 1}: want ${want[i]} / got ${got[i]}`);
  }
  if (differing.length > 0) {
    for (const line of verbose ? differing : differing.slice(0, 10)) process.stdout.write(`${line}\n`);
  }
  process.stdout.write(`${want.length - differing.length}/${want.length} lines agree\n`);
  return differing.length === 0 ? 0 : 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { expected, build };
