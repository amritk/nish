// A `TlsServer`'s ephemeral key is a readonly `Secret` field: replacing it is refused.
import { TlsServer } from "nish/net/tls";
import { secret } from "nish:secret";
const swap = (server: TlsServer): i32 => {
  server.ephemeral = secret(new Array<u8>(32));
  return 0;
};
export const main = (): i32 => 0;
