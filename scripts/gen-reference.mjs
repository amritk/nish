#!/usr/bin/env node
// Generate the library reference, docs/reference/**, from the sources.
//
//   node scripts/gen-reference.mjs                     rewrite docs/reference/ and its routes
//   node scripts/gen-reference.mjs --check             exit 1 naming each stale, missing or extra
//                                                      page, a stale route and each documentation
//                                                      gap scripts/undocumented.txt disagrees with;
//                                                      write nothing
//   node scripts/gen-reference.mjs --update-baseline   also rewrite scripts/undocumented.txt,
//                                                      refusing to add a line to it
//   node scripts/gen-reference.mjs --grow-baseline     the same, adding lines: only for a change
//                                                      to the rule itself
//
// A public declaration of std/ or nish.d.ts needs a doc comment, a `@param` per
// parameter and a `@returns` for a return other than `void` or `never`
// (findGaps). scripts/undocumented.txt lists the gaps that predate the rule and
// only shrinks: a gap it does not list, or a line that is no longer a gap,
// fails --check (and the plain run, once it has written the pages).
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
// The compiler reference is generated beside it: docs/reference/diagnostics.md
// from the rule tables of src/codes.ts, with each tests/wordings/ example and
// its .err, and tests/wordings/unreachable.txt's reason for a code no program
// provokes; docs/reference/command-line.md from `helpText` in
// src/cli-style.ts, read as a TypeScript AST.
//
// The routes go to scalar.config.json under /reference: /reference/language
// for docs/LANGUAGE.md, the /reference/library group holding every library
// page, and the /reference/compiler group holding the two compiler pages. Only the /reference group's text is rewritten, in the
// one-line-when-it-fits layout the rest of the file keeps.
//
// Output is byte-deterministic: TypeDoc sorts each module's members, modules
// and routes are sorted here, and no page holds a time or an absolute path.
import fs from "node:fs"
import path from "node:path"
import { Application, ReflectionKind } from "typedoc"
import ts from "typescript"
import { parseCodesRegistry } from "./codes-registry.js"

const root = path.resolve(import.meta.dirname, "..")
const outDir = "docs/reference"
const configFile = "scalar.config.json"
const repoUrl = "https://github.com/amritk/nish/blob/main"
const languageRoute = "/reference/language"
// Not "Language reference", the header link's title, nor "The language", the guide's group.
const languageTitle = "Language specification"
const languageSource = "docs/LANGUAGE.md"
const languagePage = `${outDir}/language.md`
/** One page per `##` section of the spec, beside its index. */
const languageDir = `${outDir}/language`
const width = 110
const baselineFile = "scripts/undocumented.txt"

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
      // A public declaration with no doc comment is a gap; findGaps collects them.
      validation: { invalidLink: true, notExported: false, notDocumented: true, rewrittenLink: false },
      requiredToBeDocumented: [
        "Function",
        "Class",
        "Constructor",
        "Interface",
        "Method",
        "Property",
        "Accessor",
        "Variable",
        "TypeAlias",
        "Enum",
        "EnumMember",
      ],
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
  // path, stay warnings.) Its notDocumented warnings are taken, not logged:
  // each names one undocumented reflection, and findGaps weighs them against
  // the baseline.
  const unresolved = []
  const undocumented = []
  const warn = app.logger.validationWarning.bind(app.logger)
  app.logger.validationWarning = (message, ...rest) => {
    const gap = /^(.+) \(\w+\), defined in .+, does not have any documentation$/.exec(String(message))
    if (gap) {
      undocumented.push(gap[1])
      return
    }
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
  return { project: app.serializer.projectToObject(project, root), gaps: findGaps(project, undocumented) }
}

/**
 * Every public declaration that lacks its documentation, as the sorted keys
 * of scripts/undocumented.txt: `module.Name.member` for a declaration with no
 * doc comment (TypeDoc's notDocumented names, passed in as `undocumented`),
 * `module.Name#param:p` for a parameter with no `@param`, and
 * `module.Name#returns` for a signature returning other than `void` or `never`
 * with no `@returns`. The signatures read are a function's or method's, a
 * constructor's, an accessor's and an interface's call signatures; a
 * constructor or setter returns nothing to document.
 *
 * A member TypeScript's own lib declares is not ours to document: nish.d.ts
 * merges into lib interfaces such as `Array`, and TypeDoc then names lib
 * members (and the members of their type literals) as if nish.d.ts declared
 * them. One is skipped when it, or a reflection above it, is declared only
 * under node_modules/typescript/lib.
 */
const findGaps = (project, undocumented) => {
  const lib = path.join(root, "node_modules", "typescript", "lib") + path.sep
  const fromLib = (r) => {
    for (let at = r; at && !at.isProject(); at = at.parent) {
      const files = (at.sources ?? []).map((s) => s.fullFileName)
      if (files.length > 0 && files.every((f) => f.startsWith(lib))) {
        return true
      }
    }
    return false
  }
  const byName = new Map()
  for (const r of Object.values(project.reflections)) {
    const name = r.getFriendlyFullName()
    byName.set(name, [...(byName.get(name) ?? []), r])
  }
  const gaps = new Set()
  for (const name of undocumented) {
    const rs = byName.get(name) ?? []
    if (rs.length === 0 || !rs.every(fromLib)) {
      gaps.add(name)
    }
  }
  const signed =
    ReflectionKind.FunctionOrMethod |
    ReflectionKind.Constructor |
    ReflectionKind.Accessor |
    ReflectionKind.Interface
  for (const r of project.getReflectionsByKind(signed)) {
    const name = r.getFriendlyFullName()
    const sigs = [...(r.signatures ?? []), r.getSignature, r.setSignature].filter(Boolean)
    for (const sig of sigs) {
      if (fromLib(sig)) {
        continue
      }
      for (const p of sig.parameters ?? []) {
        if (!p.hasComment()) {
          gaps.add(`${name}#param:${p.name}`)
        }
      }
      // scripts/typedoc-nish-widths.mjs keeps a return type as its source text.
      const silent =
        ["void", "never"].includes(String(sig.type)) ||
        sig.kind === ReflectionKind.ConstructorSignature ||
        sig.kind === ReflectionKind.SetSignature
      if (!silent && !(sig.comment ?? r.comment)?.getTag("@returns")) {
        gaps.add(`${name}#returns`)
      }
    }
  }
  return [...gaps].sort()
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

/** The title of a code block that reads as TypeScript: Scalar shows it above the block. */
const EXAMPLE = "example.ts"

/**
 * A code block's fence info: `ts` with the title `example.ts` when TypeScript
 * parses it, `text` and no title for a diagram or a table.
 */
const fenceLang = (code) =>
  ts.transpileModule(code, { reportDiagnostics: true }).diagnostics.length === 0 ? `ts ${EXAMPLE}` : "text"

/**
 * Each titled block that starts a line, in a code group of one: Scalar shows a
 * block's title only as a code group's tab.
 */
const codeGroups = (md) =>
  md.replace(new RegExp(`^\`\`\`ts ${EXAMPLE.replace(".", "\\.")}\n[\\s\\S]*?\n\`\`\`$`, "gm"), (block) =>
    tag("scalar-code-group", "", block)
  )

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
        level,
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

/** A list item's first line: its marker and the space after it. */
const listMarker = /^\s*(?:[-*+]|\d+[.)]) /

/**
 * A paragraph's lines joined into one, each list item on a line of its own. A
 * line that opens with `- ` or `1. ` is an item only where a list can be: as
 * the paragraph's first line, after a line ending in a colon, or after another
 * item. Elsewhere it is prose that wrapped there (`... costs\n- 1 ...`), and
 * joins with a space.
 */
const joinLines = (para) => {
  let inList = false
  let out = ""
  for (const [i, raw] of para.split("\n").entries()) {
    const line = raw.trim()
    const item = listMarker.test(line) && (i === 0 || inList || out.endsWith(":"))
    inList = item || (inList && !listMarker.test(line) && line !== "")
    out = i === 0 ? line : `${out}${item ? "<br>" : " "}${line}`
  }
  return out.trim()
}

/**
 * Markdown on one line, for a table cell: a code block's lines become code
 * spans, and each list item starts a line of its own.
 */
const cell = (md) =>
  md
    .replace(/```[^\n]*\n([\s\S]*?)```/g, (_, body) =>
      body
        .trim()
        .split("\n")
        .map((l) => `\`${l.trim()}\``)
        .join("<br>")
    )
    .split(/\n\s*\n/)
    .map(joinLines)
    .join("<br><br>")
    .replace(/\|/g, "\\|")

/**
 * What `cell` must make of a doc comment's lists, checked on every run: a
 * paragraph that opens with a list, a list after a colon, and prose that
 * wrapped onto a line opening with `- `.
 */
const CELL_CASES = [
  ["- a\n- b\n- c", "- a<br>- b<br>- c"],
  ["Values:\n- a\n- b", "Values:<br>- a<br>- b"],
  ["costs\n- 1 more than", "costs - 1 more than"],
  ["- a\n  continued\n- b", "- a continued<br>- b"],
  ["1. x\n2. y", "1. x<br>2. y"],
  ["- a", "- a"],
]

/**
 * Section bodies and the lead `leadOf` gives each: a list item's unindented
 * continuation keeps the list going, so later items stay out of the lead.
 */
const LEAD_CASES = [["- a\ncont\n- b\n- c", "a cont"]]

/**
 * Each `CELL_CASES` input whose cell, and each `LEAD_CASES` input whose lead,
 * is not the one expected, as a problem.
 */
const cellCaseProblems = () => [
  ...CELL_CASES.filter(([md, want]) => cell(md) !== want).map(
    ([md, want]) => `cell(${JSON.stringify(md)}) is ${JSON.stringify(cell(md))}, not ${JSON.stringify(want)}`
  ),
  ...LEAD_CASES.filter(([md, want]) => leadOf(md.split("\n")) !== want).map(
    ([md, want]) =>
      `leadOf(${JSON.stringify(md)}) is ${JSON.stringify(leadOf(md.split("\n")))}, not ${JSON.stringify(want)}`
  ),
]

/** The one icon of each kind of entry a page shows as a card. */
const ICONS = {
  function: "phosphor/regular/function",
  class: "phosphor/regular/cube",
  interface: "phosphor/regular/cube",
  object: "phosphor/regular/cube",
  type: "phosphor/regular/shapes",
  constant: "phosphor/regular/hash",
}

/**
 * A card's title, with a zero-width space where a long identifier may break
 * (`hkdfExpand`, `TLS_MAX`): a card title does not wrap inside a word, and an
 * unbroken name is wider than a phone's screen.
 */
const cardTitle = (s) => s.replace(/([a-z0-9])(?=[A-Z])|_(?=\w)/g, (m) => `${m}\u200b`)

/** Cards in a grid, or the one card alone: a grid of one is a lone card stretched oddly. */
const grid = (cards) => (cards.length === 1 ? cards[0] : tag("scalar-grid", 'cols="2"', cards.join("\n\n")))

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
  let hash = frag === undefined ? "" : `#${frag}`
  let to = rel
  if (rel === languageSource) {
    const at = languageTarget(frag)
    if (at === null) {
      return null
    }
    ;({ page: to, hash } = at)
  }
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
    usage = `\`\`\`ts ${EXAMPLE}\n${lines.join("\n")}\n\`\`\``
  }
  // A unit is a detail when it opens with bold: a title (`**Title.** rest`,
  // `**Title**: rest`), or after the first unit, any bold phrase.
  const boldTitle = (para) => /^\*\*(.+?)\*\*/.exec(para)
  const isTitled = (para, bold) => /[.:]$/.test(bold[1]) || /^[.:]/.test(para.slice(bold[0].length))
  const opensDetail = (para, i) => {
    const bold = boldTitle(para)
    return bold !== null && (i > 0 || isTitled(para, bold))
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
  // Each prose block with the lists and code blocks that follow it, and the
  // paragraphs indented by one space: those carry on the paragraph before them,
  // so a long detail or warning broken into paragraphs stays under its title.
  const units = []
  const carriesOn = (b) => indentOf(b[0]) === 1
  // Code blocks with only a blank line between them are one example, as the usage is.
  const merged = []
  for (const b of blocks) {
    if (isCode(b) && merged.length > 0 && isCode(merged.at(-1))) {
      merged.at(-1).push("", ...b)
    } else {
      merged.push([...b])
    }
  }
  for (const b of merged) {
    let body = b.map((l) => l.trim()).join("\n")
    if (isCode(b)) {
      body = code(b)
    } else if (isList(b)) {
      body = dedent(b).join("\n")
    }
    if (units.length > 0 && (isCode(b) || isList(b) || carriesOn(b))) {
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
    const bold = boldTitle(unit[0])
    if (!opensDetail(unit[0], i)) {
      const [first, ...rest] = unit.map(prose)
      // The summary callout is one paragraph; what follows it is the page's body.
      return i === 0
        ? [tag("scalar-callout", 'type="info"', first), ...rest]
        : [[first, ...rest].join("\n\n")]
    }
    // The title keeps its code spans as written: an attribute cannot hold Markdown.
    const title = bold[1].replace(/[.:]$/, "")
    const head = isTitled(unit[0], bold) ? unit[0].slice(bold[0].length).replace(/^[.:]/, "").trim() : unit[0]
    const body = [head, ...unit.slice(1)].map(prose).join("\n\n").trim()
    return [tag("scalar-detail", `title="${attr(title)}"`, body)]
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

const header = (source, change = "the source's doc comments") =>
  `<!-- Generated by scripts/gen-reference.mjs from ${source}. Do not edit by hand: change ${change} and run \`node scripts/gen-reference.mjs\`. -->`

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
  const out = [`### ${f.name}`]
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
    out.push(`\`\`\`ts\n${signatureText(`function ${f.name}`, sig)}\n\`\`\``, ...signatureFields(sig, c, ctx))
  }
  return out.join("\n\n")
}

/**
 * One field per parameter of `sig`, then its return unless `void`, each
 * described by the matching tag of `c`, the signature that carries the docs.
 */
const signatureFields = (sig, c, ctx) => {
  const out = []
  for (const [j, p] of (sig.parameters ?? []).entries()) {
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
  const ret = typeText(sig.type)
  if (ret !== "void") {
    out.push(tag("scalar-field", `name="returns" type="${attr(ret)}"`, blockTag(c.comment, "@returns", ctx)))
  }
  return out
}

const renderType = (t, ctx) => {
  const out = [`### ${t.name}`]
  const desc = summary(t.comment, ctx)
  if (desc) {
    out.push(desc)
  }
  out.push(`\`\`\`ts\ntype ${t.name}${typeParams(t.typeParameters)} = ${typeText(t.type)}\n\`\`\``)
  return out.join("\n\n")
}

const renderClass = (c, ctx) => {
  const out = [`### ${c.name}`]
  const desc = summary(c.comment, ctx)
  if (desc) {
    out.push(desc)
  }
  const word = c.kind === Kind.klass ? "class" : "interface"
  out.push(`\`\`\`ts\n${word} ${c.name}${typeParams(c.typeParameters)}\n\`\`\``)
  // An interface's call signatures, each shown as a function's would be.
  for (const sig of c.signatures ?? []) {
    const sigDesc = summary(sig.comment, ctx)
    if (sigDesc) {
      out.push(sigDesc)
    }
    out.push(`\`\`\`ts\n${signatureText(c.name, sig)}\n\`\`\``, ...signatureFields(sig, sig, ctx))
  }
  const rows = (c.children ?? []).flatMap((m) => memberRow(m, c.name, ctx))
  if (rows.length > 0) {
    out.push(["| Member | |", "| --- | --- |", ...rows].join("\n"))
  }
  return out.join("\n\n")
}

const renderObject = (o, ctx) => {
  const out = [`### ${o.name}`]
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
    return tag("scalar-card", `title="${attr(cardTitle(value ?? v.name))}" icon="${ICONS.constant}"`, body)
  })
  return `## ${heading}\n\n${grid(cards)}`
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
  // Scalar cuts a heading at a bare colon (`# nish:fs` renders as "nish");
  // an escaped one is a colon on both sites.
  const out = [header(source), `# ${title.replace(/:/g, "\\:")}`]
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
    // A function's card reads its first signature; an interface's, its own doc.
    const doc =
      m.signatures && m.kind === Kind.func
        ? (m.signatures[0].comment ?? fallback?.get(m.name)?.signatures?.[0]?.comment)
        : m.comment
    const first = firstSentence(summary(doc, ctx).split(/\n\s*\n/)[0] ?? "")
    // The anchor is filled in once the page's headings are known (see below).
    return tag("scalar-card", `title="${attr(cardTitle(m.name))}" icon="${icon}" href="#${CARD}"`, first)
  }
  const interfaces = classes.filter((c) => c.kind === Kind.iface)
  const klasses = classes.filter((c) => c.kind === Kind.klass)
  const sections = [...funcs, ...klasses, ...interfaces, ...objects]
  const kindOf = (m) =>
    ({ [Kind.func]: "function", [Kind.klass]: "class", [Kind.iface]: "interface" })[m.kind] ?? "object"
  // A page of one member has its section right below; a card would only repeat it.
  if (sections.length > 1) {
    out.push(grid(sections.map((m) => cardOf(m, ICONS[kindOf(m)]))))
  }
  if (body) {
    out.push(body)
  }
  // One H2 per kind of member, one H3 per member under it.
  const byKind = [
    ["Functions", funcs, (f) => renderFunction(f, ctx, fallback?.get(f.name))],
    ["Classes", klasses, (c) => renderClass(c, ctx)],
    ["Interfaces", interfaces, (c) => renderClass(c, ctx)],
    ["Objects", objects, (o) => renderObject(o, ctx)],
    ["Types", types, (t) => renderType(t, ctx)],
  ]
  for (const [heading, list, render] of byKind) {
    if (list.length > 0) {
      out.push(`## ${heading}`, ...list.map(render))
    }
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
  // Each card links to its member's own `### name` heading, the first one
  // after the previous card's: `sha256` and `Sha256` share a slug, and the
  // second is numbered (`#sha256-1`), the same on GitHub and the docs site.
  const lines = draft.split("\n")
  const hs = headings(draft)
  let at = 0
  const anchors = sections.map((m) => {
    while (at < hs.length && lines[hs[at].index] !== `### ${m.name}`) {
      at++
    }
    const h = hs[at++]
    if (!h || h.github !== h.site) {
      throw new Error(`${page}: no heading both sites give one anchor for the card of ${m.name}`)
    }
    return h.github
  })
  let n = 0
  const text = codeGroups(draft.replaceAll(`href="#${CARD}"`, () => `href="#${anchors[n++]}"`))
  return { text, lead: lead || intro }
}

/** The overview page: a card per reference and per area, then every module, linked, with its lead sentence. */
const renderIndex = (pages) => {
  const rel = (file) => path.posix.relative(outDir, file)
  const row = (p) => `| [${p.spec ? `\`${p.title}\`` : p.title}](${rel(p.page)}) | ${cell(p.first)} |`
  const table = (ps) => ["| Module | |", "| --- | --- |", ...ps.map(row)].join("\n")
  const card = (title, icon, href, body) =>
    tag("scalar-card", `title="${title}" icon="phosphor/regular/${icon}" href="${href}"`, body)
  const builtin = pages.filter((p) => !p.spec || p.spec.startsWith("nish:"))
  const std = pages.filter((p) => p.spec?.startsWith("nish/"))
  const byArea = AREAS.map((area) => ({ area, ps: std.filter((p) => areaOf(p.spec) === area) }))
  const cards = [
    card(
      "Language specification",
      "book-open",
      rel(languagePage),
      "The normative rules: what the compiler accepts and what it means."
    ),
    card(
      "Builtins",
      "cube",
      rel(`${outDir}/builtins.md`),
      `The globals and the ${builtin.length - 1} \`nish:\` modules that come with the compiler.`
    ),
    ...byArea.map(({ area, ps }) =>
      card(
        area.title,
        area.icon,
        `#${slugOfHeading(area.title, false)}`,
        `${area.about}: ${ps.length} module${ps.length === 1 ? "" : "s"}.`
      )
    ),
    card("Command line", "terminal", rel(commandLinePage), "Every command, flag and exit code of `nish`."),
    card(
      "Diagnostics",
      "warning-circle",
      rel(diagnosticsPage),
      "Every diagnostic code, what it means and a program that provokes it."
    ),
  ]
  return `${[
    header("std/**/*.ts and runtime/nish.d.ts"),
    "# Library reference",
    "Every module a Nish program can import, one page each, generated from the doc comments of its source. " +
      "The builtins come with the compiler; the `nish/` modules are the standard library, written in Nish and grouped here by area. " +
      "The language specification and the compiler's own command line and diagnostics are references too.",
    tag("scalar-grid", 'cols="2"', cards.join("\n\n")),
    "## Builtins",
    table(builtin),
    "## Standard library",
    ...byArea.flatMap(({ area, ps }) => [`### ${area.title}`, table(ps)]),
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
  // A global's own signatures likewise: lib's `parseInt(string, radix?)` goes,
  // and so does a call signature only lib's interface declares.
  const ownSignatures = (r) => {
    const sigs = r.signatures?.filter(own)
    return sigs?.length ? sigs : undefined
  }
  const ownOnly = (r) => ({
    ...r,
    signatures: ownSignatures(r),
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
        `[the language reference](${languageLink("builtin-modules-nish", `${outDir}/nish-${name}.md`)}) is the normative list.`,
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
          `[The language reference](${languageLink("builtin-modules-nish", `${outDir}/nish-${rel}.md`)}) is the normative list.`
        : "",
    })
  }
  return pages.sort((a, b) => (a.page < b.page ? -1 : 1))
}

// ---- Routes ---------------------------------------------------------------

/** The /reference/language group: the spec's index, then its sections in order. */
const languageRoutes = () => {
  const [index, ...sections] = languageParts().parts
  const children = { "/": { type: "page", title: "Overview", filepath: index.page } }
  for (const sec of sections) {
    children[`/${sec.slug}`] = { type: "page", title: sec.title.replace(/`/g, ""), filepath: sec.page }
  }
  return { type: "group", title: languageTitle, children }
}

const routeTitle = (p) => (p.spec === null ? "Globals" : p.title)

/**
 * The library's areas, in reading order, each with the top-level names of
 * `std/` it holds (a directory's whole tree goes with its name). A module in
 * no area fails the run, so a new one is placed before it is published. `key`
 * is the area's route: a directory keeps its own, and `/<area>/..` keeps a
 * loose module's route at /reference/library/<module>.
 */
const AREAS = [
  {
    title: "Core",
    about: "Numbers, bytes, sorting, randomness and the test runner",
    key: "/core/..",
    icon: "atom",
    names: ["base64", "bytes", "math", "pair", "random", "sort", "testing"],
  },
  {
    title: "Collections",
    about: "`Map`, `Set` and the operations JavaScript lacks on them",
    key: "/collections-area/..",
    icon: "stack",
    names: ["collections", "map"],
  },
  {
    title: "Text",
    about: "Strings, regular expressions, JSON and YAML",
    key: "/text-area/..",
    icon: "text-aa",
    names: ["text", "regex", "json*", "yaml*"],
  },
  {
    title: "Terminal and CLI",
    about: "Terminal output and input, and command-line parsing",
    key: "/terminal/..",
    icon: "terminal-window",
    names: ["term*", "cli*"],
  },
  {
    title: "Concurrency",
    about: "Threads, locks, shared memory and queues between processes or a wasm page",
    key: "/concurrency/..",
    icon: "arrows-split",
    names: ["threads", "sync", "host"],
  },
  {
    title: "Data",
    about: "SQLite and compression",
    key: "/data/..",
    icon: "database",
    names: ["sqlite", "compress"],
  },
  {
    title: "Networking",
    about: "DNS, HTTP/1.1, HTTP/2, HTTP/3, QUIC, TLS and the server",
    key: "/net",
    icon: "globe",
    names: ["net"],
  },
  {
    title: "Cryptography",
    about: "Hashes, ciphers, signatures, certificates and passwords",
    key: "/crypto",
    icon: "lock-key",
    names: ["crypto"],
  },
]
/** The area a `std/` module (`nish/<path>`) sits in. */
const areaOf = (spec) => {
  const top = spec.slice("nish/".length).split("/")[0]
  const area = AREAS.find((a) =>
    a.names.some((n) =>
      n.endsWith("*") ? top === n.slice(0, -1) || top.startsWith(`${n.slice(0, -1)}-`) : top === n
    )
  )
  if (!area) {
    throw new Error(`${spec}: in no area of AREAS in scripts/gen-reference.mjs; add it to one`)
  }
  return area
}

/** The /reference/library group: the overview, the builtins, then std/ by area. */
const libraryRoutes = (pages) => {
  const page = (title, filepath) => ({ type: "page", title, filepath })
  const builtins = { "/": page("Globals", `${outDir}/builtins.md`) }
  const areas = new Map(AREAS.map((a) => [a, {}]))
  for (const p of pages) {
    if (p.spec?.startsWith("nish:")) {
      builtins[`/${path.posix.basename(p.page, ".md")}`] = page(routeTitle(p), p.page)
    } else if (p.spec?.startsWith("nish/")) {
      const area = areaOf(p.spec)
      // A directory that is the area itself (net, crypto) is not a level of its own.
      const parts = p.spec.slice("nish/".length).split("/")
      const inner = area.key === `/${parts[0]}` ? parts.slice(1) : parts
      let node = areas.get(area)
      if (inner.length === 0) {
        node["/"] = page(parts[0], p.page)
        continue
      }
      for (const dir of inner.slice(0, -1)) {
        const key = `/${dir}`
        if (node[key]?.type === "page") {
          node[key] = { type: "group", title: dir, children: { "/": node[key] } }
        }
        node[key] ??= { type: "group", title: dir, children: {} }
        node = node[key].children
      }
      const name = inner.at(-1)
      const key = `/${name}`
      if (node[key]?.type === "group") {
        node[key].children = { "/": page(name, p.page), ...node[key].children }
      } else {
        node[key] = page(name, p.page)
      }
    }
  }
  const sortTree = (tree) => {
    // "/" (the group's own page) first, then by name.
    const keys = Object.keys(tree).sort((a, b) => byText(a !== "/", b !== "/") || byText(a, b))
    const out = {}
    for (const k of keys) {
      const v = tree[k]
      out[k] = v.type === "group" ? { ...v, children: sortTree(v.children) } : v
    }
    return out
  }
  const children = {
    "/": page("Overview", `${outDir}/index.md`),
    "/builtins": { type: "group", title: "Builtins", children: sortTree(builtins) },
  }
  for (const [area, tree] of areas) {
    if (Object.keys(tree).length === 0) {
      throw new Error(`AREAS in scripts/gen-reference.mjs: ${area.title} holds no module`)
    }
    children[area.key] = { type: "group", title: area.title, children: sortTree(tree) }
  }
  return { type: "group", title: "Library reference", children }
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
 * scalar.config.json with /reference's /language, /library and /compiler routes and the
 * header's "Language reference" link regenerated, and /reference's children put
 * in the order the sidebar shows them. Every other line, the hand-written
 * /reference children included, is kept byte for byte.
 */
const configText = (text, pages) => {
  const config = JSON.parse(text)
  const reference = config.navigation.routes["/"].children["/reference"]
  const link = config.navigation.header.find((h) => h.title === "Language reference")
  if (!link) {
    throw new Error(`${configFile}: the header has no "Language reference" link to point at ${languageRoute}`)
  }
  const made = {
    "/language": languageRoutes(),
    "/library": libraryRoutes(pages),
    "/compiler": {
      type: "group",
      title: "Compiler reference",
      children: {
        "/command-line": { type: "page", title: "Command line", filepath: commandLinePage },
        "/diagnostics": diagnosticsRoutes(),
      },
    },
  }
  // The references first, then the hand-written pages: the overview of std/,
  // running under Node, then release material. A hand-written page this list
  // does not name keeps its place after them.
  const after = ["/standard-library", "/run-under-node", "/install", "/benchmarks", "/changelog"]
  const written = Object.keys(reference.children).filter((k) => !(k in made))
  if (!written.includes("/standard-library")) {
    throw new Error(
      `${configFile}: /reference has no /standard-library route, the overview the library reference sits beside`
    )
  }
  const keys = [
    ...Object.keys(made),
    ...after.filter((k) => written.includes(k)),
    ...written.filter((k) => !after.includes(k)),
  ]
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

let languageCache = null
/**
 * docs/LANGUAGE.md cut at its `##` headings: the part before the first (the
 * index's opening text), then one part per section, each with its lines
 * `[from, to)` and its page; and `home`, the part holding each heading by its
 * GitHub ID in the whole file, which is what every link into the spec names.
 */
const languageParts = () => {
  if (languageCache === null) {
    const lines = fs.readFileSync(path.join(root, languageSource), "utf8").split("\n")
    const hs = headings(lines.join("\n"))
    const parts = [{ page: languagePage, from: 0, title: null, slug: null }]
    for (const h of hs.filter((x) => x.level === 2)) {
      const title = lines[h.index].replace(/^##\s+/, "").trim()
      parts.push({ page: `${languageDir}/${h.github}.md`, from: h.index, title, slug: h.github })
    }
    for (const [i, part] of parts.entries()) {
      part.to = parts[i + 1]?.from ?? lines.length
      part.headings = hs.filter((h) => h.index >= part.from && h.index < part.to)
    }
    const home = new Map(hs.map((h) => [h.github, parts.findLast((p) => p.from <= h.index)]))
    languageCache = { lines, parts, home }
  }
  return languageCache
}

/**
 * Where the spec's anchor `frag` (none for the spec itself) is on the site:
 * its part's page, and the fragment, which a section's own title does not
 * need; null for an anchor the spec has no heading for.
 */
const languageTarget = (frag) => {
  const { parts, home } = languageParts()
  const part = frag === undefined ? parts[0] : home.get(frag.toLowerCase())
  if (part === undefined) {
    return null
  }
  return { page: part.page, hash: frag === undefined || frag.toLowerCase() === part.slug ? "" : `#${frag}` }
}

/** The link from `page` to the spec's anchor `frag`. */
const languageLink = (frag, page) => {
  const at = languageTarget(frag)
  if (at === null) {
    throw new Error(`${languageSource}: no heading #${frag}`)
  }
  return `${path.posix.relative(path.posix.dirname(page), at.page)}${at.hash}`
}

/**
 * docs/LANGUAGE.md as the docs site's pages: an index (its title, its opening
 * text and a card per section) and one page per `##` section, that heading
 * the page's title and each below it one level up. Links are rewritten for
 * where each page lives, a `#fragment` to the page holding its heading, and
 * an `<a id>` written above each heading whose ID on its page, on GitHub or
 * the docs site, is not its ID in the whole spec, so every anchor written for
 * LANGUAGE.md holds.
 */
const renderLanguage = (link) => {
  const { lines, parts } = languageParts()
  const relink = (target, page) => {
    if (/^(https?:|mailto:)/.test(target)) {
      return target
    }
    if (target.startsWith("#")) {
      return languageTarget(target.slice(1))?.page === page ? target : languageLink(target.slice(1), page)
    }
    const to = link(target, languageSource, page)
    if (to === null) {
      throw new Error(`${languageSource}: broken link ${target}`)
    }
    return to
  }
  const out = new Map()
  for (const part of parts) {
    let inFence = false
    const body = lines.slice(part.from, part.to).map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence
      }
      return !inFence && part.slug !== null && /^#{2,6}\s/.test(line) ? line.slice(1) : line
    })
    // Each heading's IDs on this page, beside the one the whole spec gave it.
    const local = headings(body.join("\n"))
    const anchors = new Map()
    for (const [k, h] of local.entries()) {
      const wanted = part.headings[k].github
      if (h.github !== wanted || h.site !== wanted) {
        const taken = local.some((o, j) => j !== k && (o.github === wanted || o.site === wanted))
        if (taken || [...anchors.values()].includes(wanted)) {
          throw new Error(`${part.page}: #${wanted} names two headings once the spec is split`)
        }
        anchors.set(h.index, wanted)
      }
    }
    const text = [
      `<!-- Generated by scripts/gen-reference.mjs from ${languageSource}. ` +
        "Do not edit by hand: change that file and run `node scripts/gen-reference.mjs`. -->",
      "",
    ]
    inFence = false
    for (const [i, line] of body.entries()) {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence
      }
      if (anchors.has(i)) {
        text.push(`<a id="${anchors.get(i)}" style="scroll-margin-top: 65px"></a>`, "")
      }
      if (inFence) {
        text.push(line)
        continue
      }
      // Links outside code spans: a `[` inside one is code, not a link.
      const code = [...line.matchAll(/(`+)[^`]*?\1/g)].map((m) => [m.index, m.index + m[0].length])
      const inCode = (at) => code.some(([a, b]) => at > a && at < b)
      text.push(
        line
          .replace(/\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g, (whole, target, title, at) =>
            inCode(at) ? whole : `](${relink(target, part.page)}${title})`
          )
          .replace(/^(\s*\[[^\]]+\]:\s*)(\S+)/, (_, head, target) => `${head}${relink(target, part.page)}`)
      )
    }
    if (part.slug === null) {
      while (text.at(-1) === "") {
        text.pop()
      }
      const cards = parts
        .slice(1)
        .map((sec) =>
          tag(
            "scalar-card",
            `title="${attr(sec.title.replace(/`/g, ""))}" icon="phosphor/regular/book-open" href="${path.posix.relative(outDir, sec.page)}"`,
            languageLead(sec)
          )
        )
      text.push("", tag("scalar-grid", 'cols="2"', cards.join("\n\n")), "")
    }
    out.set(part.page, text.join("\n"))
  }
  return out
}

/**
 * A section's first sentence, for its card, links dropped: its first paragraph
 * of prose, or, when the section opens with a list, its first item with the
 * item's bold lead unmarked. A list item's continuation lines, indented or
 * not, are the item's, never a paragraph of their own. As in `joinLines`, a
 * line opening with `- ` or `1. ` inside prose starts a list only after a
 * colon; elsewhere it is prose that wrapped there.
 */
const languageLead = (part) => {
  const { lines } = languageParts()
  return leadOf(lines.slice(part.from + 1, part.to))
}

/** `languageLead` of a section's lines, its heading left out. */
const leadOf = (lines) => {
  const para = []
  let inFence = false
  let inItem = false
  let opened = false
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      opened = true
      continue
    }
    if (inFence) {
      continue
    }
    if (listMarker.test(line)) {
      if (para.length > 0 && !inItem && !para.at(-1).endsWith(":")) {
        para.push(line.trim())
        opened = true
        continue
      }
      if (para.length > 0) {
        break
      }
      if (!opened) {
        para.push(line.replace(listMarker, "").trim())
      }
      inItem = true
      opened = true
      continue
    }
    if (inItem && line.trim() !== "" && !/^\s*[#|>]/.test(line)) {
      if (para.length > 0) {
        para.push(line.trim())
      }
      continue
    }
    inItem = false
    if (line.trim() === "") {
      if (para.length > 0) {
        break
      }
      continue
    }
    if (/^#/.test(line) || /^\s*[|>]/.test(line)) {
      if (para.length > 0) {
        break
      }
      opened = true
      continue
    }
    para.push(line.trim())
    opened = true
  }
  const lead = para.join(" ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
  return firstSentence(lead.replace(/^\*\*([\s\S]*?)\*\*/, "$1"))
}

// ---- The compiler reference -----------------------------------------------

const codesSource = "src/codes.ts"
const wordingsDir = "tests/wordings"
const unreachableSource = `${wordingsDir}/unreachable.txt`
const diagnosticsPage = `${outDir}/diagnostics.md`
/** One page per band of codes, beside the index. */
const bandPage = (band) => `${outDir}/diagnostics/nl${band}xxx.md`
const helpSource = "src/cli-style.ts"
const brandingSource = "src/branding.ts"
const commandLinePage = `${outDir}/command-line.md`
const guideCli = "docs/guide/using-nish/cli.md"

/** What each band of codes is about, in the guide's words for `--json`'s bands. */
const bands = [
  ["0", "syntax errors and the run"],
  ["1", "forbidden syntax"],
  ["2", "the type checker"],
  ["3", "modules and the driver"],
  ["4", "the interop sidecars"],
  ["7", "deprecation warnings"],
  ["8", "portability warnings"],
  ["9", "performance warnings"],
]

/** The /reference/compiler/diagnostics group: the index, then one page per band. */
const diagnosticsRoutes = () => {
  const children = { "/": { type: "page", title: "Overview", filepath: diagnosticsPage } }
  for (const [band, about] of bands) {
    children[`/nl${band}xxx`] = { type: "page", title: `NL${band}xxx: ${about}`, filepath: bandPage(band) }
  }
  return { type: "group", title: "Diagnostics", children }
}

/**
 * Band 0's codes, from their constants in `src/codes.ts`: each with the doc
 * comment above it, or above the declaration it follows when two share one.
 */
const bandZero = (text) => {
  const lines = text.split("\n")
  const out = []
  let shared = ""
  for (const [i, line] of lines.entries()) {
    const m = /^(?:export )?const ([A-Z]+): string = "(NL0\d{3})"$/.exec(line)
    if (!m) {
      shared = ""
      continue
    }
    shared = commentAbove(lines, i) || shared
    if (!shared) {
      throw new Error(`${codesSource}:${i + 1}: ${m[1]} has no doc comment to render`)
    }
    out.push({ code: m[2], name: m[1], prose: shared.trim() })
  }
  return out
}

/** `unreachable.txt`'s `CODE  reason` lines, by code. */
const unreachableCodes = (text) =>
  new Map(
    text
      .split("\n")
      .filter((l) => /^NL\d{4} {2}/.test(l))
      .map((l) => [l.slice(0, 6), l.slice(8).trim()])
  )

/** Every `tests/wordings/nl####_*.ts` example, with its `.err` and `.args`, by code. */
const wordingExamples = () => {
  const out = new Map()
  const dir = path.join(root, wordingsDir)
  for (const name of fs.readdirSync(dir).sort()) {
    const m = /^nl(\d{4})_.*\.ts$/.exec(name)
    if (!m) {
      continue
    }
    const base = path.join(dir, name.slice(0, -3))
    // Each file word for word, less the newline that ends it; only `.args` is optional.
    const read = (ext, optional) => {
      if (!fs.existsSync(base + ext)) {
        if (optional) {
          return ""
        }
        throw new Error(`${wordingsDir}/${name}: no ${path.basename(base + ext)} beside it`)
      }
      return fs.readFileSync(base + ext, "utf8").replace(/\r?\n$/, "")
    }
    const code = `NL${m[1]}`
    const list = out.get(code) ?? []
    list.push({
      file: `${wordingsDir}/${name}`,
      source: read(".ts"),
      err: read(".err"),
      args: read(".args", true).trim(),
    })
    out.set(code, list)
  }
  return out
}

/**
 * A rule's fragment as matched text: a fragment is a substring of the message,
 * so `…` marks an end that is cut. The examples say exactly where the message
 * starts and ends; with none, the markers are a guess: a start is whole when
 * it is capitalised or opens on code, and an end is cut when it stops on a
 * space or on punctuation that expects more.
 */
const fragmentText = (fragment, examples) => {
  const errs = examples.map((e) => e.err).filter((e) => e.includes(fragment))
  const whole =
    errs.length > 0
      ? [errs.some((e) => e.startsWith(fragment)), errs.some((e) => e.endsWith(fragment))]
      : [/^[A-Z`]/.test(fragment), !/[\s:;,(<=-]$/.test(fragment)]
  return `${whole[0] ? "" : "…"}${fragment}${whole[1] ? "" : "…"}`
}

/** A page's link to `target`, written relative to the page itself; a target that does not exist fails the run. */
const linkFrom = (link, page) => (target) => {
  const to = link(target, page, page)
  if (to === null) {
    throw new Error(`${page}: broken link ${target}`)
  }
  return to
}

/** The fence a block of text needs: one backtick longer than any run inside it. */
const fenceOf = (lang, text) => {
  const run = Math.max(2, ...[...text.matchAll(/`+/g)].map((m) => m[0].length))
  const ticks = "`".repeat(run + 1)
  return `${ticks}${lang}\n${text}\n${ticks}`
}

/**
 * docs/reference/diagnostics.md: every code, by band, with the rule it names,
 * whether a program can still provoke it, and each `tests/wordings` program
 * that does with the message it gets.
 */
const renderDiagnostics = (link) => {
  const text = fs.readFileSync(path.join(root, codesSource), "utf8")
  const ruleCount = Number(/\bRULE_COUNT: i32 = (\d+)/.exec(text)?.[1])
  if (!Number.isInteger(ruleCount)) {
    throw new Error(`${codesSource}: no \`RULE_COUNT: i32 = <n>\` to hold the page to`)
  }
  const tables = [
    ["diagnosticRules", "an error"],
    ["portabilityRules", "a warning `--warn-portability` turns on"],
    ["performanceRules", "a warning `--no-warn-performance` turns off"],
    ["deprecationRules", "a warning"],
  ]
  // Which table a code is in, from where the fragment line sits in the file.
  const starts = tables.map(([name, kind]) => {
    const at = text.indexOf(`const ${name} = `)
    if (at < 0) {
      throw new Error(`${codesSource}: no ${name} table`)
    }
    return { at, kind }
  })
  const kindAt = (code) => {
    const at = new RegExp(`^\\s*"${code}",?$`, "m").exec(text).index
    const before = starts.filter((s) => s.at < at)
    if (before.length === 0) {
      throw new Error(`${codesSource}: ${code} sits before every rule table`)
    }
    return before.reduce((a, b) => (b.at > a.at ? b : a)).kind
  }
  const rules = parseCodesRegistry(text, codesSource).map(({ fragment, code }) => ({
    code,
    fragment,
    kind: kindAt(code),
  }))
  const zero = bandZero(text)
  const unreachable = unreachableCodes(fs.readFileSync(path.join(root, unreachableSource), "utf8"))
  const examples = wordingExamples()
  const all = [...zero.map((z) => ({ code: z.code, name: z.name, prose: z.prose })), ...rules].sort((a, b) =>
    byText(a.code, b.code)
  )
  const page = diagnosticsPage
  // A link to a file of the repository, from `from`.
  const toFile = (from) => (file) => linkFrom(link, from)(path.posix.relative(path.posix.dirname(from), file))
  const to = toFile(page)
  const retired = [...unreachable.values()].filter((r) => r.startsWith("retired")).length
  const source = header(`${codesSource}, ${wordingsDir}/ and ${unreachableSource}`, "those files")
  const index = [
    source,
    "",
    "# Diagnostics",
    "",
    `Every diagnostic Nish prints carries a stable code, the \`code\` field of its [\`--json\`](${to(`${guideCli}#--json-for-tools`)}) object. ` +
      "A code is a promise: it names the same rule in every release, and a retired rule keeps its number so no other rule is ever handed it. " +
      `These pages list all ${all.length}, one page per band: the ${zero.length} of band 0, which no rule matches, and the ${ruleCount} rules \`${codesSource}\` holds, ${retired} of them retired.`,
    "",
    "A rule is matched by a fragment of its message: the longest literal run of the message's template, with the names, types and counts it interpolates cut out. " +
      "The fragment is matched as a substring, so `…` marks where the message goes on. " +
      `Each example is a program from \`${wordingsDir}/\` that the suite compiles, and the message it gets, word for word. ` +
      `[Reading diagnostics](${to(`${guideCli}#reading-diagnostics`)}) in the guide says how to act on one; ` +
      `the [command-line reference](${to(commandLinePage)}) lists the flags that turn the warnings on and off.`,
    "",
  ]
  const pages = new Map()
  const cards = []
  let count = 0
  for (const [band, about] of bands) {
    const inBand = all.filter((r) => r.code[2] === band)
    if (inBand.length === 0) {
      throw new Error(`${codesSource}: band NL${band}xxx has no code`)
    }
    const at = bandPage(band)
    const toHere = toFile(at)
    const codes = `${inBand.length} code${inBand.length === 1 ? "" : "s"}`
    cards.push(
      tag(
        "scalar-card",
        `title="NL${band}xxx" icon="phosphor/regular/warning-circle" href="${path.posix.relative(outDir, at)}"`,
        `${about[0].toUpperCase()}${about.slice(1)}: ${codes}.`
      )
    )
    // Scalar cuts a heading at a bare colon; an escaped one is a colon on both sites.
    const out = [
      source,
      "",
      `# NL${band}xxx\\: ${about}`,
      "",
      `The ${codes} of band ${band}. [Diagnostics](${toHere(diagnosticsPage)}) says what a code promises and how a rule's fragment is matched.`,
      "",
    ]
    for (const r of inBand) {
      count++
      const seen = examples.get(r.code) ?? []
      out.push(`## ${r.code}`, "")
      if (r.prose) {
        out.push(`\`${r.name}\` in \`${codesSource}\`. ${escapeProse(r.prose)}`, "")
      } else {
        out.push(
          `The message of ${r.kind} contains:`,
          "",
          fenceOf("text", fragmentText(r.fragment, seen)),
          ""
        )
      }
      const why = unreachable.get(r.code)
      if (why?.startsWith("retired")) {
        out.push(`**Retired**${escapeProse(why.slice("retired".length))}`, "")
      } else if (why) {
        out.push(`**No program provokes it**: ${escapeProse(why)}`, "")
      }
      for (const e of seen) {
        const flags = e.args ? ` (compiled with \`${e.args.split(/\s+/).join(" ")}\`)` : ""
        out.push(
          `[\`${path.posix.basename(e.file)}\`](${toHere(e.file)})${flags}:`,
          "",
          fenceOf("ts", e.source),
          "",
          fenceOf("text", e.err),
          ""
        )
      }
    }
    pages.set(at, `${out.join("\n").trimEnd()}\n`)
  }
  index.push(tag("scalar-grid", 'cols="2"', cards.join("\n\n")))
  pages.set(page, `${index.join("\n").trimEnd()}\n`)
  if (count !== ruleCount + zero.length || zero.length !== 4) {
    throw new Error(
      `${diagnosticsPage}: rendered ${count} codes, but ${codesSource} holds ${ruleCount} rules and 4 band-0 codes`
    )
  }
  const missing = [...examples.keys(), ...unreachable.keys()].filter((c) => !all.some((r) => r.code === c))
  if (missing.length > 0) {
    throw new Error(`${diagnosticsPage}: ${missing.join(", ")} is not a code ${codesSource} holds`)
  }
  return pages
}

/** The string a help argument spells: a literal, or a template whose only hole is `CLI`. */
const helpString = (node, sf, cli) => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text
  }
  if (
    ts.isTemplateExpression(node) &&
    node.templateSpans.every((s) => ts.isIdentifier(s.expression) && s.expression.text === "CLI")
  ) {
    return node.head.text + node.templateSpans.map((s) => cli + s.literal.text).join("")
  }
  const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
  throw new Error(
    `${helpSource}:${line}: \`${node.getText(sf)}\` is not a string literal or a \`CLI\` template`
  )
}

/**
 * `helpText`'s calls on its HelpMenu, in order, read from the TypeScript AST:
 * `{ method, args, agent }`, `agent` for the calls under `if (guide...)`. The
 * title and its rule carry the version and are not the page's to show; the
 * agent section's `value(guide)` is the rules card's path, known only at run
 * time, and comes back as `{ method: "guide" }`.
 */
const helpCalls = () => {
  const brand = ts.createSourceFile(
    brandingSource,
    fs.readFileSync(path.join(root, brandingSource), "utf8"),
    ts.ScriptTarget.Latest,
    true
  )
  let cli = null
  for (const s of brand.statements) {
    for (const d of ts.isVariableStatement(s) ? s.declarationList.declarations : []) {
      if (
        ts.isIdentifier(d.name) &&
        d.name.text === "CLI" &&
        d.initializer &&
        ts.isStringLiteral(d.initializer)
      ) {
        cli = d.initializer.text
      }
    }
  }
  if (cli === null) {
    throw new Error(`${brandingSource}: no \`const CLI = "<name>"\``)
  }
  const sf = ts.createSourceFile(
    helpSource,
    fs.readFileSync(path.join(root, helpSource), "utf8"),
    ts.ScriptTarget.Latest,
    true
  )
  const decl = sf.statements
    .filter(ts.isVariableStatement)
    .flatMap((s) => s.declarationList.declarations)
    .find((d) => ts.isIdentifier(d.name) && d.name.text === "helpText")
  if (!decl?.initializer || !ts.isArrowFunction(decl.initializer) || !ts.isBlock(decl.initializer.body)) {
    throw new Error(`${helpSource}: no \`const helpText = (...) => { ... }\``)
  }
  const calls = []
  // How many arguments each rendered `menu` method takes.
  const arity = { usage: 2, section: 1, row: 3, note: 1 }
  const at = (node) => `${helpSource}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`
  // Every statement is a declaration, the `return`, a `menu.*` call, or the
  // agents-only `if (guide.length > 0) { ... }`; anything else could hide a
  // row from the page, so it fails the run.
  const visit = (statements, agent) => {
    for (const s of statements) {
      if (ts.isVariableStatement(s) || ts.isReturnStatement(s)) {
        continue
      }
      if (
        !agent &&
        ts.isIfStatement(s) &&
        s.expression.getText(sf) === "guide.length > 0" &&
        ts.isBlock(s.thenStatement) &&
        !s.elseStatement
      ) {
        visit(s.thenStatement.statements, true)
        continue
      }
      const call = ts.isExpressionStatement(s) ? s.expression : null
      if (
        !call ||
        !ts.isCallExpression(call) ||
        !ts.isPropertyAccessExpression(call.expression) ||
        call.expression.expression.getText(sf) !== "menu"
      ) {
        throw new Error(
          `${at(s)}: helpText holds a statement this page cannot read; only \`menu.*\` calls are rendered`
        )
      }
      const method = call.expression.name.text
      if (method === "title" || method === "line") {
        continue
      }
      if (method === "value" && call.arguments.length === 1 && call.arguments[0].getText(sf) === "guide") {
        calls.push({ method: "guide", args: [], agent })
        continue
      }
      if (!(method in arity)) {
        throw new Error(`${at(s)}: helpText calls menu.${method}, which this page does not render`)
      }
      if (call.arguments.length !== arity[method]) {
        throw new Error(
          `${at(s)}: menu.${method} takes ${arity[method]} arguments here, not ${call.arguments.length}`
        )
      }
      calls.push({ method, args: call.arguments.map((a) => helpString(a, sf, cli)), agent })
    }
  }
  visit(decl.initializer.body.statements, false)
  return { cli, calls }
}

/**
 * docs/reference/command-line.md: `nish --help` as a page, one section per
 * section of the help, in its order, read from `helpText` in src/cli-style.ts.
 */
const renderCommandLine = (link) => {
  const { cli, calls } = helpCalls()
  const page = commandLinePage
  const to = linkFrom(link, page)
  const guide = (hash) => to(`../../${guideCli}${hash}`)
  const columns = (pairs) => {
    const w = Math.max(...pairs.map(([a]) => a.length))
    return pairs.map(([a, b]) => (b ? `${a.padEnd(w + 2)}${b}` : a)).join("\n")
  }
  const usage = calls.filter((c) => c.method === "usage").map((c) => [`${cli} ${c.args[0]}`, c.args[1]])
  const out = [
    header(`${helpSource} (\`helpText\`)`, "that function"),
    "",
    "# Command line",
    "",
    `Every flag \`${cli} --help\` lists, in the order and the groups it lists them. ` +
      `[The CLI](${guide("")}) in the guide shows them at work; ` +
      "the [diagnostic index](diagnostics.md) lists every code a check can report.",
    "",
    "## Usage",
    "",
    fenceOf("text", columns(usage)),
  ]
  let section = null
  let rows = []
  const flush = () => {
    if (section === "Examples") {
      out.push("", fenceOf("sh", columns(rows.map(([a, , d]) => [a, d ? `# ${d}` : ""]))))
    } else {
      for (const [flag, arg, desc] of rows) {
        out.push(
          "",
          tag("scalar-field", `name="${attr(flag)}"${arg ? ` type="${attr(arg)}"` : ""}`, escapeProse(desc))
        )
      }
    }
    rows = []
  }
  for (const c of calls) {
    if (c.method === "usage") {
      continue
    }
    if (c.method === "section") {
      flush()
      section = c.args[0]
      out.push("", `## ${section}`)
      if (c.agent) {
        out.push(
          "",
          tag(
            "scalar-callout",
            'type="info"',
            `\`${cli} --help\` prints this section only when an agent runs it: [Colour, and when an agent runs ${cli}](${guide("#colour-and-when-an-agent-runs-nish")}) says how it tells.`
          )
        )
      }
    } else if (c.method === "row") {
      rows.push(c.args)
    } else if (c.method === "note" && section === "Exit codes") {
      out.push(
        "",
        fenceOf("text", c.args[0]),
        "",
        `What each one means is the guide's [exit codes](${guide("#exit-codes")}) table.`
      )
    } else if (c.method === "note") {
      out.push("", escapeProse(c.args[0]))
    } else if (c.method === "guide") {
      out.push("", `[\`docs/AI.md\`](${to("../AI.md")}), at the path the install put it.`)
    } else {
      throw new Error(`${helpSource}: helpText calls menu.${c.method}, which this page does not render`)
    }
  }
  flush()
  return `${out.join("\n")}\n`
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

const baselineHeader = `# Public declarations of std/ and runtime/nish.d.ts that lack their documentation.
#
# This list only shrinks. \`node scripts/gen-reference.mjs --check\` fails on a gap
# it does not list and on a line that is no longer a gap: document the
# declaration and delete its line. \`--update-baseline\` rewrites the file and
# refuses to add a line; \`--grow-baseline\` adds them, only for a change to the rule.
# docs/README.md -> "The library reference" states the rule.
#
#   module.Name.member     the declaration has no doc comment
#   module.Name#param:p    parameter p has no @param
#   module.Name#returns    a return type other than void or never has no @returns
`

const baselineText = (gaps) => `${baselineHeader}\n${gaps.map((g) => `${g}\n`).join("")}`

const baselineRead = () => {
  const full = path.join(root, baselineFile)
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : ""
}

/** The gaps the baseline lists. */
const baselineLines = () =>
  new Set(
    baselineRead()
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("#"))
  )

/** The baseline's disagreements with the gaps found, one line each. */
const baselineProblems = (gaps) => {
  const text = baselineRead()
  const listed = baselineLines()
  const found = new Set(gaps)
  const problems = []
  for (const g of gaps) {
    if (!listed.has(g)) {
      problems.push(
        `undocumented: ${g}: a public declaration needs a doc comment, a @param per parameter and a @returns for a non-void return`
      )
    }
  }
  for (const l of listed) {
    if (!found.has(l)) {
      problems.push(`no longer a gap: ${l}: delete its line from ${baselineFile}`)
    }
  }
  if (problems.length === 0 && text !== baselineText(gaps)) {
    problems.push(
      `stale: ${baselineFile} (its header or order); run \`node scripts/gen-reference.mjs --update-baseline\``
    )
  }
  return problems
}

const main = async () => {
  const args = process.argv.slice(2)
  const flags = ["--check", "--update-baseline", "--grow-baseline"]
  const unknown = args.filter((a) => !flags.includes(a))
  const check = args.includes("--check")
  const grow = args.includes("--grow-baseline")
  const updateBaseline = grow || args.includes("--update-baseline")
  if (unknown.length > 0 || (check && updateBaseline)) {
    console.error(
      `gen-reference: ${unknown.length > 0 ? `unknown argument ${unknown.join(" ")}` : "--check writes nothing"}; the flags are --check, --update-baseline or --grow-baseline`
    )
    process.exit(2)
  }
  const cellProblems = cellCaseProblems()
  if (cellProblems.length > 0) {
    for (const p of cellProblems) {
      console.error(`gen-reference: ${p}`)
    }
    process.exit(1)
  }
  const { project, gaps } = await readProject()
  // The baseline only shrinks: --update-baseline drops lines and refuses to
  // add one. --grow-baseline adds them, for a change to the rule itself, and
  // names each so the reviewer reads them.
  if (updateBaseline) {
    const added = gaps.filter((g) => !baselineLines().has(g))
    if (added.length > 0 && !grow) {
      for (const g of added) {
        console.error(`gen-reference: undocumented: ${g}: document it; ${baselineFile} only shrinks`)
      }
      console.error(
        "gen-reference: --update-baseline adds no line; only a change to the rule itself may pass --grow-baseline, and its PR shows each added line"
      )
      process.exit(1)
    }
    for (const g of added) {
      console.log(`gen-reference: grows ${baselineFile}: ${g}`)
    }
  }
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
  for (const [file, text] of renderLanguage(link)) {
    want.set(file, text)
  }
  for (const [file, text] of renderDiagnostics(link)) {
    want.set(file, text)
  }
  want.set(commandLinePage, renderCommandLine(link))
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
  const gapProblems = updateBaseline ? [] : baselineProblems(gaps)
  if (check) {
    for (const p of [...problems, ...gapProblems]) {
      console.error(`gen-reference: ${p}`)
    }
    if (problems.length > 0) {
      console.error("gen-reference: the reference is out of date; run `node scripts/gen-reference.mjs`")
    }
    if (gapProblems.length > 0) {
      console.error(`gen-reference: the documentation gaps disagree with ${baselineFile}, which only shrinks`)
    }
    if (problems.length > 0 || gapProblems.length > 0) {
      process.exit(1)
    }
    console.log(
      `gen-reference: ${want.size} pages and their routes are up to date; ${gaps.length} gaps, each listed`
    )
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
  if (updateBaseline) {
    fs.writeFileSync(path.join(root, baselineFile), baselineText(gaps))
    console.log(`gen-reference: wrote ${baselineFile}; ${gaps.length} gaps`)
  } else if (gapProblems.length > 0) {
    for (const p of gapProblems) {
      console.error(`gen-reference: ${p}`)
    }
    process.exit(1)
  }
}

await main()
