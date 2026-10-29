// row, end or fail before next(run) has answered the events owed panics
// rather than lose them.
// docs/security/postgres.md, "Panic sites".
import { PG_READY, PgBatchConfig, PgBatcher, PgConfig, PgConnection } from "nish/net/postgres";
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

/** A connection a trust server has made ready. */
const ready = (): PgConnection => {
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
  if (conn.next() !== PG_READY) {
    console.log("not ready");
  }
  return conn;
};

const ints = (): PgBatchConfig => {
  const c = new PgBatchConfig();
  c.name = "titles";
  c.select = "select title from articles where id = q.key";
  return c;
};

export const main = (): i32 => {
  const conn = ready();
  const b = new PgBatcher(ints());
  b.addInt(toI64(1), 1);
  b.addInt(toI64(2), 2);
  const r: i32 = b.take(conn);
  b.fail(r);
  console.log(`failed ${b.next(r)} for ${b.tag}`);
  b.fail(r);
  console.log("not reached");
  return 0;
};
