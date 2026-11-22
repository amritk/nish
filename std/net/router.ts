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
 * flat array, and `match` looks there first, for a target no longer than the
 * longest such route: one pass over the path, at most `ROUTER_PROBES` slots,
 * and a byte comparison for a slot whose method and length agree. The
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
 * **What is unchecked.** `routerSameBytes` reads with `nish:unsafe`'s
 * `uncheckedGet`, after one check that both ranges are inside their arrays;
 * a range that is not compares unequal, as a byte that differs does. It is
 * the one byte compare a lookup makes: a method of more than seven bytes
 * against each known one (a shorter one is one packed word, `routerMethodKey`),
 * a path against a static route's, a segment against a label.
 * `routerMethodKey` reads its at most seven bytes the same way, after the same
 * one range check; a range outside the array packs to 0, which no method is.
 * Every other read is checked.
 *
 * **Steps run before and after route bodies.** `step` names a step, 0 for the
 * first, and `use` binds it to a route — or to the requests no route answers,
 * `ROUTER_NOT_FOUND` and `ROUTER_METHOD_NOT_ALLOWED` — while the table is
 * built; `steps` answers a route's set as one bit per step, which
 * `nish/net/handler` and `nish/net/http-server` read to hand the program each
 * step's id (`docs/wp43-http-app-layer.md` §4, stage 5). A route bound to no
 * step answers 0, and nothing else is looked up for it.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 */
import { uncheckedGet, wrappingAdd } from "nish:unsafe"

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

/** The most steps one table names: one bit each of an `i32`, its sign bit aside. */
export const ROUTER_MAX_STEPS: i32 = 31

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
  /** Per route: the steps `use` bound to it, bit `s` for step `s`. */
  private routeSteps: i32[]
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
  /**
   * Per method: its bytes and length packed by `routerMethodKey`, or 0 for one
   * too long to pack. Private and written only by `add`, beside the public
   * arrays it is made from, so a lookup compares one word for a method.
   */
  private methodKey: u64[]
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
  /** The steps bound to `ROUTER_NOT_FOUND`: what `match` answers with any negative code but `ROUTER_METHOD_NOT_ALLOWED` runs them. */
  private missSteps: i32 = 0
  /** The steps bound to the requests `match` answers `ROUTER_METHOD_NOT_ALLOWED`. */
  private refusedSteps: i32 = 0
  /** How many steps `step` has named; the next answers this id. */
  private stepCount: i32 = 0
  /** How many routes have no parameter and no `*`, and how many of them `staticSlots` holds. */
  private statics: i32 = 0
  private staticHeld: i32 = 0
  /** The longest static route's path, in bytes: a longer target is not hashed at all. */
  private staticLongest: i32 = 0
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
    this.routeSteps = []
    this.staticSlots = [-1, -1, -1, -1, -1, -1, -1, -1]
    this.routeHash = []
    this.routePathStart = []
    this.routePathEnd = []
    this.staticPaths = []
    this.methodBytes = []
    this.methodStart = []
    this.methodEnd = []
    this.methodKey = []
    // The checks above hold each length to at most 512, so a `u16` carries it whole.
    const keep: u16 = toU16(limits.maxSegments + 1)
    const segments: u16 = toU16(limits.maxSegments)
    this.segStart = new Array<i32>(keep)
    this.segEnd = new Array<i32>(keep)
    this.found = new Array<i32>(toU16(limits.maxParams + limits.maxParams))
    this.patKind = new Array<i32>(segments)
    this.patStart = new Array<i32>(segments)
    this.patEnd = new Array<i32>(segments)
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
    if (route >= 0 && route < this.routes() && route < toI32(this.routeParams.length)) {
      return this.routeParams[route]
    }
    routerNoRoute(route, this.routes())
    // Not reached: the helper panics.
    return 0
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
   * Names a new step and answers its id, counting from 0, or `ROUTER_FULL`
   * once the table names `ROUTER_MAX_STEPS`. A step runs for the routes
   * `use` binds it to, in the order of the ids.
   * @returns the new step's id, or `ROUTER_FULL`
   */
  step(): i32 {
    const id: i32 = this.stepCount
    if (id >= ROUTER_MAX_STEPS) {
      return ROUTER_FULL
    }
    this.stepCount = id + 1
    return id
  }

  /**
   * Binds step `step` to `route`: every request `match` answers that route
   * runs it. `ROUTER_NOT_FOUND` binds it to the requests no route matches, and
   * `ROUTER_METHOD_NOT_ALLOWED` to those whose path only other methods'
   * routes match. Binding a step twice binds it once. Panics on a route or a
   * step the table does not hold.
   * @param route a route index `add` answered, `ROUTER_NOT_FOUND` or `ROUTER_METHOD_NOT_ALLOWED`
   * @param step a step id `step` answered
   */
  use(route: i32, step: i32): void {
    if (step < 0 || step >= this.stepCount) {
      panic(`Router.use: step ${step} is not one of the ${this.stepCount} the table names`)
    }
    const bit: i32 = 1 << step
    if (route === ROUTER_NOT_FOUND) {
      this.missSteps = this.missSteps | bit
    } else if (route === ROUTER_METHOD_NOT_ALLOWED) {
      this.refusedSteps = this.refusedSteps | bit
    } else {
      if (route < 0 || route >= this.routes() || route >= toI32(this.routeSteps.length)) {
        panic(`Router.use: route ${route} is not in a table of ${this.routes()}`)
      }
      this.routeSteps[route] = this.routeSteps[route] | bit
    }
  }

  /**
   * The steps bound to what `match` answered: bit `s` is set for step `s`.
   * @param route what `match` answered: a route index, or a negative `ROUTER_*` code
   * @returns the route's steps; for `ROUTER_METHOD_NOT_ALLOWED` those bound to it, for any other negative code those bound to `ROUTER_NOT_FOUND`, and 0 for a route bound to none
   */
  steps(route: i32): i32 {
    if (route >= 0) {
      return route < toI32(this.routeSteps.length) ? this.routeSteps[route] : 0
    }
    return route === ROUTER_METHOD_NOT_ALLOWED ? this.refusedSteps : this.missSteps
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
    if (toI32(pattern.length) < 1 || toI32(pattern.charCodeAt(0)) !== 47) {
      return ROUTER_BAD_PATTERN
    }
    const count: i32 = this.splitPattern(pattern)
    if (count < 0) {
      return count
    }
    let params: i32 = 0
    for (let k: i32 = 0; k < count && k < toI32(this.patKind.length); k++) {
      if (this.patKind[k] !== ROUTER_LITERAL) {
        // Never true, `params` counting at most one per segment; a proof
        // does not follow a loop, and the count needs this bound.
        if (params < 0 || params > 1073741822) {
          return ROUTER_TOO_LONG
        }
        params = params + 1
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
    if (node >= 0 && node < toI32(this.firstEndpoint.length) && known >= 0) {
      let e: i32 = this.firstEndpoint[node]
      while (e >= 0 && e < toI32(this.endpointNext.length) && e < toI32(this.routeMethod.length)) {
        if (this.routeMethod[e] === known) {
          return ROUTER_DUPLICATE
        }
        e = this.endpointNext[e]
      }
    }
    if (this.routes() >= this.maxRoutes || (known < 0 && toI32(this.methodStart.length) >= this.maxMethods)) {
      return ROUTER_FULL
    }
    // The statics are among the routes, which the constructor caps at 1048576
    // and the test above keeps below `maxRoutes`, so this is never true; it is
    // the bound the count below needs, read before anything is added.
    const statics: i32 = this.statics
    if (statics < 0 || statics > 1048575) {
      return ROUTER_FULL
    }
    let methodId: i32 = known
    if (methodId < 0) {
      methodId = toI32(this.methodStart.length)
      const methodAt: i32 = toI32(this.methodBytes.length)
      this.methodStart.push(methodAt)
      for (let k: i32 = 0; k < methodLength; k++) {
        this.methodBytes.push(toU8(toI32(method.charCodeAt(k))))
      }
      this.methodEnd.push(toI32(this.methodBytes.length))
      this.methodKey.push(routerMethodKey(this.methodBytes, methodAt, methodLength))
    }
    node = 0
    for (let k: i32 = 0; k < count; k++) {
      const next: i32 = this.childFor(node, pattern, k)
      node = next >= 0 ? next : this.addChild(node, pattern, k)
    }
    // Never true: `childFor` and `addChild` answer a node the tree holds. The
    // test is what proves the endpoint reads below.
    if (node < 0 || node >= toI32(this.firstEndpoint.length)) {
      return ROUTER_FULL
    }
    const route: i32 = this.routes()
    // The new route heads its node's endpoints; its next is the old head.
    const head: i32 = this.firstEndpoint[node]
    this.firstEndpoint[node] = route
    this.routeMethod.push(methodId)
    this.routeParams.push(params)
    this.routeSteps.push(toI32(0))
    this.endpointNext.push(head)
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
      const held: i32 = statics + 1
      this.statics = held
      if (length > this.staticLongest) {
        this.staticLongest = length
      }
      if (4 * held > toI32(this.staticSlots.length)) {
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
    // Built by pushes: the length can pass what a `u16` holds.
    const table: i32[] = []
    for (let k: i32 = 0; k < slots; k++) {
      table.push(ROUTER_NONE)
    }
    this.staticSlots = table
    this.staticHeld = 0
    for (let r: i32 = 0; r < this.routes() && r < toI32(this.routeParams.length); r++) {
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
    if (route < 0 || route >= toI32(this.routeHash.length)) {
      return
    }
    const mask: i32 = toI32(this.staticSlots.length) - 1
    let slot: i32 = routerSlot(this.routeHash[route], mask)
    for (let probe: i32 = 0; probe < ROUTER_PROBES; probe++) {
      // Never true, the mask keeping the slot inside the table; the test is the
      // proof the reads need.
      if (slot < 0 || slot >= toI32(this.staticSlots.length)) {
        return
      }
      if (this.staticSlots[slot] < 0) {
        // Never true: a free slot means fewer are held than the table has.
        // The test bounds the count below, and on it the route goes unfiled.
        const held: i32 = this.staticHeld
        if (held < 0 || held >= toI32(this.staticSlots.length)) {
          return
        }
        this.staticSlots[slot] = route
        this.staticHeld = held + 1
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
    // `add` refuses a pattern past `maxPatternBytes`, at most 65536, before
    // this; the bound is what keeps the cursor below from overflowing.
    if (length > 65536) {
      return ROUTER_TOO_LONG
    }
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
      // The segment arrays are `maxSegments` long, so the last three tests
      // never hold before the first does; they are what proves the writes.
      if (
        count >= this.maxSegments ||
        count >= toI32(this.patKind.length) ||
        count >= toI32(this.patStart.length) ||
        count >= toI32(this.patEnd.length)
      ) {
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
      // Never true, `start` lying inside the pattern; the count needs the bound.
      if (start < 0 || start > 1073741822) {
        return ROUTER_BAD_PATTERN
      }
      const name: i32 = start + 1
      this.patStart[count] = kind === ROUTER_PARAM ? name : start
      this.patEnd[count] = i
      if (kind === ROUTER_PARAM) {
        for (let k: i32 = 0; k < count; k++) {
          if (
            this.patKind[k] === ROUTER_PARAM &&
            routerSameName(pattern, this.patStart[k], this.patEnd[k], name, i)
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
    // Never true for what `add` passes; the tests are the proof the reads need.
    if (
      k < 0 ||
      k >= toI32(this.patKind.length) ||
      k >= toI32(this.patStart.length) ||
      k >= toI32(this.patEnd.length) ||
      node < 0 ||
      node >= toI32(this.firstChild.length) ||
      node >= toI32(this.paramChild.length) ||
      node >= toI32(this.wildChild.length)
    ) {
      return -1
    }
    const kind: i32 = this.patKind[k]
    if (kind === ROUTER_PARAM) {
      return this.paramChild[node]
    }
    if (kind === ROUTER_WILD) {
      return this.wildChild[node]
    }
    const start: i32 = this.patStart[k]
    const end: i32 = this.patEnd[k]
    // `splitPattern` writes ranges inside the pattern, so this never holds.
    if (start < 0 || end < 0) {
      return -1
    }
    const length: i32 = end - start
    let c: i32 = this.firstChild[node]
    while (c >= 0 && c < toI32(this.nextSibling.length) && c < toI32(this.labelStart.length) && c < toI32(this.labelEnd.length)) {
      const at: i32 = this.labelStart[c]
      const last: i32 = this.labelEnd[c]
      if (at >= 0 && last >= 0 && last - at === length && routerLabelIsText(this.labels, at, pattern, start, length)) {
        return c
      }
      c = this.nextSibling[c]
    }
    return -1
  }

  /** Adds the child of `node` that pattern segment `k` leads to, and answers it. */
  private addChild(node: i32, pattern: string, k: i32): i32 {
    // Never true for what `add` passes, as in `childFor`; -1 adds nothing.
    if (
      k < 0 ||
      k >= toI32(this.patKind.length) ||
      k >= toI32(this.patStart.length) ||
      k >= toI32(this.patEnd.length) ||
      node < 0 ||
      node >= toI32(this.firstChild.length) ||
      node >= toI32(this.paramChild.length) ||
      node >= toI32(this.wildChild.length)
    ) {
      return -1
    }
    const child: i32 = this.nodeCount()
    const kind: i32 = this.patKind[k]
    const from: i32 = this.patStart[k]
    const end: i32 = this.patEnd[k]
    const at: i32 = toI32(this.labels.length)
    // The parent's link is written first, while `node` is known to be inside
    // its arrays; a literal child goes first among its siblings, its next the
    // old first.
    let sibling: i32 = ROUTER_NONE
    if (kind === ROUTER_LITERAL) {
      sibling = this.firstChild[node]
      this.firstChild[node] = child
    } else if (kind === ROUTER_PARAM) {
      this.paramChild[node] = child
    } else {
      this.wildChild[node] = child
    }
    this.firstChild.push(ROUTER_NONE)
    this.nextSibling.push(sibling)
    this.paramChild.push(ROUTER_NONE)
    this.wildChild.push(ROUTER_NONE)
    this.firstEndpoint.push(ROUTER_NONE)
    this.labelStart.push(at)
    if (kind === ROUTER_LITERAL) {
      const n: i32 = toI32(pattern.length)
      for (let i: i32 = from; i >= 0 && i < end && i < n; i++) {
        this.labels.push(toU8(toI32(pattern.charCodeAt(i))))
      }
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
    for (let m: i32 = 0; m < toI32(this.methodStart.length) && m < toI32(this.methodEnd.length); m++) {
      const at: i32 = this.methodStart[m]
      const last: i32 = this.methodEnd[m]
      if (at >= 0 && last >= 0 && last - at === length && routerLabelIsText(this.methodBytes, at, method, 0, length)) {
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
    if (!this.enter(method, mStart, mEnd, target, tStart, tEnd)) {
      return ROUTER_NOT_FOUND
    }
    // A static route's path is never longer than the longest one: a target
    // past that, query and all, is the tree's without a byte of it read here.
    // `enter` panics on a range outside `target`, so this never holds; a proof
    // does not cross a call.
    if (tStart < 0 || tEnd < 0) {
      return ROUTER_NOT_FOUND
    }
    if (tEnd - tStart <= this.staticLongest) {
      const route: i32 = this.staticRoute(target, tStart, tEnd)
      if (route !== ROUTER_NONE) {
        return route
      }
      // The pass that hashed the path split it too, so the tree reads no byte again.
      return this.answer(target, params)
    }
    return this.descend(target, tStart, tEnd, params)
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
    if (!this.enter(method, mStart, mEnd, target, tStart, tEnd)) {
      return ROUTER_NOT_FOUND
    }
    return this.descend(target, tStart, tEnd, params)
  }

  /**
   * The start of every lookup: the range checks, and `wanted` set to the
   * method's index, or -1 for one the table has never seen. False for a target
   * that is not `/`-rooted, which is `ROUTER_NOT_FOUND` with `pathEnd` set.
   */
  private enter(method: u8[], mStart: i32, mEnd: i32, target: u8[], tStart: i32, tEnd: i32): boolean {
    if (mStart < 0 || mEnd < 0 || mEnd < mStart || mEnd > toI32(method.length)) {
      routerOutside("method", mStart, mEnd, toI32(method.length))
      // Not reached, as below.
      return false
    }
    if (tStart < 0 || tEnd < tStart || tEnd > toI32(target.length)) {
      routerOutside("target", tStart, tEnd, toI32(target.length))
      // Not reached: the helper panics. The return is what tells the prover
      // that `tStart .. tEnd` is inside `target` from here on.
      return false
    }
    this.visited = 0
    if (tStart === tEnd || tStart >= toI32(target.length) || toI32(target[tStart]) !== 47) {
      let end: i32 = tStart
      while (end < tEnd && end < toI32(target.length) && toI32(target[end]) !== 63) {
        end += 1
      }
      this.pathEnd = end
      return false
    }
    const methodLength: i32 = mEnd - mStart
    const key: u64 = routerMethodKey(method, mStart, methodLength)
    if (key !== toU64(0)) {
      for (let m: i32 = 0; m < toI32(this.methodKey.length); m++) {
        if (this.methodKey[m] === key) {
          this.wanted = m
          return true
        }
      }
      this.wanted = -1
      return true
    }
    // A method too long for a key is compared byte by byte with each known one.
    for (let m: i32 = 0; m < toI32(this.methodStart.length) && m < toI32(this.methodEnd.length); m++) {
      const at: i32 = this.methodStart[m]
      // Checked, the compare's ranges included: `methodBytes`, `methodStart`
      // and `methodEnd` are public, so nothing here can rely on `add` being
      // the only writer.
      const last: i32 = this.methodEnd[m]
      if (
        at >= 0 &&
        last >= 0 &&
        last - at === methodLength &&
        routerSameBytes(this.methodBytes, at, method, mStart, methodLength)
      ) {
        this.wanted = m
        return true
      }
    }
    this.wanted = -1
    return true
  }

  /** The tree's answer for a target `enter` took and no scan has split: the split, then `answer`. */
  private descend(target: u8[], tStart: i32, tEnd: i32, params: i32[]): i32 {
    // `enter` took this range, so this is never true; it is here because a
    // proof does not cross a call, and the reads below need this one.
    if (tStart < 0 || tStart >= tEnd || tEnd > toI32(target.length)) {
      return ROUTER_NOT_FOUND
    }
    // One pass over the path: where it ends, and each segment's span up to one
    // past the deepest route, which is as far as any edge can reach.
    // `deepest` counts a route's segments, which the constructor caps at 512,
    // so this is never true; it is the bound the count below needs.
    const deepest: i32 = this.deepest
    if (deepest < 0 || deepest > 1073741822) {
      return ROUTER_NOT_FOUND
    }
    const keep: i32 = deepest + 1
    let segments: i32 = 0
    let start: i32 = tStart + 1
    let end: i32 = start
    while (end < tEnd) {
      const c: i32 = toI32(target[end])
      if (c === 63) {
        break
      }
      if (c === 47) {
        this.span(segments, keep, start, end)
        // Never true, a path holding fewer slashes than bytes; the count
        // needs the bound, and a proof does not follow a loop.
        if (segments < 0 || segments > 1073741821) {
          return ROUTER_NOT_FOUND
        }
        segments = segments + 1
        start = end + 1
      }
      end += 1
    }
    if (segments < 0 || segments > 1073741822) {
      return ROUTER_NOT_FOUND
    }
    this.span(segments, keep, start, end)
    this.segments = segments + 1
    this.pathEnd = end
    return this.answer(target, params)
  }

  /**
   * Records `[start, end)` as segment `k`'s span when `k` is below `keep`, one
   * past the deepest route: no edge reads a span deeper than that.
   */
  private span(k: i32, keep: i32, start: i32, end: i32): void {
    // `keep` is at most `maxSegments + 1`, the arrays' length, so the last
    // two tests never decide; they are what proves the writes.
    if (k < 0 || k >= keep || k >= toI32(this.segStart.length) || k >= toI32(this.segEnd.length)) {
      return
    }
    this.segStart[k] = start
    this.segEnd[k] = end
  }

  /** The tree's answer for a path already split into `segStart`/`segEnd`: the walk and the pairs. */
  private answer(target: u8[], params: i32[]): i32 {
    this.foundCount = 0
    this.otherMethod = false
    const route: i32 = this.walk(target, toI32(0), toI32(0))
    if (route < 0) {
      return this.otherMethod ? ROUTER_METHOD_NOT_ALLOWED : ROUTER_NOT_FOUND
    }
    const count: i32 = this.foundCount
    // `pushPair` keeps the count below `found`'s length, so this never holds.
    if (count < 0 || count > 1073741823) {
      return ROUTER_TOO_MANY_PARAMS
    }
    const slots: i32 = count + count
    if (slots > toI32(params.length)) {
      return ROUTER_TOO_MANY_PARAMS
    }
    for (let k: i32 = 0; k < slots && k < toI32(params.length) && k < toI32(this.found.length); k++) {
      params[k] = this.found[k]
    }
    return route
  }

  /**
   * The static route of the wanted method whose path is `target` from `tStart`
   * to its first `?` or `tEnd`, or -1 when the exact-path table holds none. On
   * a route `pathEnd` is set; it has no pairs, so `params` is not needed.
   * Either way the path is left split, as `descend` splits it, for `answer`;
   * a range outside `target`, which `enter` never lets through, is
   * `ROUTER_NOT_FOUND` before any split.
   *
   * `match` calls this only for a target no longer than the longest static
   * route. One pass hashes and splits the path; then at most `ROUTER_PROBES` slots are
   * read, and a slot's path is compared only when its method and length
   * agree. The hash picks the slot and decides nothing else: a route is
   * answered for its method and its bytes. The cost is bounded by the longest static route's length,
   * whatever the target and however many routes the table holds.
   */
  private staticRoute(target: u8[], tStart: i32, tEnd: i32): i32 {
    // Never true, as in `descend`: the guard is the proof the loop's reads
    // need. It answers as `descend`'s does, so no split is left for `answer`.
    if (tStart < 0 || tStart >= tEnd || tEnd > toI32(target.length)) {
      return ROUTER_NOT_FOUND
    }
    // The first byte is the `/` `enter` found; each later one is hashed, and
    // a `/` among them also closes a segment, as in `descend`.
    let hash: u32 = routerHashWith(routerHashOf(this.wanted), 47)
    // `deepest` counts a route's segments, which the constructor caps at 512,
    // so this is never true; it is the bound the count below needs.
    const deepest: i32 = this.deepest
    if (deepest < 0 || deepest > 1073741822) {
      return ROUTER_NONE
    }
    const keep: i32 = deepest + 1
    let segments: i32 = 0
    let start: i32 = tStart + 1
    let end: i32 = start
    while (end < tEnd) {
      const c: i32 = toI32(target[end])
      if (c === 63) {
        break
      }
      if (c === 47) {
        this.span(segments, keep, start, end)
        // Never true, a path holding fewer slashes than bytes; the count
        // needs the bound, and a proof does not follow a loop.
        if (segments < 0 || segments > 1073741821) {
          return ROUTER_NONE
        }
        segments = segments + 1
        start = end + 1
      }
      hash = routerHashWith(hash, c)
      end += 1
    }
    if (segments < 0 || segments > 1073741822) {
      return ROUTER_NONE
    }
    this.span(segments, keep, start, end)
    this.segments = segments + 1
    this.pathEnd = end
    // `end` only grows from `tStart + 1`; a proof does not follow a loop.
    if (end < 0) {
      return ROUTER_NONE
    }
    const length: i32 = end - tStart
    const mask: i32 = toI32(this.staticSlots.length) - 1
    let slot: i32 = routerSlot(hash, mask)
    for (let probe: i32 = 0; probe < ROUTER_PROBES; probe++) {
      // Never true, as in `fileStatic`; the tests are the proof the reads need.
      if (slot < 0 || slot >= toI32(this.staticSlots.length)) {
        return ROUTER_NONE
      }
      const route: i32 = this.staticSlots[slot]
      if (
        route < 0 ||
        route >= toI32(this.routePathStart.length) ||
        route >= toI32(this.routePathEnd.length) ||
        route >= toI32(this.routeMethod.length)
      ) {
        return ROUTER_NONE
      }
      const at: i32 = this.routePathStart[route]
      const last: i32 = this.routePathEnd[route]
      if (
        this.routeMethod[route] === this.wanted &&
        at >= 0 &&
        last >= 0 &&
        last - at === length &&
        routerSameBytes(this.staticPaths, at, target, tStart, length)
      ) {
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
    // Never more than the nodes, so the count needs no overflow check.
    this.visited = wrappingAdd(this.visited, toI32(1))
    if (depth === this.segments) {
      return this.endpointFor(node)
    }
    // Never true: the split keeps a span for every depth up to the deepest
    // route, and every node is the tree's. The tests are the proof the reads need.
    if (
      depth < 0 ||
      depth >= toI32(this.segStart.length) ||
      depth >= toI32(this.segEnd.length) ||
      node < 0 ||
      node >= toI32(this.firstChild.length) ||
      node >= toI32(this.paramChild.length) ||
      node >= toI32(this.wildChild.length)
    ) {
      return -1
    }
    const start: i32 = this.segStart[depth]
    const end: i32 = this.segEnd[depth]
    // The split writes spans inside the target, so this never holds.
    if (start < 0 || end < 0) {
      return -1
    }
    const length: i32 = end - start
    let c: i32 = this.firstChild[node]
    while (c >= 0 && c < toI32(this.nextSibling.length) && c < toI32(this.labelStart.length) && c < toI32(this.labelEnd.length)) {
      const at: i32 = this.labelStart[c]
      const last: i32 = this.labelEnd[c]
      if (at >= 0 && last >= 0 && last - at === length && routerSameBytes(this.labels, at, target, start, length)) {
        const route: i32 = this.walk(target, c, depth + 1)
        if (route >= 0) {
          return route
        }
        // Labels under one node are distinct, so no other literal child can match.
        break
      }
      c = this.nextSibling[c]
    }
    const param: i32 = this.paramChild[node]
    if (param >= 0 && length > 0) {
      const top: i32 = this.foundCount
      if (this.pushPair(start, end)) {
        const route: i32 = this.walk(target, param, depth + 1)
        if (route >= 0) {
          return route
        }
        this.foundCount = top
      }
    }
    const wild: i32 = this.wildChild[node]
    if (wild >= 0) {
      this.visited = wrappingAdd(this.visited, toI32(1))
      const route: i32 = this.endpointFor(wild)
      if (route >= 0 && this.pushPair(start, this.pathEnd)) {
        return route
      }
    }
    return -1
  }

  /**
   * Pushes the pair `[start, end)` onto `found`, or answers false when it has
   * no room. A route's pattern holds at most `maxParams` parameters and `*`s,
   * and `found` has two slots for each, so a walk always has room.
   */
  private pushPair(start: i32, end: i32): boolean {
    const top: i32 = this.foundCount
    // `found` holds fewer than 1025 slots, so this is no room by a wider margin.
    if (top < 0 || top > 1073741822) {
      return false
    }
    const first: i32 = top + top
    const second: i32 = first + 1
    if (first < 0 || first >= toI32(this.found.length) || second < 0 || second >= toI32(this.found.length)) {
      return false
    }
    this.found[first] = start
    this.found[second] = end
    this.foundCount = top + 1
    return true
  }

  /** The route of the wanted method ending at `node`, or -1, noting a route of another method there. */
  private endpointFor(node: i32): i32 {
    if (node < 0 || node >= toI32(this.firstEndpoint.length)) {
      return -1
    }
    let e: i32 = this.firstEndpoint[node]
    while (e >= 0 && e < toI32(this.endpointNext.length) && e < toI32(this.routeMethod.length)) {
      if (this.routeMethod[e] === this.wanted) {
        return e
      }
      this.otherMethod = true
      e = this.endpointNext[e]
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
  if (start < 0 || end < 0 || end < start || end > toI32(target.length)) {
    panic(`routerDecode: the range ${start} to ${end} is outside its ${target.length} bytes`)
  }
  const n: i32 = toI32(target.length)
  let length: i32 = 0
  let i: i32 = start
  while (i < end) {
    if (toI32(target[i]) === 37) {
      // `end` is at most `n`, so the second test never decides; it is what
      // proves the two reads.
      if (i >= end - 2 || i >= n - 2 || routerHex(toI32(target[i + 1])) < 0 || routerHex(toI32(target[i + 2])) < 0) {
        return ROUTER_BAD_ESCAPE
      }
      i += 3
    } else {
      i += 1
    }
    // One decoded byte per raw byte at most, so this never holds.
    if (length >= n) {
      return ROUTER_NO_ROOM
    }
    length = length + 1
  }
  if (length > toI32(out.length)) {
    return ROUTER_NO_ROOM
  }
  let at: i32 = 0
  i = start
  const room: i32 = toI32(out.length)
  while (i >= 0 && i < end && i < n && at >= 0 && at < room) {
    const c: i32 = toI32(target[i])
    if (c === 37 && i < n - 2) {
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
 * Where the hash the exact-path table files a static route under begins: at
 * the method's index, so that two methods of one path do not share a slot.
 */
const routerHashOf = (method: i32): u32 => toU32(method) + toU32(1)

/**
 * `bytes[at .. at + length)` packed into one word, its first byte lowest and
 * its length in the top byte, so two methods of up to 7 bytes have the same
 * key exactly when they have the same bytes. 0, which no packed method is,
 * for a length outside 1 to 7 or a range outside `bytes`.
 */
const routerMethodKey = (bytes: u8[], at: i32, length: i32): u64 => {
  if (length < 1 || length > 7 || at < 0 || length > toI32(bytes.length) - at) {
    return toU64(0)
  }
  // The test above puts `[at, at + length)` inside `bytes`, a range the
  // prover cannot follow through `stop`, so each read skips its check and
  // the cursor its overflow test: `stop` is at most `bytes.length`, an i32.
  let key: u64 = toU64(length) << toU64(56)
  let shift: u64 = toU64(0)
  const stop: i32 = wrappingAdd(at, length)
  for (let i: i32 = at; i < stop; i = wrappingAdd(i, toI32(1))) {
    key = key | (toU64(uncheckedGet(bytes, i)) << shift)
    shift = shift + toU64(8)
  }
  return key
}

/**
 * `hash` with the path byte `byte` taken in, as FNV-1a takes one: an exclusive
 * or and a product with its 32-bit prime. `u32` arithmetic wraps.
 */
const routerHashWith = (hash: u32, byte: i32): u32 => {
  const prime: u32 = 16777619
  return (hash ^ toU32(byte)) * prime
}

/**
 * The slot of a table of `mask + 1`, a power of two, that `hash` names: its
 * product with 2^32 over the golden ratio, the high bits folded into the low
 * ones the mask keeps.
 */
const routerSlot = (hash: u32, mask: i32): i32 => {
  const spread: u32 = 2654435769
  const mixed: u32 = hash * spread
  return toI32((mixed ^ (mixed >>> 15)) & toU32(mask))
}

/**
 * Panics for a `what` range `start` to `end` outside its `length` bytes. Apart
 * from `enter`, so that a lookup holds no string of its own.
 */
const routerOutside = (what: string, start: i32, end: i32, length: i32): void => {
  panic(`Router.match: the ${what} range ${start} to ${end} is outside its ${length} bytes`)
}

/**
 * Panics for a `route` that is not one of the table's `routes`. Apart from
 * `paramCount`, which a server calls per request, for the reason `routerOutside` is.
 */
const routerNoRoute = (route: i32, routes: i32): void => {
  panic(`Router.paramCount: route ${route} is not in a table of ${routes}`)
}

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
  const n: i32 = toI32(pattern.length)
  // `splitPattern` passes a range inside `pattern`, so this never holds.
  if (start < 0 || end < 0 || end < start || end > n) {
    return ROUTER_BAD_PATTERN
  }
  const width: i32 = end - start
  const first: i32 = start < n ? toI32(pattern.charCodeAt(start)) : -1
  if (width === 1 && first === 42) {
    return ROUTER_WILD
  }
  const param: boolean = width > 0 && first === 58
  if (param && width === 1) {
    return ROUTER_BAD_PATTERN
  }
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
  if (a < 0 || aEnd < 0 || b < 0 || bEnd < 0 || aEnd - a !== bEnd - b) {
    return false
  }
  // Two cursors, each held inside `pattern`: `splitPattern` passes ranges
  // inside it, so the bound never ends the walk early.
  const n: i32 = toI32(pattern.length)
  let i: i32 = a
  let j: i32 = b
  while (i < aEnd) {
    if (i < 0 || i >= n || j < 0 || j >= n || pattern.charCodeAt(i) !== pattern.charCodeAt(j)) {
      return false
    }
    i += 1
    j += 1
  }
  return true
}

/** Whether `bytes[at .. at + length)` spells `text[from .. from + length)`. */
const routerLabelIsText = (bytes: u8[], at: i32, text: string, from: i32, length: i32): boolean => {
  // A range outside either one, which no caller passes, does not spell it.
  const nb: i32 = toI32(bytes.length)
  const nt: i32 = toI32(text.length)
  let i: i32 = at
  let j: i32 = from
  for (let k: i32 = 0; k < length; k++) {
    if (i < 0 || i >= nb || j < 0 || j >= nt || toI32(bytes[i]) !== toI32(text.charCodeAt(j))) {
      return false
    }
    i += 1
    j += 1
  }
  return true
}

/**
 * Whether `a[at .. at + length)` and `b[from .. from + length)` hold the same
 * bytes; a negative length, or a range outside its array, does not. The
 * ranges are checked once, here, and the bytes are then read without a check
 * per byte.
 */
const routerSameBytes = (a: u8[], at: i32, b: u8[], from: i32, length: i32): boolean => {
  if (at < 0 || from < 0 || length > toI32(a.length) - at || length > toI32(b.length) - from) {
    return false
  }
  // Two cursors, each stepped without an overflow check: `at` and `from` are
  // not negative and `length` is at most what is left of each array after
  // them, so neither passes its array's length, an i32. A negative `length`
  // puts `stop` below `at` (no overflow, `at` being at least 0), so the loop
  // never runs and the closing test answers false: a separate `length < 0`
  // test up front measured 5 to 47 Ir more per match.
  const stop: i32 = wrappingAdd(at, length)
  let j: i32 = from
  let i: i32 = at
  while (i < stop) {
    if (uncheckedGet(a, i) !== uncheckedGet(b, j)) {
      return false
    }
    i = wrappingAdd(i, toI32(1))
    j = wrappingAdd(j, toI32(1))
  }
  return i === stop
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
