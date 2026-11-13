/**
 * `nish/release` — what the newest release of a project on GitHub is, whether
 * it is newer than the one running, and a small cache so a program asks at
 * most once a day.
 *
 *     import { releaseCheckCached, releaseLatest } from "nish/release"
 *
 *     const latest: string | null = releaseLatest("https://github.com/owner/repo", 2000)
 *     const newer: string | null = releaseCheckCached(
 *       "https://github.com/owner/repo", "1.2.0", "/home/me/.cache/app/latest", 86400000, 2000)
 *
 * - `releaseValidVersion(v)` — whether `v` is a version that may go in a URL:
 *   it starts with a digit and holds only letters, digits, `.`, `-` and `+`,
 *   with no `..`. The same rule as `install.sh`'s `nish_valid_version`.
 * - `releaseParseVersion(v)` and `releaseCompare(a, b)` — semantic versions,
 *   `major.minor.patch[-pre][+build]`. A prerelease sorts below its release
 *   and build metadata is ignored.
 * - `releaseIsNewer(candidate, current)` — true only when both parse and the
 *   candidate is strictly newer, so a version that does not parse is never
 *   newer and nothing here ever proposes a downgrade.
 * - `releaseTagFromLocation(base, location)` — the version a
 *   `/releases/latest` redirect names, or null for anything that is not
 *   exactly `<base>/releases/tag/v<version>` (or without the `v`).
 * - `releaseLatest(base, timeoutMs)` — asks `<base>/releases/latest` once,
 *   without following the redirect, and answers its version or null. Every
 *   failure is null: a server that is down, slow, refuses, or answers
 *   anything but a redirect to a release tag.
 * - `releaseCacheRead`, `releaseCacheWrite` and `releaseCheckCached` — the
 *   answer kept in a file the program names, believed only when it is a
 *   regular file this user owns that no one else can write, and only for
 *   `maxAgeMs` (a check dated in the future counts as stale).
 * - `releaseFetchInstaller(rawBase, version, path)` — the `install.sh` of one
 *   release tag, written to a file for the caller to run, never piped into a
 *   shell.
 *
 * Nothing here runs under a wasm32 build: it reaches the network and reads file
 * owners. The record of what it defends against is `docs/security/release.md`.
 */
import { FetchSyncClient, HttpOptions, HttpRequest, HttpResponse } from "./net/fetch"
import { split } from "./text"

/**
 * A parsed semantic version. `pre` is the prerelease after the `-`, empty for a
 * release; build metadata after the `+` is dropped, as it never orders.
 */
export class ReleaseVersion {
  /** The major number. */
  major: i64 = 0
  /** The minor number. */
  minor: i64 = 0
  /** The patch number. */
  patch: i64 = 0
  /** The prerelease identifiers, dot-separated, or "" for a release. */
  pre: string = ""
}

/**
 * The cache's contents: when the check ran and what it found.
 */
export class ReleaseCache {
  /** When the check ran, in milliseconds since 1970 (`Date.now()`'s clock). */
  checkedMs: i64 = 0
  /** The version the check found, or "" when it found none. */
  latest: string = ""
}

/**
 * Whether `v` may be put in a URL as a release version: not empty, starting
 * with a digit, holding only ASCII letters, digits, `.`, `-` and `+`, and
 * never `..`. What it rules out is a version that reaches past the tag in a
 * path — a `/`, a `..`, a `?`, a `#`, a `%`, whitespace.
 *
 * @param v The version, without a leading `v`.
 * @returns True when the version is safe to put in a release URL.
 */
export const releaseValidVersion = (v: string): boolean => {
  const n: i32 = toI32(v.length)
  if (n === 0 || n > 64) {
    return false
  }
  const first: i32 = v.charCodeAt(0)
  if (first < 48 || first > 57) {
    return false
  }
  if (v.indexOf("..") >= 0) {
    return false
  }
  for (let i: i32 = 0; i < n; i++) {
    const c: i32 = v.charCodeAt(i)
    const digit: boolean = c >= 48 && c <= 57
    const letter: boolean = (c >= 65 && c <= 90) || (c >= 97 && c <= 122)
    if (!digit && !letter && c !== 46 && c !== 45 && c !== 43) {
      return false
    }
  }
  return true
}

/** A run of ASCII digits as a number, or -1 when it is empty, too long, has a leading zero or holds anything else. */
const releaseNumber = (s: string): i64 => {
  const n: i32 = toI32(s.length)
  if (n === 0 || n > 15 || (n > 1 && s.charCodeAt(0) === 48)) {
    return -1
  }
  let value: i64 = 0
  for (let i: i32 = 0; i < n; i++) {
    const c: i32 = s.charCodeAt(i)
    if (c < 48 || c > 57) {
      return -1
    }
    value = value * 10 + toI64(c - 48)
  }
  return value
}

/** Whether every dot-separated identifier of a prerelease is non-empty and alphanumeric or `-`. */
const releasePreWellFormed = (pre: string): boolean => {
  const parts: string[] = split(pre, ".")
  for (const part of parts) {
    if (part.length === 0) {
      return false
    }
    for (let i: i32 = 0; i < toI32(part.length); i++) {
      const c: i32 = part.charCodeAt(i)
      const ok: boolean = (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 45
      if (!ok) {
        return false
      }
    }
  }
  return true
}

/**
 * `v` as a semantic version, `major.minor.patch` with an optional `-pre` and
 * `+build`, or null when it is not one. A leading `v` is not accepted; strip
 * it first.
 *
 * @param v The version text.
 * @returns The parsed version, or null.
 */
export const releaseParseVersion = (v: string): ReleaseVersion | null => {
  if (!releaseValidVersion(v)) {
    return null
  }
  let core: string = v
  const plus: i32 = toI32(core.indexOf("+"))
  if (plus >= 0) {
    if (plus + 1 === toI32(core.length) || !releasePreWellFormed(core.slice(plus + 1))) {
      return null
    }
    core = core.slice(0, plus)
  }
  let pre: string = ""
  const dash: i32 = toI32(core.indexOf("-"))
  if (dash >= 0) {
    pre = core.slice(dash + 1)
    core = core.slice(0, dash)
    if (!releasePreWellFormed(pre)) {
      return null
    }
  }
  const nums: string[] = split(core, ".")
  if (nums.length !== 3) {
    return null
  }
  const out: ReleaseVersion = new ReleaseVersion()
  out.major = releaseNumber(nums[0])
  out.minor = releaseNumber(nums[1])
  out.patch = releaseNumber(nums[2])
  if (out.major < 0 || out.minor < 0 || out.patch < 0) {
    return null
  }
  out.pre = pre
  return out
}

/** -1, 0 or 1 as `a` is below, equal to or above `b`. */
const releaseSign = (a: i64, b: i64): i32 => (a < b ? -1 : a > b ? 1 : 0)

/** Two prerelease identifiers in semver's order: numbers below words, numbers by value, words by ASCII. */
const releaseCompareIdent = (a: string, b: string): i32 => {
  const na: i64 = releaseNumber(a)
  const nb: i64 = releaseNumber(b)
  if (na >= 0 && nb >= 0) {
    return releaseSign(na, nb)
  }
  if (na >= 0) {
    return -1
  }
  if (nb >= 0) {
    return 1
  }
  const n: i32 = a.length < b.length ? toI32(a.length) : toI32(b.length)
  for (let i: i32 = 0; i < n; i++) {
    const d: i32 = a.charCodeAt(i) - b.charCodeAt(i)
    if (d !== 0) {
      return d < 0 ? -1 : 1
    }
  }
  return releaseSign(toI64(a.length), toI64(b.length))
}

/** Two prereleases in semver's order, where "" (a release) is above any prerelease. */
const releaseComparePre = (a: string, b: string): i32 => {
  if (a === b) {
    return 0
  }
  if (a.length === 0) {
    return 1
  }
  if (b.length === 0) {
    return -1
  }
  const pa: string[] = split(a, ".")
  const pb: string[] = split(b, ".")
  const n: i32 = pa.length < pb.length ? pa.length : pb.length
  for (let i: i32 = 0; i < n; i++) {
    const c: i32 = releaseCompareIdent(pa[i], pb[i])
    if (c !== 0) {
      return c
    }
  }
  return releaseSign(toI64(pa.length), toI64(pb.length))
}

/**
 * Two versions in semantic-version order: the numbers, then the prerelease,
 * where a prerelease sorts below its release; build metadata is ignored. A
 * version that does not parse sorts below every one that does, and two that do
 * not parse compare equal.
 *
 * @param a The first version, without a leading `v`.
 * @param b The second version, without a leading `v`.
 * @returns -1, 0 or 1 as `a` is older than, the same as, or newer than `b`.
 */
export const releaseCompare = (a: string, b: string): i32 => {
  const va: ReleaseVersion | null = releaseParseVersion(a)
  const vb: ReleaseVersion | null = releaseParseVersion(b)
  if (va === null || vb === null) {
    return va === null && vb === null ? 0 : va === null ? -1 : 1
  }
  let c: i32 = releaseSign(va.major, vb.major)
  if (c === 0) {
    c = releaseSign(va.minor, vb.minor)
  }
  if (c === 0) {
    c = releaseSign(va.patch, vb.patch)
  }
  if (c === 0) {
    c = releaseComparePre(va.pre, vb.pre)
  }
  return c
}

/**
 * Whether `candidate` is strictly newer than `current`. Both must parse: a
 * version that does not is never newer, and neither is the same release or an
 * older one, so the answer never suggests a downgrade.
 *
 * @param candidate The version that might be newer.
 * @param current The version running now.
 * @returns True only when both parse and `candidate` is the newer.
 */
export const releaseIsNewer = (candidate: string, current: string): boolean =>
  releaseParseVersion(candidate) !== null &&
  releaseParseVersion(current) !== null &&
  releaseCompare(candidate, current) > 0

/**
 * The version a `/releases/latest` redirect names: `location` must be exactly
 * `<base>/releases/tag/v<version>` or `<base>/releases/tag/<version>`, and the
 * version must parse. A redirect anywhere else — another repository, a login
 * page, the releases list when there is no release, a query or fragment — names
 * none.
 *
 * @param base The repository URL, e.g. `https://github.com/owner/repo`, with no trailing slash.
 * @param location The redirect's `Location` header.
 * @returns The version, without a `v`, or null.
 */
export const releaseTagFromLocation = (base: string, location: string): string | null => {
  const prefix: string = `${base}/releases/tag/`
  if (!location.startsWith(prefix)) {
    return null
  }
  let version: string = location.slice(prefix.length)
  if (version.startsWith("v")) {
    version = version.slice(1)
  }
  return releaseParseVersion(version) === null ? null : version
}

/**
 * Whether `base` is a URL this module will ask: `https://`, or `http://` only
 * to this machine (`127.0.0.1`, `localhost` or `[::1]`), which is what a test
 * server listens on.
 *
 * @param base The URL.
 * @returns True when the URL may be fetched.
 */
export const releaseBaseAllowed = (base: string): boolean => {
  if (base.startsWith("https://")) {
    return base.length > 8
  }
  const loopback: string[] = ["http://127.0.0.1", "http://localhost", "http://[::1]"]
  for (const host of loopback) {
    if (base === host || base.startsWith(`${host}/`) || base.startsWith(`${host}:`)) {
      return true
    }
  }
  return false
}

/** The options both fetches share: no redirect followed, and every wait bounded by `timeoutMs`. */
const releaseOptions = (timeoutMs: i32, maxBody: i32): HttpOptions => {
  const options: HttpOptions = new HttpOptions()
  options.followRedirects = false
  options.connectTimeoutMs = timeoutMs
  options.readTimeoutMs = timeoutMs
  options.totalTimeoutMs = timeoutMs
  options.maxBodyBytes = toI64(maxBody)
  return options
}

/**
 * The newest release of the repository at `base`, read from where
 * `<base>/releases/latest` redirects. The redirect is not followed and needs
 * no token. Null when the server cannot be reached within `timeoutMs`, answers
 * anything but a 3xx, or redirects anywhere but a release tag of `base`.
 *
 * @param base The repository URL, e.g. `https://github.com/owner/repo`: https, or http to this machine.
 * @param timeoutMs The most milliseconds the whole request may take.
 * @returns The newest version, without a `v`, or null.
 */
export const releaseLatest = (base: string, timeoutMs: i32): string | null => {
  if (!releaseBaseAllowed(base)) {
    return null
  }
  const client: FetchSyncClient = new FetchSyncClient(releaseOptions(timeoutMs, 65536))
  const res: HttpResponse | null = client.fetch(new HttpRequest("GET", `${base}/releases/latest`))
  let version: string | null = null
  if (res !== null && res.status >= 300 && res.status < 400) {
    const location: string | null = res.header("location")
    if (location !== null) {
      version = releaseTagFromLocation(base, location)
    }
  }
  client.close()
  return version
}

/**
 * The `install.sh` of release `version`, fetched from
 * `<rawBase>/v<version>/install.sh` and written to `path`. It is the script of
 * that tag, never of a branch, and it goes to a file so the caller runs it with
 * `sh <path>` — nothing fetched is ever piped into a shell. `path` should be in
 * a directory only this user can write.
 *
 * @param rawBase The raw-content URL, e.g. `https://raw.githubusercontent.com/owner/repo`: https, or http to this machine.
 * @param version The release to fetch, without a `v`; refused unless `releaseValidVersion`.
 * @param path Where to write the script.
 * @param timeoutMs The most milliseconds the whole request may take.
 * @returns True when a 200 answer was written to `path`.
 */
export const releaseFetchInstaller = (
  rawBase: string,
  version: string,
  path: string,
  timeoutMs: i32
): boolean => {
  if (!releaseBaseAllowed(rawBase) || !releaseValidVersion(version)) {
    return false
  }
  const client: FetchSyncClient = new FetchSyncClient(releaseOptions(timeoutMs, 1048576))
  const res: HttpResponse | null = client.fetch(new HttpRequest("GET", `${rawBase}/v${version}/install.sh`))
  let ok: boolean = false
  if (res !== null && res.status === 200) {
    const body: u8[] | null = res.body.readAll(1048576)
    if (body !== null && body.length > 0) {
      ok = writeFileBytesSync(path, body) === body.length
    }
  }
  client.close()
  return ok
}

/**
 * Whether the file at `path` may be believed: a regular file (a symbolic link
 * is not followed), owned by this process's effective user, and writable by
 * neither its group nor every user.
 *
 * @param path The file.
 * @returns True when the file may be read and believed.
 */
export const releaseFileTrusted = (path: string): boolean => {
  const om: i64 = lstatOwnerModeSync(path)
  if (om < 0) {
    return false
  }
  const owner: i64 = (om >> 32) & 0xffffffff
  const mode: i64 = om & 0xffff
  return (mode & 0xf000) === 0x8000 && owner === geteuid() && (mode & 0o022) === 0
}

/**
 * The cache at `path`, or null when there is none, it cannot be believed (see
 * `releaseFileTrusted`) or it does not parse. Its format is two lines,
 * `checked <ms>` and `latest <version>`, the version empty when the check found
 * none.
 *
 * @param path The cache file.
 * @returns What the cache holds, or null.
 */
export const releaseCacheRead = (path: string): ReleaseCache | null => {
  if (!releaseFileTrusted(path)) {
    return null
  }
  const text: string | null = readFileSyncOrNull(path)
  if (text === null) {
    return null
  }
  return releaseCacheParse(text)
}

/**
 * The cache's text as a `ReleaseCache`, or null when it is not exactly the two
 * lines `checked <ms>` and `latest <version>` (the version empty or valid).
 *
 * @param text The file's contents.
 * @returns The parsed cache, or null.
 */
export const releaseCacheParse = (text: string): ReleaseCache | null => {
  const lines: string[] = split(text, "\n")
  if (lines.length < 2 || !lines[0].startsWith("checked ") || !lines[1].startsWith("latest ")) {
    return null
  }
  const checked: i64 = releaseNumber(lines[0].slice(8))
  const latest: string = lines[1].slice(7)
  if (checked < 0 || (latest.length > 0 && releaseParseVersion(latest) === null)) {
    return null
  }
  const out: ReleaseCache = new ReleaseCache()
  out.checkedMs = checked
  out.latest = latest
  return out
}

/**
 * Whether a cache checked at `checkedMs` still answers at `nowMs`: younger
 * than `maxAgeMs`, and not dated in the future, which a clock set back or a
 * planted file would give.
 *
 * @param cache The cache.
 * @param nowMs The time now, in milliseconds since 1970.
 * @param maxAgeMs How long an answer stays fresh.
 * @returns True when the cache need not be refreshed.
 */
export const releaseCacheFresh = (cache: ReleaseCache, nowMs: i64, maxAgeMs: i64): boolean =>
  cache.checkedMs <= nowMs && nowMs - cache.checkedMs < maxAgeMs

/**
 * Writes the cache at `path`: its directory is created mode 0700 when missing
 * (its parent must exist), the text goes to a new temporary file beside it of
 * mode 0600, and that is renamed over `path`, so a reader sees the old cache or
 * the new one and a link planted at `path` is replaced, never followed.
 *
 * @param path The cache file.
 * @param latest The version found, or "" for none.
 * @param nowMs When the check ran, in milliseconds since 1970.
 * @returns True when the cache was written.
 */
export const releaseCacheWrite = (path: string, latest: string, nowMs: i64): boolean => {
  let slash: i32 = toI32(path.length) - 1
  while (slash > 0 && path.charCodeAt(slash) !== 47) {
    slash--
  }
  if (slash > 0) {
    const made: i32 = mkdirSyncMode(path.slice(0, slash), 0o700)
    if (made !== 0 && made !== -17) {
      return false
    }
  }
  const temp: string = `${path}.${wallClockNanos()}.tmp`
  const text: string = `checked ${nowMs}\nlatest ${latest}\n`
  if (createFileExclusiveSync(temp, text, 0o600) < 0) {
    return false
  }
  if (renameSync(temp, path) !== 0) {
    unlinkSync(temp)
    return false
  }
  return true
}

/**
 * The newest release when it is newer than `current`, from the cache at
 * `cachePath` while it is fresh and believed, else from `releaseLatest`, whose
 * answer (or its failure, as "") is written back so the next call within
 * `maxAgeMs` asks nothing.
 *
 * @param base The repository URL, as `releaseLatest` takes it.
 * @param current The version running now.
 * @param cachePath The cache file; its directory's parent must exist.
 * @param maxAgeMs How long an answer stays fresh, e.g. 86400000 for a day.
 * @param timeoutMs The most milliseconds a check may take.
 * @returns The newer version, or null when there is none or none is known.
 */
export const releaseCheckCached = (
  base: string,
  current: string,
  cachePath: string,
  maxAgeMs: i64,
  timeoutMs: i32
): string | null => {
  const now: i64 = toI64(Date.now())
  const cache: ReleaseCache | null = releaseCacheRead(cachePath)
  let latest: string = ""
  if (cache !== null && releaseCacheFresh(cache, now, maxAgeMs)) {
    latest = cache.latest
  } else {
    const found: string | null = releaseLatest(base, timeoutMs)
    latest = found === null ? "" : found
    releaseCacheWrite(cachePath, latest, now)
  }
  return releaseIsNewer(latest, current) ? latest : null
}
