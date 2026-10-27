// A run handle past any take can give panics: PgBatchConfig.runs runs, each
// counting 2^20 takes. A spent handle inside that range is answered.
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
  console.log(`the last handle ${b.next(2 * 1048576 - 1)}`);
  b.next(2 * 1048576);
  console.log("not reached");
  return 0;
};
