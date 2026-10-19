// A `TlsServer`'s ephemeral key is a readonly `Secret` field: replacing it
// is refused. This is the readonly rule (NL2181) applied to a `Secret`
// holder's field, not a rule of `Secret`'s own.
import { TlsServer } from "nish/net/tls";
import { secret } from "nish:secret";
const swap = (server: TlsServer): i32 => {
  server.ephemeral = secret(new Array<u8>(32));
  return 0;
};
export const main = (): i32 => 0;
