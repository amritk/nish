/**
 * The S3 type-model oracle: `self/types.ts` against `src/types.ts`
 * (docs/wp14-selfhost.md §6 rule 3).
 *
 *   node tests/self/types_oracle.js             build, run, diff
 *   node tests/self/types_oracle.js --verbose   print every differing line
 *
 * stage1 interns types and names them by an `i32`; stage0 keeps them as
 * discriminated-union objects and compares them structurally. That is a real
 * change of representation, so what has to be shown is that nothing
 * downstream can tell: the LLVM type, the alignment, the name a diagnostic
 * prints, and the assignability matrix are generated here from `dist/types.js`
 * over the same list of types, in the same order, and diffed.
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");
const types = require(path.join(root, "dist", "types.js"));

/** The list `tests/self/types.ts` builds, in the order it builds it. */
function buildTypes() {
  const scalars = [
    types.I32,
    types.I64,
    types.U8,
    types.U16,
    types.U32,
    types.U64,
    types.F32,
    types.F64,
    types.BOOL,
    types.STRING,
    types.VOID,
  ];
  const list = [...scalars, { kind: "struct", name: "Node" }, { kind: "struct", name: "Lexer" }];
  const arrays = list.map((t) => types.arrayOf(t));
  list.push(...arrays);
  list.push(types.nullableOf(types.STRING));
  list.push(types.nullableOf({ kind: "struct", name: "Node" }));
  list.push(types.nullableOf({ kind: "struct", name: "Lexer" }));
  list.push(...arrays.map((t) => types.nullableOf(t)));
  list.push(types.arrayOf(types.arrayOf(types.I32)));
  list.push(types.arrayOf(types.nullableOf({ kind: "struct", name: "Node" })));
  list.push(types.nullableOf(types.arrayOf(types.arrayOf(types.I32))));
  return list;
}

/**
 * The size stage1's table reaches after the driver has run. Interning means
 * one entry per *distinct* derived type, so this is the count of distinct
 * types the driver asks for plus the 12 fixed scalar ids.
 */
function expectedTableSize(list) {
  const keys = new Set();
  const key = (t) => {
    if (t.kind === "array") return `12:${key(t.elem)}`;
    if (t.kind === "struct") return `13:${t.name}`;
    if (t.kind === "nullable") return `14:${key(t.inner)}`;
    return t.kind;
  };
  const walk = (t) => {
    if (t.kind === "array") walk(t.elem);
    if (t.kind === "nullable") walk(t.inner);
    if (t.kind === "array" || t.kind === "struct" || t.kind === "nullable") keys.add(key(t));
  };
  for (const t of list) walk(t);
  return 12 + keys.size;
}

function expected() {
  const list = buildTypes();
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    const flags = [
      types.isPointerType(t),
      types.isInteger(t),
      types.isUnsigned(t),
      types.isFloat(t),
      types.isNumeric(t),
    ]
      .map((b) => (b ? 1 : 0))
      .join("");
    out.push(
      `type ${i} ${types.typeToString(t)} | ${types.llvmType(t)} | ${types.alignOf(t)} ${flags} ${types.intBits(t)}`
    );
  }
  for (let from = 0; from < list.length; from++) {
    for (let to = 0; to < list.length; to++) {
      if (types.assignable(list[from], list[to])) out.push(`assignable ${from} ${to}`);
    }
  }
  out.push("intern array 1");
  out.push("intern struct 1");
  out.push("intern nullable 1");
  out.push("strip 1");
  out.push("strip plain 1");
  out.push("distinct 0");
  out.push(`table size ${expectedTableSize(list)}`);
  // `T_ERROR` is stage1's alone; these four lines are its specification.
  out.push("error name error");
  out.push("error to i32 1");
  out.push("error from i32 1");
  out.push("error not i32 0");
  return `${out.join("\n")}\n`;
}

function build() {
  const out = path.join(root, "build", "self", "types");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const r = spawnSync(
    "node",
    [path.join(root, "dist", "index.js"), path.join(root, "tests", "self", "types.ts"), "--link", out],
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
  const run = spawnSync(binary, [], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0) {
    process.stderr.write(`types exited ${run.status}\n${run.stderr}`);
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

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { expected, build };
