#!/usr/bin/env node
// No package the lockfile installs runs code at install time, except this
// repository's own postinstall.
//
//   node scripts/check-install-scripts.mjs              check package-lock.json (CI lint job)
//   node scripts/check-install-scripts.mjs --lock FILE  check FILE instead
//
// npm records `hasInstallScript: true` on a lockfile entry whose package has a
// `preinstall`, `install` or `postinstall` script, or a binding.gyp npm would
// build. CI installs with `npm ci --ignore-scripts`, so such a script never
// runs there; a developer's `npm install` runs every one. This check makes a
// dependency that gains one a lockfile change a reviewer sees fail, rather than
// code that runs on the next machine to install (SC-30 in
// docs/security/supply-chain.md). The root entry, `""`, is this package: its
// postinstall is scripts/postinstall.mjs, which does nothing in a checkout.
import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const at = args.indexOf("--lock")
const lockPath =
  at >= 0 ? path.resolve(args[at + 1]) : path.resolve(import.meta.dirname, "..", "package-lock.json")

const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"))
if (lock.lockfileVersion < 2 || typeof lock.packages !== "object") {
  console.error(`${lockPath}: lockfileVersion ${lock.lockfileVersion} has no "packages" map to check`)
  process.exit(1)
}

const offenders = Object.entries(lock.packages)
  .filter(([where, entry]) => where !== "" && entry.hasInstallScript === true)
  .map(([where, entry]) => `${where}@${entry.version ?? "?"}`)

if (offenders.length > 0) {
  console.error(`${path.basename(lockPath)}: ${offenders.length} package(s) run code when installed:`)
  for (const o of offenders) {
    console.error(`  ${o}`)
  }
  console.error(
    "Pin a version without the script, or raise the dependency in the PR: see SC-30 in docs/security/supply-chain.md."
  )
  process.exit(1)
}
console.log(
  `${path.basename(lockPath)}: ${Object.keys(lock.packages).length - 1} packages, none with an install script`
)
