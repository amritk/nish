// PgBatcher.takeDue with a clock that does not mirror the batcher panics: a
// request added without `clock.arrived` would never be timed.
// docs/security/postgres.md, "Panic sites".
import { PgBatchClock, PgBatchClockConfig, PgBatchConfig, PgBatcher, PgConfig, PgConnection } from "nish/net/postgres";
import { secret, wipe } from "nish:secret";

const z = (text: string): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

export const main = (): i32 => {
  const bc = new PgBatchConfig();
  bc.name = "titles";
  bc.select = "select title from articles where id = q.key";
  const b = new PgBatcher(bc);
  const config = new PgConfig();
  config.user = "app";
  const password = secret(z("pw"));
  const conn = new PgConnection(config, password, z("nish-postgres-test"));
  wipe(password);
  b.addInt(toI64(1), 0);
  console.log("a request the clock never saw");
  b.takeDue(conn, new PgBatchClock(new PgBatchClockConfig()), toI64(0), 0);
  console.log("not reached");
  return 0;
};
