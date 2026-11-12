# Security record: the HTTP router

The record of WP43's first stage: `nish/net/router`, the method and path
router ([wp43-http-app-layer.md](https://github.com/amritk/nish/blob/main/docs/wp43-http-app-layer.md)). It says what the
router refuses when a table is built and with what code, what it answers for a
target no route reaches, what a lookup costs, what it writes and where, and
the test that pins each property. It is written with the code rather than
after an audit, so that the audit of the HTTP application layer starts from
evidence.

Anchors are function names in `std/net/router.ts` at `ad1dbeb`, the last
commit to change it on the head that merges this record.

**Result.** Every route a table would hold ambiguously is refused when it is
added, never resolved by the order routes came in; a refused `add` changes
nothing. Every target, however long, deep or malformed, answers a route index
or `ROUTER_NOT_FOUND` / `ROUTER_METHOD_NOT_ALLOWED`, or
`ROUTER_TOO_MANY_PARAMS` when the caller's `params` holds too few pairs;
none panics. `match` panics only on caller misuse: a method or target range
outside the array it indexes.

A lookup splits the path once and enters each node of the table at most once, so its
cost is bounded by the target's length plus the table's size, whatever the
target. A match allocates nothing and writes only into the `params` the caller
passed, and only when every pair fits. Nothing was found to fix or left open.

A route with no parameter and no `*` is also filed in an exact-path table that
`match` reads before the tree (WP49 stage 6). The table answers only the route
the tree would have answered (ROUTE-10), a lookup in it reads the path once
and at most eight slots whatever the client sends (ROUTE-11), and its one
unchecked comparison reads inside ranges already checked (ROUTE-12).
Two properties a reader might assume are not provided, by design, and are
recorded as accepted: dot segments are not removed (ROUTE-8) and the path is
matched before it is decoded (ROUTE-9).

## Scope

| File | Functions |
| --- | --- |
| `std/net/router.ts` | `RouterLimits`; `Router` (`add`, `splitPattern`, `childFor`, `addChild`, `growStatic`, `fileStatic`, `methodIndex`, `match`, `matchTree`, `enter`, `staticRoute`, `descend`, `walk`, `endpointFor`, and the accessors `routes`, `nodeCount`, `paramCount`, `staticCount`, `lastVisited`); `routerDecode`; the helpers `routerLimit`, `routerTchar`, `routerSegmentKind`, `routerSameName`, `routerLabelIsText`, `routerSameBytes`, `routerSameRange`, `routerHashOf`, `routerHashWith`, `routerSlot`, `routerOutside`, `routerNoRoute`, `routerHex` |

Out of scope: the carriers that hand the router its method and target
(`docs/security/http1-codec.md`, `http2.md`, `http3.md`), which have already refused
a malformed request line or pseudo-header before a program routes it, and what
a program does with a decoded parameter.

## Threat model

The attacker is the client: the method and the target are theirs, any bytes of
any length, and they may send as many requests as the carrier lets them.

A win is a panic, time or memory a target can make a lookup spend beyond its
own length and the table's size, a write outside `params`, a request routed to
a route its path does not spell, or two programs with the same routes routing
one target differently because they added the routes in a different order. The
route table is the program's and is trusted; its mistakes are refusal codes
from `add`, or a panic in the constructor for a limit out of range.

## Findings

Rows ROUTE-1 to ROUTE-7 are the shapes an attacker's target can take, each
checked and found to hold; they are recorded so that the audit can see what
was tried. ROUTE-8 and ROUTE-9 are accepted. ROUTE-10 to ROUTE-12 are what the
exact-path table adds to the surface, checked the same way. None is counted as
fixed or open in the index.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| ROUTE-1 | Medium if it failed | `match`, `endpointFor` | A target no route spells must answer a code, not a route or a panic: an unknown path, a method the table has never seen, a method in another case, a path whose routes are all of other methods. | **Holds.** 404 (`ROUTER_NOT_FOUND`) or 405 (`ROUTER_METHOD_NOT_ALLOWED`), and a 405 only when a route of another method ends where the path does. |
| ROUTE-2 | Medium if it failed | `match` | A target that is not `/`-rooted — `*` (`OPTIONS *`), the authority form (`CONNECT host:443`), the absolute form, an empty target, a bare `?` — must not be split as a path. | **Holds.** Each answers `ROUTER_NOT_FOUND` before the path is read; the program answers those forms itself. |
| ROUTE-3 | Medium if it failed | `descend`, `walk` | A long or deeply nested target must not cost more than one scan: a path of thousands of segments, against a table a few deep, and under a `*`. | **Holds.** The path is split once, and segment spans are kept only to one past the deepest route, in scratch the constructor sized from `maxSegments`. A 5,000-segment path against a table 7 deep answers 404 after visiting 4 nodes, and one under `*` is taken whole as one pair. |
| ROUTE-4 | Medium if it failed | `walk` | Backtracking (literal, then parameter, then `*`) must not make a lookup exponential in the depth. | **Holds.** Every edge consumes one segment and a node is reached by one edge, so a lookup enters each node at most once: `lastVisited()` is at most `nodeCount()`. A target that backtracks twice visits 19 of 21 nodes, and one that fails everywhere 18 of 21. A path the exact-path table answers enters none: `lastVisited()` is 0. |
| ROUTE-5 | Medium if it failed | `match`, `routerDecode` | `%2F` must not add a segment, and a malformed escape must not be read past. | **Holds.** `match` splits on raw bytes and decodes nothing, so `%2F` stays inside one parameter. `routerDecode` checks every escape before it writes: a `%` at the end, with one digit or a non-hex digit answers `ROUTER_BAD_ESCAPE`, and a decoded length past `out` `ROUTER_NO_ROOM`, each writing nothing. |
| ROUTE-6 | High if it failed | `match` | A route with more parameter pairs than `params` holds must not write past it. | **Holds.** `match` collects the pairs in its own scratch, sized `2 * maxParams` at construction, and copies them out only when all fit; otherwise it answers `ROUTER_TOO_MANY_PARAMS` and `params` is left as it was. |
| ROUTE-7 | Low if it failed | `match` | The query must not be matched, nor parsed. | **Holds.** The path ends at the first `?`; neither the query nor a `*`'s pair reaches past it. The query is left to the program. |
| ROUTE-8 | Low | `match` | Dot segments (`.` and `..`) and empty segments are matched as bytes, not removed as RFC 3986 §5.2.4 removes them, so `/public/../admin` reaches a `/public/*` route with `../admin` as its pair, not an `/admin` route. A program that guards a prefix by its route, and serves files from a parameter, must refuse such a parameter itself. | **Accepted.** Normalising would make the route a target reaches differ from the bytes it spells. Refusing dot segments in a parameter is the caller's job today; the static-file stage that will normalise the path it serves (`docs/wp43-http-app-layer.md`) is planned, not built. The guide says so: a decoded parameter can hold `/`, `..` and NUL. |
| ROUTE-9 | Low | `match`, `routerDecode` | The path is matched before it is decoded, so `/%61dmin` does not reach an `/admin` route, while a proxy that decodes first would send it there. | **Accepted.** Decoding first would let `%2F` split a segment, which is the worse confusion; a pattern refuses `%`, so no route can be spelled encoded. RFC 3986 §6.2.2.2 makes `%61` and `a` equivalent, so a server behind a decoding proxy routes on what it receives. |
| ROUTE-10 | Medium if it failed | `staticRoute`, `fileStatic` | The exact-path table must not answer a route the tree would not: a static route beside a parameter or a `*`, the same path under another method, a trailing slash, another case, an escape, a path that is a prefix of a filed one, two routes filed in one run of slots. | **Holds.** A slot answers only when its route's method is the request's and its stored path is the request's path byte for byte, to the first `?`; the hash chooses where to look and decides nothing. The tree tries a literal first at every segment, so the route it reaches for such a path is that one, with no pairs. Anything else, a 405 and a 404 included, is the tree's answer unchanged. `matchTree` is the tree alone, and the test asks both. |
| ROUTE-11 | Medium if it failed | `staticRoute`, `fileStatic`, `growStatic` | A client must not be able to make the table slow: paths chosen to collide, a very long path, many requests. | **Holds.** The client adds nothing to the table: it holds only routes `add` filed, at most `maxRoutes`. A lookup reads the path once, and only when the target is no longer than the longest filed path, then at most `ROUTER_PROBES` (8) slots, stopping at the first empty one; each slot costs a comparison of at most that length. `add` keeps four slots a route and files a route only within eight slots of its home, leaving it to the tree otherwise, so no run a lookup follows is longer. The hash is not keyed and need not be: a chosen path can reach a full run, and costs the eight slots every miss may cost, then the tree as before. |
| ROUTE-12 | High if it failed | `routerSameRange`, `enter`, `staticRoute` | The comparison that reads without a bounds check (`nish:unsafe`) must not read outside either array. | **Holds.** It has two callers. Each compares a range `add` pushed (a method, a static path; nothing removes a byte) with a range of the caller's of the same length that `enter` has already checked, panicking on one outside its array. `staticRoute` compares only when the lengths are equal, so the read ends at the path's end. |

`add`'s refusals are the program's, not the attacker's, and are listed under
the properties below.

## Properties verified

Each property below is pinned by a test that fails if it stops holding. The
router's own checks are lines of `tests/link/net_router/expected.out`, which
`link/net_router: exits with 0 and stdout matches expected.out` compares byte
for byte, and the same program under `--number-mode f64` is
`link/net_router_f64: exits with 0 and stdout matches expected.out`.

**Refusal at build time, never by order** (`net_router`): the same pattern
twice, and the same shape under another parameter name, are
`ROUTER_DUPLICATE`, while another method may share the shape; `*` not last is
`ROUTER_AMBIGUOUS`; every malformed pattern (empty, not `/`-rooted, a `:` with
no name or a bad name byte, a repeated name, `*` inside a segment, `%`, `?`, a
space, a control byte, a byte past `~`) is `ROUTER_BAD_PATTERN`; a bad method
is `ROUTER_BAD_METHOD`; each limit is `ROUTER_TOO_LONG` or `ROUTER_FULL` one
past its value and taken at it, and "a third method is refused by maxMethods
alone" pins the method limit apart from `maxRoutes`.

"none of the refusals added a node" pins that
a refused `add` changes nothing, and "a duplicate is still named a duplicate
when the table is full" that the codes do not depend on the table's state.

Each refusal is checked in the other order too, so none hangs on what was
added first: "a duplicate is refused whichever name came first", "* in the
middle is ambiguous in an empty table", "then a pattern over maxPatternBytes"
after the exact fits, "are each refused all the same, adding no node"; and a
literal wins over a parameter whichever came first, "a literal wins over a
parameter added before it" and "a literal added before a parameter wins over
it".

Each refusal also ends a program that checks it, with exit 1 and the message
its own `panic` gives: `link/net_router_negative_duplicate`, `_ambiguous`,
`_too_long` and `_too_many_params`, each `exits with 1 and stdout matches
expected.out`. A limit out of range panics in the constructor
(`link/net_router_negative_limits: exits with 1 and stdout matches
expected.out`).

**Unmatched and unrooted targets** (ROUTE-1, ROUTE-2): "a path that only
other methods match is 405", "and so is one whose method the table has never
seen at all", "a path no route matches is 404", "methods are compared exactly,
case and all", "OPTIONS * is not routed", "nor CONNECT's authority form", "nor
the absolute form", "nor an empty target", "a bare ? is not rooted either".

**The lookup bound** (ROUTE-3, ROUTE-4): "a target that backtracks twice still
matches", "and visits no node twice (19 of 21)", "visits at most every node
(18 of 21)", "a path of 5000 segments against a table 7 deep is 404", "after
visiting no more than the table (4)", "and one of 5000 under a * is taken
whole: 5 [a/a/.../a]", "from just past /static/ to the end (${wholeRest[0]} ..
${wholeRest[1]})".

**Escapes** (ROUTE-5): "matching is on raw bytes: %2F does not split", "%2F
decodes to / inside the parameter", "a % at the end is refused", "a % with one
digit", "a % with a non-hex digit", "a % with a non-hex second digit", "a
decoded length past out", "a malformed escape late in the range", "writes
nothing", "a match on /files/a%2Fb", "decodes its pair in place to a/b".

**Empty and trailing segments** (ROUTE-8): "an empty segment is a segment",
"a trailing slash is significant", "/a alone does not answer /a/", "/a/ alone
does not answer /a", "a pattern with an empty segment is taken", "a parameter
does not match an empty segment"; the dot-segment half, "a dot segment is
matched as bytes, not removed" (`/static/../admin` reaches `/static/*` with
`../admin` as its pair).

**Params past storage** (ROUTE-6): "a match with more pairs than params holds
is refused", "and params is left as it was", "a route with no parameters needs
no room".

**The query** (ROUTE-7): "the query is not matched", "nor is a query on its
own", "nor the query after it".

**No allocation per match**: "3000 matches move the arena by nothing (0
bytes)".

**The exact-path table answers as the tree does** (ROUTE-10): a table of
static routes mixed with parameters and `*` under four methods, asked for
every pattern and its near misses (a trailing slash added and dropped, a byte
dropped, added and changed, another case, an escape, a query, a segment more)
under every method and two that have no route, with `params` of every size
from none to enough, once through `match` and once through `matchTree`:
"16800 lookups answer alike from the table and from the tree", route, path end
and every slot of `params`. The answers a reader would name are pinned one by
one: "a static route wins over the parameter beside it", "and is answered
without entering the tree", "the parameter route answers every other segment",
"the same path under another method is its own route", "a static path under a
method with no route there is 405", "and under a method the table has never
seen", "a static route with a query", "with its path ending at the ?", "a
trailing slash is not the static route", "another case is not the static
route", "nor is an escape of it", "a parameter route still refuses too little
params". Two routes in one run of slots: "a path two methods file at one slot,
and one filed where its prefix is", "the first method's route", "and the
second's, one slot on", "a path is not the longer one filed before it", "nor
the longer one it".

**The table's bounds** (ROUTE-11): "nine paths of one home slot", "eight are
filed and the ninth is left to the tree", "all nine answer their own index",
"one of them from the tree", "a tenth path of that slot is 404", "a table
grown past them files the ninth (17 of 17)"; growth, "300 static routes each
answer their own index as they are added", "and all 300 are in the table",
"and again once it has grown", "a path one past the last of them is 404". A hit
allocates nothing: "1000 matches from the table move the arena by nothing (0
bytes)".

**The unchecked comparison** (ROUTE-12): the ranges are the ones the checks
above pass, and a method or target range outside its array still panics before
any read; the comparison's two callers are named in the module's header, under
"What is unchecked".
