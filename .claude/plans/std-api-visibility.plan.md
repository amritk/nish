---
name: Mark std/ internals private and document its public API
overview: Mark every std class member that is not part of its module's API as private (or internal when a free function in the same module reads it), and give every exported function, public method and exported constant a description with param and returns tags, so the TypeDoc library reference shows only the real API. One stage per group of modules, each its own PR. Visibility keywords change no IR.
stages:
  - id: regex
    title: "docs(std): mark regex internals private and document its API"
    goal: Regex, RegexMatch and every export of std/regex.ts show only their real API, documented, and the reference page proves it if the generator has merged
    verification: npm run check && npm run lint && node tests/self/goldens.js && node tests/run.js std_regex
    todos:
      - id: regex-visibility
        content: Mark std/regex.ts members private or internal per the visibility rule, in a commit of its own — see Visibility rule
      - id: regex-docs
        content: Complete the description, param and returns tags on every export and public method of std/regex.ts — see Documentation rule
      - id: regex-reference
        content: If scripts/gen-reference.mjs is on main, regenerate and check the Regex page lists only source, flags, groups and its real methods — see Regex
  - id: json
    title: "docs(std): mark json internals private and document its API"
    goal: Every std/json*.ts module, collections, map and pair show only their real API, documented
    verification: npm run check && npm run lint && node tests/self/goldens.js && node tests/run.js std_json && node tests/run.js std_pair && node tests/run.js map_dbg && node tests/run.js dbg_map
    todos:
      - id: json-visibility
        content: Mark members private or internal in std/json*.ts, std/collections.ts, std/map.ts, std/pair.ts, in a commit of its own — see Visibility rule
      - id: json-docs
        content: Complete descriptions, param and returns tags and module headers in the same files — see Documentation rule
  - id: http-server
    title: "docs(std): mark http server internals private and document its API"
    goal: The HTTP/1 server, codec, fields, compression, handler, router, prefork and buffer-pool modules show only their real API, documented
    verification: npm run check && npm run lint && node tests/self/goldens.js && node tests/run.js net_http1 && node tests/run.js net_router && node tests/run.js net_prefork && node tests/run.js std_http
    todos:
      - id: http-server-visibility
        content: Mark members private or internal in the http-server Owns files, in a commit of its own — see Visibility rule
      - id: http-server-docs
        content: Complete descriptions, param and returns tags and module headers in the same files — see Documentation rule
  - id: http-client
    title: "docs(std): mark http client internals private and document its API"
    goal: fetch, the HTTP/1 client codec, upstream, outbound, url and websocket show only their real API, documented
    verification: npm run check && npm run lint && node tests/self/goldens.js && node tests/run.js net_http_fetch && node tests/run.js net_http1_client && node tests/run.js net_websocket && node tests/run.js net_url
    todos:
      - id: http-client-visibility
        content: Mark members private or internal in the http-client Owns files, in a commit of its own — see Visibility rule
      - id: http-client-docs
        content: Complete descriptions, param and returns tags and module headers in the same files — see Documentation rule
  - id: http23
    title: "docs(std): mark http2 and http3 internals private and document their API"
    goal: http2, hpack, http3, qpack and webtransport show only their real API, documented
    verification: npm run check && npm run lint && node tests/self/goldens.js && node tests/run.js net_http2 && node tests/run.js net_http3 && node tests/run.js net_webtransport && node tests/run.js pack
    todos:
      - id: http23-visibility
        content: Mark members private or internal in the http23 Owns files, in a commit of its own — see Visibility rule
      - id: http23-docs
        content: Complete descriptions, param and returns tags and module headers in the same files — see Documentation rule
  - id: quic
    title: "docs(std): mark quic internals private and document its API"
    goal: Every std/net/quic*.ts module shows only its real API, documented
    verification: npm run check && npm run lint && node tests/self/goldens.js && node tests/run.js net_quic
    todos:
      - id: quic-visibility
        content: Mark members private or internal in std/net/quic*.ts, in a commit of its own — see Visibility rule
      - id: quic-docs
        content: Complete descriptions, param and returns tags and module headers in the same files — see Documentation rule
  - id: tls
    title: "docs(std): mark tls internals private and document its API"
    goal: std/net/tls.ts, tls-tcp.ts and std/net/tls/ show only their real API, documented
    verification: npm run check && npm run lint && node tests/self/goldens.js && node tests/run.js net_tls
    todos:
      - id: tls-visibility
        content: Mark members private or internal in the tls Owns files, in a commit of its own — see Visibility rule
      - id: tls-docs
        content: Complete descriptions, param and returns tags and module headers in the same files — see Documentation rule
  - id: postgres-dns
    title: "docs(std): mark postgres, dns and sqlite internals private and document their API"
    goal: postgres, postgres-carrier, the dns modules and sqlite show only their real API, documented
    verification: npm run check && npm run lint && node tests/self/goldens.js && node tests/run.js postgres && node tests/run.js std_dns && node tests/run.js sqlite
    todos:
      - id: postgres-dns-visibility
        content: Mark members private or internal in the postgres-dns Owns files, in a commit of its own — see Visibility rule
      - id: postgres-dns-docs
        content: Complete descriptions, param and returns tags and module headers in the same files — see Documentation rule
  - id: crypto-ecc
    title: "docs(std): mark elliptic-curve crypto internals private and document their API"
    goal: p256, p384, ed25519 and x25519 show only their real API, documented, with no behaviour change
    verification: npm run check && npm run lint && node tests/self/goldens.js && node tests/run.js crypto_
    todos:
      - id: crypto-ecc-visibility
        content: Mark members private or internal in the crypto-ecc Owns files, in a commit of its own — see Visibility rule and Security
      - id: crypto-ecc-docs
        content: Complete descriptions, param and returns tags and module headers in the same files — see Documentation rule
  - id: crypto-pki
    title: "docs(std): mark pki, x509, rsa and jwt internals private and document their API"
    goal: x509, pki, pki-roots, x509-random, rsa and jwt show only their real API, documented, with no behaviour change
    verification: npm run check && npm run lint && node tests/self/goldens.js && node tests/run.js crypto_
    todos:
      - id: crypto-pki-visibility
        content: Mark members private or internal in the crypto-pki Owns files, in a commit of its own — see Visibility rule and Security
      - id: crypto-pki-docs
        content: Complete descriptions, param and returns tags and module headers in the same files — see Documentation rule
  - id: crypto-sym
    title: "docs(std): mark symmetric crypto and hash internals private and document their API"
    goal: aes, chacha20poly1305, hmac, hkdf, the sha modules, bcrypt, base64url and ct show only their real API, documented, with no behaviour change
    verification: npm run check && npm run lint && node tests/self/goldens.js && node tests/run.js crypto_
    todos:
      - id: crypto-sym-visibility
        content: Mark members private or internal in the crypto-sym Owns files, in a commit of its own — see Visibility rule and Security
      - id: crypto-sym-docs
        content: Complete descriptions, param and returns tags and module headers in the same files — see Documentation rule
  - id: yaml-term
    title: "docs(std): mark yaml and term internals private and document their API"
    goal: The yaml and term modules show only their real API, documented
    verification: npm run check && npm run lint && node tests/self/goldens.js && node tests/run.js std_yaml && node tests/run.js std_term
    todos:
      - id: yaml-term-visibility
        content: Mark members private or internal in std/yaml*.ts and std/term*.ts, in a commit of its own — see Visibility rule
      - id: yaml-term-docs
        content: Complete descriptions, param and returns tags and module headers in the same files — see Documentation rule
  - id: core
    title: "docs(std): mark core std internals private and document their API"
    goal: The cli, threads, math, bytes, text, testing, sort, random, base64, region, secret, compress and sync modules show only their real API, documented
    verification: npm run check && npm run lint && node tests/self/goldens.js && node tests/run.js std_cli && node tests/run.js std_bytes && node tests/run.js std_text && node tests/run.js std_compress && node tests/run.js thread_ && node tests/run.js sync_ && node tests/run.js caps_
    todos:
      - id: core-visibility
        content: Mark members private or internal in the core Owns files, in a commit of its own — see Visibility rule
      - id: core-docs
        content: Complete descriptions, param and returns tags and module headers in the same files — see Documentation rule
---

# Mark std/ internals private and document its public API

## Context

`scripts/gen-reference.mjs` (another run, tracking issue #1233) builds the library reference from `std/**/*.ts` with TypeDoc and `--excludePrivate`. Today std classes expose their internals: `Regex` in [std/regex.ts](../../std/regex.ts) shows 93 properties and about 45 methods, of which users need about 10 methods and `source`, `flags`, `groups`. The compiler accepts and ignores `public`, `private` and `protected` ([docs/LANGUAGE.md](../../docs/LANGUAGE.md), the class field rules near line 2634), so the keyword changes no generated code. `tsc` does not ignore them: [tsconfig.json](../../tsconfig.json) includes `std/**/*.ts` and `tests/nish/**/*.ts`, so `npm run check` refuses a `private` member that anything else in those trees reaches.

## Visibility rule

Every stage applies this to the files it owns.

1. **Public** means read or called from outside its class: by another std module, a free function in the same module, `tests/` (cases, link programs, `tests/nish/`), `examples/`, `bench/`, or a snippet in `docs/`. Grep all of these for `.<member>` before you mark anything. `tsc` covers `std/` and `tests/nish/` only; `tests/cases/*.ts`, `tests/link/**`, `examples/`, `bench/` and docs snippets are not type-checked, so the grep is the only check there.
2. A member read only inside its own class (scratch fields, helper methods) gets `private`.
3. A member that is module plumbing but is read from outside its class, by a free function in the same module or by another std module, stays without a keyword and gets an `@internal` JSDoc tag (a one-line `/** @internal <why it is reachable>. */` is enough). TypeScript's `private` would refuse those reads, and they are not part of the API. A member that a user, a test, an example or a guide page uses is real API and gets neither.
4. `noUnusedLocals` is on, so `tsc` reports a `private` member nothing reads. Leave that member public with `@internal`, and list it in the PR body as dead. Deleting it is out of scope.
5. **Visibility goes in a commit of its own, before any JSDoc.** The keyword sits on the member's existing line, so no line number in `std/` moves. Run `node tests/self/goldens.js --update` and `UPDATE_GOLDENS=1 node tests/run.js <your filters>` after that commit: **any diff in a golden is a bug.** Stop, report it in the PR body, and do not regenerate past it. (Clarified after the regex stage: `--emit-checked` goldens record absolute `L:C` positions, so a new `@internal` line or a formatter wrap may move positions. Only a change to a node id, a column, content, or `.ll` text other than debug-info line fields is the bug.)

## Documentation rule

Follow [.claude/comments.md](../comments.md) and [.claude/typescript.md](../typescript.md).

- Every exported function, every public (non-`private`, non-`@internal`) method and every exported constant has a description, an `@param` for each parameter, and `@returns` unless it returns `void`. Say what a value means (units, ranges, who owns it, what an error value says), never its type.
- Every module starts with a header JSDoc shaped like [std/regex.ts](../../std/regex.ts): a lead sentence, an indented usage example that compiles against the module's real API, then paragraphs. A bold-led paragraph becomes a collapsible section on the reference page, so lead each topic with one. Keep a module's existing header and fill in what it lacks. Do not rewrite a header that already has this shape.
- No behaviour change, no renames, no moved code. Only comments and visibility keywords change in `std/`.
- **JSDoc moves line numbers, and some generated files record them**: `tests/link/*/expected.caps.json` (dns, sqlite, threads, text), `tests/link/std_sqlite_deny_ffi/expected.err`, `tests/wordings/nl2458_deny_panics_call.err` (text), and the debug-info `.ll` goldens `tests/cases/dbg_map_get`, `dbg_map_iter`, `enum_member_type_slots` and `map_dbg` (collections). Regenerate them with the repo's tooling (`UPDATE_GOLDENS=1 node tests/run.js <filter>`, `node tests/self/goldens.js --update`) and read the diff. In this commit only `file:line` positions and debug-info line fields may move.
- `docs/security/` records state the commit their `file:line` anchors are at ([docs/security/README.md](../../docs/security/README.md#writing-a-record)), so they stay as they are. The same goes for design notes such as [docs/h3-latency.md](../../docs/h3-latency.md).

## Security

`std/crypto/` and `std/net/` fall under [docs/security/README.md](../../docs/security/README.md). Read it first. Changing visibility and comments is allowed; behaviour is not. A crypto member holding secret material keeps its `Secret<T>` shape. If the docs are wrong about how a function treats a secret, record it in the PR body and leave the code alone.

## Regex

`std/regex.ts` goes first and is the template for the rest. Its header is already the target shape. The expected public surface is `Regex` with `source`, `flags` and `groups`, its matching methods (`exec`, `test`, `findAll`, `count`, `replaceAll`, `split` and the like), `RegexMatch` and its accessors, and `regexCompile`. If `scripts/gen-reference.mjs` is on `main` when the stage runs, regenerate the reference and check that the `Regex` page lists only those. Otherwise say in the PR body that the generator had not merged.

## Stages and ownership

| stage | Owns |
|---|---|
| regex | `std/regex.ts` |
| json | `std/json*.ts`, `std/collections.ts`, `std/map.ts`, `std/pair.ts` |
| http-server | `std/net/http1-server.ts`, `std/net/http1-codec.ts`, `std/net/http-fields.ts`, `std/net/http-compress.ts`, `std/net/handler.ts`, `std/net/router.ts`, `std/net/prefork.ts`, `std/net/buffer-pool.ts` |
| http-client | `std/net/http1-client-codec.ts`, `std/net/fetch.ts`, `std/net/upstream.ts`, `std/net/outbound.ts`, `std/net/url.ts`, `std/net/websocket.ts` |
| http23 | `std/net/http2*.ts`, `std/net/hpack.ts`, `std/net/http3*.ts`, `std/net/qpack.ts`, `std/net/webtransport.ts` |
| quic | `std/net/quic*.ts` |
| tls | `std/net/tls.ts`, `std/net/tls-tcp.ts`, `std/net/tls/**` |
| postgres-dns | `std/net/postgres*.ts`, `std/net/dns*.ts`, `std/sqlite.ts` |
| crypto-ecc | `std/crypto/p256.ts`, `std/crypto/p384.ts`, `std/crypto/ed25519.ts`, `std/crypto/x25519.ts` |
| crypto-pki | `std/crypto/x509*.ts`, `std/crypto/pki*.ts`, `std/crypto/rsa.ts`, `std/crypto/jwt.ts` |
| crypto-sym | `std/crypto/aes.ts`, `std/crypto/chacha20poly1305.ts`, `std/crypto/hmac.ts`, `std/crypto/hkdf.ts`, `std/crypto/sha*.ts`, `std/crypto/bcrypt*.ts`, `std/crypto/base64url.ts`, `std/crypto/ct.ts` |
| yaml-term | `std/yaml*.ts`, `std/term*.ts` |
| core | `std/cli*.ts`, `std/threads.ts`, `std/math.ts`, `std/bytes.ts`, `std/text.ts`, `std/testing.ts`, `std/sort.ts`, `std/random.ts`, `std/base64.ts`, `std/region.ts`, `std/secret.ts`, `std/compress/**`, `std/sync/**` |

Every stage may also change, by regeneration only, the generated files under **Documentation rule**: `tests/self/goldens/**`, `tests/link/*/expected.*`, `tests/wordings/*.err` and `tests/cases/*.ll`. Two stages that regenerate the same file (`std_dns_caps` names `bytes.ts` and the dns modules) do not conflict by hand: the second to merge regenerates on its update. No stage depends on another. A member made `private` in one stage that a module owned by another stage still reads fails `npm run check` on the first stage's branch, because that reader is already on `main`.

## Out of scope

- `runtime/nish.d.ts` (other sessions own it), `src/`, `scripts/gen-reference.mjs`, `docs/guide/` and `docs/security/` content.
- Removing dead members, renaming, moving code, or changing any behaviour.
- `std/README.md` and the license files.

## Verification

Per stage, its `verification` line plus `node tests/run.js <filter>` for every test prefix naming one of its modules. The visibility commit's golden run shows **zero** diff. The JSDoc commit's diff touches only generated line positions. CI's eight `test` shards run the full suite.

## Acceptance criteria

Checked against `main` once every stage has merged or escalated, independently of the stages.

1. In every `std/**/*.ts` class, a member that nothing outside its class reads is `private`.
2. A member read from outside its class (by a free function in its module or another std module) that is not part of the API carries `@internal`, and no member that `tests/`, `examples/`, `bench/`, `docs/` or another std module uses is `private`. `npm run check` passes on `main`.
3. Every exported function, public method and exported constant in `std/` has a description, an `@param` for each parameter, and `@returns` unless it returns `void`.
4. Every `std/` module opens with a header JSDoc: a lead sentence, an indented usage example, then paragraphs.
5. No generated IR changed: between the base and `main`, the only golden diffs the run made are `file:line` positions and debug-info line fields.
6. `runtime/nish.d.ts`, `src/` and the behaviour of `std/crypto/` and `std/net/` are unchanged. In `std/`, the run changed only comments and visibility keywords.
7. If `scripts/gen-reference.mjs` is on `main`, the generated `Regex` page lists only `source`, `flags`, `groups` and its real methods.
