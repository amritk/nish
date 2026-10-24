// PgPool.connection on a slot with no connection is a programming error: it
// panics rather than answer one that does not exist.
// docs/security/postgres.md, "Panic sites".
import { PgConfig, PgPool } from "nish/net/postgres";
import { secret, wipe } from "nish:secret";

export const main = (): i32 => {
  const config = new PgConfig();
  config.user = "app";
  const password = secret(new Array<u8>(2));
  const pool = new PgPool(config, password, 2, 1);
  wipe(password);
  pool.request();
  pool.dispatch();
  pool.connect(pool.wanted(), new Array<u8>(18));
  console.log(`slot 0 has its connection: ${pool.connection(0).canSend() ? "ready" : "starting"}`);
  pool.connection(1);
  console.log("not reached");
  return 0;
};
