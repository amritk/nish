/**
 * `nish/map` — two operations on the global `Map` that JavaScript's does not
 * have, written so that a program using them still runs unmodified under Node
 * (docs/wp32-map.md §9.2).
 *
 * The bodies below are the meaning, and they are what runs under Node:
 * `reserve` does nothing, and `getOrInsert` is a `get`, and a `set` when the
 * key was missing. Natively neither body is ever called. The compiler lowers
 * every call in place, as it lowers `hashKey` and `sameKey`: `reserve` is the
 * table's `reserveSlots`, which grows the buckets so that `n` entries fit
 * without a rebuild, and `getOrInsert` is one `probe` of the key, then the
 * value it found or an insert through the empty bucket the probe stopped at,
 * with the hash it already computed. So this module writes no `.ll` of its
 * own, and a one-file program that imports it is still one module.
 */

/**
 * Make room in `m` for `n` entries in all, so that inserting up to `n` never
 * grows the table. Only the speed of a program depends on it: natively it
 * presizes the bucket table, and under Node, which has no such call, it does
 * nothing. A count that is not positive does nothing either way.
 */
export const reserve = <K, V>(m: Map<K, V>, n: number): void => {};

/**
 * The value of `key` in `m`; or, when `key` is missing, `value`, after
 * setting `key` to it. One hash and one probe natively, whichever it was.
 * `value` is evaluated either way, as every argument is.
 */
export const getOrInsert = <K, V>(m: Map<K, V>, key: K, value: V): V => {
  const found = m.get(key);
  if (found !== undefined) {
    return found;
  }
  m.set(key, value);
  return value;
};
