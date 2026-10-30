// Exercises how changelog-gen.mjs chooses the next version: the bump the
// commit types imply, and the `Release-As:` trailer that raises it. Every case
// builds a throwaway repository -- a tag, a package.json at that version, and
// the commits since -- runs the real script's `--next` in it, and compares the
// exit code and the version (or the words of the refusal) with what the case
// expects. `--next` is what release-pr.yml reads, so this is the number the
// Release PR would propose.
//
// The cases after the table pin the record itself: trailers come off an
// entry's body, and `Changelog: skip` / `Changelog-Skip:` keep commits out of
// every output, counted on stderr but never named.
//
//   node scripts/changelog-gen.test.mjs
//
// `npm test` runs it.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const SCRIPT = path.join(import.meta.dirname, "changelog-gen.mjs")

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "test@example.com",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
}

const git = (dir, args) => {
  const r = spawnSync("git", args, { cwd: dir, env: GIT_ENV, encoding: "utf8" })
  if (r.status !== 0) {
    throw new Error(`git ${args.join(" ")}: ${r.stderr}`)
  }
}

/**
 * A repository tagged `v<tag>` with package.json at that version, then one
 * commit per message. Returns the directory.
 */
const repo = (tag, messages) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "changelog-gen-"))
  fs.mkdirSync(path.join(dir, "scripts"))
  fs.copyFileSync(SCRIPT, path.join(dir, "scripts", "changelog-gen.mjs"))
  fs.writeFileSync(path.join(dir, "package.json"), `${JSON.stringify({ name: "fixture", version: tag })}\n`)
  git(dir, ["init", "-q"])
  git(dir, ["add", "-A"])
  git(dir, ["commit", "-q", "-m", `chore(release): ${tag}`])
  git(dir, ["tag", `v${tag}`])
  for (const message of messages) {
    git(dir, ["commit", "-q", "--allow-empty", "-m", message])
  }
  return dir
}

const run = (dir, args) =>
  spawnSync(process.execPath, [path.join(dir, "scripts", "changelog-gen.mjs"), ...args], {
    cwd: dir,
    encoding: "utf8",
  })

const feat = "feat(checker): accept a thing\n\nThe prose."
const fix = "fix(codegen): mend a thing\n\nThe prose."
const breaking = "feat(checker)!: refuse a thing\n\nThe prose."
const releaseAs = (version, subject = "docs(plan): the reference is frozen") =>
  `${subject}\n\nThe prose.\n\nRelease-As: ${version}\nRefs: docs/wp12-release.md`

// [label, the tag the range starts at, the commits since, the exit code, and
// the version printed -- or, for a refusal, the phrases its message must hold].
const cases = [
  ["no trailer: a fix moves the patch", "0.9.0", [fix], 0, "0.9.1"],
  ["no trailer: a feat moves the minor", "0.9.0", [fix, feat], 0, "0.10.0"],
  ["no trailer: before 1.0 a break moves the minor", "0.9.0", [feat, breaking], 0, "0.10.0"],
  [
    "Release-As: 1.0.0 over 0.9.0, with a feat and a break",
    "0.9.0",
    [feat, breaking, releaseAs("1.0.0")],
    0,
    "1.0.0",
  ],
  ["a trailer at the floor is the floor", "0.9.0", [feat, releaseAs("0.10.0")], 0, "0.10.0"],
  ["the highest of two trailers wins", "0.9.0", [releaseAs("1.0.0"), fix, releaseAs("0.11.0")], 0, "1.0.0"],
  [
    "a trailer on an unconventional commit still counts",
    "0.9.0",
    [fix, "work in progress\n\nRelease-As: 1.0.0"],
    0,
    "1.0.0",
  ],
  [
    "REFUSE a patch where a feat asks for the minor",
    "0.9.0",
    [feat, releaseAs("0.9.1")],
    1,
    ["`Release-As: 0.9.1`", "docs(plan): the reference is frozen", "below 0.10.0", "since v0.9.0"],
  ],
  [
    "REFUSE a downgrade",
    "0.9.0",
    [fix, releaseAs("0.8.0")],
    1,
    ["`Release-As: 0.8.0`", "docs(plan): the reference is frozen", "below 0.9.1"],
  ],
  [
    "REFUSE a malformed trailer: two parts",
    "0.9.0",
    [feat, releaseAs("1.0")],
    1,
    ["malformed", "`Release-As: 1.0`", "docs(plan): the reference is frozen", "X.Y.Z"],
  ],
  [
    "REFUSE a malformed trailer: a leading v",
    "0.9.0",
    [feat, releaseAs("v1.0.0")],
    1,
    ["malformed", "`Release-As: v1.0.0`"],
  ],
  [
    "REFUSE a malformed trailer even beside a good one",
    "0.9.0",
    [releaseAs("1.0.0"), releaseAs("1.0.0-rc.1")],
    1,
    ["malformed", "`Release-As: 1.0.0-rc.1`"],
  ],
  [
    "REFUSE two trailers in one commit that disagree",
    "0.9.0",
    [`${feat}\n\nRelease-As: 1.0.0\nRelease-As: 0.11.0`],
    1,
    ["disagree", "`Release-As: 1.0.0`", "`Release-As: 0.11.0`", "feat(checker): accept a thing"],
  ],
  [
    "two trailers in one commit that agree are one",
    "0.9.0",
    [`${feat}\n\nRelease-As: 1.0.0\nRelease-As: 1.0.0`],
    0,
    "1.0.0",
  ],
  ["after 1.0: a break moves the major", "1.0.0", [fix, breaking], 0, "2.0.0"],
  ["after 1.0: a feat moves the minor", "1.0.0", [fix, feat], 0, "1.1.0"],
  ["after 1.0: a fix moves the patch", "1.0.0", [fix], 0, "1.0.1"],
]

let failed = 0
let total = 0
const check = (label, ok, detail) => {
  total++
  if (!ok) {
    failed++
  }
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${ok ? "" : `\n${detail.replace(/^/gm, "        ")}`}`)
}

// A throwaway repository per case, removed however the run ends: `git()`
// throws, and a failure that left temp directories behind would pile up.
const dirs = []
try {
  for (const [label, tag, messages, expected, want] of cases) {
    const dir = repo(tag, messages)
    dirs.push(dir)
    const r = run(dir, ["--next"])
    const ok =
      r.status === expected &&
      (expected === 0
        ? r.stdout === `${want}\n`
        : r.stdout === "" && want.every((phrase) => r.stderr.includes(phrase)))
    check(label, ok, `exit ${r.status}, wanted ${expected}\nstdout: ${r.stdout}stderr: ${r.stderr}`)
  }

  // The trailer is bookkeeping for the version, not prose for the reader, so it
  // comes off the body in the record the website renders, as `Refs:` does.
  {
    const dir = repo("0.9.0", [releaseAs("1.0.0")])
    dirs.push(dir)
    const r = run(dir, ["--version", "1.0.0", "--stdout", "json"])
    const entry = r.status === 0 ? JSON.parse(r.stdout).entries[0] : undefined
    check(
      "the trailer is stripped from the entry's body",
      entry?.body === "The prose." && entry.refs.join() === "docs/wp12-release.md",
      `exit ${r.status}\n${r.stdout}${r.stderr}`
    )
  }

  // `Changelog: skip` and `Changelog-Skip: <sha>` keep commits out of every
  // output. The kept-out subjects are distinctive, so a leak into stdout,
  // stderr or the written files is a substring away.
  const sha = (dir, rev = "HEAD") =>
    spawnSync("git", ["rev-parse", rev], { cwd: dir, env: GIT_ENV, encoding: "utf8" }).stdout.trim()
  const hiddenA = "feat(cli): zanzibar quokka"
  const hiddenB = "fix(cli): mend the quokka"
  const leaks = (text) => /quokka|zanzibar|Changelog(-Skip)?:/.test(text)
  const both = (dir, args) => {
    const md = run(dir, args)
    const json = run(dir, [...args, "--stdout", "json"])
    return { md, json, entries: json.status === 0 ? JSON.parse(json.stdout).entries : [] }
  }
  {
    // One commit skips itself; a later one names an earlier one by a 7-char
    // SHA, and a SHA that is in no commit of the range, which is ignored.
    const dir = repo("0.9.0", [`${hiddenA}\n\nThe prose.\n\nChangelog: skip`, hiddenB])
    dirs.push(dir)
    const bSha = sha(dir).slice(0, 7)
    const outside = sha(dir, "v0.9.0").slice(0, 7)
    git(dir, [
      "commit",
      "-q",
      "--allow-empty",
      "-m",
      `${fix}\n\nChangelog-Skip: ${bSha}, ${outside}, deadbeefcafe\nRefs: docs/a.md`,
    ])
    const { md, json, entries } = both(dir, ["--version", "0.9.1"])
    check(
      "Changelog: skip and Changelog-Skip: drop their commits, the rest stays",
      md.status === 0 && entries.map((e) => e.title).join() === "mend a thing",
      `exit ${json.status}\n${json.stdout}${json.stderr}`
    )
    check(
      "a kept-out commit is counted on stderr and named nowhere",
      md.stderr.includes("2 commits kept out of the changelog by trailer") &&
        ![md.stdout, md.stderr, json.stdout, json.stderr].some(leaks),
      `md: ${md.stdout}${md.stderr}json: ${json.stdout}${json.stderr}`
    )
    check(
      "the trailers come off a kept entry's body",
      entries[0]?.body === "The prose." && entries[0].refs.join() === "docs/a.md",
      json.stdout
    )
    fs.writeFileSync(path.join(dir, "CHANGELOG.md"), "# Changelog\n\n## [Unreleased]\n")
    const w = run(dir, ["--version", "0.9.1", "--write"])
    const written = [
      fs.readFileSync(path.join(dir, "changelog", "0.9.1.json"), "utf8"),
      fs.readFileSync(path.join(dir, "CHANGELOG.md"), "utf8"),
    ].join("")
    check(
      "--write leaves the kept-out commits out",
      w.status === 0 && !leaks(written),
      `${w.stderr}${written}`
    )
    const next = run(dir, ["--next"])
    check("a kept-out feat does not move the version", next.stdout === "0.9.1\n", next.stdout + next.stderr)
  }
  {
    // A version someone asked for is an explicit request, not a bump the notes
    // must explain, so it holds on a kept-out commit too.
    const dir = repo("0.9.0", [fix, `${releaseAs("0.12.0", hiddenA)}\nChangelog: skip`])
    dirs.push(dir)
    const r = run(dir, ["--next"])
    check(
      "a kept-out commit's Release-As still applies",
      r.status === 0 && r.stdout === "0.12.0\n" && !leaks(r.stderr),
      `exit ${r.status}\n${r.stdout}${r.stderr}`
    )
  }
  {
    // Nothing left to announce is the empty release, refused with a count.
    const dir = repo("0.9.0", [`${hiddenA}\n\nChangelog: skip`])
    dirs.push(dir)
    const r = run(dir, ["--version", "0.9.1"])
    check(
      "REFUSE a release whose every conventional commit is kept out",
      r.status === 1 &&
        r.stdout === "" &&
        r.stderr.includes("1 commit kept out") &&
        r.stderr.includes("every commit") &&
        !leaks(r.stderr),
      `exit ${r.status}\n${r.stdout}${r.stderr}`
    )
  }
} finally {
  for (const dir of dirs) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

console.log(failed === 0 ? `\nall ${total} cases pass` : `\n${failed} case(s) failed`)
process.exit(failed === 0 ? 0 : 1)
