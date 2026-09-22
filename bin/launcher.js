/**
 * The `nish` command: run the native compiler this machine installed, or say
 * why there is none and stop.
 *
 * This is what `bin.nish` points at, and it exists because npm cannot point a
 * `bin` entry at a dependency that may or may not be installed. The native
 * compiler ships as `@amritk/nish-<asset>` packages declared as
 * `optionalDependencies` with `os` and `cpu` set, so npm installs exactly the
 * one that matches and silently skips the rest (docs/wp12-release.md,
 * "Which compiler the package ships"). Something still has to look at what
 * landed and hand over to it, and that is this file.
 *
 * **Nothing is ever compiled on a user's machine.** The binary is built,
 * `--verify`d and smoke-tested per platform by `release.yml` before the
 * release that carries it exists; installing is a download and an unpack.
 *
 * **A platform with no prebuilt binary is now an error rather than a fallback,
 * and that is a decision rather than an oversight.** Until 0.6.0 this file
 * imported `dist/index.js` -- the TypeScript compiler built from `src/` -- so
 * musl, FreeBSD and 32-bit anything got a working compiler that happened to be
 * slower. `src/` is being deleted (`docs/wp19-stage0-retirement.md`), so there
 * is no second compiler in the package to reach for, and the honest answer is
 * the one below: name the platforms a release carries, say there is nothing to
 * fall back to, and exit non-zero. The alternative -- shipping `self/` and
 * bootstrapping on the user's machine -- was priced in wp12 and turned down,
 * and quietly doing nothing was never on the table: a command that exits 0
 * having compiled nothing is worse than one that refuses.
 *
 * `bin/` rather than `dist/` for the same reason: the command may not be a
 * build artifact of the compiler it installs.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { assetFor, noCompilerMessage, platformPackageName } from "./packaging.js";

/** Package root: bin/launcher.js -> `..`, the directory `package.json` sits in. */
const PKG_ROOT = path.resolve(import.meta.dirname, "..");

/**
 * Exit 3, the toolchain code.
 *
 * **It is deliberately the same 3 a missing `clang` answers, and that is worth
 * defending because a wrapper cannot tell the two apart by status alone.** The
 * table in docs/wp12-release.md's "Exit codes and failure modes" reads
 * "toolchain: the C toolchain, or the prebuilt compiler itself, could not be
 * run", which is one band for one shape of failure: nothing is wrong with the
 * program, there is no source position, and what could not be run is a
 * *program* rather than the input. A fourth code would put the launcher in the
 * exit-status contract that `tests/nish/cli.ts` pins for the compiler, for a
 * situation the compiler cannot be in. What tells them apart is the `code`
 * field under `--json` and the first line otherwise, which is why the refusal
 * below is machine-readable. `scripts/postinstall.mjs`'s generated shim answers
 * 3 for its own version of this, so all three spell one situation the same way.
 */
const NO_COMPILER = 3;

/** This package's own name, or `null` when its `package.json` cannot be read. */
const packageName = () => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, "package.json"), "utf8"));
    return typeof pkg.name === "string" ? pkg.name : null;
  } catch {
    return null;
  }
};

/**
 * Whether this invocation asked for machine-readable output.
 *
 * Read off the raw argv rather than parsed, because the launcher does not parse
 * the command line and must not start: every other flag is the compiler's
 * business. `--json` is the one thing it has to notice, since a refusal is a
 * failure the `--json` contract covers (AGENTS.md, "Machine-readable
 * surfaces").
 */
const wantsJson = () => process.argv.slice(2).includes("--json");

/**
 * Write and exit, without losing what was written.
 *
 * `process.exit` does not wait for a pending write, and stdout/stderr are
 * asynchronous when they are pipes -- which is what they are whenever anything
 * captures this command's output, and the case where the message matters most.
 * `process.exitCode` plus a natural exit flushes, so that is what this does;
 * there is nothing after it to run.
 */
const writeAndExit = (stream, text, status) => {
  stream.write(text);
  process.exitCode = status;
};

/**
 * Where the native compiler for this machine is, or `null` when this machine
 * has none installed.
 *
 * Resolution goes through the platform package's `package.json` rather than
 * its binary, because a package may expose its own files however it likes but
 * `./package.json` is the one export every package in this project declares.
 * From there the layout is the release tarball's, unchanged: `bin/nish` beside
 * `runtime/`, `scripts/` and `std/`, which is what lets the binary find
 * `build.sh`, the C runtime and the standard library one level up from itself
 * exactly as it does when unpacked by hand.
 */
const nativeCompiler = (asset) => {
  const name = packageName();
  if (name === null) return null;
  try {
    const manifest = createRequire(import.meta.url).resolve(`${platformPackageName(name, asset)}/package.json`);
    const binary = path.join(path.dirname(manifest), "bin", "nish");
    return fs.existsSync(binary) ? binary : null;
  } catch {
    // Not installed. On a supported platform that is a partial install; on an
    // unsupported one npm skipped the entry on purpose. `refuse` tells the two
    // apart, because the advice differs.
    return null;
  }
};

/**
 * Say why there is no compiler to run, and stop.
 *
 * Under `--json` that is one object on stdout and **nothing on stderr**, which
 * is the shape `self/compile.ts`'s own `reportToolchainFailure` uses for the
 * same code: stdout carries objects and nothing else, so a tool reading it does
 * not have to strip a human report out of the stream. Otherwise it is the
 * report on stderr. Either way the status is the same.
 */
const refuse = (unstartable) => {
  const why = noCompilerMessage({
    platform: process.platform,
    arch: process.arch,
    // The name comes from this package's own `package.json` or not at all. A
    // literal here would be the scope spelled a second time, against
    // packaging.js's own rule, and a *wrong* package name is worse advice than
    // none: it sends the user to install something that does not exist.
    packageName: packageName(),
    unstartable,
  });
  if (wantsJson()) {
    writeAndExit(
      process.stdout,
      `${JSON.stringify({ severity: "error", code: why.code, message: why.summary })}\n`,
      NO_COMPILER
    );
  } else {
    writeAndExit(process.stderr, why.report, NO_COMPILER);
  }
};

const asset = assetFor(process.platform, process.arch);
// No binary for this machine, and none coming: musl, FreeBSD, 32-bit anything.
// `refuse` sets an exit code rather than exiting, so each of these returns
// before the next line runs: the sequence below is written as a chain for that
// reason and `process.exitCode` is what carries the status out.
if (asset === null) {
  refuse(null);
} else {
  const binary = nativeCompiler(asset);
  if (binary === null) {
    // A binary exists for this platform and this install does not have it.
    refuse(null);
  } else {
    handOver(binary);
  }
}

/** Run the native compiler and give the caller back exactly what it answered. */
function handOver(binary) {
  const result = spawnSync(binary, process.argv.slice(2), { stdio: "inherit" });
  if (result.error !== undefined && result.error !== null) {
    // Installed and will not start -- a broken or partial install rather than an
    // unsupported platform. There is nothing to fall back to, so this is a
    // refusal with the reason in it rather than a warning above a slower compile.
    refuse({ binary, reason: result.error.message });
    } else if (result.signal !== null) {
    // Re-raise rather than translating to an exit code, so that a crash or an
    // interrupt reaches the shell as the signal it was. `process.exitCode`
    // cannot express one, and a wrapper that turned SIGINT into exit 130 would
    // make `nish` the one command in a pipeline that did.
    process.kill(process.pid, result.signal);
  } else {
    process.exitCode = result.status ?? 0;
  }
}
