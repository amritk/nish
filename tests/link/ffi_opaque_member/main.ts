// WP66 S3: C keeps an opaque class's fields, so a member of one is refused.
declare class Db {}
declare function db_open(flags: i32): Db | null;

export const main = (): i32 => {
  const db = db_open(1);
  if (db === null) {
    return 1;
  }
  return db.handle;
};
