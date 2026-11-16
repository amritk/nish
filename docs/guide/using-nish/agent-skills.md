# Agent skills

A coding agent writes better Nish when it has the rules in front of it. Nish
ships them as an *agent skill*: `writing-nish`, a single `SKILL.md` that
teaches an agent the subset, the compile-and-fix loop and the TypeScript
habits Nish rejects. Claude Code loads a project's skills from
`.claude/skills/<name>/SKILL.md`, and installing Nish puts `writing-nish`
there for you. A Nish library can ship skills of its own the same way.

Which packages count as Nish packages is the rule in
[`export` and `import`](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#export-and-import):
the ones whose `package.json` offers a file under the `nish` export condition.

## What installing Nish does

```bash
npm install --save-dev nish
```

links `.claude/skills/writing-nish` to the copy inside
`node_modules/nish/skills/`. It is a link, not a copy, so it follows an
upgrade of Nish and keeps working if you move the project. On Windows it is a
junction, which needs no administrator rights.

Nothing is linked for a global install (`npm install -g nish`), for `npx nish`
run outside a project, or when `NISH_NO_SKILLS` is set to any non-empty value:

```bash
NISH_NO_SKILLS=1 npm install --save-dev nish
```

If the link cannot be written (a read-only directory, say), the install still
succeeds and prints why the skills were left out.

## Linking a library's skills: `npx nish-skills`

npm runs Nish's install step only when Nish itself is installed, so a Nish
library you add later is not linked on its own. Run

```bash
npx nish-skills
```

in the project. It finds the nearest directory above you holding a
`package.json`, or takes one as its argument (`npx nish-skills path/to/app`),
and links the skills of every installed Nish package: `nish` and each
`node_modules/<pkg>` or `node_modules/@scope/<pkg>` with a `nish` condition. An
ordinary npm package that happens to have a `skills/` directory is left out.

It prints one line per change and a summary, and running it again changes
nothing. Run it after you add or remove a Nish library: a link whose package
is gone is removed. It exits 0 when it ran, 1 when a write failed and 2 for a
usage error or when it finds no project.

When two packages ship a skill with the same name, the first by package name
is linked and the other is reported as skipped.

## What belongs to you

`.claude/skills/` is yours, and Nish only ever touches its own links: an entry
is Nish's only if it is a link that points inside the project's
`node_modules/`. Everything else stays exactly as it is:

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

A fresh clone gets them back from `npm install`, or from `npx nish-skills`
for a library's.

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
in a project that installs `greet` links `.claude/skills/greet`. The skill's
name is its directory's name, so pick one that is unlikely to clash with
another package's, such as your package's own name.

Tell your users to run `npx nish-skills` after installing your package; your
README is the place. Do not run it from your own `postinstall`: npm runs that
script inside your package's directory, not the user's project.
