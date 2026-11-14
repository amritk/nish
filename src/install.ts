// `nish install`: a Nish package fetched from git into `node_modules`, where
// the resolver already looks for it (WP21), and recorded in `package.json` in
// the spelling npm reads.
//
// **Why git, and why into `node_modules`.** A Nish package is its source
// (`docs/wp21-packages.md` §3), so there is nothing to build before it can be
// installed and nothing a registry adds that a tag does not: a tag is a
// release. Unpacking into `node_modules/<name>` is what keeps the compiler out
// of it. The resolver already finds a bare specifier there and already
// attributes errors to the dependency, so the command is a fetcher and the
// compile that follows it is the compile that would follow `npm install`.
//
// **Why npm's spelling.** The dependency is written into `package.json` as
// npm writes a git dependency (`git+ssh://...#v1.2.0`), so a project that
// installs with nish can be installed by `npm install` too, and the reverse:
// either tool reads the line and both put the same tree at the same path.
//
// **What pins it.** A tag can be moved and a branch moves by design, so the
// commit each package was installed at is kept in `nish.lock`. `nish install`
// with no operand installs every git dependency of `package.json` at its
// locked commit when the lock has one for the same source, which is what makes
// a second checkout of the project compile the same bytes as the first. The
// lock is nish's own; npm keeps the same fact in `package-lock.json`.
//
// **What it refuses**, each before anything moves into `node_modules`: a
// source that is not https, ssh or a local repository (`git://` and `http://`
// are plaintext, and an `ext::` URL runs a command); a source or ref that
// starts with `-`, so neither can be read as a flag by `git`; a tree that
// holds a symbolic link or a submodule, since the first can name a file
// outside the package and the second is a fetch this command does not make;
// a `name` that is not a plain npm name, since it becomes a path; and a
// package whose `exports` offers no Nish condition, which nothing could import.
// The security record is `docs/security/install.md`.
//
// The network is never reached from here: `git` reaches it, as a child, the
// way `scripts/build.sh` reaches `clang`. Nothing in the fetched tree runs.

import { CLI } from "./branding"
import {
  manifestMembers,
  manifestOffersNish,
  manifestSkipBlank,
  manifestString,
  manifestVersion,
} from "./manifest"
import { PACKAGE_ROOT_SEGMENT } from "./packages"
import { dirname } from "./paths"
import { hexOfI64, jsonQuote, splitByte, StringBuilder } from "./strings"

/** The manifest a dependency is recorded in. */
const MANIFEST: string = "package.json"

/** The file each installed commit is kept in, beside the manifest. */
export const LOCKFILE: string = "nish.lock"

/** The `lockfileVersion` this compiler writes and reads. */
const LOCK_VERSION: i32 = 1

/** The prefix npm gives a git dependency, and the one `nish install` with no operand reads. */
const GIT_PLUS: string = "git+"

/** The longest name npm publishes. */
const NAME_LIMIT: i32 = 214

/** The longest ref accepted; git's own refname limit is the filesystem's. */
const REF_LIMIT: i32 = 255

const SPACE: i32 = 32
const DELETE: i32 = 127
const HASH: i32 = 35
const SLASH: i32 = 47
const AT: i32 = 64
const COLON: i32 = 58
const NEWLINE: i32 = 10
const TAB: i32 = 9
const CARRIAGE_RETURN: i32 = 13
const DOT: i32 = 46
const DASH: i32 = 45
const UNDERSCORE: i32 = 95
const TILDE: i32 = 126
const PLUS: i32 = 43
const DIGIT_0: i32 = 48
const DIGIT_9: i32 = 57
const LOWER_A: i32 = 97
const LOWER_Z: i32 = 122
const LOWER_F: i32 = 102
const OPEN_BRACE: i32 = 123
const UPPER_A: i32 = 65
const UPPER_Z: i32 = 90

/**
 * Where a package comes from, read off the operand: `url` is what `git` is
 * given, `spec` is npm's spelling of the same repository (without the ref),
 * and `ref` is the tag, branch or commit after `#`, or `""` for none.
 * `problem` is why the operand was refused, and `""` when it was not.
 */
export class GitSource {
  url: string = ""
  spec: string = ""
  ref: string = ""
  problem: string = ""
}

/** The index of the last `code` in `text`, or -1. */
const lastIndexOfByte = (text: string, code: i32): i32 => {
  let i = text.length - 1
  while (i >= 0) {
    if (text.charCodeAt(i) === code) {
      return i
    }
    i = i - 1
  }
  return -1
}

/** Whether `text` holds a space, a control character or DEL: none belongs in a source or a ref. */
const hasUnsafeByte = (text: string): boolean => {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code <= SPACE || code === DELETE) {
      return true
    }
  }
  return false
}

const isDigitCode = (code: i32): boolean => code >= DIGIT_0 && code <= DIGIT_9

const isLowerOrDigit = (code: i32): boolean => (code >= LOWER_A && code <= LOWER_Z) || isDigitCode(code)

const isLetterOrDigit = (code: i32): boolean => isLowerOrDigit(code) || (code >= UPPER_A && code <= UPPER_Z)

/**
 * Whether `text` is git's scp-like form, `[user@]host:path`: a colon before
 * any slash, and not `scheme://`. `git@github.com:owner/repo.git` is the one a
 * person copies from GitHub's SSH tab.
 */
const isScpLike = (text: string): boolean => {
  const colon = text.indexOf(":")
  if (colon <= 0 || colon + 1 >= text.length || text.charCodeAt(colon + 1) === COLON) {
    return false
  }
  // The part before the colon is a host, with a user before an `@`: nothing
  // else, so that git's `ext::<command>` transport, which also has a colon
  // before any slash, is never read as one.
  let at = -1
  for (let i = 0; i < colon; i++) {
    const code = text.charCodeAt(i)
    if (code === AT && at < 0 && i > 0) {
      at = i
    } else if (!isLetterOrDigit(code) && code !== DOT && code !== DASH && code !== UNDERSCORE) {
      return false
    }
  }
  return at < colon - 1
}

/**
 * Whether `ref` can be handed to `git fetch` as a refspec and come back as the
 * same name: letters, digits and `._/-+`, not starting with `-` or `/`, with
 * no `..` (git's own refusal, made here so the message is this command's).
 */
const validRef = (ref: string): boolean => {
  if (ref.length === 0 || ref.length > REF_LIMIT) {
    return false
  }
  const first = ref.charCodeAt(0)
  if (first === DASH || first === SLASH || ref.indexOf("..") >= 0 || ref.endsWith("/")) {
    return false
  }
  for (let i = 0; i < ref.length; i++) {
    const code = ref.charCodeAt(i)
    if (
      !isLetterOrDigit(code) &&
      code !== DOT &&
      code !== SLASH &&
      code !== DASH &&
      code !== UNDERSCORE &&
      code !== PLUS
    ) {
      return false
    }
  }
  return true
}

/** One half of a package name: npm's lower-case alphabet, not starting with `.` or `_`. */
const validNamePart = (part: string): boolean => {
  if (part.length === 0) {
    return false
  }
  const first = part.charCodeAt(0)
  if (first === DOT || first === UNDERSCORE) {
    return false
  }
  for (let i = 0; i < part.length; i++) {
    const code = part.charCodeAt(i)
    if (!isLowerOrDigit(code) && code !== DASH && code !== DOT && code !== UNDERSCORE && code !== TILDE) {
      return false
    }
  }
  return true
}

/**
 * Whether `name` is a package name npm would publish: `name` or
 * `@scope/name`. It becomes a directory under `node_modules`, so this is also
 * the check that keeps `../x` and `a/b/c` from naming a path outside it.
 */
export const validPackageName = (name: string): boolean => {
  if (name.length === 0 || name.length > NAME_LIMIT) {
    return false
  }
  if (name.charCodeAt(0) !== AT) {
    return validNamePart(name)
  }
  const slash = name.indexOf("/")
  if (slash < 0) {
    return false
  }
  return validNamePart(name.substring(1, slash)) && validNamePart(name.substring(slash + 1))
}

/** A refused operand: `problem` says why. */
const refusedSource = (problem: string): GitSource => {
  const source = new GitSource()
  source.problem = problem
  return source
}

/**
 * The repository `operand` names, in the forms a person copies and the forms
 * npm writes: `git@host:owner/repo.git`, `ssh://...`, `https://...`,
 * `file://...` or a local directory, each optionally prefixed `git+`, and each
 * optionally followed by `#<ref>`. The `spec` is npm's spelling of it, so the
 * line written into `package.json` is one npm installs.
 */
export const parseGitSource = (operand: string): GitSource => {
  let base = operand
  let ref = ""
  const hash = lastIndexOfByte(operand, HASH)
  if (hash >= 0) {
    base = operand.substring(0, hash)
    ref = operand.substring(hash + 1)
    if (!validRef(ref)) {
      return refusedSource(`not a tag, branch or commit: ${jsonQuote(ref)}`)
    }
  }
  if (base.length === 0 || hasUnsafeByte(base) || base.charCodeAt(0) === DASH) {
    return refusedSource(`not a git repository: ${jsonQuote(operand)}`)
  }
  const source = new GitSource()
  source.ref = ref
  if (base.startsWith("git+ssh://")) {
    // npm writes an scp-like source as `git+ssh://git@host:owner/repo`, which
    // git reads only without the scheme: with it, `:owner` is a port.
    const rest = base.substring(10)
    source.url = isScpLike(rest) ? rest : `ssh://${rest}`
    source.spec = base
  } else if (base.startsWith("git+https://") || base.startsWith("git+file://")) {
    source.url = base.substring(GIT_PLUS.length)
    source.spec = base
  } else if (base.startsWith("ssh://") || base.startsWith("https://") || base.startsWith("file://")) {
    source.url = base
    source.spec = `${GIT_PLUS}${base}`
  } else if (base.indexOf("://") >= 0) {
    return refusedSource(`${jsonQuote(operand)}: only https://, ssh:// and file:// sources are installed`)
  } else if (
    base.startsWith("/") ||
    base.startsWith("./") ||
    base.startsWith("../") ||
    base === "." ||
    base === ".."
  ) {
    const real = realpathSync(base)
    if (real === null) {
      return refusedSource(`no directory ${jsonQuote(base)}`)
    }
    source.url = `file://${real}`
    source.spec = `${GIT_PLUS}file://${real}`
  } else if (isScpLike(base)) {
    source.url = base
    source.spec = `${GIT_PLUS}ssh://${base}`
  } else {
    return refusedSource(
      `not a git repository: ${jsonQuote(operand)} (an https://, ssh:// or git@host:path URL, or a directory)`
    )
  }
  return source
}

/** `source` as `package.json` records it: npm's spelling and the ref it was installed at. */
const recordedSpec = (source: GitSource, ref: string): string =>
  ref.length > 0 ? `${source.spec}#${ref}` : source.spec

/** The stage directories and capture files of one run are named apart by this. */
const runTag = (): string => hexOfI64(monotonicNanos(), 16)

/** `git` with `args`, its stdout to `out` (or inherited for `""`) and its stderr inherited. */
const git = (args: string[], out: string): number => {
  const argv: string[] = ["git"]
  for (const arg of args) {
    argv.push(arg)
  }
  return spawnSyncTo(argv, out, "")
}

/** `rm -rf -- path`, as `nish upgrade` clears its scratch directory. */
const removeTree = (path: string): void => {
  spawnSync(["rm", "-rf", "--", path])
}

/** `text` without the blank characters at its two ends. */
const trimmed = (text: string): string => {
  let start = 0
  let end = text.length
  while (start < end && isBlankByte(text.charCodeAt(start))) {
    start = start + 1
  }
  while (end > start && isBlankByte(text.charCodeAt(end - 1))) {
    end = end - 1
  }
  return text.substring(start, end)
}

const isBlankByte = (code: i32): boolean =>
  code === SPACE || code === TAB || code === NEWLINE || code === CARRIAGE_RETURN

/**
 * A release tag's three numbers, or an empty array for a tag that is not one:
 * `1.2.3` or `v1.2.3`, each part at most nine digits. A prerelease
 * (`v1.0.0-rc.1`) is not a release, and a monorepo's `@scope/pkg@1.0.0` is
 * some other package's, so neither is picked as the latest.
 */
const releaseParts = (tag: string): i32[] => {
  const text = tag.startsWith("v") ? tag.substring(1) : tag
  const parts: i32[] = []
  for (const piece of splitByte(text, DOT)) {
    if (piece.length === 0 || piece.length > 9) {
      return []
    }
    let value = 0
    for (let i = 0; i < piece.length; i++) {
      const code = piece.charCodeAt(i)
      if (!isDigitCode(code)) {
        return []
      }
      value = value * 10 + (code - DIGIT_0)
    }
    parts.push(value)
  }
  return parts.length === 3 ? parts : []
}

/** Whether release `a` is newer than release `b`, both from `releaseParts`. */
const newerRelease = (a: i32[], b: i32[]): boolean => {
  if (b.length !== 3) {
    return true
  }
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) {
      return a[i] > b[i]
    }
  }
  return false
}

/**
 * The newest release tag of `url`, asked with `git ls-remote`, which speaks
 * the git protocol rather than a host's API and so has no rate limit to meet;
 * `""` when the repository has none, and null when it could not be asked.
 */
const latestReleaseTag = (url: string, capture: string): string | null => {
  if (git(["ls-remote", "--tags", "--refs", "--", url], capture) !== 0) {
    return null
  }
  const listing = readFileSyncOrNull(capture)
  unlinkSync(capture)
  if (listing === null) {
    return null
  }
  let best = ""
  let bestParts: i32[] = []
  for (const line of splitByte(listing, NEWLINE)) {
    const at = line.indexOf("refs/tags/")
    if (at >= 0) {
      const tag = trimmed(line.substring(at + 10))
      const parts = releaseParts(tag)
      if (parts.length === 3 && validRef(tag) && newerRelease(parts, bestParts)) {
        best = tag
        bestParts = parts
      }
    }
  }
  return best
}

/** What one fetch came away with: the commit, or the `problem` that stopped it. */
class Fetched {
  commit: string = ""
  problem: string = ""
}

/** A fetch that stopped: `problem` says why. */
const fetchFailed = (problem: string): Fetched => {
  const out = new Fetched()
  out.problem = problem
  return out
}

/** Whether `text` is a full commit hash: forty or sixty-four lower-case hex digits. */
const isCommitHash = (text: string): boolean => {
  if (text.length !== 40 && text.length !== 64) {
    return false
  }
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (!isDigitCode(code) && !(code >= LOWER_A && code <= LOWER_F)) {
      return false
    }
  }
  return true
}

/**
 * Fetches `ref` of `url` (its default branch for `""`) into `stage`, one commit
 * deep, and checks it out there with no `.git` left behind. The tree is read
 * with `ls-tree` before anything is written into the working copy, and refused
 * when it holds a symbolic link (mode 120000) or a submodule (160000).
 */
const fetchInto = (url: string, ref: string, stage: string, capture: string): Fetched => {
  if (git(["init", "-q", "--", stage], "/dev/null") !== 0) {
    return fetchFailed(`git could not create ${stage}`)
  }
  const fetch: string[] = ["-C", stage, "fetch", "-q", "--depth", "1", "--", url]
  if (ref.length > 0) {
    fetch.push(ref)
  }
  if (git(fetch, "") !== 0) {
    return fetchFailed(
      ref.length > 0 ? `git could not fetch ${ref} from ${url}` : `git could not fetch ${url}`
    )
  }
  if (git(["-C", stage, "rev-parse", "--verify", "-q", "FETCH_HEAD^{commit}"], capture) !== 0) {
    return fetchFailed(`${ref.length > 0 ? ref : "the default branch"} of ${url} is not a commit`)
  }
  const head = readFileSyncOrNull(capture)
  const commit = head === null ? "" : trimmed(head)
  if (!isCommitHash(commit)) {
    return fetchFailed(`git named no commit for ${url}`)
  }
  if (git(["-C", stage, "ls-tree", "-r", "--full-tree", commit], capture) !== 0) {
    return fetchFailed(`git could not list ${commit}`)
  }
  const tree = readFileSyncOrNull(capture)
  unlinkSync(capture)
  if (tree === null) {
    return fetchFailed(`git could not list ${commit}`)
  }
  for (const line of splitByte(tree, NEWLINE)) {
    const tab = line.indexOf("\t")
    const path = tab >= 0 ? line.substring(tab + 1) : line
    if (line.startsWith("120000 ")) {
      return fetchFailed(`${path} is a symbolic link, and an installed package may not hold one`)
    }
    if (line.startsWith("160000 ")) {
      return fetchFailed(`${path} is a git submodule, which ${CLI} install does not fetch`)
    }
  }
  if (git(["-C", stage, "-c", "advice.detachedHead=false", "checkout", "-q", commit], "") !== 0) {
    return fetchFailed(`git could not check out ${commit}`)
  }
  removeTree(`${stage}/.git`)
  const out = new Fetched()
  out.commit = commit
  return out
}

/** What one installed package came to: its name and version, and where it came from. */
export class Installed {
  name: string = ""
  version: string = ""
  source: string = ""
  commit: string = ""
  problem: string = ""
}

/** An install that stopped: `problem` says why. */
const installFailed = (problem: string): Installed => {
  const out = new Installed()
  out.problem = problem
  return out
}

/**
 * Moves `stage` to `<modules>/<name>`, over whatever was there: the old
 * directory is renamed aside first and put back if the move fails, so a
 * failed install leaves the package that was installed rather than none.
 */
const placePackage = (stage: string, modules: string, name: string, tag: string): boolean => {
  if (name.charCodeAt(0) === AT) {
    mkdirSync(`${modules}/${name.substring(0, name.indexOf("/"))}`)
  }
  const target = `${modules}/${name}`
  const aside = `${modules}/.${CLI}-old-${tag}`
  const hadOne = renameSync(target, aside) === 0
  if (renameSync(stage, target) !== 0) {
    if (hadOne) {
      renameSync(aside, target)
    }
    return false
  }
  if (hadOne) {
    removeTree(aside)
  }
  return true
}

/**
 * Installs `source` into `<root>/node_modules`. `wanted` is the name the
 * manifest already records it under (`""` for a new one), which the package's
 * own `name` must then be; `locked` is the commit `nish.lock` holds for it
 * (`""` for none), which is fetched in place of the ref when the host serves a
 * commit by its hash, and which the ref must otherwise still name.
 */
const installSource = (source: GitSource, root: string, wanted: string, locked: string): Installed => {
  const modules = `${root}/${PACKAGE_ROOT_SEGMENT}`
  mkdirSync(modules)
  const tag = runTag()
  const stage = `${modules}/.${CLI}-install-${tag}`
  const capture = `${stage}.out`
  let ref = source.ref
  if (ref.length === 0 && locked.length === 0) {
    const latest = latestReleaseTag(source.url, capture)
    if (latest === null) {
      return installFailed(`git could not list the tags of ${source.url}`)
    }
    ref = latest
  }
  let fetched = new Fetched()
  if (locked.length > 0) {
    fetched = fetchInto(source.url, locked, stage, capture)
    if (fetched.problem.length > 0) {
      // A host that will not serve a commit by its hash is still asked for
      // the ref, and the lock then holds it to the commit it named before.
      removeTree(stage)
      fetched = fetchInto(source.url, ref, stage, capture)
      if (fetched.problem.length === 0 && fetched.commit !== locked) {
        removeTree(stage)
        return installFailed(
          `${source.url}#${ref} is now ${fetched.commit}, but ${LOCKFILE} holds ${locked}: ` +
            `install it by name to move the lock (${CLI} install ${recordedSpec(source, ref)})`
        )
      }
    }
  } else {
    fetched = fetchInto(source.url, ref, stage, capture)
  }
  unlinkSync(capture)
  if (fetched.problem.length > 0) {
    removeTree(stage)
    return installFailed(fetched.problem)
  }
  const manifest = readFileSyncOrNull(`${stage}/${MANIFEST}`)
  if (manifest === null) {
    removeTree(stage)
    return installFailed(`${source.url} has no ${MANIFEST} at its root, so it is not a package`)
  }
  const name = manifestString(manifest, "name")
  if (name === null || !validPackageName(name)) {
    removeTree(stage)
    return installFailed(
      `${source.url}: its ${MANIFEST} names it ${name === null ? "nothing" : jsonQuote(name)}, which is not a package name`
    )
  }
  if (wanted.length > 0 && name !== wanted) {
    removeTree(stage)
    return installFailed(`${source.url} is the package ${name}, but ${MANIFEST} installs it as ${wanted}`)
  }
  if (!manifestOffersNish(manifest)) {
    removeTree(stage)
    return installFailed(
      `${name} (${source.url}) has no Nish entry point: its ${MANIFEST} \`exports\` offers no \`nish\` condition`
    )
  }
  if (!placePackage(stage, modules, name, tag)) {
    removeTree(stage)
    return installFailed(`could not move ${name} into ${modules}`)
  }
  const out = new Installed()
  out.name = name
  out.version = manifestVersion(manifest)
  out.source = recordedSpec(source, ref.length > 0 ? ref : fetched.commit)
  out.commit = fetched.commit
  return out
}

/**
 * The directory whose `package.json` the dependency is recorded in: the
 * nearest one at or above the working directory that has one, as npm finds
 * it, or the working directory itself when none does.
 */
const projectRoot = (): string => {
  const here = realpathSync(".")
  if (here === null) {
    return "."
  }
  let dir = here
  while (dir.length > 0) {
    if (readFileSyncOrNull(`${dir}/${MANIFEST}`) !== null) {
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) {
      return here
    }
    dir = parent
  }
  return here
}

/** The spaces and tabs between the start of `at`'s line and `at`. */
const indentAt = (text: string, at: i32): string => {
  let start = at
  while (start > 0 && (text.charCodeAt(start - 1) === SPACE || text.charCodeAt(start - 1) === TAB)) {
    start = start - 1
  }
  return start > 0 && text.charCodeAt(start - 1) !== NEWLINE ? "" : text.substring(start, at)
}

/**
 * `text` with the object at `objectAt` given `key: value`: the value replaced
 * where the key is already a member, and otherwise a member added after the
 * last one, indented as that one is (or by `indent` inside an empty object,
 * whose closing brace goes at `closeIndent`). Null for an object the reader
 * cannot walk, which is written over by nothing.
 */
const withMember = (
  text: string,
  objectAt: i32,
  key: string,
  value: string,
  indent: string,
  closeIndent: string
): string | null => {
  const members = manifestMembers(text, objectAt)
  if (members.broken >= 0) {
    return null
  }
  for (let k = 0; k < members.keys.length; k++) {
    if (members.keys[k] === key) {
      return `${text.substring(0, members.valueAt[k])}${value}${text.substring(members.valueEnd[k])}`
    }
  }
  const member = `${jsonQuote(key)}: ${value}`
  if (members.keys.length === 0) {
    const close = manifestSkipBlank(text, objectAt + 1)
    return `${text.substring(0, objectAt)}{\n${indent}${member}\n${closeIndent}}${text.substring(close + 1)}`
  }
  const last = members.keys.length - 1
  const lastIndent = indentAt(text, members.keyAt[last])
  const end = members.valueEnd[last]
  return `${text.substring(0, end)},\n${lastIndent.length > 0 ? lastIndent : indent}${member}${text.substring(end)}`
}

/**
 * `manifest` (null for none) with `dependencies[name]` set to `spec`,
 * formatted as the rest of the file is, or null when it is not an object this
 * reader can walk: the command then refuses rather than guess at an edit.
 */
export const withDependency = (manifest: string | null, name: string, spec: string): string | null => {
  if (manifest === null || trimmed(manifest).length === 0) {
    return `{\n  "dependencies": {\n    ${jsonQuote(name)}: ${jsonQuote(spec)}\n  }\n}\n`
  }
  const at = manifestSkipBlank(manifest, 0)
  const top = manifestMembers(manifest, at)
  if (top.broken >= 0) {
    return null
  }
  for (let k = 0; k < top.keys.length; k++) {
    if (top.keys[k] === "dependencies") {
      const deps = top.valueAt[k]
      if (manifest.charCodeAt(deps) !== OPEN_BRACE) {
        return null
      }
      const outer = indentAt(manifest, top.keyAt[k])
      return withMember(
        manifest,
        deps,
        name,
        jsonQuote(spec),
        `${outer}${outer.length > 0 ? outer : "  "}`,
        outer
      )
    }
  }
  const inner = top.keys.length > 0 ? indentAt(manifest, top.keyAt[0]) : "  "
  const indent = inner.length > 0 ? inner : "  "
  const block = `{\n${indent}${indent}${jsonQuote(name)}: ${jsonQuote(spec)}\n${indent}}`
  return withMember(manifest, at, "dependencies", block, indent, "")
}

/** One row of `nish.lock`: a package, the source it was installed from, and its commit. */
export class LockEntry {
  name: string = ""
  source: string = ""
  commit: string = ""
}

/** The rows of a `nish.lock`, or none for a file that is missing or that this reader cannot walk. */
export const readLock = (text: string | null): LockEntry[] => {
  const entries: LockEntry[] = []
  if (text === null) {
    return entries
  }
  const top = manifestMembers(text, manifestSkipBlank(text, 0))
  for (let k = 0; k < top.keys.length; k++) {
    if (top.keys[k] === "packages") {
      const packages = manifestMembers(text, top.valueAt[k])
      for (let p = 0; p < packages.keys.length; p++) {
        const row = text.substring(packages.valueAt[p], packages.valueEnd[p])
        const source = manifestString(row, "source")
        const commit = manifestString(row, "commit")
        if (source !== null && commit !== null && isCommitHash(commit)) {
          const entry = new LockEntry()
          entry.name = packages.keys[p]
          entry.source = source
          entry.commit = commit
          entries.push(entry)
        }
      }
    }
  }
  return entries
}

/** `entries` as the lockfile holds them, one package to a line, in the order given. */
export const formatLock = (entries: LockEntry[]): string => {
  const out = new StringBuilder()
  out.add(`{\n  "lockfileVersion": ${LOCK_VERSION},\n  "packages": {`)
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    out.add(i === 0 ? "\n" : ",\n")
    out.add(
      `    ${jsonQuote(e.name)}: { "source": ${jsonQuote(e.source)}, "commit": ${jsonQuote(e.commit)} }`
    )
  }
  out.add(entries.length > 0 ? "\n  }\n}\n" : "}\n}\n")
  return out.toText()
}

/** The commit `entries` holds for `name` installed from `source`, or `""`. */
const lockedCommit = (entries: LockEntry[], name: string, source: string): string => {
  for (const e of entries) {
    if (e.name === name && e.source === source) {
      return e.commit
    }
  }
  return ""
}

/** `entries` with `installed` recorded: its row replaced, or added at the end. */
const withLockEntry = (entries: LockEntry[], installed: Installed): LockEntry[] => {
  const entry = new LockEntry()
  entry.name = installed.name
  entry.source = installed.source
  entry.commit = installed.commit
  const out: LockEntry[] = []
  let replaced = false
  for (const e of entries) {
    if (e.name === installed.name) {
      out.push(entry)
      replaced = true
    } else {
      out.push(e)
    }
  }
  if (!replaced) {
    out.push(entry)
  }
  return out
}

/** Writes `text` to `path` through a temporary beside it, so a reader never sees half of it. */
const writeWhole = (path: string, text: string): boolean => {
  const temp = `${path}.${runTag()}.tmp`
  if (writeFileSyncMode(temp, text, 0o644) < 0 || renameSync(temp, path) < 0) {
    unlinkSync(temp)
    return false
  }
  return true
}

/** The usage line, and the lines `--help` adds to it. */
const installUsageLine = (): string => `usage: ${CLI} install [<git-url>[#<ref>] ...]`

/** A usage error of `nish install`: the message, the usage line, and status 2. */
const installUsage = (message: string): i32 => {
  console.error(`install: ${message}`)
  console.error(installUsageLine())
  return 2
}

/** Whether `git` can be started at all; the command's toolchain is this one program. */
const gitRuns = (): boolean => spawnSyncTo(["git", "--version"], "/dev/null", "/dev/null") === 0

/**
 * The dependencies of a manifest that are git sources, as names and specs in
 * two parallel arrays, and how many others it records (npm's to install).
 */
class GitDependencies {
  names: string[]
  specs: string[]
  others: i32

  constructor() {
    this.names = []
    this.specs = []
    this.others = 0
  }
}

const gitDependencies = (manifest: string): GitDependencies => {
  const out = new GitDependencies()
  const top = manifestMembers(manifest, manifestSkipBlank(manifest, 0))
  for (let k = 0; k < top.keys.length; k++) {
    if (top.keys[k] === "dependencies") {
      const deps = manifest.substring(top.valueAt[k], top.valueEnd[k])
      const members = manifestMembers(deps, 0)
      for (const name of members.keys) {
        const spec = manifestString(deps, name)
        if (spec !== null && spec.startsWith(GIT_PLUS)) {
          out.names.push(name)
          out.specs.push(spec)
        } else {
          out.others = out.others + 1
        }
      }
    }
  }
  return out
}

/**
 * `nish install [<git-url>[#<ref>] ...]` (`args` from index `from`, what
 * follows `install`). With operands, each is fetched, placed in
 * `node_modules`, recorded in `package.json` and locked. With none, every git
 * dependency `package.json` already records is installed at its locked commit,
 * and the rest are left to npm. 0 when every package installed, 1 when one
 * did not, 2 for a usage error and 3 when `git` cannot be started.
 */
export const install = (args: string[], from: i32): i32 => {
  const operands: string[] = []
  for (let i = from; i >= 0 && i < args.length; i++) {
    const arg = args[i]
    if (arg === "--help" || arg === "-h") {
      console.log(installUsageLine())
      console.log("  fetches each package from git into node_modules, records it in package.json")
      console.log(`  as npm writes a git dependency, and keeps its commit in ${LOCKFILE};`)
      console.log("  with no URL, installs every git dependency package.json records, at its locked commit")
      console.log("  <git-url>  git@host:owner/repo.git, ssh://..., https://..., file://... or a directory")
      console.log("  #<ref>     a tag, branch or commit; the newest vX.Y.Z tag when left out")
      return 0
    }
    if (arg.startsWith("-")) {
      return installUsage(`unknown flag ${arg}`)
    }
    operands.push(arg)
  }
  const sources: GitSource[] = []
  for (const operand of operands) {
    const source = parseGitSource(operand)
    if (source.problem.length > 0) {
      return installUsage(source.problem)
    }
    sources.push(source)
  }
  if (!gitRuns()) {
    console.error(
      `install: git could not be started; ${CLI} install fetches packages with it, so install git first`
    )
    return 3
  }
  const root = projectRoot()
  const manifestPath = `${root}/${MANIFEST}`
  const lockPath = `${root}/${LOCKFILE}`
  let manifest = readFileSyncOrNull(manifestPath)
  let lock = readLock(readFileSyncOrNull(lockPath))
  const wanted: string[] = []
  const locked: string[] = []
  if (sources.length === 0) {
    if (manifest === null) {
      console.error(`install: no ${MANIFEST} here or above, so nothing to install`)
      return 0
    }
    const deps = gitDependencies(manifest)
    for (let i = 0; i < deps.names.length; i++) {
      const source = parseGitSource(deps.specs[i])
      if (source.problem.length > 0) {
        console.error(`install: ${deps.names[i]}: ${source.problem}`)
        return 1
      }
      sources.push(source)
      wanted.push(deps.names[i])
      locked.push(lockedCommit(lock, deps.names[i], deps.specs[i]))
    }
    if (sources.length === 0) {
      console.error(
        `install: ${MANIFEST} records no git dependency${deps.others > 0 ? "; the others are npm's to install" : ""}`
      )
      return 0
    }
  } else {
    for (let i = 0; i < sources.length; i++) {
      wanted.push("")
      locked.push("")
    }
  }
  let status = 0
  for (let i = 0; i < sources.length; i++) {
    const installed = installSource(sources[i], root, wanted[i], locked[i])
    if (installed.problem.length > 0) {
      console.error(`install: ${installed.problem}`)
      status = 1
    } else {
      const edited = withDependency(manifest, installed.name, installed.source)
      if (edited === null) {
        console.error(
          `install: ${manifestPath} is not a JSON object this command can edit; add the dependency yourself:`
        )
        console.error(`  ${jsonQuote(installed.name)}: ${jsonQuote(installed.source)}`)
        status = 1
      } else if (manifest === null || edited !== manifest) {
        if (!writeWhole(manifestPath, edited)) {
          console.error(`install: could not write ${manifestPath}`)
          status = 1
        }
        manifest = edited
      }
      lock = withLockEntry(lock, installed)
      const version = installed.version.length > 0 ? `@${installed.version}` : ""
      console.error(
        `installed ${installed.name}${version} from ${installed.source} (${installed.commit.substring(0, 12)})`
      )
    }
  }
  if (lock.length > 0 && !writeWhole(lockPath, formatLock(lock))) {
    console.error(`install: could not write ${lockPath}`)
    status = 1
  }
  return status
}
