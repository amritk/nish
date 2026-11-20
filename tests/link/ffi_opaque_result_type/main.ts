// WP66 S3: an opaque class is not a `Result` arm in a written type either: a
// parameter, a return type or an annotation that spells `Result<Db, E>` is
// refused where it is written, as `Result<CPtr, E>` is.
declare class Db {}
declare function db_open(flags: i32): Db | null;

const opened = (r: Result<Db, string>): i32 => {
  return r.isOk() ? 1 : 0;
};

export const main = (): i32 => {
  return 0;
};
