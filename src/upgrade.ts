// `nish upgrade` and the update notice: what a person sees when a newer
// release is out, and the command that installs it (#1523).
//
// The network is never reached from here. `src/` is also the web compiler,
// linked to wasm, where `nish:net` is refused, so the lookup is a small Nish
// program of its own, `RELEASE_HELPER_SOURCE`, which `src/compile.ts` builds
// into the run cache the way it builds the watch supervisor, and runs as a
// child. The helper is `std/release.ts` with a command line on it.
//
// What this file holds is everything else, and none of it needs the network:
// the arguments `nish upgrade` takes, how the compiler was installed, the
// cache the notice reads, and the notice itself. The security record is
// `docs/security/release.md`.

import {
  CLI,
  HEADER_GUARD_PREFIX,
  NPM_PACKAGE,
  NPM_PLATFORM_DIR,
  RAW_REPOSITORY,
  REPOSITORY,
  VERSION,
} from "./branding"
import { dirname } from "./paths"
import { runCacheRoot } from "./run-cache"
import { jsonQuote, splitByte } from "./strings"

/** How long a check of the latest release is believed: a day, in milliseconds. */
const DAY_MS: i64 = 86400000

/** Nanoseconds in a millisecond. */
const NS_PER_MS: i64 = 1000000

/** `installChannel`'s answer: `install.sh` put the compiler at `<dir>/libexec/nish`. */
const CHANNEL_CURL: i32 = 0

/** `installChannel`'s answer: npm installed a prebuilt compiler. */
const CHANNEL_NPM: i32 = 1

/** `installChannel`'s answer: anything else, which is a build from a checkout. */
const CHANNEL_SOURCE: i32 = 2

/** An environment variable of the compiler's own, `NISH_<suffix>`. */
const envName = (suffix: string): string => `${HEADER_GUARD_PREFIX}_${suffix}`

/** Whether `value` is set to something other than empty or `0`. */
const setOn = (value: string | null): boolean => value !== null && value !== "" && value !== "0"

/**
 * Whether the notice is turned off by the environment: `NISH_NO_UPDATE_CHECK`
 * set (other than empty or `0`), or `CI` set (other than empty, `0` or
 * `false`), which every CI service sets and where nobody reads the line.
 */
const noticeOffByEnvironment = (): boolean => {
  if (setOn(getenv(envName("NO_UPDATE_CHECK")))) {
    return true
  }
  const ci = getenv("CI")
  return ci !== null && setOn(ci) && ci !== "false"
}

/**
 * Where the number at `i` in `v` ends, or -1 when there is none, it has a
 * leading zero, or it is longer than 15 digits (what `nish/release` reads).
 */
const numberEnd = (v: string, i: i32): i32 => {
  let j = i
  while (j >= 0 && j < v.length && v.charCodeAt(j) >= 48 && v.charCodeAt(j) <= 57) {
    j++
  }
  if (j === i || j - i > 15 || (j - i > 1 && v.charCodeAt(i) === 48)) {
    return -1
  }
  return j
}

/**
 * Where the dot-separated identifiers at `i` in `v` end, or -1 when one is
 * empty or holds anything but `[0-9A-Za-z-]`. In a prerelease (`pre`) an
 * identifier of digits alone has no leading zero.
 */
const identifiersEnd = (v: string, i: i32, pre: boolean): i32 => {
  let start = i
  let j = i
  while (true) {
    let digits = true
    while (j >= 0 && j < v.length) {
      const c = v.charCodeAt(j)
      const digit = c >= 48 && c <= 57
      if (!digit && !((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 45)) {
        break
      }
      digits = digits && digit
      j++
    }
    if (
      j === start ||
      (pre && digits && j - start > 1 && start >= 0 && start < v.length && v.charCodeAt(start) === 48)
    ) {
      return -1
    }
    if (j < 0 || j >= v.length || v.charCodeAt(j) !== 46) {
      return j
    }
    j++
    start = j
  }
}

/**
 * Whether `v` may be a release version: a semantic version,
 * `MAJOR.MINOR.PATCH` of numbers with no leading zero, then an optional
 * `-prerelease` and `+build`, at most 64 bytes — the versions `nish/release`
 * parses, which also pass `install.sh`'s `nish_valid_version`. A version is
 * put into a URL and a command line, and printed to a terminal, so it is
 * checked before any of that: no `/`, `?`, `%`, space or escape gets through.
 */
const validVersion = (v: string): boolean => {
  if (v.length > 64) {
    return false
  }
  let i = 0
  for (let part = 0; part < 3; part++) {
    if (part > 0) {
      if (i < 0 || i >= v.length || v.charCodeAt(i) !== 46) {
        return false
      }
      i++
    }
    i = numberEnd(v, i)
    if (i < 0) {
      return false
    }
  }
  if (i < v.length && v.charCodeAt(i) === 45) {
    i = identifiersEnd(v, i + 1, true)
    if (i < 0) {
      return false
    }
  }
  if (i < v.length && v.charCodeAt(i) === 43) {
    i = identifiersEnd(v, i + 1, false)
    if (i < 0) {
      return false
    }
  }
  return i === v.length
}

/** Whether `rest`, what follows a host, is empty, a path, or a port of digits then nothing or a path. */
const portThenPath = (rest: string): boolean => {
  if (rest.length === 0 || rest.charCodeAt(0) === 47) {
    return true
  }
  if (rest.charCodeAt(0) !== 58) {
    return false
  }
  let i = 1
  while (i < rest.length && rest.charCodeAt(i) >= 48 && rest.charCodeAt(i) <= 57) {
    i++
  }
  return i > 1 && (i === rest.length || rest.charCodeAt(i) === 47)
}

/**
 * Whether `base` may be asked for a release: `https://`, or `http://` to the
 * loopback address only, which is what a test's server is. Anything else is
 * refused before a request, since the answer decides what gets installed.
 */
const baseAllowed = (base: string): boolean => {
  if (base.startsWith("https://")) {
    return base.length > 8
  }
  const hosts: string[] = ["127.0.0.1", "localhost", "[::1]"]
  for (const host of hosts) {
    const origin = `http://${host}`
    if (base.startsWith(origin) && portThenPath(base.slice(origin.length))) {
      return true
    }
  }
  return false
}

/** The base the `NISH_<suffix>` override names, `fallback` when it is unset, or empty when it is not `baseAllowed`. */
const baseFromEnv = (suffix: string, fallback: string): string => {
  const set = getenv(envName(suffix))
  if (set === null || set === "") {
    return fallback
  }
  return baseAllowed(set) ? set : ""
}

/**
 * The repository the latest release is asked of: `REPOSITORY`, or
 * `NISH_RELEASE_URL` when it is set, which a test points at a server of its
 * own. Empty when the override is not `baseAllowed`.
 */
const releaseBase = (): string => baseFromEnv("RELEASE_URL", REPOSITORY)

/** Where `install.sh` is fetched from: `RAW_REPOSITORY`, or `NISH_RELEASE_RAW_URL`, under `releaseBase`'s rule. */
const rawBase = (): string => baseFromEnv("RELEASE_RAW_URL", RAW_REPOSITORY)

/** How the compiler was installed, and where: `installChannel`'s answer. */
class InstallChannel {
  /** `CHANNEL_CURL`, `CHANNEL_NPM` or `CHANNEL_SOURCE` (2, the default). */
  kind: i32 = 2
  /** The `--dir` of a curl install; empty otherwise. */
  dir: string = ""
}

/**
 * How the compiler at the real path `real` was installed, given what its
 * install's `bin/nish` holds (`wrapper`, null when there is none). A curl
 * install is `<dir>/libexec/nish` beside a `<dir>/bin/nish` that
 * `install.sh` wrote; npm's is in a prebuilt package under `node_modules`;
 * anything else is a build from a checkout. A pure function, so the tests ask
 * it about paths no install has.
 */
const installChannel = (real: string, wrapper: string | null): InstallChannel => {
  const channel = new InstallChannel()
  if (real.indexOf(NPM_PLATFORM_DIR) >= 0) {
    channel.kind = CHANNEL_NPM
    return channel
  }
  if (real.endsWith(`/libexec/${CLI}`) && wrapper !== null && wrapper.indexOf("Written by install.sh") >= 0) {
    channel.kind = CHANNEL_CURL
    channel.dir = dirname(dirname(real))
  }
  return channel
}

/** The wrapper a curl install would have put beside the compiler at the real path `real`, or null. */
const wrapperBeside = (real: string): string | null =>
  real.endsWith(`/libexec/${CLI}`) ? readFileSyncOrNull(`${dirname(dirname(real))}/bin/${CLI}`) : null

/**
 * The notice's cache: `$XDG_CACHE_HOME/nish/release/notice-<version>`, else
 * under `$HOME/.cache`, and empty when neither is absolute. The running
 * version is in the name, so an upgrade starts from no cache, and a cache
 * that said this version was behind is never read by the next one.
 */
const noticeCachePath = (): string => {
  const runs = runCacheRoot()
  return runs.length === 0 ? "" : `${dirname(runs)}/release/notice-${VERSION}`
}

/** What the notice's cache holds: when it was checked, and the newer release it found, if any. */
class NoticeCache {
  checkedMs: i64 = 0
  newer: string = ""
}

/** The milliseconds `text` spells, or -1 when it is not 1 to 15 digits. */
const parseMs = (text: string): i64 => {
  if (text.length === 0 || text.length > 15) {
    return toI64(-1)
  }
  let value: i64 = toI64(0)
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c < 48 || c > 57) {
      return toI64(-1)
    }
    value = value * toI64(10) + toI64(c - 48)
  }
  return value
}

/**
 * The cache's two lines, `checked <ms>` and `newer <version>` (empty when the
 * check found nothing newer), or null when `text` is not exactly that. A
 * version that is not `validVersion` does not parse: the line goes to a
 * terminal.
 */
const parseNoticeCache = (text: string): NoticeCache | null => {
  const lines = splitByte(text, 10)
  if (lines.length < 2 || lines.length > 3 || (lines.length === 3 && lines[2] !== "")) {
    return null
  }
  if (!lines[0].startsWith("checked ") || !lines[1].startsWith("newer")) {
    return null
  }
  const cache = new NoticeCache()
  cache.checkedMs = parseMs(lines[0].slice(8))
  if (cache.checkedMs < toI64(0)) {
    return null
  }
  if (lines[1] === "newer") {
    return cache
  }
  if (!lines[1].startsWith("newer ")) {
    return null
  }
  cache.newer = lines[1].slice(6)
  return validVersion(cache.newer) ? cache : null
}

/** The cache's text for a check at `atMs` that found `newer` (empty for nothing newer). */
const formatNoticeCache = (atMs: i64, newer: string): string =>
  newer.length === 0 ? `checked ${atMs}\nnewer\n` : `checked ${atMs}\nnewer ${newer}\n`

/** Whether a check at `checkedMs` still holds at `nowMs`: under a day old, and not in the future. */
const noticeFresh = (checkedMs: i64, nowMs: i64): boolean => checkedMs <= nowMs && nowMs - checkedMs < DAY_MS

/** The wall clock in milliseconds. */
const wallClockMs = (): i64 => wallClockNanos() / NS_PER_MS

/**
 * Keeps a check at `nowMs` that found `newer` in the cache at `path`, making
 * its directory private (0700), and answers whether it was kept. A directory
 * already there is made 0700 by `chmod`, since the language has no call for
 * it; one `chmod` cannot change is another user's, and nothing is kept in it,
 * so the notice does not start a check that could never be believed. Written beside it and renamed over it at 0600, so a reader sees the
 * old cache or the new one, and a link planted at `path` is replaced, never
 * followed. Says nothing either way: the cache is a convenience.
 */
const writeNoticeCache = (path: string, nowMs: i64, newer: string): boolean => {
  if (path.length === 0) {
    return false
  }
  const dir = dirname(path)
  const parent = dirname(dir)
  mkdirSync(dirname(parent))
  mkdirSync(parent)
  const made = mkdirSyncMode(dir, 0o700)
  if (made !== 0 && made !== -17) {
    return false
  }
  const privateDir: string[] = ["chmod", "700", "--", dir]
  if (made === -17 && spawnSyncTo(privateDir, "/dev/null", "/dev/null") !== 0) {
    return false
  }
  const temp = `${path}.${wallClockNanos()}.tmp`
  if (writeFileSyncMode(temp, formatNoticeCache(nowMs, newer), 0o600) < 0 || renameSync(temp, path) < 0) {
    unlinkSync(temp)
    return false
  }
  return true
}

/**
 * The script the notice's one process runs, with the cache file and its
 * directory as operands. Its answer is its exit status: 1 when stderr is not
 * a terminal (no notice, and no check either), 3 when there is no cache yet,
 * 4 when there is one it may not believe, and 0 for one it may. A cache is
 * believed when it is a regular file (a link is not followed), and it and its
 * directory are this user's and writable by nobody else: whoever else can
 * write it chooses the line printed to this user's terminal. `[ -t 2 ]` is
 * asked first, and stderr is closed to the rest, so the probe never writes
 * there. Both tools are named by absolute path, as `DISTRUST_SCRIPT` names
 * them, and `set -f` keeps a `*` in a path from being expanded.
 */
const NOTICE_PROBE: string =
  "[ -t 2 ] || exit 1\n" +
  "exec 2>/dev/null\n" +
  "set -f\n" +
  "p=$1 d=$2\n" +
  '[ -e "$p" ] || [ -h "$p" ] || exit 3\n' +
  'for f in "$d" "$p"; do\n' +
  '  line=$(/bin/ls -ldn -- "$f") || exit 4\n' +
  "  set -- $line\n" +
  '  case $f in "$d") t=d ;; *) t=- ;; esac\n' +
  '  case $1 in "$t"[-r][-w][-xsS][-r][-w][-xsS][-r][-w][-xtT]*) ;; *) exit 4 ;; esac\n' +
  "  case $1 in ?????w* | ????????w*) exit 4 ;; esac\n" +
  '  [ -O "$f" ] || exit 4\n' +
  "done\n" +
  "exit 0\n"

/** `NOTICE_PROBE`'s answer: stderr is not a terminal. */
const PROBE_NOT_TERMINAL: i32 = 1

/** `NOTICE_PROBE`'s answer: a cache that may be read. */
const PROBE_TRUSTED: i32 = 0

/** The line the notice prints for a newer release `newer`. */
const noticeLine = (newer: string): string =>
  `${CLI} ${newer} is available (you have ${VERSION}); run \`${CLI} upgrade\``

/**
 * The update notice, after a command's work is done and its status known:
 * one line on stderr when the cache says a newer release is out, and a check
 * started in the background when the cache is missing, stale, dated in the
 * future or not to be believed. `suppressed` is the caller's half of the
 * rule (`--json`, `nish run`, `nish upgrade`, a usage error); the
 * environment's half is `noticeOffByEnvironment`, and a stderr that is not a
 * terminal ends it before any process starts.
 *
 * True when a check is due, which the caller starts with `startNoticeCheck`.
 * Its time is written to the cache first, keeping the newer release the cache
 * already named, so the next run within a day starts none, whether this one
 * reaches the server or not. The compiler's path is found only then, so a run
 * with nothing to check spawns at most the probe.
 */
export const updateNotice = (suppressed: boolean): boolean => {
  if (suppressed || noticeOffByEnvironment() || !isTerminal(2)) {
    return false
  }
  const path = noticeCachePath()
  if (path.length === 0) {
    return false
  }
  const probe: string[] = ["/bin/sh", "-c", NOTICE_PROBE, "sh", path, dirname(path)]
  const status = spawnSyncTo(probe, "/dev/null", "")
  if (status === PROBE_NOT_TERMINAL || status < 0) {
    return false
  }
  let cache: NoticeCache | null = null
  if (status === PROBE_TRUSTED) {
    const text = readFileSyncOrNull(path)
    cache = text === null ? null : parseNoticeCache(text)
  }
  const now = wallClockMs()
  if (cache !== null && cache.newer.length > 0 && cache.newer !== VERSION) {
    console.error(noticeLine(cache.newer))
  }
  if (cache !== null && noticeFresh(cache.checkedMs, now)) {
    return false
  }
  return writeNoticeCache(path, now, cache === null ? "" : cache.newer)
}

/**
 * Start the check `updateNotice` said is due: `<self> upgrade --check`,
 * detached by the shell with its output gone and the hangup a closing
 * terminal sends ignored, so it never holds this command's terminal or delays
 * its exit. `self` is the compiler's path; when it is empty nothing starts,
 * and the cache's new time keeps the next run within a day from trying again.
 */
export const startNoticeCheck = (self: string): void => {
  if (self.length === 0) {
    return
  }
  const detach: string[] = [
    "/bin/sh",
    "-c",
    'trap "" HUP; "$0" upgrade --check </dev/null >/dev/null 2>&1 &',
    self,
  ]
  spawnSyncTo(detach, "/dev/null", "/dev/null")
}

/**
 * The release helper: the one part of the notice and of `nish upgrade` that
 * reaches the network, as a Nish program over `nish/release`. Its commands:
 *
 * - `latest <base> <current>`: the latest release on two lines, the version
 *   and `newer` or `not newer` against `current`; exit 3 for no answer.
 * - `newer <a> <b>`: exit 0 when `a` is a newer release than `b`, else 1.
 * - `installer <raw> <version> <file>`: `install.sh` from the tag into `file`;
 *   exit 3 when it could not be fetched.
 *
 * Any other line exits 2.
 */
export const RELEASE_HELPER_SOURCE: string = `// The release helper \`nish upgrade\` and the update notice run.
import { releaseFetchInstaller, releaseIsNewer, releaseLatest } from "nish/release"

const LOOKUP_MS: i32 = 2000
const INSTALLER_MS: i32 = 30000

export const main = (): number => {
  const argv: string[] = process.argv
  if (argv.length === 4 && argv[1] === "latest") {
    const latest = releaseLatest(argv[2], LOOKUP_MS)
    if (latest === null) {
      return 3
    }
    console.log(latest)
    console.log(releaseIsNewer(latest, argv[3]) ? "newer" : "not newer")
    return 0
  }
  if (argv.length === 4 && argv[1] === "newer") {
    return releaseIsNewer(argv[2], argv[3]) ? 0 : 1
  }
  if (argv.length === 5 && argv[1] === "installer") {
    return releaseFetchInstaller(argv[2], argv[3], argv[4], INSTALLER_MS) ? 0 : 3
  }
  return 2
}
`

/**
 * What `nish upgrade`'s line asks for, read before anything is built or
 * fetched. `status` is the exit status when the command is already answered
 * (a usage error, an npm or source install), else -1.
 */
export class UpgradePlan {
  status: i32 = -1
  check: boolean = false
  version: string = ""
  base: string = ""
  raw: string = ""
  dir: string = ""
}

/** A usage error of `nish upgrade`: the message, and status 2. */
const upgradeUsage = (plan: UpgradePlan, message: string): UpgradePlan => {
  console.error(`upgrade: ${message}`)
  console.error(`usage: ${CLI} upgrade [<version>] [--check]`)
  plan.status = 2
  return plan
}

/**
 * Reads `nish upgrade [<version>] [--check]` (`args` from index `from`, what
 * follows `upgrade`) and how the compiler at `real` was installed. `--help`
 * prints the usage on stdout, status 0. Everything that can
 * refuse without the network refuses here: a flag it does not know, a version
 * that is not `validVersion` (so `1.0.0/../x` never reaches a URL), a base
 * override that is not `baseAllowed`, and an install it cannot upgrade in
 * place. npm's is npm's to replace, so the line is printed for the user to
 * run; a checkout's is rebuilt from source. Both exit 2 and change nothing.
 */
export const planUpgrade = (args: string[], from: i32, real: string): UpgradePlan => {
  const plan = new UpgradePlan()
  for (let i = from; i >= 0 && i < args.length; i++) {
    const arg = args[i]
    if (arg === "--check") {
      plan.check = true
    } else if (arg === "--help" || arg === "-h") {
      // Asked for, the usage is an answer: stdout and exit 0, as `nish --help` is.
      console.log(`usage: ${CLI} upgrade [<version>] [--check]`)
      console.log("  installs the newest release, or <version>, over the install.sh install that runs it")
      console.log("  --check  prints the running version and the newest release, and installs nothing")
      plan.status = 0
      return plan
    } else if (arg.startsWith("-")) {
      return upgradeUsage(plan, `unknown flag ${arg}`)
    } else if (plan.version.length > 0) {
      return upgradeUsage(plan, "one version at most")
    } else if (!validVersion(arg)) {
      return upgradeUsage(plan, `not a release version: ${jsonQuote(arg)}`)
    } else {
      plan.version = arg
    }
  }
  if (plan.check && plan.version.length > 0) {
    return upgradeUsage(plan, "--check takes no version")
  }
  plan.base = releaseBase()
  plan.raw = rawBase()
  if (plan.base.length === 0 || plan.raw.length === 0) {
    const bad = plan.base.length === 0 ? envName("RELEASE_URL") : envName("RELEASE_RAW_URL")
    return upgradeUsage(plan, `${bad} must be https://, or http:// to the loopback address`)
  }
  if (plan.check) {
    return plan
  }
  const channel = installChannel(real, wrapperBeside(real))
  if (channel.kind === CHANNEL_NPM) {
    const wanted = plan.version.length > 0 ? plan.version : "latest"
    console.error(`upgrade: this ${CLI} was installed by npm, which owns its files; upgrade it with npm:`)
    console.error(`  npm install -g ${NPM_PACKAGE}@${wanted}`)
    console.error("(or the same line without -g, in the project that depends on it)")
    plan.status = 2
    return plan
  }
  if (channel.kind === CHANNEL_SOURCE) {
    console.error(
      `upgrade: ${real} was not installed by install.sh or npm, so there is nothing to upgrade in place;`
    )
    console.error("a build from a checkout is upgraded by pulling and building it again")
    plan.status = 2
    return plan
  }
  plan.dir = channel.dir
  return plan
}

/** The release helper's answer to `latest`: the version, and whether it is newer than this one. */
class Latest {
  version: string = ""
  newer: boolean = false
}

/** The latest release, asked of `base` by the helper with its stdout in `out`, or null for no answer. */
const askLatest = (helper: string, base: string, out: string): Latest | null => {
  if (spawnSyncTo([helper, "latest", base, VERSION], out, "/dev/null") !== 0) {
    return null
  }
  const text = readFileSyncOrNull(out)
  if (text === null) {
    return null
  }
  const lines = splitByte(text, 10)
  if (lines.length < 2 || !validVersion(lines[0])) {
    return null
  }
  const latest = new Latest()
  latest.version = lines[0]
  latest.newer = lines[1] === "newer"
  return latest
}

/**
 * The latest release, as `askLatest` learns it, kept in the notice's cache;
 * null, with the line that says so and the cache untouched, for no answer.
 */
const learnLatest = (helper: string, base: string, out: string): Latest | null => {
  const latest = askLatest(helper, base, out)
  if (latest === null) {
    console.error(`upgrade: could not learn the latest release from ${base}/releases/latest`)
    return null
  }
  writeNoticeCache(noticeCachePath(), wallClockMs(), latest.newer ? latest.version : "")
  return latest
}

/**
 * `nish upgrade` once `planUpgrade` has passed it: `helper` is the built
 * release helper and `scratch` a directory private to this user that the
 * caller removes. `--check` prints this version and the latest, records them
 * in the notice's cache, and exits 0; when the latest is not known it exits 3
 * and leaves the cache as it was, so a newer release it already names is not
 * forgotten. (The notice writes the time before it starts a check, so a
 * server that is down is still asked at most once a day.) Otherwise the version asked for, or the latest when
 * none was and it is newer than this one, is installed by its own
 * `install.sh`, fetched from its tag into `scratch` and run as
 * `sh install.sh <version> --dir <dir>`. An explicit older version is
 * installed with a line that says it is a downgrade; with no version, nothing
 * older or the same is.
 */
export const runUpgrade = (plan: UpgradePlan, helper: string, scratch: string): i32 => {
  const out = `${scratch}/latest`
  if (plan.check) {
    const latest = learnLatest(helper, plan.base, out)
    if (latest === null) {
      return 3
    }
    console.log(`current ${VERSION}`)
    console.log(`latest  ${latest.version}`)
    return 0
  }
  let version = plan.version
  if (version.length === 0) {
    const latest = learnLatest(helper, plan.base, out)
    if (latest === null) {
      return 3
    }
    if (!latest.newer) {
      console.error(`upgrade: ${CLI} ${VERSION} is up to date (the latest release is ${latest.version})`)
      return 0
    }
    version = latest.version
  } else if (spawnSyncTo([helper, "newer", VERSION, version], "/dev/null", "/dev/null") === 0) {
    console.error(`upgrade: ${version} is older than ${VERSION}; this is a downgrade`)
  }
  const installer = `${scratch}/install.sh`
  if (spawnSyncTo([helper, "installer", plan.raw, version, installer], "/dev/null", "/dev/null") !== 0) {
    console.error(
      `upgrade: could not fetch install.sh for ${version} from ${plan.raw}/v${version}/install.sh`
    )
    return 3
  }
  const status = spawnSync(["/bin/sh", installer, version, "--dir", plan.dir])
  if (status !== 0) {
    console.error(`upgrade: install.sh ${version} --dir ${plan.dir} failed (exit ${status})`)
    return 3
  }
  return 0
}
