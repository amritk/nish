/**
 * The S3 scope oracle: `self/symbols.ts` against `src/checker/scope.ts`
 * (docs/wp14-selfhost.md §6 rule 3).
 *
 *   node tests/self/symbols_oracle.js             build, run, diff
 *   node tests/self/symbols_oracle.js --verbose   print every differing line
 *
 * Narrowing is the part of the checker that a program can *observe* going
 * wrong — a scope that keeps a narrowing one statement too long compiles a
 * load through a pointer the checker promised was not null — so the two
 * implementations are driven through the same script and every answer is
 * compared: what a name resolves to, what it reads as, and where a narrowing
 * stops.
 *
 * stage0's `Scope.declare` throws a `CompileError` on a duplicate and
 * stage1's returns false (D1's error-value threading); that is the one
 * deliberate difference, and it is compared as the same 1/0 either way.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..", "..");
const { Scope } = await import(pathToFileURL(path.join(root, "dist", "checker", "scope.js")).href);
const types = await import(pathToFileURL(path.join(root, "dist", "types.js")).href);

const dummy = ts.createSourceFile("scope.ts", "const x = 0;\n", ts.ScriptTarget.Latest, true);
const dummyNode = dummy.statements[0];

/** `Scope.declare` throws where stage1 answers false; both are read as 1/0 here. */
function declare(scope, local) {
  try {
    scope.declare(local, dummyNode, dummy);
    return 1;
  } catch {
    return 0;
  }
}

function expected() {
  const out = [];
  const nullableString = types.nullableOf(types.STRING);
  const node = { kind: "struct", name: "Node" };
  const nullableNode = types.nullableOf(node);
  const name = (t) => types.typeToString(t);

  const report = (scope, where, varName) => {
    const found = scope.lookup(varName);
    if (!found) {
      out.push(`${where} ${varName} absent`);
      return;
    }
    out.push(`${where} ${varName} ${name(found.type)} reads ${name(scope.typeOf(found))}`);
  };

  const rootScope = new Scope();
  const a = { name: "a", type: types.I32, mutable: true, storage: "local" };
  const b = { name: "b", type: nullableString, mutable: false, storage: "param" };
  const c = { name: "c", type: nullableNode, mutable: true, storage: "local" };
  out.push(`declare a ${declare(rootScope, a)}`);
  out.push(`declare b ${declare(rootScope, b)}`);
  out.push(`declare c ${declare(rootScope, c)}`);
  out.push(
    `declare a again ${declare(rootScope, { name: "a", type: types.F64, mutable: true, storage: "local" })}`
  );
  report(rootScope, "root", "a");
  report(rootScope, "root", "b");
  report(rootScope, "root", "c");
  report(rootScope, "root", "missing");

  const inner = rootScope.child();
  const shadow = { name: "a", type: types.F64, mutable: false, storage: "local" };
  out.push(`shadow ${declare(inner, shadow)}`);
  report(inner, "inner", "a");
  report(inner, "inner", "b");
  out.push(`storage ${a.storage === "local" ? 1 : 0} ${b.storage === "param" ? 1 : 0}`);
  out.push(`mutable ${a.mutable ? 1 : 0} ${shadow.mutable ? 1 : 0}`);
  // `declaresHere` has no counterpart: stage0 reads its private map directly
  // in `declare`. Its specification is that it sees this scope only.
  out.push("declares here 1 0");

  inner.narrow(b, types.STRING);
  report(inner, "narrowed", "b");
  report(rootScope, "root after narrow", "b");
  const deeper = inner.child();
  report(deeper, "deeper", "b");

  deeper.narrow(b, nullableString);
  report(deeper, "renarrowed", "b");
  report(inner, "outer still", "b");
  deeper.clearNarrowing(b);
  report(deeper, "cleared deeper", "b");
  report(inner, "cleared inner", "b");

  rootScope.narrow(c, node);
  report(deeper, "c narrowed at root", "c");
  deeper.clearNarrowing(c);
  report(rootScope, "c cleared from deeper", "c");
  out.push("clear absent -1");
  return `${out.join("\n")}\n`;
}

function build() {
  const out = path.join(root, "build", "self", "symbols");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const r = spawnSync(
    "node",
    [path.join(root, "dist", "index.js"), path.join(root, "tests", "self", "symbols.ts"), "--link", out],
    { cwd: root, encoding: "utf8" }
  );
  if (r.status !== 0) {
    process.stderr.write(`${r.stderr}\n`);
    return null;
  }
  return out;
}

function main(argv) {
  const verbose = argv.includes("--verbose");
  const binary = build();
  if (binary === null) return 1;
  const run = spawnSync(binary, [], { cwd: root, encoding: "utf8" });
  if (run.status !== 0) {
    process.stderr.write(`symbols exited ${run.status}\n${run.stderr}`);
    return 1;
  }
  const want = expected().split("\n");
  const got = run.stdout.split("\n");
  const differing = [];
  for (let i = 0; i < Math.max(want.length, got.length); i++) {
    if (want[i] !== got[i]) differing.push(`  line ${i + 1}: want ${want[i]} / got ${got[i]}`);
  }
  if (differing.length > 0) {
    for (const line of verbose ? differing : differing.slice(0, 10)) process.stdout.write(`${line}\n`);
  }
  process.stdout.write(`${want.length - differing.length}/${want.length} lines agree\n`);
  return differing.length === 0 ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
export { expected, build };
