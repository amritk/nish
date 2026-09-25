// WP32 (docs/wp32-map.md §5.1): a `Result` has no identity and no equality worth hashing.
export const main = (): i32 => {
  new Map<Result<i32, string>, i32>();
  return 0;
};
