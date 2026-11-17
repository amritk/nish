// Writes each page route's `head` in scalar.config.json: the page's <title>
// ("Installation · Nish"), its og:title and twitter:title, and its canonical
// link. Scalar has no title template and its site-wide `head.meta` is on every
// page, so a per-page value can only come from the route. The values follow
// from the routes themselves, so they are generated rather than hand-written:
//
//   node scripts/route-head.mjs           rewrite scalar.config.json
//   node scripts/route-head.mjs --check   fail if a route's head is missing or stale
//
// scripts/gen-reference.mjs applies `withHeads` to the routes it writes, so its
// own `--check` (run by CI) catches a stale head anywhere in the file.
//
// A page's name is its route title; an "Overview" takes its group's title, and
// a name two pages share takes " · <group title>". The home page keeps its
// hand-written head.title, which is also its og:title and twitter:title. Only
// page routes' own lines are rewritten; every other line is kept byte for byte.
import fs from "node:fs"
import path from "node:path"

export const site = "https://nishlang.com"
const siteName = "Nish"
const configFile = "scalar.config.json"
export const width = 110

/** One line of JSON with a space inside each brace and after each comma. */
export const oneLine = (v) => {
  if (Array.isArray(v)) {
    return `[${v.map(oneLine).join(", ")}]`
  }
  if (v === null || typeof v !== "object") {
    return JSON.stringify(v)
  }
  const kv = Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${oneLine(x)}`)
  return kv.length > 0 ? `{ ${kv.join(", ")} }` : "{}"
}

/** JSON in the file's layout: an object or array on one line when it fits in `width`. */
export const printJson = (value, indent, prefix, suffix) => {
  const one = oneLine(value)
  if (
    typeof value !== "object" ||
    value === null ||
    indent + prefix.length + one.length + suffix.length <= width
  ) {
    return `${" ".repeat(indent)}${prefix}${one}${suffix}`
  }
  const pad = " ".repeat(indent)
  const entries = Array.isArray(value) ? value.map((v) => ["", v]) : Object.entries(value)
  const [open, close] = Array.isArray(value) ? ["[", "]"] : ["{", "}"]
  const lines = entries.map(([k, v], i) =>
    printJson(
      v,
      indent + 2,
      Array.isArray(value) ? "" : `${JSON.stringify(k)}: `,
      i < entries.length - 1 ? "," : ""
    )
  )
  return `${pad}${prefix}${open}\n${lines.join("\n")}\n${pad}${close}${suffix}`
}

const indentOf = (line) => /^ */.exec(line)[0].length

/** Every page route under `routes`, with its URL path and its groups, nearest first. */
const pagesOf = (routes, base, groups, out) => {
  for (const [key, route] of Object.entries(routes)) {
    const url = path.posix.normalize(`${base}/${key}`)
    if (route.type === "page") {
      out.push({ route, url, groups })
    } else if (route.children) {
      // The root group is the site itself, which every title already names.
      pagesOf(route.children, url, base === "" ? groups : [route, ...groups], out)
    }
  }
  return out
}

/**
 * The head each page route should carry, keyed by the route object. Pages that
 * share a name are told apart by the nearest group level whose titles differ.
 */
const headsFor = (config) => {
  const pages = pagesOf(config.navigation.routes, "", [], [])
  const base = (p) =>
    p.route.title === "Overview" && p.groups.length > 0 ? p.groups[0].title : p.route.title
  const alike = new Map()
  for (const p of pages) {
    alike.set(base(p), [...(alike.get(base(p)) ?? []), p])
  }
  for (const [name, same] of alike) {
    if (same.length === 1) {
      same[0].name = name
      continue
    }
    const depth = Math.max(...same.map((p) => p.groups.length))
    const level = [...Array(depth).keys()].find(
      (d) => new Set(same.map((p) => p.groups[d]?.title ?? "")).size === same.length
    )
    if (level === undefined) {
      throw new Error(
        `${configFile}: ${same.map((p) => p.url).join(" and ")} cannot be told apart by a group title`
      )
    }
    for (const p of same) {
      const group = p.groups[level]?.title
      p.name = group ? `${name} · ${group}` : name
    }
  }
  const taken = new Map()
  for (const p of pages) {
    if (taken.has(p.name)) {
      throw new Error(
        `${configFile}: ${taken.get(p.name)} and ${p.url} would both be titled ${JSON.stringify(p.name)}`
      )
    }
    taken.set(p.name, p.url)
  }
  const heads = new Map()
  for (const p of pages) {
    const home = p.url === "/"
    const title = home ? p.route.head?.title : `${p.name} · ${siteName}`
    if (!title) {
      throw new Error(`${configFile}: the home route needs a hand-written head.title`)
    }
    const social = home ? title : p.name
    heads.set(p.route, {
      title,
      meta: [
        { property: "og:title", content: social },
        { name: "twitter:title", content: social },
      ],
      links: [{ rel: "canonical", href: home ? `${site}/` : `${site}${p.url}` }],
    })
  }
  return heads
}

/** The line that closes the value opened on `lines[open]`. */
const closeOf = (lines, open) => {
  if (!/[{[]$/.test(lines[open])) {
    return open
  }
  const indent = indentOf(lines[open])
  const close = lines.findIndex((l, i) => i > open && indentOf(l) === indent && /^\s*[}\]],?$/.test(l))
  if (close < 0) {
    throw new Error(`${configFile}: line ${open + 1} never closes`)
  }
  return close
}

/** The members of the object whose lines are `(open, close)`: [key, first line, last line]. */
const membersOf = (lines, open, close) => {
  const out = []
  for (let i = open + 1; i < close; ) {
    const key = /^\s*"([^"]+)": /.exec(lines[i])?.[1]
    if (key === undefined) {
      throw new Error(`${configFile}: line ${i + 1} is not an object member`)
    }
    const end = closeOf(lines, i)
    out.push([key, i, end])
    i = end + 1
  }
  return out
}

/** `route` with `head` in place of its old one, or last when it had none. */
const withHead = (route, head) => {
  const out = { ...route, head }
  return "head" in route ? Object.fromEntries(Object.keys(route).map((k) => [k, out[k]])) : out
}

/**
 * scalar.config.json's text with every page route's head regenerated. A page,
 * or a group written on one line, is reprinted in the file's layout; every
 * other line is kept.
 */
export const withHeads = (text) => {
  const config = JSON.parse(text)
  const heads = headsFor(config)
  const lines = text.split("\n")
  const edits = []
  const routesLine = lines.findIndex((l) => /^\s*"routes": \{$/.test(l))
  if (routesLine < 0) {
    throw new Error(`${configFile}: no "routes" object written over several lines`)
  }
  const visit = (routes, open, close) => {
    for (const [key, from, to] of membersOf(lines, open, close)) {
      const route = routes[key]
      const comma = lines[to].endsWith(",") ? "," : ""
      const indent = indentOf(lines[from])
      if (route.type === "page") {
        edits.push([
          from,
          to,
          printJson(withHead(route, heads.get(route)), indent, `${JSON.stringify(key)}: `, comma),
        ])
      } else if (route.children && from === to) {
        const headed = (r) => {
          if (r.type === "page") {
            return withHead(r, heads.get(r))
          }
          if (!r.children) {
            return r
          }
          return {
            ...r,
            children: Object.fromEntries(Object.entries(r.children).map(([k, c]) => [k, headed(c)])),
          }
        }
        edits.push([from, to, printJson(headed(route), indent, `${JSON.stringify(key)}: `, comma)])
      } else if (route.children) {
        const child = membersOf(lines, from, to).find(([k]) => k === "children")
        if (!child) {
          throw new Error(`${configFile}: the group ${key} on line ${from + 1} has no children`)
        }
        visit(route.children, child[1], child[2])
      }
    }
  }
  visit(config.navigation.routes, routesLine, closeOf(lines, routesLine))
  for (const [from, to, replacement] of edits.sort((a, b) => b[0] - a[0])) {
    lines.splice(from, to - from + 1, replacement)
  }
  const out = lines.join("\n")
  // What was spliced as text must parse to what was meant.
  for (const [route, head] of heads) {
    route.head = head
  }
  // Assigning keeps an existing head's place and puts a new one last, as withHead does.
  if (JSON.stringify(JSON.parse(out)) !== JSON.stringify(config)) {
    throw new Error(`${configFile}: the regenerated heads do not parse back to the routes meant`)
  }
  return out
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = path.join(path.resolve(import.meta.dirname, ".."), configFile)
  const before = fs.readFileSync(file, "utf8")
  const after = withHeads(before)
  if (process.argv.includes("--check")) {
    if (after !== before) {
      console.error(
        `route-head: ${configFile} has a missing or stale route head; run \`node scripts/route-head.mjs\``
      )
      process.exit(1)
    }
    console.log(`route-head: every page route's head is up to date`)
  } else {
    fs.writeFileSync(file, after)
    console.log(`route-head: ${after === before ? "no change" : `rewrote ${configFile}`}`)
  }
}
