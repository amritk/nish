// A PgBatchConfig with an empty name panics rather than prepare the unnamed statement.
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
  c.name = "t";
  console.log(`a one-letter name ${new PgBatcher(c).waiting()}`);
  c.name = "";
  new PgBatcher(c);
  console.log("not reached");
  return 0;
};
