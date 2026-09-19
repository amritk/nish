/**
 * The command line's contract, checked in Nish.
 *
 *     build/nish-cli [compiler]
 *
 * `AGENTS.md` and `docs/wp12-release.md` state the compiler's machine-readable
 * surface as a promise to whatever drives it — a script, an editor, an agent:
 *
 *   - `--help` answers **on stdout with exit 0**, because asking for the usage
 *     text is a request that succeeded; a usage *error* is the same text on
 *     **stderr with exit 2**, because it is a refusal.
 *   - `--json` prints **one flat object per diagnostic** on stdout, whose `code`
 *     is a stable rule identifier and whose `severity` is the field a tool
 *     filters on. Every failure is one of those objects, the ones that are about
 *     the run rather than about the program included.
 *   - The exit code is a band and not a boolean: **0** ok, **1** the program was
 *     refused, **2** the command line was wrong, **3** the toolchain is not
 *     there, **70** the compiler broke.
 *
 * `tests/run.js` checks all of that from Node. This checks it from a *consumer
 * written in the language*, which is the half that was missing: the promise is
 * made to a program that reads the output, and until now no such program existed
 * in the repository. It reads the objects with `std/json`, the streams with
 * `std/text`, and reports through `std/testing` — and the version it expects from
 * `--version` it reads out of `package.json` with the same `jsonField`, so the
 * expectation and the compiler cannot drift apart at a release.
 *
 * The compiler under test is the argument, defaulting to stage0
 * (`dist/index.js`), and a native self-hosted compiler works as well:
 *
 *     build/nish-cli                    # dist/index.js, under node
 *     build/nish-cli build/nish         # the self-hosted compiler
 *
 * **It pins the shape and not the bytes**, because the contract is the shape. The
 * two compilers word the same refusal differently — stage1's usage text is one
 * line and calls the driver `compile`, its unreadable-input message says
 * `cannot open <file>` where stage0 passes Node's `ENOENT` through, and its
 * band-3 failure names `scripts/build.sh` where stage0 names the compiler it
 * could not find — and `tests/run.js` records that difference in the same words
 * ("the two usage *texts* differ ... so it is the shape that is pinned, not the
 * bytes"). So a check here asks that the usage text is on the right stream with
 * the right code and names every advertised flag, that a refusal names the flag
 * or the file it is about, and that a failure carries the documented band and
 * code — each of which both compilers promise.
 *
 * Two things report as counted skips against a compiler that is not stage0: the
 * spelling of the tool's own name in the usage text, which stage1's driver has not
 * adopted yet, and the whole internal-error group, which is one skip because what
 * is missing is one thing — `NISH_SIMULATE_ICE`, a test hook stage0 has and a
 * self-hosted compiler does not. stage1 answers an internal error with the same
 * code and the same report (`self/ice.ts`) and has nothing to provoke one with. A
 * Node entry point is what stage0 is and what stage1 is not, which is how this
 * file tells them apart: the same test `tests/diagnostic_coverage.js` makes.
 *
 * So `build/nish-cli` is 69 checks and 0 skips against stage0, and 57 checks and
 * those 2 skips against `build/nish` — the numbers the CI bootstrap job prints.
 *
 * Two POSIX utilities stand in for builtins the language does not have, exactly as
 * `tests/nish/run.ts` uses them: `env(1)` gives a child the environment a check
 * needs — there is no `setenv`, and `NISH_SIMULATE_ICE` and `CC` are environment
 * variables — and its absence is a counted skip rather than a silent pass, while
 * one `rm -f` takes a file away so that "no IR was written" is a claim that can
 * fail rather than one an earlier run has already satisfied.
 */
import { jsonField } from "../../std/json";
import { Suite } from "../../std/testing";
import { contains, splitLines, trim } from "../../std/text";

/**
 * Where the captured streams and the fixtures live. Not `build/nish-cli`, which
 * is the binary this file compiles to: `mkdirSync` answers `false` for a path
 * that is already a file, and the run then ends before its first check.
 */
const WORK: string = "build/cli-contract";
/** The compiler nobody named: stage0, the one `npm run build` leaves behind. */
const DEFAULT_CLI: string = "dist/index.js";
/** The entry the checks that need a whole program compile. */
const FIXTURE_OK: string = "ok.ts";
/** A program with two errors in it, so "one object per diagnostic" is a countable claim. */
const FIXTURE_BAD: string = "bad.ts";
/** A program that compiles and earns a WP15 §8 warning, which is a diagnostic on a program that is fine. */
const FIXTURE_WARN: string = "warn.ts";

/**
 * The flags `--help` has to name. A wrapper that reads the usage text to learn
 * the surface must not be missing one, which is why this list is the same one
 * `tests/run.js` checks: two harnesses agreeing on it is the point.
 *
 * It is a function because a module constant is a number, a boolean or a string —
 * there is no top-level code to build an array with (`docs/LANGUAGE.md`).
 */
const advertisedFlags = (): string[] => [
  "--json",
  "--link",
  "--emit-header",
  "--emit-dts",
  "--emit-napi",
  "--emit-napi-async",
  "--target",
  "--profile",
];

/** One completed run of the compiler: the status, and both streams as text. */
class Run {
  status: i32;
  stdout: string;
  stderr: string;

  constructor(status: i32, stdout: string, stderr: string) {
    this.status = status;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

/**
 * The file's contents, or `""` when it is not there. A captured stream that was
 * never written and one that was written empty say the same thing to every check
 * below, so they are the same value here.
 */
const readOrEmpty = (path: string): string => {
  const text = readFileSyncOrNull(path);
  return text === null ? "" : text;
};

/**
 * Whether `env(1)` is here and honours the `NAME=value` operands these checks
 * need. It runs `env` under itself so that one utility answers for both halves
 * and `--version`, which is GNU-only, stays out of it.
 */
const hasEnvTool = (): boolean =>
  spawnSyncTo(["env", "NISH_ENV_PROBE=1", "env"], `${WORK}/env.probe.out`, `${WORK}/env.probe.err`) === 0;

/** Every line of a captured stdout that is a `--json` object: the contract is one per line. */
const cliObjectLines = (stdout: string): string[] => {
  const objects: string[] = [];
  for (const line of splitLines(stdout)) {
    if (line.startsWith("{")) {
      objects.push(line);
    }
  }
  return objects;
};

/**
 * Whether every non-blank line of a captured stdout is an object.
 *
 * This is the claim a consumer of `--json` actually relies on: not that the
 * objects are in there somewhere, but that nothing else is, so that reading the
 * stream does not mean guessing which lines were meant for a human.
 */
const cliStdoutIsObjectsOnly = (stdout: string): boolean => {
  for (const line of splitLines(stdout)) {
    if (toI32(trim(line).length) > 0 && !line.startsWith("{")) {
      return false;
    }
  }
  return true;
};

/** One field of one object, or `<absent>`, so a check over it reads as one line. */
const cliField = (object: string, name: string): string => {
  const value = jsonField(object, name);
  return value === null ? "<absent>" : value;
};

/**
 * Whether `code` is a diagnostic code: `NL` and four digits. The checks below ask
 * for the *shape* rather than for a number, because which rule a program breaks
 * belongs to `tests/wordings/`, and what belongs here is that every failure
 * carries a code at all.
 */
const isDiagnosticCode = (code: string): boolean => {
  if (toI32(code.length) !== 6 || !code.startsWith("NL")) {
    return false;
  }
  let i: i32 = 2;
  while (i < 6) {
    const digit: i32 = toI32(code.charCodeAt(i));
    if (digit < 48 || digit > 57) {
      return false;
    }
    i += 1;
  }
  return true;
};

/**
 * Whether `text` holds an indented `at ...` line, which is what a Node stack
 * frame looks like. `--help` and every diagnostic are prose; a stack frame in
 * either is a crash report that leaked, and under `NISH_DEBUG=1` it is the thing
 * being asked for.
 */
const hasStackFrame = (text: string): boolean => {
  for (const line of splitLines(text)) {
    if (line !== trim(line) && trim(line).startsWith("at ")) {
      return true;
    }
  }
  return false;
};

/**
 * The compiler under test, as something spawnable.
 *
 * A `.js` entry is run under `node` and anything else directly, which is the
 * distinction `tests/diagnostic_coverage.js` and `tests/nish-cmp.js` both make —
 * and, today, the one between stage0 and a self-hosted binary.
 */
class Cli {
  /** The argv prefix that runs it: `["node", "dist/index.js"]`, or just the binary. */
  head: string[];
  /** What the report calls it. */
  label: string;
  /** Whether it is a Node entry point, and so has stage0's `NISH_SIMULATE_ICE` hook. */
  node: boolean;

  constructor(spec: string) {
    this.label = spec;
    this.node = spec.endsWith(".js") || spec.endsWith(".mjs") || spec.endsWith(".cjs");
    this.head = this.node ? ["node", spec] : [spec];
  }

  /**
   * One run with the environment this harness itself was given, which is what
   * most of the checks want. The empty argument list is a local rather than an
   * `[]` at the call site because an empty array literal needs a type and an
   * argument position has nowhere to write one.
   */
  plain(slot: string, args: string[]): Run {
    const inherited: string[] = [];
    return this.run(slot, inherited, args);
  }

  /**
   * One run, with `env` layered over the inherited environment through `env(1)`
   * and both streams captured to `<slot>` files. Every caller passes its own slot
   * so that a failure's output is still on disk after the run.
   */
  run(slot: string, env: string[], args: string[]): Run {
    const argv: string[] = [];
    if (env.length > 0) {
      argv.push("env");
      for (const setting of env) {
        argv.push(setting);
      }
    }
    for (const part of this.head) {
      argv.push(part);
    }
    for (const arg of args) {
      argv.push(arg);
    }
    const outPath = `${WORK}/${slot}.out`;
    const errPath = `${WORK}/${slot}.err`;
    const status = spawnSyncTo(argv, outPath, errPath);
    return new Run(status, readOrEmpty(outPath), readOrEmpty(errPath));
  }
}

/**
 * The three fixtures, written rather than pointed at: a check that asserts the
 * line a diagnostic names should own the file that line is in, and a corpus case
 * edited for its own reasons would move it.
 */
const writeFixtures = (): void => {
  writeFileSync(
    `${WORK}/${FIXTURE_OK}`,
    ["export const main = (): number => {", "  return 0;", "};", ""].join("\n")
  );
  // Two errors, one per line, so the object count and their order are both claims
  // this file can make: a string plus an i32, then an i32 initialised with a string.
  writeFileSync(
    `${WORK}/${FIXTURE_BAD}`,
    [
      "export const test = (): number => {",
      '  const a = "x" + 1;',
      '  const b: i32 = "y";',
      "  return 0;",
      "};",
      "",
    ].join("\n")
  );
  // WP15 §8: a `new Array<T>(n)` whose length is not a literal cannot be an
  // alloca, so this loop bumps one out of the arena every pass and nothing keeps
  // it past the iteration — which the compiler says, on a program that compiles.
  writeFileSync(
    `${WORK}/${FIXTURE_WARN}`,
    [
      "export const test = (): number => {",
      "  let total = 0;",
      "  let i = 0;",
      "  while (i < 4) {",
      "    const row = new Array<i32>(3 + i);",
      "    row[0] = i;",
      "    total = total + row[0] + row.length;",
      "    i = i + 1;",
      "  }",
      "  return total;",
      "};",
      "",
    ].join("\n")
  );
};

/**
 * The tool the user types, which is `bin`'s key and not `name`.
 *
 * Those were one string until the package took a scope. The registry name is
 * `@amritk/nish` because `nish` belongs to somebody else, and the command is
 * still `nish` (`docs/wp12-release.md`, "The npm name"). `name` names the
 * package; `bin`'s key names the tool, and the tool is what `--version` and the
 * usage text are about — so reading `name` here was only ever right by
 * coincidence, and the scope is what ended the coincidence.
 */
const toolName = (manifest: string): string | null => {
  const bin = jsonField(manifest, "bin");
  if (bin === null) {
    return null;
  }
  const open: i32 = toI32(bin.indexOf('"'));
  if (open < 0) {
    return null;
  }
  const rest: string = bin.substring(open + 1);
  const close: i32 = toI32(rest.indexOf('"'));
  if (close < 0) {
    return null;
  }
  return rest.substring(0, close);
};

/**
 * The tool's own name and version, both read out of `package.json` with the
 * module under test.
 *
 * Taking them from the manifest rather than writing them here is what stops this
 * file from being the thing that goes red at a release: the version moves in
 * `package.json`, the compiler bakes it in (`src/branding.ts`,
 * `self/branding.ts`), and the expectation follows both.
 */
const checkIdentity = (t: Suite, cli: Cli): string => {
  const manifest = readFileSyncOrNull("package.json");
  if (manifest === null) {
    t.fail("--version", "cannot read package.json (run this from the repository root)");
    return "";
  }
  const name = toolName(manifest);
  const version = jsonField(manifest, "version");
  if (name === null || version === null) {
    t.fail("--version", "package.json has no bin entry or no version field");
    return "";
  }
  const run = cli.plain("version", ["--version"]);
  if (!t.eqI32("--version exits 0", run.status, 0)) {
    return name;
  }
  t.eqStr("--version prints the tool's name and the version in package.json", trim(run.stdout), `${name} ${version}`);
  t.eqStr("--version says nothing on stderr", trim(run.stderr), "");
  return name;
};

/**
 * The `--help` / usage-error pair: the same text, told apart by the stream and
 * the code. A wrapper that cannot tell them apart reads an answer as a failure.
 */
const checkHelp = (t: Suite, cli: Cli, name: string): void => {
  const help = cli.plain("help", ["--help"]);
  t.eqI32("--help exits 0", help.status, 0);
  t.contains("--help prints the usage on stdout", help.stdout, "usage: ");
  t.eqStr("--help says nothing on stderr", trim(help.stderr), "");
  // The spelling rather than the shape, and the one place this file reads bytes
  // that are one compiler's: the usage text has to name the tool the user typed,
  // which stage1's driver does not do yet (it calls itself `compile` — see
  // `self/branding.ts`, and the same note beside the `--help` check in
  // `tests/run.js`).
  const named = "the usage text names the tool itself";
  if (cli.node) {
    t.contains(named, help.stdout, `usage: ${name}`);
  } else {
    t.skip(named, `${cli.label}'s driver still calls itself \`compile\` (self/branding.ts)`);
  }
  t.eqBool("--help prints no stack frame", hasStackFrame(help.stdout), false);
  const flags = advertisedFlags();
  t.containsAll(`--help names every advertised flag (${flags.length} of them)`, help.stdout, flags);

  const short = cli.plain("help_short", ["-h"]);
  t.eqStr("-h is --help exactly", short.stdout, help.stdout);

  // No arguments at all, which is the usage error every wrapper meets first.
  const nothing: string[] = [];
  const usage = cli.plain("usage", nothing);
  t.eqI32("no inputs at all exits 2", usage.status, 2);
  t.contains("and prints the usage on stderr", usage.stderr, "usage: ");
  t.eqStr(
    "--help and a usage error are the same text on different streams",
    trim(usage.stderr),
    trim(help.stdout)
  );
  t.eqStr("a usage error says nothing on stdout", trim(usage.stdout), "");
};

/** The other two band-2 refusals: a flag the driver does not have, and one missing its value. */
const checkUsageErrors = (t: Suite, cli: Cli): void => {
  const entry = `${WORK}/${FIXTURE_OK}`;
  const unknown = cli.plain("bad_flag", ["--bogus", entry]);
  t.eqI32("an unknown flag exits 2", unknown.status, 2);
  // Both compilers name the flag; only one of them calls it an "option".
  t.contains("and names the flag it did not know", unknown.stderr, "--bogus");

  const noValue = cli.plain("no_value", [entry, "-o"]);
  t.eqI32("`-o` with no value exits 2", noValue.status, 2);
  t.eqStr("and says nothing on stdout", trim(noValue.stdout), "");
};

/**
 * A program that compiles: exit 0, the module on disk, and **stdout untouched**.
 *
 * Where the `wrote <file>` line goes is the half of the contract that decides
 * whether `--json` can be read at all: it is progress and not output, so it is on
 * stderr (`src/index.ts` writes it with `console.error`), which leaves stdout to
 * `--help`, the dump flags and the objects. A consumer can therefore read stdout
 * whole, and the `{`-line filter that `tests/run.js` and this file both apply is
 * belt and braces rather than the mechanism.
 */
const checkSuccess = (t: Suite, cli: Cli): void => {
  const irPath = `${WORK}/ok.ll`;
  const run = cli.plain("ok", [`${WORK}/${FIXTURE_OK}`, "-o", irPath]);
  if (!t.eqI32("a program that compiles exits 0", run.status, 0)) {
    return;
  }
  t.eqStr("and leaves stdout empty", trim(run.stdout), "");
  t.contains("and says on stderr where it wrote the module", run.stderr, irPath);
  t.eqBool("and the module is there", readFileSyncOrNull(irPath) !== null, true);

  const json = cli.plain("ok_json", [`${WORK}/${FIXTURE_OK}`, "--json", "-o", `${WORK}/ok_json.ll`]);
  t.eqI32("the same compile under --json exits 0", json.status, 0);
  t.eqStr("and prints nothing at all on stdout, because there was no diagnostic", trim(json.stdout), "");
  t.contains("while the progress line is still on stderr", json.stderr, "wrote ");
};

/** A refused program under `--json`: one flat object per diagnostic, in source order. */
const checkErrorObjects = (t: Suite, cli: Cli): void => {
  const source = `${WORK}/${FIXTURE_BAD}`;
  const run = cli.plain("bad_json", [source, "--json", "-o", `${WORK}/bad.ll`]);
  if (!t.eqI32("a refused program exits 1", run.status, 1)) {
    return;
  }
  const objects = cliObjectLines(run.stdout);
  if (!t.eqI32("--json prints one object per diagnostic", toI32(objects.length), 2)) {
    return;
  }
  t.eqBool("and nothing else on stdout", cliStdoutIsObjectsOnly(run.stdout), true);
  const first = objects[0];
  t.eqStr("the object names the file the diagnostic is in", cliField(first, "file"), source);
  t.eqStr("and the line", cliField(first, "line"), "2");
  t.eqBool("and a column that is a position", parseInt(cliField(first, "column")) > 0, true);
  t.eqStr("and the severity a tool filters on", cliField(first, "severity"), "error");
  t.eqBool(`and a stable code (${cliField(first, "code")})`, isDiagnosticCode(cliField(first, "code")), true);
  t.eqBool("and a message", toI32(cliField(first, "message").length) > 0, true);
  // Source order, which is what makes a list of objects readable as a report.
  t.eqStr("the second object is the second diagnostic", cliField(objects[1], "line"), "3");
  t.eqBool("and carries its own code", isDiagnosticCode(cliField(objects[1], "code")), true);
};

/**
 * A warning under `--json`: a diagnostic on a program that is *fine*. `severity`
 * is the whole reason that field exists — a consumer that read the presence of an
 * object as a failure would refuse this program, and the compiler did not.
 */
const checkWarningObjects = (t: Suite, cli: Cli): void => {
  const run = cli.plain("warn_json", [`${WORK}/${FIXTURE_WARN}`, "--json", "-o", `${WORK}/warn.ll`]);
  if (!t.eqI32("a performance warning does not refuse the program", run.status, 0)) {
    return;
  }
  const objects = cliObjectLines(run.stdout);
  if (!t.eqI32("and is still an object on stdout", toI32(objects.length), 1)) {
    return;
  }
  t.eqStr("whose severity is not `error`", cliField(objects[0], "severity"), "performance");
  t.eqBool("and whose code is a code", isDiagnosticCode(cliField(objects[0], "code")), true);
};

/**
 * The two dump flags, which are the other two rows of the table in `AGENTS.md`:
 * the tree the parser built and the side tables the checker recorded.
 *
 * Their *content* is each compiler's own — stage0 prints the `typescript`
 * package's node names, stage1 the flattened vocabulary of `self/nodes.ts`, and
 * `tests/self/parity.js` declares that difference rather than comparing it — so
 * what is asked here is what both promise: the dump is on stdout, the exit code is
 * 0, and no IR is written, because a dump is a question about a program and not a
 * request to compile it.
 */
const checkDumps = (t: Suite, cli: Cli): void => {
  const source = `${WORK}/${FIXTURE_OK}`;
  const irPath = `${WORK}/dump.ll`;
  // An `.ll` left by an earlier run would make "no IR is written" unfalsifiable,
  // and there is no builtin that removes a file (`docs/LANGUAGE.md`).
  spawnSyncTo(["rm", "-f", irPath], `${WORK}/rm.out`, `${WORK}/rm.err`);

  const ast = cli.plain("emit_ast", [source, "--emit-ast", "-o", irPath]);
  t.eqI32("--emit-ast exits 0", ast.status, 0);
  t.eqBool("and prints the tree on stdout", toI32(trim(ast.stdout).length) > 0, true);
  t.eqBool("and writes no IR", readFileSyncOrNull(irPath) === null, true);

  const checked = cli.plain("emit_checked", [source, "--emit-checked", "-o", irPath]);
  t.eqI32("--emit-checked exits 0", checked.status, 0);
  t.contains("and names the module it dumped", checked.stdout, FIXTURE_OK);
  t.eqBool("and writes no IR either", readFileSyncOrNull(irPath) === null, true);
};

/** An input that cannot be read: band 1, and an object under `--json` like any other failure. */
const checkMissingInput = (t: Suite, cli: Cli): void => {
  const run = cli.plain("missing", ["does-not-exist.ts"]);
  t.eqI32("an unreadable input exits 1", run.status, 1);
  // The file and not the errno: stage0 passes Node's `ENOENT ...` through and
  // stage1 says `cannot open <file>`, and what a reader needs from either is the
  // name of the file that is not there.
  t.contains("and names the file it could not read", run.stderr, "does-not-exist.ts");
  t.eqBool("and is not reported as a compiler bug", contains(run.stderr, "internal compiler error"), false);

  const json = cli.plain("missing_json", ["does-not-exist.ts", "--json"]);
  t.eqI32("the same under --json exits 1", json.status, 1);
  const objects = cliObjectLines(json.stdout);
  if (!t.eqI32("and is an object on stdout, not only a line on stderr", toI32(objects.length), 1)) {
    return;
  }
  t.eqBool("with a code of its own", isDiagnosticCode(cliField(objects[0], "code")), true);
  t.contains("and the file in its message", cliField(objects[0], "message"), "does-not-exist.ts");
};

/**
 * Band 3, the toolchain: `--link` with a `CC` that is not there.
 *
 * It is the failure mode a user hits on a fresh machine, and the one where the
 * difference between "your program is wrong" and "this box has no C compiler"
 * matters most — so it has a band, a code and, under `--json`, an object.
 */
const checkToolchain = (t: Suite, cli: Cli, env: boolean): void => {
  if (!env) {
    t.skip("--link with no C compiler", "needs env(1) to set CC, and the probe did not find one");
    return;
  }
  const run = cli.run(
    "cc_json",
    ["CC=/nonexistent-cc"],
    [`${WORK}/${FIXTURE_OK}`, "--json", "--link", `${WORK}/nolink`]
  );
  if (!t.eqI32("--link with no usable C compiler exits 3", run.status, 3)) {
    return;
  }
  const objects = cliObjectLines(run.stdout);
  if (!t.eqI32("and prints one object", toI32(objects.length), 1)) {
    return;
  }
  t.eqStr("whose code is the toolchain code", cliField(objects[0], "code"), "NL0002");
  // The message is each compiler's own — stage0 names the C compiler it could not
  // find, stage1 names the `scripts/build.sh` run that failed — so what is pinned
  // is that there is one, and that stdout is still only objects.
  t.eqBool("and whose message says something", toI32(cliField(objects[0], "message").length) > 0, true);
  t.eqBool("and stdout carries nothing but objects", cliStdoutIsObjectsOnly(run.stdout), true);
};

/**
 * Band 70, the compiler's own bug, reached through stage0's `NISH_SIMULATE_ICE`
 * hook: the report names the input, asks for a bug report, and keeps the stack
 * behind `NISH_DEBUG=1`.
 */
const checkInternalError = (t: Suite, cli: Cli, env: boolean): void => {
  if (!env) {
    t.skip(
      "an internal compiler error",
      "needs env(1) to set NISH_SIMULATE_ICE, and the probe did not find one"
    );
    return;
  }
  if (!cli.node) {
    // Not a gap: stage1 answers 70 with the same report (`self/ice.ts`), and the
    // hook that provokes one on demand is stage0's alone.
    t.skip("an internal compiler error", `${cli.label} has no NISH_SIMULATE_ICE hook (self/ice.ts)`);
    return;
  }
  const source = `${WORK}/${FIXTURE_OK}`;
  const run = cli.run("ice", ["NISH_SIMULATE_ICE=1"], [source, "-o", `${WORK}/ice.ll`]);
  if (!t.eqI32("an internal compiler error exits 70", run.status, 70)) {
    return;
  }
  t.containsAll("and the report names the input and asks for a bug report", run.stderr, [
    "internal compiler error",
    source,
    "github.com/amritk/nish/issues",
    "NISH_DEBUG=1",
  ]);
  t.eqBool("and prints no stack frame by default", hasStackFrame(run.stderr), false);

  const debug = cli.run(
    "ice_debug",
    ["NISH_SIMULATE_ICE=1", "NISH_DEBUG=1"],
    [source, "-o", `${WORK}/ice.ll`]
  );
  t.eqI32("with NISH_DEBUG=1 it is still 70", debug.status, 70);
  t.eqBool("and the stack is printed", hasStackFrame(debug.stderr), true);

  const json = cli.run("ice_json", ["NISH_SIMULATE_ICE=1"], [source, "--json", "-o", `${WORK}/ice.ll`]);
  t.eqI32("under --json it is still 70", json.status, 70);
  const objects = cliObjectLines(json.stdout);
  if (!t.eqI32("and the crash is an object too", toI32(objects.length), 1)) {
    return;
  }
  t.eqBool("and stdout carries nothing else", cliStdoutIsObjectsOnly(json.stdout), true);
  t.eqStr("whose code is the internal-error code", cliField(objects[0], "code"), "NL0003");
  t.eqStr("and whose severity is error", cliField(objects[0], "severity"), "error");
  t.contains("and the human report is still on stderr", json.stderr, "This is a bug in nish");
};

export const main = (): number => {
  const spec = process.argv.length > 1 ? process.argv[1] : DEFAULT_CLI;
  mkdirSync("build");
  if (!mkdirSync(WORK)) {
    panic(`cannot create ${WORK}`);
  }
  if (readFileSyncOrNull(spec) === null) {
    panic(`cannot read the compiler ${spec} (run this from the repository root, after \`npm run build\`)`);
  }
  writeFixtures();

  const cli = new Cli(spec);
  const env = hasEnvTool();
  const t = new Suite(`cli contract (${cli.label})`);

  const name = checkIdentity(t, cli);
  checkHelp(t, cli, name);
  checkUsageErrors(t, cli);
  checkSuccess(t, cli);
  checkErrorObjects(t, cli);
  checkWarningObjects(t, cli);
  checkDumps(t, cli);
  checkMissingInput(t, cli);
  checkToolchain(t, cli, env);
  checkInternalError(t, cli, env);

  return t.done();
};
