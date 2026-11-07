---
name: Stream data over a real socket after an address rebind
overview: Close issue 1226 by adding an address (not port) rebind to the net_loopback WebTransport carrier, with bidirectional streams and datagrams echoed both ways and the arena kept flat, and fix the stale status line in docs/wp34-hosting-cs.md.
stages:
  - id: wt-address-rebind
    title: "test(runtime): echo WebTransport streams after the client's address changes"
    goal: A real-socket loopback test carries bidi stream data both ways after the client moves from 127.0.0.1 to 127.0.0.2 mid-session
    verification: node tests/run.js net_loopback
    todos:
      - id: udploop-rebind-host
        content: Let UdpLoop.rebind in tests/link/net_loopback/udp.ts take the host to bind, defaulting to 127.0.0.1 — see Address rebind
      - id: wt-wire-rebind-addr
        content: Add an address-rebind phase after wtWireRebind in tests/link/net_loopback/carrier-webtransport.ts with 8 rounds of datagram plus bidi stream, PATH_CHALLENGE, slot address, flat arena, nothing to the old socket — see Address rebind
      - id: expected-out
        content: Update tests/link/net_loopback/expected.out for the new checks — see Address rebind
      - id: wp34-status
        content: Replace the stale in-review status for 1210 in docs/wp34-hosting-cs.md line 20 with merged in 1218 — see Doc status
---

## Context

[Issue #1226](https://github.com/amritk/nish/issues/1226): acceptance criterion 1 of the quic-nat-rebinding run (#1210, merged as #1218) is PARTIAL. A port change carries datagrams and streams over real sockets ([`carrier-webtransport.ts`](../../tests/link/net_loopback/carrier-webtransport.ts) `wtWireRebind`). An address change carries only datagrams ([`net_relay/rebind.ts`](../../tests/link/net_relay/rebind.ts)). Only the in-memory unit [`net_quic_path/checks.ts`](../../tests/link/net_quic_path/checks.ts) pins stream data after an address move.

## Approach

Take the issue's second option, `net_loopback`'s WebTransport carrier, not the relay. The carrier already has the bidi-stream echo machinery (`lp.sendStream`, `wtWireAwait`, `p.stream(id)`) and the `LbMeter` arena check. The relay rig only reads the CONNECT stream and one request stream and does not echo stream data, so adding stream rounds there would mean new rig machinery.

## Stage wt-address-rebind

**Owns:** `tests/link/net_loopback/**`, `docs/wp34-hosting-cs.md`

One stage, one PR: the test and the doc line are each a few lines and share the issue.

## Address rebind

- [`udp.ts`](../../tests/link/net_loopback/udp.ts) `UdpLoop.rebind()` binds `"127.0.0.1"` port 0. Give it a `host` parameter (default `"127.0.0.1"`, so the existing port-rebind call is unchanged), or add a sibling. Keep it one method if Nish's default-parameter support allows it in `tests/link`.
- In `carrier-webtransport.ts`, after `wtWireRebind` (call site near line 203), run the same shape of phase with the client moving to `127.0.0.2`: drain ACKs first, rebind, 8 rounds of `rebound-addr k` as a datagram and as a new bidi stream, each echoed back. Assert all 8 intact, `lp.client.challenges` grew (the server validated the new address), the server slot's address now carries `127.0.0.2` (check the address bytes, not only the port), `LbMeter.kept === 0` over the phase, and nothing reached the old socket. Factor the shared body with `wtWireRebind` if that is the smaller diff. Return the next stream id so later phases keep working.
- The final per-session arena check (the "each keeps at most 2 KiB" line near 244) must stay green: the band is not widened.
- macOS: Darwin's `lo0` carries `127.0.0.1` alone. CI's mac job already aliases `127.0.0.2` before the tests run (`.github/workflows/ci.yml`, "Alias 127.0.0.2 and 127.0.0.3 on lo0"), as `net_relay` relies on. Mention the alias in the new test's comment the way `net_relay/loopback.ts:268` does. Do not edit CI.
- Update [`expected.out`](../../tests/link/net_loopback/expected.out) for the new check lines.

## Doc status

[`docs/wp34-hosting-cs.md`](../../docs/wp34-hosting-cs.md) line 20 says "(#1210, in review)". #1218 is merged (not yet released; the open 0.35.0 Release PR carries it). Say so, and nothing else in that file.

## Out of scope

- `tests/link/net_relay/**`: the relay's address-change datagram test stays as it is.
- `std/`, `src/`, `runtime/`: this is a test-only change. If the new test fails because the server does not follow an address change for streams, that is a real bug: open the PR as a draft and describe it; do not fix the server in this stage.
- CI workflows, any guide page (no user-visible change).

## Verification

```bash
npm run check
npm run lint
node tests/run.js net_loopback
```
