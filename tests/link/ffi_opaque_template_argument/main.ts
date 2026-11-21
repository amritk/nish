// WP66 S3: an opaque class is not the inferred type argument of a generic
// function, which would take and give the C pointer as its own `T`.
declare class Db {}
declare function db_open(flags: i32): Db | null;

const same = <T>(x: T): T => x;

export const main = (): i32 => {
  const db = db_open(1);
  if (db === null) {
    return 1;
  }
  const d = same(db);
  return d === null ? 1 : 0;
};
