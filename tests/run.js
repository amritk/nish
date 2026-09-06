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
const outLl = path.join(buildDir, "add.ll");
execFileSync("node", [cli, "examples/add.ts", "-o", outLl], { cwd: root, stdio: "pipe" });
const actual = fs.readFileSync(outLl, "utf8");
const expected = fs.readFileSync(path.join(root, "tests", "expected", "add.ll"), "utf8").trim();
// Strip the module header; only the function definition is part of the contract.
const actualFn = actual.split("\n").filter((l) => !l.startsWith(";") && !l.startsWith("source_filename")).join("\n").trim();
check("add.ts emits the expected LLVM IR", actualFn === expected, `expected:\n${expected}\n\nactual:\n${actualFn}`);

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

// 3. Negative cases -------------------------------------------------------------
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
