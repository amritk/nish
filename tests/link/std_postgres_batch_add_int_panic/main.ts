// addInt on a text batcher panics rather than queue a key of the wrong type.
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
  const b = new PgBatcher(c);
  console.log(`addText ${b.addText([toU8(97)], 0, 1, 1)}`);
  b.addInt(toI64(1), 2);
  console.log("not reached");
  return 0;
};
