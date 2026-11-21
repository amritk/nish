// WP66 S3: a `Result` is arena memory, so an opaque class is not one of its
// arms, as a `CPtr` is not.
declare class Db {}
declare function db_open(flags: i32): Db | null;

const open = (): Result<i32, string> => {
  const db = db_open(1);
  if (db === null) {
    return Err("no db");
  }
  const r: Result<Db, string> = Ok(db);
  return r.isOk() ? Ok(1) : Err("unreachable");
};

export const main = (): i32 => {
  return open().unwrapOr(0);
};
