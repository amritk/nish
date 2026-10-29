// A run handle of -1, take's answer when it took nothing, panics: the program
// routed an execution it never sent. A spent handle is answered.
// docs/security/postgres.md, "Panic sites".
import { PgBatchConfig, PgBatcher } from "nish/net/postgres";

const ints = (): PgBatchConfig => {
  const c = new PgBatchConfig();
  c.name = "titles";
  c.select = "select title from articles where id = q.key";
  return c;
};

export const main = (): i32 => {
  const b = new PgBatcher(ints());
  b.fail(0);
  console.log(`a handle never taken is spent ${b.stray}`);
  b.fail(-1);
  console.log("not reached");
  return 0;
};
