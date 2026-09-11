#!/usr/bin/env node
// Build a release's changelog from the commits it contains.
//
//   node scripts/changelog-gen.mjs --version 0.2.0 [--from <ref>] [--to <ref>]
//                                  [--write] [--stdout md|json]
//
// Writes `changelog/<version>.json` — the structured record — and renders
// Markdown from it for CHANGELOG.md and the GitHub release notes. JSON is the
// source and Markdown is a view of it, so the website and the repository
// cannot drift: there is one account of a release, rendered twice.
//
// Why the commits rather than a file maintained by hand: CHANGELOG.md is
// written when a release is cut, and the thing that knows what went into a
// release is the range of commits it contains. The subject line carries the
// classification and the body carries the explanation, so both survive into
// the record instead of the body being lost the way a subject-only generator
// loses it.
//
// The commit convention (see CLAUDE.md):
//
//   type(scope): imperative subject
//
//   The body, in prose. Markdown. This is what a reader of the release
//   notes gets, so write it for them and not only for the reviewer.
//
//   Measured: 1.58x on an element loop
//   Refs: docs/IR_COOKBOOK.md#arrays
//   Tests: tests/cases/arr_alias_domains
//   Release-Note: overrides the body for public notes, when the body is
//     about the review rather than about the change
//
// `type!` or a `BREAKING CHANGE:` trailer marks a breaking change. A subject
// that does not parse as a conventional commit is NOT dropped — it lands under
// `other` with its body intact, because a release that silently omits a change
// is worse than one with an untidy heading. The count of those is reported.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");

/** Conventional-commit types, in the order a release renders them. */
const TYPES = [
  ["feat", "Added"],
  ["fix", "Fixed"],
  ["perf", "Performance"],
  ["refactor", "Changed"],
  ["docs", "Documentation"],
  ["test", "Tests"],
  ["build", "Build"],
  ["ci", "CI"],
  ["chore", "Internal"],
  ["other", "Uncategorised"],
];

/**
 * Trailers that are bookkeeping rather than content. They are stripped from
 * every body: a release note is for the reader, and who co-authored a commit
 * or which session produced it is not part of what changed.
 */
const DROPPED_TRAILERS = /^(Co-Authored-By|Claude-Session|Signed-off-by|Reviewed-by):/i;

/** Trailers this tool reads. Everything else is left in the body. */
const KNOWN_TRAILERS = /^(Measured|Refs|Tests|Release-Note|BREAKING[ -]CHANGE):\s*(.*)$/i;

function git(args, quiet = false) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    // `git describe` with no tags writes "fatal: No names found" to stderr and
    // exits non-zero. That is an answer here, not a failure, so it is caught
    // below -- but inheriting stderr would print a fatal error during a run
    // that succeeded, which is how a green log gets read as a broken one.
    stdio: quiet ? ["ignore", "pipe", "ignore"] : undefined,
  });
}

/** The previous release tag, or undefined when this is the first release. */
function lastTag() {
  try {
    return git(["describe", "--tags", "--abbrev=0", "--match", "v*"], true).trim() || undefined;
  } catch {
    return undefined; // no tags yet: the first release covers the whole history
  }
}

/**
 * Split a commit body into prose and trailers. Only a trailing run of
 * trailer-shaped lines counts, so a colon inside the prose is safe.
 */
function splitTrailers(body) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const trailers = [];
  let end = lines.length;
  while (end > 0) {
    const line = lines[end - 1];
    if (line.trim() === "") {
      end -= 1;
      continue;
    }
    if (DROPPED_TRAILERS.test(line) || KNOWN_TRAILERS.test(line)) {
      trailers.unshift(line);
      end -= 1;
      continue;
    }
    break;
  }
  return { prose: lines.slice(0, end).join("\n").trim(), trailers };
}

function parseTrailers(lines) {
  const out = { metrics: [], refs: [], tests: [], releaseNote: undefined, breaking: undefined };
  for (const line of lines) {
    if (DROPPED_TRAILERS.test(line)) continue;
    const m = line.match(KNOWN_TRAILERS);
    if (!m) continue;
    const key = m[1].toLowerCase().replace(/[ -]/g, "");
    const value = m[2].trim();
    if (key === "measured") out.metrics.push(value);
    else if (key === "refs") out.refs.push(...value.split(",").map((s) => s.trim()).filter(Boolean));
    else if (key === "tests") out.tests.push(...value.split(",").map((s) => s.trim()).filter(Boolean));
    else if (key === "releasenote") out.releaseNote = value;
    else if (key === "breakingchange") out.breaking = value;
  }
  return out;
}

/** `type(scope)!: subject`, or undefined when the subject is not conventional. */
function parseSubject(subject) {
  const m = subject.match(/^([a-z]+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/);
  if (!m) return undefined;
  return { type: m[1], scope: m[2], bang: Boolean(m[3]), title: m[4].trim() };
}

/** A stable, human-readable anchor. The website links entries by this. */
function slug(title, taken) {
  const base =
    title
      .toLowerCase()
      .replace(/`[^`]*`/g, (s) => s.slice(1, -1))
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .split("-")
      .slice(0, 8)
      .join("-") || "entry";
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

function collect(from, to) {
  const range = from ? `${from}..${to}` : to;
  // \x00 between fields and \x1e between records: a commit body contains
  // newlines and may contain anything else, so the separators must be bytes
  // that cannot appear in one.
  const raw = git(["log", "--no-merges", "--reverse", `--format=%H%x00%an%x00%aI%x00%s%x00%b%x1e`, range]);
  const taken = new Set();
  const entries = [];
  let unconventional = 0;

  for (const record of raw.split("\x1e")) {
    const text = record.replace(/^\n/, "");
    if (!text.trim()) continue;
    const [sha, author, date, subject, body = ""] = text.split("\x00");
    const parsed = parseSubject(subject);
    if (!parsed) unconventional += 1;

    const { prose, trailers } = splitTrailers(body);
    const t = parseTrailers(trailers);
    const title = parsed ? parsed.title : subject;
    const pr = /\(#(\d+)\)\s*$/.exec(subject)?.[1];

    entries.push({
      id: slug(title, taken),
      type: parsed?.type && TYPES.some(([k]) => k === parsed.type) ? parsed.type : "other",
      scope: parsed?.scope,
      breaking: Boolean(parsed?.bang || t.breaking),
      breakingNote: t.breaking,
      title: title.replace(/\s*\(#\d+\)\s*$/, ""),
      body: t.releaseNote ?? prose,
      metrics: t.metrics,
      refs: t.refs,
      tests: t.tests,
      commits: [sha.slice(0, 7)],
      pr: pr ? Number(pr) : undefined,
      author,
      date: date.slice(0, 10),
    });
  }
  return { entries, unconventional };
}

function renderMarkdown(release) {
  const out = [];
  if (release.intro) out.push(release.intro.trim(), "");

  const breaking = release.entries.filter((e) => e.breaking);
  if (breaking.length > 0) {
    out.push("### Breaking changes", "");
    for (const e of breaking) out.push(...renderEntry(e, true));
  }

  for (const [type, heading] of TYPES) {
    const group = release.entries.filter((e) => e.type === type && !e.breaking);
    if (group.length === 0) continue;
    out.push(`### ${heading}`, "");
    for (const e of group) out.push(...renderEntry(e, false));
  }
  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function renderEntry(e, withBreakingNote) {
  // One bold run, not two: a conventional subject is lower case by convention
  // and this file's entries read as sentences, so the scope and the title are
  // joined and the first letter is raised. A title starting with `code` keeps
  // its backtick and its case.
  const title = e.title.startsWith("`") ? e.title : e.title.charAt(0).toUpperCase() + e.title.slice(1);
  const lines = [`- **${e.scope ? `${e.scope}: ` : ""}${title}**`];
  if (withBreakingNote && e.breakingNote) lines.push("", `  ${e.breakingNote}`);
  if (e.body) lines.push("", ...e.body.split("\n").map((l) => (l ? `  ${l}` : "")));
  const facts = [];
  if (e.metrics.length > 0) facts.push(`Measured: ${e.metrics.join("; ")}`);
  if (e.tests.length > 0) facts.push(`Tests: ${e.tests.map((t) => `\`${t}\``).join(", ")}`);
  if (facts.length > 0) lines.push("", `  ${facts.join(" · ")}`);
  lines.push("");
  return lines;
}

/**
 * The next version, from what the commits contain.
 *
 * Pre-1.0 semver: a breaking change moves the minor rather than the major,
 * because 0.x is the "anything may change" range and burning 1.0 on the first
 * breaking change would be a lie about stability. Reconsider at 1.0.
 */
function nextVersion(current, entries) {
  const [major, minor, patch] = current.split(".").map(Number);
  if (entries.some((e) => e.breaking)) return major === 0 ? `0.${minor + 1}.0` : `${major + 1}.0.0`;
  if (entries.some((e) => e.type === "feat")) return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

// ---- CLI ---------------------------------------------------------------------------------------

const argv = process.argv.slice(2);
function flag(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
}

// Validating one subject line. This lives here rather than in the workflow so
// that what CI enforces and what the generator parses are the same rule: a
// title the check accepts and the generator files under "Uncategorised" would
// be worse than no check at all.
const checkSubject = flag("check-subject", undefined);
if (checkSubject !== undefined) {
  const parsed = parseSubject(checkSubject);
  const types = TYPES.filter(([k]) => k !== "other").map(([k]) => k);
  if (!parsed) {
    console.error(`not a conventional commit subject:\n\n    ${checkSubject}\n`);
    console.error(`Expected \`type(scope): subject\`, where type is one of: ${types.join(", ")}.`);
    console.error(`A \`!\` after the type or scope marks a breaking change.\n`);
    console.error(`Examples:\n    feat(checker): accept non-generic type aliases`);
    console.error(`    perf(codegen)!: hoist the array header out of element loops`);
    console.error(`\nThe subject becomes the heading in the release notes, so write it for a reader.`);
    process.exit(1);
  }
  if (!types.includes(parsed.type)) {
    console.error(`unknown type \`${parsed.type}\` in:\n\n    ${checkSubject}\n`);
    console.error(`Use one of: ${types.join(", ")}.`);
    process.exit(1);
  }
  if (/[.]$/.test(parsed.title)) {
    console.error(`subject ends with a full stop:\n\n    ${checkSubject}\n`);
    console.error("It is a heading, not a sentence.");
    process.exit(1);
  }
  console.log(`ok: ${parsed.type}${parsed.scope ? `(${parsed.scope})` : ""}${parsed.bang ? "!" : ""} — ${parsed.title}`);
  process.exit(0);
}

// Rendering an already-written release: the release job must publish exactly
// the file the release PR was reviewed with, not a fresh walk of the log that
// could differ by a commit.
const fromJson = flag("from-json", undefined);
if (fromJson) {
  const stored = JSON.parse(fs.readFileSync(fromJson, "utf8"));
  process.stdout.write(renderMarkdown(stored));
  process.exit(0);
}

const pkgVersion = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const version = flag("version", pkgVersion);
const from = flag("from", lastTag());
const to = flag("to", "HEAD");
const stdoutKind = flag("stdout", "md");
const write = argv.includes("--write");

const { entries, unconventional } = collect(from, to);

// `--next` answers the version and nothing else, for the release PR to name
// itself and to bump package.json with.
if (argv.includes("--next")) {
  process.stdout.write(`${nextVersion(pkgVersion, entries)}\n`);
  process.exit(0);
}

if (entries.length === 0) {
  console.error(
    `changelog-gen: no commits in ${from ? `${from}..${to}` : to}; a release with no changes is a mistake, not an empty section`
  );
  process.exit(1);
}

const introPath = path.join(root, "changelog", `${version}.intro.md`);
const release = {
  version,
  date: new Date().toISOString().slice(0, 10),
  tag: `v${version}`,
  range: { from: from ?? null, to: git(["rev-parse", "--short", to]).trim() },
  intro: fs.existsSync(introPath) ? fs.readFileSync(introPath, "utf8").trim() : undefined,
  entries,
};

const jsonDir = path.join(root, "changelog");
const jsonPath = path.join(jsonDir, `${version}.json`);
const markdown = renderMarkdown(release);

if (write) {
  fs.mkdirSync(jsonDir, { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(release, null, 2)}\n`);

  // Splice the rendered section into CHANGELOG.md under `## [Unreleased]`,
  // which is where the file's own header says a release section goes.
  const changelogPath = path.join(root, "CHANGELOG.md");
  const current = fs.readFileSync(changelogPath, "utf8");
  const marker = "## [Unreleased]";
  if (!current.includes(marker)) {
    console.error(`changelog-gen: CHANGELOG.md has no \`${marker}\` heading to write under`);
    process.exit(1);
  }
  const section = `${marker}\n\n## [${version}] - ${release.date}\n\n${markdown}`;
  let next = current.replace(marker, section);
  const link = `[${version}]: https://github.com/amritk/nish/releases/tag/v${version}`;
  if (!next.includes(link)) next = `${next.trimEnd()}\n${link}\n`;
  fs.writeFileSync(changelogPath, next);

  console.error(`changelog-gen: wrote changelog/${version}.json and the CHANGELOG.md section`);
}

if (unconventional > 0) {
  console.error(
    `changelog-gen: ${unconventional} of ${entries.length} commits are not conventional and landed under "Uncategorised"`
  );
}

process.stdout.write(stdoutKind === "json" ? `${JSON.stringify(release, null, 2)}\n` : markdown);
