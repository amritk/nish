#!/usr/bin/env node
/**
 * The JavaScript every differential program rewrites to, checked in
 * (WP19 gate G2.4, `docs/wp19-stage0-retirement.md` §2B and §3).
 *
 *   node tests/differential/goldens.js              every program frozen and fresh, or registered
 *   node tests/differential/goldens.js corpus/i64   only the programs whose name contains that
 *   node tests/differential/goldens.js --fresh      the same (the spelling `tests/run.js` uses)
 *   node tests/differential/goldens.js --update     move what can no longer be frozen into the register
 *   node tests/differential/goldens.js --verbose
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
 * running from the store afterwards. The store was generated from the live
 * rewriter and verified against it on every `npm test` for as long as stage0
 * lived, so it records what the oracle actually compared and not what somebody
 * thought it compared.
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
 * **Freshness is the check, and it is all that is left.** Every program has a
 * record, each record's sources still hash to what they hashed, no record is
 * left over from a program that is gone, and the header's counts are the
 * store's own. While stage0 lived there was a second check, *fidelity*: the
 * whole store rebuilt from the live rewriter and compared byte for byte, which
 * is what caught a record naming the wrong file while holding that file's
 * hash. R6 took the rewriter, so the store is now trusted the way
 * `tests/cases/*.ll` is trusted: it was verified against its source on every
 * `npm test` up to the day the source was deleted.
 *
 * **The register: programs with no frozen rewrite.** Nothing can write a
 * rewrite any more, so a corpus program added after R6, or one whose source
 * has changed since it was frozen, has no reference to be compared against.
 * That is a decision to record, not a file to write (wp19 §6), and
 * `goldens/unfrozen.txt` is where it is recorded: one program per line, with
 * the reason. Every program is frozen-and-fresh or registered, never neither
 * and never both, and `tests/differential/run.js` names each registered
 * program in its output as not compared rather than leaving it out quietly.
 * `--update` is what writes it: a program with no record, or with a stale one,
 * is moved into the register (its stale record and any body only it used are
 * dropped), a record whose program is gone is dropped, and a register line
 * whose program is gone goes with it. Each move is printed, and the diff of
 * the register is the review.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Resolved without asking any module that might not survive R6. */
const root = path.resolve(import.meta.dirname, "..", "..");
const STORE = path.join(root, "tests", "differential", "goldens", "rewrites.txt");
const REGISTER = path.join(root, "tests", "differential", "goldens", "unfrozen.txt");

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

const header = (note) => [
  "# The JavaScript every differential program rewrites to, as stage0's checker typed it.",
  "# Generated by `npm run test:update` (or `node tests/differential/goldens.js --update`).",
  "# WP19 gate G2.4: the WP13 oracle's reference, written down before stage0 can take it.",
  "# Do not edit by hand — `goldens.js`'s header says what is keyed on what.",
  `# ${note}`,
];

/** The store's text with this checkout's path put back. */
const local = (text) => text.split(ROOT_TOKEN).join(root);

/** The store, parsed. Bodies are length-framed, so no line of JavaScript needs escaping. */
const readStore = () => {
  if (!fs.existsSync(STORE)) {
    return { error: `${relative(STORE)} is missing` };
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
 * The lines one record occupies in the store, as `readStore` reads them back:
 * `--update` rewrites the store from what it parsed, minus what it dropped.
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


/**
 * The store's text for these records, holding only the bodies they use, in the
 * order they were read. Rewriting an unchanged store gives back its own bytes.
 */
const storeText = (records, bodies) => {
  const used = new Set(records.flatMap((record) => [...record.modules.map((m) => m.id), record.entry.id]));
  const kept = new Map([...bodies].filter(([id]) => used.has(id)));
  const note = storeNote(records, kept);
  const lines = [...header(note)];
  for (const record of records) lines.push(...recordLines(record));
  for (const [id, text] of kept) {
    lines.push(`body ${id} ${text.split("\n").length} ${Buffer.byteLength(text)}`, text);
  }
  return { text: `${lines.join("\n")}\n`, note };
};

const REGISTER_HEADER = [
  "# Differential programs with no frozen rewrite, so nothing compares them against Node.",
  "# One `<program> <reason>` per line. `node tests/differential/goldens.js --update`",
  "# moves a program here when it has no record or its record went stale, and takes",
  "# a line out when its program is gone. The rewriter that wrote the store was",
  "# stage0's and is deleted, so a line here is coverage lost, not a task deferred:",
  "# the way back is a rewriter typed by stage1's `--emit-checked` (wp19 §6).",
];

/** The register: program name to the reason it has no frozen rewrite. */
const readRegister = () => {
  const rows = new Map();
  if (!fs.existsSync(REGISTER)) return rows;
  for (const line of fs.readFileSync(REGISTER, "utf8").split("\n")) {
    const text = line.replace(/^\s*#.*$/, "").trim();
    if (text.length === 0) continue;
    const at = text.search(/\s/);
    if (at < 0) rows.set(text, "");
    else rows.set(text.slice(0, at), text.slice(at).trim());
  }
  return rows;
};

const registerText = (rows) =>
  `${[...REGISTER_HEADER, ...[...rows].map(([name, why]) => (why.length > 0 ? `${name} ${why}` : name))].join("\n")}\n`;

const parse = (argv) => {
  const options = { update: false, verbose: false, only: undefined };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--update") options.update = true;
    // Freshness is the only check left, so `--fresh` asks for what every run
    // does; it stays a flag because `tests/run.js` passes it.
    else if (arg === "--fresh") continue;
    else if (arg === "--verbose") options.verbose = true;
    else if (arg === "--only") options.only = argv[++i];
    else if (!arg.startsWith("-") && options.only === undefined) options.only = arg;
    else return { error: `unknown option: ${arg}` };
  }
  return options;
};

/**
 * `--update`: bring the store and the register into agreement with the corpus
 * without writing a single rewrite, since nothing can write one any more.
 */
const update = (programs, store, register) => {
  const byName = new Map(programs.map((p) => [p.name, p]));
  const records = [];
  const moves = [];
  for (const [name, record] of store.programs) {
    const prog = byName.get(name);
    if (prog === undefined) {
      moves.push(`dropped the record of ${name}, which is not a program any more`);
      continue;
    }
    const why = staleness(record, prog, store.bodies);
    if (why === null) {
      records.push(record);
      continue;
    }
    register.set(name, `stale since R6: ${why}`);
    moves.push(`registered ${name}: its frozen rewrite is stale (${why})`);
  }
  const frozen = new Set(records.map((r) => r.name));
  for (const prog of programs) {
    if (frozen.has(prog.name) || register.has(prog.name)) continue;
    register.set(prog.name, "added after R6: no rewriter to freeze it with");
    moves.push(`registered ${prog.name}: it has no frozen rewrite`);
  }
  for (const name of [...register.keys()]) {
    if (byName.has(name) && !frozen.has(name)) continue;
    register.delete(name);
    moves.push(
      byName.has(name)
        ? `unregistered ${name}: it has a fresh frozen rewrite`
        : `unregistered ${name}, which is not a program any more`
    );
  }
  const { text, note } = storeText(records, store.bodies);
  const before = fs.readFileSync(STORE, "utf8");
  if (text !== before) fs.writeFileSync(STORE, text);
  const rows = new Map([...register].sort(([a], [b]) => a.localeCompare(b)));
  const registered = registerText(rows);
  const was = fs.existsSync(REGISTER) ? fs.readFileSync(REGISTER, "utf8") : null;
  if (registered !== was) fs.writeFileSync(REGISTER, registered);
  for (const move of moves) process.stdout.write(`  ${move}\n`);
  process.stdout.write(
    `rewrites: ${note}, ${relative(STORE)} ${text === before ? "unchanged" : "updated"}; ` +
      `${rows.size} registered, ${relative(REGISTER)} ${registered === was ? "unchanged" : "updated"}\n`
  );
  return 0;
};

const main = async (argv) => {
  const options = parse(argv);
  if (options.error !== undefined) {
    process.stderr.write(`${options.error}\n`);
    return 2;
  }
  const { verbose, only } = options;
  if (options.update && only !== undefined) {
    // The store is one file over the whole corpus, so a filtered update would
    // register every program the filter did not name as gone.
    process.stderr.write("--update rewrites the whole store; drop the filter\n");
    return 2;
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

  const store = readStore();
  if (store.error !== undefined) {
    process.stdout.write(`  FAIL ${store.error}\n`);
    return 1;
  }
  const register = readRegister();
  if (options.update) return update(programs, store, register);

  let failed = 0;
  let stale = 0;
  let modules = 0;
  let checked = 0;
  let registered = 0;
  const fail = (line) => {
    process.stdout.write(`  FAIL ${line}\n`);
    failed++;
  };

  // Every selected program has a fresh record or a line in the register --
  // exactly one of the two -- and nothing is stored for a program that is gone.
  for (const prog of programs) {
    const record = store.programs.get(prog.name);
    const listed = register.has(prog.name);
    if (record === undefined) {
      if (listed) {
        registered++;
        if (verbose) process.stdout.write(`  unfrozen ${prog.name}: ${register.get(prog.name)}\n`);
      } else {
        fail(
          `${prog.name} has no frozen rewrite and is not in ${relative(REGISTER)} ` +
            "(`node tests/differential/goldens.js --update` registers it)"
        );
      }
      continue;
    }
    if (listed) {
      fail(`${prog.name} has a frozen rewrite and a line in ${relative(REGISTER)}; remove the line`);
      continue;
    }
    const why = staleness(record, prog, store.bodies);
    if (why !== null) {
      fail(`${prog.name} is stale: ${why}`);
      process.stdout.write(
        "       the frozen rewrite is of a program that no longer exists; " +
          "`node tests/differential/goldens.js --update` moves it into the register\n"
      );
      stale++;
      continue;
    }
    checked++;
    modules += record.modules.length + 1;
    if (verbose) process.stdout.write(`  fresh ${prog.name} (${record.modules.length + 1} modules)\n`);
  }

  // A record or a register line with no program is the other direction of the
  // same question, and the one a loop over the corpus cannot see: deleting a
  // corpus program would otherwise take its coverage away with nothing named.
  if (only === undefined) {
    const live = new Set(programs.map((p) => p.name));
    for (const name of store.programs.keys()) {
      if (!live.has(name)) fail(`the store holds ${name}, which is not a program any more`);
    }
    for (const name of register.keys()) {
      if (!live.has(name)) fail(`${relative(REGISTER)} names ${name}, which is not a program any more`);
    }
  }

  // The header's counts, recomputed from what was parsed: the only thing
  // standing behind the store's own description of itself.
  const want = `# ${storeNote([...store.programs.values()], store.bodies)}`;
  const heading = store.heading.at(-1) ?? "";
  if (only === undefined && heading !== want) {
    fail("the store's header does not describe the store");
    process.stdout.write(`      header: ${heading}\n      actual: ${want}\n`);
  }

  const bytes = fs.statSync(STORE).size;
  process.stdout.write(
    `rewrites: ${checked}/${programs.length} programs fresh, ${registered} registered unfrozen, ` +
      `${modules} modules, ${stale} stale, ${failed} failed, ${(bytes / 1024).toFixed(0)} KiB stored\n`
  );
  return failed === 0 ? 0 : 1;
};

export { materialize, readRegister, readStore, staleness, REGISTER };

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
