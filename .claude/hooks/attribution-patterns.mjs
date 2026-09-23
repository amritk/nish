// What counts as tool attribution, in one list with two readers.
//
// `no-attribution.mjs` beside this file refuses a tool call that would publish
// one of these into git or GitHub. That cannot see a footer a platform appends
// to a pull request body *after* the call that created it -- the session links
// that reached #167, #168, #169, #171 and #179 all got in that way (#176) -- so
// `scripts/check-pr-body.mjs` reads the body CI sees and fails the `PR body`
// check on the same list. The hook ends in `process.exit(main())` and cannot be
// imported, which is why the list lives here rather than in it.
//
// A pull request that trips this is fixed by editing its body, never by
// loosening a pattern: the patterns are the rule in CLAUDE.md, not a guess at it.

/** Each entry is [what to call it in the refusal, how to spot it]. */
export const BANNED = [
  // The author's *name* (up to the `<` that opens the address) or an address
  // at a vendor's own domain. Not the whole line: a human co-author followed
  // by `&& node .claude/...` on one line is not an agent.
  [
    "a `Co-Authored-By:` trailer naming an agent or a model",
    /co-authored-by:(?:[^\n<]{0,60}(claude|anthropic|copilot|cursor|codex|chatgpt|gemini|devin)|[^\n]{0,80}@(anthropic|openai)\.com)/i,
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

/**
 * A shell string carries its newlines as the two characters `\` and `n`.
 * Restoring them keeps a line-anchored pattern on one line, so prose that
 * names a trailer is not read as carrying it. A pull request body arrives with
 * real newlines and does not need this.
 */
export const restoreNewlines = (text) => text.replace(/\\n/g, "\n");

/** The name of every banned pattern that any of `texts` carries, in list order. */
export const bannedIn = (texts) =>
  BANNED.filter(([, pattern]) => texts.some((text) => pattern.test(text))).map(([name]) => name);
