/**
 * The golden-case runner, in Nish.
 *
 *     build/nish-runner [substring]
 *
 * `tests/run.js` is the suite of record and this is not a replacement for it: it
 * covers section A, the golden cases in `tests/cases/`, and none of the pipeline
 * checks — no interop sidecars, no layout assertions, no wasm profiles, no
 * packaging, no self-hosting oracles, and none of the fourteen flag variations
 * `tests/self/parity.js` runs. What it is, is a demonstration that the language
 * can host its own harness: discovery, subprocesses, captured output and a
 * report, with no Node in the program.
 *
 * It is also the only thing in the repository that exercises `readdirSync`,
 * `spawnSyncTo` and `monotonicNanos` together on a real workload rather than in a
 * case written to pin one rule, which is why `tests/run.js` builds and runs it
 * over a handful of cases on every suite run.
 *
 * Per case `<name>.ts` in `tests/cases/`:
 *
 *   - `<name>.err` present  the compile must fail with status 1 and stderr must
 *                           contain every non-blank line of the file
 *   - otherwise              the compile must succeed, and the emitted IR must
 *                           equal `<name>.ll` once the module header is stripped
 *   - `<name>.out` present   the case is linked and run, and its stdout compared
 *   - `<name>.args` present  its contents are extra compiler flags
 *
 * A case whose sidecars this runner does not implement (`.env`, `.argv`,
 * `.stdout`) is skipped by name rather than passed over in silence: a skip that
 * is counted is a to-do list, and one that is not is a green run that proved
 * less than it looks (`.claude/testing.md`).
 */
import { Suite } from "../../std/testing";
import { firstDifference, replaceAll, splitLines, splitWhitespace, trim } from "../../std/text";

const CASES: string = "tests/cases";
const WORK: string = "build/nish-cases";
const CLI: string = "dist/index.js";
const REGISTER: string = "tests/self/stage1_only.txt";

/**
 * `producer: "nish <version>"` in place of the real version, which is what
 * `tests/run.js` does to both sides of a `-g` comparison: the producer string
 * carries the release number, so without this every `-g` golden would have to be
 * regenerated at each release — and the release commit, the one that bumps the
 * version, would be red at itself.
 *
 * One replacement is enough because a module has exactly one `DICompileUnit`,
 * and building a string in a loop is the shape this language asks you not to
 * write (`.claude/typescript.md`).
 */
const normaliseProducer = (ir: string): string => {
  const marker = 'producer: "nish ';
  const at = ir.indexOf(marker);
  if (at < 0) {
    return ir;
  }
  const from = at + marker.length;
  const tail = ir.substring(from, ir.length);
  const quote = tail.indexOf(`"`);
  if (quote < 0) {
    return ir;
  }
  return `${ir.substring(0, from)}<version>${tail.substring(quote, tail.length)}`;
};

/** The module body with the `; ModuleID` / `source_filename` header removed, as `tests/run.js` strips it. */
const stripHeader = (ir: string): string[] => {
  const kept: string[] = [];
  for (const line of splitLines(normaliseProducer(ir))) {
    if (line.startsWith(";") || line.startsWith("source_filename")) {
      continue;
    }
    kept.push(line);
  }
  // Leading and trailing blank lines are not content: the golden was trimmed.
  return splitLines(trim(kept.join("\n")));
};

/** Whether the program declares its own entry, in either spelling (WP22). */
const hasEntry = (source: string): boolean =>
  source.indexOf("export const main") >= 0 || source.indexOf("export function main") >= 0;

/**
 * The case names of the stage1-only register (`tests/self/stage1_only.txt`,
 * WP19 §1a). This runner spawns stage0, and a registered case is one stage0
 * has no implementation of, so it is skipped by name here rather than failed:
 * `tests/run.js` compiles those with a stage1 binary, which this runner has no
 * way to build.
 */
const stage1OnlyNames = (): string[] => {
  const names: string[] = [];
  const text = readFileSyncOrNull(REGISTER);
  if (text === null) {
    return names;
  }
  for (const line of splitLines(text)) {
    const entry = trim(line);
    if (entry.length === 0 || entry.startsWith("#")) {
      continue;
    }
    const fields = splitWhitespace(entry);
    if (fields.length > 0) {
      names.push(fields[0]);
    }
  }
  return names;
};

/** Whether `name` is one of `names`: the language has no `Array.includes`. */
const includesName = (names: string[], name: string): boolean => {
  for (const candidate of names) {
    if (candidate === name) {
      return true;
    }
  }
  return false;
};

/** Every `<name>.ts` in `tests/cases`, sorted, with the extension removed. */
const caseNames = (): string[] => {
  const entries = readdirSync(CASES);
  if (entries === null) {
    panic(`cannot list ${CASES} (run this from the repository root)`);
  }
  const names: string[] = [];
  for (const entry of entries) {
    if (entry.endsWith(".ts")) {
      names.push(entry.substring(0, entry.length - 3));
    }
  }
  return names;
};

export const main = (): number => {
  // One filter argument, matched as a substring, the way `node tests/run.js <sub>` does.
  const filter = process.argv.length > 1 ? process.argv[1] : "";
  mkdirSync("build");
  if (!mkdirSync(WORK)) {
    panic(`cannot create ${WORK}`);
  }
  // Both streams go to files rather than being inherited: the probe is this
  // runner's business and not part of its report.
  const hasClang =
    spawnSyncTo(["clang", "--version"], `${WORK}/clang.out`, `${WORK}/clang.err`) === 0;

  const started = monotonicNanos();
  const t = new Suite("golden cases");
  if (!hasClang) {
    t.skip("native round trips", "clang not found");
  }

  const stage1OnlyCases = stage1OnlyNames();
  for (const name of caseNames()) {
    if (filter.length > 0 && name.indexOf(filter) < 0) {
      continue;
    }
    if (includesName(stage1OnlyCases, name)) {
      t.skip(name, "stage1-only (tests/self/stage1_only.txt): this runner spawns stage0");
      continue;
    }
    const source = readFileSyncOrNull(`${CASES}/${name}.ts`);
    if (source === null) {
      t.fail(name, "the source disappeared between the listing and the read");
      continue;
    }
    // Sidecars this runner does not implement yet. Named, and counted.
    if (readFileSyncOrNull(`${CASES}/${name}.env`) !== null) {
      t.skip(name, "`.env` is not implemented: the language has no setenv");
      continue;
    }
    if (readFileSyncOrNull(`${CASES}/${name}.argv`) !== null) {
      t.skip(name, "`.argv` is not implemented");
      continue;
    }
    if (readFileSyncOrNull(`${CASES}/${name}.stdout`) !== null) {
      t.skip(name, "`.stdout` (a dump flag) is not implemented");
      continue;
    }

    const irPath = `${WORK}/${name}.ll`;
    const compileErr = `${WORK}/${name}.compile.err`;
    const argv: string[] = ["node", CLI, `${CASES}/${name}.ts`, "-o", irPath];
    const args = readFileSyncOrNull(`${CASES}/${name}.args`);
    if (args !== null) {
      for (const flag of splitWhitespace(args)) {
        argv.push(flag);
      }
    }
    const status = spawnSyncTo(argv, "", compileErr);
    const stderrText = readFileSyncOrNull(compileErr);
    const diagnostics = stderrText === null ? "" : stderrText;

    const expectedErr = readFileSyncOrNull(`${CASES}/${name}.err`);
    if (expectedErr !== null) {
      if (status !== 1) {
        t.fail(name, `expected the compile to fail with 1, got ${status}`);
        continue;
      }
      let missing = "";
      for (const fragment of splitLines(expectedErr)) {
        const wanted = trim(fragment);
        if (wanted.length > 0 && diagnostics.indexOf(wanted) < 0) {
          missing = wanted;
        }
      }
      if (missing.length > 0) {
        t.fail(name, `stderr does not contain "${missing}"`);
      } else {
        t.pass(name);
      }
      continue;
    }

    if (status !== 0) {
      t.fail(name, `the compile failed with ${status}: ${trim(diagnostics)}`);
      continue;
    }
    const golden = readFileSyncOrNull(`${CASES}/${name}.ll`);
    const emitted = readFileSyncOrNull(irPath);
    if (emitted === null) {
      t.fail(name, `the compiler wrote no ${irPath}`);
      continue;
    }
    if (golden === null) {
      // A case with no golden is not a failure here: `npm run test:update` owns
      // writing one, and this runner must never write into `tests/cases`.
      t.skip(name, "no .ll golden (run `npm run test:update`)");
    } else {
      // The goldens were written by a harness that compiles with an absolute
      // source path and folds the repository root down to `<root>`. This runner
      // compiles with relative paths — there is no `cwd` builtin to build an
      // absolute one from — so the placeholder is what has to go, and the two
      // sides then say the same thing about the same file (`dbg_locals`, whose
      // `-g` DIFile is the only place the path reaches the IR).
      const want = stripHeader(replaceAll(golden, "<root>/", ""));
      const got = stripHeader(emitted);
      const at = firstDifference(want, got);
      if (at < 0) {
        t.pass(name);
      } else {
        const wantLine = at < want.length ? want[at] : "<end of golden>";
        const gotLine = at < got.length ? got[at] : "<end of output>";
        t.fail(name, `IR line ${at + 1}: golden "${wantLine}", emitted "${gotLine}"`);
      }
    }

    const expectedOut = readFileSyncOrNull(`${CASES}/${name}.out`);
    if (expectedOut === null || !hasClang) {
      continue;
    }
    const exe = `${WORK}/${name}.exe`;
    const link: string[] = ["clang", "-Wno-override-module", "-O2", irPath];
    if (!hasEntry(source)) {
      // `<name>.c` is the case's own driver when it has one, and `tests/driver.c`
      // — which prints `test()` as an `int` — otherwise. A case compiled with
      // `--number-mode f64` needs its own, because `test()` returns a double
      // there and reading that as an `int` prints a number from another planet
      // (`tests/cases/str_f64_mode.c` is exactly that driver).
      const own = `${CASES}/${name}.c`;
      link.push(readFileSyncOrNull(own) === null ? "tests/driver.c" : own);
    }
    link.push("runtime/runtime.c");
    link.push("-lm");
    link.push("-o");
    link.push(exe);
    if (spawnSyncTo(link, "", `${WORK}/${name}.link.err`) !== 0) {
      t.fail(`${name}: links`, "clang refused the emitted IR");
      continue;
    }
    const stdoutPath = `${WORK}/${name}.stdout`;
    const ran = spawnSyncTo([exe], stdoutPath, `${WORK}/${name}.run.err`);
    const printed = readFileSyncOrNull(stdoutPath);
    if (printed === null) {
      t.fail(`${name}: runs`, "nothing was captured");
      continue;
    }
    if (ran !== 0) {
      t.fail(`${name}: runs`, `exited ${ran}`);
      continue;
    }
    t.eqStr(`${name}: stdout`, trim(printed), trim(expectedOut));
  }

  const elapsed = (monotonicNanos() - started) / toI64(1000000);
  console.log(`${elapsed} ms`);
  return t.done();
};
