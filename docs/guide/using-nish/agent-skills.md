# Agent skills

A skill from a package is instructions your coding agent follows, written by
whoever published the package, so Nish links one into your project only after
you accept it. An acceptance holds for one package, one skill and one hash of
that skill's contents: when any of the three changes, Nish asks again.
Installing a package never links a skill. `npx nish-skills` shows you each one
and asks. A skill that grants anything, such as `allowed-tools`, `hooks` or a
shell command run when it loads, is linked only when you answer `y` or name
it. Nish never follows a link to find a skill. A skill that holds a link, or
an entry Nish cannot read, counts as a grant too, and accepting one links it
for that run only. The check runs when you run `npx nish-skills`, not when npm
installs, so between an upgrade and your next run your agent sees the new
version of a linked skill. And whoever can change a committed
`.claude/skills/.nish-skills.json` can accept a skill for everyone who clones
the project.

A coding agent writes better Nish when it has the rules in front of it. Nish
ships them as an *agent skill*: `writing-nish`, a single `SKILL.md` that
teaches an agent the subset, the compile-and-fix loop and the TypeScript
habits Nish rejects. Claude Code loads a project's skills from
`.claude/skills/<name>/SKILL.md`. A Nish library can ship skills of its own
the same way.

Which packages count as Nish packages is the rule in
[`export` and `import`](../../reference/language/declarations.md#export-and-import):
the ones whose `package.json` offers a file under the `nish` export condition.

## A skill is linked only when you accept it

A skill is instructions your agent follows, written by whoever published the
package, and its frontmatter can grant the agent tools without asking you
each time:

```text
---
name: deploy
description: Ship the app.
allowed-tools: Bash
---
```

So installing a package never links one. `npm install --save-dev nish` writes
nothing under `.claude/`; it prints one line telling you to run
`npx nish-skills`. That command shows each skill and links only the ones you
accept.

You accept a skill *as it is now*. Nish records a SHA-256 hash of the skill's
whole directory, every file and link in it, in
`.claude/skills/.nish-skills.json`. When an upgrade changes anything in an
accepted skill, the next `npx nish-skills` asks again, and a run that cannot
ask removes the link until you do. The same happens when a different package
starts shipping a skill under a name you accepted, and when the package that
shipped a linked skill stops being a Nish package: any link of Nish's that is
not accepted at a skill found now is removed.

**Run `npx nish-skills` after you upgrade a package that ships skills.** The
check happens when the command runs, not when npm installs. A link points into
`node_modules/`, so from the moment `npm update` replaces the package until
your next `npx nish-skills`, your agent sees the new version of the skill,
whatever it now grants.

## Reviewing skills: `npx nish-skills`

Run it in the project, in a terminal:

```bash
npx nish-skills
```

For each skill you have not accepted at its current hash, it prints the
package, the skill's description and what it grants, one grant to a line with
the ones that act first, then asks `Link <name>? [y/N]`. A list of tools shows
how many entries it has and then each distinct tool on a line of its own, the
ones that run commands, write files, start agents or reach out first (`Bash`,
`PowerShell`, `Write`, `Edit`, `MultiEdit`, `NotebookEdit`, `WebFetch`,
`WebSearch`, `Task`, `Agent`, `Skill`, `KillShell` and any `mcp__` tool), so a
long list cannot hide one. Only `y` or `yes` links it. Enter, any other answer
and the end of input decline. A decline is not recorded, so the next run asks
again. Ctrl-C at a question stops the command with exit status 130 and writes
nothing, since every question is asked before anything is linked.

Where there is no terminal to ask in, such as a script or CI, say what to
accept:

```bash
npx nish-skills writing-nish   # link these skills, whatever they grant
npx nish-skills --yes          # link every skill that grants nothing
```

`--yes` links only a skill that grants nothing. Nish reads a skill's
frontmatter against a list of keys known to be inert, such as `name`,
`description`, `model` and `paths`. Anything else counts as a grant, and the
skill is left for you to name:

- an `allowed-tools` key, even an empty one;
- `hooks`, `context`, `agent` or `background`;
- any key Nish does not know;
- a shell command the agent runs when the skill loads: `` !`cmd` `` in the
  text, or a code fence opened with `` ```! `` or `~~~!`, spaces before the
  `!` and a list or quote marker before the fence included;
- frontmatter Nish cannot read, or none at all. Nish reads only plain
  `key: value` lines between two lines that are exactly `---`, indented with
  spaces. A carriage return that does not end a line, a vertical tab, a form
  feed, a tab or any other whitespace at the start of a line, or a `...` or
  extra `---` line makes the frontmatter unreadable, since another reader
  might see a key there that Nish does not;
- a link, a device or other special file, or an entry Nish cannot read,
  anywhere in the skill's directory, or a directory more than 32 levels deep,
  or holding more than 10,000 entries or 64 MiB of files, which Nish stops
  reading. Its hash cannot pin what it serves, so accepting it links it for
  that run only, and the next run removes the link.

A linked `skills/` directory, a linked skill directory and a linked
`SKILL.md` are no skill at all: Nish does not offer them, and naming one is
an unknown skill.

Run with neither names nor `--yes`, and with no terminal, the command keeps
what you accepted before and links nothing new. `npx nish-skills --help`
prints the usage, whatever else is on the line.

It finds the project the same way the install does: the directory whose
`node_modules/nish` it is running from, which in a workspace is the root Nish
was hoisted to even when you run it inside a member. Failing that, it takes
the nearest directory above you holding a `package.json`. You can also name
the project with `--dir path/to/app`. It considers the skills of every
installed Nish package: `nish` and each `node_modules/<pkg>` or
`node_modules/@scope/<pkg>` with a `nish` condition. An ordinary npm package
that happens to have a `skills/` directory is left out, and so is a skill
directory whose name is not a valid skill name: lowercase letters, digits,
`.`, `_` and `-`, starting with a letter or digit, at most 64 characters.

It prints one line per change, a `found` entry for each skill still waiting
to be accepted (what it grants, and the exact `npx nish-skills <name>` that
accepts it on a line of its own), and a summary. Running it again changes
nothing on disk, though the `found` lines repeat until you accept or remove
those skills. Run it after
you add, remove or upgrade a Nish library. It exits 0 when it ran, 1 when a
write failed, 2 for a usage error, a skill name no installed package ships, or
when it finds no project, and 130 when Ctrl-C interrupts a question.

When two packages ship a skill with the same name, `nish` wins first, so no
library can replace `writing-nish`; between libraries, the first by package
name is offered and the other is reported as skipped.

Each link points at the copy inside `node_modules/<pkg>/skills/`. On Windows
it is a junction, which needs no administrator rights.

## What the install prints

The install prints its one line only for a local install into a project. It
stays quiet for a global install (`npm install -g nish`), for `npx nish` run
outside a project, and when `NISH_NO_SKILLS` is set to any non-empty value:

```bash
NISH_NO_SKILLS=1 npm install --save-dev nish
```

## What belongs to you

`.claude/skills/` is yours, and Nish only ever touches its own links and its
record, `.nish-skills.json`: an entry is Nish's only if it is a link that
points inside the project's `node_modules/`. Everything else stays exactly as
it is:

- a skill directory you wrote yourself, even one named `writing-nish`, which
  then wins over Nish's;
- a link you made to somewhere else;
- `.claude` or `.claude/skills` itself when it is a link or a file: then
  nothing is written at all.

The links point into `node_modules/`, so they only work where the packages
are installed. Most projects leave them out of version control with a line in
`.gitignore`:

```text
.claude/skills/writing-nish
```

Commit `.claude/skills/.nish-skills.json` if you want a fresh clone to keep
what you accepted: after `npm install`, `npx nish-skills` links those skills
again without asking, as long as their hashes still match. Whoever can change
that file can accept a skill for everyone who clones the project, one that
grants tools included, so review a change to it as you would a change to code.

## For library authors: shipping a skill

Put each skill at `skills/<name>/SKILL.md` in your package, list `skills` in
`package.json`'s `files` so npm publishes it, and offer your source under the
`nish` condition as every Nish package does:

<!-- nish:ok -->
```json node_modules/greet/package.json
{
  "name": "greet",
  "version": "1.0.0",
  "exports": { ".": { "nish": "./src/index.ts" } },
  "files": ["src", "skills"]
}
```

<!-- nish:ok -->
```ts node_modules/greet/src/index.ts
// node_modules/greet/src/index.ts
export const greet = (name: string): string => `hello, ${name}`;
```

<!-- nish:ok -->
```ts main.ts
// main.ts
import { greet } from "greet";

export const main = (): i32 => {
  console.log(greet("agent"));
  return 0;
};
```

With `skills/greet/SKILL.md` beside `src/` in the package, `npx nish-skills`
in a project that installs `greet` offers `.claude/skills/greet`. The skill's
name is its directory's name, so pick one that is unlikely to clash with
another package's, such as your package's own name.

Give the skill frontmatter with a `name` and a `description`: the description
is what a user reads before accepting it. Grant tools only if the skill needs
them, and keep to the inert frontmatter keys, since `--yes` skips a skill that
grants anything. Name the skill's directory with lowercase letters, digits,
`.`, `_` and `-`, or it is not offered at all. Every release that changes
the skill directory asks your users to accept it again.

Tell your users to run `npx nish-skills` after installing your package; your
README is the place. Do not run it from your own `postinstall`: npm runs that
script inside your package's directory, not the user's project.
