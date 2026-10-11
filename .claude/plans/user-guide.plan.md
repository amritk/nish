---
name: User guide — a user-facing docs section, ready for Scalar
overview: Start a Markdown user guide under docs/guide/, wired into a root scalar.config.json so Scalar Docs can publish it as the documentation site later. Every Nish example in it is compiled by npm test, and every route is checked by the existing link checker.
stages:
  - id: foundation
    title: "docs(guide): add the user guide skeleton and its Scalar config"
    goal: The guide's directory, landing page, full navigation, stub pages for every planned page, and the checks that keep it honest
    verification: node docs/check-links.mjs && node tests/run.js guide && npm run lint
    todos:
      - id: scalar-config
        content: Add scalar.config.json at the repo root with every route of the guide in its final order — see Site layout
        status: pending
      - id: landing-page
        content: Write docs/guide/index.md, the introduction a new user lands on — see Foundation
        status: pending
      - id: stub-pages
        content: Create every planned page under docs/guide/ as a titled stub so all routes resolve — see Site layout
        status: pending
      - id: route-check
        content: Extend docs/check-links.mjs to fail on a route whose filepath is missing and on a docs/guide page no route reaches — see Checks
        status: pending
      - id: example-check
        content: Generalise the docs/AI.md snippet harness in tests/run.js to compile nish-marked fences in docs/guide/**/*.md too — see Checks
        status: pending
      - id: entry-points
        content: Link the guide from README.md and docs/README.md and state the rules for writing a guide page in docs/README.md — see Foundation
        status: pending
  - id: getting-started
    title: "docs(guide): write the getting-started pages"
    goal: A newcomer installs Nish, builds and runs a first program, and knows what changes coming from TypeScript
    verification: node docs/check-links.mjs && node tests/run.js guide
    todos:
      - id: gs-installation
        content: Write docs/guide/getting-started/installation.md — see Getting started
        status: pending
      - id: gs-first-program
        content: Write docs/guide/getting-started/first-program.md — see Getting started
        status: pending
      - id: gs-from-typescript
        content: Write docs/guide/getting-started/from-typescript.md — see Getting started
        status: pending
  - id: language-basics
    title: "docs(guide): write the language basics pages"
    goal: The everyday language, taught by example — types, functions, control flow, arrays and strings, classes and interfaces
    verification: node docs/check-links.mjs && node tests/run.js guide
    todos:
      - id: lb-types
        content: Write docs/guide/language/types.md — see Language basics
        status: pending
      - id: lb-functions
        content: Write docs/guide/language/functions.md — see Language basics
        status: pending
      - id: lb-control-flow
        content: Write docs/guide/language/control-flow.md — see Language basics
        status: pending
      - id: lb-arrays-strings
        content: Write docs/guide/language/arrays-and-strings.md — see Language basics
        status: pending
      - id: lb-classes
        content: Write docs/guide/language/classes-and-interfaces.md — see Language basics
        status: pending
  - id: language-advanced
    title: "docs(guide): write the error handling, generics, modules and memory pages"
    goal: The parts of the language that differ most from TypeScript, explained for a user rather than a compiler author
    verification: node docs/check-links.mjs && node tests/run.js guide
    todos:
      - id: la-errors
        content: Write docs/guide/language/errors.md — see Language advanced
        status: pending
      - id: la-collections
        content: Write docs/guide/language/maps-and-sets.md — see Language advanced
        status: pending
      - id: la-generics
        content: Write docs/guide/language/generics.md — see Language advanced
        status: pending
      - id: la-modules
        content: Write docs/guide/language/modules.md — see Language advanced
        status: pending
      - id: la-memory
        content: Write docs/guide/language/memory.md — see Language advanced
        status: pending
  - id: using-nish
    title: "docs(guide): write the CLI, standard library, interop and threads pages"
    goal: How to drive the compiler and what a program can reach beyond the core language
    verification: node docs/check-links.mjs && node tests/run.js guide
    todos:
      - id: un-cli
        content: Write docs/guide/using-nish/cli.md — see Using Nish
        status: pending
      - id: un-stdlib
        content: Write docs/guide/using-nish/standard-library.md — see Using Nish
        status: pending
      - id: un-interop
        content: Write docs/guide/using-nish/interop.md — see Using Nish
        status: pending
      - id: un-threads
        content: Write docs/guide/using-nish/threads.md — see Using Nish
        status: pending
---

# User guide — a user-facing docs section, ready for Scalar

## Why

Everything under `docs/` today is written for the people building the compiler
(`wp*.md`, `MASTER_PLAN.md`, `IR_COOKBOOK.md`) or is a reference too dense to
learn from (`LANGUAGE.md` at 7,500 lines, `AI.md` for models). There is no page
that teaches a person to write Nish. This starts one, in Markdown, laid out so
Scalar Docs can publish it as the documentation site without moving a file.

## Site layout

The guide lives in `docs/guide/`, one kebab-case `.md` per page. The site is
described by `scalar.config.json` at the repository root (Scalar's GitHub sync
reads it from there), schema `https://registry.scalar.com/@scalar/schemas/config`,
`"scalar": "2.0.0"`, with `navigation.routes`:

| route | type | file |
| --- | --- | --- |
| `/` | page | `docs/guide/index.md` — Introduction |
| `/getting-started` | group | Installation, Your first program, Coming from TypeScript |
| `/language` | group | Types, Functions, Control flow, Arrays and strings, Classes and interfaces, Errors and `Result`, Maps and sets, Generics, Modules, Memory |
| `/using-nish` | group | The CLI, The standard library, Calling Nish from other languages, Threads |
| header links | link | GitHub repository, `LANGUAGE.md` (the full reference), `CHANGELOG.md` |

Page files: `docs/guide/getting-started/{installation,first-program,from-typescript}.md`,
`docs/guide/language/{types,functions,control-flow,arrays-and-strings,classes-and-interfaces,errors,maps-and-sets,generics,modules,memory}.md`,
`docs/guide/using-nish/{cli,standard-library,interop,threads}.md`.

The navigation is complete from the first PR, so the content stages never touch
`scalar.config.json`: each one replaces stubs it owns. A stub is the page's
title plus one sentence saying what it will cover. Nothing is deployed by this
plan; hooking the repository up to Scalar is a later, human step.

## Foundation

- `docs/guide/index.md`: what Nish is in a paragraph, the pre-alpha caution from
  `README.md` restated plainly, a 10-line example, and a map of the guide.
- `README.md` and `docs/README.md` each gain one pointer to the guide.
  `docs/README.md` gets a short "Writing a guide page" section: the audience
  is a person writing programs, not the compiler; examples are marked for
  compilation; each page links the `LANGUAGE.md` section that is normative for
  it; no links to `wp*.md`, `MASTER_PLAN.md` or `.claude/`.

## Checks

- **Routes** — `docs/check-links.mjs` (already run in CI) also reads
  `scalar.config.json`: every `filepath` must exist, and every `.md` under
  `docs/guide/` must be reached by some route. Pages under `docs/guide/` are
  already scanned for broken links because the checker walks `docs/**`.
- **Examples** — the `docs/AI.md` block in `tests/run.js` becomes a loop over
  `docs/AI.md` plus `docs/guide/**/*.md`, using the same markers
  (` ```ts nish:ok `, `nish:ok-body`, `nish:err CODE`, `nish:err-body CODE`)
  and the check names `<path>:<line> compiles` /
  `<path>:<line> is rejected with <code>`. It must run under the filters
  `docs`, `ai` and `guide`. The `>= 15` floor stays on `AI.md` alone; the
  guide's floor is that every page except stubs and `installation.md` carries
  at least one marked example.
- **Config validity** — `npx @scalar/cli project check-config` passes on
  `scalar.config.json` (run by hand in the PR; not added to CI here).

## Getting started

- `installation.md`: npm install, `install.sh`, prerequisites per OS, LLVM 18,
  how to check it worked — from `docs/INSTALL.md`, shortened for a newcomer and
  linking it for the rest.
- `first-program.md`: hello world, `nish run`, compiling to a native binary,
  what an error looks like and how to read its code, exit codes.
- `from-typescript.md`: what carries over and what is refused (`any`,
  exceptions, `number` vs `i32`/`f64`, `?.`/`??`, classes without inheritance)
  with the replacement for each — from `docs/AI.md`'s reflexes section.

## Language basics

`types.md` (i32, f64, i64, bool, string, `T | null` and narrowing, ranged
integers in one paragraph), `functions.md` (arrows, `main`, parameters,
function arguments), `control-flow.md` (if, loops, switch, ternary, checked
arithmetic and what overflow does), `arrays-and-strings.md` (literals, `push`,
`for...of`, bounds, UTF-8 `.length`, templates), `classes-and-interfaces.md`
(fields, `readonly`, `implements`, why no inheritance).

## Language advanced

`errors.md` (`Result<T, E>`, the rules that stop a failure being ignored, no
`throw`), `maps-and-sets.md`, `generics.md`, `modules.md` (import/export,
`nish:` modules, `std` imports, packages), `memory.md` (no GC, arenas,
`using a = arena()`, what a user has to think about and what they do not).

## Using Nish

`cli.md` (the flags a user needs, `--json`, exit codes, `nish run` cache,
`--fix`), `standard-library.md` (each `std/` module with one example),
`interop.md` (Node via N-API, WebAssembly, C headers and `declare function`),
`threads.md` (`parallelMapInto`, `scope()`, `Mutex<T>`, `Channel<T>`).

## Rules for every content stage

- Source of truth is `docs/LANGUAGE.md`, `docs/AI.md` and the compiler; never
  describe a feature from a `wp*.md` note without checking `LANGUAGE.md`.
- Every program shown is a marked fence that `npm test` compiles; a fragment
  that cannot compile is an unmarked block and is kept short.
- Each page links the `LANGUAGE.md` section that is normative for it.
- No internal vocabulary (stage0, seed, Nish-0, work packages) on any page.

## Ownership and order

| stage | Owns | depends on |
| --- | --- | --- |
| foundation | `scalar.config.json`, `docs/guide/**`, `docs/check-links.mjs`, `tests/run.js`, `README.md`, `docs/README.md` | — |
| getting-started | `docs/guide/getting-started/**` | foundation (development) |
| language-basics | `docs/guide/language/{types,functions,control-flow,arrays-and-strings,classes-and-interfaces}.md` | foundation (development) |
| language-advanced | `docs/guide/language/{errors,maps-and-sets,generics,modules,memory}.md` | foundation (development) |
| using-nish | `docs/guide/using-nish/**` | foundation (development) |

The four content stages start once foundation is merged, run in parallel, and
own disjoint files. A content stage that finds a page in another stage worth
linking links to it; it never edits it.
