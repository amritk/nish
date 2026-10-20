// `nish/net/router`: the table `Router.add` builds, what it refuses, and what
// `Router.match` and `routerDecode` answer. Five groups of checks:
//
// - **Matching**: literal before parameter before `*`, whichever order the
//   routes were added in; a branch that fails deeper falls back; the trailing
//   slash, empty segments and the query; 405 against 404; byte-exact pairs on
//   a deep route.
// - **Refusals**: every code `add` answers, each adding nothing, and the same
//   shape under other parameter names refused as a duplicate.
// - **Targets a router does not route**: `*`, the authority form, an empty one.
// - **Bounds**: a lookup that backtracks visits each node at most once, a
//   path deeper than every route is split no further, too little `params`
//   leaves it untouched, and a warmed match moves the arena by nothing.
// - **Carriers and decoding**: one table answering an HTTP/1 request line and
//   an HTTP/2 `:path`; `%2F` decoded inside a parameter only, `+` kept,
//   malformed escapes and too small a buffer refused.
import { HTTP1_HEAD, Http1Parser } from "nish/net/http1";
import { HTTP_FIELDS_OK, HttpFields, httpFieldBytes } from "nish/net/http-fields";
import {
  ROUTER_AMBIGUOUS,
  ROUTER_BAD_ESCAPE,
  ROUTER_BAD_METHOD,
  ROUTER_BAD_PATTERN,
  ROUTER_DUPLICATE,
  ROUTER_FULL,
  ROUTER_METHOD_NOT_ALLOWED,
  ROUTER_NO_ROOM,
  ROUTER_NOT_FOUND,
  ROUTER_TOO_LONG,
  ROUTER_TOO_MANY_PARAMS,
  Router,
  RouterLimits,
  routerDecode,
} from "nish/net/router";
import { Suite } from "nish/testing";

/** `bytes[start .. end)` as a string, one character a byte. */
const textOf = (bytes: u8[], start: i32, end: i32): string => {
  const parts: string[] = [];
  for (let k: i32 = start; k < end; k++) {
    parts.push(String.fromCharCode(toI32(bytes[k])));
  }
  return parts.join("");
};

/** What `router` answers for `method target`: the route and its pairs as text, `3 id=42 rest=a/b`, or the code. */
const answer = (router: Router, method: string, target: string): string => {
  const m: u8[] = httpFieldBytes(method);
  const t: u8[] = httpFieldBytes(target);
  const params: i32[] = new Array<i32>(32);
  const route: i32 = router.match(m, toI32(0), toI32(m.length), t, toI32(0), toI32(t.length), params);
  if (route < 0) {
    return `${route}`;
  }
  const parts: string[] = [`${route}`];
  for (let k: i32 = 0; k < router.paramCount(route); k++) {
    parts.push(`[${textOf(t, params[2 * k], params[2 * k + 1])}]`);
  }
  return parts.join(" ");
};

/** `values` as `1,2,3`. */
const listOf = (values: i32[]): string => {
  const parts: string[] = [];
  for (const v of values) {
    parts.push(`${v}`);
  }
  return parts.join(",");
};

/** `routerDecode` of all of `text`, as text, or its code. */
const decoded = (text: string, room: i32): string => {
  const t: u8[] = httpFieldBytes(text);
  const out: u8[] = new Array<u8>(room);
  const n: i32 = routerDecode(t, 0, toI32(t.length), out);
  return n < 0 ? `${n}` : textOf(out, 0, n);
};

/** Runs every check and answers the exit code. */
export const routerChecks = (): i32 => {
  const t = new Suite("router");

  // --- matching ---------------------------------------------------------------------
  const r = new Router(new RouterLimits());
  const home: i32 = r.add("GET", "/");
  const users: i32 = r.add("GET", "/users");
  const user: i32 = r.add("GET", "/users/:id");
  const me: i32 = r.add("GET", "/users/me");
  const post: i32 = r.add("POST", "/users/:id");
  const files: i32 = r.add("GET", "/static/*");
  const slash: i32 = r.add("GET", "/users/");
  t.eqStr("add answers the indices 0, 1, 2, ... in order", `${home} ${users} ${user} ${me} ${post} ${files} ${slash}`, "0 1 2 3 4 5 6");
  t.eqStr("/ matches only /", `${answer(r, "GET", "/")} ${answer(r, "GET", "//")}`, `0 ${ROUTER_NOT_FOUND}`);
  t.eqStr("a literal matches", answer(r, "GET", "/users"), "1");
  t.eqStr("a parameter takes one segment", answer(r, "GET", "/users/42"), "2 [42]");
  t.eqStr("a literal wins over a parameter added before it", answer(r, "GET", "/users/me"), "3");
  t.eqStr("a trailing slash is significant", answer(r, "GET", "/users/"), "6");
  t.eqStr("the method picks between routes of one shape", answer(r, "POST", "/users/7"), "4 [7]");
  t.eqStr("a path that only other methods match is 405", answer(r, "DELETE", "/users/7"), `${ROUTER_METHOD_NOT_ALLOWED}`);
  t.eqStr("and so is one whose method the table has never seen at all", answer(r, "PUT", "/"), `${ROUTER_METHOD_NOT_ALLOWED}`);
  t.eqStr("a path no route matches is 404", answer(r, "GET", "/nope"), `${ROUTER_NOT_FOUND}`);
  t.eqStr("whatever the method", answer(r, "POST", "/nope"), `${ROUTER_NOT_FOUND}`);
  t.eqStr("methods are compared exactly, case and all", answer(r, "get", "/users"), `${ROUTER_METHOD_NOT_ALLOWED}`);
  t.eqStr("the query is not matched", answer(r, "GET", "/users/42?x=/users/me#f"), "2 [42]");
  t.eqStr("nor is a query on its own", answer(r, "GET", "/?a"), "0");
  t.eqStr("nor more than one segment", answer(r, "POST", "/users/1/2"), `${ROUTER_NOT_FOUND}`);
  t.eqStr("* takes the rest of the path, slashes and all", answer(r, "GET", "/static/css/a.css"), "5 [css/a.css]");
  t.eqStr("including none of it", answer(r, "GET", "/static/"), "5 []");
  t.eqStr("but not the slash before it", answer(r, "GET", "/static"), `${ROUTER_NOT_FOUND}`);
  t.eqStr("nor the query after it", answer(r, "GET", "/static/a?v=1"), "5 [a]");
  t.eqStr("matching is on raw bytes: %2F does not split", answer(r, "GET", "/users/a%2Fb"), "2 [a%2Fb]");
  t.eqStr("an empty segment is a segment", answer(r, "GET", "/users//"), `${ROUTER_NOT_FOUND}`);

  // Literal, then parameter, then *, in whichever order they were added, with
  // a branch that fails deeper falling back to the next.
  const order = new Router(new RouterLimits());
  const wildFirst: i32 = order.add("GET", "/a/*");
  const paramNext: i32 = order.add("GET", "/a/:x/end");
  const literalLast: i32 = order.add("GET", "/a/b/c");
  t.eqStr("the literal branch, when it reaches a route", answer(order, "GET", "/a/b/c"), `${literalLast}`);
  t.eqStr("the parameter, when the literal dead-ends below", answer(order, "GET", "/a/b/end"), `${paramNext} [b]`);
  t.eqStr("then *, whose pair is the rest, the parameter's popped", answer(order, "GET", "/a/b/zzz"), `${wildFirst} [b/zzz]`);
  t.eqStr("* after a literal it does not match", answer(order, "GET", "/a/q"), `${wildFirst} [q]`);

  // A deep route answers every pair, byte-exact, at its offsets into the target.
  const deep = new Router(new RouterLimits());
  deep.add("GET", "/v1/orgs/:org/projects/:project/builds/:build/logs/*");
  const deepTarget: u8[] = httpFieldBytes("/v1/orgs/acme/projects/rocket/builds/1234/logs/2026/10/x.log?tail=1");
  const deepParams: i32[] = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1];
  const deepMethod: u8[] = httpFieldBytes("GET");
  const deepRoute: i32 = deep.match(deepMethod, toI32(0), toI32(3), deepTarget, toI32(0), toI32(deepTarget.length), deepParams);
  t.eqI32("a nine-segment route matches", deepRoute, toI32(0));
  t.eqI32("and has four pairs", deep.paramCount(deepRoute), toI32(4));
  t.eqStr(
    "each at its offsets into the target, the slot past them untouched",
    listOf(deepParams),
    "9,13,23,29,37,41,47,60,-1,-1",
  );
  const sub: u8[] = httpFieldBytes("xxGET /v1/orgs/a/projects/b/builds/c/logs/!yy");
  const subRoute: i32 = deep.match(sub, toI32(2), toI32(5), sub, toI32(6), toI32(sub.length) - toI32(2), deepParams);
  t.ok("ranges inside a larger buffer give offsets into it", subRoute === 0 && deepParams[0] === 15 && deepParams[1] === 16 && deepParams[6] === 42 && deepParams[7] === 43);

  // --- refusals -----------------------------------------------------------------------
  const x = new Router(new RouterLimits());
  x.add("GET", "/a/:id");
  const before: i32 = x.nodeCount();
  t.eqI32("the same pattern twice is a duplicate", x.add("GET", "/a/:id"), ROUTER_DUPLICATE);
  t.eqI32("and so is the same shape under another parameter name", x.add("GET", "/a/:name"), ROUTER_DUPLICATE);
  t.eqI32("but another method may share it, under any name", x.add("PUT", "/a/:name"), toI32(1));
  t.eqStr("and is answered by position", answer(x, "PUT", "/a/9"), "1 [9]");
  t.eqStr("a parameter is never empty", answer(x, "PUT", "/a/"), `${ROUTER_NOT_FOUND}`);
  t.eqI32("* in the middle is ambiguous", x.add("GET", "/a/*/b"), ROUTER_AMBIGUOUS);
  t.eqI32("so is * then a trailing slash", x.add("GET", "/b/*/"), ROUTER_AMBIGUOUS);
  t.eqI32("an empty pattern is malformed", x.add("GET", ""), ROUTER_BAD_PATTERN);
  t.eqI32("so is one not starting with /", x.add("GET", "a/b"), ROUTER_BAD_PATTERN);
  t.eqI32("and * spelled without the slash", x.add("OPTIONS", "*"), ROUTER_BAD_PATTERN);
  t.eqI32("a : with no name", x.add("GET", "/a/:"), ROUTER_BAD_PATTERN);
  t.eqI32("a name with a byte outside [A-Za-z0-9_]", x.add("GET", "/a/:a-b"), ROUTER_BAD_PATTERN);
  t.eqI32("a * inside a segment", x.add("GET", "/a/b*"), ROUTER_BAD_PATTERN);
  t.eqI32("a parameter name twice in one pattern", x.add("GET", "/c/:id/:id"), ROUTER_BAD_PATTERN);
  t.eqI32("a %, which would make a literal that bytes never match", x.add("GET", "/a%2Fb"), ROUTER_BAD_PATTERN);
  t.eqI32("a ?", x.add("GET", "/a?b"), ROUTER_BAD_PATTERN);
  t.eqI32("a space", x.add("GET", "/a b"), ROUTER_BAD_PATTERN);
  t.eqI32("a control byte", x.add("GET", "/a\tb"), ROUTER_BAD_PATTERN);
  t.eqI32("a byte past ~", x.add("GET", "/café"), ROUTER_BAD_PATTERN);
  t.eqI32("an empty method", x.add("", "/m"), ROUTER_BAD_METHOD);
  t.eqI32("a method with a space", x.add("G T", "/m"), ROUTER_BAD_METHOD);
  t.eqI32("a method of 33 bytes", x.add("ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFG", "/m"), ROUTER_BAD_METHOD);
  t.ok("a method of 32 token bytes is taken", x.add("ABCDEFGHIJKLMNOPQRSTUVWXYZ-!#$%&", "/m") >= 0);
  t.eqI32("none of the refusals added a node", x.nodeCount(), before + 1);
  t.eqStr("a literal holding : is a literal", `${x.add("GET", "/a:b")} ${answer(x, "GET", "/a:b")}`, "3 3");

  const small = new RouterLimits();
  small.maxPatternBytes = 16;
  small.maxSegments = 4;
  small.maxParams = 2;
  small.maxRoutes = 3;
  small.maxMethods = 2;
  const s = new Router(small);
  t.eqI32("a pattern over maxPatternBytes is too long", s.add("GET", "/aaaaaaaaaaaaaaaa"), ROUTER_TOO_LONG);
  t.ok("one of exactly maxPatternBytes is not", s.add("GET", "/aaaaaaaaaaaaaaa") === 0);
  t.eqI32("more segments than maxSegments", s.add("GET", "/a/b/c/d/e"), ROUTER_TOO_LONG);
  t.eqI32("more parameters than maxParams, a final * counted", s.add("GET", "/:a/:b/*"), ROUTER_TOO_LONG);
  t.ok("maxSegments and maxParams themselves are taken", s.add("GET", "/:a/:b/c/d") === 1);
  t.ok("a second method is within maxMethods", s.add("POST", "/x") === 2);
  t.eqI32("a third is past it", s.add("PUT", "/x"), ROUTER_FULL);
  t.eqI32("a fourth route is past maxRoutes", s.add("GET", "/y"), ROUTER_FULL);
  t.eqI32("a duplicate is still named a duplicate when the table is full", s.add("GET", "/:p/:q/c/d"), ROUTER_DUPLICATE);
  t.eqI32("the method is checked before the pattern", s.add("", "/aaaaaaaaaaaaaaaaaaaa"), ROUTER_BAD_METHOD);

  // --- targets a router does not route -------------------------------------------------
  t.eqStr("OPTIONS * is not routed", answer(r, "OPTIONS", "*"), `${ROUTER_NOT_FOUND}`);
  t.eqStr("nor CONNECT's authority form", answer(r, "CONNECT", "example.com:443"), `${ROUTER_NOT_FOUND}`);
  t.eqStr("nor the absolute form", answer(r, "GET", "http://example.com/users"), `${ROUTER_NOT_FOUND}`);
  t.eqStr("nor an empty target", answer(r, "GET", ""), `${ROUTER_NOT_FOUND}`);
  t.eqStr("a bare ? is not rooted either", answer(r, "GET", "?/users"), `${ROUTER_NOT_FOUND}`);

  // --- bounds ----------------------------------------------------------------------------
  // Two routes sharing a long prefix through different branches: the target
  // walks the literal branch to its end, fails, and walks the parameter
  // branch again. Each node is still visited once.
  const back = new Router(new RouterLimits());
  back.add("GET", "/a/b/c/d/e/f/x");
  back.add("GET", "/:p/b/c/d/e/f/y");
  back.add("GET", "/:p/:q/c/d/e/f/z");
  t.eqStr("a target that backtracks twice still matches", answer(back, "GET", "/a/b/c/d/e/f/z"), "2 [a] [b]");
  t.ok(`and visits no node twice (${back.lastVisited()} of ${back.nodeCount()})`, back.lastVisited() <= back.nodeCount());
  t.eqStr("one that fails everywhere", answer(back, "GET", "/a/b/c/d/e/f/q"), `${ROUTER_NOT_FOUND}`);
  t.ok(`visits at most every node (${back.lastVisited()} of ${back.nodeCount()})`, back.lastVisited() <= back.nodeCount());

  // A path far deeper than the table: split no further than one past the deepest route.
  const longPath: string[] = [];
  for (let k: i32 = 0; k < 5000; k++) {
    longPath.push("/a");
  }
  t.eqStr("a path of 5000 segments against a table 7 deep is 404", answer(back, "GET", longPath.join("")), `${ROUTER_NOT_FOUND}`);
  t.ok(`after visiting no more than the table (${back.lastVisited()})`, back.lastVisited() <= back.nodeCount());
  t.eqI32("and one of 5000 under a * is taken whole: 5 [a/a/.../a]", toI32(answer(r, "GET", `/static${longPath.join("")}`).length), toI32(3 + 9999 + 1));

  const tight: i32[] = [7, 7, 7];
  const tm: u8[] = httpFieldBytes("GET");
  const tt: u8[] = httpFieldBytes("/v1/orgs/a/projects/b/builds/c/logs/d");
  t.eqI32("a match with more pairs than params holds is refused", deep.match(tm, toI32(0), toI32(3), tt, toI32(0), toI32(tt.length), tight), ROUTER_TOO_MANY_PARAMS);
  t.ok("and params is left as it was", tight[0] === 7 && tight[1] === 7 && tight[2] === 7);
  const none: i32[] = [];
  const noParams: u8[] = httpFieldBytes("/users");
  t.eqI32("a route with no parameters needs no room", r.match(tm, toI32(0), toI32(3), noParams, toI32(0), toI32(noParams.length), none), users);

  // A warmed match allocates nothing, hit, miss or 405.
  const hot: i32[] = new Array<i32>(8);
  const hits: u8[] = httpFieldBytes("/v1/orgs/acme/projects/rocket/builds/1234/logs/a/b");
  const miss: u8[] = httpFieldBytes("/v1/orgs/acme/nope");
  const post405: u8[] = httpFieldBytes("POST");
  let sum: i32 = 0;
  const arenaBefore: i64 = Arena.used();
  for (let k: i32 = 0; k < 1000; k++) {
    sum += deep.match(tm, toI32(0), toI32(3), hits, toI32(0), toI32(hits.length), hot);
    sum += deep.match(tm, toI32(0), toI32(3), miss, toI32(0), toI32(miss.length), hot);
    sum += deep.match(post405, toI32(0), toI32(4), hits, toI32(0), toI32(hits.length), hot);
  }
  const moved: i64 = Arena.used() - arenaBefore;
  t.ok(`3000 matches move the arena by nothing (${moved} bytes)`, moved === toI64(0));
  t.eqI32("and answer what one does", sum, toI32(1000) * (ROUTER_NOT_FOUND + ROUTER_METHOD_NOT_ALLOWED));

  // --- carriers ----------------------------------------------------------------------------
  const p: Http1Parser = new Http1Parser(8192, 16384, 64, 0);
  const wire: u8[] = httpFieldBytes("GET /users/42?x=1 HTTP/1.1\r\nhost: a\r\n\r\n");
  p.feed(wire, toI32(0), toI32(wire.length));
  t.eqI32("an HTTP/1 request line parses", p.next(), HTTP1_HEAD);
  const viaHead: i32[] = [0, 0];
  const h1: i32 = r.match(p.head, p.methodStart, p.methodEnd, p.head, p.targetStart, p.targetEnd, viaHead);
  t.eqStr("and routes from the parser's head, in place", `${h1} ${textOf(p.head, viaHead[0], viaHead[1])}`, `${user} 42`);
  const fields = new HttpFields();
  const names: u8[][] = [httpFieldBytes(":method"), httpFieldBytes(":scheme"), httpFieldBytes(":path"), httpFieldBytes(":authority")];
  const values: u8[][] = [httpFieldBytes("POST"), httpFieldBytes("https"), httpFieldBytes("/users/42?x=1"), httpFieldBytes("a")];
  t.eqI32("an HTTP/2 field section reads", fields.readRequest(names, values, false), HTTP_FIELDS_OK);
  const viaPath: i32[] = [0, 0];
  const h2: i32 = r.match(fields.method, toI32(0), toI32(fields.method.length), fields.path, toI32(0), toI32(fields.path.length), viaPath);
  t.eqStr("and the same table routes its :method and :path", `${h2} ${textOf(fields.path, viaPath[0], viaPath[1])}`, `${post} 42`);

  // --- decoding ------------------------------------------------------------------------------
  t.eqStr("plain bytes decode to themselves", decoded("abc", 3), "abc");
  t.eqStr("%2F decodes to / inside the parameter", decoded("a%2Fb", 8), "a/b");
  t.eqStr("either case of hex", decoded("%7e%7E%41", 3), "~~A");
  t.eqStr("+ stays +", decoded("a+b", 8), "a+b");
  t.eqStr("an empty range decodes to nothing", decoded("", 0), "");
  t.eqStr("a % at the end is refused", decoded("ab%", 8), `${ROUTER_BAD_ESCAPE}`);
  t.eqStr("a % with one digit", decoded("ab%4", 8), `${ROUTER_BAD_ESCAPE}`);
  t.eqStr("a % with a non-hex digit", decoded("%G1", 8), `${ROUTER_BAD_ESCAPE}`);
  t.eqStr("a % with a non-hex second digit", decoded("%1G", 8), `${ROUTER_BAD_ESCAPE}`);
  t.eqStr("a decoded length past out", decoded("abcd", 3), `${ROUTER_NO_ROOM}`);
  t.eqStr("an exact fit is not", decoded("a%20b", 3), "a b");
  const zeros: u8[] = [9, 9, 9, 9];
  const esc: u8[] = httpFieldBytes("%00%2F%zz");
  t.eqI32("a malformed escape late in the range", routerDecode(esc, 0, toI32(esc.length), zeros), ROUTER_BAD_ESCAPE);
  t.ok("writes nothing", zeros[0] === 9 && zeros[1] === 9);
  t.eqI32("a NUL decodes like any byte", routerDecode(esc, toI32(0), toI32(6), zeros), toI32(2));
  t.ok("into out from 0", zeros[0] === 0 && zeros[1] === 47 && zeros[2] === 9);
  const mid: u8[] = httpFieldBytes("/f/%41%42/x");
  t.eqI32("a range inside a target decodes only that range", routerDecode(mid, toI32(3), toI32(9), zeros), toI32(2));
  t.ok("to the bytes of that range", zeros[0] === 65 && zeros[1] === 66);
  return t.done();
};
