// WP66 S3: an opaque class lives where a `CPtr` may, so a field holding one
// is refused: the arena would own an address C frees.
declare class Db {}
declare function db_open(flags: i32): Db | null;

class Holder {
  db: Db | null = null;
}

export const main = (): i32 => {
  const h = new Holder();
  h.db = db_open(1);
  return h.db === null ? 1 : 0;
};
