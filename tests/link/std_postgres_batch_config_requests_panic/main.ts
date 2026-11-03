// A PgBatchConfig maxRequests over 65536 panics: past it, one execution's
// key array, which the server reads whole, would pass a few MiB.
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
  c.maxRequests = 65536;
  console.log(`the most requests ${new PgBatcher(c).waiting()}`);
  c.maxRequests = 65537;
  new PgBatcher(c);
  console.log("not reached");
  return 0;
};
