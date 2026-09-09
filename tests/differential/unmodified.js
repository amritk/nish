/**
 * The *unmodified* Node claim, which is a much smaller one than WP13's.
 *
 * `run.js` rewrites a program from the checker's type table before Node sees
 * it, and that is what lets it reproduce every documented semantic exactly.
 * This runner rewrites nothing: it runs the `.ts` as the TypeScript it is,
 * under `node --experimental-strip-types` with `runtime/amritscript.mjs`
 * supplying the globals AmritScript has and Node does not.
 *
 * The claim it tests is the one `docs/RUN_UNDER_NODE.md` states: an f64-mode
 * program agrees with its compiled self, up to a listed set of divergences that
 * no prelude can reach because they live in the operators and the object model
 * rather than in the globals. i32 mode is not tested and never will be — there
 * `number` is a wrapping 32-bit integer and every arithmetic operator differs.
 *
 * ```
 * node tests/differential/unmodified.js            # table + summary
 * node tests/differential/unmodified.js --verbose  # with the diffs
 * ```
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const cli = path.join(root, "dist", "index.js");
const prelude = path.join(root, "runtime", "amritscript.mjs");
const work = path.join(root, "build", "test", "unmodified");

/**
 * Programs whose native and unmodified-Node runs differ on purpose. Each one is
 * a semantic that lives below the globals this prelude can install, so the entry
 * is a statement about the language and not a bug to fix. They are the same
 * decisions `known-failures.txt` records for the rewritten runner, plus the two
 * the rewriter can reach and a prelude cannot.
 */
const KNOWN = new Map([
  ["f64_libm", "glibc libm vs V8 fdlibm: 1-ulp differences in sin/cos/log/pow"],
  ["f64_minmax_nan", "llvm.minnum/maxnum answer the non-NaN operand; Math.min/max answer NaN"],
  ["f64_round_negzero", "Math.round(-0.3) is +0 natively and -0 in JS, and x/0 differs on the integer side"],
  ["f64_i32_mixed", "explicit `i32` locals wrap natively; unmodified Node has only doubles"],
]);

/** Every f64-mode program with an entry point, from the cases and the corpus. */
function programs() {
  const dirs = [path.join(root, "tests", "cases"), path.join(root, "tests", "differential", "corpus")];
  const found = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).sort()) {
      if (!file.endsWith(".args")) continue;
      if (!fs.readFileSync(path.join(dir, file), "utf8").includes("--number-mode f64")) continue;
      const source = path.join(dir, `${file.slice(0, -".args".length)}.ts`);
      const name = path.basename(source, ".ts");
      if (name.startsWith("reject_")) continue;
      if (!fs.existsSync(source)) continue;
      if (!fs.readFileSync(source, "utf8").includes("export function main")) continue;
      found.push({ name, source });
    }
  }
  return found;
}

/** Compile and link with `--number-mode f64`, then run the binary. */
function native({ name, source }) {
  const exe = path.join(work, name);
  const built = spawnSync("node", [cli, source, "--number-mode", "f64", "--link", exe], {
    cwd: root,
    encoding: "utf8",
  });
  if (built.status !== 0) return { failed: `compile: ${built.stderr}` };
  const ran = spawnSync(exe, [], { cwd: root, encoding: "utf8" });
  return { stdout: ran.stdout, status: ran.status };
}

/**
 * Run the same source under Node with nothing rewritten.
 *
 * The copy is not cosmetic: this repository's package.json says
 * `"type": "commonjs"`, so a `.ts` file inside it is loaded as CommonJS and its
 * `export function main` is a syntax error before type stripping ever runs. The
 * program is copied under a work directory carrying `{"type": "module"}` so
 * that Node reads it the way a consumer of this language would — as an ES
 * module. Nothing about the source itself changes.
 */
function unmodified({ name, source }) {
  const dir = path.join(work, "esm");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(work, "package.json"), '{ "type": "module" }\n');
  const copy = path.join(dir, `${name}.ts`);
  fs.copyFileSync(source, copy);
  const entry = `const m = await import(${JSON.stringify(copy)}); process.exit(m.main());`;
  const ran = spawnSync(
    "node",
    ["--experimental-strip-types", "--no-warnings", "--import", prelude, "-e", entry],
    { cwd: root, encoding: "utf8" }
  );
  return { stdout: ran.stdout, status: ran.status };
}

function runUnmodified({ verbose = false } = {}) {
  fs.mkdirSync(work, { recursive: true });
  const rows = [];
  for (const program of programs()) {
    const a = native(program);
    if (a.failed) {
      rows.push({ ...program, outcome: "ERROR", detail: a.failed });
      continue;
    }
    const b = unmodified(program);
    const agrees = a.stdout === b.stdout && a.status === b.status;
    const known = KNOWN.has(program.name);
    let outcome = "AGREE";
    if (!agrees && known) outcome = "KNOWN";
    else if (!agrees) outcome = "DIFFER";
    else if (known) outcome = "XPASS"; // listed as divergent but agrees: the list is stale
    rows.push({
      ...program,
      outcome,
      detail: agrees ? "" : `native ${JSON.stringify(a.stdout)} (${a.status}) vs node ${JSON.stringify(b.stdout)} (${b.status})`,
    });
  }
  const count = (o) => rows.filter((r) => r.outcome === o).length;
  const bad = rows.filter((r) => r.outcome === "DIFFER" || r.outcome === "ERROR" || r.outcome === "XPASS");
  if (verbose) {
    for (const r of rows) console.log(`${r.outcome.padEnd(6)} ${r.name}${r.detail ? `\n       ${r.detail}` : ""}`);
  }
  return {
    ok: bad.length === 0,
    summary:
      `${count("AGREE")}/${rows.length} f64 programs agree with unmodified Node ` +
      `(${count("KNOWN")} known divergences); ${bad.length} unexpected`,
    detail: bad.map((r) => `${r.outcome} ${r.name}: ${r.detail}`).join("\n"),
  };
}

module.exports = { runUnmodified };

if (require.main === module) {
  const result = runUnmodified({ verbose: process.argv.includes("--verbose") });
  console.log(result.summary);
  if (!result.ok) console.error(result.detail);
  process.exit(result.ok ? 0 : 1);
}
