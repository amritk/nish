#!/usr/bin/env node
/**
 * WP22 x WP13: the two spellings of a function must rewrite to the same JavaScript.
 *
 * `rewrite.js` turns an Nish program into JavaScript and points every builtin at
 * `runtime/shim.mjs`, so that the Node side of a differential comparison runs this
 * language's semantics rather than JavaScript's. It used to hand back a top-level
 * `const` declaration without visiting its children, which was right while a top-level
 * `const` was only ever a folded module constant and wrong from the moment WP22 made a
 * *function* an arrow bound to one. Every arrow-declared body therefore went through
 * unrewritten: `mkdirSync` stayed bare and threw `ReferenceError`, and `console.log`
 * stayed JavaScript's own -- which is the worse half, because it prints something close
 * enough to pass while measuring nothing. Nine whole programs in the corpus were being
 * compared that way.
 *
 * The property here is the one that made that a bug rather than a difference:
 * `function f() { ... }` and `const f = () => { ... }` are the same program, so they
 * must rewrite to the same JavaScript. `arrow-parity/declared.ts` and
 * `arrow-parity/arrow.ts` are that program in the two spellings; both are rewritten and
 * their `.mjs` -- what Node actually runs -- compared line by line after two
 * normalisations and no others:
 *
 *   1. comment lines are dropped, because the two fixtures explain themselves
 *      differently and a comment is not a semantic;
 *   2. an arrow declaration header is spelled as a `function` header
 *      (`const f = (a) => {` -> `function f(a) {`, and a closing `};` -> `}`), which is
 *      the declaration syntax itself and the only thing the two files may disagree on.
 *
 * Nothing inside a body is normalised, which is what keeps the guard honest: the old
 * transform left the arrow bodies with JavaScript's own `console.log`, a bare `getenv`
 * and unwrapped i32 arithmetic, so every line of every body differed and the comparison
 * fails on the pre-fix `rewrite.js`. Point `--rewrite` at a checkout of it to see that:
 *
 *   git show 2806854^:tests/differential/rewrite.js > build/test/pre-fix-rewrite.js
 *   node tests/differential/arrow-parity.js --rewrite build/test/pre-fix-rewrite.js
 *
 * The copy has to sit two directories below the repository root, because that is where
 * `rewrite.js` resolves the root (and therefore `dist/` and the shim) from; `build/test`
 * is such a place and is not checked in.
 *
 * Beside the equality there is a second claim, because two outputs that agree would
 * also agree if the rewrite had stopped working for both spellings at once: each output
 * must reach the shim for every member `SHIM_MEMBERS` names, which is the list of calls
 * the fixtures are written to exercise.
 *
 * The fixtures are not in `corpus/`: this guard rewrites them and never runs them, so
 * putting them there would buy a native compile, link and run of two more programs for
 * a property that does not need one. Nothing here needs clang.
 *
 * Usage: node tests/differential/arrow-parity.js [--rewrite <rewrite.js>] [-o <dir>]
 * Exit status is 0 when the two spellings agree, 1 when they do not, 2 on a usage or
 * rewrite error.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const here = import.meta.dirname;
const root = path.resolve(here, "..", "..");
const fixtures = path.join(here, "arrow-parity");

/**
 * The shim members the fixture pair is written to reach. Each one is a call whose
 * JavaScript meaning differs from this language's, so a body that went through
 * unrewritten loses it -- and losing one is what "prints something close enough to pass"
 * looked like. Keep this in step with the fixtures; a name that disappears from both of
 * them should disappear from here in the same commit.
 */
const SHIM_MEMBERS = [
  "log",
  "write",
  "getenv",
  "isDirectorySync",
  "parseInt",
  "parseFloat",
  "toI32",
  "strLen",
  "charCodeAt",
  "substring",
  "idx",
];

const argv = process.argv.slice(2);
let rewriteModule = path.join(here, "rewrite.js");
let outRoot = path.join(root, "build", "test", "differential", "arrow-parity");
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--rewrite") rewriteModule = path.resolve(argv[++i]);
  else if (argv[i] === "-o") outRoot = path.resolve(argv[++i]);
  else {
    console.error(`unknown option: ${argv[i]}`);
    process.exit(2);
  }
}

const { rewriteProgram } = await import(pathToFileURL(rewriteModule).href);

/** The one rewritten module of a single-module fixture, as the text Node would run. */
const rewriteFixture = (stem) => {
  const dir = path.join(outRoot, stem);
  fs.rmSync(dir, { recursive: true, force: true });
  const result = rewriteProgram(path.join(fixtures, `${stem}.ts`), {}, dir);
  if (result.modules.length !== 1) {
    throw new Error(`${stem}.ts rewrote to ${result.modules.length} modules; the guard compares one`);
  }
  return fs.readFileSync(result.modules[0], "utf8");
};

/**
 * The declaration syntax, spelled the `function` way. Only a header line and the `};`
 * that closes one are touched, so two bodies that differ still differ afterwards.
 */
const normalise = (text) =>
  text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .map((line) =>
      line
        .replace(/^(export )?const ([A-Za-z_$][\w$]*) = \(([^)]*)\) => \{$/, "$1function $2($3) {")
        .replace(/^};$/, "}")
    )
    .join("\n")
    .trim();

/** The `__nish.<member>` calls a rewritten module makes. */
const shimMembers = (text) => new Set([...text.matchAll(/__nish\.(\w+)\(/g)].map((m) => m[1]));

let failures = 0;
const fail = (message) => {
  failures++;
  console.log(`FAIL  ${message}`);
};

let declared;
let arrow;
try {
  declared = rewriteFixture("declared");
  arrow = rewriteFixture("arrow");
} catch (e) {
  console.error(`arrow-parity: rewriting the fixtures failed: ${e.message}`);
  process.exit(2);
}

const left = normalise(declared).split("\n");
const right = normalise(arrow).split("\n");
const differing = [];
for (let i = 0; i < Math.max(left.length, right.length); i++) {
  if (left[i] !== right[i]) differing.push(i);
}
if (differing.length > 0) {
  fail(
    `declared.ts and arrow.ts rewrite differently: ${differing.length} of ` +
      `${Math.max(left.length, right.length)} line(s) differ`
  );
  for (const i of differing.slice(0, 8)) {
    console.log(`      line ${i + 1}`);
    console.log(`        function: ${left[i] ?? "(no line)"}`);
    console.log(`        arrow:    ${right[i] ?? "(no line)"}`);
  }
  if (differing.length > 8) console.log(`      ... and ${differing.length - 8} more`);
  console.log(
    "      Either the two fixtures have drifted apart -- their bodies are meant to be identical --\n" +
      "      or a body reached JavaScript unrewritten, which is the shape of the WP22 bug: the\n" +
      "      transform returned a declaration without visiting its children. When every line differs,\n" +
      "      read the shim-member failure below it: one spelling losing the whole `__nish` import is\n" +
      "      what an unvisited body looks like, because nothing in the module referenced it."
  );
}

for (const [spelling, text] of [
  ["declared", declared],
  ["arrow", arrow],
]) {
  const members = shimMembers(text);
  const absent = SHIM_MEMBERS.filter((m) => !members.has(m));
  if (absent.length > 0) {
    fail(
      `${spelling}.ts does not reach the shim for ${absent.join(", ")}: either the fixture stopped ` +
        "calling them or the rewrite stopped redirecting them"
    );
  }
}

if (failures === 0) {
  console.log(
    `arrow-parity: declared.ts and arrow.ts rewrite identically (${left.length} lines, ` +
      `${SHIM_MEMBERS.length} shim members reached by both).`
  );
}
process.exit(failures === 0 ? 0 : 1);
