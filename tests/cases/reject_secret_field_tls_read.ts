// A `TlsServer`'s ephemeral key is a `Secret` field: binding it to a local is refused.
import { TlsServer } from "nish/net/tls";
import { wipe } from "nish:secret";
const leak = (server: TlsServer): i32 => {
  const k = server.ephemeral;
  wipe(k);
  return 0;
};
export const main = (): i32 => 0;
