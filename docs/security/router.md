# Security record: the HTTP router

The record of `nish/net/router`, the method and path router. It says what the
router refuses when a table is built and with what code, what it answers for a
target no route reaches, what a lookup costs, what it writes and where, and
the test that pins each property. It is written with the code rather than
after an audit, so that the audit of the HTTP application layer starts from
evidence.

Anchors are function names in `std/net/router.ts` at `cf61c0f`, the last
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
and at most eight slots whatever the client sends (ROUTE-11), and the one
unchecked comparison reads only inside ranges it has just checked (ROUTE-12).
A method of up to seven bytes is found by one packed word, which tells two
methods apart exactly when their bytes differ (ROUTE-13).
Two properties a reader might assume are not provided, by design, and are
recorded as accepted: dot segments are not removed (ROUTE-8) and the path is
matched before it is decoded (ROUTE-9).

## Scope

| File | Functions |
| --- | --- |
| `std/net/router.ts` | `RouterLimits`; `Router` (`add`, `splitPattern`, `childFor`, `addChild`, `growStatic`, `fileStatic`, `methodIndex`, `match`, `matchTree`, `enter`, `staticRoute`, `descend`, `answer`, `walk`, `endpointFor`, and the accessors `routes`, `nodeCount`, `paramCount`, `staticCount`, `lastVisited`); `routerDecode`; the helpers `routerLimit`, `routerTchar`, `routerSegmentKind`, `routerSameName`, `routerLabelIsText`, `routerSameBytes`, `routerMethodKey`, `routerHashOf`, `routerHashWith`, `routerSlot`, `routerOutside`, `routerNoRoute`, `routerHex` |

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
exact-path table adds to the surface, and ROUTE-13 what the packed method
compare adds, checked the same way. None is counted as
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
| ROUTE-11 | Medium if it failed | `staticRoute`, `fileStatic`, `growStatic` | A client must not be able to make the table slow: paths chosen to collide, a very long path, many requests. | **Holds.** The client adds nothing to the table: it holds only routes `add` filed, at most `maxRoutes`. A lookup reads the path once, and only when the target is no longer than the longest filed path, then at most `ROUTER_PROBES` (8) slots, stopping at the first empty one; each slot costs a comparison of at most that length. `add` keeps four slots a route and files a route only within eight slots of its home, leaving it to the tree otherwise, so no run a lookup follows is longer. The hash is not keyed and need not be: a chosen path can reach a full run. What a miss costs is stated plainly: a target no longer than the longest static route that the table does not hold now pays one hash pass over its path and up to eight slots, each a length compare and at most one byte comparison of that length, and then the same tree walk it paid before the table existed. That is more than before by a bounded amount the server's own routes set, never by one the client sets; a target longer than the longest static route pays nothing new. |
| ROUTE-12 | High if it failed | `routerSameBytes`, `enter`, `staticRoute`, `walk` | The comparison that reads without a bounds check (`nish:unsafe`) must not read outside either array, whatever the ranges its caller hands it. | **Holds.** `routerSameBytes` checks first that both ranges, `a[at .. at + length)` and `b[from .. from + length)`, start at 0 or past it and end inside their arrays, written as `length > a.length - at` so that no sum can overflow, and compares unequal otherwise; only then does it read, with two cursors that run from those starts to `at + length`, which the check has put inside `a`. So no caller can make it read outside an array, and none relies on another's check: `staticRoute` hands it the private `staticPaths` and a target range `enter` checked, `walk` a label and a segment, and `enter` the public `methodBytes`, `methodStart` and `methodEnd`, which a program can rewrite. Before this stage the compare was checked and the unchecked one (`routerSameRange`) relied on its one caller's checks; now the check travels with the read. |
| ROUTE-13 | Medium if it failed | `routerMethodKey`, `enter`, `add` | A method of one to seven bytes is matched by comparing one 64-bit word, its bytes and its length packed by `routerMethodKey`, with each known method's word, which `add` stores in the private `methodKey`. Two different methods must never share a word, a method must not match a prefix or an extension of itself, and no request may reach a route by a method `add` was not given. | **Holds.** The key puts byte `k` of the method in bits `8k` to `8k + 7` and the length in the top byte, so a key of up to seven bytes is a one-to-one encoding of the bytes and their count: methods of different lengths differ in the top byte, and of one length in the byte where they differ. 0 is no packed method's key (the length byte is at least 1), and a method that is not packed, longer than seven bytes or a range outside its buffer, takes the byte compare of ROUTE-12 instead, as every method did before. `methodKey` is private and written only by `add`, beside the public arrays it is made from; a program that rewrites `methodBytes` after `add` (an `@internal` field) changes what the byte compare reads and not the key, so for a method of up to seven bytes the table keeps answering the method `add` was given. |

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
under each of those methods and three that have no route (`PATCH`, `get` and
the empty method), with `params` of every size
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
"one of them from the tree"; a miss on the full run, "an unregistered path
whose home is that full run", "is 404, as the tree alone answers it", "and the
tree visits no more than its nodes for it", "a path of another slot is 404";
"a table
grown past them files the ninth (17 of 17)"; growth, "300 static routes each
answer their own index as they are added", "and all 300 are in the table",
"and again once it has grown", "a path one past the last of them is 404". The
longest static route bounds what is hashed: "a static route with a query that
fits the longest", "is answered from the table", "the same route with a query
past the longest", "is answered by the tree". A hit
allocates nothing: "1000 matches from the table move the arena by nothing (0
bytes)".

**The unchecked comparison** (ROUTE-12): the ranges are the ones the checks
above pass, and a target range that ends past its array panics before any
read, the table's included (`link/net_router_negative_range: exits with 1 and
stdout matches expected.out`: a static route's own path, asked for with one
byte more than the buffer holds); the comparison's callers are named in the module's header, under
"What is unchecked", and it checks its own ranges before it reads, so a
method range inside a larger buffer is compared on that range alone: "a
method mid-buffer is read from its range alone, short or long".

**The packed method compare** (ROUTE-13): "methods of 1, 3, 4, 7, 8, 9 and 32
bytes each answer their own route", either side of the seven a word holds; "a
prefix or an extension of a known method is another method" (`GE`, `OPTION`,
`OPTIONSX`, `PROPFIN`, `PROPFINDX`, `AA`, each a 405); "and so is one of a
known length that differs in its first or last byte". A static miss on a
target no longer than the longest static route is the tree's answer, from the
split the table's pass made: "a shorter target it misses is the tree's, pairs
and all", "one deeper than any route is 404". Each answers as it did before
the packed compare: the same checks against the previous router print the
same lines.
