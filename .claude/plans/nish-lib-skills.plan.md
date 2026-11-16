---
name: Link installed Nish packages' agent skills into .claude/skills
overview: When a project installs nish, or a Nish library that ships a skill, link each package's skills/<name>/ into the project's .claude/skills/ so Claude Code in that project knows the language and the library. Postinstall does it for nish; a new nish-skills command does it on demand for every installed Nish package.
stages:
  - id: link-skills
    title: Ship and link package skills
    goal: npm install nish links writing-nish into the project's .claude/skills, and npx nish-skills links the skills of every installed Nish package, never touching anything the user owns
    verification: npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/run.js skills && node tests/run.js package
    todos:
      - id: linker-module
        content: Add scripts/link-skills.mjs exporting linkSkills(project, options) — discovery, ownership and pruning rules — see Linker
      - id: skills-bin
        content: Add bin/nish-skills.js and the nish-skills entry in package.json bin, with --help and exit codes, lockfile updated — see Command
      - id: postinstall-hook
        content: Call linkSkills from scripts/postinstall.mjs for nish's own install, behind every guard, never failing the install — see Postinstall
      - id: ship-skills
        content: Add skills to package.json files and extend the WP12 package section of tests/run.js to pin it and the new bin — see Packaging
      - id: skills-tests
        content: Add a skills section to tests/run.js over a fixture project — see Tests
      - id: guide-page
        content: Add docs/guide/using-nish/agent-skills.md with its scalar.config.json route, and link it from installation.md and the packages part of language/modules.md — see Docs
---

# Link installed Nish packages' agent skills

## Context

[`skills/writing-nish/SKILL.md`](../../skills/writing-nish/SKILL.md) is the agent skill for writing Nish. The docs site publishes it, but the npm package does not ship it (`files` in [`package.json`](../../package.json) leaves out `skills/`). A project that runs `npm install nish` gets a compiler, and Claude Code in that project gets nothing. Nish libraries are ordinary npm packages with a `nish` export condition ([`docs/guide/language/modules.md`](../../docs/guide/language/modules.md), "packages"), and they have no way to tell an agent how to use them either.

Claude Code loads project skills from `.claude/skills/<name>/SKILL.md`. Linking a package's skill directory there makes the skill available, and npm updates it in place when the package upgrades.

## Approach

- **Convention.** A package ships skills as `skills/<name>/SKILL.md` at its package root. The skill's id is the directory name `<name>`.
- **Who qualifies.** `nish` itself, plus any top-level `node_modules/<pkg>` or `node_modules/@scope/<pkg>` whose `package.json` `exports` uses a `nish` condition anywhere in it. A plain npm package with a `skills/` directory is not a Nish package and is left alone.
- **Links, not copies.** `.claude/skills/<name>` is a relative symlink, `../../node_modules/<pkg>/skills/<name>`, so it follows upgrades and survives moving the project. On win32 it is a junction to the absolute path, because directory symlinks there need elevation.
- **The linker owns only its own links.** An entry under `.claude/skills/` is the linker's only if it is a symlink (or junction) whose target resolves inside `<project>/node_modules/`. Anything else, such as a real directory, a file, or a link pointing elsewhere, belongs to the user and is never replaced or removed. Every check uses `lstat`, and nothing follows a link before the ownership test.
- **Two triggers.** Postinstall cannot run when *another* package is installed, so a library added later needs a command: `npx nish-skills`. Postinstall covers the common case, installing nish itself, and also links every Nish package already installed.
- **No compiler change.** This is install tooling in plain Node, like `scripts/postinstall.mjs`. `src/` is untouched, so the rolling freeze, goldens and nish-cmp do not move.

## Ship and link package skills

Owns: `scripts/link-skills.mjs`, `scripts/postinstall.mjs`, `bin/nish-skills.js`, `package.json`, `package-lock.json`, `knip.json`, `tests/run.js`, `docs/guide/using-nish/agent-skills.md`, `docs/guide/getting-started/installation.md`, `docs/guide/language/modules.md`, `docs/README.md`, `scalar.config.json`

## Linker

[`scripts/link-skills.mjs`](../../scripts/link-skills.mjs), new and shipped in `files`.

```js
/** @returns {{ linked: string[], kept: string[], pruned: string[], skipped: { name: string, reason: string }[] }} */
export const linkSkills = (project, { platform = process.platform } = {}) => …
```

1. List the qualifying packages under `<project>/node_modules` (one level, and one level under each `@scope`), sorted by package name so the result is deterministic.
2. For each `skills/<name>/` holding a `SKILL.md`, the first package in sort order claims `<name>`. A later package with the same skill name is `skipped` with the reason naming both packages.
3. Create `<project>/.claude/skills/` if it is missing. A `.claude` or `.claude/skills` that is itself a symlink or not a directory means nothing is written, and the result's `skipped` says why.
4. For each claimed name: if no entry exists, link it (`linked`). If the linker owns the entry, replace it when its target differs (`linked`), otherwise leave it (`kept`). If the user owns it, report it as `skipped` and do not touch it.
5. Remove linker-owned entries whose target no longer exists, for example a package that was uninstalled (`pruned`).
6. Write with a temporary name and rename, so a concurrent reader never sees a half-made entry.

Running it twice changes nothing the second time.

## Command

`bin/nish-skills.js` (node, `#!/usr/bin/env node`) and `"nish-skills": "bin/nish-skills.js"` in `package.json` `bin`. Update `package-lock.json` with `npm install --package-lock-only`, because CI's lint job checks the lockfile against `package.json`.

- `nish-skills [dir]` links for the project at `dir`, or the nearest ancestor of the cwd holding a `package.json`. It prints one line per linked, pruned or skipped name, and a summary.
- `--help` prints usage on stdout and exits 0, the same contract `nish --help` keeps.
- Exit codes: 0 when it ran, even if some names were skipped; 2 for a usage error or when no project is found; 1 when a write failed.
- Read `bin/launcher.js` for conventions. It must import only `node:` built-ins, and the package keeps no runtime dependency ([`.claude/node.md`](../node.md)). Add the new entry points to `knip.json` if `npm run lint:dead` reports them.

## Postinstall

[`scripts/postinstall.mjs`](../../scripts/postinstall.mjs): after the shim swap, in its own `try`/`catch`, so either half failing leaves the other intact and the install always succeeds. It links only when every guard passes, and prints one `nish:` line saying what it did or why it skipped.

| Guard | Why |
| --- | --- |
| Not a checkout (the existing `src/compile.ts` landmark) | `npm ci` in this repository must not write `.claude/skills/` |
| `npm_config_global` is not `"true"` | A global install has no project |
| `NISH_NO_SKILLS` is unset or empty | The opt-out |
| `INIT_CWD` is set, and the realpath of this package's root is `<INIT_CWD>/node_modules/nish`, or the same path under an ancestor of `INIT_CWD` that holds a `package.json` (the hoisted workspace case) | `npx nish` installs into npm's cache with `INIT_CWD` set to the user's cwd. Without this guard it would plant links into that cache |

[`tests/fetch-seed.js`](../../tests/fetch-seed.js) pins that postinstall spawns nothing and fetches nothing. The linker keeps both true.

## Packaging

- Add `"skills"` to `files`.
- In the WP12 package section of [`tests/run.js`](../../tests/run.js) (filter `package`), extend the whitelist and contents checks: the tarball ships `skills/writing-nish/SKILL.md`, `scripts/link-skills.mjs` and `bin/nish-skills.js`, and the shipped-scripts import check still passes.

## Tests

A new section in [`tests/run.js`](../../tests/run.js), guarded by `if (!only || "skills".includes(only))`, next to the WP12 package section. It builds a fixture project under `os.tmpdir()`, outside the checkout, and drives the linker and the command. Each claim is proven by exit status and by `lstat`/`readlink` on the tree, never by message text ([`.claude/testing.md`](../testing.md), "Checks that spawn a process"):

- nish's `writing-nish` and an `@scope/lib` skill (exports with a `nish` condition) are linked as relative symlinks that resolve to the right `SKILL.md`
- a plain package with `skills/x/SKILL.md` and no `nish` condition is not linked
- a user's real `.claude/skills/writing-nish/` directory, and a user's symlink pointing outside `node_modules`, are left byte-for-byte alone
- a second run is a no-op, and removing a package then re-running prunes its link
- two packages claiming one name link the first in sort order and skip the second
- `.claude` as a symlink means nothing is written
- postinstall, run from an installed copy with `INIT_CWD` set to the fixture, links. With `npm_config_global=true`, `NISH_NO_SKILLS=1`, or `INIT_CWD` naming a directory this copy is not installed under, it writes nothing. Run from a read-only `.claude/` it still exits 0
- `nish-skills --help` exits 0, an unknown flag exits 2, and a directory with no `package.json` above it exits 2

The worker shows, in the PR body, the exact command it ran for each check. There is no TypeScript snippet and no IR, because no construct is added.

## Docs

- New page [`docs/guide/using-nish/agent-skills.md`](../../docs/guide/using-nish/agent-skills.md), following [`docs/README.md`](../../docs/README.md#writing-a-guide-page): what gets linked and where, `npx nish-skills` after adding a library, the opt-out, the ownership rule, whether to commit the links (they are relative, so they work after `npm install`), and **for library authors**: ship `skills/<name>/SKILL.md`, include `skills` in `files`, and optionally add a `postinstall` of `nish-skills`. Add its route in [`scalar.config.json`](../../scalar.config.json).
- [`docs/guide/getting-started/installation.md`](../../docs/guide/getting-started/installation.md): one sentence under the project install (`--save-dev`) linking to the page.
- [`docs/guide/language/modules.md`](../../docs/guide/language/modules.md): one sentence in the packages part linking to the page.
- [`docs/README.md`](../../docs/README.md)'s paragraph on the published skill says that the npm package now ships it too.

## Out of scope

- Any change to the compiler (`src/`), including a `nish skills` subcommand. The command is a separate node bin on purpose.
- Reading a dependency's `nish` field. The compiler ignores it, and this feature does not use it.
- Nested `node_modules` (non-hoisted duplicates), and package managers other than npm.
- Agents other than Claude Code (`.cursor/`, `AGENTS.md` injection).

## Verification

```bash
npm run check && npm run lint && npm run lint:dead
node docs/check-links.mjs && node scripts/gen-reference.mjs --check
npm ls --package-lock-only --all > /dev/null
node tests/run.js skills
node tests/run.js package
```

CI's sharded `test` job is the full-suite gate. It also runs `tests/fetch-seed.js` through `tests/run.js`, which pins that postinstall spawns nothing.
