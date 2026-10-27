// A PgBatchConfig runs over 1024 panics: it bounds the run handles, runs * 2^20.
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
  c.runs = 1024;
  console.log(`the most runs ${new PgBatcher(c).waiting()}`);
  c.runs = 1025;
  new PgBatcher(c);
  console.log("not reached");
  return 0;
};
