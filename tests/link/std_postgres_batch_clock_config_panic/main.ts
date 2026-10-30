// A PgBatchClockConfig setting out of range panics: a factor over 64 would
// ask a backlog for more than any batch can be.
// docs/security/postgres.md, "Panic sites".
import { PgBatchClock, PgBatchClockConfig } from "nish/net/postgres";

export const main = (): i32 => {
  const c = new PgBatchClockConfig();
  c.factor = 64.0;
  console.log(`the largest factor ${new PgBatchClock(c).target()}`);
  c.factor = 64.5;
  new PgBatchClock(c);
  console.log("not reached");
  return 0;
};
