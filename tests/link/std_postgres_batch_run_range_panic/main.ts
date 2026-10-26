// A run number past PgBatchConfig.runs panics: there is no such run.
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
  c.runs = 2;
  const b = new PgBatcher(c);
  console.log(`the last run ${b.next(1)}`);
  b.next(2);
  console.log("not reached");
  return 0;
};
