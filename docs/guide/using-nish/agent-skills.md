# Agent skills

A coding agent writes better Nish when it has the rules in front of it. Nish
ships them as an *agent skill*: `writing-nish`, a single `SKILL.md` that
teaches an agent the subset, the compile-and-fix loop and the TypeScript
habits Nish rejects. Claude Code loads a project's skills from
`.claude/skills/<name>/SKILL.md`. A Nish library can ship skills of its own
the same way.

Which packages count as Nish packages is the rule in
[`export` and `import`](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#export-and-import):
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
starts shipping a skill under a name you accepted.

## Reviewing skills: `npx nish-skills`

Run it in the project, in a terminal:

```bash
npx nish-skills
```

For each skill you have not accepted at its current hash, it prints the
package, the skill's description and the tools it grants, then asks
`Link <name>? [y/N]`. Only `y` or `yes` links it. Enter, any other answer and
the end of input decline. A decline is not recorded, so the next run asks
again.

Where there is no terminal to ask in, such as a script or CI, say what to
accept:

```bash
npx nish-skills writing-nish   # link these skills, whatever they grant
npx nish-skills --yes          # link every skill that grants no tools
```

`--yes` links only a skill whose frontmatter grants no tools. A skill with an
`allowed-tools` key, even an empty one, or with frontmatter Nish cannot read,
is left for you to name. Run with neither, and with no terminal, the command
keeps what you accepted before and links nothing new.

It finds the project the same way the install does: the directory whose
`node_modules/nish` it is running from, which in a workspace is the root Nish
was hoisted to even when you run it inside a member. Failing that, it takes
the nearest directory above you holding a `package.json`. You can also name
the project with `--dir path/to/app`. It considers the skills of every
installed Nish package: `nish` and each `node_modules/<pkg>` or
`node_modules/@scope/<pkg>` with a `nish` condition. An ordinary npm package
that happens to have a `skills/` directory is left out.

It prints one line per change and a summary, and running it again changes
nothing. Run it after you add, remove or upgrade a Nish library: a link whose
package is gone is removed. It exits 0 when it ran, 1 when a write failed, and
2 for a usage error, a skill name no installed package ships, or when it finds
no project.

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
again without asking, as long as their hashes still match.

## For library authors: shipping a skill

Put each skill at `skills/<name>/SKILL.md` in your package, list `skills` in
`package.json`'s `files` so npm publishes it, and offer your source under the
`nish` condition as every Nish package does:

```json nish:ok file=node_modules/greet/package.json
{
  "name": "greet",
  "version": "1.0.0",
  "exports": { ".": { "nish": "./src/index.ts" } },
  "files": ["src", "skills"]
}
```

```ts nish:ok file=node_modules/greet/src/index.ts
// node_modules/greet/src/index.ts
export const greet = (name: string): string => `hello, ${name}`;
```

```ts nish:ok file=main.ts
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
them, since `--yes` skips a skill that grants any. Every release that changes
the skill directory asks your users to accept it again.

Tell your users to run `npx nish-skills` after installing your package; your
README is the place. Do not run it from your own `postinstall`: npm runs that
script inside your package's directory, not the user's project.
