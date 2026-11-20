// WP66 S3: an opaque class lives where a `CPtr` may, so a function this
// program defines does not take one.
declare class Db {}
declare function db_open(flags: i32): Db | null;
declare function db_close(db: Db): void;

const finish = (db: Db): void => {
  db_close(db);
};

export const main = (): i32 => {
  const db = db_open(1);
  if (db === null) {
    return 1;
  }
  finish(db);
  return 0;
};
