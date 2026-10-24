// PgPool.next on a slot past the pool's size is a programming error: it
// panics, as connection does, rather than index outside the slots.
// docs/security/postgres.md, "Panic sites".
import { PG_NEED_MORE } from "nish/net/postgres";
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
  console.log(`slot 0 has ${pool.next(0) === PG_NEED_MORE ? "nothing yet" : "an event"}`);
  pool.next(2);
  console.log("not reached");
  return 0;
};
