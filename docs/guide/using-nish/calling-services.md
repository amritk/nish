# Calling other services

A route handler often needs another service's answer before it can answer its
own client: a user record from a users service, a price from a pricing
service. `nish/net/upstream` makes those calls without stopping the server.
`get` sends the request and returns at once. The answer arrives in a later
turn of the same loop that serves your clients, tagged with the request that
asked for it. Meanwhile every other client is served as usual. It is a library
module ([`export` and `import`](../../LANGUAGE.md#export-and-import)) built on
[an API server](api-server.md)'s handler.

For a one-off fetch from a command-line program, where blocking is fine, use
the [HTTP client](http-client.md) instead.

## A proxying route

An `Upstream` is a pool of kept-alive connections to one origin, registered on
the handler's loop. Make it once at start-up, beside the handler:

```ts nish:ok
import { HandlerLimits, HttpHandler } from "nish/net/handler";
import { Router, RouterLimits } from "nish/net/router";
import { UPSTREAM_E_NONE, UPSTREAM_E_TIMEOUT, Upstream, UpstreamLimits } from "nish/net/upstream";
import { tcpListen } from "nish:net";

const USER: i32 = 0;

const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

export const main = (): i32 => {
  const router = new Router(new RouterLimits());
  router.add("GET", "/me");
  const listener: i32 = tcpListen("127.0.0.1", 8080, 1024);
  if (listener < 0) {
    console.error(`cannot listen: ${listener}`);
    return 1;
  }
  const h = new HttpHandler(new HandlerLimits(), listener, router);
  const users = new Upstream(h, "http://127.0.0.1:9000", new UpstreamLimits());
  if (users.error !== UPSTREAM_E_NONE) {
    console.error(users.errorText);
    return 1;
  }
  const json = bytesOf("application/json");
  while (true) {
    h.wait(100); // one turn, for clients and the upstream alike
    while (h.ready()) {
      const req = h.take();
      switch (req.route) {
        case USER:
          if (users.get(req, "/v1/users/7") !== UPSTREAM_E_NONE) {
            h.problem(req, 503, "Service Unavailable", "too many calls in flight");
          }
          break; // otherwise answered below, in a later turn
        default:
          h.refuse(req);
      }
    }
    while (users.ready()) {
      const r = users.take(); // r.req is the request that asked
      if (r.ok && r.status === 200) {
        h.send(r.req, 200, json, r.body, 0, r.length);
      } else if (r.error === UPSTREAM_E_TIMEOUT) {
        h.problem(r.req, 504, "Gateway Timeout", "");
      } else {
        h.problem(r.req, 502, "Bad Gateway", `upstream error ${r.error}`);
      }
      users.release(r);
    }
  }
};
```

The client's request stays held while the call is out, as
[answering later](api-server.md#answering) allows. If the client has gone by
the time the answer comes, `h.send` drops it, so the loop needs no special
case for that.

## Every call ends once

Each `get` that returns `UPSTREAM_E_NONE` comes back exactly once through
`ready` and `take`, however it ends. Answer `r.req`, then give the call back
with `release`; releasing it twice panics.

- `r.ok` means the response was read to its end. `r.status` is its status,
  whatever it is, and the body is `r.body[0 .. r.length)`. Read `r.length`,
  not `r.body.length`: the buffer is reused.
- Otherwise `r.error` says why:
  - The response was malformed: one of the HTTP/1.1 codec's `HTTP1_E_` codes
    from `nish/net/http1-client`. For example, `HTTP1_E_BODY_LIMIT` is a body
    past `maxBody` and `HTTP1_E_TRUNCATED` is a response cut short.
  - The call failed for another reason, with one of the codes below.

| Code | The call failed because |
| --- | --- |
| `UPSTREAM_E_ORIGIN` | the origin is not an `http:` URL with nothing past its host and port |
| `UPSTREAM_E_LOOKUP` | the origin's host could not be looked up at start-up |
| `UPSTREAM_E_BLOCKED` | the outbound policy refused the origin |
| `UPSTREAM_E_CONNECT` | the connection could not be made |
| `UPSTREAM_E_TIMEOUT` | `timeoutMs` passed before the response ended |
| `UPSTREAM_E_CLOSED` | the connection failed or closed before a response began |
| `UPSTREAM_E_REQUEST` | the path does not start with `/` or is not a request target, or the head outgrew `maxHead` |
| `UPSTREAM_E_RESET` | the connection failed (was reset, say) while the response was being read, so what came is not all of it |

`get` itself answers `UPSTREAM_E_FULL` when every call slot is taken. It then
holds nothing, and the request is still yours to answer, with a 503 say.

A connection whose call failed is closed, so nothing the origin sent on it can
be read as the next answer. The next call opens a new one.

A kept-alive connection is read once before it carries the next call. If the
origin closed it or sent something on it while it sat idle, it is closed and
the call takes another. An origin may still close a kept-alive connection
just as a call is sent on it; a call that fails that way before any byte of
its answer arrives is made once more, on a new connection. It is never made a
third time, and a call that timed out is not made again. A `get` may
therefore reach the origin twice, so call this way only paths that are safe
to repeat.

## The origin

The constructor fixes the origin. It parses the URL, looks the host up once
(start-up waits up to `lookupMs` for that) and keeps one address. Nothing is
looked up again. An unusable origin is not a crash: `error` and `errorText`
say why, and every call fails with that code. Only `http:` is spoken, so use
`nish/net/upstream` for services on a network you trust. `https:` is refused,
never sent in clear.

When the origin comes from configuration or from a request, set an
[outbound policy](http-client.md#fetching-a-url-someone-else-chose). The
policy checks the host name before the lookup and every address after it.
The pool connects only to an address the policy passed. A service on a
private address must be permitted by name or by range:

```ts nish:ok
import { OutboundPolicy } from "nish/net/outbound";
import { UpstreamLimits } from "nish/net/upstream";

export const servicesLimits = (): UpstreamLimits => {
  const policy = new OutboundPolicy();
  policy.permit("10.0.0.0/8"); // the services' own network
  const limits = new UpstreamLimits();
  limits.outbound = policy;
  return limits;
};
```

## Limits

`UpstreamLimits` holds every cap, all read once by the constructor:

| Field | Default | What it bounds |
| --- | --- | --- |
| `connections` | 4 | open connections to the origin |
| `calls` | 256 | calls queued, in flight, or finished and not yet released |
| `firstId` | 8 | the first of the handler watch ids the connections use, one each; keep them clear of your own `h.watch` ids |
| `timeoutMs` | 10 000 | one call, from `get` to its response's end |
| `lookupMs` | 5 000 | the start-up lookup |
| `maxBody` | 1 MiB | a response body |
| `maxHead` | 8 KiB | the request head `get` writes |
| `maxStatusLine`, `maxHeaderBytes`, `maxHeaders`, `maxTrailerBytes` | 8 KiB, 64 KiB, 100, 8 KiB | a response's head and trailers |
| `outbound` | null | the outbound policy |

The handler watches at most 16 descriptors besides its clients, so
`firstId + connections` is at most 16; the constructor panics otherwise.

**Two `Upstream`s on one handler need watch ids that do not overlap.** The
handler wakes an id, not a socket, and nothing checks that two pools' ids are
apart: two made with the default limits both take ids 8 to 11, and each reads
the other's wake-ups as its own. Give the second pool its own range, for
example `firstId = 12` beside a first with `firstId = 8` and four
connections.

A call's deadline is checked when you call `ready` after a turn, so wait with
a timeout, as above, not `h.wait(-1)`. The slots, the connections and their
buffers are made at start-up. Each call keeps a body buffer as large as the
largest body it has held. Each connection keeps one response parser, which
reads a response's fields into a buffer it reuses, so a warm pool allocates
nothing per call.
