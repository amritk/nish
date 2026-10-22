// `Http2TlsServer` builds every slot's `Http2Connection` on the first accept
// into it but slot 0's, which its constructor still builds so that a cap
// RFC 9113 does not allow is refused when the server is made, not at a
// client's first accept. Over the same TLS configuration, a server on the
// defaults is made, and one whose SETTINGS_MAX_FRAME_SIZE is below the 16,384
// every endpoint must accept (§6.5.2) panics in its constructor, on stderr,
// with
//
//     Http2Connection: maxFrameSize of 1024, outside 16384 to 16777215
//
// and exits 1, with no socket to accept on. `expected.stderr` pins that
// message, so the panic is `Http2Connection`'s check on the cap, raised by the
// constructor building slot 0, and not a later step's.
import { Http2Config } from "nish/net/http2";
import { H2_ALPN, Http2TlsServer } from "nish/net/http2-tls";
import { tcpConfig } from "../net_tls_common/server";

export const main = (): i32 => {
  const config = new Http2Config();
  const good = new Http2TlsServer(tcpConfig([H2_ALPN]), config, toI32(-1), toI32(4));
  console.log(`the defaults make a server of ${good.size()} slots, slot 0's connection built: ${good.connections.length}`);
  config.maxFrameSize = 1024;
  console.log(`unreachable: ${new Http2TlsServer(tcpConfig([H2_ALPN]), config, toI32(-1), toI32(4)).size()}`);
  return 0;
};
