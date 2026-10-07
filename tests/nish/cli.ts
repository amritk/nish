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
 * The compiler under test is the argument, defaulting to `build/nish`, what
 * `npm run build` leaves behind:
 *
 *     build/nish-cli                    # build/nish
 *     build/nish-cli build/nish-test    # another compiler
 *
 * **It pins the shape and not the bytes**, because the contract is the shape.
 * The wording of an answer can move between releases where the contract does
 * not. So a check here asks that the usage text is on the right stream with
 * the right code and names every advertised flag, that a refusal names the flag
 * or the file it is about, and that a failure carries the documented band and
 * code — each of which every release promises.
 *
 * The internal-error group needs `NISH_SIMULATE_ICE`, the test hook that
 * provokes one on demand, and asks the compiler whether it has one — a run with
 * the variable set that compiles cleanly has none — so the group is one counted
 * skip against a compiler without it. Under `NISH_DEBUG=1` the compiler, which
 * has no exceptions and so no stack, says so in the report.
 *
 * Two POSIX utilities stand in for builtins the language does not have, exactly as
 * `tests/nish/run.ts` uses them: `env(1)` gives a child the environment a check
 * needs — there is no `setenv`, and `NISH_SIMULATE_ICE` and `CC` are environment
 * variables — and its absence is a counted skip rather than a silent pass, while
 * one `rm -f` takes a file away so that "no IR was written" is a claim that can
 * fail rather than one an earlier run has already satisfied.
 */
import { sha256 } from "../../std/crypto/sha256";
import { jsonField } from "../../std/json";
import { VERSION } from "../../src/branding";
import { hexDigitLower } from "../../src/strings";
import { Suite } from "../../std/testing";
import { contains, splitLines, trim } from "../../std/text";

/**
 * Where the captured streams and the fixtures live. Not `build/nish-cli`, which
 * is the binary this file compiles to: `mkdirSync` answers `false` for a path
 * that is already a file, and the run then ends before its first check.
 */
const WORK: string = "build/cli-contract";
/** The compiler nobody named: the one `npm run build` leaves behind. */
const DEFAULT_CLI: string = "build/nish";
/** The entry the checks that need a whole program compile. */
const FIXTURE_OK: string = "ok.ts";
/** One unproven index, the one site `--deny-panics` refuses (`checkDenyPanics`). */
const FIXTURE_DENY: string = "deny.ts";
/** A program with two errors in it, so "one object per diagnostic" is a countable claim. */
const FIXTURE_BAD: string = "bad.ts";
/** A loose equality, the diagnostic with a fix: `--fix` rewrites a copy of it, never this file. */
const FIXTURE_FIX: string = "fix.ts";
/** A `throw`, a diagnostic no fix is safe for. */
const FIXTURE_NOFIX: string = "nofix.ts";
/** A program that compiles and earns a WP15 §8 warning, which is a diagnostic on a program that is fine. */
const FIXTURE_WARN: string = "warn.ts";
/** A program that compiles and calls a deprecated builtin, which warns by default. */
const FIXTURE_DEPRECATED: string = "deprecated.ts";

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
  "--emit-panics",
  "--deny-panics",
  "--target",
  "--profile",
  "--warn-portability",
  "--fix",
  "--emit-capabilities",
  "[--capabilities]",
  "--allow",
  "--deny",
  "run [flags] <file.ts> [args ...]",
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
 * either is a crash report that leaked, and so is one under `NISH_DEBUG=1`, where a
 * native compiler says it has no stack instead.
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
 * distinction `tests/diagnostic-coverage.js` and `tests/nish-cmp.js` both make.
 */
class Cli {
  /** The argv prefix that runs it: `["node", "<entry>.js"]`, or just the binary. */
  head: string[];
  /** What the report calls it. */
  label: string;

  constructor(spec: string) {
    this.label = spec;
    const node = spec.endsWith(".js") || spec.endsWith(".mjs") || spec.endsWith(".cjs");
    this.head = node ? ["node", spec] : [spec];
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
 * The fixtures, written rather than pointed at: a check that asserts the
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
  // `==` at line 2, columns 12 to 14: the fix's position is pinned to the column.
  writeFileSync(
    `${WORK}/${FIXTURE_FIX}`,
    ["export const same = (a: i32, b: i32): boolean => {", "  return a == b;", "};", ""].join("\n")
  );
  writeFileSync(`${WORK}/${FIXTURE_DENY}`, "export const at = (xs: i32[], i: i32): i32 => xs[i];\n");
  writeFileSync(
    `${WORK}/${FIXTURE_NOFIX}`,
    ["export const fail = (): i32 => {", '  throw new Error("no");', "};", ""].join("\n")
  );
  // WP15 §8: a `new Array<T>(n)` whose length is not a literal cannot be an
  // alloca, so this loop bumps one out of the arena every pass and nothing keeps
  // it past the iteration — which the compiler says, on a program that compiles.
  // The same array is zero-filled here and a row of holes in TypeScript, so
  // under `--warn-portability` it is a WP33 portability warning as well.
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
  // `Arena.release` still compiles, to the call it always did, and warns that
  // `using a = arena()` replaces it (NL7001).
  writeFileSync(
    `${WORK}/${FIXTURE_DEPRECATED}`,
    ["export const test = (): number => {", "  const m = Arena.mark();", "  Arena.release(m);", "  return 0;", "};", ""].join(
      "\n"
    )
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
 * `package.json`, the compiler bakes it in (stage0's `src/branding.ts`,
 * `src/branding.ts`), and the expectation follows both.
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
  // The spelling rather than the shape: the usage text has to name the tool the
  // user typed. Both compilers build it from `CLI` in their `branding.ts`.
  t.contains("the usage text names the tool itself", help.stdout, `usage: ${name}`);
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

  // `--nsw` once told the compiler it might assume signed overflow away. That
  // overflow is a checked panic now and no flag brings the assumption back, so
  // the flag is refused rather than accepted with a meaning it no longer has,
  // and the refusal names the ways to ask for a wrap that are left.
  const nsw = cli.plain("nsw_flag", ["--nsw", entry]);
  t.eqI32("`--nsw` exits 2", nsw.status, 2);
  t.contains("and says signed overflow is checked", nsw.stderr, "signed overflow is checked");
  t.contains("and names nish:unsafe as the way to wrap", nsw.stderr, "`wrappingAdd`, `wrappingSub` or `wrappingMul` from `nish:unsafe`");
  t.contains("and the deprecated --wrapping", nsw.stderr, "--wrapping");
  t.eqStr("and the refusal says nothing on stdout", trim(nsw.stdout), "");
};

/**
 * A program that compiles: exit 0, the module on disk, and **stdout untouched**.
 *
 * Where the `wrote <file>` line goes is the half of the contract that decides
 * whether `--json` can be read at all: it is progress and not output, so it is on
 * stderr (stage0's `src/index.ts` writes it with `console.error`), which leaves stdout to
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
 * The two deprecated flags: each is one performance object under `--json`, on a
 * program that is otherwise quiet, and its code names the flag, so a wrapper can
 * tell which one a build still passes. `--no-warn-performance` silences both.
 */
const checkDeprecatedFlagObjects = (t: Suite, cli: Cli): void => {
  const source = `${WORK}/${FIXTURE_OK}`;
  const unchecked = cli.plain("unchecked_json", [source, "--unchecked-indexing", "--json", "-o", `${WORK}/unchecked.ll`]);
  const wrapping = cli.plain("wrapping_json", [source, "--wrapping", "--json", "-o", `${WORK}/wrapping.ll`]);
  const quiet = cli.plain("deprecated_quiet", [
    source,
    "--unchecked-indexing",
    "--wrapping",
    "--no-warn-performance",
    "--json",
    "-o",
    `${WORK}/deprecated-quiet.ll`,
  ]);
  const uncheckedObjects = cliObjectLines(unchecked.stdout);
  const wrappingObjects = cliObjectLines(wrapping.stdout);
  if (
    !t.eqI32("--unchecked-indexing compiles", unchecked.status, 0) ||
    !t.eqI32("and is one object on stdout", toI32(uncheckedObjects.length), 1)
  ) {
    return;
  }
  t.eqStr("a performance one", cliField(uncheckedObjects[0], "severity"), "performance");
  t.eqStr("whose code is the --unchecked-indexing deprecation", cliField(uncheckedObjects[0], "code"), "NL9014");
  if (
    !t.eqI32("--wrapping compiles", wrapping.status, 0) ||
    !t.eqI32("and is one object on stdout", toI32(wrappingObjects.length), 1)
  ) {
    return;
  }
  t.eqStr("a performance one", cliField(wrappingObjects[0], "severity"), "performance");
  t.eqStr("whose code is the --wrapping deprecation", cliField(wrappingObjects[0], "code"), "NL9015");
  t.eqI32("--no-warn-performance silences both", toI32(cliObjectLines(quiet.stdout).length), 0);
};

/**
 * The machine-applicable fix: `fix` on the object, after `message`, with the
 * exact span of the token it replaces — and no `fix` key at all, rather than an
 * empty one, on a diagnostic no fix is safe for. Then `--fix` itself: it rewrites
 * a copy of the file, answers like a clean compile, and refuses `-o`.
 */
const checkFixField = (t: Suite, cli: Cli): void => {
  const loose = cli.plain("fix_json", [`${WORK}/${FIXTURE_FIX}`, "--json", "-o", `${WORK}/fix.ll`]);
  t.eqI32("a loose equality is refused with exit 1", loose.status, 1);
  const objects = cliObjectLines(loose.stdout);
  if (t.eqI32("as one object", toI32(objects.length), 1)) {
    t.eqStr(
      "which carries `fix`: the span of `==` alone, replaced by `===`",
      cliField(objects[0], "fix"),
      '[{"line":2,"column":12,"endLine":2,"endColumn":14,"text":"==="}]'
    );
    t.eqBool("and `fix` is the last key, after `message`", objects[0].endsWith("]}"), true);
  }

  const thrown = cli.plain("nofix_json", [`${WORK}/${FIXTURE_NOFIX}`, "--json", "-o", `${WORK}/nofix.ll`]);
  const thrownObjects = cliObjectLines(thrown.stdout);
  if (t.eqI32("a `throw` is one object", toI32(thrownObjects.length), 1)) {
    t.eqStr("with no `fix` key, rather than an empty one", cliField(thrownObjects[0], "fix"), "<absent>");
  }

  const copy = `${WORK}/fix_copy.ts`;
  writeFileSync(copy, readOrEmpty(`${WORK}/${FIXTURE_FIX}`));
  const fixed = cli.plain("fix_apply", ["--fix", "--json", copy]);
  t.eqI32("--fix exits 0 once every diagnostic is fixed", fixed.status, 0);
  t.eqStr("and prints no object, because none is left", trim(fixed.stdout), "");
  t.contains("and rewrote the file", readOrEmpty(copy), "return a === b;");

  const withOutput = cli.plain("fix_output", ["--fix", copy, "-o", `${WORK}/fix_copy.ll`]);
  t.eqI32("--fix with -o is a usage error, exit 2", withOutput.status, 2);
  t.eqBool("and is refused as a compile", withOutput.stderr.startsWith("compile: "), true);

  // `--target` only shapes the IR `--fix` never writes, so it is refused like
  // a product rather than dropped, whichever of the two comes first (#433).
  const unfixed = `${WORK}/fix_target.ts`;
  writeFileSync(unfixed, readOrEmpty(`${WORK}/${FIXTURE_FIX}`));
  const withTarget = cli.plain("fix_target", [unfixed, "--fix", "--target", "wasm32-wasi"]);
  t.eqI32("--fix with --target is a usage error, exit 2", withTarget.status, 2);
  t.eqBool(
    "refused as a compile, naming --target",
    withTarget.stderr.startsWith("compile: `--target` cannot be used with --fix"),
    true
  );
  t.contains("and leaves the file unfixed", readOrEmpty(unfixed), "return a == b;");
  const targetFirst = cli.plain("fix_target_first", ["--target", "x86_64-unknown-linux-gnu", "--fix", unfixed]);
  t.eqI32("--target before --fix is refused too, exit 2", targetFirst.status, 2);
  t.eqBool(
    "naming --target",
    targetFirst.stderr.startsWith("compile: `--target` cannot be used with --fix"),
    true
  );
  t.contains("and the file is still unfixed", readOrEmpty(unfixed), "return a == b;");
  // The other flags that shape only what a compile emits or links are refused
  // the same way, each by name.
  for (const flag of ["-g", "--threads", "--runtime-decls", "--plain"]) {
    const refused = cli.plain(`fix${flag}`, ["--fix", flag, unfixed]);
    t.eqI32(`--fix with ${flag} is a usage error, exit 2`, refused.status, 2);
    t.eqBool(`naming ${flag}`, refused.stderr.startsWith(`compile: \`${flag}\` cannot be used with --fix`), true);
    t.contains(`and the file is unfixed after ${flag}`, readOrEmpty(unfixed), "return a == b;");
  }

  // Under `run` the refusal is `run`'s, in its words, whichever flag it names.
  const underRun = cli.plain("fix_run", ["run", "--fix", copy]);
  t.eqI32("`nish run --fix` is a usage error, exit 2", underRun.status, 2);
  t.eqBool("refused as a run, naming --fix", underRun.stderr.startsWith("run: `--fix` cannot be used"), true);
  const underRunOutput = cli.plain("fix_run_output", ["run", "--fix", "-o", `${WORK}/fix_copy.ll`, copy]);
  t.eqI32("`nish run --fix -o` is a usage error, exit 2", underRunOutput.status, 2);
  t.eqBool("refused as a run too, not as a compile", underRunOutput.stderr.startsWith("run: "), true);
};

/**
 * The WP33 portability warning, which is off unless asked for: under
 * `--warn-portability --json` it is one more object, after the performance
 * warning, with a `severity` of its own — and the program still compiles.
 */
const checkPortabilityObjects = (t: Suite, cli: Cli): void => {
  const quiet = cli.plain("port_off", [`${WORK}/${FIXTURE_WARN}`, "--json", "-o", `${WORK}/port-off.ll`]);
  t.eqI32("without --warn-portability there is no portability object", toI32(cliObjectLines(quiet.stdout).length), 1);
  const run = cli.plain("port_json", [
    `${WORK}/${FIXTURE_WARN}`,
    "--warn-portability",
    "--json",
    "-o",
    `${WORK}/port.ll`,
  ]);
  if (!t.eqI32("a portability warning does not refuse the program", run.status, 0)) {
    return;
  }
  const objects = cliObjectLines(run.stdout);
  if (!t.eqI32("and is an object on stdout after the performance one", toI32(objects.length), 2)) {
    return;
  }
  t.eqStr("whose severity is `portability`", cliField(objects[1], "severity"), "portability");
  t.eqStr("and whose code is the zero-fill row's", cliField(objects[1], "code"), "NL8005");
};

/**
 * The deprecation warning, which is on with no flag: under `--json` it is one
 * object with a `severity` of its own and its NL7xxx code, and the program
 * still compiles.
 */
const checkDeprecationObjects = (t: Suite, cli: Cli): void => {
  const run = cli.plain("deprecated_json", [`${WORK}/${FIXTURE_DEPRECATED}`, "--json", "-o", `${WORK}/deprecated.ll`]);
  if (!t.eqI32("a deprecation warning does not refuse the program", run.status, 0)) {
    return;
  }
  const objects = cliObjectLines(run.stdout);
  if (!t.eqI32("and is an object on stdout", toI32(objects.length), 1)) {
    return;
  }
  t.eqStr("whose severity is `deprecation`", cliField(objects[0], "severity"), "deprecation");
  t.eqStr("and whose code is `Arena.release`'s", cliField(objects[0], "code"), "NL7001");
  t.eqStr("on the line of the call", cliField(objects[0], "line"), "3");
};

/**
 * WP35, the capability report: the one surface this file pins byte for byte,
 * because its stability is the promise (docs/wp35-capabilities.md §5). A tool
 * diffs it in CI, so the key order, the sorted arrays, the relative paths and
 * the trailing newline are the contract and not its wording. The golden is the
 * corpus case's own, `tests/cases/caps_generic.caps.json`, compiled here from
 * the same path, and the paths in it are relative to the entry's directory, so
 * where this file sits does not move a byte.
 *
 * The summary line `--capabilities` prints is pinned exactly too, on stderr
 * with stdout untouched, in a compile and before a `nish run` starts the
 * program; the run is one counted skip without env(1) or a C compiler.
 */
const checkCapabilities = (t: Suite, cli: Cli, env: boolean): void => {
  const source = "tests/cases/caps_generic.ts";
  const report = `${WORK}/caps.json`;
  const noFile = cli.plain("caps_no_file", [source, "--emit-capabilities"]);
  t.eqI32("--emit-capabilities with no file is a usage error, exit 2", noFile.status, 2);
  t.contains("and names the flag", noFile.stderr, "--emit-capabilities needs a file");
  t.eqStr("and says nothing on stdout", trim(noFile.stdout), "");

  removeTree(report);
  const run = cli.plain("caps_report", [source, "-o", `${WORK}/caps.ll`, "--emit-capabilities", report]);
  if (!t.eqI32("--emit-capabilities exits 0", run.status, 0)) {
    return;
  }
  t.eqStr("and leaves stdout empty", trim(run.stdout), "");
  t.contains("and says on stderr where it wrote the report", run.stderr, `wrote ${report}`);
  const got = readOrEmpty(report);
  const want = readOrEmpty("tests/cases/caps_generic.caps.json");
  t.eqLines("the report is the golden, line for line", splitLines(got), splitLines(want));
  t.eqBool("and byte for byte, the trailing newline included", got === want && got.endsWith("}\n"), true);
  t.eqStr("its version is 1", jsonFieldOr(got, "version"), "1");
  t.eqStr("its entry is named from its own directory", jsonFieldOr(got, "entry"), "caps_generic.ts");

  const pure = cli.plain("caps_line_pure", ["tests/cases/caps_pure.ts", "-o", `${WORK}/caps.ll`, "--capabilities"]);
  t.eqStr(
    "--capabilities prints `none (deterministic)` for a program that reaches nothing",
    firstLine(pure.stderr),
    "capabilities: none (deterministic)"
  );
  t.eqStr("and nothing on stdout", trim(pure.stdout), "");
  const loud = cli.plain("caps_line_loud", [source, "-o", `${WORK}/caps.ll`, "--capabilities"]);
  t.eqStr(
    "--capabilities names the program's set, in the fixed order",
    firstLine(loud.stderr),
    "capabilities: fs.read (not deterministic)"
  );

  if (!env) {
    t.skip("nish run --capabilities", "needs env(1) to set XDG_CACHE_HOME, and the probe did not find one");
    return;
  }
  const abs = realpathSync(WORK);
  if (abs === null) {
    t.fail("nish run --capabilities", `cannot resolve ${WORK}`);
    return;
  }
  const ran = cli.run("caps_run", [`XDG_CACHE_HOME=${abs}/caps-cache`], ["run", "--capabilities", "tests/cases/caps_pure.ts"]);
  if (ran.status === 3 && contains(ran.stderr, "no usable C compiler")) {
    t.skip("nish run --capabilities", "no C compiler, so nothing can be linked");
    return;
  }
  t.eqI32("nish run --capabilities runs the program, and answers its status", ran.status, 0);
  t.eqStr("and prints exactly the one line on stderr", ran.stderr, "capabilities: none (deterministic)\n");
  t.eqStr("and leaves the program's stdout alone", ran.stdout, "true\n6\n3.5\n");
};

/**
 * WP36, the capability policy (docs/wp36-capability-policy.md): each way a
 * `--allow` or `--deny` line can be refused is a usage error, exit 2, said on
 * stderr with nothing on stdout; a program inside the policy compiles to the
 * IR it compiles to without one; a program outside it is refused, band 1, with
 * one `--json` object whose code is the rule's (NL2459), and `nish run`
 * refuses it before it runs.
 */
const checkCapabilityPolicy = (t: Suite, cli: Cli, env: boolean): void => {
  const source = "tests/cases/caps_generic.ts";
  const usage: string[] = [
    "--allow",
    "fs.reads",
    "names no capability",
    "--allow",
    "unsafe",
    "`--allow unsafe` is refused",
    "--allow",
    "fs.read=/tmp",
    "scopes a capability to a directory",
    "--deny",
    "net,,exit",
    "names no capability",
  ];
  let k = 0;
  while (k + 2 < usage.length) {
    const flag = usage[k];
    const value = usage[k + 1];
    const words = usage[k + 2];
    const refused = cli.plain("policy_usage", [source, flag, value]);
    t.eqI32(`\`${flag} ${value}\` is a usage error, exit 2`, refused.status, 2);
    t.contains("and says why on stderr", refused.stderr, words);
    t.eqStr("and nothing on stdout", trim(refused.stdout), "");
    k = k + 3;
  }
  const both = cli.plain("policy_both", [source, "--allow", "net,fs.read", "--deny", "net"]);
  t.eqI32("a capability both allowed and denied is a usage error, exit 2", both.status, 2);
  t.contains("and names the capability", both.stderr, "`net` is both allowed and denied");
  const noValue = cli.plain("policy_no_value", [source, "--deny"]);
  t.eqI32("--deny with no list exits 2", noValue.status, 2);
  const ast = cli.plain("policy_ast", [source, "--deny", "net", "--emit-ast"]);
  t.eqI32("--deny with --emit-ast exits 2", ast.status, 2);
  const fix = cli.plain("policy_fix", [source, "--allow", "fs.read", "--fix"]);
  t.eqI32("--allow with --fix exits 2", fix.status, 2);

  const plainIr = `${WORK}/policy_plain.ll`;
  const grantedIr = `${WORK}/policy_granted.ll`;
  cli.plain("policy_plain", [source, "-o", plainIr]);
  const granted = cli.plain("policy_granted", [source, "-o", grantedIr, "--allow", "fs.read", "--deny", "net"]);
  if (t.eqI32("a program inside its policy compiles, exit 0", granted.status, 0)) {
    t.eqStr("to the IR a compile with no policy writes", readOrEmpty(grantedIr), readOrEmpty(plainIr));
  }
  const denied = cli.plain("policy_denied", [source, "--deny", "fs.read", "--json", "-o", `${WORK}/policy_denied.ll`]);
  if (t.eqI32("a program that reaches a denied capability exits 1", denied.status, 1)) {
    const objects = cliObjectLines(denied.stdout);
    if (t.eqI32("with one object under --json", toI32(objects.length), 1)) {
      t.eqStr("whose code is the policy's", cliField(objects[0], "code"), "NL2459");
      t.contains("and whose message names the capability", cliField(objects[0], "message"), "reaches `fs.read`");
    }
  }

  // An open build is judged on every function a host can call, in every
  // module: here a second root's export, behind a header, with no `main`.
  writeFileSync(`${WORK}/policy_entry.ts`, "export const answer = (): i32 => 42;\n");
  writeFileSync(`${WORK}/policy_lib.ts`, "export const stamp = (): f64 => Date.now();\n");
  const library = cli.plain("policy_library", [
    `${WORK}/policy_entry.ts`,
    `${WORK}/policy_lib.ts`,
    "--emit-header",
    `${WORK}/policy.h`,
    "-o",
    `${WORK}/policy_library/`,
    "--deny",
    "clock",
    "--json",
  ]);
  if (t.eqI32("a header build is refused for a second module's export, exit 1", library.status, 1)) {
    const objects = cliObjectLines(library.stdout);
    if (t.eqI32("with one object under --json", toI32(objects.length), 1)) {
      t.contains("naming the export", cliField(objects[0], "message"), "`stamp` reaches `clock`");
    }
  }
  // One object per refused capability, in source order like every diagnostic.
  writeFileSync(
    `${WORK}/policy_two.ts`,
    [
      "export const main = (): number => {",
      '  const home = getenv("HOME");',
      "  return Date.now() > 0 && home !== null ? 0 : 1;",
      "};",
      "",
    ].join("\n")
  );
  const two = cli.plain("policy_two", [`${WORK}/policy_two.ts`, "--deny", "clock,env", "--json", "-o", `${WORK}/policy_two/`]);
  if (t.eqI32("a program reaching two denied capabilities exits 1", two.status, 1)) {
    const objects = cliObjectLines(two.stdout);
    if (t.eqI32("with one object per capability under --json", toI32(objects.length), 2)) {
      t.contains("the first is the earlier call, `env`", cliField(objects[0], "message"), "reaches `env`");
      t.contains("the second the later, `clock`", cliField(objects[1], "message"), "reaches `clock`");
      t.eqStr("both with the policy's code", `${cliField(objects[0], "code")} ${cliField(objects[1], "code")}`, "NL2459 NL2459");
    }
  }

  if (!env) {
    t.skip("nish run --deny", "needs env(1) to set XDG_CACHE_HOME, and the probe did not find one");
    return;
  }
  const abs = realpathSync(WORK);
  if (abs === null) {
    t.fail("nish run --deny", `cannot resolve ${WORK}`);
    return;
  }
  const cache = `XDG_CACHE_HOME=${abs}/policy-cache`;
  const refusedRun = cli.run("policy_run_denied", [cache], ["run", "--deny", "fs.read", source]);
  t.eqI32("nish run refuses a program outside its policy, exit 1", refusedRun.status, 1);
  t.eqStr("before the program runs", refusedRun.stdout, "");
  const ran = cli.run("policy_run", [cache], ["run", "--deny", "net", "tests/cases/caps_pure.ts"]);
  if (ran.status === 3 && contains(ran.stderr, "no usable C compiler")) {
    t.skip("nish run --deny", "no C compiler, so nothing can be linked");
    return;
  }
  t.eqI32("nish run --deny runs a program inside its policy", ran.status, 0);
  t.eqStr("and leaves the program's stdout alone", ran.stdout, "true\n6\n3.5\n");
};

/** The first line of a captured stream, without its newline. */
const firstLine = (text: string): string => {
  const lines = splitLines(text);
  return lines.length > 0 ? lines[0] : "";
};

/** A top-level field of a JSON object, as written, or `""` when it is missing. */
const jsonFieldOr = (object: string, name: string): string => {
  const value = jsonField(object, name);
  return value === null ? "" : value;
};

/**
 * The two dump flags, which are the other two rows of the table in `AGENTS.md`:
 * the tree the parser built and the side tables the checker recorded.
 *
 * Their *content* is pinned by the goldens (`tests/cases/dump_ast.stdout`,
 * `tests/self/dump-ast.golden`), so what is asked here is the contract: the dump is on stdout, the exit code is
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

/**
 * `--emit-panics <file.json>`: the panic sites, written beside the IR with the
 * same `wrote` line on stderr, stdout untouched, and not one byte of the IR
 * changed by asking. What the file says about each kind is the goldens'
 * (`tests/cases/panics_*.panics`); what is asked here is the shape a reader
 * keys on, and the usage error a missing path is.
 */
const checkPanicSites = (t: Suite, cli: Cli): void => {
  const source = `${WORK}/${FIXTURE_OK}`;
  const irPath = `${WORK}/panics.ll`;
  const listPath = `${WORK}/panics.json`;
  const run = cli.plain("emit_panics", [source, "-o", irPath, "--emit-panics", listPath]);
  if (!t.eqI32("--emit-panics exits 0", run.status, 0)) {
    return;
  }
  t.eqStr("and leaves stdout empty", trim(run.stdout), "");
  t.contains("and says on stderr where it wrote the sites", run.stderr, listPath);
  const list = readOrEmpty(listPath);
  t.eqBool('and the file is one `{"functions":[...]}` object', list.startsWith('{"functions":['), true);
  t.contains("which lists the entry's `main` with its sites", list, '"name":"main","symbol":');
  t.eqStr("and the IR is the bytes a compile without it writes", readOrEmpty(irPath), readOrEmpty(`${WORK}/ok.ll`));

  const noValue = cli.plain("emit_panics_no_value", [source, "--emit-panics"]);
  t.eqI32("--emit-panics with no file exits 2", noValue.status, 2);
};

/**
 * `--deny-panics`: a program with no panic site compiles to the bytes it
 * compiles to without the flag, and one with a site is refused, band 1, with
 * one `--json` object whose code is the rule's (NL2457). With `--emit-ast`,
 * which stops before the sites are known, it is a usage error.
 */
const checkDenyPanics = (t: Suite, cli: Cli): void => {
  const irPath = `${WORK}/deny_ok.ll`;
  const clean = cli.plain("deny_ok", [`${WORK}/${FIXTURE_OK}`, "-o", irPath, "--deny-panics"]);
  if (t.eqI32("--deny-panics on a program with no site exits 0", clean.status, 0)) {
    t.eqStr("and the IR is the bytes a compile without it writes", readOrEmpty(irPath), readOrEmpty(`${WORK}/ok.ll`));
  }
  const refused = cli.plain("deny_site", [`${WORK}/${FIXTURE_DENY}`, "--deny-panics", "--json", "-o", `${WORK}/deny.ll`]);
  if (!t.eqI32("--deny-panics on an unproven index exits 1", refused.status, 1)) {
    return;
  }
  const objects = cliObjectLines(refused.stdout);
  if (!t.eqI32("with one object under --json", toI32(objects.length), 1)) {
    return;
  }
  t.eqStr("whose severity is error", cliField(objects[0], "severity"), "error");
  t.eqStr("and whose code is the no-panic scope's", cliField(objects[0], "code"), "NL2457");
  const ast = cli.plain("deny_ast", [`${WORK}/${FIXTURE_DENY}`, "--deny-panics", "--emit-ast"]);
  t.eqI32("--deny-panics with --emit-ast exits 2", ast.status, 2);
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
 * Band 70, the compiler's own bug, reached through the `NISH_SIMULATE_ICE` hook:
 * the report names the input, asks for a bug report, and keeps the stack behind
 * `NISH_DEBUG=1`.
 *
 * Whether the compiler has the hook is probed rather than assumed from what kind
 * of file it is. The first run sets the variable on a program that compiles, so
 * an exit 0 is a compiler with no hook — a counted skip — and any other answer is
 * the hook's, which the checks below then hold to the contract.
 */
const checkInternalError = (t: Suite, cli: Cli, env: boolean): void => {
  if (!env) {
    t.skip(
      "an internal compiler error",
      "needs env(1) to set NISH_SIMULATE_ICE, and the probe did not find one"
    );
    return;
  }
  const source = `${WORK}/${FIXTURE_OK}`;
  const run = cli.run("ice", ["NISH_SIMULATE_ICE=1"], [source, "-o", `${WORK}/ice.ll`]);
  if (run.status === 0) {
    // Not a gap: a compiler without the hook still answers 70 with the same
    // report when it really breaks (`src/ice.ts`); it has nothing to provoke one with.
    t.skip(
      "an internal compiler error",
      `${cli.label} has no NISH_SIMULATE_ICE hook: it compiled ${FIXTURE_OK} with the variable set`
    );
    return;
  }
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
  // A native compiler has no exceptions, so there is no stack to print: what
  // the variable owes the reader is the report saying so, rather than a line
  // promising a trace a rerun would not produce (`src/ice.ts`).
  t.contains(
    "and the report says there is no stack behind it",
    debug.stderr,
    "there is no stack behind this, so NISH_DEBUG=1 adds nothing"
  );
  t.eqBool("and still prints no stack frame", hasStackFrame(debug.stderr), false);

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

/**
 * One refusal at the package boundary (WP21 S3): the `tests/link/` program that
 * provokes it, the flags it is compiled with, and the code it must carry.
 */
const checkPackageCode = (t: Suite, cli: Cli, name: string, flags: string[], code: string): void => {
  const args: string[] = [`tests/link/${name}/main.ts`, "--json", "-o", `${WORK}/${name}/`];
  for (const flag of flags) {
    args.push(flag);
  }
  const run = cli.plain(name, args);
  if (!t.eqI32(`${name}: a package the program cannot use refuses it`, run.status, 1)) {
    return;
  }
  const objects = cliObjectLines(run.stdout);
  if (!t.eqI32(`${name}: as one object`, toI32(objects.length), 1)) {
    return;
  }
  t.eqStr(`${name}: whose code names the cause`, cliField(objects[0], "code"), code);
  t.eqStr(`${name}: at the importing module`, cliField(objects[0], "file"), `tests/link/${name}/main.ts`);
};

/**
 * Every way a bare import can fail at the package boundary has its own code,
 * which is the promise `docs/wp21-packages.md` §5c and §6 make to a tool that
 * reads `--json`: a script can tell a package built for the other number mode
 * from one that needs a newer compiler, from one with no Nish source at all,
 * from one whose `package.json` is broken, without reading the prose. NL3014
 * is what is left when none of those is the reason.
 */
const checkPackageBoundary = (t: Suite, cli: Cli): void => {
  const none: string[] = [];
  checkPackageCode(t, cli, "package_other_mode", none, "NL3017");
  checkPackageCode(t, cli, "package_other_mode_f64", ["--number-mode", "f64"], "NL3017");
  checkPackageCode(t, cli, "package_engines_floor", none, "NL3018");
  checkPackageCode(t, cli, "package_engines_range", none, "NL3019");
  checkPackageCode(t, cli, "package_no_condition", none, "NL3020");
  checkPackageCode(t, cli, "package_not_nish", none, "NL3020");
  checkPackageCode(t, cli, "package_malformed", none, "NL3021");
  checkPackageCode(t, cli, "package_no_subpath", none, "NL3014");
  checkPackageCode(t, cli, "package_nested_condition", none, "NL3014");
};

/**
 * One whole-program clash (#174, #193): the `tests/link/` program that provokes
 * it, the module the report lands in — the later of the two, since the earlier
 * one is named in the message — and the code it must carry. Until #174 all of
 * these were `NL0000`, which is not a code a tool can key on.
 */
const checkClashCode = (t: Suite, cli: Cli, name: string, file: string, code: string): void => {
  const run = cli.plain(name, [`tests/link/${name}/main.ts`, "--json", "-o", `${WORK}/${name}/`]);
  if (!t.eqI32(`${name}: a symbol two modules define is refused`, run.status, 1)) {
    return;
  }
  const objects = cliObjectLines(run.stdout);
  if (!t.eqI32(`${name}: as one object`, toI32(objects.length), 1)) {
    return;
  }
  t.eqStr(`${name}: whose code names the clash`, cliField(objects[0], "code"), code);
  t.eqStr(`${name}: at the second definition`, cliField(objects[0], "file"), `tests/link/${name}/${file}`);
};

/**
 * An exported function and a private one are each a symbol the whole program
 * shares, so a second definition is a driver refusal with a code of its own:
 * NL3024 for an exported function and NL3026 for a private one, whose package
 * spellings, NL3025 and NL3027, are pinned by `tests/wordings/`. A class's
 * constructor or method is one too, but two classes that share one share a name,
 * and since #193 that is refused first and alone, as NL3028 — one object for one
 * mistake, whether the classes declare a constructor, a method, fields only, or
 * sit inside a package. Two generic classes of one package that share a name
 * are refused at the template (NL3013) once, even when a signature has made
 * their instantiations, members included, before any body is checked; and a
 * declared class spelled like an instantiation (`Box$i32`) is refused for its
 * `$` (NL2296), whichever of it and `Box<i32>` loads first.
 */
const checkSymbolClashes = (t: Suite, cli: Cli): void => {
  checkClashCode(t, cli, "class_clash_constructor", "lib.ts", "NL3028");
  checkClashCode(t, cli, "class_clash_method", "lib.ts", "NL3028");
  checkClashCode(t, cli, "class_clash_fields", "lib.ts", "NL3028");
  checkClashCode(t, cli, "iface_clash_private", "lib.ts", "NL3028");
  checkClashCode(t, cli, "class_clash_package", "node_modules/shapes/other.ts", "NL3028");
  checkClashCode(t, cli, "duplicate_export", "b.ts", "NL3024");
  checkClashCode(t, cli, "duplicate_internal", "helper.ts", "NL3026");
  checkClashCode(t, cli, "generic_class_clash_signature", "a.ts", "NL3013");
  checkClashCode(t, cli, "class_dollar_name", "main.ts", "NL2296");
  checkClashCode(t, cli, "class_dollar_name_imported", "lib.ts", "NL2296");
  checkPackageThenNameClash(t, cli, "class_clash_after_package", "a.ts", "b.ts");
  checkPackageThenNameClash(t, cli, "class_clash_package_after_root", "node_modules/pa/index.ts", "node_modules/pa/other.ts");
};

/**
 * Two modules of one package declare a class `Base` after a module of another
 * package did. The first of the two is refused against the other package
 * (NL3009) and the second against the first (NL3028): two objects, one per
 * mistake, and no third for the constructor the same-package pair shares.
 */
const checkPackageThenNameClash = (t: Suite, cli: Cli, name: string, crossFile: string, sameFile: string): void => {
  const run = cli.plain(name, [`tests/link/${name}/main.ts`, "--json", "-o", `${WORK}/${name}/`]);
  if (!t.eqI32(`${name}: a class two packages declare is refused`, run.status, 1)) {
    return;
  }
  const objects = cliObjectLines(run.stdout);
  if (!t.eqI32(`${name}: as two objects`, toI32(objects.length), 2)) {
    return;
  }
  t.eqStr(`${name}: first across packages`, cliField(objects[0], "code"), "NL3009");
  t.eqStr(`${name}: at the package's first declaration`, cliField(objects[0], "file"), `tests/link/${name}/${crossFile}`);
  t.eqStr(`${name}: then inside the package`, cliField(objects[1], "code"), "NL3028");
  t.eqStr(`${name}: at the package's second declaration`, cliField(objects[1], "file"), `tests/link/${name}/${sameFile}`);
};

/**
 * `VERSION` without a prerelease or build tag: `0.9.0` for `0.9.0-rc.1`. A
 * floor is written in the numbers alone, so this is the version a floor is
 * compared against.
 */
const versionCore = (version: string): string => {
  let end = version.length;
  const dash = version.indexOf("-");
  if (dash >= 0 && dash < end) {
    end = dash;
  }
  const plus = version.indexOf("+");
  if (plus >= 0 && plus < end) {
    end = plus;
  }
  return version.substring(0, end);
};

/** `core` with its last number one higher: the smallest floor this compiler does not meet. */
const nextPatch = (core: string): string => {
  let dot = -1;
  let at = 0;
  while (at < core.length) {
    if (core.charCodeAt(at) === 46) {
      dot = at;
    }
    at = at + 1;
  }
  return `${core.substring(0, dot + 1)}${toI32(parseInt(core.substring(dot + 1))) + 1}`;
};

/**
 * A program importing one package whose `engines.nish` is `range`, written
 * under `WORK` rather than checked in: the floors at the boundary are derived
 * from the compiler's own version, so they have to move with every release,
 * and a checked-in `>=0.8.0` would stop being the boundary at the next one.
 */
const writeEnginesFixture = (name: string, range: string): string => {
  const dir = `${WORK}/${name}`;
  const pkg = `${dir}/node_modules/pkg_edge`;
  mkdirSync(dir);
  mkdirSync(`${dir}/node_modules`);
  mkdirSync(pkg);
  writeFileSync(
    `${pkg}/package.json`,
    `{ "name": "pkg_edge", "version": "1.0.0", "engines": { "nish": "${range}" }, "exports": { ".": { "nish": "./index.ts" } } }\n`
  );
  writeFileSync(`${pkg}/index.ts`, "export const seed = (): i32 => 7;\n");
  writeFileSync(`${dir}/main.ts`, 'import { seed } from "pkg_edge";\n\nexport const main = (): i32 => seed();\n');
  return `${dir}/main.ts`;
};

/**
 * The `engines.nish` boundary, at this compiler's own version (WP21 S3): a
 * floor equal to it is met and compiles, one patch above it is refused as
 * NL3018, and every refusal names the version that was compared. Both are
 * derived from `VERSION` in `src/branding.ts`, the constant `--version`
 * prints, so they test the boundary after a release as well as before it.
 */
const checkEnginesBoundary = (t: Suite, cli: Cli): void => {
  const core = versionCore(VERSION);
  const equal = writeEnginesFixture("engines_equal", `>=${core}`);
  const met = cli.plain("engines_equal", [equal, "-o", `${WORK}/ir_engines_equal/`]);
  t.eqI32(`a floor of >=${core}, this compiler's own version, is met and compiles`, met.status, 0);

  const above = nextPatch(core);
  const next = writeEnginesFixture("engines_above", `>=${above}`);
  const refused = cli.plain("engines_above", [next, "--json", "-o", `${WORK}/ir_engines_above/`]);
  if (!t.eqI32(`a floor of >=${above}, one patch above this compiler, is refused`, refused.status, 1)) {
    return;
  }
  const objects = cliObjectLines(refused.stdout);
  if (!t.eqI32("as one object", toI32(objects.length), 1)) {
    return;
  }
  t.eqStr("whose code is the floor's", cliField(objects[0], "code"), "NL3018");
  t.contains(
    "and whose message names the floor and this compiler's version",
    cliField(objects[0], "message"),
    `asks for \`>=${above}\` and this is nish ${VERSION}`
  );

  const fixed = cli.plain("engines_floor_text", ["tests/link/package_engines_floor/main.ts", "-o", `${WORK}/ir_engines_floor/`]);
  t.contains(
    "package_engines_floor's refusal ends with this compiler's version",
    fixed.stderr,
    `asks for \`>=999.0.0\` and this is nish ${VERSION}`
  );
};

/**
 * Module and package identity is the real path (#198). One package name at two
 * real directories is refused at the import that reached the second, with a
 * code of its own (NL3029), rather than compiled as two copies that then clash
 * on a symbol. And two modules whose output stems meet — `types.ts` and
 * `far/../types.ts`, with `far` a link elsewhere, are two files — are written
 * to two files: the second takes `types_2.ll` instead of overwriting the first.
 */
const checkIdentity198 = (t: Suite, cli: Cli): void => {
  const twoDirs = "package_two_dirs";
  const run = cli.plain(twoDirs, [`tests/link/${twoDirs}/main.ts`, "--json", "-o", `${WORK}/${twoDirs}/`]);
  if (t.eqI32(`${twoDirs}: one package at two directories is refused`, run.status, 1)) {
    const objects = cliObjectLines(run.stdout);
    if (t.eqI32(`${twoDirs}: as one object`, toI32(objects.length), 1)) {
      t.eqStr(`${twoDirs}: whose code names the cause`, cliField(objects[0], "code"), "NL3029");
      t.eqStr(
        `${twoDirs}: at the import that reached the second copy`,
        cliField(objects[0], "file"),
        `tests/link/${twoDirs}/node_modules/user/index.ts`
      );
    }
  }

  const out = `${WORK}/identity_dotdot`;
  // A `types.ll` left by an earlier run would let one write look like two.
  spawnSyncTo(["rm", "-rf", out], `${WORK}/rm.out`, `${WORK}/rm.err`);
  const fixture = "tests/link/identity_symlink_dotdot";
  const dotdot = cli.plain("identity_dotdot", [`${fixture}/main.ts`, `${fixture}/far/../types.ts`, "-o", `${out}/`]);
  if (!t.eqI32("a link followed by `..` is a second module, and compiles", dotdot.status, 0)) {
    return;
  }
  t.contains("the imported `types.ts` keeps its stem", readOrEmpty(`${out}/types.ll`), "@seven(");
  t.contains("and the root it shares a stem with is written beside it", readOrEmpty(`${out}/types_2.ll`), "@eleven(");
};

/**
 * `argv` started in `dir` rather than here, through `sh`, since a spawn has no
 * working directory of its own to set. The directory and every argument are
 * positional parameters, so none of them is ever read as shell syntax.
 */
const inDirectory = (dir: string, argv: string[]): string[] => {
  const out: string[] = ["sh", "-c", 'cd "$1" && shift && exec "$@"', "sh", dir];
  for (const arg of argv) {
    out.push(arg);
  }
  return out;
};

/** `rm -rf`, so a check starts from nothing an earlier run left behind. */
const removeTree = (path: string): void => {
  spawnSyncTo(["rm", "-rf", "--", path], `${WORK}/rm.out`, `${WORK}/rm.err`);
};

/** `text` at `path`, made executable: `writeFileSync` creates every file `0644`. */
const writeExecutable = (path: string, text: string): void => {
  writeFileSync(path, text);
  spawnSyncTo(["chmod", "755", path], `${WORK}/chmod.out`, `${WORK}/chmod.err`);
};

/** The `ls -ld` line for `path`, whose first ten bytes are its type and mode. */
const modeLine = (path: string): string => {
  spawnSyncTo(["ls", "-ld", path], `${WORK}/ls.out`, `${WORK}/ls.err`);
  return readOrEmpty(`${WORK}/ls.out`);
};

/** `bytes` as lowercase hex, two digits a byte. */
const hexOf = (bytes: u8[]): string => {
  const out: string[] = [];
  for (const b of bytes) {
    const v = toI32(b);
    out.push(hexDigitLower(v >> 4));
    out.push(hexDigitLower(v));
  }
  return out.join("");
};

/** A program that says it ran and answers 7, so a run of the wrong binary cannot pass for it. */
const writeRunFixture = (path: string): void => {
  writeFileSync(
    path,
    ["export const main = (): number => {", '  console.log("cli-sec ran");', "  return 7;", "};", ""].join("\n")
  );
};

/**
 * `nish run` keeps its performance advice to itself, since a script prints on
 * every run, but a deprecated flag it is handed still says so (NL9014,
 * NL9015), on stderr or as a `--json` object, and `--no-warn-performance`
 * silences that too. The script allocates in a loop, so the advice it does not
 * print is really there.
 */
const checkRunDeprecations = (t: Suite, cli: Cli, cache: string): void => {
  const script = `${WORK}/run-deprecated.ts`;
  writeFileSync(
    script,
    [
      "export const main = (): number => {",
      "  let total = 0;",
      "  for (let i = 0; i < 4; i++) {",
      "    const row = new Array<i32>(3 + i);",
      "    total = total + row.length;",
      "  }",
      "  return total - 11;",
      "};",
      "",
    ].join("\n")
  );
  const env = [`XDG_CACHE_HOME=${cache}`];
  const json = cli.run("run_unchecked_json", env, ["run", "--unchecked-indexing", "--json", script]);
  const objects = cliObjectLines(json.stdout);
  t.eqI32("nish run --unchecked-indexing runs the script", json.status, 7);
  if (t.eqI32("and --json carries one object, the deprecation and not the advice", toI32(objects.length), 1)) {
    t.eqStr("whose code is NL9014", cliField(objects[0], "code"), "NL9014");
  }
  const human = cli.run("run_wrapping", env, ["run", "--wrapping", script]);
  t.eqI32("nish run --wrapping runs the script", human.status, 7);
  t.contains("and says on stderr that --wrapping is deprecated", human.stderr, "--wrapping is deprecated");
  t.eqBool(
    "and still prints none of the performance advice",
    contains(human.stderr, "allocates a dynamically sized array"),
    false
  );
  const quiet = cli.run("run_wrapping_quiet", env, ["run", "--wrapping", "--no-warn-performance", script]);
  t.eqBool("--no-warn-performance silences it under nish run", contains(quiet.stderr, "deprecated"), false);
};

/**
 * `nish run`'s cache, as another user or a stale entry would meet it
 * (docs/security/cli.md). Each check names the finding it pins: CLI-1, a
 * script called `key.ts`, whose binary was overwritten by the entry's key and
 * started as text; CLI-3, a relative `XDG_CACHE_HOME`, which put the cache in
 * whatever directory the run was started in; CLI-4, the cache root, which was
 * left with the umask's mode and so readable by every user. Then the
 * properties the record verifies: an entry whose key is not this run's is
 * relinked rather than started, and a link's paths reach `scripts/build.sh`
 * as arguments rather than as shell text.
 *
 * A run needs a C compiler, so a compiler that cannot link is one counted skip.
 */
const checkRunCache = (t: Suite, cli: Cli, env: boolean): void => {
  if (!env) {
    t.skip("nish run's cache", "needs env(1) to set XDG_CACHE_HOME, and the probe did not find one");
    return;
  }
  const abs = realpathSync(WORK);
  if (abs === null) {
    t.fail("nish run's cache", `cannot resolve ${WORK}`);
    return;
  }
  const cache = `${abs}/sec-cache`;
  removeTree(cache);
  const script = `${WORK}/key.ts`;
  writeRunFixture(script);
  const first = cli.run("sec_key", [`XDG_CACHE_HOME=${cache}`], ["run", script]);
  if (first.status === 3 && contains(first.stderr, "no usable C compiler")) {
    t.skip("nish run's cache", "no C compiler, so nothing can be linked into it");
    return;
  }
  t.eqI32("CLI-1: a script called key.ts runs, and answers its own status", first.status, 7);
  t.contains("CLI-1: and its own output", first.stdout, "cli-sec ran");
  const hit = cli.run("sec_key_hit", [`XDG_CACHE_HOME=${cache}`], ["run", script]);
  t.eqI32("CLI-1: and runs again from the cache", hit.status, 7);
  checkRunDeprecations(t, cli, cache);

  t.eqStr(
    "CLI-4: the cache root is private to its owner",
    modeLine(`${cache}/nish/run`).substring(0, 10),
    "drwx------"
  );

  // CLI-10: a cache root that cannot be made is reported as that, not as the
  // chmod that never ran. A regular file where a directory should be makes
  // mkdir fail with ENOTDIR.
  const blocked = `${abs}/sec-blocked`;
  removeTree(blocked);
  writeFileSync(blocked, "not a directory\n");
  const unmade = cli.run("sec_mkdir", [`XDG_CACHE_HOME=${blocked}`], ["run", script]);
  t.eqI32("CLI-10: a cache root that cannot be made is refused with the toolchain band", unmade.status, 3);
  t.contains("CLI-10: and says it could not be created", unmade.stderr, `run: cannot create ${blocked}/nish/run`);
  t.eqBool("CLI-10: not that chmod failed", contains(unmade.stderr, "chmod 700 failed"), false);

  // An entry whose key is replaced by one that is not this run's, and whose
  // binary by a script that would print PLANTED: a run that trusted the
  // entry's name rather than comparing the key would start it. A cache and a
  // script of its own, so it says nothing about CLI-1.
  const tamperCache = `${abs}/sec-tamper-cache`;
  removeTree(tamperCache);
  const tamper = `${WORK}/sec-tamper.ts`;
  writeRunFixture(tamper);
  cli.run("sec_tamper", [`XDG_CACHE_HOME=${tamperCache}`], ["run", tamper]);
  const entries = readdirSync(`${tamperCache}/nish/run`);
  const path = getenv("PATH");
  if (entries !== null && t.eqI32("there is one entry to tamper with", toI32(entries.length), 1)) {
    const entry = `${tamperCache}/nish/run/${entries[0]}`;
    // CLI-8: the entry is named by the SHA-256 of the key it holds, checked
    // against `std/crypto`'s, which is a second implementation of the hash:
    // sixty-four hex digits, where a 64-bit FNV-1a gave sixteen.
    const keyBytes = readFileBytesSync(`${entry}/key`);
    t.eqStr(
      "CLI-8: the entry is named by the SHA-256 of its key",
      entries[0],
      keyBytes === null ? "(no key)" : hexOf(sha256(keyBytes))
    );
    writeFileSync(`${entry}/key`, "nish 0.0.0\nrun sec-tamper\nnot this run's key\n");
    writeExecutable(`${entry}/sec-tamper`, "#!/bin/sh\necho PLANTED\nexit 0\n");
    const relinked = cli.run("sec_relink", [`XDG_CACHE_HOME=${tamperCache}`], ["run", tamper]);
    t.eqI32("an entry whose key is not this run's is relinked, not started", relinked.status, 7);
    t.eqBool("and the binary it held never ran", contains(relinked.stdout, "PLANTED"), false);

    // CLI-5: a run that dies between moving its binary in and writing its key
    // must not leave the entry's old key beside the new binary. The entry is
    // given a key that is not this run's, standing in for another program
    // whose key hashed to the same name, and `mv` is a stub that does the real
    // move and then kills the compiler that started it.
    if (path !== null) {
      const stubs = `${abs}/sec-stubs`;
      removeTree(stubs);
      mkdirSync(stubs);
      writeExecutable(`${stubs}/mv`, '#!/bin/sh\n/bin/mv "$@" || exit 1\nkill -9 $PPID\n');
      const otherKey = "nish 0.0.0\nrun sec-tamper\nanother program's key\n";
      writeFileSync(`${entry}/key`, otherKey);
      cli.run("sec_killed", [`XDG_CACHE_HOME=${tamperCache}`, `PATH=${stubs}:${path}`], ["run", tamper]);
      t.eqBool(
        "CLI-5: a run killed after its binary is moved in leaves no other program's key beside it",
        readOrEmpty(`${entry}/key`) === otherKey,
        false
      );
    }
  }

  const relative = `${WORK}/sec-relative-cache`;
  const home = `${abs}/sec-home`;
  removeTree(relative);
  removeTree(home);
  const ok = `${WORK}/sec-ok.ts`;
  writeRunFixture(ok);
  const viaRelative = cli.run("sec_relative", [`XDG_CACHE_HOME=${relative}`, `HOME=${home}`], ["run", ok]);
  t.eqI32("CLI-3: a run with a relative XDG_CACHE_HOME still runs", viaRelative.status, 7);
  t.eqBool("CLI-3: and keeps nothing under the relative path", isDirectorySync(relative), false);
  t.eqBool("CLI-3: but under $HOME/.cache, as if it were unset", isDirectorySync(`${home}/.cache/nish/run`), true);
  const homeless = cli.run(
    "sec_relative_home",
    [`XDG_CACHE_HOME=${relative}`, "HOME=relative-home"],
    ["run", "--json", ok]
  );
  t.eqI32("CLI-3: with no absolute HOME either, the run is refused with the toolchain band", homeless.status, 3);
  t.eqBool("CLI-3: and nothing is kept under the relative HOME", isDirectorySync("relative-home"), false);

  // Every byte that is shell syntax in one place: a link that reached a shell
  // as text would run the `touch`.
  const marker = `${abs}/sec-meta-ran`;
  removeTree(marker);
  const exe = `${WORK}/sec meta;touch ${marker};$(touch ${marker})\`touch ${marker}\``;
  const meta = cli.plain("sec_meta", [`${WORK}/${FIXTURE_OK}`, "-o", `${WORK}/sec-meta.ll`, "--link", exe]);
  t.eqI32("a --link path full of shell syntax links", meta.status, 0);
  t.eqBool("and none of it is run", readFileSyncOrNull(marker) !== null, false);
  removeTree(`${WORK}/sec meta;touch `);
};

/**
 * CLI-2: a compiler with no package beside it does not take one from the
 * directory it is run in. The compiler under test is copied out of its
 * package, and run in a directory that holds a `scripts/build.sh` and a
 * `std/` of someone else's: `--link` must not run the script, and
 * `nish/<module>` must not compile the library. Both did until the working
 * directory stopped being a candidate for a compiler outside it.
 */
const checkPackageRoot = (t: Suite, cli: Cli): void => {
  if (cli.head.length !== 1) {
    t.skip("a compiler outside its package", `${cli.label} is not a binary that can be copied out of its package`);
    return;
  }
  const abs = realpathSync(WORK);
  if (abs === null) {
    t.fail("a compiler outside its package", `cannot resolve ${WORK}`);
    return;
  }
  const lone = `${abs}/sec-standalone/bin`;
  const planted = `${abs}/sec-planted`;
  removeTree(`${abs}/sec-standalone`);
  removeTree(planted);
  mkdirSync(`${abs}/sec-standalone`);
  mkdirSync(lone);
  mkdirSync(planted);
  mkdirSync(`${planted}/scripts`);
  mkdirSync(`${planted}/std`);
  if (spawnSyncTo(["cp", cli.head[0], `${lone}/nish`], `${WORK}/cp.out`, `${WORK}/cp.err`) !== 0) {
    t.fail("a compiler outside its package", `cannot copy ${cli.label}: ${readOrEmpty(`${WORK}/cp.err`)}`);
    return;
  }
  const marker = `${planted}/build-sh-ran`;
  writeFileSync(`${planted}/scripts/build.sh`, `touch '${marker}'\nexit 0\n`);
  writeFileSync(`${planted}/std/planted.ts`, "export const plantedOnly = (): number => 1;\n");
  writeFileSync(`${planted}/main.ts`, ["export const main = (): number => {", "  return 0;", "};", ""].join("\n"));
  writeFileSync(
    `${planted}/uses-std.ts`,
    [
      'import { plantedOnly } from "nish/planted";',
      "export const main = (): number => {",
      "  return plantedOnly();",
      "};",
      "",
    ].join("\n")
  );

  const link = spawnSyncTo(
    inDirectory(planted, [`${lone}/nish`, "main.ts", "-o", "out/", "--link", "out/main"]),
    `${WORK}/sec_planted_link.out`,
    `${WORK}/sec_planted_link.err`
  );
  t.eqBool(
    "CLI-2: --link does not run the working directory's scripts/build.sh",
    readFileSyncOrNull(marker) !== null,
    false
  );
  t.eqI32("CLI-2: and is refused with the toolchain band, since there is no package", link, 3);

  const std = spawnSyncTo(
    inDirectory(planted, [`${lone}/nish`, "uses-std.ts", "-o", "out/"]),
    `${WORK}/sec_planted_std.out`,
    `${WORK}/sec_planted_std.err`
  );
  t.eqI32("CLI-2: nish/<module> is not read from the working directory's std/", std, 1);
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
  checkDeprecatedFlagObjects(t, cli);
  checkPortabilityObjects(t, cli);
  checkDeprecationObjects(t, cli);
  checkFixField(t, cli);
  checkDumps(t, cli);
  checkPanicSites(t, cli);
  checkDenyPanics(t, cli);
  checkCapabilities(t, cli, env);
  checkCapabilityPolicy(t, cli, env);
  checkMissingInput(t, cli);
  checkToolchain(t, cli, env);
  checkInternalError(t, cli, env);
  checkPackageBoundary(t, cli);
  checkEnginesBoundary(t, cli);
  checkSymbolClashes(t, cli);
  checkIdentity198(t, cli);
  checkRunCache(t, cli, env);
  checkPackageRoot(t, cli);

  return t.done();
};
