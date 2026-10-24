import { PgConfig, PgConnection, PG_NEED_MORE } from "nish/net/postgres";
import { secret, wipe } from "nish:secret";
import { Suite } from "nish/testing";

export const main = (): number => {
  const t = new Suite("postgres");
  const config = new PgConfig();
  config.user = "app";
  const nonce: u8[] = new Array<u8>(18);
  const password = secret(new Array<u8>(4));
  const conn = new PgConnection(config, password, nonce);
  wipe(password);
  t.eqI32("starts needing input", conn.next(), PG_NEED_MORE);
  return t.done();
};
