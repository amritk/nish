// PgPool.connect on a slot the pool did not ask for is a programming error:
// it panics rather than replace a live connection and lose its requests.
// docs/security/postgres.md, "Panic sites".
import { PgConfig, PgPool } from "nish/net/postgres";
import { secret, wipe } from "nish:secret";

export const main = (): i32 => {
  const config = new PgConfig();
  config.user = "app";
  const password = secret(new Array<u8>(2));
  const pool = new PgPool(config, password, 2, 1);
  wipe(password);
  const nonce: u8[] = new Array<u8>(18);
  pool.request();
  pool.dispatch();
  pool.connect(pool.wanted(), nonce);
  console.log("the wanted slot connected");
  pool.connect(0, nonce);
  console.log("not reached");
  return 0;
};
