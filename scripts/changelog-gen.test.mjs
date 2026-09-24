// Exercises how changelog-gen.mjs chooses the next version: the bump the
// commit types imply, and the `Release-As:` trailer that raises it. Every case
// builds a throwaway repository -- a tag, a package.json at that version, and
// the commits since -- runs the real script's `--next` in it, and compares the
// exit code and the version (or the words of the refusal) with what the case
// expects. `--next` is what release-pr.yml reads, so this is the number the
// Release PR would propose.
//
//   node scripts/changelog-gen.test.mjs
//
// `npm test` runs it.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPT = path.join(import.meta.dirname, "changelog-gen.mjs");

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "test@example.com",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
};

function git(dir, args) {
  const r = spawnSync("git", args, { cwd: dir, env: GIT_ENV, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
}

/**
 * A repository tagged `v<tag>` with package.json at that version, then one
 * commit per message. Returns the directory.
 */
function repo(tag, messages) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "changelog-gen-"));
  fs.mkdirSync(path.join(dir, "scripts"));
  fs.copyFileSync(SCRIPT, path.join(dir, "scripts", "changelog-gen.mjs"));
  fs.writeFileSync(path.join(dir, "package.json"), `${JSON.stringify({ name: "fixture", version: tag })}\n`);
  git(dir, ["init", "-q"]);
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", `chore(release): ${tag}`]);
  git(dir, ["tag", `v${tag}`]);
  for (const message of messages) git(dir, ["commit", "-q", "--allow-empty", "-m", message]);
  return dir;
}

function run(dir, args) {
  return spawnSync(process.execPath, [path.join(dir, "scripts", "changelog-gen.mjs"), ...args], {
    cwd: dir,
    encoding: "utf8",
  });
}

const feat = "feat(checker): accept a thing\n\nThe prose.";
const fix = "fix(codegen): mend a thing\n\nThe prose.";
const breaking = "feat(checker)!: refuse a thing\n\nThe prose.";
const releaseAs = (version, subject = "docs(plan): the reference is frozen") =>
  `${subject}\n\nThe prose.\n\nRelease-As: ${version}\nRefs: docs/wp12-release.md`;

// [label, the tag the range starts at, the commits since, the exit code, and
// the version printed -- or, for a refusal, the phrases its message must hold].
const cases = [
  ["no trailer: a fix moves the patch", "0.9.0", [fix], 0, "0.9.1"],
  ["no trailer: a feat moves the minor", "0.9.0", [fix, feat], 0, "0.10.0"],
  ["no trailer: before 1.0 a break moves the minor", "0.9.0", [feat, breaking], 0, "0.10.0"],
  ["Release-As: 1.0.0 over 0.9.0, with a feat and a break", "0.9.0", [feat, breaking, releaseAs("1.0.0")], 0, "1.0.0"],
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
  ["REFUSE a malformed trailer: a leading v", "0.9.0", [feat, releaseAs("v1.0.0")], 1, ["malformed", "`Release-As: v1.0.0`"]],
  [
    "REFUSE a malformed trailer even beside a good one",
    "0.9.0",
    [releaseAs("1.0.0"), releaseAs("1.0.0-rc.1")],
    1,
    ["malformed", "`Release-As: 1.0.0-rc.1`"],
  ],
  ["after 1.0: a break moves the major", "1.0.0", [fix, breaking], 0, "2.0.0"],
  ["after 1.0: a feat moves the minor", "1.0.0", [fix, feat], 0, "1.1.0"],
  ["after 1.0: a fix moves the patch", "1.0.0", [fix], 0, "1.0.1"],
];

let failed = 0;
let total = 0;
const check = (label, ok, detail) => {
  total++;
  if (!ok) failed++;
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${ok ? "" : `\n${detail.replace(/^/gm, "        ")}`}`);
};

const dirs = [];
for (const [label, tag, messages, expected, want] of cases) {
  const dir = repo(tag, messages);
  dirs.push(dir);
  const r = run(dir, ["--next"]);
  const ok =
    r.status === expected &&
    (expected === 0 ? r.stdout === `${want}\n` : r.stdout === "" && want.every((phrase) => r.stderr.includes(phrase)));
  check(label, ok, `exit ${r.status}, wanted ${expected}\nstdout: ${r.stdout}stderr: ${r.stderr}`);
}

// The trailer is bookkeeping for the version, not prose for the reader, so it
// comes off the body in the record the website renders, as `Refs:` does.
{
  const dir = repo("0.9.0", [releaseAs("1.0.0")]);
  dirs.push(dir);
  const r = run(dir, ["--version", "1.0.0", "--stdout", "json"]);
  const entry = r.status === 0 ? JSON.parse(r.stdout).entries[0] : undefined;
  check(
    "the trailer is stripped from the entry's body",
    entry?.body === "The prose." && entry.refs.join() === "docs/wp12-release.md",
    `exit ${r.status}\n${r.stdout}${r.stderr}`,
  );
}

for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });

console.log(failed === 0 ? `\nall ${total} cases pass` : `\n${failed} case(s) failed`);
process.exit(failed === 0 ? 0 : 1);
