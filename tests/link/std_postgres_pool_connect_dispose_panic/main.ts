// PgPool.connect after dispose is a programming error: the password it would
// authenticate with is wiped, so it panics rather than make a connection that
// cannot log in. docs/security/postgres.md, "Panic sites".
import { PgConfig, PgPool } from "nish/net/postgres";
import { secret, wipe } from "nish:secret";

export const main = (): i32 => {
  const config = new PgConfig();
  config.user = "app";
  const password = secret(new Array<u8>(2));
  const pool = new PgPool(config, password, 1, 1);
  wipe(password);
  pool.request();
  pool.dispatch();
  pool.dispose();
  const slot: i32 = pool.wanted();
  console.log(`the slot is ${slot === 0 ? "wanted" : "not wanted"} after dispose`);
  pool.connect(slot, new Array<u8>(18));
  console.log("not reached");
  return 0;
};
