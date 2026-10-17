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

Read here, audited for this rule by the field section below: `src/attributes.ts`
(`PointerParamFacts.captured`, the fact the sole-reference rule reads for "keeps
its parameter"; its `markWipe` is in the field section's Scope).

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
  value, an arrow's capture, and a task's argument (`s.spawn(entry, raw, …)`). The compound assignments (`+=`, `??=`,
  `||=`) take no array, so they are no road.
- Wrote a program for each one that reads the alias after `wipe`, and ran it
  against `main`'s compiler.

## Findings

| Id | Severity | Where (base) | Description | Disposition |
| --- | --- | --- | --- | --- |
| SECRET-1 | Medium | `src/secret.ts:1078` (`SecretFlow.move`), `src/secret.ts:1221` (`checkSecretFlow`) | `secret(x)` marked the one local `x` moved, and NL2445 refused a later read of `x`, but nothing asked whether the value had another name. `const alias = raw; const key = secret(raw); wipe(key); alias[0]` compiled and read 0, and before the `wipe` the same name read the key with none of the `Secret`'s rules. Every road listed under Method compiled: `let`, a field (`h.buf = raw`, `{ buf: raw }`), an element (`[raw]`, `xs[0] = raw`, `xs.push(raw)`), a callee that stores or returns its parameter, `secret(id(raw))` with `raw` read after, a ternary (`c ? raw : other` as a value, and as the argument of `secret`, which moved neither arm), `maybe ?? raw`, `Ok(raw)` and `Err(raw)` (the `Result` holds `raw` as its payload or its error), a constructor that keeps its argument or hands `this` out, a method that keeps `this` or answers a field, `rows.pop()`, a `let` given another local's array, a `for...of` binding, a later declarator (`const n = 1, alias = raw`), an assignment to the local used as a value (`alias = raw = [1, 2, 3]`, `const alias = (raw = [...])`, `xs.push(raw = [...])`, `h.k = (raw = [...])`, `keep(h, raw = [...])`, found in review round 3), and, once #609 let an arrow given to `parallelMap`, `parallelFrom`, `parallelMapInto` or `parallelReduce` read the function's `const` locals, a capture of `raw` by such an arrow, and, once #644 let a task spawned as an arrow capture them too, a capture by a task, and a task's argument, which the scope keeps until the task has run (`s.spawn(first, raw, out, 0)`, `s.spawn(sum, raw)`). The ternary also let a parameter past NL2447: `secret(c ? p : [1])`. Medium: no input reaches the rule, so not High, but a program it accepts reads its key outside `expose` without a word, which is more than hardening | **Fixed.** `secret(v)` takes only a value nothing else holds (docs/LANGUAGE.md, "Secrets"; NL2512). `checkSoleReferences` judges each argument over the body it is in (`FreshJudge`): a literal, `null` and a `new` are fresh, a ternary when both arms are, a call when its callee's answer is, and a local when it is no parameter, every value it is given is fresh and not another local, it is no `for...of` binding, and `ReferenceScan` finds no other occurrence that leaves a second name (one inside an arrow, resolved through `sourceLocal` to the local it captures, always does). What only the whole program knows is left as a `SecretNeed`, which `Compilation.checkSecrets` answers with `FreshResults`: a callee's answer, judged over its own body by the same rule as a greatest fixpoint over the calls between them, and whether a callee keeps a parameter, which `PointerParamFacts.captured` says. An assignment to the local is harmless only where its own value is dropped, by a statement or a `for` header (`ReferenceScan.harmlessAt`); anywhere else its value is judged as the local is. `ReferenceScan.handsOn` follows a value through every wrapper that answers it: parentheses, a ternary arm, `??`, `Ok` and `Err`, and `orReturn`, `expect` and `unwrapOr`, so `const r = Ok(raw)` leaves a second name while a callee's `return Ok(out)` is its result. A `Result` method that answers the payload is judged by what the `Result` carries, so `make().orReturn()` is fresh when `make` returns `Ok` of a fresh array. At a `secret(...)` a local carried there (`r.unwrapOr(d)`) is refused, because the move does not reach it. `SecretFlow.move` moves the local in either arm of a ternary, so neither is read again, and refuses a parameter there. The `secret` golden positives and every `std/` caller compile unchanged (see Tests) |

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
  `reject_secret_alias_capture_from`, `reject_secret_alias_capture_map_into`,
  `reject_secret_alias_capture_reduce`, `reject_secret_alias_capture_spawn`,
  `reject_secret_alias_spawn_arg` and `reject_secret_alias_spawn_with`: one
  road each.
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
  NL2512, and the copy accepted.

## The field rule: a `Secret` held by a class

NL2430 refused every `Secret` field. The field rule (#668) admits one shape,
and this part of the record says what that shape is held to and how. Its rows
name functions rather than lines: the rule is new code on `main` `461489b`, so
no base line describes it.

### Scope

| File | What |
| --- | --- |
| `src/secret.ts` | `admitsSecretField` and `secretFieldOf` (the declaration), `checkHolderReleaser` (the releaser's signature), `SecretFlow.collectSlots`, `fieldRead`, `fieldStore` and `storedType` (the walk over a holder's constructor, its `wipe()` and every other body) |
| `src/structs.ts` | where a field's type is admitted, and where `checkHolderReleaser` runs once a class's members are known |
| `src/members.ts` | the object literal of a holder (NL2541) |
| `src/interop-header.ts` | `structDefinitions` and `structFieldTypes`: a `Secret` (`isSecretStruct`) and a holder (`secretFieldOf`) are opaque in an `--emit-header` sidecar |
| `src/attributes.ts` | `markWipe`: a `wipe` marks what its argument reaches as written, for the region rule of a scope |
| `src/codes.ts` | the field rule's diagnostics, NL2536 to NL2544, with their fragments and advice |
| `src/types.ts` | `TypeTable.holdsSecret`, which does not look inside a struct: a holder travels as a value, since its own `wipe()` ends its field |

### Threat model

As above: the rule is a promise to the program's author, and the failure is a
program that compiles while the key stays readable, or unwiped, where the
language says it is not. A field adds two roads a local does not have: the
holder outlives the function that made the key, and every method of the class
can name the field.

### Method

- Listed each way in: a field declared on an interface, on a generic class,
  without `readonly`, as `Secret<T> | null`, inside an array, a `Result` or
  another `Secret`; a releaser missing, with a parameter or with another
  return type; a `wipe()` that skips the field on one branch, in a loop, after
  an early `return`, or by calling a helper; a constructor that sets the field
  from a local, a parameter or a call, from an aliased array, twice, or in a
  loop; a store from a method, from outside the class, by a compound
  assignment, or through `this` handed out of the constructor; a read into a
  local, a `let`, a return value, a ternary, a `??`, an optional chain, a
  chained member, an index, a template, `console.log`, a condition and
  `secret(h.k)`; the holder as an object literal, a JSON encode or decode
  target, a data-parallel capture, a task's argument wiped in its scope, and a
  `using` binding. Review round 1 added: a function, an arrow or a generic
  `id<T>` that returns the `Secret` it borrows; `wipe(h.k)` in a function,
  another method, a constructor, or through `this` handed out of one; a
  helper that wipes its `Secret` parameter; a constructor reached by `new`
  that zeroes the key in place inside `wipe()`; a field read through a nested
  member, `o.h.k`; and the header, typings and N-API shim of an exported
  function that takes or returns a holder. Review round 2 added: a method
  that returns the `Secret` it borrows; a ternary that picks between two
  borrowed keys; a helper that wipes its parameter, reached by `new` and by a
  method call; a holder's `wipe()` that wipes a nested holder's field,
  `wipe(this.h.k)`, or another holder's, `wipe(o.k)`; the C layout of an
  exported holder; and an exported function that returns a bare `Secret`.
- Wrote a program for each and compiled it with the branch's `build/nish`.

### Findings

Found by review rounds 1 and 2 of #685, on the branch before it landed, so
each row names functions rather than base lines.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| SECRET-2 | Medium | `SecretFlow.name` (`src/secret.ts`) | Identity laundering: a function, an arrow, a generic `id<T>` or a method that returned the `Secret` it was passed handed its caller a second name for a holder's key, which outlived the holder's `wipe()` and read zeros, or read the key before it with no tie to the holder. A ternary between two borrowed keys was the same road. Medium on SECRET-1's reasoning: no input reaches it, but an accepted program holds the key under a name the rule does not see | **Fixed.** A `Secret` parameter is borrowed: returning it is NL2542, for every `Secret` parameter (a break from 0.18.0, docs/LANGUAGE.md, "Secrets"). A ternary of two is refused by the copy rule |
| SECRET-3 | Low | `SecretFlow.fieldRead` (`src/secret.ts`) | Wipe then read: `wipe(h.k)` in a function, another method, a constructor, through `this` handed out of one, or in a holder's `wipe()` aimed at a nested or another holder's field, zeroed a key its holder went on using. A wrong answer, not a leak | **Fixed.** A field is wiped only by `wipe(this.f)` in its own holder's `wipe()` (NL2543) |
| SECRET-4 | Low | `SecretFlow.name` (`src/secret.ts`) | A helper that wiped its `Secret` parameter, called directly, by `new` or by a method, zeroed a holder's key behind its back | **Fixed.** Wiping a borrowed `Secret` is NL2544; the owner wipes it |
| SECRET-5 | Low | `structDefinitions`, `structFieldTypes` (`src/interop-header.ts`) | The `--emit-header` sidecar gave a `Secret`'s struct and an exported holder's layout, so a host could read the key's bytes by offset, or allocate a holder and skip the constructor that sets its key | **Fixed.** A `Secret` (`isSecretStruct`) and a holder (`secretFieldOf`) are opaque: a `typedef` with no fields, reached only as a pointer, and a function that takes or returns one is not bridged to JS |

### Properties verified

- A `Secret` field is `readonly`, typed exactly `Secret<T>`, on a non-generic
  class; any other declaration is NL2430, and a `Secret` inside an array, a
  `Result` or another `Secret` is NL2429.
- A class with such a field has `wipe(): void` with no parameters (NL2536),
  and that method calls `wipe(this.f)` for every field on every path out of it
  (NL2537): a branch, a loop body, an early `return` and a helper that wipes it
  are each refused. A field is wiped only there: `wipe(h.f)` anywhere else,
  a constructor included, is NL2543 (`SecretFlow.fieldRead`, `src/secret.ts`).
- A `Secret` parameter is borrowed: returning it is NL2542 and wiping it
  NL2544 (`SecretFlow.name`), so no function, arrow or generic instantiation
  hands a caller a second name for a holder's key.
- The C header keeps a `Secret` opaque, as it does a `Map`
  (`isSecretStruct`, `src/interop-header.ts`): an exported function's
  `Secret` parameter or return is a pointer to an incomplete struct with no
  layout. A holder is opaque too (`secretFieldOf`): a `typedef` with no
  fields, so a host cannot allocate one and skip the constructor that sets
  the key. The `.d.ts` and N-API shim bridge no such function.
- The field is set only in the constructor, only from `secret(...)` (NL2538),
  and only once (NL2539); `secret(...)` there keeps the sole-reference rule
  (NL2512). A store anywhere else is NL2181, and the store is a statement of its
  own: its value bound to a local is NL2540.
- A scope's parent may not wipe a holder while a task of the scope may read
  its key: `wipe` marks what its argument reaches as written
  (`markWipe`, `src/attributes.ts`), so `h.wipe()`, a helper that wipes
  `h.k`, and a constructor reached by `new` that does are each the region
  rule's write before the join, as `wipe(h.k)` written in the block is.
- A read of the field is a loan: an argument of a call or of `new`, or an
  operand of `===` or `!==`. Anything else is NL2540, and the existing rules
  (NL2428, NL2431 to NL2436, NL2439) still refuse what they refused of a local.
- A holder made by an object literal is NL2541, and JSON encode and decode of
  one are NL2485.
- The `wipe()` of a holder is the same volatile `llvm.memset` a local's is, and
  it survives `opt -O2` where a plain `fill(0)` of the twin's field is an
  ordinary one (on the arena, `opt` keeps both; the check pins the volatile
  flag).
- What the rule leaves out: nothing makes a program call `wipe()`, so a holder
  that is never wiped leaves its key in memory, unzeroed; the rule does
  not follow a second reference to the holder itself, which is a loan of the
  whole object rather than of the key; a function that takes a `Secret` may
  still zero its bytes through `exposeWith` and `fill(0)`, which is a write
  through a borrow like any other and leaves the holder reading zeros, a
  wrong answer and not a leak; and a key made per packet or per record
  is a local, held to NL2448 and NL2450, not a field.

### Tests

- `${name}: rejected with ${needles.map((n) => `"${n}"`).join(", ")}`, for
  `reject_secret_field`, `reject_secret_field_interface`,
  `reject_secret_field_generic_class`, `reject_secret_field_not_readonly`,
  `reject_secret_field_nullable`, `reject_secret_field_array`,
  `reject_secret_field_array_literal`, `reject_secret_field_result`,
  `reject_secret_field_holder_payload`, `reject_secret_field_no_wipe`,
  `reject_secret_field_wipe_signature`, `reject_secret_field_wipe_missing`,
  `reject_secret_field_wipe_branch`, `reject_secret_field_wipe_loop`,
  `reject_secret_field_wipe_return`, `reject_secret_field_wipe_helper`,
  `reject_secret_field_local`, `reject_secret_field_param`,
  `reject_secret_field_call`, `reject_secret_field_alias_raw`,
  `reject_secret_field_twice`, `reject_secret_field_ctor_loop`,
  `reject_secret_field_store_method`, `reject_secret_field_store_outside`,
  `reject_secret_field_compound`, `reject_secret_field_this_escape`,
  `reject_secret_field_assign_local`, `reject_secret_field_bind`,
  `reject_secret_field_return`, `reject_secret_field_ternary`,
  `reject_secret_field_nullish`, `reject_secret_field_optional_chain`,
  `reject_secret_field_chain`, `reject_secret_field_index`,
  `reject_secret_field_member`, `reject_secret_field_template`,
  `reject_secret_field_console`, `reject_secret_field_condition`,
  `reject_secret_field_equality`, `reject_secret_field_secret_arg`,
  `reject_secret_field_new_arg`, `reject_secret_field_object_literal`,
  `reject_secret_field_json`, `reject_secret_field_json_decode`,
  `reject_secret_field_capture`, `reject_secret_field_task_wipe`,
  `reject_secret_field_scope_wipe`, `reject_secret_field_scope_helper`,
  `reject_secret_field_scope_new`, `reject_secret_field_store_value`,
  `reject_secret_field_using`, `reject_secret_field_launder_function`,
  `reject_secret_field_launder_arrow`, `reject_secret_field_launder_generic`,
  `reject_secret_field_wipe_outside`, `reject_secret_field_wipe_through`,
  `reject_secret_field_wipe_method`, `reject_secret_field_wipe_ctor`,
  `reject_secret_field_this_fin`, `reject_secret_field_this_store`,
  `reject_secret_field_wipe_param`, `reject_secret_field_wipe_new`,
  `reject_secret_field_nested`, `reject_secret_field_launder_method`,
  `reject_secret_field_launder_ternary`, `reject_secret_field_wipe_param_new`,
  `reject_secret_field_wipe_param_method`, `reject_secret_field_wipe_nested`
  `reject_secret_field_wipe_other`, and, for a caller's own local in place of
  a field, `reject_secret_field_launder_local` and
  `reject_secret_field_wipe_param_local`: one road each.
- `nish:secret: --emit-header keeps a Secret and its holder opaque, and --emit-dts / --emit-napi bridge neither`.
- `${name}: IR matches golden` and `${name}: native output matches .out`, for
  `secret_field`, `secret_field_wipe_o2` and `secret_field_wipe_o2_plain`.
- `nish:secret: a holder's wipe survives opt -O2 (a volatile memset of its key), where the twin's fill(0) is an ordinary one`.
- `codes: every registry code is provoked by a program, declared, or explained (${wordingsSummary})`:
  NL2536 to NL2544 each have their `tests/wordings/` program.
- `${rel}:${s.line} is rejected with ${s.code}` and `${rel}:${s.line} compiles`,
  for `docs/AI.md` and `docs/guide/using-nish/standard-library.md`: a holder
  accepted, and a field copied into a local refused with NL2540.
