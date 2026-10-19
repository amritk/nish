// A `TlsServer`'s ephemeral key is a `Secret`: printing it is refused.
import { TlsServer } from "nish/net/tls";
const leak = (server: TlsServer): i32 => {
  console.log(server.ephemeral);
  return 0;
};
export const main = (): i32 => 0;
