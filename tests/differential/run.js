#!/usr/bin/env node
/**
 * Differential test runner (WP13): every whole program in tests/cases (those
 * with `export function main` and no `.err`) and tests/differential/corpus is
 *
 *   1. compiled and linked with amritc (`.args` respected), run, stdout and
 *      exit status captured;
 *   2. rewritten to JavaScript (rewrite.js) and run under Node with
 *      runtime/shim.mjs, stdout and exit status captured;
 *   3. compared byte for byte.
 *
 * Usage: node tests/differential/run.js [--only <substring>] [--jobs N]
 *          [--update-known] [--quick] [--corpus-only] [--cases-only] [--verbose]
 *
 *   --only <s>       run only programs whose name contains <s>
 *   --jobs N         parallel builds (default: CPU count, max 8)
 *   --update-known   rewrite known-failures.txt with the current mismatches
 *   --quick          skip corpus programs named slow_* (the tests/run.js budget)
 *   --verbose        print both outputs of every mismatch
 *
 * Exit status is non-zero when any program mismatches, fails to compile, or
 * fails to rewrite, unless it is listed in known-failures.txt (one name per
 * line, `#` comments). A listed program that now matches is reported as XPASS
 * and does not fail the run; remove it from the list.
 */
const fs = require("node:fs");
const os = require("node:os");
const lib = require("./lib");

async function main(argv) {
  let only;
  let jobs = Math.min(8, os.cpus().length || 2);
  let updateKnown = false;
  let quick = false;
  let verbose = false;
  let cases = true;
  let corpus = true;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--only") only = argv[++i];
    else if (a === "--jobs") jobs = Number(argv[++i]);
    else if (a === "--update-known") updateKnown = true;
    else if (a === "--quick") quick = true;
    else if (a === "--verbose") verbose = true;
    else if (a === "--corpus-only") cases = false;
    else if (a === "--cases-only") corpus = false;
    else if (!a.startsWith("-") && only === undefined) only = a;
    else {
      console.error(`unknown option: ${a}`);
      return 2;
    }
  }
  if (!lib.hasClang()) {
    console.error("clang not installed: differential tests need a native toolchain");
    return 2;
  }
  if (!fs.existsSync(`${lib.root}/dist/index.js`)) {
    console.error("dist/index.js missing: run `npm run build` first");
    return 2;
  }

  let programs = lib.discoverPrograms({ cases, corpus });
  if (only) programs = programs.filter((p) => p.name.includes(only));
  if (quick) programs = programs.filter((p) => !p.name.startsWith("corpus/slow_"));
  if (programs.length === 0) {
    console.error("no programs selected");
    return 2;
  }
  const known = lib.readKnownFailures();

  const t0 = Date.now();
  const results = await lib.pool(programs, jobs, (p) => lib.runProgram(p));

  const width = Math.max(...programs.map((p) => p.name.length));
  const pad = (s, n) => s + " ".repeat(Math.max(0, n - s.length));
  console.log(`${pad("program", width)}  ${pad("native", 18)}  ${pad("node", 18)}  ${pad("time", 7)}  result`);
  console.log("-".repeat(width + 2 + 18 + 2 + 18 + 2 + 7 + 2 + 10));

  let failures = 0;
  const mismatches = [];
  for (const r of results) {
    const isKnown = known.has(r.prog.name);
    let result;
    if (r.verdict === "match") result = isKnown ? "XPASS (remove from known-failures.txt)" : "ok";
    else if (isKnown) result = `KNOWN ${r.verdict}`;
    else {
      result = r.verdict.toUpperCase();
      failures++;
    }
    if (r.verdict !== "match") mismatches.push(r.prog.name);
    console.log(
      `${pad(r.prog.name, width)}  ${pad(lib.summarize(r.native), 18)}  ${pad(lib.summarize(r.node), 18)}  ${pad(`${r.ms} ms`, 7)}  ${result}`
    );
    if (r.verdict === "mismatch") {
      for (const line of lib.describeMismatch(r).split("\n")) console.log(`      ${line}`);
      if (verbose) {
        console.log(`      --- native stdout\n${indent(String(r.native.stdout))}`);
        console.log(`      --- node stdout\n${indent(String(r.node.stdout))}`);
        if (r.node.stderr.length > 0) console.log(`      --- node stderr\n${indent(String(r.node.stderr))}`);
      }
    } else if (r.verdict === "compile-error" || r.verdict === "rewrite-error") {
      console.log(indent(r.detail.trim().split("\n").slice(0, 8).join("\n")));
    }
  }

  const matched = results.filter((r) => r.verdict === "match").length;
  console.log(
    `\n${matched}/${results.length} programs agree with Node (${((Date.now() - t0) / 1000).toFixed(1)} s, ${jobs} jobs); ${failures} unexpected failure(s).`
  );

  if (updateKnown) {
    const header = [
      "# Programs whose native output is known to differ from Node (or that fail to build).",
      "# One program name per line; `#` starts a comment. Each entry is a bug documented",
      "# in docs/wp13-differential.md. Regenerate with: node tests/differential/run.js --update-known",
    ];
    fs.writeFileSync(lib.knownFile, `${[...header, ...mismatches].join("\n")}\n`);
    console.log(`wrote ${mismatches.length} entr${mismatches.length === 1 ? "y" : "ies"} to ${lib.knownFile}`);
  }
  return failures === 0 ? 0 : 1;
}

function indent(s) {
  return s
    .split("\n")
    .map((l) => `      ${l}`)
    .join("\n");
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e) => {
    console.error(e);
    process.exit(2);
  }
);
