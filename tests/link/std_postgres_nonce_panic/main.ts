// A SCRAM nonce shorter than 18 bytes is a programming error: the constructor
// panics rather than send a guessable nonce. docs/security/postgres.md,
// "Panic sites".
import { PgConfig, PgConnection } from "nish/net/postgres";
import { secret, wipe } from "nish:secret";

const connect = (bytes: i32): PgConnection => {
  const config = new PgConfig();
  config.user = "app";
  const password = secret(new Array<u8>(2));
  const conn = new PgConnection(config, password, new Array<u8>(bytes));
  wipe(password);
  return conn;
};

export const main = (): i32 => {
  console.log(`an 18-byte nonce ${connect(18).canSend() ? "ready" : "starting"}`);
  connect(17);
  console.log("not reached");
  return 0;
};
