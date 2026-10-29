// A PgBatchConfig queueBytes under 0 panics rather than size the key store by it.
// docs/security/postgres.md, "Panic sites".
import { PgBatchConfig, PgBatcher } from "nish/net/postgres";

const ints = (): PgBatchConfig => {
  const c = new PgBatchConfig();
  c.name = "titles";
  c.select = "select title from articles where id = q.key";
  return c;
};

export const main = (): i32 => {
  const c = ints();
  c.queueBytes = 0;
  console.log(`the smallest queueBytes ${new PgBatcher(c).waiting()}`);
  c.queueBytes = -1;
  new PgBatcher(c);
  console.log("not reached");
  return 0;
};
