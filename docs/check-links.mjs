#!/usr/bin/env node
// Check every relative Markdown link (and heading anchor) in the repository's docs.
//
//   node docs/check-links.mjs            exit 1 and list every broken link
//
// Scans README.md, CHANGELOG.md, std/README.md, and docs/**/*.md. For each `[text](target)` or
// `[ref]: target` outside a fenced code block: http(s)/mailto targets are
// skipped; a relative path must exist; a `#fragment` must match a heading of
// the target file (GitHub slug rules: lower-case, punctuation removed, spaces
// to `-`, duplicates suffixed `-1`, `-2`, ...). A bare `#fragment` refers to
// the current file. Absolute paths and directories are allowed as targets.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function listMarkdown(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      out.push(...listMarkdown(full));
    } else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

const files = ["README.md", "CHANGELOG.md", "std/README.md"]
  .map((f) => path.join(root, f))
  .filter((f) => fs.existsSync(f))
  .concat(listMarkdown(path.join(root, "docs")));

/** Lines of a file with fenced code blocks blanked out (links inside them are not links). */
function proseLines(text) {
  let inFence = false;
  return text.split("\n").map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return "";
    }
    return inFence ? "" : line;
  });
}

/** GitHub-style heading slugs for a Markdown file, in order. */
function headingSlugs(text) {
  const seen = new Map();
  const slugs = new Set();
  for (const line of proseLines(text)) {
    const m = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    let slug = m[1]
      .replace(/`([^`]*)`/g, "$1") // inline code keeps its text
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links keep their text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-");
    const n = seen.get(slug) ?? 0;
    seen.set(slug, n + 1);
    if (n > 0) slug = `${slug}-${n}`;
    slugs.add(slug);
  }
  return slugs;
}

const slugCache = new Map();
function slugsOf(file) {
  if (!slugCache.has(file)) slugCache.set(file, headingSlugs(fs.readFileSync(file, "utf8")));
  return slugCache.get(file);
}

// Inline links `[text](target)` (target up to the first unbalanced `)`) and reference definitions `[ref]: target`.
const INLINE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const REFDEF = /^\s*\[[^\]]+\]:\s*(\S+)/;

const problems = [];
let checked = 0;
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  proseLines(text).forEach((line, index) => {
    const targets = [];
    for (const m of line.matchAll(INLINE)) targets.push(m[1]);
    const ref = REFDEF.exec(line);
    if (ref) targets.push(ref[1]);
    for (let target of targets) {
      target = target.replace(/^<|>$/g, "");
      if (/^(https?:|mailto:|tel:)/i.test(target)) continue;
      checked++;
      const [pathPart, fragment] = target.split("#");
      const where = `${path.relative(root, file)}:${index + 1}`;
      let resolved = file;
      if (pathPart) {
        resolved = path.resolve(path.dirname(file), decodeURIComponent(pathPart));
        if (!fs.existsSync(resolved)) {
          problems.push(`${where}: broken link \`${target}\` (no such file: ${path.relative(root, resolved)})`);
          continue;
        }
      }
      if (fragment !== undefined && fragment !== "") {
        if (!resolved.endsWith(".md") || fs.statSync(resolved).isDirectory()) continue;
        if (!slugsOf(resolved).has(fragment.toLowerCase())) {
          problems.push(`${where}: broken anchor \`${target}\` (no heading #${fragment} in ${path.relative(root, resolved)})`);
        }
      }
    }
  });
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} broken link(s) in ${files.length} files (${checked} links checked)`);
  process.exit(1);
}
console.log(`ok: ${checked} links in ${files.length} Markdown files`);
