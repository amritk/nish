// Exercises no-attribution.mjs, the PreToolUse hook beside this file: every
// case is [label, the exit code the hook should give, the event it is fed].
// A blocked call is exit 2; anything else is exit 0.
//
//   node .claude/hooks/no-attribution.test.mjs
//
// `npm test` runs it, beside `scripts/check-pr-body.test.mjs`, which holds the
// same patterns (`attribution-patterns.mjs`) to a pull request body. The
// banned strings are built by concatenation so that editing this file, and
// grepping the repository for them, does not turn up a line that reads like
// the real thing.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.join(here, "no-attribution.mjs");
const CWD = path.resolve(here, "..", "..");

const coauth = `Co-Authored-By: ${"Claude"} Opus 5 <noreply@anthropic.com>`;
const session = `Claude-Session: ${"https://"}claude.ai/code/session_01P9`;
const footer = `\u{1F916} Generated with [${"Claude"} Code](https://claude.com/claude-code)`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "no-attribution-test-"));
const messageFile = path.join(tmp, "msg.txt");
fs.writeFileSync(messageFile, `chore: something\n\n${coauth}\n`);

const bash = (command) => ({ tool_name: "Bash", cwd: CWD, tool_input: { command } });
const mcp = (tool_name, tool_input) => ({ tool_name, cwd: CWD, tool_input });

const cases = [
  ["BLOCK  agent co-author in -m", 2, bash(`git commit -m "fix: x\n\n${coauth}"`)],
  ["BLOCK  session trailer in a heredoc", 2, bash(`git commit -F - <<MSG\nfeat: y\n\n${session}\nMSG`)],
  ["BLOCK  the message file named by -F", 2, bash(`git commit -q -F ${messageFile}`)],
  ["BLOCK  gh pr create --body", 2, bash(`gh pr create --title t --body "x\n\n${footer}"`)],
  ["BLOCK  an annotated tag", 2, bash(`git tag -a v9 -m "release\n\n${coauth}"`)],
  ["BLOCK  a PR body through the GitHub MCP", 2, mcp("mcp__github__create_pull_request", { title: "feat: z", body: `Does a thing.\n\n${footer}` })],
  ["BLOCK  an issue comment through the GitHub MCP", 2, mcp("mcp__github__add_issue_comment", { body: `Fixed in the last push.\n\n${session}` })],
  ["ALLOW  a clean commit", 0, bash('git commit -m "docs(readme): centred header\n\nRefs: README.md"')],
  ["ALLOW  a human co-author", 0, bash('git commit -m "fix: x\n\nCo-Authored-By: A Person <person@example.com>"')],
  ["ALLOW  reading the history for them", 0, bash(`git log --grep="${coauth}"`)],
  ["ALLOW  a commit from a path with claude-0 in it", 0, bash("git commit -q -F /tmp/claude-0/scratch/msg-that-does-not-exist.txt")],
  ["ALLOW  npm test", 0, bash("npm test")],
  ["ALLOW  a clean PR through the GitHub MCP", 0, mcp("mcp__github__create_pull_request", { title: "feat: z", body: "Does a thing." })],
  // The two that bit us: prose about the rule is not a breach of it. Both
  // name a trailer on one line and `.claude/...` further down, which a
  // pattern that runs past the end of a line reads as one line.
  [
    "ALLOW  a PR body that describes the rule",
    0,
    mcp("mcp__github__update_pull_request", {
      body: "Adds a hook that refuses an agent `Co-Authored-By:` trailer.\n\nSee `.claude/hooks/no-attribution.mjs`.",
    }),
  ],
  [
    "ALLOW  a human co-author above a path with claude in it",
    0,
    bash('git commit -m "fix: x\\n\\nCo-Authored-By: A Person <p@example.com>" && node .claude/hooks/no-attribution.test.mjs'),
  ],
  ["ALLOW  a tool the matcher does not cover", 0, mcp("Write", { file_path: "CLAUDE.md", content: session })],
  ["ALLOW  unparseable stdin, which fails open", 0, "not json at all"],
];

let failed = 0;
for (const [label, expected, event] of cases) {
  const input = typeof event === "string" ? event : JSON.stringify(event);
  const run = spawnSync("node", [HOOK], { input, encoding: "utf8" });
  const ok = run.status === expected;
  if (!ok) failed++;
  console.log(`${ok ? "pass" : "FAIL"}  ${label}  (exit ${run.status}, wanted ${expected})`);
  if (!ok && run.stderr) console.log(run.stderr.replace(/^/gm, "        "));
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed === 0 ? `\nall ${cases.length} cases pass` : `\n${failed} case(s) failed`);
process.exit(failed === 0 ? 0 : 1);
