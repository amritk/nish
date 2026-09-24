#!/usr/bin/env node
// Build a release's changelog from the commits it contains.
//
//   node scripts/changelog-gen.mjs --version 0.2.0 [--from <ref>] [--to <ref>]
//                                  [--write] [--stdout md|json]
//                                  [--include-unconventional]
//
// Writes `changelog/<version>.json` — the structured record — and renders
// Markdown from it for CHANGELOG.md and the GitHub release notes. JSON is the
// source and Markdown is a view of it, so the website and the repository
// cannot drift: there is one account of a release, rendered twice.
//
// The two views are not the same shape. The JSON keeps everything a commit
// said -- the prose, the `Measured:` numbers, the refs and the tests -- because
// the website renders an entry as a page. The Markdown is an index: one line
// per change, its title and a link to the pull request it landed in, grouped
// under the type's heading. A reader scanning CHANGELOG.md or a release body
// wants to know what changed and where to read the rest, and the pull request
// is where the rest already lives; repeating each body inline turned one
// release into pages of prose that nobody scrolled.
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
//   The body, in prose. Markdown. This is the entry's account on the
//   website, so write it for a reader and not only for the reviewer.
//
//   Measured: 1.58x on an element loop
//   Refs: docs/IR_COOKBOOK.md#arrays
//   Tests: tests/cases/arr_alias_domains
//   Release-Note: overrides the body for public notes, when the body is
//     about the review rather than about the change
//   Release-As: 1.0.0 -- the version the next release takes, when it is not
//     the one the types imply (see nextVersion)
//
// `type!` or a `BREAKING CHANGE:` trailer marks a breaking change.
//
// Only conventional subjects become entries. The release notes are the account
// of what a release changed, and a commit that did not say what it changed is
// not that account: `pr-title.yml` makes every squash-merge subject
// conventional, so what the filter removes is the history behind a merge
// commit -- the work-in-progress commits whose landed subject already has an
// entry -- and the commits that predate the convention. Nothing is dropped
// silently: every skipped subject is listed on stderr, and the
// `--include-unconventional` flag files them under "Uncategorised" the way this
// tool behaved before. Use it for the first release after the convention
// lands, or write the history up by hand in `changelog/<version>.intro.md`,
// which renders above the sections.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");

/**
 * The repository the entries link into, from `package.json#repository`. Read
 * from the manifest rather than hard-coded so a fork renders its own links,
 * and optional: without it an entry names `#38` as text instead of claiming a
 * URL it cannot know.
 */
const REPO_URL = (() => {
  try {
    const { repository } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const url = typeof repository === "string" ? repository : repository?.url;
    const m = /github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/.exec(url ?? "");
    return m ? `https://github.com/${m[1]}` : undefined;
  } catch {
    return undefined;
  }
})();

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
  // Only reachable under --include-unconventional; ordinarily a subject that
  // does not classify is skipped rather than filed here.
  ["other", "Uncategorised"],
];

/** The types a subject may name. `other` is this tool's bucket, not a type. */
const CONVENTIONAL_TYPES = TYPES.filter(([k]) => k !== "other").map(([k]) => k);

/**
 * Trailers that are bookkeeping rather than content. They are stripped from
 * every body: a release note is for the reader, and who co-authored a commit
 * or which session produced it is not part of what changed.
 */
const DROPPED_TRAILERS = /^(Co-Authored-By|Claude-Session|Signed-off-by|Reviewed-by):/i;

/** Trailers this tool reads. Everything else is left in the body. */
const KNOWN_TRAILERS = /^(Measured|Refs|Tests|Release-Note|Release-As|BREAKING[ -]CHANGE):\s*(.*)$/i;

/**
 * GitHub ends a squashed body with a rule when the branch had more than one
 * commit. It renders as an `<hr>` in the middle of the notes and says nothing,
 * so it goes the way the bookkeeping trailers do. It sits above the
 * co-authorship trailers rather than at the end, so it comes off the prose.
 */
const SQUASH_RULE = /\n[ \t]*\n[ \t]*-{3,}[ \t]*$/;

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
  const out = { metrics: [], refs: [], tests: [], releaseNote: undefined, releaseAs: [], breaking: undefined };
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
    else if (key === "releaseas") out.releaseAs.push(value);
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

/**
 * The entries a release contains, the subjects that did not become one, and
 * the `Release-As:` trailers the range carries.
 *
 * A subject that does not classify is skipped: `pr-title.yml` makes every
 * squash-merge subject conventional, so what is left over is the branch
 * history behind a merge commit -- already represented by the subject that
 * landed -- or a commit from before the convention. Both are noise in the
 * notes rather than content, and both used to be most of the file. The skipped
 * subjects are returned so the caller can report them; `includeUnconventional`
 * restores the old behaviour and files them under "Uncategorised".
 *
 * A trailer is read from every commit in the range, skipped or not: a version
 * someone asked for is not lost because the commit that asked was the
 * work-in-progress half of a merge.
 */
function collect(from, to, includeUnconventional = false) {
  const range = from ? `${from}..${to}` : to;
  // \x00 between fields and \x1e between records: a commit body contains
  // newlines and may contain anything else, so the separators must be bytes
  // that cannot appear in one.
  const raw = git(["log", "--no-merges", "--reverse", `--format=%H%x00%an%x00%aI%x00%s%x00%b%x1e`, range]);
  const taken = new Set();
  const entries = [];
  const skipped = [];
  const releaseAs = [];

  for (const record of raw.split("\x1e")) {
    const text = record.replace(/^\n/, "");
    if (!text.trim()) continue;
    const [sha, author, date, subject, body = ""] = text.split("\x00");
    const { prose: rawProse, trailers } = splitTrailers(body);
    const t = parseTrailers(trailers);
    for (const version of t.releaseAs) releaseAs.push({ version, commit: `${sha.slice(0, 7)} ${subject}` });

    const parsed = parseSubject(subject);
    const classified = parsed !== undefined && CONVENTIONAL_TYPES.includes(parsed.type);
    if (!classified) {
      skipped.push(`${sha.slice(0, 7)} ${subject}`);
      if (!includeUnconventional) continue;
    }

    const prose = rawProse.replace(SQUASH_RULE, "");
    const title = parsed ? parsed.title : subject;
    const pr = /\(#(\d+)\)\s*$/.exec(subject)?.[1];

    entries.push({
      id: slug(title, taken),
      type: classified ? parsed.type : "other",
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
  return { entries, skipped, releaseAs };
}

function renderMarkdown(release) {
  const out = [];
  if (release.intro) out.push(release.intro.trim(), "");

  const group = (predicate) => release.entries.filter(predicate).map(renderEntry);

  const breaking = group((e) => e.breaking);
  if (breaking.length > 0) out.push("### Breaking changes", "", ...breaking, "");

  for (const [type, heading] of TYPES) {
    const lines = group((e) => e.type === type && !e.breaking);
    if (lines.length === 0) continue;
    out.push(`### ${heading}`, "", ...lines, "");
  }
  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

/**
 * Where to read the rest of an entry: the pull request it landed in, or the
 * commit when it landed without one. Every line carries one, so the index
 * always leads somewhere.
 */
function entryLink(e) {
  if (e.pr) return REPO_URL ? `[#${e.pr}](${REPO_URL}/pull/${e.pr})` : `#${e.pr}`;
  const sha = e.commits[0];
  if (!sha) return undefined;
  return REPO_URL ? `[\`${sha}\`](${REPO_URL}/commit/${sha})` : `\`${sha}\``;
}

/**
 * One line: the scope, the title, and the link. A conventional subject is
 * lower case by convention and these read as sentences, so the scope and the
 * title are joined and the first letter is raised -- unless the title starts
 * with `code`, which keeps its backtick and its case.
 */
function renderEntry(e) {
  const title = e.title.startsWith("`") ? e.title : e.title.charAt(0).toUpperCase() + e.title.slice(1);
  const link = entryLink(e);
  return `- ${e.scope ? `${e.scope}: ` : ""}${title}${link ? ` (${link})` : ""}`;
}

/**
 * The version the commits imply, from their types, as `[major, minor, patch]`.
 *
 * Before 1.0 a breaking change moves the minor rather than the major, because
 * 0.x is the "anything may change" range and burning 1.0 on the first breaking
 * change would be a lie about stability. 1.0 is therefore never implied: it is
 * asked for, with a `Release-As:` trailer (see nextVersion). From 1.0 on the
 * same branch is ordinary semver -- a break moves the major, a `feat` the
 * minor, anything else the patch -- so nothing changes here when 1.0 is cut.
 */
function impliedVersion(current, entries, previousTag) {
  // The first release is 0.1.0 whatever the commits say. Every commit before
  // the convention existed is typed `other`, so a type-driven bump would read
  // the entire history as a patch and ship 0.0.1 — a number that would claim
  // the compiler is a bug-fix on nothing. 0.1.0 is also what the seed policy
  // already names as the base case (docs/wp12-release.md, "The bootstrap seed").
  if (!previousTag) return [0, 1, 0];
  const [major, minor, patch] = current.split(".").map(Number);
  if (entries.some((e) => e.breaking)) return major === 0 ? [0, minor + 1, 0] : [major + 1, 0, 0];
  if (entries.some((e) => e.type === "feat")) return [major, minor + 1, 0];
  return [major, minor, patch + 1];
}

/** `X.Y.Z` as three numbers, or undefined when it is not one. No `v`, no pre-release, no leading zeros. */
function parseVersion(text) {
  const m = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(text);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : undefined;
}

/** Negative, zero or positive as `a` is below, at or above `b`. */
function compareVersions(a, b) {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/**
 * The next version: the one the commits imply, unless a `Release-As: X.Y.Z`
 * trailer in the range asks for another. The highest trailer wins, and it may
 * only raise the version -- the implied one is a floor, so a trailer can cut
 * 1.0.0 over a range that implies 0.10.0, but it can never downgrade, and
 * never ship a patch where a `feat` asks for the minor.
 *
 * Returns `{ version }`, or `{ error }` naming the trailer and its commit when
 * one is malformed, below the floor, or disagrees with another trailer on the
 * same commit -- one commit asking for two versions has not said which it means. Neither is skipped: a trailer is a
 * human's decision about a number the release will carry for ever, and the
 * release PR proposing some other number without saying so would be worse than
 * the train stopping.
 */
function nextVersion(current, entries, previousTag, releaseAs = []) {
  const implied = impliedVersion(current, entries, previousTag);
  let chosen;
  const byCommit = new Map();
  for (const request of releaseAs) {
    const parsed = parseVersion(request.version);
    if (!parsed) {
      return {
        error: `malformed trailer \`Release-As: ${request.version}\` on ${request.commit}; the value is a version, X.Y.Z`,
      };
    }
    const earlier = byCommit.get(request.commit);
    if (earlier !== undefined && earlier !== request.version) {
      return {
        error: `two trailers on ${request.commit} disagree: \`Release-As: ${earlier}\` and \`Release-As: ${request.version}\`; a commit asks for one version`,
      };
    }
    byCommit.set(request.commit, request.version);
    if (!chosen || compareVersions(parsed, chosen.parsed) > 0) chosen = { ...request, parsed };
  }
  if (!chosen) return { version: implied.join(".") };
  if (compareVersions(chosen.parsed, implied) < 0) {
    return {
      error:
        `trailer \`Release-As: ${chosen.version}\` on ${chosen.commit} is below ${implied.join(".")}, ` +
        `the version the commits since ${previousTag ?? "the start of the history"} imply; ` +
        "a trailer may raise the next version, never lower it",
    };
  }
  return { version: chosen.version };
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
  if (!parsed) {
    console.error(`not a conventional commit subject:\n\n    ${checkSubject}\n`);
    console.error(`Expected \`type(scope): subject\`, where type is one of: ${CONVENTIONAL_TYPES.join(", ")}.`);
    console.error(`A \`!\` after the type or scope marks a breaking change.\n`);
    console.error(`Examples:\n    feat(checker): accept non-generic type aliases`);
    console.error(`    perf(codegen)!: hoist the array header out of element loops`);
    console.error(`\nThe subject becomes the heading in the release notes, so write it for a reader.`);
    process.exit(1);
  }
  if (!CONVENTIONAL_TYPES.includes(parsed.type)) {
    console.error(`unknown type \`${parsed.type}\` in:\n\n    ${checkSubject}\n`);
    console.error(`Use one of: ${CONVENTIONAL_TYPES.join(", ")}.`);
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
const includeUnconventional = argv.includes("--include-unconventional");

const { entries, skipped, releaseAs } = collect(from, to, includeUnconventional);

// `--next` answers the version and nothing else, for the release PR to name
// itself and to bump package.json with. Everything release-pr.yml writes reads
// this one line, so a `Release-As:` trailer reaches all of it here.
if (argv.includes("--next")) {
  const next = nextVersion(pkgVersion, entries, from, releaseAs);
  if (next.error) {
    console.error(`changelog-gen: ${next.error}`);
    process.exit(1);
  }
  process.stdout.write(`${next.version}\n`);
  process.exit(0);
}

// Skipped is not silent: the subjects are named, because a change that belongs
// in the notes and was written without a type is a defect to fix in the
// commit, not something for a reader of the notes to discover missing.
if (skipped.length > 0 && !includeUnconventional) {
  const shown = skipped.slice(0, 20);
  console.error(
    `changelog-gen: skipped ${skipped.length} commit${skipped.length === 1 ? "" : "s"} whose subject is not a conventional commit:`
  );
  for (const line of shown) console.error(`  ${line}`);
  if (skipped.length > shown.length) console.error(`  ... and ${skipped.length - shown.length} more`);
  console.error("Pass --include-unconventional to file them under \"Uncategorised\" instead.");
}

if (entries.length === 0) {
  const range = from ? `${from}..${to}` : to;
  console.error(
    skipped.length > 0
      ? `changelog-gen: no commit in ${range} carries a conventional subject (${skipped.length} skipped, listed above), so the release has no entries; fix the subjects or pass --include-unconventional`
      : `changelog-gen: no commits in ${range}; a release with no changes is a mistake, not an empty section`
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

if (includeUnconventional && skipped.length > 0) {
  console.error(
    `changelog-gen: ${skipped.length} of ${entries.length} commits are not conventional and landed under "Uncategorised"`
  );
}

process.stdout.write(stdoutKind === "json" ? `${JSON.stringify(release, null, 2)}\n` : markdown);
