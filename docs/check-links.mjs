#!/usr/bin/env node
// Check every relative Markdown link (and heading anchor) in the repository's docs.
//
//   node docs/check-links.mjs            exit 1 and list every broken link
//
// Scans README.md, CHANGELOG.md, std/README.md, and docs/**/*.md. For each `[text](target)` or
// `[ref]: target` outside a fenced code block: http(s)/mailto targets are
// skipped; a relative path must exist; a `#fragment` must match a heading of
// the target file (GitHub slug rules: lower-case, punctuation deleted, each
// remaining space to one `-`, duplicates suffixed `-1`, `-2`, ... -- see
// headingSlugs below, which is written to agree with github-slugger rather than
// to approximate it). A bare `#fragment` refers to the current file. Absolute
// paths and directories are allowed as targets.
//
// A link to this repository on github.com at `main`
// (`https://github.com/amritk/nish/blob/main/<path>`, or `tree/main/` for a
// directory) is checked as the relative link to `<path>` would be: the file
// must exist here and its `#fragment` must name a heading.
//
// The pages scalar.config.json routes are published as a site, which serves
// those pages and hands any other file a page links to back as a download. So
// a routed page links another routed page relatively (the site resolves it to
// that page) and any other file of the repository by its GitHub URL, and a
// relative link from a routed page to a file that is not one is reported.
//
// It also reads scalar.config.json, the navigation of the user guide's site:
// every route's `filepath` must be an existing .md file, and every page under
// docs/guide/ or docs/roadmap/ must be reached by some route, so a page cannot
// be written and then never published; and every docs/wp*.md note must have
// its roadmap page, docs/roadmap/<the note's name>.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const listMarkdown = (dir) => {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) {
        continue
      }
      out.push(...listMarkdown(full))
    } else if (entry.name.endsWith(".md")) {
      out.push(full)
    }
  }
  return out
}

const files = ["README.md", "CHANGELOG.md", "std/README.md"]
  .map((f) => path.join(root, f))
  .filter((f) => fs.existsSync(f))
  .concat(listMarkdown(path.join(root, "docs")))

/** Lines of a file with fenced code blocks blanked out (links inside them are not links). */
const proseLines = (text) => {
  let inFence = false
  return text.split("\n").map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      return ""
    }
    return inFence ? "" : line
  })
}

// GitHub slugs a heading with `github-slugger`, which is three steps and no
// more: lower-case it, DELETE every character that is not a letter, a number, a
// mark, `_` or `-`, then turn each remaining space into one `-`. The deletion
// and the substitution are separate passes, so a character that vanishes
// between two spaces leaves both spaces behind and the slug keeps a hyphen for
// each: `G5 — Distribution` is `g5--distribution`, with two.
//
// This checker used to collapse whitespace runs instead (`.replace(/\s+/g,
// "-")`), which is the same answer for every heading whose words are separated
// by one space and a different one for every heading containing an em dash, a
// slash or any other deleted character with a space on both sides. Every anchor
// of that shape passed here and landed nowhere on github.com -- a link gate
// that is green while the links are broken, which is worth more attention than
// the five links it was hiding. It also dropped `_`, which GitHub keeps.
//
// The character class below is `[^\p{L}\p{N}\p{M}\p{Pc}\- ]`, which agrees with
// github-slugger 2.0.0 on all 886 headings in this repository. It is not
// character-for-character that package's 8 KB generated table: the table is
// generated against the Unicode version of the day and deletes code points
// unassigned back then that are letters now, which is a difference in scripts
// no heading here is written in.
/** GitHub-style heading slugs for a Markdown file, in order. */
const headingSlugs = (text) => {
  const seen = new Map()
  const slugs = new Set()
  for (const line of proseLines(text)) {
    const m = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line)
    if (!m) {
      continue
    }
    let slug = m[1]
      .replace(/`([^`]*)`/g, "$1") // inline code keeps its text
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links keep their text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}\p{Pc}\- ]/gu, "") // deleted, not replaced
      .replace(/ /g, "-") // one hyphen per space, runs included
    const n = seen.get(slug) ?? 0
    seen.set(slug, n + 1)
    if (n > 0) {
      slug = `${slug}-${n}`
    }
    slugs.add(slug)
  }
  return slugs
}

// The docs site (Scalar) slugs a heading its own way, which is not GitHub's:
// it deletes `_` and every character but a letter, a number, a mark, `-`, `.`
// and a space, turns each space into `-`, then collapses each run of `-` to
// one and trims `-` from both ends, so `` `--fix` `` is `fix` there and
// `--fix` on GitHub, and "4. Exit codes" keeps its dot. Only headings of levels
// 1 to 4 get an ID at all. This agrees with the site's preview on all 1,230
// such headings of its 90 pages. A link that has to land on both sites names a
// heading whose two slugs agree, or an `<a id="...">` written above it.
/** The docs site's heading IDs for a Markdown file. */
const scalarHeadingSlugs = (text) => {
  const seen = new Map()
  const slugs = new Set()
  for (const line of proseLines(text)) {
    const m = /^#{1,4}\s+(.*?)\s*#*\s*$/.exec(line)
    if (!m) {
      continue
    }
    let slug = m[1]
      .replace(/`([^`]*)`/g, "$1")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}\-. ]/gu, "")
      .replace(/ /g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
    const n = seen.get(slug) ?? 0
    seen.set(slug, n + 1)
    if (n > 0) {
      slug = `${slug}-${n}`
    }
    slugs.add(slug)
  }
  return slugs
}

/** The IDs a file's own HTML gives (`<a id="...">`), which hold on both sites. */
const htmlIds = (text) =>
  new Set(proseLines(text).flatMap((line) => [...line.matchAll(/<a\s+id="([^"]+)"/g)].map((m) => m[1])))

const slugCache = new Map()
const slugsOf = (file) => {
  if (!slugCache.has(file)) {
    const text = fs.readFileSync(file, "utf8")
    const ids = htmlIds(text)
    slugCache.set(file, {
      github: new Set([...headingSlugs(text), ...ids]),
      site: new Set([...scalarHeadingSlugs(text), ...ids]),
    })
  }
  return slugCache.get(file)
}

// Inline links `[text](target)` (target up to the first unbalanced `)`) and reference definitions `[ref]: target`.
const INLINE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const REFDEF = /^\s*\[[^\]]+\]:\s*(\S+)/

// This repository's files on github.com, at main.
const REPO_URL = /^https:\/\/github\.com\/amritk\/nish\/(?:blob|tree)\/main\/([^#?]*)(#.*)?$/

// The site's pages, by absolute path, from scalar.config.json's routes.
const scalarConfig = path.join(root, "scalar.config.json")
const routes = JSON.parse(fs.readFileSync(scalarConfig, "utf8")).navigation.routes
const routedPages = new Set()
const collectPages = (entries) => {
  for (const entry of Object.values(entries)) {
    if (entry.filepath !== undefined) {
      routedPages.add(path.join(root, entry.filepath))
    }
    if (entry.children !== undefined) {
      collectPages(entry.children)
    }
  }
}
collectPages(routes)

const problems = []
let checked = 0
for (const file of files) {
  const text = fs.readFileSync(file, "utf8")
  proseLines(text).forEach((line, index) => {
    const targets = []
    for (const m of line.matchAll(INLINE)) {
      targets.push(m[1])
    }
    const ref = REFDEF.exec(line)
    if (ref) {
      targets.push(ref[1])
    }
    for (let target of targets) {
      target = target.replace(/^<|>$/g, "")
      const repo = REPO_URL.exec(target)
      if (repo === null && /^(https?:|mailto:|tel:)/i.test(target)) {
        continue
      }
      checked++
      const [pathPart, fragment] = repo === null ? target.split("#") : [repo[1], repo[2]?.slice(1)]
      const where = `${path.relative(root, file)}:${index + 1}`
      let resolved = file
      if (pathPart) {
        resolved =
          repo === null
            ? path.resolve(path.dirname(file), decodeURIComponent(pathPart))
            : path.join(root, decodeURIComponent(pathPart))
        if (repo === null && routedPages.has(file) && !routedPages.has(resolved) && fs.existsSync(resolved)) {
          const rel = path.relative(root, resolved).split(path.sep).join("/")
          const kind = fs.statSync(resolved).isDirectory() ? "tree" : "blob"
          problems.push(
            `${where}: \`${target}\` is not a page of the docs site (scalar.config.json), which would serve it as a download; link https://github.com/amritk/nish/${kind}/main/${rel}${fragment !== undefined ? `#${fragment}` : ""} instead, or give it a route`
          )
          continue
        }
        if (!fs.existsSync(resolved)) {
          problems.push(
            `${where}: broken link \`${target}\` (no such file: ${path.relative(root, resolved)})`
          )
          continue
        }
      }
      if (fragment !== undefined && fragment !== "") {
        if (!resolved.endsWith(".md") || fs.statSync(resolved).isDirectory()) {
          continue
        }
        if (!slugsOf(resolved).github.has(fragment.toLowerCase())) {
          problems.push(
            `${where}: broken anchor \`${target}\` (no heading #${fragment} in ${path.relative(root, resolved)})`
          )
        } else if (
          repo === null &&
          routedPages.has(file) &&
          routedPages.has(resolved) &&
          !slugsOf(resolved).site.has(fragment.toLowerCase())
        ) {
          problems.push(
            `${where}: anchor \`${target}\` lands on GitHub but not on the docs site, which spells that heading's ID differently (or gives a heading below level 4 none); write <a id="${fragment}"></a> on its own line above the heading in ${path.relative(root, resolved)}`
          )
        }
      }
    }
  })
}

// The guide's navigation. A route to anything but an existing .md file (a typo,
// a directory) is a dead page on the site, and a guide page no route names is
// one nobody can reach from it.
const walkRoutes = (entries, prefix) => {
  for (const [route, entry] of Object.entries(entries)) {
    // A page must name its file; a group or a link legitimately has none.
    if (entry.type === "page" || entry.filepath !== undefined) {
      const file = path.join(root, entry.filepath ?? "")
      if (!(file.endsWith(".md") && fs.existsSync(file) && fs.statSync(file).isFile())) {
        problems.push(
          `scalar.config.json: route \`${prefix}${route}\` names no Markdown page: ${entry.filepath ?? "(no filepath)"}`
        )
      }
    }
    if (entry.children !== undefined) {
      walkRoutes(entry.children, prefix + route)
    }
  }
}
walkRoutes(routes, "")
const guideDir = path.join(root, "docs", "guide") + path.sep
for (const page of files.filter((f) => f.startsWith(guideDir))) {
  if (!routedPages.has(page)) {
    problems.push(`${path.relative(root, page)}: no route in scalar.config.json reaches this guide page`)
  }
}
// The roadmap keeps every work package's state on a page of its own, named as
// its note is, so a new note without a page, or a page left unrouted, would be
// a package the published roadmap silently drops.
const roadmapDir = path.join(root, "docs", "roadmap")
for (const page of files.filter((f) => f.startsWith(roadmapDir + path.sep))) {
  if (!routedPages.has(page)) {
    problems.push(`${path.relative(root, page)}: no route in scalar.config.json reaches this roadmap page`)
  }
}
for (const note of fs.readdirSync(path.join(root, "docs")).filter((f) => /^wp\d+-.*\.md$/.test(f))) {
  if (!fs.existsSync(path.join(roadmapDir, note))) {
    problems.push(`docs/${note}: no roadmap page; add docs/roadmap/${note} and its route`)
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"))
  console.error(
    `\n${problems.length} broken link(s) or route(s) in ${files.length} files (${checked} links checked)`
  )
  process.exit(1)
}
console.log(`ok: ${checked} links in ${files.length} Markdown files`)
