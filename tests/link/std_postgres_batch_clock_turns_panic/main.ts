// PgBatchTurns.finished on a slot holding no batch panics: the program would
// count a connection free twice.
// docs/security/postgres.md, "Panic sites".
import { PgBatchClock, PgBatchClockConfig, PgBatchTurns } from "nish/net/postgres";

export const main = (): i32 => {
  const t = new PgBatchTurns(new PgBatchClock(new PgBatchClockConfig()), 2);
  t.push(toI64(0));
  t.started(0, 1, toI64(1));
  t.finished(0, toI64(2));
  console.log("slot 0 finished");
  t.finished(0, toI64(3));
  console.log("not reached");
  return 0;
};
