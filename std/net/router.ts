/**
 * `nish/net/router` — a method and path router for HTTP servers, independent
 * of the carrier: the same table answers an HTTP/1 request line and an
 * HTTP/2 or HTTP/3 `:path`.
 *
 *     const HOME: i32 = 0   // module constants, in the order the routes are added
 *     const USER: i32 = 1
 *     const router = new Router(new RouterLimits())
 *     if (router.add("GET", "/") !== HOME || router.add("GET", "/users/:id") !== USER) panic(...)
 *     // per request, with `params` made once beside the connection:
 *     switch (router.match(p.head, p.methodStart, p.methodEnd, p.head, p.targetStart, p.targetEnd, params)) {
 *       case HOME: ... case USER: ... case ROUTER_NOT_FOUND: ...
 *     }
 *
 * Nish has no function values, so a route is the index `add` answered, 0 for
 * the first and one more for each after, and the program dispatches on it
 * with `switch`, whose labels are module constants. A parameter is answered as a
 * `[start, end)` pair of offsets into the target, never as a copy, and
 * `routerDecode` percent-decodes one of them into a buffer the caller owns.
 *
 * **The table is built once; a match allocates nothing.** `add` refuses a
 * duplicate, an ambiguous or an over-long pattern with a negative code and
 * adds nothing. `match` walks flat `i32` arrays the table grew and writes into
 * scratch the constructor sized, so a warmed server moves the arena by
 * nothing per request. A `Router` is therefore not reentrant: one match at a
 * time, which is what a connection loop does.
 *
 * **A route with no parameter and no `*` is answered without the tree.** `add`
 * also files such a route under a hash of its method and path, in one more
 * flat array, and `match` looks there first: one pass over the path, at most
 * `ROUTER_PROBES` slots, and a byte comparison when a slot's hash agrees. The
 * tree stays the definition: a literal is tried first at every segment, so
 * the route the exact table holds for a method and a path is the one the tree
 * would have reached, and anything the table does not hold falls through to
 * the tree unchanged. `matchTree` is the tree alone, for a test of exactly that.
 *
 * **The rules** (`docs/wp43-http-app-layer.md` §2):
 *
 * - The path is the target up to its first `?` (the query is left alone) and
 *   must start with `/`: the `*` of `OPTIONS *` and the authority form of
 *   `CONNECT` match nothing, so the program answers them before it routes.
 * - A path is split on `/` into segments; `/a/` has two, `a` and an empty one.
 *   A trailing slash is significant, and matching is on raw bytes, so `%2F`
 *   never splits a segment.
 * - A pattern segment is a literal, a parameter `:name` (one non-empty
 *   segment), or `*` as the last segment (the rest of the path, possibly
 *   empty, as one more pair). Precedence is literal, then parameter, then
 *   wildcard, segment by segment from the left; a branch that fails further
 *   down falls back to the next one. Every edge consumes one segment, so a
 *   lookup visits each node of the table at most once.
 * - A path that matches only routes of other methods answers
 *   `ROUTER_METHOD_NOT_ALLOWED`, so a server can tell 405 from 404.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 */

/** `add`: the pattern is empty, does not start with `/`, or misuses `:`, `*`, `%`, `?` or a byte outside `!` to `~`. */
export const ROUTER_BAD_PATTERN: i32 = -1
/** `add`: the method is not a token of 1 to 32 bytes. */
export const ROUTER_BAD_METHOD: i32 = -2
/** `add`: the pattern is over `RouterLimits`' bytes, segments or parameters. */
export const ROUTER_TOO_LONG: i32 = -3
/** `add`: a `*` that is not the last segment, where how much it takes would be a guess. */
export const ROUTER_AMBIGUOUS: i32 = -4
/** `add`: the method already has a route of this shape, whatever its parameters are called. */
export const ROUTER_DUPLICATE: i32 = -5
/** `add`: the table holds `RouterLimits.maxRoutes` routes or `maxMethods` methods already. */
export const ROUTER_FULL: i32 = -6
/** `match`: no route's pattern matches the path, or the target is not `/`-rooted. */
export const ROUTER_NOT_FOUND: i32 = -7
/** `match`: the path matches only routes of other methods. */
export const ROUTER_METHOD_NOT_ALLOWED: i32 = -8
/** `match`: the route matched, but its parameters need more than `params` holds; nothing was written. */
export const ROUTER_TOO_MANY_PARAMS: i32 = -9
/** `routerDecode`: a `%` not followed by two hex digits. */
export const ROUTER_BAD_ESCAPE: i32 = -10
/** `routerDecode`: the decoded bytes do not fit `out`; nothing was written. */
export const ROUTER_NO_ROOM: i32 = -11

/** The longest method `add` takes, as `nish/net/http1-codec`'s `HTTP1_MAX_METHOD`. */
const ROUTER_MAX_METHOD: i32 = 32
/** No node or route: an `i32` spelled once, so that `--number-mode f64` does not read a bare `-1` as a double. */
const ROUTER_NONE: i32 = -1
/**
 * The most slots a lookup in the exact-path table reads, and so the furthest
 * from its home slot `add` will file a route. A static route with no free slot
 * that near is left to the tree, which answers it as it always did.
 */
const ROUTER_PROBES: i32 = 8
/** A pattern segment's kind, in `Router.add`'s scratch. */
const ROUTER_LITERAL: i32 = 0
const ROUTER_PARAM: i32 = 1
const ROUTER_WILD: i32 = 2

/**
 * What a `Router` holds and refuses past. Each field has a default a server
 * can use as it is; the constructor panics on a value no table could work with.
 */
export class RouterLimits {
  /** The longest pattern, in bytes (1 to 65536). */
  maxPatternBytes: i32 = 1024
  /** The most segments in one pattern (1 to 256): the deepest a route can be. */
  maxSegments: i32 = 32
  /** The most parameters in one pattern, a final `*` counted (0 to 256). */
  maxParams: i32 = 16
  /** The most routes in the table (1 to 1048576). */
  maxRoutes: i32 = 4096
  /** The most distinct methods (1 to 64). */
  maxMethods: i32 = 16
}

/**
 * A route table: a tree whose edges are path segments, kept in flat arrays.
 * Node 0 is the root, the point before the first segment; a node at depth `d`
 * has consumed `d` segments.
 */
export class Router {
  // References, then 32-bit fields: the order the layout packs without padding.
  /** Per node: its first literal child, or -1; siblings chain through `nextSibling`. */
  private firstChild: i32[]
  /** Per node: the next literal child of its parent, or -1. */
  private nextSibling: i32[]
  /** Per node: its literal label, `labels[labelStart .. labelEnd)`; empty for a parameter or `*` node. */
  private labelStart: i32[]
  private labelEnd: i32[]
  /** Per node: its parameter child, or -1; one per node, since names take no part in matching. */
  private paramChild: i32[]
  /** Per node: its `*` child, or -1. */
  private wildChild: i32[]
  /** Per node: the first route ending there, or -1; routes chain through `endpointNext`. */
  private firstEndpoint: i32[]
  /** Every literal label, back to back. */
  private labels: u8[]
  /** Per route: its method's index into `methodStart`, the next route ending at its node, and its parameter pairs. */
  private routeMethod: i32[]
  private endpointNext: i32[]
  private routeParams: i32[]
  /**
   * The exact-path table: per slot a static route, or -1. Its length is a
   * power of two, at least four slots for each static route, and a route sits
   * within `ROUTER_PROBES` slots of the one its hash names.
   */
  private staticSlots: i32[]
  /** Per route: the hash of its method and path, and its path `staticPaths[routePathStart .. routePathEnd)`; zeros unless it is static. */
  private routeHash: u32[]
  private routePathStart: i32[]
  private routePathEnd: i32[]
  /** Every static route's path, back to back. */
  private staticPaths: u8[]
  /**
   * The methods the table knows, `methodBytes[methodStart[m] .. methodEnd[m])`, compared exactly (RFC 9110 §9.1).
   * @internal Read by std/net/handler.ts, which matches a path against each known method to build a 405's `Allow` value.
   */
  methodBytes: u8[]
  /**
   * Where method `m`'s bytes start in `methodBytes`.
   * @internal Read by std/net/handler.ts to match a path under each known method for `Allow`, and under GET for a HEAD.
   */
  methodStart: i32[]
  /**
   * Where method `m`'s bytes end in `methodBytes`.
   * @internal Read by std/net/handler.ts beside `methodStart`, for the same matches.
   */
  methodEnd: i32[]
  /** `match`'s scratch, sized by the constructor: each segment's span, then the pairs found so far. */
  private segStart: i32[]
  private segEnd: i32[]
  private found: i32[]
  /** `add`'s scratch: each pattern segment's kind and span in the pattern. */
  private patKind: i32[]
  private patStart: i32[]
  private patEnd: i32[]
  /** The limits, copied out of the `RouterLimits` the table was made with. */
  private maxPatternBytes: i32 = 0
  private maxSegments: i32 = 0
  /**
   * The most parameters one pattern may have, a final `*` counted.
   * @internal Read by std/net/handler.ts to size the scratch `params` array it hands `match`.
   */
  maxParams: i32 = 0
  private maxRoutes: i32 = 0
  private maxMethods: i32 = 0
  /** How many routes have no parameter and no `*`, and how many of them `staticSlots` holds. */
  private statics: i32 = 0
  private staticHeld: i32 = 0
  /** The most segments any route has: a path is split no further than one past it. */
  private deepest: i32 = 0
  /** During a match: how many segments the path has, the method's index, and the pairs in `found`. */
  private segments: i32 = 0
  /**
   * Where the last `match`'s path ends in its target: the first `?`, or the target's end.
   * @internal Read by std/net/handler.ts, so a request's path is not scanned twice.
   */
  pathEnd: i32 = 0
  private wanted: i32 = 0
  private foundCount: i32 = 0
  /** During a match: whether a route of another method ended at the path's end. */
  private otherMethod: boolean = false
  /** The nodes the last `match` visited: never more than `nodeCount()`, which the tests pin, and none when the exact-path table answered. */
  private visited: i32 = 0

  /**
   * An empty table. Panics, naming the field, on a limit outside the range `RouterLimits` gives it.
   * @param limits the caps, copied out here, so changing them later has no effect on this table
   */
  constructor(limits: RouterLimits) {
    routerLimit("maxPatternBytes", limits.maxPatternBytes, 1, 65536)
    routerLimit("maxSegments", limits.maxSegments, 1, 256)
    routerLimit("maxParams", limits.maxParams, 0, 256)
    routerLimit("maxRoutes", limits.maxRoutes, 1, 1048576)
    routerLimit("maxMethods", limits.maxMethods, 1, 64)
    this.maxPatternBytes = limits.maxPatternBytes
    this.maxSegments = limits.maxSegments
    this.maxParams = limits.maxParams
    this.maxRoutes = limits.maxRoutes
    this.maxMethods = limits.maxMethods
    this.firstChild = [-1]
    this.nextSibling = [-1]
    this.labelStart = [0]
    this.labelEnd = [0]
    this.paramChild = [-1]
    this.wildChild = [-1]
    this.firstEndpoint = [-1]
    this.labels = []
    this.routeMethod = []
    this.endpointNext = []
    this.routeParams = []
    this.staticSlots = [-1, -1, -1, -1, -1, -1, -1, -1]
    this.routeHash = []
    this.routePathStart = []
    this.routePathEnd = []
    this.staticPaths = []
    this.methodBytes = []
    this.methodStart = []
    this.methodEnd = []
    this.segStart = new Array<i32>(limits.maxSegments + 1)
    this.segEnd = new Array<i32>(limits.maxSegments + 1)
    this.found = new Array<i32>(2 * limits.maxParams)
    this.patKind = new Array<i32>(limits.maxSegments)
    this.patStart = new Array<i32>(limits.maxSegments)
    this.patEnd = new Array<i32>(limits.maxSegments)
  }

  /** How many routes the table holds; the next `add` answers this index. */
  private routes(): i32 {
    return toI32(this.routeMethod.length)
  }

  /**
   * How many nodes the tree has, the root included: the most one `match` visits.
   * @returns the node count, which grows only as `add` makes new segments
   */
  nodeCount(): i32 {
    return toI32(this.firstChild.length)
  }

  /**
   * How many `[start, end)` pairs `route` answers: its parameters, and one more for a final `*`.
   * @param route a route index `add` answered; panics on one the table does not hold
   * @returns how many pairs `match` writes to `params` for that route, so half the slots it needs
   */
  paramCount(route: i32): i32 {
    if (route < 0 || route >= this.routes()) {
      panic(`Router.paramCount: route ${route} is not in a table of ${this.routes()}`)
    }
    return this.routeParams[route]
  }

  /**
   * How many routes the exact-path table holds: the routes `match` answers
   * without the tree. Every route with no parameter and no `*` is one, but for
   * a route whose slots were all taken, which the tree answers instead.
   * @returns the count, never more than the routes that have no parameter and no `*`
   */
  staticCount(): i32 {
    return this.staticHeld
  }

  /**
   * How many nodes of the tree the last `match` visited.
   * @returns the visit count, never more than `nodeCount()`, and 0 when the exact-path table answered, which the tests use to pin a lookup's cost
   */
  lastVisited(): i32 {
    return this.visited
  }

  /**
   * Adds the route `method pattern` and answers its index, counting from 0, or
   * a negative `ROUTER_*` code; a refused pattern adds nothing. Whether a
   * pattern is refused never depends on the order routes were added in.
   * @param method the method the route answers, an HTTP token of 1 to 32 bytes such as `"GET"`
   * @param pattern the path pattern, starting with `/`, with `:name` parameters and an optional final `*`
   * @returns the new route's index, which `match` answers for it, or a negative `ROUTER_*` code
   */
  add(method: string, pattern: string): i32 {
    const methodLength: i32 = toI32(method.length)
    if (methodLength < 1 || methodLength > ROUTER_MAX_METHOD) {
      return ROUTER_BAD_METHOD
    }
    for (let k: i32 = 0; k < methodLength; k++) {
      if (!routerTchar(toI32(method.charCodeAt(k)))) {
        return ROUTER_BAD_METHOD
      }
    }
    const length: i32 = toI32(pattern.length)
    if (length > this.maxPatternBytes) {
      return ROUTER_TOO_LONG
    }
    if (length === 0 || toI32(pattern.charCodeAt(0)) !== 47) {
      return ROUTER_BAD_PATTERN
    }
    const count: i32 = this.splitPattern(pattern)
    if (count < 0) {
      return count
    }
    let params: i32 = 0
    for (let k: i32 = 0; k < count; k++) {
      if (this.patKind[k] !== ROUTER_LITERAL) {
        params += 1
      }
    }
    if (params > this.maxParams) {
      return ROUTER_TOO_LONG
    }
    // The walk that finds where the pattern ends, adding nothing yet: a
    // duplicate is a pattern whose every node already exists.
    let node: i32 = 0
    let depth: i32 = 0
    while (depth < count && node >= 0) {
      node = this.childFor(node, pattern, depth)
      depth += 1
    }
    const known: i32 = this.methodIndex(method)
    if (node >= 0 && known >= 0) {
      for (let e: i32 = this.firstEndpoint[node]; e >= 0; e = this.endpointNext[e]) {
        if (this.routeMethod[e] === known) {
          return ROUTER_DUPLICATE
        }
      }
    }
    if (this.routes() >= this.maxRoutes || (known < 0 && toI32(this.methodStart.length) >= this.maxMethods)) {
      return ROUTER_FULL
    }
    let methodId: i32 = known
    if (methodId < 0) {
      methodId = toI32(this.methodStart.length)
      this.methodStart.push(toI32(this.methodBytes.length))
      for (let k: i32 = 0; k < methodLength; k++) {
        this.methodBytes.push(toU8(toI32(method.charCodeAt(k))))
      }
      this.methodEnd.push(toI32(this.methodBytes.length))
    }
    node = 0
    for (let k: i32 = 0; k < count; k++) {
      const next: i32 = this.childFor(node, pattern, k)
      node = next >= 0 ? next : this.addChild(node, pattern, k)
    }
    const route: i32 = this.routes()
    this.routeMethod.push(methodId)
    this.routeParams.push(params)
    this.endpointNext.push(this.firstEndpoint[node])
    this.firstEndpoint[node] = route
    if (count > this.deepest) {
      this.deepest = count
    }
    this.routePathStart.push(toI32(this.staticPaths.length))
    let hash: u32 = routerHashOf(methodId)
    if (params === 0) {
      for (let k: i32 = 0; k < length; k++) {
        const c: i32 = toI32(pattern.charCodeAt(k))
        this.staticPaths.push(toU8(c))
        hash = routerHashWith(hash, c)
      }
    }
    this.routePathEnd.push(toI32(this.staticPaths.length))
    this.routeHash.push(hash)
    if (params === 0) {
      this.statics += 1
      if (4 * this.statics > toI32(this.staticSlots.length)) {
        this.growStatic()
      } else {
        this.fileStatic(route)
      }
    }
    return route
  }

  /** Doubles the exact-path table and files every static route again, in the order they were added. */
  private growStatic(): void {
    const slots: i32 = 2 * toI32(this.staticSlots.length)
    this.staticSlots = new Array<i32>(slots)
    for (let k: i32 = 0; k < slots; k++) {
      this.staticSlots[k] = ROUTER_NONE
    }
    this.staticHeld = 0
    for (let r: i32 = 0; r < this.routes(); r++) {
      if (this.routeParams[r] === 0) {
        this.fileStatic(r)
      }
    }
  }

  /**
   * Files the static route `route` in the first free slot of the
   * `ROUTER_PROBES` from its hash's, or nowhere when all are taken: the tree
   * holds every route, so one the table lacks is still answered.
   */
  private fileStatic(route: i32): void {
    const mask: i32 = toI32(this.staticSlots.length) - 1
    let slot: i32 = routerSlot(this.routeHash[route], mask)
    for (let probe: i32 = 0; probe < ROUTER_PROBES; probe++) {
      if (this.staticSlots[slot] < 0) {
        this.staticSlots[slot] = route
        this.staticHeld += 1
        return
      }
      slot = (slot + 1) & mask
    }
  }

  /**
   * Splits `pattern`, which starts with `/`, into `patKind`/`patStart`/`patEnd`
   * and answers how many segments it has, or the code that refuses it.
   */
  private splitPattern(pattern: string): i32 {
    const length: i32 = toI32(pattern.length)
    let count: i32 = 0
    let start: i32 = 1
    for (let i: i32 = 1; i <= length; i++) {
      const c: i32 = i < length ? toI32(pattern.charCodeAt(i)) : 47
      if (c < 33 || c > 126 || c === 37 || c === 63) {
        return ROUTER_BAD_PATTERN
      }
      if (c !== 47) {
        continue
      }
      if (count === this.maxSegments) {
        return ROUTER_TOO_LONG
      }
      if (count > 0 && this.patKind[count - 1] === ROUTER_WILD) {
        return ROUTER_AMBIGUOUS
      }
      const kind: i32 = routerSegmentKind(pattern, start, i)
      if (kind < 0) {
        return kind
      }
      this.patKind[count] = kind
      this.patStart[count] = kind === ROUTER_PARAM ? start + 1 : start
      this.patEnd[count] = i
      if (kind === ROUTER_PARAM) {
        for (let k: i32 = 0; k < count; k++) {
          if (
            this.patKind[k] === ROUTER_PARAM &&
            routerSameName(pattern, this.patStart[k], this.patEnd[k], start + 1, i)
          ) {
            return ROUTER_BAD_PATTERN
          }
        }
      }
      count += 1
      start = i + 1
    }
    return count
  }

  /** The child of `node` that pattern segment `k` leads to, or -1. */
  private childFor(node: i32, pattern: string, k: i32): i32 {
    const kind: i32 = this.patKind[k]
    if (kind === ROUTER_PARAM) {
      return this.paramChild[node]
    }
    if (kind === ROUTER_WILD) {
      return this.wildChild[node]
    }
    const start: i32 = this.patStart[k]
    const length: i32 = this.patEnd[k] - start
    for (let c: i32 = this.firstChild[node]; c >= 0; c = this.nextSibling[c]) {
      const at: i32 = this.labelStart[c]
      if (this.labelEnd[c] - at === length && routerLabelIsText(this.labels, at, pattern, start, length)) {
        return c
      }
    }
    return -1
  }

  /** Adds the child of `node` that pattern segment `k` leads to, and answers it. */
  private addChild(node: i32, pattern: string, k: i32): i32 {
    const child: i32 = this.nodeCount()
    const kind: i32 = this.patKind[k]
    const at: i32 = toI32(this.labels.length)
    this.firstChild.push(ROUTER_NONE)
    this.nextSibling.push(ROUTER_NONE)
    this.paramChild.push(ROUTER_NONE)
    this.wildChild.push(ROUTER_NONE)
    this.firstEndpoint.push(ROUTER_NONE)
    this.labelStart.push(at)
    if (kind === ROUTER_LITERAL) {
      const n: i32 = toI32(pattern.length)
      for (let i: i32 = this.patStart[k]; i >= 0 && i < this.patEnd[k] && i < n; i++) {
        this.labels.push(toU8(toI32(pattern.charCodeAt(i))))
      }
      this.nextSibling[child] = this.firstChild[node]
      this.firstChild[node] = child
    } else if (kind === ROUTER_PARAM) {
      this.paramChild[node] = child
    } else {
      this.wildChild[node] = child
    }
    this.labelEnd.push(toI32(this.labels.length))
    return child
  }

  /**
   * The index of `method` among the methods the table knows, or -1.
   * @internal Called by std/net/handler.ts to find GET's index, so a HEAD on a GET-only path routes as GET.
   */
  methodIndex(method: string): i32 {
    const length: i32 = toI32(method.length)
    for (let m: i32 = 0; m < toI32(this.methodStart.length); m++) {
      const at: i32 = this.methodStart[m]
      if (this.methodEnd[m] - at === length && routerLabelIsText(this.methodBytes, at, method, 0, length)) {
        return m
      }
    }
    return -1
  }

  /**
   * The route `method[mStart .. mEnd)` and `target[tStart .. tEnd)` reach, or
   * a negative `ROUTER_*` code. On a route, its parameters are written to
   * `params` as `[start, end)` offsets into `target`, two slots each, in the
   * pattern's order, and a final `*` as one more pair; on a refusal `params`
   * is untouched. Panics on a range outside its array.
   * @param method the buffer holding the request's method
   * @param mStart where the method starts in `method`
   * @param mEnd where the method ends in `method`
   * @param target the buffer holding the request target, which may be the same buffer as `method`
   * @param tStart where the target starts in `target`
   * @param tEnd where the target ends in `target`, the query included
   * @param params the caller's scratch for the parameter pairs, two slots for each pair
   * @returns the matched route's index, or `ROUTER_NOT_FOUND`, `ROUTER_METHOD_NOT_ALLOWED` or `ROUTER_TOO_MANY_PARAMS`
   */
  match(method: u8[], mStart: i32, mEnd: i32, target: u8[], tStart: i32, tEnd: i32, params: i32[]): i32 {
    return this.lookup(method, mStart, mEnd, target, tStart, tEnd, params, true)
  }

  /**
   * What `match` answers, found by the tree alone: the exact-path table is not
   * read. The two agree on every method and target, in the route or code they
   * answer, in `params` and in where the path ends; this one is the definition
   * and exists so that a test can hold `match` to it.
   * @param method the buffer holding the request's method
   * @param mStart where the method starts in `method`
   * @param mEnd where the method ends in `method`
   * @param target the buffer holding the request target, which may be the same buffer as `method`
   * @param tStart where the target starts in `target`
   * @param tEnd where the target ends in `target`, the query included
   * @param params the caller's scratch for the parameter pairs, two slots for each pair
   * @returns the matched route's index, or `ROUTER_NOT_FOUND`, `ROUTER_METHOD_NOT_ALLOWED` or `ROUTER_TOO_MANY_PARAMS`
   */
  matchTree(method: u8[], mStart: i32, mEnd: i32, target: u8[], tStart: i32, tEnd: i32, params: i32[]): i32 {
    return this.lookup(method, mStart, mEnd, target, tStart, tEnd, params, false)
  }

  /** `match`, reading the exact-path table first when `exact`, and `matchTree` otherwise. */
  private lookup(
    method: u8[],
    mStart: i32,
    mEnd: i32,
    target: u8[],
    tStart: i32,
    tEnd: i32,
    params: i32[],
    exact: boolean,
  ): i32 {
    if (mStart < 0 || mEnd < mStart || mEnd > toI32(method.length)) {
      panic(`Router.match: the method range ${mStart} to ${mEnd} is outside its ${method.length} bytes`)
    }
    if (tStart < 0 || tEnd < tStart || tEnd > toI32(target.length)) {
      panic(`Router.match: the target range ${tStart} to ${tEnd} is outside its ${target.length} bytes`)
    }
    this.visited = 0
    if (tStart === tEnd || toI32(target[tStart]) !== 47) {
      let end: i32 = tStart
      while (end < tEnd && toI32(target[end]) !== 63) {
        end += 1
      }
      this.pathEnd = end
      return ROUTER_NOT_FOUND
    }
    this.wanted = -1
    const methodLength: i32 = mEnd - mStart
    for (let m: i32 = 0; m < toI32(this.methodStart.length) && this.wanted < 0; m++) {
      const at: i32 = this.methodStart[m]
      if (
        this.methodEnd[m] - at === methodLength &&
        routerSameBytes(this.methodBytes, at, method, mStart, methodLength)
      ) {
        this.wanted = m
      }
    }
    // A static route is never under a method the table does not know, so
    // neither case below has anything to find in the exact-path table.
    if (exact && this.wanted >= 0 && this.staticHeld > 0) {
      const route: i32 = this.staticRoute(target, tStart, tEnd)
      if (route >= 0) {
        return route
      }
    }
    // One pass over the path: where it ends, and each segment's span up to one
    // past the deepest route, which is as far as any edge can reach.
    const keep: i32 = this.deepest + 1
    let segments: i32 = 0
    let start: i32 = tStart + 1
    let end: i32 = start
    while (end < tEnd) {
      const c: i32 = toI32(target[end])
      if (c === 63) {
        break
      }
      if (c === 47) {
        if (segments < keep) {
          this.segStart[segments] = start
          this.segEnd[segments] = end
        }
        segments += 1
        start = end + 1
      }
      end += 1
    }
    if (segments < keep) {
      this.segStart[segments] = start
      this.segEnd[segments] = end
    }
    segments += 1
    this.segments = segments
    this.pathEnd = end
    this.foundCount = 0
    this.otherMethod = false
    const route: i32 = this.walk(target, toI32(0), toI32(0))
    if (route < 0) {
      return this.otherMethod ? ROUTER_METHOD_NOT_ALLOWED : ROUTER_NOT_FOUND
    }
    const pairs: i32 = this.foundCount
    if (2 * pairs > toI32(params.length)) {
      return ROUTER_TOO_MANY_PARAMS
    }
    for (let k: i32 = 0; k < 2 * pairs && k < toI32(params.length); k++) {
      params[k] = this.found[k]
    }
    return route
  }

  /**
   * The static route of the wanted method whose path is `target` from `tStart`
   * to its first `?` or `tEnd`, or -1 when the exact-path table holds none. On
   * a route `pathEnd` is set; it has no pairs, so `params` is not needed.
   *
   * One pass hashes the path, then at most `ROUTER_PROBES` slots are read, and
   * a slot's path is compared only when its hash, method and length all agree:
   * the cost is bounded by the path's length, whatever the path and however
   * many routes the table holds.
   */
  private staticRoute(target: u8[], tStart: i32, tEnd: i32): i32 {
    let hash: u32 = routerHashOf(this.wanted)
    let end: i32 = tStart
    while (end < tEnd) {
      const c: i32 = toI32(target[end])
      if (c === 63) {
        break
      }
      hash = routerHashWith(hash, c)
      end += 1
    }
    const length: i32 = end - tStart
    const mask: i32 = toI32(this.staticSlots.length) - 1
    let slot: i32 = routerSlot(hash, mask)
    for (let probe: i32 = 0; probe < ROUTER_PROBES; probe++) {
      const route: i32 = this.staticSlots[slot]
      if (route < 0) {
        return ROUTER_NONE
      }
      const at: i32 = this.routePathStart[route]
      if (
        this.routeHash[route] === hash &&
        this.routeMethod[route] === this.wanted &&
        this.routePathEnd[route] - at === length &&
        routerSameBytes(this.staticPaths, at, target, tStart, length)
      ) {
        this.pathEnd = end
        return route
      }
      slot = (slot + 1) & mask
    }
    return ROUTER_NONE
  }

  /**
   * The route below `node`, which has consumed `depth` segments, for the
   * wanted method, or -1. Literal, then parameter, then `*`: the first branch
   * that reaches a route wins, and a branch that does not is left with the
   * pairs it pushed popped.
   */
  private walk(target: u8[], node: i32, depth: i32): i32 {
    this.visited += 1
    if (depth === this.segments) {
      return this.endpointFor(node)
    }
    const start: i32 = this.segStart[depth]
    const end: i32 = this.segEnd[depth]
    const length: i32 = end - start
    for (let c: i32 = this.firstChild[node]; c >= 0; c = this.nextSibling[c]) {
      const at: i32 = this.labelStart[c]
      if (this.labelEnd[c] - at === length && routerSameBytes(this.labels, at, target, start, length)) {
        const route: i32 = this.walk(target, c, depth + 1)
        if (route >= 0) {
          return route
        }
        // Labels under one node are distinct, so no other literal child can match.
        break
      }
    }
    const param: i32 = this.paramChild[node]
    if (param >= 0 && length > 0) {
      const top: i32 = this.foundCount
      this.found[2 * top] = start
      this.found[2 * top + 1] = end
      this.foundCount = top + 1
      const route: i32 = this.walk(target, param, depth + 1)
      if (route >= 0) {
        return route
      }
      this.foundCount = top
    }
    const wild: i32 = this.wildChild[node]
    if (wild >= 0) {
      this.visited += 1
      const route: i32 = this.endpointFor(wild)
      if (route >= 0) {
        const top: i32 = this.foundCount
        this.found[2 * top] = start
        this.found[2 * top + 1] = this.pathEnd
        this.foundCount = top + 1
        return route
      }
    }
    return -1
  }

  /** The route of the wanted method ending at `node`, or -1, noting a route of another method there. */
  private endpointFor(node: i32): i32 {
    for (let e: i32 = this.firstEndpoint[node]; e >= 0; e = this.endpointNext[e]) {
      if (this.routeMethod[e] === this.wanted) {
        return e
      }
      this.otherMethod = true
    }
    return -1
  }
}

/**
 * Percent-decodes `target[start .. end)`, one range `match` answered, into
 * `out` from 0, and answers the decoded length or a negative `ROUTER_*` code;
 * on a code nothing is written. `%2F` becomes `/` here, inside the one
 * parameter, because `match` split the path before anything was decoded. `+`
 * stays `+`: a space spelled `+` is the query's form encoding, not the path's.
 * The output may hold any byte, NUL and `/` included. Panics on a range
 * outside `target`.
 * @param target the buffer the range points into, usually the request head
 * @param start where the raw parameter starts in `target`
 * @param end where the raw parameter ends in `target`
 * @param out where the decoded bytes go, from index 0; the caller's buffer
 * @returns how many decoded bytes were written, or `ROUTER_BAD_ESCAPE` or `ROUTER_NO_ROOM`
 */
export const routerDecode = (target: u8[], start: i32, end: i32, out: u8[]): i32 => {
  if (start < 0 || end < start || end > toI32(target.length)) {
    panic(`routerDecode: the range ${start} to ${end} is outside its ${target.length} bytes`)
  }
  let length: i32 = 0
  let i: i32 = start
  while (i < end) {
    if (toI32(target[i]) === 37) {
      if (i + 2 >= end || routerHex(toI32(target[i + 1])) < 0 || routerHex(toI32(target[i + 2])) < 0) {
        return ROUTER_BAD_ESCAPE
      }
      i += 3
    } else {
      i += 1
    }
    length += 1
  }
  if (length > toI32(out.length)) {
    return ROUTER_NO_ROOM
  }
  let at: i32 = 0
  i = start
  const room: i32 = toI32(out.length)
  const n: i32 = toI32(target.length)
  while (i >= 0 && i < end && i < n && at >= 0 && at < room) {
    const c: i32 = toI32(target[i])
    if (c === 37 && i + 2 < n) {
      out[at] = toU8(routerHex(toI32(target[i + 1])) * 16 + routerHex(toI32(target[i + 2])))
      i += 3
    } else {
      out[at] = target[i]
      i += 1
    }
    at += 1
  }
  return length
}

/**
 * The hash the exact-path table files a static route under: FNV-1a (public
 * domain) over the path's bytes, begun from the method's index so that two
 * methods of one path do not share a slot. `u32` arithmetic wraps.
 */
const routerHashOf = (method: i32): u32 => {
  const basis: u32 = 2166136261
  return basis ^ toU32(method)
}

/** `hash` with the path byte `byte` taken in: one step of FNV-1a. */
const routerHashWith = (hash: u32, byte: i32): u32 => {
  const prime: u32 = 16777619
  return (hash ^ toU32(byte)) * prime
}

/** The slot of a table of `mask + 1`, a power of two, that `hash` names: its high bits folded into the low ones the mask keeps. */
const routerSlot = (hash: u32, mask: i32): i32 => toI32((hash ^ (hash >> 15)) & toU32(mask))

/** Panics, naming `RouterLimits.<field>`, unless `value` is in `low .. high`. */
const routerLimit = (field: string, value: i32, low: i32, high: i32): void => {
  if (value < low || value > high) {
    panic(`RouterLimits.${field}: ${value} is outside ${low} to ${high}`)
  }
}

/** Whether `c` is a token character (RFC 9110 §5.6.2), what a method is made of. */
const routerTchar = (c: i32): boolean => {
  if ((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122)) {
    return true
  }
  return (
    c === 33 ||
    c === 35 ||
    c === 36 ||
    c === 37 ||
    c === 38 ||
    c === 39 ||
    c === 42 ||
    c === 43 ||
    c === 45 ||
    c === 46 ||
    c === 94 ||
    c === 95 ||
    c === 96 ||
    c === 124 ||
    c === 126
  )
}

/**
 * The kind of the pattern segment `pattern[start .. end)`, or
 * `ROUTER_BAD_PATTERN`: a parameter is `:` and a name of letters, digits and
 * `_`; `*` is the whole segment or nowhere in it; anything else is a literal.
 */
const routerSegmentKind = (pattern: string, start: i32, end: i32): i32 => {
  if (end - start === 1 && toI32(pattern.charCodeAt(start)) === 42) {
    return ROUTER_WILD
  }
  const param: boolean = end > start && toI32(pattern.charCodeAt(start)) === 58
  if (param && end - start === 1) {
    return ROUTER_BAD_PATTERN
  }
  const n: i32 = toI32(pattern.length)
  for (let i: i32 = start; i >= 0 && i < end && i < n; i++) {
    const c: i32 = toI32(pattern.charCodeAt(i))
    if (c === 42) {
      return ROUTER_BAD_PATTERN
    }
    const nameByte: boolean =
      (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95
    if (param && i > start && !nameByte) {
      return ROUTER_BAD_PATTERN
    }
  }
  return param ? ROUTER_PARAM : ROUTER_LITERAL
}

/** Whether the names `pattern[a .. aEnd)` and `pattern[b .. bEnd)` are the same. */
const routerSameName = (pattern: string, a: i32, aEnd: i32, b: i32, bEnd: i32): boolean => {
  if (aEnd - a !== bEnd - b) {
    return false
  }
  for (let k: i32 = 0; k < aEnd - a; k++) {
    if (pattern.charCodeAt(a + k) !== pattern.charCodeAt(b + k)) {
      return false
    }
  }
  return true
}

/** Whether `bytes[at .. at + length)` spells `text[from .. from + length)`. */
const routerLabelIsText = (bytes: u8[], at: i32, text: string, from: i32, length: i32): boolean => {
  for (let k: i32 = 0; k < length; k++) {
    if (toI32(bytes[at + k]) !== toI32(text.charCodeAt(from + k))) {
      return false
    }
  }
  return true
}

/** Whether `a[at .. at + length)` and `b[from .. from + length)` hold the same bytes; a range outside its array does not. */
const routerSameBytes = (a: u8[], at: i32, b: u8[], from: i32, length: i32): boolean => {
  // Two cursors, so no index is a sum that must be checked for overflow. `stop`
  // is one sum, but every caller passes a label's or a method's offset and
  // length inside an array whose length is an i32, so it cannot overflow; a
  // range past either end fails the per-byte checks and answers false.
  const stop: i32 = at + length
  let j: i32 = from
  for (let i: i32 = at; i < stop; i++) {
    if (i < 0 || i >= toI32(a.length) || j < 0 || j >= toI32(b.length) || a[i] !== b[j]) {
      return false
    }
    j++
  }
  return true
}

/** The value of the hex digit `c`, in either case, or -1. */
const routerHex = (c: i32): i32 => {
  if (c >= 48 && c <= 57) {
    return c - 48
  }
  if (c >= 65 && c <= 70) {
    return c - 55
  }
  if (c >= 97 && c <= 102) {
    return c - 87
  }
  return -1
}
