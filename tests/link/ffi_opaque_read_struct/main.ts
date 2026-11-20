// WP66 S3: an opaque class has no fields, so `readStruct` cannot copy into one.
import { readStruct } from "nish:unsafe";

declare class Db {}
declare function db_raw(flags: i32): CPtr;
declare function db_close(db: Db): void;

export const main = (): i32 => {
  const db: Db = readStruct(db_raw(1));
  db_close(db);
  return 0;
};
