// WP66 S3: an opaque class has no members, so none is written.
declare class Db {}
declare function db_open(flags: i32): Db | null;
declare function db_close(db: Db): void;

export const main = (): i32 => {
  const db = db_open(1);
  if (db === null) {
    return 1;
  }
  db.x = 1;
  return 0;
};
