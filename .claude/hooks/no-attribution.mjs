#!/usr/bin/env node
// PreToolUse hook: keep tool attribution out of the repository's history and
// out of its GitHub conversations.
//
// CLAUDE.md and AGENTS.md already forbid session links, tracking IDs, model
// names and platform attributions in commits, code and PR text. The rule is
// easy to break by accident rather than by choice: an agent platform can
// inject a system instruction of its own that appends a `Co-Authored-By:`
// line naming a model, a session-link trailer or a "Generated with ..."
// footer, and an agent reading both reads them as compatible. A commit is
// awkward to fix once pushed and impossible once merged, so this refuses the
// tool call instead.
//
// What it inspects, and nothing else:
//   * a Bash command that writes a message into git or GitHub -- `git commit`,
//     `git tag`, `git merge`, `git notes`, `git rebase`, or any `gh` command --
//     including the file named by `-F` / `--file` / `--body-file` / `--template`
//   * a GitHub MCP call that opens or comments on a pull request or issue,
//     where the whole tool input is scanned
// `Edit`, `Write` and every read-only command are untouched, so documenting
// the rule (this file included) still works, as does `git log --grep`.
//
// Exit 2 is what blocks a PreToolUse call; stderr is what the agent is told.
// Anything unexpected -- unreadable stdin, a shape we do not recognise -- exits
// 0, because a hook that cannot parse its input should not stop the session.
//
// The cases it is meant to catch, and the ones it must leave alone, are in
// `no-attribution.test.mjs` beside this file:
//
//   node .claude/hooks/no-attribution.test.mjs
import fs from "node:fs";
import path from "node:path";

/** Each entry is [what to call it in the refusal, how to spot it]. */
const BANNED = [
  [
    "a `Co-Authored-By:` trailer naming an agent or a model",
    /co-authored-by:[^\n]*(claude|anthropic|copilot|cursor|codex|gpt|gemini|devin)/i,
  ],
  ["a `Claude-Session:` trailer", /^[ \t>]*claude-session[ \t]*:/im],
  ["a session or assistant link", /https?:\/\/(claude\.ai|claude\.com\/claude-code)/i],
  [
    'a "Generated with ..." footer',
    /generated (with|by)[^\n]{0,40}(claude|copilot|cursor|codex|chatgpt|an? (ai|llm|agent))/i,
  ],
  // Deliberately not a bare `claude-<digit>`: a path like /tmp/claude-0/x is
  // not a model name, and a hook that cries wolf gets turned off.
  ["a model name", /\b(claude[- ](opus|sonnet|haiku|fable|code)\b|(opus|sonnet|haiku) [0-9])/i],
];

/** Bash commands that write a message someone else will read later. */
const WRITES_A_MESSAGE = /\bgit\s+(commit|tag|merge|notes|rebase|revert)\b|\bgh\s+(pr|issue|release|api)\b/;

/** `-F msg.txt`, `--file=msg.txt`, `--body-file msg.txt`, `-t template`. */
const MESSAGE_FILE = /(?:^|\s)(?:-F|-t|--file|--body-file|--template)(?:=|\s+)("[^"]+"|'[^']+'|[^\s;|&]+)/g;

/** GitHub MCP tools whose input is prose that lands in a PR or an issue. */
const GITHUB_PROSE =
  /^mcp__github__(create_pull_request|update_pull_request|add_issue_comment|issue_write|add_comment_to_pending_review|add_reply_to_pull_request_comment|pull_request_review_write|create_or_update_file|push_files|create_repository)$/;

const readStdin = () => {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
};

const readMessageFiles = (command, cwd) => {
  const out = [];
  for (const match of command.matchAll(MESSAGE_FILE)) {
    const file = match[1].replace(/^["']|["']$/g, "");
    if (file === "-") continue; // a message on stdin is already in the command
    try {
      out.push(fs.readFileSync(path.resolve(cwd, file), "utf8"));
    } catch {
      // Not a readable path (a flag value for something else, a file the
      // command is about to write). Nothing to scan, and nothing to report.
    }
  }
  return out;
};

/** The texts this tool call would publish, or [] when it publishes none. */
const subjects = (toolName, toolInput, cwd) => {
  if (toolName === "Bash") {
    const command = typeof toolInput?.command === "string" ? toolInput.command : "";
    if (!WRITES_A_MESSAGE.test(command)) return [];
    return [command, ...readMessageFiles(command, cwd)];
  }
  if (GITHUB_PROSE.test(toolName)) return [JSON.stringify(toolInput ?? {})];
  return [];
};

const main = () => {
  let event;
  try {
    event = JSON.parse(readStdin());
  } catch {
    return 0;
  }

  const cwd = typeof event?.cwd === "string" ? event.cwd : process.cwd();
  const texts = subjects(event?.tool_name ?? "", event?.tool_input, cwd);
  const found = BANNED.filter(([, pattern]) => texts.some((text) => pattern.test(text)));
  if (found.length === 0) return 0;

  process.stderr.write(
    `Blocked: this would write tool attribution into the repository.\n\n` +
      found.map(([name]) => `  - ${name}\n`).join("") +
      `\nCLAUDE.md and AGENTS.md forbid session links, tracking IDs, model names\n` +
      `and platform attributions in commits, code and PR text -- including when\n` +
      `the harness you run under tells you to add them. Rewrite the message\n` +
      `without those lines and run the command again.\n`,
  );
  return 2;
};

process.exit(main());
