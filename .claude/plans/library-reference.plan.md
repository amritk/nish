---
name: Generate the library reference from source into Scalar Docs pages
overview: Add scripts/gen-reference.mjs, which runs TypeDoc's JSON output over std/**/*.ts and runtime/nish.d.ts and renders one Scalar-markdown page per module into docs/reference/, with their routes in scalar.config.json and a --check mode CI runs. The pages sit beside the hand-written guide and replace nothing yet.
stages:
  - id: generator
    title: "docs: generate the library reference from source"
    goal: One command regenerates docs/reference/*.md and the Reference routes from the sources, and CI fails when they are stale
    verification: node scripts/gen-reference.mjs --check && node docs/check-links.mjs && npm run check && npm run lint
    todos:
      - id: pin-typedoc
        content: Add typedoc 0.28.20 as an exact devDependency in package.json and package-lock.json, and register it with knip if knip flags it — see Pipeline
      - id: widths-plugin
        content: Add scripts/typedoc-nish-widths.mjs, the TypeDoc plugin that restores i32/u8/... as written — see Pipeline
      - id: typedoc-run
        content: Run TypeDoc in-process from scripts/gen-reference.mjs with the fixed config (ES2022 lib, no types, moduleDetection force, nish paths, excludePrivate/Internal, GitHub source links) and confirm 0 TS errors — see Pipeline
      - id: render-pages
        content: Render one page per module with the C-flat template into docs/reference/, nish-name.md for builtin modules — see Page template
      - id: module-jsdoc-convention
        content: Choose and document in docs/README.md how a module JSDoc marks its info, warning and detail paragraphs — see Module JSDoc convention
      - id: routes
        content: Write the generated routes into the Reference group of scalar.config.json, add docs/LANGUAGE.md there, and point the header's Language reference link at it — see Wiring
      - id: check-mode
        content: Add --check (exit 1 naming each stale page or route) and run it in .github/workflows/ci.yml next to node docs/check-links.mjs — see Wiring
      - id: never-hand-edit
        content: Put a do-not-edit header comment in each page, the rule in docs/README.md, and the rule in CLAUDE.md's goldens paragraph — see Wiring
      - id: package-files
        content: Exclude the two new scripts from the npm package's files list in package.json — see Wiring
      - id: screenshots
        content: Preview with scalar project preview under Node 24 and put screenshots of nish/regex and one nish- module in the PR body — see Verification
---

## Stage: generator

**Owns:** `scripts/gen-reference.mjs`, `scripts/typedoc-nish-widths.mjs`, `typedoc.json` (if used), `docs/reference/**`, `scalar.config.json`, `package.json`, `package-lock.json`, `knip.json`, `.github/workflows/ci.yml`, `docs/README.md`, `CLAUDE.md`

One stage, one PR: the generator, its output, its routes and its CI step have to land together or `--check` is red.

## Context

[`scalar.config.json`](../../scalar.config.json) already publishes the hand-written guide, with a `/reference` group (install, std/README, run-under-node, benchmarks, changelog). Its header links "Language reference" to GitHub's copy of [`docs/LANGUAGE.md`](../../docs/LANGUAGE.md). There is no API reference generated from the JSDoc in [`std/`](../../std) and [`runtime/nish.d.ts`](../../runtime/nish.d.ts).

## Approach

- **TypeDoc JSON, our renderer.** No typedoc-plugin-markdown; read the `--json` project (or the in-process `ProjectReflection` serialised the same way) and render ourselves, so the template is ours.
- **Generated, never hand-edited**, like the goldens. `--check` regenerates into memory and diffs against disk.
- **Placement.** The generated pages go into the existing Reference group as a child group (for example `/reference/library/...`), so the generator owns one subtree of `scalar.config.json` and leaves every hand-written route alone. `--check` compares only that subtree plus the LANGUAGE.md page and header link.
- **Determinism.** Output must be byte-stable across runs and machines (sorted modules, no timestamps, no absolute paths, `\n` line ends, formatted the way biome leaves `scalar.config.json`), or `--check` is red on CI.

## Pipeline

- `typedoc` pinned exactly at `0.28.20` in `devDependencies`. It needs the repo's `typescript`; confirm the lockfile resolves without a second copy.
- TypeDoc options: `entryPoints` = `std/**/*.ts` + `runtime/nish.d.ts`; compiler options `lib: ["ES2022"]`, `types: []`, `moduleDetection: "force"`, `paths: { "nish/*": ["./std/*"] }`; `excludePrivate`, `excludeInternal`; `sourceLinkTemplate: "https://github.com/amritk/nish/blob/main/{path}#L{line}"`. Keep it in a config file or inline in the script, whichever is simpler; the run must report 0 TS errors (without lib/types, `crypto.getRandomValues` gives 17 TS2345 errors), and the script fails if TypeDoc reports any error.
- [`scripts/typedoc-nish-widths.mjs`](../../scripts/typedoc-nish-widths.mjs): the plugin from the request, verbatim in behaviour, so `type i32 = number` shows as `i32`:

```js
import { Converter, UnknownType } from "typedoc"
import ts from "typescript"
const spelt = (node) => (node && node.type ? new UnknownType(node.type.getText()) : undefined)
export function load(app) {
  const sigs = []
  app.converter.on(Converter.EVENT_CREATE_SIGNATURE, (_ctx, refl, node) => { if (node) sigs.push([refl, node]) })
  app.converter.on(Converter.EVENT_CREATE_DECLARATION, (ctx, refl) => {
    const d = ctx.getSymbolFromReflection(refl)?.valueDeclaration
    if (d && (ts.isPropertyDeclaration(d) || ts.isPropertySignature(d) || ts.isVariableDeclaration(d)) && d.type) refl.type = spelt(d)
  })
  app.converter.on(Converter.EVENT_RESOLVE_BEGIN, () => {
    for (const [refl, node] of sigs) {
      const r = spelt(node); if (r) refl.type = r
      const ps = node.parameters ?? []
      ;(refl.parameters ?? []).forEach((p, i) => { const t = spelt(ps[i]); if (t) p.type = t })
    }
  })
}
```

- Kind numbers: 32 variable, 64 function, 128 class, 256 interface, 2097152 type alias, 1024 property, 2048 method. Comments: `comment.summary[].text`; for functions and methods `signatures[0].comment`, `@param` on each parameter, `@returns` in `blockTags`.
- Import path: `nish/<module>` for `std/` (e.g. `std/crypto/sha256.ts` → `nish/crypto/sha256`), `nish:<name>` for each `declare module "nish:<name>"` in `runtime/nish.d.ts`. File names never contain `:` (Windows): `nish:fs` → `docs/reference/nish-fs.md`; `nish/crypto/sha256` → a colon-free, slash-free or nested name of the worker's choosing, stated in docs/README.md. Global (non-module) declarations in nish.d.ts get one page of their own (e.g. `docs/reference/builtins.md`) or are left out, stated in the PR.

## Page template

Template "C, flat": Scalar markdown components, no tabs. Every custom tag has an explicit closing tag and a blank line around its body. In order:

1. `# nish/regex`, then the module's lead sentence.
2. A ` ```ts ` block importing every export, one name per line. Then the module JSDoc's usage example as a second ` ```ts ` block, without `lineNumbers` (Scalar numbers from 0).
3. `<scalar-grid cols="2">` with one `<scalar-card title icon href="#anchor">` per function (icon `phosphor/regular/function`) and per class (icon `phosphor/regular/cube`); the body is the doc's first sentence. Anchors must match Scalar's heading slugs (check-links resolves them).
4. The module JSDoc's remaining paragraphs: the first → `<scalar-callout type="info">`; a limits/refusals paragraph → `<scalar-callout type="warning">`; a paragraph opening with a bold lead (`**Matching never backtracks.** …`) → `<scalar-detail title="Matching never backtracks">` with the rest as body. Anything else stays a plain paragraph.
5. Per function: `## name`, its description, its signature in a ` ```ts ` block (one parameter per line when longer than about 50 characters), `#### Parameters` as `<scalar-field name type required>` rows holding the `@param` text, then `#### Returns` as one `<scalar-field name="returns" type=…>` holding the `@returns` text.
6. Per class or interface: `## Name`, its description, and a `| Member | |` table with `` `method(a: i32): string` `` and its description. Escape `|` inside cells.
7. Exported constants: `## Limits` (or `## Constants` when they are not limits) as a `<scalar-grid cols="2">` of cards titled with the value formatted (`10,000`), with `` `NAME` `` and the description in the body.

Every page starts with a header comment saying it is generated by `node scripts/gen-reference.mjs` and must not be edited. Undocumented members render with their type and no description — never invent text, never skip the member.

## Module JSDoc convention

Decide how a module comment marks the warning paragraph and the detail paragraphs (a TSDoc block tag such as `@remarks`/a custom tag, or a pure convention such as "bold lead → detail, a paragraph under a `Limits`/`Refuses` lead → warning"). Prefer a convention today's comments already follow, so no `std/` file needs editing. Write it in [`docs/README.md`](../../docs/README.md) beside the guide-page rules. If a custom tag is chosen, register it in TypeDoc's `blockTags`/`modifierTags` so TypeDoc does not warn.

## Wiring

- `scalar.config.json`: the generated routes as a group inside the existing `/reference` group, plus a page for `docs/LANGUAGE.md`; the header's "Language reference" link points at that route instead of GitHub. Hand-written routes stay as they are.
- `--check`: regenerate in memory, compare every page and the owned route subtree, exit 1 naming each stale or extra file. Extra files in `docs/reference/` (a removed module) count as stale.
- [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml): a step `node scripts/gen-reference.mjs --check` in the lint job right next to `node docs/check-links.mjs` (that job runs `npm ci`, so typedoc is installed there).
- `docs/README.md`: a row for the reference, the never-hand-edit rule, the regenerate command, and the JSDoc convention.
- [`CLAUDE.md`](../../CLAUDE.md): add `docs/reference/` (regenerated with `node scripts/gen-reference.mjs`) to the "Generated goldens are regenerated, never edited or merged by hand" paragraph.
- `package.json` `files`: add `!scripts/gen-reference.mjs` and `!scripts/typedoc-nish-widths.mjs`; the package ships `scripts/*` and these are repo tooling.
- `std/` and `runtime/nish.d.ts` are not edited unless the generator strictly needs it (other sessions are adding JSDoc and marking internals `private`); any such edit is listed and justified in the PR body.

## Out of scope

- Writing or fixing JSDoc in `std/` or `runtime/nish.d.ts`.
- Removing or rewriting any hand-written guide page or route.
- Making `@scalar/cli` a dependency (preview only).
- Changes to `src/`, the goldens, or the test suite.

## Tests

`tests/run.js` has nothing for docs tooling; the gate is `--check` itself. Show in the PR body that `--check` fails on a hand-edited page and on a stale route, and passes after regeneration. Run it twice in a row and confirm byte-identical output.

## Verification

```bash
npm ci
node scripts/gen-reference.mjs            # writes docs/reference/ and routes
node scripts/gen-reference.mjs --check    # exit 0
node docs/check-links.mjs
npm run check
npm run lint
npx knip --no-progress                    # typedoc devDependency and new scripts accounted for
```

Preview: under Node 24, `npx @scalar/cli@2.15 project preview` (not a dependency), screenshot `nish/regex` and one `nish:` page with Playwright at deviceScaleFactor 2, and push the PNGs to a separate branch `feature/library-reference/screenshots` (never the PR branch, so they stay out of the diff); the PR body embeds them by their `raw.githubusercontent.com` URL.
