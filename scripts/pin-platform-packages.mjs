#!/usr/bin/env node
/**
 * Write the platform packages into the main package's manifest, at pack time.
 *
 *   node scripts/pin-platform-packages.mjs <package.json> <asset>...
 *
 * The published `nish` names one `@amritk/nish-<asset>` per platform as an
 * `optionalDependencies` entry, pinned to its own version, so npm installs the
 * native compiler that matches the machine. The checked-in `package.json`
 * deliberately does not: `release.yml` runs this on its checkout just before
 * `npm pack`, with the assets the release's own matrix built.
 *
 * Why not keep them in the file: a pin in `package.json` is a pin in
 * `package-lock.json`, and the lockfile entry for a platform package carries
 * the `resolved` URL and `integrity` hash of a tarball that does not exist
 * until the release has built and published it. Every release commit used to
 * land with those entries one version behind, `npm ci` refused `main` the
 * moment the publish went out, and a second job had to regenerate the lockfile
 * and merge it. With the pins written here, the repository's own install never
 * sees a platform package and its lockfile never depends on a publish.
 *
 * The assets come from the caller rather than `.github/seed-targets.json`, so
 * the pins are exactly the packages this release built: a platform whose row
 * is not due yet gets no pin and no install that would 404.
 */
import fs from "node:fs"
import { platformPackageName, targetForAsset } from "../bin/packaging.js"

const [manifestPath, ...assets] = process.argv.slice(2)

if (manifestPath === undefined || assets.length === 0) {
  console.error("usage: pin-platform-packages.mjs <package.json> <asset>...")
  process.exit(2)
}

const unknown = assets.filter((a) => targetForAsset(a) === null)
if (unknown.length > 0) {
  console.error(`pin-platform-packages.mjs: ${unknown.join(", ")} is not a platform this project builds for`)
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
if (manifest.optionalDependencies !== undefined) {
  // Two sources for one list is the drift this script exists to end, so a
  // manifest that already carries pins is refused rather than merged into.
  console.error(`pin-platform-packages.mjs: ${manifestPath} already declares optionalDependencies`)
  process.exit(1)
}

manifest.optionalDependencies = Object.fromEntries(
  [...new Set(assets)].sort().map((a) => [platformPackageName(a), manifest.version])
)
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
for (const [name, version] of Object.entries(manifest.optionalDependencies)) {
  console.log(`${name}@${version}`)
}
