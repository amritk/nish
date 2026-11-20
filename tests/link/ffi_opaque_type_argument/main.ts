// WP66 S3: an opaque class is not a type argument of a generic class, which
// would hold the C pointer however its members spell `T`.
declare class Db {}
declare function db_open(flags: i32): Db | null;

class Empty<T> {
  n: i32 = 0;
}

export const main = (): i32 => {
  const e = new Empty<Db>();
  return e.n;
};
