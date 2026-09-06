#!/usr/bin/env node
/**
 * Phase 1 test runner.
 *
 *  1. Compile examples/add.ts and check the emitted function is byte-for-byte
 *     identical to tests/expected/add.ll.
 *  2. If LLVM tools are installed, assemble the IR with llvm-as, link it with
 *     examples/main.c via clang, run the binary, and check its output.
 *  3. Check that a few invalid programs are rejected with a diagnostic.
 */
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const cli = path.join(root, "dist", "index.js");
const buildDir = path.join(root, "build", "test");
fs.mkdirSync(buildDir, { recursive: true });

let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) {
    failures++;
    if (detail) console.log(detail.split("\n").map((l) => "      " + l).join("\n"));
  }
}
function has(tool) {
  return spawnSync("which", [tool]).status === 0;
}

// 1. Golden IR comparison -----------------------------------------------------
function compileGolden(name, extraArgs, goldenFile) {
  const out = path.join(buildDir, `${name}.ll`);
  execFileSync("node", [cli, "examples/add.ts", "-o", out, ...extraArgs], { cwd: root, stdio: "pipe" });
  const actual = fs.readFileSync(out, "utf8");
  const expected = fs.readFileSync(path.join(root, "tests", "expected", goldenFile), "utf8").trim();
  // Strip the module header; only the definitions are part of the contract.
  const body = actual.split("\n").filter((l) => !l.startsWith(";") && !l.startsWith("source_filename")).join("\n").trim();
  check(`add.ts emits the expected LLVM IR (${name})`, body === expected, `expected:\n${expected}\n\nactual:\n${body}`);
  return out;
}
compileGolden("add.plain", ["--plain"], "add.plain.ll");
const outLl = compileGolden("add", [], "add.ll");

// 2. Toolchain round trip -----------------------------------------------------
if (has("llvm-as")) {
  const r = spawnSync("llvm-as", [outLl, "-o", path.join(buildDir, "add.bc")]);
  check("llvm-as accepts the emitted IR", r.status === 0, String(r.stderr));
} else {
  console.log("SKIP  llvm-as not installed");
}

if (has("clang")) {
  const exe = path.join(buildDir, "add_app");
  const r = spawnSync("clang", ["-Wno-override-module", outLl, "examples/main.c", "-o", exe], { cwd: root });
  check("clang links IR with main.c", r.status === 0, String(r.stderr));
  if (r.status === 0) {
    const run = spawnSync(exe);
    check("native binary prints add(2, 3) = 5", String(run.stdout).trim() === "add(2, 3) = 5", String(run.stdout));
  }
} else {
  console.log("SKIP  clang not installed");
}

// 3. Runtime + optimised build pipeline ----------------------------------------------
if (has("clang")) {
  const rt = spawnSync("clang", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-O2", "runtime/runtime.c", "tests/runtime_test.c", "-o", path.join(buildDir, "runtime_test")], { cwd: root });
  check("runtime.c compiles warning-free and passes its unit test",
    rt.status === 0 && spawnSync(path.join(buildDir, "runtime_test")).status === 0, String(rt.stderr));

  // Emit the runtime prelude, append an IR test that uses the inline allocator, and
  // link it against runtime.c: proves the IR struct layout matches the C struct.
  const preludeLl = path.join(buildDir, "prelude.ll");
  execFileSync("node", [cli, "examples/strings.ts", "--runtime-decls", "-o", preludeLl], { cwd: root, stdio: "pipe" });
  const smokeLl = path.join(buildDir, "alloc_smoke.ll");
  fs.writeFileSync(smokeLl, fs.readFileSync(preludeLl, "utf8") + fs.readFileSync(path.join(root, "tests/ir/alloc_smoke.ll"), "utf8"));
  const smokeExe = path.join(buildDir, "alloc_smoke");
  const b = spawnSync("bash", ["scripts/build.sh", smokeLl, "runtime/runtime.c", "tests/ir/alloc_smoke_main.c", "-o", smokeExe, "--profile", "speed"], { cwd: root });
  check("inline arena allocator links with runtime.c (speed profile, LTO)", b.status === 0, String(b.stderr));
  if (b.status === 0) {
    const r = spawnSync(smokeExe);
    check("inline allocator bump matches C arena layout (delta 16)", r.status === 0, String(r.stdout));
  }

  for (const profile of ["size"]) {
    const exe = path.join(buildDir, `add_${profile}`);
    const r = spawnSync("bash", ["scripts/build.sh", outLl, "runtime/runtime.c", "examples/main.c", "-o", exe, "--profile", profile], { cwd: root });
    const run = r.status === 0 ? spawnSync(exe) : null;
    check(`${profile} profile builds a working stripped binary`, run !== null && String(run.stdout).trim() === "add(2, 3) = 5", String(r.stderr));
  }

  if (has("wasm-ld")) {
    const wasm = path.join(buildDir, "add.wasm");
    const r = spawnSync("bash", ["scripts/build.sh", outLl, "-o", wasm, "--profile", "wasm"], { cwd: root });
    const run = r.status === 0 ? spawnSync("node", ["examples/node-host.mjs", wasm], { cwd: root }) : null;
    check("wasm profile builds a module Node can import", run !== null && String(run.stdout).trim() === "add(2, 3) = 5", String(r.stderr) + (run ? String(run.stderr) : ""));
  }
}

// 4. Negative cases -------------------------------------------------------------
const rejects = [
  ["any parameter", "function f(a: any): number { return a; }", "`any` is forbidden"],
  ["missing return type", "function f(a: number) { return a; }", "explicit return type"],
  ["type mismatch", "function f(a: number): number { return a + true; }", "same numeric type"],
  ["assign to parameter", "function f(a: number): number { a = 1; return a; }", "Cannot assign"],
  ["missing return", "function f(a: number): number { let x = a; }", "every path"],
  ["top-level statement", "let x = 1;", "Only top-level function declarations"],
];
for (const [name, src, needle] of rejects) {
  const file = path.join(buildDir, `reject_${name.replace(/\W+/g, "_")}.ts`);
  fs.writeFileSync(file, src + "\n");
  const r = spawnSync("node", [cli, file], { cwd: root });
  const err = String(r.stderr);
  check(`rejects ${name}`, r.status === 1 && err.includes(needle), err);
}

console.log(failures === 0 ? "\nAll tests passed." : `\n${failures} test(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
