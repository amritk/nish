---
name: Make agent-skill linking opt-in
overview: Installing nish links no agent skill. npx nish-skills shows each installed Nish package's skills and links only the ones the user accepts, records what was accepted with a hash, asks again when a skill changes, and never links a skill that grants allowed-tools without the user naming it. Follow-up to #1654, which linked every Nish package's skills at install time without asking.
stages:
  - id: skills-opt-in
    title: Ask before linking a package's agent skills
    goal: postinstall writes nothing under .claude/, and nish-skills links a skill only when the user has accepted it at its current hash — by a y on a TTY, by naming it, or by --yes for a skill that grants no tools
    verification: npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs && node tests/run.js skills && node tests/run.js package
    todos:
      - id: discovery
        content: Split discovery out of linkSkills in scripts/link-skills.mjs — each found skill with package, version, name, dir, hash, description and allowed-tools from a fail-closed frontmatter read — see Discovery
      - id: consent-linker
        content: Make linkSkills take the accepted set, link only those, unlink owned links that are not accepted, keep pruning and ownership exactly as #1654 left them, and write the record — see Linker
      - id: record
        content: Keep .claude/skills/.nish-skills.json (package, skill, hash per accepted skill), written atomically, read tolerantly — see Record
      - id: cli
        content: Rework bin/nish-skills.js — TTY y/N per skill (default no), non-TTY names / --yes with the allowed-tools rule, --dir, sanitised output, exit codes — see Command
      - id: postinstall-hint
        content: Make scripts/postinstall.mjs's skills half print one hint and write nothing — see Postinstall
      - id: tests
        content: Update the skills section of tests/run.js — see Tests
      - id: docs
        content: Rewrite docs/guide/using-nish/agent-skills.md leading with the trust model, and add the finding to docs/security/supply-chain.md — see Docs
---

# Make agent-skill linking opt-in

## Context

[#1654](https://github.com/amritk/nish/pull/1654) (run ledger [#1652](https://github.com/amritk/nish/issues/1652)) made `scripts/postinstall.mjs` link every Nish package's `skills/<name>/` into the project's `.claude/skills/`. That includes hoisted transitive dependencies, and it never asks. A skill is instructions for Claude plus an optional `allowed-tools` grant. So any package in the tree with a `nish` export condition can give Claude in the user's project both, and it needs no install script of its own to do it. The links are symlinks, so they also follow every upgrade without anyone seeing it.

None of this has shipped. It is in the open release PR, [#1656](https://github.com/amritk/nish/pull/1656) (`chore(release): 0.42.0`). This change must land on `main` before that PR merges, so 0.42.0 never ships install-time linking. No released version has links that need migrating.

## Approach

- **Consent is per skill, at a hash.** The unit is a skill: one package, one skill name, one content hash. Linking needs an accepted record for that exact triple. A new package, a different package claiming the same name, or a changed hash all ask again.
- **What gets hashed.** sha256 over the whole skill directory: every regular file's path relative to the skill directory and its bytes, in code-unit order. A symlink inside the directory contributes its target string and is never followed. `SKILL.md` alone would miss a `scripts/` or `references/` file that `SKILL.md` tells Claude to run or read. Chosen at sign-off over hashing `SKILL.md` alone.
- **Fail closed.** If the frontmatter cannot be read, the skill counts as granting tools. The same goes for an `allowed-tools` key in any form, even empty. A skill counts as tool-free only when the frontmatter parsed and has no such key.
- **What ends up linked equals what is accepted.** Each run links what is accepted and unlinks every linker-owned link that is not accepted at its current hash. "Linker-owned" is still #1654's rule: an `lstat` symlink that resolves inside `node_modules/`. Unlinking only ever removes something, so it needs no consent. It covers a skill whose hash changed and was not re-accepted, and a link #1654's behaviour made that has no record.
- **The gap this leaves, written down rather than hidden.** An accepted skill is still a symlink. Between an upgrade and the next `nish-skills` run, the link serves the new content. Postinstall cannot close the gap, because it must write nothing and it runs only when nish itself is installed. The guide's trust model says so, and tells the user to run `npx nish-skills` after upgrading a package that ships skills.
- **Declines are not recorded.** An interactive run asks again about a skill it was refused. A non-TTY run links nothing it was not told to link.
- **No compiler change.** This is plain-Node install tooling. `src/`, `std/`, the goldens, nish-cmp and the rolling freeze do not move.

## Ask before linking a package's agent skills

Owns: `scripts/link-skills.mjs`, `scripts/postinstall.mjs`, `bin/nish-skills.js`, `tests/run.js`, `docs/guide/using-nish/agent-skills.md`, `docs/guide/getting-started/installation.md`, `docs/guide/language/modules.md`, `docs/security/supply-chain.md`, `docs/security/README.md`, `knip.json`, `package.json`

## Discovery

Package discovery in `scripts/link-skills.mjs` stays the same: `nish` first, then every top-level or `@scope` package whose `exports` uses a `nish` condition, in code-unit order. The first package to claim a name wins, and a later one is reported as skipped. A new export, for example `findSkills(project)`, returns each claimed skill as `{ pkg, version, name, dir, hash, description, allowedTools }`. `allowedTools` is `null` when the skill grants none, and otherwise a string array, or `["<unreadable frontmatter>"]` when the frontmatter could not be read.

Frontmatter: the `---` block at the top of `SKILL.md`. Read only top-level `key: value` scalars (quoted or not), inline `[a, b]` lists, and `- item` block lists. Anything else under `allowed-tools` keeps the key present, which means the skill grants tools. Plain `node:` built-ins only, with no YAML dependency.

## Linker

`linkSkills(project, { accepted, platform })`. `accepted` is the set of skill names the caller has decided to link at the hashes `findSkills` returned. After the call:

1. Every accepted skill has a link, made with today's temp-name-and-rename write, junction on win32.
2. Every linker-owned link to a found skill that is not accepted is removed, and reported as `unlinked` with the reason: not accepted, or changed since accepted.
3. Pruning, user-owned entries, a symlinked or non-directory `.claude`/`.claude/skills`, and killed-run temporary links behave exactly as in #1654. Their existing tests must pass unchanged, apart from the setup each one now needs to accept a skill.
4. Nothing is created under `.claude/` when no skill is accepted and no record exists.

## Record

`.claude/skills/.nish-skills.json`:

```json
{ "version": 1, "skills": { "<name>": { "package": "<pkg>", "hash": "sha256-<hex>" } } }
```

- Written with temp-name-and-rename, only when its content changes, and only when `.claude/skills/` is a real directory. The pruning loop must never touch it: it is a regular file, so it is not linker-owned.
- A missing, unreadable or malformed record, or one whose `version` is unknown, means nothing is accepted. It is never an error, and it is rewritten on the next accepted link.
- A skill is "already accepted" only when the record's `package` and `hash` both match what `findSkills` found.

## Command

`nish-skills [--dir <dir>] [--yes] [<skill>...]`. `--dir` replaces the positional directory, which is safe because 0.42.0 has not shipped. The default project is still `projectOf(cwd) ?? findProject(cwd)`.

- **TTY** (stdin and stdout both TTYs, no names, no `--yes`): for each found skill that is not already accepted, print `<name> from <pkg>@<version>`, its description, and its `allowed-tools` (or "grants no tools"), then ask `Link <name>? [y/N]`. Only `y` or `yes` (any case, trimmed) accepts. Enter, anything else, or EOF declines. A skill that is already accepted is kept without asking.
- **Not a TTY**, or names/`--yes` given: a named skill is accepted, `allowed-tools` or not. `--yes` accepts every found skill that grants no tools. A skill that grants tools and is not named is not linked, and the output names it and says to pass it by name. Already-accepted skills are kept. With neither names nor `--yes` and no TTY, nothing new is linked, and the output lists what was found and how to accept it.
- A name that matches no found skill is a usage error: exit 2, and nothing is written.
- **Everything a package controls is sanitised before it reaches the terminal**: description, allowed-tools entries, package name and version. C0/C1 control characters and ESC are replaced, and the output is capped in length. A `SKILL.md` must not be able to redraw the prompt.
- The exit codes stay `0` / `1` / `2` as today. `--help` prints the usage on stdout and exits 0.

## Postinstall

`skills()` in `scripts/postinstall.mjs` keeps the same guards: checkout, global, `NISH_NO_SKILLS`, no `INIT_CWD`, not this project's copy. When they pass, it prints one line, `nish: run 'npx nish-skills' to review and link the agent skills of installed Nish packages`, and returns. It imports nothing that writes and creates nothing. Update the file's doc comment, and the `swap` half stays as it is.

## Tests

In the `skills` section of `tests/run.js`, update the existing checks so each accepts its skills explicitly (by name, or `--yes`), and add:

- postinstall run with `INIT_CWD` set on a fixture holding nish plus a Nish library with a skill creates no `.claude/`, and prints the hint exactly once.
- No answer means no link. Drive the interactive path in-process through the module with an injected `ask`. Do not add an environment-variable hook to the shipped bin. Cover `""`, `"n"`, EOF (`null`) and `"Y"`.
- The bin over a pipe with no names and no `--yes` links nothing.
- `allowed-tools` refusal: `--yes` does not link a skill that grants tools, naming it does, and an unparseable frontmatter counts as granting tools.
- A hash change asks again. Accept a skill, change its `SKILL.md` (and, in a second check, a non-`SKILL.md` file in the skill directory), and run again. Interactively it asks again. Without consent the link is removed.
- A different package claiming an accepted name asks again.
- The record round-trips. A re-run with every skill accepted asks nothing and changes no inode.
- A description carrying ESC/CSI sequences reaches stdout with no raw ESC byte.
- An unknown skill name exits 2 and writes nothing.

Each check proves its claim by exit status and filesystem state, never by message text (`.claude/testing.md`, "Checks that spawn a process").

## Docs

- `docs/guide/using-nish/agent-skills.md` opens with **the trust model**: what a skill is (instructions plus an optional `allowed-tools` grant), why nothing is linked at install time, what accepting means (this package, this skill, this hash), the upgrade gap and what to do about it, and that `allowed-tools` needs the skill's name. After that come the command and its flags, the record file, the ownership and pruning rules, and the library-author convention. Follow `docs/README.md#writing-a-guide-page`.
- `installation.md` and `language/modules.md` change only where they say install links skills.
- `docs/security/supply-chain.md`: a new SC row for the finding (install-time linking gave any Nish dependency an unconsented skill and `allowed-tools` grant), marked Fixed with this PR's tests. Add `scripts/link-skills.mjs` and `bin/nish-skills.js` to the scope table if `node scripts/security-scope.mjs` asks for them, and update the index row in `docs/security/README.md` if its counts change.

## Commit

`fix(cli): link a package's agent skills only when the user accepts them`. The body is release-note prose for 0.42.0's readers. 0.42.0 is the first release with skills at all, so it reads as the shipped behaviour, not as a break.
