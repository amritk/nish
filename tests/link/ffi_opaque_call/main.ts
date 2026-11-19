// WP66 S3: an opaque class has no methods; it is passed to the
// `declare function`s that take it.
declare class Db {}
declare function db_open(flags: i32): Db | null;
declare function db_close(db: Db): void;

export const main = (): i32 => {
  const db = db_open(1);
  if (db === null) {
    return 1;
  }
  db.close();
  return 0;
};
