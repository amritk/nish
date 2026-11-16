/**
 * Link the agent skills of a project's installed Nish packages into its
 * `.claude/skills/`, where Claude Code loads project skills from.
 *
 * A package ships a skill as `skills/<name>/SKILL.md` at its root, and the
 * skill's id is `<name>`. The packages that qualify are `nish` itself and every
 * top-level `node_modules/<pkg>` or `node_modules/@scope/<pkg>` whose
 * `package.json` `exports` uses a `nish` condition. A plain npm package with a
 * `skills/` directory is not a Nish package and is left alone.
 *
 * **Links, not copies**: `.claude/skills/<name>` is a relative symlink to
 * `../../node_modules/<pkg>/skills/<name>`, so it follows an upgrade and
 * survives moving the project. On win32 it is a junction to the absolute path,
 * because a directory symlink there needs elevation.
 *
 * **The linker owns only its own links.** An entry under `.claude/skills/` is
 * the linker's only if it is a link whose target resolves inside
 * `<project>/node_modules/`. Anything else -- a real directory, a file, a link
 * pointing elsewhere -- belongs to the user and is never replaced or removed.
 * Every check is an `lstat`, and nothing follows a link before that test.
 *
 * Plain Node with `node:` built-ins only: it ships in the package, which keeps
 * no runtime dependency, and `scripts/postinstall.mjs` runs it.
 */
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

/**
 * Link every installed Nish package's skills into `<project>/.claude/skills/`.
 *
 * Running it twice changes nothing the second time. A write that fails throws,
 * after cleaning up its temporary entry.
 *
 * @param {string} project The project root, the directory holding `node_modules/`.
 * @param {{ platform?: string }} [options] `platform` chooses a junction (`win32`) or a relative symlink.
 * @returns {{ linked: string[], kept: string[], pruned: string[], skipped: { name: string, reason: string }[] }}
 *   What happened to each skill name: linked or relinked, already right, removed because its target is gone, or left alone and why.
 */
export const linkSkills = (project, { platform = process.platform } = {}) => {
  const result = { linked: [], kept: [], pruned: [], skipped: [] }
  const root = path.resolve(project)
  const nodeModules = path.join(root, "node_modules")

  const claims = new Map()
  for (const pkg of nishPackages(nodeModules)) {
    for (const name of skillsOf(pkg.dir)) {
      const owner = claims.get(name)
      if (owner === undefined) {
        claims.set(name, { pkg: pkg.name, dir: path.join(pkg.dir, "skills", name) })
      } else {
        result.skipped.push({
          name,
          reason: `${owner.pkg} already provides it, so ${pkg.name}'s is not linked`,
        })
      }
    }
  }

  const claude = path.join(root, ".claude")
  const skills = path.join(claude, "skills")
  for (const dir of [claude, skills]) {
    const st = lstatOrNull(dir)
    if (st === null) {
      if (claims.size === 0) {
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

  for (const [name, claim] of claims) {
    const entry = path.join(skills, name)
    const st = lstatOrNull(entry)
    if (st !== null && !owned(entry, st)) {
      result.skipped.push({
        name,
        reason: `.claude/skills/${name} is the project's own, so it is left alone`,
      })
      continue
    }
    if (st !== null && targetOf(entry) === claim.dir) {
      result.kept.push(name)
      continue
    }
    const junction = platform === "win32"
    const target = junction ? claim.dir : path.relative(skills, claim.dir)
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

  for (const name of fs.readdirSync(skills).sort()) {
    const entry = path.join(skills, name)
    if (claims.has(name) || !owned(entry, lstatOrNull(entry))) {
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
  return result
}
