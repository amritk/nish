#!/usr/bin/env node
/**
 * Put the native compiler on PATH directly, when this machine got one.
 *
 * `bin/nish` ships as a node shim that resolves the prebuilt binary and spawns
 * it. That works everywhere and costs node's startup on every invocation --
 * 94 ms against the binary's own 2.7 ms, which is nothing for a single build
 * and is 80 seconds across a suite that spawns a compiler per case. So when a
 * `@amritk/nish-<asset>` package did get installed, this replaces the shim
 * with a one-line `exec` of that package's binary: 3.9 ms, and no node.
 *
 * **It execs the binary where it lies; it does not copy it here.** Copying was
 * the first attempt and it is wrong, for a reason worth writing down because
 * nothing in the test suite was looking for it. npm links the command as
 * `node_modules/.bin/nish -> ../@amritk/nish/bin/nish`, so a user always
 * invokes it through a symlink, and the native compiler resolves `build.sh`
 * and `runtime/` from `argv[0]`'s directory without following one. A copy at
 * `@amritk/nish/bin/nish` invoked through `.bin` therefore looks for them in
 * `node_modules/`, finds neither, and every `--link` fails with "cannot find
 * scripts/build.sh" -- while `--version` and plain `-o` keep working, which is
 * what makes it a trap. The node shim never had the problem because node
 * resolves `import.meta.url` to the realpath.
 *
 * Execing an absolute path sidesteps it entirely and is better on its own
 * terms: the binary runs from inside its own package, next to the `runtime/`
 * and `scripts/` that were staged and smoke-tested beside it by `release.yml`,
 * rather than beside the main package's copies.
 *
 * **The compiler resolves the link itself as of 0.6.0** -- the real path of
 * whatever `argv[0]` named is a candidate for the package root
 * ([wp19 §5a](../docs/wp19-stage0-retirement.md) item 4, in `self/`) -- so this
 * `exec` is no longer what makes a copy work, and the reason it is still here is
 * the 91 ms above rather than the defect. It also still carries whoever never
 * ran this script: a shim npm linked and nothing swapped now finds its own
 * package too.
 *
 * **This script may never fail an install.** It exits 0 whatever happens --
 * no prebuilt binary for this platform, a read-only `node_modules`, scripts
 * disabled, a partially written package. Every one of those leaves the shim in
 * place, and the shim is the mechanism this only optimises: where a prebuilt
 * binary exists it finds it, and where none does it says so and exits 3. What
 * it is *not*, since 0.6.0, is a compiler of its own -- `dist/` is no longer in
 * the package -- so "the shim is still there" means the command still behaves
 * correctly, not that it can still compile on a platform with no binary. A
 * postinstall that can break `npm ci` is a worse bug than the startup cost it
 * exists to remove.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");

const swap = async () => {
  // A checkout, not an install. The repository is its own package, so `npm ci`
  // here installs this package's own optionalDependencies -- and without this
  // guard, the first `npm ci` after they are published would overwrite the
  // tracked `bin/nish` with a binary and leave the working tree dirty. The
  // landmark is `self/compile.ts`, which is the check `scripts/bootstrap.sh`
  // makes and is not in `files`; it used to be `src/launcher.ts`, which stopped
  // being a landmark when the launcher moved into `bin/` and ships.
  if (fs.existsSync(path.join(root, "self", "compile.ts"))) return "a checkout, so the shim stays";

  const shim = path.join(root, "bin", "nish");
  if (!fs.existsSync(shim)) return "no bin/nish to replace";

  const packaging = path.join(root, "bin", "packaging.js");
  if (!fs.existsSync(packaging)) return "bin/packaging.js is missing";
  const { assetFor, platformPackageName } = await import(pathToFileURL(packaging).href);
  const asset = assetFor(process.platform, process.arch);
  if (asset === null) return `no prebuilt binary for ${process.platform}/${process.arch}`;

  const name = platformPackageName(
    JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).name,
    asset
  );
  let binary;
  try {
    const manifest = createRequire(import.meta.url).resolve(`${name}/package.json`);
    binary = path.join(path.dirname(manifest), "bin", "nish");
  } catch {
    return `${name} is not installed`;
  }
  if (!fs.existsSync(binary)) return `${name} carries no bin/nish`;

  // The absolute path is baked in at install time, which is the one thing this
  // gives up: a `node_modules` copied to a different path without a reinstall
  // leaves a shim pointing at nothing. The `-x` test is what turns that from a
  // confusing exec failure into a sentence naming the fix, and `npm rebuild`
  // re-runs this script and rewrites the path.
  //
  // Written beside the target and renamed, so a process running `nish` while
  // this runs never sees a half-written one; rename is atomic within a
  // directory, and the temporary file is cleaned up if it is not.
  //
  // Single quotes, not `JSON.stringify`. JSON escaping is not shell escaping:
  // it leaves `$` and a backtick alone, and inside the double quotes they would
  // have ended up in, the shell would expand them. A home directory with a `$`
  // in it is unusual and entirely legal. In POSIX sh nothing is special inside
  // single quotes, so the only thing to handle is a single quote itself.
  const shellQuote = (value) => `'${value.split("'").join(`'\\''`)}'`;
  const target = shellQuote(binary);
  const script =
    "#!/bin/sh\n" +
    "# Written by scripts/postinstall.mjs. `npm rebuild` regenerates it.\n" +
    `if [ -x ${target} ]; then exec ${target} "$@"; fi\n` +
    // Exit 3 is this project's toolchain code: the compiler could not be run,
    // which is exactly what has happened (docs/wp12-release.md, "Exit codes").
    'echo "nish: the prebuilt compiler is not where it was installed; run \'npm rebuild\' to repoint this" >&2\n' +
    "exit 3\n";
  const temp = `${shim}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temp, script);
    fs.chmodSync(temp, 0o755);
    fs.renameSync(temp, shim);
  } catch (err) {
    try {
      fs.rmSync(temp, { force: true });
    } catch {
      // Nothing to do about it, and it is not worth a second message.
    }
    throw err;
  }
  return `bin/nish now execs the native compiler in ${name}`;
};

try {
  console.log(`nish: ${await swap()}`);
} catch (err) {
  // Deliberately not an error: the shim is still there and still works.
  console.log(`nish: keeping the node launcher (${err instanceof Error ? err.message : String(err)})`);
}
