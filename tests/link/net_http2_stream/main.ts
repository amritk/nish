// `Http2Connection.hold`, `consumeBody` and `settleCredit`, the stream
// flow control `HttpServer.streamBody` reads a body by, driven by the
// scripted client of `net_http2/peer.ts` with no socket. The config's
// initialWindowSize is 1024 bytes, so a WINDOW_UPDATE is owed at 512
// consumed; the output buffer is 1024 bytes too.
//
//   1. A partial consume: 100 of 600 bytes held credits nothing, the next
//      500 credit all 600, and a consume past what the stream was sent is
//      cut to it.
//   2. A consume into a full output: `consumeBody` answers H2_AGAIN and no
//      WINDOW_UPDATE goes out; once the output drains, `settleCredit` sends
//      it, and with nothing owed it answers false.
import { H2_AGAIN, Http2Config } from "nish/net/http2"
import { Suite } from "nish/testing"
import { Client, ZERO, filler, postOf } from "../net_http2/peer"

/** Streams 1, 3, 5, ... opened, each POST declaring 600 bytes. */
const STREAMS: i32 = 12

/** The `k`th stream's identifier. */
const idOf = (k: i32): i32 => k * 2 + 1

export const main = (): i32 => {
  const t = new Suite("http2 stream")
  const config = new Http2Config()
  config.outputSize = 1024
  config.initialWindowSize = 1024
  const c = new Client(config)
  c.open()
  for (let k: i32 = 0; k < STREAMS; k++) {
    c.wire.headers(idOf(k), postOf("/up", toI32(600)), ZERO)
  }
  c.send()
  c.takeEvents()
  let held: boolean = true
  for (let k: i32 = 0; k < STREAMS; k++) {
    held = c.conn.hold(idOf(k)) && held
  }
  t.ok("every stream held", held)
  for (let k: i32 = 0; k < STREAMS; k++) {
    c.wire.dataN(idOf(k), toI32(600), ZERO)
  }
  c.send()
  c.takeEvents()
  t.eqStr("arrival credits no held stream", c.takeFrames().indexOf("WINDOW_UPDATE 1 ") >= 0 ? "credited" : "", "")

  // 1. A partial consume.
  t.eqI32("100 of 600 consumed", c.conn.consumeBody(toI32(1), toI32(100)), ZERO)
  t.eqStr("below half the window: no WINDOW_UPDATE", c.takeFrames(), "")
  t.eqI32("the other 500, and 1000 past them", c.conn.consumeBody(toI32(1), toI32(1500)), ZERO)
  t.eqStr("credits the 600 sent, no more", c.takeFrames(), "WINDOW_UPDATE 1 600")
  t.eqI32("a stream owing nothing more", c.conn.consumeBody(toI32(1), toI32(600)), ZERO)
  t.eqStr("is credited nothing", c.takeFrames(), "")

  // 2. A consume into a full output: a response body fills it to the control reserve, and
  // WINDOW_UPDATEs, which do not wait for the reserve, fill that.
  c.reading = false
  const none: u8[][] = []
  c.conn.respond(toI32(1), toI32(200), none, none, false)
  c.conn.writeData(toI32(1), filler(1024), ZERO, toI32(1024), false)
  let stalled: i32 = -1
  for (let k: i32 = 1; k < STREAMS && stalled < 0; k++) {
    if (c.conn.consumeBody(idOf(k), toI32(600)) === H2_AGAIN) {
      stalled = idOf(k)
    }
  }
  t.ok("a consume with no room for its WINDOW_UPDATE: H2_AGAIN", stalled > 0)
  t.ok("nothing owed is settled before the output drains", !c.conn.settleCredit())
  const before: string = c.takeFrames()
  t.ok("the output held the other streams' WINDOW_UPDATEs", before.indexOf("WINDOW_UPDATE 3 600") >= 0)
  t.ok("but not the stalled stream's", before.indexOf(`WINDOW_UPDATE ${stalled} `) < 0)
  t.ok("once drained, settleCredit sends what was owed", c.conn.settleCredit())
  t.eqStr("the stalled stream's WINDOW_UPDATE", c.takeFrames(), `WINDOW_UPDATE ${stalled} 600`)
  t.ok("and with nothing owed, settleCredit answers false", !c.conn.settleCredit())
  return t.done()
}
