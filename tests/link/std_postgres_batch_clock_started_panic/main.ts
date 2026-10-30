// PgBatchClock.started with more items than are waiting panics: the program's
// mirror of its queue has slipped.
// docs/security/postgres.md, "Panic sites".
import { PgBatchClock, PgBatchClockConfig } from "nish/net/postgres";

export const main = (): i32 => {
  const c = new PgBatchClock(new PgBatchClockConfig());
  c.arrived(toI64(0));
  c.started(1, toI64(5));
  console.log(`one started, none waits ${c.waiting()}`);
  c.started(1, toI64(6));
  console.log("not reached");
  return 0;
};
