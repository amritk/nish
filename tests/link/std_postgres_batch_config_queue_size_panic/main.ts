// A PgBatchConfig queueSize of 0 panics: the queue could hold no request.
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
  c.queueSize = 1;
  console.log(`the smallest queueSize ${new PgBatcher(c).waiting()}`);
  c.queueSize = 0;
  new PgBatcher(c);
  console.log("not reached");
  return 0;
};
