// WP66 S3: a `CPtr` is not an opaque class: C's untyped pointer is not
// passed where a `Db` is wanted.
declare class Db {}
declare function db_open(flags: i32): Db | null;
declare function db_close(db: Db): void;
declare function raw(): CPtr;

export const main = (): i32 => {
  db_close(raw());
  return 0;
};
