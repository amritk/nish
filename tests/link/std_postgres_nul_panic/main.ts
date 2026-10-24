// A startup parameter holding a NUL byte is a programming error: the
// constructor panics rather than let the byte end the parameter early and
// start another. docs/security/postgres.md, "Panic sites".
import { PgConfig, PgConnection } from "nish/net/postgres";
import { secret, wipe } from "nish:secret";

const connect = (database: string): PgConnection => {
  const config = new PgConfig();
  config.user = "app";
  config.database = database;
  const password = secret(new Array<u8>(2));
  const conn = new PgConnection(config, password, new Array<u8>(18));
  wipe(password);
  return conn;
};

export const main = (): i32 => {
  console.log(`a database without NUL ${connect("app").canSend() ? "ready" : "starting"}`);
  connect(`app${String.fromCharCode(0)}user`);
  console.log("not reached");
  return 0;
};
