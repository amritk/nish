#!/usr/bin/env node
/**
 * The `nish` command: run the native compiler when this machine has one, and
 * the Node compiler when it does not.
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
 * release that carries it exists; installing is a download and an unpack. A
 * platform with no binary of its own falls back to the Node compiler in
 * `dist/`, which is already in this package and needs no C toolchain — slower
 * to compile with, but instant to install and correct everywhere node runs.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { assetFor, platformPackageName } from "./packaging.js";
import { PKG_ROOT } from "./version.js";

/**
 * Where the native compiler for this machine is, or `null` when this machine
 * has none installed.
 *
 * Resolution goes through the platform package's `package.json` rather than
 * its binary, because a package may expose its own files however it likes but
 * `./package.json` is the one export every package in this project declares.
 * From there the layout is the release tarball's, unchanged: `bin/nish` beside
 * `runtime/` and `scripts/`, which is what lets the binary find `build.sh` and
 * the C runtime one level up from itself exactly as it does when unpacked by
 * hand.
 */
const nativeCompiler = (): string | null => {
  const asset = assetFor(process.platform, process.arch);
  if (asset === null) return null;
  let name: string;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, "package.json"), "utf8")) as { name?: unknown };
    if (typeof pkg.name !== "string") return null;
    name = platformPackageName(pkg.name, asset);
  } catch {
    return null;
  }
  try {
    const manifest = createRequire(import.meta.url).resolve(`${name}/package.json`);
    const binary = path.join(path.dirname(manifest), "bin", "nish");
    return fs.existsSync(binary) ? binary : null;
  } catch {
    // Not installed, which is the ordinary answer on a platform this project
    // attaches no binary for. The fallback below is the whole handling.
    return null;
  }
};

const binary = nativeCompiler();
if (binary === null) {
  // No native compiler here, so run the one in this package. Imported rather
  // than spawned: `index.js` reads `process.argv` and sets `process.exitCode`
  // itself, so handing it this process costs nothing and keeps `nish` a single
  // process on the platforms that need this path most.
  await import("./index.js");
} else {
  const result = spawnSync(binary, process.argv.slice(2), { stdio: "inherit" });
  if (result.error !== undefined && result.error !== null) {
    // The package is installed and its binary will not start -- a broken or
    // partial install rather than an unsupported platform. Say so, because
    // falling back in silence would leave the user wondering why the compiler
    // they installed for the speed is answering at a Node compiler's pace.
    console.error(`nish: ${binary} could not be started (${result.error.message}); using the Node compiler instead`);
    await import("./index.js");
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
