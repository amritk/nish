// WP66 S3: each opaque class is its own C pointer type, so a `Db` is not
// passed where a `Stmt` is wanted, though both lower to `i8*`.
declare class Db {}
declare class Stmt {}
declare function db_open(flags: i32): Db | null;
declare function stmt_close(stmt: Stmt): void;

export const main = (): i32 => {
  const db = db_open(1);
  if (db === null) {
    return 1;
  }
  stmt_close(db);
  return 0;
};
