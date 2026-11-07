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
import ts from "typescript"

const root = path.resolve(import.meta.dirname, "..")
const outDir = "docs/reference"
const configFile = "scalar.config.json"
const repoUrl = "https://github.com/amritk/nish/blob/main"
const languageRoute = "/reference/language"
// Not "Language reference", the header link's title, nor "The language", the guide's group.
const languageTitle = "Language specification"
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
      // Against the checkout, wherever the script is run from.
      entryPoints: ["std/**/*.ts", "runtime/nish.d.ts"].map((p) => path.join(root, p)),
      plugin: [path.join(root, "scripts/typedoc-nish-widths.mjs")],
      excludePrivate: true,
      excludeInternal: true,
      disableGit: true,
      // TypeDoc keeps each reflection's `sources` (read below) only with a
      // template under disableGit. No page prints the line link: it would move
      // with every edit above the declaration, and a page should change only
      // when its declarations or their comments do.
      sourceLinkTemplate: `${repoUrl}/{path}#L{line}`,
      logLevel: "Warn",
      // A `{@link}` that names nothing fails the run; the rest is not checked.
      validation: { invalidLink: true, notExported: false, notDocumented: false, rewrittenLink: false },
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
        paths: { "nish/*": [path.join(root, "std/*")] },
      },
    },
    []
  )
  // TypeDoc only warns of a `{@link}` it cannot resolve; here it fails the
  // run. (Its other warnings, such as a `[text](-A)` it takes for a relative
  // path, stay warnings.)
  const unresolved = []
  const warn = app.logger.validationWarning.bind(app.logger)
  app.logger.validationWarning = (message, ...rest) => {
    if (String(message).startsWith("Failed to resolve link")) {
      unresolved.push(String(message))
    }
    warn(message, ...rest)
  }
  const project = await app.convert()
  if (!project || app.logger.errorCount > 0) {
    console.error(`gen-reference: TypeDoc reported ${app.logger.errorCount} error(s)`)
    process.exit(1)
  }
  app.validate(project)
  if (unresolved.length > 0) {
    console.error(`gen-reference: a \`{@link}\` names nothing:\n${unresolved.join("\n")}`)
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

/**
 * Apply `f` to the prose of Markdown text, never to a fenced block or a code
 * span. A span closes at the next run of as many backticks as opened it, so
 * ``` `` $` `` ``` is one span; a run that never closes is prose.
 */
const outsideCode = (s, f) =>
  s
    .split(/(^[ \t]*```[\s\S]*?^[ \t]*```[ \t]*$)/m)
    .map((piece, i) => {
      if (i % 2 === 1) {
        return piece
      }
      let out = ""
      let from = 0
      const open = /`+/g
      for (let m = open.exec(piece); m; m = open.exec(piece)) {
        const close = new RegExp(`(?<!\`)${m[0]}(?!\`)`, "g")
        close.lastIndex = m.index + m[0].length
        const c = close.exec(piece)
        if (c) {
          out += f(piece.slice(from, m.index)) + piece.slice(m.index, close.lastIndex)
          from = close.lastIndex
          open.lastIndex = from
        }
      }
      return out + f(piece.slice(from))
    })
    .join("")

/** A code block's fence language: `ts` when TypeScript parses it, `text` for a diagram or a table. */
const fenceLang = (code) =>
  ts.transpileModule(code, { reportDiagnostics: true }).diagnostics.length === 0 ? "ts" : "text"

const fence = (lines) => `\`\`\`${fenceLang(lines.join("\n"))}\n${lines.join("\n")}\n\`\`\``

/**
 * A doc comment's indented code blocks (four spaces, after a blank line) as
 * fenced ones, so escaping, table cells and highlighting all see them as code.
 */
const fenceIndented = (s) => {
  const lines = s.split("\n")
  const out = []
  let inFence = false
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) {
      inFence = !inFence
    }
    if (inFence || !/^ {4}\S/.test(lines[i]) || (i > 0 && lines[i - 1].trim())) {
      out.push(lines[i])
      continue
    }
    let end = i
    while (end < lines.length && (/^ {4}/.test(lines[end]) || !lines[end].trim())) {
      end++
    }
    while (!lines[end - 1].trim()) {
      end--
    }
    out.push(fence(lines.slice(i, end).map((l) => l.slice(4))))
    i = end - 1
  }
  return out.join("\n")
}

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
  let inFence = false
  for (const [index, line] of text.split("\n").entries()) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    const m = inFence ? null : /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
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

// Words whose dot ends no sentence.
const abbreviation = /\b(?:e\.g|i\.e|vs|etc|cf|approx|resp|No|Fig)$/

/**
 * The first sentence of a paragraph, ending at a `.` outside code before a
 * capital or the end. A code span opens with a run of backticks and closes at
 * the next run of the same length, so ``` `` a`b `` ``` is one span.
 */
const firstSentence = (para) => {
  const flat = para.replace(/\s+/g, " ").trim()
  let span = 0
  for (let i = 0; i < flat.length; i++) {
    if (flat[i] === "`") {
      const run = /^`+/.exec(flat.slice(i))[0].length
      if (span === 0) {
        span = run
      } else if (run === span) {
        span = 0
      }
      i += run - 1
    } else if (
      span === 0 &&
      flat[i] === "." &&
      (i + 1 === flat.length || /^ [A-Z`*]/.test(flat.slice(i + 1))) &&
      !abbreviation.test(flat.slice(0, i))
    ) {
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
/** A card's anchor before the page's headings are numbered. */
const CARD = "\u0002"

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
  return outsideCode(fenceIndented(s), escapeProse)
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
const signatureText = (head, sig, withReturn = true, wrap = true) => {
  const params = (sig.parameters ?? []).map(paramText)
  const ret = withReturn ? `: ${typeText(sig.type)}` : ""
  const tps = typeParams(sig.typeParameters)
  const one = `${head}${tps}(${params.join(", ")})${ret}`
  if (!wrap || one.length <= 50 || params.length === 0) {
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

/** The `/** … *\/` comment that ends on the line before `lines[at]`, as leadingComment reads it; "" for none. */
const commentAbove = (lines, at) => {
  let end = at - 1
  while (end >= 0 && !lines[end].trim()) {
    end--
  }
  if (end < 0 || !lines[end].trim().endsWith("*/")) {
    return ""
  }
  let start = end
  while (start >= 0 && !lines[start].trimStart().startsWith("/*")) {
    start--
  }
  return start >= 0 && lines[start].trimStart().startsWith("/**")
    ? leadingComment(lines.slice(start, end + 1).join("\n"))
    : ""
}

const listItem = /^(?:[-*+]|\d+[.)])\s/

const indentOf = (line) => /^ */.exec(line)[0].length

const dedent = (lines) => {
  const n = Math.min(...lines.filter((l) => l.trim()).map(indentOf))
  return lines.map((l) => l.slice(n))
}

/**
 * A module comment as Markdown, by the convention docs/README.md states: the
 * lead paragraph, the usage example (the first indented block that reads as
 * code, whatever it imports), and the rest as callouts, details and paragraphs.
 */
const moduleProse = (comment, prose) => {
  const blocks = comment
    .split(/\n\s*\n/)
    .map((b) => b.split("\n"))
    .filter((b) => b.some((l) => l.trim()))
  const isCode = (b) => indentOf(b[0]) >= 2 && !listItem.test(b[0].trim())
  const isList = (b) => !isCode(b) && listItem.test(b[0].trim())
  const code = (b) => fence(dedent(b))
  // The usage example is the first code block that reads as code, not a
  // diagram or a table: its first line opens with a keyword or a comment.
  const looksLikeCode = (b) =>
    isCode(b) &&
    /^(?:import|export|const|let|var|function|class|type|interface|await|async|for|if|while|return)\b|^\/\//.test(
      b.find((l) => l.trim()).trim()
    )
  const lead = blocks.length > 0 && !isCode(blocks[0]) ? blocks.shift() : []
  const leadText = lead
    .join(" ")
    .replace(/^\s*`?(?:nish|std)[/:][\w/.-]*`?\s*(?:—|--|-|:)\s*/, "")
    .trim()
    // "nish/regex — regular expressions ..." leads with a lowercase word once the name is gone.
    .replace(/^[a-z]/, (c) => c.toUpperCase())
  const usageAt = blocks.findIndex(looksLikeCode)
  // The usage example, with the indented blocks that directly follow it.
  let usage = ""
  if (usageAt >= 0) {
    let n = 1
    while (usageAt + n < blocks.length && isCode(blocks[usageAt + n])) {
      n++
    }
    // Always `ts`: an example may elide with `…` and still be TypeScript to a reader.
    const lines = dedent(blocks.splice(usageAt, n).flatMap((b, i) => (i ? ["", ...b] : b)))
    usage = `\`\`\`ts\n${lines.join("\n")}\n\`\`\``
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
  // A unit without a warning. The first after the lead is the info callout
  // unless it opens with a bold title (`**Title.** rest`, `**Title**: rest`);
  // a bold phrase that runs on into its sentence (`**The syntax is
  // JavaScript's**, with …`) does not stop it. Any other unit that opens with
  // bold is a detail under that title, a titled one with the rest as its body.
  const classify = (unit, i) => {
    if (unit.length === 0) {
      return []
    }
    const bold = /^\*\*(.+?)\*\*/.exec(unit[0])
    const titled = bold !== null && (/[.:]$/.test(bold[1]) || /^[.:]/.test(unit[0].slice(bold[0].length)))
    if (!titled && (i === 0 || !bold)) {
      const text = unit.map(prose).join("\n\n")
      return [i === 0 ? tag("scalar-callout", 'type="info"', text) : text]
    }
    // The title keeps its code spans as written: an attribute cannot hold Markdown.
    const title = bold[1].replace(/[.:]$/, "")
    const head = titled ? unit[0].slice(bold[0].length).replace(/^[.:]/, "").trim() : unit[0]
    const body = [head, ...unit.slice(1)].map(prose).join("\n\n").trim()
    return [tag("scalar-detail", `title="${attr(title)}"`, body)]
  }
  const warns = (title) => /\b(refus|limit|caps?\b)/i.test(title.replace(/`/g, ""))
  // Where a sentence opening with a warning's bold phrase starts, outside code; -1 for none.
  const warningAt = (para) => {
    for (const m of para.matchAll(/(^|[.!?]\s+)\*\*([^*]+)\*\*/g)) {
      const at = m.index + m[1].length
      if (warns(m[2]) && (para.slice(0, at).match(/`/g) ?? []).length % 2 === 0) {
        return at
      }
    }
    return -1
  }
  const out = []
  for (const [i, unit] of units.entries()) {
    // A warning sentence and the rest of its unit are split from the prose before it.
    const at = warningAt(unit[0])
    let head = unit
    if (at >= 0) {
      head = at > 0 ? [unit[0].slice(0, at).trim()] : []
    }
    if (at >= 0) {
      out.push(
        ...classify(head, i),
        tag("scalar-callout", 'type="warning"', [unit[0].slice(at), ...unit.slice(1)].map(prose).join("\n\n"))
      )
    } else {
      out.push(...classify(head, i))
    }
  }
  return { lead: prose(leadText), usage, body: out.join("\n\n") }
}

// ---- Pages ----------------------------------------------------------------

const header = (source) =>
  `<!-- Generated by scripts/gen-reference.mjs from ${source}. Do not edit by hand: change the source's doc comments and run \`node scripts/gen-reference.mjs\`. -->`

const byText = (a, b) => Number(a > b) - Number(a < b)
const sortByName = (xs) => [...xs].sort((a, b) => byText(a.name, b.name))

/**
 * A constant's value as its card's title: a decimal integer with its digits
 * grouped in threes (`100,000`, exact past 2^53), anything else as written
 * (`0x01`, `"h3"`, `DNS_QUERY_MAX_BYTES + 2`).
 */
const valueTitle = (v) => {
  const m = /^(-?)(\d+)$/.exec(v)
  return m ? `${m[1]}${m[2].replace(/\B(?=(\d{3})+$)/g, ",")}` : v.replace(/\s+/g, " ")
}

/** A member's name; TypeDoc names a well-known-symbol key `[dispose]`, the source `[Symbol.dispose]`. */
const memberName = (name) => name.replace(/^\[(\w+)\]$/, "[Symbol.$1]")

/** The table row of one class or interface member. */
const memberRow = (m, owner, ctx) => {
  const stat = m.flags?.isStatic ? "static " : ""
  const ro = m.flags?.isReadonly ? "readonly " : ""
  const rows = []
  if (m.kind === Kind.ctor) {
    for (const sig of m.signatures ?? []) {
      rows.push([signatureText(`new ${owner}`, sig, false, false), sig])
    }
  } else if (m.signatures) {
    for (const sig of m.signatures) {
      rows.push([`${stat}${signatureText(memberName(m.name), sig, true, false)}`, sig])
    }
  } else {
    rows.push([`${stat}${ro}${memberName(m.name)}${m.flags?.isOptional ? "?" : ""}: ${typeText(m.type)}`, m])
  }
  return rows.map(
    ([sig, c]) =>
      `| \`${sig.replace(/\s+/g, " ").replace(/\|/g, "\\|")}\` | ${cell(summary(c.comment, ctx))} |`
  )
}

/**
 * A function's section. Each overload is shown whole, in source order: its own
 * description (or the first's, when it has none), signature, parameters and
 * return. A builtin module's undocumented re-declaration takes the global's.
 */
const renderFunction = (f, ctx, fallback) => {
  const out = [`## ${f.name}`]
  const sigs = f.signatures ?? []
  const doc = (sig, i) => {
    if (sig.comment) {
      return sig
    }
    return fallback?.signatures?.[i] ?? fallback?.signatures?.[0] ?? (sigs[0].comment ? sigs[0] : sig)
  }
  const firstDesc = sigs.length > 0 ? summary(doc(sigs[0], 0).comment, ctx) : ""
  for (const [i, sig] of sigs.entries()) {
    const c = doc(sig, i)
    const desc = summary(c.comment, ctx)
    // An overload that repeats the first one's description, word for word, shows it once.
    if (desc && (i === 0 || desc !== firstDesc)) {
      out.push(desc)
    }
    out.push(`\`\`\`ts\n${signatureText(`function ${f.name}`, sig)}\n\`\`\``)
    if (sig.parameters?.length) {
      out.push("#### Parameters")
      for (const [j, p] of sig.parameters.entries()) {
        const req = p.flags?.isOptional || p.defaultValue !== undefined ? "" : " required"
        const pc = c.parameters?.[j]?.comment ?? p.comment
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

const renderObject = (o, ctx) => {
  const out = [`## ${o.name}`]
  const desc = summary(o.comment, ctx)
  if (desc) {
    out.push(desc)
  }
  out.push(`\`\`\`ts\nconst ${o.name}: { ... }\n\`\`\``)
  const rows = (o.type.declaration?.children ?? []).flatMap((m) => memberRow(m, o.name, ctx))
  if (rows.length > 0) {
    out.push(["| Member | |", "| --- | --- |", ...rows].join("\n"))
  }
  return out.join("\n\n")
}

/**
 * A constant is a limit, listed under `## Limits`, by its doc's first
 * sentence: one that opens with a bound ("The most|fewest|least|longest|
 * shortest|largest|smallest|deepest|highest|lowest|maximum|minimum …",
 * "At most|least …", "Most …", "How deep(ly) …"), or with "How
 * many/much/long/far …" and says what is bounded ("may", "keep(s)", "kept",
 * "hold(s)", "held", "refuse…"). Its name does not decide: `QUIC_TP_MAX_DATA`
 * is a protocol identifier. `docs/README.md` states the same rule.
 */
const isLimit = (v) => {
  const first = firstSentence(
    (v.comment?.summary ?? [])
      .map((p) => p.text)
      .join("")
      .trim()
  )
  const bound =
    /^(?:the\s+(?:most|fewest|least|longest|shortest|largest|smallest|deepest|highest|lowest|maximum|minimum)|at\s+(?:most|least)|most|how\s+deep(?:ly)?)\b/i
  const amount = /^how\s+(?:many|much|long|far)\b/i
  return (
    bound.test(first) || (amount.test(first) && /\b(?:may|keeps?|kept|holds?|held|refus\w*)\b/i.test(first))
  )
}

const renderConstants = (heading, vars, ctx) => {
  const cards = vars.map((v) => {
    // TypeDoc writes "..." for an initialiser it does not print (`A * 2`), which is no value to show.
    const value = v.defaultValue === undefined || v.defaultValue === "..." ? null : valueTitle(v.defaultValue)
    const desc = summary(v.comment, ctx)
    const body = [`\`${v.name}: ${typeText(v.type)}\``, desc].filter(Boolean).join("\n\n")
    return tag("scalar-card", `title="${attr(value ?? v.name)}" icon="phosphor/regular/hash"`, body)
  })
  return `## ${heading}\n\n${tag("scalar-grid", 'cols="2"', cards.join("\n\n"))}`
}

/**
 * One module's page. `mod` is its TypeDoc reflection, `spec` what a program
 * imports (null for the globals), `source` its file, `comment` the module
 * prose's source text, `intro` the lead when that prose has none, `note` a
 * paragraph said after the lead either way, and `fallback` the globals by
 * name, whose doc comment a builtin module's undocumented re-declaration shows.
 */
const renderPage = ({ mod, spec, title, source, page, comment, intro, note, fallback }, link) => {
  const ctx = { link, source, page }
  const prose = (s) => outsideCode(s, (p) => relinkProse(escapeProse(p), link, source, page))
  const members = (mod.children ?? []).filter((c) => c.kind !== Kind.module)
  const of = (...kinds) => sortByName(members.filter((m) => kinds.includes(m.kind)))
  const funcs = of(Kind.func)
  const classes = of(Kind.klass, Kind.iface)
  const types = of(Kind.alias)
  // A constant typed as an object literal (`Arena`, `crypto`) is shown as its members.
  const objects = of(Kind.variable).filter((v) => v.type?.type === "reflection")
  const vars = of(Kind.variable).filter((v) => v.type?.type !== "reflection")
  const { lead, usage, body } = moduleProse(comment, prose)
  // A module's name is code, and Scalar cuts a heading at a bare colon
  // (`# nish:fs` renders as "nish"); a code span keeps it whole.
  const out = [header(source), spec === null ? `# ${title}` : `# \`${title}\``]
  if (lead || intro) {
    out.push(lead || intro)
  }
  if (note) {
    out.push(note)
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
    // The anchor is filled in once the page's headings are known (see below).
    return tag(
      "scalar-card",
      `title="${attr(m.name)}" icon="phosphor/regular/${icon}" href="#${CARD}"`,
      first
    )
  }
  const sections = [...funcs, ...classes, ...objects]
  const cards = sections.map((m) => cardOf(m, m.kind === Kind.func ? "function" : "cube"))
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
  for (const o of objects) {
    out.push(renderObject(o, ctx))
  }
  for (const t of types) {
    out.push(renderType(t, ctx))
  }
  const limits = vars.filter(isLimit)
  const constants = vars.filter((v) => !isLimit(v))
  if (limits.length > 0) {
    out.push(renderConstants("Limits", limits, ctx))
  }
  if (constants.length > 0) {
    out.push(renderConstants("Constants", constants, ctx))
  }
  const draft = `${out.join("\n\n")}\n`
  // Each card links to its member's own `## name` heading, the first one
  // after the previous card's: `sha256` and `Sha256` share a slug, and the
  // second is numbered (`#sha256-1`), the same on GitHub and the docs site.
  const lines = draft.split("\n")
  const hs = headings(draft)
  let at = 0
  const anchors = sections.map((m) => {
    while (at < hs.length && lines[hs[at].index] !== `## ${m.name}`) {
      at++
    }
    const h = hs[at++]
    if (!h || h.github !== h.site) {
      throw new Error(`${page}: no heading both sites give one anchor for the card of ${m.name}`)
    }
    return h.github
  })
  let n = 0
  const text = draft.replaceAll(`href="#${CARD}"`, () => `href="#${anchors[n++]}"`)
  return { text, lead: lead || intro }
}

/** The overview page: every module, linked, with its lead sentence. */
const renderIndex = (pages) => {
  const row = (p) =>
    `| [${p.spec ? `\`${p.title}\`` : p.title}](${path.posix.relative(outDir, p.page)}) | ${cell(p.first)} |`
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

/**
 * The builtin modules with Nish source behind them (`src/nish-modules.ts`,
 * `isNishSourceModule`): a program imports `nish:region`, never `nish/region`,
 * which the compiler refuses. Each gets one page, from its `std/` source,
 * under its builtin name, in place of the `runtime/nish.d.ts` page.
 */
const SOURCE_MODULES = new Set(["region", "secret"])

const collectPages = (project) => {
  const pages = []
  const runtime = project.children.find((m) => m.name === "runtime/nish")
  if (!runtime) {
    throw new Error("gen-reference: TypeDoc read no runtime/nish module, so no builtin page can be made")
  }
  // A global nish.d.ts merges into one of TypeScript's own (`Array`,
  // `StringConstructor`) keeps only what nish.d.ts declares; one it does not
  // declare at all (`Array`'s constructor variable) is left out.
  const dtsLines = fs.readFileSync(path.join(root, "runtime/nish.d.ts"), "utf8").split("\n")
  // A variable's sources include the interfaces merged with it, so it counts
  // as declared here only on a `var`/`const`/`let` line of this file.
  const own = (r) =>
    r.sources?.some(
      (s) =>
        s.fileName === "runtime/nish.d.ts" &&
        (r.kind !== Kind.variable || /^\s*(?:declare\s+)?(?:var|const|let)\b/.test(dtsLines[s.line - 1]))
    )
  const ownOnly = (r) => ({
    ...r,
    children: r.children
      ?.filter(own)
      .map((c) => (c.signatures ? { ...c, signatures: c.signatures.filter(own) } : c))
      .filter((c) => !c.signatures || c.signatures.length > 0),
  })
  const globalList = runtime.children.filter((c) => c.kind !== Kind.module && own(c)).map(ownOnly)
  const globals = new Map(globalList.filter((c) => c.kind === Kind.func).map((c) => [c.name, c]))
  pages.push({
    mod: { children: globalList },
    spec: null,
    title: "Globals",
    source: "runtime/nish.d.ts",
    page: `${outDir}/builtins.md`,
    comment: leadingComment(dtsLines.join("\n")),
    intro: "",
  })
  for (const m of runtime?.children ?? []) {
    if (m.kind !== Kind.module) {
      continue
    }
    const name = m.name.replace(/^nish:/, "")
    if (SOURCE_MODULES.has(name)) {
      continue
    }
    const at = dtsLines.findIndex((l) => l.startsWith(`declare module ${JSON.stringify(m.name)}`))
    pages.push({
      mod: m,
      spec: m.name,
      title: m.name,
      source: "runtime/nish.d.ts",
      page: `${outDir}/nish-${name}.md`,
      // A `/** … */` above `declare module "nish:x"` is the page's module comment.
      comment: at < 0 ? "" : commentAbove(dtsLines, at),
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
    const builtin = SOURCE_MODULES.has(rel)
    const spec = builtin ? `nish:${rel}` : `nish/${rel}`
    pages.push({
      mod: m,
      spec,
      title: spec,
      source,
      page: `${outDir}/${builtin ? `nish-${rel}` : rel}.md`,
      comment: leadingComment(fs.readFileSync(path.join(root, source), "utf8")),
      intro: "",
      // Said whatever the module comment says, so the page names what to import.
      note: builtin
        ? `The \`${spec}\` builtin module, whose source is \`${source}\`. ` +
          `A program imports it as \`${spec}\`; the compiler refuses \`nish/${rel}\`. ` +
          "[The language reference](language.md#builtin-modules-nish) is the normative list."
        : "",
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

const oneLine = (v) => {
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
const printJson = (value, indent, prefix, suffix) => {
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

/** The line range `[open, close]` of the object `"key": {` that opens at or after `from`. */
const objectLines = (lines, key, from) => {
  const open = lines.findIndex((l, i) => i >= from && l.trimStart().startsWith(`${JSON.stringify(key)}: {`))
  if (open < 0) {
    throw new Error(`${configFile}: no ${JSON.stringify(key)} object to regenerate`)
  }
  const indent = indentOf(lines[open])
  if (/\}\s*,?$/.test(lines[open])) {
    return [open, open]
  }
  const close = lines.findIndex((l, i) => i > open && indentOf(l) === indent && /^\s*\},?$/.test(l))
  return [open, close]
}

/**
 * scalar.config.json with /reference's /language and /library routes and the
 * header's "Language reference" link regenerated. Every other line, the
 * hand-written /reference children included, is kept byte for byte.
 */
const configText = (text, pages) => {
  const config = JSON.parse(text)
  const reference = config.navigation.routes["/"].children["/reference"]
  const link = config.navigation.header.find((h) => h.title === "Language reference")
  if (!link) {
    throw new Error(`${configFile}: the header has no "Language reference" link to point at ${languageRoute}`)
  }
  const made = {
    "/language": { type: "page", title: languageTitle, filepath: languagePage },
    "/library": libraryRoutes(pages),
  }
  const keys = Object.keys(reference.children).filter((k) => !(k in made))
  const at = keys.indexOf("/standard-library")
  if (at < 0) {
    throw new Error(
      `${configFile}: /reference has no /standard-library route to place /language and /library after`
    )
  }
  keys.splice(at + 1, 0, ...Object.keys(made))
  const lines = text.split("\n")
  const [refOpen, refClose] = objectLines(lines, "/reference", 0)
  const [open, close] = objectLines(lines, "children", refOpen)
  if (close > refClose) {
    throw new Error(`${configFile}: /reference has no children object`)
  }
  // Each existing child's own lines, without the comma that separates it.
  const own = new Map()
  for (let i = open + 1; i < close; ) {
    const key = /^\s*"([^"]+)": /.exec(lines[i])?.[1]
    const [, end] = objectLines(lines, key, i)
    own.set(
      key,
      lines
        .slice(i, end + 1)
        .join("\n")
        .replace(/,$/, "")
    )
    i = end + 1
  }
  const indent = indentOf(lines[open]) + 2
  const children = keys.map((k, i) => {
    const comma = i < keys.length - 1 ? "," : ""
    return k in made ? printJson(made[k], indent, `${JSON.stringify(k)}: `, comma) : `${own.get(k)}${comma}`
  })
  let out = [...lines.slice(0, open + 1), ...children, ...lines.slice(close)].join("\n")
  if (link.to !== languageRoute) {
    const line = /("title": "Language reference",\s*"to": )"[^"]*"/
    if (!line.test(out)) {
      throw new Error(
        `${configFile}: the header's "Language reference" link is not written as { "type", "title", "to" }`
      )
    }
    out = out.replace(line, `$1"${languageRoute}"`)
  }
  // What was spliced as text must parse to what was meant.
  reference.children = Object.fromEntries(keys.map((k) => [k, made[k] ?? reference.children[k]]))
  link.to = languageRoute
  if (JSON.stringify(JSON.parse(out)) !== JSON.stringify(config)) {
    throw new Error(`${configFile}: the regenerated routes do not parse back to the routes meant`)
  }
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
  let inFence = false
  for (const [i, line] of lines.entries()) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
    }
    if (anchors.has(i)) {
      out.push(`<a id="${anchors.get(i)}" style="scroll-margin-top: 65px"></a>`, "")
    }
    if (inFence) {
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
  const args = process.argv.slice(2)
  const unknown = args.filter((a) => a !== "--check")
  if (unknown.length > 0) {
    console.error(`gen-reference: unknown argument ${unknown.join(" ")}; the one flag is --check`)
    process.exit(2)
  }
  const check = args.includes("--check")
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
    const before = JSON.parse(configBefore)
    const after = JSON.parse(configAfter)
    const routes = (c) => JSON.stringify(c.navigation.routes["/"].children["/reference"])
    const headerOf = (c) => JSON.stringify(c.navigation.header)
    const drift = []
    if (routes(before) !== routes(after)) {
      drift.push("the /reference routes")
    }
    if (headerOf(before) !== headerOf(after)) {
      drift.push('the header\'s "Language reference" link')
    }
    problems.push(`stale: ${configFile} (${drift.join(" and ") || "the layout of the /reference routes"})`)
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
