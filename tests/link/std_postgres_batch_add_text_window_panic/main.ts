// addText of a window not inside its source panics rather than read past it.
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
  const key: u8[] = [toU8(97), toU8(98)];
  console.log(`the whole source ${b.addText(key, 0, 2, 1)}`);
  b.addText(key, 1, 2, 2);
  console.log("not reached");
  return 0;
};
