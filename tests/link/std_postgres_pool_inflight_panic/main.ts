// A pooled connection's maxInFlight over 1024 is a programming error: the
// constructor panics rather than size every slot's ring by it.
// docs/security/postgres.md, "Panic sites".
import { PgConfig, PgPool } from "nish/net/postgres";
import { secret, wipe } from "nish:secret";

const make = (maxInFlight: i32): PgPool => {
  const config = new PgConfig();
  config.user = "app";
  config.maxInFlight = maxInFlight;
  const password = secret(new Array<u8>(2));
  const pool = new PgPool(config, password, 1, 1);
  wipe(password);
  return pool;
};

export const main = (): i32 => {
  make(1024);
  console.log("maxInFlight 1024 made");
  make(1025);
  console.log("not reached");
  return 0;
};
