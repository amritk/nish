# HTTP routing

`nish/net/router` maps a request's method and path to one of the routes you
added. It reads no socket and knows no HTTP version: you hand it the method
and the target as bytes, from an HTTP/1.1 request line or from an HTTP/2 or
HTTP/3 `:path`, and it answers which route they reach. It is imported like any
other library module ([`export` and `import`](../../LANGUAGE.md#export-and-import)).

Nish has no function values, so a route is not a handler. `add` answers a
number, the route's index, and your program dispatches on that number with
`switch`. A route's parameters are not copied out either: `match` writes each
one as a pair of offsets into the target, in an `i32[]` you made once.

## A first table

```ts nish:ok
import { ROUTER_METHOD_NOT_ALLOWED, ROUTER_NOT_FOUND, Router, RouterLimits } from "nish/net/router";

// The routes, in the order they are added: `add` answers 0, 1, 2.
const HOME: i32 = 0;
const USER: i32 = 1;
const FILES: i32 = 2;

const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  const n: i32 = toI32(text.length);
  for (let i: i32 = 0; i < n; i++) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

const route = (router: Router, index: i32, method: string, pattern: string): void => {
  const answer: i32 = router.add(method, pattern);
  if (answer !== index) {
    panic(`${method} ${pattern} is refused with ${answer}`);
  }
};

const answer = (router: Router, method: string, target: string, params: i32[]): void => {
  const m = bytesOf(method);
  const t = bytesOf(target);
  switch (router.match(m, 0, toI32(m.length), t, 0, toI32(t.length), params)) {
    case HOME:
      console.log(`${method} ${target}: the home page`);
      break;
    case USER:
      console.log(`${method} ${target}: user ${String.fromBytes(t, params[0], params[1])}`);
      break;
    case FILES:
      console.log(`${method} ${target}: the file ${String.fromBytes(t, params[0], params[1])}`);
      break;
    case ROUTER_METHOD_NOT_ALLOWED:
      console.log(`${method} ${target}: 405`);
      break;
    case ROUTER_NOT_FOUND:
      console.log(`${method} ${target}: 404`);
      break;
    default:
      console.log(`${method} ${target}: 500, params is too short`);
  }
};

export const main = (): i32 => {
  const router = new Router(new RouterLimits());
  route(router, HOME, "GET", "/");
  route(router, USER, "GET", "/users/:id");
  route(router, FILES, "GET", "/static/*");
  const params: i32[] = [0, 0, 0, 0];
  answer(router, "GET", "/", params);
  answer(router, "GET", "/users/42?tab=keys", params);
  answer(router, "GET", "/static/css/site.css", params);
  answer(router, "DELETE", "/users/42", params);
  answer(router, "GET", "/nowhere", params);
  return 0;
};
```

```console
$ nish run routes.ts
GET /: the home page
GET /users/42?tab=keys: user 42
GET /static/css/site.css: the file css/site.css
DELETE /users/42: 405
GET /nowhere: 404
```

Build the table once, at start-up. A `case` label is a constant, so name
each route's index as a module constant and check that `add` answered it:
`add` answers 0 for the first route, 1 for the next, and a negative code for
a pattern it refuses, so the constants follow the order you add in. Every
refusal and miss is negative and every route is not, so the cases stay
distinct. A match allocates nothing, so a server that makes `params` beside
each connection routes every request without touching the heap. A `Router`
answers one match at a time; give each thread its own.

## Patterns

A pattern starts with `/` and is split on `/` into segments. Each segment is
one of:

| Segment | Matches |
| --- | --- |
| `users` | exactly the bytes `users` |
| `:id` | any one segment that is not empty; the name, letters, digits and `_`, is for you to read, and `match` ignores it |
| `*` | the rest of the path, possibly empty; only as the last segment. `/static/*` answers `/static/` but not `/static`: the slash before `*` is part of the pattern |

A trailing slash is a segment of its own, an empty one, so `/users` and
`/users/` are different routes, and neither answers the other's target. An
empty segment inside a pattern, as in `/a//b`, is an empty literal: it matches
only an empty segment of the target, which a parameter never does. Matching is on the bytes as they arrive, case
and all.

The query is left alone: the path ends at the first `?`, and what follows is
yours to parse. A target that does not start with `/` matches nothing, so
`OPTIONS *` and the authority form of `CONNECT` answer `ROUTER_NOT_FOUND`;
answer them before you route if your server supports them.

### Which route wins

When more than one route could match, the router compares them segment by
segment from the left, and at each segment prefers a literal, then a
parameter, then `*`. If the preferred branch fails further along, it falls
back to the next one, so `/users/new` reaches a `GET /users/new` route before
`GET /users/:id`, and `/users/new/avatar` still reaches
`GET /users/:id/avatar` when no literal route goes that deep. A request never
waits on that search: every step moves one segment deeper into the table, so
one match looks at each route's segments at most once.

A path that matches routes only under other methods answers
`ROUTER_METHOD_NOT_ALLOWED`, so your server can send 405 and 404 where each
belongs. Methods are compared exactly: `get` is not `GET`.

## What `add` refuses

`add` checks a pattern when the table is built, never when a request arrives,
and answers a negative code rather than adding something that would surprise
you later. A refused pattern adds nothing, and whether a pattern is refused
does not depend on the order you added routes in.

| Code | Why |
| --- | --- |
| `ROUTER_BAD_METHOD` | the method is empty, longer than 32 bytes, or not an HTTP token |
| `ROUTER_BAD_PATTERN` | the pattern is empty, does not start with `/`, has a `:` name that is empty, uses more than letters, digits and `_`, or repeats an earlier one, uses `*` beside other bytes in a segment, or holds `%`, `?` or a byte outside `!` to `~` |
| `ROUTER_TOO_LONG` | the pattern is over the table's limit of bytes, segments or parameters |
| `ROUTER_AMBIGUOUS` | a `*` that is not the last segment |
| `ROUTER_DUPLICATE` | the method already has a route of this shape, whatever its parameters are called: `/users/:id` and `/users/:name` are one route |
| `ROUTER_FULL` | the table holds its limit of routes or methods |

A route table is part of your program, so a refusal is usually a bug to fix
before the server starts. Check every index, and stop there:

```ts nish:ok
import { ROUTER_DUPLICATE, Router, RouterLimits } from "nish/net/router";

export const main = (): i32 => {
  const router = new Router(new RouterLimits());
  const first: i32 = router.add("GET", "/users/:id");
  const second: i32 = router.add("GET", "/users/:name");
  console.log(`${first} ${second === ROUTER_DUPLICATE ? "duplicate" : "added"}`);
  return 0;
};
```

```console
$ nish run duplicate.ts
0 duplicate
```

`RouterLimits` holds the limits, each with a default a server can use as it
is: `maxPatternBytes` (1024), `maxSegments` (32), `maxParams` (16, a final
`*` counted), `maxRoutes` (4096) and `maxMethods` (16). Set a field before
you pass it to `new Router`; a value no table could work with, such as
`maxSegments = 0`, panics there.

## Parameters

On a route, `match` writes the parameters into `params` in the pattern's
order, two slots each: `params[0]` and `params[1]` are where the first one
starts and ends in the target, `params[2]` and `params[3]` the second, and a
final `*` is one more pair. `router.paramCount(route)` says how many pairs a
route answers, so `2 * paramCount` is the length `params` needs; size it for
your widest route. If it is too short, `match` answers
`ROUTER_TOO_MANY_PARAMS` and writes nothing.

The offsets point at the bytes as they arrived, still percent-encoded. That
matters: `match` splits the path before anything is decoded, so `%2F` in
`/files/a%2Fb` stays inside one parameter instead of adding a segment.
`routerDecode(target, start, end, out)` decodes one parameter into a buffer you
own and answers its length, or `ROUTER_BAD_ESCAPE` for a `%` not followed by
two hex digits, or `ROUTER_NO_ROOM` when `out` is too small. `+` stays `+`:
it means a space only in a query.

```ts nish:ok
import { Router, RouterLimits, routerDecode } from "nish/net/router";

const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  const n: i32 = toI32(text.length);
  for (let i: i32 = 0; i < n; i++) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

export const main = (): i32 => {
  const router = new Router(new RouterLimits());
  const file: i32 = router.add("GET", "/files/:name");
  const method = bytesOf("GET");
  const target = bytesOf("/files/a%2Fb.txt");
  const params: i32[] = [0, 0];
  if (router.match(method, 0, 3, target, 0, toI32(target.length), params) !== file) {
    return 1;
  }
  const name: u8[] = new Array<u8>(64);
  const length: i32 = routerDecode(target, params[0], params[1], name);
  if (length < 0) {
    return 1;
  }
  const text = String.fromBytes(name, 0, length);
  console.log(`${text}, ${length} bytes`);
  return 0;
};
```

```console
$ nish run decode.ts
a/b.txt, 7 bytes
```

A decoded parameter can hold any byte, `/`, `..` and NUL among them. Check it
before you use it as a file name.

## From HTTP/1.1, HTTP/2 and HTTP/3

`match` takes the method and the target as windows into arrays you already
hold, so neither carrier copies anything to route.

With `nish/net/http1`, the parser keeps the request line in `head`:

```ts
const route: i32 = router.match(
  parser.head, parser.methodStart, parser.methodEnd,
  parser.head, parser.targetStart, parser.targetEnd, params);
```

With `nish/net/http2` or `nish/net/http3`, a request's `HttpFields` hands
over `:method` and `:path` as arrays:

```ts
const fields = conn.fields;
const route: i32 = router.match(
  fields.method, 0, toI32(fields.method.length),
  fields.path, 0, toI32(fields.path.length), params);
```

Under `nish/net/http2` those arrays are the connection's, not the request's.
`conn.fields`, and every `u8[]` taken from it (`path`, `method`, `get(..)`,
`names[k]`), holds until the connection decodes its next header block, on any
stream, one your program never sees included. Route at `H2_REQUEST`; a value
needed later, at `H2_DATA` of a streaming POST say, is copied there first:

```ts
const path: u8[] = []; for (const b of fields.path) { path.push(b) }
```

`get(..)` answers `null` for a field the request does not carry, so copy what
it found, and keep an empty array (or your own default) for what it did not:

```ts
const found: u8[] | null = fields.get("content-type");
const type: u8[] = [];
if (found !== null) { for (const b of found) { type.push(b) } }
```

The same table and the same `switch` then serve all three. The
[standard library page](standard-library.md#nishnet) lists the carriers, and
the [library's README](../../../std/README.md) every export.
