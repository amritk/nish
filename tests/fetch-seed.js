/**
 * `scripts/fetch-seed.sh`, checked against a stand-in `install.sh`.
 *
 *   node tests/fetch-seed.js
 *
 * The download itself is `install.sh`'s and `tests/run.js` checks it there;
 * what `fetch-seed.sh` adds is the logic around the call, and that is what
 * this checks: which arguments reach the installer, when the installer is not
 * called at all, which command lines are refused, and which of the installer's
 * output reaches the caller.
 *
 * No network, and nothing in the real `build/seed/`. Each check copies the
 * script into a fresh sandbox laid out as a checkout — `scripts/fetch-seed.sh`
 * and a stand-in `install.sh` at its root, which is where the script `cd`s to
 * — so it runs byte for byte what is checked in against an installer that
 * records its arguments and does what the check says. Exit 0 when every check
 * passes, 1 otherwise, and one PASS/FAIL line per check.
 *
 * It also carries the regression tests of the supply-chain audit
 * (docs/security/supply-chain.md), because `install.sh` is the download this
 * script delegates to and the rest is what that download's trust rests on:
 * that `install.sh` runs nothing it has not checked against a SHA-256, that
 * the workflows splice no expression into a shell and pin every action, and
 * that the WASI host in `web/wasi.mjs` never hands a program weak or partial
 * randomness. Each is a check here, with no network, and each was watched
 * failing on the commit before the fix.
 */
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { MemoryFileSystem, WasiHost } from "../web/wasi.mjs"

const root = path.resolve(import.meta.dirname, "..")
const script = path.join(root, "scripts", "fetch-seed.sh")
const installSh = path.join(root, "install.sh")

let failed = 0
let passed = 0
const check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`)
  if (ok) {
    passed++
  } else {
    failed++
    if (detail) {
      console.log(String(detail).replace(/^/gm, "      "))
    }
  }
}

/**
 * A stand-in installer. It appends its argument list to `install.calls`, and
 * then does what `mode` says: `ok` writes a `bin/nish` answering `nish
 * <version>` into the `--dir` it was given and prints the chatter a real
 * install prints; `fail` prints a reason and exits 1.
 */
const installer = (mode, version) => `#!/bin/sh
printf '%s\\n' "$*" >> install.calls
printf '%s\\n' "$#" >> install.argc
dir=""
while [ $# -gt 0 ]; do
  case "$1" in --dir) dir="$2"; shift 2 ;; *) shift ;; esac
done
if [ "${mode}" = fail ]; then
  echo "install: could not download (stand-in)" >&2
  exit 1
fi
mkdir -p "$dir/bin"
printf '#!/bin/sh\\necho "nish ${version}"\\n' > "$dir/bin/nish"
chmod +x "$dir/bin/nish"
echo "Put it on your PATH by adding this to your shell profile (stand-in chatter)"
`

/** A sandbox checkout with the real script and a stand-in installer. */
const sandbox = (mode = "ok", version = "0.5.0") => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fetch-seed-"))
  fs.mkdirSync(path.join(dir, "scripts"))
  fs.copyFileSync(script, path.join(dir, "scripts", "fetch-seed.sh"))
  fs.writeFileSync(path.join(dir, "install.sh"), installer(mode, version))
  return dir
}

/** A `build/seed/bin/nish` already in the sandbox, answering `--version` as given. */
const seedIn = (dir, answer) => {
  const bin = path.join(dir, "build", "seed", "bin")
  fs.mkdirSync(bin, { recursive: true })
  fs.writeFileSync(path.join(bin, "nish"), `#!/bin/sh\n${answer}\n`)
  fs.chmodSync(path.join(bin, "nish"), 0o755)
}

const run = (dir, args) =>
  spawnSync("bash", [path.join(dir, "scripts", "fetch-seed.sh"), ...args], { encoding: "utf8" })

/** The installer's argument lists, one per call, or [] when it was never called. */
const calls = (dir) => {
  const file = path.join(dir, "install.calls")
  const text = readOr(file, "")
  return text === "" ? [] : text.trim().split("\n")
}

/** A file's text, or `fallback` when it is not there. */
const readOr = (file, fallback) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : fallback)

const both = (r) => `status ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`
const sandboxes = []
const fresh = (...a) => {
  const dir = sandbox(...a)
  sandboxes.push(dir)
  return dir
}

// No seed yet: the installer is called for the latest release into build/seed,
// its chatter is swallowed, and the line printed is the seed's own version.
{
  const dir = fresh()
  const r = run(dir, [])
  check(
    "with no seed it installs the latest release into build/seed",
    r.status === 0 && calls(dir).join("|") === "--dir build/seed",
    `${both(r)}\ncalls: ${calls(dir)}`
  )
  check("and says which version it fetched", r.stdout === "fetch-seed: nish 0.5.0 in build/seed\n", both(r))
  check(
    "and keeps the installer's success chatter to itself",
    !r.stdout.includes("stand-in chatter") && !r.stderr.includes("stand-in chatter"),
    both(r)
  )

  // The same sandbox again: the seed runs, so nothing is fetched.
  const again = run(dir, [])
  check(
    "a seed that runs is left alone, without calling the installer",
    again.status === 0 && calls(dir).length === 1,
    `${both(again)}\ncalls: ${calls(dir)}`
  )
  check("and says so", again.stdout === "fetch-seed: nish 0.5.0 in build/seed (already there)\n", both(again))
}

// A seed that is there but does not run is not a seed: fetch it again.
{
  const dir = fresh()
  seedIn(dir, "exit 1")
  const r = run(dir, [])
  check(
    "a seed whose --version fails is fetched again",
    r.status === 0 && calls(dir).join("|") === "--dir build/seed",
    `${both(r)}\ncalls: ${calls(dir)}`
  )
}

// --force and a version both go past the short-circuit, and reach the
// installer as install.sh spells them.
{
  const dir = fresh()
  seedIn(dir, 'echo "nish 0.4.0"')
  const r = run(dir, ["--force"])
  check(
    "--force calls the installer even over a working seed, with --force",
    r.status === 0 && calls(dir).join("|") === "--force --dir build/seed",
    `${both(r)}\ncalls: ${calls(dir)}`
  )
}
{
  const dir = fresh("ok", "0.4.0")
  seedIn(dir, 'echo "nish 0.5.0"')
  const r = run(dir, ["0.4.0"])
  check(
    "a version is passed to the installer even over a working seed",
    r.status === 0 && calls(dir).join("|") === "0.4.0 --dir build/seed",
    `${both(r)}\ncalls: ${calls(dir)}`
  )
  check(
    "and the line printed is what the seed now says",
    r.stdout === "fetch-seed: nish 0.4.0 in build/seed\n",
    both(r)
  )
}

// Refusals: exit 2, a reason on stderr, and no installer call.
for (const [name, args, words] of [
  ["two versions are refused", ["0.4.0", "0.5.0"], "two versions given: 0.4.0 and 0.5.0"],
  ["an unknown option is refused", ["--bogus"], "unknown option --bogus"],
]) {
  const dir = fresh()
  const r = run(dir, args)
  check(
    `${name} with exit 2, before calling the installer`,
    r.status === 2 && r.stderr.includes(words) && calls(dir).length === 0,
    `${both(r)}\ncalls: ${calls(dir)}`
  )
}

// --help is the header, on stdout, and nothing else happens.
{
  const dir = fresh()
  const r = run(dir, ["--help"])
  check(
    "--help prints the usage on stdout and installs nothing",
    r.status === 0 &&
      r.stdout.includes("scripts/fetch-seed.sh --force") &&
      !r.stdout.includes("set -eu") &&
      calls(dir).length === 0,
    both(r)
  )
}

// A failed install: exit 1, and the installer's own reason reaches stderr.
{
  const dir = fresh("fail")
  const r = run(dir, [])
  check(
    "a failed install exits 1 and passes the installer's reason on",
    r.status === 1 && r.stderr.includes("could not download (stand-in)"),
    both(r)
  )
}

// A version reaches the installer as ONE argument, whatever is in it. It went
// through unquoted, so a version with a space in it was split into options:
// `fetch-seed.sh "0.4.0 --dir /elsewhere"` handed install.sh a second --dir.
{
  const dir = fresh()
  const r = run(dir, ["0.4.0 --dir /elsewhere"])
  const argc = readOr(path.join(dir, "install.argc"), "never called").trim()
  check(
    "a version is passed to the installer as one word, never split into options",
    argc === "3",
    `${both(r)}\ninstaller argc: ${argc} (want 3: the version, --dir, build/seed)\ncalls: ${calls(dir)}`
  )
}

// --expect-tarball reaches the installer as two words, and a seed that is
// already there does not short-circuit past the check it asks for.
{
  const dir = fresh()
  seedIn(dir, 'echo "nish 0.5.0"')
  const r = run(dir, ["0.5.0", "--expect-tarball", "nish-0.5.0-x86_64-linux.tar.gz"])
  check(
    "--expect-tarball is passed to the installer as one option and its one value",
    r.status === 0 &&
      calls(dir).join("|") === "0.5.0 --expect-tarball nish-0.5.0-x86_64-linux.tar.gz --dir build/seed",
    `${both(r)}\ncalls: ${calls(dir)}`
  )
  const bare = fresh()
  seedIn(bare, 'echo "nish 0.5.0"')
  const b = run(bare, ["--expect-tarball", "nish-0.5.0-x86_64-linux.tar.gz"])
  check(
    "--expect-tarball with no version still asks the installer, over a seed that runs",
    b.status === 0 &&
      calls(bare).join("|") === "--expect-tarball nish-0.5.0-x86_64-linux.tar.gz --dir build/seed",
    `${both(b)}\ncalls: ${calls(bare)}`
  )
}

// --expect-tarball with no name, or an empty one, is refused rather than read
// as "no expectation": the call into install.sh passes the option only when
// it has a value, so an empty one used to be dropped and the check skipped.
for (const args of [
  ["0.5.0", "--expect-tarball", ""],
  ["0.5.0", "--expect-tarball"],
]) {
  const dir = fresh()
  const r = run(dir, args)
  check(
    `fetch-seed refuses ${JSON.stringify(args.slice(1))} without calling the installer`,
    r.status === 2 && r.stderr.includes("--expect-tarball needs a file name") && calls(dir).length === 0,
    `${both(r)}\ncalls: ${calls(dir)}`
  )
}
// ---- install.sh: nothing downloaded runs before its digest matches -------------------
//
// A sandbox with a stand-in `curl` first on PATH that serves files out of a
// fixture "release" directory and logs every URL, and a fixture tarball whose
// compiler records that it ran. "Refused" below means three things together:
// a non-zero exit, no install directory, and the compiler never having run --
// install.sh runs the download's `--version` before it installs, so the third
// is the one that says an unverified binary was not executed.

const sha256 = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex")

const fakeCurl = `#!/bin/sh
out=""; url=""; head=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    -w) shift 2 ;;
    -*I*) head=1; shift ;;
    -*) shift ;;
    *) url="$1"; shift ;;
  esac
done
printf '%s\\n' "$url" >> "$CURL_LOG"
if [ -n "$head" ]; then printf 'https://github.com/amritk/nish/releases/tag/v9.9.9'; exit 0; fi
file="$FIXTURES/\${url#https://github.com/amritk/nish/releases/download/}"
[ -f "$file" ] || exit 22
cp "$file" "$out"
`

/** The asset install.sh derives for this machine, from install.sh itself. */
const hostAsset = spawnSync(
  "sh",
  [
    "-c",
    'NISH_INSTALL_SOURCE_ONLY=1 . "$1"; nish_asset "$(uname -s)" "$(uname -m)" || true',
    "sh",
    installSh,
  ],
  { encoding: "utf8" }
).stdout.trim()

/**
 * A sandbox holding a release `v<version>` with this machine's tarball in it,
 * whose compiler answers `nish <version>` and appends to `ran` when run.
 */
const installSandbox = (version) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "install-sh-"))
  sandboxes.push(dir)
  fs.mkdirSync(path.join(dir, "bin"))
  fs.writeFileSync(path.join(dir, "bin", "curl"), fakeCurl)
  fs.chmodSync(path.join(dir, "bin", "curl"), 0o755)
  const name = `nish-${version}-${hostAsset}`
  const stage = path.join(dir, "stage", name)
  for (const sub of ["bin", "runtime", "scripts"]) {
    fs.mkdirSync(path.join(stage, sub), { recursive: true })
  }
  fs.writeFileSync(
    path.join(stage, "bin", "nish"),
    `#!/bin/sh\necho ran >> '${path.join(dir, "ran")}'\necho "nish ${version}"\n`
  )
  fs.chmodSync(path.join(stage, "bin", "nish"), 0o755)
  for (const f of ["runtime/runtime.c", "runtime/nish.h", "scripts/build.sh"]) {
    fs.writeFileSync(path.join(stage, f), "")
  }
  const release = path.join(dir, "release", `v${version}`)
  fs.mkdirSync(release, { recursive: true })
  const tarball = path.join(release, `${name}.tar.gz`)
  spawnSync("tar", ["-czf", tarball, "-C", path.join(dir, "stage"), name])
  return { dir, name, tarball, release, home: path.join(dir, "home", "nish") }
}

const install = (box, args) =>
  spawnSync("sh", [installSh, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${path.join(box.dir, "bin")}:${process.env.PATH}`,
      FIXTURES: path.join(box.dir, "release"),
      CURL_LOG: path.join(box.dir, "curl.log"),
      NISH_VERSION: "",
    },
  })
const ran = (box) => fs.existsSync(path.join(box.dir, "ran"))
const curled = (box) => readOr(path.join(box.dir, "curl.log"), "")
const refused = (box, r) => r.status !== 0 && !fs.existsSync(box.home) && !ran(box)
const told = (box, r) => `${both(r)}\ncompiler ran: ${ran(box)}\ncurl:\n${curled(box)}`

check(`install.sh derives an asset for this machine (${hostAsset || "none"})`, hostAsset !== "", hostAsset)

// No SHA256SUMS and no pin: refused, and the reason says so. This is what every
// download was before: fetched over HTTPS, unpacked, and run.
{
  const box = installSandbox("9.9.9")
  const r = install(box, ["9.9.9", "--dir", box.home])
  check(
    "install.sh refuses a release with no SHA256SUMS and no pinned digest, without running it",
    refused(box, r) && r.stderr.includes("publishes no SHA256SUMS"),
    told(box, r)
  )
}

// A SHA256SUMS that names the tarball with the wrong digest.
{
  const box = installSandbox("9.9.9")
  fs.writeFileSync(path.join(box.release, "SHA256SUMS"), `${"0".repeat(64)}  ${box.name}.tar.gz\n`)
  const r = install(box, ["9.9.9", "--dir", box.home])
  check(
    "install.sh refuses a tarball whose SHA-256 is not the one SHA256SUMS gives, without running it",
    refused(box, r) && r.stderr.includes("does not match its published SHA-256"),
    told(box, r)
  )
}

// A SHA256SUMS that does not name this tarball at all, only something like it.
{
  const box = installSandbox("9.9.9")
  fs.writeFileSync(path.join(box.release, "SHA256SUMS"), `${sha256(box.tarball)}  other-${box.name}.tar.gz\n`)
  const r = install(box, ["9.9.9", "--dir", box.home])
  check(
    "install.sh refuses a tarball SHA256SUMS has no line for, even when another line carries its digest",
    refused(box, r) && r.stderr.includes("has no entry for"),
    told(box, r)
  )
}

// The digest matches -- in sha256sum's binary-mode spelling, `*name` -- and the
// install goes ahead and works.
{
  const box = installSandbox("9.9.9")
  fs.writeFileSync(path.join(box.release, "SHA256SUMS"), `${sha256(box.tarball)} *${box.name}.tar.gz\n`)
  const r = install(box, ["9.9.9", "--dir", box.home])
  const v = spawnSync(path.join(box.home, "bin", "nish"), ["--version"], { encoding: "utf8" })
  check(
    "install.sh installs a tarball whose SHA-256 matches its SHA256SUMS line",
    r.status === 0 && v.stdout.trim() === "nish 9.9.9",
    `${told(box, r)}\ninstalled --version: ${v.stdout}${v.stderr}`
  )
}

// A pinned release: the digest in install.sh wins, so a tarball and a
// SHA256SUMS swapped together on the release -- which agree with each other --
// are still refused.
{
  const box = installSandbox("0.15.0")
  fs.writeFileSync(path.join(box.release, "SHA256SUMS"), `${sha256(box.tarball)}  ${box.name}.tar.gz\n`)
  const r = install(box, ["0.15.0", "--dir", box.home])
  check(
    "install.sh holds a pinned release to its pinned digest, over a SHA256SUMS swapped with the tarball",
    refused(box, r) &&
      r.stderr.includes("does not match its published SHA-256") &&
      !curled(box).includes("SHA256SUMS"),
    told(box, r)
  )
}

// The pin table itself: 64 hex digits each, every asset a seed-targets one, and
// every target due by 0.15.0 pinned for it -- the last release before
// SHA256SUMS, which is the one the seed is today.
{
  const text = fs.readFileSync(installSh, "utf8")
  const body = text.slice(text.indexOf("nish_pinned_sha256() {"), text.indexOf("nish_sums_lookup() {"))
  const pins = [...body.matchAll(/^\s+(\d+\.\d+\.\d+)-(\S+)\) echo (\S+) ;;$/gm)].map((m) => ({
    version: m[1],
    asset: m[2],
    digest: m[3],
  }))
  const targets = JSON.parse(fs.readFileSync(path.join(root, ".github", "seed-targets.json"), "utf8")).targets
  const assets = new Set(targets.map((t) => t.asset))
  const bad = pins.filter((p) => !/^[0-9a-f]{64}$/.test(p.digest) || !assets.has(p.asset))
  const missing = targets.filter((t) => !pins.some((p) => p.version === "0.15.0" && p.asset === t.asset))
  check(
    `install.sh's ${pins.length} pinned digests are well formed and cover every 0.15.0 seed`,
    pins.length >= 47 && bad.length === 0 && missing.length === 0,
    `malformed: ${JSON.stringify(bad)}\nunpinned for 0.15.0: ${missing.map((t) => t.asset).join(", ")}`
  )
}

// A version is checked before it is put in a URL, so it cannot walk out of
// /releases/download/<tag>/, and junk from the latest-release redirect is not
// requested either.
{
  const box = installSandbox("9.9.9")
  const r = install(box, ["../../../amritk/evil/releases/download/v1", "--dir", box.home])
  check(
    "install.sh refuses a version that is not one, before it requests anything",
    refused(box, r) && r.stderr.includes("is not a release version") && curled(box) === "",
    told(box, r)
  )
}

// A caller that says which tarball it expects -- CI's seed rows, which name
// theirs in .github/seed-targets.json -- gets that one or nothing. A runner
// whose hardware has drifted from its row resolves another asset, and used to
// bootstrap with that seed under the row's name. It is refused before anything
// is requested, and the one this machine does resolve still installs.
{
  const other = hostAsset === "x86_64-linux" ? "aarch64-darwin" : "x86_64-linux"
  const box = installSandbox("9.9.9")
  fs.writeFileSync(path.join(box.release, "SHA256SUMS"), `${sha256(box.tarball)}  ${box.name}.tar.gz\n`)
  const r = install(box, ["9.9.9", "--expect-tarball", `nish-9.9.9-${other}.tar.gz`, "--dir", box.home])
  check(
    "install.sh --expect-tarball refuses when this machine resolves another asset, before requesting anything",
    refused(box, r) && r.stderr.includes(`nish-9.9.9-${other}.tar.gz`) && curled(box) === "",
    told(box, r)
  )
  const ok = install(box, ["9.9.9", "--expect-tarball", `${box.name}.tar.gz`, "--dir", box.home])
  check(
    "install.sh --expect-tarball installs the tarball this machine resolves when it is the one expected",
    ok.status === 0 && fs.existsSync(path.join(box.home, "bin", "nish")),
    told(box, ok)
  )
}

// The same guard with no version: the version comes from the latest-release
// lookup, which is a request, so the asset half -- from `uname` -- is compared
// before it and refuses with nothing requested; the whole name is compared
// after it and before anything is downloaded.
{
  const other = hostAsset === "x86_64-linux" ? "aarch64-darwin" : "x86_64-linux"
  const box = installSandbox("9.9.9")
  fs.writeFileSync(path.join(box.release, "SHA256SUMS"), `${sha256(box.tarball)}  ${box.name}.tar.gz\n`)
  const r = install(box, ["--expect-tarball", `nish-9.9.9-${other}.tar.gz`, "--dir", box.home])
  check(
    "install.sh --expect-tarball with no version refuses another asset before the latest-release lookup",
    refused(box, r) && r.stderr.includes(`nish-9.9.9-${other}.tar.gz`) && curled(box) === "",
    told(box, r)
  )
  const later = installSandbox("9.9.9")
  const stale = install(later, ["--expect-tarball", `nish-1.0.0-${hostAsset}.tar.gz`, "--dir", later.home])
  check(
    "install.sh --expect-tarball with no version refuses another version after the lookup, downloading nothing",
    refused(later, stale) &&
      stale.stderr.includes(`${later.name}.tar.gz`) &&
      curled(later) === "https://github.com/amritk/nish/releases/latest\n",
    told(later, stale)
  )
  const ok = install(box, ["--expect-tarball", `${box.name}.tar.gz`, "--dir", box.home])
  check(
    "install.sh --expect-tarball with no version installs the latest when it is the tarball expected",
    ok.status === 0 && fs.existsSync(path.join(box.home, "bin", "nish")),
    told(box, ok)
  )
}

// Everything in the expected name but the version is known before that
// lookup, and is held to exactly `nish-<release version>-<asset>.tar.gz`. A
// glob over the middle let a second platform, a `/` or an empty version through
// to the lookup before the whole-name check refused them.
{
  const other = hostAsset === "x86_64-linux" ? "aarch64-darwin" : "x86_64-linux"
  for (const [what, name] of [
    ["an extra platform segment", `nish-9.9.9-${other}-${hostAsset}.tar.gz`],
    ["a / in the version", `nish-9.9/9-${hostAsset}.tar.gz`],
    ["an empty version", `nish--${hostAsset}.tar.gz`],
    ["a .. in the version", `nish-9..9-${hostAsset}.tar.gz`],
    ["no nish- prefix", `9.9.9-${hostAsset}.tar.gz`],
    ["a version of latest", `nish-latest-${hostAsset}.tar.gz`],
  ]) {
    const box = installSandbox("9.9.9")
    fs.writeFileSync(path.join(box.release, "SHA256SUMS"), `${sha256(box.tarball)}  ${box.name}.tar.gz\n`)
    const r = install(box, ["--expect-tarball", name, "--dir", box.home])
    check(
      `install.sh --expect-tarball with no version refuses ${what} before the latest-release lookup`,
      refused(box, r) && r.stderr.includes(name) && curled(box) === "",
      told(box, r)
    )
  }
}

// An empty --expect-tarball, or none after the flag, is a usage error, not a
// guard that skips itself.
for (const args of [
  ["9.9.9", "--expect-tarball", ""],
  ["9.9.9", "--expect-tarball"],
]) {
  const box = installSandbox("9.9.9")
  fs.writeFileSync(path.join(box.release, "SHA256SUMS"), `${sha256(box.tarball)}  ${box.name}.tar.gz\n`)
  const r = install(box, [...args.slice(0, 1), "--dir", box.home, ...args.slice(1)])
  check(
    `install.sh refuses ${JSON.stringify(args.slice(1))} before requesting anything`,
    refused(box, r) && r.stderr.includes("--expect-tarball needs a file name") && curled(box) === "",
    told(box, r)
  )
}
// Installing into a directory that is not an install refuses rather than moving
// it aside, where the exit trap would delete it.
{
  const box = installSandbox("9.9.9")
  fs.writeFileSync(path.join(box.release, "SHA256SUMS"), `${sha256(box.tarball)}  ${box.name}.tar.gz\n`)
  fs.mkdirSync(box.home, { recursive: true })
  fs.writeFileSync(path.join(box.home, "thesis.tex"), "years of work\n")
  const r = install(box, ["9.9.9", "--dir", box.home])
  check(
    "install.sh refuses to install over a non-empty directory that is not an install, and leaves it whole",
    r.status !== 0 &&
      fs.existsSync(path.join(box.home, "thesis.tex")) &&
      r.stderr.includes("is not a nish install") &&
      curled(box) === "",
    told(box, r)
  )
  const u = install(box, ["--uninstall", "--dir", box.home])
  check(
    "install.sh --uninstall refuses a directory with no bin/nish in it, and leaves it whole",
    u.status !== 0 && fs.existsSync(path.join(box.home, "thesis.tex")),
    told(box, u)
  )
}

// The wrapper quotes the path it bakes in. A single quote in the install
// directory used to close the string, and what followed it ran.
{
  const box = fs.mkdtempSync(path.join(os.tmpdir(), "install-sh-quote-"))
  sandboxes.push(box)
  const home = path.join(box, "o'neil $(touch pwned) `touch pwned`")
  fs.mkdirSync(path.join(home, "bin"), { recursive: true })
  fs.writeFileSync(path.join(home, "bin", "nish"), '#!/bin/sh\necho "argv0=$0"\n')
  fs.chmodSync(path.join(home, "bin", "nish"), 0o755)
  const wrote = spawnSync(
    "sh",
    ["-c", 'NISH_INSTALL_SOURCE_ONLY=1 . "$1"; nish_write_wrapper "$2"', "sh", installSh, home],
    { encoding: "utf8" }
  )
  const r = spawnSync(path.join(home, "bin", "nish"), [], { cwd: box, encoding: "utf8" })
  check(
    "install.sh's wrapper execs a path with quotes, $() and backticks in it as that path, running none of it",
    wrote.status === 0 &&
      r.status === 0 &&
      r.stdout.trim() === `argv0=${path.join(home, "libexec", "nish")}` &&
      !fs.existsSync(path.join(box, "pwned")),
    `${both(r)}\nwrapper:\n${readOr(path.join(home, "bin", "nish"), "(none)")}`
  )
}

// ---- the npm channel: a platform package runs nothing on install -------------------
//
// npm verifies every tarball against the lockfile's integrity hash, so what this
// channel has to keep true is that installing it executes nothing it did not
// already have: the main package's postinstall downloads nothing (it repoints
// bin/nish at a binary npm already verified), and the platform packages carry
// no lifecycle scripts at all. The second is a property of the manifest
// scripts/platform-package.mjs writes, so it is checked on one.
{
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "platform-package-"))
  sandboxes.push(stage)
  fs.mkdirSync(path.join(stage, "bin"))
  fs.writeFileSync(path.join(stage, "bin", "nish"), "")
  const r = spawnSync("node", [path.join(root, "scripts", "platform-package.mjs"), stage, "x86_64-linux"], {
    encoding: "utf8",
  })
  const manifest = r.status === 0 ? JSON.parse(fs.readFileSync(path.join(stage, "package.json"), "utf8")) : {}
  check(
    "a generated platform package declares no lifecycle scripts and no bin, so installing it runs nothing",
    r.status === 0 && manifest.scripts === undefined && manifest.bin === undefined,
    `${both(r)}\n${JSON.stringify(manifest, null, 2)}`
  )
  const postinstall = fs.readFileSync(path.join(root, "scripts", "postinstall.mjs"), "utf8")
  check(
    "scripts/postinstall.mjs fetches nothing and spawns nothing",
    !/from "node:(child_process|http|https|net|tls|dgram)"|\bfetch\(|\bimport\(\s*["']node:/.test(
      postinstall
    ),
    "postinstall.mjs reaches for the network or a process"
  )
}

// ---- the workflows ------------------------------------------------------------------
//
// Read as text, because there is no YAML parser among this repository's
// dependencies; each check reads for the thing that carries the meaning.

/** One job of a workflow, from its `  name:` line to the next job's, or "". */
const jobOf = (text, name) => {
  const start = text.indexOf(`\n  ${name}:\n`)
  if (start < 0) {
    return ""
  }
  const end = text.slice(start + 1).search(/\n {2}[a-z][\w-]*:\n/)
  return text.slice(start, end < 0 ? undefined : start + 1 + end)
}

const workflowDir = path.join(root, ".github", "workflows")
const workflows = fs
  .readdirSync(workflowDir)
  .filter((f) => f.endsWith(".yml"))
  .map((f) => ({ file: f, text: fs.readFileSync(path.join(workflowDir, f), "utf8") }))

/** Every `run:` script in a workflow, as `[line number, text]` pairs. */
const runScripts = (text) => {
  const lines = text.split("\n")
  const out = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)(?:- )?run:\s*(.*)$/)
    if (m === null) {
      continue
    }
    if (!/^[|>]-?$/.test(m[2])) {
      out.push([i + 1, m[2]])
      continue
    }
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() !== "" && lines[j].match(/^\s*/)[0].length <= m[1].length) {
        break
      }
      out.push([j + 1, lines[j]])
    }
  }
  return out
}

// An expression spliced into a script is text the shell parses, and some of
// it -- a title, a body, a branch name -- is whoever opened the pull request's.
// The rule is the strong one: no `${{` inside a `run:` at all, so nobody has to
// decide case by case which contexts are safe. Values go through `env:`.
{
  const spliced = workflows.flatMap(({ file, text }) =>
    runScripts(text)
      .filter(([, line]) => line.includes("${{"))
      .map(([n, line]) => `${file}:${n}: ${line.trim()}`)
  )
  check(
    `no workflow splices a \${{ }} expression into a run: script (${workflows.length} files)`,
    spliced.length === 0,
    spliced.join("\n")
  )
}

// What goes through env: is named in upper case, as the shell's own environment
// is, so a script's $NAME reads as something the step was given and a
// lower-case $name as one of its own variables. A key spelt like a local
// (release-pr.yml's `next`) is one the script can shadow or reassign unseen.
{
  const lower = workflows.flatMap(({ file, text }) => {
    const lines = text.split("\n")
    const out = []
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(\s*)env:\s*$/)
      if (m === null) {
        continue
      }
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j]
        if (/^\s*(#.*)?$/.test(line)) {
          continue
        }
        const indent = line.match(/^\s*/)[0].length
        if (indent <= m[1].length) {
          break
        }
        const key = line.match(/^\s*([^\s:#][^:]*):/)
        if (key !== null && !/^[A-Z][A-Z0-9_]*$/.test(key[1])) {
          out.push(`${file}:${j + 1}: ${key[1]}`)
        }
      }
    }
    return out
  })
  check(
    `every env: key a workflow sets is upper case (${workflows.length} files)`,
    lower.length === 0,
    lower.join("\n")
  )
}

// A tag can be moved; a commit cannot. Every action is pinned to a full SHA.
{
  const loose = workflows.flatMap(({ file, text }) =>
    [...text.matchAll(/^\s*(?:- )?uses:\s*(\S+)/gm)]
      .map((m) => m[1])
      .filter((ref) => !ref.startsWith("./") && !/@[0-9a-f]{40}$/.test(ref))
      .map((ref) => `${file}: ${ref}`)
  )
  check("every action a workflow uses is pinned to a full commit SHA", loose.length === 0, loose.join("\n"))
}

// The two triggers that run a fork's pull request with the base repository's
// secrets and a write token, and the explicit token every file narrows.
{
  const risky = workflows.filter(({ text }) => /^\s*(pull_request_target|workflow_run)\s*:/m.test(text))
  const open = workflows.filter(({ text }) => !/^permissions:/m.test(text))
  check(
    "no workflow runs on pull_request_target or workflow_run, and every one declares its token's permissions",
    risky.length === 0 && open.length === 0,
    `trigger: ${risky.map((w) => w.file).join(", ")}\nno top-level permissions: ${open.map((w) => w.file).join(", ")}`
  )
}

// release.yml: the job holding `contents: write` does not leave the token in
// .git/config while `npm ci` runs install scripts, the release carries a
// SHA256SUMS for install.sh to check, and the npm that publishes is an exact
// version rather than whatever a range resolves to on the day.
{
  const release = workflows.find((w) => w.file === "release.yml").text
  const job = (name) => jobOf(release, name)
  const releaseJob = job("release")
  check(
    "release.yml's release job checks out without persisting its write token",
    /uses: actions\/checkout@\S+[^\n]*\n\s+with:\n\s+persist-credentials: false/.test(releaseJob) &&
      releaseJob.includes("npm ci"),
    releaseJob
  )
  check(
    "release.yml computes a SHA256SUMS over the release's files and attaches it",
    /sha256sum -- "\$\{names\[@\]\}"\) > build\/release\/SHA256SUMS/.test(releaseJob) &&
      /gh release create[^\n]*\\\n(?:[^\n]*\\\n)*\s+build\/release\/SHA256SUMS \\/.test(releaseJob),
    releaseJob
  )
  check(
    "release.yml publishes with an exact npm version, not a range",
    /npm install -g npm@\d+\.\d+\.\d+\n/.test(job("npm")) && !/npm@[\^~]/.test(release),
    job("npm")
  )
  // The release job hands its sums to the npm job as an output, and the npm job
  // checks every package it downloads back from the release against them before
  // the first publish.
  const npmJob = job("npm")
  const verify = npmJob.indexOf("needs.release.outputs.sums")
  check(
    "release.yml's npm job checks every package against the release job's SHA256SUMS before publishing",
    /sums: \$\{\{ steps\.create\.outputs\.sums \}\}/.test(releaseJob) &&
      /echo "sums<<SHA256SUMS_END"/.test(releaseJob) &&
      verify > 0 &&
      verify < npmJob.indexOf("npm publish"),
    npmJob
  )
}

// A seed in CI comes through scripts/fetch-seed.sh, which is install.sh, which
// verifies it. A bare `gh release download` and `tar` is the unverified path the
// bootstrap and nish-cmp jobs used to take before running what arrived.
{
  const ci = workflows
    .find((w) => w.file === "ci.yml")
    .text.split("\n")
    .filter((l) => !l.trimStart().startsWith("#"))
    .join("\n")
  check(
    "ci.yml takes every seed through scripts/fetch-seed.sh, never a bare download",
    !/gh release download|\bcurl\b|\bwget\b/.test(ci) &&
      ["bootstrap", "nish-cmp"].every((name) => jobOf(ci, name).includes("bash scripts/fetch-seed.sh")),
    ci
      .split("\n")
      .filter((l) => /fetch-seed|release download|curl|wget/.test(l))
      .join("\n")
  )
}

// Every seed row names the tarball it is for, and refuses any other: a runner
// label that moved to other hardware fails the row rather than checking the
// freeze with another platform's seed under this row's name. release.yml's
// `binaries` job guards its own rows the same way, against `host`.
{
  const ci = fs.readFileSync(path.join(workflowDir, "ci.yml"), "utf8")
  const unguarded = ["bootstrap", "nish-cmp"].filter((name) => {
    const job = jobOf(ci, name)
    return !(
      /TARBALL: \$\{\{ matrix\.seed\.tarball \}\}/.test(job) &&
      /bash scripts\/fetch-seed\.sh "\$\{TAG#v\}" --expect-tarball "\$TARBALL"/.test(job)
    )
  })
  check(
    "ci.yml's bootstrap and nish-cmp rows refuse a seed that is not their matrix.seed.tarball",
    unguarded.length === 0,
    `unguarded: ${unguarded.join(", ")}`
  )
}

// ---- web/wasi.mjs: the randomness a program's keys come from ------------------------

/** A host over `size` bytes of memory, and its `random_get`. */
const randomHost = (size) => {
  const host = new WasiHost()
  const memory = new ArrayBuffer(size)
  host.instance = { exports: { memory: { buffer: memory } } }
  return { bytes: new Uint8Array(memory), randomGet: host.imports().wasi_snapshot_preview1.random_get }
}
const ENOSYS = 52
const EFAULT = 21

// No CSPRNG on the host: the call fails, and the buffer is left as it was. It
// used to fill the buffer from Math.random and report success.
{
  const { bytes, randomGet } = randomHost(64)
  const saved = Object.getOwnPropertyDescriptor(globalThis, "crypto")
  Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true, writable: true })
  let status
  try {
    status = randomGet(0, 32)
  } catch (error) {
    status = `threw ${error}`
  } finally {
    Object.defineProperty(globalThis, "crypto", saved)
  }
  check(
    "wasi random_get with no CSPRNG on the host answers ENOSYS and writes nothing",
    status === ENOSYS && bytes.every((b) => b === 0),
    `status ${status}, bytes ${bytes.slice(0, 32).join(",")}`
  )
}

// More than one Web Crypto call can fill is filled in pieces, all the way to
// the end, rather than thrown out of the import as a QuotaExceededError.
{
  const { bytes, randomGet } = randomHost(200000)
  let status
  try {
    status = randomGet(1000, 150000)
  } catch (error) {
    status = `threw ${error}`
  }
  const tail = bytes.subarray(1000 + 150000 - 4096, 1000 + 150000)
  check(
    "wasi random_get fills a request longer than 65,536 bytes to its last byte",
    status === 0 && tail.some((b) => b !== 0) && bytes.subarray(1000 + 150000).every((b) => b === 0),
    `status ${status}`
  )
}

// A range past the end of memory is EFAULT, not a clamped fill reported as a
// success.
{
  const { bytes, randomGet } = randomHost(1024)
  const status = randomGet(1000, 64)
  check(
    "wasi random_get refuses a range past the end of memory with EFAULT, writing nothing",
    status === EFAULT && bytes.every((b) => b === 0),
    `status ${status}`
  )
}

// A file a program names `__proto__` comes back as a file.
{
  const memfs = new MemoryFileSystem()
  memfs.write("__proto__", "x")
  const text = memfs.toText()
  check(
    "wasi MemoryFileSystem.toText returns a file named __proto__ as a key, not a prototype",
    Object.getOwnPropertyDescriptor(text, "__proto__")?.value === "x",
    JSON.stringify(Object.keys(text))
  )
}

for (const dir of sandboxes) {
  fs.rmSync(dir, { recursive: true, force: true })
}
console.log(`fetch-seed: ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
