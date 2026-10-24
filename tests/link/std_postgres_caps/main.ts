// Pins what `nish/net/postgres` reaches: no capability at all. The module is
// sans-IO and the program owns the socket, so building a connection, framing
// its startup message and reading from it compile under `args`, which denies
// every capability; the nonce is the program's to draw. The whole
// `--emit-capabilities` report is not pinned: it names each of the module's
// panic sites by line, so it would move with every edit to it.
import { PG_NEED_MORE, PgConfig, PgConnection } from "nish/net/postgres";
import { secret, wipe } from "nish:secret";

export const main = (): i32 => {
  const config = new PgConfig();
  config.user = "app";
  const nonce: u8[] = new Array<u8>(18);
  const password = secret(new Array<u8>(0));
  const conn = new PgConnection(config, password, nonce);
  wipe(password);
  console.log(conn.outputEnd() > 0 && conn.next() === PG_NEED_MORE);
  conn.dispose();
  return 0;
};
