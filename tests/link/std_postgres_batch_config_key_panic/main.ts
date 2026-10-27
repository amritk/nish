// A PgBatchConfig keyType that is neither PG_BATCH_INT nor PG_BATCH_TEXT
// panics rather than bind keys of a type the statement does not name.
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
  c.keyType = 1;
  console.log(`a text batcher ${new PgBatcher(c).waiting()}`);
  c.keyType = 2;
  new PgBatcher(c);
  console.log("not reached");
  return 0;
};
