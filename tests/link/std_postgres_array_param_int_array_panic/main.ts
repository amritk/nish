// paramIntArray while an array is open panics rather than writing it
// inside the array. docs/security/postgres.md, panic sites.
import { PG_READY, PgConfig, PgConnection } from "nish/net/postgres";
import { secret, wipe } from "nish:secret";

/** One message of `type` whose body is `body`, each `|` a NUL. */
const frame = (out: u8[], type: string, body: string): void => {
  out.push(toU8(type.charCodeAt(0)));
  const n: i32 = toI32(body.length) + 4;
  out.push(toU8(n >> 24));
  out.push(toU8((n >> 16) & 255));
  out.push(toU8((n >> 8) & 255));
  out.push(toU8(n & 255));
  for (let i: i32 = 0; i < toI32(body.length); i++) {
    const c: i32 = toI32(body.charCodeAt(i));
    out.push(toU8(c === 124 ? 0 : c));
  }
};

/** A connection a trust server has made ready, with a Bind open. */
const bound = (): PgConnection => {
  const config = new PgConfig();
  config.user = "app";
  const nonce: u8[] = new Array<u8>(18);
  const password = secret(new Array<u8>(2));
  const conn = new PgConnection(config, password, nonce);
  wipe(password);
  conn.sent(conn.outputEnd());
  const server: u8[] = [];
  frame(server, "R", "||||");
  frame(server, "S", "client_encoding|UTF8|");
  frame(server, "Z", "I");
  conn.receive(server, 0, toI32(server.length));
  if (conn.next() !== PG_READY || !conn.bindStart("")) {
    console.log("not ready");
  }
  return conn;
};

export const main = (): i32 => {
  const conn = bound();
  console.log(`an array ${conn.arrayStart()}`);
  const values: i64[] = [toI64(1)];
  conn.paramIntArray(values, 0, 1);
  console.log("not reached");
  return 0;
};
