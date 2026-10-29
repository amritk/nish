#!/usr/bin/env node
/**
 * Pin every platform package the main package depends on to one version.
 *
 *   node scripts/pin-platform-packages.mjs <version> [--dir <dir>]
 *
 * The pins are `optionalDependencies` in `package.json` and the copy of them a
 * lockfile keeps under `packages[""]`. Both are moved, because a bump that
 * moved only the top level is how 0.4.0 shipped a lockfile pinned to 0.3.0.
 * Every key is moved, not the ones that start with the main package name: the
 * main package is `nish` and its platform packages are `@amritk/nish-<asset>`.
 *
 * `release.yml` runs this twice, and the release commit never does:
 *
 * - the `release` job, on the tag, just before `npm pack`, so the main package
 *   that is published installs this release's binaries. The edit stays in that
 *   job's checkout.
 * - the `lockfile` job, on `main`, after the publish, so the pins and the
 *   lockfile entries they resolve to move in one commit.
 *
 * The release commit cannot move the pins, because the lockfile entries for a
 * platform package (its `resolved` URL and `integrity`) describe a tarball
 * that does not exist until the tag is built and published. A commit that
 * moved the pins without them left `main` disagreeing with its own lockfile
 * from the release merge to the lockfile merge, and CI's `lint` job red for
 * that whole window. So `main` pins the previous release until the lockfile
 * pull request lands, which `tests/run.js` allows.
 */
import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const dirAt = args.indexOf("--dir")
const dir = dirAt < 0 ? path.resolve(import.meta.dirname, "..") : path.resolve(args[dirAt + 1] ?? "")
const version = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--dir")

// A version a tag or `package.json` could carry, and nothing else: this writes
// the string into a manifest that gets published.
if (version === undefined || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("usage: pin-platform-packages.mjs <version> [--dir <dir>]")
  process.exit(2)
}

const pinIn = (file, depsOf) => {
  const at = path.join(dir, file)
  if (!fs.existsSync(at)) {
    return
  }
  const json = JSON.parse(fs.readFileSync(at, "utf8"))
  const deps = depsOf(json)
  if (deps === undefined || Object.keys(deps).length === 0) {
    console.error(`pin-platform-packages.mjs: ${at} declares no platform packages to pin`)
    process.exit(1)
  }
  for (const name of Object.keys(deps)) {
    deps[name] = version
  }
  fs.writeFileSync(at, `${JSON.stringify(json, null, 2)}\n`)
  console.log(`${file}: ${Object.keys(deps).sort().join(", ")} -> ${version}`)
}

// package.json has to exist; a lockfile is optional, because an `npm pack` of
// a directory without one is still a package this can pin.
if (!fs.existsSync(path.join(dir, "package.json"))) {
  console.error(`pin-platform-packages.mjs: ${dir} has no package.json`)
  process.exit(1)
}
pinIn("package.json", (j) => j.optionalDependencies)
pinIn("package-lock.json", (j) => j.packages?.[""]?.optionalDependencies)
