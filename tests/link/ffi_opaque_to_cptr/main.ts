// WP66 S3: an opaque class is not a `CPtr`, though both lower to `i8*`:
// a `Db` is not passed where a `CPtr` is wanted.
declare class Db {}
declare function db_open(flags: i32): Db | null;
declare function db_close(db: Db): void;
declare function raw_close(p: CPtr): void;

export const main = (): i32 => {
  const db = db_open(1);
  if (db === null) {
    return 1;
  }
  raw_close(db);
  return 0;
};
