// A PgConfig cap out of range is a programming error: the constructor panics
// rather than run with a send buffer too small for one message, or a cap a
// length word would overflow. docs/security/postgres.md, "Panic sites".
import { PgConfig, PgConnection } from "nish/net/postgres";
import { secret, wipe } from "nish:secret";

const connect = (config: PgConfig): PgConnection => {
  const nonce: u8[] = new Array<u8>(18);
  const password = secret(new Array<u8>(2));
  const conn = new PgConnection(config, password, nonce);
  wipe(password);
  return conn;
};

export const main = (): i32 => {
  const config = new PgConfig();
  config.user = "app";
  config.maxOutput = 1024;
  console.log(`the smallest maxOutput ${connect(config).canSend() ? "ready" : "starting"}`);
  config.maxOutput = 1023;
  connect(config);
  console.log("not reached");
  return 0;
};
