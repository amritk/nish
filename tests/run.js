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
 *     Every case is compiled by stage1 -- `self/` built by the seed into
 *     `build/nish-test` once per run -- one process per case, `defaultJobs()` at
 *     a time (tests/pool.js). The link is against the runtime and the driver as
 *     object files, built once per run (`runtimeObjects`) rather than
 *     recompiled per case; the `runtime objects:` checks at the end of the run
 *     are what say that is the same link.
 *
 *  B. Pipeline checks: the runtime unit test, inline allocator vs C arena layout
 *     (linked for the host, and asserted per target so wasm32 cannot drift),
 *     size and wasm build profiles, Node wasm host, and the browser harness in
 *     web/ compiling with the compiler's own wasi build.
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { parseCodesRegistry } from "../scripts/codes-registry.js";
import { linkWith, resolveSeed, seedForOracle, spawnSeed, withoutSeed } from "./self/seed.js";
import { defaultJobs, pool, run as spawnAsync } from "./pool.js";
import { programs as corpusPrograms } from "./self/corpus.js";
import { cwdFor } from "./differential/lib.js";
import { packageRootOf, selfCheckNotes, selfCheckRoots, selfCheckVersions, withoutOwnRoot } from "./nish-cmp.js";
import { rewrite as arrowify } from "../scripts/arrowify.mjs";
import { copyInto, diagnosticWords, diffEmitted, presentInTree, sitsOnChange, verdict } from "../scripts/arrow-verify.mjs";
const require = createRequire(import.meta.url);

const root = path.resolve(import.meta.dirname, "..");
/**
 * The compiler under test: stage1, `self/` linked by the seed once per run,
 * and every compile in this file is a spawn of it.
 *
 * Where it lives is part of what it is. `self/compile.ts` finds its package
 * root -- `scripts/build.sh` for `--link`, `std/` for a `nish/<module>` import
 * -- by climbing one directory from its own `argv[0]` (`packageRoot`), so the
 * binary has to sit one level below the repository root. Under `build/test/`
 * it would find no package and fall back to the working directory, which the
 * checks that run it from inside a fixture's tree would then be testing
 * instead of the compiler.
 */
const NISH = path.join(root, "build", "nish-test");
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
const RUNTIME_C = ["runtime/runtime.c", "runtime/runtime_os.c", "runtime/runtime_parallel.c"];

/** The driver every case without its own `.c` and without an `export main` is linked with. */
const DRIVER_C = path.join(root, "tests", "driver.c");

/**
 * The C a case is linked against -- `runtime.c`, `runtime_os.c` and the shared
 * driver -- compiled to object files once per run instead of once per case.
 *
 * The measurement, on a four-core Linux box: naming the three sources in a
 * case's link costs 470 ms, linking the same module against prebuilt objects
 * costs 91 ms, and building the objects costs 362 ms once. Over the 183 cases
 * that carry a `.out` that is the difference between 86 s of clang and 17 s.
 *
 * **`defines` is the cache key, and it is the whole of what can make one case
 * need a differently built runtime.** Today that is `-DNISH_THREADS=1` alone,
 * which moves `nish_arena` into thread-local storage. A wrong-but-fast link
 * would be worse than a slow one, so the key is checked rather than trusted,
 * in the two `runtime objects:` checks after section A: one relinks a case from
 * the sources and requires the same bytes out, and one requires a `--threads`
 * module linked against the *default* objects to **fail**. It does — `ld`
 * refuses a TLS reference against a non-TLS definition — so a case handed the
 * wrong objects is a red line rather than a program with two arenas.
 *
 * Nothing here survives a run. The objects are built on their first use in each
 * process, so a `runtime.c` edited between runs can never be linked against the
 * object a previous run left behind.
 */
const runtimeObjectCache = new Map();
const runtimeObjects = (defines) => {
  const key = defines.join(" ");
  const cached = runtimeObjectCache.get(key);
  if (cached !== undefined) return cached;
  const dir = path.join(buildDir, "runtime-obj", key.replace(/[^A-Za-z0-9]+/g, "_") || "default");
  fs.mkdirSync(dir, { recursive: true });
  const built = { objects: [], driver: null, error: null };
  for (const src of [...RUNTIME_C, DRIVER_C]) {
    const obj = path.join(dir, path.basename(src).replace(/\.c$/, ".o"));
    const cc = spawnSync("clang", ["-O2", ...defines, "-c", src, "-o", obj], { cwd: root });
    if (cc.status !== 0) {
      built.error = `could not compile ${src}${key.length > 0 ? ` with ${key}` : ""}:\n${cc.stderr}`;
      break;
    }
    if (src === DRIVER_C) built.driver = obj;
    else built.objects.push(obj);
  }
  runtimeObjectCache.set(key, built);
  return built;
};

/**
 * The first case linked under each object key, kept so the equivalence check
 * can replay it from the sources. `fromSource` is the command line this suite
 * used before the objects existed, argument for argument.
 */
const linkSpecimens = new Map();

/**
 * Link one compiled case into a runnable binary, against the prebuilt runtime.
 *
 * `driver` is `DRIVER_C` for the shared driver, a path for a case that brings
 * its own `.c`, and null when the module carries its own `main`. `defines` says
 * how the runtime has to have been built, and is what selects the objects.
 *
 * Answers in `spawnSync`'s shape, so a caller reads `status` and `stderr` the
 * way it always did; a runtime that would not compile is reported as a link
 * failure against the case, because that is what it is from here.
 */
const linkNative = (exe, ll, { driver = null, defines = [], libm = false } = {}) => {
  const rt = runtimeObjects(defines);
  if (rt.error !== null) return { status: 1, stdout: "", stderr: rt.error };
  const tail = libm ? ["-lm"] : [];
  const driverObject = driver === DRIVER_C ? rt.driver : driver;
  const args = [
    "-Wno-override-module",
    "-O2",
    ll,
    ...(driverObject === null ? [] : [driverObject]),
    ...rt.objects,
    ...tail,
  ];
  if (!linkSpecimens.has(defines.join(" "))) {
    linkSpecimens.set(defines.join(" "), {
      ll,
      fromObjects: args,
      // `-D` sits on the from-source line because it is compiling the runtime
      // there; on the object line it is already baked in, which is precisely
      // what the byte comparison of the two is asserting.
      fromSource: [
        "-Wno-override-module",
        "-O2",
        ...defines,
        ll,
        ...(driver === null ? [] : [driver]),
        ...RUNTIME_C,
        ...tail,
      ],
    });
  }
  return spawnSync("clang", [...args, "-o", exe], { cwd: root });
};

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
 * Whether this host's object format is Mach-O rather than ELF.
 *
 * Named once because two checks below differ by it, and both for the same
 * underlying reason: what a *linker* leaves behind is the platform's business,
 * so a check that reads a linked binary has to ask where the thing it wants
 * ended up, and a check about a link being refused has to ask which linker
 * refuses it. Neither is a fact about the compiler -- the IR is the same on
 * both -- which is why neither branches on the platform for what it asserts,
 * only for where it looks and for what did the refusing.
 */
const IS_MACHO = process.platform === "darwin";

/**
 * The file that holds a linked program's DWARF line table, which is not the
 * same file on both platforms.
 *
 * On ELF the executable carries `.debug_line` itself. On Mach-O it does not:
 * `clang -g` leaves the DWARF in the object files and the executable keeps only
 * a debug map naming them, so `llvm-dwarfdump --debug-line <exe>` prints the
 * section header with no table under it and says nothing at all about whether
 * `-g` worked. What holds the table is the `.dSYM` bundle `dsymutil` builds out
 * of that map, and the Darwin clang driver runs `dsymutil` itself whenever it
 * compiles and links in one step -- which is every link this suite makes --
 * precisely because the objects the map names are its own temporaries and it is
 * about to delete them.
 *
 * So the bundle beside the binary is the answer, and **running `dsymutil`
 * afterwards is not a fallback.** Measured on `macos-latest`: by then the
 * temporaries are gone, the tool warns `unable to open object file` once per
 * missing object, writes a bundle whose `.debug_line` is empty -- and exits 0.
 * Reaching for it would turn "there is no line table here" into "the line table
 * has no rows", which is the same failure wearing a worse message.
 *
 * Answering with the file rather than branching at each call site is what keeps
 * the two `-g` checks below asserting one property on both platforms: the table
 * names the `.ts` file it was compiled from, and it has at least one row.
 */
const lineTableOf = (exe) => {
  if (!IS_MACHO) return { file: exe, where: "the linked binary" };
  const bundle = `${exe}.dSYM`;
  const inside = path.join(bundle, "Contents", "Resources", "DWARF", path.basename(exe));
  return fs.existsSync(inside)
    ? { file: inside, where: `${path.basename(bundle)}, the bundle beside the linked binary` }
    : { file: exe, where: `the linked binary, since no ${path.basename(bundle)} was written` };
};

/**
 * Print the run's accounting and exit with its verdict.
 *
 * It is a function because there are two places a run can end: the last check
 * in the file, and the build of the compiler under test below, without which
 * nothing after it can run. Both have to report the same way, because the whole
 * value of this line is that a reader can trust it -- and a run that stopped
 * early and printed a bare `N passed` would read exactly like a full one.
 *
 * The summary counts what did *not* run as well as what did. A skip is not a
 * failure -- a contributor without LLVM is meant to be able to run this -- but
 * it is also not a pass, and the difference decides how much a green run is
 * worth. `.claude/orientation.md` and `.claude/node.md` say so in prose; this
 * says it in the output, where it is read.
 */
const summarise = () => {
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
};

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

/**
 * Every `--json` object a compile printed. A line that does not parse is kept
 * as an error, so a garbled stream cannot read as a clean one.
 */
const diagnosticsOf = (stdout) =>
  String(stdout)
    .split("\n")
    .filter((line) => line.startsWith("{"))
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { severity: "error", code: "unparsed", message: line };
      }
    });

/** One `--json` diagnostic as a report line: `file:line:col CODE message`. */
const diagnosticLine = (d) => `${d.file}:${d.line}:${d.column} ${d.code} ${d.message}`;

/** A dotted version as numbers, for ordering releases. */
const semver = (v) => v.split(".").map(Number);

/** Whether dotted version `a` is at or before `b` (`0.4.0` is not after `0.5.0`). */
const notAfter = (a, b) => {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0);
  }
  return true;
};

/** The canonical triple `--target host` resolves to on this machine, or undefined where there is none. */
const HOST_TRIPLE = {
  linux: { x64: "x86_64-unknown-linux-gnu", arm64: "aarch64-unknown-linux-gnu" },
  darwin: { x64: "x86_64-apple-darwin", arm64: "aarch64-apple-darwin" },
}[process.platform]?.[process.arch];

// The modes stage0 retired with it. Refused rather than ignored: a flag the
// suite no longer reads would run the whole suite and print a green summary
// that says nothing about what the flag asked for.
const RETIRED = ["--parity", "--verify-batch", "--batch-gate-only"].filter((flag) => process.argv.includes(flag));
if (RETIRED.length > 0) {
  console.error(
    `tests/run.js: ${RETIRED.join(", ")} compared stage0 with stage1 and went with stage0 (R6); ` +
      "there is nothing left to compare"
  );
  process.exit(2);
}

// ---- The compiler under test -----------------------------------------------------
//
// One stage1 for the whole run, linked by the seed: `--seed <nish>`, then
// `NISH_BOOTSTRAP`, then what `tests/self/seed.js` finds in the tree
// (`seedForOracle` says which, and says so on stderr when it had to fall back).
// Every check below spawns it, so without it nothing below can run: a machine
// with no clang cannot link it and the run is a counted skip that the DEGRADED
// banner explains, and a seed that cannot build `self/` is a failure, because
// that is the rolling freeze broken (WP19 G3).
const seed = HAS_CLANG
  ? seedForOracle(process.argv)
  : { error: "clang not found, and the compiler under test has to be linked" };
/** The seed as the tools this suite drives are handed it (`--seed <spec>`). */
const seedSpec = seed.label;
if (seed.error !== undefined) {
  if (HAS_CLANG) check("the compiler under test: a seed to build it with", false, seed.error);
  else skip(`every check: ${seed.error}`);
  summarise();
}
fs.rmSync(`${NISH}.modules`, { recursive: true, force: true });
if (
  !check(
    `the compiler under test: the seed (${seed.label}) builds self/compile.ts into build/nish-test`,
    linkWith(seed, path.join("self", "compile.ts"), NISH) !== null,
    "(the seed's report is on stderr above)"
  )
) {
  summarise();
}

// ---- A. Golden cases -------------------------------------------------------------
//
// Every case is compiled by the compiler under test, one process per case and
// `defaultJobs()` of them at a time. The compiles are independent of each other
// and the checks are not -- a later section reads the `.ll` a case left in
// `build/test` -- so all of them run first and the checks then walk the results
// in corpus order, which keeps the output the same at any width.
const only = withoutSeed(process.argv.slice(2)).find((arg) => !arg.startsWith("-"));
const cases = fs
  .readdirSync(casesDir)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => f.slice(0, -3))
  .sort();

/** The `.args` of a case as the compiler is handed them, or `[]`. */
const caseArgs = (name) => {
  const file = path.join(casesDir, `${name}.args`);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split(/\s+/).filter(Boolean) : [];
};

const selectedCases = cases.filter((name) => !only || name.includes(only));
const caseResults = await pool(selectedCases, defaultJobs(), (name) =>
  spawnAsync(
    NISH,
    [path.join(casesDir, `${name}.ts`), "-o", path.join(buildDir, `${name}.ll`), ...caseArgs(name)],
    { cwd: root }
  )
);

for (const [at, name] of selectedCases.entries()) {
  const src = path.join(casesDir, `${name}.ts`);
  const side = (ext) => path.join(casesDir, `${name}.${ext}`);
  const args = caseArgs(name);
  const outLl = path.join(buildDir, `${name}.ll`);
  const r = caseResults[at];
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
    // stage1 prints a module path the way it was handed one, and this suite
    // hands it absolute ones, so the checkout is taken back off: the goldens
    // name each module relative to the repository, as a user running from
    // the root would see it.
    const want = fs.readFileSync(side("stdout"), "utf8").trim();
    const got = String(r.stdout).split(`${root}/`).join("").trim();
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
    `${name}: IR matches golden`,
    actual === expected,
    `--- expected\n${expected}\n--- actual\n${actual}`
  );

  if (HAS_LLVM_AS) {
    const as = spawnSync("llvm-as", [outLl, "-o", "/dev/null"]);
    check(`${name}: llvm-as accepts IR`, as.status === 0, String(as.stderr));
  }

  if (fs.existsSync(side("out"))) {
    const driver = fs.existsSync(side("c")) ? side("c") : DRIVER_C;
    // WP5: a case with its own exported `main` is a whole program; link it without the driver.
    // Either spelling declares it (WP22): `export function main` or `export const main = (...) => ...`.
    const hasEntry = /\bexport\s+(?:function\s+main\b|const\s+main\s*=)/.test(fs.readFileSync(src, "utf8"));
    const exe = path.join(buildDir, name);
    // WP20 T0: a case compiled with `--threads` references `@nish_arena` as a
    // thread-local global, so runtime.c has to define it as one. The macro is
    // what `scripts/build.sh --threads` passes, and the link is still the check:
    // ELF refuses a non-TLS reference to a TLS definition, so a case that got
    // this wrong fails here rather than running with two arenas. Since the
    // runtime is now a prebuilt object, the macro is also what picks *which*
    // object -- and the `runtime objects:` checks below hold that choice up.
    const threads = args.includes("--threads") ? ["-DNISH_THREADS=1"] : [];
    // -lm: Math.sin/cos/exp/log/pow lower to LLVM intrinsics that become libm calls (WP7).
    const cc = linkNative(exe, outLl, {
      driver: hasEntry ? null : driver,
      defines: threads,
      libm: true,
    });
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
    NISH,
    [path.join(casesDir, "reject_type_mismatch.ts"), "-o", path.join(buildDir, "diag_mismatch.ll")],
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
  const syn = spawnSync(NISH, [synSrc, "-o", path.join(buildDir, "diag_syntax.ll")], { cwd: root });
  const synErr = String(syn.stderr);
  // stage1's parser stops at the `{` that cannot start a parameter, so the
  // excerpt is the first line with the caret under it.
  check(
    "diagnostics: syntax errors keep the `syntax error:` prefix and add the excerpt",
    syn.status === 1 &&
      synErr.includes(":1:13: syntax error: ") &&
      synErr.includes("  1 | function f( {\n    |             ^"),
    synErr
  );

  // Multi-error reporting: every independent error is printed, in source order, then a count.
  const multiSrc = path.join(casesDir, "reject_multi_error.ts");
  const multi = spawnSync(NISH, [multiSrc, "-o", path.join(buildDir, "diag_multi.ll")], { cwd: root });
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
  const many = spawnSync(NISH, [manySrc, "-o", path.join(buildDir, "diag_many.ll")], { cwd: root });
  const manyErr = String(many.stderr);
  check(
    "diagnostics: 25 errors print 20, then `...and 5 more errors` and `25 errors`",
    many.status === 1 &&
      manyErr.split("\n").filter((l) => /:\d+:\d+: error: /.test(l)).length === 20 &&
      manyErr.includes("\n...and 5 more errors\n25 errors"),
    manyErr
  );

  // --json: one object per line on stdout, nothing on stderr, no excerpt, exit code unchanged.
  const js = spawnSync(NISH, [multiSrc, "-o", path.join(buildDir, "diag_multi.ll"), "--json"], {
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
  const jsSyn = spawnSync(NISH, [synSrc, "-o", path.join(buildDir, "diag_syntax.ll"), "--json"], {
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
  // same rule next release. The registry is `self/codes.ts`, and the generator's
  // `--check` is what says it is well formed.
  const codesGen = spawnSync("node", [path.join(root, "scripts", "gen-diagnostic-codes.mjs"), "--check"], {
    cwd: root,
    encoding: "utf8",
  });
  check(
    "codes: scripts/gen-diagnostic-codes.mjs --check accepts the registry",
    codesGen.status === 0,
    codesGen.stdout + codesGen.stderr
  );

  // ...and that it refuses what `codeFor` would misread (issue #107). The live
  // registry is copied with one line broken, and `--check` has to reject each
  // copy and name the table. A stray string with no other half is skipped by
  // the pair reader, so it would pass for well-formed while every later rule
  // took its neighbour's code; a gap in NL9xxx is a performance rule that lost
  // its number.
  const codesLive = fs.readFileSync(path.join(root, "self", "codes.ts"), "utf8");
  const codesStray = '  "a fragment that nobody gave a code to",\n';
  const codesMutations = [
    ["a stray fragment in diagnosticRules", "diagnosticRules", (t) =>
      t.replace("export const diagnosticRules = (): string[] => [\n", (open) => open + codesStray)],
    ["a stray fragment in performanceRules", "performanceRules", (t) =>
      t.replace("export const performanceRules = (): string[] => [\n", (open) => open + codesStray)],
    ["a gap in the NL9xxx codes", "performanceRules", (t) => t.replace('"NL9010",', '"NL9011",')],
  ];
  for (const [i, [what, table, mutate]] of codesMutations.entries()) {
    const copy = path.join(buildDir, `codes-mutation-${i}.ts`);
    const mutated = mutate(codesLive);
    fs.writeFileSync(copy, mutated);
    const r = spawnSync("node", [path.join(root, "scripts", "gen-diagnostic-codes.mjs"), "--check", copy], {
      cwd: root,
      encoding: "utf8",
    });
    check(
      `codes: --check rejects ${what}`,
      mutated !== codesLive && r.status === 1 && r.stderr.includes(`\`${table}\``),
      mutated === codesLive ? "the mutation did not apply" : r.stdout + r.stderr
    );
  }

  // The parse itself is `scripts/codes-registry.js`, shared with the
  // generator and with `tests/diagnostic_coverage.js` -- three copies of one
  // regex is how the first two drifted apart (issue #96), and that module's
  // header is where the story lives. It raises on a registry whose shape has
  // moved, which is caught here rather than left to propagate: a harness that
  // throws on this line proves nothing about the thousand checks after it.
  const registryOf = (text, label) => {
    try {
      return { pairs: parseCodesRegistry(text, label), error: null };
    } catch (err) {
      return { pairs: [], error: err.message };
    }
  };
  const registryText = fs.readFileSync(path.join(root, "self", "codes.ts"), "utf8");
  const registryRead = registryOf(registryText, "self/codes.ts");
  const registryCodes = registryRead.pairs.map((p) => `${p.code} ${JSON.stringify(p.fragment)}`);
  check(
    `codes: self/codes.ts reads as a registry (${registryCodes.length} rules)`,
    registryRead.error === null && registryCodes.length > 0,
    registryRead.error ?? "an empty registry"
  );
  // A number handed out once is never handed to a different rule.
  const dupCodes = registryCodes.map((p) => p.split(" ")[0]).filter((c, i, a) => a.indexOf(c) !== i);
  check("codes: every rule has its own number", dupCodes.length === 0, `reused: ${dupCodes.join(", ")}`);

  // The reader's two promises, demonstrated rather than taken on trust, because
  // both have already failed here: a registry read at the wrong indentation was
  // read as *empty* rather than as changed, and an empty registry then passed
  // for a covered one. The live table is handed to the reader twice more,
  // reindented and then flattened, so both properties are pinned against real
  // data rather than against a fixture that can drift from it.
  const reindented = registryOf(registryText.replace(/^ {2}/gm, "    "), "self/codes.ts reindented to four spaces");
  check(
    "codes: the registry reader is indentation-agnostic",
    reindented.error === null && reindented.pairs.length === registryCodes.length,
    reindented.error ??
      `${registryCodes.length} rules as written, ${reindented.pairs.length} after reindenting`
  );

  const flattened = registryOf(registryText.replace(/^[ \t]+/gm, ""), "self/codes.ts with its indentation stripped");
  check(
    "codes: a registry the reader cannot parse raises rather than reading as empty",
    flattened.error !== null,
    `it answered ${flattened.pairs.length} pairs for a table the pattern cannot match; an empty ` +
      `registry must not be able to pass for a covered one`
  );

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
    "codes: a syntax error is NL0001, whatever the parser worded it as",
    JSON.parse(jsSyn.stdout.split("\n")[0]).code === "NL0001",
    jsSyn.stdout
  );

  // Coverage over every code in the registry, not only over the ones some
  // rejection happens to reach (WP19 G2.4). `tests/diagnostic_coverage.js`
  // compiles the negatives, the `perf_*` positives and its own
  // `tests/wordings/` corpus, reads the `code` out of every `--json` object,
  // and requires each of the registry's codes to be either provoked or named
  // in one of its registers with a reason. Two outcomes are declared per case
  // rather than in general: `parser_refusals.txt` for the constructs stage1's
  // parser turns down before the phase that owns the rule can word it (§A3),
  // and `stage1_divergence.txt` for the programs whose answer is not yet the
  // one the case pins. `--strict-refusals` is what makes both lists
  // shrink-only: a case that starts agreeing fails until the line naming it
  // is deleted.
  //
  // The uncoded remainder is still the backlog, pinned so it can shrink but not
  // grow: such a message is built entirely out of interpolations and has no
  // literal run long enough to identify a rule. Adding one is a matter of
  // giving the message words of its own, not of editing the table -- which is
  // what took this from 8 to 1 over `tests/cases`: `` `${fn}` expects ${a}, got
  // ${b} `` was eight of them, and now reads `expects an argument of type
  // ${a}`, a run a code can be derived from.
  //
  // Two, because the tool walks the `tests/link/` negatives as well as
  // `tests/cases/reject_*`: an import of a name a module does not export
  // (`tests/link/unknown_export`) is uncoded and always was, and stage1 answers
  // the empty statement of `tests/wordings/nl2260_empty_statement` with
  // ``Unsupported statement `;` ``, which quotes the statement and has no words
  // of its own. It was five until #174 gave the duplicate-symbol wordings --
  // a duplicate export, the same one reached through an import, and a
  // duplicate internal name -- codes of their own (NL3024, NL3026). They are
  // named on stdout by the run, so shrinking this backlog means giving one of
  // those messages a registry entry, or a literal run of its own first.
  const UNCODED_BACKLOG = 2;
  const wordings = spawnSync(
    "node",
    [
      path.join(root, "tests", "diagnostic_coverage.js"),
      "--compiler",
      path.relative(root, NISH),
      "--strict-refusals",
      "--require-coverage",
      ...(process.env.UPDATE_GOLDENS === "1" ? ["--update"] : []),
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  const wordingsSummary = wordings.stdout.trim().split("\n").pop() ?? "";
  check(
    `codes: every registry code is provoked by a program, declared, or explained (${wordingsSummary})`,
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
    NISH,
    [path.join(casesDir, "cf_fib.ts"), "-o", path.join(buildDir, "diag_json_ok.ll"), "--json"],
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
    NISH,
    [path.join(root, "tests", "link", "reachable_struct", "main.ts"), "-o", reachDir, "-g"],
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

  const dbgSrc = path.join(buildDir, "dbg_main.ts");
  fs.writeFileSync(
    dbgSrc,
    "function fib(n: number): number {\n  if (n < 2) return n;\n  return fib(n - 1) + fib(n - 2);\n}\n\nexport function main(): number {\n  const x = fib(10);\n  return x - 55;\n}\n"
  );
  const exe = path.join(buildDir, "dbg_main");
  const link = spawnSync(NISH, [dbgSrc, "-g", "--link", exe, "--profile", "debug"], {
    cwd: root,
    encoding: "utf8",
  });
  check(
    "-g --link --profile debug builds a binary that exits 0",
    link.status === 0 && spawnSync(exe).status === 0,
    link.stderr
  );
  if (link.status === 0) {
    // `lineTableOf` is what makes this one check on two object formats: it
    // answers with the file the platform put the table in, and the assertion
    // under it is the same sentence either way.
    const table = lineTableOf(exe);
    const dumpers = [
      ["llvm-dwarfdump", ["--debug-line", table.file]],
      ["objdump", ["--dwarf=decodedline", table.file]],
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
        `${tool[0]}: the line table names dbg_main.ts and has at least one row (read from ${table.where})`,
        dump.status === 0 && out.includes("dbg_main.ts") && hasRow,
        out.slice(0, 2000) + dump.stderr
      );
    }
  }
  // The speed profile keeps the DWARF too: -g disables the strip step of
  // build.sh. Read through `lineTableOf` for the reason the check above does:
  // on Mach-O the stripping the profile would have done is `-Wl,-x` on the
  // executable, and the table `-g` produced is in the bundle next to it, so
  // looking only at the executable would report every Darwin build as
  // stripped whether or not it was.
  const speed = spawnSync(NISH, [dbgSrc, "-g", "--link", `${exe}.speed`], {
    cwd: root,
    encoding: "utf8",
  });
  const speedTable = speed.status === 0 ? lineTableOf(`${exe}.speed`) : null;
  const symbols =
    speedTable !== null && has("llvm-dwarfdump")
      ? spawnSync("llvm-dwarfdump", ["--debug-line", speedTable.file], { encoding: "utf8" }).stdout
      : "";
  check(
    "-g --link (speed profile) is not stripped: the line table survives " +
      `(read from ${speedTable === null ? "the linked binary" : speedTable.where})`,
    speed.status === 0 && (!has("llvm-dwarfdump") || symbols.includes("dbg_main.ts")),
    speed.stderr + symbols.slice(0, 500)
  );
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
    spawnSync(NISH, [path.join(casesDir, `${name}.ts`), "-o", path.join(buildDir, out), ...extra], {
      cwd: root,
      encoding: "utf8",
    });
  const summaries = (text) => text.split("\n").filter((l) => /:\d+:\d+: performance: /.test(l));
  /** The `line:col` of each summary line, comma-joined -- the shape every check below pins. */
  const positions = (lines) => lines.map((l) => /:(\d+):(\d+): /.exec(l).slice(1, 3).join(":")).join(",");

  // The order of the stream, before any rule in it. The warning list is sorted
  // by file, then by position, then by diagnostic code, and `diag_order` is the
  // case that needs the sort: a generic's body is checked when one of its
  // instantiations is finished, so the walk *finds* the warning at line 26
  // after the one at line 36 and reported them that way until WP15's remainder.
  // The pair at 44:41 is the second key — two analyses at one position, ordered
  // by their code rather than by which of them ran. `--json` is a
  // machine-readable stream, so both are a contract, not a presentation detail.
  const order = compile("diag_order", "diag_order.ll");
  const orderLines = summaries(order.stderr);
  check(
    "performance: the warnings of one file are reported by position and then by code, whatever order the analysis found them in",
    order.status === 0 &&
      orderLines.length === 4 &&
      positions(orderLines) === "26:5,36:5,44:41,44:41" &&
      orderLines[0].includes("performance: `s` is rebuilt from its own value") &&
      orderLines[1].includes("performance: `out` is rebuilt from its own value") &&
      orderLines[2].includes("performance: this `*` is computed in i32 and wraps") &&
      orderLines[3].includes("performance: this computes with overflow"),
    order.stderr
  );

  // The key `diag_order` could pin but not falsify: a **pass-1** warning beside
  // pass-2 ones in a file that reads in neither order. A struct's layout is
  // known when its members are collected, so the analysis hands the sink the
  // two padding warnings first -- `Slot` at 26 and `Frame` at 42 -- and only
  // then the two accumulators at 20 and 36. Reported by position they come out
  // 20, 26, 36, 42, which is the file read top to bottom; with the sort removed
  // the padding pair leads, which is what WP15 §8 said blocked the tenth rule
  // until the order was written down.
  const passes = compile("diag_order_pass1", "diag_order_pass1_report.ll");
  const passLines = summaries(passes.stderr);
  check(
    "performance: a pass-1 warning is reported at its place in source order, not ahead of every pass-2 warning in its file",
    passes.status === 0 &&
      passLines.length === 4 &&
      positions(passLines) === "20:5,26:14,36:5,42:14" &&
      passLines[0].includes("performance: `out` is rebuilt from its own value") &&
      passLines[1].includes("performance: `Slot` is 24 bytes and would be 16") &&
      passLines[2].includes("performance: `s` is rebuilt from its own value") &&
      passLines[3].includes("performance: `Frame` is 24 bytes and would be 16"),
    passes.stderr
  );

  // The tenth rule (NL9010). §8's hint column asks for three things -- the size
  // the struct is, the size the same fields reach in their best order, and that
  // order -- so the whole sentence is the check rather than the words it opens
  // with. A `class` and an `interface` of identical shape, because a layout is a
  // layout and the rule may not be a rule about classes; the interface's hint
  // carries the second half of its rewrite, since reordering an interface alone
  // is what stops an implementer compiling.
  const pad = compile("perf_padding", "perf_padding_report.ll");
  const padLines = summaries(pad.stderr);
  const padSentence = (name, order) =>
    `performance: \`${name}\` is 24 bytes and would be 16 with the same fields in a different order, so 8 bytes ` +
    `of every value are padding the alignment rules insert and nothing reads: declare the fields widest first ` +
    `\u2014 \`${order}\``;
  const implementersTail =
    " \u2014 here and in any class that `implements` it, since the interface's fields are its implementers' " +
    "first fields";
  check(
    "performance: a struct a reordering would shrink warns once, naming both sizes and the order that reaches the smaller one",
    pad.status === 0 &&
      padLines.length === 2 &&
      positions(padLines) === "14:14,20:18" &&
      padLines[0].endsWith(padSentence("Mixed", "size: f64, count: i32, flag: boolean")) &&
      padLines[1].endsWith(padSentence("Row", "weight: f64, index: i32, live: boolean") + implementersTail),
    pad.stderr
  );

  // A class that `implements` an interface (#108): the interface's fields stay
  // first and only the fields after them are reordered, so the sentence names
  // the prefix it keeps and an order that starts with it. `Tagged` implements
  // two interfaces and the longer one, declared below it, is the prefix.
  const suffix = compile("perf_padding_suffix", "perf_padding_suffix_report.ll");
  const suffixLines = summaries(suffix.stderr);
  const suffixSentence = (name, iface, order) =>
    `performance: \`${name}\` is 40 bytes and would be 32 with the same fields in a different order, so 8 bytes ` +
    `of every value are padding the alignment rules insert and nothing reads: keep the first 2 fields where ` +
    `\`implements ${iface}\` puts them and declare the rest in this order \u2014 \`${order}\``;
  check(
    "performance: a class that implements an interface warns when reordering only the fields after the interface's shrinks it",
    suffix.status === 0 &&
      suffixLines.length === 2 &&
      positions(suffixLines) === "15:14,31:14" &&
      suffixLines[0].endsWith(suffixSentence("Wide", "Base", "a: i32, b: f64, d: f64, c: i32, e: i32")) &&
      suffixLines[1].endsWith(suffixSentence("Tagged", "Late", "id: i32, at: f64, weight: f64, count: i32, flag: boolean")),
    suffix.stderr
  );

  // A prefix that ends off alignment leaves a gap the class's narrow fields can
  // fill, so the best suffix is not widest first. Each sentence names the order
  // that fills the gap and the size that order measures to: 24 for `FourGap` and
  // `OneGap`, which widest first leaves at 32, and 40 for `Mixed`, where widest
  // first reaches only 48. With one field kept the sentence says so in the
  // singular.
  const gap = compile("perf_padding_suffix_gap", "perf_padding_suffix_gap_report.ll");
  const gapLines = summaries(gap.stderr);
  const gapSentence = (name, size, packed, iface, order) =>
    `performance: \`${name}\` is ${size} bytes and would be ${packed} with the same fields in a different order, ` +
    `so ${size - packed} bytes of every value are padding the alignment rules insert and nothing reads: keep the ` +
    `first field where \`implements ${iface}\` puts it and declare the rest in this order \u2014 \`${order}\``;
  check(
    "performance: a class whose interface prefix ends off alignment is told the order that fills the gap, and the size it reaches",
    gap.status === 0 &&
      gapLines.length === 3 &&
      positions(gapLines) === "14:14,27:14,42:14" &&
      gapLines[0].endsWith(gapSentence("FourGap", 32, 24, "Four", "a: i32, c: i32, b: f64, d: f64")) &&
      gapLines[1].endsWith(gapSentence("OneGap", 32, 24, "One", "a: boolean, c: boolean, d: i32, b: f64, e: f64")) &&
      gapLines[2].endsWith(
        gapSentence(
          "Mixed",
          56,
          40,
          "One",
          "a: boolean, r: u8, u: u16, f: f32, s: string, xs: i32[], n: Item | null, q: i64"
        )
      ),
    gap.stderr
  );

  const str = compile("perf_str_concat_loop", "perf_str.ll");
  const strLines = summaries(str.stderr);
  // `for`, `while`, a nested loop whose accumulator is declared one level out,
  // and `do` — each is a loop, and a template hole copies as much as `+` does.
  check(
    "performance: every self-accumulating string assignment in a loop warns, naming the variable and the `string[]` + `join` rewrite",
    str.status === 0 &&
      strLines.length === 4 &&
      positions(strLines) === "7:5,14:5,24:7,33:5" &&
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
      positions(dropLines) === "15:3,17:3,21:3" &&
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
      positions(constLines) === "8:15,9:19,12:18" &&
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
      positions(boundsLines) === "12:24,20:36,28:24" &&
      boundsLines[0].includes("`i` is not proven to be in range for `ys` here, so this access keeps its bounds check") &&
      boundsLines[1].includes("`j` is not proven to be in range for `zs`") &&
      boundsLines[2].includes("`k` is not proven to be in range for `ws`") &&
      boundsLines.every((l) =>
        l.includes("proves both ends, and an unsigned index needs only the upper one")
      ),
    bounds.stderr
  );

  // WP15 §4/§8: a `substring` bound the proof could not place in [0, s.length]
  // keeps JavaScript's clamp, and is reported once per bound -- so the one call
  // here, with neither end proven, warns twice and names each bound.
  const clamp = compile("perf_clamp", "perf_clamp.ll");
  const clampLines = summaries(clamp.stderr);
  check(
    "performance: an unfolded `substring` clamp warns once per bound, naming the bound and the guard",
    clamp.status === 0 &&
      clampLines.length === 2 &&
      positions(clampLines) === "25:33,25:39" &&
      clampLines[0].includes("`from` is not provably within `s`, so this `substring` bound keeps the clamp") &&
      clampLines[1].includes("`to` is not provably within `s`") &&
      clampLines.every((l) => l.includes("or use `slice`, which has no clamp at all")),
    clamp.stderr
  );

  // The clamp is the semantics, not a check, so the flag that removes every
  // bounds check must leave both the clamp and its warning exactly as they were.
  const clampUnchecked = compile("perf_clamp", "perf_clamp_unchecked.ll", ["--unchecked-indexing"]);
  check(
    "performance: --unchecked-indexing changes neither the substring clamp nor its warning",
    clampUnchecked.status === 0 &&
      summaries(clampUnchecked.stderr).length === 2 &&
      stripHeader(fs.readFileSync(path.join(buildDir, "perf_clamp_unchecked.ll"), "utf8")) ===
        stripHeader(fs.readFileSync(path.join(buildDir, "perf_clamp.ll"), "utf8")),
    clampUnchecked.stderr
  );

  // The proof is worth an instruction count, not just a quieter build: the two
  // proven calls in perf_clamp_quiet lose a clamp pair each -- four pairs, so
  // eight of the twenty-four calls -- and the two shapes with nothing to prove
  // keep all six of theirs. Compiled here rather than read off the goldens
  // section, so that `node tests/run.js performance` stands on its own.
  const clampQuietCompile = compile("perf_clamp_quiet", "perf_clamp_quiet.ll");
  const clampQuietIr =
    clampQuietCompile.status === 0
      ? fs.readFileSync(path.join(buildDir, "perf_clamp_quiet.ll"), "utf8")
      : "";
  const clampCalls = (clampQuietIr.match(/call i64 @llvm\.(smin|smax)\.i64/g) ?? []).length;
  check(
    "performance: a proven substring bound emits no clamp at all (8 of 24 intrinsic calls left out)",
    clampQuietCompile.status === 0 && clampCalls === 16,
    `llvm.smin/smax calls in perf_clamp_quiet.ll: ${clampCalls}, expected 16\n${clampQuietCompile.stderr}`
  );

  // WP15 §8: --no-strict-exports keeps a non-exported function an external
  // symbol. Reported at the call and only inside a loop; the exported callee
  // and the call outside the loop in the same file must stay silent.
  const inline = compile("perf_inline", "perf_inline.ll", ["--no-strict-exports"]);
  const inlineLines = summaries(inline.stderr);
  check(
    "performance: --no-strict-exports warns at a call in a loop to a function the module does not export",
    inline.status === 0 &&
      inlineLines.length === 1 &&
      inlineLines[0].includes("`step` is called here inside a loop and `--no-strict-exports` keeps it an") &&
      inlineLines[0].includes("drop `--no-strict-exports`, and a function this module does not export is"),
    inline.stderr
  );

  // The default is the rewrite the message names, so it must say nothing.
  const inlineDefault = compile("perf_inline", "perf_inline_default.ll");
  check(
    "performance: the default (--strict-exports) is the rewrite, so the same file reports nothing",
    inlineDefault.status === 0 && summaries(inlineDefault.stderr).length === 0,
    inlineDefault.stderr
  );

  // The guards, with the flag given, so what is tested is the guards.
  const inlineQuiet = compile("perf_inline_quiet", "perf_inline_quiet.ll", ["--no-strict-exports"]);
  check(
    "performance: perf_inline_quiet takes no slow path with a faster form to name, so nothing is reported",
    inlineQuiet.status === 0 && summaries(inlineQuiet.stderr).length === 0,
    inlineQuiet.stderr
  );

  // The foreign shape is the one the `exported` test alone got wrong, and a
  // count of zero above cannot say the shape was still in the file. `abs` is
  // `declare`d rather than defined, so the `declare` line is what proves this
  // case still carries it -- a silent case that stopped containing the shape
  // it guards is the failure mode a zero-warning assertion has.
  // A `declare function` is external because C defines it, not because this
  // module withheld an `export` -- and `exported` is always false for one, so
  // testing it alone reported a C call in a loop and named two rewrites that
  // were both impossible. `perf_inline_foreign` holds the foreign call and an
  // ordinary non-exported call in the *same* loop, so the one surviving
  // diagnostic is what says the `foreign` guard is not too wide.
  const inlineForeign = compile("perf_inline_foreign", "perf_inline_foreign.ll", ["--no-strict-exports"]);
  const foreignLines = summaries(inlineForeign.stderr);
  check(
    "performance: a `declare function` in a loop is silent, and the ordinary call beside it still warns",
    inlineForeign.status === 0 &&
      foreignLines.length === 1 &&
      foreignLines[0].includes("`step` is called here inside a loop and `--no-strict-exports` keeps it an"),
    inlineForeign.stderr
  );

  // And *why* it must be silent, rather than only that it is: the flag has no
  // linkage to withdraw from a `declare`, so every `declare` line the emitter
  // writes is the same under the flag as under the default. There is nothing
  // for the message's two rewrites to change, which is what makes a warning
  // here a warning about a cost nobody is paying.
  const foreignDefault = compile("perf_inline_foreign", "perf_inline_foreign_default.ll");
  const declaresIn = (f) =>
    (fs.readFileSync(path.join(buildDir, f), "utf8").match(/^declare .*$/gm) ?? []).join("\n");
  check(
    "performance: --no-strict-exports leaves a `declare function` byte for byte as the default emits it",
    inlineForeign.status === 0 &&
      foreignDefault.status === 0 &&
      declaresIn("perf_inline_foreign.ll") === declaresIn("perf_inline_foreign_default.ll") &&
      /^declare i32 @abs\(i32\)$/m.test(declaresIn("perf_inline_foreign.ll")),
    `flagged:\n${declaresIn("perf_inline_foreign.ll")}\ndefault:\n${declaresIn("perf_inline_foreign_default.ll")}`
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
    // Every index proven through a hoisted `toI32(w.length)`, the spelling that
    // compiles in both number modes; the `_f64` twin runs under its `.args`.
    "perf_bounds_toi32",
    "perf_bounds_toi32_f64",
    // Literal spellings neither compiler folds: normalising them in stage0 would
    // fold exactly what stage1 refuses, and only one of the two would warn.
    "perf_overflow_spelling",
    // Every `substring` bound either proven -- in which case the clamp is gone
    // from the IR, not merely quiet -- or with no guard anybody could write.
    "perf_clamp_quiet",
    // Structs that are already as small as their fields make them, a class
    // whose only padding is in the interface prefix it may not permute, and a
    // generic instantiation, whose order is not the author's to choose.
    "perf_padding_quiet",
    // A class whose padding is all inside its interface prefix, with the
    // fields it adds already widest first: nothing the author may reorder.
    "perf_padding_suffix_quiet",
  ]) {
    const quiet = compile(name, `${name}.ll`, caseArgs(name));
    check(
      `performance: ${name} takes no slow path with a faster form to name, so nothing is reported`,
      quiet.status === 0 && summaries(quiet.stderr).length === 0,
      quiet.stderr
    );
  }

  // Only the length converts to a length: the conversion of anything else
  // leaves the check, and the warning, where they were.
  const toI32Loop = compile("perf_bounds_toi32_loop", "perf_bounds_toi32_loop_report.ll");
  const toI32LoopLines = summaries(toI32Loop.stderr);
  check(
    "performance: `toI32` of something that is not a length proves nothing, and each access warns",
    toI32Loop.status === 0 &&
      toI32LoopLines.length === 2 &&
      positions(toI32LoopLines) === "14:33,23:17" &&
      toI32LoopLines[0].includes("`i` is not proven to be in range for `s` here") &&
      toI32LoopLines[1].includes("`j` is not proven to be in range for `xs` here"),
    toI32Loop.stderr
  );

  // A user function named `toI32` wins over the builtin and answers what it
  // likes, here one past the length. The warning says the check stayed, and
  // the run says it had to: the last pass panics instead of reading past `s`.
  const toI32User = compile("perf_bounds_toi32_user", "perf_bounds_toi32_user_report.ll");
  const toI32UserLines = summaries(toI32User.stderr);
  check(
    "performance: a user function named `toI32` is not trusted as the length, so the access warns",
    toI32User.status === 0 &&
      toI32UserLines.length === 1 &&
      positions(toI32UserLines) === "14:30" &&
      toI32UserLines[0].includes("`i` is not proven to be in range for `s` here"),
    toI32User.stderr
  );
  if (has("clang") && toI32User.status === 0) {
    const exe = path.join(buildDir, "perf_bounds_toi32_user");
    const cc = linkNative(exe, path.join(buildDir, "perf_bounds_toi32_user_report.ll"));
    const run = cc.status === 0 ? spawnSync(exe, { encoding: "utf8" }) : null;
    check(
      "perf_bounds_toi32_user: the kept check stops the pass past the end — exits 1 with `index out of range: 3 >= 3`",
      run !== null &&
        run.status === 1 &&
        run.stderr.includes("index out of range: 3 >= 3") &&
        run.stdout === "97\n98\n99\n",
      run ? `exit ${run.status}\nstdout: ${run.stdout}\nstderr: ${run.stderr}` : cc.stderr
    );
  } else {
    skip("perf_bounds_toi32_user: the panic run needs clang");
  }

  // `std/text` is imported into every program that reads lines, so a warning
  // from inside it is a warning about code the user cannot change. A program
  // importing every export — read off the module, so a new one is covered the
  // day it lands — must compile silent from `std/text.ts` in both number
  // modes: the checks are proven away, which is not the same as silenced.
  const textExports = [...fs.readFileSync(path.join(root, "std", "text.ts"), "utf8").matchAll(/^export const (\w+)/gm)].map(
    (m) => m[1]
  );
  const textUser = path.join(buildDir, "std_text_importer.ts");
  fs.writeFileSync(
    textUser,
    `import { ${textExports.join(", ")} } from "nish/text";\n\nexport const main = (): i32 => 0;\n`
  );
  for (const mode of ["i32", "f64"]) {
    const outDir = path.join(buildDir, `std_text_importer_${mode}`);
    const run = spawnSync(NISH, [textUser, "-o", `${outDir}/`, "--number-mode", mode], { cwd: root, encoding: "utf8" });
    const fromText = summaries(run.stderr).filter((l) => l.includes("std/text.ts:"));
    check(
      `performance: a program importing all ${textExports.length} exports of nish/text compiles with no warning from std/text.ts (--number-mode ${mode})`,
      run.status === 0 &&
        textExports.length > 0 &&
        fs.existsSync(path.join(outDir, "text.ll")) &&
        fromText.length === 0 &&
        !run.stderr.includes("more performance warnings"),
      run.stderr
    );
  }

  // The zero gate. What ships is held to no performance warning at all: every
  // module of the standard library, which is compiled into each program that
  // imports it, and every example, which is what a reader copies. Both are
  // discovered from their directories, so a module or an example added later
  // is gated the day it lands without anybody editing a list, and each is
  // compiled in both number modes, because a warning can be one mode's alone.
  // The warnings are read from `--json` by their `severity` and `code`, never
  // from the report, whose wording may change and whose length is capped
  // (`.claude/testing.md`). A check proven away is what clears this; there is
  // no `--no-warn-performance` anywhere in it, and none in the gated sources.
  //
  // A few programs are written for one number mode and do not compile in the
  // other at all. Each is named with the diagnostic code that refuses it, so a
  // refusal for any other reason still fails, and a listed program that starts
  // compiling fails too, until it comes off the list and the gate holds it.
  const PERF_GATE_REFUSED = new Map([
    ["examples/argv.ts f64", "NL2140"], // `main` answers `number`, which is f64 there
    ["examples/arrays.ts f64", "NL2021"], // `i * i` is f64 there, and `out` is an Int32Array
    ["examples/hello.ts f64", "NL2140"],
    ["examples/multi/main.ts f64", "NL2140"],
    ["examples/nbody.ts i32", "NL2008"], // written for f64 (its `// smoke: args` line): `Math.sqrt` of an i32
  ]);
  const gateSources = [
    ...fs
      .readdirSync(path.join(root, "std"))
      .filter((f) => f.endsWith(".ts"))
      .map((f) => `std/${f}`),
    // The corpus's own discovery, which already reads a directory with a
    // `main.ts` as one program (`examples/multi/`).
    ...corpusPrograms()
      .map((file) => path.relative(root, file).split(path.sep).join("/"))
      .filter((file) => file.startsWith("examples/")),
  ].sort();
  const gateRuns = gateSources.flatMap((source) => ["i32", "f64"].map((mode) => ({ source, mode })));
  const gateResults = await pool(gateRuns, defaultJobs(), ({ source, mode }) =>
    spawnAsync(
      NISH,
      [source, "-o", `${path.join(buildDir, "perf_gate", mode, source.replace(/[/.]/g, "_"))}/`, "--number-mode", mode, "--json"],
      { cwd: root, encoding: "utf8" }
    )
  );
  for (const [at, { source, mode }] of gateRuns.entries()) {
    const result = gateResults[at];
    const diagnostics = diagnosticsOf(result.stdout);
    const refusedBy = PERF_GATE_REFUSED.get(`${source} ${mode}`);
    if (refusedBy !== undefined) {
      const codes = diagnostics.filter((d) => d.severity === "error").map((d) => d.code);
      check(
        `performance gate: ${source} is written for the other number mode and does not compile under --number-mode ${mode} (${refusedBy}, as recorded)`,
        result.status === 1 && codes.includes(refusedBy),
        result.status === 0
          ? `it compiles now: take "${source} ${mode}" out of PERF_GATE_REFUSED in tests/run.js so the gate holds it`
          : `refused for another reason than ${refusedBy}:\n${diagnostics.map(diagnosticLine).join("\n")}${result.stderr}`
      );
      continue;
    }
    const warnings = diagnostics.filter((d) => d.severity === "performance");
    check(
      `performance gate: ${source} compiles with no performance warning (--number-mode ${mode})`,
      result.status === 0 && warnings.length === 0,
      result.status !== 0
        ? `it does not compile:\n${diagnostics.map(diagnosticLine).join("\n")}${result.stderr}`
        : `${warnings.length} performance warning(s); prove each check away rather than silencing it ` +
            `(.claude/testing.md, "The performance gate"):\n${warnings.map(diagnosticLine).join("\n")}`
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
  const mixed = spawnSync(NISH, [mixedSrc, "-o", path.join(buildDir, "perf_mixed.ll")], {
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
  const many = spawnSync(NISH, [manySrc, "-o", path.join(buildDir, "perf_many.ll")], {
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
  // `$` is part of a symbol name, not a word character: WP18 mangles an
  // instantiation as `identity$i32`, and a pattern without it silently found no
  // cross-module generic at all — which is exactly the pair this check exists
  // to compare since G7 put the `define` and the `declare` in two modules.
  // `hidden` is WP29's: a private function another module's instantiation
  // calls is in the link but exported from nothing, and its `declare` in that
  // module has the same signature and attributes as any other.
  for (const m of ir.matchAll(
    /^(define|declare) (?:internal |hidden )?(.*?) @([\w.$]+)\((.*?)\)(?: (#\d+))?(?: \{)?$/gm
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
    NISH,
    [side("main.ts"), "-o", outDir, "--link", exe, ...args],
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
    check(`link/${name}: compiles and links`, false, stderr);
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

  const run = spawnSync(exe);
  const wantCode = Number(read("expected.code").trim());
  const wantOut = fs.existsSync(side("expected.out")) ? read("expected.out").trim() : "";
  check(
    `link/${name}: exits with ${wantCode} and stdout matches expected.out`,
    run.status === wantCode && String(run.stdout).trim() === wantOut,
    `--- expected exit ${wantCode}, stdout:\n${wantOut}\n--- actual exit ${run.status}, stdout:\n${run.stdout}${run.stderr}`
  );
}

// WP29 P1: `dst` shorter than `src` panics before any element is written, with
// `std/threads.ts`'s own message. The link loop above compares stdout and the
// exit code only, so the wording is pinned here, on stderr, the way
// `arr_bounds_panic` pins `index out of range`.
// The binary's existence is part of the assertion rather than a guard around it,
// so a renamed or deleted fixture fails here instead of dropping the check.
if (!only || "par_dst_short".includes(only)) {
  // The fixture is asked for too: the link loop empties its output directory
  // only when it runs the case, so a binary left by an earlier run would
  // otherwise answer for a fixture that is gone.
  const fixture = linkTests.includes("par_dst_short");
  const exe = path.join(buildDir, "link", "par_dst_short", "app");
  const run = fixture && fs.existsSync(exe) ? spawnSync(exe) : null;
  check(
    "link/par_dst_short: exits 1 with `parallelMapInto: dst has 2 elements and src has 3` on stderr",
    run !== null &&
      run.status === 1 &&
      String(run.stderr).includes("parallelMapInto: dst has 2 elements and src has 3") &&
      String(run.stdout).trim() === "before",
    run === null ? (fixture ? `no such binary: ${exe}` : "no such fixture: tests/link/par_dst_short") : `exit ${run.status}\nstdout: ${run.stdout}\nstderr: ${run.stderr}`
  );
}

// WP29: an allocating parallel body compiles with NL9012 at the call, which
// the link loop above does not assert: it reads a successful compile's stderr
// for nothing but a failure report. Asked of `--json`, whose `code` is the contract, and again under
// `--no-warn-performance`, which must silence it and change nothing else. The
// fixture's existence is part of the assertion, as for `par_dst_short`.
if (!only || "par_alloc".includes(only)) {
  const fixture = linkTests.includes("par_alloc");
  const entry = path.join(linkDir, "par_alloc", "main.ts");
  const compileJson = (extra) => {
    const out = path.join(buildDir, "link", `par_alloc-json${extra.length}`) + path.sep;
    fs.rmSync(out, { recursive: true, force: true });
    const r = spawnSync(NISH, [entry, "--json", "-o", out, ...extra], { cwd: root, encoding: "utf8" });
    return { status: r.status, objects: diagnosticsOf(r.stdout), stderr: r.stderr };
  };
  const warned = fixture ? compileJson([]) : null;
  const quiet = fixture ? compileJson(["--no-warn-performance"]) : null;
  const w = warned === null || warned.objects.length !== 1 ? null : warned.objects[0];
  check(
    "link/par_alloc: an allocating parallel body compiles with one NL9012 at the call, and --no-warn-performance silences it",
    w !== null &&
      quiet !== null &&
      warned.status === 0 &&
      w.code === "NL9012" &&
      w.severity === "performance" &&
      w.line === 23 &&
      w.column === 3 &&
      w.message.startsWith(
        "the body of this `parallelMapInto` allocates per element: `label` answers `i32` but allocates on every call"
      ) &&
      quiet.status === 0 &&
      quiet.objects.length === 0,
    warned === null
      ? "no such fixture: tests/link/par_alloc"
      : `warned: exit ${warned.status} ${JSON.stringify(warned.objects)}\nquiet: exit ${quiet.status} ${JSON.stringify(quiet.objects)}`
  );
}

// One file named twice on a command line is one module, whichever way the
// second name is spelled. `tests/link/root_named_twice` runs the entry by
// absolute path and the second root from the repository root; these are the
// other two spellings, run from the fixture's own directory with a relative
// entry: `./types.ts` beside the import's `types.ts`, and the absolute path.
// Keyed on the spelling, each was a second module of the same file, whose
// class clashed with itself (NL3028) and whose `.ll` was written twice.
{
  const twiceDir = path.join(linkDir, "root_named_twice");
  for (const [label, second, outName] of [
    ["./types.ts", "./types.ts", "root_named_twice-dot"],
    ["its absolute path", path.join(twiceDir, "types.ts"), "root_named_twice-abs"],
  ]) {
    const outDir = path.join(buildDir, "link", outName);
    fs.rmSync(outDir, { recursive: true, force: true });
    const exe = path.join(outDir, "app");
    const r = spawnSync(NISH, ["main.ts", second, "-o", `${outDir}${path.sep}`, "--link", exe], {
      cwd: twiceDir,
      encoding: "utf8",
    });
    const wroteTypes = r.stderr.split("\n").filter((l) => l.startsWith("wrote ") && l.endsWith("types.ll"));
    const run = r.status === 0 ? spawnSync(exe) : { status: null };
    check(
      `link/root_named_twice: \`main.ts\` and \`types.ts\` named as ${label} are one module, written once, exit 7`,
      r.status === 0 && wroteTypes.length === 1 && run.status === 7,
      `compile exit ${r.status}, run exit ${run.status}\n${r.stderr}`
    );
  }
}

/**
 * Compile `entry` **by absolute path** and pin the first line of the `.ll` the
 * import produced. Compiling by absolute path is what tells a name resolved
 * against the entry apart from one resolved against the working directory:
 * under a relative entry the two answers are the same string.
 *
 * The fixture's existence is part of the assertion rather than a guard around
 * it. Wrapped in `if (fs.existsSync(entry))` the check would vanish when
 * somebody renamed the fixture — no failure, no SKIP, no line in the summary —
 * which is the silence WP19 §A7 is about.
 */
const pinsModuleId = (title, entry, outName, imported, want) => {
  const present = fs.existsSync(entry);
  const absOut = path.join(buildDir, "link", outName);
  fs.rmSync(absOut, { recursive: true, force: true });
  fs.mkdirSync(absOut, { recursive: true });
  const r = present
    ? spawnSync(NISH, [entry, "-o", `${absOut}${path.sep}`], { cwd: root, encoding: "utf8" })
    : { status: 1, stderr: `no such fixture: ${path.relative(root, entry)}\n` };
  const file = path.join(absOut, imported);
  const header = r.status === 0 && fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n")[0] : "";
  check(title, present && header === want, `--- expected\n${want}\n--- actual\n${header}\n${r.stderr}`);
};

// An imported module's name — the one in its `ModuleID`, its `source_filename`
// and its `DIFile` — is the specifier resolved against the name the *importer*
// was given, never against the working directory. Two things ride on that: the
// emitted IR does not change with the directory the compiler was run from, and
// the self-hosted compiler can produce the same bytes without a `cwd` builtin
// it has no room for (WP19 §A3). Compiling the same program by absolute path
// is what tells the two rules apart: cwd-relative naming would answer
// `tests/link/diamond/b.ts` where this answers the absolute path the entry
// carried.
pinsModuleId(
  "link/diamond: an imported module is named from the entry's own path, not from cwd",
  path.join(linkDir, "diamond", "main.ts"),
  "diamond-abs",
  "b.ll",
  `; ModuleID = '${path.join(linkDir, "diamond", "b.ts")}'`
);

// The same rule for a `nish/` specifier, and it is deliberately a *different*
// rule: a standard-library module does not resolve against the importer, it
// resolves against the package this compiler shipped in, so its name is
// package-relative and depends on neither the importer nor the cwd. Naming it
// from the importer was the same string under a relative entry and the whole
// checkout path under an absolute one, which is why the corpus never saw it
// and 37 rows of `--parity` did (WP19 §A3, and §A5 on why that gap keeps
// happening). `self/std_modules.ts` writes the rule down for stage1 and its
// comment asserts this one; this check is what keeps that sentence true.
pinsModuleId(
  "link/std_bare_specifier: a `nish/` module is named package-relative, whatever the entry was called",
  path.join(linkDir, "std_bare_specifier", "main.ts"),
  "std-bare-abs",
  "testing.ll",
  "; ModuleID = 'std/testing.ts'"
);

/** The `.ll` files an output directory holds, in name order. */
const llFilesIn = (dir) =>
  fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".ll")).sort() : [];

// WP21 S2: `node_modules` above the working directory. `tests/link/package_above`
// is the ordinary npm layout — the manifest beside `src/`, not inside it — compiled
// the ordinary way, `nish main.ts` from `src/`, so the entry is relative and the
// package is two directories up. stage0 resolves an absolute path and climbs to
// `/`; stage1 has no `process.cwd()` to build one from (WP19 §A3) and has to climb
// past `.` by spelling `..`. This is the case that tells a walk that stops at `.`
// from one that does not, and the WP14 section below runs the same fixture through
// the self-hosted compiler and diffs the IR byte for byte.
const aboveDir = path.join(linkDir, "package_above");
if (fs.existsSync(path.join(aboveDir, "src", "main.ts"))) {
  const outDir = path.join(buildDir, "link", "package_above") + path.sep;
  fs.rmSync(outDir, { recursive: true, force: true });
  const exe = path.join(buildDir, "link", "package_above-app");
  const r = spawnSync(
    NISH,
    ["main.ts", "-o", outDir, "--link", exe],
    { cwd: path.join(aboveDir, "src"), encoding: "utf8" }
  );
  const ir =
    r.status === 0
      ? llFilesIn(outDir)
          .map((f) => fs.readFileSync(path.join(outDir, f), "utf8"))
          .join("\n")
      : "";
  const missing = fs
    .readFileSync(path.join(aboveDir, "expected.ir"), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !ir.includes(l));
  check(
    "link/package_above: a package above the working directory resolves, with its package prefix",
    r.status === 0 && missing.length === 0,
    r.status === 0 ? missing.map((l) => `missing: ${l}`).join("\n") : `${r.stdout}${r.stderr}`
  );
  if (r.status === 0) {
    const run = spawnSync(exe);
    const want = Number(fs.readFileSync(path.join(aboveDir, "expected.code"), "utf8").trim());
    check(
      `link/package_above: exits with ${want}`,
      run.status === want,
      `exit ${run.status}: ${run.stdout}${run.stderr}`
    );
  }
}

// WP21 S2: a `node_modules` *ancestor*, which is the one directory the walk
// cannot always name. Node steps over a directory already called `node_modules`
// rather than searching it, so `node_modules/node_modules/zed` is a package Node
// never finds — and neither compiler finds it either wherever the importing
// module's own name spells that ancestor, which is the second run below, from
// the fixture root. The first run is the same tree compiled from inside
// `node_modules/app`, where the name is `.` and the ancestor is `..`: a
// directory named without being named, which stage1 has no `process.cwd()`
// (WP19 §A3) and no `statSync` to resolve. Both compilers therefore search it
// and both find the package — the same answer from both, which is the property
// the oracles protect, in a tree npm does not produce
// (`docs/wp21-packages.md` §10a). The WP14 section below runs the same fixture
// through the self-hosted compiler and diffs the IR.
//
// The fixture has no `main.ts` at its top, so the loop above never picks it up:
// `expected.code` and `expected.ir` belong to the run from inside and
// `expected.err` to the run from the root.
const doubledDir = path.join(linkDir, "package_doubled");
const doubledApp = path.join(doubledDir, "node_modules", "app");
if (fs.existsSync(path.join(doubledApp, "main.ts"))) {
  const outDir = path.join(buildDir, "link", "package_doubled") + path.sep;
  fs.rmSync(outDir, { recursive: true, force: true });
  const exe = path.join(buildDir, "link", "package_doubled-app");
  const inside = spawnSync(
    NISH,
    ["main.ts", "-o", outDir, "--link", exe],
    { cwd: doubledApp, encoding: "utf8" }
  );
  const ir =
    inside.status === 0
      ? llFilesIn(outDir)
          .map((f) => fs.readFileSync(path.join(outDir, f), "utf8"))
          .join("\n")
      : "";
  const missing = fs
    .readFileSync(path.join(doubledDir, "expected.ir"), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !ir.includes(l));
  check(
    "link/package_doubled: an ancestor the name cannot spell is searched, so the package resolves",
    inside.status === 0 && missing.length === 0,
    inside.status === 0 ? missing.map((l) => `missing: ${l}`).join("\n") : `${inside.stdout}${inside.stderr}`
  );
  if (inside.status === 0) {
    const run = spawnSync(exe);
    const want = Number(fs.readFileSync(path.join(doubledDir, "expected.code"), "utf8").trim());
    check(
      `link/package_doubled: exits with ${want}`,
      run.status === want,
      `exit ${run.status}: ${run.stdout}${run.stderr}`
    );
  }
  const needle = fs.readFileSync(path.join(doubledDir, "expected.err"), "utf8").trim();
  const named = spawnSync(NISH, [path.join("node_modules", "app", "main.ts"), "-o", outDir], {
    cwd: doubledDir,
    encoding: "utf8",
  });
  check(
    `link/package_doubled: named from the root, the ancestor is stepped over: "${needle}"`,
    named.status === 1 && named.stderr.includes(needle),
    named.stderr || "(compiled successfully)"
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
    const r = spawnSync(NISH, [file, "-o", out], { cwd: root, encoding: "utf8" });
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
  const generic = twin("gen_twin", `const same = <T>(x: T, n: i32): T => ${body};\n\nexport const test = (): number => {\n  console.log(same(7, 1));\n  return 0;\n};\n`);
  const plain = twin("mono_twin", `const same = (x: i32, n: i32): i32 => ${body};\n\nexport const test = (): number => {\n  console.log(same(7, 1));\n  return 0;\n};\n`);
  const got = generic.ir ? defineOf(generic.ir, "same$i32") : "";
  const want = plain.ir ? defineOf(plain.ir, "same").replace("@same(", "@same$i32(") : "";
  check(
    "generics: an instantiation's `define` is the hand-written monomorphic twin's, symbol aside",
    want.length > 0 && got === want,
    `--- monomorphic\n${want}\n--- instantiated\n${got}\n${generic.error ?? ""}${plain.error ?? ""}`
  );
  // WP18 G8: the same promise for a generic *method*. `Chooser.pick<i32>` is
  // the method somebody would have written as `pickI32`, with `this` first and
  // the same body, and nothing about it may differ but the symbol.
  const methodBody = `{
    let total = 0;
    for (let i = 0; i < 4; i++) {
      total = total + i;
    }
    return this.flip ? b : a;
  }`;
  const methodMain = (call) =>
    `export const test = (): number => {\n  const c = new Chooser();\n  console.log(${call});\n  return 0;\n};\n`;
  const genericMethod = twin(
    "gen_method_twin",
    `class Chooser {\n  flip: boolean = false;\n\n  pick<T>(a: T, b: T): T ${methodBody}\n}\n\n${methodMain("c.pick(7, 1)")}`
  );
  const plainMethod = twin(
    "mono_method_twin",
    `class Chooser {\n  flip: boolean = false;\n\n  pickI32(a: i32, b: i32): i32 ${methodBody}\n}\n\n${methodMain("c.pickI32(7, 1)")}`
  );
  const gotMethod = genericMethod.ir ? defineOf(genericMethod.ir, "Chooser.pick$i32") : "";
  const wantMethod = plainMethod.ir
    ? defineOf(plainMethod.ir, "Chooser.pickI32").replace("@Chooser.pickI32(", "@Chooser.pick$i32(")
    : "";
  check(
    "generics: a generic method's instantiation is the hand-written method's `define`, symbol aside",
    wantMethod.length > 0 && gotMethod === wantMethod,
    `--- monomorphic\n${wantMethod}\n--- instantiated\n${gotMethod}\n${genericMethod.error ?? ""}${plainMethod.error ?? ""}`
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
/** How many bounds checks function `fn` of module `ir` carries: its `nish_panic_index` calls. */
const panicCount = (ir, fn) =>
  ((ir.match(new RegExp(`define[^\\n]*@${fn}\\b[\\s\\S]*?\\n}`))?.[0] ?? "").match(/call void @nish_panic_index/g) ?? [])
    .length;

// #183: a function that can reach `nish_panic_index` through an unproven
// `charCodeAt` is not `willreturn`. With the attribute on `main`, the speed
// profile's optimiser deleted the loop that panics and the program exited 0.
// The link goes through `--profile speed` itself rather than `linkNative`, so
// the check covers the pipeline a user's build runs.
if (has("clang") && (!only || "attr_panic_charcodeat".includes(only))) {
  const exe = path.join(buildDir, "attr_panic_charcodeat");
  const link = spawnSync(
    NISH,
    [path.join(casesDir, "attr_panic_charcodeat.ts"), "--link", exe, "--profile", "speed"],
    { cwd: root, encoding: "utf8" }
  );
  const run = link.status === 0 ? spawnSync(exe, { encoding: "utf8" }) : null;
  check(
    "attr_panic_charcodeat: --profile speed keeps the panic of an unproven charCodeAt (exit 1, `5 >= 0`)",
    run !== null &&
      run.status === 1 &&
      run.stderr.includes("index out of range: 5 >= 0") &&
      run.stdout.trim() === "before",
    run ? `exit ${run.status}\nstdout: ${run.stdout}\nstderr: ${run.stderr}` : link.stderr
  );
}

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
  if (fs.existsSync(panicLl)) {
    const exe = path.join(buildDir, "arr_bounds_panic");
    const cc = linkNative(exe, panicLl);
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
  if (fs.existsSync(shrinkLl)) {
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
  // #106: a length fact keyed by a property path (`h.xs`, `this.state.idx`) is
  // only as sound as the rules that drop it, so each rule has a program that
  // proves `i < h.xs.length`, breaks it by that rule alone, and reads `h.xs[i]`
  // anyway. Every one must still panic. Each was checked against a compiler
  // with its rule removed, where it reads past the array instead of panicking.
  for (const [name, rule, stdout] of [
    ["arr_path_callee_pop", "a `pop` through a callee", "2 1"],
    ["arr_path_callee_string", "a callee's store to a string field", "97"],
    ["arr_path_reassign", "a store to `h.xs` in the loop", "1"],
    ["arr_path_alias_shrink", "a `pop` through a second holder", "1"],
    ["arr_path_alias_store", "a store to `xs` through an alias of `h`", "1"],
    ["arr_path_record_store", "a whole-record store over the root's element", "1"],
    ["arr_path_root", "a reassignment of the root", "1"],
    ["arr_path_nullable", "a rebind of a root declared `Holder | null`", "1"],
  ]) {
    const ll = path.join(buildDir, `${name}.ll`);
    if (!fs.existsSync(ll)) continue;
    const exe = path.join(buildDir, name);
    const cc = linkNative(exe, ll);
    const run = cc.status === 0 ? spawnSync(exe) : null;
    check(
      `${name}: ${rule} drops the path fact, so the next access panics`,
      run !== null &&
        run.status === 1 &&
        String(run.stderr).includes("index out of range: 1 >= 1") &&
        String(run.stdout).trim() === stdout,
      run ? `exit ${run.status}\nstdout: ${run.stdout}\nstderr: ${run.stderr}` : String(cc.stderr)
    );
  }
  // Two orderings the walk got wrong for locals before paths existed, and paths
  // then inherited (#179's review). A later `&&` / `||` operand's effects have
  // to kill an earlier operand's facts, and `a[i] = v` reads `i` before `v` and
  // checks after it. Each program proves an index, breaks the proof inside the
  // condition or the stored value, and reads or writes anyway; each read past
  // the array, or wrote a million slots past it, before the fix.
  for (const [name, rule, stdout, message] of [
    ["arr_path_cond_call", "a call in a later `&&` operand", "", "5 >= 1"],
    ["arr_path_cond_store", "a field store in a later `&&` operand", "", "5 >= 1"],
    ["arr_path_cond_root", "a root reassignment in a later `&&` operand", "", "5 >= 1"],
    ["arr_path_cond_or", "a call in a later `||` operand", "", "5 >= 1"],
    ["arr_path_cond_ternary", "a call in a later operand of a ternary's test", "", "5 >= 1"],
    ["arr_path_cond_while", "a call in a later operand of a `while` test", "1", "1 >= 1"],
    ["arr_path_cond_string", "a string field replaced by a later operand", "", "3 >= 1"],
    ["arr_path_cond_generic", "a call in a later operand, in a generic class", "", "5 >= 1"],
    ["arr_path_cond_f64", "a call in a later operand, under --number-mode f64", "", "5 >= 1"],
    ["arr_bounds_cond_effect", "a `pop` in a later operand, on a local", "", "2 >= 2"],
    ["arr_bounds_cond_assign", "a rebind in a later operand, on a local", "", "2 >= 1"],
    ["arr_path_store_rhs", "`h.xs[i] = (i = 0)`", "", "1000000 >= 3"],
    ["arr_path_store_rhs_field", "`g.hs[i].n = (i = 0)`", "", "1000000 >= 2"],
    ["arr_path_store_rhs_compound", "`h.xs[i] += (i = 2)`", "", "1000000 >= 3"],
    ["arr_bounds_store_rhs", "`xs[i] = (i = 0)` on a local", "", "1000000 >= 3"],
    // #181: a `continue` reaches the `for` update or the `do/while` condition
    // with its branch's effects applied, so those are judged from the join of
    // every `continue` and the end of the body.
    ["arr_path_continue_for", "a field store before `continue`, in a `for` update", "", "7 >= 1"],
    ["arr_bounds_continue_for", "a rebind before `continue`, in a `for` update, on a local", "", "7 >= 1"],
    ["arr_path_continue_do", "a call before `continue`, in a `do/while` condition", "", "3 >= 1"],
    ["arr_bounds_continue_do", "a rebind before `continue`, in a `do/while` condition, on a local", "", "3 >= 1"],
    ["arr_bounds_continue_nested", "an outer `continue` before an inner loop with its own", "", "7 >= 1"],
    ["arr_bounds_continue_switch", "a `continue` inside a `switch` clause", "", "7 >= 1"],
    // #181's `break` counterpart: a `break` leaves a `for` or `while` past the
    // condition that re-established a fact, so the state after the loop is the
    // join of the condition's exit and every `break`.
    ["arr_bounds_break_for", "a move before `break`, after a `for` condition", "", "1000 >= 3"],
    ["arr_bounds_break_while", "a rebind before `break`, after a `while` condition", "", "5 >= 1"],
    ["arr_bounds_break_for_string", "a bound moved before a guarded `break`, on a string", "", "3 >= 3"],
    ["arr_bounds_break_while_string", "a bound moved before `break`, on a string", "", "50 >= 3"],
    // #182: an argument evaluated on the `Err` path alone proves nothing after the call.
    ["arr_bounds_lazy_unwrap_or", "an `unwrapOr` fallback that did not run", "", "50 >= 3"],
    ["arr_bounds_lazy_expect", "an `expect` message that did not run", "", "50 >= 3"],
    // #180: the header hoist counts a whole-record store the way the proof does.
    ["arr_header_hoist_record_store", "a whole-record store under a hoisted `const` view", "1", "1 >= 1"],
    ["arr_header_hoist_record_view", "a whole-record store under a class field's view", "", "1 >= 1"],
    // A generic's instantiations are proved against their own verdicts: one
    // that stores a pointer or a value proves `r.xs[i]`, the `Rec` one must not.
    ["arr_bounds_generic_instances", "a record store in `walk<Rec>`, beside `walk<Box>`", "15", "1 >= 1"],
    ["arr_bounds_generic_instances_prim", "a record store in `walk<Rec>`, beside `walk<i32>`", "15", "1 >= 1"],
    ["arr_bounds_generic_instances_method", "a record store in `Store<Rec>.walk`, beside `Store<Box>`", "15", "1 >= 1"],
    ["arr_bounds_generic_instances_iface", "a record store through `Cell<Rec>`, beside `Cell<string>`", "15", "1 >= 1"],
  ]) {
    const ll = path.join(buildDir, `${name}.ll`);
    if (!fs.existsSync(ll)) continue;
    const exe = path.join(buildDir, name);
    // The f64 case exports `test`, so it is driven the way a `.out` case is.
    const hasMain = /\bexport\s+const\s+main\s*=/.test(fs.readFileSync(path.join(casesDir, `${name}.ts`), "utf8"));
    const cc = linkNative(exe, ll, { driver: hasMain ? null : DRIVER_C });
    const run = cc.status === 0 ? spawnSync(exe) : null;
    check(
      `${name}: ${rule} takes the proof away, so the access panics`,
      run !== null &&
        run.status === 1 &&
        String(run.stderr).includes(`index out of range: ${message}`) &&
        String(run.stdout).trim() === stdout,
      run ? `exit ${run.status}\nstdout: ${run.stdout}\nstderr: ${run.stderr}` : String(cc.stderr)
    );
  }
  // #180's rule stops at inline records: an element store into an array of
  // classes stores a pointer, so `this.src` and `this.nodes` keep their headers
  // in the preheader and the loop reloads no field of `this`.
  const classStoreLl = path.join(buildDir, "arr_header_hoist_record_class.ll");
  if (fs.existsSync(classStoreLl)) {
    const ir = fs.readFileSync(classStoreLl, "utf8");
    const fn = ir.slice(ir.search(/^define[^\n]*@Grid\.sumAndStamp\(/m));
    const body = fn.slice(fn.indexOf("for.cond:"), fn.indexOf("\n}\n"));
    const reloads = (body.match(/load %struct\.nish_array\*/g) || []).length;
    check(
      "arr_header_hoist_record_class: a class-element store leaves both headers hoisted",
      reloads === 0,
      `${reloads} array header loads inside the loop`
    );
  }
  // And it stops at what the store can reach: a whole-record store into `rs`
  // rewrites a `Rec` slot, and `g.src` is read off a class, so its header stays
  // in the preheader.
  const classRootLl = path.join(buildDir, "arr_header_hoist_record_class_root.ll");
  if (fs.existsSync(classRootLl)) {
    const ir = fs.readFileSync(classRootLl, "utf8");
    const fn = ir.slice(ir.search(/^define[^\n]*@stamp\(/m));
    const body = fn.slice(fn.indexOf("for.cond:"), fn.indexOf("\n}\n"));
    const reloads = (body.match(/load %struct\.nish_array\*/g) || []).length;
    check(
      "arr_header_hoist_record_class_root: a record store leaves a class-rooted header hoisted",
      reloads === 0,
      `${reloads} array header loads inside the loop`
    );
  }
  // The declared-type rule on its own: `narrowed` and `plain` are one loop over
  // a `Holder | null` narrowed by a guard and over a `Holder`. Only the second
  // may lose its check. The round trip above cannot show this, because the
  // root rule catches the same program; this is the rule by itself.
  const nullableLl = path.join(buildDir, "arr_path_nullable.ll");
  if (fs.existsSync(nullableLl)) {
    const ir = fs.readFileSync(nullableLl, "utf8");
    const panics = (fn) => panicCount(ir, fn);
    check(
      "arr_path_nullable: a path from a root declared `Holder | null` keeps its check, and the same path from a `Holder` does not",
      panics("narrowed") === 1 && panics("plain") === 0,
      `narrowed ${panics("narrowed")} bounds checks, plain ${panics("plain")}`
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
    // WP15 §2b: the hoist above is not the whole of what the domains bought. The loop
    // vectorises as well -- which §2c had read as something only an invariant header
    // could buy ("3.23x, and it vectorises"), and which main reaches without one on
    // this shape, a loop over two array *parameters*. Be clear about what this pins and
    // what it does not: it pins §2b's banked win against going quiet -- the way that
    // would happen is a header load creeping back into the loop and taking LICM, and
    // the vectoriser, with it -- and it says nothing about WP15 item 1b, which is open
    // for candidate 2 on a shape this case does not have. That shape is the same loop
    // with the array in a class field, it is 2.48x short of this one, and its
    // acceptance program is written out in wp15-performance.md §2c rather than living
    // here, because a corpus case is compiled by both compilers and diffed against a
    // golden, which is a poor place to keep a number nobody has earned yet.
    check(
      "arr_alias_domains: opt -O2 vectorises the element loop (<4 x i32> or <8 x i32>)",
      o.status === 0 && /<(4|8) x i32>/.test(body),
      o.status === 0 ? body : String(o.stderr)
    );
    // WP15 §2c's criterion, pinned for the first time. Vectorising is the
    // *consequence*; what makes it possible is that the two lengths this loop
    // compares against — `src.length` for the `while` and `dst.length` for the
    // bounds check — collapse into a single trip count in the preheader, so the
    // loop has one exit. `llvm.umin.i64` is that collapse, by name. §2c reached
    // "no header load left in the loop" by hand, with metadata, and measured the
    // program 5 ms *slower*, because two lengths were still two lengths; the
    // `umin` is the thing that was actually different about the fast builds, and
    // nothing here asserted it until now.
    check(
      "arr_alias_domains: opt -O2 collapses the two lengths into one trip count (llvm.umin)",
      o.status === 0 && /call i64 @llvm\.umin\.i64\(/.test(body),
      o.status === 0 ? body : String(o.stderr)
    );
  }

  // An element store cannot write the class field that holds the array, and the
  // element's own `!tbaa` tag is what tells LLVM so (`elementTbaa`, self/tbaa.ts).
  // Without it `opt -O3` reloads `this.v` and its `data` after `this.v[i] = ...` in
  // AWFY Permute's swap: two field loads (before the repeated checks were proven in
  // `self/bounds.ts` it reloaded the length too and checked `j` a second time). With
  // it the swap loads the field once and the length once. The two checks left are
  // `i`'s and `j`'s, and they must stay on: a swap with none passes nothing it
  // should. The field load is the one `load ptr` that carries `!tbaa` and no alias
  // scope (elements carry both, header fields only the scope); the length is the
  // header's `load i64`.
  const reloadLl = path.join(buildDir, "arr_field_reload.ll");
  if (has("opt") && fs.existsSync(reloadLl)) {
    const o = spawnSync("opt", ["-O3", "-S", "-mtriple=x86_64-unknown-linux-gnu", reloadLl]);
    const body = String(o.stdout).match(/define[^\n]*@Swap\.swap\b[\s\S]*?\n}/)?.[0] ?? "";
    const fieldLoads = body.match(/= load ptr, ptr %\w+, align 8, !tbaa ![0-9]+\n/g) ?? [];
    const lengthLoads = body.match(/= load i64, ptr %\w+, align 8, !alias\.scope/g) ?? [];
    const checks = body.match(/call void @nish_panic_index\(/g) ?? [];
    check(
      "arr_field_reload: opt -O3 loads the field and its length once in the swap, and keeps exactly two checks",
      o.status === 0 &&
        body !== "" &&
        fieldLoads.length === 1 &&
        lengthLoads.length === 1 &&
        checks.length === 2,
      o.status === 0
        ? `field loads ${fieldLoads.length}, length loads ${lengthLoads.length}, checks ${checks.length}\n${body}`
        : String(o.stderr)
    );
  }

  // WP15 §2c candidate 2: the emitter lifts an array header into the loop's
  // preheader. Two things are asserted and they are not the same thing.
  //
  // The first is the hoist: no load in the *header* alias domain is left inside
  // `@fieldScale`'s loop. §2b's domains do not reach this shape on their own,
  // because the header load sits in a bounds-checked block where LLVM may not
  // speculate it out — which is exactly what §2c found in `self/bounds.ts`.
  //
  // The second is §2c's criterion, and it is the one that matters: the `len` the
  // `while` condition compares against and the `len` the bounds check compares
  // against must be *the same SSA value*. A preheader load per use satisfies
  // "hoisted once per loop" and buys nothing, because two lengths are two loop
  // exits whatever they were loaded from. One value is the emitter saying so by
  // construction rather than hoping GVN merges them.
  const hoistLl = path.join(buildDir, "arr_header_hoist.ll");
  if (fs.existsSync(hoistLl)) {
    const ir = fs.readFileSync(hoistLl, "utf8");
    // `!alias.scope !N` where !N is the header scope list; read the number out
    // of the metadata rather than assuming it, since nodes are interned per
    // module and a new one anywhere would renumber them.
    const headerNode = ir.match(/^(![0-9]+) = !\{!"header",/m)?.[1];
    const headerScope = headerNode
      ? ir.match(new RegExp(`^(![0-9]+) = !\\{${headerNode.replace("!", "!")}\\}$`, "m"))?.[1]
      : undefined;
    for (const fn of ["fieldScale", "constScale"]) {
      const body = ir.match(new RegExp(`define[^\\n]*@${fn}\\b[\\s\\S]*?\\n}`))?.[0] ?? "";
      const loop = body.slice(body.indexOf("\nwhile.cond:"));
      const left = headerScope
        ? (loop.match(new RegExp(`= load [^\\n]*!alias\\.scope ${headerScope}(?![0-9])`, "g")) ?? [])
        : [];
      check(
        `arr_header_hoist: @${fn} has no array-header load inside the loop`,
        headerScope !== undefined && body !== "" && loop !== "" && left.length === 0,
        `header scope ${headerScope}, left in the loop: ${left.join(" | ") || "(none)"}\n${body}`
      );
    }
    // §2c's criterion — one length value feeding the loop condition and every
    // check that reads that array — is now met by there being *no* check on
    // `h.xs` at all: `self/bounds.ts` keys length facts by property path too
    // (#106), so `h.xs.length` proves `h.xs[i]` the way `xs.length` proves
    // `xs[i]`. What is pinned is the strongest form of that: `@fieldScale`'s
    // loop *is* `@constScale`'s, instruction for instruction once the registers
    // are numbered from the top of the loop. The condition reads the preheader's
    // `len`, and the one check left is `dst`'s, in both.
    const loopOf = (fn) => {
      const body = ir.match(new RegExp(`define[^\\n]*@${fn}\\b[\\s\\S]*?\\n}`))?.[0] ?? "";
      const loop = body.slice(body.indexOf("\nwhile.cond:"));
      const names = new Map();
      return loop.replace(/%[0-9]+\b/g, (r) => {
        if (!names.has(r)) {
          names.set(r, `%v${names.size}`);
        }
        return names.get(r);
      });
    };
    const fieldLoop = loopOf("fieldScale");
    const constLoop = loopOf("constScale");
    check(
      "arr_header_hoist: @fieldScale's loop is @constScale's, register for register",
      fieldLoop.includes("while.cond:") && fieldLoop === constLoop,
      `fieldScale:\n${fieldLoop}\nconstScale:\n${constLoop}`
    );
    // And the gap #104 measured and #106 closed, as a count so that it cannot
    // silently reopen: `const xs = h.xs` and `h.xs` carry the same checks. Before
    // #106 `fieldScale` carried two and `constScale` one, and the second was the
    // second loop exit that kept the vectoriser away.
    const panics = (fn) => panicCount(ir, fn);
    check(
      "arr_header_hoist: the checker's proof reaches @fieldScale's element read as it does @constScale's",
      panics("constScale") === 1 && panics("fieldScale") === panics("constScale"),
      `constScale ${panics("constScale")} bounds checks, fieldScale ${panics("fieldScale")}`
    );
    // A `Holder | null` narrowed by a guard *inside* the loop: the preheader is
    // outside that guard, so the path is refused on its *declared* type. Reading
    // the type the checker records at the use site -- the narrowed one -- made
    // this a null dereference in the preheader of a loop that runs zero times.
    // The `.out` catches that by running; this says which property broke.
    const guarded = ir.match(/define[^\n]*@guarded\b[\s\S]*?\n}/)?.[0] ?? "";
    check(
      "arr_header_hoist: @guarded narrows a `Holder | null` in the loop, so nothing is lifted above the guard",
      guarded !== "" && !guarded.slice(0, guarded.indexOf("\nwhile.cond:")).includes("getelementptr"),
      guarded
    );
    // The two refusals that are about the *path* rather than the header. Each is
    // a proof that could otherwise break in silence, since the hoist they refuse
    // is the one that reads a stale field load.
    //
    // `@replaced` stores `h.xs` inside the loop it reads `h.xs[i]` in, so the
    // path is shadowed by name and nothing is lifted. `@declaredInside` roots
    // its path at a `const` the loop body declares, which the preheader runs
    // before -- and it is the discriminating case, because `hs` *is* a
    // parameter and *is* hoisted in the same preheader: the refusal is per path,
    // not a blanket refusal of the loop. So both assert on the field *GEP*
    // specifically: a bare `getelementptr` would catch the array header `hs`
    // legitimately contributes, and a bare `%struct.Holder` would catch the
    // parameter's own type in the `define` line and the `alloca` of the local.
    for (const fn of ["replaced", "declaredInside"]) {
      const body = ir.match(new RegExp(`define[^\\n]*@${fn}\\b[\\s\\S]*?\\n}`))?.[0] ?? "";
      const preheader = body.slice(0, body.indexOf("\nwhile.cond:"));
      check(
        `arr_header_hoist: @${fn} refuses the path, so no \`Holder.xs\` load is lifted above the loop`,
        body !== "" && preheader !== "" && !preheader.includes("getelementptr inbounds %struct.Holder"),
        body
      );
      if (fn === "declaredInside") {
        // The positive half, and the half that makes this case discriminating.
        // Without it a regression to "hoist nothing in this loop at all" would
        // leave the preheader even freer of `%struct.Holder` and the check
        // above would still pass. `hs` is a parameter, it is indexed in the
        // loop, and it *is* lifted — under `--plain`, which turns this pass
        // off, this entry block holds no `getelementptr` at all and `hs`'s
        // header GEP appears twice inside the loop body instead.
        check(
          "arr_header_hoist: @declaredInside still hoists `hs`, so the refusal is per path and not per loop",
          preheader.includes("getelementptr inbounds %struct.nish_array, %struct.nish_array* %hs"),
          body
        );
      }
    }
    // The other half of the fact: a loop that grows the array it reads may not
    // be hoisted at all, because `push` is what moves `len`, `cap` and `data`.
    const grown = ir.match(/define[^\n]*@grown\b[\s\S]*?\n}/)?.[0] ?? "";
    const grownLoop = grown.slice(grown.indexOf("\nwhile.cond:"));
    check(
      "arr_header_hoist: @grown pushes in the loop, so nothing is hoisted out of it",
      grown !== "" && grownLoop.includes("getelementptr inbounds %struct.nish_array"),
      grown
    );
  }
  if (has("opt")) {
    const uncheckedLl = path.join(buildDir, "arr_sum_unchecked.ll");
    const c = spawnSync(
      NISH,
      [path.join(casesDir, "arr_sum.ts"), "--unchecked-indexing", "-o", uncheckedLl],
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
  if (fs.existsSync(slicePanicLl)) {
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
    NISH,
    [path.join(casesDir, "mem_stack_struct.ts"), "--no-stack-alloc", "-o", noStackLl],
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
  if (ns.status === 0) {
    const exe = path.join(buildDir, "mem_stack_struct_nostack");
    const cc = linkNative(exe, noStackLl);
    const run = cc.status === 0 ? spawnSync(exe) : null;
    check(
      "mem_stack_struct with --no-stack-alloc prints the same output",
      run !== null && String(run.stdout).trim() === "21\n7\n22",
      run ? String(run.stdout) + String(run.stderr) : String(cc.stderr)
    );
  }
  const scopeExe = path.join(buildDir, "mem_scope_dynamic_array");
  if (fs.existsSync(scopeExe)) {
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
// `isAllocatingBuiltin` in self/escape.ts names the identifier builtins whose result is
// fresh arena memory. A builtin that belongs there and is missing is not a lost
// optimisation: the function that returns its result gets an automatic arena scope
// whose `nish_arena_release` runs before the `ret`, rewinding the arena past the bytes
// the caller is about to read. That shipped in 0.1.0 for `getenv` and printed a correct
// value that the next allocation overwrote, which is silent corruption rather than a
// crash (`tests/cases/mem_getenv_scope`, and `mem_read_or_null_scope` /
// `mem_readdir_scope` for the other two). Three cases pin three builtins; this pins the
// class, in two halves that are each derived rather than listed again:
//
//  1. **Which builtins allocate, mechanically.** A builtin allocates when its lowering
//     calls a runtime callee whose declaration answers a pointer and is `noalias`. In
//     the runtime table `noalias` means "a fresh allocation per call", which is exactly
//     the property the set is about, and it is the reason the two pointer-answering
//     non-allocators are not candidates: `nish_platform` hands back the same constant
//     and is deliberately not `noalias`, and `process.argv` is `malloc`ed once by the
//     entry wrapper (neither is an identifier builtin either). The builtins are the ones
//     `isBuiltinFunction` in self/builtins.ts names, the callees of each are what
//     `identifierBuiltinCalleesNamed` in self/emit_builtins.ts answers for it -- the
//     list the attribute pass itself reads, so this asks the emitter rather than a copy
//     of the emitter -- and the table is the compiler's own, printed by
//     `--runtime-decls`.
//  2. **What membership buys, by compiling a probe.** For every builtin the signal
//     names, a generated program returns the builtin's result from a function that also
//     allocates locally -- the shape of `mem_getenv_scope` -- and the emitted IR must
//     contain no `nish_arena_release`.
//
// What this does not prove: that the C behind a `noalias` entry really bumps the arena
// (the table is where that fact is declared, and the interop section is what holds it to
// nish.h), and nothing about a hypothetical builtin that allocates through the inline
// allocator instead of a named runtime symbol -- a lowering like that would have to say
// so in its callees to keep its caller's attributes honest, and saying so is what this
// reads. The two source files are read as the compiler under test was built from them,
// so the halves cannot be describing two different compilers.
if (!only || "allocating builtins".includes(only) || only.startsWith("mem")) {
  const selfSource = (file) => fs.readFileSync(path.join(root, "self", file), "utf8");
  /** The text of `export const <name> = ...` or `const <name> = ...`, up to the next top-level `};` or `);`. */
  const declarationOf = (text, name) => {
    const at = text.search(new RegExp(`^(?:export )?const ${name}\\b`, "m"));
    if (at < 0) return null;
    const end = text.slice(at).search(/^\)?\};?$|^ {2}\);$/m);
    return end < 0 ? null : text.slice(at, at + end);
  };
  const namesTestedIn = (text) => [...(text ?? "").matchAll(/name === "([^"]+)"/g)].map((m) => m[1]);

  const builtinsDecl = declarationOf(selfSource("builtins.ts"), "isBuiltinFunction");
  const builtins = namesTestedIn(builtinsDecl);
  const emitBuiltins = selfSource("emit_builtins.ts");
  const calleesDecl = declarationOf(emitBuiltins, "identifierBuiltinCalleesNamed");
  /** The module's string constants, so `out.push(PARSE_RUNTIME)` reads as the symbol it names. */
  const constants = new Map(
    [...emitBuiltins.matchAll(/^const ([A-Z][A-Z0-9_]*): string = "([^"]*)";$/gm)].map((m) => [m[1], m[2]])
  );
  /** builtin -> the runtime symbols its lowering says it calls. */
  const calleesOf = new Map();
  for (const branch of (calleesDecl ?? "").matchAll(/if \(((?:name === "[^"]+"(?: \|\| )?)+)\) \{([\s\S]*?)return out;/g)) {
    const symbols = [...branch[2].matchAll(/out\.push\((?:"([^"]+)"|([A-Z][A-Z0-9_]*))\)/g)].map(
      (m) => m[1] ?? constants.get(m[2]) ?? `<unknown constant ${m[2]}>`
    );
    for (const name of namesTestedIn(branch[1])) calleesOf.set(name, symbols);
  }
  // Every builtin is read as having a branch in the callee table, or is one of the
  // two that lower to a single bitcast and call nothing. A builtin with neither
  // would read as "calls nothing, so allocates nothing" -- the silent miss this
  // guard exists to prevent -- so a branch this scan cannot see is a failure
  // naming the builtin, not a pass.
  const CALLS_NOTHING = new Set(["f64ToBits", "bitsToF64"]);
  const unread = builtins.filter((b) => !calleesOf.has(b) && !CALLS_NOTHING.has(b));
  check(
    `self/builtins.ts and self/emit_builtins.ts still read as a builtin list and a callee table ` +
      `(${builtins.length} builtins, ${calleesOf.size} with callees)`,
    builtins.length > 0 && calleesOf.size > 0 && unread.length === 0,
    unread.length > 0
      ? `no branch of identifierBuiltinCalleesNamed was read for ${unread.join(", ")}: teach this scan its ` +
          "shape, or name the builtin in CALLS_NOTHING if it really calls no runtime symbol"
      : "`isBuiltinFunction` or `identifierBuiltinCalleesNamed` moved or changed shape; this check reads both " +
          "by name, so point it at the new one"
  );

  // The runtime table, as the compiler under test declares it: every `declare`
  // `--runtime-decls` writes, by symbol.
  const declsLl = path.join(buildDir, "alloc_runtime_decls.ll");
  const decls = spawnSync(NISH, [path.join(casesDir, "string_params.ts"), "--runtime-decls", "-o", declsLl], {
    cwd: root,
    encoding: "utf8",
  });
  const runtimeByName = new Map(
    decls.status === 0
      ? [...fs.readFileSync(declsLl, "utf8").matchAll(/^(declare .*?@([\w.]+)\(.*\))(?: #\d+)?$/gm)].map((m) => [
          m[2],
          { name: m[2], signature: m[1] },
        ])
      : []
  );
  check(
    `--runtime-decls prints the runtime table (${runtimeByName.size} declarations)`,
    decls.status === 0 && runtimeByName.size > 0,
    decls.stderr
  );

  /** The `declare` line's return part: the attributes and the type, before the `@name(`. */
  const returnPart = (fn) =>
    fn.signature.slice("declare ".length, fn.signature.indexOf(`@${fn.name}(`)).trim();

  /** A fresh allocation per call: `noalias` on a pointer return, as the runtime table uses it. */
  const allocatesFreshMemory = (fn) => {
    const ret = returnPart(fn);
    return /\bnoalias\b/.test(ret) && /(?:i8\*|%struct\.nish_array\*)$/.test(ret);
  };

  /** builtin -> the first runtime symbol whose entry says the lowering allocates. */
  const allocating = new Map();
  const unknownSymbols = [];
  for (const builtin of builtins) {
    for (const symbol of calleesOf.get(builtin) ?? []) {
      // An LLVM intrinsic is an instruction, not a runtime call, and allocates nothing.
      if (symbol.startsWith("llvm.")) continue;
      const fn = runtimeByName.get(symbol);
      // A name the table does not know would read as "does not allocate", so the
      // signal is only as complete as this agreement.
      if (!fn) unknownSymbols.push(`${builtin} -> ${symbol}`);
      else if (allocatesFreshMemory(fn) && !allocating.has(builtin)) allocating.set(builtin, symbol);
    }
  }
  check(
    `every identifier builtin declares runtime callees the table knows (${builtins.length} builtins)`,
    unknownSymbols.length === 0,
    unknownSymbols.map((u) => `${u} is not in the runtime table (self/runtime.ts)`).join("\n")
  );

  // The set is read out of the source because it is private to escape.ts, which is
  // where it belongs: nothing but the escape analysis has any business consulting it.
  const declared = new Set(namesTestedIn(declarationOf(selfSource("escape.ts"), "isAllocatingBuiltin")));
  check(
    "self/escape.ts declares isAllocatingBuiltin as a test against a literal list of names",
    declared.size > 0,
    "the declaration moved or changed shape; this check reads it by name, so point it at the new one"
  );

  const missing = [...allocating].filter(([builtin]) => !declared.has(builtin));
  const stale = [...declared].filter((builtin) => !allocating.has(builtin));
  check(
    `isAllocatingBuiltin names every allocating builtin and nothing else (${[...allocating.keys()].join(", ")})`,
    missing.length === 0 && stale.length === 0,
    [
      ...missing.map(
        ([builtin, symbol]) =>
          `${builtin} allocates -- its lowering calls @${symbol}, whose declaration is a noalias pointer ` +
          `return, which in the runtime table means a fresh allocation per call -- but it is not in ` +
          `isAllocatingBuiltin in self/escape.ts. Add it there, or a function returning ${builtin}(...) ` +
          "gets an arena scope that releases the result before the ret. Add a tests/cases/mem_*_scope case for it " +
          "beside the other three while you are there.",
      ),
      ...stale.map(
        (builtin) =>
          `${builtin} is in isAllocatingBuiltin but nothing its lowering calls is a noalias pointer-returning ` +
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
    const fn = runtimeByName.get(symbol);
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
    const r = spawnSync(NISH, [probeTs, "-o", probeLl], { cwd: root });
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
  const r = spawnSync(NISH, [layoutTs, "-o", layoutLl, "--emit-header", layoutH], { cwd: root });
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
    // The fixture names its maker after the *LLVM* struct (`makeQ_i32` for
    // `Q$i32`), and the C twin after the C one, which for an instantiated
    // generic carries the reserved `nish_gen_` prefix `cStructName` gives it so
    // that `Q<i32>` cannot collide with a class called `Q_i32`.
    for (const [name, size] of fromC) {
      const inIr = fromIr.get(name.replace(/^nish_gen_/, ""));
      if (inIr !== size) diffs.push(`${name}: C ${size}, IR ${inIr}`);
    }
    check(
      `layout: compiler sizes match structs.c for ${fromC.size} structs (${[...fromC].map(([n, s]) => `${n}=${s}`).join(" ")})`,
      fromC.size === 18 && fromIr.size === 18 && diffs.length === 0,
      diffs.join("\n") || `IR sizes: ${JSON.stringify([...fromIr])}`
    );
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
    const exe = path.join(buildDir, "layout_structs");
    // Named as sources rather than linked against the prebuilt objects, and
    // that is the point: `-Wall -Wextra -Werror` on this line covers the two
    // runtime translation units as well as `structs.c`. Swapping them for
    // objects to save a third of a second would take the warning flags off
    // the runtime, which is a check, not an overhead.
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
    if (!fs.existsSync(ll)) continue;
    const exe = path.join(buildDir, name);
    const cc = linkNative(exe, ll, { libm: true });
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
// The two runtime unit tests below name the runtime's sources rather than the
// prebuilt objects, deliberately: what they assert *is* that the two
// translation units "compile warning-free together", so compiling them is the
// check and a cached object would skip it. Two links is what that costs.
if (!only) {
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
    "runtime.c, runtime_os.c and runtime_parallel.c compile warning-free together and pass the runtime unit test",
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
    "runtime.c -DNISH_THREADS: every thread gets its own arena and RNG seed, and a parallel range divides",
    rtThreadsRun !== null && rtThreadsRun.status === 0,
    String(rtThreads.stderr) + (rtThreadsRun ? String(rtThreadsRun.stdout) + String(rtThreadsRun.stderr) : "")
  );

  // Emit the runtime prelude, append an IR test that uses the inline allocator, and
  // link it against runtime.c: proves the IR struct layout matches the C struct.
  const preludeLl = path.join(buildDir, "prelude.ll");
  execFileSync(NISH, ["tests/cases/string_params.ts", "--runtime-decls", "-o", preludeLl], {
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
  execFileSync(NISH, ["tests/cases/string_params.ts", "--runtime-decls", "--threads", "-o", tlsPreludeLl], {
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
  // step by hand: thread-local IR linked against a runtime built without
  // -DNISH_THREADS must never be a program that *looks* like it works. A silent
  // mismatch -- the compiled code bumping one arena, the runtime owning
  // another, exit 0 and a plausible number -- is the one failure mode this
  // design could have had, so it is pinned rather than assumed.
  //
  // That property holds on both object formats and the *mechanism* is the
  // platform's. Both were measured rather than reasoned about, on
  // `macos-latest`, 2026-09-21:
  //
  //   ELF     `ld` refuses the link -- "TLS reference ... mismatches non-TLS
  //           definition" -- so there is no binary to run. This is the safety
  //           net scripts/build.sh's header describes.
  //   Mach-O  ld64 links it and clang exits 0, so the net build.sh describes
  //           is not there. It is not silent either: a thread-local read on
  //           Darwin goes through a TLV descriptor carrying the symbol's name,
  //           and `nm -m` on the result shows `_nish_arena` as
  //           `(__DATA,__common) external` -- a plain struct where the
  //           descriptor should be. The first allocation therefore calls the
  //           arena's own `buf` field as if it were the descriptor's thunk and
  //           the process dies: `Segmentation fault: 11`, exit 139. Linking
  //           the same two inputs with the macro on *both* sides prints
  //           `alloc_smoke delta = 16` and exits 0, which is what makes the
  //           crash the mismatch's rather than the fixture's.
  //
  // So what differs between the platforms is only how late the mismatch is
  // caught, and the check's name says which of the two caught it here. The
  // assertion accepts either, because a toolchain that started refusing the
  // link would be strengthening the net rather than breaking this claim.
  const mismatchExe = path.join(buildDir, "alloc_smoke_mismatch");
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
      mismatchExe,
    ],
    { cwd: root }
  );
  const refusedAtLink = mismatch.status !== 0 && /TLS|thread.local/i.test(String(mismatch.stderr));
  // Only reachable where the linker let it through; on ELF there is no file here.
  const ranMismatch = mismatch.status === 0 ? spawnSync(mismatchExe, [], { encoding: "utf8" }) : null;
  check(
    IS_MACHO
      ? "--threads IR against a runtime built without -DNISH_THREADS is never a working program (ld64 links it; the binary dies on its first allocation)"
      : "--threads IR refuses to link against a runtime built without -DNISH_THREADS (ld refuses the TLS reference)",
    refusedAtLink || (ranMismatch !== null && ranMismatch.status !== 0),
    mismatch.status === 0
      ? `it linked, and the binary it produced exited ${ranMismatch.status} on signal ${ranMismatch.signal}\n` +
        `with stdout ${JSON.stringify(ranMismatch.stdout)}. A --threads module against a runtime built\n` +
        "without the macro is then a program that looks like it works, with the compiled code bumping\n" +
        "one arena and the runtime owning another."
      : `the link failed, but over something other than the arena's storage class:\n` +
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
    // without a browser. The IR has to be the bytes the native compiler writes
    // for the same input, because a playground that emits *nearly* the right IR is worse than
    // no playground. This is also the end-to-end guard on the arena ABI: the
    // compiler allocates from compiled code on every node it parses, so a wasm32
    // layout that disagrees with the IR traps here long before it prints anything.
    const compilerWasm = path.join(buildDir, "nish.wasm");
    const linked = spawnSync(
      NISH,
      ["self/compile.ts", "--link", compilerWasm, "--profile", "wasi"],
      { cwd: root }
    );
    check(
      "web: self/ links into one wasi module (the compiler as nish.wasm)",
      linked.status === 0,
      String(linked.stderr)
    );
    if (linked.status === 0) {
      const referenceLl = path.join(buildDir, "web_add.ll");
      execFileSync(NISH, ["examples/add.ts", "-o", referenceLl], { cwd: root, stdio: "pipe" });
      const worker = spawnSync("node", ["web/compile.mjs", compilerWasm, "examples/add.ts"], { cwd: root });
      check(
        "web: nish.wasm in a worker emits the native compiler's IR for examples/add.ts, byte for byte",
        worker.status === 0 && String(worker.stdout) === fs.readFileSync(referenceLl, "utf8"),
        String(worker.stderr)
      );
    }
  } else {
    skip(`skipped: no WASI sysroot${has("wasm-ld") ? "" : " and no wasm-ld"} (set WASI_SYSROOT or install wasi-sdk, see docs/INSTALL.md): wasi profile not built`
    );
  }
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
 * Measured 1,251 bytes on 2026-09-14 with clang 18.1.3 on linux-x64 (`.text` 1,216 plus
 * `.text.unlikely.` 35, which is `nish_io_fail`), for the file I/O, the directory and
 * subprocess calls, `getenv`, the monotonic clock and the two constant host strings. It
 * was 1,190 until WP21 S2 put the `fstat`/`S_ISDIR` guard in `nish_read_file_or_null`,
 * which is 61 of those bytes and is what makes reading a directory answer null rather
 * than ask the arena for `LONG_MAX`.
 *
 * **Raised to 1,536 on 2026-09-20 by `nish_realpath`**, which is what the paragraph
 * that used to stand here said would happen: 29 bytes were left, a syscall wrapper does
 * not fit in 29 bytes, and the next one to reach into the operating system raises this
 * number in the commit that adds it rather than borrowing room from the arena to hide
 * in. Measured **1,347 bytes** (`.text` 1,312 plus `.text.unlikely.` 35) with clang 18
 * on linux-x64, so `nish_realpath` is **157** of them and the budget is the next
 * 256-byte boundary above the new measurement, leaving 189.
 *
 * 8 of those 157 are a portability choice worth its own number, because the cheaper
 * spelling is the wrong one. `realpath(p, NULL)` measures 1,339 and allocates the
 * result, which is POSIX 2008 -- but on Darwin it is the `__DARWIN_EXTSN` variant that
 * implements it, and which variant a translation unit binds depends on its
 * feature-macro level. A caller-supplied `PATH_MAX` buffer is defined for both, so it
 * is the spelling that cannot depend on that, and 8 bytes is what it costs.
 *
 * The two together are 5,120; they were 4,864, which was exactly the single budget they
 * replaced -- a coincidence then and not a constraint now.
 */
const RUNTIME_OS_TEXT_BUDGET = 1536;
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
/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c
 * runtime/runtime_parallel.c` -- the half that divides a range of work across
 * threads (WP20 T1, the stage under wp29's surface).
 *
 * Two rows, for the same reason the two above are two: the file compiles in both
 * configurations and they are not the same file. Without `-DNISH_THREADS` it is the
 * sequential fallback and measured **49 bytes** on 2026-09-18 with clang 18.1.3 on
 * linux-x64 -- one bounds test, a call, and the cached CPU count -- and the 207 bytes
 * of slack under the 256-byte boundary are not room to spend: the point of gating the default build is
 * that nothing but a fallback belongs in it, so a commit that needs the room has put
 * code on the path a program which never spawns still links.
 */
const RUNTIME_PARALLEL_TEXT_BUDGET = 256;
/**
 * Ceiling on the same file with `-DNISH_THREADS=1`, which is the build `--threads`
 * links: the partitioner, the worker trampoline, `pthread_create`/`join` and the
 * nesting guard.
 *
 * Measured 482 bytes on 2026-09-18 with clang 18.1.3 on linux-x64. This is the number
 * that made the file a third translation unit rather than a third of `runtime_os.c`,
 * which had 29 bytes of its ceiling left: 482 bytes of partitioner does not fit in 29,
 * and raising the syscall half's ceiling to hold it would have moved the number a
 * reader sees for "the operating-system surface" for a reason that has nothing to do
 * with the operating system. Section GC means a program that runs nothing in parallel
 * pays none of it, and `examples/hello.ts` is checked to be the same size to the byte.
 */
const RUNTIME_PARALLEL_THREADS_TEXT_BUDGET = 512;
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
      ["runtime/runtime_parallel.c", RUNTIME_PARALLEL_TEXT_BUDGET, "RUNTIME_PARALLEL_TEXT_BUDGET", []],
      [
        "runtime/runtime_parallel.c",
        RUNTIME_PARALLEL_THREADS_TEXT_BUDGET,
        "RUNTIME_PARALLEL_THREADS_TEXT_BUDGET",
        ["-DNISH_THREADS=1"],
      ],
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
  const irDir = path.join(buildDir, "nish-runner.ir") + path.sep;
  const runnerExe = path.join(buildDir, "nish-runner");
  const built = spawnSync(NISH, [path.join("tests", "nish", "run.ts"), "-o", irDir, "--link", runnerExe], {
    cwd: root,
  });
  if (check("tests/nish/run.ts compiles and links", built.status === 0, String(built.stderr))) {
    // cwd is the repository root because the runner addresses `tests/cases` and
    // the compiler by relative path: there is no `cwd` builtin for it to build
    // an absolute one from, which is also why it folds `<root>/` out of a
    // golden rather than into its own output. `--compiler` names the compiler
    // under test, where the runner's own default is build/nish.
    const ran = spawnSync(runnerExe, ["pop", "--compiler", path.relative(root, NISH)], { cwd: root });
    const report = String(ran.stdout);
    check(
      "the Nish runner agrees with the goldens over the `pop` cases (one golden, one native run, three rejections)",
      ran.status === 0 && / 0 failed, /.test(report),
      report + String(ran.stderr)
    );
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
  const irDir = path.join(buildDir, "nish-cli.ir") + path.sep;
  const cliExe = path.join(buildDir, "nish-cli");
  const built = spawnSync(NISH, [path.join("tests", "nish", "cli.ts"), "-o", irDir, "--link", cliExe], {
    cwd: root,
  });
  if (check("tests/nish/cli.ts compiles and links", built.status === 0, String(built.stderr))) {
    // cwd is the repository root: the harness addresses the compiler and
    // `package.json` by relative path, as the golden runner addresses the
    // corpus. Its one argument is the compiler to hold to the contract.
    const ran = spawnSync(cliExe, [path.relative(root, NISH)], { cwd: root, encoding: "utf8" });
    const report = String(ran.stdout);
    check(
      "a Nish program reading the CLI's own output agrees with its documented contract",
      ran.status === 0 && / 0 failed, /.test(report),
      report + String(ran.stderr)
    );
  }
}

// ---- WP8: interop ------------------------------------------------------------------
// runtime/nish.h is the public C ABI; --emit-header / --emit-dts / --emit-napi derive
// host-side declarations from the same checked program the IR came from. Checks:
//   - every function in the compiler's runtime table (what `--runtime-decls` declares)
//     has a prototype in nish.h, and the header is clean under -Wall -Wextra -Werror as
//     C11 and as C++
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
  // The table is the compiler's own: `--runtime-decls` declares every runtime
  // function whether or not the module calls it, so its `declare` lines are
  // `self/runtime.ts` as the compiler under test was built from it. An LLVM
  // intrinsic is not the runtime's and is never declared there.
  const declsLl = path.join(interopDir, "runtime_decls.ll");
  const decls = spawnSync(NISH, [path.join(casesDir, "string_params.ts"), "--runtime-decls", "-o", declsLl], {
    cwd: root,
    encoding: "utf8",
  });
  const declared = decls.status === 0
    ? [...fs.readFileSync(declsLl, "utf8").matchAll(/^declare .*?@(nish_\w+)\(/gm)].map((m) => m[1])
    : [];
  const runtimeNames = [...declared, "nish_alloc_struct"];
  const undeclared = runtimeNames.filter((n) => !new RegExp(`\\b${n}\\s*\\(`).test(publicHeader));
  check(
    `nish.h declares every function the runtime table does (${runtimeNames.length}) and the arena global`,
    declared.length > 0 &&
      undeclared.length === 0 &&
      publicHeader.includes("extern NISH_TLS struct nish_arena nish_arena;"),
    declared.length === 0 ? `--runtime-decls declared nothing:\n${decls.stderr}` : `missing: ${undeclared.join(", ")}`
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
    const r = spawnSync(NISH, [src, "-o", out, ...extra], { cwd: root });
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
  if (!hasNodeHeaders) {
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

  // ---- WP18 G5: an instantiated generic in the generated header --------------------
  // `Box<i32>` is `%struct.Box$i32`, and `-pedantic` refuses a `$` in a C identifier,
  // so the header has to spell it another way. If that way were the bare `$`-to-`_`
  // collapse it would not be injective — `class Box_i32` declared in the same module
  // collapses to the same thing — and the generator's one promise is to describe the
  // ABI the module really defines. `cStructName` gives the instantiation the reserved
  // `nish_gen_` prefix, which a declared name can never carry, so the fixture declares
  // both and the header has to compile with both in it.
  const genHeader = emit("tests/cases/gen_export_header.ts", ["--emit-header", sidecar("gen_export_header", "h")]);
  const genHeaderText =
    genHeader.status === 0 ? fs.readFileSync(sidecar("gen_export_header", "h"), "utf8") : "";
  check(
    "gen_export_header.h spells `Box<i32>` and a declared `Box_i32` as two different C structs",
    genHeaderText.includes("struct nish_gen_Box_i32 {") &&
      genHeaderText.includes("struct Box_i32 {") &&
      genHeaderText.includes("struct nish_gen_Box_i32 *makeGeneric(int32_t v);") &&
      genHeaderText.includes("struct Box_i32 *makeDeclared(int32_t v);"),
    genHeaderText
  );
  if (genHeader.status === 0) {
    const syn = spawnSync("clang", [
      ...strictC,
      "-pedantic",
      "-fsyntax-only",
      "-x",
      "c",
      sidecar("gen_export_header", "h"),
    ]);
    check(
      "gen_export_header.h compiles under -std=c11 -Wall -Wextra -Werror -pedantic",
      syn.status === 0,
      String(syn.stderr)
    );
  }

  // ---- WP18 G8: exported instantiations, named for C and JavaScript ------------------
  // An instantiation's symbol holds `$`, and a `.` when an argument is an array, a
  // readonly array, a nullable or a `Result` (`identity$arr.i32`). C can spell neither
  // and JavaScript cannot spell the `.`, so every sidecar calls an instantiation by its
  // C name, `nish_gen_` and the escaped collapse, which a declared name cannot take
  // (`nish_` is reserved). The fixture instantiates `identity` at each mangling tag, a
  // class and a string, and each sidecar is compiled by the tool a host would use and
  // then called: clang for the header, tsc for the `.d.ts`, Node for the wasm loader
  // and the addon.
  const genFnSrc = "tests/cases/interop_generic_fn.ts";
  const genFn = emit(genFnSrc, [
    "--emit-header",
    sidecar("interop_generic_fn", "h"),
    "--emit-dts",
    sidecar("interop_generic_fn", "d.ts"),
    "--emit-napi",
    sidecar("interop_generic_fn", "napi.c"),
  ]);
  check("interop_generic_fn: every sidecar is written", genFn.status === 0, genFn.stderr);
  const genFnText = (ext) =>
    genFn.status === 0 && fs.existsSync(sidecar("interop_generic_fn", ext))
      ? fs.readFileSync(sidecar("interop_generic_fn", ext), "utf8")
      : "";
  const genFnHeader = genFnText("h");
  const genFnJsNames = [
    "nish_gen_identity_i32",
    "nish_gen_identity_arr_i32",
    "nish_gen_identity_roarr_i32",
    "nish_gen_identity_res_i32_i32",
  ];
  check(
    "interop_generic_fn.h declares each instantiation as nish_gen_<escaped collapse>, bound to its symbol",
    genFnHeader.includes('int32_t nish_gen_identity_i32(int32_t x) NISH_SYMBOL("identity$i32");') &&
      genFnHeader.includes('nish_array *nish_gen_identity_arr_i32(nish_array *x) NISH_SYMBOL("identity$arr.i32");') &&
      genFnHeader.includes("nish_gen_identity_roarr_i32(const nish_array *x) NISH_SYMBOL(\"identity$roarr.i32\");") &&
      genFnHeader.includes('NISH_SYMBOL("identity$opt.$Box$i32");') &&
      genFnHeader.includes("nish_gen_identity_opt__Box_i32(") &&
      genFnHeader.includes('nish_gen_identity_res_i32_i32(nish_result_i32_i32_word x) NISH_SYMBOL("identity$res.i32.i32");') &&
      genFnHeader.includes('nish_str *nish_gen_identity_str(const nish_str *x) NISH_SYMBOL("identity$str");') &&
      genFnHeader.includes('int32_t nish_gen_Box_i32_get(struct nish_gen_Box_i32 *this_) NISH_SYMBOL("Box$i32.get");'),
    genFnHeader
  );
  check(
    "interop_generic_fn.h says an instantiation is one, and never calls it a C keyword",
    genFnHeader.includes("(an instantiation of identity: call it as nish_gen_identity_i32)") &&
      genFnHeader.includes("(a method of an instantiation of Box: call it as nish_gen_Box_i32_get)") &&
      !genFnHeader.includes("a C keyword"),
    genFnHeader
  );
  if (genFn.status === 0) {
    const syn = spawnSync("clang", [...strictC, "-pedantic", "-fsyntax-only", "-x", "c", sidecar("interop_generic_fn", "h")]);
    check(
      "interop_generic_fn.h compiles under -std=c11 -Wall -Wextra -Werror -pedantic",
      syn.status === 0,
      String(syn.stderr)
    );
    const genDriver = path.join(interopDir, "interop_generic_fn_driver.c");
    fs.writeFileSync(
      genDriver,
      [
        "#include <stdio.h>",
        '#include "interop_generic_fn.h"',
        "int main(void) {",
        "  int32_t buf[3] = {7, 8, 9};",
        "  nish_array xs = {3, 3, (char *)buf};",
        "  struct nish_gen_Box_i32 box = {5};",
        "  nish_array *same = nish_gen_identity_arr_i32(&xs);",
        "  nish_str *s = nish_gen_identity_str(nish_str_from_i32(nish_gen_identity_i32(41)));",
        "  nish_result_i32_i32_word r = {1, {.value = 6}};",
        '  printf("%s %d %d %d %d\\n", s->data, ((int32_t *)same->data)[2], nish_gen_Box_i32_get(nish_gen_identity__Box_i32(&box)),',
        "         nish_gen_identity_opt__Box_i32(NULL) == NULL, nish_gen_identity_res_i32_i32(r).as.value);",
        "  nish_free_arena();",
        "  return 0;",
        "}",
        "",
      ].join("\n")
    );
    const genExe = path.join(interopDir, "interop_generic_fn_driver");
    const cc = spawnSync(
      "clang",
      [...strictC, "-O2", sidecar("interop_generic_fn", "ll"), path.join(runtimeDir, "runtime.c"), genDriver, "-o", genExe],
      { cwd: root }
    );
    const run = cc.status === 0 ? spawnSync(genExe) : null;
    check(
      "a -Werror C driver calls every kind of instantiation through interop_generic_fn.h",
      run !== null && String(run.stdout).trim() === "41 9 5 1 6",
      String(cc.stderr) + (run ? String(run.stdout) + String(run.stderr) : "")
    );
  }

  const genFnDts = genFnText("d.ts");
  const members = [...genFnDts.matchAll(/^ {2}([^\s/*(]+)\(/gm)].map((m) => m[1]);
  check(
    "interop_generic_fn.d.ts names every export with an identifier, an array argument's included",
    genFnJsNames.every((name) => members.includes(name)) &&
      members.every((name) => /^[A-Za-z_][A-Za-z0-9_$]*$/.test(name)),
    genFnDts
  );
  if (genFnDts.length > 0) {
    const r = spawnSync("node", [tsc, "--noEmit", "--strict", sidecar("interop_generic_fn", "d.ts")], { cwd: root });
    check("interop_generic_fn.d.ts passes tsc --noEmit --strict", r.status === 0, String(r.stdout) + String(r.stderr));
  }
  if (genFn.status === 0 && has("wasm-ld")) {
    const genWasm = path.join(interopDir, "interop_generic_fn.wasm");
    const w = spawnSync(
      "bash",
      [
        "scripts/build.sh",
        sidecar("interop_generic_fn", "ll"),
        "runtime/runtime_wasm.c",
        "-o",
        genWasm,
        "--profile",
        "wasm",
      ],
      { cwd: root }
    );
    const script = [
      'import { readFileSync } from "node:fs";',
      `const api = await (await import(${JSON.stringify(sidecar("interop_generic_fn", "mjs"))})).load(readFileSync(${JSON.stringify(genWasm)}));`,
      "console.log([api.nish_gen_identity_i32(7), Array.from(api.nish_gen_identity_arr_i32(new Int32Array([1, 2]))).join(','),",
      "  Array.from(api.nish_gen_identity_roarr_i32(new Int32Array([3]))).join(','),",
      "  JSON.stringify(api.nish_gen_identity_res_i32_i32({ ok: false, error: 9 }))].join(' '));",
    ].join("\n");
    const r = w.status === 0 ? spawnSync("node", ["--input-type=module", "-e", script], { cwd: root }) : null;
    check(
      "wasm: the companion loader calls each instantiation by its JavaScript name, `.`-mangled ones included",
      r !== null && String(r.stdout).trim() === '7 1,2 3 {"ok":false,"error":9}',
      String(w.stderr) + (r ? String(r.stdout) + String(r.stderr) : "")
    );
  }
  const genFnShim = genFnText("napi.c");
  check(
    "interop_generic_fn.napi.c exports and wraps each instantiation under its C name",
    genFnJsNames.every((name) => genFnShim.includes(`{"${name}", nish_napi_${name}},`)) &&
      genFnShim.includes('{"nish_gen_identity_str", nish_napi_nish_gen_identity_str},') &&
      !/nish_napi_[A-Za-z0-9_]*[$.]/.test(genFnShim),
    genFnShim
  );
  if (genFn.status === 0 && !hasNodeHeaders) {
    skip(`Node headers not found (${path.join(nodeInclude, "node_api.h")}): interop_generic_fn addon build skipped`);
  } else if (genFn.status === 0) {
    const syn = spawnSync("clang", [...strictC, `-I${nodeInclude}`, "-fsyntax-only", sidecar("interop_generic_fn", "napi.c")]);
    check("interop_generic_fn.napi.c compiles under -std=c11 -Wall -Wextra -Werror", syn.status === 0, String(syn.stderr));
    const genAddon = path.join(interopDir, "interop_generic_fn.node");
    const b = spawnSync(
      "bash",
      [
        "scripts/build.sh",
        sidecar("interop_generic_fn", "ll"),
        "runtime/runtime.c",
        sidecar("interop_generic_fn", "napi.c"),
        "-o",
        genAddon,
        "--profile",
        "napi",
      ],
      { cwd: root }
    );
    const script = [
      `const api = require(${JSON.stringify(genAddon)});`,
      "let err = ''; try { api.nish_gen_identity_i32('x'); } catch (e) { err = e.message; }",
      "console.log([api.nish_gen_identity_i32(7), api.nish_gen_identity_str('caf\\u00e9'),",
      "  Array.from(api.nish_gen_identity_arr_i32(new Int32Array([1, 2]))).join(','), err].join(' | '));",
    ].join("\n");
    const r = b.status === 0 ? spawnSync("node", ["-e", script], { cwd: root }) : null;
    check(
      "napi: the addon calls each instantiation by the name the .d.ts gives it",
      r !== null &&
        String(r.stdout).trim() === "7 | café | 1,2 | nish_gen_identity_i32: argument 1 (x) must be a number",
      String(b.stderr) + (r ? String(r.stdout) + String(r.stderr) : "")
    );
  }

  // ---- WP18 G8: an exported class's generic method ----------------------------------
  // An instantiation of a generic method is a method whose symbol holds a `$`
  // (`Holder.pick$i32`, `Box$i32.with$bool`), so the header declares it under the
  // same `nish_gen_` spelling a generic function's takes and says which method it
  // instantiates, and a C host calls it with the object first. The JavaScript
  // sidecars bridge no method, because `this` is a struct pointer; what they must
  // not do is name one with a `$` or a `.`.
  const genMethod = emit("tests/cases/gen_method_export.ts", [
    "--emit-header",
    sidecar("gen_method_export", "h"),
    "--emit-dts",
    sidecar("gen_method_export", "d.ts"),
    "--emit-napi",
    sidecar("gen_method_export", "napi.c"),
  ]);
  check("gen_method_export: every sidecar is written", genMethod.status === 0, genMethod.stderr);
  const genMethodText = (ext) =>
    genMethod.status === 0 && fs.existsSync(sidecar("gen_method_export", ext))
      ? fs.readFileSync(sidecar("gen_method_export", ext), "utf8")
      : "";
  const genMethodHeader = genMethodText("h");
  check(
    "gen_method_export.h declares each generic-method instantiation as nish_gen_<escaped collapse>, bound to its symbol",
    genMethodHeader.includes(
      'int32_t nish_gen_Holder_pick_i32(struct Holder *this_, int32_t a, int32_t b) NISH_SYMBOL("Holder.pick$i32");'
    ) &&
      genMethodHeader.includes(
        'nish_str *nish_gen_Holder_pick_str(struct Holder *this_, const nish_str *a, const nish_str *b) NISH_SYMBOL("Holder.pick$str");'
      ) &&
      genMethodHeader.includes(
        'int32_t nish_gen_Box_i32_with_bool(struct nish_gen_Box_i32 *this_, bool other) NISH_SYMBOL("Box$i32.with$bool");'
      ) &&
      genMethodHeader.includes(
        "(an instantiation of the generic method Holder.pick: call it as nish_gen_Holder_pick_i32)"
      ),
    genMethodHeader
  );
  if (genMethod.status === 0) {
    const syn = spawnSync("clang", [...strictC, "-pedantic", "-fsyntax-only", "-x", "c", sidecar("gen_method_export", "h")]);
    check(
      "gen_method_export.h compiles under -std=c11 -Wall -Wextra -Werror -pedantic",
      syn.status === 0,
      String(syn.stderr)
    );
    const methodDriver = path.join(interopDir, "gen_method_export_driver.c");
    fs.writeFileSync(
      methodDriver,
      [
        "#include <stdio.h>",
        '#include "gen_method_export.h"',
        "int main(void) {",
        "  struct Holder h = {1};",
        "  struct nish_gen_Box_i32 box = {5};",
        "  nish_str *s = nish_gen_Holder_pick_str(&h, nish_str_from_i32(1), nish_str_from_i32(22));",
        '  printf("%d %s %d %d\\n", nish_gen_Holder_pick_i32(&h, 3, 4), s->data, nish_gen_Box_i32_with_bool(&box, 0), run(&h));',
        "  nish_free_arena();",
        "  return 0;",
        "}",
        "",
      ].join("\n")
    );
    const methodExe = path.join(interopDir, "gen_method_export_driver");
    const cc = spawnSync(
      "clang",
      [...strictC, "-O2", sidecar("gen_method_export", "ll"), path.join(runtimeDir, "runtime.c"), methodDriver, "-o", methodExe],
      { cwd: root }
    );
    const run = cc.status === 0 ? spawnSync(methodExe) : null;
    check(
      "a -Werror C driver calls generic-method instantiations through gen_method_export.h",
      run !== null && String(run.stdout).trim() === "4 22 5 3",
      String(cc.stderr) + (run ? String(run.stdout) + String(run.stderr) : "")
    );
  }
  const genMethodDts = genMethodText("d.ts");
  const genMethodShim = genMethodText("napi.c");
  check(
    "gen_method_export's JavaScript sidecars bridge no method and name nothing with a `$` or a `.`",
    genMethodDts.includes("Holder.pick<i32>(this: Holder, a: number, b: number): number  -- not exported to JS") &&
      ![...genMethodDts.matchAll(/^ {2}([^\s/*(]+)\(/gm)].some((m) => /[$.]/.test(m[1])) &&
      !/nish_napi_[A-Za-z0-9_]*[$.]/.test(genMethodShim) &&
      !genMethodShim.includes("nish_napi_nish_gen_Holder"),
    genMethodDts + genMethodShim
  );
  if (genMethodDts.length > 0) {
    const r = spawnSync("node", [tsc, "--noEmit", "--strict", sidecar("gen_method_export", "d.ts")], { cwd: root });
    check("gen_method_export.d.ts passes tsc --noEmit --strict", r.status === 0, String(r.stdout) + String(r.stderr));
  }
  if (genMethod.status === 0 && hasNodeHeaders) {
    const syn = spawnSync("clang", [...strictC, `-I${nodeInclude}`, "-fsyntax-only", sidecar("gen_method_export", "napi.c")]);
    check("gen_method_export.napi.c compiles under -std=c11 -Wall -Wextra -Werror", syn.status === 0, String(syn.stderr));
  }

  // A declared `identity_i32` beside `identity<i32>`: before G8 both were `identity_i32`
  // in C, and the header declared it twice with two meanings.
  const genClash = emit("tests/cases/interop_generic_collision.ts", [
    "--emit-header",
    sidecar("interop_generic_collision", "h"),
  ]);
  const genClashText =
    genClash.status === 0 ? fs.readFileSync(sidecar("interop_generic_collision", "h"), "utf8") : "";
  check(
    "interop_generic_collision.h declares the user's identity_i32 and identity<i32> as two functions",
    genClashText.includes("int32_t identity_i32(int32_t x);") &&
      genClashText.includes('int32_t nish_gen_identity_i32(int32_t x) NISH_SYMBOL("identity$i32");'),
    genClash.stderr + genClashText
  );
  if (genClash.status === 0) {
    const clashDriver = path.join(interopDir, "interop_generic_collision_driver.c");
    fs.writeFileSync(
      clashDriver,
      [
        "#include <stdio.h>",
        '#include "interop_generic_collision.h"',
        "int main(void) {",
        '  printf("%d %d\\n", identity_i32(40), nish_gen_identity_i32(40));',
        "  return 0;",
        "}",
        "",
      ].join("\n")
    );
    const clashExe = path.join(interopDir, "interop_generic_collision_driver");
    const cc = spawnSync(
      "clang",
      [
        ...strictC,
        "-pedantic",
        sidecar("interop_generic_collision", "ll"),
        path.join(runtimeDir, "runtime.c"),
        clashDriver,
        "-o",
        clashExe,
      ],
      { cwd: root }
    );
    const run = cc.status === 0 ? spawnSync(clashExe) : null;
    check(
      "a -pedantic C driver calls both identity_i32 and nish_gen_identity_i32 through one header",
      run !== null && String(run.stdout).trim() === "41 40",
      String(cc.stderr) + (run ? String(run.stdout) + String(run.stderr) : "")
    );
  }

  // §8 message 9 is a property of the *sidecar*, not of the program: every sidecar flag
  // refuses an exported generic nothing instantiates and writes nothing, and the same
  // program with no sidecar flag compiles.
  const unusedSrc = "tests/cases/reject_interop_generic_unused.ts";
  for (const [flag, ext] of [
    ["--emit-header", "h"],
    ["--emit-dts", "d.ts"],
    ["--emit-napi", "napi.c"],
  ]) {
    const out = sidecar("reject_interop_generic_unused", ext);
    fs.rmSync(out, { force: true });
    fs.rmSync(sidecar("reject_interop_generic_unused", "ll"), { force: true });
    const r = emit(unusedSrc, [flag, out]);
    check(
      `${flag} refuses an exported generic with no instantiation, and writes neither the IR nor the sidecar`,
      r.status === 1 &&
        r.stderr.includes("`identity` is generic, so it has no single C signature") &&
        r.stderr.includes("`Box` is generic, so it has no single C layout") &&
        !fs.existsSync(out) &&
        !fs.existsSync(sidecar("reject_interop_generic_unused", "ll")),
      r.stderr
    );
  }
  // NL4008 is about C prototypes, so only a file that declares both halves refuses: the
  // header declares every function, and the N-API shim only those it bridges, which a
  // method taking a `Point` is not.
  const clashNapi = emit("tests/cases/reject_interop_generic_clash.ts", [
    "--emit-napi",
    sidecar("reject_interop_generic_clash", "napi.c"),
  ]);
  check(
    "--emit-napi alone accepts a method/function C-name pair the shim bridges neither half of",
    clashNapi.status === 0 && fs.existsSync(sidecar("reject_interop_generic_clash", "napi.c")),
    clashNapi.stderr
  );
  const unusedPlain = emit(unusedSrc, []);
  check(
    "the same program with no sidecar flag compiles: message 9 is about the sidecar",
    unusedPlain.status === 0 && fs.existsSync(sidecar("reject_interop_generic_unused", "ll")),
    unusedPlain.stderr
  );

  // WP18 G8: the same rule for a generic method of an exported class, which a header
  // would otherwise describe without the method. Refused under each sidecar flag,
  // and compiled without one.
  const unusedMethodSrc = "tests/cases/reject_generic_method_unused.ts";
  for (const [flag, ext] of [
    ["--emit-header", "h"],
    ["--emit-dts", "d.ts"],
    ["--emit-napi", "napi.c"],
  ]) {
    const out = sidecar("reject_generic_method_unused", ext);
    fs.rmSync(out, { force: true });
    const r = emit(unusedMethodSrc, [flag, out]);
    check(
      `${flag} refuses an exported class's generic method with no instantiation, and writes no sidecar`,
      r.status === 1 && r.stderr.includes("`Holder.pick` is generic, so it has no single C signature") && !fs.existsSync(out),
      r.stderr
    );
  }
  const unusedMethodPlain = emit(unusedMethodSrc, []);
  check(
    "a generic method nothing instantiates compiles when no sidecar is asked for",
    unusedMethodPlain.status === 0,
    unusedMethodPlain.stderr
  );

  // ---- WP24 A1: asynchronous N-API exports (--emit-napi-async) --------------------
  // The shim runs the Nish function on whatever thread N-API handed it, which for a
  // `require()`d addon is Node's main thread, so a 200 ms call blocked Node's event
  // loop for 200 ms (wp24-async.md 5.1). `--emit-napi-async` adds a promise-returning
  // `<name>Async` beside every export whose arguments and result are plain scalars and
  // runs it on libuv's thread pool. The compiled function does not change, so what is
  // under test is the generated C: that the flag is additive and inert when absent,
  // that a build without the thread-local arena is refused rather than raced, and that
  // the two call shapes agree on every answer.
  const asyncSrc = "tests/self/interop_async.ts";
  const asyncSync = emit(asyncSrc, ["--emit-napi", sidecar("interop_async_sync", "napi.c")], "interop_async_sync");
  // `--emit-napi-async` requires `--threads`: its exports allocate on a libuv
  // worker, so the module has to reference the thread-local arena as well. No
  // sidecar's text depends on the flag -- only the IR's storage class does.
  const asyncShim = emit(
    asyncSrc,
    ["--threads", "--emit-napi-async", sidecar("interop_async", "napi.c")],
    "interop_async"
  );
  const asyncNoThreads = spawnSync(
    NISH,
    [asyncSrc, "-o", sidecar("interop_async_bad", "ll"), "--emit-napi-async", sidecar("interop_async_bad", "napi.c")],
    { cwd: root }
  );
  check(
    "--emit-napi-async without --threads is a usage error, not a silently non-thread-local arena",
    asyncNoThreads.status === 2 &&
      String(asyncNoThreads.stderr).includes("--emit-napi-async requires --threads") &&
      !fs.existsSync(sidecar("interop_async_bad", "napi.c")),
    String(asyncNoThreads.stderr)
  );
  check(
    "--emit-napi-async writes its shim",
    asyncShim.status === 0 && fs.existsSync(sidecar("interop_async", "napi.c")),
    asyncShim.stderr
  );
  const shimAsync = fs.existsSync(sidecar("interop_async", "napi.c"))
    ? fs.readFileSync(sidecar("interop_async", "napi.c"), "utf8")
    : "";
  const shimPlain = fs.existsSync(sidecar("interop_async_sync", "napi.c"))
    ? fs.readFileSync(sidecar("interop_async_sync", "napi.c"), "utf8")
    : "";
  check(
    "interop_async.napi.c registers spinAsync/digestAsync beside the synchronous exports and queues them on libuv",
    shimAsync.includes('{"spin", nish_napi_spin},') &&
      shimAsync.includes('{"spinAsync", nish_napi_async_spin},') &&
      shimAsync.includes('{"digestAsync", nish_napi_async_digest},') &&
      // A `void` result is the shape whose work item has no `result` field and
      // whose completion callback boxes `undefined` without reading one.
      shimAsync.includes('{"touchAsync", nish_napi_async_touch},') &&
      shimAsync.includes("napi_get_undefined(env, &out) != napi_ok)") &&
      shimAsync.includes("napi_create_promise(env, &nish_deferred, &nish_promise)") &&
      shimAsync.includes("napi_create_async_work(env, NULL, nish_name, nish_napi_exec_spin, nish_napi_done_spin,") &&
      shimAsync.includes("napi_queue_async_work(env, nish_w->work)") &&
      shimAsync.includes("napi_resolve_deferred(env, nish_w->deferred, out)"),
    shimAsync
  );
  check(
    "the exec callback brackets the call with the worker's own arena mark/release and never touches env",
    shimAsync.includes("static void nish_napi_exec_spin(napi_env env, void *data) {") &&
      shimAsync.includes("(void)env; /* N-API forbids reaching the JS engine here") &&
      shimAsync.includes("uint64_t nish_mark = nish_arena_mark();") &&
      shimAsync.includes("nish_arena_release(nish_mark);"),
    shimAsync
  );
  check(
    "a bad argument to an asynchronous export rejects the promise instead of throwing",
    shimAsync.includes(
      'return nish_napi_reject(env, nish_deferred, nish_promise, "spinAsync: argument 1 (rounds) must be a number");'
    ) && shimAsync.includes("static napi_value nish_napi_reject(napi_env env, napi_deferred deferred, napi_value promise,"),
    shimAsync
  );
  check(
    "the string and borrowed-array exports stay synchronous and the shim names the reason",
    shimAsync.includes("-- no `labelAsync`: it returns string, which lives in the worker thread's arena") &&
      shimAsync.includes("-- no `totalAsync`: parameter 1 (xs) is number[], which the call would borrow across threads") &&
      !shimAsync.includes('{"labelAsync"') &&
      !shimAsync.includes('{"totalAsync"'),
    shimAsync
  );
  check(
    "an asynchronous shim refuses to compile without the thread-local arena, rather than racing it",
    shimAsync.includes("#if !defined(NISH_THREADS)") &&
      shimAsync.includes(
        '#error "--emit-napi-async needs the thread-local arena: build with scripts/build.sh --threads"'
      ),
    shimAsync
  );
  // The flag has to be inert: an addon adopts it one call site at a time, so
  // --emit-napi keeps writing exactly the shim it wrote before A1 existed.
  check(
    "--emit-napi is unchanged by the flag existing: no promise, no async work, no NISH_THREADS guard",
    asyncSync.status === 0 &&
      shimPlain.length > 0 &&
      !shimPlain.includes("napi_create_promise") &&
      !shimPlain.includes("napi_create_async_work") &&
      !shimPlain.includes("NISH_THREADS") &&
      !shimPlain.includes("Async"),
    shimPlain
  );

  if (!hasNodeHeaders) {
    skip(`Node headers not found (${path.join(nodeInclude, "node_api.h")}): the asynchronous N-API addon is skipped`);
  } else if (shimAsync.length === 0) {
    check("interop_async.napi.c compiles and runs", false, "--emit-napi-async wrote no file");
  } else {
    const withThreads = spawnSync("clang", [
      ...strictC,
      `-I${nodeInclude}`,
      "-DNISH_THREADS=1",
      "-fsyntax-only",
      sidecar("interop_async", "napi.c"),
    ]);
    check(
      "interop_async.napi.c compiles under -std=c11 -Wall -Wextra -Werror with -DNISH_THREADS",
      withThreads.status === 0,
      String(withThreads.stderr)
    );
    // The guard is the whole defence against two threads bumping one arena, so
    // it is checked by compiling, not only by reading the `#error` out of the text.
    const noThreads = spawnSync("clang", [
      ...strictC,
      `-I${nodeInclude}`,
      "-fsyntax-only",
      sidecar("interop_async", "napi.c"),
    ]);
    check(
      "the same file is rejected without -DNISH_THREADS, naming --threads",
      noThreads.status !== 0 && String(noThreads.stderr).includes("build with scripts/build.sh --threads"),
      String(noThreads.stderr)
    );

    const asyncAddon = path.join(interopDir, "interop_async.node");
    const ab = spawnSync(
      "bash",
      [
        "scripts/build.sh",
        sidecar("interop_async", "ll"),
        "runtime/runtime.c",
        sidecar("interop_async", "napi.c"),
        "-o",
        asyncAddon,
        "--profile",
        "napi",
        "--threads",
      ],
      { cwd: root }
    );
    check("napi profile builds interop_async.node with --threads", ab.status === 0, String(ab.stderr));
    if (ab.status === 0) {
      // 4000 rounds rather than the 20000 of the documented measurement: enough
      // work that a blocked loop is unambiguous, little enough that the suite does
      // not spend a second on it. The numbers in wp24-async.md 11c are the harness
      // run by hand at the larger size.
      const ax = spawnSync("node", ["examples/node-addon-async.mjs", asyncAddon, "20000"], { cwd: root });
      const out = String(ax.stdout);
      // `call <n> ms ... worst loop stall <n> ms`, for each call shape.
      const timings = (label) => {
        const m = out.match(
          new RegExp(`${label}[^\\n]*call\\s+([0-9.]+) ms[^\\n]*worst loop stall\\s+([0-9.]+) ms`)
        );
        return m === null ? null : { call: Number(m[1]), stall: Number(m[2]) };
      };
      const syncRun = timings("sync spin\\(\\)");
      const asyncRun = timings("async spinAsync\\(\\)");
      check(
        "node-addon-async.mjs: both call shapes agree, concurrent calls agree, and a bad argument rejects",
        ax.status === 0 &&
          out.includes("same answer from both: true") &&
          out.includes("32 concurrent digestAsync calls agree with digest: true") &&
          out.includes("touchAsync(1000) resolves to undefined") &&
          out.includes('spinAsync("nope") rejects: spinAsync: argument 1 (rounds) must be a number'),
        out + String(ax.stderr)
      );
      // The asynchronous call takes just as long; what changes is whether the loop
      // is stalled for it. The claim is compared against each call's *own*
      // duration rather than against a fixed number of milliseconds, so this
      // stays a check about scheduling instead of a speed test on whatever
      // machine it runs on: a slow box makes both numbers bigger together.
      check(
        "the synchronous call stalls the event loop for its whole duration and the asynchronous one does not",
        syncRun !== null &&
          asyncRun !== null &&
          syncRun.stall > 0.5 * syncRun.call &&
          asyncRun.stall < 0.25 * asyncRun.call,
        `sync ${JSON.stringify(syncRun)}, async ${JSON.stringify(asyncRun)}\n${out}`
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
  if (res.status === 0) {
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
  if (res.status === 0) {
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

  if (widths.status === 0) {
    const r = spawnSync("clang", [...strictC, "-fsyntax-only", "-x", "c", sidecar("interop_widths", "h")]);
    check("interop_widths.h compiles under -std=c11 -Wall -Wextra -Werror", r.status === 0, String(r.stderr));
  }
  // The shim needs node_api.h to compile at all, so this is the same skip the
  // other addon checks take when the Node headers are not installed.
  if (hasNodeHeaders && widths.status === 0 && skips.status === 0) {
    for (const stem of ["interop_widths", "napi_skips"]) {
      const r = spawnSync("clang", [...strictC, `-I${nodeInclude}`, "-fsyntax-only", sidecar(stem, "napi.c")]);
      check(`${stem}.napi.c compiles under -std=c11 -Wall -Wextra -Werror`, r.status === 0, String(r.stderr));
    }
  }
  if (widths.status === 0 && hasNodeHeaders) {
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
    [
      "export function spell(n: i32): string {",
      "  return `${n}`;",
      "}",
      // WP30's negative half. Adding the unsigned widths to the typed-view
      // table moved the line between an element type that crosses and one that
      // does not, and these two are what must stay on the far side of it: a
      // `boolean` element would need 0/1 validation per element rather than a
      // view, and a `string` element is a pointer into the arena. Without this,
      // a future row added to `typedView` by pattern-matching on the others
      // could let either through and nothing would notice.
      "export function countTrue(flags: boolean[]): i32 {",
      "  let n = 0;",
      "  for (let i = 0; i < flags.length; i++) {",
      "    if (flags[i]) {",
      "      n = n + 1;",
      "    }",
      "  }",
      "  return n;",
      "}",
      "export function widest(names: string[]): i32 {",
      "  return names.length;",
      "}",
      "",
    ].join("\n")
  );
  const skipped = emit(skipSrc, ["--emit-dts", sidecar("skip_reasons", "d.ts")]);
  const skipDts = skipped.status === 0 ? fs.readFileSync(sidecar("skip_reasons", "d.ts"), "utf8") : "";
  const skipMjs = skipped.status === 0 ? fs.readFileSync(sidecar("skip_reasons", "mjs"), "utf8") : "";
  check(
    "a skipped function names the argument or the result, and the type, that stopped it",
    stringsDts.includes(
      "  // pick(flag: boolean, a: string, b: string): string  -- not exported to JS: argument 2 (a) is `string`,"
    ) && skipDts.includes("  // spell(n: number): string  -- not exported to JS: the result is `string`,"),
    stringsDts + skipDts
  );
  check(
    "an element type with no typed array is still declined, and named (boolean[], string[])",
    skipDts.includes(
      "  // countTrue(flags: boolean[]): number  -- not exported to JS: argument 1 (flags) is `boolean[]`,"
    ) &&
      skipDts.includes(
        "  // widest(names: string[]): number  -- not exported to JS: argument 1 (names) is `string[]`,"
      ) &&
      // And they are absent from the loader, not merely commented in the
      // declarations: the two files come from one predicate and this is the
      // half that would notice if they stopped doing so.
      skipMjs.length > 0 &&
      !skipMjs.includes("countTrue") &&
      !skipMjs.includes("widest"),
    skipDts + skipMjs
  );
  // WP30: the same widths as arrays, where the masks above have no
  // counterpart. An element never travels in a wasm value type -- it is a byte
  // in `data` that the typed array reads unsigned -- so a mask here would be
  // wrong rather than redundant, and `& 0xff` appearing in this loader would
  // mean a generator had copied the scalar rule into a place it does not hold.
  const unsignedArrays = emit("tests/self/interop_unsigned_arrays.ts", [
    "--emit-dts",
    sidecar("interop_unsigned_arrays", "d.ts"),
  ]);
  const unsignedArraysMjs =
    unsignedArrays.status === 0 ? fs.readFileSync(sidecar("interop_unsigned_arrays", "mjs"), "utf8") : "";
  check(
    "interop_unsigned_arrays.mjs marshals an unsigned element by view and masks only the scalars",
    // Arrays: the constructor and the element size, and nothing else.
    unsignedArraysMjs.includes('arrayIn(xs, Uint8Array, 1, "sumU8: argument 1 (xs)")') &&
      unsignedArraysMjs.includes('arrayIn(xs, Uint16Array, 2, "sumU16: argument 1 (xs)")') &&
      unsignedArraysMjs.includes('arrayIn(xs, BigUint64Array, 8, "sumU64: argument 1 (xs)")') &&
      unsignedArraysMjs.includes("arrayOut(raw.highU8(), Uint8Array)") &&
      unsignedArraysMjs.includes("arrayOut(raw.maxU32(), Uint32Array)") &&
      // `fillU8` is the whole rule in one call: the `u8[]` crosses in memory
      // and is handed over untouched, the scalar `u8` crosses in an i32 value
      // type and is masked, and the arena bytes come back to the caller.
      unsignedArraysMjs.includes("raw.fillU8(xs$, v & 0xff)") &&
      unsignedArraysMjs.includes("copyBack(xs$, xs)") &&
      unsignedArraysMjs.includes("raw.countU8(xs$, needle & 0xff)") &&
      // A scalar `u64` *result* still needs its reading restored, so the two
      // rules coexist in this file rather than one having replaced the other.
      unsignedArraysMjs.includes("BigInt.asUintN(64, raw.sumU64(xs$))") &&
      // And no mask is ever applied to a marshalled array: a `>>> 0` on a
      // `Uint32Array` result would be the scalar rule copied where it is wrong.
      !unsignedArraysMjs.includes("arrayOut(raw.maxU32(), Uint32Array) >>>") &&
      !unsignedArraysMjs.includes("arrayOut(raw.highU8(), Uint8Array) &"),
    unsignedArraysMjs
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
  if (has("wasm-ld")) {
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
  if (arrays.status === 0) {
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
  if (arrays.status === 0 && (has("wasm-ld") || hasNodeHeaders)) {
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

// ---- WP14: self-hosting ---------------------------------------------------------------
// `self/` is the compiler written in Nish (docs/wp14-selfhost.md), and the
// compiler every other section of this file runs. It is checked here rather than
// in tests/cases because it is a program, not a construct: the floor is that it
// compiles every module of itself cleanly, and above that stand the oracles that
// hold each phase to something outside it and the bootstrap's fixed point.
if (!only || "selfhost".includes(only) || only.includes("self")) {
  const selfDir = path.join(root, "self");
  const modules = fs.existsSync(selfDir)
    ? fs
        .readdirSync(selfDir)
        .filter((f) => f.endsWith(".ts"))
        .sort()
    : [];
  check("self/ has at least one module", modules.length > 0, `${modules.length} modules`);
  // The property is "the compiler accepts every module of self/", and one root per
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
  // `self/compile.ts` is compiled under `--json`, which moves its report to
  // stdout as one object per diagnostic: the performance ratchet below counts
  // that compile's warnings, so the count costs no compile of its own.
  const RATCHETED = "compile.ts";
  let ratchetedRun = null;
  const compileSelf = (names) => {
    const ratcheted = names.length === 1 && names[0] === RATCHETED;
    const r = spawnSync(
      NISH,
      [...names.map((m) => path.join(selfDir, m)), "-o", `${out}/`, ...(ratcheted ? ["--json"] : [])],
      { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
    );
    if (ratcheted) ratchetedRun = r;
    return r;
  };
  const declaresMain = (m) =>
    /^export (function main\b|const main\s*=)/m.test(fs.readFileSync(path.join(selfDir, m), "utf8"));
  const entries = modules.filter(declaresMain);
  const groups = [modules.filter((m) => !declaresMain(m)), ...entries.map((m) => [m])];
  const batched = groups.every((g) => g.length === 0 || compileSelf(g).status === 0);
  for (const m of modules) {
    // `batched` is the whole answer when it is true; when it is false one of
    // the groups failed and every module is compiled alone to find out which.
    const r = batched ? null : compileSelf([m]);
    check(`self/${m} compiles`, batched || r.status === 0, batched ? "" : `${r.stderr}${r.stdout}`);
  }

  // The performance ratchet. `std/` and `examples/` are held to zero warnings
  // (the performance gate above); the compiler's own source is not there yet,
  // so it is held to the count it has, per file and per code, in
  // tests/perf-baseline.json, and the count may only fall. A warning more than
  // the baseline fails and names the warnings of that file and code, among
  // which the new one is. A warning fewer fails too, asking for the baseline to
  // come down to the new count, because a cap that is never lowered lets the
  // next warning in for free. Counted from `--json` by `code`, never from the
  // report, which stops printing at 20 (`.claude/testing.md`).
  if (ratchetedRun === null) {
    check(`performance ratchet: self/${RATCHETED} was compiled, so its warnings can be counted`, false);
  } else {
    const baselineFile = path.join(root, "tests", "perf-baseline.json");
    const baseline = JSON.parse(fs.readFileSync(baselineFile, "utf8")).counts;
    const warnings = diagnosticsOf(ratchetedRun.stdout)
      .filter((d) => d.severity === "performance")
      // The modules were named by absolute path, and a diagnostic names its
      // file the way it was reached; the baseline is keyed by the repository's
      // own spelling so it reads the same on every checkout.
      .map((d) => ({ ...d, file: path.relative(root, path.resolve(root, d.file)).split(path.sep).join("/") }));
    const actual = {};
    for (const d of warnings) {
      actual[d.file] ??= {};
      actual[d.file][d.code] = (actual[d.file][d.code] ?? 0) + 1;
    }
    const over = [];
    const under = [];
    for (const file of [...new Set([...Object.keys(baseline), ...Object.keys(actual)])].sort()) {
      const want = baseline[file] ?? {};
      const got = actual[file] ?? {};
      for (const code of [...new Set([...Object.keys(want), ...Object.keys(got)])].sort()) {
        const allowed = want[code] ?? 0;
        const count = got[code] ?? 0;
        if (count > allowed) {
          const named = warnings
            .filter((d) => d.file === file && d.code === code)
            .map((d) => `        ${diagnosticLine(d)}`);
          over.push(`${file} ${code}: ${count}, the baseline allows ${allowed}; one of these is new:\n${named.join("\n")}`);
        } else if (count < allowed) {
          const edit = count === 0 ? "remove it from" : `set it to ${count} in`;
          under.push(`${file} ${code}: ${count}, the baseline says ${allowed}; ${edit} tests/perf-baseline.json`);
        }
      }
    }
    const total = warnings.length;
    check(
      `performance ratchet: self/${RATCHETED} has no performance warning past tests/perf-baseline.json (${total} today)`,
      ratchetedRun.status === 0 && over.length === 0,
      ratchetedRun.status !== 0 ? `${ratchetedRun.stdout}${ratchetedRun.stderr}` : over.join("\n")
    );
    check(
      `performance ratchet: tests/perf-baseline.json is lowered to self/${RATCHETED}'s count wherever the count fell`,
      ratchetedRun.status === 0 && under.length === 0,
      `${under.join("\n")}\nA warning proven away is progress; the baseline comes down with it so it cannot come back.`
    );
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

  // The DWARF `producer` string is "nish <version>", and stage1 cannot read
  // package.json to find the version, so it is a constant in `self/branding.ts`.
  // This is what stops that constant going stale: a disagreement here is a
  // `--version` and a byte of every `-g` module that name the wrong release.
  const brandingTs = path.join(root, "self", "branding.ts");
  if (fs.existsSync(brandingTs)) {
    const branding = fs.readFileSync(brandingTs, "utf8");
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    check(
      `self/branding.ts names the CLI and the version package.json does (nish ${pkg.version})`,
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

    // And the third party to that contract, added 2026-09-20: the release
    // tarball's presence gate. `std/` was not staged at all for four releases,
    // and the gate that exists to catch exactly that listed seven paths and
    // none of them under `std/`. Naming the modules there fixes the case that
    // happened; deriving the list from the same directory the two above read
    // is what stops the NEXT module shipping in `self/`'s literal and not in
    // the tarball -- three lists that agree until one is edited is the defect
    // `.github/seed-targets.json` exists to prevent one level up.
    const releaseYmlText = fs.readFileSync(
      path.join(root, ".github", "workflows", "release.yml"),
      "utf8"
    );
    //
    // All THREE presence gates, not the first one found. release.yml has one per
    // artefact -- the release tarball, the per-platform npm package, and the main npm
    // package -- and the first two ship a native compiler from the same staged
    // directory while the third ships `dist/`. Picking one by a `.find` would test
    // whichever happened to come first in the file and say nothing about the others,
    // which is the shape of the defect rather than a check on it.
    const gateLines = releaseYmlText.split("\n").filter((l) => /^\s*for f in \S+ /.test(l));
    const modules = actual.split(", ");
    const holes = gateLines.flatMap((line) =>
      modules.filter((m) => !line.includes(`std/${m}.ts`)).map((m) => `std/${m}.ts in: ${line.trim()}`)
    );
    check(
      `release.yml's ${gateLines.length} presence gates each name every std module, so none can ship missing (${actual})`,
      gateLines.length === 3 && holes.length === 0,
      gateLines.length !== 3
        ? `expected 3 \`for f in ...\` gates in release.yml, found ${gateLines.length}`
        : `not named:\n${holes.join("\n")}`
    );
  }

  // S1: the lexer, built by the seed, runs natively, and its token stream agrees
  // with the `typescript` scanner's over the whole corpus. The oracle links a
  // binary, so it needs clang; without one this is skipped like every other
  // toolchain-dependent check.
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
  const built = spawnSync(NISH, [path.join(selfDir, "dump_tokens.ts"), "--link", dumper], {
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
  const builtAst = spawnSync(NISH, [path.join(selfDir, "dump_ast.ts"), "--link", astDumper], {
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
  // already exists — stage0's IR escape and f64 hex, recorded in a golden
  // while it was in the tree, `node:path` for
  // the module-identity hazard of §3a D3, and `JSON.stringify` / `Map` for
  // the rest.
  const supportOracle = spawnSync("node", [path.join(root, "tests", "self", "support_oracle.js"), "--seed", seedSpec], {
    cwd: root,
    encoding: "utf8",
  });
  const supportSummary = supportOracle.stdout.trim().split("\n").pop() ?? "";
  check(
    `self/ support library agrees with node and stage0's recorded answers (${supportSummary})`,
    supportOracle.status === 0,
    `${supportOracle.stdout}${supportOracle.stderr}`
  );

  // WP19 G2.4: the four comparisons that held stage1 against stage0 --
  // the type model, the diagnostics, the scope chain and the checker's whole
  // dump -- written down. They were green when they were retired, so stage1's
  // output *is* the agreed behaviour; `tests/self/goldens/` is that output
  // checked in, and `goldens.js` compares stage1's live answer against it.
  //
  // The seed is `seedSpec` above, passed in rather than looked up, so the tool
  // builds with the seed the rest of the run was built with.
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

  // The other half of milestone S3: refusing the programs it should, for the
  // reason each case names. A dump comparison cannot see that, so every
  // `reject_*` case and every `tests/link/` negative is run through
  // `self/dump_checked.ts` and its own expected fragments are required of the
  // output -- the assertion section A makes of the driver, made of the checker
  // on its own.
  const rejectOracle = spawnSync("node", [path.join(root, "tests", "self", "reject_oracle.js"), "--seed", seedSpec], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const rejectSummary = rejectOracle.stdout.trim().split("\n").pop() ?? "";
  check(
    `self/ refuses every negative case with the message it pins (${rejectSummary})`,
    rejectOracle.status === 0,
    `${rejectOracle.stdout}${rejectOracle.stderr}`
  );

  // WP19 G2.1: the successor to the IR and interop oracles, which held stage1
  // against stage0 and retired with it (`docs/wp19-stage0-retirement.md` §2B).
  // `nish-cmp` compares the **last released** `nish` with HEAD over the same
  // corpus, byte for byte — Go's `toolstash -cmp` — and a difference has to
  // be named in `CHANGELOG.md` before it goes green.
  //
  // It needs a released `nish` to compare with, so without `NISH_BOOTSTRAP`
  // it skips rather than runs, and the skip is counted and says why: a
  // comparison against nothing that reported PASS would be exactly the
  // green-run-proving-less problem the summary at the bottom of this file
  // exists to expose. Set `NISH_BOOTSTRAP` to the seed -- the variable
  // `scripts/bootstrap.sh` reads -- and it runs. Budget about three minutes
  // for it when it does: it is the whole corpus twice.
  // The gate's own comparison logic, driven here because the gate itself
  // skips on any machine with no seed -- which is most of them, and is the
  // shape `.claude/selfhost.md` warns about: a guard nothing exercises. It is
  // the one piece of that tool that can make two DIFFERING files look equal,
  // so it is the piece worth a stand-in (`reject_oracle.js`'s `selfCheck` and
  // `scripts/verify-binaries.sh` are the precedent).
  //
  // Why the tool needs it at all: two compilers are never installed in one
  // directory, and a module reached as `nish/<name>` is named by the path the
  // compiler found it at, so the seed writes its own unpacked path where HEAD
  // writes `std/text.ts`. Measured against the v0.5.0 seed, that is four
  // undeclared differences over two programs and nothing else -- a red gate
  // for a property no cross-install comparison can have.
  check(
    "nish-cmp: its own package-root normalisation is right (stand-in inputs, not the corpus)",
    selfCheckRoots() === null,
    String(selfCheckRoots())
  );
  check(
    "nish-cmp: a compiler's own root is derived the way the compiler derives it",
    packageRootOf(NISH) === root && packageRootOf(path.join(root, "build", "self", "compile")) === root,
    `build/nish-test -> ${packageRootOf(NISH)}, ` +
      `build/self/compile -> ${packageRootOf(path.join(root, "build", "self", "compile"))}, root is ${root}`
  );
  check(
    "nish-cmp: removing a root leaves the module path, and a sibling directory alone",
    withoutOwnRoot("; ModuleID = '/opt/nish/std/text.ts'", "/opt/nish") === "; ModuleID = 'std/text.ts'" &&
      withoutOwnRoot("/opt/nish-old/std/a.ts", "/opt/nish") === "/opt/nish-old/std/a.ts",
    `${withoutOwnRoot("; ModuleID = '/opt/nish/std/text.ts'", "/opt/nish")} | ` +
      `${withoutOwnRoot("/opt/nish-old/std/a.ts", "/opt/nish")}`
  );
  // The other thing two releases cannot agree about: a `-g` build records
  // `producer: "nish <version>"`, and the reference is the last release while
  // HEAD carries the next number from the commit that bumps it. Measured
  // against the v0.6.0 seed on the 0.7.0 bump, that is seven undeclared
  // differences, one line each, all in `dbg_*` cases -- the same digits
  // `normaliseProducer` lets go for the goldens.
  check(
    "nish-cmp: its own producer-version normalisation is right (stand-in inputs, not the corpus)",
    selfCheckVersions() === null,
    String(selfCheckVersions())
  );
  // And the lookup that decides whether a declared difference is excused: its
  // words may be in CHANGELOG.md or in the section scripts/changelog-gen.mjs
  // would render for the commits not yet released, and a pending section that
  // could not be read excuses nothing.
  check(
    "nish-cmp: a declaration's words are found in CHANGELOG.md or the pending release notes, and nowhere else (stand-in inputs)",
    selfCheckNotes() === null,
    String(selfCheckNotes())
  );

  // The same equality on programs nobody wrote. The corpus is checked in and
  // therefore finite and adapted-to; the WP13 fuzzer generates random
  // straight-line programs, and here the released `nish` and HEAD are each
  // asked for the IR of every one and the texts compared byte for byte,
  // module set included (`fuzz.js --stage1`, docs/wp13-differential.md "The
  // fuzzer"). Sixteen programs from one fixed seed, which is a time budget
  // rather than a coverage judgement -- about a third of a second each, plus
  // one link. A failure reproduces from the summary line.
  // Both need the released compiler, so both wait for the same variable and
  // share one counted skip without it.
  if (!process.env.NISH_BOOTSTRAP) {
    skip(
      "NISH_BOOTSTRAP is unset: there is no released nish to compare HEAD against, so " +
        "tests/nish-cmp.js (WP19 G2) and tests/differential/fuzz.js --stage1 did not run"
    );
  } else {
    // `cmpSince` in .github/seed-targets.json names the first release this gate
    // may be asked about, and CI's `seeds` job gives nish-cmp no row for an
    // older one; the same rule here, read from the same field, so a run seeded
    // with such a release reports a counted skip rather than a red it was
    // told in advance to expect. The note beside the field says why.
    const cmpSince = JSON.parse(
      fs.readFileSync(path.join(root, ".github", "seed-targets.json"), "utf8")
    ).cmpSince;
    const released = resolveSeed(process.env.NISH_BOOTSTRAP);
    const seedVersion =
      released.error === undefined
        ? /^nish (\S+)$/m.exec(spawnSeed(released, ["--version"]).stdout ?? "")?.[1]
        : undefined;
    if (seedVersion !== undefined && !notAfter(cmpSince, seedVersion)) {
      skip(
        `NISH_BOOTSTRAP is nish ${seedVersion}, older than cmpSince ${cmpSince} in .github/seed-targets.json, ` +
          "so tests/nish-cmp.js (WP19 G2) and tests/differential/fuzz.js --stage1 did not run"
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
        `the released nish and HEAD emit the same IR for random programs (${stage1FuzzSummary || `seed=${stage1FuzzSeed}`})`,
        stage1Fuzz.status === 0,
        `${stage1Fuzz.stdout}${stage1Fuzz.stderr}`
      );
    }
  }

  // S5, and the claim the work package exists for: `self/` compiles `self/`.
  // stage1 is `self/` built by the seed, stage2 is `self/` built by stage1,
  // stage3 is `self/` built by stage2. `IR(stage1) == IR(stage2)` is the
  // fixed point -- nothing about the seed leaks into the result any more --
  // and stage3 must be byte-identical to stage2 so the binaries are compared
  // as well as the text. Three links, so it is the slowest check here.
  const bootstrap = spawnSync("node", [path.join(root, "tests", "self", "bootstrap.js"), "--seed", seedSpec], {
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

  // WP19 G3: which equalities `scripts/bootstrap.sh --verify` asserts, and
  // this check is what stops that from drifting.
  //
  // `IR(seed) == IR(stage1)` asks whether codegen has changed since the seed
  // was released, which forbids every improvement a release cycle exists to
  // carry and says nothing about the bootstrap, so it is reported and not
  // asserted. (While stage0 was a seed the same comparison was diverse
  // double-compiling, and was asserted; that went with `src/`.)
  // `IR(stage1) == IR(stage2)` and `stage3 == stage2` are properties of the
  // working tree alone and are asserted for every seed.
  //
  // The run uses the debug profile, where three stages cost about eight
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

  // A seed guaranteed to differ: the seed this run was built with, wrapped so
  // that it emits `--unchecked-indexing`, which removes the bounds checks
  // from the IR it writes for `self/` -- the
  // same shape of difference a codegen improvement makes, and the shape that
  // broke this run when the first one landed. A released seed differs from
  // HEAD already, but by however much codegen moved since that release, which
  // may be nothing; the wrapper is what makes the difference certain. It still
  // builds a working stage1, so the fixed point is untouched and stays
  // asserted.
  //
  // The difference has to actually be there: a run where nothing differs
  // would pass this check while proving nothing, so the count is read out of
  // the note and required to be non-zero.
  const perturbedSeed = seedWork("seed-unchecked.mjs");
  fs.mkdirSync(path.dirname(perturbedSeed), { recursive: true });
  fs.writeFileSync(
    perturbedSeed,
    `// Generated by tests/run.js: the seed, emitting IR without bounds checks.\n` +
      `import { spawnSync } from "node:child_process";\n` +
      `const args = process.argv.slice(2);\n` +
      `const asking = args.includes("--version") || args.includes("--help");\n` +
      `const r = spawnSync(${JSON.stringify(seed.cmd)}, [...${JSON.stringify(seed.prefix)}, ...args,` +
      ` ...(asking ? [] : ["--unchecked-indexing"])], { stdio: "inherit" });\n` +
      `process.exit(r.status === null ? 70 : r.status);\n`
  );
  const released = runBootstrap("released", { NISH_BOOTSTRAP: perturbedSeed });
  const note = /note: IR\(seed\) vs IR\(stage1\): (\d+) of (\d+) modules differ/.exec(released.stdout);
  check(
    `a seed that emits different IR has the difference reported and not asserted (${
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
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, NISH_BOOTSTRAP: seedSpec } }
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

    // stage1 answers `--version` itself: `self/branding.ts` carries the
    // version as a constant because stage1 cannot read `package.json`, so
    // this is what catches the two drifting apart at the next release bump.
    const ourVersion = spawnSync(compiler, ["--version"], { cwd: root, encoding: "utf8" });
    check(
      "the self-hosted compiler: --version names the release package.json does",
      ourVersion.status === 0 &&
        ourVersion.stdout ===
          `nish ${JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version}\n`,
      JSON.stringify(ourVersion.stdout)
    );

    // `--json` is the editor-facing diagnostic shape: the objects, their
    // order and their spans. A multi-error program is the case worth
    // pinning, because it is also the one that proves stage1 collected every
    // error rather than stopping at the first.
    //
    // The `.err` sidecars cannot see a whole span on their own -- they are
    // matched as substrings, so the caret run they pin fixes a start column
    // but not an end one, and the two compilers once printed the same
    // sentence for `reject_ffi_pointer_array` while spanning it on `CPtr[]`
    // and on `CPtr` respectively (WP27 S2). A case joins this list when its
    // span is the property under test, and the spans are written out here,
    // `line:column-endLine:endColumn` per object, because they were agreed
    // between the two compilers before stage0 retired and nothing else pins
    // them now.
    const jsonCases = [
      ["reject_multi_error", ["2:10-2:18 NL2231", "6:19-6:20 NL2185", "11:10-11:16 NL2231"]],
      ["reject_ffi_pointer_array", ["21:18-21:22 NL2323"]],
      ["reject_ffi_pointer_type_argument_fn", ["22:13-22:18 NL2323"]],
    ];
    for (const [jsonName, spans] of jsonCases) {
      const jsonCase = path.join("tests", "cases", `${jsonName}.ts`);
      const ourJson = spawnSync(compiler, [jsonCase, "--json"], { cwd: root, encoding: "utf8" });
      let got = [];
      try {
        got = ourJson.stdout
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line))
          .map((o) => `${o.line}:${o.column}-${o.endLine}:${o.endColumn} ${o.code}`);
      } catch {
        got = ["(stdout is not one JSON object per line)"];
      }
      check(
        `the self-hosted compiler: ${jsonName}'s --json diagnostics carry the spans they are pinned to`,
        ourJson.status === 1 && ourJson.stderr === "" && got.join(", ") === spans.join(", "),
        `wanted ${spans.join(", ")}\ngot ${got.join(", ")}\n${ourJson.stdout}${ourJson.stderr}`
      );
    }

    // WP21 S2: the walk up to `node_modules` has to reach the directories
    // Node reaches, and the working directory is what makes that hard.
    // `tests/link/package_above` installs the package *above* the directory
    // the compiler is run in -- `proj/node_modules` beside `proj/src/main.ts`,
    // which is what npm produces -- and is compiled the way that program is
    // compiled, `nish main.ts` from `src/`. stage1 has no `process.cwd()`
    // (WP19 §A3) and climbs past `.` by spelling `..`, so a stage1 that
    // stopped where `dirname` stops answered `` Cannot find package
    // `pkg_above` `` for a program that resolves. The two modules are the
    // entry and the package it found.
    const aboveSrc = path.join(root, "tests", "link", "package_above", "src");
    if (fs.existsSync(path.join(aboveSrc, "main.ts"))) {
      const ourDir = path.join(shipDir, "package_above-stage1") + path.sep;
      fs.rmSync(ourDir, { recursive: true, force: true });
      const ourAbove = spawnSync(compiler, ["main.ts", "-o", ourDir], {
        cwd: aboveSrc,
        encoding: "utf8",
      });
      const ourModules = llFilesIn(ourDir);
      check(
        "the self-hosted compiler: a package above the working directory resolves",
        ourAbove.status === 0 && ourModules.join(",") === "index.ll,main.ll",
        `stage1 ${ourAbove.status}: ${ourAbove.stdout}${ourAbove.stderr}modules [${ourModules.join(" ")}]`
      );
    }

    // WP21 S2, the other half of that walk: an ancestor the module's own name
    // does not spell. `tests/link/package_doubled` installs the package one
    // `node_modules` inside another and is compiled from inside
    // `node_modules/app`, so the ancestor is `..` -- a directory named without
    // being named. Node steps over a `node_modules` ancestor and so does the
    // compiler wherever the name spells one, but `..` spells nothing, and the
    // compiler has no way to learn what it is: stage1 has no `process.cwd()`
    // (WP19 §A3) and the language has no `statSync`, which is what naming a
    // directory from below would take. So it searches it, and finds the
    // package, which is the answer stage0 gave too while there was one.
    const doubledSrc = path.join(root, "tests", "link", "package_doubled", "node_modules", "app");
    if (fs.existsSync(path.join(doubledSrc, "main.ts"))) {
      const ourDir = path.join(shipDir, "package_doubled-stage1") + path.sep;
      fs.rmSync(ourDir, { recursive: true, force: true });
      const ourDoubled = spawnSync(compiler, ["main.ts", "-o", ourDir], {
        cwd: doubledSrc,
        encoding: "utf8",
      });
      const ourDoubledModules = llFilesIn(ourDir);
      check(
        "the self-hosted compiler: a `node_modules` ancestor no name spells is searched",
        ourDoubled.status === 0 && ourDoubledModules.join(",") === "index.ll,main.ll",
        `stage1 ${ourDoubled.status}: ${ourDoubled.stdout}${ourDoubled.stderr}` +
          `modules [${ourDoubledModules.join(" ")}]`
      );

      // The same tree named from its root, where the compiler *can* read the
      // ancestor's name and steps over it: the package is not found, and the
      // refusal says where it looked.
      const doubledRoot = path.join(root, "tests", "link", "package_doubled");
      const doubledEntry = path.join("node_modules", "app", "main.ts");
      const ourNamed = spawnSync(compiler, [doubledEntry, "-o", ourDir], {
        cwd: doubledRoot,
        encoding: "utf8",
      });
      check(
        "the self-hosted compiler: a `node_modules` ancestor the name spells is stepped over",
        ourNamed.status === 1 &&
          ourNamed.stderr.includes(
            "error: Cannot find package `@nish-absent/zed`; no `node_modules` directory above the importing module has it"
          ),
        `stage1 ${ourNamed.status}: ${ourNamed.stderr}`
      );
    }

    // WP21 S3 and #198: a package is its real directory. `package_symlink` is
    // pnpm's layout, one package reached a second time through a link, which
    // is one package: `@shared.val` is defined once. `package_workspace` is a
    // workspace link to a directory outside any `node_modules`, whose own
    // relative import stays in that package rather than joining the root
    // package: `foo`'s `helper` is `@foo.helper` beside the program's
    // `@helper`, where it used to clash with it. Both are compiled the way a
    // user compiles them, `nish main.ts` from the fixture; the link loop above
    // runs them.
    for (const [workspaceName, wantDefines] of [
      ["package_symlink", ["@app2.twice(", "@shared.val("]],
      ["package_workspace", ["@foo.foo(", "@foo.helper(", "@helper("]],
    ]) {
      const ourDir = path.join(shipDir, `${workspaceName}-stage1`) + path.sep;
      fs.rmSync(ourDir, { recursive: true, force: true });
      const ourBuild = spawnSync(compiler, ["main.ts", "-o", ourDir], {
        cwd: path.join(root, "tests", "link", workspaceName),
        encoding: "utf8",
      });
      const defines = llFilesIn(ourDir)
        .flatMap((file) => fs.readFileSync(path.join(ourDir, file), "utf8").split("\n"))
        .filter((line) => line.startsWith("define ") && !line.includes("@main(") && !line.includes("@nish_main("))
        .map((line) => /@[\w.$]+\(/.exec(line)?.[0] ?? line)
        .sort();
      check(
        `the self-hosted compiler: ${workspaceName} is one package per real directory (${wantDefines.join(" ")})`,
        ourBuild.status === 0 && defines.join(" ") === wantDefines.join(" "),
        `stage1 ${ourBuild.status}: ${ourBuild.stdout}${ourBuild.stderr}defines [${defines.join(" ")}]`
      );
    }

    // WP15 §8 through the driver (WP19 G1). The analysis is pinned by the
    // performance section and the checked goldens already; what this pins is
    // the half that is the driver's -- that it prints the warnings at all,
    // on stderr, as JSON objects on stdout under `--json`, and not at all
    // under `--no-warn-performance`. A warning changes no exit code, so the
    // compile that carries it is a successful one. `wrote <file>` is dropped:
    // it names a path in a temporary directory.
    const perfCase = path.join("tests", "cases", "perf_str_concat_loop.ts");
    const perfOut = (dir) => path.join(shipDir, dir, "perf.ll");
    const withoutWrote = (text) =>
      text.split("\n").filter((line) => !line.startsWith("wrote ")).join("\n");
    const ourPerf = spawnSync(compiler, [perfCase, "-o", perfOut("perf1")], { cwd: root, encoding: "utf8" });
    const ourPerfJson = spawnSync(compiler, [perfCase, "-o", perfOut("perf1j"), "--json"], { cwd: root, encoding: "utf8" });
    const ourPerfOff = spawnSync(
      compiler,
      [perfCase, "-o", perfOut("perf1q"), "--no-warn-performance"],
      { cwd: root, encoding: "utf8" }
    );
    check(
      "the self-hosted compiler: the performance warnings are printed, and --no-warn-performance silences them",
      ourPerf.status === 0 &&
        ourPerf.stderr.includes("performance: `out` is rebuilt") &&
        withoutWrote(ourPerf.stderr).trimEnd().endsWith("4 performance warnings") &&
        ourPerfJson.status === 0 &&
        ourPerfJson.stdout.split("\n").filter(Boolean).length === 4 &&
        ourPerfJson.stdout
          .split("\n")
          .filter(Boolean)
          .every((line) => JSON.parse(line).severity === "performance") &&
        ourPerfOff.status === 0 &&
        withoutWrote(ourPerfOff.stderr).trim() === "",
      `ours:\n${ourPerf.stderr}\nours --json:\n${ourPerfJson.stdout}\nours --no-warn-performance:\n${ourPerfOff.stderr}`
    );

    // `--emit-checked` through the driver, rather than through the
    // `dump_checked` entry `tests/self/goldens.js` spawns: the same text has
    // to come out of both, which is why one `self/dump.ts` writes it for
    // both, and the entry's is the one the goldens hold. A whole program is
    // dumped module by module, the entry named as one.
    const dumpCase = path.join("examples", "multi", "main.ts");
    const ourDump = spawnSync(compiler, [dumpCase, "--emit-checked"], { cwd: root, encoding: "utf8" });
    const dumpEntry = path.join(shipDir, "dump_checked");
    const dumpBuilt = spawnSync(compiler, ["self/dump_checked.ts", "--link", dumpEntry, "--profile", "debug"], {
      cwd: root,
      encoding: "utf8",
    });
    const viaEntry =
      dumpBuilt.status === 0
        ? spawnSync(dumpEntry, [dumpCase], { cwd: root, encoding: "utf8" })
        : { status: dumpBuilt.status, stdout: "", stderr: `could not link self/dump_checked.ts:\n${dumpBuilt.stderr}` };
    check(
      "the self-hosted compiler: --emit-checked dumps a whole program as the dump entry does",
      ourDump.status === 0 &&
        viaEntry.status === 0 &&
        ourDump.stdout === viaEntry.stdout &&
        ourDump.stdout.includes("module examples/multi/main.ts (entry)") &&
        ourDump.stdout.includes("module examples/multi/math.ts"),
      `driver:\n${ourDump.stdout}${ourDump.stderr}\ndump entry ${viaEntry.status}:\n${viaEntry.stdout}${viaEntry.stderr}`
    );

    // No flag is stage0's by name any more (`--emit-ast` was the last, WP19
    // R1), so what this pins is the property the refusal was really about: a
    // flag the compiler does not know is refused rather than quietly
    // dropped, because a build that asked for something must not come out
    // without it and without being told. It answers exit 2, which is the
    // usage-error code the CLI contract fixes.
    const refused = spawnSync(compiler, ["examples/hello.ts", "--emit-sidecar"], {
      cwd: root,
      encoding: "utf8",
    });
    check(
      "the self-hosted compiler: an unknown flag is refused, not ignored",
      refused.status === 2 && refused.stderr.includes("--emit-sidecar"),
      `stage1 ${refused.status}: ${refused.stdout}${refused.stderr}`
    );

    // The `--help` contract: a request that succeeded goes to stdout with
    // exit 0, a refusal to stderr with exit 2. It is the shape that is pinned
    // here; the WP12 block pins the text.
    const ourHelp = spawnSync(compiler, ["--help"], { cwd: root, encoding: "utf8" });
    const ourRefusal = spawnSync(compiler, [], { cwd: root, encoding: "utf8" });
    check(
      "the self-hosted compiler: --help answers on stdout with exit 0, and a usage error on stderr with exit 2",
      ourHelp.status === 0 &&
        ourHelp.stdout.includes("usage:") &&
        ourHelp.stderr === "" &&
        ourRefusal.status === 2 &&
        ourRefusal.stderr.includes("usage:") &&
        ourRefusal.stdout === "",
      `help ${ourHelp.status}:\n${ourHelp.stdout}${ourHelp.stderr}\nrefusal ${ourRefusal.status}:\n${ourRefusal.stdout}${ourRefusal.stderr}`
    );

    // The interop sidecars, and the directory each one needs. The bytes
    // themselves are the WP8 section's business.
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

    // ---- The command line answers the way stage0's did, not merely close
    // to it. Each of these was a silent divergence while there were two
    // compilers to compare: a flag stage1 accepted and ignored, an input it
    // dropped, a stream it wrote the wrong way down.

    // An unknown `--number-mode` refused rather than quietly meaning i32:
    // the failure mode is a program that compiles, in the other arithmetic.
    const badMode = spawnSync(
      compiler,
      ["examples/hello.ts", "--number-mode", "f32", "-o", path.join(shipDir, "unused.ll")],
      { cwd: root, encoding: "utf8" }
    );
    check(
      "the self-hosted compiler: an unknown --number-mode is refused",
      badMode.status === 2 &&
        !fs.existsSync(path.join(shipDir, "unused.ll")),
      `stage1 ${badMode.status}: ${badMode.stderr}`
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
    // so `wrote <file>` goes to stderr. A build script that pipes the IR
    // somewhere must not find chatter mixed into it.
    const chatterDir = path.join(shipDir, "chatter");
    const chatter = spawnSync(
      compiler,
      ["examples/hello.ts", "-o", `${chatterDir}/`],
      { cwd: root, encoding: "utf8" }
    );
    check(
      "the self-hosted compiler: `wrote <file>` goes to stderr",
      chatter.status === 0 && chatter.stdout === "" && chatter.stderr.includes("wrote "),
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
    check(
      "the self-hosted compiler: --link without `export const main` is refused before anything is linked",
      noMain.status === 1 && noMain.stderr.includes("export const main"),
      `stage1 ${noMain.status}: ${noMain.stderr}`
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
    // `process.arch`, and `self/target.ts` composes the triple from them. The
    // module it writes has to be the one naming that triple outright writes --
    // the whole module rather than the triple line, which keeps the check
    // honest about the layout string too. A host with no triple of its own is
    // refused with the list, and the WP9 block pins which one that is.
    const hostTripleHere = HOST_TRIPLE;
    const ourHost = path.join(shipDir, "host.ll");
    const namedHost = path.join(shipDir, "host_named.ll");
    const hostOurs = spawnSync(compiler, ["examples/hello.ts", "--target", "host", "-o", ourHost], {
      cwd: root,
      encoding: "utf8",
    });
    const hostNamed = hostTripleHere
      ? spawnSync(compiler, ["examples/hello.ts", "--target", hostTripleHere, "-o", namedHost], {
          cwd: root,
          encoding: "utf8",
        })
      : null;
    check(
      hostNamed !== null
        ? `the self-hosted compiler: --target host writes the module --target ${hostTripleHere} writes`
        : "the self-hosted compiler: --target host is refused on a host with no triple, naming the supported ones",
      hostNamed !== null
        ? hostOurs.status === 0 &&
            hostNamed.status === 0 &&
            stripHeader(fs.readFileSync(ourHost, "utf8")) === stripHeader(fs.readFileSync(namedHost, "utf8"))
        : hostOurs.status === 2 && hostOurs.stderr.includes("supported: host,"),
      `host ${hostOurs.status}: ${hostOurs.stderr}` +
        (hostNamed !== null ? `named ${hostNamed.status}: ${hostNamed.stderr}` : "")
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
}

// ---- WP9: bench --------------------------------------------------------------------
// The benchmark programs in bench/ must keep printing identical checksums across
// Nish, C and (when rustc is installed) Rust. `bench/run.mjs --validate` builds
// every variant (speed, --nsw, size profile, C, Rust, Rust native) at a small size and
// compares the outputs; nothing is timed. The Are We Fast Yet ports in bench/awfy/
// have no twins, so `awfy` builds their harness and runs each one once, which panics
// when a port's own `verifyResult` fails. `maps` builds the four WP32 map layout
// prototypes and requires each to print what bench/map_node.mjs prints from
// Node's `Map`. Also: `--target host` pins a module to a
// data layout, so `opt -O2` vectorises it without `-mtriple`, and `--nsw` flags
// every user-level integer add/sub/mul but nothing else.
if (!only || "bench".includes(only) || "wp9".includes(only)) {
  // The Nish side is built by the compiler under test, where the bench's own
  // default is build/nish.
  const v = spawnSync(
    "node",
    [
      path.join(root, "bench", "run.mjs"),
      "--compiler",
      path.relative(root, NISH),
      "--validate",
      "--only",
      "fib,sieve,awfy,maps",
      "--n",
      "fib=25,sieve=100000,maps=1024",
    ],
    { cwd: root, encoding: "utf8" }
  );
  check(
    "bench: fib(25) and sieve(1e5) print the same checksum from Nish, C and Rust (Rust skipped without rustc), the seven AWFY ports verify, and the four map prototypes agree with Node's Map",
    v.status === 0 &&
      v.stdout.includes("awfy: 7 benchmarks verified") &&
      v.stdout.includes("maps: 4 prototype(s) agree with Node's Map over 10 workloads") &&
      v.stdout.includes("checksums agree") &&
      v.stdout.includes("fib: 75025") &&
      v.stdout.includes("sieve: 191840"),
    `${v.stdout}${v.stderr}`
  );
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
    NISH,
    [path.join(casesDir, "opt_target_triple.ts"), "--target", "host", "-o", hostLl],
    { cwd: root, encoding: "utf8" }
  );
  const hostTriple = HOST_TRIPLE;
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
    NISH,
    [
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
          NISH,
          [src(name), "-o", path.join(buildDir, out), "--unchecked-indexing", ...extra],
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

// ---- Instruction counts ------------------------------------------------------------
// Wall time cannot catch a codegen regression of a few percent: a VM's run-to-run
// noise is bigger than that. An instruction count is exact, so the eighteen
// benchmark programs (bench/*.ts, the four WP32 map layout prototypes and the
// seven AWFY ports) are built as the timing
// mode builds them and run once each under cachegrind, and a count above
// bench/instructions.json by more than its tolerance fails. The counts are x86-64
// Linux's, so anywhere else, or without valgrind, the check is a counted skip.
// bench/README.md ("Instruction counts") has the determinism measurements and
// the procedure for raising a baseline.
if (!only || "instructions".includes(only)) {
  const counts = JSON.parse(fs.readFileSync(path.join(root, "bench", "instructions.json"), "utf8"));
  const host = `${process.platform}-${process.arch}`;
  if (host !== counts.platform) {
    skip(`instructions: the baseline is counted on ${counts.platform}, not ${host}`);
  } else if (!has("valgrind")) {
    skip("instructions: valgrind is not on PATH, so no benchmark's instruction count is checked");
  } else if (!HAS_CLANG) {
    skip("instructions: clang is not on PATH, so the benchmarks cannot be linked");
  } else {
    const bench = path.join(root, "bench", "run.mjs");
    const counted = spawnSync("node", [bench, "--compiler", path.relative(root, NISH), "--instructions", "--check"], {
      cwd: root,
      encoding: "utf8",
    });
    check(
      "instructions: no benchmark executes more instructions than bench/instructions.json allows",
      counted.status === 0 && /^instructions: all 18 within /m.test(counted.stdout),
      `${counted.stdout}${counted.stderr}`
    );
  }
}

// ---- WP12: exit codes --------------------------------------------------------------
// The CLI's contract (docs/wp12-release.md): 0 ok, 1 compile error, 2 usage, 3 toolchain,
// 70 internal compiler error. Each failure mode is driven from outside the compiler:
// NISH_SIMULATE_ICE=1 is the test hook for the ICE path (`self/ice.ts`), an empty PATH stands in
// for a machine without clang, and CC=<stub> makes scripts/build.sh fail after the IR
// was written.
if (!only || "exit-codes".includes(only) || "wp12".includes(only)) {
  const pkgVersion = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
  const wp12Dir = path.join(buildDir, "wp12");
  fs.rmSync(wp12Dir, { recursive: true, force: true });
  fs.mkdirSync(wp12Dir, { recursive: true });
  const run = (args, env = {}) =>
    spawnSync(NISH, [...args], { cwd: root, encoding: "utf8", env: { ...process.env, ...env } });
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
  const documented = [
    "--json",
    "--link",
    "--emit-header",
    "--emit-dts",
    "--emit-napi",
    "--emit-napi-async",
    "--target",
    "--profile",
  ];
  const undocumented = documented.filter((f) => !help.stdout.includes(f));
  check(
    `--help lists every advertised flag (${documented.length} checked)`,
    undocumented.length === 0,
    `missing from --help: ${undocumented.join(", ")}`
  );
  const badFlag = run(["--bogus", entry]);
  check(
    "unknown flag: names it, exit 2",
    badFlag.status === 2 && badFlag.stderr.includes("unknown flag `--bogus`"),
    badFlag.stderr
  );
  const noValue = run([entry, "-o"]);
  check("-o without a value: exit 2", noValue.status === 2, noValue.stderr);

  // An unreadable input names the file. stage0 passed Node's errno through
  // (`ENOENT`); stage1's runtime read answers null without saying why, so the
  // sentence is `cannot open <file>` -- the wording `tests/nish/cli.ts` already
  // holds both compilers to, and what the two checks below pin.
  //
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
      missingObj.message === "cannot open does-not-exist.ts",
    missingJson.stdout + missingJson.stderr
  );

  const missing = run(["does-not-exist.ts"]);
  check(
    "missing input file: one-line `cannot open` message, exit 1",
    missing.status === 1 &&
      missing.stderr === "error: cannot open does-not-exist.ts\n" &&
      !missing.stderr.includes("internal compiler error"),
    missing.stderr
  );

  const ice = run([entry, "-o", path.join(wp12Dir, "ice.ll")], { NISH_SIMULATE_ICE: "1" });
  check(
    "internal error: exit 70, names the file, asks for a bug report, no stack trace",
    ice.status === 70 &&
      ice.stderr.startsWith(`nish ${pkgVersion}: internal compiler error\n`) &&
      ice.stderr.includes("simulated internal compiler error while compiling " + entry) &&
      ice.stderr.includes("github.com/amritk/nish/issues") &&
      ice.stderr.includes("NISH_DEBUG=1") &&
      !/^\s+at /m.test(ice.stderr) &&
      !fs.existsSync(path.join(wp12Dir, "ice.ll")),
    ice.stderr
  );
  // stage0 printed its stack under NISH_DEBUG=1. A compiler with no exceptions
  // has no stack to print, so what the variable has to change is nothing, and
  // the report says so rather than promising a trace a rerun would not produce.
  const iceDebug = run([entry, "-o", path.join(wp12Dir, "ice.ll")], {
    NISH_SIMULATE_ICE: "1",
    NISH_DEBUG: "1",
  });
  check(
    "internal error with NISH_DEBUG=1: exit 70, the same report, and it says there is no stack behind it",
    iceDebug.status === 70 &&
      iceDebug.stderr === ice.stderr &&
      iceDebug.stderr.includes("there is no stack behind this, so NISH_DEBUG=1 adds nothing"),
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
      // The options are `npm run check`'s, so the two cannot drift apart;
      // `include: []` drops its file list for this project's own.
      JSON.stringify({ extends: path.join(root, "tsconfig.json"), include: [], files: [declarations, ...files] })
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
      // runtime/nish.d.ts, and the `self/` check below, which expects the same
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
  // `self/checker.ts` that pops without a null check carries a
  // `@ts-expect-error` -- which is also what `npm run check` holds it to: if
  // the error goes away, the unused directive is an error of its own. Anything
  // tsc reports here is a hole in the declarations.
  check(
    `tsc accepts self/ against the ambient declarations, the documented \`pop\` divergence expected in place (${selfModules.length} modules)`,
    selfCheck.ok,
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
    const run = spawnSync(NISH, [file, "--json", "-o", path.join(snippetDir, `${stem}.ll`), ...s.args], {
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
// and that the CLI resolves them from its own package root rather than from the cwd.
//
// **The package is an installer and carries no compiler of its own.** `bin.nish` is the
// launcher in `bin/`, plain JavaScript that needs no build step; the compiler arrives as
// one `@amritk/nish-<asset>` platform package per supported platform. So this block has
// two halves and they are different claims: with a platform package the round trip above
// has to work end to end, and with none the command has to say so and exit non-zero. The
// second half used to be a fallback to the Node compiler in `dist/`, which `files` no
// longer ships (docs/wp12-release.md, "Which compiler the package ships"; the cost to
// musl and FreeBSD is priced in docs/wp19-stage0-retirement.md §6).
if (!only || "package".includes(only) || "wp12".includes(only)) {
  // Outside the checkout, not under build/. The installed launcher finds its platform
  // package with Node's resolution, which walks up every parent `node_modules`: from
  // build/ that walk reaches the repository's own, where `npm ci` puts the published
  // platform package for this machine now that the registry carries one, and the
  // "nothing installed beside it" half of this block would find a compiler after all.
  const pkgDir = fs.mkdtempSync(path.join(os.tmpdir(), "nish-wp12-package-"));
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
      // No `/^dist\//`, and its absence is the check. Until 0.6.0 the tarball
      // carried the TypeScript compiler as well as the launcher, because that
      // was the fallback for a platform with no prebuilt binary; the fallback
      // is gone (docs/wp12-release.md, "Which compiler the package ships"), so
      // a `dist/` path reaching the tarball means `files` grew it back.
      /^bin\//,
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
      // The command, and the two files behind it. They are plain JavaScript
      // under `bin/` rather than `tsc` output under `dist/` because the command
      // may not be a build artifact of the compiler it installs -- and because
      // there is no longer a `dist/` to build it into.
      "bin/nish",
      "bin/launcher.js",
      "bin/packaging.js",
      "runtime/runtime.c",
      // The runtime is two translation units since the operating-system half was
      // split out for its own size budget, and `--link` compiles both. A tarball
      // with only the core would install a compiler that cannot link any program
      // that reads a file.
      "runtime/runtime_os.c",
      // And the third, which `--link` also compiles: a tarball without it would
      // install a compiler whose every link fails to find `nish_parallel_range`,
      // because build.sh pairs all three from one named input.
      "runtime/runtime_parallel.c",
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
    // A script that ships has to be able to load in the tarball it ships in: every
    // relative import it makes has to be a file the tarball also carries, and every bare
    // one has to be a runtime dependency rather than a devDependency. `scripts/` is
    // whitelisted as a directory, so a development tool added beside `build.sh` ships
    // without anybody deciding it should -- `scripts/arrow-verify.mjs` did, importing
    // `../tests/self/corpus.js`, which `files` does not ship, and nothing said so because
    // nobody runs a corpus sweep out of an install. Either it resolves or it does not
    // ship; this is what makes that a check rather than a habit.
    //
    // The specifiers are read from the parse tree and not from a pattern, because the
    // forms a pattern misses are the ones nobody looks at: `import "./x.js";` with no
    // clause, `export { a } from "./x.js"`, a dynamic `import()`, and any of them in
    // single quotes. A guard that only sees `import ... from "..."` is a guard the
    // regression it was written for can walk straight past.
    const ts = require("typescript");
    const specifiersOf = (text, name) => {
      const sf = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
      const found = [];
      const visit = (node) => {
        const fixed =
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier !== undefined
            ? node.moduleSpecifier
            : undefined;
        if (fixed !== undefined && ts.isStringLiteral(fixed)) found.push(fixed.text);
        const dynamic =
          ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
            ? node.arguments[0]
            : undefined;
        if (dynamic !== undefined && ts.isStringLiteral(dynamic)) found.push(dynamic.text);
        ts.forEachChild(node, visit);
      };
      visit(sf);
      return found;
    };
    // `@scope/name/deep` and `name/deep` are both the package plus a subpath, and it is
    // the package that `dependencies` names.
    const packageOf = (spec) =>
      spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    // A tarball with no `dependencies` at all is a thing a refactor can produce, and it
    // should fail this one check rather than throw and take the whole packaging block
    // with it.
    const deps = new Set(Object.keys(manifest.dependencies ?? {}));
    // `bin/` as well as `scripts/`, and `bin/nish` by name because it carries no
    // extension. This gate is what caught `platform-package.mjs` importing a path
    // the tarball does not ship, and in 0.6.0 the command itself moved into `bin/`
    // -- the one shipped directory of JavaScript it was not watching. `bin/nish`
    // imports `./launcher.js`, which imports `./packaging.js`, so a `files` that
    // shipped the command without the two files behind it would install a `nish`
    // that throws `ERR_MODULE_NOT_FOUND` on every invocation.
    const shippedScripts = files.filter(
      (f) => (f.startsWith("scripts/") || f.startsWith("bin/")) && (/\.(mjs|js)$/.test(f) || f === "bin/nish")
    );
    const unresolved = [];
    for (const rel of shippedScripts) {
      for (const spec of specifiersOf(fs.readFileSync(path.join(root, rel), "utf8"), rel)) {
        if (spec.startsWith("node:")) continue;
        if (!spec.startsWith(".")) {
          const pkg = packageOf(spec);
          if (!deps.has(pkg)) unresolved.push(`${rel} imports \`${spec}\`, and \`${pkg}\` is not a dependency`);
          continue;
        }
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
        if (!files.includes(target)) unresolved.push(`${rel} imports \`${spec}\`, which the tarball does not carry`);
      }
    }
    check(
      `npm pack ships no script whose imports it cannot resolve (${shippedScripts.length} scripts)`,
      unresolved.length === 0,
      unresolved.join("\n")
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
    // ---- the installer ----------------------------------------------------------------
    // `bin.nish` names the launcher, not a compiler. The native compiler reaches a
    // machine as an `optionalDependencies` entry npm installs only where `os` and `cpu`
    // match -- so something has to look at what landed and hand over to it, and npm
    // cannot point a `bin` at a dependency that may not be there. If the launcher stops
    // shipping, or `bin` goes back to naming a compiler directly, every install on every
    // platform silently stops using the native binary it downloaded.
    check(
      "npm pack ships the launcher `bin.nish` names",
      manifest.bin?.nish === "bin/nish" && files.includes("bin/nish") && files.includes("bin/launcher.js"),
      `bin.nish is ${JSON.stringify(manifest.bin)}, bin/nish ${
        files.includes("bin/nish") ? "ships" : "does not ship"
      }, and bin/launcher.js ${files.includes("bin/launcher.js") ? "ships" : "does not ship"}`
    );
    // `bin/nish` is a node shim in the tarball and a native binary after
    // postinstall has run on a machine that got one. Packing the *binary* is a
    // thing that can happen -- a developer who installed their own build over
    // it and then packed -- and it would publish one platform's compiler to
    // every platform, past `os`/`cpu` and past every check in this file that
    // looks at paths rather than contents.
    check(
      "the bin `npm pack` ships is the shim, never a binary somebody swapped in",
      fs.readFileSync(path.join(root, "bin", "nish"), "utf8").startsWith("#!/usr/bin/env node"),
      "bin/nish does not begin with a node shebang, so what would be published is not the shim"
    );
    // There is no compiler in the tarball to fall back to, and that is the
    // decision this check pins rather than an omission it tolerates
    // (docs/wp12-release.md, "Which compiler the package ships"; the cost is
    // priced in docs/wp19-stage0-retirement.md §6). A launcher that grew an
    // `import` of a compiler back would be shipping one of two things: `dist/`,
    // which `files` no longer carries, or a compile on the user's machine,
    // which is the property every path in this package is held to. The
    // behaviour this implies -- a diagnostic and a non-zero exit -- is asserted
    // from outside, on the installed command, further down.
    // The predicate is a *dynamic* import, which is what a fallback needs and what
    // the old launcher used (`await import("../dist/index.js")`): the file's static
    // imports are node built-ins and `./packaging.js`, and neither can be a
    // compiler. Matching the string "dist/" instead would fail on the comment that
    // explains why the fallback went, which is the wrong thing to make unwritable.
    const launcherText = fs.readFileSync(path.join(root, "bin", "launcher.js"), "utf8");
    check(
      "the launcher has no compiler to fall back to, and does not pretend otherwise",
      !/\bimport\s*\(/.test(launcherText) && launcherText.includes("NO_COMPILER"),
      "bin/launcher.js reaches for a compiler of its own instead of refusing; " +
        "a platform with no prebuilt binary must be told, not quietly served something else"
    );
    // One row per attached seed, at exactly this version. Two ways this goes wrong and
    // neither shows up in a build: a platform that gets a binary built and attached but
    // no package published, so every install on it refuses for want of a package that
    // was never uploaded; and a version bump that moves package.json and leaves these
    // behind, so every install resolves last release's binary against this release's
    // compiler. `release-pr.yml` bumps them with the version for that second reason.
    const seedAssets = JSON.parse(
      fs.readFileSync(path.join(root, ".github", "seed-targets.json"), "utf8")
    ).targets.map((t) => t.asset);
    const optional = manifest.optionalDependencies ?? {};
    const expectedOptional = seedAssets.map((a) => `${manifest.name}-${a}`).sort();
    check(
      `package.json declares one platform package per seed target (${seedAssets.length}: ${seedAssets.join(", ")})`,
      JSON.stringify(Object.keys(optional).sort()) === JSON.stringify(expectedOptional),
      `optionalDependencies is ${Object.keys(optional).sort().join(", ")}; expected ${expectedOptional.join(", ")}`
    );
    const misversioned = Object.entries(optional).filter(([, v]) => v !== manifest.version);
    check(
      `every platform package is pinned to this version (${manifest.version})`,
      misversioned.length === 0,
      misversioned.map(([k, v]) => `${k} is pinned to ${v}, not ${manifest.version}`).join("\n")
    );
    // And the lockfile's copy of that same list, which is a second file saying the same
    // thing and therefore a second thing to go stale. It did: 0.4.0 shipped with
    // package.json pinning 0.4.0 and the lockfile still pinning 0.3.0, because the
    // release bump read `optionalDependencies` at the top level and a lockfile keeps the
    // root package under `packages[""]`. Nothing was red -- `npm ci` tolerates it and
    // `npm install` rewrites the file under whoever runs it next, which is how it stayed
    // invisible. `release-pr.yml` moves both now, and this is the check that would have
    // noticed whatever moved them apart.
    const lockRoot = JSON.parse(
      fs.readFileSync(path.join(root, "package-lock.json"), "utf8")
    ).packages?.[""]?.optionalDependencies;
    const lockDisagrees = Object.entries(optional).filter(([k, v]) => (lockRoot ?? {})[k] !== v);
    check(
      "package-lock.json pins the same platform packages at the same versions as package.json",
      lockRoot !== undefined && lockDisagrees.length === 0,
      lockRoot === undefined
        ? 'package-lock.json has no packages[""].optionalDependencies'
        : lockDisagrees
            .map(([k, v]) => `${k}: package.json ${v}, lockfile ${JSON.stringify(lockRoot[k])}`)
            .join("\n")
    );
    // The three spellings of a platform -- node's, this project's and npm's -- converted
    // in one place, checked against the file that is the authority on the middle one.
    // A row `targetForAsset` cannot read is a platform the release attaches a binary for
    // and the launcher will never look for.
    const { assetFor, targetForAsset, SUPPORTED_ASSETS, noCompilerMessage } = await import(
      pathToFileURL(path.join(root, "bin", "packaging.js")).href
    );
    const unmapped = seedAssets.filter((a) => {
      const t = targetForAsset(a);
      return t === null || assetFor(t.os, t.cpu) !== a;
    });
    check(
      "every seed target round-trips through the launcher's platform table",
      unmapped.length === 0,
      unmapped.map((a) => `${a} does not round-trip: targetForAsset -> assetFor did not return it`).join("\n")
    );
    // A platform this project ships no binary for answers `null`, and since 0.6.0
    // that answer is what makes the launcher refuse rather than what sends it to a
    // Node compiler. If it ever returned an asset name, an Alpine or FreeBSD
    // install would resolve a package that does not exist and report a missing
    // install where the honest answer is an unsupported platform.
    check(
      "an unsupported platform maps to no asset at all",
      assetFor("freebsd", "x64") === null && assetFor("linux", "riscv64") === null,
      "assetFor answered an asset for a platform no release attaches a binary for"
    );
    // The list the launcher *prints* against the list the workflows *read*. The
    // diagnostic names the supported platforms, so a user on musl is told what the
    // whole list is; `seed-targets.json` is the authority on that list, and this is
    // what stops the shipped table saying something else. It is the same move the
    // `seed targets:` checks make for `release.yml`'s asset names.
    check(
      `the launcher's diagnostic names every platform seed-targets.json carries (${SUPPORTED_ASSETS.join(", ")})`,
      SUPPORTED_ASSETS.join(",") === [...seedAssets].sort().join(","),
      `bin/packaging.js says ${SUPPORTED_ASSETS.join(", ")}; ` +
        `.github/seed-targets.json says ${[...seedAssets].sort().join(", ")}`
    );
    // What a user on musl or FreeBSD is told, asked for by name because no runner
    // this project uses can reach that branch: every one of them is one of the four
    // supported platforms, so an end-to-end check would assert the *other* message
    // and the advice here would go stale unread. It has to say three things -- that
    // there is no compiler for this machine, which machines do have one, and what to
    // do instead -- and "what to do instead" is a real instruction rather than a
    // shrug, because this is the whole of what a user gets (wp19 §6).
    const why = noCompilerMessage({ platform: "freebsd", arch: "x64", packageName: manifest.name });
    const unsupported = why.report;
    check(
      "a platform with no prebuilt binary is told so, told which platforms have one, and told what to do",
      unsupported.includes("no prebuilt compiler for freebsd/x64") &&
        seedAssets.every((a) => unsupported.includes(a)) &&
        unsupported.includes("no compiler inside the package to fall back to") &&
        unsupported.includes("NISH_BOOTSTRAP") &&
        unsupported.includes("scripts/bootstrap.sh") &&
        unsupported.includes("docs/INSTALL.md"),
      JSON.stringify(unsupported)
    );
    // The same branch's machine-readable form. This is the half no runner can reach
    // end to end -- every one of them is a supported platform -- so it is asked for
    // by name here, and it has to carry the code a tool keys on and say the same
    // thing the report says rather than being a second, shorter opinion.
    check(
      "that branch's --json message carries NL0002 and the same remedy as its report",
      why.code === "NL0002" &&
        why.summary.includes("no prebuilt compiler for freebsd/x64") &&
        why.summary.includes("NISH_BOOTSTRAP") &&
        why.summary.includes("docs/INSTALL.md") &&
        !why.summary.includes("\n"),
      JSON.stringify(why)
    );
    // And it says outright that nothing is compiled locally. This is the property
    // the whole installer is held to -- nothing is compiled on a user's machine on
    // any path -- and the refusal is the one place where implying otherwise would
    // be an easy kindness and a lie. The negative half of this check used to
    // assert the absence of the string "will be built", which no version of the
    // message has ever contained: an assertion no edit could fail.
    check(
      "the refusal says outright that nothing is compiled on the user's machine",
      unsupported.includes("nothing is\n  compiled on your machine on any path"),
      JSON.stringify(unsupported)
    );

    for (const f of [
      "self/compile.ts",
      "tests/run.js",
      "examples/add.ts",
      ".github/workflows/ci.yml",
      "docs/MASTER_PLAN.md",
    ]) {
      check(`npm pack excludes ${f}`, !files.includes(f));
    }

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
        // The platform packages are on the registry from 0.10.0, so without this
        // npm fetches the published one for this machine and the refusal below
        // never happens. Omitting them is also exactly the user this block is
        // about: `npm install --omit=optional` gets this install and no other.
        "--omit=optional",
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

      // ---- no platform package: the refusal ----------------------------------------
      // Nothing was installed beside the main package -- `--omit=optional` kept all four
      // `optionalDependencies` out, where on a real install npm skips the three whose
      // `os`/`cpu` do not match -- so this is the state a user on musl, FreeBSD or a
      // 32-bit anything installs into. Until 0.6.0 it was the *fallback* path, and every check
      // below ran through it: this block proved the tarball's Node compiler rather than
      // the compiler a user on a supported platform gets, which is wp19 §5a item 1's
      // sentence about this very harness -- "the path the harness takes works and the
      // path a user gets does not". The fallback is gone by decision
      // (docs/wp12-release.md, "Which compiler the package ships"), so what has to be
      // true here is that the command says what happened, names the platforms that do
      // have a binary, and exits non-zero. Watched failing against the old launcher,
      // which answered `nish <version>` and exited 0.
      const refused = spawnSync(bin, ["--version"], { cwd: work, encoding: "utf8" });
      const namesEvery = seedAssets.every((a) => refused.stderr.includes(a));
      check(
        "with no prebuilt binary installed, nish refuses, names every supported platform, and exits 3",
        refused.status === 3 && namesEvery && refused.stdout.trim() === "",
        `exit ${refused.status}, stdout ${JSON.stringify(refused.stdout)}, stderr ${JSON.stringify(refused.stderr)}`
      );
      // And it says where to go next rather than only that it will not work. This is
      // the *installed but missing* branch, whose remedy is a reinstall; the
      // unsupported-platform branch is a different sentence and is asserted above,
      // by name, because no runner here is an unsupported platform.
      check(
        "the refusal names the package npm should have installed, and a remedy",
        refused.stderr.includes(`${manifest.name}-${assetFor(process.platform, process.arch)}`) &&
          refused.stderr.includes("Reinstall") &&
          refused.stderr.includes("docs/INSTALL.md"),
        JSON.stringify(refused.stderr)
      );
      // The machine-readable half of the same refusal, and it is a contract rather
      // than a nicety: AGENTS.md's "Machine-readable surfaces" says a failure with no
      // source position is still one JSON line and that under `--json` you never have
      // to read stderr to find out why a run failed. The first version of this change
      // broke that -- the refusal was prose on stderr on every path -- and it is
      // reachable on a fully supported platform, because this is the state
      // `--no-optional` or a lockfile without the optional entries installs into. The
      // shape is `self/compile.ts`'s own for the same code: the object on stdout,
      // nothing on stderr, so a tool reading stdout gets objects and nothing else.
      const refusedJson = spawnSync(bin, ["--json", "hello.ts"], { cwd: work, encoding: "utf8" });
      let refusedObj = null;
      try {
        const lines = refusedJson.stdout.trim().split("\n").filter(Boolean);
        refusedObj = lines.length === 1 ? JSON.parse(lines[0]) : null;
      } catch {
        refusedObj = null;
      }
      check(
        "with no prebuilt binary installed, `nish --json` is still one NL0002 object on stdout, exit 3",
        refusedJson.status === 3 &&
          refusedObj !== null &&
          refusedObj.severity === "error" &&
          refusedObj.code === "NL0002" &&
          typeof refusedObj.message === "string" &&
          refusedObj.message.length > 0 &&
          refusedJson.stderr === "",
        `exit ${refusedJson.status}, stdout ${JSON.stringify(refusedJson.stdout)}, ` +
          `stderr ${JSON.stringify(refusedJson.stderr)}`
      );
      // And the object says which of the three situations it is, in the field a tool
      // keys on plus the prose it carries -- the code is shared with a missing clang,
      // deliberately (one band for "a program that had to run would not"), so the
      // message is what separates them.
      check(
        "the --json refusal names the missing platform package in its message",
        refusedObj !== null &&
          typeof refusedObj.message === "string" &&
          refusedObj.message.includes(`${manifest.name}-${assetFor(process.platform, process.arch)}`),
        refusedObj === null ? "no object" : JSON.stringify(refusedObj.message)
      );
      // Nothing is compiled on the way to either refusal: the message is the whole of
      // what happens, so a machine with no C toolchain gets the same answer. Asked of
      // a command line that *would* write -- an explicit `-o` and a `--link` -- rather
      // than of an empty directory, because "no files appeared" is only an assertion
      // when something was asked for.
      const askedToWrite = spawnSync(bin, ["hello.ts", "-o", "out.ll", "--link", "outbin"], {
        cwd: work,
        encoding: "utf8",
      });
      check(
        "a refusal writes nothing, even asked for an -o and a --link",
        askedToWrite.status === 3 &&
          !fs.existsSync(path.join(work, "out.ll")) &&
          !fs.existsSync(path.join(work, "outbin")),
        `exit ${askedToWrite.status}, directory now holds ${fs.readdirSync(work).join(", ")}`
      );

      // ---- the launcher hands over to a prebuilt binary ----------------------------
      // The path a user on a supported platform actually gets, and the one G5's round
      // trip is about: pack, install into a temporary prefix, and link a hello-world
      // from an unrelated directory. It needs a platform package, so the checks below
      // make one -- twice over, because the two halves want different things from it.
      //
      // First a REAL compiler, staged the way `release.yml` stages one: the binary at
      // `bin/nish` with `runtime/`, `scripts/` and `std/` beside it. That layout is the
      // whole reason the postinstall swap execs the binary where it lies, and it is
      // what lets `--link` find `build.sh` and both runtime translation units one level
      // up from `argv[0]`. This is the half that used to run on the fallback and now
      // runs on the product.
      //
      // Then a STUB, for the launcher's own contract -- argv through, status back,
      // signal re-raised, a broken install named. A stub answers those in milliseconds
      // and says exactly what it was asked; whether the binary it hands to is a correct
      // compiler is the bootstrap section's question, and `npm run bootstrap` asks it.
      const hostAsset = assetFor(process.platform, process.arch);
      if (hostAsset === null) {
        // Counted, and counted once: everything from here to the end of this
        // block is the supported-platform path, and a run that could not build
        // a compiler to stage has not tested it. The `skip` names the reason so
        // a green summary cannot be read as this having been exercised.
        skip(`the installed package hands over to a prebuilt compiler (no asset for ${process.platform}/${process.arch})`);
      } else {
        // ---- a platform package built the way `release.yml` builds one ------------
        // The staging is `release.yml`'s `binaries` job, line for line: `bin/nish`,
        // `runtime/`, `std/`, and **`scripts/build.sh` alone** rather than the whole
        // of `scripts/` -- copying the directory would be a harness that stages more
        // than a release does, and the whole point of this block is that it stops
        // approximating the product.
        //
        // Then `scripts/platform-package.mjs` writes the manifest, and `npm pack`
        // makes the tarball, and `npm install` installs it. That matters for one
        // reason above all: the generator's own `files` list is what shipped without
        // `std` from 0.1.1 to 0.4.0, so every release carried a compiler that could
        // not import its own standard library (wp19 §5a item 1). Hand-writing the
        // manifest and copying into `node_modules` -- which is what this block did
        // when it was first written -- exercises neither the generator nor `files`,
        // and a check that reads the generator's source for the string "std" passes
        // while `"scripts"` is deleted from the same list. Packing is what makes
        // `files` load-bearing here.
        const stage = path.join(pkgDir, "stage");
        fs.rmSync(stage, { recursive: true, force: true });
        fs.mkdirSync(path.join(stage, "bin"), { recursive: true });
        fs.mkdirSync(path.join(stage, "scripts"), { recursive: true });
        for (const dir of ["runtime", "std"]) {
          fs.cpSync(path.join(root, dir), path.join(stage, dir), { recursive: true });
        }
        fs.copyFileSync(path.join(root, "scripts", "build.sh"), path.join(stage, "scripts", "build.sh"));
        fs.copyFileSync(path.join(root, "LICENSE"), path.join(stage, "LICENSE"));
        fs.copyFileSync(path.join(root, "docs", "INSTALL.md"), path.join(stage, "INSTALL.md"));
        const stagedBinary = path.join(stage, "bin", "nish");
        fs.copyFileSync(NISH, stagedBinary);
        fs.chmodSync(stagedBinary, 0o755);
        const generated = spawnSync(
          process.execPath,
          [path.join(root, "scripts", "platform-package.mjs"), stage, hostAsset],
          { cwd: root, encoding: "utf8" }
        );
        check(
          `scripts/platform-package.mjs writes the manifest for ${hostAsset}`,
          generated.status === 0 && fs.existsSync(path.join(stage, "package.json")),
          generated.stdout + generated.stderr
        );
        const platformTar = spawnSync(npm, ["pack", "--json", "--pack-destination", pkgDir], {
          cwd: stage,
          encoding: "utf8",
        });
        check(
          "npm pack turns that stage directory into a platform package",
          platformTar.status === 0,
          platformTar.stdout + platformTar.stderr
        );
        // What the generator's `files` actually shipped, rather than what its
        // source text mentions. `std/` is the entry four releases went without.
        const packed = platformTar.status === 0 ? JSON.parse(platformTar.stdout)[0] : { files: [] };
        const packedPaths = packed.files.map((f) => f.path);
        const wantedInPlatform = [
          "bin/nish",
          "runtime/runtime.c",
          "runtime/runtime_os.c",
          "runtime/nish.h",
          "scripts/build.sh",
          ...fs
            .readdirSync(path.join(root, "std"))
            .filter((f) => f.endsWith(".ts"))
            .map((f) => `std/${f}`),
        ];
        const missingFromPlatform = wantedInPlatform.filter((f) => !packedPaths.includes(f));
        check(
          `the platform package ships a whole compiler (${packedPaths.length} files, ${wantedInPlatform.length} required)`,
          platformTar.status === 0 && missingFromPlatform.length === 0,
          missingFromPlatform.join("\n")
        );
        const addPlatform =
          platformTar.status === 0
            ? spawnSync(
                npm,
                [
                  "install",
                  "--prefix",
                  prefix,
                  "--no-audit",
                  "--no-fund",
                  "--no-save",
                  "--prefer-offline",
                  "--ignore-scripts",
                  path.join(pkgDir, packed.filename),
                ],
                { cwd: pkgDir, encoding: "utf8" }
              )
            : { status: 1, stdout: "", stderr: "nothing to install" };
        check(
          "npm install <platform tarball> into the same prefix succeeds",
          addPlatform.status === 0,
          addPlatform.stdout + addPlatform.stderr
        );
        const platformDir = path.join(prefix, "node_modules", ...`${manifest.name}-${hostAsset}`.split("/"));
        {
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
          const ir = spawnSync(
            bin,
            [path.join(root, "examples", "add.ts"), "-o", path.join(work, "add.ll")],
            { cwd: work, encoding: "utf8" }
          );
          check(
            "installed nish compiles examples/add.ts to IR from an unrelated cwd",
            ir.status === 0 && fs.existsSync(path.join(work, "add.ll")),
            ir.stderr
          );
          // A program that imports the standard library, through the installed package,
          // by its package specifier. `std/` travels in the platform package as well as
          // in the main one -- four releases shipped a compiler that could not import
          // its own standard library (wp19 §5a item 1) -- and the specifier resolves
          // against the compiler's own root, which here is inside that package rather
          // than inside a checkout. With the Node fallback gone this is the only path
          // that answers it, so it is asserted rather than assumed.
          fs.writeFileSync(
            path.join(work, "std.ts"),
            'import { trim } from "nish/text";\n' +
              "export function main(): number {\n" +
              '  console.log(trim("  ok  "));\n' +
              "  return 0;\n}\n"
          );
          const stdLink = spawnSync(bin, ["std.ts", "--link", "stdhello"], { cwd: work, encoding: "utf8" });
          const stdRan =
            stdLink.status === 0
              ? spawnSync(path.join(work, "stdhello"), [], { cwd: work, encoding: "utf8" })
              : null;
          check(
            "installed nish compiles and links a program importing nish/text",
            stdLink.status === 0 && stdRan !== null && stdRan.status === 0 && stdRan.stdout.trim() === "ok",
            stdLink.stderr + (stdRan === null ? "" : stdRan.stdout + stdRan.stderr)
          );
        }

        // ---- the launcher's own contract, on a stub --------------------------------
        // The real compiler above answered "is the product correct". These answer
        // "does the launcher get out of the way", which wants a program that says
        // exactly what it was handed and costs milliseconds. It replaces the binary
        // inside the package npm just installed, so everything the launcher resolves
        // is still resolved the way a user's install resolves it.
        const stub = path.join(platformDir, "bin", "nish");
        fs.writeFileSync(stub, '#!/bin/sh\necho "stub $*"\nexit 42\n');
        fs.chmodSync(stub, 0o755);
        const handed = spawnSync(bin, ["--version", "x"], { cwd: work, encoding: "utf8" });
        check(
          "installed nish runs the prebuilt binary when one is installed, with argv and exit code intact",
          handed.status === 42 && handed.stdout.trim() === "stub --version x",
          `exit ${handed.status}, stdout ${JSON.stringify(handed.stdout)}`
        );
        // A signal is re-raised rather than folded into an exit code, so a crash or an
        // interrupt reaches the shell as what it was. `process.exitCode` cannot carry
        // one, so a launcher that forgot this would make `nish` the one command in a
        // pipeline that turned SIGINT into an ordinary status.
        fs.writeFileSync(stub, "#!/bin/sh\nkill -TERM $$\n");
        fs.chmodSync(stub, 0o755);
        const signalled = spawnSync(bin, [], { cwd: work, encoding: "utf8" });
        check(
          "a prebuilt binary killed by a signal reaches the caller as that signal",
          signalled.signal === "SIGTERM",
          `signal ${signalled.signal}, status ${signalled.status}`
        );
        // Installed but unstartable is a broken install, not an unsupported platform,
        // and the two get different advice: reinstall the package, rather than "this
        // machine has no compiler and will not have one". There is nothing to fall
        // back to any more -- this used to answer `nish <version>` out of `dist/` with
        // a warning above it -- so the reason has to be in the refusal itself.
        fs.writeFileSync(stub, "not a binary\n");
        fs.chmodSync(stub, 0o644);
        const broken = spawnSync(bin, ["--version"], { cwd: work, encoding: "utf8" });
        check(
          "a prebuilt binary that will not start is refused with the reason, and exits 3",
          broken.status === 3 &&
            broken.stdout.trim() === "" &&
            broken.stderr.includes("could not be started") &&
            broken.stderr.includes("Reinstall"),
          `exit ${broken.status}, stdout ${JSON.stringify(broken.stdout)}, stderr ${JSON.stringify(broken.stderr)}`
        );

        // ---- the postinstall swap ---------------------------------------
        // The shim above is correct and costs node's startup on every
        // invocation -- 94 ms against the binary's own 2.7 ms, measured, so
        // about 80 seconds across a suite that spawns a compiler per case.
        // `scripts/postinstall.mjs` removes it by replacing `bin/nish` with
        // the binary it would otherwise spawn. The install above ran with
        // `--ignore-scripts`, which is why the shim was still there to test;
        // this drives the script directly, which is also the honest way to
        // test it, because what it has to do is the same whether npm ran it
        // or a person did.
        fs.writeFileSync(stub, '#!/bin/sh\necho "swapped $* from $0"\nexit 7\n');
        fs.chmodSync(stub, 0o755);
        const installed = path.join(prefix, "node_modules", ...manifest.name.split("/"));
        const swap = spawnSync(process.execPath, [path.join(installed, "scripts", "postinstall.mjs")], {
          cwd: work,
          encoding: "utf8",
        });
        check(
          "postinstall replaces the node shim with an exec of the prebuilt binary",
          swap.status === 0 && fs.readFileSync(path.join(installed, "bin", "nish"), "utf8").startsWith("#!/bin/sh"),
          swap.stdout + swap.stderr
        );
        const swapped = spawnSync(bin, ["a"], { cwd: work, encoding: "utf8" });
        check(
          "the swapped bin runs the binary with no node in front of it",
          swapped.status === 7 && swapped.stdout.startsWith("swapped a from "),
          `exit ${swapped.status}, stdout ${JSON.stringify(swapped.stdout)}`
        );
        // The regression this file did not have, and the reason the swap is an
        // `exec` rather than a copy of the binary into the main package.
        //
        // npm links the command as `.bin/nish -> ../@amritk/nish/bin/nish`, so
        // a user always invokes it through a symlink -- `bin` above is that
        // symlink, deliberately. The native compiler resolves `build.sh` and
        // `runtime/` from `argv[0]`'s directory and does not follow one
        // (wp19 §5a item 4), so a binary *copied* next to the main package is
        // reached as `node_modules/.bin/nish`, looks for them in
        // `node_modules/`, and every `--link` fails -- while `--version` and
        // `-o` keep working, which is what makes it a trap rather than an
        // outage. Execing the binary where it was installed means `argv[0]`
        // is a real path inside its own package, next to the `runtime/` and
        // `scripts/` staged and smoke-tested beside it.
        //
        // The stub prints its own `$0`, so this asserts the thing the failure
        // was about -- which directory the compiler will resolve from -- and
        // not merely that something ran.
        const ranFrom = (swapped.stdout.split(" from ")[1] ?? "").trim();
        check(
          "the swapped bin execs the binary inside its own platform package, not a copy beside the main one",
          ranFrom.startsWith(platformDir + path.sep),
          `the swapped bin ran ${JSON.stringify(ranFrom)}, which is not under ${platformDir}; ` +
            "a compiler reached through npm's .bin symlink from there cannot find scripts/build.sh"
        );
        // Every way this can go wrong has to leave a working compiler, because
        // the shim it replaces is one and npm fails an install on a non-zero
        // postinstall. Removing the platform package is the reachable version
        // of "there is nothing to swap in" -- the same answer a read-only
        // node_modules or an unsupported platform gets.
        fs.rmSync(platformDir, { recursive: true, force: true });
        const nothing = spawnSync(process.execPath, [path.join(installed, "scripts", "postinstall.mjs")], {
          cwd: work,
          encoding: "utf8",
        });
        check(
          "postinstall with no platform package to swap in succeeds rather than failing the install",
          nothing.status === 0,
          nothing.stdout + nothing.stderr
        );
      }
    }
  }
}

// ---- WP12: the release train's version bump ------------------------------------------
// `release-pr.yml` bumps four things in one `node -e` script: package.json's version,
// package-lock.json's two copies of it, every platform package pinned in
// optionalDependencies, and VERSION in self/branding.ts. Nothing ran it. It is a
// workflow step, so it executes exactly once per merge to main, in a place where a
// failure stops the release train rather than a pull request -- and the person who finds
// out is whoever wanted to cut a release.
//
// It broke on the commit that added the optionalDependencies half, and for a reason no
// amount of reading the diff would have caught: the script lives inside `node -e '...'`,
// and a comment in it said "release's binaries". That apostrophe closed the shell string
// and handed node a truncated program, so the step died with `Unexpected end of input`
// after changelog-gen had already written changelog/<version>.json. The YAML was valid,
// the JavaScript was valid, and the shell quoting was not.
//
// So the step is RUN here, against copies, the way `.github/seed-matrix.sh` and
// `.github/seed-due.sh` are run rather than read. Extracted from the workflow rather
// than restated, because a second copy of the bump would agree with the first until one
// of them was edited -- which is the whole failure this block exists for.
if (!only || "release-pr".includes(only) || "wp12".includes(only)) {
  const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "release-pr.yml"), "utf8");
  const open = workflow.indexOf("node -e '");
  const close = workflow.indexOf("' \"$next\"", open);
  check("release-pr: the version-bump step is where this expects it", open >= 0 && close > open);
  if (open >= 0 && close > open) {
    // The block as the shell receives it: the workflow indents it, and the indentation
    // is inside the quoted string, so it is stripped the same way YAML does.
    const raw = workflow.slice(open, close + "' \"$next\"".length);
    const bump = raw
      .split("\n")
      .map((line) => (line.startsWith("          ") ? line.slice(10) : line))
      .join("\n");
    const work = path.join(buildDir, "release-pr-bump");
    fs.rmSync(work, { recursive: true, force: true });
    fs.mkdirSync(path.join(work, "self"), { recursive: true });
    for (const f of ["package.json", "package-lock.json"]) {
      fs.copyFileSync(path.join(root, f), path.join(work, f));
    }
    fs.copyFileSync(path.join(root, "self", "branding.ts"), path.join(work, "self", "branding.ts"));
    const next = "9.9.9";
    const ran = spawnSync("bash", ["-c", `set -e\nnext=${next}\n${bump}\n`], { cwd: work, encoding: "utf8" });
    check(
      "release-pr: the version-bump step runs (a quote in a comment truncates it, and did)",
      ran.status === 0,
      ran.stderr
    );
    if (ran.status === 0) {
      const bumped = JSON.parse(fs.readFileSync(path.join(work, "package.json"), "utf8"));
      const lock = JSON.parse(fs.readFileSync(path.join(work, "package-lock.json"), "utf8"));
      check(
        "release-pr: the bump moves package.json and both of package-lock.json's versions",
        bumped.version === next && lock.version === next && lock.packages?.[""]?.version === next,
        `package.json ${bumped.version}, lock ${lock.version}, lock.packages[""] ${lock.packages?.[""]?.version}`
      );
      // The half that was added with the installer, and the reason this block exists: a
      // release whose optionalDependencies were left behind installs a compiler that
      // resolves the previous release's binaries. It succeeds, it runs, and it is one
      // version stale in the half nobody looks at.
      //
      // Both copies of that list, which is the half this check did not have. package.json
      // keeps optionalDependencies at the top level and a lockfile keeps the root
      // package under `packages[""]`, so a bump reading only the top level moves one and
      // leaves the other -- and reading only the top level is what this check did too,
      // so it passed while 0.4.0 shipped a lockfile still pinned to 0.3.0. `npm ci`
      // tolerates the disagreement and `npm install` silently rewrites it, so nothing
      // anywhere went red. A check that looks where the code looks cannot see the code
      // looking in the wrong place: both places are named here.
      const pinSets = [
        ["package.json", bumped.optionalDependencies ?? {}],
        ["package-lock.json packages[\"\"]", lock.packages?.[""]?.optionalDependencies ?? {}],
      ];
      const stale = pinSets.flatMap(([where, deps]) =>
        Object.entries(deps)
          .filter(([, v]) => v !== next)
          .map(([k, v]) => `${where}: ${k} stayed at ${v}`)
      );
      const pinCount = pinSets.reduce((n, [, deps]) => n + Object.keys(deps).length, 0);
      check(
        `release-pr: the bump moves every platform package in BOTH files (${pinCount})`,
        pinSets.every(([, deps]) => Object.keys(deps).length > 0) && stale.length === 0,
        stale.length > 0
          ? stale.join("\n")
          : pinSets.map(([where, deps]) => `${where} pins ${Object.keys(deps).length}`).join("; ")
      );
      const branding = fs.readFileSync(path.join(work, "self", "branding.ts"), "utf8");
      check(
        "release-pr: the bump moves VERSION in self/branding.ts, which tests/run.js pins",
        new RegExp(`VERSION: string = "${next}"`).test(branding),
        (branding.match(/VERSION: string = "[^"]*"/) ?? ["not found"])[0]
      );
    }
  }
}

// ---- The seed fetch -------------------------------------------------------------------
// `scripts/fetch-seed.sh` is how a fresh clone, the session hook and CI get the
// released compiler every stage1 here is built with. `tests/fetch_seed.js` drives
// it against a stand-in installer -- which arguments reach `install.sh`, when it
// is not called at all, what is refused -- with no network and nothing touched in
// the real `build/seed/`, so it runs in every `npm test`, a degraded one included.
if (!only || "fetch-seed".includes(only) || "seed".includes(only)) {
  const fetched = spawnSync("node", [path.join(root, "tests", "fetch_seed.js")], { cwd: root, encoding: "utf8" });
  const fetchSummary = fetched.stdout.trim().split("\n").pop() ?? "";
  check(
    `scripts/fetch-seed.sh passes its own checks (${fetchSummary})`,
    fetched.status === 0 && /^fetch-seed: \d+ passed, 0 failed/.test(fetchSummary),
    `${fetched.stdout}${fetched.stderr}`
  );
}

// ---- WP19: the seed-target contract --------------------------------------------------
// `.github/seed-targets.json` is the one place a seed asset is spelled. release.yml
// attaches `nish-<version>-<asset>.tar.gz` and builds its `binaries` matrix from that
// file; ci.yml's `seeds` job looks for exactly that name before it gives a platform a
// `bootstrap` row. Neither workflow states a platform, because a contract written down
// twice is two strings that agree until one of them is edited.
//
// Four things can rot in that file without breaking a build -- a `triple` the compiler
// cannot target, an `asset` that has stopped being that triple's short spelling, a
// `host` that is not the machine the triple names, and a `runner` label GitHub has
// retired -- and one thing can rot in the jobs it feeds, which is worse: reporting
// success for a freeze it did not check, or red for a state in which nothing is wrong.
// §A5 of wp19-stage0-retirement.md is what the first of those costs, and all of them
// have now happened here, which is why `.github/seed-matrix.sh` and
// `.github/seed-due.sh` are *run* below rather than read.
if (!only || "seed-targets".includes(only) || "wp19".includes(only)) {
  const seedTargets = JSON.parse(fs.readFileSync(path.join(root, ".github", "seed-targets.json"), "utf8"));
  /**
   * The triple the compiler under test writes for `--target <spec>`, or null when
   * it refuses the spelling. Asked of the compiler rather than read out of
   * `self/target.ts`, so an alias it resolves counts as the canonical triple it
   * resolves to and nothing else does.
   */
  const resolveTarget = (spec) => {
    const out = path.join(buildDir, "seed-target-probe.ll");
    const r = spawnSync(NISH, [path.join(root, "examples", "add.ts"), "--target", spec, "-o", out], {
      cwd: root,
      encoding: "utf8",
    });
    const triple = r.status === 0 ? /^target triple = "([^"]+)"$/m.exec(fs.readFileSync(out, "utf8")) : null;
    return triple === null ? null : { triple: triple[1] };
  };
  const rows = seedTargets.targets;
  const pkgVersion = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
  const dueAt = (v) => rows.filter((t) => notAfter(t.attachedSince, v));
  const due = dueAt(pkgVersion);

  // ---- install.sh, the other way in ---------------------------------------------------
  // `curl | sh` has to name a release asset, and a release asset is spelled in
  // seed-targets.json and nowhere else. The script cannot read that file -- it runs on a
  // machine that has none of this repository -- so it derives the asset from `uname`,
  // and the derivation is checked here against every row rather than trusted.
  //
  // The script is *run* for this, the way seed-matrix.sh and seed-due.sh are: sourced
  // with NISH_INSTALL_SOURCE_ONLY=1, which returns before the install and leaves the one
  // function behind. A copy of the mapping written out in JavaScript here would be a
  // third spelling of the thing this check exists to stop there being two of.
  //
  // `uname -m` is why it is a mapping and not a concatenation: Linux on 64-bit ARM says
  // `aarch64` and macOS on the same silicon says `arm64`, and the triple this project
  // targets calls both `aarch64`. A row whose `host` stopped deriving its `asset` would
  // hand a user the wrong tarball, or a 404, with nothing between them and it.
  {
    const installSh = path.join(root, "install.sh");
    const askScript = (unameS, unameM) =>
      spawnSync(
        "sh",
        ["-c", `NISH_INSTALL_SOURCE_ONLY=1 . "$1"; nish_asset "$2" "$3" || true`, "sh", installSh, unameS, unameM],
        { encoding: "utf8" }
      );
    check("install.sh: the script is valid POSIX sh", spawnSync("sh", ["-n", installSh], { encoding: "utf8" }).status === 0);
    const wrong = [];
    for (const row of rows) {
      // `host` is `uname -s`-`uname -m` on that platform, which is exactly the pair the
      // script reads, so the row is the input and the row is the expectation.
      const dash = row.host.indexOf("-");
      const answer = askScript(row.host.slice(0, dash), row.host.slice(dash + 1)).stdout.trim();
      if (answer !== row.asset) wrong.push(`${row.host} -> ${JSON.stringify(answer)}, but the file says ${row.asset}`);
    }
    check(
      `install.sh: every row's host derives that row's asset (${rows.length}: ${rows.map((t) => t.host).join(", ")})`,
      wrong.length === 0,
      wrong.join("\n")
    );
    // macOS on Intel reports `x86_64` and some Linux userlands report `amd64` for the
    // same machine; both have to land on the same row, and neither is a platform of its
    // own.
    check(
      "install.sh: amd64 is the same row as x86_64",
      askScript("Linux", "amd64").stdout.trim() === "x86_64-linux",
      `Linux/amd64 derived ${JSON.stringify(askScript("Linux", "amd64").stdout.trim())}`
    );
    // The wrapper, and the defect it exists for. Unpacking a release tarball onto `$PATH`
    // used not to be an install: invoked as `$PATH` found it, argv[0] is a bare `nish`
    // with no directory in it, the compiler resolved `./..` for scripts/build.sh and
    // runtime/, and every `--link` failed against whatever the working directory
    // happened to be -- while `--version` and `-o` kept working (wp19 §5a item 4).
    //
    // **The compiler handles that spelling itself as of 2026-09-20**: a bare argv[0] is
    // looked up on `$PATH`, which is where the shell found it, and the check below drives
    // the real compiler that way end to end. So this wrapper is no longer what makes a
    // tarball-on-PATH install work.
    //
    // **And the symlink spelling as of 2026-09-21**: the real path of whatever `argv[0]`
    // named is a candidate for the package root as well, so `node_modules/.bin/nish ->
    // ../<pkg>/bin/nish` and an admin's `ln -s /opt/nish/bin/nish /usr/local/bin/nish`
    // both reach the package they point into. The checks below drive a real compiler
    // through both link spellings.
    //
    // So the wrapper sidesteps nothing the compiler cannot now do, and it stays for two
    // reasons that do not depend on the defect. `install.sh` installs a RELEASED
    // compiler, and every release up to and including 0.5.0 predates the fix, so the
    // script has to keep working for a binary that has it wrong -- which is a property of
    // what it downloads rather than of this tree. And an `exec` of an absolute path is
    // what makes the command the compiler itself rather than a launcher in front of it,
    // measured at 3.2 ms against node's 94 ms (docs/wp12-release.md, "What the launcher
    // costs").
    //
    // Driven with a stub binary rather than a downloaded one, so this needs no network
    // and can say exactly what argv[0] arrived as -- which is the thing that was wrong.
    // The compiler itself, driven the way `$PATH` drives it, end to end. The check above
    // is about `install.sh`'s wrapper; this one is about the defect, and it is the only
    // place a bare `nish` reaches a REAL compiler -- everything else in the suite invokes
    // one by a path, which is precisely why nothing noticed for four releases (§A7: "the
    // harness happens to invoke the spelling that agrees").
    //
    // An install is staged rather than assumed: `bin/nish` beside `scripts/`, `runtime/`
    // and `std/` is the layout release.yml builds, so what runs here is the shape a user
    // unpacks. It is driven from a third directory, so neither the checkout nor the
    // staged directory can be what makes it work, and the program imports `nish/text` --
    // a specifier resolved against the package root, so it fails if argv[0] was resolved
    // wrongly even when `scripts/build.sh` was found some other way.
    {
      const inst = path.join(buildDir, "argv0-path-install");
      fs.rmSync(inst, { recursive: true, force: true });
      fs.mkdirSync(path.join(inst, "bin"), { recursive: true });
      fs.mkdirSync(path.join(inst, "scripts"), { recursive: true });
      fs.copyFileSync(NISH, path.join(inst, "bin", "nish"));
      fs.chmodSync(path.join(inst, "bin", "nish"), 0o755);
      fs.copyFileSync(path.join(root, "scripts", "build.sh"), path.join(inst, "scripts", "build.sh"));
      fs.cpSync(path.join(root, "runtime"), path.join(inst, "runtime"), { recursive: true });
      fs.cpSync(path.join(root, "std"), path.join(inst, "std"), { recursive: true });

      const work = path.join(buildDir, "argv0-path-work");
      fs.rmSync(work, { recursive: true, force: true });
      fs.mkdirSync(work, { recursive: true });
      fs.writeFileSync(
        path.join(work, "prog.ts"),
        'import { trim } from "nish/text";\n\nexport const main = (): number => {\n  write(`[${trim("  padded  ")}]\\n`);\n  return 0;\n};\n'
      );
      const onPath = (args) =>
        spawnSync("nish", args, {
          cwd: work,
          encoding: "utf8",
          env: { ...process.env, PATH: `${path.join(inst, "bin")}${path.delimiter}${process.env.PATH}` },
        });

      const linked = onPath(["prog.ts", "--link", "prog"]);
      check(
        "a bare `nish` on PATH links: argv[0] with no directory is looked up on PATH",
        linked.status === 0,
        `exit ${linked.status}\n${linked.stdout}${linked.stderr}`
      );
      if (linked.status === 0) {
        const ran = spawnSync(path.join(work, "prog"), [], { cwd: work, encoding: "utf8" });
        check(
          "a bare `nish` on PATH resolves nish/<module> against the package, not the cwd",
          ran.status === 0 && ran.stdout.trim() === "[padded]",
          `exit ${ran.status}, stdout ${JSON.stringify(ran.stdout)}`
        );
      }

      // WP19 §A7's third bullet: the same program, the same install, three spellings of
      // `argv[0]`, and one `; ModuleID` for the standard-library module.
      //
      // `packageRoot()` is `<dirname(argv[0])>/..`, so the three spellings answer three
      // different roots -- and a package module used to be *named* by the path the
      // compiler found it at, which made a program's IR a fact about the install rather
      // than about the program. It is named by its package-relative specifier now, on
      // both sides. The bare name is the one that matters most and reads the least: it
      // is what `$PATH` hands a compiler, and before this it wrote the install's whole
      // path into the header of a module the user never named.
      //
      // The comparison is between the three spellings rather than against one string
      // that could be rewritten to whatever the compiler happens to say, and the
      // expectation is spelled as well, so a change that made all three agree on the
      // wrong answer still fails.
      {
        const spellings = [
          ["absolute", path.join(inst, "bin", "nish"), undefined],
          ["relative", path.join("..", "argv0-path-install", "bin", "nish"), undefined],
          ["bare, found on PATH", "nish", `${path.join(inst, "bin")}${path.delimiter}${process.env.PATH}`],
        ];
        const headers = spellings.map(([label, cmd, PATH]) => {
          const out = path.join(work, `out-${label.split(",")[0]}`);
          fs.rmSync(out, { recursive: true, force: true });
          const r = spawnSync(cmd, ["prog.ts", "-o", `${out}${path.sep}`], {
            cwd: work,
            encoding: "utf8",
            env: PATH === undefined ? process.env : { ...process.env, PATH },
          });
          const ll = path.join(out, "text.ll");
          return {
            label,
            header: r.status === 0 && fs.existsSync(ll) ? fs.readFileSync(ll, "utf8").split("\n")[0] : `exit ${r.status}: ${r.stderr}`,
          };
        });
        const want = "; ModuleID = 'std/text.ts'";
        check(
          "a nish/<module> is named package-relatively under every spelling of argv[0]",
          headers.every((h) => h.header === want),
          headers.map((h) => `${h.label}: ${h.header}`).join("\n")
        );
      }

      // And the diagnostic when there genuinely is no package: it has to name where it
      // looked, and `./..` is the answer that sent somebody looking in the wrong place.
      // A copy of the binary alone on PATH is that state.
      //
      // With a program that imports nothing, deliberately. `prog.ts` above would fail
      // on `nish/text` before `--link` was ever reached -- the standard library is
      // resolved against the same package root -- and this check is about the link
      // step's message, so it has to get there.
      fs.writeFileSync(
        path.join(work, "plain.ts"),
        'export const main = (): number => {\n  write("plain\\n");\n  return 0;\n};\n'
      );
      const lonely = path.join(buildDir, "argv0-path-lonely");
      fs.rmSync(lonely, { recursive: true, force: true });
      fs.mkdirSync(lonely, { recursive: true });
      fs.copyFileSync(NISH, path.join(lonely, "nish"));
      fs.chmodSync(path.join(lonely, "nish"), 0o755);
      const orphan = spawnSync("nish", ["plain.ts", "--link", "p2"], {
        cwd: work,
        encoding: "utf8",
        env: { ...process.env, PATH: `${lonely}${path.delimiter}${process.env.PATH}` },
      });
      check(
        "a bare `nish` with no package around it names the directory it searched, not `./..`",
        orphan.status !== 0 && orphan.stderr.includes(`${lonely}/..`) && !orphan.stderr.includes("./.."),
        `exit ${orphan.status}\n${orphan.stdout}${orphan.stderr}`
      );

      // The other half of the same defect, and the compiler answers this one too as of
      // 2026-09-21: `argv[0]` naming a **symbolic link** to the compiler rather than the
      // compiler. npm writes exactly that shape
      // (`node_modules/.bin/nish -> ../@amritk/nish/bin/nish`), and so does an admin's
      // `ln -s /opt/nish/bin/nish /usr/local/bin/nish`. Neither the parent of the link's
      // directory nor the `$PATH` lookup above finds the package, because a link is
      // itself a perfectly good path -- so the real path of whatever was invoked is a
      // candidate as well, through the `realpathSync` builtin 0.5.0 shipped (wp19 §5a
      // item 4; the call site waited a release for the rolling freeze).
      //
      // Both spellings are driven, because they failed for different reasons: an
      // absolute link never reached the `$PATH` code at all, and a bare name reached it
      // and found the link. Each program imports `nish/text`, which is the half of this
      // that is not about `--link`: `std/` is resolved against the same root, so a
      // wrongly-resolved one fails before the link with ``Module `nish/text` is not part
      // of the standard library``. Both link checks were watched failing with the fix
      // reverted out of `self/compile.ts` and stage1 rebuilt, and the released 0.5.0
      // compiler reproduces the same two failures by hand.
      const symlinkInstall = (dir, target) => {
        fs.rmSync(dir, { recursive: true, force: true });
        fs.mkdirSync(dir, { recursive: true });
        const link = path.join(dir, "nish");
        fs.symlinkSync(target, link);
        return link;
      };
      const binary = path.join(inst, "bin", "nish");

      // An admin's link: absolute, and invoked by its own absolute path.
      const absLink = symlinkInstall(path.join(buildDir, "argv0-symlink-abs"), binary);
      const viaAbsLink = spawnSync(absLink, ["prog.ts", "--link", "prog-abs-link"], { cwd: work, encoding: "utf8" });
      check(
        "a symlink to the compiler links: the package is found through the link, not beside it",
        viaAbsLink.status === 0,
        `exit ${viaAbsLink.status}\n${viaAbsLink.stdout}${viaAbsLink.stderr}`
      );
      if (viaAbsLink.status === 0) {
        const ran = spawnSync(path.join(work, "prog-abs-link"), [], { cwd: work, encoding: "utf8" });
        check(
          "a symlink to the compiler resolves nish/<module> against the package the link points into",
          ran.status === 0 && ran.stdout.trim() === "[padded]",
          `exit ${ran.status}, stdout ${JSON.stringify(ran.stdout)}`
        );
      }

      // npm's shape: a RELATIVE link in a directory on `$PATH`, invoked by bare name, so
      // both fixes have to hold at once -- the lookup finds the link and the link is then
      // resolved.
      const binDir = path.join(buildDir, "argv0-symlink-bin");
      symlinkInstall(binDir, path.relative(binDir, binary));
      const viaBinLink = spawnSync("nish", ["prog.ts", "--link", "prog-bin-link"], {
        cwd: work,
        encoding: "utf8",
        env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH}` },
      });
      check(
        "npm's `.bin` shape links: a relative symlink found on PATH by bare name",
        viaBinLink.status === 0,
        `exit ${viaBinLink.status}\n${viaBinLink.stdout}${viaBinLink.stderr}`
      );
      if (viaBinLink.status === 0) {
        const ran = spawnSync(path.join(work, "prog-bin-link"), [], { cwd: work, encoding: "utf8" });
        check(
          "npm's `.bin` shape resolves nish/<module> against the package, not `node_modules/`",
          ran.status === 0 && ran.stdout.trim() === "[padded]",
          `exit ${ran.status}, stdout ${JSON.stringify(ran.stdout)}`
        );
      }
    }

    // `realpathSync` against an actual symbolic link, which is the half
    // `tests/cases/io_realpath` cannot state: a resolved path is absolute, so it is
    // whatever machine this runs on, and a golden can only pin the shape. Here the
    // link and its target are both resolved and compared to each other, which is
    // machine-independent and is the property the builtin exists for.
    //
    // It is the builtin under the symlink half of wp19 §5a item 4 -- `argv[0]` reaching
    // the compiler through `node_modules/.bin/nish` or through an admin's
    // `ln -s /opt/nish/bin/nish /usr/local/bin/nish`. `packageRoot()` calls it as of
    // 0.6.0, one release after the builtin, which is what the rolling freeze costs; the
    // two `argv0-symlink-*` checks above are that call site driven end to end, and this
    // one is the builtin itself, which is what they would fail through.
    const rp = path.join(buildDir, "realpath-symlink");
    fs.rmSync(rp, { recursive: true, force: true });
    fs.mkdirSync(rp, { recursive: true });
    fs.writeFileSync(path.join(rp, "target.txt"), "x\n");
    fs.symlinkSync("target.txt", path.join(rp, "link.txt"));
    fs.mkdirSync(path.join(rp, "sub"), { recursive: true });
    fs.symlinkSync("..", path.join(rp, "sub", "up"));
    fs.writeFileSync(
      path.join(rp, "probe.ts"),
      [
        "export function main(): number {",
        '  const target = realpathSync("target.txt");',
        "  if (target === null) {",
        '    console.log("target: <null>");',
        "    return 1;",
        "  }",
        '  const link = realpathSync("link.txt");',
        '  console.log(`same: ${link !== null && link === target}`);',
        '  const viaDir = realpathSync("sub/up/target.txt");',
        '  console.log(`viaDir: ${viaDir !== null && viaDir === target}`);',
        '  console.log(`missing: ${realpathSync("absent-6b2f") === null}`);',
        "  return 0;",
        "}",
        "",
      ].join("\n")
    );
    const built = spawnSync(NISH, ["probe.ts", "--link", "probe"], { cwd: rp, encoding: "utf8" });
    check(
      "realpathSync: a program using it compiles and links",
      built.status === 0,
      `${built.stdout}${built.stderr}`
    );
    if (built.status === 0) {
      const ran = spawnSync(path.join(rp, "probe"), [], { cwd: rp, encoding: "utf8" });
      check(
        "realpathSync: a symlink and its target resolve to one path, through a directory link too",
        ran.status === 0 && ran.stdout === "same: true\nviaDir: true\nmissing: true\n",
        `exit ${ran.status}, stdout ${JSON.stringify(ran.stdout)}`
      );
    }

    {
      const home = path.join(buildDir, "install-sh-wrapper");
      fs.rmSync(home, { recursive: true, force: true });
      fs.mkdirSync(path.join(home, "bin"), { recursive: true });
      const staged = path.join(home, "bin", "nish");
      fs.writeFileSync(staged, '#!/bin/sh\necho "argv0=$0"\necho "args=$*"\nexit 9\n');
      fs.chmodSync(staged, 0o755);
      const wrote = spawnSync(
        "sh",
        ["-c", `NISH_INSTALL_SOURCE_ONLY=1 . "$1"; nish_write_wrapper "$2"`, "sh", installSh, home],
        { encoding: "utf8" }
      );
      check("install.sh: nish_write_wrapper succeeds", wrote.status === 0, wrote.stdout + wrote.stderr);
      check(
        "install.sh: the binary moves to libexec/, so bin/nish can take the command name",
        fs.existsSync(path.join(home, "libexec", "nish")) &&
          fs.readFileSync(path.join(home, "bin", "nish"), "utf8").startsWith("#!/bin/sh"),
        "the wrapper did not replace the binary at bin/nish"
      );
      // Run it the way a user does: found on PATH, by bare name, from an unrelated
      // directory. Both halves matter -- a wrapper that worked only when invoked by path
      // would pass a weaker version of this and ship the bug.
      const viaPath = spawnSync("sh", ["-c", 'cd / && PATH="$1:$PATH" nish one two', "sh", path.join(home, "bin")], {
        encoding: "utf8",
      });
      const argv0 = (viaPath.stdout.match(/argv0=(.*)/) ?? [])[1] ?? "";
      check(
        "install.sh: a bare `nish` on PATH reaches the binary with an absolute argv[0]",
        viaPath.status === 9 && argv0 === path.join(home, "libexec", "nish"),
        `argv[0] was ${JSON.stringify(argv0)}; the compiler resolves its runtime from its dirname, ` +
          "so anything without a directory in it makes --link fail against $PWD"
      );
      check(
        "install.sh: the wrapper passes its arguments through",
        /args=one two/.test(viaPath.stdout),
        viaPath.stdout + viaPath.stderr
      );
      // Installing over an existing install has to replace the compiler, and the
      // failure mode is silent: the caller has just unpacked a fresh `bin/nish`, so a
      // guard that skipped the move when `libexec/nish` already existed would leave the
      // OLD compiler in place and point a NEW wrapper at it. `nish --version` then
      // answers the version you had before, and the only sign anything happened is that
      // the script said it was installing.
      fs.writeFileSync(staged, '#!/bin/sh\necho "second"\nexit 8\n');
      fs.chmodSync(staged, 0o755);
      const again = spawnSync(
        "sh",
        ["-c", `NISH_INSTALL_SOURCE_ONLY=1 . "$1"; nish_write_wrapper "$2"`, "sh", installSh, home],
        { encoding: "utf8" }
      );
      const upgraded = spawnSync(path.join(home, "bin", "nish"), [], { cwd: root, encoding: "utf8" });
      check(
        "install.sh: installing over an existing install replaces the compiler",
        again.status === 0 && upgraded.status === 8 && upgraded.stdout.trim() === "second",
        `the wrapper still runs the previous binary: exit ${upgraded.status}, ${JSON.stringify(upgraded.stdout)}`
      );
      // And the marker keeps a second call with no unpack in between from moving the
      // wrapper on top of the compiler, which would leave bin/nish execing itself.
      const noUnpack = spawnSync(
        "sh",
        ["-c", `NISH_INSTALL_SOURCE_ONLY=1 . "$1"; nish_write_wrapper "$2"`, "sh", installSh, home],
        { encoding: "utf8" }
      );
      const stillWorks = spawnSync(path.join(home, "bin", "nish"), [], { cwd: root, encoding: "utf8" });
      check(
        "install.sh: running the wrapper step twice over does not eat the compiler",
        noUnpack.status === 0 && stillWorks.status === 8,
        `exit ${stillWorks.status}, ${JSON.stringify(stillWorks.stdout + stillWorks.stderr)}`
      );
      // The wrapper holds an ABSOLUTE path, so it does not survive the directory
      // moving -- and the script stages the install in a temporary directory beside
      // the destination and renames it into place, which moves it every time. Writing
      // the wrapper only while staged produces an install whose `bin/nish` execs a
      // path that has already been deleted:
      //
      //     bin/nish: exec: /.../.nish-install.XXXX/stage/libexec/nish: not found
      //
      // so the script calls this again at the final path. The staged copy is still
      // what gets run for the version check, because that has to happen before the
      // old install is touched -- through `libexec/nish` directly rather than through
      // the wrapper, for this reason.
      const moved = path.join(buildDir, "install-sh-moved");
      fs.rmSync(moved, { recursive: true, force: true });
      fs.renameSync(home, moved);
      const stale = spawnSync(path.join(moved, "bin", "nish"), [], { encoding: "utf8" });
      check(
        "install.sh: a wrapper written before the directory moved is stale, which is why it is rewritten",
        stale.status !== 8,
        "the wrapper survived its directory being renamed, so this check no longer proves what it is for"
      );
      const rewritten = spawnSync(
        "sh",
        ["-c", `NISH_INSTALL_SOURCE_ONLY=1 . "$1"; nish_write_wrapper "$2"`, "sh", installSh, moved],
        { encoding: "utf8" }
      );
      const afterMove = spawnSync(path.join(moved, "bin", "nish"), [], { encoding: "utf8" });
      check(
        "install.sh: rewriting the wrapper at its final path makes the install work again",
        rewritten.status === 0 && afterMove.status === 8,
        `exit ${afterMove.status}, ${JSON.stringify(afterMove.stdout + afterMove.stderr)}`
      );

      // The command surface, which costs nothing to check and is what a person reads
      // when the install did not do what they meant. All three exit before any
      // network, so none of this needs a release to exist.
      // `--dir build/nish` has to become an absolute path before the wrapper bakes it
      // in, or the installed compiler runs only from the directory it was installed
      // from -- a worse version of the argv[0] defect the wrapper exists to work
      // around, and one a person is much more likely to hit, because `--dir` invites a
      // relative path.
      const abs = (arg, cwd) =>
        spawnSync("sh", ["-c", `NISH_INSTALL_SOURCE_ONLY=1 . "$1"; nish_abspath "$2"`, "sh", installSh, arg], {
          cwd,
          encoding: "utf8",
        }).stdout.trim();
      check(
        "install.sh: a relative --dir is made absolute before the wrapper records it",
        abs("some/where", root) === path.join(root, "some/where") &&
          abs("./here", root) === path.join(root, "here") &&
          abs("/already/absolute", root) === "/already/absolute",
        `got ${JSON.stringify([abs("some/where", root), abs("./here", root), abs("/already/absolute", root)])}`
      );
      const help = spawnSync("sh", [installSh, "--help"], { encoding: "utf8" });
      check(
        "install.sh: --help explains the options and exits 0",
        help.status === 0 && /--uninstall/.test(help.stdout) && /--dir/.test(help.stdout),
        `exit ${help.status}, ${JSON.stringify(help.stdout.slice(0, 200))}`
      );
      // An unknown option is refused rather than taken for a version. Silently
      // treating `--dry-run` as a release name would download nothing, find nothing,
      // and blame the release.
      const bogus = spawnSync("sh", [installSh, "--dry-run"], { encoding: "utf8" });
      check(
        "install.sh: an unknown option is refused, not read as a version",
        bogus.status !== 0 && /unknown option/.test(bogus.stderr),
        `exit ${bogus.status}, ${JSON.stringify(bogus.stderr)}`
      );
      const nothingThere = spawnSync(
        "sh",
        [installSh, "--uninstall", "--dir", path.join(buildDir, "install-sh-absent")],
        { encoding: "utf8" }
      );
      check(
        "install.sh: --uninstall on a directory with no install says so rather than removing something",
        nothingThere.status !== 0 && /nothing installed/.test(nothingThere.stderr),
        `exit ${nothingThere.status}, ${JSON.stringify(nothingThere.stderr)}`
      );
    }

    // A platform with no row gets nothing rather than a guess: the script turns an empty
    // answer into a message naming npm, which does work there. An invented asset name
    // would be a 404 the user has to interpret.
    const unsupported = ["FreeBSD x86_64", "Linux riscv64", "MINGW64_NT-10.0 x86_64"].filter(
      (pair) => askScript(...pair.split(" ")).stdout.trim() !== ""
    );
    check(
      "install.sh: a platform with no prebuilt binary derives no asset at all",
      unsupported.length === 0,
      unsupported.map((p) => `${p} derived an asset, and no release carries one`).join("\n")
    );
  }

  // Two versions to drive the scripts with, read out of the file rather than typed,
  // and each used BOTH as the tag and as the expected row count. Both halves matter:
  // a tag hardcoded as "v0.2.0" while the expectation counted `due` -- the targets due
  // at *package.json*'s version -- passed only while those two happened to agree, and
  // went red on the next version bump, which is the release this branch exists to
  // enable. The coupling is structural now: one version, used for the tag and for the
  // count, so bumping package.json cannot re-break it.
  //
  // `early` is the oldest attachedSince in the file, so exactly the targets sharing it
  // are due; `late` is past every attachedSince, so all of them are.
  const early = rows.map((t) => t.attachedSince).reduce((a, b) => (notAfter(a, b) ? a : b));
  const late = "9999.0.0";
  const dueEarly = dueAt(early);
  const dueLate = dueAt(late);
  const later = rows.find((t) => !notAfter(t.attachedSince, early));
  check(
    `seed targets: the file has a version where some but not all targets are due (${early}: ${dueEarly.map((t) => t.asset).join(", ")})`,
    dueEarly.length > 0 && dueEarly.length < rows.length && dueLate.length === rows.length && later !== undefined
  );
  check("seed targets: the file lists targets", Array.isArray(rows) && rows.length > 0);

  // The canonical spelling, `x86_64-unknown-linux-gnu` rather than one of its aliases:
  // the asset name is derived from it below, and two spellings of one triple would
  // derive two names for one binary.
  const uncanonical = rows.filter((t) => resolveTarget(t.triple)?.triple !== t.triple);
  check(
    `seed targets: every triple is one the compiler writes as itself under --target (${rows.length}: ${rows.map((t) => t.asset).join(", ")})`,
    uncanonical.length === 0,
    uncanonical.map((t) => `${t.asset}: ${t.triple}`).join("\n")
  );

  // The asset name is the triple with the vendor and the ABI dropped, and that is the
  // whole of the rule: x86_64-unknown-linux-gnu -> x86_64-linux, aarch64-apple-darwin ->
  // aarch64-darwin. A derivation rather than a second list is what keeps the tarball
  // names and the compiler's targets one set of platforms instead of two -- two of the
  // four asset names were once written down as triples the compiler accepts, and
  // `aarch64-darwin` and `x86_64-darwin` are not spellings it has ever accepted.
  const derive = (triple) => {
    const part = triple.split("-");
    return `${part[0]}-${part[2]}`;
  };
  const misnamed = rows.filter((t) => t.asset !== derive(t.triple));
  check(
    "seed targets: every asset name is its triple without the vendor or the ABI",
    misnamed.length === 0,
    misnamed.map((t) => `${t.asset} != ${derive(t.triple)} (from ${t.triple})`).join("\n")
  );

  // `host` is what `uname -s`-`uname -m` prints on that platform, and release.yml's
  // `binaries` job refuses to stamp the asset name into a tarball built on a machine
  // that prints something else. That guard is the last one standing between a mislabelled
  // asset and a user, so the row it compares against had better be derivable from the
  // triple rather than typed: `aarch64-apple-darwin` is `Darwin-arm64` and nothing else.
  const uname = (triple) => {
    const [arch, , os] = triple.split("-");
    const sys = { linux: "Linux", darwin: "Darwin" }[os];
    const machine = os === "darwin" && arch === "aarch64" ? "arm64" : arch;
    return sys ? `${sys}-${machine}` : undefined;
  };
  const mishosted = rows.filter((t) => t.host !== uname(t.triple));
  check(
    "seed targets: every host is the `uname -s`-`uname -m` its triple names",
    mishosted.length === 0,
    mishosted.map((t) => `${t.asset}: ${t.host} != ${uname(t.triple)} (from ${t.triple})`).join("\n")
  );

  // A runner label GitHub has retired is a row that never runs: release.yml's matrix is
  // `runs-on: ${{ matrix.target.runner }}` and so is ci.yml's `bootstrap`, so the label
  // is executable configuration rather than documentation. This is a denylist and not a
  // whitelist because there is no authoritative list of live labels in this repository
  // and inventing one would fail on the day GitHub adds an image -- but a label known to
  // be gone is exactly the defect that shipped here: `macos-13` stood in this file after
  // GitHub retired the last Intel macOS image, so the day a release attached
  // `x86_64-darwin` its bootstrap row would have had nowhere to run.
  const retired = {
    "macos-11": "retired 2024; use macos-15-intel for x86_64 darwin",
    "macos-12": "retired 2024-12; use macos-15-intel for x86_64 darwin",
    "macos-13": "retired 2025-12, the last Intel image under that name; use macos-15-intel",
    "ubuntu-18.04": "retired 2023",
    "ubuntu-20.04": "retired 2025-04",
  };
  const dead = rows.filter((t) => retired[t.runner]);
  check(
    `seed targets: no row names a retired runner label (${rows.map((t) => t.runner).join(", ")})`,
    dead.length === 0,
    dead.map((t) => `${t.asset}: ${t.runner} -- ${retired[t.runner]}`).join("\n")
  );

  // `attachedSince` is a version and not a boolean, and that is load-bearing rather than
  // cosmetic. A boolean says "release.yml builds this today", which is a statement about
  // the workflow; `seeds` reads it as "the last release carried this", which is a
  // statement about a past event. The two part company in exactly the commit that adds a
  // platform: flipping a boolean to true while teaching release.yml to build the asset
  // turns `seeds` red against the release that came before, and release.yml's `release`
  // job is `needs: ci` -- so the release that would carry the asset cannot be cut, and
  // the flag cannot be flipped until it is. A version dates the claim instead.
  const badSince = rows.filter((t) => typeof t.attachedSince !== "string" || !/^\d+(\.\d+)*$/.test(t.attachedSince));
  check(
    "seed targets: every attachedSince is a dotted-integer version, not a boolean",
    badSince.length === 0,
    badSince.map((t) => `${t.asset}: ${JSON.stringify(t.attachedSince)}`).join("\n")
  );
  check(
    `seed targets: at least one target is due at ${pkgVersion}, or nothing checks the rolling freeze at all (${due.map((t) => t.asset).join(", ") || "none"})`,
    due.length > 0
  );
  check(
    "seed targets: the file says why attachedSince is a version rather than a boolean",
    seedTargets.note.some((n) => n.includes("attachedSince")) &&
      seedTargets.note.some((n) => n.includes("deadlock"))
  );

  // release.yml reads the spelling; it must not also state it. The failure this guards
  // against is the ordinary one -- a name edited on one side of the contract -- and it
  // looks exactly like the lines that used to be there: a `case "$(uname -s)"` mapping
  // hosts to assets, a matrix listing four triples, and four paths on the `gh release
  // create` line. An asset name anywhere in that file is one of them coming back.
  //
  // Checked for every row and not only the due ones, because a release.yml that spells a
  // platform it does not yet build is the same defect one release early.
  //
  // Runner labels are deliberately NOT part of this: `ubuntu-latest` is what the
  // `targets` and `release` jobs themselves run on, so the label legitimately appears
  // and forbidding it would be wrong. What must not be hardcoded is the `binaries`
  // matrix, and that is asserted directly -- its rows and its runner both come from the
  // file, by way of the `targets` job. A retired label is the retired-label check above,
  // which is where that defect belongs.
  const releaseYml = fs.readFileSync(path.join(root, ".github", "workflows", "release.yml"), "utf8");

  // ---- The tarball carries a standard library, not only a compiler ------------------
  //
  // Every release from 0.1.1 to 0.4.0 staged `bin`, `runtime` and `scripts` and no
  // `std/`. The compiler in those tarballs links `hello.ts` and answers any
  // `import { trim } from "nish/text"` with ``Module `nish/text` is not part of the
  // standard library (it has: json, testing, text)`` -- a sentence that names the module
  // it is refusing, because the list in it is the static table of module names and the
  // FILE is what is absent. It reproduces on the published v0.4.0 asset, and it is the
  // same omission in both channels the installer uses, since the npm platform package is
  // `npm pack` over the same staged directory.
  //
  // Three things had to be true at once for four releases to ship it, and each gets a
  // check here rather than a comment:
  //
  //   * the staging copied `runtime` and not `std`;
  //   * the "carries a whole compiler" gate listed seven paths, none of them under
  //     `std/`, so the presence check that exists for exactly this class passed;
  //   * both smoke programs -- `hello.ts` and `examples/multi` -- import nothing, so a
  //     compiler with no standard library links them and says so.
  //
  // The pack-and-install round trip in this file did not see it either, and that is the
  // instructive one: it packed the MAIN package, whose `files` has listed `std` all
  // along, and a main package with no platform package beside it fell back to `dist/`.
  // The path that worked was the one the harness took; the path a user gets was the one
  // that did not. That is wp19 §A7's sentence about `argv[0]` -- "the harness happens to
  // invoke the spelling that agrees" -- holding for the product a second time.
  //
  // **That hole is closed as of 0.6.0**, and by construction rather than by a check
  // added beside it: there is no `dist/` to fall back to, so the round trip stages a
  // real compiler into a platform package and drives `--link` and `nish/text` through
  // it. The harness now takes the path a user gets because it is the only path there is.
  check(
    "release tarball: the staging copies std/ beside runtime/, or no released compiler can import nish/<module>",
    /\bcp -r std "\$stage\/std"/.test(releaseYml),
    "release.yml's binaries job does not stage std/ into the tarball"
  );
  // The presence gate names a std module, so a narrower copy is caught where `runtime`
  // already is. It is a presence check and shares `runtime`'s limit: an empty text.ts
  // would pass here and fail in the smoke step below, which is why both exist.
  check(
    "release tarball: the presence gate names a std module among the paths that must be there",
    /for f in [^\n]*\bstd\/[a-z_]+\.ts\b/.test(releaseYml),
    "release.yml's tarball gate lists no std/ path, so a staging that drops it passes"
  );
  // And a program that USES the library, run rather than compiled. A list is a claim
  // about names; only running one of those modules says the library is whole. The
  // specifier form matters: `nish/text` is the form resolved against the compiler's own
  // package root, which is the only form the staging can break -- a relative import
  // resolves against the program and would pass with no std/ shipped at all.
  check(
    "release tarball: the smoke test compiles and runs a program that imports nish/<module>",
    /from "nish\/text"/.test(releaseYml) && /\.\/stdlib/.test(releaseYml),
    "release.yml smokes no program that imports the standard library by its package specifier"
  );
  // The npm side of the same omission. `platform-package.mjs` writes the manifest for
  // the per-platform package the launcher hands over to, and its `files` is the second
  // place the library has to be listed -- the staged directory is shared, the two
  // `files` lists are not.
  const platformPackage = fs.readFileSync(path.join(root, "scripts", "platform-package.mjs"), "utf8");
  check(
    "platform package: its files list carries std, so npm ships what the tarball ships",
    /files:\s*\[[^\]]*"std"[^\]]*\]/.test(platformPackage),
    "scripts/platform-package.mjs omits std from the platform package's files"
  );
  const spelled = rows.filter((t) => releaseYml.includes(t.asset));
  check(
    "seed targets: release.yml names no asset, because it reads them from the file",
    releaseYml.includes("seed-targets.json") && releaseYml.includes("seed-due.sh") && spelled.length === 0,
    spelled.map((t) => t.asset).join(", ")
  );
  // Two references, not a shape. There is no YAML parser in this repository's
  // dependencies, so this reads the text -- but it reads it for the two things that
  // carry the meaning rather than for a layout: the matrix comes from the `targets`
  // job's output, and the runner comes from a matrix row. An earlier version matched
  // `matrix:\n    target: ${{ fromJSON(...) }}` as one adjacent pattern, which would
  // have gone red on a reformat or on the `fromJson` spelling, both of which are
  // correct code. Whitespace-insensitive, and case-insensitive where Actions is.
  const derivesMatrix = /\bfromjson\s*\(\s*needs\.targets\.outputs\.rows\s*\)/i.test(releaseYml);
  const derivesRunner = /runs-on:\s*\$\{\{\s*matrix\.target\.runner\s*\}\}/.test(releaseYml);
  check(
    "seed targets: release.yml's binaries matrix and its runner are both the file's answer",
    derivesMatrix && derivesRunner,
    `matrix from the targets job: ${derivesMatrix}; runner from the matrix row: ${derivesRunner}`
  );

  // docs/INSTALL.md's table tells a reader which release first carries the binary for
  // their platform, and it says in so many words that the versions in it are
  // `attachedSince` rather than prose. That sentence is a claim about this repository,
  // so it is checked here: a row added to the JSON, or an attachedSince moved, has to
  // reach the table a user actually reads. The alternative is the failure this whole
  // file exists to prevent, one document further out.
  const install = fs.readFileSync(path.join(root, "docs", "INSTALL.md"), "utf8");
  const tabled = rows.filter((t) => {
    const row = install.split("\n").find((l) => l.includes(`nish-<version>-${t.asset}.tar.gz`));
    return row && row.trim().endsWith(`| v${t.attachedSince} |`);
  });
  check(
    `seed targets: docs/INSTALL.md's table names every asset with the version it is attached from (${rows.length})`,
    tabled.length === rows.length,
    rows
      .filter((t) => !tabled.includes(t))
      .map((t) => `${t.asset}: expected a table row ending "| v${t.attachedSince} |"`)
      .join("\n")
  );

  // The prose, as far as prose can be checked. INSTALL.md's table has a shape, so the
  // check above compares it cell by cell; the work-package documents state the same
  // versions in sentences, and when the darwin pair moved from 0.3.0 to 0.4.0 three of
  // those sentences went stale in silence -- two of them in the same table as a row that
  // had been corrected, two rows apart.
  //
  // What is mechanical about a sentence is the claim shape. Every place a document names
  // a version FOR a platform does it one of a few ways, and each is a version next to a
  // platform: "the darwin pair from 0.4.0", "the darwin pair `0.4.0`", "the two macOS
  // rows say v0.4.0". Those are matched and compared against the file. It is not a
  // general prose checker and does not pretend to be one -- a sentence phrased a new way
  // escapes it -- but it closes the shapes that have actually gone stale here, and a new
  // phrasing that wants checking can be added to the list.
  //
  // Rather than enumerate connectives, each pattern is the platform's name followed by
  // up to forty characters that do not end the sentence, then the first version after
  // it -- which is how one greps for this by hand, and is robust to "is 0.3.0", "at
  // 0.3.0", "is held at 0.4.0" and "is **0.4.0**" alike. Enumerating them was the first
  // attempt and it missed three of thirteen, found by grepping wider than the check and
  // comparing the counts. Both orders, because the documents use both.
  // No comma in the forward span: the documents enumerate these reversed and
  // comma-separated -- "0.1.1 for `x86_64-linux`, 0.3.0 for `aarch64-linux`" -- and a
  // span that may cross a comma reads the NEXT platform's version as this one's, which
  // is two false positives rather than a missed claim. The reversed patterns below are
  // what catch those, and they are unambiguous.
  // Every one of these documents is hard-wrapped at 80 columns, so a phrase written with
  // literal spaces cannot match a claim that lands on a wrap point, and a span that
  // excludes `\n` cannot reach a version on the next line. Both of `wp10-ci.md`'s darwin
  // claims wrap -- one between "darwin" and "pair", one between "is" and the version --
  // so `sed -i 's/0\.4\.0/0.3.0/g' docs/wp10-ci.md` used to leave this check green, on
  // one of the three documents that had actually gone stale. Every word boundary inside
  // an anchor is therefore `[ \t\n]+`, and `near` allows newlines.
  //
  // `:` is excluded from `near` to pay for that reach. Without it the wider span picks up
  // "the commit that taught release.yml to build the darwin pair could not also mark them
  // attached: v0.2.0" in `wp12-release.md` -- a sentence about a past release, not a claim
  // about `attachedSince`. A colon ends a claim for the same reason a period and a comma
  // do, and excluding it costs no true claim in the tree.
  const s = "[ \\t\\n]+";
  const near = "[^.|,:]{0,40}?";
  const ver = "(\\d+\\.\\d+\\.\\d+)";
  const versionClaims = [
    // [description, regex source with the version in group 1, the asset it must equal]
    // The two darwin patterns are compared against `aarch64-darwin`'s version, because
    // the documents talk about "the darwin pair" and "the two macOS rows" jointly and
    // never name either asset with a version of its own (INSTALL.md's table does name
    // them separately, and the check above compares that cell by cell). A joint claim is
    // only well-defined while the pair shares a version, so that is asserted below
    // rather than assumed: if the two ever diverge, this list needs one pattern per
    // asset and the check says so instead of being right by luck.
    ["the darwin pair ... <version>", `darwin${s}pair${near}${ver}`, "aarch64-darwin"],
    ["the macOS rows ... v<version>", `macOS${s}rows${s}say${s}v?${near}${ver}`, "aarch64-darwin"],
    ["<version> for the darwin pair", `${ver}${s}for${s}the${s}darwin${s}pair`, "aarch64-darwin"],
    ["`aarch64-linux` ... <version>", `\`aarch64-linux\`${near}${ver}`, "aarch64-linux"],
    ["<version> for `aarch64-linux`", `${ver}${s}for${s}\`aarch64-linux\``, "aarch64-linux"],
    ["`x86_64-linux` ... <version>", `\`x86_64-linux\`${near}${ver}`, "x86_64-linux"],
    ["<version> for `x86_64-linux`", `${ver}${s}for${s}\`x86_64-linux\``, "x86_64-linux"],
    // "the other three" is the documents' joint name for everything but the first
    // target, and it appeared when `aarch64-linux` joined the darwin pair at one
    // version. Like the pair patterns it is only well-defined while those three share a
    // version, which is asserted below. Without this pattern `wp12-release.md` states
    // its versions in no other way and the mutation test missed that document, which is
    // how the pattern came to be added.
    ["<version> for the other three", `${ver}${s}for${s}the${s}other${s}three`, "aarch64-linux"],
    ["the other three from <version>", `the${s}other${s}three${s}from${s}${ver}`, "aarch64-linux"],
  ];
  // "the other three" -- everything but the first target -- is only a claim with one
  // answer while those three share a version, exactly as "the darwin pair" is. Asserted
  // rather than assumed for the same reason: when they diverge the documents have to
  // stop using the phrase, and this says so instead of comparing a joint sentence to
  // whichever of the three the pattern happens to name.
  const otherThree = rows.slice(1);
  check(
    `seed targets: the three targets after the first share one attachedSince, which is what lets the docs say "the other three" (${otherThree.map((t) => `${t.asset} ${t.attachedSince}`).join(", ")})`,
    otherThree.length === 3 && new Set(otherThree.map((t) => t.attachedSince)).size === 1,
    'those three no longer share an attachedSince, so a claim about "the other three" has no single answer: reword the documents and drop that pattern from versionClaims'
  );

  const darwinPair = rows.filter((t) => t.triple.endsWith("-apple-darwin"));
  check(
    `seed targets: the darwin pair shares one attachedSince, which is what lets the docs speak of it as a pair (${darwinPair.map((t) => `${t.asset} ${t.attachedSince}`).join(", ")})`,
    darwinPair.length === 2 && darwinPair[0].attachedSince === darwinPair[1].attachedSince,
    "the two darwin rows have different attachedSince values, so a claim about `the darwin pair` no longer has one answer: give each asset its own pattern in versionClaims above"
  );

  const proseDocs = ["INSTALL.md", "wp10-ci.md", "wp12-release.md", "wp19-stage0-retirement.md"];
  const staleProse = [];
  let proseClaims = 0;
  for (const doc of proseDocs) {
    const text = fs.readFileSync(path.join(root, "docs", doc), "utf8");
    for (const [shape, re, asset] of versionClaims) {
      const want = rows.find((t) => t.asset === asset)?.attachedSince;
      for (const m of text.matchAll(new RegExp(re, "g"))) {
        proseClaims += 1;
        if (m[1] !== want) staleProse.push(`docs/${doc}: ${shape} says ${m[1]}, but ${asset} is ${want}`);
      }
    }
  }
  check(
    `seed targets: every per-platform version the docs state in prose is the one in the file (${proseClaims} claims)`,
    staleProse.length === 0 && proseClaims >= proseDocs.length,
    staleProse.join("\n") || `only ${proseClaims} claims matched; the phrasings may have changed`
  );

  // `.github/seed-due.sh` is the one place a version is compared, because release.yml
  // asks it about the version being released and seed-matrix.sh asks it about the last
  // release's -- the same question about two different versions, which is the whole
  // distinction the boolean could not draw. Answered in two places it would be the same
  // two-strings defect one level down.
  const dueSh = (version) =>
    spawnSync("bash", [path.join(root, ".github", "seed-due.sh"), version], { cwd: root, encoding: "utf8" });
  if (!has("jq")) {
    skip("seed matrix: jq is not installed, so .github/seed-due.sh and seed-matrix.sh were not run (their states are unchecked here)");
  } else {
    const dueNow = dueSh(pkgVersion);
    check(
      `seed-due: ${pkgVersion} is due exactly the targets whose attachedSince it has reached (${due.map((t) => t.asset).join(", ")})`,
      dueNow.status === 0 &&
        JSON.stringify(JSON.parse(dueNow.stdout).map((t) => t.asset)) === JSON.stringify(due.map((t) => t.asset)),
      dueNow.stdout + dueNow.stderr
    );
    const dueAll = dueSh(late);
    check(
      "seed-due: a far-future version is due every target in the file",
      dueAll.status === 0 && JSON.parse(dueAll.stdout).length === rows.length,
      dueAll.stdout + dueAll.stderr
    );
    const dueNone = dueSh("0.0.1");
    check(
      "seed-due: a version before the first attachedSince is due nothing",
      dueNone.status === 0 && JSON.parse(dueNone.stdout).length === 0,
      dueNone.stdout + dueNone.stderr
    );
    // A version this cannot order must stop the run rather than sort oddly: every caller
    // is deciding whether a missing release asset is a failure, and finding out that the
    // scheme changed by mis-ordering a prerelease is the wrong way round.
    const dueJunk = dueSh("0.3.0-rc1");
    check(
      "seed-due: a version it cannot order is refused rather than guessed at",
      dueJunk.status === 2 && dueJunk.stderr.includes("dotted-integer"),
      `exit ${dueJunk.status}\n${dueJunk.stdout}${dueJunk.stderr}`
    );
  }

  // `.github/seed-matrix.sh` decides which platforms get a bootstrap row, driven by a
  // stand-in for the GitHub CLI so all of its states can be asked for here. The states
  // are not interchangeable: a seed a release was DUE to carry and did not is a broken
  // gate, a seed not yet due is a platform with no row, and no release at all is every
  // platform in that second state at once -- which may not be red, because release.yml's
  // release job is `needs: ci` and the first release is what would supply the seed.
  //
  // The tags below are chosen to separate those states rather than to be realistic,
  // and they are read out of the file: `early` is a version only the oldest targets are
  // due at, `late` is one every target is due at. With a boolean there was no way to
  // write the second pair of cases at all, which is how the deadlock got as far as this
  // file.
  const seedDir = path.join(buildDir, "wp19-seed-matrix");
  fs.rmSync(seedDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(seedDir, "bin"), { recursive: true });
  const ghStub = path.join(seedDir, "bin", "gh");
  fs.writeFileSync(
    ghStub,
    '#!/usr/bin/env bash\n# Stand-in for `gh`, answering from FAKE_TAG / FAKE_ASSETS.\ncase "$2" in\n' +
      "  list) printf '%s\\n' \"$FAKE_TAG\" ;;\n" +
      "  view) [ -n \"$FAKE_ASSETS\" ] && printf '%s\\n' $FAKE_ASSETS ;;\n" +
      "esac\nexit 0\n"
  );
  fs.chmodSync(ghStub, 0o755);
  const seedMatrix = (tag, assets) => {
    const outFile = path.join(seedDir, "output");
    fs.writeFileSync(outFile, "");
    const r = spawnSync("bash", [path.join(root, ".github", "seed-matrix.sh")], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${path.join(seedDir, "bin")}${path.delimiter}${process.env.PATH}`,
        FAKE_TAG: tag,
        FAKE_ASSETS: assets,
        GITHUB_OUTPUT: outFile,
        GITHUB_STEP_SUMMARY: "",
      },
    });
    const written = fs.readFileSync(outFile, "utf8");
    const rowsLine = /^rows=(.*)$/m.exec(written);
    // `cmp` is read the same way and kept distinct from "the script did not
    // write it": an output GitHub never receives is the empty string, and
    // `!= '[]'` is true of it, so the job keyed on it would ask for an empty
    // matrix -- an error rather than a skip. `undefined` here is what that
    // state looks like from the harness, and the checks below assert it does
    // not happen in any arm that exits 0.
    const cmpLine = /^cmp=(.*)$/m.exec(written);
    return {
      ...r,
      rows: rowsLine ? JSON.parse(rowsLine[1]) : undefined,
      cmp: cmpLine ? JSON.parse(cmpLine[1]) : undefined,
    };
  };

  const first = rows[0];
  if (!has("jq")) {
    // The skip above covers this block too; one SKIP line for one missing tool.
  } else {
    const carried = seedMatrix(`v${early}`, `nish-${early}.tgz nish-${early}-${first.asset}.tar.gz`);
    check(
      `seed matrix: a release carrying ${first.asset} gives that platform a bootstrap row`,
      carried.status === 0 &&
        carried.rows?.length === 1 &&
        carried.rows[0].asset === first.asset &&
        carried.rows[0].tag === `v${early}` &&
        carried.rows[0].tarball === `nish-${early}-${first.asset}.tar.gz` &&
        carried.rows[0].runner === first.runner,
      carried.stdout + carried.stderr
    );

    // The negative, and half the reason this block exists: a seed the release was DUE to
    // attach is missing. That is a platform that COULD have checked the freeze and did
    // not, so it is red -- red here, and red for the release workflow that runs this one
    // through `needs: ci`. A warning here would be a green check standing for a gate
    // nobody ran.
    const dropped = seedMatrix(`v${early}`, `nish-${early}.tgz`);
    check(
      `seed matrix: a release that attaches no ${first.asset} seed FAILS rather than warns`,
      dropped.status === 1 && dropped.stdout.includes("::error::"),
      `exit ${dropped.status}\n${dropped.stdout}${dropped.stderr}`
    );

    // A release that carries no seed for a platform not yet due one is the other absence,
    // and it is not that one: it is expected, it gets no row, and it is green. This is
    // the arm that says the release which first attaches those binaries can actually be
    // cut -- v0.2.0 does not carry them, and if this were red it could not be.
    const notYet = seedMatrix(`v${early}`, `nish-${early}-${first.asset}.tar.gz`);
    check(
      `seed matrix: no ${later.asset} seed at v${early} is a platform with no row rather than a failure`,
      notYet.status === 0 &&
        notYet.rows?.length === dueEarly.length &&
        !notYet.rows.some((r) => r.asset === later.asset),
      `exit ${notYet.status}\n${notYet.stdout}${notYet.stderr}`
    );

    // The same absence one release later, when it has become the first kind. This is the
    // pair the boolean could not express: `attached: false` made the row above green
    // forever, so a release.yml that silently stopped attaching a darwin binary would
    // have reported a platform with no row instead of a broken gate.
    const overdue = seedMatrix(`v${late}`, `nish-${late}-${first.asset}.tar.gz`);
    check(
      `seed matrix: once ${later.asset} is due, a release without it FAILS rather than going quiet`,
      overdue.status === 1 && overdue.stdout.includes("::error::") && overdue.stdout.includes(later.asset),
      `exit ${overdue.status}\n${overdue.stdout}${overdue.stderr}`
    );

    // A tag nothing can order. `gh release list --limit 1` returns the newest release
    // whatever its shape, prereleases included, so this is reachable without anyone
    // doing anything odd: cut an `-rc1` and the next push turns `seeds` red. It has to
    // be red -- guessing an order is how a missing seed gets excused -- but it has to
    // say so in an annotation, because this job is `needs: ci` for the release workflow
    // and a red check whose only output is on stderr is a release with no visible
    // reason. The first version of this exited 2 with nothing but stderr.
    const unorderable = seedMatrix("v0.3.0-rc1", "");
    check(
      "seed matrix: a release tag seed-due.sh cannot order fails with an ::error:: and a recovery, not silently",
      unorderable.status === 1 &&
        unorderable.stdout.includes("::error::") &&
        unorderable.stdout.includes("dotted integers") &&
        unorderable.stdout.includes("needs: ci"),
      `exit ${unorderable.status}\n${unorderable.stdout}${unorderable.stderr}`
    );

    // And no release at all: nothing could have been checked anywhere, so there is no row,
    // no failure, and no green check claiming otherwise. This is the state before 0.1.0
    // and in every fork, and making it red is how a release train deadlocks.
    const none = seedMatrix("", "");
    check(
      "seed matrix: before the first release there is no seed, no row and no failure",
      none.status === 0 && none.rows?.length === 0 && none.stdout.includes("::notice::"),
      `exit ${none.status}\n${none.stdout}${none.stderr}`
    );

    // And the claim ci.yml makes about the day WP19 G5 attaches a darwin binary: the row
    // appears with no edit to the workflow, on the runner the file names. It is checked
    // rather than asserted in a comment, because the last comment that said this was not
    // true.
    const all = rows.map((t) => `nish-${late}-${t.asset}.tar.gz`).join(" ");
    const future = seedMatrix(`v${late}`, all);
    check(
      `seed matrix: a seed for every target gives each a row on its own runner with no edit to ci.yml`,
      future.status === 0 &&
        future.rows?.length === rows.length &&
        future.rows.every((r, i) => r.asset === rows[i].asset && r.runner === rows[i].runner),
      future.stdout + future.stderr
    );

    // ---- WP19 G2.1: which releases nish-cmp may compare against ----------------------
    //
    // `cmpSince` is to G2.1 what `attachedSince` is to G3, and it is a version for the
    // identical reason: a release already published cannot grow a file. The seeds 0.1.1
    // through 0.4.0 ship no `std/`, so the compiler in them refuses every
    // `nish/<module>` specifier -- against any of those, nish-cmp correctly reports two
    // corpus programs on which HEAD is right and the seed is broken, and there is
    // nothing anybody can edit in the tree to make that go away. A release that predates
    // a *decided* change of output is out of reach for a second reason: it disagrees with
    // HEAD on purpose, and DECLARED cannot say so between releases because it wants words
    // in a CHANGELOG.md that is generated at release time. So the gate gets no row until
    // a release exists that it may be asked about, for whichever of the two reasons
    // applies -- `.github/seed-targets.json`'s note says which, and what the dark window
    // costs while the field is ahead of every shipped release.
    //
    // Which is the one thing in this pair that could quietly stop being true. An absent
    // row is indistinguishable from a passing one in a summary, so each arm is asked for
    // here rather than left to the workflow.
    const cmpSince = seedTargets.cmpSince;
    check(
      `seed targets: cmpSince is a dotted-integer version (${cmpSince})`,
      typeof cmpSince === "string" && /^[0-9]+(\.[0-9]+)*$/.test(cmpSince),
      `cmpSince is ${JSON.stringify(cmpSince)}`
    );

    // Every arm that exits 0 writes BOTH outputs. An output the script never sets
    // arrives at the workflow as the empty string, `!= '[]'` is true of it, and the job
    // keyed on it asks GitHub for an empty matrix -- which is an error and not a skip.
    // That is the same shape as the deadlock this file's header describes, and it would
    // arrive as a red X on the first release rather than a grey square.
    for (const [label, r] of [
      ["no release at all", none],
      ["a release before cmpSince", carried],
      ["a release past every attachedSince", future],
    ]) {
      check(
        `seed matrix: ${label} still writes a cmp output rather than leaving it unset`,
        r.status !== 0 || r.cmp !== undefined,
        `exit ${r.status}, cmp=${JSON.stringify(r.cmp)}\n${r.stdout}${r.stderr}`
      );
    }

    // A seed older than cmpSince is no row and an explanation, not a red check and not a
    // green one. `carried` is the oldest attachedSince in the file, which is necessarily
    // before cmpSince while cmpSince is ahead of every shipped release.
    //
    // Counted rather than conditional when it cannot be posed. Lowering cmpSince to the
    // oldest attachedSince leaves no release that is "before" it, so this question stops
    // having an answer -- and a check that disappears when the thing it guards is
    // weakened is the pathology this package has recorded five times. A skip says so in
    // the summary; an `if` with no `else` says nothing.
    if (!notAfter(cmpSince, early)) {
      check(
        `seed matrix: a release before cmpSince (${early} < ${cmpSince}) gives nish-cmp no row, and says why`,
        carried.status === 0 &&
          Array.isArray(carried.cmp) &&
          carried.cmp.length === 0 &&
          carried.stdout.includes("::notice::") &&
          carried.stdout.includes("cmpSince"),
        `exit ${carried.status}, cmp=${JSON.stringify(carried.cmp)}\n${carried.stdout}${carried.stderr}`
      );
    } else {
      skip(
        `cmpSince is ${cmpSince} and the oldest attachedSince is ${early}, so no release in this ` +
          "file is before it: nothing here proves a pre-cmpSince release gets no nish-cmp row"
      );
    }

    // And at a version past every attachedSince and past cmpSince: a row for each Linux
    // seed and none for macOS. The Linux-only rule is a measurement rather than a
    // preference -- the checks that keep `macos-latest` out of the `test` matrix encode
    // an ELF assumption (wp19 §5a item 3) -- and it is derived from the row's own runner
    // label, so a Linux platform added later is picked up with no edit to either file.
    const linuxRows = rows.filter((t) => t.runner.startsWith("ubuntu"));
    check(
      `seed matrix: past cmpSince, nish-cmp gets a row per Linux seed and none for macOS (${linuxRows.map((t) => t.asset).join(", ")})`,
      future.status === 0 &&
        Array.isArray(future.cmp) &&
        future.cmp.length === linuxRows.length &&
        future.cmp.every((r, i) => r.asset === linuxRows[i].asset && r.runner === linuxRows[i].runner) &&
        future.cmp.every((r) => r.tarball && r.tag),
      `cmp=${JSON.stringify(future.cmp)}\n${future.stdout}${future.stderr}`
    );

    // Every nish-cmp row is one of the bootstrap rows. The two gates download the same
    // asset from the same release, and a `cmp` row the release does not carry is a
    // download that fails inside the job rather than a matrix that is empty before it.
    check(
      "seed matrix: every nish-cmp row is a seed the release actually carries",
      Array.isArray(future.cmp) &&
        future.cmp.every((c) => future.rows.some((r) => r.asset === c.asset && r.tarball === c.tarball)),
      `cmp=${JSON.stringify(future.cmp)}\nrows=${JSON.stringify(future.rows)}`
    );
  }
}

// ---- WP19: stage3 == stage2, on both platforms ---------------------------------------
// `scripts/verify-binaries.sh` is the last equality `scripts/bootstrap.sh --verify`
// asserts, and it is a script of its own so that this block can ask it for the branch
// the machine running the suite does not take. On ELF two links of one input are
// byte-identical and that is asserted; on Mach-O they are not, and there the comparison
// narrows to the size plus equality once debug information is stripped, with anything
// left over failing as UNATTRIBUTED.
//
// Narrows, not lifts: an arm that printed a line and carried on would accept a stage3
// that is a different compiler from stage2, which is the one thing this comparison is
// for. The pairs below are fabricated rather than bootstrapped, because the point is to
// present each branch with a difference it must catch and one it must forgive -- a real
// bootstrap only ever produces the identical case on this platform, which is how the
// Darwin branch came to be written without a test at all.
//
// WHAT THESE PROVE, precisely, because the first version of this block over-claimed.
// `NISH_UNAME_S=Darwin` changes which branch of the script runs; it does not change
// what format the files are. The ELF pairs below therefore establish the script's
// CONTROL FLOW on the Darwin branch and nothing about Mach-O: an appended `.debug_str`
// really is removed by `objcopy --strip-debug` on ELF, so that pair is bound to pass.
// The Mach-O pair that follows them is the real format and the real field -- two
// minimal Mach-O images differing only in LC_UUID -- and it is what says the
// unattributed arm is reachable by a pair that is probably benign. It is asserted as a
// known limitation, not as a pass, because no part of this has run on a mac.
if (!only || "verify-binaries".includes(only) || "wp19".includes(only)) {
  const vb = path.join(root, "scripts", "verify-binaries.sh");
  const dir = path.join(buildDir, "wp19-verify-binaries");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const run = (a, b, os) =>
    spawnSync("bash", [vb, a, b], {
      cwd: root,
      encoding: "utf8",
      env: os === undefined ? process.env : { ...process.env, NISH_UNAME_S: os },
    });

  const same1 = path.join(dir, "same1");
  const same2 = path.join(dir, "same2");
  fs.writeFileSync(same1, "the same twenty-eight bytes!");
  fs.writeFileSync(same2, "the same twenty-eight bytes!");
  for (const os of ["Linux", "Darwin"]) {
    const r = run(same1, same2, os);
    check(
      `verify-binaries: byte-identical binaries pass on ${os}`,
      r.status === 0 && r.stdout.includes("byte-identical"),
      `exit ${r.status}\n${r.stdout}${r.stderr}`
    );
  }

  // The ELF arm, which nothing else in the suite reaches: a differing stage3 is a
  // failure there whatever the difference is.
  const other = path.join(dir, "other");
  fs.writeFileSync(other, "the same twenty-eight byteS!");
  const elf = run(same1, other, "Linux");
  check(
    "verify-binaries: on ELF any difference between stage3 and stage2 fails",
    elf.status === 1 && elf.stderr.includes("not byte-identical"),
    `exit ${elf.status}\n${elf.stdout}${elf.stderr}`
  );

  // And the assertion doing the real work on the Darwin branch: whatever is not
  // reproducible about ld64 is small and fixed-width, so a size difference is not it.
  // This is the assertion the blanket exemption did not make.
  const longer = path.join(dir, "longer");
  fs.writeFileSync(longer, "the same twenty-eight bytes! and more");
  const sized = run(same1, longer, "Darwin");
  check(
    "verify-binaries: on the Darwin branch a size difference fails, because the size is not what ld64 varies",
    sized.status === 1 && sized.stderr.includes("not even the same size"),
    `exit ${sized.status}\n${sized.stderr}${sized.stdout}`
  );

  // The second half needs two real object files that differ only in a debug section, so
  // that stripping makes them equal -- fabricated with objcopy, which is also what does
  // the stripping. Without a C toolchain and an objcopy this is unprovable here and says
  // so rather than passing.
  const objcopy = ["llvm-objcopy", "objcopy"].find((t) => has(t));
  if (!objcopy || !has("clang")) {
    skip(
      "verify-binaries: the Mach-O debug-map arms need clang and llvm-objcopy/objcopy, so the pair that differs only in debug info was not built (that arm is unchecked here)"
    );
  } else {
    const src = path.join(dir, "s.c");
    const base = path.join(dir, "base");
    fs.writeFileSync(src, "int main(void){return 7;}\n");
    const built = spawnSync("clang", ["-O1", "-o", base, src], { encoding: "utf8" });
    const mk = (name, fill) => {
      const sec = path.join(dir, `${name}.bin`);
      const out = path.join(dir, name);
      fs.writeFileSync(sec, fill.repeat(64));
      const r = spawnSync(
        objcopy,
        [`--add-section=.debug_str=${sec}`, "--set-section-flags=.debug_str=readonly,debug", base, out],
        { encoding: "utf8" }
      );
      return r.status === 0 ? out : undefined;
    };
    const dbgA = built.status === 0 ? mk("dbgA", "A") : undefined;
    const dbgB = built.status === 0 ? mk("dbgB", "B") : undefined;
    const ready =
      dbgA &&
      dbgB &&
      fs.statSync(dbgA).size === fs.statSync(dbgB).size &&
      !fs.readFileSync(dbgA).equals(fs.readFileSync(dbgB));
    if (!ready) {
      skip(
        "verify-binaries: this toolchain would not produce two binaries of one size differing only in a debug section, so the Mach-O debug-map arms are unchecked here"
      );
    } else {
      // Same size, raw bytes differ, and the difference is entirely debug information:
      // forgiven on the Darwin branch. On ELF, which is what these files are, this
      // establishes that the strip-and-compare path runs and can forgive -- not that
      // Mach-O behaves this way. See the header.
      const forgiven = run(dbgA, dbgB, "Darwin");
      check(
        "verify-binaries: on the Darwin branch a difference that stripping removes passes, with the size asserted (ELF pair: control flow only)",
        forgiven.status === 0 &&
          forgiven.stdout.includes("identical once debug information") &&
          forgiven.stdout.includes(String(fs.statSync(dbgA).size)),
        `exit ${forgiven.status}\n${forgiven.stdout}${forgiven.stderr}`
      );

      // The same pair on ELF, where it is still a failure: the narrowing is Darwin's and
      // it did not leak.
      const strict = run(dbgA, dbgB, "Linux");
      check(
        "verify-binaries: the Mach-O narrowing does not apply on ELF",
        strict.status === 1,
        `exit ${strict.status}\n${strict.stdout}${strict.stderr}`
      );

      // And the case the exemption must NOT forgive: same size, and the difference
      // survives stripping, so it is the code. This is what an arm that only printed a
      // line would have shipped as a seed.
      const codeA = path.join(dir, "codeA");
      const codeB = path.join(dir, "codeB");
      fs.writeFileSync(codeA, fs.readFileSync(dbgA));
      const bytes = fs.readFileSync(dbgA);
      // Flip a byte inside the ELF header's padding-free entry point area rather than in
      // the appended debug section, so stripping cannot remove the difference.
      bytes[0x18] = bytes[0x18] ^ 0xff;
      fs.writeFileSync(codeB, bytes);
      const caught = run(codeA, codeB, "Darwin");
      check(
        "verify-binaries: on the Darwin branch a same-size difference that survives stripping FAILS as unattributed",
        caught.status === 1 && caught.stderr.includes("UNATTRIBUTED"),
        `exit ${caught.status}\n${caught.stdout}${caught.stderr}`
      );
    }
  }

  // The real format, and the field the header names as its leading candidate. Two
  // minimal Mach-O images -- a mach_header_64 and one LC_UUID load command -- identical
  // but for the UUID's sixteen bytes. This is fabricated rather than linked because
  // there is no macOS here and no Mach-O linker; what it costs is that these are not
  // *compilers*, and what it buys is that the format and the field are real.
  //
  // Measured here, on Linux, with LLVM 18's objcopy: `--strip-debug` leaves an
  // LC_UUID-only difference in place, and GNU strip refuses Mach-O outright
  // ("file format not recognized"). So a benign LC_UUID difference reaches the
  // unattributed arm and fails. That is a KNOWN LIMITATION and this check pins it as
  // one: if someone makes the script mask LC_UUID, or links with -Wl,-no_uuid, this is
  // the check that should be rewritten to expect a pass, and the measurement recorded.
  const machoDir = path.join(dir, "macho");
  fs.mkdirSync(machoDir, { recursive: true });
  const macho = (fill) => {
    // mach_header_64: magic, cputype, cpusubtype, filetype, ncmds, sizeofcmds, flags,
    // reserved -- then LC_UUID (cmd 0x1b, size 24) and sixteen bytes of UUID.
    const lc = Buffer.alloc(24);
    lc.writeUInt32LE(0x1b, 0);
    lc.writeUInt32LE(24, 4);
    lc.fill(fill, 8, 24);
    const hdr = Buffer.alloc(32);
    hdr.writeUInt32LE(0xfeedfacf, 0); // MH_MAGIC_64
    hdr.writeInt32LE(0x01000007, 4); // CPU_TYPE_X86_64
    hdr.writeInt32LE(3, 8);
    hdr.writeUInt32LE(2, 12); // MH_EXECUTE
    hdr.writeUInt32LE(1, 16); // ncmds
    hdr.writeUInt32LE(lc.length, 20);
    return Buffer.concat([hdr, lc]);
  };
  const uuidA = path.join(machoDir, "uuidA");
  const uuidB = path.join(machoDir, "uuidB");
  fs.writeFileSync(uuidA, macho(0xaa));
  fs.writeFileSync(uuidB, macho(0xbb));
  const machoReady =
    fs.statSync(uuidA).size === fs.statSync(uuidB).size && !fs.readFileSync(uuidA).equals(fs.readFileSync(uuidB));
  check(
    "verify-binaries: the fabricated Mach-O pair is the same size and differs only in LC_UUID",
    machoReady,
    `${fs.statSync(uuidA).size} vs ${fs.statSync(uuidB).size}`
  );
  const uuidRun = run(uuidA, uuidB, "Darwin");
  check(
    "verify-binaries: KNOWN LIMITATION -- a real Mach-O pair differing only in LC_UUID is reported unattributed, not forgiven",
    uuidRun.status === 1 && uuidRun.stderr.includes("UNATTRIBUTED") && uuidRun.stderr.includes("LC_UUID"),
    `exit ${uuidRun.status}\n${uuidRun.stdout}${uuidRun.stderr}`
  );
  // And the failure names the size rather than claiming the code differs, which is the
  // sentence the first version of this script got wrong.
  check(
    "verify-binaries: the unattributed failure does not claim the code differs",
    !uuidRun.stderr.includes("this is the code itself") && !uuidRun.stderr.includes("fixed point does not hold"),
    uuidRun.stderr
  );

  // The test hook announces itself, so a release build with NISH_UNAME_S set leaves a
  // trace rather than silently asserting a different equality.
  const announced = run(same1, other, "Darwin");
  check(
    "verify-binaries: NISH_UNAME_S says on stderr that it overrode the platform",
    announced.stderr.includes("NISH_UNAME_S") && announced.stderr.includes("test hook"),
    announced.stderr
  );

  // The platform test is the only thing NISH_UNAME_S overrides, and it defaults to the
  // real `uname -s`: the override is a test hook and must not change what a release
  // asserts when nobody sets it. Both sides of this are real assertions -- the first
  // version let macOS through on "not exit 2", which is vacuous on the one platform the
  // branch is about. `same1`/`other` are the same size, so on Darwin the expected
  // outcome is the unattributed failure and on ELF the byte failure; either way it must
  // fail, with the platform's own wording and without the hook's announcement.
  const real = run(same1, other, undefined);
  check(
    `verify-binaries: with NISH_UNAME_S unset the host's own platform decides the branch (${process.platform})`,
    real.status === 1 &&
      !real.stderr.includes("NISH_UNAME_S") &&
      (process.platform === "darwin"
        ? real.stderr.includes("UNATTRIBUTED")
        : real.stderr.includes("not byte-identical")),
    `exit ${real.status}\n${real.stdout}${real.stderr}`
  );
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

// ---- No tool attribution: the hook and the PR body check ------------------------------
// CLAUDE.md keeps session links, model names and "Generated with" footers out of
// commits and PR text. `.claude/hooks/no-attribution.mjs` refuses the tool call that
// would write one, and `scripts/check-pr-body.mjs` fails the `PR body` workflow on a
// footer appended after that call, where the hook cannot see it (#176). One pattern
// list serves both, so both suites run here: a pattern edited for one is tested
// against the other's cases too.
if (!only || "attribution".includes(only) || "pr-body".includes(only)) {
  for (const suite of [".claude/hooks/no-attribution.test.mjs", "scripts/check-pr-body.test.mjs"]) {
    const r = spawnSync(process.execPath, [path.join(root, suite)], { cwd: root, encoding: "utf8" });
    check(`attribution: node ${suite} passes`, r.status === 0, r.stdout + r.stderr);
  }
}

// ---- The release train's version: the implied bump and the `Release-As:` trailer -----
// `scripts/changelog-gen.mjs --next` is the number the Release PR proposes and every
// file it bumps. Its suite builds throwaway repositories, so it needs git and nothing else.
if (!only || "release".includes(only) || "changelog".includes(only)) {
  const suite = "scripts/changelog-gen.test.mjs";
  const r = spawnSync(process.execPath, [path.join(root, suite)], { cwd: root, encoding: "utf8" });
  check(`release: node ${suite} passes`, r.status === 0, r.stdout + r.stderr);
}

// ---- WP19 G2.4: the frozen rewrites the WP13 oracle keeps once stage0 is gone -------
// `tests/differential/rewrite.js` typed its rewrite with stage0's own `Compilation`, so
// the differential comparison against Node -- the only oracle here about runtime
// semantics rather than emitted text -- would have gone with `src/`.
// `tests/differential/goldens/rewrites.txt` is that rewrite written down while stage0
// existed, and what outlives it is **freshness**: every program's sources still hash to
// what they hashed when it was frozen, which is the reason a stale golden reads as a
// failure rather than as a verdict. `--fresh` asks that alone, with no rewriter in the
// picture. Nothing here is compiled or run, so it needs no toolchain.
if (!only || "differential".includes(only) || "goldens".includes(only)) {
  const rewrites = spawnSync(
    "node",
    [path.join(import.meta.dirname, "differential", "goldens.js"), "--fresh"],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  // The tool's own last line, whole: it names which of the two halves ran --
  // `the store is byte-identical to the live rewrite` or `store comparison
  // skipped (no rewriter)` -- and a check name that asserted the stronger one
  // in fixed text would read the same either way. That is the failure mode
  // `lib.js` refuses for the runs themselves.
  const summary = rewrites.stdout.trim().split("\n").pop() ?? "";
  check(
    `differential: the frozen rewrites (${summary || "no summary"})`,
    rewrites.status === 0,
    rewrites.stdout + rewrites.stderr
  );
}

// ---- WP22 §2: the two spellings, and the codemod that rewrites one into the other ----
// Stage A was declared done on "the two spellings of one program emit byte-identical IR",
// and until now nothing in `npm test` asked. The claim is structural rather than lucky --
// the emitter iterates checked `FunctionSig`s and there is no `isFunctionDeclaration`
// anywhere in `src/codegen/` -- which is exactly why it is worth a check: a pass that
// started reading the declaration's syntax kind would break it silently, and the goldens
// would not notice, because every golden is written in one spelling or the other and each
// would go on matching itself.
//
// The same pair pins `scripts/arrowify.mjs`, the codemod stage C's `self/` rewrite runs.
// `arrow.ts` is `declared.ts` written out by hand, so the codemod owes the two fixtures
// the same relationship a reader sees between them: everything below the header comment,
// character for character. That is a stronger statement about the tool than any IR
// comparison, because it is checked against a file somebody wrote rather than against the
// tool's own output. Nothing here is assembled or run, so it needs no toolchain.
if (!only || "arrow".includes(only) || "spelling".includes(only)) {
  const ts = require("typescript");
  const fixtures = path.join(root, "tests", "differential", "arrow-parity");
  const out = path.join(buildDir, "arrow-spelling");
  const emit = (name) => {
    const dir = path.join(out, name);
    fs.mkdirSync(dir, { recursive: true });
    const run = spawnSync(NISH, [path.join(fixtures, `${name}.ts`), "-o", `${dir}/`], {
      cwd: root,
      encoding: "utf8",
    });
    const ll = path.join(dir, `${name}.ll`);
    return run.status === 0 && fs.existsSync(ll) ? stripHeader(fs.readFileSync(ll, "utf8")) : null;
  };
  const declared = emit("declared");
  const arrow = emit("arrow");
  check(
    "WP22: the `function` and arrow spellings of one program emit identical IR",
    declared !== null && declared === arrow,
    declared === null || arrow === null ? "a fixture did not compile" : "the two modules differ"
  );

  // Each fixture explains itself in its own header comment, so the two are required to
  // agree from the first declaration onwards and not before it. The sentinel that finds
  // that point has to be *found*: `indexOf` answers -1 for a fixture that was renamed or
  // truncated, `slice(-1)` is then the last byte of each file, and the check would go on
  // passing while comparing one newline with another.
  const SENTINEL = "const label";
  const program = (text) => text.slice(text.indexOf(SENTINEL));
  const rewritten = arrowify(fs.readFileSync(path.join(fixtures, "declared.ts"), "utf8"), "declared.ts");
  const byHand = fs.readFileSync(path.join(fixtures, "arrow.ts"), "utf8");
  const anchored = rewritten.text.includes(SENTINEL) && byHand.includes(SENTINEL);
  check(
    "WP22: `scripts/arrowify.mjs` rewrites the `function` fixture into its hand-written arrow twin",
    anchored && program(rewritten.text) === program(byHand),
    anchored
      ? `rewrote ${rewritten.changed} declaration(s)`
      : `neither fixture may lose \`${SENTINEL}\`: the rewrite ${
          rewritten.text.includes(SENTINEL) ? "kept" : "lost"
        } it, arrow.ts ${byHand.includes(SENTINEL) ? "kept" : "lost"} it`
  );

  // WP22 §9: `declare function` defines nothing, so it is not a competing spelling and
  // the codemod may not reach for it -- the arrow form would need a function type, which
  // Phase 0 forbids. `ffi_scalar` is the case that has both in one file, and every
  // number here is counted off that file rather than written down, including how many
  // definitions it has: stage C converts `tests/cases/` next, so a check that required
  // this case to still contain a `function` would go red on the migration it exists to
  // enable. What must hold either way is that the ambient lines survive verbatim, that
  // exactly the definitions present were rewritten, and that none is left behind.
  const ffiSource = fs.readFileSync(path.join(casesDir, "ffi_scalar.ts"), "utf8");
  const ambient = ffiSource.split("\n").filter((l) => l.startsWith("declare function "));
  const before22 = ffiSource.split("\n").filter((l) => /^(export )?function /.test(l));
  const ffi = arrowify(ffiSource, "ffi_scalar.ts");
  const kept = ambient.every((line) => ffi.text.includes(line));
  const definitions = ffi.text.split("\n").filter((l) => /^(export )?function /.test(l));
  check(
    "WP22 §9: the codemod leaves `declare function` alone and rewrites the definitions beside it",
    ambient.length > 0 && kept && ffi.changed === before22.length && definitions.length === 0,
    `${ambient.length} ambient (${kept ? "kept" : "LOST"}), ${ffi.changed} rewritten of ` +
      `${before22.length} definition(s), ${definitions.length} left`
  );

  // The three forms with no arrow spelling at all. Each is a `reject_*` case, and each
  // was rewritten by an earlier draft of the codemod into something that *compiled* --
  // `declare const h = () => {...}`, an ordinary function where `function* g` had been,
  // and `export default const f`, which is not a sentence. A codemod that turns a
  // refused program into a compiling one is the worst thing one of these can do, because
  // every gate downstream reads the program it was handed and not the program somebody
  // wrote. These three cases are the shapes that say so, and none of them is in `self/`,
  // which is why the rewrite that matters would never have found them.
  // The claim is about the one declaration, not about the whole file -- `reject_ffi_body`
  // also has an ordinary `main` the codemod is right to convert -- so each row names the
  // shape and the line carrying it has to survive the rewrite verbatim.
  for (const [name, shape, why] of [
    ["reject_ffi_body", /^declare function /m, "a `declare function` that wrongly carries a body is still ambient"],
    ["reject_generator", /^function\* /m, "`function*` keeps its asterisk"],
    ["reject_export_default", /^export default function /m, "`export default function` has no arrow spelling"],
  ]) {
    const before = fs.readFileSync(path.join(casesDir, `${name}.ts`), "utf8");
    const line = (before.split("\n").find((l) => shape.test(l)) ?? "").trim();
    const after = arrowify(before, `${name}.ts`);
    check(
      `WP22: the codemod leaves \`${name}\` alone -- ${why}`,
      line.length > 0 && after.text.includes(line),
      line.length > 0 ? `\`${line}\` did not survive the rewrite` : `no line in ${name}.ts matches ${shape}`
    );
  }

  // `--concise` drops the braces, and the grammar then decides what has to be put back:
  // `ConciseBody` is `[lookahead != {] ExpressionBody`, so a body whose *first token* is
  // `{` re-parses as a block. Asking instead whether the returned node is an object
  // literal answers that only for the expression that is one to its last byte, and turns
  // `return { a: 1 } as Pair;` into `=> { a: 1 } as Pair`, which is two parse errors and
  // a corrupted source file. That is the same mistake as the `declare` rule above, one
  // node deeper, so each row is parsed back rather than string-matched: a rewrite whose
  // output does not re-parse is the failure this is watching for.
  for (const [what, source] of [
    ["an object literal", "function mk(): Pair {\n  return { first: 1, second: 2 };\n}\n"],
    ["an object literal in a cast", "function mk(): Pair {\n  return { first: 1, second: 2 } as Pair;\n}\n"],
    ["a field read off one", "function first(): i32 {\n  return { first: 1, second: 2 }.first;\n}\n"],
    [
      "an arrow that was already an arrow",
      "const mk = (): Pair => {\n  return { first: 1, second: 2 } as Pair;\n};\n",
    ],
  ]) {
    const collapsed = arrowify(source, "concise.ts", { concise: true });
    const reparsed = ts.createSourceFile("concise.ts", collapsed.text, ts.ScriptTarget.Latest, true);
    check(
      `WP22: \`--concise\` parenthesises a body that begins with \`{\` -- ${what}`,
      reparsed.parseDiagnostics.length === 0 && collapsed.text.includes("=> ({"),
      collapsed.text.trim()
    );
  }

  // Every position the splice cuts at comes from the tree, because a comment can contain
  // the syntax a search would find first: the word `function` in a leading comment, a
  // parenthesis in a comment after the name or inside the parameter list. Locating an
  // edit by `indexOf` put the splice inside the comment and wrote back a file that no
  // longer parses, with exit 0 -- the worst thing a codemod can do to a file nobody is
  // reading line by line. Where the comment sits in the one region the rewrite discards
  // -- between `function` and the parameter list, which becomes `const NAME = ` -- there
  // is nowhere to put it, so the declaration is refused instead of quietly losing it.
  for (const [what, source, expected] of [
    ["the keyword inside a leading comment", "export /* the function below */ function f(): i32 {\n  return 1;\n}\n", "rewritten"],
    ["a `)` inside a parameter comment", "function h(a: i32 /* ) */ ) {\n  use(a);\n}\n", "rewritten"],
    ["a comment between `function` and the name", "function /* named */ k(): i32 {\n  return 1;\n}\n", "refused"],
    ["a comment between the name and the `(`", "function g /* ( a ) */ (): i32 {\n  return 1;\n}\n", "refused"],
  ]) {
    const spliced = arrowify(source, "splice.ts");
    const reparsed = ts.createSourceFile("splice.ts", spliced.text, ts.ScriptTarget.Latest, true);
    const rewritten = spliced.changed === 1 && spliced.skipped.length === 0;
    const refused = spliced.changed === 0 && spliced.skipped.length === 1 && spliced.text === source;
    check(
      `WP22: the codemod splices from the tree, not from a text search -- ${what}`,
      reparsed.parseDiagnostics.length === 0 && (expected === "rewritten" ? rewritten : refused),
      `${spliced.changed} rewritten, ${spliced.skipped.length} left alone, ` +
        `${reparsed.parseDiagnostics.length} parse error(s): ${JSON.stringify(spliced.text)}`
    );
  }

  // The CLI's own refusals. `--check` answers with an exit code and `--stdout` with a
  // file, so asking for both used to answer 0 with the rewrites still pending; and a
  // misspelled `--concise` was ignored, which is a collapse pass that did not happen in
  // a recipe whose whole point is which pass ran.
  const cli22 = (...args) =>
    spawnSync("node", [path.join(root, "scripts", "arrowify.mjs"), ...args], { cwd: root, encoding: "utf8" }).status;
  // The fixture is written here rather than copied from `tests/cases/`, for two
  // reasons. The flag these ask about is one an unfixed codemod *ignores*, and an
  // ignored flag means the run rewrites whatever it was handed, so pointing it at a
  // golden case would overwrite one on the way to failing. And `--check` answers 1
  // only while something is left to rewrite: stage C converts `tests/cases/` next, so
  // a corpus file as the subject would take this check red exactly when the migration
  // succeeds.
  const oneFunction = path.join(buildDir, "arrow-flags.ts");
  fs.writeFileSync(oneFunction, "export function twice(n: i32): i32 {\n  return n * 2;\n}\n");
  check(
    "WP22: the codemod refuses a flag it does not have, and a pair of flags it cannot answer both of",
    cli22("--consise", oneFunction) === 2 &&
      cli22("--check", "--stdout", oneFunction) === 2 &&
      cli22("--stdout", oneFunction, oneFunction) === 2 &&
      cli22("--check", oneFunction) === 1,
    "expected 2, 2, 2 and 1"
  );

  // The verifier answers for its own flags the same way, and for the same reason: a
  // `--debg` that silently drops `-g`, or a `--rev=HEAD~1` that silently compares
  // against HEAD, is a sweep reporting on something other than what it was asked about.
  // These stop before any compiling, so they cost three process starts.
  const verify22 = (...args) =>
    spawnSync("node", [path.join(root, "scripts", "arrow-verify.mjs"), ...args], {
      cwd: root,
      encoding: "utf8",
    }).status;
  // The sweep compiles a *copy* of the tracked tree, and a tracked symlink has to
  // arrive in it as a symlink. `tests/link/package_symlink` is a package reached a
  // second time through a link, and what the compiler answers there is what the link
  // resolves to, so following it while copying would compile a tree the repository
  // does not have. `copyFileSync` does not even get that far on a link to a
  // directory: it throws `EISDIR`, which took the whole sweep down the first time
  // `self/` was verified against a tree that had one.
  const linkRoot = path.join(root, "build", "test", "wp22-symlink");
  fs.rmSync(linkRoot, { recursive: true, force: true });
  fs.mkdirSync(path.join(linkRoot, "src", "pkg"), { recursive: true });
  fs.symlinkSync("pkg", path.join(linkRoot, "src", "link"));
  fs.symlinkSync("gone", path.join(linkRoot, "src", "broken"));
  fs.symlinkSync("/etc", path.join(linkRoot, "src", "absolute"));
  fs.symlinkSync("../../outside", path.join(linkRoot, "src", "climbing"));
  const copyRoot = path.join(linkRoot, "copy");
  fs.mkdirSync(copyRoot, { recursive: true });
  // `copyInto` is given the copy root, because that is the boundary a link has
  // to land inside of; the link itself sits directly in it here.
  const copyLink = (name) => {
    try {
      return copyInto(path.join(linkRoot, "src", name), path.join(copyRoot, name), copyRoot);
    } catch (error) {
      return `threw ${error.code}`;
    }
  };
  const copiedAs = copyLink("link");
  check(
    "WP22: the verifier copies a tracked symlink as a symlink",
    copiedAs === "link" &&
      fs.lstatSync(path.join(copyRoot, "link")).isSymbolicLink() &&
      fs.readlinkSync(path.join(copyRoot, "link")) === "pkg",
    `copied as: ${copiedAs}`
  );

  // `git ls-files` names the index, and a tracked link whose target is gone is
  // still a link the tree holds. `lstat` rather than `existsSync` is what keeps
  // it from being counted as a missing file and dropped out of the copy.
  const brokenAs = copyLink("broken");
  check(
    "WP22: the verifier copies a tracked symlink whose target is gone",
    brokenAs === "link" &&
      fs.lstatSync(path.join(copyRoot, "broken")).isSymbolicLink() &&
      fs.readlinkSync(path.join(copyRoot, "broken")) === "gone" &&
      !fs.existsSync(path.join(copyRoot, "broken")),
    `copied as: ${brokenAs}`
  );

  check(
    "WP22: a tracked symlink whose target is gone is still in the tree, not a missing file",
    presentInTree(path.join(linkRoot, "src", "broken")) === true &&
      presentInTree(path.join(linkRoot, "src", "nothing-here")) === false,
    "a broken link is present; an absent path is not"
  );

  // A link that resolves out of the copy would make a compile read the live
  // working tree instead of the reverted copy, so the `before` side of an
  // `--applied` sweep would compile the rewrite it is supposed to be comparing
  // against. Both shapes of escape are refused rather than reproduced.
  const absoluteAs = copyLink("absolute");
  const climbingAs = copyLink("climbing");
  check(
    "WP22: the verifier refuses a symlink that resolves outside the copy",
    absoluteAs === "escapes" &&
      climbingAs === "escapes" &&
      !fs.existsSync(path.join(copyRoot, "absolute")) &&
      !fs.existsSync(path.join(copyRoot, "climbing")),
    `absolute: ${absoluteAs}, climbing: ${climbingAs}`
  );

  check(
    "WP22: the verifier refuses a flag it does not have, and a `--rev` without a revision",
    verify22("--debg", "tests/parser") === 2 &&
      verify22("--applied", "--rev", "--verbose", "tests/parser") === 2 &&
      verify22("--help") === 0,
    "expected 2, 2 and 0"
  );

  // WP22 §9 keeps `declare function` legal because it defines nothing. A body-less
  // declaration *without* `declare` is not that: it is an overload signature, which the
  // language does not have, and the checker refuses the line
  // (`tests/wordings/nl2204_function_without_body.ts`). The codemod leaves both alone, so
  // the only thing it can get wrong is what it tells the migrator -- and reporting the
  // second under the first's reason says the line is legal syntax when it is about to be
  // rejected.
  const overload = arrowify(
    fs.readFileSync(path.join(root, "tests", "wordings", "nl2204_function_without_body.ts"), "utf8"),
    "nl2204_function_without_body.ts"
  );
  const ambientReason = arrowify("declare function h(): i32;\n", "ambient.ts").skipped[0]?.reason ?? "";
  check(
    "WP22: the codemod does not report a body-less declaration as legal ambient syntax",
    overload.skipped.length === 1 &&
      overload.skipped[0].reason !== ambientReason &&
      !overload.skipped[0].reason.includes("stays legal"),
    `reported as: ${overload.skipped[0]?.reason ?? "nothing at all"}`
  );

  // `scripts/arrow-verify.mjs` is what the 721-declaration rewrite of `self/` will be
  // done on the say-so of, so the two places it could report success over ground it did
  // not check are pinned here rather than left to the sweep that takes half an hour.
  //
  // The first: the module comparison walks the *union* of the two sides. Iterating the
  // before side alone makes a module that only exists after the rewrite invisible, and
  // that is the difference most worth seeing -- it means the rewrite changed what the
  // program is, not how it is spelled.
  const sameBytes = Buffer.from("; ModuleID = 'a.ts'\n");
  const onlyAfter = diffEmitted(
    new Map([["main.ll", sameBytes]]),
    new Map([
      ["main.ll", sameBytes],
      ["extra.ll", Buffer.from("; ModuleID = 'extra.ts'\n")],
    ])
  );
  const onlyBefore = diffEmitted(new Map([["main.ll", sameBytes]]), new Map());
  check(
    "WP22: the verifier notices a module that exists only after the rewrite",
    onlyAfter.length === 1 && onlyAfter[0].name === "extra.ll" && onlyBefore.length === 1,
    `${onlyAfter.length} found after, ${onlyBefore.length} found before`
  );

  // And the exit path both halves of the sweep now go through, because five review
  // rounds found the same defect five times in it: a subject counted as covered and
  // then never compared. Four of those were in the loop over programs and the fifth in
  // the loop over rejections -- a "rejection" that is not refused under the flags the
  // sweep passes compared empty with empty and continued -- so there is one loop and
  // one verdict now, and this is the table of what it may answer. A subject that
  // produced nothing at all is `blind`, which fails the run; nothing else may quietly
  // mean "no difference".
  const side = (over) => ({ status: 0, stdout: "", said: "", emitted: new Map(), ...over });
  const bytes = (text) => new Map([["main.ll", Buffer.from(text)]]);
  const warn = (line) => `{"severity":"performance","code":"NL9001","message":"m","line":${line}}`;
  for (const [what, a, b, expected, differences, moved] of [
    ["identical modules", side({ emitted: bytes("x") }), side({ emitted: bytes("x") }), "emitted", 0, false],
    ["a module that differs", side({ emitted: bytes("x") }), side({ emitted: bytes("y") }), "emitted", 1, false],
    ["a dump on stdout", side({ stdout: "tree" }), side({ stdout: "tree" }), "dump", 0, false],
    ["refused on one side only", side({ status: 1, said: "{}" }), side({}), "status", 0, false],
    [
      "refused on both, same words",
      side({ status: 1, said: '{"code":"NL2204","message":"m","line":3}' }),
      side({ status: 1, said: '{"code":"NL2204","message":"m","line":9}' }),
      "refusal",
      0,
      true,
    ],
    [
      "refused on both, different words",
      side({ status: 1, said: '{"code":"NL2204","message":"m"}' }),
      side({ status: 1, said: "" }),
      "reworded",
      0,
      false,
    ],
    ["compiled clean and produced nothing", side({}), side({}), "blind", 0, false],
    ["refused on both with nothing to read", side({ status: 1 }), side({ status: 1 }), "blind", 0, false],
    // The branch that needs two files to reach in a real sweep: a corpus file nobody
    // staged is enumerated from the working tree by `programs()` and not copied by
    // `copyTree`, which reads the index -- so it is absent on both sides, and the answer
    // is that there was nothing to compile rather than that the two sides agreed.
    [
      "absent on both sides",
      side({ absent: true, status: null }),
      side({ absent: true, status: null }),
      "blind",
      0,
      false,
    ],
    // A file added since the revision has no `<rev>:<path>`, so `--applied` empties it
    // out of the copy for the before compile -- and reading it anyway ended the sweep in
    // a stack trace at the exact moment §8b's recipe needs a verdict, which is what
    // Phase 2 splitting or adding a `self/` module looks like.
    [
      "a subject added since the revision",
      side({ absent: true, status: null }),
      side({ emitted: bytes("x") }),
      "absent",
      0,
      false,
    ],
    [
      "a subject deleted since the revision",
      side({ emitted: bytes("x") }),
      side({ absent: true, status: null }),
      "absent",
      0,
      false,
    ],
    // A compile that succeeded still has a diagnostic surface, and it was read on
    // neither side: a `performance:` warning could move, change or disappear under a
    // rewrite and the sweep reported `0 difference(s)`. 76 corpus programs warn, most of
    // `self/` among them, and `--concise` moves every warning below a collapsed
    // declaration -- so the silence was pointed straight at the migration.
    [
      "a warning that only moved",
      side({ emitted: bytes("x"), said: warn(9) }),
      side({ emitted: bytes("x"), said: warn(7) }),
      "emitted",
      0,
      true,
    ],
    [
      "a warning that disappeared",
      side({ emitted: bytes("x"), said: warn(9) }),
      side({ emitted: bytes("x") }),
      "emitted",
      1,
      false,
    ],
  ]) {
    const answer = verdict(a, b);
    const found = (answer.differences ?? []).length;
    check(
      `WP22: the verifier gives every subject one verdict -- ${what} is \`${expected}\``,
      answer.kind === expected && found === differences && (answer.moved ?? false) === moved,
      `answered \`${answer.kind}\` with ${found} difference(s), moved=${answer.moved ?? false}`
    );
  }

  // A subject is only evidence about a rewrite if the rewrite reached the
  // modules it compiles. Counting one that did not is how a sweep over a slice that is
  // already migrated reports `0 difference(s)` for compiling the same source twice.
  check(
    "WP22: the verifier counts a program as evidence only when the change reached it",
    sitsOnChange("tests/link/std_testing/main.ts", new Set(["std/testing.ts"])) &&
      sitsOnChange("tests/link/std_testing/main.ts", new Set(["tests/link/std_testing/main.ts"])) &&
      !sitsOnChange("tests/link/std_testing/main.ts", new Set(["self/lexer.ts"])),
    "an imported module counts, an unrelated file does not"
  );

  // The third: a rejection is compared by its words with every position stripped, so a
  // `reject_*` case that starts compiling, or is refused under a different rule, differs
  // and fails the run -- while a caret that moved is only reported, because under
  // `--concise` the lines move by construction (WP22 §8c).
  const said = (line, code, message) =>
    JSON.stringify({ file: "x.ts", line, column: 3, severity: "error", code, message });
  check(
    "WP22: the verifier fails a rejection whose words changed and tolerates one that only moved",
    diagnosticWords(said(4, "NL2204", "Functions must have a body")) ===
      diagnosticWords(said(9, "NL2204", "Functions must have a body")) &&
      diagnosticWords(said(4, "NL2204", "Functions must have a body")) !== diagnosticWords("") &&
      diagnosticWords(said(4, "NL2204", "Functions must have a body")) !==
        diagnosticWords(said(4, "NL1002", "`function*` is not supported")),
    "positions must normalise away and codes must not"
  );
}

// ---- WP13: differential -------------------------------------------------------------
// Every whole program in tests/cases and tests/differential/corpus is compiled by the
// compiler under test, linked, and run natively, and its JavaScript -- the frozen
// rewrite in tests/differential/goldens/, typed when it was frozen by the checker of the
// day -- is run under Node with runtime/shim.mjs; stdout and exit status must agree byte
// for byte. Discrepancies listed in known-failures.txt are reported but do not fail.
if (!only || "differential".includes(only)) {
  const diffRunner = path.join(import.meta.dirname, "differential", "run.js");
  const compilerArgs = ["--compiler", path.relative(root, NISH)];
  const d = spawnSync("node", [diffRunner, "--quick", "--frozen", ...compilerArgs], { cwd: root, encoding: "utf8" });
  // `run.js`'s first line is `native: <compiler>    node: <live|frozen rewrite>`,
  // and it belongs in the check name: after R6 the same summary line is printed
  // whether the reference was today's rewrite or a recording of it, and a check
  // that cannot tell the reader which proved less than the line suggests.
  const mode = (d.stdout.split("\n").find((l) => l.startsWith("native:")) ?? "").trim();
  const summary = (
    d.stdout
      .trim()
      .split("\n")
      .filter((l) => l.includes("programs agree with Node"))
      .pop() ?? ""
  ).trim();
  check(
    `differential: native and Node agree on every corpus program not in known-failures.txt (${mode ? `${mode}; ` : ""}${summary || "no summary"})`,
    d.status === 0,
    d.stdout + d.stderr
  );

  // The runner above is parallel, and `io_nish_import` and its twin write the
  // same relative path by design, so what keeps one from reading the file the
  // other just truncated is that every run has a working directory of its own
  // (`cwdFor` in tests/differential/lib.js). The race it closed failed one run
  // in twenty; this fails every run the isolation is gone, because each twin's
  // file then lands somewhere other than its own directory.
  const scratch = ["io_nish_import", "io_nish_import_global"].flatMap((name) =>
    ["native", "node"].map((side) => path.join(cwdFor(`cases/${name}`, side), "build", "test", "io_nish_import.txt"))
  );
  const astray = scratch.filter((file) => !fs.existsSync(file));
  check(
    "differential: each program runs in a working directory of its own",
    astray.length === 0,
    `not written where its own run should have put it:\n${astray.join("\n")}`
  );

  // The smaller, unrewritten claim beside it: an f64-mode program run as the
  // TypeScript it is, under `node --experimental-strip-types` with
  // runtime/nish.mjs supplying the globals Node lacks. Nothing is
  // rewritten, so only the divergences listed in the runner may differ — they
  // live in the operators and the object model, where a prelude cannot reach.
  // docs/RUN_UNDER_NODE.md states the overlap.
  const u = spawnSync("node", [path.join(import.meta.dirname, "differential", "unmodified.js"), ...compilerArgs], {
    cwd: root,
    encoding: "utf8",
  });
  check(
    `differential: f64 programs agree with unmodified Node (${u.stdout.trim() || "no summary"})`,
    u.status === 0,
    u.stdout + u.stderr
  );
}

// ---- The gate on the prebuilt runtime objects ------------------------------------
//
// The links above are fast because `runtime.c`, `runtime_os.c` and the driver
// are compiled once per run rather than once per case, and a fast link that
// quietly used the wrong runtime would be worse than the slow one it replaced.
// Two checks, and between them they cover both ways that could happen. They sit
// at the end of the run rather than beside section A because they replay what
// this run actually linked: every section that links a case has gone past by
// here, so a set of defines that only some later block asks for is covered too.
//
// One: for every set of defines a case asked for, the first case linked with it
// is linked *again* from the sources -- the command line this suite used before
// the objects existed, argument for argument -- and the two binaries have to be
// byte-identical. That is the whole claim stated directly: the object is what
// clang would have produced inline. It is a fact about the linker's own
// pipeline rather than about the runtime, and it is asserted rather than
// assumed on every platform; if it ever turns out to be platform-specific the
// honest narrowing is a counted skip, the way the `.text` budgets have one, and
// not a weaker comparison.
if (linkSpecimens.size > 0) {
  for (const [key, spec] of linkSpecimens) {
    const label = key.length === 0 ? "the default runtime" : `the runtime built with ${key}`;
    const stem = path.join(buildDir, "runtime-obj", `specimen${key.replace(/[^A-Za-z0-9]+/g, "_")}`);
    const bySource = spawnSync("clang", [...spec.fromSource, "-o", `${stem}.src`], { cwd: root });
    const byObjects = spawnSync("clang", [...spec.fromObjects, "-o", `${stem}.obj`], { cwd: root });
    const linked = bySource.status === 0 && byObjects.status === 0;
    const same = linked && fs.readFileSync(`${stem}.src`).equals(fs.readFileSync(`${stem}.obj`));
    check(
      `runtime objects: linking ${path.basename(spec.ll)} against ${label} gives the bytes the sources do`,
      same,
      linked
        ? `${fs.statSync(`${stem}.src`).size} bytes from the sources, ` +
          `${fs.statSync(`${stem}.obj`).size} from the objects; the two links were\n` +
          `  clang ${spec.fromSource.join(" ")}\n  clang ${spec.fromObjects.join(" ")}`
        : String(bySource.stderr) + String(byObjects.stderr)
    );
  }
}

// Two: the cache key has to be load-bearing. A `--threads` module wants
// `@nish_arena` in thread-local storage and the default objects define it as an
// ordinary global, so handing a case the wrong objects has to be a link error
// rather than a program with two arenas. `ld` does refuse it -- "TLS reference
// ... mismatches non-TLS definition" -- and this is where that is written down,
// because it is the property the whole cache rests on.
const threadsLl = path.join(buildDir, "mem_threads_arena.ll");
if (fs.existsSync(threadsLl)) {
  const rt = runtimeObjects([]);
  const exe = path.join(buildDir, "runtime-obj", "threads_against_default");
  const cc =
    rt.error === null
      ? spawnSync("clang", ["-Wno-override-module", "-O2", threadsLl, ...rt.objects, "-lm", "-o", exe], {
          cwd: root,
        })
      : null;
  check(
    "runtime objects: a --threads module refuses to link against the default runtime",
    cc !== null && cc.status !== 0,
    cc === null
      ? rt.error
      : "it linked. The object cache's key is then not load-bearing, and a case could be\n" +
        "handed a runtime built for another one and run with two arenas instead of failing."
  );
}

summarise();
