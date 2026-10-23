/**
 * The core and the browser adapter, run with web globals and nothing else
 * (`node --experimental-vm-modules tests/runtime/web-context.mjs`): a vm
 * context holds only what a page has that the two read, both files are linked
 * as `SourceTextModule`s, and the linker refuses any `node:` specifier. One
 * helper from each core file runs, then `write`, `panic`, `exit` and a
 * file-system call; the console lines and each `NishExit` are asserted.
 * `tests/run.js` (`runtime-hosts`) runs it and reads its exit status.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const lines = [];
const context = vm.createContext({
  console: {
    log: (format, ...rest) => lines.push(["out", format === "%s" ? rest.join(" ") : [format, ...rest].join(" ")]),
    error: (format, ...rest) => lines.push(["err", format === "%s" ? rest.join(" ") : [format, ...rest].join(" ")]),
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

/** Run `f` and answer the `NishExit` it throws; anything else fails the check. */
function exitOf(f) {
  try {
    f();
  } catch (e) {
    assert.equal(e.name, "NishExit", `expected a NishExit, got ${e.stack}`);
    return e.code;
  }
  assert.fail("expected a NishExit, and nothing was thrown");
}

await instantiate("../../runtime/browser.mjs");
const core = await instantiate("../../runtime/core.mjs");
assert.equal(vm.runInContext("typeof process + typeof Buffer + typeof require", context), "undefinedundefinedundefined");

core.log(core.toI64(2.9)); // numbers
core.log(core.strLen("héllo")); // strings
core.log(core.idx([10, 20, 30], 1)); // arrays
core.log(core.Ok(7).unwrapOr(0)); // result
core.write("50% of ");
core.write("%d\nno newline");
assert.equal(typeof core.monotonicNanos(), "bigint");
assert.equal(core.getenv("HOME"), null);
assert.equal(exitOf(() => core.panic("boom")), 1);
assert.equal(exitOf(() => core.exit(259)), 3);
assert.equal(exitOf(() => core.readFileSync("/etc/hosts")), 1);

assert.deepEqual(lines, [
  ["out", "2"],
  ["out", "6"],
  ["out", "20"],
  ["out", "7"],
  ["out", "50% of %d"],
  // The panic's line, then the exit's flush of the unfinished one: the order
  // a native run's buffered stdout leaves too.
  ["err", "boom"],
  ["out", "no newline"],
  ["err", "readFileSync is not available in a browser"],
]);
console.log("web-context: ok");
