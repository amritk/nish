#!/usr/bin/env node
/**
 * The JavaScript every differential program rewrites to, checked in
 * (WP19 gate G2.4, `docs/wp19-stage0-retirement.md` §2B and §3).
 *
 *   node tests/differential/goldens.js              verify the store against the live rewrite
 *   node tests/differential/goldens.js corpus/i64   only the programs whose name contains that
 *   node tests/differential/goldens.js --update     rewrite the store from the live rewriter
 *   node tests/differential/goldens.js --fresh      check the hashes alone, with no rewriter
 *   node tests/differential/goldens.js --verbose --lines 40
 *
 * **Why this exists.** `tests/differential/` is the only oracle in this
 * repository about *runtime semantics* rather than emitted text: every whole
 * program is compiled and run natively, rewritten into JavaScript, run under
 * Node against `runtime/shim.mjs`, and the two runs compared byte for byte.
 * The rewrite is what makes that exact — it needs the static type of every
 * expression, because `i32`, `u8`, `f32` and `i64` are all just `number` to
 * `tsc` — so `rewrite.js` drives **stage0's own `Compilation`** in process.
 * §2B's table said this oracle survives stage0. It does not: deleting `src/`
 * takes the rewriter with it, and with it 175 programs of semantic comparison.
 *
 * So the rewrite is frozen the way the four dying oracles' output was frozen
 * in `tests/self/goldens/`: the rewritten `.mjs` of every program is written
 * down *while stage0 still exists*, and the comparison against Node keeps
 * running from the store afterwards. The store is generated from the live
 * rewriter and verified against it on every `npm test`, so it records what the
 * oracle actually compares and not what somebody thought it compared.
 *
 * `.claude/selfhost.md` says to regenerate a golden from stage1 and never from
 * stage0. **This store is the one exception in the repository, and it is an
 * exception on purpose**: its reference is stage0's *checker*, because the
 * rewrite's types come from the compiler that typed the program, and stage1
 * has no rewriter to ask. That is exactly why it has to be frozen before
 * stage0 goes rather than repointed at something that outlives it. Porting the
 * rewriter onto stage1's `--emit-checked` dump is the way out of the exception
 * and is a project of its own; until somebody does it, this store is the
 * oracle's memory.
 *
 * **What is in a record, and what is keyed on what.**
 *
 *   program cases/add
 *     module <src-hash> tests/cases/add.ts <body-id> add.mjs
 *     entry  <body-id> __entry.mjs
 *
 * The `<src-hash>` is the staleness guard and is the whole engineering content
 * of the freeze: a frozen rewrite of a program whose source has moved is worse
 * than no oracle at all, because the run still prints a verdict. It is the
 * SHA-256 of the source file's bytes, truncated to 16 hex characters, taken
 * over **every module the program loads** rather than the entry alone — an
 * edit to `modules_basic/math.ts` has to invalidate `main.ts`'s rewrite. The
 * flags line carries `<name>.args` verbatim, because `--number-mode f64` and
 * `--wrapping` change what the rewrite emits.
 *
 * Why a content hash and not something cheaper: an mtime is not reproducible
 * across two checkouts of the same commit and a git blob id needs git and a
 * committed file, whereas the bytes of the file are what the rewrite was a
 * function of. Truncation to 64 bits is safe here because the failure this
 * guards against is a forgotten regeneration, not a forged file. `<name>.argv`
 * and `<name>.env` are deliberately *not* hashed: they are read live and handed
 * to both sides of the comparison, so changing one moves the native run and the
 * Node run together and neither side goes stale.
 *
 * **Two checks, and only one of them outlives stage0.** Freshness — the hashes
 * above — is cheap and runs wherever the store is read, including after R6.
 * Fidelity is this tool's verify mode: it re-runs the live rewriter over every
 * program and requires the store to be byte identical, which is what catches an
 * edit to `rewrite.js` itself. That half dies with stage0 by construction, the
 * same way `checked_oracle.js` does, which is why it runs on every `npm test`
 * for as long as there is a stage0 to run it.
 *
 * Regenerate with `npm run test:update`, the command that also writes a missing
 * `.ll` and `tests/self/goldens/`, or with `--update` here.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Resolved without asking any module that might not survive R6. */
const root = path.resolve(import.meta.dirname, "..", "..");
const STORE = path.join(root, "tests", "differential", "goldens", "rewrites.txt");
const WORK = path.join(root, "build", "test", "differential", "goldens");

/**
 * 64 bits of SHA-256, for a source file and for a stored body alike. A body id
 * is the content, so identical text is stored once; a source hash is the guard.
 */
const ID_CHARS = 16;

/**
 * The repository root, as the store spells it. A rewritten module imports the
 * shim by absolute path, so the text as generated carries whatever directory
 * this checkout happens to live in and could not be compared between two of
 * them. Nothing else in a rewritten module is absolute — measured over all 356
 * of them — and a body that contains the token itself is refused rather than
 * round-tripped, because the substitution would not be reversible.
 */
const ROOT_TOKEN = "<root>";

const digest = (text) => crypto.createHash("sha256").update(text).digest("hex").slice(0, ID_CHARS);

const relative = (file) => path.relative(root, file).split(path.sep).join("/");

/** Long lines are cut to this in a failure report, so a diff stays readable. */
const MAX_LINE = 160;

const header = (note) => [
  "# The JavaScript every differential program rewrites to, as stage0's checker typed it.",
  "# Generated by `npm run test:update` (or `node tests/differential/goldens.js --update`).",
  "# WP19 gate G2.4: the WP13 oracle's reference, written down before stage0 can take it.",
  "# Do not edit by hand — `goldens.js`'s header says what is keyed on what.",
  `# ${note}`,
];

/** The store's text with this checkout's path put back; the inverse of `portable`. */
const local = (text) => text.split(ROOT_TOKEN).join(root);

const portable = (text) => text.split(root).join(ROOT_TOKEN);

/**
 * The rewriter, loaded only when it is needed. `rewrite.js` imports
 * `dist/compiler.js` at module scope, so a static import here would stop this
 * file loading at all in a tree where stage0 has been deleted — which is the
 * tree the store exists for.
 */
const loadRewriter = async () => {
  try {
    const module = await import("./rewrite.js");
    return { rewriteProgram: module.rewriteProgram };
  } catch (e) {
    return { error: `the live rewriter is unavailable (stage0's checker types the rewrite): ${e.message}` };
  }
};

/**
 * `{ numberMode, nsw }` for one program, from its `.args`. The checker folds
 * module constants under the compilation's overflow mode, so `--wrapping` has
 * to reach the rewrite or a program the native side compiled happily fails to
 * rewrite at all.
 */
const rewriteOptions = (args) => {
  const at = args.indexOf("--number-mode");
  return { numberMode: at >= 0 ? args[at + 1] : "i32", nsw: !args.includes("--wrapping") };
};

/**
 * Rewrite one program with the live rewriter and answer the record the store
 * would hold for it: the sources it loaded with their hashes, and the text of
 * every module Node runs.
 */
const produceOne = (rewriteProgram, prog) => {
  const out = path.join(WORK, prog.name.replace(/[\\/]/g, "_"));
  fs.rmSync(out, { recursive: true, force: true });
  let rewritten;
  try {
    rewritten = rewriteProgram(prog.entry, rewriteOptions(prog.args), out);
  } catch (e) {
    return { error: `${prog.name} does not rewrite: ${(e.stack ?? String(e)).split("\n")[0]}` };
  }
  const bodies = new Map();
  const modules = [];
  for (let i = 0; i < rewritten.modules.length; i++) {
    // `<stem>.mjs` is stored and `<stem>.rewritten.ts` beside it is not: the
    // first is what Node runs, and the second exists to be read.
    const file = rewritten.modules[i];
    const out = path.basename(file);
    const raw = fs.readFileSync(file, "utf8");
    // Checked before the substitution, not after: `portable` puts the token in
    // deliberately, so asking afterwards would answer yes for every module.
    if (raw.includes(ROOT_TOKEN)) {
      return {
        error: `${prog.name}: ${out} contains ${ROOT_TOKEN}, which the store uses for this checkout's path`,
      };
    }
    const text = portable(raw);
    const id = digest(text);
    modules.push({
      id,
      out,
      source: relative(rewritten.sources[i]),
      srcHash: digest(fs.readFileSync(rewritten.sources[i], "utf8")),
    });
    bodies.set(id, text);
  }
  const entryRaw = fs.readFileSync(rewritten.entry, "utf8");
  if (entryRaw.includes(ROOT_TOKEN)) {
    return { error: `${prog.name}: its entry module contains ${ROOT_TOKEN}` };
  }
  const entryText = portable(entryRaw);
  const entryId = digest(entryText);
  bodies.set(entryId, entryText);
  return {
    // The module order is the compilation's load order and the stems are the
    // compiler's own (`-o dir/`), so a cross-module `import "./math.mjs"`
    // resolves to the file this record names.
    record: {
      name: prog.name,
      flags: prog.args,
      modules,
      entry: { id: entryId, out: path.basename(rewritten.entry) },
    },
    bodies,
  };
};

/** The store, parsed. Bodies are length-framed, so no line of JavaScript needs escaping. */
const readStore = () => {
  if (!fs.existsSync(STORE)) {
    return { error: `${relative(STORE)} is missing: run \`npm run test:update\` while stage0 exists` };
  }
  const lines = fs.readFileSync(STORE, "utf8").split("\n");
  const programs = new Map();
  const bodies = new Map();
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("#") || line.length === 0) continue;
    if (line.startsWith("program ")) {
      current = { name: line.slice("program ".length), flags: [], modules: [], entry: null };
      programs.set(current.name, current);
      continue;
    }
    if (line.startsWith("  flags ")) {
      current.flags = line.slice("  flags ".length).split(" ").filter(Boolean);
      continue;
    }
    if (line.startsWith("  module ")) {
      const [srcHash, source, id, out] = line.slice("  module ".length).split(" ");
      current.modules.push({ srcHash, source, id, out });
      continue;
    }
    if (line.startsWith("  entry ")) {
      const [id, out] = line.slice("  entry ".length).split(" ");
      current.entry = { id, out };
      continue;
    }
    if (line.startsWith("body ")) {
      const [id, count, bytes] = line.slice("body ".length).split(" ");
      const text = lines.slice(i + 1, i + 1 + Number(count)).join("\n");
      if (Buffer.byteLength(text) !== Number(bytes)) {
        return {
          error: `${relative(STORE)}:${i + 1}: body ${id} is ${Buffer.byteLength(text)} bytes, not ${bytes}`,
        };
      }
      // The id *is* the content, so a body that does not hash to its own id has
      // been edited by hand. Checked on every read rather than only under
      // `--update`, because after R6 this is the only thing standing between a
      // typo in the store and a comparison that reports the typo as a verdict.
      if (digest(text) !== id) {
        return {
          error: `${relative(STORE)}:${i + 1}: body ${id} hashes to ${digest(text)}; it was edited by hand`,
        };
      }
      bodies.set(id, text);
      i += Number(count);
      continue;
    }
    return { error: `${relative(STORE)}:${i + 1}: unexpected line \`${line.slice(0, 60)}\`` };
  }
  return { programs, bodies };
};

/**
 * Why this program's frozen rewrite may not be used, or null when it may.
 *
 * This is the guard the freeze stands on. A stale rewrite is not a soft
 * failure to be listed in `known-failures.txt`: the run would compare the
 * native binary of today's source against the JavaScript of yesterday's and
 * print `ok` or a mismatch, either of which is a lie. So every reader of the
 * store asks this first, and the answer is a hard failure.
 */
const staleness = (record, prog, bodies) => {
  if (record.flags.join(" ") !== prog.args.join(" ")) {
    return `its flags moved: the store holds \`${record.flags.join(" ") || "(none)"}\` and \`${prog.name}.args\` now says \`${prog.args.join(" ") || "(none)"}\``;
  }
  for (const module of record.modules) {
    const file = path.join(root, module.source);
    if (!fs.existsSync(file)) return `${module.source} is gone`;
    const now = digest(fs.readFileSync(file, "utf8"));
    if (now !== module.srcHash) {
      return `${module.source} changed since the rewrite was frozen (${module.srcHash} -> ${now})`;
    }
    if (!bodies.has(module.id)) return `the stored body ${module.id} of ${module.out} is missing`;
  }
  if (record.entry === null || !bodies.has(record.entry.id)) return "its generated entry module is missing";
  return null;
};

/**
 * Write one program's frozen rewrite into `outDir` and answer it in the shape
 * `rewriteProgram` answers, so that the runner cannot tell the two apart.
 */
const materialize = (record, bodies, outDir) => {
  fs.mkdirSync(outDir, { recursive: true });
  const modules = [];
  for (const module of record.modules) {
    const at = path.join(outDir, module.out);
    fs.writeFileSync(at, local(bodies.get(module.id)));
    modules.push(at);
  }
  const entry = path.join(outDir, record.entry.out);
  fs.writeFileSync(entry, local(bodies.get(record.entry.id)));
  return { entry, modules, frozen: true };
};

/** The store's text for every program, in corpus order. */
const produceStore = (rewriteProgram, programs) => {
  const records = [];
  const bodies = new Map();
  let live = 0;
  for (const prog of programs) {
    const produced = produceOne(rewriteProgram, prog);
    if (produced.error !== undefined) return { error: produced.error };
    records.push(produced.record);
    for (const [id, text] of produced.bodies) {
      live += Buffer.byteLength(text);
      bodies.set(id, text);
    }
  }
  let stored = 0;
  for (const text of bodies.values()) stored += Buffer.byteLength(text);
  const moduleCount = records.reduce((n, r) => n + r.modules.length + 1, 0);
  const note =
    `${records.length} programs, ${moduleCount} modules, ${bodies.size} distinct ` +
    `(${(live / 1024).toFixed(1)} KiB live, ${(stored / 1024).toFixed(1)} KiB stored)`;
  const lines = [...header(note)];
  for (const record of records) {
    lines.push(`program ${record.name}`);
    if (record.flags.length > 0) lines.push(`  flags ${record.flags.join(" ")}`);
    for (const module of record.modules) {
      lines.push(`  module ${module.srcHash} ${module.source} ${module.id} ${module.out}`);
    }
    lines.push(`  entry ${record.entry.id} ${record.entry.out}`);
  }
  for (const [id, text] of bodies) {
    const count = text.split("\n").length;
    lines.push(`body ${id} ${count} ${Buffer.byteLength(text)}`, text);
  }
  return { text: `${lines.join("\n")}\n`, records, bodies, note };
};

/** The first differences between two texts, bounded, with long lines cut. */
const diff = (want, got, limit) => {
  const a = want.split("\n");
  const b = got.split("\n");
  const out = [];
  const cut = (line) =>
    line === undefined ? "<end of file>" : line.length > MAX_LINE ? `${line.slice(0, MAX_LINE)}...` : line;
  let total = 0;
  let shown = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    total++;
    if (shown < limit) {
      out.push(`      line ${i + 1}:`, `        golden: ${cut(a[i])}`, `        live:   ${cut(b[i])}`);
      shown++;
    }
  }
  return { total, shown, out };
};

const parse = (argv) => {
  const options = { update: false, verbose: false, fresh: false, lines: 10, only: undefined };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--update") options.update = true;
    else if (arg === "--fresh") options.fresh = true;
    else if (arg === "--verbose") options.verbose = true;
    else if (arg === "--lines") options.lines = Number(argv[++i]);
    else if (arg === "--only") options.only = argv[++i];
    else if (!arg.startsWith("-") && options.only === undefined) options.only = arg;
    else return { error: `unknown option: ${arg}` };
  }
  return options;
};

const main = async (argv) => {
  const options = parse(argv);
  if (options.error !== undefined) {
    process.stderr.write(`${options.error}\n`);
    return 2;
  }
  const { update, verbose, only } = options;
  const limit = verbose ? Number.POSITIVE_INFINITY : options.lines;
  if (update && only !== undefined) {
    // The store is one file over the whole corpus, so a filtered regeneration
    // would drop every program the filter did not name.
    process.stderr.write("--update rewrites the whole store; drop the filter\n");
    return 2;
  }

  // Fidelity needs the live rewriter and dies with stage0; freshness does not
  // and is what is left afterwards. A run with no rewriter says which of the two
  // it did, in its summary line rather than only on stderr, because the weaker
  // run is the one whose summary could otherwise be mistaken for the stronger.
  const live = options.fresh
    ? { error: "--fresh: the live rewriter was not asked for" }
    : await loadRewriter();
  if (live.error !== undefined && update) {
    process.stderr.write(`${live.error}\n  --update needs it: the store is generated, not written by hand\n`);
    return 2;
  }
  const rewriteProgram = live.rewriteProgram;
  if (rewriteProgram === undefined && !options.fresh) {
    process.stderr.write(
      `note: ${live.error}\n      so only the staleness guard runs, not the comparison.\n`
    );
  }
  // Imported here rather than at module scope: `lib.js` reads this file's store,
  // and a static import in both directions would evaluate one of them against
  // the other's uninitialised bindings.
  const { discoverPrograms } = await import("./lib.js");
  let programs = discoverPrograms({});
  if (only !== undefined) programs = programs.filter((p) => p.name.includes(only));
  if (programs.length === 0) {
    process.stderr.write(`no programs selected${only === undefined ? "" : ` by \`${only}\``}\n`);
    return 2;
  }

  if (update) {
    const produced = produceStore(rewriteProgram, programs);
    if (produced.error !== undefined) {
      process.stderr.write(`${produced.error}\n`);
      return 1;
    }
    fs.mkdirSync(path.dirname(STORE), { recursive: true });
    const before = fs.existsSync(STORE) ? fs.readFileSync(STORE, "utf8") : null;
    fs.writeFileSync(STORE, produced.text);
    const what = before === null ? "written" : before === produced.text ? "unchanged" : "updated";
    process.stdout.write(`rewrites: ${produced.note}, ${relative(STORE)} ${what}\n`);
    return 0;
  }

  const store = readStore();
  if (store.error !== undefined) {
    process.stdout.write(`  FAIL ${store.error}\n`);
    return 1;
  }

  let failed = 0;
  let stale = 0;
  let modules = 0;
  let agreed = 0;
  for (const prog of programs) {
    const record = store.programs.get(prog.name);
    if (record === undefined) {
      // A new corpus program: while stage0 lives this is one command away, and
      // after R6 it is a program with no differential coverage, which is a
      // decision to record rather than a file to write (§6).
      process.stdout.write(
        `  FAIL ${prog.name} has no frozen rewrite (run \`npm run test:update\` while stage0 exists)\n`
      );
      failed++;
      continue;
    }
    const why = staleness(record, prog, store.bodies);
    if (why !== null) {
      process.stdout.write(`  FAIL ${prog.name} is stale: ${why}\n`);
      process.stdout.write(
        "       the frozen rewrite is of a program that no longer exists; regenerate it\n"
      );
      failed++;
      stale++;
      continue;
    }
    if (rewriteProgram === undefined) {
      modules += record.modules.length + 1;
      agreed++;
      if (verbose) process.stdout.write(`  fresh ${prog.name} (${record.modules.length + 1} modules)\n`);
      continue;
    }
    const produced = produceOne(rewriteProgram, prog);
    if (produced.error !== undefined) {
      process.stdout.write(`  FAIL ${produced.error}\n`);
      failed++;
      continue;
    }
    const want = [...record.modules, record.entry];
    const got = [...produced.record.modules, produced.record.entry];
    let differed = false;
    if (want.length !== got.length) {
      process.stdout.write(
        `  FAIL ${prog.name} rewrites to ${got.length} modules and the store holds ${want.length}\n`
      );
      differed = true;
    }
    for (let i = 0; i < Math.min(want.length, got.length); i++) {
      modules++;
      if (want[i].out !== got[i].out) {
        process.stdout.write(
          `  FAIL ${prog.name}: module ${i + 1} is ${got[i].out}, stored as ${want[i].out}\n`
        );
        differed = true;
        continue;
      }
      if (want[i].id === got[i].id) continue;
      const d = diff(store.bodies.get(want[i].id), produced.bodies.get(got[i].id), limit);
      process.stdout.write(
        `  FAIL ${prog.name}: ${got[i].out} rewrites differently now (${d.total} line(s) differ)\n`
      );
      for (const line of d.out) process.stdout.write(`${line}\n`);
      if (d.shown < d.total) {
        process.stdout.write(`      ... and ${d.total - d.shown} more differing lines (--verbose for all)\n`);
      }
      differed = true;
    }
    if (differed) failed++;
    else agreed++;
    if (verbose && !differed) process.stdout.write(`  ok ${prog.name} (${got.length} modules)\n`);
  }

  const bytes = fs.statSync(STORE).size;
  const what = rewriteProgram === undefined ? "have a fresh frozen rewrite" : "agree with the live rewrite";
  process.stdout.write(
    `rewrites: ${agreed}/${programs.length} programs ${what}, ` +
      `${modules} modules, ${stale} stale, ${failed} failed, ${(bytes / 1024).toFixed(0)} KiB stored\n`
  );
  return failed === 0 ? 0 : 1;
};

export { loadRewriter, materialize, readStore, rewriteOptions, staleness, STORE };

// Started with `.then` rather than a top-level `await`: `lib.js` imports this
// file, and `main` imports `lib.js` back, so awaiting here would leave this
// module evaluating while it waited for a module that waits for it.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(e);
      process.exit(2);
    }
  );
}
