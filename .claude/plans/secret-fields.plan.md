---
name: Secret fields (lift NL2430) and close TLS-1, QUIC-1
overview: Let a nish:secret Secret be a readonly field of a class whose wipe() provably wipes it (model C, a fixed-buffer owner), then move the TLS and QUIC traffic secrets onto such fields so TLS-1 and QUIC-1 close and #668 and #430 can close.
stages:
  - id: s1-checker
    title: "src — a Secret may be a readonly field of a class whose wipe() wipes it"
    goal: Replace NL2430's blanket ban with model C's declaration, releaser, construction and read rules, with a negative for every way in
    verification: check, lint, gen-diagnostic-codes --check, secret and reject_secret sections, goldens and differential regenerated, nish-cmp, cookbook regen, wasi, performance, bootstrap --verify, undegraded npm test
    status: pending
    todos:
      - id: s1-collect-field
        content: Admit a readonly exactly-Secret<T> field of a non-generic class in collectField (src/structs.ts) and record the class as a holder; reword NL2430 — see S1, Declaration
        status: pending
      - id: s1-releaser
        content: Require a holder to declare wipe() returning void and prove in SecretFlow that it wipes every Secret field directly on every path — see S1, Releaser
        status: pending
      - id: s1-construction
        content: Allow a Secret field to be set only by this.f = secret(fresh) once in the constructor; refuse params, calls, locals and second stores — see S1, Construction
        status: pending
      - id: s1-reads
        content: Allow a Secret field read only as a borrowed call argument or a Secret or null equality operand; fix produced() and call() for member arguments — see S1, Reads
        status: pending
      - id: s1-builtins
        content: Make namesSecret recognise a Secret-typed member chain so console.log(h.k) is NL2432 — see S1, Reads
        status: pending
      - id: s1-bypass
        content: Refuse object-literal construction of a holder and pin typed-JSON and interop sidecars — see S1, No bypass
        status: pending
      - id: s1-o2-pin
        content: Add secret_field_wipe_o2 and the tests/run.js check that a holder's wipe survives opt -O2 — see S1, Tests
        status: pending
      - id: s1-negatives
        content: Add one reject_secret_field_* case per way in, each .err pinned to its fragment — see S1, Negatives
        status: pending
      - id: s1-docs
        content: Write the LANGUAGE.md Secret-field rule, AI.md, IR cookbook entry, guide subsection and docs/security/secret.md update — see S1, Docs
        status: pending
  - id: s2-held-derive
    title: "std — in-place derivations into a held Secret"
    goal: Add *Held forms of HKDF, the TLS schedule, record-key install and QUIC key derivation that write into a borrowed Secret in place
    verification: check, crypto_held link test equal to the Into forms on RFC 8448 and RFC 9001 vectors, wipes survive -O2, goldens regenerated, nish-cmp, undegraded npm test
    status: pending
    todos:
      - id: s2-hkdf-held
        content: Add hkdfExpandLabelSha256Held and Sha384Held in std/crypto/hkdf.ts — see S2
        status: pending
      - id: s2-tls-held
        content: Add the tls*Held schedule forms and TlsRecordProtection installHeld and advanceHeld — see S2
        status: pending
      - id: s2-quic-held
        content: Add quicKeysHeldInto and quicKeyUpdateSecretHeldInto in std/net/quic-packet.ts — see S2
        status: pending
      - id: s2-tests
        content: Add tests/link/crypto_held_derive, the -O2 group and reject_secret_held_plain_dst — see S2
        status: pending
  - id: s3-tls-fields
    title: "std — TLS key holders on Secret fields (closes TLS-1)"
    goal: Move every TLS-1 secret onto readonly Secret fields with byte-identical expected.out and rewrite TLS-1 to Closed
    verification: net_tls and net_quic sections, wipes survive -O2 with recounted roots, git diff --exit-code over expected.out, goldens, nish-cmp, TLS-1 Tests list grepped, undegraded npm test
    status: pending
    todos:
      - id: s3-tls-server
        content: Replace TlsServer's secrets256 and secrets384 pools with TlsSecretPool holders and add an ephemeral Secret field plus TlsServer.wipe() — see S3
        status: pending
      - id: s3-record-server
        content: Move TlsRecordServer's read and write traffic secrets onto Secret fields and route KeyUpdate through advanceHeld — see S3
        status: pending
      - id: s3-tcp-quic-callers
        content: Drop TlsTcpServer.keys and switch the quic.ts TlsServer call sites to borrowed pool fields with a transitional copy — see S3
        status: pending
      - id: s3-tests-records
        content: Rewrite the TLS read-backs through expose, recount tests/wipes/tls.js and close TLS-1 — see S3
        status: pending
  - id: s4-quic-fields
    title: "std — QUIC secret pools on Secret fields and one-shot key forms reshaped (closes QUIC-1)"
    goal: Move QuicConnection's traffic secrets onto Secret fields, make quicKeys and quicKeysUpdate write into a caller's slot, and close QUIC-1, #668 and #430
    verification: net_quic section, wipes survive -O2 with recounted roots, git diff --exit-code over expected.out, goldens, nish-cmp, QUIC-1 Tests list grepped, undegraded npm test
    status: pending
    todos:
      - id: s4-conn-fields
        content: Replace QuicConnection's secret pools and app secrets with a holder of Secret fields and add QuicConnection.wipe() — see S4
        status: pending
      - id: s4-one-shot
        content: Reshape quicKeys and quicKeysUpdate to write into a caller's QuicKeysSlot from a Secret — see S4 and decision D6
        status: pending
      - id: s4-close
        content: Remove the S3 transitional copy, recount tests/wipes/quic.js, close QUIC-1 and carry Fixes 668 — see S4
        status: pending
  - id: s5-holder-flow
    title: "src (optional) — a holder made in a function leaves it wiped, returned or stored"
    goal: Track a local bound to new Holder() like an owned Secret so make-and-drop and arena-block-drop are refused
    verification: same as S1
    status: cancelled
    todos:
      - id: s5-rule
        content: Extend SecretFlow to holder locals with NL2440 and NL2441 analogues and the negatives listed — see S5
        status: cancelled
---

## Context

#430's run (#626; PRs #639, #652, #653, #664, #665) wiped every TLS and QUIC key holder at each end of life. TLS-1 and QUIC-1 stay **Open, narrowed**, because a `Secret` may not be a field (NL2430). The two remainders are:

- **TLS-1** ([`docs/security/tls.md`](../../docs/security/tls.md)): an open connection's traffic, exporter, resumption and ephemeral secrets, which sit in plain `u8[]` fields.
- **QUIC-1** ([`docs/security/quic.md`](../../docs/security/quic.md)): a `QuicKeys` its caller keeps or drops without `quicKeysWipe`.

Issue #668 tracks lifting NL2430. Research was done at `main` `e4a4a020`; line numbers below are approximate.

Where the relevant rules live today:

| Rule | Location |
| --- | --- |
| NL2430 | [`src/structs.ts`](../../src/structs.ts) `collectField` (~544) |
| NL2429 | [`src/secret.ts`](../../src/secret.ts) `containerMessage` (~195) |
| Path-sensitive ownership walk (NL2439–NL2446) | `checkSecretFlow` / `SecretFlow` in [`src/secret.ts`](../../src/secret.ts) (~491, ~1274) |
| Sole-reference rule (NL2512) | `ReferenceScan` / `FreshJudge` in [`src/secret.ts`](../../src/secret.ts) |
| `readonly` store barrier | `assignableReadonly` in [`src/members.ts`](../../src/members.ts) (~894) |

`TypeTable.holdsSecret` ([`src/types.ts`](../../src/types.ts) ~670) deliberately does not look inside structs.

## Approach

Three models were compared.

| | (A) Holder must be `using`-bound | (B) Releaser + moves into a provably empty field | **(C) Fixed-buffer owner** |
| --- | --- | --- | --- |
| Soundness surface | Needs user `[Symbol.dispose]` and dispose at every exit; holders kept out of fields and arrays | Cross-method field state: per-method summaries, `this.f` narrowing, receiver aliasing | Small. Field is `readonly` and set once from `secret(...)`. `wipe()` completeness reuses `SecretFlow` inside one method. Reads are a fixed set of positions. |
| Fits pooled, process-long holders | **No.** Slots in `TlsTcpServer` and `QuicConnection` can't be `using`-bound. | Yes, after reworking pools | Yes. TLS and QUIC already preallocate per slot and refill in place. |
| `src/` size | ~1,500–2,000 lines | ~900–1,400 lines | ~450–700 lines |
| What it proves | — | Misuse, overwrite, complete releaser | Same as B |

**Recommendation: C.** Under C:

- A `Secret` field is `readonly` and set once, in the constructor, from `secret(fresh)`.
- It is rewritten only in place, through `exposeWith`, which may write the exposed value.
- It is read only as a borrowed call argument.
- The class's `wipe(): void` must wipe every such field directly, on every path.
- Holder objects themselves are not tracked.

The optional S5 adds a lexical "holder made here is wiped, returned or stored" rule.

**What C does not prove** (stated in the records):

- a holder dropped, or released by its arena, without `wipe()`;
- a wipe through one alias zeroing the key for every alias (zeros, not a leak);
- plain temporaries inside exposed functions (these are wiped);
- per-packet and per-record keys.

Per-packet and per-record keys can never be `Secret` under today's `expose`: sealing writes the output buffer (NL2450) and the AES kernels are C (NL2448).

### Decisions to sign off

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | Model | C. S5 optional. |
| D2 | Releaser | `wipe(): void`, no parameters, matching `QuicKeysSlot` and `HkdfScratch`. It must call `wipe(this.f)` directly for every field on every path; delegating to a helper does not count. |
| D3 | Field initialiser | Only `this.f = secret(v)` in the constructor, with `v` judged by NL2512. A `Secret` parameter, a call answering a `Secret`, and an owned local are refused. This can be widened later. |
| D4 | Admitted shapes | Non-generic `class`, `readonly`, exactly `Secret<T>`. Interfaces, nullable, arrays and generic owners stay NL2430. The existing `reject_secret_field.err` still matches. |
| D5 | Holders are values | Holders may be aliased and kept in arrays, `Map`s, fields and `Result`s. Parallel and task captures stay refused through `captureObstacle`. |
| D6 | How QUIC-1 closes | Keep the names `quicKeys` and `quicKeysUpdate`, so `expected.out` labels survive, but have them write into a caller's `QuicKeysSlot` from a `Secret`. QUIC-1 closes on QUIC-2/QUIC-5's terms: "a slot the caller owns is the caller's to wipe". The alternative is to leave QUIC-1 Open, narrowed. |
| D7 | TLS-1 "Closed" | The checker proves misuse, overwrite and releaser completeness. End of life stays pinned by the read-back and -O2 tests, and the row says so. Then close #430. |
| D8 | `std` API breaks (`!` commits) | `TlsServer.readSecret`/`writeSecret` and the public secret fields become `Secret` fields read through `expose`. `restart` and the constructor copy the key in and wipe the caller's array. `TlsTcpServer.keys` goes. |
| D9 | `tests/wipes/*.js` -O2 counts | Counts move (they are not `expected.out`), re-derived by deleting each wipe in turn, as #430 did. |
| D10 | Derivation scratch | Allocated and wiped inside the exposed function, within an existing `using a = arena()` block. No new `exposeInto` primitive. |

## S1 — src: a Secret may be a readonly field of a class whose wipe() wipes it

Commit: `feat(checker): a Secret may be a readonly field of a class whose wipe() wipes it`.

**Owns:**

- `src/`: `structs.ts`, `secret.ts`, `members.ts`, `types.ts` (comment), `codes.ts`; `json-typed.ts` and `interop-*.ts` only if probes show a gap.
- Comments: `std/secret.ts`, `runtime/nish.d.ts`.
- Tests:
  - `tests/cases/secret_field*` and `reject_secret_field_*`;
  - `tests/wordings/` for each new code;
  - `tests/run.js` (the -O2 check);
  - `tests/nish-cmp.js`;
  - differential and self goldens.
- Docs: `docs/LANGUAGE.md`, `docs/AI.md`, `docs/IR_COOKBOOK.md`, `docs/cookbook/builtin-secret-field.ts`, the `nish:secret` section of `docs/guide/using-nish/standard-library.md`, `docs/security/secret.md`.

**Declaration.**

- `collectField` admits a field whose type is exactly `Secret<T>` when:
  - the owner is a non-generic class;
  - the field is `readonly`;
  - the owner is not `nish:secret`.
- Anything else `holdsSecret` gives stays NL2430: an interface, nullable, `Secret<T>[]`, a generic owner, or a field that is not `readonly`.
- NL2430's hint becomes "…a local, a parameter, or a `readonly` field of a class whose `wipe()` wipes it".
- The class is recorded as a holder on `StructInfo`.

**Releaser.**

- A holder without `wipe(): void` is new code A. New codes start at the next free number, which `node scripts/gen-diagnostic-codes.mjs` prints.
- In `checkSecretFlow`, the holder's `wipe` seeds one live, owned pseudo-variable per `Secret` field.
- Only `wipe(this.f)` discharges a field.
- An exit or block end with a field still live is code C. This reuses `checkExit`/`checkScopeEnd`.
- `SecretFlow.vars` generalises to "a local or a field slot".

**Construction.**

- In `SecretFlow.assignment`, `this.f = …` on a `Secret` field inside the constructor must be `secret(...)`, under a new `ROLE_FIELD_INIT` so `produced()` stays quiet and NL2512 still judges the argument. Anything else is code D.
- A second store while the slot is live, including on a later loop iteration, is code E.
- Stores outside the constructor, through an alias of `this` (#566), or compound assignments already hit the `readonly` refusal; negatives pin them.

**Reads.**

- A `Secret`-field member read is legal only in three places:
  - a call or `new` argument, as a borrow (including `expose`, `exposeWith` and `wipe`);
  - an `===`/`!==` operand against a `Secret` or `null`;
  - the constructor's assignment target.
- Anywhere else is code G: an initialiser, an assignment value, `return`, ternary, `??`, `?.`, a literal element, `Ok`/`Err`.
- `produced()` must stop treating a field read as made.
- `call()` must borrow member arguments.
- `namesSecret` must answer for a `Secret`-typed member chain, so `console.log(h.k)` is NL2432.

**No bypass.**

- An object literal of a holder class is code F (cf. the `nish/threads` refusal in `src/codes.ts`).
- Probe `jsonDecode<Holder>`/`jsonEncode(holder)` and the `--emit-header`/`--emit-dts`/`--emit-napi` sidecars. Refuse (codes F/H), or pin the existing refusal with a negative.

**Negatives**, one per way in:

| Group | Cases | Code |
| --- | --- | --- |
| Declaration | `reject_secret_field` (existing, unchanged), `_interface`, `_nullable`, `_array`, `_generic_class`, `_not_readonly` | NL2430 |
| Releaser | `_no_wipe`, `_wipe_signature` | A |
| Releaser | `_wipe_missing`, `_wipe_branch`, `_wipe_return`, `_wipe_loop`, `_wipe_helper` | C |
| Construction (`new` is a call) | `_param`, `_call`, `_local` | D |
| Construction | `_twice`, `_ctor_loop` | E |
| Construction | `_alias_raw` | NL2512 |
| Construction | `_new_arg` | NL2439 |
| Construction | `_chain` | G |
| Stores after construction | `_store_method`, `_store_outside`, `_this_escape`, `_compound` | `readonly` refusal |
| Stores after construction | `_object_literal`, `_json` | F, or existing |
| Reads | `_bind`, `_return`, `_ternary`, `_assign_local`, `_nullish`, `_optional_chain`, `_array_literal` | G |
| Reads | `_result` | NL2429 |
| Reads | `_secret_arg` | NL2447 |
| Reads | `_console` | NL2432 |
| Reads | `_template` | NL2431 |
| Reads | `_equality` | NL2433 |
| Reads | `_condition` | NL2434 |
| Reads | `_index` | NL2435 |
| Reads | `_member` | NL2436 |
| Reads | `_capture` | `captureObstacle` |
| Reads | `_task_wipe` | NL2471 |
| Payload and `using` | `_holder_payload` | NL2428 / NL2438 |
| Payload and `using` | `_using`, which pins every declarator | existing `using` refusal |
| Interop | `_export` | H, or existing |

**Tests.**

- `tests/cases/secret_field.ts`, with `.ll` and `.out`. One holder with:
  - a `Secret<u8[]>` field and a `Secret<Rec>` field;
  - an in-place refill through `exposeWith`;
  - a tag via `expose`;
  - a borrow through a `Secret` parameter;
  - `h.k === h.j`;
  - holders kept in an array and aliased;
  - `wipe()` covering both fields.
- `tests/cases/secret_field_wipe_o2.ts`, plus a `tests/run.js` check "nish:secret: a holder's wipe survives opt -O2" against a `fill(0)` twin, modelled on `secret_wipe_o2`.

**Docs.**

- `docs/LANGUAGE.md`: a "**A `Secret` field**" rule replaces the NL2430 bullet. It cites every case and states what the rule leaves.
- Plus `docs/AI.md`, an IR cookbook section, a guide subsection "Keeping a key in an object", and the field rule in `docs/security/secret.md`.

## S2 — std: in-place derivations into a held Secret

Commit: `feat(crypto): HKDF, TLS schedule and QUIC derivations into a held Secret`. Purely additive, and needs no `src/` change.

**Owns:**

- `std/`: `std/crypto/hkdf.ts`, `std/net/tls/schedule.ts`, `std/net/tls/record.ts` (the new methods only), `std/net/quic-packet.ts` (the new functions only), `std/README.md`.
- Tests: `tests/link/crypto_held_derive/**`, `tests/wipes/crypto.js` (the new group), `tests/cases/reject_secret_held_plain_dst.*`, `tests/nish-cmp.js`, the self and differential goldens.
- Docs: the `nish/crypto` section of `docs/guide/using-nish/standard-library.md`, the HKDF row in `docs/security/crypto-k1.md`.

Runs alongside S1: it uses only today's `exposeWith`. The shared files (`tests/nish-cmp.js`, the goldens, `standard-library.md` in a different section) are merged by regenerating, never by hand.

**New forms:**

| File | Forms |
| --- | --- |
| [`std/crypto/hkdf.ts`](../../std/crypto/hkdf.ts) | `hkdfExpandLabelSha256Held(dst, prk, label, context)`, Sha384 twin |
| [`std/net/tls/schedule.ts`](../../std/net/tls/schedule.ts) | `tlsDeriveSecretHeld`, `tlsHandshakeSecretHeld`, `tlsMasterSecretHeld`, `tlsFinishedVerifyDataHeld` (answers plain `verify_data`), `tlsTrafficKeysFromHeld` |
| [`std/net/tls/record.ts`](../../std/net/tls/record.ts) | `TlsRecordProtection.installHeld(suite, secret)`, `advanceHeld(secret)` (ratchets in place) |
| [`std/net/quic-packet.ts`](../../std/net/quic-packet.ts) | `quicKeysHeldInto(slot, aead, secret)`, `quicKeyUpdateSecretHeldInto(dst, src)` |

**Idiom.** Inside `using a = arena()`:

1. `exposeWith(src, params, derive)` answers a fresh plain `okm`.
2. `exposeWith(dst, okm, copyInto)` writes it into the held secret.
3. `wipe(okm)`.

Check each block against NL2424.

**Tests.**

- `tests/link/crypto_held_derive` checks that the `*Held` forms equal the `Into` forms on the RFC 8448 and RFC 9001 vectors, and reads the temporaries back as zero.
- An -O2 wipe group.
- `reject_secret_held_plain_dst`.

**Also update:** `std/README.md`, the guide's `nish/crypto` section, and the HKDF security row.

## S3 — std: TLS key holders on Secret fields (closes TLS-1)

Commit: `feat(tls)!: TlsServer and TlsRecordServer hold their secrets in Secret fields`. Needs S1 and S2.

**Owns:**

- `std/`: `std/net/tls.ts`, `std/net/tls/record-server.ts`, `std/net/tls/record.ts` (callers), `std/net/tls-tcp.ts`.
- `std/net/quic.ts`, but only its `TlsServer` call sites (the handshake and app-key install, `keysFor`, `wipeAll`'s calls).
- Docs: `std/README.md`, the guide, `docs/security/{tls,quic,README}.md`.
- Test sources: `tests/link/net_tls_*` and the `net_quic_*` sources that touch `TlsServer`. Never their `expected.out`.
- `tests/wipes/{tls,quic}.js`, `tests/nish-cmp.js`, `checked.txt`.
- New negatives: `reject_secret_field_tls_read` (G), `_tls_log` (NL2432), `_tls_store` (`readonly`).

**Work:**

- **`TlsServer`:**
  - `secrets256`/`secrets384` become `TlsSecretPool` holders. Each has named `readonly` `Secret` fields at exact HashLen (`handshake`, `clientHandshake`, `serverHandshake`, `clientApplication`, `serverApplication`, `exporter`, `resumption`, …) and a `wipe()`. The pool names stay, so `expected.out` labels stay true.
  - A held-bitmask replaces the `none` pointers.
  - Add `readonly ephemeral: Secret<u8[]>`. `restart` and the constructor copy the caller's key in and `secureZero` theirs.
  - `TlsServer.wipe()` is called by `restart`, `fail` and the carriers.
  - Derivations go through S2's forms, inside the existing arena blocks.
- **`TlsRecordServer`:**
  - four `readonly` `Secret` traffic fields with a hash selector;
  - `wipe()`;
  - KeyUpdate via `advanceHeld`.
- **`TlsTcpServer`:** loses `keys`. `accept` keeps its contract that the caller's array is wiped once taken.
- **QUIC transition:** at app-key hand-off, copy `TlsServer`'s app secrets into `QuicConnection`'s existing plain pools through a wiped temporary. This keeps QUIC byte-identical until S4.
- **Tests:** rewrite read-backs as `expose(field, bytesHeld)` with the labels unchanged. Re-derive the `tests/wipes/tls.js` roots.
- **TLS-1:** rewrite to Closed per D7, listing every cited `check(...)` name verbatim.

## S4 — std: QUIC secret pools on Secret fields; one-shot key forms reshaped (closes QUIC-1)

Commit: `feat(quic)!: QuicConnection holds its traffic secrets in Secret fields; quicKeys writes into a caller's slot`. Needs S3.

**Owns:**

- [`std/net/quic.ts`](../../std/net/quic.ts), [`std/net/quic-packet.ts`](../../std/net/quic-packet.ts).
- The `tests/link/net_quic_*` sources (never `expected.out`), and `reject_secret_quic_plain_key.ts` (its `.err` stays).
- `tests/wipes/quic.js`.
- `docs/security/{quic,README}.md`, `std/README.md`, the guide's `quicKeysWipe` line.
- `tests/nish-cmp.js`, `checked.txt`.
- New negative: `reject_secret_field_quic_read` (G).

**Work:**

- **Connection secrets:** `writeSecrets`, `readSecrets`, `appReadSecret`, `appWriteSecret` and `nextReadSecret` become one holder with current and next × read and write × 256 and 384 `Secret` fields.
- **Ephemeral key:** drop `QuicConnection.ephemeralPrivate`; `reset` copies the entropy straight into `tls.ephemeral`.
- **Wipe:** add `QuicConnection.wipe()`, called from `wipeAll`, `reset` and `release`.
- **One-shot forms (D6):** `quicKeys(slot, aead, secret)` and `quicKeysUpdate(slot, keys, next)` write into the slot.
  - `quicKeysWipe` and `quicKeyUpdateSecret` stay.
  - The plain `quicKeysInto` stays only for the public Initial secrets.
- **Clean-up:** remove S3's transitional copy and re-derive the `tests/wipes/quic.js` roots.
- **Close-out:** close QUIC-1 on D6's terms. Commit body `Fixes #668`. Close #430 once the owner confirms.

## S5 (optional) — src: a holder made in a function leaves it wiped, returned or stored

**Cancelled at sign-off (2026-10-16).** Holder end of life stays runtime-pinned, as D7 records.

Commit: `feat(checker): a Secret holder made in a function leaves it wiped, returned or stored`.

**Rule:**

- A local bound to `new H(...)` is tracked like an owned `Secret`.
- It is discharged by `h.wipe()`, `return h`, or a store into a field or element (including `push`).
- An exit or block end with it live is the NL2440/NL2441 analogue.
- `const a = h` is a move.

**Negatives:** `reject_secret_field_holder_dropped`, `_holder_arena_block`, `_holder_branch`, `_holder_break`, `_holder_or_return`, `_holder_copy`.

**Positives:** a holder pushed into a pool, returned, or stored in a field.

## Risks

1. **A read position missed by code G.** Probe every value-producing form; when review finds one, probe its siblings too (CLAUDE.md, "every way in").
2. **`readonly` as the store barrier.** The rule relies on `assignableReadonly` requiring `N_THIS` and `=`. A comment plus a negative tie the two together, so loosening `readonly` cannot silently loosen this rule.
3. **Typed JSON and interop sidecars.** These could bypass the constructor or expose a holder's layout (S1, No bypass).
4. **NL2424 inside the existing `using a = arena()` blocks** when derivations move inside them (S2).
5. **Byte-identical `expected.out`.** The S3 and S4 rewrites are large, and their labels and memory figures are literal strings.
6. **Contention.** S3 and S4 touch the files #652, #653 and #665 just settled, and will conflict with any open `std/net` PR.
7. **Holders are not tracked.** A holder dropped, or released by its arena, without `wipe()` is not caught. S5 narrows this; nothing closes it.

## Out of scope

- A user `[Symbol.dispose]` or user-class `using` (model A).
- Linear holders across functions.
- An `exposeInto` primitive.
- `Secret` packet and record keys, and `AesKey` schedules. TLS-2 and QUIC-2 stay runtime-pinned.
- QUIC-5's config static keys and the listener seed, a possible later follow-up.
- `Secret` fields in interfaces or generic classes, nullable `Secret` fields, and fields set after construction.
- `src/` using the construct (rolling freeze).

## Tests

Every stage keeps every `tests/link/**/expected.out` byte-identical: `git diff --exit-code origin/main -- 'tests/link/**/expected.out'` must print nothing.

Each stage also:

- adds `tests/nish-cmp.js` `DECLARED` entries for programs the reference compiler now refuses;
- regenerates the goldens with `node tests/self/goldens.js --update` and reads the diff;
- registers new positive `tests/cases` with `node tests/differential/goldens.js --update`.

## Verification

S1 and S5 touch `src/`, so they also need wasi, performance and `bootstrap --verify`. S2–S4 are `std/` only; `std/` may use the construct as soon as S1 is on `main`.

```bash
bash scripts/fetch-seed.sh --force
npm run check
npm run lint
node scripts/gen-diagnostic-codes.mjs --check       # S1, S5
node tests/run.js secret                             # S1, S5
node tests/run.js reject_secret
node tests/run.js "wipes survive"
node tests/run.js net_tls                            # S3
node tests/run.js net_quic                           # S3, S4
node tests/self/goldens.js --update                  # read the diff
node tests/differential/goldens.js --update          # when a positive tests/cases file is added
NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js
docs/cookbook/regen.sh --check                       # S1
WASI_SYSROOT=/usr node tests/run.js wasi             # S1, S5; read the skip line
node tests/run.js performance                        # S1, S5
scripts/bootstrap.sh --verify                        # S1, S5
npm test                                             # undegraded; read the skip count
git diff --exit-code origin/main -- 'tests/link/**/expected.out'
```
