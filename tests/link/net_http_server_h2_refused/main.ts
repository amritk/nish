// A field the HTTP/2 carrier refuses panics: here `connection`, which HTTP/2
// forbids, on a request taken over h2c.
import { secret, wipe } from "nish:secret"
import { H2_FLAG_END_STREAM } from "nish/net/http2-frame"
import { n32 } from "../net_quic_frame/typed"
import { leafPrivate } from "../net_tls_common/server"
import { getOf } from "../net_http2/peer"
import { rigLimits, Rig } from "../net_http_server_carriers/rig"
import { H2cClient } from "../net_http_server_carriers/client"
import { ascii, ZERO } from "../net_tls_record_common/bytes"

export const main = (): i32 => {
  const key = secret(leafPrivate())
  const rig = new Rig(rigLimits(4), false, 1)
  const c = new H2cClient(rig)
  c.connect(rig.h2.h2cPort)
  c.wire.preface()
  const none: i32[] = []
  const noValues: i64[] = []
  c.wire.settings(none, noValues)
  c.wire.settingsAck()
  c.wire.headers(n32(1), getOf("/hello"), H2_FLAG_END_STREAM)
  c.flush(key)
  const names: u8[][] = [ascii("connection")]
  const values: u8[][] = [ascii("close")]
  for (let turn: i32 = 0; turn < 1000; turn++) {
    rig.h.wait(5)
    if (rig.h.ready()) {
      rig.h.start(rig.h.take(), 200, names, values, ZERO)
      console.log("FAIL  the call returned")
      wipe(key)
      return 0
    }
  }
  wipe(key)
  console.log("FAIL  no request came")
  return 0
}
