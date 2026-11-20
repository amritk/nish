// WP66 S3: a `declare class` with no members is opaque -- the pointer type a
// C library hands out and takes back, lowered as `i8*` the way `CPtr` is, but
// with a name, so a `Stmt` is never passed where a `Db` is wanted. `Db | null`
// reads C's `NULL` as `null`; a plain `Stmt` result is C's promise of a
// pointer and panics on `NULL` (`ffi-null`), as a `string` result does.
// `ffi_opaque_handle.c` is the library and the driver: it runs `broken`, whose
// `stmt_prepare` breaks that promise, in a child and prints its exit status.
declare class Db {}
declare class Stmt {}

declare function db_open(flags: i32): Db | null;
declare function db_close(db: Db): void;
declare function stmt_prepare(db: Db, n: i32): Stmt;
declare function stmt_step(stmt: Stmt): i32;
declare function stmt_close(stmt: Stmt): void;

export const run = (flags: i32, n: i32): i32 => {
  const db = db_open(flags);
  if (db === null) {
    return -1;
  }
  const stmt = stmt_prepare(db, n);
  let sum = 0;
  let row = stmt_step(stmt);
  while (row > 0) {
    sum = sum + row;
    row = stmt_step(stmt);
  }
  stmt_close(stmt);
  db_close(db);
  return sum;
};

export const broken = (): i32 => {
  let db: Db | null = null;
  db = db_open(1);
  if (db === null) {
    return -1;
  }
  const stmt = stmt_prepare(db, -1);
  stmt_close(stmt);
  db_close(db);
  return 0;
};
