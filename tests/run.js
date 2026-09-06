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
    const cc = spawnSync("clang", ["-Wno-override-module", "-O2", outLl, ...(hasEntry ? [] : [driver]), "runtime/runtime.c", "-o", exe], { cwd: root });
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
      `--- expected exit ${wantCode}, stdout:\n${wantOut}\n--- actual exit ${run.status}, stdout:\n${run.stdout}${run.stderr}`);
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

console.log(`\n${passes} passed, ${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
