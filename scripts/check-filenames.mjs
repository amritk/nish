#!/usr/bin/env node
// Every tracked path is kebab-case: `emit-arrays.ts`, `runtime-os.c`,
// `docs/wp19-stage0-retirement.md`. Biome's `useFilenamingConvention` says the
// same thing, but only about the files Biome reads; this covers the rest of the
// tree (C, shell, Markdown, directories) so there is one rule, not one per
// language.
//
// Each path segment is split on `.` and every part must be lowercase letters and
// digits joined by single hyphens, so `no-attribution.test.mjs`, `nish.d.ts` and
// `changelog/0.10.0.json` pass and `emit_arrays.ts` and `emitArrays.ts` do not.
// A leading dot (`.github`, `.gitignore`) and a leading `@` (an npm scope) are
// dropped before the check.
//
// Two kinds of name are exempt, because the spelling carries meaning:
//   - An ALL-CAPS file is a document convention every reader knows to look for:
//     `README.md`, `LICENSE`, `CHANGELOG.md`, `THIRD_PARTY_NOTICES.md`,
//     `docs/LANGUAGE.md`.
//   - The test fixture trees in FIXTURE_ROOTS. A case's name is an identifier:
//     `cf_while_break` is cited by `docs/LANGUAGE.md`, `known-failures.txt`, the
//     wordings register and the goldens, and the family prefix before its first
//     underscore is how `.claude/testing.md` groups the suite. Renaming 3,000
//     fixtures would move all of that for no reader's benefit.
//
//   node scripts/check-filenames.mjs             exit 1 on any violation
//   node scripts/check-filenames.mjs --advisory  print them, exit 0
//
// `--advisory` is what `npm run lint` passes until the kebab-case rename lands
// (`.claude/linting.md`, "The cleanup pass"); the rename drops the flag and the
// rule becomes a gate.
// Not shipped in the npm package.
import { execFileSync } from "node:child_process";

const FIXTURE_ROOTS = ["tests/cases/", "tests/wordings/", "tests/link/", "tests/differential/corpus/"];

const KEBAB_PART = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SHOUTED_DOCUMENT = /^[A-Z][A-Z0-9]*([_-][A-Za-z0-9]+)*(\.[a-z]+)?$/;

/** Whether one path segment (a directory or a file name) is kebab-case. */
const isKebabSegment = (segment) => {
  const bare = segment.replace(/^[.@]/, "");
  return bare.split(".").every((part) => KEBAB_PART.test(part));
};

/** The segments of `file` that break the rule, empty when it is exempt or clean. */
const offendingSegments = (file) => {
  if (FIXTURE_ROOTS.some((root) => file.startsWith(root))) {
    return [];
  }
  const segments = file.split("/");
  const base = segments[segments.length - 1];
  const dirs = segments.slice(0, -1);
  const bad = dirs.filter((dir) => !isKebabSegment(dir));
  if (!SHOUTED_DOCUMENT.test(base) && !isKebabSegment(base)) {
    bad.push(base);
  }
  return bad;
};

const main = (argv) => {
  const advisory = argv.includes("--advisory");
  const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0");
  const violations = files.filter((file) => file.length > 0 && offendingSegments(file).length > 0);
  if (violations.length === 0) {
    return 0;
  }

  const lines = violations.map((file) => `  ${file}  (${offendingSegments(file).join(", ")})\n`);
  process.stderr.write(
    `${violations.length} path(s) are not kebab-case:\n${lines.join("")}` +
      "\nRename to kebab-case (`emit_arrays.ts` -> `emit-arrays.ts`); see .claude/linting.md.\n"
  );
  return advisory ? 0 : 1;
};

process.exitCode = main(process.argv.slice(2));
