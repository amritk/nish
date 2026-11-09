// The TechEmpower json and plaintext answers as a `serve` handler, the async
// twin of server.ts, shared by `async-main.ts` and the verifier checks in
// tests/link/tfb_async_entry.
//
//   GET /json       {"message":"Hello, World!"}, application/json, written by
//                   a `JsonWriter` on every request: TFB forbids caching the
//                   serialization
//   GET /plaintext  Hello, World!, text/plain
//   anything else   404, `not found`, text/plain
//
// `serve` adds `Date` and `Content-Length`, answers a request the parser
// refuses 400 with `Connection: close`, and answers pipelined requests in
// order. Each request runs in a task of its own, and the task's buffers live
// in its region, so the body it answers is made per request.
import { Router, RouterLimits } from "nish/net/router"
import { Request, Response, ServeLimits } from "nish/net/serve"
import { JsonWriter } from "nish/json"

/** The routes, in the order `tfbRouter` adds them. */
const TFB_PLAINTEXT: i32 = 0
const TFB_JSON: i32 = 1
/** Room for the JSON answer, which is 27 bytes, and for every other body. */
const TFB_BODY_ROOM: i32 = 64

/** A string's bytes: the handler's strings are ASCII. */
const tfbAsyncBytes = (s: string): u8[] => {
  const out: u8[] = new Array<u8>(s.length)
  for (let k: i32 = 0; k < toI32(s.length) && k < toI32(out.length); k++) {
    out[k] = toU8(s.charCodeAt(k))
  }
  return out
}

/** A text/plain answer of `s` with `status`. */
const tfbText = (status: i32, s: string): Response =>
  new Response(status).bytes("text/plain", tfbAsyncBytes(s), toI32(0), toI32(s.length))

/** The two routes TFB asks for. */
export const tfbRouter = (): Router => {
  const router: Router = new Router(new RouterLimits())
  router.add("GET", "/plaintext")
  router.add("GET", "/json")
  return router
}

/**
 * The caps for a pool of `size` connections, at least one. At most one
 * request per connection is in flight, so `inFlight` matches the pool and no
 * request the explicit entry answers is answered 503. No task carries a
 * deadline: the explicit entry has none, and one is a timer per request.
 */
export const tfbLimits = (size: i32): ServeLimits => {
  const limits: ServeLimits = new ServeLimits()
  limits.connections = size < 1 ? 1 : size
  limits.inFlight = limits.connections
  limits.responseBytes = TFB_BODY_ROOM
  limits.deadline = 0
  return limits
}

/** TFB's answer to `req`: /plaintext, /json, or 404 for any other method or path. */
// biome-ignore lint/suspicious/useAwait: `serveOn` takes an async handler, and these answers wait on nothing
export const tfbHandle = async (req: Request): Promise<Response> => {
  switch (req.route) {
    case TFB_PLAINTEXT:
      return tfbText(200, "Hello, World!")
    case TFB_JSON: {
      const buf: u8[] = new Array<u8>(TFB_BODY_ROOM)
      const w: JsonWriter = new JsonWriter(buf, toI32(0))
      w.beginObject()
      w.key("message")
      w.string("Hello, World!")
      w.endObject()
      return new Response(200).bytes("application/json", buf, toI32(0), w.end)
    }
    default:
      return tfbText(404, "not found")
  }
}
