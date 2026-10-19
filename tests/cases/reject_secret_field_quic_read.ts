// A `QuicConnection`'s 1-RTT traffic secrets are `Secret` fields: picking one
// by the suite's width as a value is refused, so no alias outlives the
// connection's `wipe()`.
import { QuicConnection } from "nish/net/quic";
import { Secret } from "nish:secret";
const readSecretOf = (conn: QuicConnection, wide: boolean): Secret<u8[]> =>
  wide ? conn.readSecret384 : conn.readSecret256;
export const main = (): i32 => 0;
