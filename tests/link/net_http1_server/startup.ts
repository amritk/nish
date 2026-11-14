// What `Http1Server` costs before its first connection and what each idle
// connection holds, for the ceilings `HTTP1_SERVER_START_BYTES` and
// `HTTP1_SERVER_IDLE_BYTES` in `tests/runtime-budgets.js`, which `tests/run.js`
// holds this program's answer to: a pool of 16,384 slots on the default
// `Http1Config`, built on no socket, then the one connection `connection(0)`
// builds for a slot never accepted into, then a second connection built as
// the server builds a slot's, on its outputs, input and head pools and `Date`,
// that serves four
// keep-alive GETs and parks. Slot 0's connection serves the same requests
// first, so what the pool and the `Date` keep for every connection is not
// counted against the second. It prints `<the pool's bytes> <that
// connection's bytes> <one chunk> <the idle connection's bytes>`, the bytes
// read from `Arena.used()`, which counts within the current chunk only: the
// third field says whether the pool and the idle connection each fit in the
// chunk they started in, without which their counts mean nothing.
import { H1_END, H1_NEED_MORE, Http1Config, Http1Connection, Http1Server } from "nish/net/http1-server"

const ascii = (text: string): u8[] => {
  const out: u8[] = []
  for (let i: i32 = 0; i < text.length; i += 1) {
    out.push(toU8(text.charCodeAt(i)))
  }
  return out
}

/** One request read, answered and sent at once, then the connection parked, as `Http1Server` serves it. */
const serve = (conn: Http1Connection, req: u8[], names: u8[][], values: u8[][], body: u8[]): boolean => {
  const len: i32 = toI32(req.length)
  if (conn.inputRoom() < len || conn.feed(req, 0, len) !== len) {
    return false
  }
  conn.headArrived(toI64(0))
  let answered: boolean = false
  let event: i32 = conn.next()
  while (event !== H1_NEED_MORE) {
    if (event === H1_END) {
      const n: i32 = toI32(body.length)
      if (conn.respond(200, names, values, n) !== 0 || conn.write(body, 0, n) !== n) {
        return false
      }
      conn.end()
      answered = true
    }
    event = conn.next()
  }
  conn.consume(conn.outputEnd - conn.outputStart)
  conn.release()
  conn.park()
  return answered && !conn.isDone() && conn.inputRoom() > 0 && !conn.wantsWrite()
}

export const main = (): i32 => {
  const config: Http1Config = new Http1Config()
  const mark: i64 = Arena.mark()
  const before: i64 = Arena.used()
  const server: Http1Server = new Http1Server(config, toI32(-1), toI32(16384))
  const built: i64 = Arena.used()
  const oneChunk: boolean = Arena.mark() - mark === built - before
  const first: Http1Connection = server.connection(toI32(0))
  const one: i64 = Arena.used() - built
  server.date.pin(toI64(1700000000) * toI64(1000))
  const req: u8[] = ascii(
    "GET /api/v1/items/42 HTTP/1.1\r\n" +
      "Host: bench.example.com:8080\r\n" +
      "User-Agent: loadgen/1.0\r\n" +
      "Accept: application/json\r\n" +
      "Accept-Encoding: gzip, deflate\r\n" +
      "\r\n"
  )
  const names: u8[][] = [ascii("content-type")]
  const values: u8[][] = [ascii("application/json")]
  const body: u8[] = ascii('{"id":42,"name":"widget","price":1999,"tags":["a","b"],"ok":true}')
  let served: boolean = true
  for (let i: i32 = 0; i < 4; i += 1) {
    served = served && serve(first, req, names, values, body)
  }
  const idleMark: i64 = Arena.mark()
  const idleBefore: i64 = Arena.used()
  const conn: Http1Connection = new Http1Connection(config, server.date)
  conn.pool = server.outputs
  if (config.idleInput) {
    conn.inputs = server.inputs
    conn.heads = server.heads
  }
  for (let i: i32 = 0; i < 4; i += 1) {
    served = served && serve(conn, req, names, values, body)
  }
  const idle: i64 = Arena.used() - idleBefore
  const idleChunk: boolean = Arena.mark() - idleMark === idle
  console.log(`${built - before} ${one} ${oneChunk && idleChunk ? "yes" : "no"} ${idle}`)
  return served && server.size() === 16384 && server.busy() === 0 ? 0 : 1
}
