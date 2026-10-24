// A PgConfig without a user is a programming error: the constructor panics
// rather than send a startup message the server must refuse.
// docs/security/postgres.md, "Panic sites".
import { PgConfig, PgConnection } from "nish/net/postgres";
import { secret, wipe } from "nish:secret";

const connect = (user: string): PgConnection => {
  const config = new PgConfig();
  config.user = user;
  const password = secret(new Array<u8>(2));
  const conn = new PgConnection(config, password, new Array<u8>(18));
  wipe(password);
  return conn;
};

export const main = (): i32 => {
  console.log(`a one-letter user ${connect("a").canSend() ? "ready" : "starting"}`);
  connect("");
  console.log("not reached");
  return 0;
};
