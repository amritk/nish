// A PgBatchConfig name with a NUL panics rather than prepare a statement under another name.
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
  c.name = "titles2";
  console.log(`a name ${new PgBatcher(c).waiting()}`);
  c.name = "titles\u0000";
  new PgBatcher(c);
  console.log("not reached");
  return 0;
};
