/**
 * The core and the browser adapter, run with web globals and nothing else
 * (`node --experimental-vm-modules tests/runtime/web-context.mjs`): a vm
 * context holds only what a page has that the two read, both files are linked
 * as `SourceTextModule`s, and the linker refuses any `node:` specifier. One
 * helper from each core file runs, then `argv`, `write`, `panic`, `exit` and a
 * file-system call; the console lines, each `NishExit` and the flush of an
 * unfinished line once the program yields are asserted.
 * `tests/run.js` (`runtime-hosts`) runs it and reads its exit status.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Each console call is recorded with its arguments as given, the format
// included: a line printed without its `"%s"` would have a `%d` in the
// program's text read as a directive.
const lines = [];
const context = vm.createContext({
  console: {
    log: (...args) => lines.push(["out", ...args]),
    error: (...args) => lines.push(["err", ...args]),
  },
  performance,
  crypto,
  TextEncoder,
  TextDecoder,
  queueMicrotask,
  setTimeout,
});

const modules = new Map();
function load(url) {
  if (!modules.has(url)) {
    const source = readFileSync(new URL(url), "utf8");
    modules.set(url, new vm.SourceTextModule(source, { identifier: url, context }));
  }
  return modules.get(url);
}
function linker(specifier, referencing) {
  if (specifier.startsWith("node:")) {
    throw new Error(`${referencing.identifier} imports ${specifier}, which a browser does not have`);
  }
  return load(new URL(specifier, referencing.identifier).href);
}

async function instantiate(path) {
  const module = load(new URL(path, import.meta.url).href);
  await module.link(linker);
  await module.evaluate();
  return module.namespace;
}

const { NishExit } = await instantiate("../../runtime/browser.mjs");

/** Run `f` and answer the `NishExit` it throws; anything else fails the check. */
function exitOf(f) {
  try {
    f();
  } catch (e) {
    assert.ok(e instanceof NishExit, `expected a NishExit, got ${e.stack}`);
    return e.code;
  }
  assert.fail("expected a NishExit, and nothing was thrown");
}

// BROWSER-3: the class is exported, so a thrown object that only carries its
// name is not taken for an exit.
const impostor = Object.assign(new Error("not an exit"), { name: "NishExit", code: 0 });
assert.equal(impostor instanceof NishExit, false);
const core = await instantiate("../../runtime/core.mjs");
assert.equal(vm.runInContext("typeof process + typeof Buffer + typeof require", context), "undefinedundefinedundefined");

core.log(core.toI64(2.9)); // numbers
core.log(core.strLen("héllo")); // strings
core.log(core.idx([10, 20, 30], 1)); // arrays
core.log(core.Ok(7).unwrapOr(0)); // result
core.write("50% of ");
core.write("%d\nno newline");
assert.deepEqual([...core.argv()], ["main"]);
assert.equal(typeof core.monotonicNanos(), "bigint");
assert.equal(core.getenv("HOME"), null);
assert.equal(exitOf(() => core.panic("boom")), 1);
assert.equal(exitOf(() => core.exit(259)), 3);
assert.equal(exitOf(() => core.readFileSync("/etc/hosts")), 1);

assert.deepEqual(lines, [
  ["out", "%s", "2"],
  ["out", "%s", "6"],
  ["out", "%s", "20"],
  ["out", "%s", "7"],
  ["out", "%s", "50% of %d"],
  // The panic's line, then the exit's flush of the unfinished one: the order
  // a native run's buffered stdout leaves too.
  ["err", "%s", "boom"],
  ["out", "%s", "no newline"],
  ["err", "%s", "readFileSync is not available in a browser"],
]);

// A line left unfinished is printed once the program yields to its caller.
lines.length = 0;
core.write("partial");
assert.deepEqual(lines, []);
await Promise.resolve();
assert.deepEqual(lines, [["out", "%s", "partial"]]);

// BROWSER-1: a write with no newline appends to the pending line and splits
// nothing, so 400,000 one-byte writes are one line, printed whole, in well
// under a second. Splitting the whole pending line on every write took 29 s.
lines.length = 0;
const started = performance.now();
for (let i = 0; i < 400000; i++) core.write("x");
core.write("\n");
const took = performance.now() - started;
assert.equal(lines.length, 1);
assert.equal(lines[0][2].length, 400000);
assert.ok(took < 1000, `400,000 one-byte writes took ${Math.round(took)} ms`);
console.log("web-context: ok");
