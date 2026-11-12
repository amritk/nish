// `nish/net/router`'s exact-path table against its tree. `Router.match` reads
// the table first and `Router.matchTree` never does, so every lookup here is
// made both ways and must agree in all a caller can read: the route or the
// code, `pathEnd`, and each slot of `params`. The tree is the definition; the
// table is right when no target can tell the two apart.
//
// - **A mixed table**: static routes beside the parameter and `*` routes that
//   overlap them, under several methods, asked for every pattern and for each
//   one's near misses (a query, a trailing slash, a byte more or less, another
//   case, an escape), inside a request line and at the very end of a buffer.
// - **Growth**: 300 static routes, each answered by its own index.
// - **Neighbours**: two methods of one path, and a path and its prefix, filed
//   in one probe run.
// - **One home slot**: nine routes the table would file at one slot, where it
//   keeps eight and leaves the ninth to the tree.
import { httpFieldBytes } from "nish/net/http-fields";
import { ROUTER_METHOD_NOT_ALLOWED, ROUTER_NOT_FOUND, ROUTER_TOO_MANY_PARAMS, Router, RouterLimits } from "nish/net/router";
import { Suite } from "nish/testing";

/** What a slot of `params` holds before a lookup, so that a write shows. */
const UNTOUCHED: i32 = -7;

/** `match`'s answer for `method target`, or -100 when `matchTree` answers anything else, in route, `pathEnd` or `params`. */
const both = (router: Router, method: string, target: string, room: i32, framed: boolean): i32 => {
  // Framed, the two are where a request line has them, with bytes on each
  // side; unframed, the target ends where its buffer does.
  const line: u8[] = httpFieldBytes(framed ? `${method} ${target} HTTP/1.1` : `${method}${target}`);
  const mEnd: i32 = toI32(method.length);
  const tStart: i32 = framed ? mEnd + 1 : mEnd;
  const tEnd: i32 = tStart + toI32(target.length);
  const viaTable: i32[] = new Array<i32>(room);
  const viaTree: i32[] = new Array<i32>(room);
  for (let k: i32 = 0; k < room; k++) {
    viaTable[k] = UNTOUCHED;
    viaTree[k] = UNTOUCHED;
  }
  const tree: i32 = router.matchTree(line, toI32(0), mEnd, line, tStart, tEnd, viaTree);
  const treeEnd: i32 = router.pathEnd;
  const table: i32 = router.match(line, toI32(0), mEnd, line, tStart, tEnd, viaTable);
  if (table !== tree || router.pathEnd !== treeEnd) {
    return toI32(-100);
  }
  for (let k: i32 = 0; k < room; k++) {
    if (viaTable[k] !== viaTree[k]) {
      return toI32(-100);
    }
  }
  return table;
};

/** `text` with its last letter in the other case, or `text` when it has none. */
const otherCase = (text: string): string => {
  for (let k: i32 = toI32(text.length) - 1; k >= 0; k--) {
    const c: i32 = toI32(text.charCodeAt(k));
    if (c >= 97 && c <= 122) {
      return `${text.slice(0, k)}${String.fromCharCode(c - 32)}${text.slice(k + 1)}`;
    }
    if (c >= 65 && c <= 90) {
      return `${text.slice(0, k)}${String.fromCharCode(c + 32)}${text.slice(k + 1)}`;
    }
  }
  return text;
};

/** The targets near `path`: itself, and each way a client might nearly spell it. */
const near = (path: string): string[] => {
  const n: i32 = toI32(path.length);
  const cut: i32 = n > 0 ? n - 1 : toI32(0);
  return [
    path,
    `${path}?`,
    `${path}?a=b/c`,
    `${path}/`,
    `${path}x`,
    `${path}%20`,
    `/${path}`,
    path.slice(0, cut),
    otherCase(path),
    // The last byte spelled as an escape of `a`: never the path, whatever it ends in.
    `${path.slice(0, cut)}%61`,
  ];
};

/**
 * The slot of `slots` the table files `path` at under the method of index
 * `method`: `routerHashOf`, `routerHashWith` and `routerSlot` of
 * `std/net/router.ts`, spelled again. Only "neighbours" and "one home slot" below read it, to
 * pick paths that collide; when the hash changes, that check fails and
 * this moves with it.
 */
const homeOf = (method: i32, path: string, slots: i32): i32 => {
  const prime: u32 = 16777619;
  const spread: u32 = 2654435769;
  let hash: u32 = toU32(method + 1);
  for (let k: i32 = 0; k < toI32(path.length); k++) {
    hash = (hash ^ toU32(path.charCodeAt(k))) * prime;
  }
  const mixed: u32 = hash * spread;
  return toI32((mixed ^ (mixed >>> 15)) & toU32(slots - 1));
};

/** The exact-path table's checks, into `t`. */
export const exactChecks = (t: Suite): void => {
  // --- a mixed table ----------------------------------------------------------------
  const r = new Router(new RouterLimits());
  const patterns: string[] = [
    "/",
    "/plaintext",
    "/json",
    "/users/me",
    "/users/:id",
    "/users/:id/posts",
    "/users/me/posts",
    "/a",
    "/a/",
    "/a//b",
    "/static/*",
    "/static/app.js",
    "/files/:name/raw",
    "/files/index/raw",
    "/v1/:a/:b/:c",
    "/v1/x/y/z",
  ];
  let statics: i32 = 0;
  for (const pattern of patterns) {
    r.add("GET", pattern);
    if (pattern.indexOf(":") < 0 && pattern.indexOf("*") < 0) {
      statics += 1;
    }
  }
  r.add("POST", "/json");
  r.add("POST", "/users");
  r.add("PUT", "/users/:id");
  r.add("DELETE", "/users/me");
  statics += 3;
  t.eqI32("every route with no parameter is in the exact-path table", r.staticCount(), statics);

  const targets: string[] = [];
  for (const pattern of patterns) {
    targets.push(pattern);
  }
  for (const extra of [
    "/users",
    "/users/42",
    "/users/42/posts",
    "/users/me/posts/1",
    "/static/",
    "/static/x/y",
    "/files/a%2Fb/raw",
    "/v1/x/y/q",
    "/%6Ason",
    "//",
    "*",
    "",
    "?",
    "http://h/json",
  ]) {
    targets.push(extra);
  }
  const methods: string[] = ["GET", "POST", "PUT", "DELETE", "PATCH", "get", ""];
  let lookups: i32 = 0;
  let apart: i32 = 0;
  let routed: i32 = 0;
  let refused: i32 = 0;
  for (const target of targets) {
    for (const spelled of near(target)) {
      for (const method of methods) {
        for (let room: i32 = 0; room <= 6; room += 2) {
          const framed: i32 = both(r, method, spelled, room, true);
          const bare: i32 = both(r, method, spelled, room, false);
          lookups += 2;
          if (framed === -100 || bare === -100 || framed !== bare) {
            apart += 1;
          } else if (framed >= 0) {
            routed += 1;
          } else if (framed === ROUTER_TOO_MANY_PARAMS) {
            refused += 1;
          }
        }
      }
    }
  }
  t.eqI32(`${lookups} lookups answer alike from the table and from the tree`, apart, toI32(0));
  t.ok(`some of them reach a route (${routed})`, routed > 0);
  t.ok(`and some are refused for too little params (${refused})`, refused > 0);

  // The answers themselves, where the table and a parameter route overlap.
  t.eqI32("a static route wins over the parameter beside it", both(r, "GET", "/users/me", 6, true), toI32(3));
  t.eqI32("and is answered without entering the tree", r.lastVisited(), toI32(0));
  t.eqI32("the parameter route answers every other segment", both(r, "GET", "/users/42", 6, true), toI32(4));
  t.ok("from the tree", r.lastVisited() > 0);
  t.eqI32("a static route below a parameter's sibling", both(r, "GET", "/users/me/posts", 6, true), toI32(6));
  t.eqI32("a static route beside a *", both(r, "GET", "/static/app.js", 6, true), toI32(11));
  t.eqI32("a static route of four literals beside four parameters", both(r, "GET", "/v1/x/y/z", 6, true), toI32(15));
  t.eqI32("the same path under another method is its own route", both(r, "POST", "/json", 6, true), toI32(16));
  t.eqI32("a static path under a method with no route there is 405", both(r, "PUT", "/json", 6, true), ROUTER_METHOD_NOT_ALLOWED);
  t.eqI32("and under a method the table has never seen", both(r, "PATCH", "/json", 6, true), ROUTER_METHOD_NOT_ALLOWED);
  t.eqI32("a static route with a query", both(r, "GET", "/json?pretty=1", 6, true), toI32(2));
  t.eqI32("with its path ending at the ?", r.pathEnd, toI32(9));
  t.eqI32("a static route needs no params", both(r, "GET", "/plaintext", 0, false), toI32(1));
  t.eqI32("a trailing slash is not the static route", both(r, "GET", "/json/", 6, true), ROUTER_NOT_FOUND);
  t.eqI32("unless it is one", both(r, "GET", "/a/", 6, true), toI32(8));
  t.eqI32("another case is not the static route", both(r, "GET", "/JSON", 6, true), ROUTER_NOT_FOUND);
  t.eqI32("nor is an escape of it", both(r, "GET", "/%6Ason", 6, true), ROUTER_NOT_FOUND);

  // A hit in the table allocates nothing, as one in the tree does not.
  const get: u8[] = httpFieldBytes("GET");
  const plain: u8[] = httpFieldBytes("/plaintext");
  const unused: i32[] = [];
  let hitSum: i32 = 0;
  const arenaBefore: i64 = Arena.used();
  for (let k: i32 = 0; k < 1000; k++) {
    hitSum += r.match(get, toI32(0), toI32(3), plain, toI32(0), toI32(plain.length), unused);
  }
  const moved: i64 = Arena.used() - arenaBefore;
  t.ok(`1000 matches from the table move the arena by nothing (${moved} bytes)`, moved === toI64(0) && hitSum === 1000);
  t.eqI32("the root is a static route", both(r, "GET", "/", 0, true), toI32(0));
  t.eqI32(
    "a parameter route still refuses too little params",
    both(r, "GET", "/v1/p/q/r", 4, true),
    ROUTER_TOO_MANY_PARAMS,
  );

  // --- growth -----------------------------------------------------------------------
  const big = new Router(new RouterLimits());
  big.add("GET", "/r/:id/x");
  let own: i32 = 0;
  for (let k: i32 = 0; k < 300; k++) {
    const path: string = `/r/${k}`;
    const method: string = k % 3 === 0 ? "POST" : "GET";
    const route: i32 = big.add(method, path);
    // Asked at once, while the table is every size it grows through.
    if (route === k + 1 && both(big, method, path, 2, true) === route && big.lastVisited() === 0) {
      own += 1;
    }
  }
  t.eqI32("300 static routes each answer their own index as they are added", own, toI32(300));
  t.eqI32("and all 300 are in the table", big.staticCount(), toI32(300));
  own = 0;
  for (let k: i32 = 0; k < 300; k++) {
    if (both(big, k % 3 === 0 ? "POST" : "GET", `/r/${k}?q`, 2, false) === k + 1) {
      own += 1;
    }
  }
  t.eqI32("and again once it has grown", own, toI32(300));
  t.eqI32("a parameter route among them", both(big, "GET", "/r/7/x", 2, true), toI32(0));
  t.eqI32("a path one past the last of them is 404", both(big, "GET", "/r/300", 2, true), ROUTER_NOT_FOUND);

  // --- neighbours in one probe run ---------------------------------------------------
  // Two routes take 8 slots. A path that GET and POST file at one slot makes
  // each the other's neighbour, as does a path filed where its own prefix is:
  // only the method and the length tell them apart before the bytes are read.
  let shared: string = "";
  let longer: string = "";
  for (let k: i32 = 0; k < 10000 && (shared === "" || longer === ""); k++) {
    if (shared === "" && homeOf(0, `/m/${k}`, 8) === homeOf(1, `/m/${k}`, 8)) {
      shared = `/m/${k}`;
    }
    if (longer === "" && homeOf(0, `/p/${k}`, 8) === homeOf(0, `/p/${k}0`, 8)) {
      longer = `/p/${k}0`;
    }
  }
  t.ok("a path two methods file at one slot, and one filed where its prefix is", shared !== "" && longer !== "");
  const two = new Router(new RouterLimits());
  two.add("GET", shared);
  two.add("POST", shared);
  t.eqI32("the first method's route", both(two, "GET", shared, 0, true), toI32(0));
  t.eqI32("and the second's, one slot on", both(two, "POST", shared, 0, true), toI32(1));
  t.eqI32("both from the table", two.staticCount(), toI32(2));
  const pre = new Router(new RouterLimits());
  pre.add("GET", longer);
  pre.add("GET", longer.slice(0, toI32(longer.length) - 1));
  t.eqI32("a path is not the longer one filed before it", both(pre, "GET", longer.slice(0, toI32(longer.length) - 1), 0, true), toI32(1));
  t.eqI32("nor the longer one it", both(pre, "GET", longer, 0, true), toI32(0));

  // --- one home slot ----------------------------------------------------------------
  // Nine static routes take the table to 64 slots. These nine share slot 60
  // of 64, so the eight probes from it wrap past the end, and they do not all
  // share a slot of 128, so growing the table spreads them.
  const crowd: string[] = [];
  let spread: boolean = false;
  for (let k: i32 = 0; crowd.length < 9 && k < 100000; k++) {
    const path: string = `/c/${k}`;
    if (homeOf(0, path, 64) === 60) {
      const last: boolean = crowd.length === 8;
      if (!last || spread || homeOf(0, path, 128) !== homeOf(0, crowd[0], 128)) {
        spread = spread || (crowd.length > 0 && homeOf(0, path, 128) !== homeOf(0, crowd[0], 128));
        crowd.push(path);
      }
    }
  }
  t.eqI32("nine paths of one home slot", toI32(crowd.length), toI32(9));
  const c = new Router(new RouterLimits());
  for (const path of crowd) {
    c.add("GET", path);
  }
  t.eqI32("eight are filed and the ninth is left to the tree", c.staticCount(), toI32(8));
  own = 0;
  let viaTree: i32 = 0;
  for (let k: i32 = 0; k < 9; k++) {
    if (both(c, "GET", crowd[k], 0, true) === k) {
      own += 1;
    }
    if (c.lastVisited() > 0) {
      viaTree += 1;
    }
  }
  t.eqI32("all nine answer their own index", own, toI32(9));
  t.eqI32("one of them from the tree", viaTree, toI32(1));
  // A path nobody registered whose home is the full run: the lookup reads its
  // eight slots, finds none of them is this path, and the tree answers as it
  // would have alone, visiting no more than every node once.
  let stranger: string = "";
  for (let k: i32 = 0; stranger.length === 0 && k < 100000; k++) {
    const path: string = `/c/${k}`;
    let filed: boolean = false;
    for (const taken of crowd) {
      filed = filed || taken === path;
    }
    if (homeOf(0, path, 64) === 60 && !filed) {
      stranger = path;
    }
  }
  t.ok("an unregistered path whose home is that full run", stranger.length > 0);
  t.eqI32("is 404, as the tree alone answers it", both(c, "GET", stranger, 0, true), ROUTER_NOT_FOUND);
  t.ok("and the tree visits no more than its nodes for it", c.lastVisited() > 0 && c.lastVisited() <= c.nodeCount());
  t.eqI32("a path of another slot is 404", both(c, "GET", "/c/none", 0, true), ROUTER_NOT_FOUND);

  // --- the longest static route ---------------------------------------------------
  // A target longer than every static route, query included, is not hashed:
  // the tree answers it. One that fits is answered from the table.
  const lg = new Router(new RouterLimits());
  lg.add("GET", "/ab");
  lg.add("GET", "/abcdef");
  t.eqI32("a static route with a query that fits the longest", both(lg, "GET", "/ab?x=1", 0, true), toI32(0));
  t.eqI32("is answered from the table", lg.lastVisited(), toI32(0));
  t.eqI32("the same route with a query past the longest", both(lg, "GET", "/ab?x=12", 0, true), toI32(0));
  t.ok("is answered by the tree", lg.lastVisited() > 0);
  for (let k: i32 = 0; k < 8; k++) {
    c.add("GET", `/d/${k}`);
  }
  t.ok(`a table grown past them files the ninth (${c.staticCount()} of 17)`, c.staticCount() > 8);
  own = 0;
  for (let k: i32 = 0; k < 9; k++) {
    if (both(c, "GET", crowd[k], 0, true) === k) {
      own += 1;
    }
  }
  t.eqI32("and all nine still answer their own index", own, toI32(9));
};
