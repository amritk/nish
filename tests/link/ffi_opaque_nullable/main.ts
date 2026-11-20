// WP66 S3: a `Db | null` is narrowed before it is passed where a `Db`
// is wanted.
declare class Db {}
declare function db_open(flags: i32): Db | null;
declare function db_close(db: Db): void;

export const main = (): i32 => {
  const db = db_open(1);
  db_close(db);
  return 0;
};
