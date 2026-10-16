# `nish:secret`: the checker rules that keep a key in its `Secret`

The record for the `nish:secret` checker rules. It says what was checked, how,
what was found, and which test pins each answer. The `file:line` anchors in
**Where (base)** are at `main` `b515c1b`; the fix names functions rather than
lines, because it moves every line below them.

## Scope

| File | What |
| --- | --- |
| `src/secret.ts` | `SecretFlow` (the ownership walk: `move`, `name`, `collectFlow`), `checkSecretFlow`, and the sole-reference rule this record adds: `ReferenceScan`, `FreshJudge`, `checkSoleReferences`, `FreshResults` |
| `src/compilation.ts` | `Compilation.checkSecrets`, which asks the whole-program questions |
| `src/program.ts` | `SecretNeed` and `CheckedProgram.secretNeeds`, the questions a body leaves for it |

Read but not owned: `src/attributes.ts` (`PointerParamFacts.captured`, the fact
the rule reads for "keeps its parameter").

## Threat model

`nish:secret` is a promise the compiler makes to the program's own author:
key material held in a `Secret<T>` leaves only through `expose`, and after
`wipe` nothing reads it. The rules run at compile time, so no input the program
reads can reach them; what they defend against is a program that, by mistake,
keeps a second road to the bytes. A rule the checker states and does not hold
is the failure: the program compiles, and its key is readable where the
language says it is not.

## Method

- Read `SecretFlow.move` and every place a local can be named in a body, and
  listed each way a second name for an array or record can be made before
  `secret(x)` moves `x`: a `const` or `let`, a field, an element, a callee's
  parameter, a callee's return value, a ternary or a `??`, a `Result` built by
  `Ok` or `Err` and read back through `orReturn`, `expect` or `unwrapOr`, a
  constructor's argument or its `this`, a method's `this`, a `for...of`
  binding, a later declarator of the same statement, an assignment used as a
  value, and an arrow's capture. The compound assignments (`+=`, `??=`,
  `||=`) take no array, so they are no road.
- Wrote a program for each one that reads the alias after `wipe`, and ran it
  against `main`'s compiler.

## Findings

| Id | Severity | Where (base) | Description | Disposition |
| --- | --- | --- | --- | --- |
| SECRET-1 | Medium | `src/secret.ts:1078` (`SecretFlow.move`), `src/secret.ts:1221` (`checkSecretFlow`) | `secret(x)` marked the one local `x` moved, and NL2445 refused a later read of `x`, but nothing asked whether the value had another name. `const alias = raw; const key = secret(raw); wipe(key); alias[0]` compiled and read 0, and before the `wipe` the same name read the key with none of the `Secret`'s rules. Every road listed under Method compiled: `let`, a field (`h.buf = raw`, `{ buf: raw }`), an element (`[raw]`, `xs[0] = raw`, `xs.push(raw)`), a callee that stores or returns its parameter, `secret(id(raw))` with `raw` read after, a ternary (`c ? raw : other` as a value, and as the argument of `secret`, which moved neither arm), `maybe ?? raw`, `Ok(raw)` and `Err(raw)` (the `Result` holds `raw` as its payload or its error), a constructor that keeps its argument or hands `this` out, a method that keeps `this` or answers a field, `rows.pop()`, a `let` given another local's array, a `for...of` binding, a later declarator (`const n = 1, alias = raw`), an assignment to the local used as a value (`alias = raw = [1, 2, 3]`, `const alias = (raw = [...])`, `xs.push(raw = [...])`, `h.k = (raw = [...])`, `keep(h, raw = [...])`, found in review round 3), and, once #609 let an arrow given to `parallelMap`, `parallelFrom`, `parallelMapInto` or `parallelReduce` read the function's `const` locals, a capture of `raw` by such an arrow. The ternary also let a parameter past NL2447: `secret(c ? p : [1])`. Medium: no input reaches the rule, so not High, but a program it accepts reads its key outside `expose` without a word, which is more than hardening | **Fixed.** `secret(v)` takes only a value nothing else holds (docs/LANGUAGE.md, "Secrets"; NL2506). `checkSoleReferences` judges each argument over the body it is in (`FreshJudge`): a literal, `null` and a `new` are fresh, a ternary when both arms are, a call when its callee's answer is, and a local when it is no parameter, every value it is given is fresh and not another local, it is no `for...of` binding, and `ReferenceScan` finds no other occurrence that leaves a second name (one inside an arrow, resolved through `sourceLocal` to the local it captures, always does). What only the whole program knows is left as a `SecretNeed`, which `Compilation.checkSecrets` answers with `FreshResults`: a callee's answer, judged over its own body by the same rule as a greatest fixpoint over the calls between them, and whether a callee keeps a parameter, which `PointerParamFacts.captured` says. An assignment to the local is harmless only where its own value is dropped, by a statement or a `for` header (`ReferenceScan.harmlessAt`); anywhere else its value is judged as the local is. `ReferenceScan.handsOn` follows a value through every wrapper that answers it: parentheses, a ternary arm, `??`, `Ok` and `Err`, and `orReturn`, `expect` and `unwrapOr`, so `const r = Ok(raw)` leaves a second name while a callee's `return Ok(out)` is its result. A `Result` method that answers the payload is judged by what the `Result` carries, so `make().orReturn()` is fresh when `make` returns `Ok` of a fresh array. At a `secret(...)` a local carried there (`r.unwrapOr(d)`) is refused, because the move does not reach it. `SecretFlow.move` moves the local in either arm of a ternary, so neither is read again, and refuses a parameter there. The `secret` golden positives and every `std/` caller compile unchanged (see Tests) |

## Properties verified

- Each road above is refused, with the reference named and its line, or the
  callee and the parameter that keeps it.
- The copy the diagnostic suggests compiles: `const copy: u8[] = new
  Array<u8>(raw.length); copy.set(raw)` and `secret(copy)`
  (`docs/guide/using-nish/standard-library.md`).
- A recursive function that only ever answers a literal is fresh, and one that
  answers its parameter through another function is not.
- A `Result` whose `Ok` payload is fresh gives a fresh value through `orReturn`
  and `expect`.
- The rule refuses more than it must in three places, each a compile error
  rather than a missed read, and each pinned: a data-parallel arrow that reads
  the local before the move, where the read ends with the call
  (`reject_secret_alias_capture_*`); a `Result` local copied into another,
  `const alias = r` (`reject_secret_alias_result_copy`); and a `let` given
  another local after the move, `raw = other`
  (`reject_secret_alias_reassigned_after`). A `let` given a fresh value after
  the move is accepted.
- The rule is what refuses each case: the same `src/` with it taken out
  compiles every one of them.

## Tests

The checks in `tests/run.js` that hold the above:

- `${name}: rejected with ${needles.map((n) => `"${n}"`).join(", ")}`, for
  `reject_secret_alias_const`, `reject_secret_alias_let`,
  `reject_secret_alias_reassigned`, `reject_secret_alias_assign_chain`,
  `reject_secret_alias_assign_init`, `reject_secret_alias_assign_push`,
  `reject_secret_alias_assign_field`, `reject_secret_alias_assign_kept`,
  `reject_secret_alias_assign_helper`, `reject_secret_alias_assign_parents`,
  `reject_secret_alias_assign_constructor`, `reject_secret_alias_assign_source`,
  `reject_secret_alias_declarators`,
  `reject_secret_alias_declarator_moved`, `reject_secret_alias_field`,
  `reject_secret_alias_element`, `reject_secret_alias_param`,
  `reject_secret_alias_return`, `reject_secret_alias_mutual`,
  `reject_secret_alias_ternary`, `reject_secret_alias_nullish`,
  `reject_secret_alias_ok`, `reject_secret_alias_err`,
  `reject_secret_alias_unwrap_or`, `reject_secret_alias_unwrap_helper`,
  `reject_secret_alias_unwrap_local`, `reject_secret_alias_result_copy`,
  `reject_secret_alias_reassigned_after`, `reject_secret_alias_constructor`,
  `reject_secret_alias_receiver`, `reject_secret_alias_pop`,
  `reject_secret_alias_for_of`, `reject_secret_alias_capture_map`,
  `reject_secret_alias_capture_from`, `reject_secret_alias_capture_map_into`
  and `reject_secret_alias_capture_reduce`: one road each.
- `nish:secret: reverting the sole-reference rule lets every reject_secret_alias_* case compile (${aliasCases.length} cases)`:
  a copy of `src/` without the rule, built by the seed, compiles all of them
  but `reject_secret_alias_declarator_moved`, which the move refuses itself
  (NL2445).
- `nish:secret: secret(v) still takes ${what}`, for a recursive function that
  answers only a literal, a fresh payload through `Ok`, `orReturn` and
  `expect`, and the copy the diagnostic suggests.
- `nish:secret: every std/ caller of secret(v) compiles (${callers.length} modules)`:
  `std/net/tls.ts`, `std/crypto/x509-random.ts`, `std/crypto/hkdf.ts`,
  `std/crypto/x25519.ts` and `std/crypto/x509.ts`.
- `${name}: IR matches golden` and `${name}: native output matches .out`, for
  `secret_flow`, `secret_wipe`, `secret_wipe_o2` and `secret_wipe_o2_plain`:
  the positives, unchanged.
- `${rel}:${s.line} is rejected with ${s.code}` and `${rel}:${s.line} compiles`,
  for `docs/guide/using-nish/standard-library.md`: the alias refused with
  NL2506, and the copy accepted.
