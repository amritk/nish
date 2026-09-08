#!/usr/bin/env node
/**
 * AmritScript test runner.
 *
 *  A. Golden cases in tests/cases/  (one .ts per case, discovered automatically)
 *       <name>.ts    source
 *       <name>.ll    expected IR (module header stripped). Missing + UPDATE_GOLDENS=1 -> written.
 *       <name>.args  extra CLI flags, whitespace separated
 *       <name>.err   expected error substring; compile must fail (no .ll needed)
 *       <name>.out   expected stdout when linked with <name>.c (or tests/driver.c,
 *                    which prints `test()`) and runtime/runtime.c, then run
 *       <name>.argv  command-line arguments for that run, whitespace separated (WP7)
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

/** Module body with the `; ModuleID` / `source_filename` header removed. */
function stripHeader(ir) {
  return ir
    .split("\n")
    .filter((l) => !l.startsWith(";") && !l.startsWith("source_filename"))
    .join("\n")
    .trim();
}

// ---- A. Golden cases -------------------------------------------------------------
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
  const r = spawnSync("node", [cli, src, "-o", outLl, ...args], { cwd: root });
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
  const actual = stripHeader(fs.readFileSync(outLl, "utf8")).split(root).join("<root>");
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
  check(
    `${name}: IR matches golden`,
    actual === expected,
    `--- expected\n${expected}\n--- actual\n${actual}`
  );

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
    const cc = spawnSync(
      "clang",
      [
        "-Wno-override-module",
        "-O2",
        outLl,
        ...(hasEntry ? [] : [driver]),
        "runtime/runtime.c",
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
    const run = spawnSync(exe, argv);
    const want = fs.readFileSync(side("out"), "utf8").trim();
    check(
      `${name}: native output matches .out`,
      run.status === 0 && String(run.stdout).trim() === want,
      `--- expected\n${want}\n--- actual (exit ${run.status})\n${run.stdout}${run.stderr}`
    );
  }
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
  if (has("opt")) {
    const v = spawnSync("opt", ["-passes=verify", "-disable-output", path.join(buildDir, "dbg_locals.ll")]);
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
        console.log("SKIP  -g: neither llvm-dwarfdump nor objdump is installed; line table not inspected");
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
    const cc = spawnSync("clang", ["-Wno-override-module", "-O2", panicLl, "runtime/runtime.c", "-o", exe], {
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
      "arr_sum with --unchecked-indexing references no amrit_panic_index",
      c.status === 0 && !fs.readFileSync(uncheckedLl, "utf8").includes("amrit_panic_index"),
      String(c.stderr)
    );
    const checkedLl = path.join(buildDir, "arr_sum.ll");
    if (fs.existsSync(checkedLl)) {
      const oc = spawnSync("opt", ["-O2", "-S", "-mtriple=x86_64-unknown-linux-gnu", checkedLl]);
      const outc = String(oc.stdout);
      // The vector body lives in @amrit_main (inlined sum, constant length); @sum itself stays scalar.
      const mainBody = outc.slice(outc.indexOf("@amrit_main("));
      check(
        "opt -O2 vectorises the checked arr_sum loop once inlined into main (bounds check folded)",
        oc.status === 0 && /<(4|8) x i32>/.test(mainBody),
        oc.status === 0 ? outc : String(oc.stderr)
      );
    }
  }
}

// ---- WP6: memory --------------------------------------------------------------------
// 1. Every mem_ module passes the IR verifier (allocas, scope calls, null compares).
// 2. mem_stack_struct.ts has no arena allocation left: every object is an alloca, so the
//    module never references amrit_alloc_struct (and therefore emits no arena prelude).
// 3. mem_scope_dynamic_array.ts builds a `new Array<number>(n)` per call and is called
//    100000 times: the function's automatic arena scope releases each one, so the two
//    `Arena.used()` lines (before and after the loop) must be identical, with no
//    OS-specific RSS tooling involved. mem_stack_loop / mem_scope_string_temp print
//    their own `true` for the same property (checked by their .out files).
// 4. --no-stack-alloc keeps every object in the arena: the same source then does
//    reference amrit_alloc_struct, and still runs to the same output.
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
      "mem_stack_struct: no amrit_alloc_struct and no arena prelude, five `alloca %struct.` objects",
      !ir.includes("amrit_alloc_struct") &&
        !ir.includes("@amrit_arena =") &&
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
      nsIr.includes("call i8* @amrit_alloc_struct(i64 8)") &&
      !/alloca %struct\.(Pair|Point|Counter), align/.test(nsIr),
    String(ns.stderr) || nsIr
  );
  if (HAS_CLANG && ns.status === 0) {
    const exe = path.join(buildDir, "mem_stack_struct_nostack");
    const cc = spawnSync(
      "clang",
      ["-Wno-override-module", "-O2", noStackLl, "runtime/runtime.c", "-o", exe],
      { cwd: root }
    );
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

// ---- WP2: layout -------------------------------------------------------------------
// tests/layout/structs.ts declares ten classes plus three derived ones (WP2b, whose
// layout is the base's fields followed by their own); tests/layout/structs.c declares
// the same C structs (flattened) with `_Static_assert(sizeof(struct X) == N)`. The
// compiler's size for each class is read from the `amrit_alloc_struct(i64 N)` in its
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
      const alloc = m[2].match(/@amrit_alloc_struct\(i64 (\d+)\)/);
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
      fromC.size === 15 && fromIr.size === 15 && diffs.length === 0,
      diffs.join("\n") || `IR sizes: ${JSON.stringify([...fromIr])}`
    );
    if (HAS_CLANG) {
      // WP2b: the C header lists every class with its flattened fields; a derived
      // struct must therefore have the size the compiler (and structs.c) computed.
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
        `layout: --emit-header declares the ${fromC.size} structs (derived ones flattened) with the sizes structs.c asserts, under -Wall -Wextra -Werror`,
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
          "runtime/runtime.c",
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
    const cc = spawnSync(
      "clang",
      ["-Wno-override-module", "-O2", ll, "runtime/runtime.c", "-lm", "-o", exe],
      { cwd: root }
    );
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
      "runtime/runtime.c",
      "tests/runtime_test.c",
      "-o",
      path.join(buildDir, "runtime_test"),
    ],
    { cwd: root }
  );
  check(
    "runtime.c compiles warning-free and passes its unit test",
    rt.status === 0 && spawnSync(path.join(buildDir, "runtime_test")).status === 0,
    String(rt.stderr)
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
  } else {
    console.log(
      `SKIP  skipped: no WASI sysroot${has("wasm-ld") ? "" : " and no wasm-ld"} (set WASI_SYSROOT or install wasi-sdk, see docs/INSTALL.md): wasi profile not built`
    );
  }
} else if (!HAS_CLANG) {
  console.log("SKIP  clang not installed: native round trips and pipeline checks skipped");
}

// ---- WP8: interop ------------------------------------------------------------------
// runtime/amritc.h is the public C ABI; --emit-header / --emit-dts / --emit-napi derive
// host-side declarations from the same checked program the IR came from. Checks:
//   - every function in src/codegen/runtime.ts has a prototype in amritc.h, and the
//     header is clean under -Wall -Wextra -Werror as C11 and as C++
//   - generated headers compile under the same flags and link a C driver (including a
//     function named `double`, bound through AMRIT_SYMBOL), strings map to amrit_str, and
//     --strict-exports hides internal functions
//   - the generated .d.ts type-checks with tsc; string functions are commented out
//   - the N-API shim compiles warning-free, builds into a .node addon with the napi
//     profile, loads in Node, type-checks its arguments, and agrees with the wasm build
//     of the same module (skipped when the Node headers are not installed)
if (!only || "interop".includes(only)) {
  const interopDir = path.join(buildDir, "interop");
  fs.mkdirSync(interopDir, { recursive: true });
  const runtimeDir = path.join(root, "runtime");
  const publicHeader = fs.readFileSync(path.join(runtimeDir, "amritc.h"), "utf8");
  const { RUNTIME_FUNCTIONS } = require(path.join(root, "dist", "codegen", "runtime.js"));
  const runtimeNames = [
    ...RUNTIME_FUNCTIONS.filter((f) => !f.intrinsic).map((f) => f.name),
    "amrit_alloc_struct",
  ];
  const undeclared = runtimeNames.filter((n) => !new RegExp(`\\b${n}\\s*\\(`).test(publicHeader));
  check(
    `amritc.h declares every runtime.ts function (${runtimeNames.length}) and the arena global`,
    undeclared.length === 0 && publicHeader.includes("extern struct amrit_arena amrit_arena;"),
    `missing: ${undeclared.join(", ")}`
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
    "add.h declares `int32_t add(int32_t a, int32_t b);` with guards and amritc.h",
    addHeader.includes("int32_t add(int32_t a, int32_t b);") &&
      addHeader.includes("#ifndef AMRITC_ADD_H") &&
      addHeader.includes('#include "amritc.h"') &&
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
    "strings.h maps string to `amrit_str *` (const parameters) and boolean to bool",
    stringsHeader.includes("amrit_str *pick(bool flag, const amrit_str *a, const amrit_str *b);") &&
      stringsHeader.includes("int32_t len2(const amrit_str *s);"),
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

  const keyword = emit("tests/cases/export_fn.ts", ["--emit-header", sidecar("export_fn", "h")]);
  const keywordHeader = keyword.status === 0 ? fs.readFileSync(sidecar("export_fn", "h"), "utf8") : "";
  check(
    'a function named `double` is declared as double_ bound with AMRIT_SYMBOL("double")',
    keywordHeader.includes('int32_t double_(int32_t n) AMRIT_SYMBOL("double");') &&
      keywordHeader.includes("int32_t helper(int32_t n);"),
    keywordHeader || keyword.stderr
  );

  const strict = emit(
    "tests/cases/export_strict.ts",
    ["--strict-exports", "--emit-header", sidecar("export_strict", "h")],
    "export_strict"
  );
  const strictHeader = strict.status === 0 ? fs.readFileSync(sidecar("export_strict", "h"), "utf8") : "";
  check(
    "--strict-exports keeps internal functions out of the header",
    strictHeader.includes("int32_t next(int32_t n);") && !strictHeader.includes("helper"),
    strictHeader || strict.stderr
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
      path.join(runtimeDir, "amritc.h"),
    ]);
    const c11 = spawnSync("clang", [
      ...strictC,
      "-pedantic",
      "-fsyntax-only",
      "-x",
      "c",
      path.join(runtimeDir, "amritc.h"),
    ]);
    check(
      "amritc.h compiles under -Wall -Wextra -Werror as C11 (-pedantic) and as C++17",
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

    for (const stem of ["add", "strings", "export_fn", "export_strict", "multi"]) {
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
        "  amrit_str *s = amrit_str_from_i32(add(40, 2));",
        '  printf("add(40, 2) = %s; double_(21) = %d; next(20) = %d\\n", s->data, double_(21), next(20));',
        "  amrit_free_arena();",
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
    shim.includes('{"add", amrit_napi_add},') &&
      shim.includes("type != napi_number") &&
      shim.includes("NAPI_MODULE_INIT()"),
    shim
  );
  check(
    "strings.napi.c bridges string functions (arena strings in, napi_create_string_utf8 out, released per call) and exposes amrit_reset_arena",
    stringsShim.includes('{"pick", amrit_napi_pick},') &&
      stringsShim.includes("amrit_napi_string_arg(env, argv[1])") &&
      stringsShim.includes("napi_create_string_utf8(env, result->data, result->len, &out)") &&
      stringsShim.includes("uint64_t mark = amrit_arena_mark();") &&
      stringsShim.includes('{"amrit_reset_arena", amrit_napi_reset_arena},'),
    stringsShim
  );
  if (!HAS_CLANG) {
    // nothing to build
  } else if (!hasNodeHeaders) {
    console.log(
      `SKIP  Node headers not found (${path.join(nodeInclude, "node_api.h")}): N-API addon build skipped`
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
    resHeader.includes("typedef struct amrit_result_i32_i32_word {") &&
      resHeader.includes("union { int32_t value; int32_t error; } as;") &&
      resHeader.includes("AMRIT_RESULT_ASSERT(sizeof(amrit_result_i32_i32_word) == 8,") &&
      resHeader.includes("amrit_result_i32_i32_word half(int32_t n);") &&
      resHeader.includes("amrit_result_void_i32_word checkPort(int32_t port);") &&
      resHeader.includes("struct amrit_result_i32__IoError *openFile(const amrit_str *path);") &&
      resHeader.includes("int32_t describe(amrit_result_i32_i32_word r);"),
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
        "    amrit_result_i32_i32_word r = half(n);",
        '    printf("half(%d) %s %d via %d\\n", n, r.ok ? "ok" : "err",',
        "           r.ok ? r.as.value : r.as.error, describe(r));",
        "  }",
        "  /* a Result the C side builds itself, handed to AmritScript by value */",
        "  amrit_result_i32_i32_word made = { 1, { 41 } };",
        '  printf("C-built %d ", describe(made));',
        "  made.ok = 0; made.as.error = 5;",
        '  printf("%d\\n", describe(made));',
        "  amrit_result_void_i32_word v = checkPort(0), w = checkPort(443);",
        '  printf("checkPort %d %d %d\\n", v.ok, v.as.error, w.ok);',
        "  struct amrit_result_i32__IoError *o = openFile(amrit_str_new(\"\", 0));",
        '  printf("openFile %d %d\\n", o->ok, o->error->code);',
        "  amrit_free_arena();",
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
    resShim.includes("static napi_status amrit_napi_result(napi_env env, bool ok, napi_value payload, napi_value *out)") &&
      resShim.includes('napi_set_named_property(env, obj, ok ? "value" : "error", payload)') &&
      resShim.includes('{"half", amrit_napi_half},') &&
      resShim.includes('{"describe", amrit_napi_describe},') &&
      resShim.includes('napi_get_named_property(env, argv[0], r_flag ? "value" : "error", &r_arm)') &&
      resShim.includes("openFile(path: string): Result<number, IoError> -- not bridged"),
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

  // ---- WP4/WP8: arrays and strings across the boundary ----------------------------
  // examples/arrays.ts takes and returns Int32Array / Float64Array / BigInt64Array. Checks:
  //   - the header spells a read-only array parameter `const amrit_array *` and a written one
  //     `amrit_array *`, compiles under -Werror, and a C driver passes a stack-built header
  //   - the .d.ts declares typed-array signatures, type-checks, and its companion .mjs loader
  //     marshals typed arrays into the wasm build (linked with runtime/runtime_wasm.c),
  //     copies results out, copies written parameters back, and survives a trap
  //   - the N-API addon borrows typed arrays (zero-copy, `fill` mutates in place), returns
  //     fresh typed arrays, bridges strings, and agrees with the wasm build value for value
  const arraysHeader = arrays.status === 0 ? fs.readFileSync(sidecar("arrays", "h"), "utf8") : "";
  check(
    "arrays.h: read-only array parameters are `const amrit_array *`, written ones `amrit_array *`, results `amrit_array *`",
    arraysHeader.includes("double sumF64(const amrit_array *xs);") &&
      arraysHeader.includes("void fill(amrit_array *xs, int32_t v);") &&
      arraysHeader.includes("amrit_array *scale(const amrit_array *xs, double k);") &&
      arraysHeader.includes("-- xs: int32_t elements, returns int64_t elements"),
    arraysHeader || arrays.stderr
  );
  const arraysDts = arrays.status === 0 ? fs.readFileSync(sidecar("arrays", "d.ts"), "utf8") : "";
  check(
    "arrays.d.ts declares typed-array signatures and the runtime exports",
    arraysDts.includes("  scale(xs: Float64Array, k: number): Float64Array;") &&
      arraysDts.includes("  sumI64(xs: BigInt64Array): bigint;") &&
      arraysDts.includes("  fill(xs: Int32Array, v: number): void;") &&
      arraysDts.includes("  amrit_reset_arena(): void;"),
    arraysDts || arrays.stderr
  );
  check(
    "--emit-dts writes the companion loader arrays.mjs with arena-scoped marshalling",
    fs.existsSync(sidecar("arrays", "mjs")) &&
      fs
        .readFileSync(sidecar("arrays", "mjs"), "utf8")
        .includes("raw.amrit_alloc_array(BigInt(elemSize), BigInt(value.length))"),
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
        "  amrit_array xs = {4, 4, (char *)buf}; /* a host buffer, borrowed for the calls */",
        "  int32_t before = sumI32(&xs);",
        "  fill(&xs, 5);",
        "  amrit_array *sq = squares(4); /* arena-owned */",
        '  printf("sumI32 = %d; after fill buf[3] = %d, sum %d; squares len %llu last %d\\n", before, buf[3], sumI32(&xs), (unsigned long long)sq->len, ((int32_t *)sq->data)[3]);',
        "  amrit_free_arena();",
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
      "a -Werror C driver passes a stack-built amrit_array through arrays.h and reads a returned one",
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
      console.log(
        `SKIP  Node headers not found (${path.join(nodeInclude, "node_api.h")}): arrays/strings addon build skipped`
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
  const { validateSyntax } = require(path.join(root, "dist", "validator.js"));
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
// `self/` is the compiler being written in AmritScript (docs/wp14-selfhost.md). It is
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
  for (const m of modules) {
    const out = path.join(buildDir, "self");
    fs.mkdirSync(out, { recursive: true });
    const r = spawnSync("node", [cli, path.join(selfDir, m), "-o", `${out}/`], {
      cwd: root,
      encoding: "utf8",
    });
    check(`self/${m} compiles`, r.status === 0, r.stderr);
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

  // The DWARF `producer` string is "amritc <version>" on both sides, and stage1
  // cannot read package.json to find the version, so it is a constant in
  // `self/branding.ts`. This is what stops that constant going stale: a
  // disagreement here is a byte of every `-g` module the two compilers would
  // then emit differently.
  const brandingTs = path.join(root, "self", "branding.ts");
  if (fs.existsSync(brandingTs)) {
    const branding = fs.readFileSync(brandingTs, "utf8");
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    check(
      `self/branding.ts names the CLI and version stage0 does (amritc ${pkg.version})`,
      branding.includes(`export const CLI: string = "amritc";`) &&
        branding.includes(`export const VERSION: string = "${pkg.version}";`),
      branding
        .split("\n")
        .filter((l) => l.startsWith("export const"))
        .join(" | ")
    );
  }

  // S1: the lexer built by stage0 runs natively, and its token stream agrees
  // with the `typescript` scanner's over the whole corpus. The oracle links a
  // binary, so it needs clang; without one this is skipped like every other
  // toolchain-dependent check.
  if (HAS_CLANG) {
    const oracle = spawnSync("node", [path.join(root, "tests", "lexer_oracle.js")], {
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
    // the files the oracle skips are the forbidden constructs AmritScript-0 has
    // no grammar for yet, and that count is the S2 gate's own measurement.
    const parserOracle = spawnSync("node", [path.join(root, "tests", "parser_oracle.js")], {
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
    const supportOracle = spawnSync("node", [path.join(root, "tests", "self", "support_oracle.js")], {
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

    // The other half of milestone S3: refusing the same programs for the same
    // reason. A dump comparison cannot see that, so every `reject_*` case and
    // every `tests/link/` negative is run through stage1 and its own expected
    // fragments are required of the output — the same assertion the suite
    // already makes of stage0.
    const rejectOracle = spawnSync("node", [path.join(root, "tests", "self", "reject_oracle.js")], {
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
    // past. The skips are the flags stage1 does not have (`-g`, the dumps) and
    // the one parser fixture no checker accepts.
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

    // The deployment path (docs/wp14-selfhost.md §7). The check above proves
    // the fixed point and then deletes every compiler it built; this one
    // proves the artifact: `scripts/bootstrap.sh` builds a compiler you can
    // keep, and `scripts/amritc.sh` is the command line D4 said a wrapper
    // would supply — the directory creation and the link step stage1 does not
    // do itself. One stage rather than three, because what is under test here
    // is the recipe and the wrapper, not the equalities.
    const shipDir = path.join(buildDir, "selfhost");
    fs.rmSync(shipDir, { recursive: true, force: true });
    const compiler = path.join(shipDir, "amritc");
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
      const env = { ...process.env, AMRITC: compiler };
      const wrapper = path.join(root, "scripts", "amritc.sh");

      // One module: the IR lands next to the binary as `<exe>.ll`, which is
      // where stage0's `--link` puts it too.
      const hello = path.join(shipDir, "hello");
      const one = spawnSync(
        "bash",
        [wrapper, "examples/hello.ts", "--link", hello, "--profile", "debug"],
        { cwd: root, encoding: "utf8", env }
      );
      const ranHello = one.status === 0 ? spawnSync(hello, [], { encoding: "utf8" }) : null;
      check(
        "scripts/amritc.sh: the self-hosted compiler links and runs examples/hello.ts",
        one.status === 0 &&
          fs.existsSync(`${hello}.ll`) &&
          ranHello !== null &&
          ranHello.status === 0 &&
          ranHello.stdout === "hello from AmritScript\n",
        `${one.stdout}${one.stderr}${ranHello ? `ran: ${ranHello.status} ${JSON.stringify(ranHello.stdout)}` : ""}`
      );

      // Two modules: the wrapper makes the `<exe>.modules/` directory the
      // compiler will not make for itself, and `main()` returns the exit code.
      const multi = path.join(shipDir, "multi");
      const many = spawnSync(
        "bash",
        [wrapper, "examples/multi/main.ts", "--link", multi, "--profile", "debug"],
        { cwd: root, encoding: "utf8", env }
      );
      const ranMulti = many.status === 0 ? spawnSync(multi, [], { encoding: "utf8" }) : null;
      const emitted = fs.existsSync(`${multi}.modules`)
        ? fs.readdirSync(`${multi}.modules`).filter((f) => f.endsWith(".ll")).sort()
        : [];
      check(
        "scripts/amritc.sh: a program with imports links from <exe>.modules/ and exits 49",
        many.status === 0 &&
          emitted.join(",") === "main.ll,math.ll" &&
          ranMulti !== null &&
          ranMulti.status === 49,
        `${many.stdout}${many.stderr}modules: ${emitted.join(",")}${ranMulti ? ` exit ${ranMulti.status}` : ""}`
      );

      // `-g` is stage1's now: the wrapper hands it to the compiler *and* to
      // scripts/build.sh, so the DWARF in the .ll survives the link instead of
      // being stripped with the profile. A `.debug_info` section in the linked
      // binary is the end-to-end proof; the metadata in the IR is what the
      // oracle compares byte for byte.
      const dbgExe = path.join(shipDir, "hello-g");
      const withG = spawnSync(
        "bash",
        [wrapper, "examples/hello.ts", "--link", dbgExe, "--profile", "debug", "-g"],
        { cwd: root, encoding: "utf8", env }
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
        "scripts/amritc.sh: -g reaches the compiler and the linked program carries DWARF",
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
      const ourVersion = spawnSync("bash", [wrapper, "--version"], { cwd: root, encoding: "utf8", env });
      const theirVersion = spawnSync("node", [cli, "--version"], { cwd: root, encoding: "utf8" });
      check(
        "scripts/amritc.sh: --version is the line stage0 prints",
        ourVersion.status === 0 &&
          ourVersion.stdout === theirVersion.stdout &&
          ourVersion.stdout.trim() ===
            `amritc ${JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version}`,
        `ours ${JSON.stringify(ourVersion.stdout)} theirs ${JSON.stringify(theirVersion.stdout)}`
      );

      // `--json` is the editor-facing diagnostic shape, and an editor pointed
      // at either compiler must get the same bytes: same objects, same order,
      // same spans. A multi-error program is the case worth pinning, because
      // it is also the one that proves stage1 collected every error rather
      // than stopping at the first.
      const jsonCase = path.join("tests", "cases", "reject_multi_error.ts");
      const ourJson = spawnSync("bash", [wrapper, jsonCase, "--json"], { cwd: root, encoding: "utf8", env });
      const theirJson = spawnSync("node", [cli, jsonCase, "--json"], { cwd: root, encoding: "utf8" });
      check(
        "scripts/amritc.sh: --json diagnostics are byte-identical to stage0's",
        ourJson.status === 1 &&
          theirJson.status === 1 &&
          ourJson.stdout === theirJson.stdout &&
          ourJson.stdout.split("\n").filter(Boolean).length === 3,
        `ours:\n${ourJson.stdout}${ourJson.stderr}\ntheirs:\n${theirJson.stdout}`
      );

      // `--emit-checked` through the driver, rather than through the
      // `dump_checked` entry the oracle spawns: the same text has to come out
      // of both, which is why one `self/dump.ts` writes it for both. The
      // attribute pass's lines are dropped on stage0's side exactly as
      // `tests/self/checked_oracle.js` drops them.
      const laterPhases = /^ {2}(facts:|escaping:|calls:|pointer |stackSites)/;
      const checkerLines = (text) => text.split("\n").filter((l) => l.length > 0 && !laterPhases.test(l));
      const dumpCase = path.join("examples", "multi", "main.ts");
      const ourDump = spawnSync("bash", [wrapper, dumpCase, "--emit-checked"], { cwd: root, encoding: "utf8", env });
      const theirDump = spawnSync("node", [cli, dumpCase, "--emit-checked"], { cwd: root, encoding: "utf8" });
      check(
        "scripts/amritc.sh: --emit-checked dumps a whole program as stage0 dumps it",
        ourDump.status === 0 &&
          theirDump.status === 0 &&
          checkerLines(ourDump.stdout).join("\n") === checkerLines(theirDump.stdout).join("\n") &&
          ourDump.stdout.includes("module examples/multi/main.ts (entry)"),
        `ours:\n${ourDump.stdout}${ourDump.stderr}\ntheirs:\n${theirDump.stdout}`
      );

      // The mechanism is still there for the flags that *are* stage0's: one of
      // them refused by name rather than quietly ignored, because a build that
      // asked for a sidecar must not come out without it. `--emit-ast` is the
      // one that stays stage0's on purpose rather than for now: its dump
      // prints the `typescript` package's node names and line:column spans,
      // and stage1's tree is the flattened one `self/nodes.ts` defines, so
      // matching it would be imitation rather than parity.
      const refused = spawnSync(
        "bash",
        [wrapper, "examples/hello.ts", "--emit-ast"],
        { cwd: root, encoding: "utf8", env }
      );
      check(
        "scripts/amritc.sh: --emit-ast is refused by name, not ignored (D4)",
        refused.status === 2 && refused.stderr.includes("is stage0's"),
        `${refused.status}: ${refused.stdout}${refused.stderr}`
      );

      // The interop sidecars are stage1's, so the wrapper passes them through
      // and supplies for them the one thing D4 kept out of the compiler: the
      // directory. The bytes themselves are the interop oracle's business.
      const sidecarDir = path.join(shipDir, "interop");
      const sidecarFiles = ["add.h", "add.d.ts", "add.mjs", "add.napi.c"];
      const sidecars = spawnSync(
        "bash",
        [
          wrapper,
          "examples/add.ts",
          "-o", path.join(shipDir, "add.ll"),
          "--emit-header", path.join(sidecarDir, "add.h"),
          "--emit-dts", path.join(sidecarDir, "add.d.ts"),
          "--emit-napi", path.join(sidecarDir, "add.napi.c"),
        ],
        { cwd: root, encoding: "utf8", env }
      );
      const wrote = sidecarFiles.filter((f) => fs.existsSync(path.join(sidecarDir, f)));
      const selfHeader = wrote.includes("add.h")
        ? fs.readFileSync(path.join(sidecarDir, "add.h"), "utf8")
        : "";
      check(
        "scripts/amritc.sh: the interop sidecars are passed through and their directory made",
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
        "bash",
        [wrapper, "examples/hello.ts", "--number-mode", "f32", "-o", path.join(shipDir, "unused.ll")],
        { cwd: root, encoding: "utf8", env }
      );
      const badMode0 = spawnSync(
        "node",
        [cli, "examples/hello.ts", "--number-mode", "f32", "-o", path.join(shipDir, "unused0.ll")],
        { cwd: root, encoding: "utf8" }
      );
      check(
        "scripts/amritc.sh: an unknown --number-mode is refused, as stage0 refuses it",
        badMode.status === 2 &&
          badMode0.status === 2 &&
          !fs.existsSync(path.join(shipDir, "unused.ll")),
        `stage1 ${badMode.status}: ${badMode.stderr}stage0 ${badMode0.status}: ${badMode0.stderr}`
      );

      // Every positional is a root, as it is for stage0. Before this the last
      // one won and the others were compiled into nothing.
      const rootsDir = path.join(shipDir, "roots");
      const roots = spawnSync(
        "bash",
        [wrapper, "examples/hello.ts", "examples/add.ts", "-o", `${rootsDir}/`],
        { cwd: root, encoding: "utf8", env }
      );
      const rootsWrote = fs.existsSync(rootsDir) ? fs.readdirSync(rootsDir).sort() : [];
      check(
        "scripts/amritc.sh: every file named on the command line is a root",
        roots.status === 0 && rootsWrote.join(",") === "add.ll,hello.ll",
        `${roots.status}: ${roots.stdout}${roots.stderr}wrote: ${rootsWrote.join(",")}`
      );

      // stdout carries the IR and the `--json` diagnostics and nothing else,
      // so `wrote <file>` goes to stderr where stage0 puts it. A build script
      // that pipes the IR somewhere must not find chatter mixed into it.
      const chatterDir = path.join(shipDir, "chatter");
      const chatter = spawnSync(
        "bash",
        [wrapper, "examples/hello.ts", "-o", `${chatterDir}/`],
        { cwd: root, encoding: "utf8", env }
      );
      const chatter0 = spawnSync(
        "node",
        [cli, "examples/hello.ts", "-o", `${path.join(shipDir, "chatter0")}/`],
        { cwd: root, encoding: "utf8" }
      );
      check(
        "scripts/amritc.sh: `wrote <file>` goes to stderr, as stage0 writes it",
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
        "bash",
        [wrapper, path.join(shipDir, "no_such_file.ts"), "-o", path.join(shipDir, "nope.ll")],
        { cwd: root, encoding: "utf8", env }
      );
      const missingJson = spawnSync(
        "bash",
        [wrapper, path.join(shipDir, "no_such_file.ts"), "--json", "-o", path.join(shipDir, "nope.ll")],
        { cwd: root, encoding: "utf8", env }
      );
      let missingObject = null;
      try {
        missingObject = JSON.parse(missingJson.stdout.trim());
      } catch {}
      check(
        "scripts/amritc.sh: an unreadable root exits 1 and --json makes it an object",
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
        "bash",
        [wrapper, "tests/link/no_main/main.ts", "--link", path.join(shipDir, "no_main"), "--profile", "debug"],
        { cwd: root, encoding: "utf8", env }
      );
      const noMain0 = spawnSync(
        "node",
        [cli, "tests/link/no_main/main.ts", "--link", path.join(shipDir, "no_main0")],
        { cwd: root, encoding: "utf8" }
      );
      check(
        "scripts/amritc.sh: --link without `export function main` is refused, as stage0 refuses it",
        noMain.status === 1 &&
          noMain.stderr.includes("export function main") &&
          noMain0.status === 1 &&
          noMain0.stderr.includes("export function main"),
        `stage1 ${noMain.status}: ${noMain.stderr}stage0 ${noMain0.status}: ${noMain0.stderr}`
      );

      // An unknown profile refused before the compile rather than after it, as
      // stage0 validates `PROFILES` before it reads a file.
      const badProfile = spawnSync(
        "bash",
        [wrapper, "examples/hello.ts", "--link", path.join(shipDir, "bad"), "--profile", "turbo"],
        { cwd: root, encoding: "utf8", env }
      );
      check(
        "scripts/amritc.sh: an unknown --profile is refused before anything is compiled",
        badProfile.status === 2 && badProfile.stderr.includes("unknown profile"),
        `${badProfile.status}: ${badProfile.stdout}${badProfile.stderr}`
      );

      // `-o <dir>/` writes into the directory it was given; it does not empty
      // it first. The wrapper used to `rm -rf` the caller's directory before
      // the compile, which for `-o build/` took the rest of `build/` with it.
      const keepDir = path.join(shipDir, "keep");
      fs.mkdirSync(keepDir, { recursive: true });
      fs.writeFileSync(path.join(keepDir, "keep.txt"), "not the compiler's\n");
      const keep = spawnSync(
        "bash",
        [wrapper, "examples/hello.ts", "-o", `${keepDir}/`],
        { cwd: root, encoding: "utf8", env }
      );
      check(
        "scripts/amritc.sh: -o <dir>/ writes into the directory, it does not clear it",
        keep.status === 0 &&
          fs.existsSync(path.join(keepDir, "keep.txt")) &&
          fs.existsSync(path.join(keepDir, "hello.ll")),
        `${keep.status}: ${keep.stdout}${keep.stderr}`
      );
    }
  } else {
    // Everything from the lexer oracle down links a stage1 binary, so without
    // clang none of it runs. Say so: the WP14 block is the self-hosting proof,
    // and a run that quietly leaves it out reports the 55 compile-gate passes
    // above as though the fixed point had been checked. WP12 and WP13 print
    // their skip for the same reason.
    console.log("SKIP  clang not installed: the self-hosting oracles and the bootstrap are skipped");
  }
}

// ---- WP9: bench --------------------------------------------------------------------
// The benchmark programs in bench/ must keep printing identical checksums across
// AmritScript, C and (when rustc is installed) Rust. `bench/run.mjs --validate` builds
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
      "bench: fib(25) and sieve(1e5) print the same checksum from AmritScript, C and Rust (Rust skipped without rustc)",
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
  const nswLl = path.join(buildDir, "opt_nsw.ll");
  if (fs.existsSync(nswLl)) {
    const ir = fs.readFileSync(nswLl, "utf8");
    // User-level i32 arithmetic: flagged. Compiler-internal i64 index/length arithmetic and the allocator: never.
    const userOps = [...ir.matchAll(/= (add|sub|mul)( nsw)? i32 /g)];
    const internalOps = [...ir.matchAll(/= (add|sub|mul)( nsw)? i64 /g)];
    check(
      `opt_nsw: every user-level i32 add/sub/mul carries nsw (${userOps.length} ops) and no internal i64 op does (${internalOps.length} ops)`,
      // Since WP6 stack-allocates the case's arrays there may be no internal i64 arithmetic at all.
      userOps.length >= 10 &&
        userOps.every((m) => m[2] === " nsw") &&
        internalOps.every((m) => m[2] === undefined),
      ir
    );
    const plainIr = fs.readFileSync(path.join(buildDir, "cf_fib.ll"), "utf8");
    check("without --nsw no instruction carries nsw (cf_fib)", !plainIr.includes("nsw"), plainIr);
  }
}

// ---- WP12: exit codes --------------------------------------------------------------
// The CLI's contract (docs/wp12-release.md): 0 ok, 1 compile error, 2 usage, 3 toolchain,
// 70 internal compiler error. Each failure mode is driven from outside the compiler:
// AMRITC_SIMULATE_ICE=1 is the test hook for the ICE path, an empty PATH stands in
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
    `--version prints "amritc ${pkgVersion}" and exits 0`,
    v.status === 0 && v.stdout.trim() === `amritc ${pkgVersion}`,
    v.stdout + v.stderr
  );

  const noInputs = run([]);
  check(
    "no inputs: usage on stderr, exit 2",
    noInputs.status === 2 && noInputs.stderr.includes("usage: amritc"),
    noInputs.stderr
  );
  const badFlag = run(["--bogus", entry]);
  check(
    "unknown flag: names it, exit 2",
    badFlag.status === 2 && badFlag.stderr.includes("unknown option: --bogus"),
    badFlag.stderr
  );
  const noValue = run([entry, "-o"]);
  check("-o without a value: exit 2", noValue.status === 2, noValue.stderr);

  const missing = run(["does-not-exist.ts"]);
  check(
    "missing input file: one-line ENOENT message, exit 1",
    missing.status === 1 &&
      missing.stderr.includes("ENOENT") &&
      !missing.stderr.includes("internal compiler error"),
    missing.stderr
  );

  const ice = run([entry, "-o", path.join(wp12Dir, "ice.ll")], { AMRITC_SIMULATE_ICE: "1" });
  check(
    "internal error: exit 70, names the file, asks for a bug report, no stack trace",
    ice.status === 70 &&
      ice.stderr.includes("internal compiler error while compiling " + entry) &&
      ice.stderr.includes("TypeError: simulated internal compiler error") &&
      ice.stderr.includes("github.com/amritk/compiler/issues") &&
      ice.stderr.includes("AMRITC_DEBUG=1") &&
      !/^\s+at /m.test(ice.stderr),
    ice.stderr
  );
  const iceDebug = run([entry, "-o", path.join(wp12Dir, "ice.ll")], {
    AMRITC_SIMULATE_ICE: "1",
    AMRITC_DEBUG: "1",
  });
  check(
    "internal error with AMRITC_DEBUG=1: exit 70 and the stack trace is printed",
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
// `runtime/amritc.d.ts` is what makes an AmritScript program legal TypeScript to
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
  const declarations = path.join(root, "runtime", "amritc.d.ts");
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
  check("runtime/amritc.d.ts type-checks under tsc --strict", own.ok, own.output);

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
    "tsc refuses `r.value` before the discriminant test, exactly as amritc does",
    !refused.ok && refused.output.includes("Property 'value' does not exist"),
    refused.output
  );
}

// ---- WP12: package ------------------------------------------------------------------
// The npm tarball must be self-contained: `npm pack`, install it into a temporary prefix,
// and drive the installed `amritc` from an unrelated directory. That proves the `files`
// whitelist ships runtime/runtime.c, runtime/amritc.h and scripts/build.sh, and that the
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
      /^README\.md$/,
      /^LICENSE$/,
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
      "runtime/amritc.h",
      "runtime/amritc.d.ts",
      "scripts/build.sh",
      "LICENSE",
      "docs/INSTALL.md",
    ];
    const absent = required.filter((f) => !files.includes(f));
    check(
      "npm pack includes everything --link needs (runtime.c, amritc.h, amritc.d.ts, build.sh) plus LICENSE/INSTALL.md",
      absent.length === 0,
      absent.join("\n")
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
      console.log("SKIP  package install + --link from another cwd (clang not found)");
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
        const bin = path.join(prefix, "node_modules", ".bin", "amritc");
        const work = path.join(pkgDir, "elsewhere");
        fs.mkdirSync(work, { recursive: true });
        fs.writeFileSync(
          path.join(work, "hello.ts"),
          'export function main(): number {\n  console.log("hello from a global install");\n  return 0;\n}\n'
        );
        const ver = spawnSync(bin, ["--version"], { cwd: work, encoding: "utf8" });
        check(
          "installed amritc --version works from an unrelated cwd",
          ver.status === 0 && ver.stdout.trim() === `amritc ${info.version}`,
          ver.stdout + ver.stderr
        );
        const link = spawnSync(bin, ["hello.ts", "--link", "hello"], { cwd: work, encoding: "utf8" });
        check(
          "installed amritc hello.ts --link works from an unrelated cwd",
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
          "installed amritc compiles examples/add.ts to IR from an unrelated cwd",
          ir.status === 0 && fs.existsSync(path.join(work, "add.ll")),
          ir.stderr
        );
      }
    }
  }
}

// ---- WP13: differential -------------------------------------------------------------
// Every whole program in tests/cases and tests/differential/corpus is compiled, linked,
// and run natively, then rewritten to JavaScript (tests/differential/rewrite.js, types
// from the compiler's own checker) and run under Node with runtime/shim.mjs; stdout and
// exit status must agree byte for byte. Discrepancies listed in known-failures.txt are
// reported but do not fail. A 10-program fuzz batch with a fixed seed runs too; the seed
// is printed so a failure reproduces with `node tests/differential/fuzz.js --seed <s> --count 1`.
if ((!only || "differential".includes(only)) && HAS_CLANG) {
  const diffRunner = path.join(__dirname, "differential", "run.js");
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

  const fuzzSeed = 20260906;
  const f = spawnSync(
    "node",
    [path.join(__dirname, "differential", "fuzz.js"), "--seed", String(fuzzSeed), "--count", "10"],
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
  console.log("SKIP  clang not installed: differential tests skipped");
}

console.log(`\n${passes} passed, ${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
