// `Http2CleartextServer` refuses a `prefaceTimeout` below one millisecond
// when it is made: with none, `expire` would close every client before its
// first byte, and a negative one would never close a slow preface at all. A
// server of a one-millisecond timeout is made, and one of none panics in its
// constructor, on stderr, with
//
//     Http2CleartextServer: prefaceTimeout is 0 ms; at least 1 is needed
//
// and exits 1. `expected.stderr` pins the message.
import { Http2Config } from "nish/net/http2";
import { Http2CleartextServer } from "nish/net/http2-cleartext";

export const main = (): i32 => {
  const good = new Http2CleartextServer(new Http2Config(), toI32(-1), toI32(4), toI32(1));
  console.log(`a one-millisecond timeout makes a server of ${good.size()} slots`);
  console.log(`unreachable: ${new Http2CleartextServer(new Http2Config(), toI32(-1), toI32(4), toI32(0)).size()}`);
  return 0;
};
