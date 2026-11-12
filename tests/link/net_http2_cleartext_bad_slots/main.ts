// `Http2CleartextServer` refuses a pool of no slots when it is made, rather
// than clamping it to one as `Http2TlsServer` does: a server that could
// accept nobody is a mistake in its program. A server of one slot is made, and
// one of none panics in its constructor, on stderr, with
//
//     Http2CleartextServer: slots is 0; at least 1 is needed
//
// and exits 1, before it reads the listening socket. `expected.stderr` pins
// the message, so the panic is the constructor's own check.
import { Http2Config } from "nish/net/http2";
import { Http2CleartextServer } from "nish/net/http2-cleartext";

export const main = (): i32 => {
  const good = new Http2CleartextServer(new Http2Config(), toI32(-1), toI32(1), toI32(10000));
  console.log(`one slot makes a server of ${good.size()} slot, ${good.busy()} busy`);
  console.log(`unreachable: ${new Http2CleartextServer(new Http2Config(), toI32(-1), toI32(0), toI32(10000)).size()}`);
  return 0;
};
