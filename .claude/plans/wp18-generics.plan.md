---
name: WP18 — generics by monomorphisation
overview: Generics landed; four items were put off on purpose, each with a trigger that would reopen it. They stay deferred until the trigger fires.
roadmap: docs/roadmap/wp18-generics.md
spec: docs/wp18-generics.md
priority: 80
labels: [deferred]
stages:
  - id: g-return-inference
    title: WP18 G9 — infer a type parameter that appears only in the return type
    goal: A factory whose type parameter appears only in its return type infers it from the contextual type instead of being refused at the declaration.
    verification: node tests/run.js generics && npm run check && npm run lint
    status: pending
    labels: [deferred]
    todos:
      - id: g9-infer
        content: Infer a return-only type parameter from the contextual type in src/generics.ts — see WP18 G9
        status: pending
  - id: g-explicit-type-args
    title: WP18 G10 — explicit type arguments at a call, f<i32>(x)
    goal: f<i32>(x) parses and instantiates, using a restartable lexer and a save/restore cursor in the parser.
    verification: node tests/run.js generics && npm run check && npm run lint
    status: pending
    labels: [deferred]
    todos:
      - id: g10-parser
        content: Add a save/restore cursor in src/parser.ts that tells f<i32>(x) from (f < i32) > (x) — see WP18 G10
        status: pending
  - id: g-differential
    title: WP18 G11 — a differential rewrite of generic bodies against Node
    goal: The differential rewriter emits one JavaScript function per instantiation, driven by the checker's typed output.
    verification: node tests/run.js differential && npm run lint
    status: pending
    labels: [deferred]
    todos:
      - id: g11-rewriter
        content: Drive the rewriter from stage1's per-instantiation types in tests/differential — see WP18 G11
        status: pending
  - id: g-imported-interface
    title: WP18 G12 — a class implementing an interface imported from another module
    goal: A class may implement an imported interface, with the resolved StructInfo recorded beside each implements name.
    verification: node tests/run.js link && node tests/run.js generics && npm run check && npm run lint
    status: pending
    labels: [deferred]
    todos:
      - id: g12-implements
        content: Lift the NL2079 refusal and record StructInfo in implementsDeclaration in src/generics.ts — see WP18 G12
        status: pending
---

# WP18 — generics by monomorphisation

## Context
Generic functions, classes, interfaces, constraints, generic methods, whole-program instantiation and discriminated unions have landed. See [the roadmap page](../../docs/roadmap/wp18-generics.md). All four stages below are deferred on purpose; [§16](../../docs/wp18-generics.md#16-wp18-is-closed-what-stays-deferred) says what reopens each. Stage ids G9 to G12 are this plan's numbering.

## WP18 G9 — infer a type parameter that appears only in the return type
Today refused at the declaration ([§2a](../../docs/wp18-generics.md#2-the-surface-what-is-written), §14 question 1). Trigger: the first container library written against generics needs a factory in more than two places.

## WP18 G10 — explicit type arguments at a call, f<i32>(x)
Refused on a parser ground: one token of lookahead cannot tell `f<i32>(x)` from `(f < i32) > (x)`. Trigger: evidence that inference is too weak in practice, which pays for a restartable lexer and save/restore cursor.

## WP18 G11 — a differential rewrite of generic bodies against Node
Each instantiation rewrites differently (`i32` wraps, `f64` does not), so one JS function per instantiation is needed, from stage1's typed output ([wp19 §6](../../docs/wp19-stage0-retirement.md)). Until then the fuzzer's seed-versus-HEAD comparison and golden round trips cover generics. Trigger: a stage1-typed rewriter.

## WP18 G12 — a class implementing an interface imported from another module
NL2079 (`Shape` is not a declared interface) is relied on by the constraint check and by the class-to-interface conversion (#173); both fail closed, so lifting it alone would reject an imported constraint. Trigger: a program that needs it.
