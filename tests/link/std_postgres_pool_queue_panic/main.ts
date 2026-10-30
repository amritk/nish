// A PgPool queue outside 1 to 2^20 is a programming error: the constructor
// panics rather than allocate it, or refuse every request.
// docs/security/postgres.md, "Panic sites".
import { PgConfig, PgPool } from "nish/net/postgres";
import { secret, wipe } from "nish:secret";

const make = (queueSize: i32): PgPool => {
  const config = new PgConfig();
  config.user = "app";
  const password = secret(new Array<u8>(2));
  const pool = new PgPool(config, password, 1, queueSize);
  wipe(password);
  return pool;
};

export const main = (): i32 => {
  make(1048576);
  console.log("a queue of 2^20 made");
  make(0);
  console.log("not reached");
  return 0;
};
