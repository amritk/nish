#!/usr/bin/env node
/**
 * Differential test runner (WP13): every whole program in tests/cases (those
 * with `export function main` and no `.err`) and tests/differential/corpus is
 *
 *   1. compiled and linked with nish (`.args` respected), run, stdout and
 *      exit status captured;
 *   2. taken as the JavaScript its frozen rewrite in tests/differential/goldens/
 *      holds, and run under Node with runtime/shim.mjs, stdout and exit
 *      status captured;
 *   3. compared byte for byte.
 *
 * Usage: node tests/differential/run.js [--only <substring>] [--jobs N]
 *          [--update-known] [--quick] [--corpus-only] [--cases-only] [--verbose]
 *          [--compiler <nish>]
 *
 *   --only <s>       run only programs whose name contains <s>
 *   --jobs N         parallel builds (default: CPU count, max 8)
 *   --update-known   rewrite known-failures.txt with the current mismatches
 *   --quick          skip corpus programs named slow_* (the tests/run.js budget)
 *   --verbose        print both outputs of every mismatch
 *   --compiler <p>   the compiler the native half is built with (default: the
 *                    seed, `NISH_BOOTSTRAP` then build/nish)
 *   --frozen         accepted and ignored: the frozen rewrites are the only
 *                    JavaScript there is since the rewriter went with stage0
 *                    (R6), and `tests/run.js` still spells it
 *
 * Exit status is non-zero when any program mismatches, fails to compile, or
 * fails to rewrite, unless it is listed in known-failures.txt (one name per
 * line, `#` comments). A listed program that now matches is reported as XPASS
 * and does not fail the run; remove it from the list.
 *
 * **A stale frozen rewrite is the one outcome no list may excuse.** It means
 * the run could have compared today's binary against the JavaScript of a source
 * that has since changed, and printed a verdict either way; `known-failures.txt`
 * covers decisions about the language, not references that have rotted.
 *
 * A program named in `tests/differential/goldens/unfrozen.txt` has no frozen
 * rewrite at all. It is not built, not counted as agreeing, and not a
 * failure: it is printed as UNFROZEN with the register's reason, and the
 * summary says how many there were.
 */
import fs from "node:fs";
import os from "node:os";
import * as lib from "./lib.js";

async function main(argv) {
  let only;
  let jobs = Math.min(8, os.cpus().length || 2);
  let updateKnown = false;
  let quick = false;
  let verbose = false;
  let cases = true;
  let corpus = true;
  let compilerSpec;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--only") only = argv[++i];
    else if (a === "--jobs") jobs = Number(argv[++i]);
    else if (a === "--update-known") updateKnown = true;
    else if (a === "--quick") quick = true;
    else if (a === "--verbose") verbose = true;
    else if (a === "--corpus-only") cases = false;
    else if (a === "--cases-only") corpus = false;
    else if (a === "--frozen") continue;
    else if (a === "--live") {
      console.error("--live: the live rewriter drove stage0's checker and was deleted with it (R6)");
      return 2;
    }
    else if (a === "--compiler") compilerSpec = argv[++i];
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
  // The two halves of the comparison, each resolved once and named in the run's
  // first line: the compiler `--compiler` or the seed protocol answers, and the
  // frozen store (WP19 G2.4, R6).
  const compiler = lib.compilerFor(compilerSpec);
  if (compiler.error !== undefined) {
    console.error(compiler.error);
    return 2;
  }
  const rewriter = lib.rewriterFor();
  if (rewriter.error !== undefined) {
    console.error(rewriter.error);
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
  console.log(`native: ${compiler.label}    node: ${rewriter.label}`);
  const results = await lib.pool(programs, jobs, (p) => lib.runProgram(p, { compiler, rewriter }));

  const width = Math.max(...programs.map((p) => p.name.length));
  const pad = (s, n) => s + " ".repeat(Math.max(0, n - s.length));
  console.log(`${pad("program", width)}  ${pad("native", 18)}  ${pad("node", 18)}  ${pad("time", 7)}  result`);
  console.log("-".repeat(width + 2 + 18 + 2 + 18 + 2 + 7 + 2 + 10));

  let failures = 0;
  let stale = 0;
  let unfrozen = 0;
  const mismatches = [];
  for (const r of results) {
    const isKnown = known.has(r.prog.name);
    let result;
    if (r.verdict === "unfrozen") {
      // Named rather than dropped, and ahead of the known-failures test: the
      // register is the record that this program is compared against nothing.
      result = "UNFROZEN (no frozen rewrite; tests/differential/goldens/unfrozen.txt)";
      unfrozen++;
    } else if (r.verdict === "stale-golden") {
      // Deliberately ahead of the known-failures test: a rotted reference is
      // not a documented semantic difference, and counting it as one is how a
      // frozen oracle comes to look like coverage it no longer has.
      result = "STALE";
      failures++;
      stale++;
    } else if (r.verdict === "match") result = isKnown ? "XPASS (remove from known-failures.txt)" : "ok";
    else if (isKnown) result = `KNOWN ${r.verdict}`;
    else {
      result = r.verdict.toUpperCase();
      failures++;
    }
    // `--update-known` writes this list, and `known-failures.txt` holds
    // decisions about the language rather than references that have rotted, so
    // a STALE program must not be able to arrive in it.
    if (r.verdict !== "match" && r.verdict !== "stale-golden" && r.verdict !== "unfrozen") {
      mismatches.push(r.prog.name);
    }
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
    } else if (r.verdict === "stale-golden") {
      console.log(indent(r.detail));
      console.log(indent("`node tests/differential/goldens.js --update` moves it into the register"));
    } else if (r.verdict === "unfrozen") {
      console.log(indent(r.detail));
    }
  }

  const matched = results.filter((r) => r.verdict === "match").length;
  // The summary line's shape is the one it had while a live rewriter existed,
  // so the runs before and after R6 read side by side. A registered program is
  // out of the denominator, because nothing compared it, and named just below.
  console.log(
    `\n${matched}/${results.length - unfrozen} programs agree with Node (${((Date.now() - t0) / 1000).toFixed(1)} s, ${jobs} jobs); ${failures} unexpected failure(s).`
  );
  if (unfrozen > 0) {
    console.log(`${unfrozen} program(s) have no frozen rewrite and were not compared (tests/differential/goldens/unfrozen.txt).`);
  }
  if (stale > 0) {
    console.log(
      `${stale} program(s) compared against nothing: their frozen rewrite is stale or missing and was not used.`
    );
  }

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
