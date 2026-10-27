// A PgBatchConfig with an empty select panics rather than prepare a
// statement with no query in it.
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
  c.select = "select 1";
  console.log(`a select ${new PgBatcher(c).waiting()}`);
  c.select = "";
  new PgBatcher(c);
  console.log("not reached");
  return 0;
};
