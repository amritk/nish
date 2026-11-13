---
name: A Content-Length response that sent its whole body is finished
overview: An `Http1Connection` response stays owed until the program calls `end()`, even once `write` or `sendBody` has sent every byte its `Content-Length` declared. A program that forgets `end()` leaves a keep-alive connection waiting forever, and the next request on it is never answered, with no error anywhere. Make a response whose length is satisfied (or that carries no body at all) count as finished when the connection looks for the next request, so `end()` becomes optional for it; keep `end()` required, and documented as required, where the connection cannot know the body is over (chunked, and an unframed HTTP/1.0 body).
stages:
  - id: implicit-end
    title: "fix(runtime): finish a Content-Length response once its whole body is sent"
    goal: On a keep-alive connection, a response whose declared Content-Length has been sent in full through write or sendBody, or a response with no body (Content-Length 0, HEAD, 204, 304), is finished without end(), and the next request on the connection is answered
    verification: node tests/run.js http1 && npm run check && npm run lint && node scripts/gen-reference.mjs --check
    todos:
      - id: finish-at-boundary
        content: In Http1Connection.nextRequest (std/net/http1-server.ts), treat a response still in H1_R_BODY as done when it is empty (responseEmpty) or length-framed with responseLeft === 0, exactly as if end() had run — see Design
      - id: end-unchanged
        content: Keep end()'s answers unchanged for a program that calls it before the next request starts (0 once the length is met, H1_INVALID while bytes are owed, the last chunk for chunked); respondEncoded keeps working — see Design
      - id: doc-comments
        content: Rewrite the doc comments of respond, write, sendBody and end, and the module header's streaming paragraph, to say when end() is optional and when it is required (chunked, unframed HTTP/1.0); regenerate docs/reference with node scripts/gen-reference.mjs
      - id: tests
        content: A new link test tests/link/net_http1_server_implicit_end (main.ts, expected.out, expected.code) — see Tests
      - id: guide
        content: Update the Http1Server section of docs/guide/using-nish/standard-library.md with the rule, and docs/security/http1-codec.md if it describes when an exchange ends
      - id: generated
        content: Regenerate tests/self/goldens/checked with node tests/self/goldens.js --update, run nish-cmp and add narrow DECLARED entries to tests/nish-cmp.js if any corpus program's IR moved
---

# A Content-Length response that sent its whole body is finished

## Problem

`Http1Connection.nextRequest` moves to the next request only when
`this.response === H1_R_DONE`, and only `end()` (and `acceptWebSocket`) sets
that. A program that answers with `respond(200, …, n)` and sends all `n` bytes
with `sendBody` or `write`, but never calls `end()`, leaves the response in
`H1_R_BODY` forever: the bytes go out, the client reads a complete response,
and its second request on the same keep-alive connection is buffered and never
answered. Nothing reports it.

## Design

Finish lazily, at the exchange boundary, in `nextRequest`:

- When `requestEnded` and the response is `H1_R_BODY` and either
  `responseEmpty`, or `responseFraming >= 0 && responseLeft === 0`, the
  exchange is over: proceed as `end()` would have left it (`H1_R_DONE`, then the
  existing reset to the next request, upgrade, or close).
- Chunked (`HTTP1_CHUNKED`) and unframed (`HTTP1_NO_BODY` on HTTP/1.0) bodies
  have no length the connection can count, so they still need `end()`; the docs
  say so plainly.
- `end()`, `write` and `sendBody` keep every answer they give today to a
  program that calls `end()` before the next request starts. A program that
  skips `end()` and calls it after the connection has moved on gets
  `H1_CLOSED`, as a second `end()` does today.
- Finishing at the boundary, not inside `write`, is chosen so that a HEAD / 204
  / 304 response (where `write` swallows the body and answers its length) and a
  `Content-Length: 0` response keep answering exactly as now until the
  connection moves on, and so `respondEncoded`'s `write`-then-`end` is untouched.
- Check that nothing else reads `response` to decide input interest or buffer
  lending in a way that would still stall (`grep -n "this.response" std/net/http1-server.ts`);
  the observable tests below are the bar.

## Tests

`tests/link/net_http1_server_implicit_end/` — one `Http1Server` slot over
loopback with a plain `nish:net` client, bounded waits (see
`tests/link/net_http1_server_send_body/main.ts` for the harness and its
`ready` helper), `Date` pinned. Each case sends two requests on one keep-alive
connection and must read both responses; none of them calls `end()` unless
stated:

1. full body through `sendBody`;
2. full body through `write`, in more than one call;
3. `Content-Length: 0`, no `write`;
4. HEAD with a declared length, body written and swallowed;
5. two requests pipelined in one client write, both answered in order;
6. `end()` called after the full body still answers 0 and the bytes on the
   wire are identical to the case without it;
7. negative: a body one byte short, no `end()` — the second request gets no
   answer within the bound and `end()` still answers `H1_INVALID`;
8. negative: a chunked response with no `end()` is not finished (no terminator
   on the wire, second request unanswered within the bound).

Show the exact LLVM IR for any TypeScript snippet the PR adds to the tests, per
`CLAUDE.md`, if the test harness requires a golden.

**Owns:** `std/net/http1-server.ts`, `tests/link/net_http1_server_implicit_end/**`, `docs/guide/using-nish/standard-library.md`, `docs/security/http1-codec.md`, `docs/reference/**`, `scalar.config.json`, `tests/self/goldens/**`, `tests/differential/**`, `tests/nish-cmp.js`
