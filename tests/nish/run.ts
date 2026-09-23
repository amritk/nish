/**
 * The golden-case runner, in Nish.
 *
 *     build/nish-runner [substring] [--compiler <nish>]
 *
 * The compiler under test defaults to `build/nish`, what `npm run build` leaves
 * behind; `--compiler <nish>` names another. A Node entry point (`.js`, `.mjs`,
 * `.cjs`) runs under `node` and anything else directly, the rule
 * `NISH_BOOTSTRAP` follows in `scripts/bootstrap.sh`.
 *
 * `tests/run.js` is the suite of record and this is not a replacement for it: it
 * covers section A, the golden cases in `tests/cases/`, and the `tests/link/`
 * programs, and none of the pipeline checks — no interop sidecars, no layout
 * assertions, no wasm profiles, no packaging, no differential rewrite, no
 * self-hosting checks. What it is, is a demonstration that the language
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
 *   - `<name>.err` present     the compile must fail with status 1 and stderr must
 *                              contain every non-blank line of the file
 *   - `<name>.stdout` present  a dump flag: the *compiler's* stdout is the golden
 *                              and no IR is written, so nothing else runs
 *   - otherwise                the compile must succeed, and the emitted IR must
 *                              equal `<name>.ll` once the module header is stripped
 *   - `<name>.args` present    its contents are extra compiler flags
 *   - `<name>.out` present     the case is linked and run, and its stdout compared
 *   - `<name>.argv` present    command-line arguments for that run
 *   - `<name>.env` present     the environment for that run, layered over the
 *                              inherited one through `env(1)`
 *
 * Every case that emitted IR is also assembled with `llvm-as` and verified with
 * `opt -passes=verify`, which is the difference between proving the IR equals a
 * golden and proving it is *valid*: a golden that was wrong the day it was
 * written would satisfy the first claim forever.
 *
 * Then every `tests/link/<name>/` program — `main.ts` is the entry, `args` is its
 * extra flags — compiled module by module, assembled and verified the same way,
 * and checked against `expected.err` for a program that must be refused, or
 * `expected.code`, `expected.out`, `expected.ir` and any per-module
 * `<module>.ll` golden for one that must not be.
 *
 * Four things are skipped rather than passed over in silence, because a skip that
 * is counted is a to-do list and one that is not is a green run that proved less
 * than it looks (`.claude/testing.md`):
 *
 *   - a case with no `.ll` golden, because writing one is `npm run test:update`'s
 *     job and this runner must never write into `tests/cases`
 *   - the native round trips, when `clang` is missing
 *   - the assembly and the verify, when `llvm-as` or `opt` is missing
 *   - a `.env` case, when `env(1)` is missing or does not honour `-u`
 *
 * Two checks `tests/run.js` makes over the same files are still not made here:
 * the cross-module `declare` / `define` attribute agreement, which wants a
 * regular expression over the IR that this language does not have, and
 * `UPDATE_GOLDENS`, which this runner deliberately cannot do.
 */
import { Suite } from "../../std/testing";
import { replaceAll, splitLines, splitWhitespace, trim } from "../../std/text";

const CASES: string = "tests/cases";
const LINKS: string = "tests/link";
const WORK: string = "build/nish-cases";
/** `tests/run.js`'s own build directory, which some cases write into by that literal path. */
const CASE_WORK: string = "build/test";
const LINK_WORK: string = "build/nish-link";
/** The compiler nobody named: the one `npm run build` leaves behind. */
const DEFAULT_CLI: string = "build/nish";
/** How many of the slowest cases the closing report names. */
const SLOWEST: i32 = 5;

/**
 * Which external tools this run found.
 *
 * They are probed once and passed down rather than asked about per case: four
 * hundred cases would otherwise spawn four hundred processes to learn something
 * that cannot change while the run is in progress.
 */
class Tools {
  /** The argv prefix that runs the compiler under test: `["node", "<entry>.js"]`, or just a binary. */
  compiler: string[];
  clang: boolean;
  llvmAs: boolean;
  opt: boolean;
  /** `env(1)`, and specifically an `env` that honours `-u`. See `hasEnvTool`. */
  env: boolean;

  constructor(clang: boolean, llvmAs: boolean, opt: boolean, env: boolean, compiler: string) {
    this.clang = clang;
    this.llvmAs = llvmAs;
    this.opt = opt;
    this.env = env;
    const node = compiler.endsWith(".js") || compiler.endsWith(".mjs") || compiler.endsWith(".cjs");
    this.compiler = node ? ["node", compiler] : [compiler];
  }
}

/** The compiler's argv prefix followed by `args`: one compile's whole command line. */
const compilerArgv = (tools: Tools, args: string[]): string[] => {
  const argv: string[] = [];
  for (const part of tools.compiler) {
    argv.push(part);
  }
  for (const arg of args) {
    argv.push(arg);
  }
  return argv;
};

/**
 * The slowest cases, kept as an insertion-sorted top `SLOWEST` rather than by
 * sorting the whole corpus at the end: a comparator cannot be passed to a sort
 * here (a function is not a value), and for five elements the insertion *is* the
 * whole algorithm. A run that takes four and a half minutes should say where the
 * time went, which is the only reason `monotonicNanos` is read per case at all.
 */
class Slowest {
  names: string[];
  nanos: i64[];

  constructor() {
    this.names = [];
    this.nanos = [];
  }

  record(name: string, elapsed: i64): void {
    // Descending, so the insertion point is the first entry this one beats.
    let at: i32 = this.nanos.length;
    while (at > 0 && this.nanos[at - 1] < elapsed) {
      at -= 1;
    }
    if (at >= SLOWEST) {
      return;
    }
    // Grow by one, shift the tail down, then write the hole. There is no
    // `splice`, and a second array copied element by element would be the same
    // loop with an allocation in front of it.
    this.names.push(name);
    this.nanos.push(elapsed);
    let i: i32 = this.names.length - 1;
    while (i > at) {
      this.names[i] = this.names[i - 1];
      this.nanos[i] = this.nanos[i - 1];
      i -= 1;
    }
    this.names[at] = name;
    this.nanos[at] = elapsed;
    if (this.names.length > SLOWEST) {
      this.names.pop();
      this.nanos.pop();
    }
  }

  report(): void {
    if (this.names.length === 0) {
      return;
    }
    const parts: string[] = [];
    let i: i32 = 0;
    while (i < this.names.length) {
      parts.push(`${this.names[i]} ${this.nanos[i] / toI64(1000000)} ms`);
      i += 1;
    }
    console.log(`slowest: ${parts.join(", ")}`);
  }
}

/**
 * The file's contents, or `""` when it is not there. For a captured stderr that
 * is only ever going to be quoted in a failure detail, "missing" and "empty"
 * mean the same thing; a sidecar whose *presence* is the question is read with
 * `readFileSyncOrNull` directly instead.
 */
const readOrEmpty = (path: string): string => {
  const text = readFileSyncOrNull(path);
  return text === null ? "" : text;
};

/**
 * Whether `tool --version` answers 0, which is this runner's `which`. Both
 * streams go to files because the probe is the runner's own business and not
 * part of its report.
 */
const probe = (tool: string): boolean =>
  spawnSyncTo([tool, "--version"], `${WORK}/${tool}.probe.out`, `${WORK}/${tool}.probe.err`) === 0;

/**
 * Whether `env(1)` is here and honours `-u`.
 *
 * `<name>.env` looks impossible in a language with no `setenv`, and it is not:
 * POSIX `env` sets — and with `-u` unsets — variables for a child without a
 * shell, so the environment a case asks for is just a prefix on the argv the
 * runner already builds. `-u` is the half worth probing, because the bare-`NAME`
 * form of a `.env` file is an *unset* and nothing else can express it; the probe
 * runs `env` under itself so that one utility answers both halves of the
 * question and `--version`, which is GNU-only, stays out of it.
 */
const hasEnvTool = (): boolean =>
  spawnSyncTo(["env", "-u", "NISH_ENV_PROBE", "env"], `${WORK}/env.probe.out`, `${WORK}/env.probe.err`) ===
  0;

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

/** Every `tests/link/<name>/` that holds a `main.ts`, sorted — the entry is what makes it a case. */
const linkNames = (): string[] => {
  const entries = readdirSync(LINKS);
  if (entries === null) {
    panic(`cannot list ${LINKS} (run this from the repository root)`);
  }
  const names: string[] = [];
  for (const entry of entries) {
    if (readFileSyncOrNull(`${LINKS}/${entry}/main.ts`) !== null) {
      names.push(entry);
    }
  }
  return names;
};

/**
 * `env(1)` arguments that layer a `.env` file over the inherited environment,
 * with the semantics `caseEnv` in `tests/run.js` defines: blank lines and `#`
 * comments are ignored, `NAME=value` sets, `NAME=` sets an *empty but set*
 * value, and a bare `NAME` takes the variable away.
 *
 * A name that appears twice takes its last line, because that is what assigning
 * into an object twice does on the Node side. The unsets are emitted before the
 * assignments for a reason that is `env`'s and not this file's: POSIX `env`
 * stops reading options at the first operand, so a `-u` after a `NAME=value`
 * would be read as the command to run.
 */
const envPrefix = (spec: string): string[] => {
  const names: string[] = [];
  // The `NAME=value` text to hand `env`, or `""` for a name to unset. `NAME=`
  // is never `""` here, so the empty string is an unambiguous "take it away".
  const settings: string[] = [];
  for (const line of splitLines(spec)) {
    const text = trim(line);
    if (text.length === 0 || text.startsWith("#")) {
      continue;
    }
    const eq = text.indexOf("=");
    if (eq === 0) {
      // `=value` names no variable; `tests/run.js` drops it and so does this.
      continue;
    }
    const name = eq < 0 ? text : text.substring(0, eq);
    const setting = eq < 0 ? "" : text;
    let seen: i32 = -1;
    let j: i32 = 0;
    while (j < names.length) {
      if (names[j] === name) {
        seen = j;
      }
      j += 1;
    }
    if (seen < 0) {
      names.push(name);
      settings.push(setting);
    } else {
      settings[seen] = setting;
    }
  }
  const argv: string[] = ["env"];
  let i: i32 = 0;
  while (i < names.length) {
    if (settings[i].length === 0) {
      argv.push("-u");
      argv.push(names[i]);
    }
    i += 1;
  }
  i = 0;
  while (i < names.length) {
    if (settings[i].length > 0) {
      argv.push(settings[i]);
    }
    i += 1;
  }
  return argv;
};

/**
 * `llvm-as` and `opt -passes=verify` over one emitted module.
 *
 * Both are what make the runner say something about the IR rather than only
 * about the golden: `llvm-as` proves the text parses as LLVM assembly and
 * `opt -passes=verify` proves the module satisfies the verifier's invariants,
 * neither of which a line-by-line comparison with a checked-in file can. Each is
 * gated on its tool, and `main` reports a missing one once as a counted skip
 * rather than once per case.
 */
const verifyIR = (t: Suite, tools: Tools, label: string, irPath: string, errBase: string): void => {
  if (tools.llvmAs) {
    const asErr = `${errBase}.as.err`;
    if (spawnSyncTo(["llvm-as", irPath, "-o", "/dev/null"], "", asErr) === 0) {
      t.pass(`${label}: llvm-as accepts IR`);
    } else {
      t.fail(`${label}: llvm-as accepts IR`, trim(readOrEmpty(asErr)));
    }
  }
  if (tools.opt) {
    const optErr = `${errBase}.opt.err`;
    if (spawnSyncTo(["opt", "-passes=verify", "-disable-output", irPath], "", optErr) === 0) {
      t.pass(`${label}: opt -passes=verify accepts IR`);
    } else {
      t.fail(`${label}: opt -passes=verify accepts IR`, trim(readOrEmpty(optErr)));
    }
  }
};

/** One `tests/cases/<name>.ts` and every sidecar beside it. */
const runGoldenCase = (t: Suite, tools: Tools, name: string): void => {
  const source = readFileSyncOrNull(`${CASES}/${name}.ts`);
  if (source === null) {
    t.fail(name, "the source disappeared between the listing and the read");
    return;
  }

  const irPath = `${WORK}/${name}.ll`;
  const compileOut = `${WORK}/${name}.compile.out`;
  const compileErr = `${WORK}/${name}.compile.err`;
  const argv = compilerArgv(tools, [`${CASES}/${name}.ts`, "-o", irPath]);
  // `--threads` is the one compiler flag that also changes how the case is
  // *linked*: the IR then reaches for a `_Thread_local` arena, which only
  // `runtime.c` compiled with `-DNISH_THREADS=1` defines (WP20 T0). Reading it
  // out of the same `.args` the compile reads is what keeps the two in step.
  let threaded = false;
  const args = readFileSyncOrNull(`${CASES}/${name}.args`);
  if (args !== null) {
    for (const flag of splitWhitespace(args)) {
      if (flag === "--threads") {
        threaded = true;
      }
      argv.push(flag);
    }
  }
  // The compiler's stdout goes to a file rather than being inherited, for two
  // reasons at once: a dump flag's golden *is* that stream, and every other
  // case's `wrote ...` line would otherwise land in the middle of the report.
  const status = spawnSyncTo(argv, compileOut, compileErr);
  const diagnostics = readOrEmpty(compileErr);

  const expectedErr = readFileSyncOrNull(`${CASES}/${name}.err`);
  if (expectedErr !== null) {
    if (status !== 1) {
      t.fail(name, `expected the compile to fail with 1, got ${status}`);
      return;
    }
    // One fragment per line, and `containsAll` ignores the blank ones, which is
    // why the file needs no filtering here beyond the trim.
    const fragments: string[] = [];
    for (const fragment of splitLines(expectedErr)) {
      fragments.push(trim(fragment));
    }
    t.containsAll(name, diagnostics, fragments);
    return;
  }

  if (status !== 0) {
    t.fail(name, `the compile failed with ${status}: ${trim(diagnostics)}`);
    return;
  }

  const expectedDump = readFileSyncOrNull(`${CASES}/${name}.stdout`);
  if (expectedDump !== null) {
    // A dump flag (`--emit-ast`, `--emit-checked`) answers on stdout and writes
    // no IR at all, so everything below has nothing to work on: there is no
    // `.ll` to compare, nothing to assemble and nothing to link.
    t.eqStr(`${name}: dump matches .stdout`, trim(readOrEmpty(compileOut)), trim(expectedDump));
    return;
  }

  const golden = readFileSyncOrNull(`${CASES}/${name}.ll`);
  const emitted = readFileSyncOrNull(irPath);
  if (emitted === null) {
    t.fail(name, `the compiler wrote no ${irPath}`);
    return;
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
    t.eqLines(name, stripHeader(emitted), stripHeader(replaceAll(golden, "<root>/", "")));
  }

  verifyIR(t, tools, name, irPath, `${WORK}/${name}`);

  const expectedOut = readFileSyncOrNull(`${CASES}/${name}.out`);
  if (expectedOut === null || !tools.clang) {
    return;
  }
  const envSpec = readFileSyncOrNull(`${CASES}/${name}.env`);
  if (envSpec !== null && !tools.env) {
    t.skip(`${name}: stdout`, "`.env` needs an env(1) with -u, and the probe did not find one");
    return;
  }

  const exe = `${WORK}/${name}.exe`;
  const link: string[] = ["clang", "-Wno-override-module", "-O2"];
  if (threaded) {
    link.push("-DNISH_THREADS=1");
    link.push("-pthread");
  }
  link.push(irPath);
  if (!hasEntry(source)) {
    // `<name>.c` is the case's own driver when it has one, and `tests/driver.c`
    // — which prints `test()` as an `int` — otherwise. A case compiled with
    // `--number-mode f64` needs its own, because `test()` returns a double
    // there and reading that as an `int` prints a number from another planet
    // (`tests/cases/str_f64_mode.c` is exactly that driver).
    const own = `${CASES}/${name}.c`;
    link.push(readFileSyncOrNull(own) === null ? "tests/driver.c" : own);
  }
  // The C runtime is two translation units: the core (arena, strings, arrays,
  // number formatting, the panics) and the syscall wrappers, split apart so each
  // carries its own size budget. A direct `clang` line names both; only
  // `scripts/build.sh` pairs them for its callers.
  link.push("runtime/runtime.c");
  link.push("runtime/runtime_os.c");
  link.push("-lm");
  link.push("-o");
  link.push(exe);
  if (spawnSyncTo(link, "", `${WORK}/${name}.link.err`) !== 0) {
    t.fail(`${name}: links`, "clang refused the emitted IR");
    return;
  }

  // `env NAME=value ... exe arg ...`: the environment is a prefix and the
  // arguments are a suffix of one argv, so both sidecars are the same mechanism.
  const runArgv: string[] = [];
  if (envSpec !== null) {
    for (const arg of envPrefix(envSpec)) {
      runArgv.push(arg);
    }
  }
  runArgv.push(exe);
  const argvSpec = readFileSyncOrNull(`${CASES}/${name}.argv`);
  if (argvSpec !== null) {
    for (const arg of splitWhitespace(argvSpec)) {
      runArgv.push(arg);
    }
  }
  const stdoutPath = `${WORK}/${name}.stdout`;
  const ran = spawnSyncTo(runArgv, stdoutPath, `${WORK}/${name}.run.err`);
  const printed = readFileSyncOrNull(stdoutPath);
  if (printed === null) {
    t.fail(`${name}: runs`, "nothing was captured");
    return;
  }
  if (ran !== 0) {
    t.fail(`${name}: runs`, `exited ${ran}`);
    return;
  }
  t.eqStr(`${name}: stdout`, trim(printed), trim(expectedOut));
};

/**
 * One `tests/link/<name>/` program: `main.ts` is the entry, the whole program is
 * compiled to one `.ll` per module and — when clang is here — linked into a
 * binary whose exit code and stdout are the golden.
 *
 * It is its own loop rather than a variation on the golden one because almost
 * nothing is shared: the sidecars have different names, `expected.err` is one
 * needle rather than one per line, the goldens are per module, and the assertion
 * is the process's exit *code* rather than a `test()` return value a driver
 * prints.
 */
const runLinkCase = (t: Suite, tools: Tools, name: string): void => {
  const dir = `${LINKS}/${name}`;
  const outDir = `${LINK_WORK}/${name}`;
  const label = `link/${name}`;
  if (!mkdirSync(outDir)) {
    t.fail(label, `cannot create ${outDir}`);
    return;
  }
  const exe = `${outDir}/app`;
  const argv = compilerArgv(tools, [`${dir}/main.ts`, "-o", `${outDir}/`]);
  if (tools.clang) {
    argv.push("--link");
    argv.push(exe);
  }
  const args = readFileSyncOrNull(`${dir}/args`);
  if (args !== null) {
    for (const flag of splitWhitespace(args)) {
      argv.push(flag);
    }
  }
  const work = `${WORK}/link_${name}`;
  const status = spawnSyncTo(argv, `${work}.compile.out`, `${work}.compile.err`);
  const diagnostics = readOrEmpty(`${work}.compile.err`);

  const expectedErr = readFileSyncOrNull(`${dir}/expected.err`);
  if (expectedErr !== null) {
    if (status !== 1) {
      t.fail(label, `expected the compile to fail with 1, got ${status}`);
    } else {
      t.contains(label, diagnostics, trim(expectedErr));
    }
    return;
  }
  if (status !== 0) {
    t.fail(label, `the compile failed with ${status}: ${trim(diagnostics)}`);
    return;
  }

  const entries = readdirSync(outDir);
  if (entries === null) {
    t.fail(label, `the compiler wrote no ${outDir}`);
    return;
  }
  // Every module's text, so that `expected.ir` can be a substring question about
  // the program rather than about whichever file happens to hold the line.
  const all: string[] = [];
  for (const file of entries) {
    if (!file.endsWith(".ll")) {
      continue;
    }
    const emitted = readOrEmpty(`${outDir}/${file}`);
    all.push(emitted);
    const golden = readFileSyncOrNull(`${dir}/${file}`);
    if (golden !== null) {
      t.eqLines(`${label}: ${file} matches golden`, stripHeader(emitted), stripHeader(golden));
    }
    verifyIR(t, tools, `${label}: ${file}`, `${outDir}/${file}`, `${work}_${file}`);
  }

  const expectedIR = readFileSyncOrNull(`${dir}/expected.ir`);
  if (expectedIR !== null) {
    const wanted: string[] = [];
    for (const line of splitLines(expectedIR)) {
      wanted.push(trim(line));
    }
    t.containsAll(`${label}: emitted IR contains every expected.ir line`, all.join("\n"), wanted);
  }

  if (!tools.clang) {
    return;
  }
  const expectedCode = readFileSyncOrNull(`${dir}/expected.code`);
  if (expectedCode === null) {
    t.fail(label, "there is no expected.code, so the program's exit code is unpinned");
    return;
  }
  const stdoutPath = `${work}.run.out`;
  const ran = spawnSyncTo([exe], stdoutPath, `${work}.run.err`);
  const wantedCode = parseInt(trim(expectedCode));
  // The exit code first: a program that died somewhere else printed something
  // else too, and reporting both would name the symptom twice.
  if (!t.eqI32(`${label}: exits with ${wantedCode}`, ran, wantedCode)) {
    return;
  }
  // A missing `expected.out` means no output, which is what most of these
  // programs have: they return a number from `main` and print nothing.
  t.eqStr(`${label}: stdout`, trim(readOrEmpty(stdoutPath)), trim(readOrEmpty(`${dir}/expected.out`)));
};

export const main = (): number => {
  // One filter argument, matched as a substring, the way `node tests/run.js <sub>` does,
  // and `--compiler <nish>` anywhere around it.
  let filter = "";
  let compiler = DEFAULT_CLI;
  let i = 1;
  while (i < process.argv.length) {
    if (process.argv[i] === "--compiler") {
      if (i + 1 >= process.argv.length) {
        panic("--compiler needs a path");
      }
      compiler = process.argv[i + 1];
      i = i + 2;
    } else {
      filter = process.argv[i];
      i = i + 1;
    }
  }
  if (readFileSyncOrNull(compiler) === null) {
    panic(`cannot read the compiler ${compiler} (run this from the repository root, after \`npm run build\`)`);
  }
  mkdirSync("build");
  if (!mkdirSync(WORK)) {
    panic(`cannot create ${WORK}`);
  }
  // `build/test` is not this runner's directory — it is `tests/run.js`'s, which
  // creates it before running anything. Several cases write into it by that
  // literal path (`io_files`, `io_mkdir`, `io_streams`), so a harness that runs
  // them has to provide it or they fail at their first `writeFileSync`. This
  // runner passed for days on a tree where an earlier `npm test` had left the
  // directory behind, and failed the moment CI ran it on a clean checkout.
  if (!mkdirSync(CASE_WORK)) {
    panic(`cannot create ${CASE_WORK}`);
  }
  // The link work directory starts empty, because a stale module left by an
  // earlier run would be listed, assembled, verified and — if a `<module>.ll`
  // golden names it — compared as though this run had emitted it. `rm -rf` is
  // the tool for that here for the same reason `env(1)` answers `.env`: a POSIX
  // utility stands in for the builtin the language does not have.
  const cleaned = spawnSyncTo(["rm", "-rf", LINK_WORK], `${WORK}/rm.out`, `${WORK}/rm.err`) === 0;
  const linkReady = cleaned && mkdirSync(LINK_WORK);

  const tools = new Tools(probe("clang"), probe("llvm-as"), probe("opt"), hasEnvTool(), compiler);

  const started = monotonicNanos();
  const t = new Suite("golden cases");
  if (!tools.clang) {
    t.skip("native round trips", "clang not found");
  }
  if (!tools.llvmAs) {
    t.skip("llvm-as accepts the emitted IR", "llvm-as not found");
  }
  if (!tools.opt) {
    t.skip("opt -passes=verify accepts the emitted IR", "opt not found");
  }

  const slow = new Slowest();
  for (const name of caseNames()) {
    if (filter.length > 0 && name.indexOf(filter) < 0) {
      continue;
    }
    const at = monotonicNanos();
    runGoldenCase(t, tools, name);
    slow.record(name, monotonicNanos() - at);
  }

  if (!linkReady) {
    t.skip("tests/link programs", `cannot empty ${LINK_WORK}, and a stale module would read as this run's`);
  } else {
    for (const name of linkNames()) {
      if (filter.length > 0 && name.indexOf(filter) < 0) {
        continue;
      }
      const at = monotonicNanos();
      runLinkCase(t, tools, name);
      slow.record(`link/${name}`, monotonicNanos() - at);
    }
  }

  const elapsed = (monotonicNanos() - started) / toI64(1000000);
  slow.report();
  console.log(`${elapsed} ms`);
  return t.done();
};
