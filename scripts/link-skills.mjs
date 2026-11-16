/**
 * Find the agent skills of a project's installed Nish packages, and link the
 * ones the user has accepted into its `.claude/skills/`, where Claude Code
 * loads project skills from.
 *
 * A package ships a skill as `skills/<name>/SKILL.md` at its root, and the
 * skill's id is `<name>`. The packages that qualify are `nish` itself and every
 * top-level `node_modules/<pkg>` or `node_modules/@scope/<pkg>` whose
 * `package.json` `exports` uses a `nish` condition. A plain npm package with a
 * `skills/` directory is not a Nish package and is left alone.
 *
 * **Nothing is linked without consent.** A skill is instructions for Claude,
 * and its frontmatter and body can grant tools, register hooks or run shell
 * commands when it loads; any package in the tree can ship one, so the unit of
 * consent is one package, one skill name and one hash of the whole skill
 * directory. The accepted triples live in `.claude/skills/.nish-skills.json`;
 * a new package, a rival claiming the same name, or a changed hash is not
 * accepted until the user says so again. What a skill grants is read against an
 * allowlist of inert frontmatter keys, so a key this file does not know counts
 * as a grant.
 *
 * **Everything a package controls is checked, never trusted**: a skill name
 * must match `NAME` before it is linked or printed in a command, and every
 * other package string reaches the terminal only through `clean`.
 *
 * **Links, not copies**: `.claude/skills/<name>` is a relative symlink to
 * `../../node_modules/<pkg>/skills/<name>`, so it survives moving the project.
 * On win32 it is a junction to the absolute path, because a directory symlink
 * there needs elevation. A link also follows an upgrade, which is the gap the
 * hash cannot close on its own: the next run unlinks a skill whose hash moved.
 *
 * **The linker owns only its own links.** An entry under `.claude/skills/` is
 * the linker's only if it is a link whose target resolves inside
 * `<project>/node_modules/`. Anything else -- a real directory, a file, a link
 * pointing elsewhere -- belongs to the user and is never replaced or removed.
 * Every check is an `lstat`, and nothing follows a link before that test.
 *
 * Plain Node with `node:` built-ins only: it ships in the package, which keeps
 * no runtime dependency, and `bin/nish-skills.js` runs it.
 */
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

/** The `lstat` of a path, or null when nothing is there. */
const lstatOrNull = (file) => {
  try {
    return fs.lstatSync(file)
  } catch {
    return null
  }
}

/** Whether an `exports` value uses a `nish` condition anywhere in it. */
const usesNishCondition = (exports) => {
  if (Array.isArray(exports)) {
    return exports.some(usesNishCondition)
  }
  if (exports === null || typeof exports !== "object") {
    return false
  }
  return Object.entries(exports).some(([key, value]) => key === "nish" || usesNishCondition(value))
}

/** Whether the package at `dir` is a Nish package: `nish` itself, or one whose exports use the `nish` condition. */
const isNishPackage = (name, dir) => {
  if (name === "nish") {
    return true
  }
  try {
    return usesNishCondition(JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).exports)
  } catch {
    return false
  }
}

/**
 * The names of the directories in `dir`, links to one included, or none when
 * it cannot be read. Only for `node_modules`, where a workspace member is a
 * link; a skill directory is never reached through a link (see `skillsOf`).
 */
const subdirectories = (dir) => {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() || e.isSymbolicLink())
      .map((e) => e.name)
  } catch {
    return []
  }
}

/**
 * The qualifying packages under `node_modules`, one level and one under each
 * `@scope`: `nish` first, so no library can shadow its skills, then the rest by
 * name.
 */
const nishPackages = (nodeModules) => {
  const found = []
  for (const entry of subdirectories(nodeModules)) {
    if (entry.startsWith(".")) {
      continue
    }
    const names = entry.startsWith("@")
      ? subdirectories(path.join(nodeModules, entry)).map((n) => `${entry}/${n}`)
      : [entry]
    for (const name of names) {
      const dir = path.join(nodeModules, name)
      if (isNishPackage(name, dir)) {
        found.push({ name, dir })
      }
    }
  }
  // Code-unit order, not the locale's, so every machine picks the same first claimant.
  const rank = (p) => (p.name === "nish" ? "" : p.name)
  return found.sort((a, b) => Number(rank(a) > rank(b)) - Number(rank(a) < rank(b)))
}

/** Code-unit order, not the locale's, so every machine sorts the same way. */
const byCodeUnit = (a, b) => Number(a > b) - Number(a < b)

/**
 * The names a skill may have: Claude Code's own shape. Anything else is never
 * linked, so every name that reaches a path, the record or a command the user is
 * told to run is safe in all three.
 */
const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/

/**
 * The skills a package ships, read by `lstat` alone: each `skills/<name>/`
 * that is a real directory holding a regular `SKILL.md`, with `skills/`
 * itself a real directory. A link at any of those three places is never
 * followed: what it points at is outside what the hash covers, so the entry is
 * reported as skipped instead.
 *
 * @param {{ name: string, dir: string }} pkg The package.
 * @param {{ name: string, reason: string }[]} skipped Where an entry left out is reported.
 * @returns {string[]} The skill names, in code-unit order.
 */
const skillsOf = (pkg, skipped) => {
  const at = path.join(pkg.dir, "skills")
  const st = lstatOrNull(at)
  if (st === null || !(st.isDirectory() || st.isSymbolicLink())) {
    return []
  }
  if (st.isSymbolicLink()) {
    skipped.push({ name: "skills", reason: `in ${pkg.name} is a link, so none of its skills is linked` })
    return []
  }
  let entries
  try {
    entries = fs.readdirSync(at, { withFileTypes: true })
  } catch {
    skipped.push({ name: "skills", reason: `in ${pkg.name} cannot be read, so none of its skills is linked` })
    return []
  }
  const names = []
  for (const e of entries) {
    if (e.name.startsWith(".")) {
      continue
    }
    if (e.isSymbolicLink()) {
      skipped.push({ name: e.name, reason: `in ${pkg.name} is a link, so it is not linked` })
      continue
    }
    if (!e.isDirectory()) {
      continue
    }
    const md = lstatOrNull(path.join(at, e.name, "SKILL.md"))
    if (md?.isFile()) {
      names.push(e.name)
    } else if (md !== null) {
      skipped.push({
        name: e.name,
        reason: `in ${pkg.name} has a SKILL.md that is ${md.isSymbolicLink() ? "a link" : "not a regular file"}, so it is not linked`,
      })
    }
  }
  return names.sort(byCodeUnit)
}

/** A link's target as an absolute path, without the `\\?\` prefix win32 gives a junction's. */
const targetOf = (link) => {
  const raw = fs.readlinkSync(link)
  const target = raw.startsWith("\\\\?\\") ? raw.slice(4) : raw
  return path.resolve(path.dirname(link), target)
}

/** The name a link is written under before it is renamed into place; see `tempName`. */
const TEMP = /^\..+\.\d+\.tmp$/

/** The temporary name for skill `name`'s link, unique to this process. */
const tempName = (name) => `.${name}.${process.pid}.tmp`

/** Whether `child` lies strictly inside `parent`. */
const inside = (child, parent) => {
  const rel = path.relative(parent, child)
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel)
}

/**
 * The project a copy of `nish` at `nishRoot` is installed in, searching from
 * `start` upwards: `start` itself or the nearest ancestor holding a
 * `package.json` whose `node_modules/nish` is that copy. In a workspace that is
 * the root nish was hoisted to, not the member `start` names. Null when no
 * directory above `start` installs this copy -- a checkout, or npx's cache.
 *
 * @param {string} start Where to start: npm's `INIT_CWD`, or the current directory.
 * @param {string} nishRoot The root of the `nish` package asking.
 * @returns {string | null} The project directory, or null.
 */
export const projectOf = (start, nishRoot) => {
  const here = fs.realpathSync(nishRoot)
  const from = path.resolve(start)
  for (let dir = from; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, "node_modules", "nish")
    if (
      (dir === from || fs.existsSync(path.join(dir, "package.json"))) &&
      fs.existsSync(candidate) &&
      fs.realpathSync(candidate) === here
    ) {
      return dir
    }
    if (path.dirname(dir) === dir) {
      return null
    }
  }
}

/**
 * A skill directory read whole, for its hash and its `SKILL.md`.
 *
 * @typedef {object} SkillTree
 * @property {string} hash `sha256-<hex>` over the directory.
 * @property {string[]} grants What its shape grants: a link, a special file or an unreadable entry inside it.
 * @property {Buffer | null} skillMd The bytes of its `SKILL.md`, or null when they could not be read.
 */

/**
 * Read a skill directory: the sha256 of every entry's path relative to `dir`
 * and kind, with a regular file's bytes and a link's target string, in
 * code-unit order of the path, each part length-prefixed so no two trees frame
 * to the same bytes. Nothing is followed.
 *
 * Three kinds of entry hold content the hash cannot pin: a link (its target's
 * bytes are not hashed), a special file such as a FIFO or a device, and an
 * entry that cannot be read. Each is a grant, so `--yes` refuses the skill,
 * and each mixes a fresh random value into the hash, so a name that accepts
 * such a skill accepts it for that run only: the next run finds it changed and
 * asks again, rather than keep serving content nobody saw.
 *
 * @param {string} dir The skill directory, already known to be a real directory.
 * @returns {SkillTree}
 */
const readSkill = (dir) => {
  const entries = []
  const grants = new Set()
  const walk = (at, rel) => {
    let list
    try {
      list = fs.readdirSync(at, { withFileTypes: true })
    } catch {
      grants.add("contains an unreadable entry")
      entries.push({ name: rel, kind: "unreadable", data: Buffer.alloc(0) })
      return
    }
    for (const e of list) {
      const file = path.join(at, e.name)
      const name = rel === "" ? e.name : `${rel}/${e.name}`
      if (e.isDirectory()) {
        entries.push({ name, kind: "dir", data: Buffer.alloc(0) })
        walk(file, name)
        continue
      }
      let kind = "other"
      let data = Buffer.alloc(0)
      try {
        if (e.isFile()) {
          kind = "file"
          data = fs.readFileSync(file)
        } else if (e.isSymbolicLink()) {
          kind = "link"
          data = Buffer.from(fs.readlinkSync(file))
          grants.add("contains a link")
        } else {
          grants.add("contains a special file")
        }
      } catch {
        kind = "unreadable"
        data = Buffer.alloc(0)
        grants.add("contains an unreadable entry")
      }
      entries.push({ name, kind, data })
    }
  }
  walk(dir, "")
  const hash = crypto.createHash("sha256")
  for (const { name, kind, data } of entries.sort((x, y) => byCodeUnit(x.name, y.name))) {
    const head = Buffer.from(name)
    hash.update(`${kind} ${head.length} `).update(head).update(` ${data.length} `).update(data)
  }
  if (grants.size > 0) {
    hash.update(crypto.randomBytes(32))
  }
  const skillMd = entries.find((e) => e.name === "SKILL.md" && e.kind === "file")?.data ?? null
  return { hash: `sha256-${hash.digest("hex")}`, grants: [...grants], skillMd }
}

/** What a skill grants when its frontmatter could not be read: it counts as a grant. */
const UNREADABLE = "unreadable frontmatter"

/**
 * The top-level frontmatter keys Claude Code documents as granting nothing.
 * Every other key -- `allowed-tools`, `hooks`, `context`, `agent`,
 * `background`, or one added after this list was written -- counts as a grant,
 * so a key Claude Code learns later is refused by `--yes` until a person names
 * the skill.
 */
const INERT = new Set([
  "name",
  "description",
  "when_to_use",
  "argument-hint",
  "arguments",
  "metadata",
  "license",
  "compatibility",
  "model",
  "effort",
  "disable-model-invocation",
  "user-invocable",
  "paths",
  "disallowed-tools",
  "shell",
])

/** Keys Claude Code documents as granting something, named as they are rather than as unknown. */
const GRANTING = new Set(["hooks", "context", "agent", "background"])

/**
 * A `SKILL.md` body or frontmatter that runs a shell command when the skill
 * loads: an inline `` !`cmd` ``, or a fence of three or more backticks or
 * tildes followed by `!`. The fence counts anywhere on a line -- after
 * indentation, a list or quote marker, or any text -- and with any spaces,
 * tabs and non-breaking spaces included, between it and the `!` on that line. An inline `` !` ``
 * counts after anything but a letter, digit or `_`: that one is code such as
 * TypeScript's `` `x!` `` (non-null assertion) inside a code span. Either way
 * the check errs towards asking.
 */
const SHELL_AT_LOAD = /(?<![\p{L}\p{N}_])!`|(?:`{3,}|~{3,})[^\S\r\n]*!/u

/** A YAML scalar with its quotes taken off. */
const unquote = (value) => (/^"[^"]*"$|^'[^']*'$/.test(value) ? value.slice(1, -1) : value)

/** The tools an `allowed-tools` key lists, with `<unreadable>` for a form this file does not read. */
const toolsOf = ({ value, under }) => {
  if (value === "" && under.every((item) => item.startsWith("- "))) {
    return under.map((item) => unquote(item.slice(2).trim()))
  }
  if (under.length > 0 || (value.startsWith("[") && !value.endsWith("]"))) {
    return ["<unreadable>"]
  }
  if (value.startsWith("[")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((t) => unquote(t.trim()))
  }
  return unquote(value).split(/[,\s]+/)
}

/**
 * The description of a `SKILL.md` and everything it grants, read from its
 * leading `---` block and its body. It reads only top-level `key: value`
 * scalars, inline `[a, b]` lists and `- item` block lists -- no YAML
 * dependency -- and it fails closed: a block it cannot read, a top-level key
 * not in `INERT`, or a load-time shell command adds to `grants`. Only a block
 * that parsed, holds inert keys alone, and a text with no `!` command yields
 * an empty `grants`.
 *
 * @param {string} text The whole `SKILL.md`.
 * @returns {{ description: string, grants: string[] }} Each grant as it is shown, unsanitised.
 */
const frontmatter = (text) => {
  const shell = SHELL_AT_LOAD.test(text) ? ["runs shell at load"] : []
  const unreadable = { description: "", grants: [UNREADABLE, ...shell] }
  const lines = text.replace(/^﻿/, "").split(/\r?\n/)
  if (lines[0].trimEnd() !== "---") {
    return unreadable
  }
  const end = lines.findIndex((line, i) => i > 0 && line.trimEnd() === "---")
  if (end === -1) {
    return unreadable
  }
  /** Each top-level key with its inline value and the indented lines under it. */
  const keys = []
  for (const line of lines.slice(1, end)) {
    if (line.trim() === "" || line.startsWith("#")) {
      continue
    }
    if (/^\s/.test(line)) {
      if (keys.length === 0) {
        return unreadable
      }
      keys[keys.length - 1].under.push(line.trim())
      continue
    }
    // A quoted key, a merge key, a flow mapping: anything else at the top could
    // hide a grant, so the whole block counts as unreadable.
    const m = /^([A-Za-z0-9_.-]+):(?:\s+(.*))?$/.exec(line)
    if (m === null) {
      return unreadable
    }
    keys.push({ key: m[1], value: (m[2] ?? "").trim(), under: [] })
  }
  const description = keys
    .filter((k) => k.key === "description")
    .map((k) => [unquote(k.value.replace(/^[>|][-+]?$/, "")), ...k.under].join(" ").trim())
    .join(" ")
  const grants = []
  for (const k of keys) {
    if (INERT.has(k.key)) {
      continue
    }
    if (/^allowed[-_]?tools$/i.test(k.key)) {
      // Any spelling a reader might honour is shown as what it is, so a near-miss reads as a grant.
      const tools = toolsOf(k).filter((t) => t !== "")
      grants.push(tools.length === 0 ? `${k.key} (present, empty)` : `${k.key}: ${tools.join(", ")}`)
    } else {
      grants.push(GRANTING.has(k.key) ? k.key : `unknown key ${k.key}`)
    }
  }
  return { description, grants: [...grants, ...shell] }
}

/** A package's `version`, or `?` when it has none to show. */
const versionOf = (dir) => {
  try {
    const { version } = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"))
    return typeof version === "string" ? version : "?"
  } catch {
    return "?"
  }
}

/**
 * One skill a Nish package ships, as `findSkills` found it.
 *
 * @typedef {object} Skill
 * @property {string} pkg The package that ships it.
 * @property {string} version That package's version, or `?`.
 * @property {string} name The skill's name: its directory under `skills/`.
 * @property {string} dir The skill directory's absolute path.
 * @property {string} hash `sha256-<hex>` over the whole skill directory.
 * @property {string} description The frontmatter's `description`, unsanitised.
 * @property {string[]} grants What it grants, as `frontmatter` reads it, unsanitised; empty when it grants nothing.
 */

/**
 * Every skill the project's Nish packages ship. The first package in order to
 * claim a name wins it -- `nish` first, so no library can shadow its skills --
 * and a later claimant is reported as skipped, as is a directory whose name is
 * not a `NAME`.
 *
 * @param {string} project The project root, the directory holding `node_modules/`.
 * @returns {{ skills: Skill[], skipped: { name: string, reason: string }[] }}
 */
const findSkills = (project) => {
  const skills = []
  const skipped = []
  for (const pkg of nishPackages(path.join(path.resolve(project), "node_modules"))) {
    for (const name of skillsOf(pkg, skipped)) {
      if (!NAME.test(name)) {
        skipped.push({ name, reason: `in ${pkg.name} is not a valid skill name, so it is not linked` })
        continue
      }
      const owner = skills.find((s) => s.name === name)
      if (owner !== undefined) {
        skipped.push({ name, reason: `${owner.pkg} already provides it, so ${pkg.name}'s is not linked` })
        continue
      }
      const dir = path.join(pkg.dir, "skills", name)
      // The text is the bytes the hash covers, never a second read that could differ.
      const tree = readSkill(dir)
      const meta =
        tree.skillMd === null
          ? { description: "", grants: ["unreadable SKILL.md"] }
          : frontmatter(tree.skillMd.toString("utf8"))
      skills.push({
        pkg: pkg.name,
        version: versionOf(pkg.dir),
        name,
        dir,
        hash: tree.hash,
        description: meta.description,
        grants: [...meta.grants, ...tree.grants],
      })
    }
  }
  return { skills, skipped }
}

/** The record of accepted skills, beside the links it governs. */
const RECORD = ".nish-skills.json"

/** The record's format version; a record with any other is read as accepting nothing. */
const RECORD_VERSION = 1

/**
 * The accepted skills the record holds, by name. A missing, unreadable or
 * malformed record, or one of an unknown version, accepts nothing: consent
 * that cannot be read is consent not given, and asking again is the cost.
 *
 * @param {string} project The project root.
 * @returns {Map<string, { package: string, hash: string }>}
 */
const readRecord = (project) => {
  const accepted = new Map()
  const file = path.join(path.resolve(project), ".claude", "skills", RECORD)
  let parsed
  try {
    if (!fs.lstatSync(file).isFile()) {
      return accepted
    }
    parsed = JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return accepted
  }
  const skills = parsed?.version === RECORD_VERSION ? parsed.skills : null
  if (skills === null || typeof skills !== "object" || Array.isArray(skills)) {
    return accepted
  }
  for (const [name, entry] of Object.entries(skills)) {
    if (typeof entry?.package === "string" && typeof entry?.hash === "string") {
      accepted.set(name, { package: entry.package, hash: entry.hash })
    }
  }
  return accepted
}

/** Whether the record accepts this exact skill: the same package and the same hash. */
const isAccepted = (record, skill) => {
  const entry = record.get(skill.name)
  return entry !== undefined && entry.package === skill.pkg && entry.hash === skill.hash
}

/** Write `data` to `file` through a temporary name and a rename, so a reader never sees half of it. */
const writeAtomic = (file, data) => {
  const temp = `${file}.${process.pid}.tmp`
  // A leftover of a killed run with this pid goes first; `wx` then refuses
  // anything that appears in its place, a link above all, rather than write through it.
  fs.rmSync(temp, { force: true })
  try {
    fs.writeFileSync(temp, data, { flag: "wx" })
    fs.renameSync(temp, file)
  } catch (err) {
    fs.rmSync(temp, { force: true })
    throw err
  }
}

/**
 * Make `<project>/.claude/skills/` match what is accepted: link every accepted
 * skill, unlink every other linker-owned link (to a skill not accepted at its
 * current hash, or one no installed Nish package ships any more), and write
 * the record of what is accepted.
 *
 * A skill in `accepted` counts only if it is in `found` from the same package
 * at the same hash. The check is against `found`, not the disk: a caller that
 * asked a question about a skill passes the same `found` it asked about, and a
 * caller that wants the disk's current state passes a fresh `findSkills`.
 * Nothing is created under `.claude/` when nothing
 * is accepted. Running it twice changes nothing the second time. A write that
 * fails throws, after cleaning up its temporary entry.
 *
 * @param {string} project The project root, the directory holding `node_modules/`.
 * @param {{ accepted?: { name: string, pkg: string, hash: string }[], platform?: string, found?: ReturnType<typeof findSkills> }} [options]
 *   `accepted` is every skill to link, already-accepted ones included; `platform` chooses a junction (`win32`) or a relative symlink;
 *   `found` is a `findSkills` result to reuse.
 * @returns {{ linked: string[], kept: string[], unlinked: { name: string, reason: string }[], pruned: string[], skipped: { name: string, reason: string }[] }}
 *   What happened to each skill name: linked or relinked, already right, unlinked and why, removed because its target is gone, or left alone and why.
 */
export const linkSkills = (project, { accepted = [], platform = process.platform, found } = {}) => {
  const root = path.resolve(project)
  const { skills: all, skipped } = found ?? findSkills(root)
  const result = { linked: [], kept: [], unlinked: [], pruned: [], skipped: [...skipped] }
  const nodeModules = path.join(root, "node_modules")
  const yes = all.filter((s) =>
    accepted.some((a) => a.name === s.name && a.pkg === s.pkg && a.hash === s.hash)
  )
  const previous = readRecord(root)

  const claude = path.join(root, ".claude")
  const skills = path.join(claude, "skills")
  for (const dir of [claude, skills]) {
    const st = lstatOrNull(dir)
    if (st === null) {
      if (yes.length === 0) {
        return result
      }
      fs.mkdirSync(dir)
    } else if (st.isSymbolicLink() || !st.isDirectory()) {
      result.skipped.push({
        name: path.relative(root, dir),
        reason: `${st.isSymbolicLink() ? "is a link" : "is not a directory"}, so nothing is written`,
      })
      return result
    }
  }

  /** Whether the entry is one of the linker's own: a link that resolves inside `node_modules/`. */
  const owned = (entry, st) => st !== null && st.isSymbolicLink() && inside(targetOf(entry), nodeModules)

  for (const skill of all) {
    const { name } = skill
    const entry = path.join(skills, name)
    const st = lstatOrNull(entry)
    if (!yes.includes(skill)) {
      // Removing needs no consent, so a link the user never accepted, or
      // accepted at another hash, goes whatever made it.
      if (owned(entry, st)) {
        fs.unlinkSync(entry)
        const was = previous.get(name)
        result.unlinked.push({
          name,
          reason: was?.package === skill.pkg ? "changed since it was accepted" : "not accepted",
        })
      }
      continue
    }
    if (st !== null && !owned(entry, st)) {
      result.skipped.push({
        name,
        reason: `.claude/skills/${name} is the project's own, so it is left alone`,
      })
      continue
    }
    if (st !== null && targetOf(entry) === skill.dir) {
      result.kept.push(name)
      continue
    }
    const junction = platform === "win32"
    const target = junction ? skill.dir : path.relative(skills, skill.dir)
    const temp = path.join(skills, tempName(name))
    // win32's rename does not replace an existing directory entry, so the old
    // link is removed first, and put back if the rename then fails.
    const replaced = st !== null && junction ? fs.readlinkSync(entry) : null
    try {
      fs.symlinkSync(target, temp, junction ? "junction" : "dir")
      if (replaced !== null) {
        fs.unlinkSync(entry)
      }
      fs.renameSync(temp, entry)
    } catch (err) {
      fs.rmSync(temp, { force: true })
      if (replaced !== null && lstatOrNull(entry) === null) {
        fs.symlinkSync(replaced, entry, "junction")
      }
      throw err
    }
    result.linked.push(name)
  }

  const names = new Set(all.map((s) => s.name))
  // Every other owned link goes: a temporary one a killed run left behind, one
  // whose target is gone, and one to a skill that no longer qualifies (its
  // package dropped `exports.nish`, or the name is no longer valid), which
  // would otherwise keep serving whatever the package now ships.
  for (const name of fs.readdirSync(skills).sort()) {
    const entry = path.join(skills, name)
    if (names.has(name) || !owned(entry, lstatOrNull(entry))) {
      continue
    }
    const gone = !fs.existsSync(targetOf(entry))
    fs.unlinkSync(entry)
    if (TEMP.test(name)) {
      // Never a skill, whatever it points at: nothing to report.
    } else if (gone) {
      result.pruned.push(name)
    } else {
      result.unlinked.push({ name, reason: "no installed Nish package ships it" })
    }
  }

  const file = path.join(skills, RECORD)
  const record = `${JSON.stringify(
    {
      version: RECORD_VERSION,
      skills: Object.fromEntries(yes.map((s) => [s.name, { package: s.pkg, hash: s.hash }])),
    },
    null,
    2
  )}\n`
  let current = null
  try {
    current = fs.readFileSync(file, "utf8")
  } catch {
    // No record yet, or one that cannot be read: either way it is rewritten below.
  }
  if (current !== record && (current !== null || yes.length > 0)) {
    writeAtomic(file, record)
  }
  return result
}

/**
 * What `clean` replaces: every control (`Cc`), format character (`Cf`: the
 * bidirectional marks and overrides, the zero-width characters, the tag
 * characters), private-use, unassigned and surrogate code point, the line and
 * paragraph separators, and the characters that draw nothing yet are not in
 * those classes -- the combining grapheme joiner, the Hangul fillers, the
 * braille blank and the variation selectors.
 */
const INVISIBLE =
  /͏|[\p{Cc}\p{Cf}\p{Co}\p{Cn}\p{Cs}\p{Zl}\p{Zp}\u115f\u1160\u3164\uffa0\u2800]|[\ufe00-\ufe0f]|[\u{e0100}-\u{e01ef}]/gu

/**
 * A package-controlled string made safe for a terminal: every `INVISIBLE`
 * character becomes `?` (tab, newline and carriage return a space), and
 * anything past `max` code points is cut, so a
 * `SKILL.md` cannot move the cursor, recolour or redraw the prompt it is shown
 * in, or hide text inside what it shows.
 *
 * @param {unknown} text The string to show.
 * @param {number} [max] The most code points to keep.
 * @returns {string} The text, safe to print.
 */
export const clean = (text, max = 300) => {
  const safe = Array.from(
    String(text)
      .replace(/[\t\n\r]/g, " ")
      .replace(INVISIBLE, "?")
  )
  return safe.length > max ? `${safe.slice(0, max).join("")}...` : safe.join("")
}

/** What a skill grants, for the terminal. */
const grantOf = (skill) =>
  skill.grants.length === 0 ? "grants nothing" : `grants ${skill.grants.map((g) => clean(g, 80)).join("; ")}`

/**
 * The `nish-skills` command, without its argument parsing: find the project's
 * skills, decide which are accepted, link exactly those, and report.
 *
 * A skill the record accepts at its current package and hash is kept without
 * asking. Otherwise, with `ask` (an interactive run), each skill is shown and
 * asked about, and only `y` or `yes` accepts; with names or `yes` (a run that
 * cannot ask), a named skill is accepted whatever it grants, `yes` accepts
 * every skill that grants nothing, and a skill that grants anything is linked
 * only when named. Declines are not recorded, so an interactive run asks again.
 *
 * @param {string} project The project root.
 * @param {{ names?: string[], yes?: boolean, ask?: ((question: string, name: string) => Promise<string | null>) | null, write?: (text: string) => void, platform?: string }} [options]
 *   `ask` is given the question and the skill's name, and returns the answer line, or
 *   null at end of input; `write` receives the output.
 * @returns {Promise<{ unknown: string[], result: ReturnType<typeof linkSkills> | null }>}
 *   `unknown` holds the names no found skill has, and then nothing was written and `result` is null.
 */
export const review = async (
  project,
  { names = [], yes = false, ask = null, write = (t) => process.stdout.write(t), platform } = {}
) => {
  const say = (line) => write(`${clean(line, 1000)}\n`)
  const found = findSkills(project)
  const unknown = names.filter((n) => !found.skills.some((s) => s.name === n))
  if (unknown.length > 0) {
    return { unknown, result: null }
  }
  const record = readRecord(project)
  const accepted = []
  const waiting = []
  for (const skill of found.skills) {
    if (isAccepted(record, skill) || names.includes(skill.name)) {
      accepted.push(skill)
    } else if (ask !== null) {
      say(`${clean(skill.name, 100)} from ${clean(skill.pkg, 100)}@${clean(skill.version, 40)}`)
      say(`  ${clean(skill.description) || "(no description)"}`)
      say(`  ${grantOf(skill)}`)
      const answer = await ask(`Link ${clean(skill.name, 100)}? [y/N] `, skill.name)
      if (answer !== null && /^y(es)?$/i.test(answer.trim())) {
        accepted.push(skill)
      }
    } else if (yes && skill.grants.length === 0) {
      accepted.push(skill)
    } else {
      waiting.push(skill)
    }
  }
  const result = linkSkills(project, { accepted, platform, found })
  for (const skill of waiting) {
    const name = clean(skill.name, 100)
    say(
      `found   ${name} from ${clean(skill.pkg, 100)}@${clean(skill.version, 40)}: ${clean(skill.description) || "(no description)"}`
    )
    say(
      skill.grants.length === 0
        ? `        not linked; accept it with 'npx nish-skills ${name}' or 'npx nish-skills --yes'`
        : `        not linked: it ${grantOf(skill)}, so only 'npx nish-skills ${name}' accepts it`
    )
  }
  for (const name of result.linked) {
    say(`linked   ${name}`)
  }
  for (const { name, reason } of result.unlinked) {
    say(`unlinked ${name}: ${reason}`)
  }
  for (const name of result.pruned) {
    say(`pruned   ${name}`)
  }
  for (const { name, reason } of result.skipped) {
    say(`skipped  ${name}: ${reason}`)
  }
  say(
    `nish-skills: ${result.linked.length} linked, ${result.kept.length} unchanged, ${result.unlinked.length} unlinked, ${result.pruned.length} pruned, ${waiting.length} not accepted, ${result.skipped.length} skipped in ${project}`
  )
  return { unknown: [], result }
}
