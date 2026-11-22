// Route dispatch (std/net/router.ts) under an instruction count: one table of
// forty routes built once, then `n` lookups rotating through static paths the
// exact-path table answers, parameterised and `*` paths the tree answers, a
// method the route does not take and a path no route has, with one
// parameter percent-decoded by `routerDecode`. It reaches the lookups whose
// panic sites the std/ ratchet counts, so a fix to one of them shows here as
// a count that holds or falls. It prints a sum over every answer.
import { Router, RouterLimits, routerDecode } from "nish/net/router"
import { httpFieldBytes } from "nish/net/http-fields"

/** The table: one "METHOD /pattern" per route, in `Router.add` order. */
const routeTable = (): string[] => [
  "GET /",
  "GET /health",
  "GET /metrics",
  "GET /robots.txt",
  "GET /static/*",
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
  "GET /v1/projects",
  "POST /v1/projects",
  "GET /v1/projects/:id",
  "DELETE /v1/projects/:id",
  "GET /v1/builds",
  "GET /v1/builds/:id",
  "GET /v1/builds/:id/logs/*",
  "GET /v1/keys",
  "POST /v1/keys",
  "GET /v1/keys/:id",
  "DELETE /v1/keys/:id",
  "GET /v1/orgs/:org/members",
  "GET /v1/orgs/:org/members/:user",
  "DELETE /v1/orgs/:org/members/:user",
  "GET /v1/orgs/:org/projects/:project",
  "PATCH /v1/orgs/:org/projects/:project",
  "GET /v1/orgs/:org/projects/:project/builds/:build",
  "GET /v1/repos/:owner/:repo",
  "GET /v1/repos/:owner/:repo/issues/:number",
  "GET /v1/repos/:owner/:repo/contents/*",
  "GET /v2/users/:id",
  "GET /v2/users/:id/keys/:key",
  "GET /v2/search",
  "POST /v2/search",
]

/** A lookup: the method and the target, as the request head holds them. */
class Lookup {
  method: u8[]
  target: u8[]

  constructor(method: string, target: string) {
    this.method = httpFieldBytes(method)
    this.target = httpFieldBytes(target)
  }
}

/** The rotating lookups: static, parameterised, `*`, a refused method, a path no route has. */
const lookups = (): Lookup[] => [
  new Lookup("GET", "/health"),
  new Lookup("GET", "/v1/users/u-42"),
  new Lookup("POST", "/v1/projects"),
  new Lookup("GET", "/v1/orgs/acme/projects/web/builds/4211"),
  new Lookup("GET", "/static/css/site.css"),
  new Lookup("DELETE", "/v1/orgs/acme/members/jo%20ann"),
  new Lookup("GET", "/v1/repos/nish/compiler/issues/721?view=full"),
  new Lookup("GET", "/metrics"),
  new Lookup("PUT", "/v1/keys/k-7"),
  new Lookup("GET", "/v1/repos/nish/compiler/contents/src/emit.ts"),
  new Lookup("GET", "/v3/nothing/here"),
  new Lookup("GET", "/v2/users/u-9/keys/k-1"),
]

export const main = (): i32 => {
  const n: i32 = 150000 // bench:n
  const rows = routeTable()
  const router = new Router(new RouterLimits())
  for (let r: i32 = 0; r < toI32(rows.length); r++) {
    const row = rows[r]
    const space: i32 = toI32(row.indexOf(" "))
    if (router.add(row.slice(0, space), row.slice(space + 1, row.length)) !== r) {
      panic(`std-router: ${row} was refused`)
    }
  }
  const all = lookups()
  const params: i32[] = [0, 0, 0, 0, 0, 0, 0, 0]
  const decoded = new Array<u8>(64)
  let sum: i64 = 0
  for (let i: i32 = 0; i < n; i++) {
    const l = all[i % toI32(all.length)]
    const route: i32 = router.match(
      l.method,
      0,
      toI32(l.method.length),
      l.target,
      0,
      toI32(l.target.length),
      params
    )
    sum += toI64(route) * 1000003
    if (route >= 0) {
      const pairs: i32 = router.paramCount(route)
      for (let k: i32 = 0; k < 2 * pairs && k < toI32(params.length); k++) {
        sum += toI64(params[k]) * toI64(k + 1)
      }
      if (pairs > 0) {
        const last: i32 = 2 * pairs - 2
        if (last >= 0 && last + 1 < toI32(params.length)) {
          sum += toI64(routerDecode(l.target, params[last], params[last + 1], decoded))
        }
      }
    }
  }
  console.log(`${sum}`)
  return 0
}
