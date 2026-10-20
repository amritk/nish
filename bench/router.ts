// What `nish/net/router`'s tree is worth against the loop it replaces: a deep
// route looked up in a table of 112 routes, by the router and by a hand-written
// linear scan of the same table, timed against each other in one process.
//
//   build/nish run bench/router.ts
//
// The table is `routeTable` below, one "METHOD /pattern" string per route, in
// one place so that a server benchmark can copy it whole: 14 resources with
// the usual six routes each, a few statics and a `*`, and nested routes up to
// nine segments deep with one to three parameters, the deepest ending in `*`.
//
// Each lookup rotates its target through `TARGETS`, four deep paths whose
// routes sit near the end of the table: the linear scan's honest worst case,
// and the case a router exists for. Every answer, route index and parameter
// offsets, is folded into a printed checksum, and the two lookups must agree
// on each one or the program panics, so neither can be timing a shortcut.
//
// Three columns, in interleaved rounds, each reported as its minimum and
// median: `router`, `linear`, and `linear copy`, a byte-identical copy of the
// linear scan. The distance between the two linear columns is the noise band
// a difference has to clear before it means anything.
import { Router, RouterLimits } from "nish/net/router"
import { httpFieldBytes } from "nish/net/http-fields"

/** The table: one "METHOD /pattern" per route, in `Router.add` order. */
const routeTable = (): string[] => [
  "GET /",
  "GET /robots.txt",
  "GET /health",
  "GET /metrics",
  "GET /static/*",
  "GET /v1",
  "GET /v1/users",
  "POST /v1/users",
  "GET /v1/users/:id",
  "PUT /v1/users/:id",
  "DELETE /v1/users/:id",
  "GET /v1/users/:id/events",
  "GET /v1/orgs",
  "POST /v1/orgs",
  "GET /v1/orgs/:id",
  "PUT /v1/orgs/:id",
  "DELETE /v1/orgs/:id",
  "GET /v1/orgs/:id/events",
  "GET /v1/projects",
  "POST /v1/projects",
  "GET /v1/projects/:id",
  "PUT /v1/projects/:id",
  "DELETE /v1/projects/:id",
  "GET /v1/projects/:id/events",
  "GET /v1/builds",
  "POST /v1/builds",
  "GET /v1/builds/:id",
  "PUT /v1/builds/:id",
  "DELETE /v1/builds/:id",
  "GET /v1/builds/:id/events",
  "GET /v1/repos",
  "POST /v1/repos",
  "GET /v1/repos/:id",
  "PUT /v1/repos/:id",
  "DELETE /v1/repos/:id",
  "GET /v1/repos/:id/events",
  "GET /v1/issues",
  "POST /v1/issues",
  "GET /v1/issues/:id",
  "PUT /v1/issues/:id",
  "DELETE /v1/issues/:id",
  "GET /v1/issues/:id/events",
  "GET /v1/pulls",
  "POST /v1/pulls",
  "GET /v1/pulls/:id",
  "PUT /v1/pulls/:id",
  "DELETE /v1/pulls/:id",
  "GET /v1/pulls/:id/events",
  "GET /v1/teams",
  "POST /v1/teams",
  "GET /v1/teams/:id",
  "PUT /v1/teams/:id",
  "DELETE /v1/teams/:id",
  "GET /v1/teams/:id/events",
  "GET /v1/keys",
  "POST /v1/keys",
  "GET /v1/keys/:id",
  "PUT /v1/keys/:id",
  "DELETE /v1/keys/:id",
  "GET /v1/keys/:id/events",
  "GET /v1/hooks",
  "POST /v1/hooks",
  "GET /v1/hooks/:id",
  "PUT /v1/hooks/:id",
  "DELETE /v1/hooks/:id",
  "GET /v1/hooks/:id/events",
  "GET /v1/releases",
  "POST /v1/releases",
  "GET /v1/releases/:id",
  "PUT /v1/releases/:id",
  "DELETE /v1/releases/:id",
  "GET /v1/releases/:id/events",
  "GET /v1/packages",
  "POST /v1/packages",
  "GET /v1/packages/:id",
  "PUT /v1/packages/:id",
  "DELETE /v1/packages/:id",
  "GET /v1/packages/:id/events",
  "GET /v1/gists",
  "POST /v1/gists",
  "GET /v1/gists/:id",
  "PUT /v1/gists/:id",
  "DELETE /v1/gists/:id",
  "GET /v1/gists/:id/events",
  "GET /v1/events",
  "POST /v1/events",
  "GET /v1/events/:id",
  "PUT /v1/events/:id",
  "DELETE /v1/events/:id",
  "GET /v1/events/:id/events",
  "GET /v1/orgs/:org/members",
  "GET /v1/orgs/:org/members/:user",
  "DELETE /v1/orgs/:org/members/:user",
  "GET /v1/orgs/:org/teams/:team",
  "GET /v1/orgs/:org/teams/:team/members",
  "GET /v1/orgs/:org/projects/:project",
  "PATCH /v1/orgs/:org/projects/:project",
  "GET /v1/orgs/:org/projects/:project/settings",
  "GET /v1/orgs/:org/projects/:project/builds",
  "POST /v1/orgs/:org/projects/:project/builds",
  "GET /v1/orgs/:org/projects/:project/builds/:build",
  "DELETE /v1/orgs/:org/projects/:project/builds/:build",
  "GET /v1/orgs/:org/projects/:project/builds/:build/artifacts",
  "GET /v1/orgs/:org/projects/:project/builds/:build/logs/*",
  "GET /v1/repos/:owner/:repo",
  "GET /v1/repos/:owner/:repo/issues",
  "GET /v1/repos/:owner/:repo/issues/:number",
  "GET /v1/repos/:owner/:repo/issues/:number/comments",
  "GET /v1/repos/:owner/:repo/pulls/:number/files",
  "GET /v1/repos/:owner/:repo/contents/*",
  "GET /v2/users/:id",
  "GET /v2/users/:id/keys/:key",
]

/** The rotating targets, each answered by one of the deep routes above. */
const TARGETS = (): string[] => [
  "/v1/orgs/acme/projects/web/builds/4211/logs/step/3.txt",
  "/v1/repos/nish/compiler/issues/721/comments",
  "/v1/orgs/acme/projects/api/builds/97/artifacts",
  "/v2/users/u-42/keys/k-7",
]

const LOOKUPS: i32 = 200000
const ROUNDS: i32 = 15
const SLASH: i32 = 47
const LITERAL: i32 = 0
const PARAM: i32 = 1
const WILD: i32 = 2

/**
 * The same table, as a linear scan keeps it: per route its method and its
 * segments, each a kind and, for a literal, a label in `labels`.
 */
class LinearTable {
  methods: string[]
  segFirst: i32[]
  segCount: i32[]
  kind: i32[]
  labelStart: i32[]
  labelEnd: i32[]
  labels: u8[]

  constructor() {
    this.methods = []
    this.segFirst = []
    this.segCount = []
    this.kind = []
    this.labelStart = []
    this.labelEnd = []
    this.labels = []
  }

  add(method: string, pattern: string): void {
    this.methods.push(method)
    this.segFirst.push(toI32(this.kind.length))
    let count: i32 = 0
    let start: i32 = 1
    const length: i32 = toI32(pattern.length)
    for (let i: i32 = 1; i <= length; i++) {
      if (i < length && toI32(pattern.charCodeAt(i)) !== SLASH) {
        continue
      }
      const first: i32 = start < length ? toI32(pattern.charCodeAt(start)) : 0
      let kind: i32 = LITERAL
      if (first === 58) {
        kind = PARAM
      } else if (first === 42 && i - start === 1) {
        kind = WILD
      }
      this.kind.push(kind)
      this.labelStart.push(toI32(this.labels.length))
      for (let k: i32 = start; k < i; k++) {
        this.labels.push(toU8(toI32(pattern.charCodeAt(k))))
      }
      this.labelEnd.push(toI32(this.labels.length))
      count += 1
      start = i + 1
    }
    this.segCount.push(count)
  }
}

/** Whether `method` spells `text`. */
const sameMethod = (method: u8[], text: string): boolean => {
  if (toI32(method.length) !== toI32(text.length)) {
    return false
  }
  for (let k: i32 = 0; k < toI32(method.length); k++) {
    if (toI32(method[k]) !== toI32(text.charCodeAt(k))) {
      return false
    }
  }
  return true
}

/** The first route of `t` that `method target` reaches, its pairs in `params`, or -1. */
const linearMatch = (t: LinearTable, method: u8[], target: u8[], params: i32[]): i32 => {
  const end: i32 = toI32(target.length)
  for (let r: i32 = 0; r < toI32(t.methods.length); r++) {
    if (!sameMethod(method, t.methods[r])) {
      continue
    }
    let pos: i32 = 1
    let pairs: i32 = 0
    let ok = true
    let rest = false
    const first: i32 = t.segFirst[r]
    for (let s: i32 = first; s < first + t.segCount[r] && ok; s++) {
      if (pos > end) {
        ok = false
        break
      }
      let e: i32 = pos
      while (e < end && toI32(target[e]) !== SLASH) {
        e += 1
      }
      const kind: i32 = t.kind[s]
      if (kind === WILD) {
        params[2 * pairs] = pos
        params[2 * pairs + 1] = end
        pairs += 1
        rest = true
        break
      }
      if (kind === PARAM) {
        if (e === pos) {
          ok = false
          break
        }
        params[2 * pairs] = pos
        params[2 * pairs + 1] = e
        pairs += 1
      } else {
        const at: i32 = t.labelStart[s]
        if (t.labelEnd[s] - at !== e - pos) {
          ok = false
          break
        }
        for (let k: i32 = 0; k < e - pos; k++) {
          if (t.labels[at + k] !== target[pos + k]) {
            ok = false
            break
          }
        }
      }
      pos = e + 1
    }
    if (ok && (rest || pos === end + 1)) {
      return r
    }
  }
  return -1
}

/** `linearMatch`, byte for byte: the noise band's other half. */
const linearMatchCopy = (t: LinearTable, method: u8[], target: u8[], params: i32[]): i32 => {
  const end: i32 = toI32(target.length)
  for (let r: i32 = 0; r < toI32(t.methods.length); r++) {
    if (!sameMethod(method, t.methods[r])) {
      continue
    }
    let pos: i32 = 1
    let pairs: i32 = 0
    let ok = true
    let rest = false
    const first: i32 = t.segFirst[r]
    for (let s: i32 = first; s < first + t.segCount[r] && ok; s++) {
      if (pos > end) {
        ok = false
        break
      }
      let e: i32 = pos
      while (e < end && toI32(target[e]) !== SLASH) {
        e += 1
      }
      const kind: i32 = t.kind[s]
      if (kind === WILD) {
        params[2 * pairs] = pos
        params[2 * pairs + 1] = end
        pairs += 1
        rest = true
        break
      }
      if (kind === PARAM) {
        if (e === pos) {
          ok = false
          break
        }
        params[2 * pairs] = pos
        params[2 * pairs + 1] = e
        pairs += 1
      } else {
        const at: i32 = t.labelStart[s]
        if (t.labelEnd[s] - at !== e - pos) {
          ok = false
          break
        }
        for (let k: i32 = 0; k < e - pos; k++) {
          if (t.labels[at + k] !== target[pos + k]) {
            ok = false
            break
          }
        }
      }
      pos = e + 1
    }
    if (ok && (rest || pos === end + 1)) {
      return r
    }
  }
  return -1
}

/** What a lookup answered, folded: the route and all four of its pairs. */
const fold = (route: i32, params: i32[]): i64 =>
  toI64(route) * 1000003 +
  toI64(params[0] + 7 * params[1] + 31 * params[2] + 127 * params[3]) +
  toI64(509 * params[4] + 2039 * params[5] + 8191 * params[6] + 32749 * params[7])

const routerRun = (router: Router, method: u8[], targets: u8[][], params: i32[]): i64 => {
  let sum: i64 = 0
  for (let i: i32 = 0; i < LOOKUPS; i++) {
    const target = targets[i % 4]
    const route = router.match(method, 0, toI32(method.length), target, 0, toI32(target.length), params)
    sum += fold(route, params)
  }
  return sum
}

const linearRun = (t: LinearTable, method: u8[], targets: u8[][], params: i32[]): i64 => {
  let sum: i64 = 0
  for (let i: i32 = 0; i < LOOKUPS; i++) {
    const target = targets[i % 4]
    sum += fold(linearMatch(t, method, target, params), params)
  }
  return sum
}

const linearRunCopy = (t: LinearTable, method: u8[], targets: u8[][], params: i32[]): i64 => {
  let sum: i64 = 0
  for (let i: i32 = 0; i < LOOKUPS; i++) {
    const target = targets[i % 4]
    sum += fold(linearMatchCopy(t, method, target, params), params)
  }
  return sum
}

/** The median of `xs`, sorted in place. */
const median = (xs: i64[]): i64 => {
  for (let i: i32 = 1; i < toI32(xs.length); i++) {
    const x = xs[i]
    let j: i32 = i - 1
    while (j >= 0 && xs[j] > x) {
      xs[j + 1] = xs[j]
      j -= 1
    }
    xs[j + 1] = x
  }
  const middle: i32 = toI32(xs.length) >> 1
  return xs[middle]
}

/** Nanoseconds per lookup, to a tenth. */
const perLookup = (total: i64): string => {
  const tenths: i64 = (total * 10) / toI64(LOOKUPS)
  return `${tenths / 10}.${tenths % 10}`
}

export const main = (): i32 => {
  const rows = routeTable()
  const router = new Router(new RouterLimits())
  const table = new LinearTable()
  for (let r: i32 = 0; r < toI32(rows.length); r++) {
    const row = rows[r]
    const space: i32 = toI32(row.indexOf(" "))
    const method = row.substring(0, space)
    const pattern = row.substring(space + 1, row.length)
    if (router.add(method, pattern) !== r) {
      panic(`router.ts: ${row} was refused`)
    }
    table.add(method, pattern)
  }
  const names = TARGETS()
  const targets: u8[][] = []
  for (let k: i32 = 0; k < toI32(names.length); k++) {
    targets.push(httpFieldBytes(names[k]))
  }
  const method = httpFieldBytes("GET")
  const params: i32[] = [0, 0, 0, 0, 0, 0, 0, 0]
  const check: i32[] = [0, 0, 0, 0, 0, 0, 0, 0]
  for (let k: i32 = 0; k < toI32(targets.length); k++) {
    const target = targets[k]
    const a = router.match(method, 0, toI32(method.length), target, 0, toI32(target.length), params)
    const b = linearMatch(table, method, target, check)
    if (a < 0 || a !== b || fold(a, params) !== fold(b, check)) {
      panic(`router.ts: ${names[k]} is route ${a} to the router and ${b} to the scan`)
    }
  }

  const routerNs: i64[] = []
  const linearNs: i64[] = []
  const copyNs: i64[] = []
  let checksum: i64 = 0
  for (let round: i32 = 0; round < ROUNDS; round++) {
    const a = monotonicNanos()
    checksum += routerRun(router, method, targets, params)
    const b = monotonicNanos()
    checksum += linearRun(table, method, targets, params)
    const c = monotonicNanos()
    checksum += linearRunCopy(table, method, targets, params)
    const d = monotonicNanos()
    routerNs.push(b - a)
    linearNs.push(c - b)
    copyNs.push(d - c)
  }
  const rMed = median(routerNs)
  const lMed = median(linearNs)
  const cMed = median(copyNs)
  console.log(
    `routes ${rows.length}, nodes ${router.nodeCount()}, ${LOOKUPS} lookups a round, ${ROUNDS} rounds`
  )
  console.log(`router       min ${perLookup(routerNs[0])} ns  median ${perLookup(rMed)} ns`)
  console.log(`linear       min ${perLookup(linearNs[0])} ns  median ${perLookup(lMed)} ns`)
  console.log(`linear copy  min ${perLookup(copyNs[0])} ns  median ${perLookup(cMed)} ns`)
  const band: i64 = lMed > cMed ? lMed - cMed : cMed - lMed
  console.log(`noise band   ${(band * 1000) / lMed} per mille of linear`)
  console.log(`linear/router ${toF64(lMed) / toF64(rMed)}`)
  console.log(`checksum ${checksum}`)
  return 0
}
