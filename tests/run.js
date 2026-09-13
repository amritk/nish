#!/usr/bin/env node
/**
 * Nish test runner.
 *
 *  A. Golden cases in tests/cases/  (one .ts per case, discovered automatically)
 *       <name>.ts    source
 *       <name>.ll    expected IR (module header stripped). Missing + UPDATE_GOLDENS=1 -> written.
 *       <name>.args  extra CLI flags, whitespace separated
 *       <name>.err   expected error substring; compile must fail (no .ll needed)
 *       <name>.out   expected stdout when linked with <name>.c (or tests/driver.c,
 *                    which prints `test()`) and the two runtime .c files, then run
 *       <name>.argv  command-line arguments for that run, whitespace separated (WP7)
 *       <name>.env   environment for that run, `NAME=value` per line, layered over
 *                    the inherited one (WP19 R1: `getenv` has no other way to be pinned)
 *     Every successfully compiled case is also assembled with llvm-as.
 *
 *  B. Pipeline checks: the runtime unit test, inline allocator vs C arena layout
 *     (linked for the host, and asserted per target so wasm32 cannot drift),
 *     size and wasm build profiles, Node wasm host, and the browser harness in
 *     web/ compiling with the compiler's own wasi build.
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { linkWith, resolveSeed } from "./self/seed.js";
import { stage1Only } from "./self/stage1_only.js";
const require = createRequire(import.meta.url);

const root = path.resolve(import.meta.dirname, "..");
const cli = path.join(root, "dist", "index.js");
const casesDir = path.join(root, "tests", "cases");
const buildDir = path.join(root, "build", "test");
fs.mkdirSync(buildDir, { recursive: true });

/**
 * The C runtime's two translation units, as a direct `clang` line has to spell
 * them: `runtime.c` is the core every program touches and `runtime_os.c` is the
 * half that wraps the system calls, split apart so that each carries its own
 * `.text*` budget (RUNTIME_TEXT_BUDGET and RUNTIME_OS_TEXT_BUDGET below).
 *
 * Named here rather than written out at each link so that a third unit is one
 * edit, and spelled out at all -- `scripts/build.sh` pairs the two itself, so
 * the builds that go through it need only name `runtime.c` -- because a link
 * line this suite gets wrong should fail as a link error rather than be quietly
 * repaired on the way past.
 */
const RUNTIME_C = ["runtime/runtime.c", "runtime/runtime_os.c"];

/**
 * The seed every stage1 binary in this suite is built with (WP19 G2.3):
 * `NISH_BOOTSTRAP` when there is one, and stage0 otherwise, which is what a
 * fresh clone has. The tools themselves name no compiler — `tests/self/seed.js`
 * resolves what it is given — so this is the one line in the suite that still
 * says `dist/index.js` on their behalf, and after R6 it loses its second half.
 */
const seedSpec = process.env.NISH_BOOTSTRAP || path.relative(root, cli);

/**
 * The cases whose only implementation is `self/`'s (WP19 §1a). The file's
 * header is the contract; here it decides which compiler section A runs.
 */
const STAGE1_ONLY = stage1Only();

let failures = 0;
let passes = 0;
/**
 * Sections that did not run. Counted rather than only printed: without LLVM the
 * toolchain-dependent half of this suite skips instead of failing, and a run
 * that ends `N passed, 0 failed` then looks exactly like a run that proved
 * everything. The summary says how many skipped and the banner says which
 * tools were missing, so a reader -- or an agent -- can tell the two apart.
 */
const skipped = [];
const skip = (reason) => {
  console.log(`SKIP  ${reason}`);
  skipped.push(reason);
};
function check(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (ok) passes++;
  else {
    failures++;
    if (detail)
      console.log(
        String(detail)
          .split("\n")
          .map((l) => "      " + l)
          .join("\n")
      );
  }
  return ok;
}
const has = (tool) => spawnSync("which", [tool]).status === 0;
const HAS_LLVM_AS = has("llvm-as");
const HAS_CLANG = has("clang");
/** `-g` end to end: the linked binary is read with the dumper when there is one. */
const HAS_LLVM_DWARFDUMP = has("llvm-dwarfdump");

/**
 * The DWARF producer, with the version replaced by a placeholder.
 *
 * `-g` writes `producer: "nish <version>"` into the compile unit, so two
 * goldens would otherwise have to be regenerated at every release for a change
 * that is not a lowering at all -- and the release pull request, which is the
 * commit that bumps the version, would be red at itself. Applied to the golden
 * as well as to the emitted IR, so a golden written before this is still read
 * correctly. `llvm-as` runs on the emitted file rather than the golden, so the
 * placeholder never reaches a verifier.
 */
function normaliseProducer(ir) {
  return ir.replace(/producer: "nish [^"]*"/g, 'producer: "nish <version>"');
}

/** Module body with the `; ModuleID` / `source_filename` header removed. */
function stripHeader(ir) {
  return ir
    .split("\n")
    .filter((l) => !l.startsWith(";") && !l.startsWith("source_filename"))
    .join("\n")
    .trim();
}

// ---- WP19 G1: `--parity`, a mode rather than a section ----------------------------
// The gate asks for the corpus through both compilers on every flag combination
// the suite uses, with an empty difference set printed as a table. That is a
// different shape from the checks below — a cross product rather than a list of
// properties — and it links a stage1 binary, so it is its own run rather than a
// block that would make every `npm test` pay for it. `tests/self/parity.js` is
// the driver; everything after `--parity` is passed on to it.
if (process.argv.includes("--parity")) {
  const at = process.argv.indexOf("--parity");
  const r = spawnSync(
    "node",
    [path.join(import.meta.dirname, "self", "parity.js"), ...process.argv.slice(at + 1)],
    { cwd: root, stdio: "inherit" }
  );
  process.exit(r.status ?? 1);
}

// ---- A. Golden cases -------------------------------------------------------------
//
// A case is compiled by stage0, unless the stage1-only register names it: then
// it is compiled by a stage1 binary built out of `self/` with the seed, because
// a construct that lives only in `self/` has no stage0 answer to be held
// against (WP19 §1a). One compiler is built for all of them, on the first case
// that needs it, and never at all when the register is empty.
let stage1Cache;
function stage1ForCases() {
  if (stage1Cache === undefined) stage1Cache = buildStage1ForCases();
  return stage1Cache;
}

function buildStage1ForCases() {
  if (!HAS_CLANG) return { error: "clang not found, and a stage1 compiler has to be linked" };
  const seed = resolveSeed(seedSpec);
  if (seed.error !== undefined) return { error: seed.error };
  const built = linkWith(seed, path.join("self", "compile.ts"), path.join(buildDir, "self", "compile"));
  if (built === null) return { error: `the seed (${seed.label}) could not build self/compile.ts` };
  return { cmd: built, prefix: [], label: seed.label };
}

const only = process.argv[2];
const cases = fs
  .readdirSync(casesDir)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => f.slice(0, -3))
  .sort();
for (const name of cases) {
  if (only && !name.includes(only)) continue;
  const src = path.join(casesDir, `${name}.ts`);
  const side = (ext) => path.join(casesDir, `${name}.${ext}`);
  const args = fs.existsSync(side("args"))
    ? fs.readFileSync(side("args"), "utf8").trim().split(/\s+/).filter(Boolean)
    : [];
  const outLl = path.join(buildDir, `${name}.ll`);
  const registered = STAGE1_ONLY.get(name) ?? null;
  let stage1 = null;
  if (registered !== null) {
    stage1 = stage1ForCases();
    if (stage1.error !== undefined) {
      // Loudly, and counted: a registered case compiled by stage0 instead
      // would be a golden written by the compiler that is supposed to have no
      // opinion about it.
      skip(`${name}: it is stage1-only and there is no stage1 compiler (${stage1.error})`);
      continue;
    }
  }
  const r =
    stage1 === null
      ? spawnSync("node", [cli, src, "-o", outLl, ...args], { cwd: root })
      : spawnSync(stage1.cmd, [...stage1.prefix, src, "-o", outLl, ...args], { cwd: root });
  const stderr = String(r.stderr);

  if (fs.existsSync(side("err"))) {
    // One fragment per line; every one must appear (WP10: several errors from one compile).
    const needles = fs
      .readFileSync(side("err"), "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const missing = needles.filter((n) => !stderr.includes(n));
    check(
      `${name}: rejected with ${needles.map((n) => `"${n}"`).join(", ")}`,
      r.status === 1 && missing.length === 0,
      stderr || "(compiled successfully)"
    );
    continue;
  }
  if (r.status !== 0) {
    check(`${name}: compiles`, false, stderr);
    continue;
  }
  if (fs.existsSync(side("stdout"))) {
    // A dump flag (`--emit-ast`, `--emit-checked`): the compiler's stdout is the golden, no IR is written.
    const want = fs.readFileSync(side("stdout"), "utf8").trim();
    const got = String(r.stdout).trim();
    check(`${name}: stdout matches .stdout`, got === want, `--- expected\n${want}\n--- actual\n${got}`);
    continue;
  }

  // `-g` names the working directory in `DIFile`; keep the golden machine-independent.
  // It also names the compiler's version in the DWARF producer, which changes
  // at every release and is not a fact about the lowering -- so normalise it
  // the same way, and for the same reason one step further out: without this
  // the release pull request's own version bump turns `dbg_locals` and
  // `dbg_result` red, and a release cannot go green on itself. The version is
  // still pinned, by the `--version` checks and by the branding/package.json
  // equality check above; it is just not pinned once per golden.
  const actual = normaliseProducer(stripHeader(fs.readFileSync(outLl, "utf8")).split(root).join("<root>"));
  if (!fs.existsSync(side("ll"))) {
    if (process.env.UPDATE_GOLDENS) {
      fs.writeFileSync(side("ll"), actual + "\n");
      console.log(`WROTE ${name}.ll`);
    } else {
      check(`${name}: has golden .ll (run with UPDATE_GOLDENS=1 to create)`, false);
      continue;
    }
  }
  const expected = normaliseProducer(fs.readFileSync(side("ll"), "utf8").trim());
  check(
    `${name}: IR matches golden${registered === null ? "" : " (compiled by stage1)"}`,
    actual === expected,
    `--- expected\n${expected}\n--- actual\n${actual}`
  );

  // The register's fixture is a case both compilers can do, registered so that
  // the stage1 path is exercised on every run. That makes one more assertion
  // available than a real stage1-only case allows, and it is the strongest one
  // here: the two compilers emit the same bytes for it, so a difference is the
  // machinery rather than the language.
  if (registered !== null && registered.fixture) {
    const alsoLl = path.join(buildDir, `${name}.stage0.ll`);
    const byStage0 = spawnSync("node", [cli, src, "-o", alsoLl, ...args], { cwd: root });
    const stage0Ir =
      byStage0.status === 0
        ? normaliseProducer(stripHeader(fs.readFileSync(alsoLl, "utf8")).split(root).join("<root>"))
        : String(byStage0.stderr);
    check(
      `${name}: the register's fixture compiles to the same bytes under stage0`,
      byStage0.status === 0 && stage0Ir === actual,
      `--- stage1\n${actual}\n--- stage0\n${stage0Ir}`
    );
  }

  if (HAS_LLVM_AS) {
    const as = spawnSync("llvm-as", [outLl, "-o", "/dev/null"]);
    check(`${name}: llvm-as accepts IR`, as.status === 0, String(as.stderr));
  }

  if (fs.existsSync(side("out")) && HAS_CLANG) {
    const driver = fs.existsSync(side("c")) ? side("c") : path.join(root, "tests", "driver.c");
    // WP5: a case with its own exported `main` is a whole program; link it without the driver.
    // Either spelling declares it (WP22): `export function main` or `export const main = (...) => ...`.
    const hasEntry = /\bexport\s+(?:function\s+main\b|const\s+main\s*=)/.test(fs.readFileSync(src, "utf8"));
    const exe = path.join(buildDir, name);
    // WP20 T0: a case compiled with `--threads` references `@nish_arena` as a
    // thread-local global, so runtime.c has to define it as one. The macro is
    // what `scripts/build.sh --threads` passes, and the link is the check: ELF
    // refuses a non-TLS reference to a TLS definition, so a case that got this
    // wrong fails here rather than running with two arenas.
    const threads = args.includes("--threads") ? ["-DNISH_THREADS=1"] : [];
    // -lm: Math.sin/cos/exp/log/pow lower to LLVM intrinsics that become libm calls (WP7).
    const cc = spawnSync(
      "clang",
      [
        "-Wno-override-module",
        "-O2",
        ...threads,
        outLl,
        ...(hasEntry ? [] : [driver]),
        ...RUNTIME_C,
        "-lm",
        "-o",
        exe,
      ],
      { cwd: root }
    );
    if (cc.status !== 0) {
      check(`${name}: links natively`, false, String(cc.stderr));
      continue;
    }
    const argv = fs.existsSync(side("argv"))
      ? fs.readFileSync(side("argv"), "utf8").trim().split(/\s+/).filter(Boolean)
      : [];
    const run = spawnSync(exe, argv, { env: caseEnv(side("env")) });
    const want = fs.readFileSync(side("out"), "utf8").trim();
    check(
      `${name}: native output matches .out`,
      run.status === 0 && String(run.stdout).trim() === want,
      `--- expected\n${want}\n--- actual (exit ${run.status})\n${run.stdout}${run.stderr}`
    );
  }
}

// Every line of the register has to name a case that exists. A typo there is
// silent otherwise — the case would be compiled by stage0 and pass, and the
// register would be a claim about a file nobody has.
for (const entry of STAGE1_ONLY.values()) {
  check(
    `tests/self/stage1_only.txt: \`${entry.name}\` is a case in tests/cases`,
    fs.existsSync(path.join(casesDir, `${entry.name}.ts`)),
    `no tests/cases/${entry.name}.ts`
  );
}

// ---- A `nish:` import is the same builtin, not another one -----------------------
// The whole claim a builtin module makes: importing a name *renames* a builtin
// rather than introducing one, so the program that imports and the program that
// reaches for the global have to emit the same body. A golden cannot say that —
// two goldens generated together only prove they were generated together — so
// the two outputs are compared directly, with the one line that is allowed to
// differ (the source file each was compiled from) taken out.
if (!only || "io_nish_import".includes(only) || "io_nish_import_global".includes(only)) {
  const ir = (name) => {
    const file = path.join(buildDir, `${name}.ll`);
    return fs.existsSync(file)
      ? stripHeader(fs.readFileSync(file, "utf8")).split(root).join("<root>").trim()
      : null;
  };
  const imported = ir("io_nish_import");
  const global = ir("io_nish_import_global");
  check(
    "io_nish_import: the imported spelling emits the IR the global one does",
    imported !== null && imported === global,
    imported === null
      ? "(one of the two cases did not compile)"
      : `--- global\n${global}\n--- imported\n${imported}`
  );
}

/**
 * `<name>.env`: one `NAME=value` per line, layered over the environment the
 * harness inherited. A case that reads the environment (`getenv`, WP19 R1)
 * cannot pin the answer itself — the language has no `setenv` — so the runner
 * is the only place the value can come from, and a golden that depended on
 * the developer's own environment would not be a golden. Blank lines and `#`
 * comments are ignored; `NAME=` sets an empty value, which is a *set*
 * variable and not the same as leaving it out, and a bare `NAME` unsets it.
 */
function caseEnv(file) {
  if (!fs.existsSync(file)) return process.env;
  const env = { ...process.env };
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const text = line.trim();
    if (text.length === 0 || text.startsWith("#")) continue;
    const eq = text.indexOf("=");
    // A bare `NAME` takes the variable *away*, which `NAME=` cannot do: an
    // empty value is a set variable, and `getenv`'s third answer — unset — is
    // otherwise only as reliable as the developer's own environment.
    if (eq < 0) delete env[text];
    else if (eq > 0) env[text.slice(0, eq)] = text.slice(eq + 1);
  }
  return env;
}

// ---- WP10: diagnostics ------------------------------------------------------------
// Every CompileError prints `file:line:col: error: <msg>` and then a source excerpt:
// the offending line and a caret line (`^` at the start column, `~` to the node end).
if (!only || "diagnostics".includes(only)) {
  const mm = spawnSync(
    "node",
    [cli, path.join(casesDir, "reject_type_mismatch.ts"), "-o", path.join(buildDir, "diag_mismatch.ll")],
    { cwd: root }
  );
  const mmLines = String(mm.stderr).split("\n");
  // `a + true` (8 chars) starts at column 40 of line 1, so the caret sits after 39 spaces.
  check(
    "diagnostics: excerpt shows the offending source line",
    mmLines[1] === "  1 | function f(a: number): number { return a + true; }",
    mm.stderr
  );
  check(
    "diagnostics: caret line marks `a + true` under column 40",
    mmLines[2] === "    | " + " ".repeat(39) + "^~~~~~~~",
    mm.stderr
  );

  const synSrc = path.join(buildDir, "diag_syntax.ts");
  fs.writeFileSync(synSrc, "function f( {\n  return 1;\n}\n");
  const syn = spawnSync("node", [cli, synSrc, "-o", path.join(buildDir, "diag_syntax.ll")], { cwd: root });
  const synErr = String(syn.stderr);
  check(
    "diagnostics: syntax errors keep the `syntax error:` prefix and add the excerpt",
    syn.status === 1 &&
      synErr.includes(": syntax error: ") &&
      synErr.includes("  2 |   return 1;\n    |          ^"),
    synErr
  );

  // Multi-error reporting: every independent error is printed, in source order, then a count.
  const multiSrc = path.join(casesDir, "reject_multi_error.ts");
  const multi = spawnSync("node", [cli, multiSrc, "-o", path.join(buildDir, "diag_multi.ll")], { cwd: root });
  const multiErr = String(multi.stderr);
  const summaries = multiErr.split("\n").filter((l) => /:\d+:\d+: error: /.test(l));
  check(
    "diagnostics: three independent errors are all reported, in source order, with a `3 errors` line",
    multi.status === 1 &&
      summaries.length === 3 &&
      summaries.map((l) => Number(l.split(":")[1])).join(",") === "2,6,11" &&
      multiErr.trim().endsWith("3 errors"),
    multiErr
  );
  check(
    "diagnostics: a lone error prints no count line (single-error output unchanged)",
    !String(mm.stderr).includes("error\n1 error") && String(mm.stderr).split("\n").length === 4,
    mm.stderr
  );

  // The report stops at 20 errors and says how many more there are.
  const manySrc = path.join(buildDir, "diag_many.ts");
  fs.writeFileSync(
    manySrc,
    Array.from({ length: 25 }, (_, i) => `function f${i}(a: number): number { return a + true; }`).join(
      "\n"
    ) + "\n"
  );
  const many = spawnSync("node", [cli, manySrc, "-o", path.join(buildDir, "diag_many.ll")], { cwd: root });
  const manyErr = String(many.stderr);
  check(
    "diagnostics: 25 errors print 20, then `...and 5 more errors` and `25 errors`",
    many.status === 1 &&
      manyErr.split("\n").filter((l) => /:\d+:\d+: error: /.test(l)).length === 20 &&
      manyErr.includes("\n...and 5 more errors\n25 errors"),
    manyErr
  );

  // --json: one object per line on stdout, nothing on stderr, no excerpt, exit code unchanged.
  const js = spawnSync("node", [cli, multiSrc, "-o", path.join(buildDir, "diag_multi.ll"), "--json"], {
    cwd: root,
    encoding: "utf8",
  });
  let objects = [];
  try {
    objects = js.stdout
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
  } catch {
    objects = [];
  }
  check(
    "diagnostics: --json prints one JSON object per error on stdout with file/line/column/endLine/endColumn/severity/message",
    js.status === 1 &&
      js.stderr === "" &&
      objects.length === 3 &&
      objects.every(
        (o) =>
          o.file === multiSrc &&
          o.severity === "error" &&
          typeof o.message === "string" &&
          !o.message.includes("|")
      ) &&
      objects[0].line === 2 &&
      objects[0].column === 10 &&
      objects[0].endLine === 2 &&
      objects[0].endColumn === 18,
    js.stdout + js.stderr
  );
  const jsSyn = spawnSync("node", [cli, synSrc, "-o", path.join(buildDir, "diag_syntax.ll"), "--json"], {
    cwd: root,
    encoding: "utf8",
  });
  check(
    "diagnostics: --json syntax errors carry the `syntax error:` prefix in `message`",
    jsSyn.status === 1 &&
      jsSyn.stdout.startsWith("{") &&
      JSON.parse(jsSyn.stdout.split("\n")[0]).message.startsWith("syntax error: "),
    jsSyn.stdout + jsSyn.stderr
  );

  // ---- stable diagnostic codes ---------------------------------------------
  // `code` is what a tool keys on instead of the prose, so it has to mean the
  // same rule next release. Three things keep that true: the registry is
  // generated from the compiler's own sources (so a new diagnostic cannot go
  // uncoded unnoticed), the generator only ever appends numbers, and the two
  // compilers share one table.
  const codesGen = spawnSync("node", [path.join(root, "scripts", "gen-diagnostic-codes.mjs"), "--check"], {
    cwd: root,
    encoding: "utf8",
  });
  check(
    "codes: src/codes.ts and self/codes.ts are up to date with the diagnostics in src/",
    codesGen.status === 0,
    codesGen.stdout + codesGen.stderr
  );

  // One table, two compilers: the pairs must be identical, exactly as
  // `branding.ts` must name the same language on both sides.
  const pairsOf = (file) => {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    return [...text.matchAll(/^ {4}("(?:[^"\\]|\\.)*"),\n {4}"(NL\d{4})",$/gm)].map((m) => `${m[2]} ${m[1]}`);
  };
  const stage0Codes = pairsOf("src/codes.ts");
  const stage1Codes = pairsOf("self/codes.ts");
  check(
    `codes: stage0 and stage1 hold the same registry (${stage0Codes.length} rules)`,
    stage0Codes.length > 0 && stage0Codes.join("\n") === stage1Codes.join("\n"),
    `stage0 ${stage0Codes.length} rules, stage1 ${stage1Codes.length} rules`
  );
  // A number handed out once is never handed to a different rule.
  const dupCodes = stage0Codes.map((p) => p.split(" ")[0]).filter((c, i, a) => a.indexOf(c) !== i);
  check("codes: every rule has its own number", dupCodes.length === 0, `reused: ${dupCodes.join(", ")}`);

  const jsCode = JSON.parse(js.stdout.split("\n")[0]);
  check(
    `codes: --json carries a code (${jsCode.code}) and the human summary line does not`,
    /^NL\d{4}$/.test(jsCode.code) &&
      jsCode.code !== "NL0000" &&
      !manyErr.includes(jsCode.code) &&
      !many.stderr.includes("NL"),
    `${js.stdout.split("\n")[0]}\n---\n${manyErr.split("\n")[0]}`
  );
  check(
    "codes: a syntax error is NL0001, whatever the `typescript` package worded it as",
    JSON.parse(jsSyn.stdout.split("\n")[0]).code === "NL0001",
    jsSyn.stdout
  );

  // Coverage over every code in the registry, not only over the ones some
  // rejection happens to reach (WP19 G2.4). `tests/diagnostic_coverage.js`
  // compiles the negatives, the `perf_*` positives and its own
  // `tests/wordings/` corpus, reads the `code` out of every `--json` object,
  // and requires each of the registry's codes to be either provoked or named
  // in `tests/wordings/unreachable.txt` with a reason. It replaces the loop
  // that used to live here, which spawned the same compilers one at a time and
  // could only report what the corpus already reached; this one is pooled and
  // says what it does *not* reach, which is the number the gate is about.
  //
  // The uncoded remainder is still the backlog, pinned so it can shrink but not
  // grow: such a message is built entirely out of interpolations and has no
  // literal run long enough to identify a rule. Adding one is a matter of
  // giving the message words of its own, not of editing the table -- which is
  // what took this from 8 to 1 over `tests/cases`: `` `${fn}` expects ${a}, got
  // ${b} `` was eight of them, and now reads `expects an argument of type
  // ${a}`, a run a code can be derived from. The one left there is `Unknown
  // base class ...`, whose leading run is shorter than the parenthetical that
  // actually states the rule.
  //
  // Five rather than one, because the loop this replaced walked
  // `tests/cases/reject_*` alone and the tool walks the `tests/link/` negatives
  // too: the whole-program rules -- a duplicate export, a duplicate import, a
  // duplicate internal name and an export a module does not have -- are
  // uncoded and always were, and nothing was counting them. They are named on
  // stdout by the run, so shrinking this backlog means giving one of those
  // messages a literal run of its own.
  const UNCODED_BACKLOG = 4;
  const wordings = spawnSync(
    "node",
    [
      path.join(root, "tests", "diagnostic_coverage.js"),
      "--compiler",
      path.relative(root, cli),
      "--require-coverage",
      ...(process.env.UPDATE_GOLDENS === "1" ? ["--update"] : []),
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  const wordingsSummary = wordings.stdout.trim().split("\n").pop() ?? "";
  check(
    `codes: every registry code is provoked by a program or explained (${wordingsSummary})`,
    wordings.status === 0,
    `${wordings.stdout}${wordings.stderr}`
  );
  const uncodedCount = Number(/uncoded=(\d+)/.exec(wordingsSummary)?.[1] ?? NaN);
  check(
    `codes: the uncoded backlog is ${uncodedCount} message(s), and may not grow past ${UNCODED_BACKLOG}`,
    Number.isFinite(uncodedCount) && uncodedCount <= UNCODED_BACKLOG,
    wordings.stdout
  );
  const jsOk = spawnSync(
    "node",
    [cli, path.join(casesDir, "cf_fib.ts"), "-o", path.join(buildDir, "diag_json_ok.ll"), "--json"],
    { cwd: root, encoding: "utf8" }
  );
  check(
    "diagnostics: --json on a clean program prints nothing on stdout and exits 0",
    jsOk.status === 0 && jsOk.stdout === "",
    jsOk.stdout + jsOk.stderr
  );

  // -g: the IR verifies, and a linked debug binary carries a DWARF line table naming the .ts file.
  // The golden is compiled by the cases loop above, which a `node tests/run.js
  // <sub>` run may have filtered out; verifying a file that was never written
  // reports a failure about the filter rather than about the compiler.
  const dbgLocalsIr = path.join(buildDir, "dbg_locals.ll");
  if (has("opt") && fs.existsSync(dbgLocalsIr)) {
    const v = spawnSync("opt", ["-passes=verify", "-disable-output", dbgLocalsIr]);
    check("dbg_locals: opt -passes=verify accepts the -g IR", v.status === 0, String(v.stderr));
  }
  // A class reached only through an imported class's signatures is described
  // against the file that *declares* it, not against the importer: two
  // `DIFile`s in one module, and the composite naming the second. Before this,
  // `Entry`'s declaration offset was looked up in main.ts's line table and a
  // debugger was sent to a line in the wrong source.
  const reachDir = path.join(buildDir, "dbg_reachable") + path.sep;
  fs.rmSync(reachDir, { recursive: true, force: true });
  const reach = spawnSync(
    "node",
    [cli, path.join(root, "tests", "link", "reachable_struct", "main.ts"), "-o", reachDir, "-g"],
    { cwd: root, encoding: "utf8" }
  );
  const reachIr =
    reach.status === 0 && fs.existsSync(path.join(reachDir, "main.ll"))
      ? fs.readFileSync(path.join(reachDir, "main.ll"), "utf8")
      : "";
  const libFile = /^(![0-9]+) = !DIFile\(filename: "[^"]*reachable_struct[/\\]lib\.ts", directory: "\."\)$/m.exec(
    reachIr
  );
  check(
    "-g: a class reached through an import is described against the file that declares it",
    libFile !== null && reachIr.includes(`name: "Entry", file: ${libFile[1]}, line: 4,`),
    reach.stderr +
      reachIr
        .split("\n")
        .filter((l) => l.includes("DIFile") || l.includes('name: "Entry"'))
        .join("\n")
  );

  if (HAS_CLANG) {
    const dbgSrc = path.join(buildDir, "dbg_main.ts");
    fs.writeFileSync(
      dbgSrc,
      "function fib(n: number): number {\n  if (n < 2) return n;\n  return fib(n - 1) + fib(n - 2);\n}\n\nexport function main(): number {\n  const x = fib(10);\n  return x - 55;\n}\n"
    );
    const exe = path.join(buildDir, "dbg_main");
    const link = spawnSync("node", [cli, dbgSrc, "-g", "--link", exe, "--profile", "debug"], {
      cwd: root,
      encoding: "utf8",
    });
    check(
      "-g --link --profile debug builds a binary that exits 0",
      link.status === 0 && spawnSync(exe).status === 0,
      link.stderr
    );
    if (link.status === 0) {
      const dumpers = [
        ["llvm-dwarfdump", ["--debug-line", exe]],
        ["objdump", ["--dwarf=decodedline", exe]],
      ];
      const tool = dumpers.find(([t]) => has(t));
      if (!tool) {
        skip("-g: neither llvm-dwarfdump nor objdump is installed; line table not inspected");
      } else {
        const dump = spawnSync(tool[0], tool[1], { encoding: "utf8" });
        const out = dump.stdout;
        // A row of the line table for our file: `<address> <line> <column> ...` (dwarfdump) or `dbg_main.ts <line> <addr>` (objdump).
        const hasRow =
          tool[0] === "llvm-dwarfdump"
            ? /^0x[0-9a-f]+\s+[1-9]\d*\s+\d+/m.test(out)
            : /dbg_main\.ts\s+[1-9]\d*\s+0x/.test(out);
        check(
          `${tool[0]}: the linked binary's line table names dbg_main.ts and has at least one row`,
          dump.status === 0 && out.includes("dbg_main.ts") && hasRow,
          out.slice(0, 2000) + dump.stderr
        );
      }
    }
    // The speed profile keeps the DWARF too: -g disables the strip step of build.sh.
    const speed = spawnSync("node", [cli, dbgSrc, "-g", "--link", `${exe}.speed`], {
      cwd: root,
      encoding: "utf8",
    });
    const symbols =
      speed.status === 0 && has("llvm-dwarfdump")
        ? spawnSync("llvm-dwarfdump", ["--debug-line", `${exe}.speed`], { encoding: "utf8" }).stdout
        : "";
    check(
      "-g --link (speed profile) is not stripped: the line table survives",
      speed.status === 0 && (!has("llvm-dwarfdump") || symbols.includes("dbg_main.ts")),
      speed.stderr + symbols.slice(0, 500)
    );
  }
}

// ---- WP15 §8: the `performance` diagnostic class -----------------------------------
// Warnings, not errors: a program that trips one still compiles and still exits 0.
// They print `file:line:col: performance: <text>` with the same excerpt an error
// gets, carry `"severity":"performance"` in `--json`, and `--no-warn-performance`
// silences the class without changing one byte of the IR. The guard cases matter
// most: a warning that fires where the compiler already did the right thing is what
// teaches people to ignore a whole diagnostic class.
if (!only || "performance".includes(only)) {
  /** Compile one case to its own output file and hand back the whole result. */
  const compile = (name, out, extra = []) =>
    spawnSync("node", [cli, path.join(casesDir, `${name}.ts`), "-o", path.join(buildDir, out), ...extra], {
      cwd: root,
      encoding: "utf8",
    });
  const summaries = (text) => text.split("\n").filter((l) => /:\d+:\d+: performance: /.test(l));

  const str = compile("perf_str_concat_loop", "perf_str.ll");
  const strLines = summaries(str.stderr);
  // `for`, `while`, a nested loop whose accumulator is declared one level out,
  // and `do` — each is a loop, and a template hole copies as much as `+` does.
  check(
    "performance: every self-accumulating string assignment in a loop warns, naming the variable and the `string[]` + `join` rewrite",
    str.status === 0 &&
      strLines.length === 4 &&
      strLines.map((l) => /:(\d+):(\d+): /.exec(l).slice(1, 3).join(":")).join(",") ===
        "7:5,14:5,24:7,33:5" &&
      strLines[0].includes("performance: `out` is rebuilt from its own value on every iteration of this loop") &&
      strLines[1].includes("performance: `tagged` is rebuilt from its own value") &&
      strLines[2].includes("performance: `row` is rebuilt from its own value") &&
      strLines[3].includes("performance: `tail` is rebuilt from its own value") &&
      strLines.every((l) => l.includes("collect the pieces in a `string[]` and `join` them after the loop")) &&
      str.stderr.includes("\n4 performance warnings\n"),
    str.stderr
  );
  check(
    "performance: a warning carries the same caret excerpt an error does",
    str.stderr.includes('  7 |     out = out + "ab";\n    |     ^~~\n'),
    str.stderr
  );

  const alloc = compile("perf_alloc_loop", "perf_alloc.ll");
  const allocLines = summaries(alloc.stderr);
  check(
    "performance: a dynamically sized `new Array<T>(n)` in a loop warns and names the hoist and the arena scope",
    alloc.status === 0 &&
      allocLines.length === 1 &&
      allocLines[0].includes(
        ":10:11: performance: `row` allocates a dynamically sized array on every iteration of this loop"
      ) &&
      allocLines[0].includes(
        "hoist the allocation above the loop and reuse it, or bracket the loop body with `Arena.mark()` and `Arena.release(m)`"
      ),
    alloc.stderr
  );

  // Memory that is allocated and then dropped. The function loses its arena
  // scope as well, so both the dropped value and everything else the body
  // allocated live until the program exits.
  const drop = compile("perf_arena_drop", "perf_arena_drop.ll");
  const dropLines = summaries(drop.stderr);
  check(
    "performance: an allocation assigned over an allocation warns once per dropped value, naming both rewrites",
    drop.status === 0 &&
      dropLines.length === 3 &&
      dropLines.map((l) => /:(\d+):(\d+): /.exec(l).slice(1, 3).join(":")).join(",") === "15:3,17:3,21:3" &&
      dropLines[0].includes(
        "`p` already holds an allocation and this one drops it: nothing can reach the old value from here and " +
          "nothing frees it, and assigning a local is also what stops this function from releasing its arena " +
          "memory at all, so both allocations live until the program exits. Give each value its own `const`, or " +
          "bracket the body with `Arena.mark()` and `Arena.release(m)`"
      ) &&
      dropLines[1].includes("`xs` already holds an allocation") &&
      dropLines[2].includes("`s` already holds an allocation"),
    drop.stderr
  );

  // The arithmetic rules. These are not advice about speed: each one is a
  // program that does not compute what it was written to compute, and the
  // message has to name the rewrite all the same.
  const over = compile("perf_overflow", "perf_overflow.ll");
  const overLines = summaries(over.stderr);
  check(
    "performance: `toI64(a * b)` and a shift count at the operand width both warn, each naming its rewrite",
    over.status === 0 &&
      overLines.length === 2 &&
      overLines[0].includes(
        "this `*` is computed in i32 and wraps before `toI64` widens the result, so the conversion cannot recover " +
          "an overflow that has already happened: convert the operands first, as `toI64(a) * toI64(b)`"
      ) &&
      overLines[1].includes(
        "the shift count 32 is at or beyond the 32 bits of the operand, so it is masked to 0 and this shifts by that instead"
      ),
    over.stderr
  );

  // Reported on the innermost expression that overflows: the third constant
  // here is `100000 * 100000 + 1`, and only the `*` is named, because the `+`
  // merely inherits a value that has already gone wrong.
  const consts = compile("perf_overflow_const", "perf_overflow_const.ll");
  const constLines = summaries(consts.stderr);
  check(
    "performance: a constant that does not fit its i32 warns once per innermost overflow, naming the value and the range",
    consts.status === 0 &&
      constLines.length === 3 &&
      constLines.map((l) => /:(\d+):(\d+): /.exec(l).slice(1, 3).join(":")).join(",") === "8:15,9:19,12:18" &&
      constLines[0].includes(
        "this computes with overflow: the result 2147483648 does not fit in i32 (the range is -2147483648 to " +
          "2147483647), and signed overflow is undefined behaviour rather than a wrap: widen the operands with " +
          "`toI64` first, or use --wrapping for two's-complement arithmetic"
      ) &&
      constLines[2].includes("the result 10000000000 does not fit in i32"),
    consts.stderr
  );

  // `--wrapping` makes the wrap the defined answer, so the constant rule has
  // nothing left to say and must not argue with the flag.
  const wrapped = compile("perf_overflow_wrapping", "perf_overflow_wrapping.ll", ["--wrapping"]);
  check(
    "performance: --wrapping silences the constant-overflow warning, which is only about undefined behaviour",
    wrapped.status === 0 && summaries(wrapped.stderr).length === 0,
    wrapped.stderr
  );

  // WP15 §2: a bounds check the proof could not remove. The three shapes are the
  // three ways a fact dies — a second array with its own length, a call that may
  // move `len`, and a cursor that walks down — and each message names the guard
  // that would prove both ends.
  const bounds = compile("perf_bounds_loop", "perf_bounds_loop.ll");
  const boundsLines = summaries(bounds.stderr);
  check(
    "performance: a bounds check that survived the proof warns once per access, naming the guard",
    bounds.status === 0 &&
      boundsLines.length === 3 &&
      boundsLines.map((l) => /:(\d+):(\d+): /.exec(l).slice(1, 3).join(":")).join(",") ===
        "12:24,20:36,28:24" &&
      boundsLines[0].includes("`i` is not proven to be in range for `ys` here, so this access keeps its bounds check") &&
      boundsLines[1].includes("`j` is not proven to be in range for `zs`") &&
      boundsLines[2].includes("`k` is not proven to be in range for `ws`") &&
      boundsLines.every((l) =>
        l.includes("proves both ends, and an unsigned index needs only the upper one")
      ),
    bounds.stderr
  );

  // The flag removes every check, so there is no surviving one to report.
  const boundsOff = compile("perf_bounds_loop", "perf_bounds_off.ll", ["--unchecked-indexing"]);
  check(
    "performance: --unchecked-indexing leaves no bounds check to warn about",
    boundsOff.status === 0 && summaries(boundsOff.stderr).length === 0,
    boundsOff.stderr
  );

  // The false-positive guards. Each of these compiles loops that concatenate or
  // allocate where the faster form is already what the compiler emits, or where the
  // program genuinely asked for the memory, so it must say nothing at all.
  for (const name of [
    "perf_str_concat_quiet",
    "perf_alloc_quiet",
    "perf_overflow_quiet",
    "perf_arena_quiet",
    // Every index proven, so no check survives and nothing is reported.
    "perf_bounds_quiet",
    // Literal spellings neither compiler folds: normalising them in stage0 would
    // fold exactly what stage1 refuses, and only one of the two would warn.
    "perf_overflow_spelling",
  ]) {
    const quiet = compile(name, `${name}.ll`);
    check(
      `performance: ${name} takes no slow path with a faster form to name, so nothing is reported`,
      quiet.status === 0 && summaries(quiet.stderr).length === 0,
      quiet.stderr
    );
  }

  // The flag decides what is printed and nothing else.
  const off = compile("perf_str_concat_loop", "perf_str_off.ll", ["--no-warn-performance"]);
  check(
    "performance: --no-warn-performance silences the class and leaves the IR byte-identical",
    off.status === 0 &&
      summaries(off.stderr).length === 0 &&
      stripHeader(fs.readFileSync(path.join(buildDir, "perf_str_off.ll"), "utf8")) ===
        stripHeader(fs.readFileSync(path.join(buildDir, "perf_str.ll"), "utf8")),
    off.stderr
  );

  // --json: one object per warning on stdout, with a severity a tool can filter on.
  const js = compile("perf_alloc_loop", "perf_alloc_json.ll", ["--json"]);
  const jsLines = js.stdout.trim().length > 0 ? js.stdout.trim().split("\n") : [];
  let jsObj = null;
  try {
    jsObj = JSON.parse(jsLines[0]);
  } catch {
    jsObj = null;
  }
  check(
    'performance: --json prints one object per warning on stdout with "severity":"performance", and exits 0',
    js.status === 0 &&
      jsLines.length === 1 &&
      jsObj !== null &&
      jsObj.severity === "performance" &&
      jsObj.line === 10 &&
      jsObj.column === 11 &&
      !jsObj.message.includes("|"),
    js.stdout + js.stderr
  );

  // An error report is never diluted with advice about code that is about to change.
  const mixedSrc = path.join(buildDir, "perf_mixed.ts");
  fs.writeFileSync(
    mixedSrc,
    'export function test(): number {\n  let s = "";\n  for (let i = 0; i < 2; i = i + 1) {\n    s = s + "x";\n  }\n  return s;\n}\n'
  );
  const mixed = spawnSync("node", [cli, mixedSrc, "-o", path.join(buildDir, "perf_mixed.ll")], {
    cwd: root,
    encoding: "utf8",
  });
  check(
    "performance: a compilation that failed prints its errors and none of its warnings",
    mixed.status === 1 && mixed.stderr.includes(": error: ") && summaries(mixed.stderr).length === 0,
    mixed.stderr
  );

  // The report is capped exactly where the error report is.
  const manySrc = path.join(buildDir, "perf_many.ts");
  fs.writeFileSync(
    manySrc,
    Array.from(
      { length: 25 },
      (_, i) =>
        `export function f${i}(): number {\n  let s = "";\n  for (let j = 0; j < 2; j = j + 1) {\n    s = s + "x";\n  }\n  return s.length;\n}`
    ).join("\n") + "\n"
  );
  const many = spawnSync("node", [cli, manySrc, "-o", path.join(buildDir, "perf_many.ll")], {
    cwd: root,
    encoding: "utf8",
  });
  check(
    "performance: 25 warnings print 20, then `...and 5 more performance warnings` and `25 performance warnings`",
    many.status === 0 &&
      summaries(many.stderr).length === 20 &&
      many.stderr.includes("\n...and 5 more performance warnings\n25 performance warnings"),
    many.stderr
  );
}

// ---- WP5: link -------------------------------------------------------------------
// Multi-module programs in tests/link/<name>/. `main.ts` is the entry; the program is
// compiled with `-o <dir>/` (one .ll per module) and `--link` (scripts/build.sh, speed
// profile) into build/test/link/<name>/app. Nothing can print yet (console.log is
// WP3), so each program returns its result from `main` and the harness compares the
// process exit code with `expected.code`; `expected.out` is the expected stdout
// (empty for now). Other optional files:
//   expected.err   compile must fail and stderr must contain this text
//   expected.ir    lines (substring match) that must appear in some emitted module
//   args           extra CLI flags (e.g. --strict-exports)
//   <module>.ll    golden IR for that module (header stripped, like tests/cases)
// Every positive test is also assembled (llvm-as), verified (opt -passes=verify),
// and checked for cross-module attribute agreement: each `declare` of a user
// function in an importer must match the exporter's `define` attribute for attribute.
const linkDir = path.join(root, "tests", "link");
const linkTests = fs.existsSync(linkDir)
  ? fs
      .readdirSync(linkDir)
      .filter((d) => fs.existsSync(path.join(linkDir, d, "main.ts")))
      .sort()
  : [];
const HAS_OPT = has("opt");

/** Parse `define`/`declare` headers into { name -> { kind, sig, attrs } } with attribute groups resolved. */
function functionHeaders(ir) {
  const groups = new Map();
  for (const m of ir.matchAll(/^attributes (#\d+) = \{ (.*) \}$/gm)) groups.set(m[1], m[2]);
  const out = new Map();
  for (const m of ir.matchAll(
    /^(define|declare) (?:internal )?(.*?) @([\w.]+)\((.*?)\)(?: (#\d+))?(?: \{)?$/gm
  )) {
    const params = m[4].replace(/ %[\w.]+(?=,|$)/g, ""); // drop parameter names: declares have none
    out.set(m[3], { kind: m[1], sig: `${m[2]} (${params})`, attrs: m[5] ? (groups.get(m[5]) ?? m[5]) : "" });
  }
  return out;
}

for (const name of linkTests) {
  if (only && !name.includes(only)) continue;
  const dir = path.join(linkDir, name);
  const side = (f) => path.join(dir, f);
  const read = (f) => fs.readFileSync(side(f), "utf8");
  const args = fs.existsSync(side("args")) ? read("args").trim().split(/\s+/).filter(Boolean) : [];
  const outDir = path.join(buildDir, "link", name) + path.sep;
  const exe = path.join(outDir, "app");
  fs.rmSync(outDir, { recursive: true, force: true });
  const r = spawnSync(
    "node",
    [cli, side("main.ts"), "-o", outDir, ...(HAS_CLANG ? ["--link", exe] : []), ...args],
    { cwd: root }
  );
  const stderr = String(r.stderr);

  if (fs.existsSync(side("expected.err"))) {
    const needle = read("expected.err").trim();
    check(
      `link/${name}: rejected with "${needle}"`,
      r.status === 1 && stderr.includes(needle),
      stderr || "(compiled successfully)"
    );
    continue;
  }
  if (r.status !== 0) {
    check(`link/${name}: compiles${HAS_CLANG ? " and links" : ""}`, false, stderr);
    continue;
  }

  const modules = fs
    .readdirSync(outDir)
    .filter((f) => f.endsWith(".ll"))
    .sort()
    .map((f) => ({ file: f, ir: fs.readFileSync(path.join(outDir, f), "utf8") }));
  for (const m of modules) {
    if (fs.existsSync(side(m.file))) {
      const expected = read(m.file).trim();
      const actual = stripHeader(m.ir);
      check(
        `link/${name}: ${m.file} matches golden`,
        actual === expected,
        `--- expected\n${expected}\n--- actual\n${actual}`
      );
    }
    if (HAS_LLVM_AS) {
      const as = spawnSync("llvm-as", [path.join(outDir, m.file), "-o", "/dev/null"]);
      check(`link/${name}: llvm-as accepts ${m.file}`, as.status === 0, String(as.stderr));
    }
    if (HAS_OPT) {
      const v = spawnSync("opt", ["-passes=verify", "-disable-output", path.join(outDir, m.file)]);
      check(`link/${name}: opt -passes=verify accepts ${m.file}`, v.status === 0, String(v.stderr));
    }
  }

  // Cross-module attribute agreement: importer `declare` == exporter `define`.
  const defines = new Map();
  for (const m of modules)
    for (const [sym, h] of functionHeaders(m.ir))
      if (h.kind === "define") defines.set(sym, { ...h, file: m.file });
  let declares = 0;
  const mismatches = [];
  for (const m of modules) {
    for (const [sym, h] of functionHeaders(m.ir)) {
      if (h.kind !== "declare" || !defines.has(sym)) continue; // runtime declares have no define here
      declares++;
      const d = defines.get(sym);
      if (h.sig !== d.sig || h.attrs !== d.attrs) {
        mismatches.push(
          `${m.file}: declare ${h.sig} { ${h.attrs} }\n${d.file}: define  ${d.sig} { ${d.attrs} }`
        );
      }
    }
  }
  check(
    `link/${name}: ${declares} imported declare(s) match their define(s) attribute for attribute`,
    declares > 0 && mismatches.length === 0,
    mismatches.join("\n") || "(no cross-module declares found)"
  );

  if (fs.existsSync(side("expected.ir"))) {
    const all = modules.map((m) => m.ir).join("\n");
    const missing = read("expected.ir")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !all.includes(l));
    check(
      `link/${name}: emitted IR contains every expected.ir line`,
      missing.length === 0,
      missing.map((l) => `missing: ${l}`).join("\n")
    );
  }

  if (HAS_CLANG) {
    const run = spawnSync(exe);
    const wantCode = Number(read("expected.code").trim());
    const wantOut = fs.existsSync(side("expected.out")) ? read("expected.out").trim() : "";
    check(
      `link/${name}: exits with ${wantCode} and stdout matches expected.out`,
      run.status === wantCode && String(run.stdout).trim() === wantOut,
      `--- expected exit ${wantCode}, stdout:\n${wantOut}\n--- actual exit ${run.status}, stdout:\n${run.stdout}${run.stderr}`
    );
  }
}

// An imported module's name — the one in its `ModuleID`, its `source_filename`
// and its `DIFile` — is the specifier resolved against the name the *importer*
// was given, never against the working directory. Two things ride on that: the
// emitted IR does not change with the directory the compiler was run from, and
// the self-hosted compiler can produce the same bytes without a `cwd` builtin
// it has no room for (WP19 §A3). Compiling the same program by absolute path
// is what tells the two rules apart: cwd-relative naming would answer
// `tests/link/diamond/b.ts` where this answers the absolute path the entry
// carried.
const diamondEntry = path.join(linkDir, "diamond", "main.ts");
if (fs.existsSync(diamondEntry)) {
  const absOut = path.join(buildDir, "link", "diamond-abs");
  fs.rmSync(absOut, { recursive: true, force: true });
  fs.mkdirSync(absOut, { recursive: true });
  const r = spawnSync("node", [cli, diamondEntry, "-o", `${absOut}${path.sep}`], {
    cwd: root,
    encoding: "utf8",
  });
  const imported = path.join(absOut, "b.ll");
  const header =
    r.status === 0 && fs.existsSync(imported) ? fs.readFileSync(imported, "utf8").split("\n")[0] : "";
  const want = `; ModuleID = '${path.join(linkDir, "diamond", "b.ts")}'`;
  check(
    "link/diamond: an imported module is named from the entry's own path, not from cwd",
    header === want,
    `--- expected\n${want}\n--- actual\n${header}\n${r.stderr}`
  );
}

// ---- WP1: optimisation ------------------------------------------------------------
// The emitted IR is target-neutral, so `opt` needs a triple before it believes it has
// vector registers; without one the loop vectoriser never fires. x86_64 is always built in.
const sumLoopLl = path.join(buildDir, "cf_sum_loop.ll");
if (has("opt") && fs.existsSync(sumLoopLl)) {
  const o = spawnSync("opt", ["-O2", "-S", "-mtriple=x86_64-unknown-linux-gnu", sumLoopLl]);
  const out = String(o.stdout);
  check(
    "opt -O2 vectorises the cf_sum_loop reduction (<4 x i32> or <8 x i32>)",
    o.status === 0 && /<(4|8) x i32>/.test(out),
    o.status === 0 ? out : String(o.stderr)
  );
  // Control-flow modules must satisfy the IR verifier (dominance, terminators, phis), not just the assembler.
  for (const name of cases.filter((c) => c.startsWith("cf_") && (!only || c.includes(only)))) {
    const ll = path.join(buildDir, `${name}.ll`);
    if (!fs.existsSync(ll)) continue;
    const v = spawnSync("opt", ["-passes=verify", "-disable-output", ll]);
    check(`${name}: opt -passes=verify accepts IR`, v.status === 0, String(v.stderr));
  }
}

// ---- WP18: generics ---------------------------------------------------------------
// The acceptance test of the whole package, and a golden cannot express it: an
// instantiation's `define` must be *byte-identical* to the `define` of the
// monomorphic function somebody would have written by hand, modulo the symbol
// name. If that ever stops holding, the instantiation path has started emitting
// something a hand-written function would not, which is a bug rather than a
// performance question (docs/wp18-generics.md §9, §12).
{
  const dir = path.join(buildDir, "generics");
  fs.mkdirSync(dir, { recursive: true });
  const twin = (name, source) => {
    const file = path.join(dir, `${name}.ts`);
    fs.writeFileSync(file, source);
    const out = path.join(dir, `${name}.ll`);
    const r = spawnSync("node", [cli, file, "-o", out], { cwd: root, encoding: "utf8" });
    if (r.status !== 0) return { error: `${r.stdout}${r.stderr}` };
    return { ir: fs.readFileSync(out, "utf8") };
  };
  /**
   * One `define` block, from its header to the closing brace, with the
   * attribute *group* resolved to the attributes it names. The index is
   * per module and depends on the order the groups were added, and the two
   * modules emit their functions in different orders — the template's
   * instantiations are appended after the functions the module declares — so
   * comparing `#0` against `#1` would fail on the numbering rather than on the
   * function. Resolving it compares the attributes themselves, which is the
   * stronger check anyway.
   */
  const defineOf = (ir, symbol) => {
    const lines = ir.split("\n");
    const at = lines.findIndex((line) => line.startsWith(`define `) && line.includes(`@${symbol}(`));
    if (at < 0) return "";
    const end = lines.indexOf("}", at);
    const block = lines.slice(at, end + 1);
    block[0] = block[0].replace(/#(\d+) \{$/, (_, n) => {
      const group = lines.find((line) => line.startsWith(`attributes #${n} = `));
      return `${group ? group.slice(`attributes #${n} = `.length) : `#${n}`} {`;
    });
    return block.join("\n");
  };
  const body = `{
  let total = 0;
  for (let i = 0; i < 4; i++) {
    total = total + i;
  }
  return x;
}`;
  const generic = twin("gen_twin", `const same = <T>(x: T, n: i32): T => ${body}\n\nexport const test = (): number => {\n  console.log(same(7, 1));\n  return 0;\n};\n`);
  const plain = twin("mono_twin", `const same = (x: i32, n: i32): i32 => ${body}\n\nexport const test = (): number => {\n  console.log(same(7, 1));\n  return 0;\n};\n`);
  const got = generic.ir ? defineOf(generic.ir, "same$i32") : "";
  const want = plain.ir ? defineOf(plain.ir, "same").replace("@same(", "@same$i32(") : "";
  check(
    "generics: an instantiation's `define` is the hand-written monomorphic twin's, symbol aside",
    want.length > 0 && got === want,
    `--- monomorphic\n${want}\n--- instantiated\n${got}\n${generic.error ?? ""}${plain.error ?? ""}`
  );
}
// Every generic module must satisfy the IR verifier, not just the assembler:
// an instantiation is emitted from side tables the module's own body never
// wrote into, which is exactly the shape a dominance bug would hide in.
if (has("opt")) {
  for (const name of cases.filter((c) => c.startsWith("gen_") && (!only || c.includes(only)))) {
    const ll = path.join(buildDir, `${name}.ll`);
    if (!fs.existsSync(ll)) continue;
    const v = spawnSync("opt", ["-passes=verify", "-disable-output", ll]);
    check(`${name}: opt -passes=verify accepts IR`, v.status === 0, String(v.stderr));
  }
}

// ---- WP4: arrays ------------------------------------------------------------------
// 1. Every arr_ module must pass the IR verifier (the bounds check adds blocks and `unreachable`).
// 2. A failed bounds check exits 1 with "index out of range: <idx> >= <len>" on stderr.
// 3. `arr_sum.ts` compiled with --unchecked-indexing must vectorise its sum loop under
//    `opt -O2`. The checked build vectorises too, but only where `sum` is inlined into
//    `main` and the length is a known constant: the standalone `sum` keeps a hoisted
//    length compare plus a per-iteration branch to the noreturn panic block, and LLVM
//    18's loop vectoriser does not handle multi-exit loops (see docs/wp4-arrays.md).
if (!only || "arrays".includes(only) || only.startsWith("arr")) {
  if (has("opt")) {
    for (const name of cases.filter((c) => c.startsWith("arr_") && (!only || c.includes(only)))) {
      const ll = path.join(buildDir, `${name}.ll`);
      if (!fs.existsSync(ll)) continue;
      const v = spawnSync("opt", ["-passes=verify", "-disable-output", ll]);
      check(`${name}: opt -passes=verify accepts IR`, v.status === 0, String(v.stderr));
    }
  }
  const panicLl = path.join(buildDir, "arr_bounds_panic.ll");
  if (HAS_CLANG && fs.existsSync(panicLl)) {
    const exe = path.join(buildDir, "arr_bounds_panic");
    const cc = spawnSync("clang", ["-Wno-override-module", "-O2", panicLl, ...RUNTIME_C, "-o", exe], {
      cwd: root,
    });
    const run = cc.status === 0 ? spawnSync(exe) : null;
    check(
      "arr_bounds_panic: exits 1 with `index out of range: 5 >= 3` on stderr (stdout keeps the earlier line)",
      run !== null &&
        run.status === 1 &&
        String(run.stderr).includes("index out of range: 5 >= 3") &&
        String(run.stdout).trim() === "3",
      run ? `exit ${run.status}\nstdout: ${run.stdout}\nstderr: ${run.stderr}` : String(cc.stderr)
    );
  }
  // WP15 §2: the proof is not a licence. The loop condition proves `i < xs.length`
  // on the way in, but the callee pops through the same array, so the fact dies at
  // the call and the access after it still panics.
  const shrinkLl = path.join(buildDir, "arr_bounds_shrink_panic.ll");
  if (HAS_CLANG && fs.existsSync(shrinkLl)) {
    const exe = path.join(buildDir, "arr_bounds_shrink_panic");
    const cc = spawnSync("clang", ["-Wno-override-module", "-O2", shrinkLl, "runtime/runtime.c", "-o", exe], {
      cwd: root,
    });
    const run = cc.status === 0 ? spawnSync(exe) : null;
    check(
      "arr_bounds_shrink_panic: a `pop` through a callee kills the proof, so the next access panics",
      run !== null &&
        run.status === 1 &&
        String(run.stderr).includes("index out of range: 1 >= 1") &&
        String(run.stdout).split("\n").filter((l) => l.length > 0).join(",") === "2,1,1",
      run ? `exit ${run.status}\nstdout: ${run.stdout}\nstderr: ${run.stderr}` : String(cc.stderr)
    );
  }

  // WP15: the array header and the element buffer are separate alias domains, so an
  // element store cannot be read as a clobber of a header. The consequence a golden
  // cannot express is that LICM then hoists `len` and `data` out of a loop that writes
  // elements: after `opt -O2` every `%struct.nish_array` access in `@scale` must sit
  // in the preheader, none in the loop body. Without the domains all four were reloaded
  // per iteration, which measured 1.6x on the same shape.
  const aliasLl = path.join(buildDir, "arr_alias_domains.ll");
  if (has("opt") && fs.existsSync(aliasLl)) {
    const o = spawnSync("opt", ["-O2", "-S", "-mtriple=x86_64-unknown-linux-gnu", aliasLl]);
    const body = String(o.stdout).match(/define[^\n]*@scale\b[\s\S]*?\n}/)?.[0] ?? "";
    // Everything from the loop's back-edge target onwards is the loop; the preheader is before it.
    // The GEPs hoist on their own (they are pure address arithmetic), so what tells the two builds
    // apart is the *loads*: `len` is `load i64` and `data` is `load ptr`, and the elements here are
    // `i32`, so neither spelling can be element traffic.
    const loop = body.slice(body.indexOf("\nwhile.body:"));
    const reloads = (loop.match(/load (i64|ptr),/g) ?? []).join(" ");
    check(
      "arr_alias_domains: opt -O2 hoists every array header load out of the loop",
      o.status === 0 && body !== "" && loop !== "" && reloads === "",
      o.status === 0 ? `reloaded in the loop: ${reloads || "(none)"}\n${body}` : String(o.stderr)
    );
  }
  if (has("opt")) {
    const uncheckedLl = path.join(buildDir, "arr_sum_unchecked.ll");
    const c = spawnSync(
      "node",
      [cli, path.join(casesDir, "arr_sum.ts"), "--unchecked-indexing", "-o", uncheckedLl],
      { cwd: root }
    );
    const o =
      c.status === 0
        ? spawnSync("opt", ["-O2", "-S", "-mtriple=x86_64-unknown-linux-gnu", uncheckedLl])
        : null;
    const out = o ? String(o.stdout) : "";
    check(
      "opt -O2 vectorises the arr_sum loop built with --unchecked-indexing (<4 x i32> or <8 x i32>)",
      o !== null && o.status === 0 && /<(4|8) x i32>/.test(out),
      o ? out || String(o.stderr) : String(c.stderr)
    );
    // The unchecked module must not declare the panic symbol at all.
    check(
      "arr_sum with --unchecked-indexing references no nish_panic_index",
      c.status === 0 && !fs.readFileSync(uncheckedLl, "utf8").includes("nish_panic_index"),
      String(c.stderr)
    );
    const checkedLl = path.join(buildDir, "arr_sum.ll");
    if (fs.existsSync(checkedLl)) {
      const oc = spawnSync("opt", ["-O2", "-S", "-mtriple=x86_64-unknown-linux-gnu", checkedLl]);
      const outc = String(oc.stdout);
      // The vector body lives in @nish_main (inlined sum, constant length); @sum itself stays scalar.
      const mainBody = outc.slice(outc.indexOf("@nish_main("));
      check(
        "opt -O2 vectorises the checked arr_sum loop once inlined into main (bounds check folded)",
        oc.status === 0 && /<(4|8) x i32>/.test(mainBody),
        oc.status === 0 ? outc : String(oc.stderr)
      );
    }
  }
}

// ---- WP15 §4: the fast slice ---------------------------------------------------------
// 1. Every str_ module must satisfy the IR verifier, because `slice`'s range check adds
//    blocks and an `unreachable` the way the array bounds check does.
// 2. A failed range check exits 1 naming the interval that was asked for, and the earlier
//    line still reaches stdout. The case slices a reversed pair, which is what separates
//    `slice` from `substring`: JavaScript's `substring` would swap the ends and answer.
// 3. The check is what the clamp is not: provable. `str_slice.ts` slices constant offsets
//    out of a literal, so after `opt -O2` not one `nish_panic_slice` call is left in the
//    module — the lean lowering costs nothing at all where the bounds are known, which is
//    the argument for having it beside `substring` rather than instead of it.
if (!only || "strings".includes(only) || only.startsWith("str")) {
  if (HAS_OPT) {
    for (const name of cases.filter((c) => c.startsWith("str_") && (!only || c.includes(only)))) {
      const ll = path.join(buildDir, `${name}.ll`);
      if (!fs.existsSync(ll)) continue;
      const v = spawnSync("opt", ["-passes=verify", "-disable-output", ll]);
      check(`${name}: opt -passes=verify accepts IR`, v.status === 0, String(v.stderr));
    }
    const sliceLl = path.join(buildDir, "str_slice.ll");
    if (fs.existsSync(sliceLl)) {
      const o = spawnSync("opt", ["-O2", "-S", sliceLl]);
      const out = String(o.stdout);
      check(
        "str_slice: opt -O2 proves every constant slice in range and drops the panic",
        o.status === 0 && out !== "" && !out.includes("nish_panic_slice"),
        o.status === 0 ? out : String(o.stderr)
      );
    }
  }
  const slicePanicLl = path.join(buildDir, "str_slice_panic.ll");
  if (HAS_CLANG && fs.existsSync(slicePanicLl)) {
    const exe = path.join(buildDir, "str_slice_panic");
    const cc = spawnSync("clang", ["-Wno-override-module", "-O2", slicePanicLl, "runtime/runtime.c", "-o", exe], {
      cwd: root,
    });
    const run = cc.status === 0 ? spawnSync(exe) : null;
    check(
      "str_slice_panic: exits 1 with `slice out of range: [4, 2) of length 5` on stderr",
      run !== null &&
        run.status === 1 &&
        String(run.stderr).includes("slice out of range: [4, 2) of length 5") &&
        String(run.stdout).trim() === "el",
      run ? `exit ${run.status}\nstdout: ${run.stdout}\nstderr: ${run.stderr}` : String(cc.stderr)
    );
  }
}

// ---- WP6: memory --------------------------------------------------------------------
// 1. Every mem_ module passes the IR verifier (allocas, scope calls, null compares).
// 2. mem_stack_struct.ts has no arena allocation left: every object is an alloca, so the
//    module never references nish_alloc_struct (and therefore emits no arena prelude).
// 3. mem_scope_dynamic_array.ts builds a `new Array<number>(n)` per call and is called
//    100000 times: the function's automatic arena scope releases each one, so the two
//    `Arena.used()` lines (before and after the loop) must be identical, with no
//    OS-specific RSS tooling involved. mem_stack_loop / mem_scope_string_temp print
//    their own `true` for the same property (checked by their .out files).
// 4. --no-stack-alloc keeps every object in the arena: the same source then does
//    reference nish_alloc_struct, and still runs to the same output.
if (!only || "memory".includes(only) || only.startsWith("mem")) {
  if (HAS_OPT) {
    for (const name of cases.filter((c) => c.startsWith("mem_") && (!only || c.includes(only)))) {
      const ll = path.join(buildDir, `${name}.ll`);
      if (!fs.existsSync(ll)) continue;
      const v = spawnSync("opt", ["-passes=verify", "-disable-output", ll]);
      check(`${name}: opt -passes=verify accepts IR`, v.status === 0, String(v.stderr));
    }
  }
  const stackLl = path.join(buildDir, "mem_stack_struct.ll");
  if (fs.existsSync(stackLl)) {
    const ir = fs.readFileSync(stackLl, "utf8");
    check(
      "mem_stack_struct: no nish_alloc_struct and no arena prelude, five `alloca %struct.` objects",
      !ir.includes("nish_alloc_struct") &&
        !ir.includes("@nish_arena =") &&
        (ir.match(/= alloca %struct\.(Pair|Point|Counter), align 8/g) ?? []).length === 5,
      ir
    );
  }
  const noStackLl = path.join(buildDir, "mem_stack_struct_nostack.ll");
  const ns = spawnSync(
    "node",
    [cli, path.join(casesDir, "mem_stack_struct.ts"), "--no-stack-alloc", "-o", noStackLl],
    { cwd: root }
  );
  const nsIr = ns.status === 0 ? fs.readFileSync(noStackLl, "utf8") : "";
  check(
    "--no-stack-alloc puts mem_stack_struct's objects back in the arena",
    ns.status === 0 &&
      nsIr.includes("call i8* @nish_alloc_struct(i64 8)") &&
      !/alloca %struct\.(Pair|Point|Counter), align/.test(nsIr),
    String(ns.stderr) || nsIr
  );
  if (HAS_CLANG && ns.status === 0) {
    const exe = path.join(buildDir, "mem_stack_struct_nostack");
    const cc = spawnSync("clang", ["-Wno-override-module", "-O2", noStackLl, ...RUNTIME_C, "-o", exe], {
      cwd: root,
    });
    const run = cc.status === 0 ? spawnSync(exe) : null;
    check(
      "mem_stack_struct with --no-stack-alloc prints the same output",
      run !== null && String(run.stdout).trim() === "21\n7\n22",
      run ? String(run.stdout) + String(run.stderr) : String(cc.stderr)
    );
  }
  const scopeExe = path.join(buildDir, "mem_scope_dynamic_array");
  if (HAS_CLANG && fs.existsSync(scopeExe)) {
    const run = spawnSync(scopeExe);
    const lines = String(run.stdout).trim().split("\n");
    check(
      "mem_scope_dynamic_array: Arena.used() is identical before and after 100000 scoped calls (arena stays flat)",
      run.status === 0 && lines.length === 4 && lines[1] === lines[3],
      String(run.stdout) + String(run.stderr)
    );
  }
}

// ---- WP6: every allocating builtin is an allocation site -----------------------------
// `ALLOCATING_BUILTINS` in src/codegen/escape.ts names the identifier builtins whose
// result is fresh arena memory. A builtin that belongs there and is missing is not a
// lost optimisation: the function that returns its result gets an automatic arena scope
// whose `nish_arena_release` runs before the `ret`, rewinding the arena past the bytes
// the caller is about to read. That shipped in 0.1.0 for `getenv` and printed a correct
// value that the next allocation overwrote, which is silent corruption rather than a
// crash (`tests/cases/mem_getenv_scope`, and `mem_read_or_null_scope` /
// `mem_readdir_scope` for the other two). Three cases pin three builtins; this pins the
// class, in two halves that are each derived rather than listed again:
//
//  1. **Which builtins allocate, mechanically.** A builtin allocates when its lowering
//     declares a runtime callee whose entry in src/codegen/runtime.ts answers a pointer
//     and is `noalias`. In that table `noalias` means "a fresh allocation per call",
//     which is exactly the property the set is about, and it is the reason the two
//     pointer-answering non-allocators are not candidates: `nish_platform` hands back
//     the same constant and is deliberately not `noalias`, and `process.argv` is
//     `malloc`ed once by the entry wrapper (neither is an identifier builtin either).
//     The lowering's own `callees` list is the link, so this asks the emitter rather
//     than a copy of the emitter.
//  2. **What membership buys, by compiling a probe.** For every builtin the signal
//     names, a generated program returns the builtin's result from a function that also
//     allocates locally -- the shape of `mem_getenv_scope` -- and the emitted IR must
//     contain no `nish_arena_release`.
//
// What this does not prove: that the C behind a `noalias` entry really bumps the arena
// (the table is where that fact is declared, and the interop section is what holds it to
// nish.h), and nothing about a hypothetical builtin that allocates through the inline
// allocator instead of a named runtime symbol -- a lowering like that would have to say
// so in `callees` to keep its caller's attributes honest, and saying so is what this
// reads. The lowerings come from dist/, which `npm test` has just built, while the set is
// read from src/: running this over a stale dist/ compares two different compilers.
if (!only || "allocating builtins".includes(only) || only.startsWith("mem")) {
  const { builtinFunctionEmitters } = await import(
    pathToFileURL(path.join(root, "dist", "codegen", "emit", "expressions.js")).href
  );
  const { RUNTIME_BY_NAME } = await import(
    pathToFileURL(path.join(root, "dist", "codegen", "runtime.js")).href
  );

  /**
   * The runtime symbols one builtin's lowering may call. `callees` is handed the checked
   * program and the call because a builtin's symbol can depend on its argument type
   * (`Number(s)` parses, `Number(n)` converts), so the question is asked once per
   * argument kind over a stub that answers that kind for every node, and the answers
   * are unioned: what matters here is whether *any* call of the builtin allocates.
   */
  const ARGUMENT_KINDS = ["string", "f64", "i32", "bool"];
  const calleesOf = (emitter) => {
    const symbols = new Set();
    const failures = [];
    for (const kind of ARGUMENT_KINDS) {
      const program = { types: { get: () => ({ kind }) } };
      const expr = { arguments: [{}, {}, {}] };
      try {
        for (const symbol of emitter.callees(program, expr)) symbols.add(symbol);
      } catch (e) {
        failures.push(`${kind}: ${e.message}`);
      }
    }
    return { symbols, failures };
  };

  /** The `declare` line's return part: the attributes and the type, before the `@name(`. */
  const returnPart = (fn) =>
    fn.signature.slice("declare ".length, fn.signature.indexOf(`@${fn.name}(`)).trim();

  /** A fresh allocation per call: `noalias` on a pointer return, as runtime.ts uses it. */
  const allocatesFreshMemory = (fn) => {
    const ret = returnPart(fn);
    return /\bnoalias\b/.test(ret) && /(?:i8\*|%struct\.nish_array\*)$/.test(ret);
  };

  /** builtin -> the first runtime symbol whose entry says the lowering allocates. */
  const allocating = new Map();
  const unreadable = [];
  const unknownSymbols = [];
  for (const [builtin, emitter] of Object.entries(builtinFunctionEmitters)) {
    const { symbols, failures } = calleesOf(emitter);
    if (failures.length === ARGUMENT_KINDS.length) {
      unreadable.push(`${builtin}: ${failures[0]}`);
      continue;
    }
    for (const symbol of symbols) {
      const fn = RUNTIME_BY_NAME.get(symbol);
      // A name the table does not know would read as "does not allocate", so the
      // signal is only as complete as this agreement.
      if (!fn) unknownSymbols.push(`${builtin} -> ${symbol}`);
      else if (allocatesFreshMemory(fn) && !allocating.has(builtin)) allocating.set(builtin, symbol);
    }
  }
  check(
    `every identifier builtin declares runtime callees the table knows (${Object.keys(builtinFunctionEmitters).length} builtins)`,
    unreadable.length === 0 && unknownSymbols.length === 0,
    [
      ...unreadable.map(
        (u) => `could not read the callees of ${u} -- teach this check the context that lowering needs`
      ),
      ...unknownSymbols.map((u) => `${u} is not in RUNTIME_FUNCTIONS (src/codegen/runtime.ts)`),
    ].join("\n")
  );

  // The set is read out of the source because it is private to escape.ts, which is
  // where it belongs: nothing but the escape analysis has any business consulting it.
  const escapeSrc = fs.readFileSync(path.join(root, "src", "codegen", "escape.ts"), "utf8");
  const setLiteral = escapeSrc.match(/ALLOCATING_BUILTINS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
  const declared = new Set([...(setLiteral?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]));
  check(
    "src/codegen/escape.ts declares ALLOCATING_BUILTINS as a literal set of names",
    setLiteral !== null && declared.size > 0,
    "the declaration moved or changed shape; this check reads it by name, so point it at the new one"
  );

  const missing = [...allocating].filter(([builtin]) => !declared.has(builtin));
  const stale = [...declared].filter((builtin) => !allocating.has(builtin));
  check(
    `ALLOCATING_BUILTINS lists every allocating builtin and nothing else (${[...allocating.keys()].join(", ")})`,
    missing.length === 0 && stale.length === 0,
    [
      ...missing.map(
        ([builtin, symbol]) =>
          `${builtin} allocates -- its lowering calls @${symbol}, whose entry in src/codegen/runtime.ts is a ` +
          `noalias pointer return, which in that table means a fresh allocation per call -- but it is not in ` +
          `ALLOCATING_BUILTINS in src/codegen/escape.ts. Add it there, or a function returning ${builtin}(...) ` +
          "gets an arena scope that releases the result before the ret. Add a tests/cases/mem_*_scope case for it " +
          "beside the other three while you are there.",
      ),
      ...stale.map(
        (builtin) =>
          `${builtin} is in ALLOCATING_BUILTINS but nothing its lowering calls is a noalias pointer-returning ` +
          "runtime symbol: either the lowering changed or the entry is stale.",
      ),
    ].join("\n")
  );

  // Half two: the consequence, for each builtin the signal named. The probe is
  // generated from the runtime signature -- one string argument per `i8*` parameter,
  // and a return type from the pointer kind and whether the entry is `nonnull` -- so
  // there is no per-builtin fixture to keep in step. A shape the generator cannot
  // express is a counted skip rather than a failure: half one is what proves
  // completeness, and this half is about what membership does.
  const nishReturnType = (fn) => {
    const ret = returnPart(fn);
    const orNull = /\bnonnull\b/.test(ret) ? "" : " | null";
    // The element type of an array is not in `%struct.nish_array*`; every
    // array-answering builtin answers `string[]` today, and a probe that does not
    // typecheck skips itself below rather than claiming anything.
    if (/i8\*$/.test(ret)) return `string${orNull}`;
    if (/%struct\.nish_array\*$/.test(ret)) return `string[]${orNull}`;
    return undefined;
  };
  const stringArity = (fn) => {
    const params = fn.signature.slice(fn.signature.indexOf("(") + 1, fn.signature.lastIndexOf(")"));
    const parts = params.split(",").map((p) => p.trim()).filter(Boolean);
    return parts.every((p) => p.startsWith("i8*")) ? parts.length : undefined;
  };
  for (const [builtin, symbol] of allocating) {
    const fn = RUNTIME_BY_NAME.get(symbol);
    const returnType = nishReturnType(fn);
    const arity = stringArity(fn);
    if (returnType === undefined || arity === undefined || arity === 0) {
      skip(`${builtin}: no arena-scope probe (@${symbol} takes or answers a shape the generator cannot write)`);
      continue;
    }
    const params = Array.from({ length: arity }, (_, i) => `arg${i}: string`).join(", ");
    const args = Array.from({ length: arity }, (_, i) => `arg${i}`).join(", ");
    // The template literal is the local allocation that gives the function something
    // to release, which is what made the missing sites visible in the first place.
    const probeSrc = [
      `export const probe = (${params}): ${returnType} => {`,
      "  const label = `probe ${arg0}`;",
      "  console.log(label);",
      `  return ${builtin}(${args});`,
      "};",
      "",
    ].join("\n");
    const probeTs = path.join(buildDir, `alloc_probe_${builtin}.ts`);
    const probeLl = path.join(buildDir, `alloc_probe_${builtin}.ll`);
    fs.writeFileSync(probeTs, probeSrc);
    const r = spawnSync("node", [cli, probeTs, "-o", probeLl], { cwd: root });
    if (r.status !== 0) {
      skip(`${builtin}: no arena-scope probe (the generated program did not compile: ${String(r.stderr).trim().split("\n")[0]})`);
      continue;
    }
    const ir = fs.readFileSync(probeLl, "utf8");
    const body = ir.match(/^define [^\n]*@probe\([^\n]*\{\n([\s\S]*?)^\}/m)?.[1] ?? "";
    // The `@nish_str_concat` is the template literal's own allocation: it is what there
    // would be to release, so a probe missing it would pass for the wrong reason.
    check(
      `${builtin}: a function returning its result keeps the arena (no nish_arena_release before the ret)`,
      body.includes(`@${symbol}(`) && body.includes("@nish_str_concat(") && !body.includes("nish_arena_release"),
      `${probeSrc}\n${ir}`
    );
  }
}

// ---- WP2: layout -------------------------------------------------------------------
// tests/layout/structs.ts declares fifteen classes, three of which `implements` an
// interface (WP25, whose layout is the interface's fields followed by their own),
// plus the WP15 §2a record `P`, whose *array* is contiguous storage: the C twin
// walks `data` as a `struct P *` and checks the stride and every field of every
// element, which is the half of the ABI a golden `.ll` cannot express.
// tests/layout/structs.c declares
// the same C structs (flattened) with `_Static_assert(sizeof(struct X) == N)`. The
// compiler's size for each class is read from the `nish_alloc_struct(i64 N)` in its
// `make<X>` function and must equal the C file's N; then the C program (built with
// -std=c11 -Wall -Wextra -Werror, which validates the asserts against clang's own
// layout) fills every struct through the C definition and reads each field back
// through the compiled getters, so every offset is verified at run time as well.
// The generated `--emit-header` must list the same structs with the same sizes and
// compile cleanly. Class modules must also pass `opt -passes=verify`.
if (!only || "layout".includes(only)) {
  const layoutTs = path.join(root, "tests", "layout", "structs.ts");
  const layoutC = path.join(root, "tests", "layout", "structs.c");
  const layoutLl = path.join(buildDir, "layout_structs.ll");
  const layoutH = path.join(buildDir, "layout_structs.h");
  const r = spawnSync("node", [cli, layoutTs, "-o", layoutLl, "--emit-header", layoutH], { cwd: root });
  check("layout: tests/layout/structs.ts compiles", r.status === 0, String(r.stderr));
  if (r.status === 0) {
    const ir = fs.readFileSync(layoutLl, "utf8");
    const fromIr = new Map();
    for (const m of ir.matchAll(/^define [^\n]*@make(\w+)\([^\n]*\{\n([\s\S]*?)^\}/gm)) {
      const alloc = m[2].match(/@nish_alloc_struct\(i64 (\d+)\)/);
      if (alloc) fromIr.set(m[1], Number(alloc[1]));
    }
    const fromC = new Map();
    for (const m of fs
      .readFileSync(layoutC, "utf8")
      .matchAll(/_Static_assert\(sizeof\(struct (\w+)\) == (\d+)/g)) {
      fromC.set(m[1], Number(m[2]));
    }
    const diffs = [];
    for (const [name, size] of fromC)
      if (fromIr.get(name) !== size) diffs.push(`${name}: C ${size}, IR ${fromIr.get(name)}`);
    check(
      `layout: compiler sizes match structs.c for ${fromC.size} structs (${[...fromC].map(([n, s]) => `${n}=${s}`).join(" ")})`,
      fromC.size === 16 && fromIr.size === 16 && diffs.length === 0,
      diffs.join("\n") || `IR sizes: ${JSON.stringify([...fromIr])}`
    );
    if (HAS_CLANG) {
      // WP25: the C header lists every class with its flattened fields; one that
      // `implements` an interface must therefore have the size the compiler (and
      // structs.c) computed.
      const headerCheck = path.join(buildDir, "layout_header_check.c");
      fs.writeFileSync(
        headerCheck,
        [
          '#include "layout_structs.h"',
          ...[...fromC].map(([n, s]) => `_Static_assert(sizeof(struct ${n}) == ${s}, "${n}");`),
          "int main(void) { return 0; }",
          "",
        ].join("\n")
      );
      const hc = spawnSync(
        "clang",
        [
          "-std=c11",
          "-Wall",
          "-Wextra",
          "-Werror",
          "-fsyntax-only",
          `-I${buildDir}`,
          "-Iruntime",
          headerCheck,
        ],
        { cwd: root }
      );
      check(
        `layout: --emit-header declares the ${fromC.size} structs (flattened) with the sizes structs.c asserts, under -Wall -Wextra -Werror`,
        hc.status === 0 && fs.readFileSync(layoutH, "utf8").includes("struct M {"),
        String(hc.stderr)
      );
    }
    if (HAS_CLANG) {
      const exe = path.join(buildDir, "layout_structs");
      const cc = spawnSync(
        "clang",
        [
          "-std=c11",
          "-Wall",
          "-Wextra",
          "-Werror",
          "-Wno-override-module",
          "-O2",
          layoutC,
          layoutLl,
          ...RUNTIME_C,
          "-o",
          exe,
        ],
        { cwd: root }
      );
      check(
        "layout: structs.c compiles with -std=c11 -Wall -Wextra -Werror (sizes agree with clang)",
        cc.status === 0,
        String(cc.stderr)
      );
      if (cc.status === 0) {
        const run = spawnSync(exe);
        check(
          "layout: every field offset agrees with clang at run time",
          run.status === 0 && String(run.stdout).trim() === "layout ok",
          `${run.stdout}${run.stderr}`
        );
      }
    }
  }
  if (HAS_OPT) {
    for (const name of cases.filter((c) => c.startsWith("cls_") && (!only || c.includes(only)))) {
      const ll = path.join(buildDir, `${name}.ll`);
      if (!fs.existsSync(ll)) continue;
      const v = spawnSync("opt", ["-passes=verify", "-disable-output", ll]);
      check(`${name}: opt -passes=verify accepts IR`, v.status === 0, String(v.stderr));
    }
  }
}

// ---- Checked integer division ---------------------------------------------------
// `/` and `%` on integers panic (exit 1) on a zero divisor or MIN / -1 instead of
// executing an sdiv/srem with a poison result. Both programs must print nothing after
// the offending line and name the failure on stderr.
if (!only || "division".includes(only) || only.startsWith("div") || only.startsWith("u_")) {
  for (const [name, needle, expectedOut] of [
    ["div_zero_panic", "attempt to divide by zero", "before"],
    ["div_overflow_panic", "attempt to divide with overflow", ""],
    // WP15: the cheaper one-compare unsigned check still catches a zero divisor.
    ["u_div_zero_panic", "attempt to divide by zero", "before"],
  ]) {
    const ll = path.join(buildDir, `${name}.ll`);
    if (!HAS_CLANG || !fs.existsSync(ll)) continue;
    const exe = path.join(buildDir, name);
    const cc = spawnSync("clang", ["-Wno-override-module", "-O2", ll, ...RUNTIME_C, "-lm", "-o", exe], {
      cwd: root,
    });
    const run = cc.status === 0 ? spawnSync(exe) : null;
    check(
      `${name}: exits 1 with "${needle}" on stderr`,
      run !== null &&
        run.status === 1 &&
        String(run.stderr).includes(needle) &&
        String(run.stdout).trim() === expectedOut,
      run ? `exit ${run.status}\nstdout: ${run.stdout}\nstderr: ${run.stderr}` : String(cc.stderr)
    );
  }
}

// ---- B. Pipeline checks -----------------------------------------------------------
if (!only && HAS_CLANG) {
  const rt = spawnSync(
    "clang",
    [
      "-std=c11",
      "-Wall",
      "-Wextra",
      "-Werror",
      "-O2",
      ...RUNTIME_C,
      "tests/runtime_test.c",
      "-o",
      path.join(buildDir, "runtime_test"),
    ],
    { cwd: root }
  );
  check(
    "runtime.c and runtime_os.c compile warning-free together and pass the runtime unit test",
    rt.status === 0 && spawnSync(path.join(buildDir, "runtime_test")).status === 0,
    String(rt.stderr)
  );

  // WP20 T0: the same file again with -DNISH_THREADS, which is the build where
  // the arena and the RNG seed are `_Thread_local`. The extra section it turns
  // on runs a worker thread and asserts that its arena is its own -- empty at
  // entry, disjoint from the parent's storage, and released and freed without
  // the parent losing a byte.
  const rtThreads = spawnSync(
    "clang",
    [
      "-std=c11",
      "-Wall",
      "-Wextra",
      "-Werror",
      "-O2",
      "-DNISH_THREADS=1",
      "-pthread",
      // Both translation units, as its non-threaded sibling above names both:
      // `runtime_test.c` exercises the file I/O, which lives in runtime_os.c
      // since the split, so naming only the core leaves `nish_write_file`,
      // `nish_append_file` and `nish_read_file` undefined at link time.
      ...RUNTIME_C,
      "tests/runtime_test.c",
      "-o",
      path.join(buildDir, "runtime_test_threads"),
    ],
    { cwd: root }
  );
  const rtThreadsRun = rtThreads.status === 0 ? spawnSync(path.join(buildDir, "runtime_test_threads")) : null;
  check(
    "runtime.c -DNISH_THREADS: every thread gets its own arena and RNG seed",
    rtThreadsRun !== null && rtThreadsRun.status === 0,
    String(rtThreads.stderr) + (rtThreadsRun ? String(rtThreadsRun.stdout) + String(rtThreadsRun.stderr) : "")
  );

  // Emit the runtime prelude, append an IR test that uses the inline allocator, and
  // link it against runtime.c: proves the IR struct layout matches the C struct.
  const preludeLl = path.join(buildDir, "prelude.ll");
  execFileSync("node", [cli, "tests/cases/string_params.ts", "--runtime-decls", "-o", preludeLl], {
    cwd: root,
    stdio: "pipe",
  });
  const smokeLl = path.join(buildDir, "alloc_smoke.ll");
  fs.writeFileSync(
    smokeLl,
    fs.readFileSync(preludeLl, "utf8") + fs.readFileSync(path.join(root, "tests/ir/alloc_smoke.ll"), "utf8")
  );
  const smokeExe = path.join(buildDir, "alloc_smoke");
  const b = spawnSync(
    "bash",
    [
      "scripts/build.sh",
      smokeLl,
      "runtime/runtime.c",
      "tests/ir/alloc_smoke_main.c",
      "-o",
      smokeExe,
      "--profile",
      "speed",
    ],
    { cwd: root }
  );
  check("inline arena allocator links with runtime.c (speed profile, LTO)", b.status === 0, String(b.stderr));
  if (b.status === 0) {
    const r = spawnSync(smokeExe);
    check("inline allocator bump matches C arena layout (delta 16)", r.status === 0, String(r.stdout));
  }

  // WP20 T0: the same smoke, with `--threads` on both halves. It is the layout
  // check the flag needs, because the flag changes the storage class of a
  // global the IR and the C both name: the IR declares `@nish_arena`
  // thread-local, `scripts/build.sh --threads` compiles runtime.c with
  // -DNISH_THREADS so the definition is too, and the driver then asks the
  // question the flag exists for -- does a second thread bump its own arena?
  // (`-pthread` is passed as an input so it reaches clang; build.sh forwards
  // anything it does not recognise, the way it already receives `-lm`.)
  const tlsPreludeLl = path.join(buildDir, "prelude_threads.ll");
  execFileSync("node", [cli, "tests/cases/string_params.ts", "--runtime-decls", "--threads", "-o", tlsPreludeLl], {
    cwd: root,
    stdio: "pipe",
  });
  const tlsPrelude = fs.readFileSync(tlsPreludeLl, "utf8");
  check(
    "--threads declares @nish_arena thread-local and changes nothing else in the prelude",
    tlsPrelude.split("thread_local").length === 2 &&
      tlsPrelude.replace(" thread_local(initialexec)", "") === fs.readFileSync(preludeLl, "utf8"),
    "the --threads prelude differs from the ordinary one by more than the arena's storage class"
  );
  const tlsSmokeLl = path.join(buildDir, "alloc_smoke_threads.ll");
  fs.writeFileSync(
    tlsSmokeLl,
    tlsPrelude + fs.readFileSync(path.join(root, "tests/ir/alloc_smoke.ll"), "utf8")
  );
  const tlsSmokeExe = path.join(buildDir, "alloc_smoke_threads");
  const tb = spawnSync(
    "bash",
    [
      "scripts/build.sh",
      tlsSmokeLl,
      "runtime/runtime.c",
      "tests/ir/alloc_smoke_threads_main.c",
      "-pthread",
      "-o",
      tlsSmokeExe,
      "--profile",
      "speed",
      "--threads",
    ],
    { cwd: root }
  );
  check(
    "--threads: the thread-local allocator links with runtime.c -DNISH_THREADS (speed profile, LTO)",
    tb.status === 0,
    String(tb.stderr)
  );
  if (tb.status === 0) {
    const r = spawnSync(tlsSmokeExe);
    check(
      "--threads: two threads bump two arenas (16 apart, 32 used, each)",
      r.status === 0,
      String(r.stdout) + String(r.stderr)
    );
  }

  // The negative half, and the reason the two flags never have to be kept in
  // step by hand: thread-local IR linked against a runtime that was built
  // without -DNISH_THREADS is a *link* error on every ELF target, not a program
  // with two arenas. A silent mismatch is the one failure mode this design
  // could have had, so it is pinned rather than assumed.
  const mismatch = spawnSync(
    "clang",
    [
      "-Wno-override-module",
      "-O2",
      tlsSmokeLl,
      "runtime/runtime.c",
      "tests/ir/alloc_smoke_main.c",
      "-lm",
      "-o",
      path.join(buildDir, "alloc_smoke_mismatch"),
    ],
    { cwd: root }
  );
  check(
    "--threads IR refuses to link against a runtime built without -DNISH_THREADS",
    mismatch.status !== 0 && /TLS|thread.local/i.test(String(mismatch.stderr)),
    `exit ${mismatch.status}\n${mismatch.stderr}`
  );

  // The check above links for the host, so it only ever proved the layout on a 64-bit
  // target. The IR is target-neutral — `%struct.nish_arena = type { i8*, i64, i64, i8* }`
  // is what every compiled function inlines — so the C side has to hold those offsets
  // on wasm32 too, where a pointer is 4 bytes and `size_t` used to move `off` and `cap`
  // to bytes 4 and 8. That mismatch made the wasi profile hand out wild pointers for any
  // program allocating from compiled code. -fsyntax-only needs no sysroot and no linker,
  // so the guard runs wherever clang does.
  const abiSrc = path.join(buildDir, "abi_layout.c");
  const abiInclude = `-I${path.join(root, "runtime")}`;
  fs.writeFileSync(
    abiSrc,
    [
      "/* Generated by tests/run.js: the runtime ABI layouts, asserted per target. */",
      "#include <stddef.h>",
      '#include "nish.h"',
      '_Static_assert(sizeof(struct nish_arena) == 32, "arena: %struct.nish_arena = { i8*, i64, i64, i8* }");',
      '_Static_assert(offsetof(struct nish_arena, off) == 8, "arena.off is the field the inlined allocator bumps");',
      '_Static_assert(offsetof(struct nish_arena, cap) == 16, "arena.cap is the field the inlined allocator compares");',
      '_Static_assert(offsetof(struct nish_arena, chunks) == 24, "arena.chunks");',
      '_Static_assert(offsetof(nish_str, data) == 8, "nish_str = { i64 len, bytes }");',
      '_Static_assert(sizeof(nish_array) == 24, "nish_array = { i64, i64, i8* }");',
      '_Static_assert(offsetof(nish_array, cap) == 8, "nish_array.cap");',
      '_Static_assert(offsetof(nish_array, data) == 16, "nish_array.data, the offset the wasm loader reads");',
      "",
    ].join("\n")
  );
  // Each target twice: the ordinary header, and the one a `--threads` host
  // includes. `-DNISH_THREADS` moves the arena into thread-local storage and
  // must move nothing else, so the same assertions have to hold under it —
  // a storage class is not a layout, and this is where that is written down.
  for (const target of ["host", "wasm32-unknown-unknown"]) {
    const flags = target === "host" ? [] : [`--target=${target}`];
    for (const threads of [[], ["-DNISH_THREADS=1"]]) {
      const a = spawnSync(
        "clang",
        [...flags, ...threads, "-std=c11", "-Wall", "-Wextra", "-Werror", abiInclude, "-fsyntax-only", abiSrc],
        { cwd: root }
      );
      const how = threads.length > 0 ? " under -DNISH_THREADS" : "";
      check(`nish.h layouts match the IR types on ${target}${how}`, a.status === 0, String(a.stderr));
    }
  }

  const addLl = path.join(buildDir, "add.ll");
  const exe = path.join(buildDir, "add_size");
  const r = spawnSync(
    "bash",
    ["scripts/build.sh", addLl, "runtime/runtime.c", "examples/main.c", "-o", exe, "--profile", "size"],
    { cwd: root }
  );
  const run = r.status === 0 ? spawnSync(exe) : null;
  check(
    "size profile builds a working stripped binary",
    run !== null && String(run.stdout).trim() === "add(2, 3) = 5",
    String(r.stderr)
  );

  if (has("wasm-ld")) {
    const wasm = path.join(buildDir, "add.wasm");
    const w = spawnSync("bash", ["scripts/build.sh", addLl, "-o", wasm, "--profile", "wasm"], { cwd: root });
    const host = w.status === 0 ? spawnSync("node", ["examples/node-host.mjs", wasm], { cwd: root }) : null;
    check(
      "wasm profile builds a module Node can import",
      host !== null && String(host.stdout).trim() === "add(2, 3) = 5",
      String(w.stderr) + (host ? String(host.stderr) : "")
    );
  }

  // WP7: the wasi profile links runtime.c against wasi-libc, so string programs run under
  // any WASI host; Node's own implementation runs it here. Needs a WASI sysroot (wasi-sdk
  // or the wasi-libc package; WASI_SYSROOT overrides the default locations) and, with a
  // distro clang, compiler-rt's wasm32 builtins (see scripts/build.sh); otherwise skipped.
  const wasiSysroot = [
    process.env.WASI_SYSROOT,
    "/usr/lib/wasi-sysroot",
    "/opt/wasi-sdk/share/wasi-sysroot",
    "/usr/share/wasi-sysroot",
  ].find((d) => d && fs.existsSync(path.join(d, "lib")));
  if (wasiSysroot && has("wasm-ld")) {
    const wasm = path.join(buildDir, "argv_echo.wasm");
    const w = spawnSync(
      "bash",
      [
        "scripts/build.sh",
        path.join(buildDir, "argv_echo.ll"),
        "runtime/runtime.c",
        "-o",
        wasm,
        "--profile",
        "wasi",
      ],
      { cwd: root }
    );
    const argv = fs.readFileSync(path.join(casesDir, "argv_echo.argv"), "utf8").trim().split(/\s+/);
    const host =
      w.status === 0
        ? spawnSync("node", ["--no-warnings", "examples/wasi-host.mjs", wasm, ...argv], { cwd: root })
        : null;
    const want = fs.readFileSync(path.join(casesDir, "argv_echo.out"), "utf8").trim();
    check(
      `wasi profile (sysroot ${wasiSysroot}) builds argv_echo and Node's WASI runs it with the native output`,
      host !== null && host.status === 0 && String(host.stdout).trim() === want,
      String(w.stderr) + (host ? String(host.stdout) + String(host.stderr) : "")
    );

    // web/: the compiler itself as one wasi module, driven through web/worker.mjs
    // over the in-memory filesystem in web/wasi.mjs — the browser path, exercised
    // without a browser. The IR has to be the bytes stage0 writes for the same
    // input, because a playground that emits *nearly* the right IR is worse than
    // no playground. This is also the end-to-end guard on the arena ABI: the
    // compiler allocates from compiled code on every node it parses, so a wasm32
    // layout that disagrees with the IR traps here long before it prints anything.
    const compilerWasm = path.join(buildDir, "nish.wasm");
    const linked = spawnSync(
      "node",
      [cli, "self/compile.ts", "--link", compilerWasm, "--profile", "wasi"],
      { cwd: root }
    );
    check(
      "web: self/ links into one wasi module (the compiler as nish.wasm)",
      linked.status === 0,
      String(linked.stderr)
    );
    if (linked.status === 0) {
      const referenceLl = path.join(buildDir, "web_add.ll");
      execFileSync("node", [cli, "examples/add.ts", "-o", referenceLl], { cwd: root, stdio: "pipe" });
      const worker = spawnSync("node", ["web/compile.mjs", compilerWasm, "examples/add.ts"], { cwd: root });
      check(
        "web: nish.wasm in a worker emits stage0's IR for examples/add.ts, byte for byte",
        worker.status === 0 && String(worker.stdout) === fs.readFileSync(referenceLl, "utf8"),
        String(worker.stderr)
      );
    }
  } else {
    skip(`skipped: no WASI sysroot${has("wasm-ld") ? "" : " and no wasm-ld"} (set WASI_SYSROOT or install wasi-sdk, see docs/INSTALL.md): wasi profile not built`
    );
  }
} else if (!HAS_CLANG) {
  skip("clang not installed: native round trips and pipeline checks skipped");
}

// ---- WP7: the runtime .text budgets ------------------------------------------------
// The C runtime is linked into every native binary, so its machine code is a cost every
// program that touches the runtime pays. The budget was a row in docs/wp7-runtime.md and
// a reviewer's memory until this check, which is why nobody noticed the tree drift from
// the 2,544 bytes WP14 D4 recorded to 4,154 -- a review rule cannot see a number that no
// run prints.
//
// The metric is the sum of every `.text*` section rather than the single `.text` line
// wp7 quoted, because that sum is what a linked binary pays: `clang -Oz` puts cold code
// in `.text.unlikely.`, so a ceiling on `.text` alone can also be met by moving code
// into another section instead of by making it smaller. The two other numbers in that
// table are history rather than limits -- source bytes mostly measure comments, and the
// `text` column of plain `size` adds the read-only constants and the `.eh_frame` unwind
// tables that the size build profile strips.
//
// There are two budgets because there are two translation units, and they grow for
// unrelated reasons. `runtime.c` is the core every program touches whatever it does --
// the arena, strings, arrays, number formatting, the panics -- and that is a closed set,
// so its ceiling should come down over time and never up. `runtime_os.c` is the syscall
// wrappers, and that surface grows whenever the language reaches further into the
// operating system: three builtins (`readdirSync`, `spawnSyncTo`, `monotonicNanos`) took
// the single old budget from 4,096 to 4,864 and moved the number a reader saw for "the
// runtime" for a reason that had nothing to do with the arena or the strings. Section GC
// already meant a program calling none of them paid nothing; now the measurement says so
// too. One gate, two constants, two reasons.
/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c runtime/runtime.c`.
 *
 * Measured 3,480 bytes on 2026-09-12 with clang 18.1.3 on linux-x64 (`.text` 3,449 plus
 * `.text.unlikely.` 31), the whole runtime's 4,670 less the 1,190 bytes that moved into
 * runtime_os.c. The budget is the next 256-byte boundary above that measurement, so 104
 * bytes are left. That is deliberately tight: this half is a closed set, so a commit that
 * needs the room is a commit that grew something which was not supposed to grow, and
 * raising this number -- unlike raising the one below it -- should be rare enough to be
 * argued for. Either way it comes with its own measurement and a row in
 * docs/wp7-runtime.md ("Runtime additions and budget"); it is not a way to get green.
 */
const RUNTIME_TEXT_BUDGET = 3584;
/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c runtime/runtime_os.c`.
 *
 * Measured 1,190 bytes on 2026-09-12 with clang 18.1.3 on linux-x64 (`.text` 1,155 plus
 * `.text.unlikely.` 35, which is `nish_io_fail`), for the file I/O, the directory and
 * subprocess calls, `getenv`, the monotonic clock and the two constant host strings. The
 * budget is the next 256-byte boundary above it, 90 bytes of headroom, which is less than
 * one syscall wrapper on purpose: `nish_readdir` alone is 294 bytes, so the next builtin
 * that reaches into the operating system has to raise this number in the commit that adds
 * it, with the measurement, and cannot borrow room from the arena to hide in.
 *
 * The two together are 4,864 -- exactly the single budget they replace, which is a
 * coincidence and not a constraint.
 */
const RUNTIME_OS_TEXT_BUDGET = 1280;
/**
 * Ceiling on the same `runtime.c` compiled with `-DNISH_THREADS=1`, which is the build
 * `--threads` links (WP20 T0): the arena and the RNG seed become `_Thread_local`.
 *
 * Measured 3,605 bytes on 2026-09-12 with clang 18.1.3 on linux-x64, 125 more than the
 * default build and 21 *above* `RUNTIME_TEXT_BUDGET` — which is exactly why it needs a
 * number of its own instead of sharing one. The default measurement cannot see this
 * configuration, so without a row of its own the threads build's code size was ungated
 * while the gate stayed green: `--threads` is a flag a user passes, not a experiment, and
 * `_Thread_local` storage is the kind of thing that grows quietly.
 *
 * It is deliberately a *separate* ceiling rather than a raised shared one. Making the core
 * budget 3,840 to cover both would give the default build 360 bytes of room it has no
 * business having, and the point of the split was that a number should mean one thing.
 */
const RUNTIME_THREADS_TEXT_BUDGET = 3840;
if (!only || "runtime-budget".includes(only) || "wp7".includes(only)) {
  // A byte-exact ceiling is a fact about one target and one compiler, not about the
  // source, so everywhere else the honest answer is a counted skip rather than a number
  // that would fail for the wrong reason.
  const budgetSkip = () => {
    const host = `${process.platform}-${process.arch}`;
    if (host !== "linux-x64")
      return (
        `runtime .text budgets: measured on linux-x64 and this host is ${host}; ` +
        "a byte-exact ceiling is a fact about one target and one compiler version"
      );
    if (!HAS_CLANG) return "clang not installed: the runtime .text budgets are not measured";
    if (!has("size"))
      return "size (binutils or llvm) not installed: the runtime .text budgets are not measured";
    return null;
  };
  const reason = budgetSkip();
  if (reason !== null) skip(reason);
  else {
    for (const [src, budget, constant, flags] of [
      ["runtime/runtime.c", RUNTIME_TEXT_BUDGET, "RUNTIME_TEXT_BUDGET", []],
      ["runtime/runtime_os.c", RUNTIME_OS_TEXT_BUDGET, "RUNTIME_OS_TEXT_BUDGET", []],
      ["runtime/runtime.c", RUNTIME_THREADS_TEXT_BUDGET, "RUNTIME_THREADS_TEXT_BUDGET", ["-DNISH_THREADS=1"]],
    ]) {
      const name = path.basename(src);
      // The flags are in the check's name and in the object's, so the two rows for
      // runtime.c read as the two configurations they are rather than as a repeat.
      const label = flags.length > 0 ? `${name} ${flags.join(" ")}` : name;
      const stem = `${name.replace(/\.c$/, "")}${flags.length > 0 ? "_threads" : ""}`;
      const obj = path.join(buildDir, `${stem}_budget.o`);
      const cc = spawnSync("clang", ["-Oz", ...flags, "-c", src, "-o", obj], { cwd: root });
      const sz = cc.status === 0 ? spawnSync("size", ["-A", obj]) : null;
      // `size -A` prints one `<section> <size> <addr>` row per section; every row whose
      // name starts with `.text` counts, whatever clang decided to call it.
      const sections = String(sz?.stdout ?? "")
        .split("\n")
        .map((line) => line.trim().split(/\s+/))
        .filter((row) => row[0].startsWith(".text") && /^\d+$/.test(row[1] ?? ""))
        .map((row) => [row[0], Number(row[1])]);
      const total = sections.reduce((sum, [, bytes]) => sum + bytes, 0);
      const breakdown = sections.map(([section, bytes]) => `${section} ${bytes}`).join(" + ");
      check(
        `${label}: .text* at -Oz fits the ${budget} byte budget`,
        cc.status === 0 && sections.length > 0 && total <= budget,
        cc.status !== 0
          ? String(cc.stderr)
          : sections.length === 0
            ? `size -A printed no .text section:\n${sz.stdout}${sz.stderr}`
            : `measured ${total} bytes (${breakdown}), budget ${budget}, ` +
              `over by ${total - budget}.\n` +
              `Shrink the addition, or raise ${constant} in tests/run.js and add the ` +
              "measured row to docs/wp7-runtime.md saying why it moved."
      );
    }
  }
}

// ---- The golden runner written in Nish ---------------------------------------------
// `tests/nish/run.ts` is the suite's section A — the golden cases — implemented in
// the language instead of in Node, on top of `std/testing`, `std/text` and the three
// builtins that made it possible (`readdirSync`, `spawnSyncTo`, `monotonicNanos`).
// It is the only thing here that exercises those three together on a real workload
// rather than in a case written to pin one rule.
//
// This runs it over the `pop` cases and not over the corpus, deliberately: the
// runner spawns a compiler per case, so a full pass costs about four and a half
// minutes, and paying that on every `npm test` would double the suite to prove
// what a handful of cases already prove — one golden, one native round trip and
// three rejections. `npm run test:nish` is the full pass.
if (!only || "nish-runner".includes(only)) {
  if (!HAS_CLANG) {
    skip("the golden runner written in Nish (clang not found, and it links)");
  } else {
    const irDir = path.join(buildDir, "nish-runner.ir") + path.sep;
    const runnerExe = path.join(buildDir, "nish-runner");
    const built = spawnSync("node", [cli, path.join("tests", "nish", "run.ts"), "-o", irDir, "--link", runnerExe], {
      cwd: root,
    });
    if (check("tests/nish/run.ts compiles and links", built.status === 0, String(built.stderr))) {
      // cwd is the repository root because the runner addresses `tests/cases` and
      // `dist/index.js` by relative path: there is no `cwd` builtin for it to
      // build an absolute one from, which is also why it folds `<root>/` out of a
      // golden rather than into its own output.
      const ran = spawnSync(runnerExe, ["pop"], { cwd: root });
      const report = String(ran.stdout);
      check(
        "the Nish runner agrees with the goldens over the `pop` cases (one golden, one native run, three rejections)",
        ran.status === 0 && / 0 failed, /.test(report),
        report + String(ran.stderr)
      );
    }
  }
}

// ---- The CLI contract checked in Nish ------------------------------------------------
// `tests/nish/cli.ts` asks the questions the WP12 block below asks — the streams and
// the exit-code bands, `--help` against a usage error, and one flat `--json` object
// per diagnostic — from a *consumer written in the language*: it reads the objects
// with `std/json`, the streams with `std/text` and reports through `std/testing`,
// and it takes the version it expects from `package.json` with the same reader.
//
// Unlike the golden runner above this one runs in full, because it spawns eighteen
// compilers rather than four hundred: the contract is what every wrapper depends on,
// and a check of it that only CI runs is a check that rots. `npm run test:cli` is
// the same pass by hand, and `build/nish-cli build/nish` points it at the
// self-hosted compiler.
if (!only || "nish-cli".includes(only) || "contract".includes(only)) {
  if (!HAS_CLANG) {
    skip("the CLI contract checked in Nish (clang not found, and it links)");
  } else {
    const irDir = path.join(buildDir, "nish-cli.ir") + path.sep;
    const cliExe = path.join(buildDir, "nish-cli");
    const built = spawnSync("node", [cli, path.join("tests", "nish", "cli.ts"), "-o", irDir, "--link", cliExe], {
      cwd: root,
    });
    if (check("tests/nish/cli.ts compiles and links", built.status === 0, String(built.stderr))) {
      // cwd is the repository root: the harness addresses `dist/index.js` and
      // `package.json` by relative path, as the golden runner addresses the corpus.
      const ran = spawnSync(cliExe, [], { cwd: root, encoding: "utf8" });
      const report = String(ran.stdout);
      check(
        "a Nish program reading the CLI's own output agrees with its documented contract",
        ran.status === 0 && / 0 failed, /.test(report),
        report + String(ran.stderr)
      );
    }
  }
}

// ---- WP8: interop ------------------------------------------------------------------
// runtime/nish.h is the public C ABI; --emit-header / --emit-dts / --emit-napi derive
// host-side declarations from the same checked program the IR came from. Checks:
//   - every function in src/codegen/runtime.ts has a prototype in nish.h, and the
//     header is clean under -Wall -Wextra -Werror as C11 and as C++
//   - generated headers compile under the same flags and link a C driver (including a
//     function named `double`, bound through NISH_SYMBOL), strings map to nish_str, and
//     --strict-exports hides internal functions
//   - the generated .d.ts type-checks with tsc; string functions are commented out
//   - the N-API shim compiles warning-free, builds into a .node addon with the napi
//     profile, loads in Node, type-checks its arguments, and agrees with the wasm build
//     of the same module (skipped when the Node headers are not installed)
if (!only || "interop".includes(only)) {
  const interopDir = path.join(buildDir, "interop");
  fs.mkdirSync(interopDir, { recursive: true });
  const runtimeDir = path.join(root, "runtime");
  const publicHeader = fs.readFileSync(path.join(runtimeDir, "nish.h"), "utf8");
  const { RUNTIME_FUNCTIONS } = await import(pathToFileURL(path.join(root, "dist", "codegen", "runtime.js")).href);
  const runtimeNames = [
    ...RUNTIME_FUNCTIONS.filter((f) => !f.intrinsic).map((f) => f.name),
    "nish_alloc_struct",
  ];
  const undeclared = runtimeNames.filter((n) => !new RegExp(`\\b${n}\\s*\\(`).test(publicHeader));
  check(
    `nish.h declares every runtime.ts function (${runtimeNames.length}) and the arena global`,
    undeclared.length === 0 && publicHeader.includes("extern NISH_TLS struct nish_arena nish_arena;"),
    `missing: ${undeclared.join(", ")}`
  );
  // WP20 T0: `NISH_TLS` is the storage class of the arena, and a host that
  // includes this header has to agree with the runtime about it. The macro is
  // defined in three places that are one contract — the header a host reads,
  // and the two runtimes — so the three spellings are compared rather than
  // trusted.
  const tlsMacro = /#ifdef NISH_THREADS\n#define NISH_TLS _Thread_local\n#else\n#define NISH_TLS\n#endif/;
  const tlsSources = ["nish.h", "runtime.c", "runtime_wasm.c"];
  const withoutMacro = tlsSources.filter((f) => !tlsMacro.test(fs.readFileSync(path.join(runtimeDir, f), "utf8")));
  check(
    "NISH_TLS is defined the same way in nish.h, runtime.c and runtime_wasm.c",
    withoutMacro.length === 0,
    `missing or different in: ${withoutMacro.join(", ")}`
  );

  const strictC = [
    "-std=c11",
    "-Wall",
    "-Wextra",
    "-Werror",
    "-Wno-override-module",
    `-I${runtimeDir}`,
    `-I${interopDir}`,
  ];
  // Resolve tsc the way `require("typescript")` does, so a worktree without its own node_modules still finds it.
  let tsc = path.join(root, "node_modules", "typescript", "bin", "tsc");
  try {
    tsc = require.resolve("typescript/bin/tsc");
  } catch {}
  /** Compile <src> to build/test/interop/<stem>.ll (or <stem>/ for a multi-module program) plus the requested sidecars. */
  const emit = (src, extra, stem = path.basename(src, ".ts"), multi = false) => {
    const out = multi ? path.join(interopDir, stem) + path.sep : path.join(interopDir, `${stem}.ll`);
    const r = spawnSync("node", [cli, src, "-o", out, ...extra], { cwd: root });
    return { stem, status: r.status, stderr: String(r.stderr) };
  };
  const sidecar = (stem, ext) => path.join(interopDir, `${stem}.${ext}`);

  // Headers.
  const add = emit("examples/add.ts", [
    "--emit-header",
    sidecar("add", "h"),
    "--emit-dts",
    sidecar("add", "d.ts"),
    "--emit-napi",
    sidecar("add", "napi.c"),
  ]);
  check(
    "--emit-header/--emit-dts/--emit-napi write their files",
    add.status === 0 && ["h", "d.ts", "napi.c"].every((e) => fs.existsSync(sidecar("add", e))),
    add.stderr
  );
  const addHeader = fs.existsSync(sidecar("add", "h")) ? fs.readFileSync(sidecar("add", "h"), "utf8") : "";
  check(
    "add.h declares `int32_t add(int32_t a, int32_t b);` with guards and nish.h",
    addHeader.includes("int32_t add(int32_t a, int32_t b);") &&
      addHeader.includes("#ifndef NISH_ADD_H") &&
      addHeader.includes('#include "nish.h"') &&
      addHeader.includes('extern "C"'),
    addHeader
  );

  const strings = emit("examples/strings.ts", [
    "--emit-header",
    sidecar("strings", "h"),
    "--emit-dts",
    sidecar("strings", "d.ts"),
    "--emit-napi",
    sidecar("strings", "napi.c"),
  ]);
  const stringsHeader = strings.status === 0 ? fs.readFileSync(sidecar("strings", "h"), "utf8") : "";
  check(
    "strings.h maps string to `nish_str *` (const parameters) and boolean to bool",
    stringsHeader.includes("nish_str *pick(bool flag, const nish_str *a, const nish_str *b);") &&
      stringsHeader.includes("int32_t len2(const nish_str *s);"),
    stringsHeader || strings.stderr
  );

  // The arrays sidecars are written here rather than beside their own checks
  // (further down, "arrays and strings across the boundary") because the N-API
  // compile loop below covers all three stems and only sees a file that already
  // exists. Emitted late, `arrays.napi.c` was silently skipped on a clean
  // build/ and compiled the *previous* run's copy on a dirty one.
  const arrays = emit("examples/arrays.ts", [
    "--emit-header",
    sidecar("arrays", "h"),
    "--emit-dts",
    sidecar("arrays", "d.ts"),
    "--emit-napi",
    sidecar("arrays", "napi.c"),
  ]);

  // A `readonly T[]` parameter *declares* the `const` that the whole-program
  // fixpoint otherwise has to prove, and the comment above the prototype shows
  // the annotation that earned it. The mutable `fill` beside it is the control:
  // it writes, so it stays `nish_array *` and its comment stays `number[]`.
  const readonlyArrays = emit("tests/cases/arr_readonly_header.ts", [
    "--emit-header",
    sidecar("arr_readonly_header", "h"),
  ]);
  const readonlyHeader =
    readonlyArrays.status === 0 ? fs.readFileSync(sidecar("arr_readonly_header", "h"), "utf8") : "";
  check(
    "a `readonly T[]` parameter is `const nish_array *`, and the comment shows the annotation that promised it",
    readonlyHeader.includes("/* sum(xs: readonly number[]): number -- xs: int32_t elements */") &&
      readonlyHeader.includes("int32_t sum(const nish_array *xs);") &&
      readonlyHeader.includes("/* fill(xs: number[], v: number): void -- xs: int32_t elements */") &&
      readonlyHeader.includes("void fill(nish_array *xs, int32_t v);"),
    readonlyHeader || readonlyArrays.stderr
  );

  // The `const` survives an escape. `writesThrough` is a may-write that every
  // escape sets, so a `readonly` parameter that is returned or stored in a field
  // would lose its `const` if the header consulted the fixpoint for one — and
  // for a while the disagreement aborted the compile with exit 70 instead.
  const escaped = emit("tests/cases/arr_readonly_escape.ts", [
    "--emit-header",
    sidecar("arr_readonly_escape", "h"),
  ]);
  const escapedHeader = escaped.status === 0 ? fs.readFileSync(sidecar("arr_readonly_escape", "h"), "utf8") : "";
  check(
    "a `readonly T[]` that escapes (returned, stored in a field) keeps its `const`, and compiling it is not an internal error",
    escaped.status === 0 &&
      escapedHeader.includes("nish_array *first(const nish_array *xs);") &&
      escapedHeader.includes("int32_t hold(const nish_array *xs);") &&
      escapedHeader.includes("int32_t touch(const nish_array *rows, int32_t v);"),
    escapedHeader || escaped.stdout + escaped.stderr
  );

  const keyword = emit("tests/cases/export_fn.ts", ["--emit-header", sidecar("export_fn", "h")]);
  const keywordHeader = keyword.status === 0 ? fs.readFileSync(sidecar("export_fn", "h"), "utf8") : "";
  check(
    'a function named `double` is declared as double_ bound with NISH_SYMBOL("double")',
    keywordHeader.includes('int32_t double_(int32_t n) NISH_SYMBOL("double");') &&
      keywordHeader.includes("int32_t next(int32_t n);"),
    keywordHeader || keyword.stderr
  );
  // WP15 §3: `internal` linkage is the default, so a non-exported function is
  // not a C-ABI symbol and must not be promised by the header either.
  check(
    "the header leaves the non-exported `helper` out by default",
    keyword.status === 0 && !keywordHeader.includes("helper"),
    keywordHeader || keyword.stderr
  );

  const strict = emit(
    "tests/cases/export_strict.ts",
    ["--strict-exports", "--emit-header", sidecar("export_strict", "h")],
    "export_strict"
  );
  const strictHeader = strict.status === 0 ? fs.readFileSync(sidecar("export_strict", "h"), "utf8") : "";
  check(
    "--strict-exports (the default, spelled out) keeps internal functions out of the header",
    strictHeader.includes("int32_t next(int32_t n);") && !strictHeader.includes("helper"),
    strictHeader || strict.stderr
  );

  // The other direction: --no-strict-exports puts every function back on the ABI,
  // so the header has to declare the ones it hid.
  const loose = emit(
    "tests/cases/export_strict.ts",
    ["--no-strict-exports", "--emit-header", sidecar("export_loose", "h")],
    "export_loose"
  );
  const looseHeader = loose.status === 0 ? fs.readFileSync(sidecar("export_loose", "h"), "utf8") : "";
  check(
    "--no-strict-exports puts the non-exported function back in the header",
    looseHeader.includes("int32_t next(int32_t n);") && looseHeader.includes("int32_t helper(int32_t n);"),
    looseHeader || loose.stderr
  );

  const entry = emit("examples/multi/main.ts", ["--emit-header", sidecar("multi", "h")], "multi", true);
  const entryHeader = entry.status === 0 ? fs.readFileSync(sidecar("multi", "h"), "utf8") : "";
  check(
    "the entry `export function main` is omitted; imported modules are listed",
    !entryHeader.includes("main(") &&
      entryHeader.includes("int32_t square(int32_t n);") &&
      entryHeader.includes("/* examples/multi/math.ts */"),
    entryHeader || entry.stderr
  );

  if (HAS_CLANG) {
    const cxx = spawnSync("clang", [
      "-std=c++17",
      "-x",
      "c++",
      "-Wall",
      "-Wextra",
      "-Werror",
      "-fsyntax-only",
      path.join(runtimeDir, "nish.h"),
    ]);
    const c11 = spawnSync("clang", [
      ...strictC,
      "-pedantic",
      "-fsyntax-only",
      "-x",
      "c",
      path.join(runtimeDir, "nish.h"),
    ]);
    check(
      "nish.h compiles under -Wall -Wextra -Werror as C11 (-pedantic) and as C++17",
      cxx.status === 0 && c11.status === 0,
      String(cxx.stderr) + String(c11.stderr)
    );
    const wasmRt = spawnSync("clang", [
      "--target=wasm32-unknown-unknown",
      "-std=c11",
      "-Wall",
      "-Wextra",
      "-Werror",
      "-pedantic",
      "-mbulk-memory",
      "-fsyntax-only",
      path.join(runtimeDir, "runtime_wasm.c"),
    ]);
    check(
      "runtime/runtime_wasm.c compiles for wasm32 under -std=c11 -Wall -Wextra -Werror -pedantic",
      wasmRt.status === 0,
      String(wasmRt.stderr)
    );

    for (const stem of ["add", "strings", "export_fn", "export_strict", "export_loose", "multi"]) {
      if (!fs.existsSync(sidecar(stem, "h"))) continue;
      const r = spawnSync("clang", [...strictC, "-fsyntax-only", "-x", "c", sidecar(stem, "h")]);
      check(`${stem}.h compiles under -std=c11 -Wall -Wextra -Werror`, r.status === 0, String(r.stderr));
    }

    // A C driver that calls through the generated header, including the keyword-named `double`.
    const driver = path.join(interopDir, "header_driver.c");
    fs.writeFileSync(
      driver,
      [
        "#include <stdio.h>",
        '#include "add.h"',
        '#include "export_fn.h"',
        "int main(void) {",
        "  nish_str *s = nish_str_from_i32(add(40, 2));",
        '  printf("add(40, 2) = %s; double_(21) = %d; next(20) = %d\\n", s->data, double_(21), next(20));',
        "  nish_free_arena();",
        "  return 0;",
        "}",
        "",
      ].join("\n")
    );
    const exe = path.join(interopDir, "header_driver");
    const cc = spawnSync(
      "clang",
      [
        ...strictC,
        "-O2",
        sidecar("add", "ll"),
        sidecar("export_fn", "ll"),
        path.join(runtimeDir, "runtime.c"),
        driver,
        "-o",
        exe,
      ],
      { cwd: root }
    );
    const run = cc.status === 0 ? spawnSync(exe) : null;
    check(
      "a -Werror C driver links through the generated headers and runtime.c",
      run !== null && String(run.stdout).trim() === "add(40, 2) = 42; double_(21) = 42; next(20) = 41",
      String(cc.stderr) + (run ? String(run.stdout) + String(run.stderr) : "")
    );
  }

  // TypeScript declarations for the wasm build.
  const addDts = fs.existsSync(sidecar("add", "d.ts")) ? fs.readFileSync(sidecar("add", "d.ts"), "utf8") : "";
  const stringsDts = fs.existsSync(sidecar("strings", "d.ts"))
    ? fs.readFileSync(sidecar("strings", "d.ts"), "utf8")
    : "";
  check(
    "add.d.ts declares `add(a: number, b: number): number` and `load(bytes: BufferSource): Promise<Exports>`",
    addDts.includes("  add(a: number, b: number): number;") &&
      addDts.includes("export function load(bytes: BufferSource): Promise<Exports>;"),
    addDts
  );
  check(
    "strings.d.ts comments out every string function",
    stringsDts.includes("  // pick(flag: boolean, a: string, b: string): string  -- not exported to JS") &&
      !/^\s*pick\(/m.test(stringsDts),
    stringsDts
  );
  for (const stem of ["add", "strings"]) {
    if (!fs.existsSync(sidecar(stem, "d.ts"))) continue;
    const r = spawnSync("node", [tsc, "--noEmit", "--strict", sidecar(stem, "d.ts")], { cwd: root });
    check(`${stem}.d.ts passes tsc --noEmit --strict`, r.status === 0, String(r.stdout) + String(r.stderr));
  }

  // N-API addon.
  const nodeInclude =
    process.env.NODE_INCLUDE || path.join(path.dirname(process.execPath), "..", "include", "node");
  const hasNodeHeaders = fs.existsSync(path.join(nodeInclude, "node_api.h"));
  const shim = fs.existsSync(sidecar("add", "napi.c"))
    ? fs.readFileSync(sidecar("add", "napi.c"), "utf8")
    : "";
  const stringsShim = fs.existsSync(sidecar("strings", "napi.c"))
    ? fs.readFileSync(sidecar("strings", "napi.c"), "utf8")
    : "";
  check(
    "add.napi.c registers `add` with type checks and a NAPI_MODULE_INIT",
    shim.includes('{"add", nish_napi_add},') &&
      shim.includes("type != napi_number") &&
      shim.includes("NAPI_MODULE_INIT()"),
    shim
  );
  check(
    "strings.napi.c bridges string functions (arena strings in, napi_create_string_utf8 out, released per call) and exposes nish_reset_arena",
    stringsShim.includes('{"pick", nish_napi_pick},') &&
      stringsShim.includes("nish_napi_string_arg(env, argv[1])") &&
      stringsShim.includes("napi_create_string_utf8(env, result->data, result->len, &out)") &&
      stringsShim.includes("uint64_t mark = nish_arena_mark();") &&
      stringsShim.includes('{"nish_reset_arena", nish_napi_reset_arena},'),
    stringsShim
  );
  if (!HAS_CLANG) {
    // nothing to build
  } else if (!hasNodeHeaders) {
    skip(`Node headers not found (${path.join(nodeInclude, "node_api.h")}): N-API addon build skipped`
    );
  } else {
    for (const stem of ["add", "strings", "arrays"]) {
      if (!fs.existsSync(sidecar(stem, "napi.c"))) {
        const label = `${stem}.napi.c compiles under -std=c11 -Wall -Wextra -Werror`;
        check(label, false, "--emit-napi wrote no file");
        continue;
      }
      const r = spawnSync("clang", [
        ...strictC,
        `-I${nodeInclude}`,
        "-fsyntax-only",
        sidecar(stem, "napi.c"),
      ]);
      check(`${stem}.napi.c compiles under -std=c11 -Wall -Wextra -Werror`, r.status === 0, String(r.stderr));
    }
    const addon = path.join(interopDir, "add.node");
    const b = spawnSync(
      "bash",
      [
        "scripts/build.sh",
        sidecar("add", "ll"),
        "runtime/runtime.c",
        sidecar("add", "napi.c"),
        "-o",
        addon,
        "--profile",
        "napi",
      ],
      { cwd: root }
    );
    check("napi profile builds add.node", b.status === 0, String(b.stderr));
    if (b.status === 0) {
      const ex = spawnSync("node", ["examples/node-addon.mjs", addon], { cwd: root });
      const lines = String(ex.stdout).trim().split("\n");
      check(
        'examples/node-addon.mjs prints add(2, 3) = 5 and the TypeError for add("2", 3)',
        ex.status === 0 &&
          lines[0] === "add(2, 3) = 5" &&
          lines[1] === 'add("2", 3) throws: add: argument 1 (a) must be a number',
        String(ex.stdout) + String(ex.stderr)
      );

      if (has("wasm-ld")) {
        const wasm = path.join(interopDir, "add.wasm");
        const w = spawnSync(
          "bash",
          ["scripts/build.sh", sidecar("add", "ll"), "-o", wasm, "--profile", "wasm"],
          { cwd: root }
        );
        const script = [
          'import { readFileSync } from "node:fs";',
          'import { createRequire } from "node:module";',
          `const addon = createRequire(import.meta.url)(${JSON.stringify(addon)});`,
          `const { instance } = await WebAssembly.instantiate(readFileSync(${JSON.stringify(wasm)}), {});`,
          "const pairs = [[2, 3], [40, 2], [-7, 7], [2147483647, 1]];",
          "const same = pairs.every(([a, b]) => addon.add(a, b) === instance.exports.add(a, b));",
          'console.log(same ? pairs.map(([a, b]) => addon.add(a, b)).join(" ") : "mismatch");',
        ].join("\n");
        const cmp =
          w.status === 0 ? spawnSync("node", ["--input-type=module", "-e", script], { cwd: root }) : null;
        check(
          "the .node and .wasm builds of add.ts return identical results (i32 wrap included)",
          cmp !== null && String(cmp.stdout).trim() === "5 42 0 -2147483648",
          String(w.stderr) + (cmp ? String(cmp.stdout) + String(cmp.stderr) : "")
        );
      }
    }
  }

  // ---- WP24 A1: the asynchronous N-API shim ---------------------------------------
  // `--emit-napi-async` is the same shim with a promise in front of every function it
  // can run off the JS thread, so a long call no longer blocks Node's event loop. The
  // Nish function is not touched: what changes is the C around it. Three things are
  // checked here, and the third is the acceptance criterion `docs/wp24-async.md` §5.1
  // states -- a program that does not ask for the flag gets the shim it always got.
  const addAsync = emit(
    "examples/add.ts",
    ["--threads", "--emit-napi", sidecar("add_t", "napi.c"), "--emit-napi-async", sidecar("add_t", "napi_async.c")],
    "add_t"
  );
  const asyncShim =
    addAsync.status === 0 && fs.existsSync(sidecar("add_t", "napi_async.c"))
      ? fs.readFileSync(sidecar("add_t", "napi_async.c"), "utf8")
      : "";
  check(
    "add.napi_async.c queues the call on a libuv worker and answers a promise",
    asyncShim.includes("static void nish_napi_execute_add(napi_env env, void *data) {") &&
      asyncShim.includes("(void)env; /* a worker thread: no napi_value, no napi_* call, by N-API's rule */") &&
      // The worker marks and releases its own thread-local arena, which the
      // synchronous path does only when the boundary needed a scope.
      asyncShim.includes("  uint64_t mark = nish_arena_mark();\n  w->result = add(w->a, w->b);\n  nish_arena_release(mark);") &&
      asyncShim.includes("napi_create_promise(env, &w->deferred, &promise)") &&
      // Queuing last, and a queue that fails rejects the promise rather than
      // throwing past it: a deferred that is neither resolved nor rejected is a
      // leak, and by this point the promise is already in the caller's hands.
      asyncShim.includes("  if (napi_queue_async_work(env, w->work) != napi_ok) {\n    nish_napi_reject(") &&
      asyncShim.includes("napi_resolve_deferred(env, w->deferred, out);"),
    asyncShim.slice(0, 2000)
  );
  check(
    "--emit-napi-async is refused without --threads: the worker allocates",
    (() => {
      const r = spawnSync("node", [cli, "examples/add.ts", "-o", sidecar("add_x", "ll"), "--emit-napi-async", sidecar("add_x", "napi_async.c")], { cwd: root });
      return r.status === 2 && String(r.stderr).includes("--emit-napi-async needs --threads");
    })(),
    "expected exit 2 and the --threads message"
  );
  check(
    "asking for the async shim leaves the synchronous one byte-identical",
    fs.existsSync(sidecar("add", "napi.c")) &&
      fs.existsSync(sidecar("add_t", "napi.c")) &&
      fs.readFileSync(sidecar("add", "napi.c"), "utf8").replace(/add_t/g, "add") ===
        fs.readFileSync(sidecar("add_t", "napi.c"), "utf8").replace(/add_t/g, "add"),
    "the --emit-napi output moved when --emit-napi-async was asked for alongside it"
  );
  if (HAS_CLANG && hasNodeHeaders && fs.existsSync(sidecar("add_t", "napi_async.c"))) {
    const r = spawnSync("clang", [...strictC, `-I${nodeInclude}`, "-fsyntax-only", sidecar("add_t", "napi_async.c")]);
    check("add.napi_async.c compiles under -std=c11 -Wall -Wextra -Werror", r.status === 0, String(r.stderr));
    const addon = path.join(interopDir, "add_async.node");
    const b = spawnSync(
      "bash",
      ["scripts/build.sh", sidecar("add_t", "ll"), "runtime/runtime.c", sidecar("add_t", "napi_async.c"), "-o", addon, "--profile", "napi", "--threads"],
      { cwd: root }
    );
    check("napi profile builds add_async.node with --threads", b.status === 0, String(b.stderr));
    if (b.status === 0) {
      // The point of the round trip: the JS side gets a *promise*, it resolves to
      // what the synchronous shim returns, and a bad argument still throws on the
      // spot rather than rejecting -- the promise does not exist yet at that point.
      const script = [
        'import { createRequire } from "node:module";',
        `const addon = createRequire(import.meta.url)(${JSON.stringify(addon)});`,
        "const p = addon.add(2, 3);",
        "const isPromise = p instanceof Promise;",
        "const value = await p;",
        "let threw = \"\";",
        'try { addon.add("2", 3); } catch (e) { threw = e.message; }',
        // Concatenated rather than interpolated: this is a *string* holding a
        // program, and a `${}` in one is what `noTemplateCurlyInString` is for.
        'console.log(isPromise + " " + value + " " + threw);',
      ].join("\n");
      const run = spawnSync("node", ["--input-type=module", "-e", script], { cwd: root });
      check(
        "add_async.node answers a promise that resolves to 5, and still throws on a bad argument",
        String(run.stdout).trim() === "true 5 add: argument 1 (a) must be a number",
        String(run.stdout) + String(run.stderr)
      );
    }
  }

  // ---- WP17: a `Result` across the host boundary ----------------------------------
  // WP16 skipped every function whose signature mentioned a `Result` and left a note.
  // Now: --emit-header declares both C shapes (the packed word a small `Result` travels
  // in, either direction, and the arena object for the rest), a -Werror C driver calls
  // all four functions through it — including one that *takes* a `Result` the C side
  // built itself — the N-API shim speaks `{ ok, value }` / `{ ok, error }` both ways,
  // and the wasm loader packs and unpacks the i64. The point of the driver is that it
  // *calls across*, so the register agreement is checked rather than only the header
  // compiling.
  const res = emit("tests/cases/res_export.ts", [
    "--emit-header",
    sidecar("res_export", "h"),
    "--emit-dts",
    sidecar("res_export", "d.ts"),
    "--emit-napi",
    sidecar("res_export", "napi.c"),
  ]);
  const resHeader = res.status === 0 ? fs.readFileSync(sidecar("res_export", "h"), "utf8") : "";
  check(
    "res_export.h declares the packed word a small Result travels in both ways, the arena object for the rest, and asserts the word is 8 bytes",
    resHeader.includes("typedef struct nish_result_i32_i32_word {") &&
      resHeader.includes("union { int32_t value; int32_t error; } as;") &&
      resHeader.includes("NISH_RESULT_ASSERT(sizeof(nish_result_i32_i32_word) == 8,") &&
      resHeader.includes("nish_result_i32_i32_word half(int32_t n);") &&
      resHeader.includes("nish_result_void_i32_word checkPort(int32_t port);") &&
      resHeader.includes("struct nish_result_i32__IoError *openFile(const nish_str *path);") &&
      resHeader.includes("int32_t describe(nish_result_i32_i32_word r);"),
    resHeader
  );
  const resDts = res.status === 0 ? fs.readFileSync(sidecar("res_export", "d.ts"), "utf8") : "";
  check(
    "res_export.d.ts declares a by-value Result as a tagged union in both positions and leaves the pointer one out",
    resDts.includes("half(n: number): { ok: true; value: number } | { ok: false; error: number };") &&
      resDts.includes("checkPort(port: number): { ok: true } | { ok: false; error: number };") &&
      resDts.includes(
        "describe(r: { ok: true; value: number } | { ok: false; error: number }): number;"
      ) &&
      resDts.includes("// openFile(path: string): Result<number, IoError>  -- not exported to JS"),
    resDts
  );
  if (fs.existsSync(sidecar("res_export", "d.ts"))) {
    const r = spawnSync("node", [tsc, "--noEmit", "--strict", sidecar("res_export", "d.ts")], { cwd: root });
    check("res_export.d.ts passes tsc --noEmit --strict", r.status === 0, String(r.stdout) + String(r.stderr));
  }
  if (HAS_CLANG && res.status === 0) {
    const syn = spawnSync("clang", [...strictC, "-pedantic", "-fsyntax-only", "-x", "c", sidecar("res_export", "h")]);
    check(
      "res_export.h compiles under -std=c11 -Wall -Wextra -Werror -pedantic",
      syn.status === 0,
      String(syn.stderr)
    );
    const driver = path.join(interopDir, "res_driver.c");
    fs.writeFileSync(
      driver,
      [
        "#include <stdio.h>",
        '#include "res_export.h"',
        "int main(void) {",
        "  for (int32_t n = 8; n <= 9; n++) {",
        "    nish_result_i32_i32_word r = half(n);",
        '    printf("half(%d) %s %d via %d\\n", n, r.ok ? "ok" : "err",',
        "           r.ok ? r.as.value : r.as.error, describe(r));",
        "  }",
        "  /* a Result the C side builds itself, handed to Nish by value */",
        "  nish_result_i32_i32_word made = { 1, { 41 } };",
        '  printf("C-built %d ", describe(made));',
        "  made.ok = 0; made.as.error = 5;",
        '  printf("%d\\n", describe(made));',
        "  nish_result_void_i32_word v = checkPort(0), w = checkPort(443);",
        '  printf("checkPort %d %d %d\\n", v.ok, v.as.error, w.ok);',
        "  struct nish_result_i32__IoError *o = openFile(nish_str_new(\"\", 0));",
        '  printf("openFile %d %d\\n", o->ok, o->error->code);',
        "  nish_free_arena();",
        "  return 0;",
        "}",
        "",
      ].join("\n")
    );
    const exe = path.join(interopDir, "res_driver");
    const cc = spawnSync(
      "clang",
      [...strictC, "-O2", sidecar("res_export", "ll"), path.join(runtimeDir, "runtime.c"), driver, "-o", exe],
      { cwd: root }
    );
    const run = cc.status === 0 ? spawnSync(exe) : null;
    check(
      "a -Werror C driver calls a by-value Result in and out, and a pointer Result, through res_export.h",
      run !== null &&
        String(run.stdout).trim().split("\n").join(" | ") ===
          "half(8) ok 4 via 4 | half(9) err 9 via -9 | C-built 41 -5 | checkPort 0 0 1 | openFile 0 2",
      String(cc.stderr) + (run ? String(run.stdout) + String(run.stderr) : "")
    );
  }
  const resShim = res.status === 0 ? fs.readFileSync(sidecar("res_export", "napi.c"), "utf8") : "";
  check(
    "res_export.napi.c boxes a by-value Result as { ok, value } / { ok, error } and skips the pointer ones",
    resShim.includes("static napi_status nish_napi_result(napi_env env, bool ok, napi_value payload, napi_value *out)") &&
      resShim.includes('napi_set_named_property(env, obj, ok ? "value" : "error", payload)') &&
      resShim.includes('{"half", nish_napi_half},') &&
      resShim.includes('{"describe", nish_napi_describe},') &&
      resShim.includes('napi_get_named_property(env, argv[0], r_flag ? "value" : "error", &r_arm)') &&
      resShim.includes(
        "openFile(path: string): Result<number, IoError> -- not bridged: it returns Result<number, IoError>"
      ),
    resShim
  );
  if (HAS_CLANG && res.status === 0) {
    if (hasNodeHeaders) {
      const addon = path.join(interopDir, "res_export.node");
      const b = spawnSync(
        "bash",
        [
          "scripts/build.sh",
          sidecar("res_export", "ll"),
          "runtime/runtime.c",
          sidecar("res_export", "napi.c"),
          "-o",
          addon,
          "--profile",
          "napi",
        ],
        { cwd: root }
      );
      const script = [
        'import { createRequire } from "node:module";',
        `const api = createRequire(import.meta.url)(${JSON.stringify(addon)});`,
        "const out = [api.half(8), api.half(7), api.checkPort(0), api.checkPort(443)].map((r) => JSON.stringify(r));",
        "out.push(api.describe({ ok: true, value: 41 }), api.describe({ ok: false, error: 5 }), api.describe(api.half(9)));",
        "try { api.describe(7); } catch (e) { out.push(e.message); }",
        "console.log(out.join(' '));",
      ].join("\n");
      const r = b.status === 0 ? spawnSync("node", ["--input-type=module", "-e", script], { cwd: root }) : null;
      check(
        "N-API: a by-value Result crosses both ways as { ok: true, value } / { ok: false, error }",
        r !== null &&
          String(r.stdout).trim() ===
            '{"ok":true,"value":4} {"ok":false,"error":7} {"ok":false,"error":0} {"ok":true} 41 -5 -9' +
              " describe: argument 1 (r) must be { ok: true, value } or { ok: false, error }",
        String(b.stderr) + (r ? String(r.stdout) + String(r.stderr) : "")
      );
    }
    if (has("wasm-ld")) {
      // The freestanding wasm profile has no string runtime, so the wasm half
      // uses the scalar-only subset of the same four functions.
      const src = path.join(interopDir, "res_wasm.ts");
      fs.writeFileSync(
        src,
        [
          "export function half(n: i32): Result<i32, i32> {",
          "  if (n % 2 !== 0) { return Err(n); }",
          "  return Ok(n / 2);",
          "}",
          "export function checkPort(port: i32): Result<void, i32> {",
          "  if (port <= 0) { return Err(port); }",
          "  return Ok();",
          "}",
          "export function describe(r: Result<i32, i32>): i32 {",
          "  if (r.isErr()) { return -r.error; }",
          "  return r.value;",
          "}",
          "",
        ].join("\n")
      );
      const scalar = emit(src, ["--emit-dts", sidecar("res_wasm", "d.ts")]);
      const wasm = path.join(interopDir, "res_wasm.wasm");
      const w =
        scalar.status === 0
          ? spawnSync(
              "bash",
              ["scripts/build.sh", sidecar("res_wasm", "ll"), "-o", wasm, "--profile", "wasm"],
              { cwd: root }
            )
          : { status: 1, stderr: scalar.stderr };
      const script = [
        'import { readFileSync } from "node:fs";',
        `const { load } = await import(${JSON.stringify(sidecar("res_wasm", "mjs"))});`,
        `const api = await load(readFileSync(${JSON.stringify(wasm)}));`,
        "const out = [api.half(8), api.half(7), api.checkPort(0), api.checkPort(443)].map((r) => JSON.stringify(r));",
        "out.push(api.describe({ ok: true, value: 41 }), api.describe({ ok: false, error: 5 }), api.describe(api.half(9)));",
        "try { api.describe(7); } catch (e) { out.push(e.message); }",
        "console.log(out.join(' '));",
      ].join("\n");
      const r = w.status === 0 ? spawnSync("node", ["--input-type=module", "-e", script], { cwd: root }) : null;
      check(
        "wasm: the companion loader packs and unpacks the i64 a by-value Result crosses in",
        r !== null &&
          String(r.stdout).trim() ===
            '{"ok":true,"value":4} {"ok":false,"error":7} {"ok":false,"error":0} {"ok":true} 41 -5 -9' +
              " expected { ok: true, value } or { ok: false, error }",
        String(w.stderr) + (r ? String(r.stdout) + String(r.stderr) : "")
      );
    }
  }

  // ---- WP15/WP8: the numeric widths across the N-API boundary ---------------------
  // The shim's reader and boxer tables knew i32 / f64 / bool / i64 and nothing else, so
  // a function mentioning u8, u16, u32, u64 or f32 was dropped from the addon instead of
  // bridged. Checks:
  //   - each width is read with the getter of its own family, and the two that N-API has
  //     no getter for (u8 / u16 from ToUint32, f32 from a double) are narrowed explicitly
  //   - the shim still compiles under -std=c11 -Wall -Wextra -Werror
  //   - the built addon truncates an out-of-range JS number exactly as a typed array
  //     store does, hands back a u32 above 2^31 as a positive number, round-trips an f32
  //     through the f64 JS holds it in, and takes both arms of a narrow packed `Result`
  //   - a function that genuinely cannot cross is named in the shim with the position and
  //     the type that stopped it, which is what a silent omission hid
  const widths = emit("tests/self/interop_widths.ts", [
    "--emit-header",
    sidecar("interop_widths", "h"),
    "--emit-napi",
    sidecar("interop_widths", "napi.c"),
  ]);
  const widthsShim =
    widths.status === 0 ? fs.readFileSync(sidecar("interop_widths", "napi.c"), "utf8") : "";
  check(
    "interop_widths.napi.c bridges u8/u16/u32/u64/f32 instead of skipping them",
    // u8: ToUint32 into a temporary, then the width's own modulus.
    widthsShim.includes("if (napi_get_value_uint32(env, argv[0], &x_raw) != napi_ok)") &&
      widthsShim.includes("uint8_t x = (uint8_t)x_raw;") &&
      widthsShim.includes("uint16_t x = (uint16_t)x_raw;") &&
      // u32 needs no temporary: the getter already writes its type.
      widthsShim.includes("uint32_t x;\n  if (napi_typeof(env, argv[0], &type)") &&
      widthsShim.includes("napi_get_value_bigint_uint64(env, argv[0], &x, &lossless)") &&
      widthsShim.includes("float x = nish_napi_f32(x_raw);") &&
      widthsShim.includes("static float nish_napi_f32(double value) {") &&
      // The boxers: unsigned goes back through napi_create_uint32, f32 as a double.
      widthsShim.includes("uint32_t result = highBit();") &&
      widthsShim.includes("napi_create_uint32(env, result, &out)") &&
      widthsShim.includes("napi_create_bigint_uint64(env, result, &out)") &&
      // Both arms of Result<f32, u8> narrow, each through its own temporary.
      widthsShim.includes("if (r_flag) r.as.value = nish_napi_f32(r_value_raw);") &&
      widthsShim.includes("if (!r_flag) r.as.error = (uint8_t)r_error_raw;") &&
      !widthsShim.includes("not bridged"),
    widthsShim || widths.stderr
  );

  // A module whose functions cannot cross at all: the shim must name each one
  // and say which position and which type stopped it.
  const skipsSrc = path.join(interopDir, "napi_skips.ts");
  fs.writeFileSync(
    skipsSrc,
    [
      "export class Point {",
      "  x: number = 0;",
      "}",
      "",
      "export function move(p: Point, dx: number): Point {",
      "  p.x = p.x + dx;",
      "  return p;",
      "}",
      "",
      "export function origin(): Point {",
      "  return new Point();",
      "}",
      "",
    ].join("\n")
  );
  const skips = emit(skipsSrc, ["--emit-napi", sidecar("napi_skips", "napi.c")]);
  const skipsShim =
    skips.status === 0 ? fs.readFileSync(sidecar("napi_skips", "napi.c"), "utf8") : "";
  check(
    "an unbridgeable function is named in the shim with the position and type that stopped it",
    skipsShim.includes("move(p: Point, dx: number): Point -- not bridged: parameter 1 (p) is Point") &&
      skipsShim.includes("origin(): Point -- not bridged: it returns Point") &&
      skipsShim.includes("/* Not bridged, and why."),
    skipsShim || skips.stderr
  );

  if (HAS_CLANG && widths.status === 0) {
    const r = spawnSync("clang", [...strictC, "-fsyntax-only", "-x", "c", sidecar("interop_widths", "h")]);
    check("interop_widths.h compiles under -std=c11 -Wall -Wextra -Werror", r.status === 0, String(r.stderr));
  }
  // The shim needs node_api.h to compile at all, so this is the same skip the
  // other addon checks take when the Node headers are not installed.
  if (HAS_CLANG && hasNodeHeaders && widths.status === 0 && skips.status === 0) {
    for (const stem of ["interop_widths", "napi_skips"]) {
      const r = spawnSync("clang", [...strictC, `-I${nodeInclude}`, "-fsyntax-only", sidecar(stem, "napi.c")]);
      check(`${stem}.napi.c compiles under -std=c11 -Wall -Wextra -Werror`, r.status === 0, String(r.stderr));
    }
  }
  if (HAS_CLANG && widths.status === 0 && hasNodeHeaders) {
    const addon = path.join(interopDir, "interop_widths.node");
    const b = spawnSync(
      "bash",
      [
        "scripts/build.sh",
        sidecar("interop_widths", "ll"),
        "runtime/runtime.c",
        sidecar("interop_widths", "napi.c"),
        "-o",
        addon,
        "--profile",
        "napi",
      ],
      { cwd: root }
    );
    const script = [
      'import { createRequire } from "node:module";',
      `const a = createRequire(import.meta.url)(${JSON.stringify(addon)});`,
      "const out = [];",
      // Boundaries, and the two out-of-range values whose behaviour is the decision:
      // ToUint32 then the width's modulus, exactly as a typed-array store.
      "out.push(a.echoU8(0), a.echoU8(255), a.echoU8(300), a.echoU8(-1));",
      "out.push(a.echoU16(0), a.echoU16(65535), a.echoU16(65536), a.echoU16(-1));",
      "out.push(a.echoU32(0), a.echoU32(4294967295), a.echoU32(-1));",
      "out.push(String(a.echoU64(0n)), String(a.echoU64((1n << 64n) - 1n)));",
      // 0.1 has no f32, so the round trip must come back as Math.fround(0.1) and not as 0.1.
      "out.push(a.echoF32(0.1) === Math.fround(0.1), a.echoF32(0.1) === 0.1);",
      // A double past the float range must be an infinity, not undefined behaviour.
      "out.push(a.echoF32(1e39), a.echoF32(-1e39), Number.isNaN(a.echoF32(NaN)));",
      "out.push(a.mixWidths(255, 65535, 4294967295, 0.5), a.highBit());",
      "out.push(JSON.stringify(a.halve(9)), JSON.stringify(a.halve(-1)));",
      "out.push(a.orError({ ok: true, value: 0.25 }), a.orError({ ok: false, error: 200 }), a.orError(a.halve(-1)));",
      'try { a.echoU8("x"); } catch (e) { out.push(e.message); }',
      "console.log(out.join(' | '));",
    ].join("\n");
    const r = b.status === 0 ? spawnSync("node", ["--input-type=module", "-e", script], { cwd: root }) : null;
    const expected = [
      "0 | 255 | 44 | 255",
      "0 | 65535 | 0 | 65535",
      "0 | 4294967295 | 4294967295",
      "0 | 18446744073709551615",
      "true | false",
      "Infinity | -Infinity | true",
      "4295033085.5 | 4294967295",
      '{"ok":true,"value":4.5} | {"ok":false,"error":255}',
      "0.25 | 200 | 255",
      "echoU8: argument 1 (x) must be a number",
    ].join(" | ");
    check(
      "N-API: u8/u16/u32 truncate as a typed-array store, u64 is a bigint, f32 round-trips, and a u32 above 2^31 stays positive",
      r !== null && String(r.stdout).trim() === expected,
      String(b.stderr) + (r ? String(r.stdout) + String(r.stderr) : "")
    );
  }

  // ---- WP8/WP15: the unsigned widths across the wasm boundary ---------------------
  // The wasm ABI has four value types, so `u8` / `u16` / `u32` share one with `i32` and
  // `u64` shares one with `i64`, and the generated loader is the only place the range
  // can be restored. `--emit-dts` used to declare these signatures while the loader
  // wrote no entry for them at all, so `load()` handed back an object missing the
  // function the `.d.ts` promised. Checks:
  //   - every function the `.d.ts` declares has an entry in the companion `.mjs`
  //     (the two files are generated from one predicate, and this says so)
  //   - the loader masks a narrow argument on the way in, narrows a `u8` / `u16`
  //     result the callee never narrowed, and hands back a `u32` above 2^31 and a
  //     `u64` above 2^63 *positive* rather than as the signed value wasm returns
  const unsignedSrc = "tests/self/interop_unsigned.ts";
  const unsigned = emit(unsignedSrc, ["--emit-dts", sidecar("interop_unsigned", "d.ts")]);
  const unsignedDts =
    unsigned.status === 0 ? fs.readFileSync(sidecar("interop_unsigned", "d.ts"), "utf8") : "";
  const unsignedMjs =
    unsigned.status === 0 ? fs.readFileSync(sidecar("interop_unsigned", "mjs"), "utf8") : "";
  check(
    "interop_unsigned.d.ts declares the unsigned widths as `number` / `bigint`",
    unsignedDts.includes("  idU8(x: number): number;") &&
      unsignedDts.includes("  idU32(x: number): number;") &&
      unsignedDts.includes("  idU64(x: bigint): bigint;"),
    unsignedDts
  );
  // The regression guard, and the general one: a `.d.ts` may not promise a function
  // its loader omits. Before the fix `interop_unsigned.mjs` had none of these ten.
  // The expected count is spelled out so a generator that started declaring nothing
  // could not pass this by having nothing to miss (strings.d.ts really declares none:
  // every one of its functions is commented out).
  for (const [stem, declares] of [
    ["add", 1],
    ["strings", 0],
    ["arrays", 9],
    ["res_wasm", 3],
    ["interop_unsigned", 10],
  ]) {
    if (!fs.existsSync(sidecar(stem, "d.ts")) || !fs.existsSync(sidecar(stem, "mjs"))) continue;
    const dts = fs.readFileSync(sidecar(stem, "d.ts"), "utf8");
    const mjs = fs.readFileSync(sidecar(stem, "mjs"), "utf8");
    const exports_ = dts.slice(dts.indexOf("export interface Exports {"), dts.indexOf("\n}\n"));
    const declared = [...exports_.matchAll(/^ {2}(\w+)\(/gm)].map((m) => m[1]);
    const missing = declared.filter((name) => !new RegExp(`^ {4}${name}: `, "m").test(mjs));
    check(
      `${stem}.mjs implements every function ${stem}.d.ts declares (${declares})`,
      declared.length === declares && missing.length === 0,
      `declared ${declared.length}, expected ${declares}; declared but not loaded: ${missing.join(", ")}`
    );
  }
  // Both halves of the skip message. No corpus program has a function whose
  // arguments all cross and whose *result* does not, so that one is written here.
  const skipSrc = path.join(interopDir, "skip_reasons.ts");
  fs.writeFileSync(
    skipSrc,
    ["export function spell(n: i32): string {", "  return `${n}`;", "}", ""].join("\n")
  );
  const skipped = emit(skipSrc, ["--emit-dts", sidecar("skip_reasons", "d.ts")]);
  const skipDts = skipped.status === 0 ? fs.readFileSync(sidecar("skip_reasons", "d.ts"), "utf8") : "";
  check(
    "a skipped function names the argument or the result, and the type, that stopped it",
    stringsDts.includes(
      "  // pick(flag: boolean, a: string, b: string): string  -- not exported to JS: argument 2 (a) is `string`,"
    ) && skipDts.includes("  // spell(n: number): string  -- not exported to JS: the result is `string`,"),
    stringsDts + skipDts
  );
  check(
    "interop_unsigned.mjs masks a narrow argument in, narrows a narrow result out, and reads u32/u64 unsigned",
    unsignedMjs.includes("idU8: (x) => raw.idU8(x & 0xff) & 0xff,") &&
      unsignedMjs.includes("idU16: (x) => raw.idU16(x & 0xffff) & 0xffff,") &&
      unsignedMjs.includes("idU32: (x) => raw.idU32(x) >>> 0,") &&
      unsignedMjs.includes("idU64: (x) => BigInt.asUintN(64, raw.idU64(x)),") &&
      unsignedMjs.includes("scaleF32: raw.scaleF32,"),
    unsignedMjs
  );
  if (unsigned.status === 0) {
    const r = spawnSync("node", [tsc, "--noEmit", "--strict", sidecar("interop_unsigned", "d.ts")], {
      cwd: root,
    });
    check(
      "interop_unsigned.d.ts passes tsc --noEmit --strict",
      r.status === 0,
      String(r.stdout) + String(r.stderr)
    );
  }
  if (HAS_CLANG && has("wasm-ld")) {
    const wasm = path.join(interopDir, "interop_unsigned.wasm");
    const w =
      unsigned.status === 0
        ? spawnSync(
            "bash",
            ["scripts/build.sh", sidecar("interop_unsigned", "ll"), "-o", wasm, "--profile", "wasm"],
            { cwd: root }
          )
        : { status: 1, stderr: unsigned.stderr };
    // Boundaries on both sides of every width, the truncations on the way in, and the
    // two results a signed read would get wrong: 4294967295 and 2^64 - 1.
    const script = [
      'import { readFileSync } from "node:fs";',
      `const { load } = await import(${JSON.stringify(sidecar("interop_unsigned", "mjs"))});`,
      `const api = await load(readFileSync(${JSON.stringify(wasm)}));`,
      "const out = [];",
      "out.push(api.idU8(0), api.idU8(255), api.idU8(256), api.idU8(300), api.idU8(-1));",
      "out.push(api.addU8(200, 100), api.addU8(255, 1));",
      "out.push(api.idU16(0), api.idU16(65535), api.idU16(65536), api.idU16(-1));",
      "out.push(api.addU16(65535, 2), api.widen(300));",
      "out.push(api.idU32(0), api.idU32(2147483648), api.idU32(4294967295), api.addU32(4294967295, 2));",
      "out.push(api.idU64(0n), api.idU64(2n ** 63n), api.idU64(2n ** 64n - 1n), api.addU64(2n ** 64n - 1n, 1n));",
      "out.push(api.scaleF32(0.5), api.scaleF32(Math.fround(0.1)) === Math.fround(0.2));",
      "console.log(out.join(' '));",
    ].join("\n");
    const r = w.status === 0 ? spawnSync("node", ["--input-type=module", "-e", script], { cwd: root }) : null;
    check(
      "wasm: the loader puts every unsigned width back in range (a u32 above 2^31 arrives positive)",
      r !== null &&
        String(r.stdout).trim() ===
          "0 255 0 44 255 44 0 0 65535 0 65535 1 44 0 2147483648 4294967295 1 " +
            "0 9223372036854775808 18446744073709551615 0 1 true",
      String(w.stderr) + (r ? String(r.stdout) + String(r.stderr) : "")
    );
  }

  // ---- WP4/WP8: arrays and strings across the boundary ----------------------------
  // examples/arrays.ts takes and returns Int32Array / Float64Array / BigInt64Array. Checks:
  //   - the header spells a read-only array parameter `const nish_array *` and a written one
  //     `nish_array *`, compiles under -Werror, and a C driver passes a stack-built header
  //   - the .d.ts declares typed-array signatures, type-checks, and its companion .mjs loader
  //     marshals typed arrays into the wasm build (linked with runtime/runtime_wasm.c),
  //     copies results out, copies written parameters back, and survives a trap
  //   - the N-API addon borrows typed arrays (zero-copy, `fill` mutates in place), returns
  //     fresh typed arrays, bridges strings, and agrees with the wasm build value for value
  const arraysHeader = arrays.status === 0 ? fs.readFileSync(sidecar("arrays", "h"), "utf8") : "";
  check(
    "arrays.h: read-only array parameters are `const nish_array *`, written ones `nish_array *`, results `nish_array *`",
    arraysHeader.includes("double sumF64(const nish_array *xs);") &&
      arraysHeader.includes("void fill(nish_array *xs, int32_t v);") &&
      arraysHeader.includes("nish_array *scale(const nish_array *xs, double k);") &&
      arraysHeader.includes("-- xs: int32_t elements, returns int64_t elements"),
    arraysHeader || arrays.stderr
  );
  const arraysDts = arrays.status === 0 ? fs.readFileSync(sidecar("arrays", "d.ts"), "utf8") : "";
  check(
    "arrays.d.ts declares typed-array signatures and the runtime exports",
    arraysDts.includes("  scale(xs: Float64Array, k: number): Float64Array;") &&
      arraysDts.includes("  sumI64(xs: BigInt64Array): bigint;") &&
      arraysDts.includes("  fill(xs: Int32Array, v: number): void;") &&
      arraysDts.includes("  nish_reset_arena(): void;"),
    arraysDts || arrays.stderr
  );
  check(
    "--emit-dts writes the companion loader arrays.mjs with arena-scoped marshalling",
    fs.existsSync(sidecar("arrays", "mjs")) &&
      fs
        .readFileSync(sidecar("arrays", "mjs"), "utf8")
        .includes("raw.nish_alloc_array(BigInt(elemSize), BigInt(value.length))"),
    arrays.stderr
  );
  if (fs.existsSync(sidecar("arrays", "d.ts"))) {
    const r = spawnSync("node", [tsc, "--noEmit", "--strict", sidecar("arrays", "d.ts")], { cwd: root });
    check("arrays.d.ts passes tsc --noEmit --strict", r.status === 0, String(r.stdout) + String(r.stderr));
  }
  if (HAS_CLANG && arrays.status === 0) {
    const r = spawnSync("clang", [...strictC, "-fsyntax-only", "-x", "c", sidecar("arrays", "h")]);
    check("arrays.h compiles under -std=c11 -Wall -Wextra -Werror", r.status === 0, String(r.stderr));
    const driver = path.join(interopDir, "arrays_driver.c");
    fs.writeFileSync(
      driver,
      [
        "#include <stdio.h>",
        '#include "arrays.h"',
        "int main(void) {",
        "  int32_t buf[4] = {1, 2, 3, 4};",
        "  nish_array xs = {4, 4, (char *)buf}; /* a host buffer, borrowed for the calls */",
        "  int32_t before = sumI32(&xs);",
        "  fill(&xs, 5);",
        "  nish_array *sq = squares(4); /* arena-owned */",
        '  printf("sumI32 = %d; after fill buf[3] = %d, sum %d; squares len %llu last %d\\n", before, buf[3], sumI32(&xs), (unsigned long long)sq->len, ((int32_t *)sq->data)[3]);',
        "  nish_free_arena();",
        "  return 0;",
        "}",
        "",
      ].join("\n")
    );
    const exe = path.join(interopDir, "arrays_driver");
    const cc = spawnSync(
      "clang",
      [...strictC, "-O2", sidecar("arrays", "ll"), path.join(runtimeDir, "runtime.c"), driver, "-o", exe],
      { cwd: root }
    );
    const run = cc.status === 0 ? spawnSync(exe) : null;
    check(
      "a -Werror C driver passes a stack-built nish_array through arrays.h and reads a returned one",
      run !== null &&
        String(run.stdout).trim() === "sumI32 = 10; after fill buf[3] = 5, sum 20; squares len 4 last 9",
      String(cc.stderr) + (run ? String(run.stdout) + String(run.stderr) : "")
    );
  }
  if (HAS_CLANG && arrays.status === 0 && (has("wasm-ld") || hasNodeHeaders)) {
    const wasm = path.join(interopDir, "arrays.wasm");
    const addon = path.join(interopDir, "arrays.node");
    const stringsAddon = path.join(interopDir, "strings.node");
    let wasmOk = false;
    if (has("wasm-ld")) {
      const w = spawnSync(
        "bash",
        [
          "scripts/build.sh",
          sidecar("arrays", "ll"),
          "runtime/runtime_wasm.c",
          "-o",
          wasm,
          "--profile",
          "wasm",
        ],
        { cwd: root }
      );
      check(
        "wasm profile links examples/arrays.ts with runtime/runtime_wasm.c",
        w.status === 0,
        String(w.stderr)
      );
      wasmOk = w.status === 0;
    }
    let napiOk = false;
    if (hasNodeHeaders) {
      const b = spawnSync(
        "bash",
        [
          "scripts/build.sh",
          sidecar("arrays", "ll"),
          "runtime/runtime.c",
          sidecar("arrays", "napi.c"),
          "-o",
          addon,
          "--profile",
          "napi",
        ],
        { cwd: root }
      );
      const s = spawnSync(
        "bash",
        [
          "scripts/build.sh",
          sidecar("strings", "ll"),
          "runtime/runtime.c",
          sidecar("strings", "napi.c"),
          "-o",
          stringsAddon,
          "--profile",
          "napi",
        ],
        { cwd: root }
      );
      check(
        "napi profile builds arrays.node and strings.node",
        b.status === 0 && s.status === 0,
        String(b.stderr) + String(s.stderr)
      );
      napiOk = b.status === 0 && s.status === 0;
    } else {
      skip(`Node headers not found (${path.join(nodeInclude, "node_api.h")}): arrays/strings addon build skipped`
      );
    }
    const script = [
      'import { readFileSync } from "node:fs";',
      'import { createRequire } from "node:module";',
      "const apis = {};",
      ...(wasmOk
        ? [
            `apis.wasm = await (await import(${JSON.stringify(sidecar("arrays", "mjs"))})).load(readFileSync(${JSON.stringify(wasm)}));`,
          ]
        : []),
      ...(napiOk ? [`apis.napi = createRequire(import.meta.url)(${JSON.stringify(addon)});`] : []),
      "const xs = new Float64Array([0.5, 1.5, 2.5]);",
      "const is = new Int32Array([1, 2, 3, 4]);",
      "const big = new Float64Array(1000000).fill(1);",
      "for (const [name, api] of Object.entries(apis)) {",
      "  const buf = new Int32Array(3);",
      "  api.fill(buf, 7);",
      '  let err = "";',
      "  try { api.sumF64(is); } catch (e) { err = e.constructor.name + ': ' + e.message; }",
      "  const row = [api.sumF64(xs), api.sumI32(is), Array.from(api.scale(xs, 2)).join(','), api.scale(xs, 2).constructor.name,",
      "    Array.from(api.squares(5)).join(','), api.widen(is).constructor.name, String(api.sumI64(new BigInt64Array([1n << 40n, 2n]))),",
      "    Array.from(buf).join(','), err, api.sumF64(big), api.sumF64(big)];",
      "  console.log(name + ' | ' + row.join(' | '));",
      "}",
      // A trap inside wasm (`new Int32Array(-1)` is a huge allocation: memory.grow fails, `unreachable`)
      // surfaces as a RuntimeError; the loader's `finally` releases the arena and later calls still work.
      // The native addon would `_exit(1)` with "out of memory" instead, so only the wasm build is probed.
      ...(wasmOk
        ? [
            'let trap = ""; try { apis.wasm.squares(-1); } catch (e) { trap = e.constructor.name; }',
            "console.log('trap | ' + trap + ' | ' + apis.wasm.sumF64(xs));",
          ]
        : []),
      ...(napiOk
        ? [
            `const strings = createRequire(import.meta.url)(${JSON.stringify(stringsAddon)});`,
            'let serr = ""; try { strings.pick(true, 1, "b"); } catch (e) { serr = e.message; }',
            'console.log(["strings", strings.pick(true, "hello", "world"), strings.identity("caf\\u00e9 \\u{1F600}"), strings.len2("x"), serr].join(" | "));',
          ]
        : []),
    ].join("\n");
    const roundTrip =
      "4.5 | 10 | 1,3,5 | Float64Array | 0,1,4,9,16 | BigInt64Array | 1099511627778 | 7,7,7 | TypeError: sumF64: argument 1 (xs) must be a Float64Array | 1000000 | 1000000";
    const r =
      wasmOk || napiOk ? spawnSync("node", ["--input-type=module", "-e", script], { cwd: root }) : null;
    const lines = r ? String(r.stdout).trim().split("\n") : [];
    const detail = r ? String(r.stdout) + String(r.stderr) : "not built";
    if (wasmOk) {
      check(
        "wasm: the companion loader marshals typed arrays in and out, copies `fill` back, and a 1M-element batch grows memory",
        lines.includes(`wasm | ${roundTrip}`),
        detail
      );
      check(
        "wasm: a trap (squares(-1) -> RuntimeError) releases the arena and the next call works",
        lines.includes("trap | RuntimeError | 4.5"),
        detail
      );
    }
    if (napiOk) {
      check(
        "N-API: typed arrays are borrowed (fill mutates the Int32Array in place), results are fresh typed arrays, i64 is a bigint",
        lines.includes(`napi | ${roundTrip}`),
        detail
      );
      check(
        "N-API: strings cross both ways (UTF-8 preserved) and a non-string argument is a TypeError",
        lines.includes("strings | hello | café \u{1F600} | 2 | pick: argument 2 (a) must be a string"),
        detail
      );
      const ex = spawnSync("node", ["examples/node-addon.mjs", addon], { cwd: root });
      check(
        "examples/node-addon.mjs demonstrates the arrays addon (zero-copy fill, typed-array results)",
        ex.status === 0 &&
          String(ex.stdout).includes("fill(buf, 7) leaves buf = 7,7,7,7") &&
          String(ex.stdout).includes("scale([1,2,3], 2) = 2,4,6 (Float64Array)"),
        String(ex.stdout) + String(ex.stderr)
      );
    }
    if (wasmOk) {
      const host = spawnSync("node", ["examples/node-host.mjs", wasm, "scale", "f64:1,2,3", "2"], {
        cwd: root,
      });
      check(
        "examples/node-host.mjs picks up the companion loader and passes a Float64Array",
        String(host.stdout).trim() === "scale(1, 2, 3, 2) = 2, 4, 6",
        String(host.stdout) + String(host.stderr)
      );
    }
  }
}

// ---- WP0: validator ----------------------------------------------------------------
// Phase 0 must stay cheap. A synthetic 1,000-line file (functions, locals, arithmetic,
// calls, string/boolean expressions, control flow) is parsed once, then only the
// validator is timed. Budget in docs/MASTER_PLAN.md is 5 ms; the gate is 50 ms for CI headroom.
if (!only) {
  const ts = require("typescript");
  const { validateSyntax } = await import(pathToFileURL(path.join(root, "dist", "validator.js")).href);
  const lines = [];
  for (let i = 0; lines.length < 1000; i++) {
    const callee = i === 0 ? "fn0" : `fn${i - 1}`;
    lines.push(`function fn${i}(a: number, b: number, s: string, flag: boolean): number {`);
    lines.push(`  const x = a * ${i} + b - (a % 7); let y = x / 2;`);
    lines.push(
      `  if ((flag && y > a) || !(s === "k")) { y = y + ${callee}(x, y, s, !flag); } else { y = y - 1; }`
    );
    lines.push("  for (let k = 0; k < b; k++) { y = y + k * (k - 1); } return y - x;");
    lines.push("}");
  }
  const perfTs = path.join(buildDir, "validator_perf.ts");
  fs.writeFileSync(perfTs, `${lines.join("\n")}\n`);
  const sf = ts.createSourceFile(
    perfTs,
    fs.readFileSync(perfTs, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  let error = null;
  const t0 = process.hrtime.bigint();
  try {
    validateSyntax(sf);
  } catch (e) {
    error = e;
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  check(`validator accepts a ${lines.length}-line file`, error === null, error?.message);
  check(
    `validator runs in under 50 ms on ${lines.length} lines (${ms.toFixed(2)} ms)`,
    ms < 50,
    `${ms.toFixed(2)} ms`
  );
}

// ---- WP14: self-hosting ---------------------------------------------------------------
// `self/` is the compiler being written in Nish (docs/wp14-selfhost.md). It is
// checked here rather than in tests/cases because it is a program, not a construct:
// the property is that stage0 compiles every module of it cleanly, which is the
// floor the staged bootstrap stands on. As phases land this section grows into the
// stage comparisons of the plan; until then it is a compile gate that fails the
// moment `self/` uses something the language does not have.
if (!only || "selfhost".includes(only) || only.includes("self")) {
  const selfDir = path.join(root, "self");
  const modules = fs.existsSync(selfDir)
    ? fs
        .readdirSync(selfDir)
        .filter((f) => f.endsWith(".ts"))
        .sort()
    : [];
  check("self/ has at least one module", modules.length > 0, `${modules.length} modules`);
  // The property is "stage0 accepts every module of self/", and one root per
  // module proved it at the price of 58 process starts and 58 walks of the
  // module graph -- about a minute of every run. Named together they are one
  // walk and prove the same thing, so the batch is the fast path and the loop
  // below is the fallback that says *which* module failed: a green batch is
  // reported as the same 58 checks under the same names, and a red one is
  // re-run module by module so the failure is attributed rather than dumped.
  //
  // The entry points are compiled apart from the rest because only the entry
  // module may declare `export function main`, so naming two of them in one
  // command produces that diagnostic instead of a build. They are found the
  // way scripts/smoke.sh finds them, and for the same reason: both spellings
  // are legal (docs/wp22-arrow-functions.md).
  const out = path.join(buildDir, "self");
  fs.mkdirSync(out, { recursive: true });
  const compileSelf = (names) =>
    spawnSync("node", [cli, ...names.map((m) => path.join(selfDir, m)), "-o", `${out}/`], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  const declaresMain = (m) =>
    /^export (function main\b|const main\s*=)/m.test(fs.readFileSync(path.join(selfDir, m), "utf8"));
  const entries = modules.filter(declaresMain);
  const groups = [modules.filter((m) => !declaresMain(m)), ...entries.map((m) => [m])];
  const batched = groups.every((g) => g.length === 0 || compileSelf(g).status === 0);
  for (const m of modules) {
    // `batched` is the whole answer when it is true; when it is false one of
    // the groups failed and every module is compiled alone to find out which.
    const r = batched ? null : compileSelf([m]);
    check(`self/${m} compiles`, batched || r.status === 0, batched ? "" : r.stderr);
  }
  // Module constants are the reason `self/` can name its token kinds at all: if
  // one ever became a global, every kind would cost a load on the lexer's hot path.
  const tokensLl = path.join(buildDir, "self", "tokens.ll");
  if (fs.existsSync(tokensLl)) {
    const ir = fs.readFileSync(tokensLl, "utf8");
    check(
      "self/tokens.ts emits no global for its token kinds",
      !/^@(?!\.str\.)/m.test(ir),
      ir
        .split("\n")
        .filter((l) => l.startsWith("@"))
        .join(" | ")
    );
  }

  // The DWARF `producer` string is "nish <version>" on both sides, and stage1
  // cannot read package.json to find the version, so it is a constant in
  // `self/branding.ts`. This is what stops that constant going stale: a
  // disagreement here is a byte of every `-g` module the two compilers would
  // then emit differently.
  const brandingTs = path.join(root, "self", "branding.ts");
  if (fs.existsSync(brandingTs)) {
    const branding = fs.readFileSync(brandingTs, "utf8");
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    check(
      `self/branding.ts names the CLI and version stage0 does (nish ${pkg.version})`,
      branding.includes(`export const CLI: string = "nish";`) &&
        branding.includes(`export const VERSION: string = "${pkg.version}";`),
      branding
        .split("\n")
        .filter((l) => l.startsWith("export const"))
        .join(" | ")
    );
  }

  // stage1 cannot read `std/` to list it: `self/` has to compile under the last
  // *released* compiler (the WP19 G2 gate), and `readdirSync` is newer than
  // that release, so `self/std_modules.ts` carries the list as a literal while
  // stage0 reads the directory. This is what stops the literal going stale — a
  // disagreement is a diagnostic the two compilers word differently, which the
  // reject oracle would only catch if a case happened to trigger it.
  {
    const stdDir = path.join(root, "std");
    const actual = fs
      .readdirSync(stdDir)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => f.slice(0, -3))
      .sort()
      .join(", ");
    const stage1 = fs.readFileSync(path.join(root, "self", "std_modules.ts"), "utf8");
    check(
      `self/std_modules.ts lists the modules std/ actually has (${actual})`,
      stage1.includes(`=> "${actual}"`),
      stage1
        .split("\n")
        .filter((l) => l.includes("stdModuleNames"))
        .join(" | ")
    );
  }

  // S1: the lexer built by stage0 runs natively, and its token stream agrees
  // with the `typescript` scanner's over the whole corpus. The oracle links a
  // binary, so it needs clang; without one this is skipped like every other
  // toolchain-dependent check.
  if (HAS_CLANG) {
    const oracle = spawnSync("node", [path.join(root, "tests", "lexer_oracle.js"), "--seed", seedSpec], {
      cwd: root,
      encoding: "utf8",
    });
    const summary = oracle.stdout.trim().split("\n").pop() ?? "";
    check(
      `self/lexer.ts agrees with the typescript scanner (${summary})`,
      oracle.status === 0,
      `${oracle.stdout}${oracle.stderr}`
    );

    // The one thing the oracle cannot judge: the scanner recovers from a
    // lexical error and this lexer stops, so the message and the position it
    // stops at are a golden of their own.
    const dumper = path.join(buildDir, "self", "dump_tokens");
    const built = spawnSync("node", [cli, path.join(selfDir, "dump_tokens.ts"), "--link", dumper], {
      cwd: root,
      encoding: "utf8",
    });
    if (check("self/dump_tokens.ts links", built.status === 0, built.stderr)) {
      const errorsTs = path.join(root, "tests", "lexer", "errors.ts");
      const run = spawnSync(dumper, [errorsTs], { cwd: root, encoding: "utf8" });
      const want = fs.readFileSync(path.join(root, "tests", "lexer", "errors.out"), "utf8");
      check(
        "self/lexer.ts stops at a lexical error with its message and position",
        run.stdout === want && run.status === 1,
        `exit ${run.status}\n${run.stdout}`
      );
    }

    // S2: the same shape one level up. Every positive program in the corpus
    // must parse to the tree the `typescript` parser builds, span for span;
    // the files the oracle skips are the forbidden constructs Nish-0 has
    // no grammar for yet, and that count is the S2 gate's own measurement.
    const parserOracle = spawnSync("node", [path.join(root, "tests", "parser_oracle.js"), "--seed", seedSpec], {
      cwd: root,
      encoding: "utf8",
    });
    const parserSummary = parserOracle.stdout.trim().split("\n").pop() ?? "";
    check(
      `self/parser.ts agrees with the typescript parser (${parserSummary})`,
      parserOracle.status === 0,
      `${parserOracle.stdout}${parserOracle.stderr}`
    );

    // And the half of the parser the oracle cannot see: recovery. A failed
    // parse is an `N_ERROR` node and a diagnostic, and the declaration after
    // it still parses (docs/wp14-selfhost.md §3a D1).
    const astDumper = path.join(buildDir, "self", "dump_ast");
    const builtAst = spawnSync("node", [cli, path.join(selfDir, "dump_ast.ts"), "--link", astDumper], {
      cwd: root,
      encoding: "utf8",
    });
    if (check("self/dump_ast.ts links", builtAst.status === 0, builtAst.stderr)) {
      // Relative, because the diagnostics quote the path they were given and
      // the golden cannot hold this machine's checkout directory.
      const recovery = spawnSync(astDumper, ["tests/parser/recovery.ts"], { cwd: root, encoding: "utf8" });
      const wantOut = fs.readFileSync(path.join(root, "tests", "parser", "recovery.out"), "utf8");
      const wantErr = fs.readFileSync(path.join(root, "tests", "parser", "recovery.err"), "utf8");
      check(
        "self/parser.ts reports a syntax error and keeps parsing what follows",
        recovery.stdout === wantOut && recovery.stderr === wantErr && recovery.status === 1,
        `exit ${recovery.status}\n${recovery.stdout}${recovery.stderr}`
      );
    }

    // Wave C: the support library the checker and the emitter are written
    // over (docs/wp14-selfhost.md §3). It has no counterpart in `src/` to
    // diff phase by phase, so each function is matched with something that
    // already exists — stage0's own IR escape and f64 hex, `node:path` for
    // the module-identity hazard of §3a D3, and `JSON.stringify` / `Map` for
    // the rest.
    const supportOracle = spawnSync("node", [path.join(root, "tests", "self", "support_oracle.js"), "--seed", seedSpec], {
      cwd: root,
      encoding: "utf8",
    });
    const supportSummary = supportOracle.stdout.trim().split("\n").pop() ?? "";
    check(
      `self/ support library agrees with node and stage0 (${supportSummary})`,
      supportOracle.status === 0,
      `${supportOracle.stdout}${supportOracle.stderr}`
    );

    // S3, first piece: the type model. stage1 interns types and names them by
    // an `i32`; stage0 keeps discriminated-union objects and compares them
    // structurally. The oracle is that nothing downstream can tell — same
    // LLVM type, same alignment, same name in a diagnostic, same
    // assignability matrix.
    const typesOracle = spawnSync("node", [path.join(root, "tests", "self", "types_oracle.js")], {
      cwd: root,
      encoding: "utf8",
    });
    const typesSummary = typesOracle.stdout.trim().split("\n").pop() ?? "";
    check(
      `self/types.ts agrees with src/types.ts (${typesSummary})`,
      typesOracle.status === 0,
      `${typesOracle.stdout}${typesOracle.stderr}`
    );

    // S3: diagnostics. The `.err` goldens match on a summary line and the CLI
    // prints an excerpt, so "stage1 reports the same errors" means every byte
    // of both — plus the order a phase's errors come out in, the
    // `...and N more` cut and the `--json` object.
    const diagnosticsOracle = spawnSync("node", [path.join(root, "tests", "self", "diagnostics_oracle.js")], {
      cwd: root,
      encoding: "utf8",
    });
    const diagnosticsSummary = diagnosticsOracle.stdout.trim().split("\n").pop() ?? "";
    check(
      `self/diagnostics.ts agrees with src/diagnostics.ts (${diagnosticsSummary})`,
      diagnosticsOracle.status === 0,
      `${diagnosticsOracle.stdout}${diagnosticsOracle.stderr}`
    );

    // S3: the scope chain, and with it the narrowing rules. This is the part
    // of the checker a program can observe going wrong — a narrowing kept one
    // statement too long compiles a load through a pointer the checker
    // promised was not null — so both implementations are driven through one
    // script and every answer compared.
    const symbolsOracle = spawnSync("node", [path.join(root, "tests", "self", "symbols_oracle.js")], {
      cwd: root,
      encoding: "utf8",
    });
    const symbolsSummary = symbolsOracle.stdout.trim().split("\n").pop() ?? "";
    check(
      `self/symbols.ts agrees with src/checker/scope.ts (${symbolsSummary})`,
      symbolsOracle.status === 0,
      `${symbolsOracle.stdout}${symbolsOracle.stderr}`
    );

    // S3, the checker. `self/dump_checked.ts` prints what it collected in
    // exactly the format `--emit-checked` prints it, so what is compared over
    // the whole corpus is every struct's layout — field indices and byte
    // offsets included — every signature, every symbol, every folded constant,
    // and the order they come out in. A program that imports is loaded whole
    // through the S5 driver and every module of it is dumped, so the binding
    // of each imported name is compared too.
    const checkedOracle = spawnSync("node", [path.join(root, "tests", "self", "checked_oracle.js")], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const checkedSummary = checkedOracle.stdout.trim().split("\n").pop() ?? "";
    check(
      `self/checker.ts agrees with stage0 on what it accepts (${checkedSummary})`,
      checkedOracle.status === 0,
      `${checkedOracle.stdout}${checkedOracle.stderr}`
    );

    // WP19 G2.4: the same four comparisons, written down. The oracle above and
    // the three before it — types, diagnostics, symbols — prove stage1 correct
    // by holding it against stage0, and prove nothing at all once `src/` is
    // deleted. They are green, so stage1's output *is* the agreed behaviour;
    // `tests/self/goldens/` is that output checked in, and `goldens.js`
    // compares stage1's live answer against it with stage0 nowhere in the
    // picture. Both run while stage0 lives: this one survives it.
    //
    // The seed is `seedSpec` above, passed in rather than looked up, because
    // the *suite* still has stage0 and the tool must not.
    const goldens = spawnSync(
      "node",
      [
        path.join(root, "tests", "self", "goldens.js"),
        ...(process.env.UPDATE_GOLDENS === "1" ? ["--update"] : []),
        "--seed",
        seedSpec,
      ],
      { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
    );
    const goldensSummary = goldens.stdout.trim().split("\n").pop() ?? "";
    check(
      `self/ prints what tests/self/goldens/ records, with no stage0 in it (${goldensSummary})`,
      goldens.status === 0,
      `${goldens.stdout}${goldens.stderr}`
    );

    // The other half of milestone S3: refusing the same programs for the same
    // reason. A dump comparison cannot see that, so every `reject_*` case and
    // every `tests/link/` negative is run through stage1 and its own expected
    // fragments are required of the output — the same assertion the suite
    // already makes of stage0.
    const rejectOracle = spawnSync("node", [path.join(root, "tests", "self", "reject_oracle.js"), "--seed", seedSpec], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const rejectSummary = rejectOracle.stdout.trim().split("\n").pop() ?? "";
    check(
      `self/ refuses what stage0 refuses (${rejectSummary})`,
      rejectOracle.status === 0,
      `${rejectOracle.stdout}${rejectOracle.stderr}`
    );

    // S4: the emitter. `IR(stage0, p) == IR(stage1, p)` byte for byte over
    // every whole program in the corpus — not a golden a human wrote, and not
    // a summary either: every attribute, every block label and every SSA
    // number has to match, which is the half of the output a golden test reads
    // past. One skip is left and it is the parser fixture no checker accepts;
    // the dump flags are counted apart from it, as dumps.
    const irOracle = spawnSync("node", [path.join(root, "tests", "self", "ir_oracle.js")], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const irSummary = irOracle.stdout.trim().split("\n").pop() ?? "";
    check(
      `self/emit.ts emits the IR stage0 emits (${irSummary})`,
      irOracle.status === 0,
      `${irOracle.stdout}${irOracle.stderr}`
    );

    // WP19 G2.1: the successor to the oracle above and to the interop oracle
    // below, which both die with stage0 (`docs/wp19-stage0-retirement.md` §2B).
    // `nish-cmp` compares the **last released** `nish` with HEAD over the same
    // corpus, byte for byte — Go's `toolstash -cmp` — and a difference has to
    // be named in `CHANGELOG.md` before it goes green.
    //
    // Nish has no release yet, so on every machine today this skips rather
    // than runs, and the skip is counted and says why: a comparison against
    // nothing that reported PASS would be exactly the green-run-proving-less
    // problem the summary at the bottom of this file exists to expose. Set
    // `NISH_BOOTSTRAP` to the seed — the variable `scripts/bootstrap.sh` reads
    // — and it runs, which is what CI does once 0.1.0 is out. Budget about
    // three minutes for it when it does: it is the whole corpus twice, which
    // is the same shape and the same cost as the oracle above.
    if (!process.env.NISH_BOOTSTRAP) {
      skip(
        "NISH_BOOTSTRAP is unset: there is no released nish to compare HEAD against, so " +
          "tests/nish-cmp.js (WP19 G2) did not run"
      );
    } else {
      const nishCmp = spawnSync("node", [path.join(root, "tests", "nish-cmp.js")], {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
      const nishCmpSummary = nishCmp.stdout.trim().split("\n").pop() ?? "";
      check(
        `the released nish and HEAD write the same bytes (${nishCmpSummary})`,
        nishCmp.status === 0,
        `${nishCmp.stdout}${nishCmp.stderr}`
      );
    }

    // The same equality, on programs nobody wrote. The corpus the oracle above
    // reads is checked in and therefore finite and adapted-to; the WP13 fuzzer
    // generates random straight-line programs, and here both compilers are
    // asked for the IR of each and the texts compared byte for byte, module set
    // included (`fuzz.js --stage1`, docs/wp13-differential.md "The fuzzer").
    //
    // Sixteen programs from one fixed seed. The count is a time budget rather
    // than a coverage judgement: the run links one stage1 binary (about 15 s)
    // and each program then costs about a third of a second, so sixteen keeps
    // the whole check near 20 s, most of it the link, and leaves the suite the
    // length it was. Three hundred programs is about two minutes and belongs in
    // a manual `node tests/differential/fuzz.js --stage1 --count 300` rather
    // than in every `npm test`. The seed is fixed
    // so the check is deterministic and a failure reproduces from the summary
    // line alone, and it is deliberately not the seed the WP13 batch uses, so
    // the two checks look at different programs.
    const stage1FuzzSeed = 20261001;
    const stage1Fuzz = spawnSync(
      "node",
      [
        path.join(root, "tests", "differential", "fuzz.js"),
        "--stage1",
        "--seed",
        String(stage1FuzzSeed),
        "--count",
        "16",
      ],
      { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
    );
    const stage1FuzzSummary =
      stage1Fuzz.stdout
        .trim()
        .split("\n")
        .filter((l) => l.startsWith("fuzz: stage1 seed="))
        .pop() ?? "";
    check(
      `self/emit.ts emits the IR stage0 emits for random programs (${stage1FuzzSummary || `seed=${stage1FuzzSeed}`})`,
      stage1Fuzz.status === 0,
      `${stage1Fuzz.stdout}${stage1Fuzz.stderr}`
    );

    // WP8 from stage1: the interop sidecars. `--emit-header`, `--emit-dts`
    // (which also writes its companion loader) and `--emit-napi` are derived
    // from the same checked program the IR came from, so the oracle is the
    // same one: run both compilers over the corpus the WP8 section above
    // drives the generators over, and compare all four files byte for byte.
    // Only the link step and the directory creation are still stage0's (D4).
    // WP19 G1, the flag-set half only. The corpus half is `--parity`, a mode
    // rather than a section, because it is minutes (see the top of this file);
    // this is two `--help` runs and belongs in every `npm test`, because it
    // asks the one question no oracle and no variation asks — what flags does
    // each compiler say it has? — and a flag one side lacks is invisible to
    // everything else here.
    //
    // It earns that by what it found: `--no-warn-performance` was stage0's
    // alone and stage1 printed no performance warnings at all, and `--out-dir`
    // was stage1's alone. Both had been so for as long as they had existed.
    const parity = spawnSync(
      "node",
      [path.join(root, "tests", "self", "parity.js"), "--flags-only"],
      { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
    );
    const paritySummary = parity.stdout.trim().split("\n").pop() ?? "";
    check(
      `the two compilers document the same flags (${paritySummary})`,
      parity.status === 0,
      `${parity.stdout}${parity.stderr}`
    );

    const interopOracle = spawnSync("node", [path.join(root, "tests", "self", "interop_oracle.js")], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const interopSummary = interopOracle.stdout.trim().split("\n").pop() ?? "";
    check(
      `self/ writes the interop sidecars stage0 writes (${interopSummary})`,
      interopOracle.status === 0,
      `${interopOracle.stdout}${interopOracle.stderr}`
    );

    // S5, and the claim the work package exists for: `self/` compiles `self/`.
    // stage1 is `self/` built by stage0, stage2 is `self/` built by stage1,
    // stage3 is `self/` built by stage2. `IR(stage1) == IR(stage2)` is the
    // fixed point — nothing about stage0 leaks into the result any more — and
    // stage3 must be byte-identical to stage2 so the binaries are compared as
    // well as the text. Three links, so it is the slowest check here.
    const bootstrap = spawnSync("node", [path.join(root, "tests", "self", "bootstrap.js")], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const bootstrapSummary = bootstrap.stdout.trim().split("\n").pop() ?? "";
    check(
      `self/ compiles self/: the bootstrap reaches a fixed point (${bootstrapSummary})`,
      bootstrap.status === 0,
      `${bootstrap.stdout}${bootstrap.stderr}`
    );

    // WP19 G3: which equalities `scripts/bootstrap.sh --verify` asserts is
    // decided by what the seed is, and these two checks are what stops that
    // from drifting back.
    //
    // `IR(seed) == IR(stage1)` is two different claims wearing one spelling.
    // With stage0 as the seed it is diverse double-compiling -- two
    // independently written implementations of this revision emitting the same
    // IR for it -- and it is asserted. With a released binary as the seed the
    // same comparison asks whether codegen has changed since that release,
    // which forbids every improvement a release cycle exists to carry and says
    // nothing about the bootstrap, so it is reported and not asserted.
    // `IR(stage1) == IR(stage2)` and `stage3 == stage2` are properties of the
    // working tree alone and are asserted for every seed.
    //
    // Both runs use the debug profile, where three stages cost about eight
    // seconds rather than the speed profile's minutes; what is under test is
    // the decision, not the code the linker produced.
    const seedWork = (name) => path.join(buildDir, "seed-equality", name);
    const runBootstrap = (name, env) =>
      spawnSync(
        "bash",
        [
          path.join(root, "scripts", "bootstrap.sh"),
          "--verify",
          "--profile", "debug",
          "--work", seedWork(name),
          "-o", path.join(seedWork(name), "nish"),
        ],
        { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...env } }
      );

    // The two seed-independent equalities, and the named seed equality, all
    // reported as asserted. NISH_BOOTSTRAP is cleared rather than inherited:
    // a developer with one set in their shell must still be testing stage0
    // here. The second run names stage0 through the variable, which is the
    // same seed spelled a second way and has to be recognised as one -- the
    // decision is about the seed, not about whether the variable was set.
    const stage0Seeded = runBootstrap("stage0", { NISH_BOOTSTRAP: "" });
    const namedStage0 = runBootstrap("named", { NISH_BOOTSTRAP: "dist/index.js" });
    check(
      "the bootstrap script: a stage0 seed asserts IR(stage0) == IR(stage1), however it is named",
      stage0Seeded.status === 0 &&
        namedStage0.status === 0 &&
        /IR\(stage0\) == IR\(stage1\): \d+ modules identical/.test(stage0Seeded.stdout) &&
        /IR\(stage0\) == IR\(stage1\): \d+ modules identical/.test(namedStage0.stdout) &&
        !stage0Seeded.stdout.includes("note: IR(seed)") &&
        !namedStage0.stdout.includes("note: IR(seed)"),
      `unset ${stage0Seeded.status}:\n${stage0Seeded.stdout}${stage0Seeded.stderr}\n` +
        `named ${namedStage0.status}:\n${namedStage0.stdout}${namedStage0.stderr}`
    );

    // And a seed that is not stage0. A released `nish` is the real case and CI
    // has one, but a checkout does not, so the difference is staged instead:
    // the seed here is stage0 with `--unchecked-indexing`, which removes the
    // bounds checks from the IR it emits for `self/` -- the same shape of
    // difference a codegen improvement makes, and the shape that broke this
    // run when the first one landed. The seed still builds a working stage1,
    // so the fixed point is untouched and stays asserted.
    //
    // The difference has to actually be there: a run where nothing differs
    // would pass this check while proving nothing, so the count is read out of
    // the note and required to be non-zero.
    const perturbedSeed = seedWork("seed-unchecked.mjs");
    fs.mkdirSync(path.dirname(perturbedSeed), { recursive: true });
    fs.writeFileSync(
      perturbedSeed,
      `// Generated by tests/run.js: stage0, emitting IR without bounds checks.\n` +
        `import { spawnSync } from "node:child_process";\n` +
        `const args = process.argv.slice(2);\n` +
        `const asking = args.includes("--version") || args.includes("--help");\n` +
        `const r = spawnSync(process.execPath, [${JSON.stringify(cli)}, ...args,` +
        ` ...(asking ? [] : ["--unchecked-indexing"])], { stdio: "inherit" });\n` +
        `process.exit(r.status === null ? 70 : r.status);\n`
    );
    const released = runBootstrap("released", { NISH_BOOTSTRAP: perturbedSeed });
    const note = /note: IR\(seed\) vs IR\(stage1\): (\d+) of (\d+) modules differ/.exec(released.stdout);
    check(
      `a seed that is not stage0 reports the seed difference and does not assert it (${
        note ? `${note[1]} of ${note[2]} modules` : "no note printed"
      })`,
      released.status === 0 &&
        note !== null &&
        Number(note[1]) > 0 &&
        released.stdout.includes("Not a bootstrap failure") &&
        /IR\(stage1\) == IR\(stage2\): \d+ modules identical/.test(released.stdout) &&
        released.stdout.includes("stage3 == stage2: byte-identical binaries"),
      `${released.status}:\n${released.stdout}${released.stderr}`
    );

    // The deployment path (docs/wp14-selfhost.md §7). The check above proves
    // the fixed point and then deletes every compiler it built; this one
    // proves the artifact: `scripts/bootstrap.sh` builds a compiler you can
    // keep, and that compiler is the whole command line — the output planning,
    // the directory creation and the link step included, which is D4 reversed
    // (§7a). Everything below runs the binary itself, with no wrapper in the
    // way. One stage rather than three, because what is under test here is the
    // recipe and the driver, not the equalities.
    const shipDir = path.join(buildDir, "selfhost");
    fs.rmSync(shipDir, { recursive: true, force: true });
    const compiler = path.join(shipDir, "nish");
    const shipped = spawnSync(
      "bash",
      [
        path.join(root, "scripts", "bootstrap.sh"),
        "--stages", "1",
        "--profile", "debug",
        "--work", shipDir,
        "-o", compiler,
        "--quiet",
      ],
      { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
    );
    if (
      check(
        "scripts/bootstrap.sh builds the self-hosted compiler from source",
        shipped.status === 0 && fs.existsSync(compiler),
        `${shipped.stdout}${shipped.stderr}`
      )
    ) {

      // One module: the IR lands next to the binary as `<exe>.ll`, which is
      // where stage0's `--link` puts it too.
      const hello = path.join(shipDir, "hello");
      const one = spawnSync(
        compiler,
        ["examples/hello.ts", "--link", hello, "--profile", "debug"],
        { cwd: root, encoding: "utf8" }
      );
      const ranHello = one.status === 0 ? spawnSync(hello, [], { encoding: "utf8" }) : null;
      check(
        "the self-hosted compiler: the self-hosted compiler links and runs examples/hello.ts",
        one.status === 0 &&
          fs.existsSync(`${hello}.ll`) &&
          ranHello !== null &&
          ranHello.status === 0 &&
          ranHello.stdout === "hello from Nish\n",
        `${one.stdout}${one.stderr}${ranHello ? `ran: ${ranHello.status} ${JSON.stringify(ranHello.stdout)}` : ""}`
      );

      // Two modules: the compiler makes the `<exe>.modules/` directory itself
      // now, and `main()` returns the exit code.
      const multi = path.join(shipDir, "multi");
      const many = spawnSync(
        compiler,
        ["examples/multi/main.ts", "--link", multi, "--profile", "debug"],
        { cwd: root, encoding: "utf8" }
      );
      const ranMulti = many.status === 0 ? spawnSync(multi, [], { encoding: "utf8" }) : null;
      const emitted = fs.existsSync(`${multi}.modules`)
        ? fs.readdirSync(`${multi}.modules`).filter((f) => f.endsWith(".ll")).sort()
        : [];
      check(
        "the self-hosted compiler: a program with imports links from <exe>.modules/ and exits 49",
        many.status === 0 &&
          emitted.join(",") === "main.ll,math.ll" &&
          ranMulti !== null &&
          ranMulti.status === 49,
        `${many.stdout}${many.stderr}modules: ${emitted.join(",")}${ranMulti ? ` exit ${ranMulti.status}` : ""}`
      );

      // `-g` reaches both halves: the compiler puts the DWARF in the `.ll` and
      // hands `-g` to
      // scripts/build.sh, so the DWARF in the .ll survives the link instead of
      // being stripped with the profile. A `.debug_info` section in the linked
      // binary is the end-to-end proof; the metadata in the IR is what the
      // oracle compares byte for byte.
      const dbgExe = path.join(shipDir, "hello-g");
      const withG = spawnSync(
        compiler,
        ["examples/hello.ts", "--link", dbgExe, "--profile", "debug", "-g"],
        { cwd: root, encoding: "utf8" }
      );
      const dbgIr = fs.existsSync(`${dbgExe}.ll`) ? fs.readFileSync(`${dbgExe}.ll`, "utf8") : "";
      const dwarf = withG.status === 0 && HAS_LLVM_DWARFDUMP
        ? spawnSync("llvm-dwarfdump", ["--debug-info", dbgExe], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
        : null;
      // Without llvm-dwarfdump, read the section table clang already wrote.
      const hasDwarf = dwarf
        ? dwarf.status === 0 && dwarf.stdout.includes("DW_TAG_compile_unit")
        : withG.status === 0 && fs.readFileSync(dbgExe).includes("debug_info");
      check(
        "the self-hosted compiler: -g reaches the compiler and the linked program carries DWARF",
        withG.status === 0 &&
          dbgIr.includes("!llvm.dbg.cu") &&
          dbgIr.includes("distinct !DISubprogram(name: \"main\"") &&
          hasDwarf,
        `${withG.status}: ${withG.stdout}${withG.stderr}${dwarf ? dwarf.stdout.slice(0, 400) : ""}`
      );

      // stage1 answers `--version` itself, and the answer has to be the same
      // string stage0 prints: `self/branding.ts` carries the version as a
      // constant because stage1 cannot read `package.json`, so this is what
      // catches the two drifting apart at the next release bump.
      const ourVersion = spawnSync(compiler, ["--version"], { cwd: root, encoding: "utf8" });
      const theirVersion = spawnSync("node", [cli, "--version"], { cwd: root, encoding: "utf8" });
      check(
        "the self-hosted compiler: --version is the line stage0 prints",
        ourVersion.status === 0 &&
          ourVersion.stdout === theirVersion.stdout &&
          ourVersion.stdout.trim() ===
            `nish ${JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version}`,
        `ours ${JSON.stringify(ourVersion.stdout)} theirs ${JSON.stringify(theirVersion.stdout)}`
      );

      // `--json` is the editor-facing diagnostic shape, and an editor pointed
      // at either compiler must get the same bytes: same objects, same order,
      // same spans. A multi-error program is the case worth pinning, because
      // it is also the one that proves stage1 collected every error rather
      // than stopping at the first.
      const jsonCase = path.join("tests", "cases", "reject_multi_error.ts");
      const ourJson = spawnSync(compiler, [jsonCase, "--json"], { cwd: root, encoding: "utf8" });
      const theirJson = spawnSync("node", [cli, jsonCase, "--json"], { cwd: root, encoding: "utf8" });
      check(
        "the self-hosted compiler: --json diagnostics are byte-identical to stage0's",
        ourJson.status === 1 &&
          theirJson.status === 1 &&
          ourJson.stdout === theirJson.stdout &&
          ourJson.stdout.split("\n").filter(Boolean).length === 3,
        `ours:\n${ourJson.stdout}${ourJson.stderr}\ntheirs:\n${theirJson.stdout}`
      );

      // WP19 G2.4, the wording gap: the same coverage run, through the
      // compiler that survives stage0. `tests/wordings/` pins stage0's wording
      // for each code, and this asks stage1 for the same sentence. Two
      // outcomes are declared per case rather than in general:
      // `parser_refusals.txt` for the constructs stage1's parser turns down
      // before the phase that owns the rule can word it (§A3), and
      // `stage1_divergence.txt` for the eleven programs the two compilers do
      // not yet answer the same way at all. `--strict-refusals` is what makes
      // both lists shrink-only: a case that starts agreeing fails until the
      // line naming it is deleted.
      const stage1Wordings = spawnSync(
        "node",
        [
          path.join(root, "tests", "diagnostic_coverage.js"),
          "--compiler",
          path.relative(root, compiler),
          "--strict-refusals",
        ],
        { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
      );
      const stage1WordingsSummary = stage1Wordings.stdout.trim().split("\n").pop() ?? "";
      check(
        `the self-hosted compiler: the diagnostic wordings are stage1's too (${stage1WordingsSummary})`,
        stage1Wordings.status === 0,
        `${stage1Wordings.stdout}${stage1Wordings.stderr}`
      );

      // WP15 §8 through the driver (WP19 G1). The analysis is compared word
      // for word by the checked oracle already; what this pins is the half
      // that is the driver's -- that stage1 prints the warnings at all, on
      // stderr, in stage0's order and with stage0's cap, as JSON objects on
      // stdout under `--json`, and not at all under `--no-warn-performance`.
      // A warning changes no exit code on either side, so the compile that
      // carries it is a successful one. `wrote <file>` is dropped from both:
      // it names a path in a temporary directory that differs per side.
      const perfCase = path.join("tests", "cases", "perf_str_concat_loop.ts");
      const perfOut = (dir) => path.join(shipDir, dir, "perf.ll");
      const withoutWrote = (text) =>
        text.split("\n").filter((line) => !line.startsWith("wrote ")).join("\n");
      const ourPerf = spawnSync(compiler, [perfCase, "-o", perfOut("perf1")], { cwd: root, encoding: "utf8" });
      const theirPerf = spawnSync("node", [cli, perfCase, "-o", perfOut("perf0")], { cwd: root, encoding: "utf8" });
      const ourPerfJson = spawnSync(compiler, [perfCase, "-o", perfOut("perf1j"), "--json"], { cwd: root, encoding: "utf8" });
      const theirPerfJson = spawnSync("node", [cli, perfCase, "-o", perfOut("perf0j"), "--json"], { cwd: root, encoding: "utf8" });
      const ourPerfOff = spawnSync(
        compiler,
        [perfCase, "-o", perfOut("perf1q"), "--no-warn-performance"],
        { cwd: root, encoding: "utf8" }
      );
      check(
        "the self-hosted compiler: the performance warnings are stage0's, and --no-warn-performance silences them",
        ourPerf.status === 0 &&
          theirPerf.status === 0 &&
          withoutWrote(ourPerf.stderr) === withoutWrote(theirPerf.stderr) &&
          ourPerf.stderr.includes("performance: `out` is rebuilt") &&
          withoutWrote(ourPerf.stderr).trimEnd().endsWith("4 performance warnings") &&
          ourPerfJson.stdout === theirPerfJson.stdout &&
          ourPerfJson.stdout.split("\n").filter(Boolean).length === 4 &&
          ourPerfOff.status === 0 &&
          withoutWrote(ourPerfOff.stderr).trim() === "",
        `ours:\n${ourPerf.stderr}\ntheirs:\n${theirPerf.stderr}\nours --json:\n${ourPerfJson.stdout}\ntheirs --json:\n${theirPerfJson.stdout}\nours --no-warn-performance:\n${ourPerfOff.stderr}`
      );

      // `--emit-checked` through the driver, rather than through the
      // `dump_checked` entry the oracle spawns: the same text has to come out
      // of both, which is why one `self/dump.ts` writes it for both. The
      // attribute pass's lines are dropped on stage0's side exactly as
      // `tests/self/checked_oracle.js` drops them.
      const laterPhases = /^ {2}(facts:|escaping:|calls:|pointer |stackSites)/;
      const checkerLines = (text) => text.split("\n").filter((l) => l.length > 0 && !laterPhases.test(l));
      const dumpCase = path.join("examples", "multi", "main.ts");
      const ourDump = spawnSync(compiler, [dumpCase, "--emit-checked"], { cwd: root, encoding: "utf8" });
      const theirDump = spawnSync("node", [cli, dumpCase, "--emit-checked"], { cwd: root, encoding: "utf8" });
      check(
        "the self-hosted compiler: --emit-checked dumps a whole program as stage0 dumps it",
        ourDump.status === 0 &&
          theirDump.status === 0 &&
          checkerLines(ourDump.stdout).join("\n") === checkerLines(theirDump.stdout).join("\n") &&
          ourDump.stdout.includes("module examples/multi/main.ts (entry)"),
        `ours:\n${ourDump.stdout}${ourDump.stderr}\ntheirs:\n${theirDump.stdout}`
      );

      // No flag is stage0's by name any more (`--emit-ast` was the last, WP19
      // R1), so what this pins is the property the refusal was really about: a
      // flag the compiler does not know is refused rather than quietly
      // dropped, because a build that asked for something must not come out
      // without it and without being told. Both compilers answer exit 2, which
      // is the usage-error code the CLI contract fixes.
      const refused = spawnSync(compiler, ["examples/hello.ts", "--emit-sidecar"], {
        cwd: root,
        encoding: "utf8",
      });
      const refused0 = spawnSync("node", [cli, "examples/hello.ts", "--emit-sidecar"], {
        cwd: root,
        encoding: "utf8",
      });
      check(
        "the self-hosted compiler: an unknown flag is refused, not ignored, as stage0 refuses it",
        refused.status === 2 &&
          refused.stderr.includes("--emit-sidecar") &&
          refused0.status === 2,
        `stage1 ${refused.status}: ${refused.stdout}${refused.stderr}stage0 ${refused0.status}: ${refused0.stderr}`
      );

      // The `--help` contract is shared rather than each compiler's own: a
      // request that succeeded goes to stdout with exit 0, a refusal to stderr
      // with exit 2. The two usage *texts* differ -- stage1's is one line and
      // names `compile` -- so it is the shape that is pinned, not the bytes.
      const ourHelp = spawnSync(compiler, ["--help"], { cwd: root, encoding: "utf8" });
      const theirHelp = spawnSync("node", [cli, "--help"], { cwd: root, encoding: "utf8" });
      const ourRefusal = spawnSync(compiler, [], { cwd: root, encoding: "utf8" });
      check(
        "the self-hosted compiler: --help answers on stdout with exit 0, as stage0 does",
        ourHelp.status === 0 &&
          theirHelp.status === 0 &&
          ourHelp.stdout.includes("usage:") &&
          ourHelp.stderr === "" &&
          ourRefusal.status === 2 &&
          ourRefusal.stderr.includes("usage:") &&
          ourRefusal.stdout === "",
        `help ${ourHelp.status}:\n${ourHelp.stdout}${ourHelp.stderr}\nrefusal ${ourRefusal.status}:\n${ourRefusal.stdout}${ourRefusal.stderr}`
      );

      // The interop sidecars are stage1's, and so is the directory each one
      // needs. The bytes themselves are the interop oracle's business.
      const sidecarDir = path.join(shipDir, "interop");
      const sidecarFiles = ["add.h", "add.d.ts", "add.mjs", "add.napi.c"];
      const sidecars = spawnSync(
        compiler,
        [
          "examples/add.ts",
          "-o", path.join(shipDir, "add.ll"),
          "--emit-header", path.join(sidecarDir, "add.h"),
          "--emit-dts", path.join(sidecarDir, "add.d.ts"),
          "--emit-napi", path.join(sidecarDir, "add.napi.c"),
        ],
        { cwd: root, encoding: "utf8" }
      );
      const wrote = sidecarFiles.filter((f) => fs.existsSync(path.join(sidecarDir, f)));
      const selfHeader = wrote.includes("add.h")
        ? fs.readFileSync(path.join(sidecarDir, "add.h"), "utf8")
        : "";
      check(
        "the self-hosted compiler: the interop sidecars are passed through and their directory made",
        sidecars.status === 0 &&
          wrote.length === sidecarFiles.length &&
          selfHeader.includes("int32_t add(int32_t a, int32_t b);"),
        `${sidecars.status}: ${sidecars.stdout}${sidecars.stderr}wrote: ${wrote.join(",")}`
      );

      // ---- The command line answers the way stage0's does, not merely close
      // to it. Each of these was a silent divergence: a flag stage1 accepted
      // and ignored, an input it dropped, a stream it wrote the wrong way
      // down. None of them is a decision D4 or §7 records, which is what
      // separates them from `--emit-ast`.

      // An unknown `--number-mode` refused rather than quietly meaning i32:
      // the failure mode is a program that compiles, in the other arithmetic.
      const badMode = spawnSync(
        compiler,
        ["examples/hello.ts", "--number-mode", "f32", "-o", path.join(shipDir, "unused.ll")],
        { cwd: root, encoding: "utf8" }
      );
      const badMode0 = spawnSync(
        "node",
        [cli, "examples/hello.ts", "--number-mode", "f32", "-o", path.join(shipDir, "unused0.ll")],
        { cwd: root, encoding: "utf8" }
      );
      check(
        "the self-hosted compiler: an unknown --number-mode is refused, as stage0 refuses it",
        badMode.status === 2 &&
          badMode0.status === 2 &&
          !fs.existsSync(path.join(shipDir, "unused.ll")),
        `stage1 ${badMode.status}: ${badMode.stderr}stage0 ${badMode0.status}: ${badMode0.stderr}`
      );

      // Every positional is a root, as it is for stage0. Before this the last
      // one won and the others were compiled into nothing.
      const rootsDir = path.join(shipDir, "roots");
      const roots = spawnSync(
        compiler,
        ["examples/hello.ts", "examples/add.ts", "-o", `${rootsDir}/`],
        { cwd: root, encoding: "utf8" }
      );
      const rootsWrote = fs.existsSync(rootsDir) ? fs.readdirSync(rootsDir).sort() : [];
      check(
        "the self-hosted compiler: every file named on the command line is a root",
        roots.status === 0 && rootsWrote.join(",") === "add.ll,hello.ll",
        `${roots.status}: ${roots.stdout}${roots.stderr}wrote: ${rootsWrote.join(",")}`
      );

      // stdout carries the IR and the `--json` diagnostics and nothing else,
      // so `wrote <file>` goes to stderr where stage0 puts it. A build script
      // that pipes the IR somewhere must not find chatter mixed into it.
      const chatterDir = path.join(shipDir, "chatter");
      const chatter = spawnSync(
        compiler,
        ["examples/hello.ts", "-o", `${chatterDir}/`],
        { cwd: root, encoding: "utf8" }
      );
      const chatter0 = spawnSync(
        "node",
        [cli, "examples/hello.ts", "-o", `${path.join(shipDir, "chatter0")}/`],
        { cwd: root, encoding: "utf8" }
      );
      check(
        "the self-hosted compiler: `wrote <file>` goes to stderr, as stage0 writes it",
        chatter.status === 0 &&
          chatter.stdout === "" &&
          chatter.stderr.includes("wrote ") &&
          chatter0.stdout === "" &&
          chatter0.stderr.includes("wrote "),
        `stage1 out=${JSON.stringify(chatter.stdout)} err=${JSON.stringify(chatter.stderr)}`
      );

      // A root that cannot be opened is a driver failure, not a diagnostic
      // with a span: stage0 answers exit 1 with `error: ...` on stderr, and
      // one flat object on stdout under `--json`. The errno itself stays
      // stage0's — Node names it and the runtime's read does not.
      const missing = spawnSync(
        compiler,
        [path.join(shipDir, "no_such_file.ts"), "-o", path.join(shipDir, "nope.ll")],
        { cwd: root, encoding: "utf8" }
      );
      const missingJson = spawnSync(
        compiler,
        [path.join(shipDir, "no_such_file.ts"), "--json", "-o", path.join(shipDir, "nope.ll")],
        { cwd: root, encoding: "utf8" }
      );
      let missingObject = null;
      try {
        missingObject = JSON.parse(missingJson.stdout.trim());
      } catch {}
      check(
        "the self-hosted compiler: an unreadable root exits 1 and --json makes it an object",
        missing.status === 1 &&
          missing.stderr.startsWith("error: cannot open ") &&
          missingJson.status === 1 &&
          missingObject !== null &&
          missingObject.severity === "error" &&
          missingObject.message.startsWith("cannot open "),
        `${missing.status}: ${missing.stderr}json ${missingJson.status}: ${missingJson.stdout}`
      );

      // `--link` on a program with no entry point: stage0 refuses it before it
      // emits anything, with exit 1 and a message naming what to declare.
      // Reaching clang instead costs a link and answers `undefined reference
      // to main` with exit 3.
      const noMain = spawnSync(
        compiler,
        ["tests/link/no_main/main.ts", "--link", path.join(shipDir, "no_main"), "--profile", "debug"],
        { cwd: root, encoding: "utf8" }
      );
      const noMain0 = spawnSync(
        "node",
        [cli, "tests/link/no_main/main.ts", "--link", path.join(shipDir, "no_main0")],
        { cwd: root, encoding: "utf8" }
      );
      check(
        "the self-hosted compiler: --link without `export const main` is refused, as stage0 refuses it",
        noMain.status === 1 &&
          noMain.stderr.includes("export const main") &&
          noMain0.status === 1 &&
          noMain0.stderr.includes("export const main"),
        `stage1 ${noMain.status}: ${noMain.stderr}stage0 ${noMain0.status}: ${noMain0.stderr}`
      );

      // An unknown profile refused before the compile rather than after it, as
      // stage0 validates `PROFILES` before it reads a file.
      const badProfile = spawnSync(
        compiler,
        ["examples/hello.ts", "--link", path.join(shipDir, "bad"), "--profile", "turbo"],
        { cwd: root, encoding: "utf8" }
      );
      check(
        "the self-hosted compiler: an unknown --profile is refused before anything is compiled",
        badProfile.status === 2 && badProfile.stderr.includes("unknown profile"),
        `${badProfile.status}: ${badProfile.stdout}${badProfile.stderr}`
      );

      // `-o <dir>/` writes into the directory it was given; it does not empty
      // it first: `-o build/` must not take the rest of `build/` with it.
      const keepDir = path.join(shipDir, "keep");
      fs.mkdirSync(keepDir, { recursive: true });
      fs.writeFileSync(path.join(keepDir, "keep.txt"), "not the compiler's\n");
      const keep = spawnSync(
        compiler,
        ["examples/hello.ts", "-o", `${keepDir}/`],
        { cwd: root, encoding: "utf8" }
      );
      check(
        "the self-hosted compiler: -o <dir>/ writes into the directory, it does not clear it",
        keep.status === 0 &&
          fs.existsSync(path.join(keepDir, "keep.txt")) &&
          fs.existsSync(path.join(keepDir, "hello.ll")),
        `${keep.status}: ${keep.stdout}${keep.stderr}`
      );

      // ---- The three things §7a listed as still stage0's, closed. -----------

      // `-o <dir>` for a directory that is already there, without the trailing
      // slash: stage0 stats the path, and so does this now (`isDirectorySync`,
      // WP14 §7a). The slash still names a directory that does not exist yet,
      // so both spellings are checked, and a name that is *not* a directory
      // must still be taken as a file.
      const statDir = path.join(shipDir, "stat");
      fs.mkdirSync(statDir, { recursive: true });
      const intoDir = spawnSync(compiler, ["examples/hello.ts", "-o", statDir], {
        cwd: root,
        encoding: "utf8",
      });
      const asFile = path.join(shipDir, "stat_file.ll");
      const intoFile = spawnSync(compiler, ["examples/hello.ts", "-o", asFile], {
        cwd: root,
        encoding: "utf8",
      });
      check(
        "the self-hosted compiler: -o <existing dir> without the slash is the directory, as stage0 stats it",
        intoDir.status === 0 &&
          fs.existsSync(path.join(statDir, "hello.ll")) &&
          intoFile.status === 0 &&
          fs.existsSync(asFile),
        `dir ${intoDir.status}: ${intoDir.stderr}file ${intoFile.status}: ${intoFile.stderr}`
      );

      // `--target host`: the machine answers, through `process.platform` and
      // `process.arch`, and `self/target.ts` composes the triple the way
      // `src/codegen/target.ts` does — so the two compilers must land on the
      // same one. Comparing the whole module rather than the triple line keeps
      // the check honest about the layout string too.
      const ourHost = path.join(shipDir, "host1.ll");
      const theirHost = path.join(shipDir, "host0.ll");
      const hostOurs = spawnSync(compiler, ["examples/hello.ts", "--target", "host", "-o", ourHost], {
        cwd: root,
        encoding: "utf8",
      });
      const hostTheirs = spawnSync("node", [cli, "examples/hello.ts", "--target", "host", "-o", theirHost], {
        cwd: root,
        encoding: "utf8",
      });
      const supportedHost = hostTheirs.status === 0;
      check(
        supportedHost
          ? "the self-hosted compiler: --target host resolves to the triple stage0 resolves it to"
          : "the self-hosted compiler: --target host is refused here exactly as stage0 refuses it",
        supportedHost
          ? hostOurs.status === 0 &&
              stripHeader(fs.readFileSync(ourHost, "utf8")) === stripHeader(fs.readFileSync(theirHost, "utf8"))
          : hostOurs.status === 2 && hostOurs.stderr.includes("supported: host,"),
        `stage1 ${hostOurs.status}: ${hostOurs.stderr}stage0 ${hostTheirs.status}: ${hostTheirs.stderr}`
      );

      // `--emit-ast`, the last flag that was stage0's by name (WP19 R1, §2A).
      // What it prints is deliberately *not* stage0's output: stage0 dumps the
      // `typescript` package's node names and 1-based line:column spans, and
      // this dumps the flattened vocabulary of `self/nodes.ts` with byte
      // offsets, because that is the tree this compiler actually has. So there
      // is no oracle between the two — there is a golden per compiler, over
      // the same input file, and this is stage1's. The check is that the flag
      // is answered (exit 0, no IR written) and that the tree is the one
      // `tests/self/dump_ast.golden` records.
      const astOut = path.join(shipDir, "ast");
      fs.mkdirSync(astOut, { recursive: true });
      const astRun = spawnSync(compiler, ["tests/cases/dump_ast.ts", "--emit-ast", "-o", `${astOut}/`], {
        cwd: root,
        encoding: "utf8",
      });
      const astGoldenFile = path.join(root, "tests", "self", "dump_ast.golden");
      const astGolden = fs.existsSync(astGoldenFile) ? fs.readFileSync(astGoldenFile, "utf8") : "";
      if (process.env.UPDATE_GOLDENS === "1" && astRun.status === 0 && astRun.stdout !== astGolden) {
        fs.writeFileSync(astGoldenFile, astRun.stdout);
      }
      check(
        "the self-hosted compiler: --emit-ast prints its own tree and writes no IR",
        astRun.status === 0 &&
          astRun.stdout === fs.readFileSync(astGoldenFile, "utf8") &&
          fs.readdirSync(astOut).length === 0,
        `${astRun.status}: ${astRun.stderr}--- stdout\n${astRun.stdout}`
      );

      // A broken invariant answers 70 (`EX_SOFTWARE`) and stage0's report,
      // less the two halves a self-hosted compiler honestly has not got: the
      // input files, which live in a `process.argv` that only a program with
      // an entry `main` may read, and the stack, which needs the `try`/`catch`
      // the language does not have. `tests/self/ice.ts` calls the report
      // directly, because an invariant nothing reaches cannot be provoked from
      // a command line, and stage1 builds it, so what prints this is stage1's
      // code compiled by stage1.
      const iceVersion = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
      const iceExe = path.join(shipDir, "ice");
      const iceBuild = spawnSync(compiler, ["tests/self/ice.ts", "--link", iceExe, "--profile", "debug"], {
        cwd: root,
        encoding: "utf8",
      });
      const ice = iceBuild.status === 0 ? spawnSync(iceExe, [], { cwd: root, encoding: "utf8" }) : null;
      check(
        "the self-hosted compiler: an internal error exits 70 and says what it cannot show",
        ice !== null &&
          ice.status === 70 &&
          ice.stderr.startsWith(`nish ${iceVersion}: internal compiler error\n`) &&
          ice.stderr.includes("  emitter: no callee recorded for `f`\n") &&
          ice.stderr.includes("NISH_DEBUG=1 adds nothing") &&
          ice.stderr.includes("This is a bug in nish, not in your program."),
        `${iceBuild.status}: ${iceBuild.stderr}${ice ? `ran ${ice.status}: ${ice.stderr}` : ""}`
      );
    }
  } else {
    // Everything from the lexer oracle down links a stage1 binary, so without
    // clang none of it runs. Say so: the WP14 block is the self-hosting proof,
    // and a run that quietly leaves it out reports the 55 compile-gate passes
    // above as though the fixed point had been checked. WP12 and WP13 print
    // their skip for the same reason.
    skip("clang not installed: the self-hosting oracles and the bootstrap are skipped");
  }
}

// ---- WP9: bench --------------------------------------------------------------------
// The benchmark programs in bench/ must keep printing identical checksums across
// Nish, C and (when rustc is installed) Rust. `bench/run.mjs --validate` builds
// every variant (speed, --nsw, size profile, C, Rust, Rust native) at a small size and
// compares the outputs; nothing is timed. Also: `--target host` pins a module to a
// data layout, so `opt -O2` vectorises it without `-mtriple`, and `--nsw` flags
// every user-level integer add/sub/mul but nothing else.
if (!only || "bench".includes(only) || "wp9".includes(only)) {
  if (HAS_CLANG) {
    const v = spawnSync(
      "node",
      [
        path.join(root, "bench", "run.mjs"),
        "--validate",
        "--only",
        "fib,sieve",
        "--n",
        "fib=25,sieve=100000",
      ],
      { cwd: root, encoding: "utf8" }
    );
    check(
      "bench: fib(25) and sieve(1e5) print the same checksum from Nish, C and Rust (Rust skipped without rustc)",
      v.status === 0 &&
        v.stdout.includes("checksums agree") &&
        v.stdout.includes("fib: 75025") &&
        v.stdout.includes("sieve: 191840"),
      `${v.stdout}${v.stderr}`
    );
  }
  const targetLl = path.join(buildDir, "opt_target_triple.ll");
  if (has("opt") && fs.existsSync(targetLl)) {
    const ir = fs.readFileSync(targetLl, "utf8");
    check(
      "opt_target_triple: module carries target datalayout and triple",
      ir.includes(
        'target datalayout = "e-m:e-p270:32:32-p271:32:32-p272:64:64-i64:64-i128:128-f80:128-n8:16:32:64-S128"'
      ) && ir.includes('target triple = "x86_64-unknown-linux-gnu"'),
      ir.split("\n").slice(0, 5).join("\n")
    );
    const o = spawnSync("opt", ["-O2", "-S", targetLl]); // no -mtriple: the module has one
    check(
      "opt -O2 vectorises opt_target_triple without -mtriple (<4 x i32> or <8 x i32>)",
      o.status === 0 && /<(4|8) x i32>/.test(String(o.stdout)),
      o.status === 0 ? String(o.stdout) : String(o.stderr)
    );
  }
  const hostLl = path.join(buildDir, "opt_target_host.ll");
  const host = spawnSync(
    "node",
    [cli, path.join(casesDir, "opt_target_triple.ts"), "--target", "host", "-o", hostLl],
    { cwd: root, encoding: "utf8" }
  );
  const hostTriple = {
    linux: { x64: "x86_64-unknown-linux-gnu", arm64: "aarch64-unknown-linux-gnu" },
    darwin: { x64: "x86_64-apple-darwin", arm64: "aarch64-apple-darwin" },
  }[process.platform]?.[process.arch];
  if (hostTriple) {
    check(
      `--target host resolves to ${hostTriple} here`,
      host.status === 0 && fs.readFileSync(hostLl, "utf8").includes(`target triple = "${hostTriple}"`),
      host.stderr
    );
  } else {
    check(
      "--target host is rejected on an unsupported host with the supported list",
      host.status === 2 && host.stderr.includes("supported: host,"),
      host.stderr
    );
  }
  const bad = spawnSync(
    "node",
    [
      cli,
      path.join(casesDir, "opt_target_triple.ts"),
      "--target",
      "mips-unknown-elf",
      "-o",
      path.join(buildDir, "opt_target_bad.ll"),
    ],
    { cwd: root, encoding: "utf8" }
  );
  check(
    "--target with an unknown triple is a usage error (exit 2) listing the supported triples",
    bad.status === 2 &&
      bad.stderr.includes("unsupported target `mips-unknown-elf`") &&
      bad.stderr.includes("x86_64-unknown-linux-gnu"),
    bad.stderr
  );
  // WP15 §3: `nsw` is the default, and `opt_nsw.ll` pins exactly which operations
  // carry it. Signedness is not in the LLVM type — a `u32` is an `i32` — so the
  // check is per function: `mix` is the case's unsigned one and must be clean.
  const nswLl = path.join(buildDir, "opt_nsw.ll");
  if (fs.existsSync(nswLl)) {
    const ir = fs.readFileSync(nswLl, "utf8");
    /** The body of `@<name>`, so an op can be attributed to the function that wrote it. */
    const bodyOf = (text, name) => {
      const m = new RegExp(`^define [^\n]*@${name}\\(.*?\\n\\}$`, "ms").exec(text);
      return m ? m[0] : "";
    };
    const signed = ["poly", "sum", "test"].map((n) => bodyOf(ir, n)).join("\n");
    const unsigned = bodyOf(ir, "mix");
    const userOps = [...signed.matchAll(/= (add|sub|mul)( nsw)? i32 /g)];
    const unsignedOps = [...unsigned.matchAll(/= (add|sub|mul)( nsw| nuw)? i32 /g)];
    const internalOps = [...ir.matchAll(/= (add|sub|mul)( nsw)? i64 /g)];
    check(
      `opt_nsw: every user-level signed i32 add/sub/mul carries nsw (${userOps.length} ops), no unsigned one does (${unsignedOps.length} ops), and no internal i64 op does (${internalOps.length} ops)`,
      // Since WP6 stack-allocates the case's arrays there may be no internal i64 arithmetic at all.
      userOps.length >= 10 &&
        userOps.every((m) => m[2] === " nsw") &&
        unsignedOps.length >= 3 &&
        unsignedOps.every((m) => m[2] === undefined) &&
        internalOps.every((m) => m[2] === undefined),
      ir
    );
    // The opt-out: the same source under --wrapping, which must differ in the
    // flags and in nothing else *the flag does not reach*. Since WP15 §2 it
    // reaches one more thing, and honestly: the bounds proof may not carry a
    // lower bound across `i = i + 1` when the wrap is *defined*, because the
    // increment that passes `INT_MAX` then lands on `INT_MIN` rather than being
    // undefined behaviour the compiler may assume away
    // (`src/checker/bounds.ts`). So the counted loop in `sum` keeps the checks
    // the default build proves away, and the two IRs are compared with the
    // checks out of the picture on both sides — where the only difference left
    // is the flag itself.
    const wrapLl = path.join(buildDir, "opt_wrapping.ll");
    if (fs.existsSync(wrapLl)) {
      const src = (name) => path.join(casesDir, `${name}.ts`);
      const buildUnchecked = (name, out, extra) => {
        const r = spawnSync(
          "node",
          [cli, src(name), "-o", path.join(buildDir, out), "--unchecked-indexing", ...extra],
          { cwd: root, encoding: "utf8" }
        );
        return r.status === 0 ? stripHeader(fs.readFileSync(path.join(buildDir, out), "utf8")) : r.stderr;
      };
      const nswBare = buildUnchecked("opt_nsw", "opt_nsw_unchecked.ll", []);
      const wrapBare = buildUnchecked("opt_wrapping", "opt_wrapping_unchecked.ll", ["--wrapping"]);
      check(
        "--wrapping removes every nsw and, with the bounds checks out of both builds, changes nothing else",
        !wrapBare.includes("nsw") && !wrapBare.includes("nuw") && wrapBare === nswBare.split(" nsw").join(""),
        wrapBare
      );
      // The second half of the same story, stated rather than left implicit:
      // the checked `--wrapping` build *does* keep the checks, and the checked
      // default build has none, which is what the flag now costs.
      const wrapIr = stripHeader(fs.readFileSync(wrapLl, "utf8"));
      check(
        "--wrapping costs the lower-bound proof: its counted loops keep the bounds checks the default build removes",
        wrapIr.includes("nish_panic_index") && !stripHeader(ir).includes("nish_panic_index"),
        `wrapping has panic_index: ${wrapIr.includes("nish_panic_index")}, default has: ${stripHeader(ir).includes("nish_panic_index")}`
      );
    }
  }
}

// ---- WP12: exit codes --------------------------------------------------------------
// The CLI's contract (docs/wp12-release.md): 0 ok, 1 compile error, 2 usage, 3 toolchain,
// 70 internal compiler error. Each failure mode is driven from outside the compiler:
// NISH_SIMULATE_ICE=1 is the test hook for the ICE path, an empty PATH stands in
// for a machine without clang, and CC=<stub> makes scripts/build.sh fail after the IR
// was written.
if (!only || "exit-codes".includes(only) || "wp12".includes(only)) {
  const pkgVersion = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
  const wp12Dir = path.join(buildDir, "wp12");
  fs.rmSync(wp12Dir, { recursive: true, force: true });
  fs.mkdirSync(wp12Dir, { recursive: true });
  const run = (args, env = {}) =>
    spawnSync("node", [cli, ...args], { cwd: root, encoding: "utf8", env: { ...process.env, ...env } });
  const entry = path.join(root, "examples", "multi", "main.ts");

  const v = run(["--version"]);
  check(
    `--version prints "nish ${pkgVersion}" and exits 0`,
    v.status === 0 && v.stdout.trim() === `nish ${pkgVersion}`,
    v.stdout + v.stderr
  );

  const noInputs = run([]);
  check(
    "no inputs: usage on stderr, exit 2",
    noInputs.status === 2 && noInputs.stderr.includes("usage: nish"),
    noInputs.stderr
  );

  // `--help` is a request that succeeded and a usage error is a refusal; the
  // two are told apart by the stream and the exit code, so a wrapper -- a
  // script, an editor, an agent -- can ask for the text without reading the
  // run as a failure. `noInputs` above is the other half of this pair.
  const help = run(["--help"]);
  check(
    "--help: usage on stdout, nothing on stderr, exit 0",
    help.status === 0 && help.stdout.includes("usage: nish") && help.stderr === "",
    help.stdout + help.stderr
  );
  const shortHelp = run(["-h"]);
  check(
    "-h: identical to --help",
    shortHelp.status === 0 && shortHelp.stdout === help.stdout,
    shortHelp.stdout + shortHelp.stderr
  );
  check(
    "--help and a usage error print the same text on different streams",
    help.stdout.trim() === noInputs.stderr.trim(),
    `stdout:\n${help.stdout}\nstderr:\n${noInputs.stderr}`
  );
  // Every flag the driver accepts is listed: a wrapper that reads --help to
  // learn the surface must not be missing one.
  const documented = ["--json", "--link", "--emit-header", "--emit-dts", "--emit-napi", "--target", "--profile"];
  const undocumented = documented.filter((f) => !help.stdout.includes(f));
  check(
    `--help lists every advertised flag (${documented.length} checked)`,
    undocumented.length === 0,
    `missing from --help: ${undocumented.join(", ")}`
  );
  const badFlag = run(["--bogus", entry]);
  check(
    "unknown flag: names it, exit 2",
    badFlag.status === 2 && badFlag.stderr.includes("unknown option: --bogus"),
    badFlag.stderr
  );
  const noValue = run([entry, "-o"]);
  check("-o without a value: exit 2", noValue.status === 2, noValue.stderr);

  // Under `--json` every failure is a parseable line, not just the ones with a
  // source span. A wrapper that asked for JSON and got an empty stdout plus a
  // non-zero exit has to scrape stderr to find out what happened, which is the
  // thing `--json` exists to avoid. Band 0 marks what is wrong with the run
  // rather than with the program: NL0002 toolchain, NL0003 internal error.
  const jsonLine = (r) => {
    const first = r.stdout.split("\n").find((l) => l.startsWith("{"));
    try {
      return first ? JSON.parse(first) : null;
    } catch {
      return null;
    }
  };

  const iceJson = run([entry, "--json", "-o", path.join(wp12Dir, "ice_json.ll")], {
    NISH_SIMULATE_ICE: "1",
  });
  const iceObj = jsonLine(iceJson);
  check(
    "--json: an internal compiler error is an NL0003 object on stdout, exit 70, human report still on stderr",
    iceJson.status === 70 &&
      iceObj !== null &&
      iceObj.code === "NL0003" &&
      iceObj.severity === "error" &&
      iceObj.message.includes("internal compiler error") &&
      iceJson.stderr.includes("This is a bug in nish"),
    iceJson.stdout + iceJson.stderr
  );

  const ccJson = run([entry, "--json", "--link", path.join(wp12Dir, "cc_json")], { CC: "/nonexistent-cc" });
  const ccObj = jsonLine(ccJson);
  check(
    "--json: no usable C compiler is an NL0002 object on stdout, exit 3, nothing on stderr",
    ccJson.status === 3 &&
      ccObj !== null &&
      ccObj.code === "NL0002" &&
      ccObj.message.includes("no usable C compiler") &&
      ccJson.stderr === "",
    ccJson.stdout + ccJson.stderr
  );

  const missingJson = run(["does-not-exist.ts", "--json"]);
  const missingObj = jsonLine(missingJson);
  check(
    "--json: an unreadable input is an object on stdout with a code, exit 1",
    missingJson.status === 1 &&
      missingObj !== null &&
      /^NL\d{4}$/.test(missingObj.code) &&
      missingObj.message.includes("ENOENT"),
    missingJson.stdout + missingJson.stderr
  );

  const missing = run(["does-not-exist.ts"]);
  check(
    "missing input file: one-line ENOENT message, exit 1",
    missing.status === 1 &&
      missing.stderr.includes("ENOENT") &&
      !missing.stderr.includes("internal compiler error"),
    missing.stderr
  );

  const ice = run([entry, "-o", path.join(wp12Dir, "ice.ll")], { NISH_SIMULATE_ICE: "1" });
  check(
    "internal error: exit 70, names the file, asks for a bug report, no stack trace",
    ice.status === 70 &&
      ice.stderr.includes("internal compiler error while compiling " + entry) &&
      ice.stderr.includes("TypeError: simulated internal compiler error") &&
      ice.stderr.includes("github.com/amritk/nish/issues") &&
      ice.stderr.includes("NISH_DEBUG=1") &&
      !/^\s+at /m.test(ice.stderr),
    ice.stderr
  );
  const iceDebug = run([entry, "-o", path.join(wp12Dir, "ice.ll")], {
    NISH_SIMULATE_ICE: "1",
    NISH_DEBUG: "1",
  });
  check(
    "internal error with NISH_DEBUG=1: exit 70 and the stack trace is printed",
    iceDebug.status === 70 && /^\s+at /m.test(iceDebug.stderr),
    iceDebug.stderr
  );

  // Machine without clang: PATH holds only an empty dir plus node's own dir (spawnSync needs `node`).
  const emptyBin = path.join(wp12Dir, "empty-bin");
  fs.mkdirSync(emptyBin, { recursive: true });
  const noClang = run([entry, "--link", path.join(wp12Dir, "noclang")], {
    PATH: `${emptyBin}${path.delimiter}${path.dirname(process.execPath)}`,
    CC: "",
  });
  check(
    "--link without clang: install hint per platform, exit 3, no IR written",
    noClang.status === 3 &&
      noClang.stderr.includes("no usable C compiler") &&
      noClang.stderr.includes("apt-get install") &&
      noClang.stderr.includes("brew install") &&
      noClang.stderr.includes("WSL") &&
      !fs.existsSync(path.join(wp12Dir, "noclang.modules")),
    noClang.stderr
  );

  // build.sh failure: a stub compiler that passes the --version probe but cannot link.
  const stub = path.join(wp12Dir, "stub-cc");
  fs.writeFileSync(
    stub,
    '#!/bin/sh\ncase "$1" in --version) exit 0 ;; esac\necho "stub-cc: refusing to link" >&2\nexit 1\n',
    { mode: 0o755 }
  );
  const badBuild = run([entry, "--link", path.join(wp12Dir, "badbuild")], { CC: stub });
  check(
    "--link when build.sh fails: its stderr is shown, the .ll paths are named, exit 3",
    badBuild.status === 3 &&
      badBuild.stderr.includes("stub-cc: refusing to link") &&
      badBuild.stderr.includes("build.sh failed (exit 1)") &&
      badBuild.stderr.includes("main.ll") &&
      fs.existsSync(path.join(wp12Dir, "badbuild.modules", "main.ll")),
    badBuild.stderr
  );
}

// ---- WP16: the ambient declarations -------------------------------------------------
// `runtime/nish.d.ts` is what makes an Nish program legal TypeScript to
// `tsc` and to an editor, not just to this compiler's parser. The claim is only
// worth what it is tested against, so:
//   - the file itself type-checks under --strict;
//   - every `res_*` case type-checks against it, which is the whole `Result`
//     surface (`Result<T, E>`, `Ok`/`Err`, `isOk`/`isErr`, `value`/`error`,
//     `orReturn`/`unwrapOr`/`expect`) plus `i32`, `console` and `parseInt`;
//   - `reject_result_value_unchecked` is refused by tsc *as well*, which is the
//     one that proves the declarations model the narrowing rather than just the
//     names: a `.d.ts` that typed `value` as always present would pass it.
if (!only || "ambient".includes(only) || "dts".includes(only)) {
  const ambientDir = path.join(buildDir, "ambient");
  fs.mkdirSync(ambientDir, { recursive: true });
  let tscBin = path.join(root, "node_modules", "typescript", "bin", "tsc");
  try {
    tscBin = require.resolve("typescript/bin/tsc");
  } catch {}
  const declarations = path.join(root, "runtime", "nish.d.ts");
  /** Type-check `files` against the ambient declarations with a project of their own. */
  const typeCheck = (name, files) => {
    const config = path.join(ambientDir, `tsconfig.${name}.json`);
    fs.writeFileSync(
      config,
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          target: "ES2022",
          lib: ["ES2022"],
          types: [],
          moduleDetection: "force",
        },
        files: [declarations, ...files],
      })
    );
    const r = spawnSync("node", [tscBin, "-p", config], { cwd: root, encoding: "utf8" });
    return { ok: r.status === 0, output: `${r.stdout}${r.stderr}` };
  };

  const own = typeCheck("self", []);
  check("runtime/nish.d.ts type-checks under tsc --strict", own.ok, own.output);

  const resultCases = fs
    .readdirSync(casesDir)
    .filter((f) => f.startsWith("res_") && f.endsWith(".ts"))
    .map((f) => path.join(casesDir, f));
  const accepted = typeCheck("cases", resultCases);
  check(
    `tsc accepts every res_* case against the ambient declarations (${resultCases.length} cases)`,
    accepted.ok,
    accepted.output
  );

  const unchecked = path.join(casesDir, "reject_result_value_unchecked.ts");
  const refused = typeCheck("narrowing", [unchecked]);
  check(
    "tsc refuses `r.value` before the discriminant test, exactly as nish does",
    !refused.ok && refused.output.includes("Property 'value' does not exist"),
    refused.output
  );

  // The declarations claim a direction, not a coincidence: a program nish
  // accepts should never be one tsc refuses. `res_*` above tests that claim on
  // the `Result` surface; this tests it on every accepted case there is, which
  // is the whole language. One case is listed because the divergence is real
  // and documented, not because the declarations are missing something. The
  // second went with inheritance (WP25): an implicit `super()` was the only
  // place an accepted program did something JavaScript would throw on.
  const AMBIENT_DIVERGENCES = new Map([
    [
      "arr_typed_views.ts",
      // `Int32Array` and friends name the element-typed array here and the JS
      // view in lib.es5; redeclaring them would break every other lib type.
      "typed-array aliases (see the note at the foot of runtime/nish.d.ts)",
    ],
    [
      "arr_struct_push_copy.ts",
      // The `pop` divergence the declarations already document (the note at
      // runtime/nish.d.ts, and the `self/` check below, which strips the same
      // error): `a.pop()` is `T` here because an empty array panics, and
      // `T | undefined` in lib.es5, so reading a field of the popped element
      // is TS18048 and nothing this side can say changes that. The case reads
      // one because a popped *record* is the slot that was dropped, which is
      // the interior pointer WP15 §2a is about.
      "`pop` is `T` here and `T | undefined` in lib.es5 (see runtime/nish.d.ts)",
    ],
  ]);
  const acceptedCases = fs
    .readdirSync(casesDir)
    .filter((f) => f.endsWith(".ts") && !f.startsWith("reject_") && !AMBIENT_DIVERGENCES.has(f));
  const everyCase = typeCheck("accepted", acceptedCases.map((f) => path.join(casesDir, f)));
  check(
    `tsc accepts every case nish accepts, against the ambient declarations (${acceptedCases.length} cases, ${AMBIENT_DIVERGENCES.size} documented divergences)`,
    everyCase.ok,
    everyCase.output
  );

  // And on the largest Nish program there is: the compiler itself.
  const selfDir = path.join(root, "self");
  const selfModules = fs
    .readdirSync(selfDir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => path.join(selfDir, f));
  const selfCheck = typeCheck("stage1", selfModules);
  // `a.pop()` is `T` here and `T | undefined` in lib.es5 (the foot of
  // runtime/nish.d.ts says why it stays that way), so the one call in
  // `self/checker.ts` that pops without a null check is the only diagnostic
  // this may report. Anything else is a hole in the declarations.
  const selfErrors = selfCheck.output
    .split("\n")
    .filter((line) => line.includes(": error TS"));
  // `selfCheck.ok` has to be part of the predicate: a tsc that fell over before
  // it checked anything (a bad config, TS18003, a spawn failure) produces no
  // `error TS` lines at all, and `[].every(...)` is `true` — a check that passes
  // by having tested nothing. So: either tsc was clean, or the only things it
  // said are the one divergence the declarations document.
  const isPopDivergence = (line) =>
    line.includes("TS2345") && line.includes("| undefined") && line.includes("self/checker.ts");
  check(
    `tsc accepts self/ against the ambient declarations, bar the documented \`pop\` divergence (${selfModules.length} modules)`,
    selfCheck.ok || (selfErrors.length > 0 && selfErrors.every(isPopDivergence)),
    selfCheck.output
  );

  // And on the library and the programs written on it. `std/` is the code a user
  // *imports* and `tests/nish/` is what a user's own harness looks like, so the
  // claim these declarations make — a program nish accepts is never one tsc
  // refuses — is worth as much here as on the corpus, and an editor open on
  // `std/testing.ts` is how most people will meet it. They are one project
  // because they import each other.
  const libraryModules = [
    ...fs
      .readdirSync(path.join(root, "std"))
      .filter((f) => f.endsWith(".ts"))
      .map((f) => path.join(root, "std", f)),
    ...fs
      .readdirSync(path.join(root, "tests", "nish"))
      .filter((f) => f.endsWith(".ts"))
      .map((f) => path.join(root, "tests", "nish", f)),
  ];
  const library = typeCheck("library", libraryModules);
  check(
    `tsc accepts std/ and the harnesses written on it against the ambient declarations (${libraryModules.length} modules)`,
    library.ok,
    library.output
  );
}

// ---- docs/AI.md: the rules card compiles ---------------------------------------------
// `docs/AI.md` is the language written for a model that has to produce a program
// that compiles on the first try, so its examples are the part that matters: an
// agent copies them. A digest hand-written beside a 2,300-line reference is also
// exactly the kind of document that rots, and a stale example is worse than no
// example -- it teaches a rule the compiler no longer has.
//
// So every fenced block the doc marks is compiled here, and the marker says what
// must happen:
//
//   ```ts nish:ok                 compiles, exit 0
//   ```ts nish:ok-body            the same, wrapped in a `main` body
//   ```ts nish:err NL2231         must be rejected, with that code among the errors
//   ```ts nish:err-body NL2188    the same, wrapped in a `main` body
//
// Anything after the code is passed to the CLI as flags (`--number-mode f64`).
// A plain ```ts block is prose and is not compiled, which is what lets the doc
// show a fragment. The expectation is the *code* rather than the message,
// because that is what the doc tells its reader to key on (`AGENTS.md`,
// "Machine-readable surfaces"): a reworded message must not fail this, and a
// renumbered rule must.
if (!only || "docs".includes(only) || "ai".includes(only)) {
  const aiDoc = path.join(root, "docs", "AI.md");
  const snippetDir = path.join(buildDir, "docs-ai");
  fs.rmSync(snippetDir, { recursive: true, force: true });
  fs.mkdirSync(snippetDir, { recursive: true });

  /** Fenced blocks of `docs/AI.md` that carry a `nish:` marker, with the line they start on. */
  const markedSnippets = (text) => {
    const found = [];
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = /^```ts\s+nish:(ok|err)(-body)?\s*(.*)$/.exec(lines[i]);
      if (!m) continue;
      const rest = m[3].trim().split(/\s+/).filter(Boolean);
      const code = m[1] === "err" ? rest.shift() : null;
      let end = i + 1;
      while (end < lines.length && lines[end] !== "```") end++;
      found.push({
        kind: m[1],
        wrap: m[2] === "-body",
        code,
        args: rest,
        line: i + 1,
        source: lines.slice(i + 1, end).join("\n"),
      });
      i = end;
    }
    return found;
  };

  const snippets = markedSnippets(fs.readFileSync(aiDoc, "utf8"));
  // A doc whose markers all got renamed would otherwise pass by checking nothing.
  check("docs/AI.md marks its examples for compilation", snippets.length >= 15, `${snippets.length} found`);
  for (const s of snippets) {
    const stem = `ai_${s.line}`;
    const file = path.join(snippetDir, `${stem}.ts`);
    const body = s.wrap
      ? `export const main = (): i32 => {\n${s.source}\n  return 0;\n};\n`
      : `${s.source}\n`;
    fs.writeFileSync(file, body);
    const run = spawnSync("node", [cli, file, "--json", "-o", path.join(snippetDir, `${stem}.ll`), ...s.args], {
      encoding: "utf8",
    });
    const diagnostics = run.stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const errors = diagnostics.filter((d) => d.severity === "error");
    const detail = errors.map((e) => `${e.code} ${e.message}`).join("\n");
    if (s.kind === "ok") {
      check(`docs/AI.md:${s.line} compiles`, run.status === 0, detail || run.stderr);
    } else {
      check(
        `docs/AI.md:${s.line} is rejected with ${s.code}`,
        run.status !== 0 && errors.some((e) => e.code === s.code),
        run.status === 0 ? "it compiled" : detail || run.stderr
      );
    }
  }
}

// ---- WP12: package ------------------------------------------------------------------
// The npm tarball must be self-contained: `npm pack`, install it into a temporary prefix,
// and drive the installed `nish` from an unrelated directory. That proves the `files`
// whitelist ships both runtime translation units, runtime/nish.h and scripts/build.sh,
// and that the
// CLI resolves them from its own package root rather than from the cwd.
if (!only || "package".includes(only) || "wp12".includes(only)) {
  const pkgDir = path.join(buildDir, "wp12-package");
  fs.rmSync(pkgDir, { recursive: true, force: true });
  fs.mkdirSync(pkgDir, { recursive: true });
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const pack = spawnSync(npm, ["pack", "--json", "--pack-destination", pkgDir], {
    cwd: root,
    encoding: "utf8",
  });
  check("npm pack succeeds", pack.status === 0, pack.stderr);
  if (pack.status === 0) {
    const info = JSON.parse(pack.stdout)[0];
    const files = info.files.map((f) => f.path).sort();
    const allowed = [
      /^dist\//,
      /^runtime\//,
      /^scripts\//,
      /^std\//,
      /^README\.md$/,
      /^LICENSE$/,
      /^llms\.txt$/,
      /^docs\/AI\.md$/,
      /^docs\/INSTALL\.md$/,
      /^package\.json$/,
      /^CHANGELOG\.md$/,
    ];
    const stray = files.filter((f) => !allowed.some((re) => re.test(f)));
    check(
      `npm pack ships only the whitelisted paths (${files.length} files)`,
      stray.length === 0,
      stray.join("\n")
    );
    const required = [
      "dist/index.js",
      "dist/version.js",
      "runtime/runtime.c",
      // The runtime is two translation units since the operating-system half was
      // split out for its own size budget, and `--link` compiles both. A tarball
      // with only the core would install a compiler that cannot link any program
      // that reads a file.
      "runtime/runtime_os.c",
      "runtime/nish.h",
      "runtime/nish.d.ts",
      "runtime/nish.mjs",
      "scripts/build.sh",
      // The standard library is source, so shipping it *is* shipping the library
      // (wp21 §2). A tarball without it would install a compiler whose `std/`
      // imports cannot resolve.
      "std/testing.ts",
      "std/README.md",
      "LICENSE",
      // An agent writing Nish reads what is on disk beside the compiler it is
      // driving, so the rules card and the llms.txt index ship with it: an
      // install is then self-describing, with no network fetch and no version
      // skew between the compiler and the rules it is documented by.
      "llms.txt",
      "docs/AI.md",
      "docs/INSTALL.md",
    ];
    const absent = required.filter((f) => !files.includes(f));
    check(
      "npm pack includes everything --link and `node --import` need (runtime.c, runtime_os.c, nish.h, nish.d.ts, nish.mjs, build.sh) plus std/, LICENSE, llms.txt, AI.md and INSTALL.md",
      absent.length === 0,
      absent.join("\n")
    );
    // Every module of the library, and not a list of them: `files` in package.json
    // names the whole directory, so a new module ships without anybody saying so —
    // and a `files` entry narrowed later would take it back out just as quietly.
    // Asking the tree rather than a written list is the assertion that cannot go
    // stale (wp26 §7 question 6).
    const stdModules = fs
      .readdirSync(path.join(root, "std"))
      .filter((f) => f.endsWith(".ts"))
      .map((f) => `std/${f}`)
      .sort();
    const unshipped = stdModules.filter((f) => !files.includes(f));
    check(
      `npm pack ships every std/ module in the tree (${stdModules.length}: ${stdModules.join(", ")})`,
      stdModules.length > 0 && unshipped.length === 0,
      unshipped.join("\n")
    );
    for (const f of [
      "src/index.ts",
      "tests/run.js",
      "examples/add.ts",
      ".github/workflows/ci.yml",
      "docs/MASTER_PLAN.md",
    ]) {
      check(`npm pack excludes ${f}`, !files.includes(f));
    }

    if (!HAS_CLANG) {
      skip("package install + --link from another cwd (clang not found)");
    } else {
      const tarball = path.join(pkgDir, info.filename);
      const prefix = path.join(pkgDir, "prefix");
      const install = spawnSync(
        npm,
        [
          "install",
          "--prefix",
          prefix,
          "--no-audit",
          "--no-fund",
          "--prefer-offline",
          "--ignore-scripts",
          tarball,
        ],
        { cwd: pkgDir, encoding: "utf8" }
      );
      check(
        "npm install <tarball> --prefix <tmp> succeeds",
        install.status === 0,
        install.stdout + install.stderr
      );
      if (install.status === 0) {
        const bin = path.join(prefix, "node_modules", ".bin", "nish");
        const work = path.join(pkgDir, "elsewhere");
        fs.mkdirSync(work, { recursive: true });
        fs.writeFileSync(
          path.join(work, "hello.ts"),
          'export function main(): number {\n  console.log("hello from a global install");\n  return 0;\n}\n'
        );
        const ver = spawnSync(bin, ["--version"], { cwd: work, encoding: "utf8" });
        check(
          "installed nish --version works from an unrelated cwd",
          ver.status === 0 && ver.stdout.trim() === `nish ${info.version}`,
          ver.stdout + ver.stderr
        );
        const link = spawnSync(bin, ["hello.ts", "--link", "hello"], { cwd: work, encoding: "utf8" });
        check(
          "installed nish hello.ts --link works from an unrelated cwd",
          link.status === 0 && fs.existsSync(path.join(work, "hello")),
          link.stderr
        );
        if (link.status === 0) {
          const hello = spawnSync(path.join(work, "hello"), [], { cwd: work, encoding: "utf8" });
          check(
            "the binary linked by the installed package runs",
            hello.status === 0 && hello.stdout.trim() === "hello from a global install",
            hello.stdout + hello.stderr
          );
        }
        const ir = spawnSync(bin, [path.join(root, "examples", "add.ts"), "-o", path.join(work, "add.ll")], {
          cwd: work,
          encoding: "utf8",
        });
        check(
          "installed nish compiles examples/add.ts to IR from an unrelated cwd",
          ir.status === 0 && fs.existsSync(path.join(work, "add.ll")),
          ir.stderr
        );
      }
    }
  }
}

// ---- WP12: changelog ----------------------------------------------------------------
// The release notes are generated from the commits, so what the generator keeps and what
// it drops is a released artifact rather than a convenience. Driven against a throwaway
// repository whose log is known: a conventional commit, one that predates the convention,
// and a branch merged rather than squashed -- which is where the noise came from, because
// every work-in-progress commit behind the merge used to become an entry of its own.
if (!only || "changelog".includes(only) || "wp12".includes(only)) {
  const gen = path.join(root, "scripts", "changelog-gen.mjs");
  const repo = path.join(buildDir, "wp12-changelog");
  fs.rmSync(repo, { recursive: true, force: true });
  fs.mkdirSync(repo, { recursive: true });
  const g = (...args) =>
    spawnSync("git", args, {
      cwd: repo,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "T",
        GIT_AUTHOR_EMAIL: "t@example.com",
        GIT_COMMITTER_NAME: "T",
        GIT_COMMITTER_EMAIL: "t@example.com",
        GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
        GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z",
      },
    });
  /** Make a commit and return its sha, so a range can name it rather than guess it. */
  const commit = (message) => {
    fs.appendFileSync(path.join(repo, "f.txt"), `${message}\n`);
    g("add", "-A");
    g("commit", "-m", message);
    return g("rev-parse", "HEAD").stdout.trim();
  };

  g("init", "-q", "-b", "main");
  const feat = commit("feat(cli): accept a second input file");
  const wip = commit("wip: still poking at it");
  g("checkout", "-q", "-b", "side");
  commit("fix(codegen): widen the index before the bounds check");
  // A squash merge's subject ends in `(#N)` and its body is the prose. The
  // record keeps that prose; the rendered index does not, and links the pull
  // request instead -- which is the pair the checks below pin.
  commit(
    "perf(codegen): hoist the array header out of element loops (#12)\n\n" +
      "The header load moved out of the loop, so the body indexes a register.\n\n" +
      "Measured: 1.58x on an element loop\n"
  );
  commit("more wip");
  g("checkout", "-q", "main");
  const merge = g("merge", "--no-ff", "-m", "Merge branch 'side'", "side");
  check("changelog fixture: the throwaway repository builds", merge.status === 0, merge.stderr);

  // The generator walks the log of the repository it lives in, so it is copied beside the
  // fixture: `--from`/`--to` choose a range, never a repository.
  const genDir = path.join(repo, "scripts");
  fs.mkdirSync(genDir, { recursive: true });
  fs.copyFileSync(gen, path.join(genDir, "changelog-gen.mjs"));
  fs.writeFileSync(
    path.join(repo, "package.json"),
    `${JSON.stringify(
      { name: "fixture", version: "0.1.0", repository: { type: "git", url: "git+https://github.com/n/fix.git" } },
      null,
      2
    )}\n`
  );
  fs.writeFileSync(path.join(repo, "CHANGELOG.md"), "# Changelog\n\n## [Unreleased]\n");
  const run = (...args) =>
    spawnSync(process.execPath, [path.join(genDir, "changelog-gen.mjs"), ...args], {
      cwd: repo,
      encoding: "utf8",
    });

  const md = run("--version", "0.1.0");
  check("changelog: the generator succeeds over the fixture", md.status === 0, md.stderr);
  const headings = [...md.stdout.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
  check(
    "changelog: only the conventional commits become entries",
    headings.join(",") === "Added,Fixed,Performance",
    `headings: ${headings.join(", ") || "(none)"}\n${md.stdout}`
  );

  // The rendered notes are an index, not the prose: one line per change, the
  // title and a link to where the rest is. The body still has to survive into
  // the JSON, which is what the website renders, so both halves are checked --
  // a renderer that dropped the prose from the record would pass the first.
  const bullets = md.stdout.split("\n").filter((l) => l.startsWith("- "));
  check(
    "changelog: an entry renders as one line, its title and its pull request",
    bullets.length === 3 &&
      bullets.includes(
        "- codegen: Hoist the array header out of element loops ([#12](https://github.com/n/fix/pull/12))"
      ),
    bullets.join("\n") || "(no entries)"
  );
  check(
    "changelog: an entry that landed without a pull request links its commit",
    /^- cli: Accept a second input file \(\[`[0-9a-f]{7}`\]\(https:\/\/github\.com\/n\/fix\/commit\/[0-9a-f]{7}\)\)$/m.test(
      md.stdout
    ),
    md.stdout
  );
  check(
    "changelog: the commit body and its Measured: number stay out of the rendered index",
    !md.stdout.includes("indexes a register") && !md.stdout.includes("1.58x"),
    md.stdout
  );
  const record = run("--version", "0.1.0", "--stdout", "json");
  const entry = JSON.parse(record.stdout).entries.find((e) => e.pr === 12);
  check(
    "changelog: the record keeps the prose and the number the index leaves out",
    entry !== undefined &&
      entry.body.includes("indexes a register") &&
      entry.metrics.includes("1.58x on an element loop"),
    record.stdout
  );
  check(
    "changelog: the rendered notes open with a heading and end in one newline",
    md.stdout.startsWith("### ") && md.stdout.endsWith("\n") && !md.stdout.endsWith("\n\n"),
    JSON.stringify(md.stdout.slice(0, 40))
  );

  // The release pull request pastes those notes under a `---` rule, and `$(...)`
  // eats trailing newlines: appending the notes to a preamble that ends in the
  // rule is what rendered `---### Fixed` as one line of literal text. The fix is
  // structural -- the notes are an argument to the one printf that writes the
  // blank lines -- so that is what is checked, in the workflow rather than here.
  const trainYml = fs.readFileSync(path.join(root, ".github", "workflows", "release-pr.yml"), "utf8");
  check(
    "changelog: the release pull request separates the `---` rule from the notes it pastes",
    /\\n\\n---\\n\\n%s/.test(trainYml) && !/body="\$body\$\(/.test(trainYml),
    trainYml
      .split("\n")
      .filter((l) => l.includes("---") || l.includes("body="))
      .join("\n")
  );
  check(
    "changelog: the merge commit and the work-in-progress commits are not entries",
    !/wip|Merge branch/i.test(md.stdout),
    md.stdout
  );
  check(
    "changelog: every skipped subject is named on stderr, so nothing goes missing quietly",
    md.stderr.includes("skipped 2 commits") &&
      md.stderr.includes("wip: still poking at it") &&
      md.stderr.includes("more wip"),
    md.stderr
  );

  const all = run("--version", "0.1.0", "--include-unconventional");
  const allHeadings = [...all.stdout.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
  check(
    "changelog: --include-unconventional files the rest under Uncategorised",
    all.status === 0 && allHeadings.join(",") === "Added,Fixed,Performance,Uncategorised",
    `headings: ${allHeadings.join(", ")}\n${all.stderr}`
  );

  // The negative: a range whose commits all predate the convention is an error rather than
  // an empty release section, because a silently empty set of notes is the failure mode
  // the filter could otherwise introduce.
  const none = run("--version", "0.1.0", "--from", feat, "--to", wip);
  check(
    "changelog: a range with no conventional commit fails rather than rendering nothing",
    none.status === 1 && /no commit in .* carries a conventional subject/.test(none.stderr),
    `exit ${none.status}\n${none.stderr}`
  );

  const bad = run("--check-subject", "Add arrays");
  const ok = run("--check-subject", "perf(codegen)!: hoist the array header");
  check(
    "changelog: --check-subject is the same rule pr-title.yml enforces",
    bad.status === 1 && ok.status === 0,
    `bad exit ${bad.status}, ok exit ${ok.status}\n${bad.stderr}${ok.stderr}`
  );
}

// ---- WP22 x WP13: the two spellings of a function ------------------------------------
// `tests/differential/arrow-parity.js` rewrites one program written both ways --
// `function f() { ... }` and `const f = () => { ... }` -- and compares the JavaScript
// modulo the declaration syntax. They are the same program, so the rewrite owes them the
// same output; it did not, from WP22 until 2806854, and the symptom was a body that
// reached Node with JavaScript's own `console.log` in it, printing something close
// enough to pass while measuring nothing. The runner's own header says why the
// comparison is honest and how to point it at the pre-fix rewrite. Nothing here is
// compiled or run, so this needs no toolchain and does not belong under the clang gate
// below.
if (!only || "differential".includes(only) || "arrow-parity".includes(only)) {
  const ap = spawnSync("node", [path.join(import.meta.dirname, "differential", "arrow-parity.js")], {
    cwd: root,
    encoding: "utf8",
  });
  const summary = (ap.stdout.match(/^arrow-parity: .*\(([^)]*)\)/m) ?? [])[1] ?? "";
  check(
    `differential: an arrow-declared program and its \`function\` twin rewrite identically (${summary || "no summary"})`,
    ap.status === 0,
    ap.stdout + ap.stderr
  );
}

// ---- WP13: differential -------------------------------------------------------------
// Every whole program in tests/cases and tests/differential/corpus is compiled, linked,
// and run natively, then rewritten to JavaScript (tests/differential/rewrite.js, types
// from the compiler's own checker) and run under Node with runtime/shim.mjs; stdout and
// exit status must agree byte for byte. Discrepancies listed in known-failures.txt are
// reported but do not fail. A 10-program fuzz batch with a fixed seed runs too; the seed
// is printed so a failure reproduces with `node tests/differential/fuzz.js --seed <s> --count 1`.
if ((!only || "differential".includes(only)) && HAS_CLANG) {
  const diffRunner = path.join(import.meta.dirname, "differential", "run.js");
  const d = spawnSync("node", [diffRunner, "--quick"], { cwd: root, encoding: "utf8" });
  const summary = (
    d.stdout
      .trim()
      .split("\n")
      .filter((l) => l.includes("programs agree with Node"))
      .pop() ?? ""
  ).trim();
  check(
    `differential: native and Node agree on every corpus program not in known-failures.txt (${summary || "no summary"})`,
    d.status === 0,
    d.stdout + d.stderr
  );

  // The smaller, unrewritten claim beside it: an f64-mode program run as the
  // TypeScript it is, under `node --experimental-strip-types` with
  // runtime/nish.mjs supplying the globals Node lacks. Nothing is
  // rewritten, so only the divergences listed in the runner may differ — they
  // live in the operators and the object model, where a prelude cannot reach.
  // docs/RUN_UNDER_NODE.md states the overlap.
  const u = spawnSync("node", [path.join(import.meta.dirname, "differential", "unmodified.js")], {
    cwd: root,
    encoding: "utf8",
  });
  check(
    `differential: f64 programs agree with unmodified Node (${u.stdout.trim() || "no summary"})`,
    u.status === 0,
    u.stdout + u.stderr
  );

  const fuzzSeed = 20260906;
  const f = spawnSync(
    "node",
    [path.join(import.meta.dirname, "differential", "fuzz.js"), "--seed", String(fuzzSeed), "--count", "10"],
    { cwd: root, encoding: "utf8" }
  );
  const fuzzSummary =
    f.stdout
      .trim()
      .split("\n")
      .filter((l) => l.startsWith("fuzz: seed="))
      .pop() ?? "";
  check(
    `differential: 10 fuzz programs agree with Node (${fuzzSummary || `seed=${fuzzSeed}`})`,
    f.status === 0,
    f.stdout + f.stderr
  );
} else if (!HAS_CLANG) {
  skip("clang not installed: differential tests skipped");
}

// The summary counts what did *not* run as well as what did. A skip is not a
// failure -- a contributor without LLVM is meant to be able to run this -- but
// it is also not a pass, and the difference decides how much a green run is
// worth. `.claude/orientation.md` and `.claude/node.md` say so in prose; this
// says it in the output, where it is read.
const summary = [`${passes} passed`, `${failures} failed`];
if (skipped.length > 0) summary.push(`${skipped.length} skipped`);
console.log(`\n${summary.join(", ")}.`);

if (skipped.length > 0) {
  const TOOLCHAIN = ["clang", "llc", "llvm-as", "opt", "ld.lld", "wasm-ld"];
  const absent = TOOLCHAIN.filter((tool) => !has(tool));
  console.log(
    absent.length > 0
      ? `\nDEGRADED: ${absent.length} of the ${TOOLCHAIN.length} LLVM 18 tools are missing (${absent.join(", ")}), so ` +
          `${skipped.length} section(s) were skipped rather than run. This result does NOT prove the toolchain-dependent\n` +
          "checks pass: assembly, native round trips, linking, the interop addons, the self-hosting oracles and the\n" +
          "differential suite are among them. Install LLVM 18 (docs/INSTALL.md) and run again before trusting a green run."
      : `\nNote: ${skipped.length} section(s) were skipped for reasons other than a missing LLVM toolchain ` +
          "(see the SKIP lines above); everything they cover is unproven by this run."
  );
}

process.exit(failures === 0 ? 0 : 1);
