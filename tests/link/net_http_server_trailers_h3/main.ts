// Trailers on an HTTP/3 response panic: the façade sends them on HTTP/2
// only. The rig answers `GET /trailers` with a body and a trailer section.
import { secret, wipe } from "nish:secret"
import { H3_STREAM_CONTROL, H3_STREAM_QPACK_DECODER, H3_STREAM_QPACK_ENCODER, H3_FRAME_HEADERS } from "nish/net/http3-frame"
import { QpackEncoder } from "nish/net/qpack"
import { n32, n64 } from "../net_quic_frame/typed"
import { leafPrivate } from "../net_tls_common/server"
import { CLIENT_CONTROL, CLIENT_DECODER, CLIENT_ENCODER, H3Limits, h3Cat, h3ClientParams, h3ClientSettings, h3Frame, h3Section, h3Varint } from "../net_http3/peer"
import { QuicClient } from "../net_http_server_carriers/client"
import { Rig, rigLimits } from "../net_http_server_carriers/rig"

export const main = (): i32 => {
  const key = secret(leafPrivate())
  const rig = new Rig(rigLimits(n32(16)), true, toI32(4))
  const h3 = new QuicClient(rig)
  if (!h3.connect("h3", h3ClientParams(new H3Limits()), key)) {
    console.log("FAIL  no HTTP/3 connection")
    wipe(key)
    return 0
  }
  h3.send(CLIENT_CONTROL, h3Cat([h3Varint(H3_STREAM_CONTROL), h3ClientSettings(n64(-1))]), false)
  h3.send(CLIENT_ENCODER, h3Varint(H3_STREAM_QPACK_ENCODER), false)
  h3.send(CLIENT_DECODER, h3Varint(H3_STREAM_QPACK_DECODER), false)
  const fields: string[] = [":method", ":scheme", ":authority", ":path"]
  const values: string[] = ["GET", "https", "localhost", "/trailers"]
  h3.send(n64(0), h3Frame(H3_FRAME_HEADERS, h3Section(new QpackEncoder(), fields, values)), true)
  h3.turnUntil(key, n64(0), false)
  console.log("FAIL  the request was answered")
  wipe(key)
  return 0
}
