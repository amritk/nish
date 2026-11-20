// WP66 S3: only a `declare function` returns an opaque class; a function
// this program defines does not.
declare class Db {}
declare function db_open(flags: i32): Db | null;
declare function db_close(db: Db): void;

const reopen = (): Db | null => db_open(1);

export const main = (): i32 => {
  const db = reopen();
  if (db === null) {
    return 1;
  }
  db_close(db);
  return 0;
};
