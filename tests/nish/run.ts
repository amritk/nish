/**
 * The golden-case runner, in Nish.
 *
 *     build/nish-runner [substring] [--compiler <nish>] [--shard <i>/<n>] [--jobs <p>]
 *
 * The compiler under test defaults to `build/nish`, what `npm run build` leaves
 * behind; `--compiler <nish>` names another. A Node entry point (`.js`, `.mjs`,
 * `.cjs`) runs under `node` and anything else directly, the rule
 * `NISH_BOOTSTRAP` follows in `scripts/bootstrap.sh`. `--shard <i>/<n>` runs the
`i`th of `n` slices of the selected cases and link programs, dealt round-robin
over one list, so `n` CI jobs share the corpus between them.
 *
 * `--jobs <p>` runs that slice as `p` processes, one per core by default (at
 * most 8; at most 64 when given). Every check is a `spawnSyncTo` the runner
 * waits on, so one process leaves all but one core idle; with `p` above 1 the
 * runner starts itself `p` times through `spawn` instead, on the slices `i`,
 * `i + n`, ..., `i + n(p - 1)` of `n·p`. An item lands in one of those exactly
 * when its position is `i - 1` modulo `n`, which is the set `--shard i/n` names
 * alone, so `--jobs` changes how long a slice takes and never what it checks.
 * Each child keeps its work under `build/nish-runner-jobs/<slice>-of-<total>/`
 * (`--work <dir>`, the child's own flag, refused beside `--jobs` above 1),
 * its output is printed whole in slice order once it and every slice before
 * it are done, and the last line is the summary summed over them, so a
 * `tail -n 1` reads it as one run's.
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
 * `<module>.ll` golden for one that must not be. It links under the profile
 * `tests/run.js` gives it: `--profile debug` unless `tests/speed-link.txt`
 * names it or its `args` name a profile.
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
/** `tests/run.js`'s own build directory, which some cases write into by that literal path. */
const CASE_WORK: string = "build/test";
/** Where `--jobs` children keep their work, one directory per slice. */
const JOB_WORK: string = "build/nish-runner-jobs";
/** The `tests/link` programs that keep the speed profile; see `speedLinkNames`. */
const SPEED_LINK: string = "tests/speed-link.txt";
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
  /** This process's scratch files for the golden cases. */
  work: string;
  /** This process's link work directory, one subdirectory per program. */
  linkWork: string;

  constructor(
    clang: boolean,
    llvmAs: boolean,
    opt: boolean,
    env: boolean,
    compiler: string,
    work: string,
    linkWork: string,
  ) {
    this.work = work;
    this.linkWork = linkWork;
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
const probe = (work: string, tool: string): boolean =>
  spawnSyncTo([tool, "--version"], `${work}/${tool}.probe.out`, `${work}/${tool}.probe.err`) === 0;

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
const hasEnvTool = (work: string): boolean =>
  spawnSyncTo(["env", "-u", "NISH_ENV_PROBE", "env"], `${work}/env.probe.out`, `${work}/env.probe.err`) ===
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

  const irPath = `${tools.work}/${name}.ll`;
  const compileOut = `${tools.work}/${name}.compile.out`;
  const compileErr = `${tools.work}/${name}.compile.err`;
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

  verifyIR(t, tools, name, irPath, `${tools.work}/${name}`);

  const expectedOut = readFileSyncOrNull(`${CASES}/${name}.out`);
  if (expectedOut === null || !tools.clang) {
    return;
  }
  const envSpec = readFileSyncOrNull(`${CASES}/${name}.env`);
  if (envSpec !== null && !tools.env) {
    t.skip(`${name}: stdout`, "`.env` needs an env(1) with -u, and the probe did not find one");
    return;
  }

  const exe = `${tools.work}/${name}.exe`;
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
  // The C runtime is several translation units: the core (arena, strings,
  // arrays, number formatting, the panics), the syscall wrappers, the worker
  // pool (its sequential fallback without `-pthread`, linked for the CPU count
  // `--sandbox` primes), the host calls (the wall clock, entropy, file times,
  // signals), the sockets of `nish:net`, the byte searches that read a vector
  // at a time, AES-GCM on the CPU's AES instructions, CRC-32 on its CRC
  // instructions, the stdin and terminal calls of `nish:term`, the byte-class
  // runs of `nish/bytes` and the `--sandbox` confinement, split apart so each
  // carries its own size budget.
  // A direct `clang` line names them; only `scripts/build.sh` pairs them for
  // its callers.
  link.push("runtime/runtime.c");
  link.push("runtime/runtime-os.c");
  link.push("runtime/runtime-parallel.c");
  link.push("runtime/runtime-host.c");
  link.push("runtime/runtime-net.c");
  link.push("runtime/runtime-simd.c");
  link.push("runtime/runtime-aes.c");
  link.push("runtime/runtime-checksum.c");
  link.push("runtime/runtime-term.c");
  link.push("runtime/runtime-bytes.c");
  link.push("runtime/runtime-sandbox.c");
  link.push("-lm");
  link.push("-o");
  link.push(exe);
  if (spawnSyncTo(link, "", `${tools.work}/${name}.link.err`) !== 0) {
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
  const stdoutPath = `${tools.work}/${name}.stdout`;
  const ran = spawnSyncTo(runArgv, stdoutPath, `${tools.work}/${name}.run.err`);
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
 * The programs `tests/speed-link.txt` names: the first word of every line that
 * is neither blank nor a `#` comment. The rest of a line is its reason, for the
 * reader of that file.
 */
const speedLinkNames = (): string[] => {
  const text = readFileSyncOrNull(SPEED_LINK);
  if (text === null) {
    panic(`cannot read ${SPEED_LINK} (run this from the repository root)`);
  }
  const names: string[] = [];
  for (const line of splitLines(text)) {
    const words = splitWhitespace(line);
    if (words.length > 0 && !words[0].startsWith("#")) {
      names.push(words[0]);
    }
  }
  return names;
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
const runLinkCase = (t: Suite, tools: Tools, speedLink: string[], name: string): void => {
  const dir = `${LINKS}/${name}`;
  const outDir = `${tools.linkWork}/${name}`;
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
  const flags: string[] = args === null ? [] : splitWhitespace(args);
  for (const flag of flags) {
    argv.push(flag);
  }
  // `linkProfile` in tests/run.js: an unoptimised link is about a third of
  // the speed one's time, and the profile never changes a byte of the IR.
  if (tools.clang && flags.indexOf("--profile") < 0 && speedLink.indexOf(name) < 0) {
    argv.push("--profile");
    argv.push("debug");
  }
  const work = `${tools.work}/link_${name}`;
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

/**
 * Whether `name` is one of the cases that share a file under `CASE_WORK` by
 * literal path: both write `build/test/io_nish_import.txt`. Processes share
 * `CASE_WORK`, so these are dealt one position between them and always land
 * in the same process. (A module constant cannot be an array.)
 */
const sharesAFile = (name: string): boolean => name === "io_nish_import" || name === "io_nish_import_global";

/**
 * The counts of the last `golden cases: N passed, N failed, N skipped` line a
 * child printed, as `[passed, failed, skipped]`, or `[]` when it printed none
 * — a child that panicked or was killed before its report.
 */
const summaryOf = (output: string): i32[] => {
  const prefix = "golden cases: ";
  let found = "";
  for (const line of splitLines(output)) {
    if (line.startsWith(prefix) && line.endsWith(" skipped")) {
      found = line.substring(prefix.length, line.length);
    }
  }
  if (found.length === 0) {
    return [];
  }
  // `parseInt` stops at the first non-digit, so "12 passed, ..." reads as 12
  // and each count is read from just past the comma before it.
  const counts: i32[] = [parseInt(found)];
  let rest = found;
  while (counts.length < 3) {
    const comma = rest.indexOf(", ");
    if (comma < 0) {
      return [];
    }
    rest = rest.substring(comma + 2, rest.length);
    counts.push(parseInt(rest));
  }
  return counts;
};

/**
 * `--jobs` above 1: this runner, started once per slice and reaped as each
 * finishes, with each child's output printed whole and in slice order and the
 * summed summary last.
 *
 * `spawn` inherits the parent's streams and redirects none, so each child is
 * started through `sh -c` with its two streams sent to files — the same
 * stand-in for a missing builtin that `env(1)` is for `.env`. The script takes
 * the two paths as its first arguments and `exec`s the rest, so no argument is
 * ever spliced into shell text.
 */
const runJobs = (filter: string, compiler: string, shard: i32, shards: i32, jobs: i32): number => {
  if (!mkdirSync(JOB_WORK)) {
    panic(`cannot create ${JOB_WORK}`);
  }
  const total = shards * jobs;
  const redirect = 'out=$1; err=$2; shift 2; exec "$@" >"$out" 2>"$err"';
  const slices: i32[] = [];
  const dirs: string[] = [];
  const pids: i32[] = [];
  const statuses: i32[] = [];
  const finished: boolean[] = [];
  let running: i32 = 0;
  let p: i32 = 0;
  while (p < jobs) {
    const slice = shard + shards * p;
    // Named by slice and total, so the two halves of one corpus can run at once.
    const dir = `${JOB_WORK}/${slice}-of-${total}`;
    const argv: string[] = ["sh", "-c", redirect, "sh", `${dir}/out`, `${dir}/err`, process.argv[0]];
    if (filter.length > 0) {
      argv.push(filter);
    }
    for (const arg of ["--compiler", compiler, "--shard", `${slice}/${total}`, "--jobs", "1", "--work", dir]) {
      argv.push(arg);
    }
    // `spawn` answers a pid or a negative errno; 0 stands for a directory that could not be made.
    const pid = mkdirSync(dir) ? spawn(argv) : 0;
    slices.push(slice);
    dirs.push(dir);
    pids.push(pid);
    // A child that never started is finished already, and its files, if any, are an earlier run's.
    statuses.push(0);
    finished.push(pid <= 0);
    if (pid > 0) {
      running += 1;
    }
    p += 1;
  }

  const outputs: string[] = [];
  let printed: i32 = 0;
  while (printed < jobs) {
    if (finished[printed]) {
      const ran = pids[printed] > 0;
      const out = ran ? readOrEmpty(`${dirs[printed]}/out`) : "";
      const err = ran ? readOrEmpty(`${dirs[printed]}/err`) : "";
      write(`--- slice ${slices[printed]}/${total}\n${out}${err}`);
      outputs.push(out);
      printed += 1;
      continue;
    }
    if (running === 0) {
      panic("a child is unfinished and none is running");
    }
    const reaped = waitPid(-1, 0);
    // -EINTR (4 on Linux and macOS): a signal interrupted the wait, and the children run on.
    if (reaped[0] === -4) {
      continue;
    }
    if (reaped[0] < 0) {
      panic(`waitPid failed with ${reaped[0]} while ${running} children were running`);
    }
    let at: i32 = 0;
    while (at < jobs) {
      if (pids[at] === reaped[0] && !finished[at]) {
        statuses[at] = reaped[1];
        finished[at] = true;
        running -= 1;
      }
      at += 1;
    }
  }

  let passed: i32 = 0;
  let failed: i32 = 0;
  let skipped: i32 = 0;
  let broken: i32 = 0;
  p = 0;
  while (p < jobs) {
    const counts = summaryOf(outputs[p]);
    const label = `slice ${slices[p]}/${total}`;
    if (pids[p] === 0) {
      console.log(`FAIL  ${label} did not start: cannot create ${dirs[p]}`);
      broken += 1;
    } else if (pids[p] < 0) {
      console.log(`FAIL  ${label} did not start: spawn answered ${pids[p]}`);
      broken += 1;
    } else if (counts.length === 0) {
      console.log(`FAIL  ${label} printed no summary (exit ${statuses[p]})`);
      broken += 1;
    } else {
      passed += counts[0];
      failed += counts[1];
      skipped += counts[2];
      // A child that failed a check exits 1, and its summary already counts it.
      if (statuses[p] !== 0 && counts[1] === 0) {
        console.log(`FAIL  ${label} exited ${statuses[p]} with no failed check`);
        broken += 1;
      }
    }
    p += 1;
  }
  console.log(`golden cases: ${passed} passed, ${failed + broken} failed, ${skipped} skipped`);
  return failed + broken > 0 ? 1 : 0;
};

export const main = (): number => {
  // One filter argument, matched as a substring, the way `node tests/run.js <sub>` does,
  // and `--compiler <nish>` anywhere around it.
  let filter = "";
  let compiler = DEFAULT_CLI;
  // `--shard <i>/<n>`: this run takes every `n`th selected program, starting
  // from the `i`th, counting cases and link programs as one list. Dealt rather
  // than cut into runs, so the slow `crypto_*` link programs land in different
  // slices instead of all in the last one.
  let shard: i32 = 1;
  let shards: i32 = 1;
  const cores = availableParallelism();
  let jobs: i32 = cores < 8 ? cores : 8;
  let base = "build";
  let workGiven = false;
  let i = 1;
  while (i < process.argv.length) {
    if (process.argv[i] === "--compiler") {
      if (i + 1 >= process.argv.length) {
        panic("--compiler needs a path");
      }
      compiler = process.argv[i + 1];
      i = i + 2;
    } else if (process.argv[i] === "--shard") {
      if (i + 1 >= process.argv.length) {
        panic("--shard needs <i>/<n>");
      }
      const spec = process.argv[i + 1];
      const slash = spec.indexOf("/");
      shard = slash > 0 ? parseInt(spec.substring(0, slash)) : 0;
      shards = slash > 0 ? parseInt(spec.substring(slash + 1)) : 0;
      // `parseInt` answers 0 for no digits, so one range check refuses a
      // missing number as well as one out of range.
      if (shards < 1 || shard < 1 || shard > shards) {
        panic(`--shard wants <i>/<n> with 1 <= i <= n, not ${spec}`);
      }
      i = i + 2;
    } else if (process.argv[i] === "--jobs") {
      if (i + 1 >= process.argv.length) {
        panic("--jobs needs a count");
      }
      jobs = parseInt(process.argv[i + 1]);
      if (jobs < 1 || jobs > 64) {
        panic(`--jobs wants a count from 1 to 64, not ${process.argv[i + 1]}`);
      }
      i = i + 2;
    } else if (process.argv[i] === "--work") {
      if (i + 1 >= process.argv.length) {
        panic("--work needs a directory");
      }
      base = process.argv[i + 1];
      workGiven = true;
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
  if (jobs > 1 && workGiven) {
    panic(`--work names one process's directory; pass --jobs 1 with it (--jobs ${jobs} keeps each under ${JOB_WORK})`);
  }
  if (jobs > 1) {
    return runJobs(filter, compiler, shard, shards, jobs);
  }
  const work = `${base}/nish-cases`;
  const linkWork = `${base}/nish-link`;
  if (!mkdirSync(base) || !mkdirSync(work)) {
    panic(`cannot create ${work}`);
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
  const cleaned = spawnSyncTo(["rm", "-rf", linkWork], `${work}/rm.out`, `${work}/rm.err`) === 0;
  const linkReady = cleaned && mkdirSync(linkWork);

  const tools = new Tools(
    probe(work, "clang"),
    probe(work, "llvm-as"),
    probe(work, "opt"),
    hasEnvTool(work),
    compiler,
    work,
    linkWork,
  );

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
  // The position in the selected list, which decides the shard: counted after
  // the filter, so a filtered run still splits evenly. It depends on nothing
  // but the list, so a `--jobs` child dealt `slice/total` and this process
  // dealt `shard/shards` agree on every position.
  let dealt: i32 = 0;
  // The position the first case `sharesAFile` names was dealt, which the second reuses.
  let sharedAt: i32 = -1;
  for (const name of caseNames()) {
    if (filter.length > 0 && name.indexOf(filter) < 0) {
      continue;
    }
    let position = dealt;
    if (sharesAFile(name) && sharedAt >= 0) {
      position = sharedAt;
    } else {
      dealt += 1;
      if (sharesAFile(name)) {
        sharedAt = position;
      }
    }
    if (position % shards !== shard - 1) {
      continue;
    }
    const at = monotonicNanos();
    runGoldenCase(t, tools, name);
    slow.record(name, monotonicNanos() - at);
  }

  if (!linkReady) {
    t.skip("tests/link programs", `cannot empty ${linkWork}, and a stale module would read as this run's`);
  } else {
    const speedLink = speedLinkNames();
    for (const name of linkNames()) {
      if (filter.length > 0 && name.indexOf(filter) < 0) {
        continue;
      }
      dealt += 1;
      if ((dealt - 1) % shards !== shard - 1) {
        continue;
      }
      const at = monotonicNanos();
      runLinkCase(t, tools, speedLink, name);
      slow.record(`link/${name}`, monotonicNanos() - at);
    }
  }

  const elapsed = (monotonicNanos() - started) / toI64(1000000);
  slow.report();
  console.log(`${elapsed} ms`);
  return t.done();
};
