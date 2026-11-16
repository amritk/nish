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
 * **Nothing is linked without consent.** A skill is instructions for Claude
 * plus an optional `allowed-tools` grant, and any package in the tree can ship
 * one, so the unit of consent is one package, one skill name and one hash of
 * the whole skill directory. The accepted triples live in
 * `.claude/skills/.nish-skills.json`; a new package, a rival claiming the same
 * name, or a changed hash is not accepted until the user says so again.
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

/** The names of the directories in `dir`, or none when it cannot be read. */
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

/** The skills a package ships: each `skills/<name>/` that holds a `SKILL.md`. */
const skillsOf = (dir) =>
  subdirectories(path.join(dir, "skills"))
    .filter((name) => !name.startsWith("."))
    .filter((name) => {
      try {
        return fs.statSync(path.join(dir, "skills", name, "SKILL.md")).isFile()
      } catch {
        return false
      }
    })
    .sort()

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


/** Code-unit order, not the locale's, so every machine sorts the same way. */
const byCodeUnit = (a, b) => Number(a > b) - Number(a < b)

/**
 * The sha256 of a skill directory, as `sha256-<hex>`: every regular file's
 * path relative to `dir` and its bytes, in code-unit order of the path. An
 * inner link contributes its target string and is never followed, and any
 * other entry its path and kind, so nothing in the directory can change
 * without the hash moving. Each part is length-prefixed, so no two trees
 * frame to the same bytes.
 */
const hashSkill = (dir) => {
  const entries = []
  const walk = (at, rel) => {
    for (const e of fs.readdirSync(at, { withFileTypes: true })) {
      const file = path.join(at, e.name)
      const name = rel === "" ? e.name : `${rel}/${e.name}`
      if (e.isDirectory()) {
        walk(file, name)
      } else if (e.isFile()) {
        entries.push({ name, kind: "file", data: fs.readFileSync(file) })
      } else if (e.isSymbolicLink()) {
        entries.push({ name, kind: "link", data: Buffer.from(fs.readlinkSync(file)) })
      } else {
        entries.push({ name, kind: "other", data: Buffer.alloc(0) })
      }
    }
  }
  walk(dir, "")
  const hash = crypto.createHash("sha256")
  for (const { name, kind, data } of entries.sort((x, y) => byCodeUnit(x.name, y.name))) {
    const head = Buffer.from(name)
    hash.update(`${kind} ${head.length} `).update(head).update(` ${data.length} `).update(data)
  }
  return `sha256-${hash.digest("hex")}`
}

/** What `allowedTools` holds when the frontmatter could not be read: it counts as a grant. */
const UNREADABLE = "<unreadable frontmatter>"

/** A YAML scalar with its quotes taken off. */
const unquote = (value) =>
  /^"[^"]*"$|^'[^']*'$/.test(value) ? value.slice(1, -1) : value

/**
 * The description and `allowed-tools` of a `SKILL.md`, read from its leading
 * `---` block. It reads only top-level `key: value` scalars, inline `[a, b]`
 * lists and `- item` block lists -- no YAML dependency -- and it fails closed:
 * a block it cannot read, or an `allowed-tools` key in any form it does not
 * know, even an empty one, makes `allowedTools` non-null. Only a block that
 * parsed and has no such key yields null.
 *
 * @param {string} text The whole `SKILL.md`.
 * @returns {{ description: string, allowedTools: string[] | null }}
 */
const frontmatter = (text) => {
  const unreadable = { description: "", allowedTools: [UNREADABLE] }
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/)
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
    // hide an allowed-tools, so the whole block counts as unreadable.
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
  // Any spelling a reader might honour counts, so a near-miss key cannot slip a grant past.
  const grants = keys.filter((k) => /^allowed[-_]?tools$/i.test(k.key))
  if (grants.length === 0) {
    return { description, allowedTools: null }
  }
  const tools = []
  for (const { value, under } of grants) {
    if (value === "" && under.every((item) => item.startsWith("- "))) {
      tools.push(...under.map((item) => unquote(item.slice(2).trim())))
    } else if (under.length > 0) {
      tools.push(UNREADABLE)
    } else if (value.startsWith("[")) {
      if (!value.endsWith("]")) {
        tools.push(UNREADABLE)
      } else {
        tools.push(...value.slice(1, -1).split(",").map((t) => unquote(t.trim())))
      }
    } else {
      tools.push(...unquote(value).split(/[,\s]+/))
    }
  }
  return { description, allowedTools: tools.filter((t) => t !== "") }
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
 * @property {string[] | null} allowedTools Null when it grants no tools; otherwise what it grants, unsanitised.
 */

/**
 * Every skill the project's Nish packages ship. The first package in order to
 * claim a name wins it -- `nish` first, so no library can shadow its skills --
 * and a later claimant is reported as skipped.
 *
 * @param {string} project The project root, the directory holding `node_modules/`.
 * @returns {{ skills: Skill[], skipped: { name: string, reason: string }[] }}
 */
const findSkills = (project) => {
  const skills = []
  const skipped = []
  for (const pkg of nishPackages(path.join(path.resolve(project), "node_modules"))) {
    for (const name of skillsOf(pkg.dir)) {
      const owner = skills.find((s) => s.name === name)
      if (owner !== undefined) {
        skipped.push({ name, reason: `${owner.pkg} already provides it, so ${pkg.name}'s is not linked` })
        continue
      }
      const dir = path.join(pkg.dir, "skills", name)
      let text = null
      try {
        text = fs.readFileSync(path.join(dir, "SKILL.md"), "utf8")
      } catch {
        // Unreadable: fails closed below, like a block that does not parse.
      }
      const meta = text === null ? { description: "", allowedTools: [UNREADABLE] } : frontmatter(text)
      skills.push({ pkg: pkg.name, version: versionOf(pkg.dir), name, dir, hash: hashSkill(dir), ...meta })
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
  try {
    fs.writeFileSync(temp, data)
    fs.renameSync(temp, file)
  } catch (err) {
    fs.rmSync(temp, { force: true })
    throw err
  }
}

/**
 * Make `<project>/.claude/skills/` match what is accepted: link every accepted
 * skill, unlink every linker-owned link to a found skill that is not accepted
 * at its current hash, prune owned links whose target is gone, and write the
 * record of what is accepted.
 *
 * A skill in `accepted` counts only if `findSkills` still finds it from the
 * same package at the same hash, so a skill that changed between the question
 * and the link is not linked. Nothing is created under `.claude/` when nothing
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
  const yes = all.filter((s) => accepted.some((a) => a.name === s.name && a.pkg === s.pkg && a.hash === s.hash))
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
  for (const name of fs.readdirSync(skills).sort()) {
    const entry = path.join(skills, name)
    if (names.has(name) || !owned(entry, lstatOrNull(entry))) {
      continue
    }
    if (TEMP.test(name)) {
      // A temporary link a killed run left behind: never a skill, whatever it points at.
      fs.unlinkSync(entry)
    } else if (!fs.existsSync(targetOf(entry))) {
      fs.unlinkSync(entry)
      result.pruned.push(name)
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
 * A package-controlled string made safe for a terminal: every C0 and C1
 * control, DEL, and the bidirectional overrides become `?` (tab and newline a
 * space), and anything past `max` code points is cut, so a `SKILL.md` cannot
 * move the cursor, recolour or redraw the prompt it is shown in.
 */
const clean = (text, max = 300) => {
  const safe = Array.from(
    String(text).replace(/[\t\n\r]/g, " ").replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2028\u2029\u2066-\u2069]/g, "?")
  )
  return safe.length > max ? `${safe.slice(0, max).join("")}...` : safe.join("")
}

/** What a skill grants, for the terminal. */
const grantOf = (skill) =>
  skill.allowedTools === null
    ? "grants no tools"
    : `allowed-tools: ${skill.allowedTools.length === 0 ? "(present, empty)" : skill.allowedTools.map((t) => clean(t, 80)).join(", ")}`

/**
 * The `nish-skills` command, without its argument parsing: find the project's
 * skills, decide which are accepted, link exactly those, and report.
 *
 * A skill the record accepts at its current package and hash is kept without
 * asking. Otherwise, with `ask` (an interactive run), each skill is shown and
 * asked about, and only `y` or `yes` accepts; with names or `yes` (a run that
 * cannot ask), a named skill is accepted whatever it grants, `yes` accepts
 * every skill that grants no tools, and a skill that grants tools is linked
 * only when named. Declines are not recorded, so an interactive run asks again.
 *
 * @param {string} project The project root.
 * @param {{ names?: string[], yes?: boolean, ask?: ((question: string) => Promise<string | null>) | null, write?: (text: string) => void, platform?: string }} [options]
 *   `ask` returns the answer line, or null at end of input; `write` receives the output.
 * @returns {Promise<{ unknown: string[], result: ReturnType<typeof linkSkills> | null }>}
 *   `unknown` holds the names no found skill has, and then nothing was written and `result` is null.
 */
export const review = async (project, { names = [], yes = false, ask = null, write = (t) => process.stdout.write(t), platform } = {}) => {
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
      const answer = await ask(`Link ${clean(skill.name, 100)}? [y/N] `)
      if (answer !== null && /^y(es)?$/i.test(answer.trim())) {
        accepted.push(skill)
      }
    } else if (yes && skill.allowedTools === null) {
      accepted.push(skill)
    } else {
      waiting.push(skill)
    }
  }
  const result = linkSkills(project, { accepted, platform, found })
  for (const skill of waiting) {
    const name = clean(skill.name, 100)
    say(`found   ${name} from ${clean(skill.pkg, 100)}@${clean(skill.version, 40)}: ${clean(skill.description) || "(no description)"}`)
    say(
      skill.allowedTools === null
        ? `        not linked; accept it with 'npx nish-skills ${name}' or 'npx nish-skills --yes'`
        : `        not linked: it grants tools (${grantOf(skill)}), so only 'npx nish-skills ${name}' accepts it`
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
