// A PgBatchConfig maxRequests over 1024 panics: it bounds the slots one
// take probes, maxRequests^2 / 2 at worst.
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
  c.maxRequests = 1024;
  console.log(`the most requests ${new PgBatcher(c).waiting()}`);
  c.maxRequests = 1025;
  new PgBatcher(c);
  console.log("not reached");
  return 0;
};
