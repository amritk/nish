#!/usr/bin/env node
/**
 * The JavaScript every differential program rewrites to, checked in
 * (WP19 gate G2.4, `docs/wp19-stage0-retirement.md` §2B and §3).
 *
 *   node tests/differential/goldens.js              the store against the live rewrite, byte for byte
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
 * takes the rewriter with it, and with it 176 programs of semantic comparison.
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
 * function of. Truncation to 64 bits is enough for the failure freshness is
 * against, which is a forgotten regeneration. `<name>.argv` and `<name>.env`
 * are deliberately *not* hashed: they are read live and handed to both sides of
 * the comparison, so changing one moves the native run and the Node run
 * together and neither side goes stale. Neither is `runtime/shim.mjs`, which
 * every rewritten module imports: an edit there changes what Node *does* rather
 * than what the rewrite *says*, so the comparison catches it loudly on the next
 * run — the same way it would with a live rewriter, and the safe direction.
 *
 * **Two checks, and only one of them outlives stage0.**
 *
 *   - **Fidelity**, in verify mode: the whole store is rebuilt from the live
 *     rewriter and compared to the file **byte for byte**, the way
 *     `tests/self/goldens.js` compares its four. That is deliberate rather than
 *     convenient. A comparison field by field is a comparison of the fields
 *     somebody remembered: this one compared `out` and the body id and left
 *     `source` and `srcHash` checked by nothing, so a record could name a
 *     module the rewrite never came from — with that module's own hash beside
 *     it, so freshness agreed — and both halves passed. Rebuilding the text
 *     leaves no column to forget, and it is also what makes an orphan record
 *     and a fabricated one visible.
 *   - **Freshness**, everywhere the store is read, including after R6: every
 *     program has a record, each record's sources still hash to what they
 *     hashed, no record is left over from a program that is gone, and the
 *     header's counts are the store's own. What it cannot do is notice that a
 *     record names the wrong file while holding that file's hash; nothing
 *     short of the rewriter can, which is why the byte comparison runs on every
 *     `npm test` for as long as there is a stage0 to run it. After that the
 *     store is trusted the way `tests/cases/*.ll` is trusted.
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
 * them. Nothing else in a rewritten module is absolute — measured over all 358
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
  const dir = path.join(WORK, prog.name.replace(/[\\/]/g, "_"));
  fs.rmSync(dir, { recursive: true, force: true });
  let rewritten;
  try {
    rewritten = rewriteProgram(prog.entry, rewriteOptions(prog.args), dir);
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
    const source = relative(rewritten.sources[i]);
    // A record line is space-separated, and a path with a space in it would
    // read back as two fields. No corpus program has one; this is what makes
    // that a refusal rather than a silently mangled record.
    if (source.includes(" ") || out.includes(" ")) {
      return { error: `${prog.name}: \`${source}\` has a space in its path, which the store cannot hold` };
    }
    // The bytes, not the UTF-8 decode re-encoded: the guard is about the file
    // on disk, and `readFileSync` with an encoding would answer for a lossy
    // round trip of it instead.
    modules.push({ id, out, source, srcHash: digest(fs.readFileSync(rewritten.sources[i])) });
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
  const heading = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("#")) {
      // Only the lines before the first record: a `#` inside a body is
      // JavaScript, and a body's lines are consumed by count below.
      if (programs.size === 0) heading.push(line);
      continue;
    }
    if (line.length === 0) continue;
    if (line.startsWith("program ")) {
      current = { name: line.slice("program ".length), flags: [], modules: [], entry: null };
      programs.set(current.name, current);
      continue;
    }
    if (line.startsWith("  ") && current === null) {
      return { error: `${relative(STORE)}:${i + 1}: a record's field before any \`program\` line` };
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
  return { programs, bodies, heading };
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
    const now = digest(fs.readFileSync(file));
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

/**
 * The lines one record occupies in the store. Factored out because a verify has
 * to be able to rebuild them: comparing a record field by field is how the
 * `source` and `srcHash` columns came to be compared by nothing at all, and a
 * record whose text is rebuilt has no columns to forget.
 */
const recordLines = (record) => {
  const lines = [`program ${record.name}`];
  if (record.flags.length > 0) lines.push(`  flags ${record.flags.join(" ")}`);
  for (const module of record.modules) {
    lines.push(`  module ${module.srcHash} ${module.source} ${module.id} ${module.out}`);
  }
  lines.push(`  entry ${record.entry.id} ${record.entry.out}`);
  return lines;
};

/**
 * The header's own count of what the store holds, derived from the store rather
 * than written beside it. A verify recomputes this from what it parsed and
 * requires the line to match, so the summary at the top of the file is a claim
 * with a check behind it instead of a decoration a hand edit can rewrite.
 */
const storeNote = (records, bodies) => {
  let live = 0;
  let moduleCount = 0;
  for (const record of records) {
    for (const module of record.modules) live += Buffer.byteLength(bodies.get(module.id) ?? "");
    live += Buffer.byteLength(bodies.get(record.entry.id) ?? "");
    moduleCount += record.modules.length + 1;
  }
  let stored = 0;
  for (const text of bodies.values()) stored += Buffer.byteLength(text);
  return (
    `${records.length} programs, ${moduleCount} modules, ${bodies.size} distinct ` +
    `(${(live / 1024).toFixed(1)} KiB live, ${(stored / 1024).toFixed(1)} KiB stored)`
  );
};

/** The store's text for every program, in corpus order. */
const produceStore = (rewriteProgram, programs) => {
  const records = [];
  const bodies = new Map();
  for (const prog of programs) {
    const produced = produceOne(rewriteProgram, prog);
    if (produced.error !== undefined) return { error: produced.error };
    records.push(produced.record);
    for (const [id, text] of produced.bodies) bodies.set(id, text);
  }
  const note = storeNote(records, bodies);
  const lines = [...header(note)];
  for (const record of records) lines.push(...recordLines(record));
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
  let checked = 0;

  // ---- Freshness: the half that outlives stage0 ----------------------------
  // Every selected program has a record, that record's sources still hash to
  // what they hashed, and nothing is stored for a program that is not there.
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
    checked++;
    modules += record.modules.length + 1;
    if (verbose) process.stdout.write(`  fresh ${prog.name} (${record.modules.length + 1} modules)\n`);
  }

  // A record with no program is the other direction of the same question, and
  // the one a loop over the corpus cannot see: deleting a corpus program would
  // otherwise take its coverage away with nothing named and exit 0.
  if (only === undefined) {
    const live = new Set(programs.map((p) => p.name));
    for (const name of store.programs.keys()) {
      if (live.has(name)) continue;
      process.stdout.write(`  FAIL the store holds ${name}, which is not a program any more\n`);
      failed++;
    }
  }

  // The header's counts, recomputed from what was parsed. Cheap, and it is the
  // only thing standing behind the store's own description of itself once the
  // comparison below cannot run.
  const want = `# ${storeNote([...store.programs.values()], store.bodies)}`;
  const heading = store.heading.at(-1) ?? "";
  if (only === undefined && heading !== want) {
    process.stdout.write(`  FAIL the store's header does not describe the store\n`);
    process.stdout.write(`      header: ${heading}\n      actual: ${want}\n`);
    failed++;
  }

  // ---- Fidelity: the half that dies with stage0 ----------------------------
  // The whole file, rebuilt from the live rewriter and compared byte for byte,
  // which is what `tests/self/goldens.js` does and the only form that leaves no
  // column uncompared: a field-by-field comparison had `source` and `srcHash`
  // checked by nothing, so a record could name a module the rewrite never came
  // from and both halves would pass.
  // What the summary says about this half, so that a check name carrying the
  // summary says which of the two runs happened rather than asserting the
  // stronger one. A run that proved something weaker than its summary line
  // suggests is worse than a run that refused.
  let fidelity =
    rewriteProgram === undefined
      ? "store comparison skipped (no rewriter)"
      : "store comparison skipped (filtered)";
  if (rewriteProgram !== undefined) {
    if (only !== undefined) {
      process.stdout.write(
        `  note: the store is one file, so the byte comparison needs the whole corpus; \`${only}\` ran the freshness half only\n`
      );
    } else {
      const produced = produceStore(rewriteProgram, programs);
      if (produced.error !== undefined) {
        process.stdout.write(`  FAIL ${produced.error}\n`);
        failed++;
      } else {
        fidelity = "the store is byte-identical to the live rewrite";
        const have = fs.readFileSync(STORE, "utf8");
        if (have !== produced.text) {
          fidelity = "the store differs from the live rewrite";
          const d = diff(have, produced.text, limit);
          process.stdout.write(
            `  FAIL ${relative(STORE)} is not what the rewriter produces now (${d.total} line(s) differ)\n`
          );
          for (const line of d.out) process.stdout.write(`${line}\n`);
          if (d.shown < d.total) {
            process.stdout.write(
              `      ... and ${d.total - d.shown} more differing lines (--verbose for all)\n`
            );
          }
          failed++;
        }
      }
    }
  }

  const bytes = fs.statSync(STORE).size;
  process.stdout.write(
    `rewrites: ${checked}/${programs.length} programs fresh, ${fidelity}, ` +
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
