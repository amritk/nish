// `receive` panics on a window outside its source rather than reading past it,
// as `received` does on a count past `inputRoom()`. docs/security/postgres.md, PG-1.
import { PgConfig, PgConnection } from "nish/net/postgres";
import { secret, wipe } from "nish:secret";

export const main = (): i32 => {
  const config = new PgConfig();
  config.user = "app";
  const nonce: u8[] = new Array<u8>(18);
  const password = secret(new Array<u8>(2));
  const conn = new PgConnection(config, password, nonce);
  wipe(password);
  const src: u8[] = new Array<u8>(8);
  console.log(`in bounds ${conn.receive(src, 2, 6)}`);
  conn.receive(src, 4, 6);
  console.log("not reached");
  return 0;
};
