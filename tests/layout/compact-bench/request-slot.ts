// The HttpServerRequest bench of docs/wp48-ref32-classes.md §5.5. No std
// class holds an `HttpServerRequest` link, so this program's own `Slot` does,
// as tests/link/net_http_server/taken.ts's `Taken` does: a slot per request
// made in a loop, a ring of 64 kept, and each slot's request read back
// through the link. The holder-only rule of #1736 picks `HttpServerRequest`
// for that one link; the stage-3 rule leaves it alone.
//
//   build/nish tests/layout/compact-bench/request-slot.ts --link build/cb-req && build/cb-req <rounds>
import { HttpServerRequest } from "nish/net/http-server"

class Slot {
  req: HttpServerRequest
  seen: i32
  status: i32 = 0
  constructor(req: HttpServerRequest, seen: i32) {
    this.req = req
    this.seen = seen
  }
}

const RING: i32 = 64

export const main = (): number => {
  const rounds: i32 = process.argv.length > 1 ? toI32(parseInt(process.argv[1])) : 1000
  const ring: Slot[] = []
  for (let k: i32 = 0; k < RING; k += 1) {
    ring.push(new Slot(new HttpServerRequest(k), 0))
  }
  let checksum: i64 = 0
  for (let i: i32 = 0; i < rounds; i += 1) {
    const at: i32 = i % RING
    const old: Slot = ring[at]
    const s = new Slot(old.req, i)
    s.req.bodyLength = (s.req.bodyLength + i) % 4096
    s.status = 200 + (s.req.bodyLength % 3)
    ring[at] = s
    checksum = (checksum * toI64(31) + toI64(s.req.index + s.req.bodyLength + s.status)) % toI64(1000000007)
  }
  console.log(`${checksum}`)
  return 0
}
