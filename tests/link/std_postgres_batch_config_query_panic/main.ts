// A PgBatchConfig name or query that is empty or holds a NUL panics
// rather than prepare a statement other than the one it names.
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
  c.orderBy = "t.id";
  console.log(`ordered ${new PgBatcher(c).waiting()}`);
  c.orderBy = "t.id\u0000";
  new PgBatcher(c);
  console.log("not reached");
  return 0;
};
