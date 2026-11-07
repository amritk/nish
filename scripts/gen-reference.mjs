#!/usr/bin/env node
// Generate the library reference, docs/reference/**, from the sources.
//
//   node scripts/gen-reference.mjs           rewrite docs/reference/ and its routes
//   node scripts/gen-reference.mjs --check   exit 1 naming each stale, missing or extra
//                                            page and a stale route; write nothing
//
// TypeDoc reads every std/**/*.ts module and runtime/nish.d.ts in-process, with
// scripts/typedoc-nish-widths.mjs keeping types as the source spells them, and
// one page is rendered per module: docs/reference/<path>.md for `nish/<path>`
// (std/<path>.ts), docs/reference/nish-<name>.md for the builtin module
// `nish:<name>`, and docs/reference/builtins.md for the globals nish.d.ts
// declares. A module's prose comes from the `/** ... */` comment that opens its
// file, read here rather than through TypeDoc, which has no module comment
// without an `@module` tag. docs/README.md -> "The library reference" states
// how that comment is laid out, and so how it renders.
//
// The routes go to scalar.config.json under /reference: /reference/language
// for docs/LANGUAGE.md, and the /reference/library group holding every
// generated page. Only the /reference group's text is rewritten, in the
// one-line-when-it-fits layout the rest of the file keeps.
//
// Output is byte-deterministic: TypeDoc sorts each module's members, modules
// and routes are sorted here, and no page holds a time or an absolute path.
import fs from "node:fs"
import path from "node:path"
import { Application } from "typedoc"

const root = path.resolve(import.meta.dirname, "..")
const outDir = "docs/reference"
const configFile = "scalar.config.json"
const repoUrl = "https://github.com/amritk/nish/blob/main"
const languageRoute = "/reference/language"
const languageSource = "docs/LANGUAGE.md"
const languagePage = `${outDir}/language.md`
const width = 110

const Kind = {
  module: 2,
  variable: 32,
  func: 64,
  klass: 128,
  iface: 256,
  ctor: 512,
  property: 1024,
  method: 2048,
  alias: 2097152,
}

// ---- TypeDoc --------------------------------------------------------------

const readProject = async () => {
  const app = await Application.bootstrapWithPlugins(
    {
      entryPoints: ["std/**/*.ts", "runtime/nish.d.ts"],
      plugin: [path.join(root, "scripts/typedoc-nish-widths.mjs")],
      excludePrivate: true,
      excludeInternal: true,
      disableGit: true,
      sourceLinkTemplate: `${repoUrl}/{path}#L{line}`,
      logLevel: "Warn",
      // tsconfig.json's options for std/, without its `include`, so the run
      // checks only what it documents. An empty reader list keeps TypeDoc from
      // reading tsconfig.json or typedoc.json itself.
      compilerOptions: {
        strict: true,
        noEmit: true,
        target: "es2022",
        lib: ["es2022"],
        types: [],
        moduleDetection: "force",
        paths: { "nish/*": ["./std/*"] },
      },
    },
    []
  )
  const project = await app.convert()
  if (!project || app.logger.errorCount > 0) {
    console.error(`gen-reference: TypeDoc reported ${app.logger.errorCount} error(s)`)
    process.exit(1)
  }
  return app.serializer.projectToObject(project, root)
}

// ---- Markdown helpers -----------------------------------------------------

const attr = (s) =>
  s
    .replace(/\s+/g, " ")
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

/** Apply `f` to the prose of a line, never to its `code spans`. */
const outsideCode = (s, f) =>
  s
    .split(/(`+[^`]*`+)/)
    .map((piece, i) => (i % 2 === 1 ? piece : f(piece)))
    .join("")

/** `<` before a letter or `/` would open an HTML tag. */
const escapeProse = (s) => s.replace(/<(?=[A-Za-z/!?])/g, "&lt;")

/** A heading's slug on GitHub, or (`site`) on the docs site, as docs/check-links.mjs computes them. */
const slugOfHeading = (heading, site) => {
  const s = heading
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .toLowerCase()
  return site
    ? s
        .replace(/[^\p{L}\p{N}\p{M}\-. ]/gu, "")
        .replace(/ /g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
    : s.replace(/[^\p{L}\p{N}\p{M}\p{Pc}\- ]/gu, "").replace(/ /g, "-")
}

/**
 * Each heading of a Markdown text, outside fences: its line index, level and
 * slugs on GitHub and the docs site (null below level 4, which gets no ID there),
 * numbered as each site numbers a repeated slug.
 */
const headings = (text) => {
  const seen = [new Map(), new Map()]
  const number = (slug, i) => {
    const n = seen[i].get(slug) ?? 0
    seen[i].set(slug, n + 1)
    return n > 0 ? `${slug}-${n}` : slug
  }
  const out = []
  let fence = false
  for (const [index, line] of text.split("\n").entries()) {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence
      continue
    }
    const m = fence ? null : /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
    if (m) {
      const level = m[1].length
      out.push({
        index,
        github: number(slugOfHeading(m[2], false), 0),
        site: level <= 4 ? number(slugOfHeading(m[2], true), 1) : null,
      })
    }
  }
  return out
}

/** The first sentence of a paragraph, ending at a `.` outside code before a capital or the end. */
const firstSentence = (para) => {
  const flat = para.replace(/\s+/g, " ").trim()
  let inCode = false
  for (let i = 0; i < flat.length; i++) {
    if (flat[i] === "`") {
      inCode = !inCode
    } else if (!inCode && flat[i] === "." && (i + 1 === flat.length || /^ [A-Z`*]/.test(flat.slice(i + 1)))) {
      return flat.slice(0, i + 1)
    }
  }
  return flat
}

/** Markdown on one line, for a table cell: a code block's lines become code spans. */
const cell = (md) =>
  md
    .replace(/```\w*\n([\s\S]*?)```/g, (_, body) =>
      body
        .trim()
        .split("\n")
        .map((l) => `\`${l.trim()}\``)
        .join("<br>")
    )
    .split(/\n\s*\n/)
    .map((para) => para.replace(/\s*\n\s*/g, " ").trim())
    .join("<br><br>")
    .replace(/\|/g, "\\|")

/** Wrap `body` in a Scalar block tag, with the blank lines its Markdown body needs. */
const tag = (name, attrs, body) => {
  const open = `<${name}${attrs ? ` ${attrs}` : ""}>`
  return body ? `${open}\n\n${body}\n\n</${name}>` : `${open}\n</${name}>`
}

// ---- Links ----------------------------------------------------------------

/** Every Markdown file scalar.config.json routes, which a routed page links relatively. */
const routedFiles = (config, generated) => {
  const out = new Set(generated)
  const walk = (node) => {
    if (node && typeof node === "object") {
      if (typeof node.filepath === "string") {
        out.add(node.filepath)
      }
      for (const v of Object.values(node)) {
        walk(v)
      }
    }
  }
  walk(config.navigation)
  return out
}

/**
 * A link written in a source comment, relative to that source, as the page at
 * `page` must write it: relatively to a routed page, by GitHub URL to any
 * other file, and null when the target does not exist.
 */
const makeLinker = (routed) => (target, source, page) => {
  const [file, frag] = target.split("#")
  const rel = path.posix.normalize(path.posix.join(path.posix.dirname(source), file))
  if (rel.startsWith("..") || !fs.existsSync(path.join(root, rel))) {
    return null
  }
  const hash = frag === undefined ? "" : `#${frag}`
  const to = rel === languageSource ? languagePage : rel
  if (routed.has(to)) {
    return `${path.posix.relative(path.posix.dirname(page), to)}${hash}`
  }
  return `${repoUrl}/${rel}${hash}`
}

/** Rewrite the relative `[text](target)` links of prose; an unresolvable one loses its brackets' meaning. */
const relinkProse = (s, link, source, page) =>
  s.replace(/\[([^\]\n]*)\]\(([^)\s]+)\)/g, (whole, label, target) => {
    if (/^(https?:|mailto:|#)/.test(target)) {
      return whole
    }
    const to = link(target, source, page)
    return to === null ? `[${label}]\\(${target})` : `[${label}](${to})`
  })

// ---- TypeDoc comments to Markdown -----------------------------------------

const MISSING = "\u0001"

/** A TypeDoc comment's display parts as Markdown. */
const partsToMd = (parts, ctx) => {
  let s = ""
  for (const p of parts ?? []) {
    if (p.kind === "code") {
      s += p.text
    } else if (p.kind === "inline-tag") {
      s += `\`${(p.text || p.target?.name || "").trim()}\``
    } else if (p.kind === "relative-link") {
      const to = ctx.link(p.text, ctx.source, ctx.page)
      s += to === null ? `${MISSING}${p.text}` : to
    } else {
      s += p.text
    }
  }
  // The prose between code spans and fences: escape what Markdown would read
  // as HTML, and the brackets of a link whose target is not a file.
  return s
    .split(/(```[\s\S]*?```|`+[^`]*`+)/)
    .map((piece, i) => (i % 2 === 1 ? piece : escapeProse(piece)))
    .join("")
    .replace(new RegExp(`\\[([^\\]\\n]*)\\]\\(${MISSING}([^)]*)\\)`, "g"), "[$1]\\($2)")
    .replaceAll(MISSING, "")
    .trim()
}

const summary = (comment, ctx) => partsToMd(comment?.summary, ctx)

const blockTag = (comment, name, ctx) =>
  partsToMd(comment?.blockTags?.find((b) => b.tag === name)?.content, ctx)

// ---- Types ----------------------------------------------------------------

/** A TypeDoc type as TypeScript text; the plugin leaves most as the source's own `unknown` text. */
const typeText = (t) => {
  if (!t) {
    return "unknown"
  }
  switch (t.type) {
    case "unknown":
    case "intrinsic":
      return t.name
    case "reference":
      return t.typeArguments?.length ? `${t.name}<${t.typeArguments.map(typeText).join(", ")}>` : t.name
    case "array":
      return `${typeText(t.elementType)}[]`
    case "union":
      return t.types.map(typeText).join(" | ")
    case "intersection":
      return t.types.map(typeText).join(" & ")
    case "literal":
      return typeof t.value === "string" ? JSON.stringify(t.value) : String(t.value)
    case "tuple":
      return `[${(t.elements ?? []).map(typeText).join(", ")}]`
    case "typeOperator":
      return `${t.operator} ${typeText(t.target)}`
    default:
      return t.type
  }
}

const typeParams = (tps) =>
  tps?.length
    ? `<${tps
        .map(
          (tp) =>
            `${tp.name}${tp.type ? ` extends ${typeText(tp.type)}` : ""}${tp.default ? ` = ${typeText(tp.default)}` : ""}`
        )
        .join(", ")}>`
    : ""

const paramText = (p) =>
  `${p.flags?.isRest ? "..." : ""}${p.name}${p.flags?.isOptional ? "?" : ""}: ${typeText(p.type)}${
    p.defaultValue !== undefined ? ` = ${p.defaultValue}` : ""
  }`

/** `head(params): ret`, one parameter per line when the one-line form runs long. */
const signatureText = (head, sig, withReturn = true) => {
  const params = (sig.parameters ?? []).map(paramText)
  const ret = withReturn ? `: ${typeText(sig.type)}` : ""
  const tps = typeParams(sig.typeParameters)
  const one = `${head}${tps}(${params.join(", ")})${ret}`
  if (one.length <= 50 || params.length === 0) {
    return one
  }
  return `${head}${tps}(\n${params.map((p) => `  ${p},`).join("\n")}\n)${ret}`
}

// ---- Module comments --------------------------------------------------------

/** The text of the `/** ... *\/` comment that opens a file, or "" when none does. */
const leadingComment = (src) => {
  const m = /^\s*\/\*\*([\s\S]*?)\*\//.exec(src)
  if (!m) {
    return ""
  }
  return m[1]
    .split("\n")
    .map((l) => l.replace(/^\s*\* ?/, "").replace(/\s+$/, ""))
    .join("\n")
    .replace(/\*\\\//g, "*/")
    .replace(/^\n+|\n+$/g, "")
}

const listItem = /^(?:[-*+]|\d+[.)])\s/

const indentOf = (line) => /^ */.exec(line)[0].length

const dedent = (lines) => {
  const n = Math.min(...lines.filter((l) => l.trim()).map(indentOf))
  return lines.map((l) => l.slice(n))
}

/**
 * A module comment as Markdown, by the convention docs/README.md states: the
 * lead paragraph, the usage example (the first indented block that imports
 * from `nish/`), and the rest as callouts, details and paragraphs.
 */
const moduleProse = (comment, prose) => {
  const blocks = comment
    .split(/\n\s*\n/)
    .map((b) => b.split("\n"))
    .filter((b) => b.some((l) => l.trim()))
  const isCode = (b) => indentOf(b[0]) >= 2 && !listItem.test(b[0].trim())
  const isList = (b) => !isCode(b) && listItem.test(b[0].trim())
  const code = (b) => `\`\`\`ts\n${dedent(b).join("\n")}\n\`\`\``
  const lead = blocks.length > 0 && !isCode(blocks[0]) ? blocks.shift() : []
  const leadText = lead
    .join(" ")
    .replace(/^\s*`?(?:nish|std)[/:][\w/.-]*`?\s*(?:—|--|-|:)\s*/, "")
    .trim()
  const usageAt = blocks.findIndex((b) => isCode(b) && /^\s*import\b[\s\S]*from\s+"nish\//.test(b.join("\n")))
  // The usage example, with the indented blocks that directly follow it.
  let usage = ""
  if (usageAt >= 0) {
    let n = 1
    while (usageAt + n < blocks.length && isCode(blocks[usageAt + n])) {
      n++
    }
    usage = code(blocks.splice(usageAt, n).flatMap((b, i) => (i ? ["", ...b] : b)))
  }
  // Each prose block with the lists and code blocks that follow it.
  const units = []
  for (const b of blocks) {
    let body = b.map((l) => l.trim()).join("\n")
    if (isCode(b)) {
      body = code(b)
    } else if (isList(b)) {
      body = dedent(b).join("\n")
    }
    if (units.length > 0 && (isCode(b) || isList(b))) {
      units.at(-1).push(body)
    } else {
      units.push([body])
    }
  }
  const out = []
  for (const [i, unit] of units.entries()) {
    const text = unit.map(prose).join("\n\n")
    const bold = /^\*\*(.+?)\*\*/.exec(unit[0])
    if (!bold) {
      out.push(i === 0 ? tag("scalar-callout", 'type="info"', text) : text)
      continue
    }
    const title = bold[1].replace(/`/g, "").replace(/[.:]$/, "")
    if (/\b(refus|limit|caps?\b)/i.test(title)) {
      out.push(tag("scalar-callout", 'type="warning"', text))
    } else {
      // `**Title.** rest` gives the rest as the body; a bold phrase that runs
      // on into its sentence stays in it.
      const titled = /[.:]$/.test(bold[1]) || /^[.:]/.test(unit[0].slice(bold[0].length))
      const head = titled ? unit[0].slice(bold[0].length).replace(/^[.:]/, "").trim() : unit[0]
      const body = [head, ...unit.slice(1)].map(prose).join("\n\n").trim()
      out.push(tag("scalar-detail", `title="${attr(title)}"`, body))
    }
  }
  return { lead: prose(leadText), usage, body: out.join("\n\n") }
}

// ---- Pages ----------------------------------------------------------------

const header = (source) =>
  `<!-- Generated by scripts/gen-reference.mjs from ${source}. Do not edit by hand: change the source's doc comments and run \`node scripts/gen-reference.mjs\`. -->`

const byText = (a, b) => Number(a > b) - Number(a < b)
const sortByName = (xs) => [...xs].sort((a, b) => byText(a.name, b.name))

const formatNumber = (v) => (/^-?\d+$/.test(v) ? Number(v).toLocaleString("en-US") : null)

/** The table row of one class or interface member. */
const memberRow = (m, owner, ctx) => {
  const stat = m.flags?.isStatic ? "static " : ""
  const ro = m.flags?.isReadonly ? "readonly " : ""
  const rows = []
  if (m.kind === Kind.ctor) {
    for (const sig of m.signatures ?? []) {
      rows.push([signatureText(`new ${owner}`, sig, false).replace(/\n\s*/g, " ").replace(/,\)/, ")"), sig])
    }
  } else if (m.signatures) {
    for (const sig of m.signatures) {
      rows.push([`${stat}${signatureText(m.name, sig).replace(/\n\s*/g, " ").replace(/,\)/, ")")}`, sig])
    }
  } else {
    rows.push([`${stat}${ro}${m.name}${m.flags?.isOptional ? "?" : ""}: ${typeText(m.type)}`, m])
  }
  return rows.map(([sig, c]) => `| \`${sig.replace(/\|/g, "\\|")}\` | ${cell(summary(c.comment, ctx))} |`)
}

const renderFunction = (f, ctx, fallback) => {
  const out = [`## ${f.name}`]
  const sigs = f.signatures ?? []
  const doc = (sig) => (sig.comment ? sig : (fallback?.signatures?.[0] ?? sig))
  const desc = summary(doc(sigs[0]).comment, ctx)
  if (desc) {
    out.push(desc)
  }
  out.push(`\`\`\`ts\n${sigs.map((s) => signatureText(`function ${f.name}`, s)).join("\n")}\n\`\`\``)
  for (const sig of sigs) {
    const c = doc(sig)
    if (sig.parameters?.length) {
      out.push("#### Parameters")
      for (const [i, p] of sig.parameters.entries()) {
        const req = p.flags?.isOptional || p.defaultValue !== undefined ? "" : " required"
        const pc = c.parameters?.[i]?.comment ?? p.comment
        out.push(
          tag(
            "scalar-field",
            `name="${attr(`${p.flags?.isRest ? "..." : ""}${p.name}`)}" type="${attr(typeText(p.type))}"${req}`,
            summary(pc, ctx)
          )
        )
      }
    }
    const ret = typeText(sig.type)
    if (ret !== "void") {
      out.push("#### Returns")
      out.push(
        tag("scalar-field", `name="returns" type="${attr(ret)}"`, blockTag(c.comment, "@returns", ctx))
      )
    }
  }
  return out.join("\n\n")
}

const renderType = (t, ctx) => {
  const out = [`## ${t.name}`]
  const desc = summary(t.comment, ctx)
  if (desc) {
    out.push(desc)
  }
  out.push(`\`\`\`ts\ntype ${t.name}${typeParams(t.typeParameters)} = ${typeText(t.type)}\n\`\`\``)
  return out.join("\n\n")
}

const renderClass = (c, ctx) => {
  const out = [`## ${c.name}`]
  const desc = summary(c.comment, ctx)
  if (desc) {
    out.push(desc)
  }
  const word = c.kind === Kind.klass ? "class" : "interface"
  out.push(`\`\`\`ts\n${word} ${c.name}${typeParams(c.typeParameters)}\n\`\`\``)
  const rows = (c.children ?? []).flatMap((m) => memberRow(m, c.name, ctx))
  if (rows.length > 0) {
    out.push(["| Member | |", "| --- | --- |", ...rows].join("\n"))
  }
  return out.join("\n\n")
}

const renderConstants = (vars, ctx) => {
  const cards = vars.map((v) => {
    const value = v.defaultValue === undefined ? null : formatNumber(v.defaultValue)
    const desc = summary(v.comment, ctx)
    const body = [`\`${v.name}: ${typeText(v.type)}\``, desc].filter(Boolean).join("\n\n")
    return tag("scalar-card", `title="${attr(value ?? v.name)}" icon="phosphor/regular/hash"`, body)
  })
  return `## Constants\n\n${tag("scalar-grid", 'cols="2"', cards.join("\n\n"))}`
}

/**
 * One module's page. `mod` is its TypeDoc reflection, `spec` what a program
 * imports (null for the globals), `source` its file, `comment` the module
 * prose's source text and `fallback` the globals by name, whose doc comment a
 * builtin module's undocumented re-declaration shows.
 */
const renderPage = ({ mod, spec, title, source, page, comment, intro, fallback }, link) => {
  const ctx = { link, source, page }
  const prose = (s) =>
    s
      .split(/(```[\s\S]*?```)/)
      .map((piece, i) =>
        i % 2 === 1 ? piece : outsideCode(piece, (p) => relinkProse(escapeProse(p), link, source, page))
      )
      .join("")
  const members = (mod.children ?? []).filter((c) => c.kind !== Kind.module)
  const of = (...kinds) => sortByName(members.filter((m) => kinds.includes(m.kind)))
  const funcs = of(Kind.func)
  const classes = of(Kind.klass, Kind.iface)
  const types = of(Kind.alias)
  const vars = of(Kind.variable)
  const { lead, usage, body } = moduleProse(comment, prose)
  const out = [header(source), `# ${title}`]
  if (lead || intro) {
    out.push(lead || intro)
  }
  if (spec && members.length > 0) {
    const names = sortByName(members).map((m) => `  ${m.name},`)
    out.push(`\`\`\`ts\nimport {\n${names.join("\n")}\n} from "${spec}";\n\`\`\``)
  }
  if (usage) {
    out.push(usage)
  }
  const cardOf = (m, icon) => {
    const doc = m.signatures
      ? (m.signatures[0].comment ?? fallback?.get(m.name)?.signatures?.[0]?.comment)
      : m.comment
    const first = firstSentence(summary(doc, ctx).split(/\n\s*\n/)[0] ?? "")
    return tag(
      "scalar-card",
      `title="${attr(m.name)}" icon="phosphor/regular/${icon}" href="#${slugOf(m.name)}"`,
      first
    )
  }
  const cards = [...funcs.map((f) => cardOf(f, "function")), ...classes.map((c) => cardOf(c, "cube"))]
  if (cards.length > 0) {
    out.push(tag("scalar-grid", 'cols="2"', cards.join("\n\n")))
  }
  if (body) {
    out.push(body)
  }
  for (const f of funcs) {
    out.push(renderFunction(f, ctx, fallback?.get(f.name)))
  }
  for (const c of classes) {
    out.push(renderClass(c, ctx))
  }
  for (const t of types) {
    out.push(renderType(t, ctx))
  }
  if (vars.length > 0) {
    out.push(renderConstants(vars, ctx))
  }
  const text = `${out.join("\n\n")}\n`
  // Every card's anchor must name a heading of the page it is on, on both sites.
  const hs = headings(text)
  for (const m of text.matchAll(/ href="#([^"]+)"/g)) {
    if (!hs.some((h) => h.github === m[1] && h.site === m[1])) {
      throw new Error(`${page}: card anchor #${m[1]} names no heading`)
    }
  }
  return { text, lead: lead || intro }
}

const slugOf = (name) => slugOfHeading(name, false)

/** The overview page: every module, linked, with its lead sentence. */
const renderIndex = (pages) => {
  const row = (p) => `| [\`${p.title}\`](${path.posix.relative(outDir, p.page)}) | ${cell(p.first)} |`
  const builtin = pages.filter((p) => !p.spec || p.spec.startsWith("nish:"))
  const std = pages.filter((p) => p.spec?.startsWith("nish/"))
  return `${[
    header("std/**/*.ts and runtime/nish.d.ts"),
    "# Library reference",
    "Every module a Nish program can import, one page each, generated from the doc comments of its source. " +
      "The builtins come with the compiler; the `nish/` modules are the standard library, written in Nish.",
    "## Builtins",
    ["| Module | |", "| --- | --- |", ...builtin.map(row)].join("\n"),
    "## Standard library",
    ["| Module | |", "| --- | --- |", ...std.map(row)].join("\n"),
  ].join("\n\n")}\n`
}

// ---- Modules --------------------------------------------------------------

const collectPages = (project) => {
  const pages = []
  const runtime = project.children.find((m) => m.name === "runtime/nish")
  const globals = new Map(
    (runtime?.children ?? []).filter((c) => c.kind !== Kind.module).map((c) => [c.name, c])
  )
  const dts = fs.readFileSync(path.join(root, "runtime/nish.d.ts"), "utf8")
  pages.push({
    mod: { children: [...globals.values()] },
    spec: null,
    title: "Globals",
    source: "runtime/nish.d.ts",
    page: `${outDir}/builtins.md`,
    comment: leadingComment(dts),
    intro: "",
  })
  for (const m of runtime?.children ?? []) {
    if (m.kind !== Kind.module) {
      continue
    }
    const name = m.name.replace(/^nish:/, "")
    pages.push({
      mod: m,
      spec: m.name,
      title: m.name,
      source: "runtime/nish.d.ts",
      page: `${outDir}/nish-${name}.md`,
      comment: "",
      intro:
        `The \`${m.name}\` builtin module: the globals of the same names, importable. ` +
        "Its members are declared in `runtime/nish.d.ts`; " +
        "[the language reference](language.md#builtin-modules-nish) is the normative list.",
      fallback: globals,
    })
  }
  for (const m of project.children) {
    if (!m.name.startsWith("std/")) {
      continue
    }
    const rel = m.name.slice("std/".length)
    const source = `std/${rel}.ts`
    pages.push({
      mod: m,
      spec: `nish/${rel}`,
      title: `nish/${rel}`,
      source,
      page: `${outDir}/${rel}.md`,
      comment: leadingComment(fs.readFileSync(path.join(root, source), "utf8")),
      intro: "",
    })
  }
  return pages.sort((a, b) => (a.page < b.page ? -1 : 1))
}

// ---- Routes ---------------------------------------------------------------

const routeTitle = (p) => (p.spec === null ? "Globals" : p.title)

/** The /reference/library group: the overview, the builtins, then std/ by directory. */
const libraryRoutes = (pages) => {
  const page = (title, filepath) => ({ type: "page", title, filepath })
  const builtins = { "/": page("Globals", `${outDir}/builtins.md`) }
  const std = {}
  for (const p of pages) {
    if (p.spec?.startsWith("nish:")) {
      builtins[`/${path.posix.basename(p.page, ".md")}`] = page(routeTitle(p), p.page)
    } else if (p.spec?.startsWith("nish/")) {
      const parts = p.spec.slice("nish/".length).split("/")
      let node = std
      for (const [i, dir] of parts.slice(0, -1).entries()) {
        const key = `/${dir}`
        if (node[key]?.type === "page") {
          node[key] = { type: "group", title: node[key].title, children: { "/": node[key] } }
        }
        node[key] ??= { type: "group", title: `nish/${parts.slice(0, i + 1).join("/")}`, children: {} }
        node = node[key].children
      }
      const key = `/${parts.at(-1)}`
      if (node[key]?.type === "group") {
        node[key].children = { "/": page(p.title, p.page), ...node[key].children }
      } else {
        node[key] = page(p.title, p.page)
      }
    }
  }
  const sortTree = (children) => {
    // "/" (the group's own page) first, then by name.
    const keys = Object.keys(children).sort((a, b) => byText(a !== "/", b !== "/") || byText(a, b))
    const out = {}
    for (const k of keys) {
      const v = children[k]
      out[k] = v.type === "group" ? { ...v, children: sortTree(v.children) } : v
    }
    return out
  }
  return {
    type: "group",
    title: "Library reference",
    children: {
      "/": page("Overview", `${outDir}/index.md`),
      "/builtins": { type: "group", title: "Builtins", children: sortTree(builtins) },
      ...sortTree(std),
    },
  }
}

/** JSON in the file's layout: an object or array on one line when it fits in `width`. */
const printJson = (value, indent, prefix, suffix) => {
  const one = JSON.stringify(value, null, 1)
    .replace(/\n\s*/g, " ")
    .replace(/\{ /g, "{ ")
    .replace(/\[ /g, "[")
    .replace(/ \]/g, "]")
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

/** scalar.config.json with /reference's routes and the header's language link regenerated. */
const configText = (text, pages) => {
  const config = JSON.parse(text)
  const reference = config.navigation.routes["/"].children["/reference"]
  const kept = Object.entries(reference.children).filter(([k]) => k !== "/language" && k !== "/library")
  const children = {}
  for (const [k, v] of kept) {
    children[k] = v
    if (k === "/standard-library") {
      children["/language"] = { type: "page", title: "Language reference", filepath: languagePage }
      children["/library"] = libraryRoutes(pages)
    }
  }
  reference.children = children
  const lines = text.split("\n")
  const start = lines.findIndex((l) => /^\s*"\/reference": \{$/.test(l))
  const indent = indentOf(lines[start])
  const end = lines.findIndex((l, i) => i > start && indentOf(l) === indent && /^\s*\},?$/.test(l))
  const comma = lines[end].trim().endsWith(",") ? "," : ""
  const block = printJson(reference, indent, '"/reference": ', comma)
  let out = [...lines.slice(0, start), block, ...lines.slice(end + 1)].join("\n")
  // The header's "Language reference" link opens the routed page.
  out = out.replace(
    /\{\s*"type": "link",\s*"title": "Language reference",\s*"to": "[^"]*"(?:,\s*"newTab": true)?\s*\}/,
    `{ "type": "link", "title": "Language reference", "to": "${languageRoute}" }`
  )
  return out
}

// ---- The language reference ----------------------------------------------

/**
 * docs/LANGUAGE.md as the docs site's page: its relative links rewritten for
 * docs/reference/, and an `<a id>` above each heading whose ID the docs site
 * spells differently from GitHub, so the anchors written for GitHub hold.
 */
const renderLanguage = (link) => {
  const text = fs.readFileSync(path.join(root, languageSource), "utf8")
  const lines = text.split("\n")
  const anchors = new Map(
    headings(text)
      .filter((h) => h.site !== h.github)
      .map((h) => [h.index, h.github])
  )
  const relink = (target) => {
    if (/^(https?:|mailto:|#)/.test(target)) {
      return target
    }
    const to = link(target, languageSource, languagePage)
    if (to === null) {
      throw new Error(`${languageSource}: broken link ${target}`)
    }
    return to
  }
  const out = [
    `<!-- Generated by scripts/gen-reference.mjs from ${languageSource}. ` +
      "Do not edit by hand: change that file and run `node scripts/gen-reference.mjs`. -->",
    "",
  ]
  let fence = false
  for (const [i, line] of lines.entries()) {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence
    }
    if (anchors.has(i)) {
      out.push(`<a id="${anchors.get(i)}" style="scroll-margin-top: 65px"></a>`, "")
    }
    if (fence) {
      out.push(line)
      continue
    }
    // Links outside code spans: a `[` inside one is code, not a link.
    const code = [...line.matchAll(/(`+)[^`]*?\1/g)].map((m) => [m.index, m.index + m[0].length])
    const inCode = (at) => code.some(([a, b]) => at > a && at < b)
    out.push(
      line
        .replace(/\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g, (whole, target, title, at) =>
          inCode(at) ? whole : `](${relink(target)}${title})`
        )
        .replace(/^(\s*\[[^\]]+\]:\s*)(\S+)/, (_, head, target) => `${head}${relink(target)}`)
    )
  }
  return out.join("\n")
}

// ---- Main -----------------------------------------------------------------

const listFiles = (dir) => {
  const full = path.join(root, dir)
  if (!fs.existsSync(full)) {
    return []
  }
  return fs
    .readdirSync(full, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.posix.join(path.relative(root, e.parentPath).split(path.sep).join("/"), e.name))
    .sort()
}

const main = async () => {
  const check = process.argv.includes("--check")
  const project = await readProject()
  const pages = collectPages(project)
  const configBefore = fs.readFileSync(path.join(root, configFile), "utf8")
  const configAfter = configText(configBefore, pages)
  const link = makeLinker(routedFiles(JSON.parse(configAfter), []))
  const want = new Map()
  for (const p of pages) {
    const { text, lead } = renderPage(p, link)
    p.first = firstSentence(lead.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"))
    want.set(p.page, text)
  }
  want.set(`${outDir}/index.md`, renderIndex(pages))
  want.set(languagePage, renderLanguage(link))
  const have = listFiles(outDir)
  const problems = []
  for (const [file, text] of [...want].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const full = path.join(root, file)
    if (!fs.existsSync(full)) {
      problems.push(`missing: ${file}`)
    } else if (fs.readFileSync(full, "utf8") !== text) {
      problems.push(`stale: ${file}`)
    }
  }
  for (const file of have) {
    if (!want.has(file)) {
      problems.push(`extra: ${file}`)
    }
  }
  if (configAfter !== configBefore) {
    problems.push(`stale: ${configFile} (the /reference routes or the "Language reference" link)`)
  }
  if (check) {
    if (problems.length > 0) {
      for (const p of problems) {
        console.error(`gen-reference: ${p}`)
      }
      console.error(
        "gen-reference: the library reference is out of date; run `node scripts/gen-reference.mjs`"
      )
      process.exit(1)
    }
    console.log(`gen-reference: ${want.size} pages and their routes are up to date`)
    return
  }
  for (const file of have) {
    if (!want.has(file)) {
      fs.rmSync(path.join(root, file))
    }
  }
  for (const [file, text] of want) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), text)
  }
  fs.writeFileSync(path.join(root, configFile), configAfter)
  console.log(`gen-reference: wrote ${want.size} pages; ${problems.length} changed`)
}

await main()
