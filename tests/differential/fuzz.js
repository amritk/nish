#!/usr/bin/env node
/**
 * Random-program fuzzer for the differential harness (WP13).
 *
 * Generates straight-line Nish programs over 32-bit integers and
 * booleans: locals, `+ - * / %` (divisors go through `nz(x)`, which maps any
 * value into [2, 1001], so no division by zero and no INT_MIN / -1), unary
 * minus, `Math.abs/min/max`, comparisons, `&&`/`||`/`!`, ternaries, `++`/`--`
 * (prefix and postfix, also inside expressions for their side effects),
 * compound assignment, `if`/`else`, a few `for`/`while` loops with fixed trip
 * counts, helper functions, and `console.log` of numbers, booleans, and
 * template literals. Every program is deterministic and prints its locals at
 * the end.
 *
 * The generator feeds two comparisons, and they are independent:
 *
 *   - the default mode (WP13) builds each program natively and runs the same
 *     program under Node through the rewrite (lib.js), and compares stdout,
 *     exit status and signal;
 *   - `--stage1` (WP14) compiles each program with stage0 *and* with the
 *     self-hosted compiler and compares the emitted IR byte for byte, module
 *     set included, reusing the build and comparison of
 *     `tests/self/ir_oracle.js`. The stage1 binary is linked once per run.
 *
 * Usage: node tests/differential/fuzz.js [--count N] [--seed S] [--jobs J] [--depth D]
 *        node tests/differential/fuzz.js --stage1 [--count N] [--seed S] [--depth D]
 *
 * Program i of a run uses seed S + i; a mismatching program is saved as
 * build/test/differential/fuzz-fail-<S + i>.ts (`fuzz-stage1-fail-<S + i>.ts`
 * in stage1 mode) and reproduces with
 * `node tests/differential/fuzz.js [--stage1] --seed <S + i> --count 1`.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as lib from "./lib.js";
import * as irOracle from "../self/ir_oracle.js";
import ts from "typescript";
import { fileURLToPath } from "node:url";

/** mulberry32: small, seedable, good enough for program shapes. */
function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (xs) => xs[Math.floor(next() * xs.length)],
    chance: (p) => next() < p,
  };
}

const LITERALS = [0, 1, -1, 2, 3, 7, 10, 100, 1000, 65536, 46341, 1000000000, 2147483647, -2147483647, 2147483646];

/** Build one program from a seed; returns its source text. */
function buildProgram(seed, label, opts = {}) {
  const r = rng(seed);
  const maxDepth = opts.depth ?? 3;
  const nLocals = r.int(3, 6);
  const nBools = r.int(1, 3);
  const helpers = r.int(1, 3);
  const locals = Array.from({ length: nLocals }, (_, i) => `v${i}`);
  const bools = Array.from({ length: nBools }, (_, i) => `b${i}`);

  const literal = () => {
    const v = r.chance(0.6) ? r.pick(LITERALS) : r.int(-2147483647, 2147483647);
    return v < 0 ? `(${v})` : String(v);
  };

  /**
   * Integer expression. `env` lists readable int names, `mutable` those `++` may
   * touch, `boolEnv` the boolean locals already declared, `callable` how many
   * helpers (`h0..h<callable-1>`) may be called.
   */
  let boolEnv = [];
  let callable = 0;
  function intExpr(d, env, mutable) {
    if (d <= 0 || r.chance(0.2)) {
      return env.length > 0 && r.chance(0.6) ? r.pick(env) : literal();
    }
    const sub = () => intExpr(d - 1, env, mutable);
    switch (r.int(0, 13)) {
      case 0:
        return `(${sub()} + ${sub()})`;
      case 1:
        return `(${sub()} - ${sub()})`;
      case 2:
        return `(${sub()} * ${sub()})`;
      case 3:
        return `(${sub()} / nz(${sub()}))`;
      case 4:
        return `(${sub()} % nz(${sub()}))`;
      case 5:
        return `(-(${sub()}))`; // the inner parens keep `-` and `--x` from fusing into `---x`
      case 6:
        return `Math.abs(${sub()})`;
      case 7:
        return `Math.min(${sub()}, ${sub()})`;
      case 8:
        return `Math.max(${sub()}, ${sub()})`;
      case 9:
        return `(${boolExpr(d - 1, env, mutable)} ? ${sub()} : ${sub()})`;
      case 10:
        // Helpers may only call lower-numbered helpers, so there is no recursion.
        if (callable > 0) return `h${r.int(0, callable - 1)}(${sub()}, ${sub()})`;
        return sub();
      case 11:
        if (mutable.length > 0) return `${r.pick(mutable)}${r.pick(["++", "--"])}`;
        return sub();
      case 12:
        if (mutable.length > 0) return `${r.pick(["++", "--"])}${r.pick(mutable)}`;
        return sub();
      default:
        return `(${sub()} - ${literal()})`;
    }
  }

  function boolExpr(d, env, mutable) {
    const sub = () => intExpr(d, env, mutable);
    if (d <= 0 || r.chance(0.15)) {
      if (boolEnv.length > 0 && r.chance(0.5)) return r.pick(boolEnv);
      return r.pick(["true", "false"]);
    }
    switch (r.int(0, 8)) {
      case 0:
        return `(${sub()} < ${sub()})`;
      case 1:
        return `(${sub()} <= ${sub()})`;
      case 2:
        return `(${sub()} > ${sub()})`;
      case 3:
        return `(${sub()} >= ${sub()})`;
      case 4:
        return `(${sub()} === ${sub()})`;
      case 5:
        return `(${sub()} !== ${sub()})`;
      case 6:
        return `(${boolExpr(d - 1, env, mutable)} && ${boolExpr(d - 1, env, mutable)})`;
      case 7:
        return `(${boolExpr(d - 1, env, mutable)} || ${boolExpr(d - 1, env, mutable)})`;
      default:
        return `!${boolExpr(d - 1, env, mutable)}`;
    }
  }

  const lines = [];
  lines.push("// Generated by tests/differential/fuzz.js; seed " + label);
  lines.push("function nz(x: number): number {");
  lines.push("  let r = x % 1000;");
  lines.push("  if (r < 0) {");
  lines.push("    r = -r;");
  lines.push("  }");
  lines.push("  return r + 2;");
  lines.push("}");
  for (let h = 0; h < helpers; h++) {
    callable = h;
    lines.push("");
    lines.push(`function h${h}(a: number, b: number): number {`);
    if (r.chance(0.5)) {
      lines.push(`  if (${boolExpr(2, ["a", "b"], [])}) {`);
      lines.push(`    return ${intExpr(maxDepth - 1, ["a", "b"], [])};`);
      lines.push("  }");
    }
    lines.push(`  return ${intExpr(maxDepth - 1, ["a", "b"], [])};`);
    lines.push("}");
  }
  lines.push("");
  lines.push("export function main(): number {");
  callable = helpers;
  for (const v of locals) lines.push(`  let ${v} = ${literal()};`);
  for (const b of bools) {
    lines.push(`  let ${b} = ${boolExpr(2, locals, [])};`);
    boolEnv = [...boolEnv, b];
  }

  let loopId = 0;
  function statement(indent, env, mutable, depth) {
    const pad = " ".repeat(indent);
    const target = r.pick(locals);
    switch (r.int(0, 11)) {
      case 0:
      case 1:
        lines.push(`${pad}${target} = ${intExpr(maxDepth, env, mutable)};`);
        break;
      case 2:
        lines.push(`${pad}${target} ${r.pick(["+=", "-=", "*="])} ${intExpr(maxDepth - 1, env, mutable)};`);
        break;
      case 3:
        lines.push(`${pad}${target} ${r.pick(["/=", "%="])} nz(${intExpr(maxDepth - 1, env, mutable)});`);
        break;
      case 4:
        lines.push(`${pad}${r.pick(bools)} = ${boolExpr(maxDepth - 1, env, mutable)};`);
        break;
      case 5:
        lines.push(`${pad}${target}${r.pick(["++", "--"])};`);
        break;
      case 6:
        lines.push(`${pad}console.log(${intExpr(maxDepth, env, mutable)});`);
        break;
      case 7:
        lines.push(`${pad}console.log(${boolExpr(maxDepth - 1, env, mutable)});`);
        break;
      case 8:
        lines.push(`${pad}console.log(\`${target}=\${${target}} ${r.pick(bools)}=\${${r.pick(bools)}} e=\${${intExpr(1, env, mutable)}}\`);`);
        break;
      case 9:
        if (depth > 0) {
          lines.push(`${pad}if (${boolExpr(maxDepth - 1, env, mutable)}) {`);
          statement(indent + 2, env, mutable, depth - 1);
          lines.push(`${pad}} else {`);
          statement(indent + 2, env, mutable, depth - 1);
          lines.push(`${pad}}`);
        } else lines.push(`${pad}${target} = ${intExpr(2, env, mutable)};`);
        break;
      case 10:
        if (depth > 0) {
          const i = `i${loopId++}`;
          lines.push(`${pad}for (let ${i} = 0; ${i} < ${r.int(1, 8)}; ${i}++) {`);
          statement(indent + 2, [...env, i], mutable, depth - 1);
          if (r.chance(0.5)) statement(indent + 2, [...env, i], mutable, depth - 1);
          lines.push(`${pad}}`);
        } else lines.push(`${pad}${target} = ${intExpr(2, env, mutable)};`);
        break;
      default:
        if (depth > 0) {
          const c = `c${loopId++}`;
          lines.push(`${pad}let ${c} = ${r.int(1, 6)};`);
          lines.push(`${pad}while (${c} > 0) {`);
          statement(indent + 2, [...env, c], mutable, depth - 1);
          if (r.chance(0.3)) {
            lines.push(`${pad}  if (${boolExpr(1, env, [])}) {`);
            lines.push(`${pad}    ${c}--;`);
            lines.push(`${pad}    continue;`);
            lines.push(`${pad}  }`);
          }
          lines.push(`${pad}  ${c}--;`);
          lines.push(`${pad}}`);
        } else lines.push(`${pad}${target} = ${intExpr(2, env, mutable)};`);
        break;
    }
  }
  const nStatements = r.int(8, 16);
  for (let s = 0; s < nStatements; s++) statement(2, locals, locals, 2);
  for (const v of locals) lines.push(`  console.log(${v});`);
  for (const b of bools) lines.push(`  console.log(${b});`);
  lines.push("  return 0;");
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

/**
 * Generate and run `count` programs from `seed`. Returns
 * `{ seed, count, mismatches: [{ seed, file, result }], compileErrors, results }`.
 */
/**
 * A generated comparison can hit TypeScript's `a < b > (c)` ambiguity, where
 * the parser reads `<` as the start of a type-argument list: `tsc` rejects
 * such a program exactly as `nish` does, so it tests nothing. Rather
 * than teach every expression rule about it, re-roll the seed until the text
 * parses. Deterministic per seed, so a saved failure still reproduces with
 * `--seed <S> --count 1`.
 */
function generateProgram(seed, opts = {}) {
  let text = "";
  for (let salt = 0; salt < 32; salt++) {
    text = buildProgram((seed + salt * 0x9e3779b1) >>> 0, seed, opts);
    const sourceFile = ts.createSourceFile("fuzz.ts", text, ts.ScriptTarget.ES2020, true);
    const diagnostics = (sourceFile).parseDiagnostics;
    if (!diagnostics || diagnostics.length === 0) return text;
  }
  return text; // give up after 32 re-rolls and let the harness report it
}

async function fuzzRun({ count = 50, seed = 1, jobs = 4, depth = 3, log = () => {} } = {}) {
  const dir = path.join(lib.buildDir, "fuzz");
  fs.mkdirSync(dir, { recursive: true });
  const programs = [];
  for (let i = 0; i < count; i++) {
    const s = (seed + i) >>> 0;
    const file = path.join(dir, `fuzz-${s}.ts`);
    fs.writeFileSync(file, generateProgram(s, { depth }));
    programs.push({ name: `fuzz/${s}`, entry: file, args: [], kind: "fuzz", seed: s });
  }
  const results = await lib.pool(programs, jobs, async (p) => {
    const r = await lib.runProgram(p);
    log(r);
    return r;
  });
  const mismatches = [];
  const compileErrors = [];
  for (const r of results) {
    if (r.verdict === "match") continue;
    const failFile = path.join(lib.buildDir, `fuzz-fail-${r.prog.seed}.ts`);
    fs.copyFileSync(r.prog.entry, failFile);
    (r.verdict === "mismatch" ? mismatches : compileErrors).push({ seed: r.prog.seed, file: failFile, result: r });
  }
  return { seed, count, mismatches, compileErrors, results };
}

/**
 * The stage1 mode: generate `count` programs and require
 * `IR(stage0, p) == IR(stage1, p)` for each, byte for byte and module set
 * included — the same equality `tests/self/ir_oracle.js` asserts over the
 * checked-in corpus, on programs neither compiler has ever seen. stage0 is the
 * oracle; there is no golden anywhere in this path.
 *
 * The stage1 binary is linked once (about 15 s) and every program reuses it;
 * the programs themselves are compared one at a time, because the oracle's
 * `compare` is synchronous and empties the directory it works in, so `--jobs`
 * does not apply to this mode.
 * Returns `{ seed, count, agreed, modules, lines, disagreements }`, where a
 * disagreement is `{ seed, verdict, detail, file }` and `file` is the saved
 * reproducer. `binary === null` means the link failed and nothing was compared.
 */
function stage1Run({ count = 20, seed = 1, depth = 3, log = () => {} } = {}) {
  const binary = irOracle.build();
  if (binary === null) return { seed, count, binary, agreed: 0, modules: 0, lines: 0, disagreements: [] };
  const dir = path.join(lib.buildDir, "fuzz");
  fs.mkdirSync(dir, { recursive: true });
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "nish-fuzz-ir-"));
  const disagreements = [];
  let agreed = 0;
  let modules = 0;
  let lines = 0;
  for (let i = 0; i < count; i++) {
    const s = (seed + i) >>> 0;
    const file = path.join(dir, `fuzz-${s}.ts`);
    fs.writeFileSync(file, generateProgram(s, { depth }));
    const t0 = Date.now();
    const result = irOracle.compare(binary, work, file);
    // A generated program carries no `.args` and stays inside the language, so
    // the oracle's "skipped" outcomes cannot happen here for a benign reason:
    // every verdict other than an agreement is a failure worth saving.
    const entry = { seed: s, name: `fuzz/${s}`, verdict: "agree", detail: "", ms: Date.now() - t0, file };
    if (result.failed !== undefined) {
      entry.verdict = "ir-mismatch";
      entry.detail = result.failed;
    } else if (result.rejected !== undefined) {
      entry.verdict = "stage1-rejected";
      entry.detail = result.rejected;
    } else if (result.skipped !== undefined) {
      entry.verdict = "stage0-error";
      entry.detail = result.skipped;
    } else {
      agreed++;
      modules += result.modules;
      lines += result.lines;
    }
    if (entry.verdict !== "agree") {
      const failFile = path.join(lib.buildDir, `fuzz-stage1-fail-${s}.ts`);
      fs.copyFileSync(file, failFile);
      entry.file = failFile;
      disagreements.push(entry);
    }
    log(entry);
  }
  fs.rmSync(work, { recursive: true, force: true });
  return { seed, count, binary, agreed, modules, lines, disagreements };
}

export { generateProgram, fuzzRun, stage1Run };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  let count = 50;
  let seed = (Date.now() ^ (process.pid << 8)) >>> 0;
  let jobs = Math.min(8, os.cpus().length || 2);
  let depth = 3;
  let printOnly = false;
  let stage1 = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--count") count = Number(argv[++i]);
    else if (argv[i] === "--seed") seed = Number(argv[++i]) >>> 0;
    else if (argv[i] === "--jobs") jobs = Number(argv[++i]);
    else if (argv[i] === "--depth") depth = Number(argv[++i]);
    else if (argv[i] === "--print") printOnly = true;
    else if (argv[i] === "--stage1") stage1 = true;
    else {
      console.error(`unknown option: ${argv[i]}`);
      process.exit(2);
    }
  }
  if (printOnly) {
    process.stdout.write(generateProgram(seed, { depth }));
    process.exit(0);
  }
  if (!lib.hasClang()) {
    console.error("clang not installed");
    process.exit(2);
  }
  if (stage1) {
    console.log(`fuzz: stage1 seed=${seed} count=${count} depth=${depth} (linking stage1)`);
    const tStage1 = Date.now();
    const res = stage1Run({
      count,
      seed,
      depth,
      log: (e) => {
        const tag = e.verdict === "agree" ? "ok  " : e.verdict.toUpperCase();
        console.log(`${tag}  ${e.name}  ${e.ms} ms${e.detail ? `  ${e.detail}` : ""}`);
      },
    });
    if (res.binary === null) {
      console.error("fuzz: stage1 did not link; nothing compared");
      process.exit(2);
    }
    console.log(
      `\nfuzz: stage1 seed=${res.seed} count=${res.count} agree=${res.agreed} disagreements=${res.disagreements.length} (${res.modules} modules, ${res.lines} IR lines, ${((Date.now() - tStage1) / 1000).toFixed(1)} s)`
    );
    for (const d of res.disagreements) {
      console.log(`  ${d.verdict}: seed ${d.seed} saved to ${d.file}`);
      console.log(`      ${d.detail}`);
      console.log(`      reproduce: node tests/differential/fuzz.js --stage1 --seed ${d.seed} --count 1`);
    }
    process.exit(res.disagreements.length === 0 ? 0 : 1);
  }
  console.log(`fuzz: seed=${seed} count=${count} depth=${depth} jobs=${jobs}`);
  const t0 = Date.now();
  fuzzRun({
    count,
    seed,
    jobs,
    depth,
    log: (r) => {
      const tag = r.verdict === "match" ? "ok  " : r.verdict.toUpperCase();
      console.log(`${tag}  ${r.prog.name}  native ${lib.summarize(r.native)}  node ${lib.summarize(r.node)}  ${r.ms} ms`);
      if (r.verdict === "mismatch") console.log(`      ${lib.describeMismatch(r).replace(/\n/g, "\n      ")}`);
      if (r.verdict === "compile-error" || r.verdict === "rewrite-error") console.log(`      ${r.detail.trim().split("\n")[0]}`);
    },
  }).then((res) => {
    const bad = res.mismatches.length + res.compileErrors.length;
    console.log(
      `\nfuzz: seed=${res.seed} count=${res.count} mismatches=${res.mismatches.length} errors=${res.compileErrors.length} (${((Date.now() - t0) / 1000).toFixed(1)} s)`
    );
    for (const m of [...res.mismatches, ...res.compileErrors]) {
      console.log(`  ${m.result.verdict}: seed ${m.seed} saved to ${m.file}`);
    }
    process.exit(bad === 0 ? 0 : 1);
  });
}
