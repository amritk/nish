#!/usr/bin/env node
/**
 * StaticTS test runner.
 *
 *  A. Golden cases in tests/cases/  (one .ts per case, discovered automatically)
 *       <name>.ts    source
 *       <name>.ll    expected IR (module header stripped). Missing + UPDATE_GOLDENS=1 -> written.
 *       <name>.args  extra CLI flags, whitespace separated
 *       <name>.err   expected error substring; compile must fail (no .ll needed)
 *       <name>.out   expected stdout when linked with <name>.c (or tests/driver.c,
 *                    which prints `test()`) and runtime/runtime.c, then run
 *     Every successfully compiled case is also assembled with llvm-as.
 *
 *  B. Pipeline checks: runtime.c unit test, inline allocator vs C arena layout,
 *     size and wasm build profiles, Node wasm host.
 */
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const cli = path.join(root, "dist", "index.js");
const casesDir = path.join(root, "tests", "cases");
const buildDir = path.join(root, "build", "test");
fs.mkdirSync(buildDir, { recursive: true });

let failures = 0;
let passes = 0;
function check(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (ok) passes++;
  else {
    failures++;
    if (detail) console.log(String(detail).split("\n").map((l) => "      " + l).join("\n"));
  }
}
const has = (tool) => spawnSync("which", [tool]).status === 0;
const HAS_LLVM_AS = has("llvm-as");
const HAS_CLANG = has("clang");

/** Module body with the `; ModuleID` / `source_filename` header removed. */
function stripHeader(ir) {
  return ir.split("\n").filter((l) => !l.startsWith(";") && !l.startsWith("source_filename")).join("\n").trim();
}

// ---- A. Golden cases -------------------------------------------------------------
const only = process.argv[2];
const cases = fs.readdirSync(casesDir).filter((f) => f.endsWith(".ts")).map((f) => f.slice(0, -3)).sort();
for (const name of cases) {
  if (only && !name.includes(only)) continue;
  const src = path.join(casesDir, `${name}.ts`);
  const side = (ext) => path.join(casesDir, `${name}.${ext}`);
  const args = fs.existsSync(side("args")) ? fs.readFileSync(side("args"), "utf8").trim().split(/\s+/).filter(Boolean) : [];
  const outLl = path.join(buildDir, `${name}.ll`);
  const r = spawnSync("node", [cli, src, "-o", outLl, ...args], { cwd: root });
  const stderr = String(r.stderr);

  if (fs.existsSync(side("err"))) {
    const needle = fs.readFileSync(side("err"), "utf8").trim();
    check(`${name}: rejected with "${needle}"`, r.status === 1 && stderr.includes(needle), stderr || "(compiled successfully)");
    continue;
  }
  if (r.status !== 0) {
    check(`${name}: compiles`, false, stderr);
    continue;
  }

  const actual = stripHeader(fs.readFileSync(outLl, "utf8"));
  if (!fs.existsSync(side("ll"))) {
    if (process.env.UPDATE_GOLDENS) {
      fs.writeFileSync(side("ll"), actual + "\n");
      console.log(`WROTE ${name}.ll`);
    } else {
      check(`${name}: has golden .ll (run with UPDATE_GOLDENS=1 to create)`, false);
      continue;
    }
  }
  const expected = fs.readFileSync(side("ll"), "utf8").trim();
  check(`${name}: IR matches golden`, actual === expected, `--- expected\n${expected}\n--- actual\n${actual}`);

  if (HAS_LLVM_AS) {
    const as = spawnSync("llvm-as", [outLl, "-o", "/dev/null"]);
    check(`${name}: llvm-as accepts IR`, as.status === 0, String(as.stderr));
  }

  if (fs.existsSync(side("out")) && HAS_CLANG) {
    const driver = fs.existsSync(side("c")) ? side("c") : path.join(root, "tests", "driver.c");
    // WP5: a case with its own `export function main` is a whole program; link it without the driver.
    const hasEntry = /\bexport\s+function\s+main\b/.test(fs.readFileSync(src, "utf8"));
    const exe = path.join(buildDir, name);
    // -lm: Math.sin/cos/exp/log/pow lower to LLVM intrinsics that become libm calls (WP7).
    const cc = spawnSync("clang", ["-Wno-override-module", "-O2", outLl, ...(hasEntry ? [] : [driver]), "runtime/runtime.c", "-lm", "-o", exe], { cwd: root });
    if (cc.status !== 0) {
      check(`${name}: links natively`, false, String(cc.stderr));
      continue;
    }
    const run = spawnSync(exe);
    const want = fs.readFileSync(side("out"), "utf8").trim();
    check(`${name}: native output matches .out`, run.status === 0 && String(run.stdout).trim() === want,
      `--- expected\n${want}\n--- actual (exit ${run.status})\n${run.stdout}${run.stderr}`);
  }
}

// ---- WP10: diagnostics ------------------------------------------------------------
// Every CompileError prints `file:line:col: error: <msg>` and then a source excerpt:
// the offending line and a caret line (`^` at the start column, `~` to the node end).
if (!only || "diagnostics".includes(only)) {
  const mm = spawnSync("node", [cli, path.join(casesDir, "reject_type_mismatch.ts"), "-o", path.join(buildDir, "diag_mismatch.ll")], { cwd: root });
  const mmLines = String(mm.stderr).split("\n");
  // `a + true` (8 chars) starts at column 40 of line 1, so the caret sits after 39 spaces.
  check("diagnostics: excerpt shows the offending source line",
    mmLines[1] === "  1 | function f(a: number): number { return a + true; }", mm.stderr);
  check("diagnostics: caret line marks `a + true` under column 40",
    mmLines[2] === "    | " + " ".repeat(39) + "^~~~~~~~", mm.stderr);

  const synSrc = path.join(buildDir, "diag_syntax.ts");
  fs.writeFileSync(synSrc, "function f( {\n  return 1;\n}\n");
  const syn = spawnSync("node", [cli, synSrc, "-o", path.join(buildDir, "diag_syntax.ll")], { cwd: root });
  const synErr = String(syn.stderr);
  check("diagnostics: syntax errors keep the `syntax error:` prefix and add the excerpt",
    syn.status === 1 && synErr.includes(": syntax error: ") && synErr.includes("  2 |   return 1;\n    |          ^"), synErr);
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
  ? fs.readdirSync(linkDir).filter((d) => fs.existsSync(path.join(linkDir, d, "main.ts"))).sort()
  : [];
const HAS_OPT = has("opt");

/** Parse `define`/`declare` headers into { name -> { kind, sig, attrs } } with attribute groups resolved. */
function functionHeaders(ir) {
  const groups = new Map();
  for (const m of ir.matchAll(/^attributes (#\d+) = \{ (.*) \}$/gm)) groups.set(m[1], m[2]);
  const out = new Map();
  for (const m of ir.matchAll(/^(define|declare) (?:internal )?(.*?) @([\w.]+)\((.*?)\)(?: (#\d+))?(?: \{)?$/gm)) {
    const params = m[4].replace(/ %[\w.]+(?=,|$)/g, ""); // drop parameter names: declares have none
    out.set(m[3], { kind: m[1], sig: `${m[2]} (${params})`, attrs: m[5] ? groups.get(m[5]) ?? m[5] : "" });
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
  const r = spawnSync("node", [cli, side("main.ts"), "-o", outDir, ...(HAS_CLANG ? ["--link", exe] : []), ...args], { cwd: root });
  const stderr = String(r.stderr);

  if (fs.existsSync(side("expected.err"))) {
    const needle = read("expected.err").trim();
    check(`link/${name}: rejected with "${needle}"`, r.status === 1 && stderr.includes(needle), stderr || "(compiled successfully)");
    continue;
  }
  if (r.status !== 0) {
    check(`link/${name}: compiles${HAS_CLANG ? " and links" : ""}`, false, stderr);
    continue;
  }

  const modules = fs.readdirSync(outDir).filter((f) => f.endsWith(".ll")).sort()
    .map((f) => ({ file: f, ir: fs.readFileSync(path.join(outDir, f), "utf8") }));
  for (const m of modules) {
    if (fs.existsSync(side(m.file))) {
      const expected = read(m.file).trim();
      const actual = stripHeader(m.ir);
      check(`link/${name}: ${m.file} matches golden`, actual === expected, `--- expected\n${expected}\n--- actual\n${actual}`);
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
  for (const m of modules) for (const [sym, h] of functionHeaders(m.ir)) if (h.kind === "define") defines.set(sym, { ...h, file: m.file });
  let declares = 0;
  const mismatches = [];
  for (const m of modules) {
    for (const [sym, h] of functionHeaders(m.ir)) {
      if (h.kind !== "declare" || !defines.has(sym)) continue; // runtime declares have no define here
      declares++;
      const d = defines.get(sym);
      if (h.sig !== d.sig || h.attrs !== d.attrs) {
        mismatches.push(`${m.file}: declare ${h.sig} { ${h.attrs} }\n${d.file}: define  ${d.sig} { ${d.attrs} }`);
      }
    }
  }
  check(`link/${name}: ${declares} imported declare(s) match their define(s) attribute for attribute`,
    declares > 0 && mismatches.length === 0, mismatches.join("\n") || "(no cross-module declares found)");

  if (fs.existsSync(side("expected.ir"))) {
    const all = modules.map((m) => m.ir).join("\n");
    const missing = read("expected.ir").split("\n").map((l) => l.trim()).filter(Boolean).filter((l) => !all.includes(l));
    check(`link/${name}: emitted IR contains every expected.ir line`, missing.length === 0, missing.map((l) => `missing: ${l}`).join("\n"));
  }

  if (HAS_CLANG) {
    const run = spawnSync(exe);
    const wantCode = Number(read("expected.code").trim());
    const wantOut = fs.existsSync(side("expected.out")) ? read("expected.out").trim() : "";
    check(`link/${name}: exits with ${wantCode} and stdout matches expected.out`,
      run.status === wantCode && String(run.stdout).trim() === wantOut,
      `--- expected exit ${wantCode}, stdout:\n${wantOut}\n--- actual exit ${run.status}, stdout:\n${run.stdout}${run.stderr}`);  }
}

// ---- WP1: optimisation ------------------------------------------------------------
// The emitted IR is target-neutral, so `opt` needs a triple before it believes it has
// vector registers; without one the loop vectoriser never fires. x86_64 is always built in.
const sumLoopLl = path.join(buildDir, "cf_sum_loop.ll");
if (has("opt") && fs.existsSync(sumLoopLl)) {
  const o = spawnSync("opt", ["-O2", "-S", "-mtriple=x86_64-unknown-linux-gnu", sumLoopLl]);
  const out = String(o.stdout);
  check("opt -O2 vectorises the cf_sum_loop reduction (<4 x i32> or <8 x i32>)",
    o.status === 0 && /<(4|8) x i32>/.test(out), o.status === 0 ? out : String(o.stderr));
  // Control-flow modules must satisfy the IR verifier (dominance, terminators, phis), not just the assembler.
  for (const name of cases.filter((c) => c.startsWith("cf_") && (!only || c.includes(only)))) {
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
    const cc = spawnSync("clang", ["-Wno-override-module", "-O2", panicLl, "runtime/runtime.c", "-o", exe], { cwd: root });
    const run = cc.status === 0 ? spawnSync(exe) : null;
    check("arr_bounds_panic: exits 1 with `index out of range: 5 >= 3` on stderr (stdout keeps the earlier line)",
      run !== null && run.status === 1 && String(run.stderr).includes("index out of range: 5 >= 3") && String(run.stdout).trim() === "3",
      run ? `exit ${run.status}\nstdout: ${run.stdout}\nstderr: ${run.stderr}` : String(cc.stderr));
  }
  if (has("opt")) {
    const uncheckedLl = path.join(buildDir, "arr_sum_unchecked.ll");
    const c = spawnSync("node", [cli, path.join(casesDir, "arr_sum.ts"), "--unchecked-indexing", "-o", uncheckedLl], { cwd: root });
    const o = c.status === 0 ? spawnSync("opt", ["-O2", "-S", "-mtriple=x86_64-unknown-linux-gnu", uncheckedLl]) : null;
    const out = o ? String(o.stdout) : "";
    check("opt -O2 vectorises the arr_sum loop built with --unchecked-indexing (<4 x i32> or <8 x i32>)",
      o !== null && o.status === 0 && /<(4|8) x i32>/.test(out), o ? out || String(o.stderr) : String(c.stderr));
    // The unchecked module must not declare the panic symbol at all.
    check("arr_sum with --unchecked-indexing references no sts_panic_index",
      c.status === 0 && !fs.readFileSync(uncheckedLl, "utf8").includes("sts_panic_index"), String(c.stderr));
    const checkedLl = path.join(buildDir, "arr_sum.ll");
    if (fs.existsSync(checkedLl)) {
      const oc = spawnSync("opt", ["-O2", "-S", "-mtriple=x86_64-unknown-linux-gnu", checkedLl]);
      const outc = String(oc.stdout);
      // The vector body lives in @sts_main (inlined sum, constant length); @sum itself stays scalar.
      const mainBody = outc.slice(outc.indexOf("@sts_main("));
      check("opt -O2 vectorises the checked arr_sum loop once inlined into main (bounds check folded)",
        oc.status === 0 && /<(4|8) x i32>/.test(mainBody), oc.status === 0 ? outc : String(oc.stderr));
    }
  }
}

// ---- B. Pipeline checks -----------------------------------------------------------
if (!only && HAS_CLANG) {
  const rt = spawnSync("clang", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-O2", "runtime/runtime.c", "tests/runtime_test.c", "-o", path.join(buildDir, "runtime_test")], { cwd: root });
  check("runtime.c compiles warning-free and passes its unit test",
    rt.status === 0 && spawnSync(path.join(buildDir, "runtime_test")).status === 0, String(rt.stderr));

  // Emit the runtime prelude, append an IR test that uses the inline allocator, and
  // link it against runtime.c: proves the IR struct layout matches the C struct.
  const preludeLl = path.join(buildDir, "prelude.ll");
  execFileSync("node", [cli, "tests/cases/string_params.ts", "--runtime-decls", "-o", preludeLl], { cwd: root, stdio: "pipe" });
  const smokeLl = path.join(buildDir, "alloc_smoke.ll");
  fs.writeFileSync(smokeLl, fs.readFileSync(preludeLl, "utf8") + fs.readFileSync(path.join(root, "tests/ir/alloc_smoke.ll"), "utf8"));
  const smokeExe = path.join(buildDir, "alloc_smoke");
  const b = spawnSync("bash", ["scripts/build.sh", smokeLl, "runtime/runtime.c", "tests/ir/alloc_smoke_main.c", "-o", smokeExe, "--profile", "speed"], { cwd: root });
  check("inline arena allocator links with runtime.c (speed profile, LTO)", b.status === 0, String(b.stderr));
  if (b.status === 0) {
    const r = spawnSync(smokeExe);
    check("inline allocator bump matches C arena layout (delta 16)", r.status === 0, String(r.stdout));
  }

  const addLl = path.join(buildDir, "add.ll");
  const exe = path.join(buildDir, "add_size");
  const r = spawnSync("bash", ["scripts/build.sh", addLl, "runtime/runtime.c", "examples/main.c", "-o", exe, "--profile", "size"], { cwd: root });
  const run = r.status === 0 ? spawnSync(exe) : null;
  check("size profile builds a working stripped binary", run !== null && String(run.stdout).trim() === "add(2, 3) = 5", String(r.stderr));

  if (has("wasm-ld")) {
    const wasm = path.join(buildDir, "add.wasm");
    const w = spawnSync("bash", ["scripts/build.sh", addLl, "-o", wasm, "--profile", "wasm"], { cwd: root });
    const host = w.status === 0 ? spawnSync("node", ["examples/node-host.mjs", wasm], { cwd: root }) : null;
    check("wasm profile builds a module Node can import", host !== null && String(host.stdout).trim() === "add(2, 3) = 5", String(w.stderr) + (host ? String(host.stderr) : ""));
  }
} else if (!HAS_CLANG) {
  console.log("SKIP  clang not installed: native round trips and pipeline checks skipped");
}

// ---- WP8: interop ------------------------------------------------------------------
// runtime/statictsc.h is the public C ABI; --emit-header / --emit-dts / --emit-napi derive
// host-side declarations from the same checked program the IR came from. Checks:
//   - every function in src/codegen/runtime.ts has a prototype in statictsc.h, and the
//     header is clean under -Wall -Wextra -Werror as C11 and as C++
//   - generated headers compile under the same flags and link a C driver (including a
//     function named `double`, bound through STS_SYMBOL), strings map to sts_str, and
//     --strict-exports hides internal functions
//   - the generated .d.ts type-checks with tsc; string functions are commented out
//   - the N-API shim compiles warning-free, builds into a .node addon with the napi
//     profile, loads in Node, type-checks its arguments, and agrees with the wasm build
//     of the same module (skipped when the Node headers are not installed)
if (!only || "interop".includes(only)) {
  const interopDir = path.join(buildDir, "interop");
  fs.mkdirSync(interopDir, { recursive: true });
  const runtimeDir = path.join(root, "runtime");
  const publicHeader = fs.readFileSync(path.join(runtimeDir, "statictsc.h"), "utf8");
  const { RUNTIME_FUNCTIONS } = require(path.join(root, "dist", "codegen", "runtime.js"));
  const runtimeNames = [...RUNTIME_FUNCTIONS.filter((f) => !f.intrinsic).map((f) => f.name), "sts_alloc_struct"];
  const undeclared = runtimeNames.filter((n) => !new RegExp(`\\b${n}\\s*\\(`).test(publicHeader));
  check(`statictsc.h declares every runtime.ts function (${runtimeNames.length}) and the arena global`,
    undeclared.length === 0 && publicHeader.includes("extern struct sts_arena sts_arena;"), `missing: ${undeclared.join(", ")}`);

  const strictC = ["-std=c11", "-Wall", "-Wextra", "-Werror", "-Wno-override-module", `-I${runtimeDir}`, `-I${interopDir}`];
  const tsc = path.join(root, "node_modules", "typescript", "bin", "tsc");
  /** Compile <src> to build/test/interop/<stem>.ll (or <stem>/ for a multi-module program) plus the requested sidecars. */
  const emit = (src, extra, stem = path.basename(src, ".ts"), multi = false) => {
    const out = multi ? path.join(interopDir, stem) + path.sep : path.join(interopDir, `${stem}.ll`);
    const r = spawnSync("node", [cli, src, "-o", out, ...extra], { cwd: root });
    return { stem, status: r.status, stderr: String(r.stderr) };
  };
  const sidecar = (stem, ext) => path.join(interopDir, `${stem}.${ext}`);

  // Headers.
  const add = emit("examples/add.ts", ["--emit-header", sidecar("add", "h"), "--emit-dts", sidecar("add", "d.ts"), "--emit-napi", sidecar("add", "napi.c")]);
  check("--emit-header/--emit-dts/--emit-napi write their files", add.status === 0 && ["h", "d.ts", "napi.c"].every((e) => fs.existsSync(sidecar("add", e))), add.stderr);
  const addHeader = fs.existsSync(sidecar("add", "h")) ? fs.readFileSync(sidecar("add", "h"), "utf8") : "";
  check("add.h declares `int32_t add(int32_t a, int32_t b);` with guards and statictsc.h",
    addHeader.includes("int32_t add(int32_t a, int32_t b);") && addHeader.includes("#ifndef STATICTSC_ADD_H") && addHeader.includes('#include "statictsc.h"') && addHeader.includes('extern "C"'), addHeader);

  const strings = emit("examples/strings.ts", ["--emit-header", sidecar("strings", "h"), "--emit-dts", sidecar("strings", "d.ts"), "--emit-napi", sidecar("strings", "napi.c")]);
  const stringsHeader = strings.status === 0 ? fs.readFileSync(sidecar("strings", "h"), "utf8") : "";
  check("strings.h maps string to `sts_str *` (const parameters) and boolean to bool",
    stringsHeader.includes("sts_str *pick(bool flag, const sts_str *a, const sts_str *b);") && stringsHeader.includes("int32_t len2(const sts_str *s);"), stringsHeader || strings.stderr);

  const keyword = emit("tests/cases/export_fn.ts", ["--emit-header", sidecar("export_fn", "h")]);
  const keywordHeader = keyword.status === 0 ? fs.readFileSync(sidecar("export_fn", "h"), "utf8") : "";
  check("a function named `double` is declared as double_ bound with STS_SYMBOL(\"double\")",
    keywordHeader.includes('int32_t double_(int32_t n) STS_SYMBOL("double");') && keywordHeader.includes("int32_t helper(int32_t n);"), keywordHeader || keyword.stderr);

  const strict = emit("tests/cases/export_strict.ts", ["--strict-exports", "--emit-header", sidecar("export_strict", "h")], "export_strict");
  const strictHeader = strict.status === 0 ? fs.readFileSync(sidecar("export_strict", "h"), "utf8") : "";
  check("--strict-exports keeps internal functions out of the header",
    strictHeader.includes("int32_t next(int32_t n);") && !strictHeader.includes("helper"), strictHeader || strict.stderr);

  const entry = emit("examples/multi/main.ts", ["--emit-header", sidecar("multi", "h")], "multi", true);
  const entryHeader = entry.status === 0 ? fs.readFileSync(sidecar("multi", "h"), "utf8") : "";
  check("the entry `export function main` is omitted; imported modules are listed",
    !entryHeader.includes("main(") && entryHeader.includes("int32_t square(int32_t n);") && entryHeader.includes("/* examples/multi/math.ts */"), entryHeader || entry.stderr);

  if (HAS_CLANG) {
    const cxx = spawnSync("clang", ["-std=c++17", "-x", "c++", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", path.join(runtimeDir, "statictsc.h")]);
    const c11 = spawnSync("clang", [...strictC, "-pedantic", "-fsyntax-only", "-x", "c", path.join(runtimeDir, "statictsc.h")]);
    check("statictsc.h compiles under -Wall -Wextra -Werror as C11 (-pedantic) and as C++17", cxx.status === 0 && c11.status === 0, String(cxx.stderr) + String(c11.stderr));

    for (const stem of ["add", "strings", "export_fn", "export_strict", "multi"]) {
      if (!fs.existsSync(sidecar(stem, "h"))) continue;
      const r = spawnSync("clang", [...strictC, "-fsyntax-only", "-x", "c", sidecar(stem, "h")]);
      check(`${stem}.h compiles under -std=c11 -Wall -Wextra -Werror`, r.status === 0, String(r.stderr));
    }

    // A C driver that calls through the generated header, including the keyword-named `double`.
    const driver = path.join(interopDir, "header_driver.c");
    fs.writeFileSync(driver, [
      "#include <stdio.h>",
      '#include "add.h"',
      '#include "export_fn.h"',
      "int main(void) {",
      "  sts_str *s = sts_str_from_i32(add(40, 2));",
      '  printf("add(40, 2) = %s; double_(21) = %d; next(20) = %d\\n", s->data, double_(21), next(20));',
      "  sts_free_arena();",
      "  return 0;",
      "}",
      "",
    ].join("\n"));
    const exe = path.join(interopDir, "header_driver");
    const cc = spawnSync("clang", [...strictC, "-O2", sidecar("add", "ll"), sidecar("export_fn", "ll"), path.join(runtimeDir, "runtime.c"), driver, "-o", exe], { cwd: root });
    const run = cc.status === 0 ? spawnSync(exe) : null;
    check("a -Werror C driver links through the generated headers and runtime.c",
      run !== null && String(run.stdout).trim() === "add(40, 2) = 42; double_(21) = 42; next(20) = 41", String(cc.stderr) + (run ? String(run.stdout) + String(run.stderr) : ""));
  }

  // TypeScript declarations for the wasm build.
  const addDts = fs.existsSync(sidecar("add", "d.ts")) ? fs.readFileSync(sidecar("add", "d.ts"), "utf8") : "";
  const stringsDts = fs.existsSync(sidecar("strings", "d.ts")) ? fs.readFileSync(sidecar("strings", "d.ts"), "utf8") : "";
  check("add.d.ts declares `add(a: number, b: number): number` and `load(bytes: BufferSource): Promise<Exports>`",
    addDts.includes("  add(a: number, b: number): number;") && addDts.includes("export function load(bytes: BufferSource): Promise<Exports>;"), addDts);
  check("strings.d.ts comments out every string function",
    stringsDts.includes("  // pick(flag: boolean, a: string, b: string): string  -- not exported to JS") && !/^\s*pick\(/m.test(stringsDts), stringsDts);
  for (const stem of ["add", "strings"]) {
    if (!fs.existsSync(sidecar(stem, "d.ts"))) continue;
    const r = spawnSync("node", [tsc, "--noEmit", "--strict", sidecar(stem, "d.ts")], { cwd: root });
    check(`${stem}.d.ts passes tsc --noEmit --strict`, r.status === 0, String(r.stdout) + String(r.stderr));
  }

  // N-API addon.
  const nodeInclude = process.env.NODE_INCLUDE || path.join(path.dirname(process.execPath), "..", "include", "node");
  const hasNodeHeaders = fs.existsSync(path.join(nodeInclude, "node_api.h"));
  const shim = fs.existsSync(sidecar("add", "napi.c")) ? fs.readFileSync(sidecar("add", "napi.c"), "utf8") : "";
  const stringsShim = fs.existsSync(sidecar("strings", "napi.c")) ? fs.readFileSync(sidecar("strings", "napi.c"), "utf8") : "";
  check("add.napi.c registers `add` with type checks and a NAPI_MODULE_INIT",
    shim.includes('{"add", sts_napi_add},') && shim.includes("type != napi_number") && shim.includes("NAPI_MODULE_INIT()"), shim);
  check("strings.napi.c skips string functions with a comment and still exposes sts_reset_arena",
    stringsShim.includes("pick(flag: boolean, a: string, b: string): string -- not bridged") && !stringsShim.includes("sts_napi_pick") && stringsShim.includes('{"sts_reset_arena", sts_napi_reset_arena},'), stringsShim);
  if (!HAS_CLANG) {
    // nothing to build
  } else if (!hasNodeHeaders) {
    console.log(`SKIP  Node headers not found (${path.join(nodeInclude, "node_api.h")}): N-API addon build skipped`);
  } else {
    for (const stem of ["add", "strings"]) {
      const r = spawnSync("clang", [...strictC, `-I${nodeInclude}`, "-fsyntax-only", sidecar(stem, "napi.c")]);
      check(`${stem}.napi.c compiles under -std=c11 -Wall -Wextra -Werror`, r.status === 0, String(r.stderr));
    }
    const addon = path.join(interopDir, "add.node");
    const b = spawnSync("bash", ["scripts/build.sh", sidecar("add", "ll"), "runtime/runtime.c", sidecar("add", "napi.c"), "-o", addon, "--profile", "napi"], { cwd: root });
    check("napi profile builds add.node", b.status === 0, String(b.stderr));
    if (b.status === 0) {
      const ex = spawnSync("node", ["examples/node-addon.mjs", addon], { cwd: root });
      const lines = String(ex.stdout).trim().split("\n");
      check("examples/node-addon.mjs prints add(2, 3) = 5 and the TypeError for add(\"2\", 3)",
        ex.status === 0 && lines[0] === "add(2, 3) = 5" && lines[1] === 'add("2", 3) throws: add: argument 1 (a) must be a number', String(ex.stdout) + String(ex.stderr));

      if (has("wasm-ld")) {
        const wasm = path.join(interopDir, "add.wasm");
        const w = spawnSync("bash", ["scripts/build.sh", sidecar("add", "ll"), "-o", wasm, "--profile", "wasm"], { cwd: root });
        const script = [
          'import { readFileSync } from "node:fs";',
          'import { createRequire } from "node:module";',
          `const addon = createRequire(import.meta.url)(${JSON.stringify(addon)});`,
          `const { instance } = await WebAssembly.instantiate(readFileSync(${JSON.stringify(wasm)}), {});`,
          "const pairs = [[2, 3], [40, 2], [-7, 7], [2147483647, 1]];",
          "const same = pairs.every(([a, b]) => addon.add(a, b) === instance.exports.add(a, b));",
          "console.log(same ? pairs.map(([a, b]) => addon.add(a, b)).join(\" \") : \"mismatch\");",
        ].join("\n");
        const cmp = w.status === 0 ? spawnSync("node", ["--input-type=module", "-e", script], { cwd: root }) : null;
        check("the .node and .wasm builds of add.ts return identical results (i32 wrap included)",
          cmp !== null && String(cmp.stdout).trim() === "5 42 0 -2147483648", String(w.stderr) + (cmp ? String(cmp.stdout) + String(cmp.stderr) : ""));
      }
    }
  }
}

// ---- WP0: validator ----------------------------------------------------------------
// Phase 0 must stay cheap. A synthetic 1,000-line file (functions, locals, arithmetic,
// calls, string/boolean expressions, control flow) is parsed once, then only the
// validator is timed. Budget in docs/MASTER_PLAN.md is 5 ms; the gate is 50 ms for CI headroom.
if (!only) {
  const ts = require("typescript");
  const { validateStaticTS } = require(path.join(root, "dist", "validator.js"));
  const lines = [];
  for (let i = 0; lines.length < 1000; i++) {
    const callee = i === 0 ? "fn0" : `fn${i - 1}`;
    lines.push(`function fn${i}(a: number, b: number, s: string, flag: boolean): number {`);
    lines.push(`  const x = a * ${i} + b - (a % 7); let y = x / 2;`);
    lines.push(`  if ((flag && y > a) || !(s === "k")) { y = y + ${callee}(x, y, s, !flag); } else { y = y - 1; }`);
    lines.push("  for (let k = 0; k < b; k++) { y = y + k * (k - 1); } return y - x;");
    lines.push("}");
  }
  const perfTs = path.join(buildDir, "validator_perf.ts");
  fs.writeFileSync(perfTs, `${lines.join("\n")}\n`);
  const sf = ts.createSourceFile(perfTs, fs.readFileSync(perfTs, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let error = null;
  const t0 = process.hrtime.bigint();
  try {
    validateStaticTS(sf);
  } catch (e) {
    error = e;
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  check(`validator accepts a ${lines.length}-line file`, error === null, error?.message);
  check(`validator runs in under 50 ms on ${lines.length} lines (${ms.toFixed(2)} ms)`, ms < 50, `${ms.toFixed(2)} ms`);
}

// ---- WP12: exit codes --------------------------------------------------------------
// The CLI's contract (docs/wp12-release.md): 0 ok, 1 compile error, 2 usage, 3 toolchain,
// 70 internal compiler error. Each failure mode is driven from outside the compiler:
// STATICTSC_SIMULATE_ICE=1 is the test hook for the ICE path, an empty PATH stands in
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
  check(`--version prints "statictsc ${pkgVersion}" and exits 0`, v.status === 0 && v.stdout.trim() === `statictsc ${pkgVersion}`, v.stdout + v.stderr);

  const noInputs = run([]);
  check("no inputs: usage on stderr, exit 2", noInputs.status === 2 && noInputs.stderr.includes("usage: statictsc"), noInputs.stderr);
  const badFlag = run(["--bogus", entry]);
  check("unknown flag: names it, exit 2", badFlag.status === 2 && badFlag.stderr.includes("unknown option: --bogus"), badFlag.stderr);
  const noValue = run([entry, "-o"]);
  check("-o without a value: exit 2", noValue.status === 2, noValue.stderr);

  const missing = run(["does-not-exist.ts"]);
  check("missing input file: one-line ENOENT message, exit 1", missing.status === 1 && missing.stderr.includes("ENOENT") && !missing.stderr.includes("internal compiler error"), missing.stderr);

  const ice = run([entry, "-o", path.join(wp12Dir, "ice.ll")], { STATICTSC_SIMULATE_ICE: "1" });
  check("internal error: exit 70, names the file, asks for a bug report, no stack trace",
    ice.status === 70 && ice.stderr.includes("internal compiler error while compiling " + entry) &&
      ice.stderr.includes("TypeError: simulated internal compiler error") && ice.stderr.includes("github.com/amritk/compiler/issues") &&
      ice.stderr.includes("STATICTSC_DEBUG=1") && !/^\s+at /m.test(ice.stderr),
    ice.stderr);
  const iceDebug = run([entry, "-o", path.join(wp12Dir, "ice.ll")], { STATICTSC_SIMULATE_ICE: "1", STATICTSC_DEBUG: "1" });
  check("internal error with STATICTSC_DEBUG=1: exit 70 and the stack trace is printed",
    iceDebug.status === 70 && /^\s+at /m.test(iceDebug.stderr), iceDebug.stderr);

  // Machine without clang: PATH holds only an empty dir plus node's own dir (spawnSync needs `node`).
  const emptyBin = path.join(wp12Dir, "empty-bin");
  fs.mkdirSync(emptyBin, { recursive: true });
  const noClang = run([entry, "--link", path.join(wp12Dir, "noclang")], { PATH: `${emptyBin}${path.delimiter}${path.dirname(process.execPath)}`, CC: "" });
  check("--link without clang: install hint per platform, exit 3, no IR written",
    noClang.status === 3 && noClang.stderr.includes("no usable C compiler") && noClang.stderr.includes("apt-get install") &&
      noClang.stderr.includes("brew install") && noClang.stderr.includes("WSL") && !fs.existsSync(path.join(wp12Dir, "noclang.modules")),
    noClang.stderr);

  // build.sh failure: a stub compiler that passes the --version probe but cannot link.
  const stub = path.join(wp12Dir, "stub-cc");
  fs.writeFileSync(stub, '#!/bin/sh\ncase "$1" in --version) exit 0 ;; esac\necho "stub-cc: refusing to link" >&2\nexit 1\n', { mode: 0o755 });
  const badBuild = run([entry, "--link", path.join(wp12Dir, "badbuild")], { CC: stub });
  check("--link when build.sh fails: its stderr is shown, the .ll paths are named, exit 3",
    badBuild.status === 3 && badBuild.stderr.includes("stub-cc: refusing to link") && badBuild.stderr.includes("build.sh failed (exit 1)") &&
      badBuild.stderr.includes("main.ll") && fs.existsSync(path.join(wp12Dir, "badbuild.modules", "main.ll")),
    badBuild.stderr);
}

// ---- WP12: package ------------------------------------------------------------------
// The npm tarball must be self-contained: `npm pack`, install it into a temporary prefix,
// and drive the installed `statictsc` from an unrelated directory. That proves the `files`
// whitelist ships runtime/runtime.c, runtime/statictsc.h and scripts/build.sh, and that the
// CLI resolves them from its own package root rather than from the cwd.
if (!only || "package".includes(only) || "wp12".includes(only)) {
  const pkgDir = path.join(buildDir, "wp12-package");
  fs.rmSync(pkgDir, { recursive: true, force: true });
  fs.mkdirSync(pkgDir, { recursive: true });
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const pack = spawnSync(npm, ["pack", "--json", "--pack-destination", pkgDir], { cwd: root, encoding: "utf8" });
  check("npm pack succeeds", pack.status === 0, pack.stderr);
  if (pack.status === 0) {
    const info = JSON.parse(pack.stdout)[0];
    const files = info.files.map((f) => f.path).sort();
    const allowed = [/^dist\//, /^runtime\//, /^scripts\//, /^README\.md$/, /^LICENSE$/, /^docs\/INSTALL\.md$/, /^package\.json$/, /^CHANGELOG\.md$/];
    const stray = files.filter((f) => !allowed.some((re) => re.test(f)));
    check(`npm pack ships only the whitelisted paths (${files.length} files)`, stray.length === 0, stray.join("\n"));
    const required = ["dist/index.js", "dist/version.js", "runtime/runtime.c", "runtime/statictsc.h", "scripts/build.sh", "LICENSE", "docs/INSTALL.md"];
    const absent = required.filter((f) => !files.includes(f));
    check("npm pack includes everything --link needs (runtime.c, statictsc.h, build.sh) plus LICENSE/INSTALL.md", absent.length === 0, absent.join("\n"));
    for (const f of ["src/index.ts", "tests/run.js", "examples/add.ts", ".github/workflows/ci.yml", "docs/MASTER_PLAN.md"]) {
      check(`npm pack excludes ${f}`, !files.includes(f));
    }

    if (!HAS_CLANG) {
      console.log("SKIP  package install + --link from another cwd (clang not found)");
    } else {
      const tarball = path.join(pkgDir, info.filename);
      const prefix = path.join(pkgDir, "prefix");
      const install = spawnSync(npm, ["install", "--prefix", prefix, "--no-audit", "--no-fund", "--prefer-offline", "--ignore-scripts", tarball], { cwd: pkgDir, encoding: "utf8" });
      check("npm install <tarball> --prefix <tmp> succeeds", install.status === 0, install.stdout + install.stderr);
      if (install.status === 0) {
        const bin = path.join(prefix, "node_modules", ".bin", "statictsc");
        const work = path.join(pkgDir, "elsewhere");
        fs.mkdirSync(work, { recursive: true });
        fs.writeFileSync(path.join(work, "hello.ts"), 'export function main(): number {\n  console.log("hello from a global install");\n  return 0;\n}\n');
        const ver = spawnSync(bin, ["--version"], { cwd: work, encoding: "utf8" });
        check("installed statictsc --version works from an unrelated cwd", ver.status === 0 && ver.stdout.trim() === `statictsc ${info.version}`, ver.stdout + ver.stderr);
        const link = spawnSync(bin, ["hello.ts", "--link", "hello"], { cwd: work, encoding: "utf8" });
        check("installed statictsc hello.ts --link works from an unrelated cwd", link.status === 0 && fs.existsSync(path.join(work, "hello")), link.stderr);
        if (link.status === 0) {
          const hello = spawnSync(path.join(work, "hello"), [], { cwd: work, encoding: "utf8" });
          check("the binary linked by the installed package runs", hello.status === 0 && hello.stdout.trim() === "hello from a global install", hello.stdout + hello.stderr);
        }
        const ir = spawnSync(bin, [path.join(root, "examples", "add.ts"), "-o", path.join(work, "add.ll")], { cwd: work, encoding: "utf8" });
        check("installed statictsc compiles examples/add.ts to IR from an unrelated cwd", ir.status === 0 && fs.existsSync(path.join(work, "add.ll")), ir.stderr);
      }
    }
  }
}

console.log(`\n${passes} passed, ${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
