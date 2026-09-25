# Licensing third-party code

This repository is MIT, and the root [`LICENSE`](../LICENSE) covers the code
written for it. Code written elsewhere keeps the licence it came with, and
almost every permissive licence has one condition: keep the copyright notice in
every copy. That condition is easy to break without noticing, because the
natural way to pin a compiler rule is to paste the program that motivated it
into a test. So the rule here is short, and it is checked.

[`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) is the list of every
third-party file in the tree, and `node tests/run.js third-party-licence` holds
the list, the files and the package to each other.

## What counts as a copy

A file is a copy when it is **ported, translated, adapted, or structurally close
to code someone else wrote**: the same identifiers, the same constants, the same
branches in the same order, the same comments. A port from JavaScript to Nish is
a copy. A C twin of that port is a copy. Ten lines of a benchmark pasted into a
golden case are a copy. Ryu's `d2d()` rewritten with `nish_` prefixes is a copy.

An **idea is not a copy**. Implementing an algorithm from a paper, a textbook
or a description, in your own structure and names, needs a citation in a
comment and nothing else. FNV-1a, a published hash function, is an idea; a
specific program's hash table built around it is code.

When you cannot tell, treat it as a copy. A notice on a file that did not need
one costs two lines.

## What a copy must carry

1. **The upstream notice, in the file.** A header naming where it came from
   (project, file or program, and its contributors where upstream names them),
   the upstream copyright line, and the licence, with the path of the licence
   text in this repository. The existing forms are in
   `THIRD_PARTY_NOTICES.md`'s "Notices" section; reuse the one that fits,
   because the check matches it.
2. **The licence text, in the repository.** Verbatim from upstream, beside the
   code (`runtime/LICENSE-ryu`, `bench/LICENSE-benchmarksgame.md`,
   `bench/awfy/LICENSE.md`).
3. **The licence text in the package, when the file ships.** If
   `package.json`'s `files`, the release tarball or the platform packages carry
   the file, they carry its licence text too. `runtime/` ships whole, so a
   licence file there ships with it; the check also requires each presence gate
   in `.github/workflows/release.yml` that names the file to name its licence.
4. **A row in `THIRD_PARTY_NOTICES.md`.** File, what it derives from, licence,
   licence text. A copy of an Are We Fast Yet port goes in the table in
   `bench/awfy/LICENSE.md` instead, with that file's header.
5. **The origin in the PR body.** Name the upstream project, the file or
   program, its licence, and what you took. A reviewer checks the licence
   there, not by rediscovering where the code came from.

A **ported benchmark keeps the source's constants and its notice**. The
constants are why its numbers compare with the other languages'
([`typescript.md`](./typescript.md), "Naming Conventions"); the notice is the
condition on which it may be used at all.

## Which licences are allowed

Only licences whose code can sit in an MIT repository and ship in an MIT
package: **MIT, BSD (2- and 3-clause), Apache-2.0, BSL-1.0, ISC, zlib, and
public domain / CC0 / Unlicense**. Where upstream offers a choice, take the one
with the lighter obligation for what ships: Ryu is Apache-2.0 *or* BSL-1.0, and
this repository takes BSL-1.0 because it exempts compiled object code, so
neither `nish` nor a program it links needs a notice.

**Never take code from:**

- **GPL, LGPL or AGPL** projects, in any amount. Their terms would reach the
  whole compiler and every runtime it links into a user's program.
- **Rosetta Code** (GFDL), **Stack Overflow** (CC-BY-SA) or **Project Euler**
  solutions (CC-BY-NC). None of them is a licence for code in an MIT package.
- **Anything with no licence at all**: a gist, a blog post, a repository with
  no `LICENSE`. No licence means no permission.

Reading such code to understand an algorithm and then writing your own is
fine; keeping its structure is not. If the only good implementation is under
one of these, say so in the PR and ask.

## Public domain

Public-domain code needs no notice, but say so where its constants appear, so
the next audit does not have to rediscover it: `self/map.ts`,
`self/emit_map.ts` and `std/collections.ts` mark FNV-1a and MurmurHash3's
finalisers, and `runtime/runtime.c` marks xorshift64*.
`THIRD_PARTY_NOTICES.md` lists them under "Public-domain algorithms".
