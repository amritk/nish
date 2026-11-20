// WP66 S3: C makes an opaque class's values, so `new` of one is refused.
declare class Db {}
declare function db_close(db: Db): void;

export const main = (): i32 => {
  db_close(new Db());
  return 0;
};
