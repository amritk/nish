#!/usr/bin/env node
/**
 * Turn a staged release directory into a publishable platform package.
 *
 *   node scripts/platform-package.mjs <stage-dir> <asset> [--version <v>]
 *
 * `release.yml`'s `binaries` job already stages exactly what one of these
 * needs, because the release tarball and the npm package want the same thing:
 * `bin/nish` beside the `runtime/` and `scripts/` it resolves one level up
 * from itself. So this script adds a `package.json` to that directory and
 * changes nothing else — `npm publish <stage-dir>` then uploads the same bytes
 * the tarball carries, built and smoke-tested by the steps above it.
 *
 * The package declares `os` and `cpu`, which is the whole mechanism: it is an
 * `optionalDependencies` entry of the main package, so npm installs the one
 * that matches this machine and skips the others without failing. Nothing here
 * is compiled on the way in.
 *
 * It deliberately declares no `bin`. The `nish` command belongs to the main
 * package's launcher, which is the only thing that knows which platform's
 * binary to hand over to -- and, since 0.6.0, the only thing that knows how to
 * say so when none was installed; two packages claiming one command name would
 * leave which binary wins up to npm's link order.
 */
import fs from "node:fs";
import path from "node:path";
import { targetForAsset } from "../bin/packaging.js";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? null : args[i + 1];
};
const positional = args.filter((a, i) => !a.startsWith("--") && !(args[i - 1] ?? "").startsWith("--"));
const [stageDir, asset] = positional;

if (stageDir === undefined || asset === undefined) {
  console.error("usage: platform-package.mjs <stage-dir> <asset> [--version <v>]");
  process.exit(2);
}

const root = path.resolve(import.meta.dirname, "..");
const main = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = flag("--version") ?? main.version;

const target = targetForAsset(asset);
if (target === null) {
  console.error(`platform-package.mjs: ${asset} is not a platform this project builds for`);
  process.exit(1);
}

const binary = path.join(stageDir, "bin", "nish");
if (!fs.existsSync(binary)) {
  console.error(`platform-package.mjs: ${binary} does not exist; stage the binary before packaging it`);
  process.exit(1);
}

const pretty = { linux: "Linux", darwin: "macOS" }[target.os] ?? target.os;
const chip = { x64: "x86_64", arm64: "ARM64" }[target.cpu] ?? target.cpu;

const manifest = {
  name: `${main.name}-${asset}`,
  version,
  description: `The ${main.name} native compiler for ${pretty} on ${chip}`,
  license: main.license,
  os: [target.os],
  cpu: [target.cpu],
  // `./package.json` is how the launcher finds this package: it resolves the
  // manifest and joins `bin/nish` to its directory. Everything else is read by
  // the binary itself, relative to its own path, never through a specifier.
  exports: { "./package.json": "./package.json" },
  // `std` is in this list for the reason `runtime` is, and it was missing until
  // 2026-09-20: the compiler resolves a `nish/<module>` specifier against its
  // own package root, so a platform package without it answers every one of
  // them with ``Module `nish/text` is not part of the standard library``, while
  // naming `text` among the modules it has. The message is the static list of
  // module names; what is absent is the file. Nothing caught it because every
  // program the release smoke-tests imports by relative path or not at all,
  // and because the pack-and-install round trip in `tests/run.js` packs the
  // MAIN package, which has carried `std` in its own `files` all along --
  // so the fallback to `dist/` worked and the path a user actually gets did
  // not. See docs/wp12-release.md and wp19 §5a.
  files: ["bin", "runtime", "scripts", "std", "LICENSE", "INSTALL.md"],
  repository: main.repository,
  bugs: main.bugs,
  homepage: main.homepage,
};

const out = path.join(stageDir, "package.json");
fs.writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${manifest.name}@${version} (os ${target.os}, cpu ${target.cpu}) -> ${out}`);
