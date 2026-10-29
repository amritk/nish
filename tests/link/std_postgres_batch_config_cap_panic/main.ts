// A PgBatchConfig cap out of range panics: maxBytes below 22 could
// never hold the widest int8 key.
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
  c.maxBytes = 22;
  console.log(`the smallest maxBytes ${new PgBatcher(c).waiting()}`);
  c.maxBytes = 21;
  new PgBatcher(c);
  console.log("not reached");
  return 0;
};
