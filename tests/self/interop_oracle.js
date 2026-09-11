/**
 * The WP8 interop oracle: the sidecars stage1 writes are the sidecars stage0
 * writes, byte for byte (docs/wp14-selfhost.md §6 rule 3).
 *
 *   node tests/self/interop_oracle.js              the interop corpus
 *   node tests/self/interop_oracle.js --all        every whole program in the tree
 *   node tests/self/interop_oracle.js <file>...    just those files
 *   node tests/self/interop_oracle.js --verbose    name every skip
 *   node tests/self/interop_oracle.js --diff       print the first differing line
 *
 * Both compilers are given the same entry path and the same sidecar paths, so
 * there is nothing to normalise: the banner names the entry, the include guard
 * and the loader comment are derived from the sidecar's basename, and
 * everything else is the generators' own text. Four files are compared per
 * program — `<stem>.h`, `<stem>.d.ts`, its companion `<stem>.mjs`, and
 * `<stem>.napi.c` — because `--emit-dts` writes two.
 *
 * A skip is a fact about the port, never a file that is allowed to disagree:
 *
 *   - stage0 rejects the program, so there is nothing to compare against;
 *   - stage1 rejects it, which is counted and named apart from the other
 *     skips because it is remaining work rather than a decision.
 *
 * The default corpus is the one the WP8 section of `tests/run.js` drives the
 * generators over — the header, `.d.ts`, loader and N-API checks there all
 * read these programs — plus the layout program, whose header is the widest
 * struct declaration the generators ever write, and the three `interop_*.ts`
 * fixtures, which exist only because the narrow numeric widths have a reader
 * and a writer each and nothing else here mentions them: inside a packed
 * `Result` in `interop_payloads.ts`, at a plain parameter and return for the
 * N-API shim in `interop_widths.ts`, and as bare parameters and results for
 * the wasm loader's masks in `interop_unsigned.ts`. `--all` runs the same
 * comparison over every whole program the IR oracle reads, which is how a
 * shape nobody thought to put in the corpus gets found.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(import.meta.dirname, "..", "..");
const cli = path.join(root, "dist", "index.js");

/**
 * The interop corpus: an entry, the stem its sidecars are named after (the
 * basename by default), and the flags both compilers get. `export_strict.ts`
 * carries `--strict-exports` because what it proves is that an internal
 * function stays out of the header, and `nbody.ts` carries `--number-mode f64`
 * because that is the mode it compiles in at all.
 */
const CORPUS = [
  { file: "examples/add.ts" },
  { file: "examples/argv.ts" },
  { file: "examples/arrays.ts" },
  { file: "examples/hello.ts" },
  { file: "examples/math.ts" },
  // f64 mode, so `number` reaches the header as `double` rather than `int32_t`.
  { file: "examples/nbody.ts", flags: ["--number-mode", "f64"] },
  { file: "examples/strings.ts" },
  { file: "examples/multi/main.ts", stem: "multi" },
  { file: "tests/cases/export_fn.ts" },
  { file: "tests/cases/export_strict.ts", flags: ["--strict-exports"] },
  { file: "tests/cases/res_export.ts" },
  // The narrow `Result` payloads nothing else in the corpus mentions: `f32`,
  // `u8`, `u16`, `u32`, and the loader's bit-view helpers they pull in.
  { file: "tests/self/interop_payloads.ts" },
  // The same widths at a plain parameter and return, where the N-API shim
  // narrows what N-API has no getter for and emits its `nish_napi_f32` helper.
  { file: "tests/self/interop_widths.ts" },
  // Every unsigned width as a bare parameter and result, which is where the
  // loader's masks live; the WP8 section of tests/run.js builds this one to
  // wasm and calls it.
  { file: "tests/self/interop_unsigned.ts" },
  { file: "tests/layout/structs.ts", stem: "layout_structs" },
];

/** Flags that change the IR and that stage1 accepts; anything else is a skip. */
const SHARED_FLAGS = new Set([
  "--plain",
  "--strict-exports",
  "--unchecked-indexing",
  "--nsw",
  // Both of these are stage1's and have been since WP14 §7a; they were left
  // out of this set when they were stage0's alone, and a skip is silent, so
  // four programs of the corpus stopped being compared without anyone
  // deciding that (WP19 G1).
  "--wrapping",
  "--no-strict-exports",
  "--no-stack-alloc",
  "--runtime-decls",
]);
const VALUE_FLAGS = new Set(["--number-mode", "--target"]);

/** The `.args` of a case, split into what both compilers take and what stage1 cannot. */
const argsFor = (file) => {
  const argsFile = file.replace(/\.ts$/, ".args");
  if (!fs.existsSync(argsFile)) return { flags: [], unsupported: [] };
  const raw = fs.readFileSync(argsFile, "utf8").trim().split(/\s+/).filter(Boolean);
  const flags = [];
  const unsupported = [];
  for (let i = 0; i < raw.length; i++) {
    if (SHARED_FLAGS.has(raw[i])) flags.push(raw[i]);
    else if (VALUE_FLAGS.has(raw[i])) flags.push(raw[i], raw[++i]);
    else unsupported.push(raw[i]);
  }
  return { flags, unsupported };
};

/** The sidecar names of one program, in the order the drivers write them. */
const sidecars = (dir, stem) =>
  [`${stem}.h`, `${stem}.d.ts`, `${stem}.mjs`, `${stem}.napi.c`].map((n) => path.join(dir, n));

/** `--emit-header <dir>/<stem>.h ...`: the flags that ask for all four files. */
const emitFlags = (dir, stem) => [
  "--emit-header",
  path.join(dir, `${stem}.h`),
  "--emit-dts",
  path.join(dir, `${stem}.d.ts`),
  "--emit-napi",
  path.join(dir, `${stem}.napi.c`),
];

const fresh = (dir) => {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const compare = (binary, work, entry) => {
  const file = path.join(root, entry.file);
  if (!fs.existsSync(file)) return { skipped: "no such file" };
  const { flags, unsupported } = argsFor(file);
  if (unsupported.length > 0) return { skipped: `stage1 has no ${unsupported.join(" ")}` };
  const all = [...flags, ...(entry.flags ?? [])];
  const stem = entry.stem ?? path.basename(entry.file, ".ts");
  // Both sides name each module by the path they resolved it to, and the
  // banner of every sidecar carries the entry's, so the two must be spelled
  // the same. The sidecar basenames are shared too: the include guard and the
  // loader's comment are derived from them.
  const named = path.relative(root, file);
  const dir0 = fresh(path.join(work, "stage0"));
  const dir1 = fresh(path.join(work, "stage1"));

  const stage0 = spawnSync("node", [cli, named, "-o", `${dir0}/`, ...all, ...emitFlags(dir0, stem)], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (stage0.status !== 0) return { skipped: "stage0 rejects it" };

  const stage1 = spawnSync(binary, [...all, named, "-o", `${dir1}/`, ...emitFlags(dir1, stem)], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (stage1.status !== 0) {
    const first = stage1.stderr.trim().split("\n")[0] ?? `exit ${stage1.status}`;
    return { rejected: first };
  }

  const want = sidecars(dir0, stem);
  const got = sidecars(dir1, stem);
  let bytes = 0;
  for (let i = 0; i < want.length; i++) {
    const name = path.basename(want[i]);
    if (!fs.existsSync(want[i])) return { failed: `stage0 wrote no ${name}` };
    if (!fs.existsSync(got[i])) return { failed: `ours wrote no ${name}` };
    const a = fs.readFileSync(want[i], "utf8");
    const b = fs.readFileSync(got[i], "utf8");
    if (a === b) {
      bytes += a.length;
      continue;
    }
    const wantLines = a.split("\n");
    const gotLines = b.split("\n");
    for (let l = 0; l < Math.max(wantLines.length, gotLines.length); l++) {
      if (wantLines[l] !== gotLines[l]) {
        return {
          failed: `${name} line ${l + 1}: ours \`${gotLines[l] ?? "<end>"}\`, stage0 \`${wantLines[l] ?? "<end>"}\``,
        };
      }
    }
    return { failed: `${name}: the texts differ but no line does` };
  }
  return { bytes, files: want.length };
};

/** Every whole program the IR oracle reads, for `--all`. */
const wideCorpus = () => {
  const dirs = [
    path.join(root, "tests", "cases"),
    path.join(root, "examples"),
    path.join(root, "self"),
    path.join(root, "docs", "cookbook"),
    path.join(root, "bench"),
    path.join(root, "tests", "parser"),
    path.join(root, "tests", "layout"),
  ];
  const files = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      if (!name.endsWith(".ts")) continue;
      const file = path.join(dir, name);
      // A `.err` case is a rejection: there are no sidecars on either side.
      if (fs.existsSync(file.replace(/\.ts$/, ".err"))) continue;
      files.push({ file: path.relative(root, file), stem: path.basename(name, ".ts") });
    }
  }
  const linkDir = path.join(root, "tests", "link");
  if (fs.existsSync(linkDir)) {
    for (const name of fs.readdirSync(linkDir).sort()) {
      const main = path.join(linkDir, name, "main.ts");
      if (fs.existsSync(main)) files.push({ file: path.relative(root, main), stem: name });
    }
  }
  return files;
};

const build = () => {
  const out = path.join(root, "build", "self", "compile");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const r = spawnSync("node", [cli, path.join(root, "self", "compile.ts"), "--link", out], {
    cwd: root,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    process.stderr.write(`${r.stderr}\n`);
    return null;
  }
  return out;
};

const main = (argv) => {
  const verbose = argv.includes("--verbose");
  const showDiff = argv.includes("--diff");
  const named = argv.filter((a) => !a.startsWith("--"));
  const binary = build();
  if (binary === null) return 1;
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "nish-interop-"));
  let inputs = CORPUS;
  if (argv.includes("--all")) inputs = wideCorpus();
  if (named.length > 0)
    inputs = named.map((f) => ({
      file: path.relative(root, path.resolve(f)),
      stem: path.basename(f, ".ts"),
    }));

  let agreed = 0;
  let files = 0;
  let bytes = 0;
  const skipped = [];
  const rejected = [];
  const failed = [];
  for (const entry of inputs) {
    const result = compare(binary, work, entry);
    if (result.skipped !== undefined) skipped.push(`${entry.file}: ${result.skipped}`);
    else if (result.rejected !== undefined) rejected.push(`${entry.file}: ${result.rejected}`);
    else if (result.failed !== undefined) failed.push(`${entry.file}: ${result.failed}`);
    else {
      agreed++;
      files += result.files;
      bytes += result.bytes;
    }
  }
  fs.rmSync(work, { recursive: true, force: true });
  for (const f of failed) process.stdout.write(`  FAIL ${f}\n`);
  if (verbose || showDiff) {
    for (const r of rejected) process.stdout.write(`  reject ${r}\n`);
  }
  if (verbose) {
    for (const s of skipped) process.stdout.write(`  skip ${s}\n`);
  }
  const compared = inputs.length - skipped.length - rejected.length;
  // Rejections are counted apart from the other skips and named in the
  // summary: a program stage0 writes sidecars for and stage1 refuses is
  // remaining work, and it must not be able to hide inside a skip count.
  const note = rejected.length > 0 ? `, ${rejected.length} rejected by stage1` : "";
  process.stdout.write(
    `${agreed}/${compared} programs agree (${files} sidecars, ${bytes} bytes), ${skipped.length} skipped${note}\n`
  );
  return failed.length === 0 && rejected.length === 0 ? 0 : 1;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
export { compare, CORPUS, build };
