// WP66 S3: an opaque class lives where a `CPtr` may, so an arrow handed to a
// call does not capture one: the callee may keep the arrow, and the address
// with it, after C has freed it.
declare class Db {}
declare function db_open(flags: i32): Db | null;
declare function db_close(db: Db): void;

const later = (f: () => void): void => {
  f();
};

export const main = (): i32 => {
  const db = db_open(1);
  if (db === null) {
    return 1;
  }
  later(() => {
    db_close(db);
  });
  return 0;
};
