---
name: WP57 — module-scoped names
overview: A struct has a symbol separate from its source name (S3a); what is left is spelling every IR struct, member and constructor from that symbol, then qualifying a clashing private class or interface and allowing rename on import.
roadmap: docs/roadmap/wp57-module-scoped-names.md
spec: docs/wp57-module-scoped-names.md
priority: 40
issue: 1871
stages:
  - id: s3b-struct-spelling
    title: WP57 S3b — every %struct. spelled from the struct's symbol
    goal: Every struct IR type spelling and the header's cStructName read the symbol, messages read the source name, and no IR moves.
    verification: node tests/run.js link && npm run check && node tests/self/goldens.js --update && npm run lint
    status: pending
    issue: 1882
    todos:
      - id: s3b-spellers
        content: Switch the 44 %struct. spellers and llvmType in src/ to read StructInfo.symbol — see WP57 S3b — every %struct. spelled from the struct's symbol
        status: pending
      - id: s3b-header
        content: Make cStructName in the header emitter read the symbol too — see WP57 S3b — every %struct. spelled from the struct's symbol
        status: pending
  - id: s3c-member-symbols
    title: WP57 S3c — member and constructor symbols spelled from their owner's symbol
    goal: The three member sites build owner-symbol.name while displays keep the source name, and no IR moves.
    verification: node tests/run.js link && npm run check && npm run lint
    status: pending
    todos:
      - id: s3c-members
        content: Build member and constructor symbols from the owner's symbol in src/structs.ts and src/generics.ts — see WP57 S3c — member and constructor symbols spelled from their owner's symbol
        status: pending
  - id: s3d-private-qualified
    title: WP57 S3d — a private class or interface qualified by its module path when it would clash
    goal: Two modules may each declare a private class or interface of one name; the clash checks run over symbols, and the user sees the change.
    verification: node tests/run.js link && node tests/run.js wasi && npm run check && npm run lint
    status: pending
    todos:
      - id: s3d-qualify
        content: Qualify a clashing private class or interface symbol by module path and move name lookups to structByType in src/members.ts — see WP57 S3d — a private class or interface qualified by its module path when it would clash
        status: pending
      - id: s3d-docs
        content: Add negative tests, the LANGUAGE.md rule and the guide page for the new accepted case — see WP57 S3d — a private class or interface qualified by its module path when it would clash
        status: pending
  - id: s3e-rename-on-import
    title: WP57 S3e — a class or interface renamed on import
    goal: import { A as B } works for a class or interface, using the symbol the type table now carries.
    verification: node tests/run.js link && npm run check && npm run lint
    status: pending
    todos:
      - id: s3e-rename
        content: Admit rename on import for a class or interface in the import resolution in src/ — see WP57 S3e — a class or interface renamed on import
        status: pending
      - id: s3e-docs
        content: Add the negative test, LANGUAGE.md rule and guide page for renamed type imports — see WP57 S3e — a class or interface renamed on import
        status: pending
---

# WP57 — module-scoped names

## Context
S1 (clashing private functions and generic templates qualified by module path), S2 (exported clashes stay refused, decided) and S3a (`StructInfo.symbol`) have landed; see [the roadmap page](../../docs/roadmap/wp57-module-scoped-names.md). Left are S3b to S3e. S3a to S3c move no IR; S3d is the stage users see; S3e needs only S3a. Spec: [design note §7b](../../docs/wp57-module-scoped-names.md#7b-stages).

## WP57 S3b — every %struct. spelled from the struct's symbol
Every `%struct.` speller and `llvmType` reads the symbol, and so does the header's `cStructName`; every message and `tsKeyword` read the source name. About 44 spellers. Depends on S3a. Release note in the note: `refactor(codegen): spell a struct's IR type from its symbol`. Goldens move only if a symbol differs from the name; regenerate and read the diff.
Likely files: `src/emit*.ts`, `src/header*.ts`.

## WP57 S3c — member and constructor symbols spelled from their owner's symbol
The three member sites build `<owner symbol>.<name>`; displays keep the source name. Depends on S3a; after S3b to keep each diff to one kind of site. Note's release line: `refactor(codegen): spell a member's symbol from its owner's symbol`.
Likely files: `src/structs.ts`, `src/generics.ts`.

## WP57 S3d — a private class or interface qualified by its module path when it would clash
The user-visible stage: a private class or interface that would clash across modules is qualified by module path, with the clash checks over the symbols. Lookups inside one module that go by name (`members.ts`'s `structOf`, the 51 `.struct(nameOf(...))` sites) move to `structByType` where a qualified local struct would otherwise be missed. Construct-style checklist: golden `.ll`, `llvm-as`, round trip, a negative, LANGUAGE.md rule, guide page.
Likely files: `src/structs.ts`, `src/members.ts`, `src/program.ts`, `docs/LANGUAGE.md`, `docs/guide/`.

## WP57 S3e — a class or interface renamed on import
Rename on import for a class or interface; needs only S3a. Likely files: `src/` import resolution, `docs/LANGUAGE.md`, `docs/guide/`.
