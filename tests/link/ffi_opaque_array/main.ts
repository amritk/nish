// WP66 S3: an opaque class is not an array element.
declare class Db {}
declare function db_open(flags: i32): Db | null;
declare function db_close(db: Db): void;

export const main = (): i32 => {
  const xs: Db[] = [];
  return xs.length;
};
