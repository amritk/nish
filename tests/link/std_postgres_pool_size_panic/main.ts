// A PgPool of more than 1024 slots is a programming error: the constructor
// panics rather than allocate them. docs/security/postgres.md, "Panic sites".
import { PgConfig, PgPool } from "nish/net/postgres";
import { secret, wipe } from "nish:secret";

const make = (size: i32, queueSize: i32): PgPool => {
  const config = new PgConfig();
  config.user = "app";
  const password = secret(new Array<u8>(2));
  const pool = new PgPool(config, password, size, queueSize);
  wipe(password);
  return pool;
};

export const main = (): i32 => {
  console.log(`a pool of ${make(1024, 1).size} slots made`);
  make(1025, 1);
  console.log("not reached");
  return 0;
};
