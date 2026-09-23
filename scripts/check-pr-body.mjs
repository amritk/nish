#!/usr/bin/env node
// Fails when a pull request body carries tool attribution: a session link, a
// `Claude-Session:` trailer, an agent `Co-Authored-By:`, a "Generated with ..."
// footer or a model name.
//
// CLAUDE.md forbids all of them in PR text, and `.claude/hooks/no-attribution.mjs`
// refuses a tool call that would write one. The hook cannot see a footer the
// platform appends to the body after the call that opened the pull request,
// which is how session links reached five merged bodies (#176), so the
// `PR body` workflow runs this on the body GitHub actually holds. The list is
// the hook's own, imported from `.claude/hooks/attribution-patterns.mjs`.
//
// The body arrives in `BODY`, never on the command line: it is text anyone who
// opens a pull request controls, and `${{ }}` inside a `run:` would splice it
// into the shell. An unset or empty `BODY` passes, because a pull request with
// no description has nothing to attribute.
//
//   BODY="$(cat body.md)" node scripts/check-pr-body.mjs
//
// Exit 0 when the body is clean, 1 when it is not, with each pattern it
// carries named on stderr. Not shipped in the npm package: it imports from
// `.claude/`, which the tarball does not carry.
import { bannedIn } from "../.claude/hooks/attribution-patterns.mjs";

const found = bannedIn([process.env.BODY ?? ""]);
if (found.length > 0) {
  process.stderr.write(
    `The pull request body carries tool attribution:\n\n` +
      found.map((name) => `  - ${name}\n`).join("") +
      `\nCLAUDE.md forbids session links, tracking IDs, model names and platform\n` +
      `attributions in PR text. Edit the body to remove them; the check runs again\n` +
      `on the edit. A footer the platform appended after the pull request was\n` +
      `opened fails this too, and the fix is the same.\n`,
  );
}
process.exit(found.length > 0 ? 1 : 0);
